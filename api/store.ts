// For the System check tab: whether the site's database is connected and really stores things.
// Behind the same password check as everything else.
import { gate } from "../src/lesson/auth.js";
import { listAccounts } from "../src/store/accounts.js";
import { kvFromEnv } from "../src/store/kv.js";

const json = (status: number, body: unknown) => new Response(JSON.stringify(body), { status, headers: { "content-type": "application/json", "cache-control": "no-store" } });

export async function GET(request: Request): Promise<Response> {
  const access = gate(request.headers.get("authorization"), { APP_PASSWORD: process.env.APP_PASSWORD, VERCEL: process.env.VERCEL });
  if (access === "locked") return json(503, { error: "locked", message: "This site is locked: APP_PASSWORD is not set on the server." });
  if (access === "denied") return json(401, { error: "unauthorized", message: "Password required." });
  const kv = kvFromEnv();
  if (!kv) return json(200, { configured: false });
  try {
    const stamp = Date.now();
    await kv.set("pw:check", stamp, 600);
    return json(200, { configured: true, working: (await kv.get<number>("pw:check")) === stamp, accounts: (await listAccounts(kv)).length, ownerSet: !!process.env.OWNER_EMAIL?.trim() });
  } catch (e) {
    console.error(e);
    return json(502, { error: "database", message: "The site's database could not be reached." });
  }
}
