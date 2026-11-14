// Keeps one person's finished lessons and saved chats in step between this browser and the site's database,
// so they are there on any device. The browser's own storage stays the working copy (the app reads and
// writes it exactly as before); this module copies it up after a change and down when a person is chosen.
// Without a database none of this runs and the app behaves as it always did.
import { loadDone, saveDone } from "../course/progress";
import { loadChats, replaceChats, type SavedChat } from "./chats";
import { currentPlayer, setCurrentPlayer, type Me } from "./me";

export interface PlayerInfo { id: string; name: string; createdAt: string }
export interface Remote { lessons: string[]; chats: SavedChat[] }
export type StoreStatus = { configured: boolean; players: PlayerInfo[]; message?: string };

const call = async (fetchImpl: typeof fetch, init?: RequestInit, query = "") => {
  const res = await fetchImpl(`/api/store${query}`, init);
  const body = (await res.json().catch(() => undefined)) as Record<string, unknown> | undefined;
  return { ok: res.ok, status: res.status, body };
};

/** Whether the site has a database, and who is on its list. Any failure reads as "no database". */
export async function storeStatus(fetchImpl: typeof fetch = fetch): Promise<StoreStatus> {
  try {
    const { ok, body } = await call(fetchImpl);
    if (!ok || !body) return { configured: false, players: [], message: typeof body?.message === "string" ? body.message : undefined };
    return { configured: body.configured === true, players: Array.isArray(body.players) ? (body.players as PlayerInfo[]) : [] };
  } catch { return { configured: false, players: [] }; }
}
export async function addPlayer(name: string, fetchImpl: typeof fetch = fetch): Promise<{ player?: PlayerInfo; message?: string }> {
  try {
    const { ok, body } = await call(fetchImpl, { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify({ op: "add", name }) });
    return ok && body?.player ? { player: body.player as PlayerInfo } : { message: typeof body?.message === "string" ? body.message : "That name could not be added." };
  } catch { return { message: "Could not reach the site." }; }
}
export async function removePlayer(id: string, fetchImpl: typeof fetch = fetch): Promise<boolean> {
  try { return (await call(fetchImpl, { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify({ op: "remove", player: id }) })).ok; } catch { return false; }
}

/** Two copies of a person's things brought together: every finished lesson, and each chat's newest version. */
export function merge(a: Remote, b: Remote): Remote {
  const chats = new Map<string, SavedChat>();
  for (const c of [...a.chats, ...b.chats]) { const had = chats.get(c.id); if (!had || had.savedAt < c.savedAt) chats.set(c.id, c); }
  return { lessons: [...new Set([...a.lessons, ...b.lessons])], chats: [...chats.values()].sort((x, y) => (x.savedAt < y.savedAt ? 1 : -1)) };
}

const here = (): Remote => ({ lessons: loadDone(), chats: loadChats() });
/**
 * Copy this browser's lessons and chats up to the database for the person playing. Normally the database's
 * copy is read first and the two are joined, so something done on another device is never overwritten by an
 * older copy here (and it is brought into this browser too). `exact` skips that: after a deletion, the
 * database must match this browser.
 */
export async function pushNow(fetchImpl: typeof fetch = fetch, me: Me | undefined = currentPlayer(), exact = false): Promise<boolean> {
  if (!me) return false;
  try {
    let mine = here();
    if (!exact) {
      const { ok, body } = await call(fetchImpl, undefined, `?player=${encodeURIComponent(me.id)}`);
      if (!ok || !body?.data) return false;
      const joined = merge(body.data as Remote, mine);
      if (joined.lessons.length !== mine.lessons.length) saveDone(joined.lessons);
      if (joined.chats.length !== mine.chats.length) replaceChats(joined.chats);
      mine = joined;
    }
    return (await call(fetchImpl, { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify({ op: "save", player: me.id, ...mine }) })).ok;
  } catch { return false; }
}
let timer: ReturnType<typeof setTimeout> | undefined, exactNext = false;
/** Called after anything is saved locally: copies it up shortly afterwards (several quick changes make one request). */
export function schedulePush(exact?: boolean): void {
  if (typeof window === "undefined" || !currentPlayer()) return;
  exactNext ||= exact === true;
  if (timer) clearTimeout(timer);
  timer = setTimeout(() => { timer = undefined; const e = exactNext; exactNext = false; void pushNow(fetch, currentPlayer(), e); }, 1500);
}

/**
 * Start playing as someone. Their saved things come down from the database into this browser. If this
 * browser already held things that belong to nobody yet (it was used before the picker existed) and
 * `adoptLocal` is set, those are kept and joined in, so nothing done so far is lost. Otherwise the browser's
 * copy is replaced, because it belonged to whoever was playing before.
 */
export async function playAs(me: Me, adoptLocal: boolean, fetchImpl: typeof fetch = fetch): Promise<{ ok: boolean; message?: string }> {
  try {
    const before = currentPlayer();
    if (before && before.id !== me.id) await pushNow(fetchImpl, before);
    const { ok, body } = await call(fetchImpl, undefined, `?player=${encodeURIComponent(me.id)}`);
    if (!ok || !body?.data) return { ok: false, message: typeof body?.message === "string" ? body.message : "That person's saved things could not be loaded." };
    const remote = body.data as Remote;
    const next = adoptLocal ? merge(remote, here()) : { lessons: remote.lessons ?? [], chats: remote.chats ?? [] };
    saveDone(next.lessons); replaceChats(next.chats);
    setCurrentPlayer(me);
    if (adoptLocal) await pushNow(fetchImpl, me, true);
    return { ok: true };
  } catch { return { ok: false, message: "Could not reach the site." }; }
}
/** Stop playing as anyone on this browser, after copying the current person's things up. Local copies are cleared. */
export async function signOut(fetchImpl: typeof fetch = fetch): Promise<void> {
  await pushNow(fetchImpl);
  if (timer) { clearTimeout(timer); timer = undefined; }
  setCurrentPlayer(undefined);
  saveDone([]); replaceChats([]);
}
