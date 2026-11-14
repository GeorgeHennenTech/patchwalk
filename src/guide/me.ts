// Who is using this browser, and (optionally) their own Claude key. Both are kept in this browser only.
// The key is sent with requests to the guide so that person's questions are billed to them; the server uses
// it for that one request and never stores it.
export interface Me { id: string; name: string }
const PLAYER = "patchwalk.player.v1", KEY = "patchwalk.ownkey.v1";
type Store = Pick<Storage, "getItem" | "setItem" | "removeItem">;
const local = (): Store | undefined => { try { return globalThis.localStorage; } catch { return undefined; } };

export function currentPlayer(storage: Pick<Storage, "getItem"> | undefined = local()): Me | undefined {
  try {
    const v = JSON.parse(storage?.getItem(PLAYER) ?? "null") as Me | null;
    return v && typeof v.id === "string" && typeof v.name === "string" ? v : undefined;
  } catch { return undefined; }
}
export function setCurrentPlayer(me: Me | undefined, storage: Store | undefined = local()): void {
  try { if (me) storage?.setItem(PLAYER, JSON.stringify(me)); else storage?.removeItem(PLAYER); } catch { /* not remembered */ }
}

export const looksLikeKey = (k: string) => /^sk-ant-[A-Za-z0-9_-]{20,300}$/.test(k.trim());
export function ownKey(storage: Pick<Storage, "getItem"> | undefined = local()): string | undefined {
  try { const k = storage?.getItem(KEY) ?? ""; return looksLikeKey(k) ? k : undefined; } catch { return undefined; }
}
export function setOwnKey(key: string | undefined, storage: Store | undefined = local()): boolean {
  try {
    if (!key) { storage?.removeItem(KEY); return true; }
    if (!looksLikeKey(key)) return false;
    storage?.setItem(KEY, key.trim());
    return !!storage;
  } catch { return false; }
}
/** Whether this browser has already been asked about using a key of one's own (asked once, never nagged). */
const ASKED = "patchwalk.keyasked.v1";
export const keyPromptSeen = (storage: Pick<Storage, "getItem"> | undefined = local()): boolean => {
  try { return storage?.getItem(ASKED) === "1"; } catch { return false; }
};
export function markKeyPromptSeen(storage: Store | undefined = local()): void {
  try { storage?.setItem(ASKED, "1"); } catch { /* asked again next time */ }
}
/** Headers for a request to the guide: JSON, plus this person's own key when they have set one. */
export function guideHeaders(storage: Pick<Storage, "getItem"> | undefined = local()): Record<string, string> {
  const key = ownKey(storage);
  return { "content-type": "application/json", ...(key ? { "x-anthropic-key": key } : {}) };
}
