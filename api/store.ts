// The people who use this site and what each has saved, kept in the project's database so it follows them to
// any device. Behind the same password check as everything else. GET lists the people (and, with ?player=,
// that person's saved things); POST adds or removes a person, or saves a person's things.
import { randomBytes } from "node:crypto";
import { gate } from "../src/lesson/auth.js";
import { kvFromEnv } from "../src/store/kv.js";
import { change, listPlayers, loadPlayer, StoreRequestSchema } from "../src/store/players.js";

const json = (status: number, body: unknown) => new Response(JSON.stringify(body), { status, headers: { "content-type": "application/json", "cache-control": "no-store" } });
const newId = () => randomBytes(6).toString("hex").slice(0, 10);

function guard(request: Request): Response | undefined {
  const access = gate(request.headers.get("authorization"), { APP_PASSWORD: process.env.APP_PASSWORD, VERCEL: process.env.VERCEL });
  if (access === "locked") return json(503, { error: "locked", message: "This site is locked: APP_PASSWORD is not set on the server." });
  if (access === "denied") return json(401, { error: "unauthorized", message: "Password required." });
  return undefined;
}

export async function GET(request: Request): Promise<Response> {
  const blocked = guard(request);
  if (blocked) return blocked;
  const kv = kvFromEnv();
  // No database is not an error: the site then keeps everything in each browser, as it always has.
  if (!kv) return json(200, { configured: false, players: [] });
  try {
    const params = new URL(request.url).searchParams, player = params.get("player");
    // The System check asks for a real round trip: write something, read it back.
    if (params.get("check")) { const stamp = Date.now(); await kv.set("pw:check", stamp, 600); return json(200, { configured: true, working: (await kv.get<number>("pw:check")) === stamp, players: await listPlayers(kv) }); }
    const players = await listPlayers(kv);
    if (!player) return json(200, { configured: true, players });
    const data = await loadPlayer(kv, player);
    return data ? json(200, { configured: true, players, data }) : json(404, { error: "no-player", message: "That person is not on this site's list." });
  } catch (e) {
    console.error(e);
    return json(502, { error: "database", message: "The site's database could not be reached." });
  }
}

export async function POST(request: Request): Promise<Response> {
  const blocked = guard(request);
  if (blocked) return blocked;
  const kv = kvFromEnv();
  if (!kv) return json(503, { error: "no-database", message: "This site has no database connected." });
  const raw = await request.text();
  if (raw.length > 700_000) return json(413, { error: "too-large", message: "Too much to save at once." });
  let body: unknown;
  try { body = JSON.parse(raw); } catch { return json(400, { error: "bad-json", message: "Request body is not JSON." }); }
  const parsed = StoreRequestSchema.safeParse(body);
  if (!parsed.success) return json(400, { error: "bad-request", message: "That request was not understood." });
  try {
    const out = await change(kv, parsed.data, newId);
    return json(out.status, out.body);
  } catch (e) {
    console.error(e);
    return json(502, { error: "database", message: "The site's database could not be reached." });
  }
}
