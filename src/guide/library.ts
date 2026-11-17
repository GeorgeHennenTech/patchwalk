// The browser's side of the shared library (sounds, breaks, racks, songs). Everything here fails quietly
// into a plain message: with no database, or signed out, the Studio still works from this browser alone.
import type { LibEntry, LibKind } from "../store/library";
import { guideHeaders } from "./me";

export type { LibEntry, LibKind };
/** The largest sound file the library takes; bigger ones stay in the browser. Kept equal to the server's limit by a test. */
export const LIB_SOUND_MAX = 2 * 1024 * 1024;
export type LibOutcome<T> = { ok: true; value: T } | { ok: false; status: number; message: string };
export interface LibList { items: LibEntry[]; database: boolean; owner?: boolean; me?: string }

async function call<T>(body: unknown, fetchImpl: typeof fetch = fetch): Promise<LibOutcome<T>> {
  let res: Response;
  try { res = await fetchImpl("/api/library", { method: "POST", headers: guideHeaders(), body: JSON.stringify(body) }); } catch { return { ok: false, status: 0, message: "Could not reach the library." }; }
  const got = (await res.json().catch(() => undefined)) as (T & { message?: string }) | undefined;
  if (!res.ok || !got) return { ok: false, status: res.status, message: got?.message ?? `The library returned an error (${res.status}).` };
  return { ok: true, value: got };
}
export const libList = (kind: LibKind, f?: typeof fetch) => call<LibList>({ op: "list", kind }, f);
export const libGet = async (kind: LibKind, id: string, f?: typeof fetch): Promise<unknown> => { const r = await call<{ data?: unknown }>({ op: "get", kind, id }, f); return r.ok ? r.value.data : undefined; };
export const libPut = (kind: LibKind, name: string, data: unknown, about?: string, f?: typeof fetch) => call<{ entry?: LibEntry; already?: boolean; database?: boolean }>({ op: "put", kind, name: name.trim().slice(0, 60) || "Untitled", data, ...(about ? { about: about.slice(0, 120) } : {}) }, f);
export const libRemove = (kind: LibKind, id: string, f?: typeof fetch) => call<LibList>({ op: "remove", kind, id }, f);

export function toBase64(bytes: ArrayBuffer): string {
  const u = new Uint8Array(bytes);
  let s = "";
  for (let i = 0; i < u.length; i += 0x8000) s += String.fromCharCode(...u.subarray(i, i + 0x8000));
  return btoa(s);
}
export function fromBase64(text: string): ArrayBuffer {
  const s = atob(text), u = new Uint8Array(s.length);
  for (let i = 0; i < s.length; i++) u[i] = s.charCodeAt(i);
  return u.buffer;
}
/** A sound's id, made from its bytes the same way the library makes it: the same file is the same id in every browser. */
export async function soundHash(bytes: ArrayBuffer): Promise<string> {
  const d = new Uint8Array(await crypto.subtle.digest("SHA-256", bytes));
  return `h${[...d].map((b) => b.toString(16).padStart(2, "0")).join("").slice(0, 24)}`;
}
/** Send a sound to the library. Gives back a line to show the learner. */
export async function shareSound(name: string, bytes: ArrayBuffer, f?: typeof fetch): Promise<string> {
  if (bytes.byteLength > LIB_SOUND_MAX) return "Kept in this browser only: it is over 2 MB, the most the library takes.";
  const r = await libPut("sound", name, toBase64(bytes), undefined, f);
  if (r.ok) return r.value.database === false ? "Kept in this browser (this site has no library database)." : r.value.already ? "Already in the library." : "Saved to the library too.";
  return r.status === 401 ? "Kept in this browser only: sign in to save to the library." : `Kept in this browser only. ${r.message}`;
}
