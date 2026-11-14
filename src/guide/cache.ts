// A small memory of what the guide has already answered on this device, so the same question (or the same
// "Show me where" on the same picture) is not paid for twice. It lives in this browser only. Entries are kept
// for a limited time because the library changes; anything remembered can be asked again fresh.
export const CACHE_DAYS = 30, CACHE_MAX = 200;

/** Two wordings count as the same question when they differ only in capitals, punctuation and spacing. */
export const sameQuestionKey = (q: string) => q.toLowerCase().replace(/[^\p{L}\p{N}]+/gu, " ").trim();

type Store = Pick<Storage, "getItem" | "setItem">;
interface Entry<T> { at: number; value: T }

export function remember<T>(name: string, key: string, value: T, now = Date.now(), storage: Store | undefined = globalThis.localStorage): void {
  try {
    const all = JSON.parse(storage?.getItem(name) ?? "{}") as Record<string, Entry<T>>;
    all[key] = { at: now, value };
    // newest kept when the memory is full
    const kept = Object.entries(all).sort((a, b) => b[1].at - a[1].at).slice(0, CACHE_MAX);
    storage?.setItem(name, JSON.stringify(Object.fromEntries(kept)));
  } catch { /* a browser that will not store things simply remembers nothing */ }
}
export function recall<T>(name: string, key: string, now = Date.now(), storage: Pick<Storage, "getItem"> | undefined = globalThis.localStorage): T | undefined {
  try {
    const hit = (JSON.parse(storage?.getItem(name) ?? "{}") as Record<string, Entry<T>>)[key];
    return hit && now - hit.at < CACHE_DAYS * 86_400_000 ? hit.value : undefined;
  } catch { return undefined; }
}
export const ANSWERS = "patchwalk.answers.v1", MARKS = "patchwalk.marks.v1";
