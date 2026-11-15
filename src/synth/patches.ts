// The learner's own saved sounds on the practice synth. Kept in this browser only. A patch is the synth's
// whole state under a name; loading one fills in anything a newer version of the synth has added.
import { INITIAL, type SynthState } from "./params";

export interface Patch { name: string; savedAt: number; state: SynthState }
const KEY = "patchwalk.patches.v1";
export const MAX_PATCHES = 40;
type Store = Pick<Storage, "getItem" | "setItem">;
const local = (): Store | undefined => { try { return globalThis.localStorage; } catch { return undefined; } };

/** Settings as they should be loaded: only settings the synth knows, each of the right kind, the rest from a fresh synth. */
export function clean(raw: unknown): SynthState {
  const out = { ...INITIAL } as Record<string, unknown>, given = (raw && typeof raw === "object" ? raw : {}) as Record<string, unknown>;
  for (const k of Object.keys(INITIAL)) {
    const want = (INITIAL as unknown as Record<string, unknown>)[k], got = given[k];
    if (got === undefined || got === null) continue;
    if (Array.isArray(want) ? Array.isArray(got) : typeof got === typeof want && (typeof got !== "number" || Number.isFinite(got))) out[k] = got;
  }
  return out as unknown as SynthState;
}
export function loadPatches(s: Pick<Storage, "getItem"> | undefined = local()): Patch[] {
  try {
    const v = JSON.parse(s?.getItem(KEY) ?? "[]") as Patch[];
    return Array.isArray(v) ? v.filter((p) => p && typeof p.name === "string" && p.state).map((p) => ({ name: p.name, savedAt: Number(p.savedAt) || 0, state: clean(p.state) })) : [];
  } catch { return []; }
}
const store = (list: Patch[], s: Store | undefined) => { try { s?.setItem(KEY, JSON.stringify(list)); return true; } catch { return false; } };
/** Save under a name. The same name (in any capitals) is replaced; newest first; the oldest beyond the limit drop off. */
export function savePatch(name: string, state: SynthState, now: number, s: Store | undefined = local()): Patch[] {
  const tidy = name.trim().slice(0, 40) || "Untitled";
  const list = [{ name: tidy, savedAt: now, state }, ...loadPatches(s).filter((p) => p.name.toLowerCase() !== tidy.toLowerCase())].slice(0, MAX_PATCHES);
  store(list, s); return list;
}
export function deletePatch(name: string, s: Store | undefined = local()): Patch[] {
  const list = loadPatches(s).filter((p) => p.name !== name); store(list, s); return list;
}
/** A patch as a file's text, and back. Anything that is not a patch comes back undefined. */
export const toFile = (p: Patch) => JSON.stringify({ patchwalkPatch: 1, name: p.name, state: p.state }, null, 1);
export function fromFile(text: string): { name: string; state: SynthState } | undefined {
  try {
    const v = JSON.parse(text) as { patchwalkPatch?: number; name?: unknown; state?: unknown };
    return v?.patchwalkPatch === 1 && v.state && typeof v.state === "object" ? { name: typeof v.name === "string" ? v.name.slice(0, 40) : "Imported", state: clean(v.state) } : undefined;
  } catch { return undefined; }
}
