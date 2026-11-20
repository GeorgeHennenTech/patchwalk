// The Sources shelf of the Library tab: a catalogue of every text in the private library, and a search that
// answers with short excerpts and page numbers. No call to Claude is made, so it needs the site's password
// and a signed-in account, and no key. A book's words never leave the server whole: a search returns at most
// a dozen excerpts of a few lines each, the same passages the guide itself would read.
import { z } from "zod";
import { accountOf, tokenOf } from "../src/store/accounts.js";
import { gate } from "../src/lesson/auth.js";
import { kvFromEnv } from "../src/store/kv.js";
import { search } from "../src/library/search.js";
import { HITS_MAX, snippet, type SourceHit } from "../src/library/catalog.js";
import { loadCatalog, loadLibrary } from "./_library.js";

const RequestSchema = z.discriminatedUnion("op", [
  z.object({ op: z.literal("list") }),
  z.object({ op: z.literal("search"), query: z.string().trim().min(2).max(200), book: z.string().regex(/^[a-z0-9][a-z0-9-]{0,80}$/).optional() }),
]);
const json = (status: number, body: unknown) =>
  new Response(JSON.stringify(body), { status, headers: { "content-type": "application/json", "cache-control": "no-store" } });

export async function POST(request: Request): Promise<Response> {
  const access = gate(request.headers.get("authorization"), { APP_PASSWORD: process.env.APP_PASSWORD, VERCEL: process.env.VERCEL });
  if (access === "locked") return json(503, { error: "locked", message: "This site is locked: APP_PASSWORD is not set on the server." });
  if (access === "denied") return json(401, { error: "unauthorized", message: "Password required." });
  const raw = await request.text();
  if (raw.length > 2_000) return json(413, { error: "too-large", message: "Request is too long." });
  let body: unknown;
  try { body = JSON.parse(raw); } catch { return json(400, { error: "bad-json", message: "Request body is not JSON." }); }
  const parsed = RequestSchema.safeParse(body);
  if (!parsed.success) return json(400, { error: "bad-request", message: "Search for two or more letters." });
  // Signed-in people only. On the deployed site with no database nobody can be signed in, so nothing is shown.
  const kv = kvFromEnv();
  if (kv) {
    try { if (!(await accountOf(kv, tokenOf(request.headers)))) return json(401, { error: "signed-out", message: "Sign in first (reload the page)." }); }
    catch (e) { console.error(e); return json(502, { error: "database", message: "The site's database could not be reached. Try again." }); }
  } else if (process.env.VERCEL) return json(503, { error: "no-database", message: "This site has no database, so nobody is signed in and the sources cannot be shown." });
  const req = parsed.data;
  if (req.op === "list") return json(200, { sources: loadCatalog() });
  const lib = loadLibrary(), only = req.book;
  const found = search(lib, req.query, HITS_MAX, { ...(only ? { only: (p) => p.id.startsWith(`${only}#`) } : { only: (p) => !p.id.startsWith("card:") }), perPage: 1 });
  const hits: SourceHit[] = found.map((h) => ({ book: (h.passage.of ?? h.passage.id).split("#")[0]!, page: h.passage.page ?? 0, chapter: h.passage.section, excerpt: snippet(h.passage.text, req.query), pictures: h.passage.images?.length ?? 0 }));
  return json(200, { hits });
}
