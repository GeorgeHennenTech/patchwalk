// The shared library of things people have made here: sounds, breaks, racks and songs. No call to Claude is
// made, so it needs the site's password and a signed-in account, and no key.
import { accountOf, isOwner, tokenOf } from "../src/store/accounts.js";
import { gate } from "../src/lesson/auth.js";
import { kvFromEnv } from "../src/store/kv.js";
import { getLib, LibRequestSchema, listLib, putLib, removeLib } from "../src/store/library.js";

const json = (status: number, body: unknown) =>
  new Response(JSON.stringify(body), { status, headers: { "content-type": "application/json", "cache-control": "no-store" } });

export async function POST(request: Request): Promise<Response> {
  const access = gate(request.headers.get("authorization"), { APP_PASSWORD: process.env.APP_PASSWORD, VERCEL: process.env.VERCEL });
  if (access === "locked") return json(503, { error: "locked", message: "This site is locked: APP_PASSWORD is not set on the server." });
  if (access === "denied") return json(401, { error: "unauthorized", message: "Password required." });
  const raw = await request.text();
  if (raw.length > 3_200_000) return json(413, { error: "too-large", message: "That is too big for the library." });
  let body: unknown;
  try { body = JSON.parse(raw); } catch { return json(400, { error: "bad-json", message: "Request body is not JSON." }); }
  const parsed = LibRequestSchema.safeParse(body);
  if (!parsed.success) return json(400, { error: "bad-request", message: "The library did not understand that request." });
  const req = parsed.data, kv = kvFromEnv();
  if (!kv) return json(200, req.op === "list" ? { items: [], database: false } : { error: "no-database", database: false, message: "This site has no database, so there is no shared library." });
  try {
    const me = await accountOf(kv, tokenOf(request.headers));
    if (!me) return json(401, { error: "signed-out", message: "Sign in first (reload the page)." });
    const owner = isOwner(me, process.env.OWNER_EMAIL);
    if (req.op === "list") return json(200, { items: await listLib(kv, req.kind), database: true, owner, me: me.id });
    if (req.op === "get") { const data = await getLib(kv, req.kind, req.id); return data === undefined ? json(404, { error: "gone", message: "That is no longer in the library." }) : json(200, { data }); }
    if (req.op === "put") { const r = await putLib(kv, req.kind, req.name, req.data, me, req.about); return r.ok ? json(200, { entry: r.entry, already: r.already === true }) : json(r.status, { error: "refused", message: r.message }); }
    const r = await removeLib(kv, req.kind, req.id, { id: me.id, owner });
    if (r === "not-yours") return json(403, { error: "not-yours", message: "Only the person who added it, or the owner, can remove it." });
    return json(200, { items: await listLib(kv, req.kind), database: true, owner, me: me.id });
  } catch (e) { console.error(e); return json(502, { error: "database", message: "The site's database could not be reached, or it refused something that large. Try again." }); }
}
