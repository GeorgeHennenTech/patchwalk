// The devices (effects) that can sit on a track, after its instrument, in a row: the Studio's own versions of
// a DAW's stock plugins. This file is the plain data and rules: what devices exist, their settings and ranges,
// and the edits to a track's chain. No sound here; `fxnodes.ts` makes the audio from the same settings.
// The devices are our own, built from what each kind of effect does. They are named for what they do, the
// way every DAW names them; they are not copies of any maker's code, sound or look.

export interface ParamSpec { id: string; label: string; min: number; max: number; step: number; def: number; unit?: string; /** for a switch or a menu: the names of the values 0, 1, 2... */ choices?: string[] }
export interface DeviceSpec { kind: string; name: string; about: string; /** the stock device in Ableton Live that does the same job, so a chain built here can be rebuilt there */ like: string; params: ParamSpec[] }
export interface Device { id: string; kind: string; on: boolean; /** each setting's value, by its id */ p: Record<string, number> }

const sw = (id: string, label: string, def = 0): ParamSpec => ({ id, label, min: 0, max: 1, step: 1, def, choices: ["Off", "On"] });

export const DEVICES: DeviceSpec[] = [
  { kind: "utility", name: "Utility", like: "Utility", about: "Level, left and right, width, and flipping a side upside down. The plain tool for fixing a track.", params: [
    { id: "gain", label: "Gain", min: -36, max: 24, step: 0.5, def: 0, unit: "dB" },
    { id: "pan", label: "Pan", min: -100, max: 100, step: 1, def: 0 },
    { id: "width", label: "Width", min: 0, max: 200, step: 1, def: 100, unit: "%" },
    sw("mono", "Mono"), sw("flipL", "Flip left"), sw("flipR", "Flip right"), sw("mute", "Mute"),
  ] },
];
export const MAX_DEVICES = 8;
export const specOf = (kind: string): DeviceSpec | undefined => DEVICES.find((d) => d.kind === kind);
const clamp = (v: number, lo: number, hi: number) => Math.min(hi, Math.max(lo, v));
/** A setting's value kept inside its range and on its step. */
export const tidyParam = (s: ParamSpec, v: unknown): number => { const n = Number(v); return Number.isFinite(n) ? clamp(Math.round(n / s.step) * s.step, s.min, s.max) : s.def; };
const freeId = (taken: readonly string[]) => { let n = 1; while (taken.includes(`d${n}`)) n++; return `d${n}`; };

export function newDevice(kind: string, taken: readonly string[] = []): Device | undefined {
  const spec = specOf(kind);
  return spec ? { id: freeId(taken), kind, on: true, p: Object.fromEntries(spec.params.map((s) => [s.id, s.def])) } : undefined;
}
/** Add a device to the end of a chain. Nothing happens when the kind is unknown or the chain is full. */
export function addDevice(chain: Device[], kind: string): Device[] {
  const d = chain.length < MAX_DEVICES ? newDevice(kind, chain.map((x) => x.id)) : undefined;
  return d ? [...chain, d] : chain;
}
export const removeDevice = (chain: Device[], id: string): Device[] => chain.filter((d) => d.id !== id);
export const toggleDevice = (chain: Device[], id: string): Device[] => chain.map((d) => (d.id === id ? { ...d, on: !d.on } : d));
export function setDeviceParam(chain: Device[], id: string, param: string, value: number): Device[] {
  return chain.map((d) => { const s = d.id === id ? specOf(d.kind)?.params.find((x) => x.id === param) : undefined; return s ? { ...d, p: { ...d.p, [param]: tidyParam(s, value) } } : d; });
}
/** Move a device one place earlier (-1) or later (1) in the chain. */
export function moveDevice(chain: Device[], id: string, by: -1 | 1): Device[] {
  const i = chain.findIndex((d) => d.id === id), j = i + by;
  if (i < 0 || j < 0 || j >= chain.length) return chain;
  const next = [...chain]; [next[i], next[j]] = [next[j]!, next[i]!];
  return next;
}
/** A chain read back from storage, made safe: unknown devices dropped, every setting in range, ids different. */
export function tidyDevices(raw: unknown): Device[] {
  const out: Device[] = [];
  for (const g of Array.isArray(raw) ? raw : []) {
    const spec = g && typeof g === "object" ? specOf((g as Device).kind) : undefined;
    if (!spec || out.length >= MAX_DEVICES) continue;
    const taken = out.map((d) => d.id), id = typeof g.id === "string" && /^[\w-]{1,16}$/.test(g.id) && !taken.includes(g.id) ? g.id : freeId(taken);
    out.push({ id, kind: spec.kind, on: g.on !== false, p: Object.fromEntries(spec.params.map((s) => [s.id, tidyParam(s, (g.p ?? {})[s.id] ?? s.def)])) });
  }
  return out;
}
/** What tells one arrangement of devices from another: when this changes the audio has to be wired again; a setting alone never changes it. */
export const chainShape = (chain: Device[]): string => chain.map((d) => `${d.id}:${d.kind}`).join(">");

// ---- the maths each device's audio is built from, here so that tests and the audio share one definition ----
export const dbToGain = (db: number) => 10 ** (db / 20);
/**
 * Utility's four gains: how much of the left and right inputs goes to each output. Width 100% leaves the two
 * sides alone, 0% (or Mono) makes them the same, 200% doubles what differs between them; a flipped side is
 * turned upside down before any of that.
 */
export function utilityMatrix(p: Record<string, number>): { ll: number; rl: number; lr: number; rr: number; gain: number } {
  const w = p.mono ? 0 : clamp((p.width ?? 100) / 100, 0, 2), sl = p.flipL ? -1 : 1, sr = p.flipR ? -1 : 1, pan = clamp((p.pan ?? 0) / 100, -1, 1);
  // Pan is a balance: it turns the other side down and never turns a side up.
  const left = pan > 0 ? 1 - pan : 1, right = pan < 0 ? 1 + pan : 1;
  return { ll: (left * sl * (1 + w)) / 2, rl: (left * sr * (1 - w)) / 2, lr: (right * sl * (1 - w)) / 2, rr: (right * sr * (1 + w)) / 2, gain: p.mute ? 0 : dbToGain(p.gain ?? 0) };
}
