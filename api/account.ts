// Accounts: sign up, sign in, sign out, and each person's saved things. Behind the site's password like
// everything else. The rules are in src/store/accounts.ts.
import { randomBytes } from "node:crypto";
import { gate } from "../src/lesson/auth.js";
import { AccountRequestSchema, handle, sessionCookie, status, tokenOf } from "../src/store/accounts.js";
import { kvFromEnv } from "../src/store/kv.js";
import { mailerFromEnv } from "../src/store/mail.js";

const json = (code: number, body: unknown, cookie?: string) => new Response(JSON.stringify(body), { status: code, headers: { "content-type": "application/json", "cache-control": "no-store", ...(cookie ? { "set-cookie": cookie } : {}) } });

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
  // Off Vercel with no database there are no accounts; on Vercel the browser is told so it can say why.
  if (!kv) return json(200, { configured: false, deployed: !!process.env.VERCEL });
  try {
    const q = new URL(request.url).searchParams;
    return json(200, { ...(await status(kv, tokenOf(request.headers), process.env.OWNER_EMAIL, { data: !!q.get("data"), people: !!q.get("people") })), ownerSet: !!process.env.OWNER_EMAIL?.trim(), mail: !!mailerFromEnv() });
  } catch (e) {
    console.error(e);
    return json(502, { error: "database", message: "The site's database could not be reached." });
  }
}

export async function POST(request: Request): Promise<Response> {
  const blocked = guard(request);
  if (blocked) return blocked;
  const kv = kvFromEnv();
  if (!kv) return json(503, { error: "no-database", message: "This site has no database connected, so there are no accounts." });
  const raw = await request.text();
  if (raw.length > 700_000) return json(413, { error: "too-large", message: "Too much to save at once." });
  let body: unknown;
  try { body = JSON.parse(raw); } catch { return json(400, { error: "bad-json", message: "Request body is not JSON." }); }
  const parsed = AccountRequestSchema.safeParse(body);
  if (!parsed.success) {
    const field = String(parsed.error.issues[0]?.path[0] ?? "");
    return json(400, { error: "bad-request", message: field === "email" ? "That does not look like an email address." : field === "password" || field === "next" ? "A password needs at least 8 characters." : field === "name" ? "A name needs 1 to 24 characters." : "That request was not understood." });
  }
  try {
    const out = await handle(kv, parsed.data, { token: tokenOf(request.headers), ownerEmail: process.env.OWNER_EMAIL, newId: () => randomBytes(6).toString("hex").slice(0, 10), newToken: () => randomBytes(32).toString("hex"), mail: mailerFromEnv(),
      // the site's own address: the one Vercel knows it by, never one a request merely claims
      origin: process.env.VERCEL_PROJECT_PRODUCTION_URL ? `https://${process.env.VERCEL_PROJECT_PRODUCTION_URL}` : new URL(request.url).origin });
    return json(out.status, out.body, out.session === undefined ? undefined : sessionCookie(out.session, !!process.env.VERCEL));
  } catch (e) {
    console.error(e);
    return json(502, { error: "database", message: "The site's database could not be reached." });
  }
}
