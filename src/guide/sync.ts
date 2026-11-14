// Accounts in the browser: signing in and out, and keeping the signed-in person's finished lessons and saved
// chats in step between this browser and the site's database, so they are there on any device. The browser's
// own storage stays the working copy (the app reads and writes it exactly as before); this module copies it
// up after a change and down at sign-in. Without a database none of this runs.
import { loadDone, saveDone } from "../course/progress";
import { loadChats, replaceChats, type SavedChat } from "./chats";
import { currentPlayer, setCurrentPlayer } from "./me";

export interface AccountInfo { id: string; name: string; email: string; createdAt: string; owner: boolean }
export interface Remote { lessons: string[]; chats: SavedChat[] }
/**
 * open: no accounts here (a developer's machine with no database). signedOut / signedIn: as they say.
 * down: accounts cannot work right now (no database on the live site, or it cannot be reached).
 */
export type Session =
  | { state: "open" }
  | { state: "signedOut"; ownerSet: boolean; /** whether the site can email a reset link */ mail: boolean }
  | { state: "signedIn"; account: AccountInfo; ownerSet: boolean; people?: AccountInfo[] }
  | { state: "down"; message: string };

const post = (body: unknown): RequestInit => ({ method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify(body) });
const call = async (fetchImpl: typeof fetch, init?: RequestInit, query = "") => {
  const res = await fetchImpl(`/api/account${query}`, init);
  const body = (await res.json().catch(() => undefined)) as Record<string, unknown> | undefined;
  return { ok: res.ok, status: res.status, body };
};
const said = (body: Record<string, unknown> | undefined, fallback: string) => (typeof body?.message === "string" ? body.message : fallback);

/** Who is signed in on this browser, as the server sees it. */
export async function session(fetchImpl: typeof fetch = fetch): Promise<Session> {
  try {
    const { ok, body } = await call(fetchImpl, undefined, "?people=1");
    if (!ok || !body) return { state: "down", message: said(body, "The site could not say who is signed in.") };
    if (body.configured !== true) return body.deployed ? { state: "down", message: "This site has no database connected, so nobody can sign in." } : { state: "open" };
    const ownerSet = body.ownerSet === true;
    return body.account ? { state: "signedIn", account: body.account as AccountInfo, ownerSet, ...(Array.isArray(body.people) ? { people: body.people as AccountInfo[] } : {}) } : { state: "signedOut", ownerSet, mail: body.mail === true };
  } catch { return { state: "down", message: "Could not reach the site." }; }
}

/** Two copies of a person's things brought together: every finished lesson, and each chat's newest version. */
export function merge(a: Remote, b: Remote): Remote {
  const chats = new Map<string, SavedChat>();
  for (const c of [...a.chats, ...b.chats]) { const had = chats.get(c.id); if (!had || had.savedAt < c.savedAt) chats.set(c.id, c); }
  return { lessons: [...new Set([...a.lessons, ...b.lessons])], chats: [...chats.values()].sort((x, y) => (x.savedAt < y.savedAt ? 1 : -1)) };
}

const here = (): Remote => ({ lessons: loadDone(), chats: loadChats() });
const signedInHere = () => currentPlayer()?.account === true;
/**
 * Copy this browser's lessons and chats up to the database for the signed-in person. Normally the database's
 * copy is read first and the two are joined, so something done on another device is never overwritten by an
 * older copy here (and it is brought into this browser too). `exact` skips that: after a deletion, the
 * database must match this browser.
 */
export async function pushNow(fetchImpl: typeof fetch = fetch, exact = false): Promise<boolean> {
  if (!signedInHere()) return false;
  try {
    let mine = here();
    if (!exact) {
      const { ok, body } = await call(fetchImpl, undefined, "?data=1");
      // someone else's session (or none) must never receive this browser's copy
      if (!ok || !body?.data || (body.account as AccountInfo | undefined)?.id !== currentPlayer()?.id) return false;
      const joined = merge(body.data as Remote, mine);
      if (joined.lessons.length !== mine.lessons.length) saveDone(joined.lessons);
      if (joined.chats.length !== mine.chats.length) replaceChats(joined.chats);
      mine = joined;
    }
    return (await call(fetchImpl, post({ op: "save", ...mine }))).ok;
  } catch { return false; }
}
let timer: ReturnType<typeof setTimeout> | undefined, exactNext = false;
/** Called after anything is saved locally: copies it up shortly afterwards (several quick changes make one request). */
export function schedulePush(exact?: boolean): void {
  if (typeof window === "undefined" || !signedInHere()) return;
  exactNext ||= exact === true;
  if (timer) clearTimeout(timer);
  timer = setTimeout(() => { timer = undefined; const e = exactNext; exactNext = false; void pushNow(fetch, e); }, 1500);
}

/**
 * Bring a just-signed-in person's things into this browser. What the browser already holds is kept and
 * joined in when it is theirs (the same account), or belongs to nobody with an account (it was used before
 * accounts existed). Otherwise it is replaced: it belonged to whoever was signed in before.
 */
async function enter(account: AccountInfo, fetchImpl: typeof fetch): Promise<{ ok: boolean; message?: string }> {
  const before = currentPlayer();
  const keep = !before || !before.account || before.id === account.id;
  const { ok, body } = await call(fetchImpl, undefined, "?data=1");
  if (!ok || !body?.data) return { ok: false, message: said(body, "Your saved things could not be loaded.") };
  const remote = body.data as Remote;
  const next = keep ? merge(remote, here()) : { lessons: remote.lessons ?? [], chats: remote.chats ?? [] };
  saveDone(next.lessons); replaceChats(next.chats);
  setCurrentPlayer({ id: account.id, name: account.name, account: true });
  if (keep) await pushNow(fetchImpl, true);
  return { ok: true };
}
type Outcome = { ok: boolean; message?: string };
const begin = async (request: unknown, fallback: string, fetchImpl: typeof fetch): Promise<Outcome> => {
  try {
    const { ok, body } = await call(fetchImpl, post(request));
    if (!ok || !body?.account) return { ok: false, message: said(body, fallback) };
    return await enter(body.account as AccountInfo, fetchImpl);
  } catch { return { ok: false, message: "Could not reach the site." }; }
};
export const signUp = (name: string, email: string, password: string, fetchImpl: typeof fetch = fetch) => begin({ op: "signup", name, email, password }, "The account could not be made.", fetchImpl);
export const signIn = (email: string, password: string, fetchImpl: typeof fetch = fetch) => begin({ op: "signin", email, password }, "Could not sign in.", fetchImpl);

/** Ask for a reset link by email. The answer is the same whether or not the email has an account. */
export function forgotPassword(email: string, f: typeof fetch = fetch): Promise<Outcome> { return simple({ op: "forgot", email }, "The email could not be sent.", f); }
/** Use a reset link: set the new password and sign in. */
export const recover = (token: string, next: string, fetchImpl: typeof fetch = fetch) => begin({ op: "recover", token, next }, "The password was not changed.", fetchImpl);

/** Line a browser up with the server's session on page load: nothing is copied up for a session that has ended. */
export function settle(s: Session): void {
  const me = currentPlayer();
  if (s.state === "signedIn" && me?.account && me.id === s.account.id) { if (me.name !== s.account.name) setCurrentPlayer({ ...me, name: s.account.name }); return; }
  if (s.state === "signedIn") { void enter(s.account, fetch).then((r) => { if (r.ok) window.location.reload(); }); }
}

/** Sign out on this browser, after copying the person's things up. Local copies are cleared. */
export async function signOut(fetchImpl: typeof fetch = fetch): Promise<void> {
  await pushNow(fetchImpl);
  if (timer) { clearTimeout(timer); timer = undefined; }
  try { await call(fetchImpl, post({ op: "signout" })); } catch { /* the cookie will simply expire */ }
  setCurrentPlayer(undefined);
  saveDone([]); replaceChats([]);
}
const simple = async (request: unknown, fallback: string, fetchImpl: typeof fetch): Promise<Outcome> => {
  try { const { ok, body } = await call(fetchImpl, post(request)); return ok ? { ok } : { ok, message: said(body, fallback) }; }
  catch { return { ok: false, message: "Could not reach the site." }; }
};
export const changePassword = (old: string, next: string, f: typeof fetch = fetch) => simple({ op: "password", old, next }, "The password was not changed.", f);
export const resetPassword = (account: string, next: string, f: typeof fetch = fetch) => simple({ op: "reset", account, next }, "The password was not changed.", f);
export const removeAccount = (account: string, f: typeof fetch = fetch) => simple({ op: "remove", account }, "The account was not removed.", f);
