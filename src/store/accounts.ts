// Accounts: each person signs in with an email and a password. Server only.
// - Passwords are never stored: only a salted scrypt hash. Sessions are random tokens kept in an HttpOnly
//   cookie; the database holds a hash of the token, not the token.
// - One account is the owner's: the one whose email matches OWNER_EMAIL, set on the server by the owner.
//   Only that account may spend the site's own Claude key (`payer`). Everyone else needs a key of their own.
//   With OWNER_EMAIL unset there is no owner, so nobody spends the site's key.
// - Emails are not verified (the site sends no mail), so the owner must create their account before setting
//   OWNER_EMAIL, or at least check that it is theirs.
// The request handling is here, not in api/, so it can be tested with a store kept in memory.
import { createHash, randomBytes, scryptSync, timingSafeEqual } from "node:crypto";
import { z } from "zod";
import type { Kv } from "./kv.js";

export interface Account { id: string; name: string; email: string; createdAt: string }
export interface AccountView extends Account { owner: boolean }
export interface AccountData { lessons: string[]; chats: unknown[] }
interface Secret { salt: string; hash: string }

export const MAX_ACCOUNTS = 12, MAX_DATA_BYTES = 600_000, SESSION_SECONDS = 30 * 24 * 3600, MAX_FAILS = 8, LOCK_SECONDS = 15 * 60;
const LIST = "pw:accounts";
const sha = (s: string) => createHash("sha256").update(s).digest("hex");
const secretKey = (id: string) => `pw:acct:${id}`, dataKey = (id: string) => `pw:a:${id}`;
const resetKey = (token: string) => `pw:reset:${sha(token)}`, askedKey = (email: string) => `pw:asked:${sha(email)}`;
export const RESET_SECONDS = 30 * 60, ASK_AGAIN_SECONDS = 120;
const sessionKey = (token: string) => `pw:sess:${sha(token)}`, failKey = (email: string) => `pw:fail:${sha(email)}`;

const Email = z.string().trim().toLowerCase().max(120).regex(/^[^\s@]+@[^\s@]+\.[^\s@]+$/);
const Password = z.string().min(8).max(200);
const Id = z.string().regex(/^[a-z0-9]{6,16}$/);
export const AccountRequestSchema = z.discriminatedUnion("op", [
  z.object({ op: z.literal("signup"), name: z.string().trim().min(1).max(24), email: Email, password: Password }),
  z.object({ op: z.literal("signin"), email: Email, password: z.string().max(200) }),
  z.object({ op: z.literal("signout") }),
  z.object({ op: z.literal("forgot"), email: Email }),
  z.object({ op: z.literal("recover"), token: z.string().regex(/^[a-f0-9]{64}$/), next: Password }),
  z.object({ op: z.literal("save"), lessons: z.array(z.string().max(20)).max(2000), chats: z.array(z.unknown()).max(60) }),
  z.object({ op: z.literal("password"), old: z.string().max(200), next: Password }),
  z.object({ op: z.literal("reset"), account: Id, next: Password }),
  z.object({ op: z.literal("remove"), account: Id }),
]);
export type AccountRequest = z.infer<typeof AccountRequestSchema>;

const hashOf = (password: string, salt: string) => scryptSync(password, salt, 32).toString("hex");
const sealed = (password: string): Secret => { const salt = randomBytes(16).toString("hex"); return { salt, hash: hashOf(password, salt) }; };
const matches = (password: string, s: Secret | undefined): boolean => {
  // always do the work, so a missing account takes as long as a wrong password
  const got = Buffer.from(hashOf(password, s?.salt ?? "0".repeat(32)), "hex"), want = Buffer.from(s?.hash ?? "0".repeat(64), "hex");
  return got.length === want.length && timingSafeEqual(got, want) && !!s;
};

export const isOwner = (a: Pick<Account, "email">, ownerEmail: string | undefined) => !!ownerEmail?.trim() && a.email === ownerEmail.trim().toLowerCase();
const view = (a: Account, ownerEmail: string | undefined): AccountView => ({ ...a, owner: isOwner(a, ownerEmail) });
export const listAccounts = async (kv: Kv) => (await kv.get<Account[]>(LIST)) ?? [];

/** The session token a request carries in its cookie, if any. */
export function tokenOf(headers: Headers): string | undefined {
  return /(?:^|;\s*)pw_session=([a-f0-9]{64})(?:;|$)/.exec(headers.get("cookie") ?? "")?.[1];
}
export const sessionCookie = (token: string | null, secure: boolean) =>
  `pw_session=${token ?? ""}; Path=/; HttpOnly; SameSite=Lax; Max-Age=${token ? SESSION_SECONDS : 0}${secure ? "; Secure" : ""}`;

/** The account a session token belongs to. */
export async function accountOf(kv: Kv, token: string | undefined): Promise<Account | undefined> {
  if (!token) return undefined;
  const id = await kv.get<string>(sessionKey(token));
  return id ? (await listAccounts(kv)).find((a) => a.id === id) : undefined;
}
export async function loadData(kv: Kv, id: string): Promise<AccountData> {
  const d = await kv.get<Partial<AccountData>>(dataKey(id));
  return { lessons: Array.isArray(d?.lessons) ? d!.lessons! : [], chats: Array.isArray(d?.chats) ? d!.chats! : [] };
}

/** What a browser is told about itself: who is signed in, and, on request, their saved things and (owner only) everyone. */
export async function status(kv: Kv, token: string | undefined, ownerEmail: string | undefined, want: { data?: boolean; people?: boolean } = {}): Promise<Record<string, unknown>> {
  const me = await accountOf(kv, token);
  if (!me) return { configured: true };
  const mine = view(me, ownerEmail);
  return {
    configured: true, account: mine,
    ...(want.data ? { data: await loadData(kv, me.id) } : {}),
    ...(want.people && mine.owner ? { people: (await listAccounts(kv)).map((a) => view(a, ownerEmail)) } : {}),
  };
}

export type AccountResult = { status: number; body: Record<string, unknown>; /** a new session to set, or null to clear it */ session?: string | null };
const no = (status: number, error: string, message: string): AccountResult => ({ status, body: { error, message } });
interface Ctx { token?: string; ownerEmail?: string; newId: () => string; newToken: () => string; now?: Date;
  /** Sends one email; absent when the site has no mail service. */ mail?: (to: string, subject: string, text: string) => Promise<boolean>;
  /** The site's own address, for the link in a reset email. */ origin?: string }

/** Carry out one request. Ids, tokens and the time are passed in so tests are repeatable. */
export async function handle(kv: Kv, req: AccountRequest, ctx: Ctx): Promise<AccountResult> {
  const accounts = await listAccounts(kv);
  const open = async (a: Account): Promise<AccountResult> => {
    const token = ctx.newToken();
    await kv.set(sessionKey(token), a.id, SESSION_SECONDS);
    return { status: 200, body: { account: view(a, ctx.ownerEmail) }, session: token };
  };
  if (req.op === "signup") {
    if (accounts.length >= MAX_ACCOUNTS) return no(409, "full", `This site holds ${MAX_ACCOUNTS} accounts at most. Ask the owner to remove one.`);
    if (accounts.some((a) => a.email === req.email)) return no(409, "email-taken", "There is already an account with that email. Sign in instead.");
    if (accounts.some((a) => a.name.toLowerCase() === req.name.toLowerCase())) return no(409, "name-taken", "Someone already uses that name here. Choose another.");
    const account: Account = { id: ctx.newId(), name: req.name, email: req.email, createdAt: (ctx.now ?? new Date()).toISOString() };
    await kv.set(secretKey(account.id), sealed(req.password));
    await kv.set(LIST, [...accounts, account]);
    return open(account);
  }
  if (req.op === "signin") {
    const fails = (await kv.get<number>(failKey(req.email))) ?? 0;
    if (fails >= MAX_FAILS) return no(429, "locked-out", "Too many wrong passwords for that email. Wait fifteen minutes and try again.");
    const account = accounts.find((a) => a.email === req.email);
    if (!matches(req.password, account && (await kv.get<Secret>(secretKey(account.id)))) || !account) {
      await kv.set(failKey(req.email), fails + 1, LOCK_SECONDS);
      return no(401, "wrong", "That email and password do not match an account here.");
    }
    await kv.del(failKey(req.email));
    return open(account);
  }
  if (req.op === "signout") {
    if (ctx.token) await kv.del(sessionKey(ctx.token));
    return { status: 200, body: { signedOut: true }, session: null };
  }
  if (req.op === "forgot") {
    if (!ctx.mail || !ctx.origin) return no(503, "no-mail", "This site cannot send email yet. Ask the site’s owner to set a new password for you.");
    // the same answer whether or not the email has an account, so the form cannot be used to find out who is here
    const said: AccountResult = { status: 200, body: { sent: true } };
    const account = accounts.find((a) => a.email === req.email);
    if (!account || (await kv.get<number>(askedKey(req.email)))) return said;
    const token = ctx.newToken();
    await kv.set(resetKey(token), account.id, RESET_SECONDS);
    await kv.set(askedKey(req.email), 1, ASK_AGAIN_SECONDS);
    const sent = await ctx.mail(account.email, "Choose a new Patchwalk password", `Hello ${account.name},\n\nOpen this link to choose a new password. It works once, for 30 minutes:\n\n${ctx.origin}/?reset=${token}\n\nIf you did not ask for this, ignore this email: your password stays as it is.\n`);
    return sent ? said : no(502, "mail-failed", "The email could not be sent. Try again in a few minutes, or ask the site’s owner to set a new password for you.");
  }
  if (req.op === "recover") {
    const id = await kv.get<string>(resetKey(req.token)), account = accounts.find((a) => a.id === id);
    if (!account) return no(410, "link-used", "That link has been used or has run out. Ask for a new one.");
    await kv.set(secretKey(account.id), sealed(req.next));
    await kv.del(resetKey(req.token)); await kv.del(failKey(account.email));
    return open(account);
  }
  const me = await accountOf(kv, ctx.token);
  if (!me) return no(401, "signed-out", "Sign in first.");
  if (req.op === "save") {
    const data: AccountData = { lessons: [...new Set(req.lessons)], chats: req.chats };
    if (JSON.stringify(data).length > MAX_DATA_BYTES) return no(413, "too-large", "Too much to save. Delete some saved chats and try again.");
    await kv.set(dataKey(me.id), data);
    return { status: 200, body: { saved: true } };
  }
  if (req.op === "password") {
    if (!matches(req.old, await kv.get<Secret>(secretKey(me.id)))) return no(401, "wrong", "The current password is not right.");
    await kv.set(secretKey(me.id), sealed(req.next));
    return { status: 200, body: { changed: true } };
  }
  // the rest act on an account: your own, or anyone's if you are the owner
  const target = accounts.find((a) => a.id === req.account);
  if (!target) return no(404, "no-account", "That account does not exist.");
  const owner = isOwner(me, ctx.ownerEmail);
  if (req.op === "reset") {
    if (!owner) return no(403, "owner-only", "Only the site's owner can set someone else's password.");
    await kv.set(secretKey(target.id), sealed(req.next));
    return { status: 200, body: { changed: true } };
  }
  if (!owner && target.id !== me.id) return no(403, "owner-only", "Only the site's owner can remove someone else.");
  await kv.set(LIST, accounts.filter((a) => a.id !== target.id));
  await kv.del(secretKey(target.id)); await kv.del(dataKey(target.id));
  return { status: 200, body: { removed: true }, ...(target.id === me.id ? { session: null } : {}) };
}

export type Payer = { ok: true; /** the person's own key; undefined means the site's key */ key?: string } | { ok: false; status: number; body: { error: string; message: string } };
/**
 * Who pays for a call to Claude. A key the person sent with the request is theirs to spend. The site's own
 * key is spent only for the owner's account. Anyone else is refused, as is anyone not signed in.
 * Off Vercel with no database (a developer's own machine) there are no accounts and the local key is used.
 */
export async function payer(kv: Kv | undefined, headers: Headers, own: string | undefined, env: { VERCEL?: string; OWNER_EMAIL?: string; ANTHROPIC_API_KEY?: string }): Promise<Payer> {
  const off = { ok: false as const, status: 503, body: { error: "not-configured", message: "The guide is switched off: no ANTHROPIC_API_KEY is set on the server." } };
  if (!kv) {
    if (env.VERCEL) return { ok: false, status: 503, body: { error: "no-database", message: "The guide is off: this site has no database for accounts, so nobody can be recognised." } };
    return own ? { ok: true, key: own } : env.ANTHROPIC_API_KEY ? { ok: true } : off;
  }
  let me: Account | undefined;
  try { me = await accountOf(kv, tokenOf(headers)); }
  catch { return { ok: false, status: 502, body: { error: "database", message: "The site's database could not be reached, so you could not be recognised. Try again." } }; }
  if (!me) return { ok: false, status: 401, body: { error: "signed-out", message: "Sign in first (reload the page)." } };
  if (own) return { ok: true, key: own };
  if (!isOwner(me, env.OWNER_EMAIL)) return { ok: false, status: 402, body: { error: "needs-key", message: "This needs a Claude key of your own. Open “Account” at the top of the page: the steps for getting one are there." } };
  return env.ANTHROPIC_API_KEY ? { ok: true } : off;
}
