// Saved conversations with the guide. They are kept in this browser only (nothing is sent anywhere), so they
// are there next time on the same device and browser, and nowhere else.
import type { Turn } from "./ask";

export interface SavedChat { id: string; title: string; savedAt: string; turns: Turn[] }
const KEY = "patchwalk.chats.v1";
export const MAX_CHATS = 60;

/** Only finished turns are worth keeping. */
const finished = (turns: Turn[]) => turns.filter((t) => t.outcome);
const valid = (c: unknown): c is SavedChat => !!c && typeof c === "object" && typeof (c as SavedChat).id === "string" && typeof (c as SavedChat).title === "string" && Array.isArray((c as SavedChat).turns);

export function loadChats(storage: Pick<Storage, "getItem"> | undefined = globalThis.localStorage): SavedChat[] {
  try {
    const raw = JSON.parse(storage?.getItem(KEY) ?? "[]") as unknown;
    return Array.isArray(raw) ? raw.filter(valid) : [];
  } catch { return []; }
}
/** Called after the saved chats change, so they can be copied to the site's database. Set by the app. */
let changed: (exact?: boolean) => void = () => {};
/** `exact` is true after a deletion: the copy in the database must then match this browser's, not be joined with it. */
export const onChatsChanged = (fn: (exact?: boolean) => void) => { changed = fn; };
function store(chats: SavedChat[], storage: Pick<Storage, "setItem"> | undefined, exact = false): boolean {
  try { storage?.setItem(KEY, JSON.stringify(chats)); if (storage) changed(exact); return !!storage; } catch { return false; }
}
/** Replace every saved chat at once (when a person's chats arrive from the database). Does not report a change. */
export function replaceChats(chats: SavedChat[], storage: Pick<Storage, "setItem"> | undefined = globalThis.localStorage): void {
  try { storage?.setItem(KEY, JSON.stringify(chats.filter(valid).slice(0, MAX_CHATS))); } catch { /* not kept */ }
}
/**
 * Save a conversation, newest first. Saving one that is already saved (same id) replaces it, so a chat can be
 * saved again after more questions. Returns the new list, or null if the browser would not store it.
 */
export function saveChat(chat: { id?: string; turns: Turn[] }, now = new Date(), storage: Pick<Storage, "getItem" | "setItem"> | undefined = globalThis.localStorage): { id: string; chats: SavedChat[] } | null {
  const turns = finished(chat.turns);
  if (!turns.length) return null;
  const id = chat.id ?? `c${now.getTime().toString(36)}${Math.random().toString(36).slice(2, 6)}`;
  const title = turns[0]!.question.length > 70 ? `${turns[0]!.question.slice(0, 67)}…` : turns[0]!.question;
  const chats = [{ id, title, savedAt: now.toISOString(), turns }, ...loadChats(storage).filter((c) => c.id !== id)].slice(0, MAX_CHATS);
  return store(chats, storage) ? { id, chats } : null;
}
export function deleteChat(id: string, storage: Pick<Storage, "getItem" | "setItem"> | undefined = globalThis.localStorage): SavedChat[] {
  const chats = loadChats(storage).filter((c) => c.id !== id);
  store(chats, storage, true);
  return chats;
}
