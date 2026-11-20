// The browser's side of the Library tab's Sources shelf: the catalogue of texts, and a search that comes
// back with short excerpts. Fails quietly into a plain message.
import type { SourceCard, SourceHit } from "../library/catalog";
import { guideHeaders } from "./me";

export type SourcesOutcome<T> = { ok: true; value: T } | { ok: false; message: string };
async function call<T>(body: unknown, fetchImpl: typeof fetch = fetch): Promise<SourcesOutcome<T>> {
  let res: Response;
  try { res = await fetchImpl("/api/sources", { method: "POST", headers: guideHeaders(), body: JSON.stringify(body) }); } catch { return { ok: false, message: "Could not reach the library." }; }
  const got = (await res.json().catch(() => undefined)) as (T & { message?: string }) | undefined;
  if (!res.ok || !got) return { ok: false, message: got?.message ?? `The library returned an error (${res.status}).` };
  return { ok: true, value: got };
}
export const listSources = (f?: typeof fetch) => call<{ sources: SourceCard[] }>({ op: "list" }, f);
export const searchSources = (query: string, book?: string, f?: typeof fetch) => call<{ hits: SourceHit[] }>({ op: "search", query: query.trim().slice(0, 200), ...(book ? { book } : {}) }, f);
