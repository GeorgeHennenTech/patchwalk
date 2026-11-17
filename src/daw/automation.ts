// Automation: a line drawn along the song that moves a setting while it plays (a track's level or pan, any
// numeric setting of one of its effects, or, on a synth track, any knob of the synth: `s:<knob>`). Plain data and rules; `Transport` reads `automate` as the song plays.
// A lane is a list of points; between two points the setting moves in a straight line, before the first and
// after the last it stays where that point put it. A lane with no points leaves the setting alone.
import { specOf, type Device } from "./devices";
import { MACRO_DESTS, PARAMS } from "../synth/params";

/** `at`: sixteenth steps from the start of the song. `v`: 0 (the setting's lowest) to 1 (its highest). */
export interface AutoPoint { at: number; v: number }
export interface AutoLane { target: string; points: AutoPoint[] }
export interface AutoTarget { id: string; label: string; min: number; max: number; step: number; unit?: string; log?: boolean; /** the heading it is listed under */ group: string }
export const MAX_LANES = 4, MAX_POINTS = 64;
const clamp = (v: number, lo: number, hi: number) => Math.min(hi, Math.max(lo, v));
type Auto = { level: number; pan: number; devices: Device[]; auto?: AutoLane[]; patch?: object; sampler?: object; /** the master: its level is the song's volume and it has no pan */ master?: boolean };
/** The sampler's knobs a lane can move (`m:<knob>`). */
const SAMPLER: AutoTarget[] = [["start", "Start", 0, 99, "%"], ["length", "Length", 1, 100, "%"], ["tune", "Tune", -24, 24, "st"], ["attack", "Fade in", 1, 2000, "ms"], ["release", "Fade out", 1, 5000, "ms"], ["level", "Level", 0, 100, ""]].map(([id, label, min, max, unit]) => ({ id: `m:${id}`, label: label as string, min: min as number, max: max as number, step: 1, unit: (unit as string) || undefined, log: unit === "ms", group: "Sampler" }));
/**
 * The synth's knobs a lane can move: every continuous one, except the tempo (the song sets it) and two that
 * rebuild something too heavy to do many times a second (random phase, reverb size).
 */
export const SYNTH_TARGETS: string[] = MACRO_DESTS.filter((id) => !["none", "bpm", "randomPhase", "reverbSize"].includes(id));
const SYNTH: AutoTarget[] = SYNTH_TARGETS.map((id) => { const p = PARAMS[id]!; return { id: `s:${id}`, label: p.label, min: p.min!, max: p.max!, step: p.step ?? 1, unit: p.unit, log: p.log, group: `Synth: ${p.group}` }; });

/** What can be automated on a track: its level, its pan, and every slider of every effect on it (not menus or switches). */
export function targetsOf(t: { devices: Device[]; patch?: object; sampler?: object; master?: boolean }): AutoTarget[] {
  const out: AutoTarget[] = t.master ? [{ id: "level", label: "Master volume", min: 0, max: 100, step: 1, group: "Master" }] : [{ id: "level", label: "Track level", min: 0, max: 100, step: 1, group: "Track" }, { id: "pan", label: "Track pan", min: -100, max: 100, step: 1, group: "Track" }];
  t.devices.forEach((d, i) => { const spec = specOf(d.kind); for (const p of spec?.params ?? []) if (!p.choices) out.push({ id: `d:${d.id}:${p.id}`, label: `${i + 1} ${spec!.name}: ${p.group ? `${p.group} ` : ""}${p.label}`, min: p.min, max: p.max, step: p.step, unit: p.unit, log: p.log, group: "Effects" }); });
  if (t.sampler) out.push(...SAMPLER); else if (t.patch) out.push(...SYNTH);
  return out;
}
/** A lane's 0-to-1 value as the setting's own value (a frequency or time moves in ratios, as its slider does). */
export const fromUnit = (t: Pick<AutoTarget, "min" | "max" | "step" | "log">, v: number): number => { const x = clamp(v, 0, 1), raw = t.log && t.min > 0 ? t.min * (t.max / t.min) ** x : t.min + (t.max - t.min) * x; return Number(clamp(Math.round(raw / t.step) * t.step, t.min, t.max).toFixed(4)); };
export const toUnit = (t: Pick<AutoTarget, "min" | "max" | "log">, value: number): number => clamp(t.log && t.min > 0 ? Math.log(Math.max(t.min, value) / t.min) / Math.log(t.max / t.min) : (value - t.min) / (t.max - t.min), 0, 1);
/** Where a lane puts its setting at a place in the song, 0 to 1; nothing when the lane is empty. */
export function valueAt(points: readonly AutoPoint[], step: number): number | undefined {
  if (!points.length) return undefined;
  if (step <= points[0]!.at) return points[0]!.v;
  for (let i = 1; i < points.length; i++) { const a = points[i - 1]!, b = points[i]!; if (step <= b.at) return b.at === a.at ? b.v : a.v + ((b.v - a.v) * (step - a.at)) / (b.at - a.at); }
  return points[points.length - 1]!.v;
}
type Lanes = { auto?: AutoLane[] };
const drawn = (x: Lanes) => (x.auto ?? []).some((l) => l.points.length > 0);
type WholeSong = { tracks: Auto[]; returns?: (Omit<Auto, "patch" | "sampler"> & { id: string })[]; volume?: number; masterFx?: Device[]; masterAuto?: AutoLane[] };
export const hasAutomation = (s: { tracks: Lanes[]; returns?: Lanes[]; masterAuto?: AutoLane[] }) => s.tracks.some(drawn) || (s.returns ?? []).some(drawn) || drawn({ auto: s.masterAuto });
/** The master as a strip a lane can move: its level is the song's volume. */
export const masterStrip = (s: { volume?: number; masterFx?: Device[]; masterAuto?: AutoLane[] }): Auto => ({ level: s.volume ?? 85, pan: 0, devices: s.masterFx ?? [], auto: s.masterAuto ?? [], master: true });
// A synth track's sound with its automated knobs moved. The last answer for each sound is kept, so that while
// the values stand still the same object comes back and the synth is not told to change when nothing has.
const patched = new WeakMap<object, { key: string; out: object }>();
function withKnobs(patch: object, moves: [string, number][]): object {
  const real = moves.filter(([id, v]) => (patch as Record<string, unknown>)[id] !== v);
  if (!real.length) return patch;
  const key = real.map(([id, v]) => `${id}=${v}`).join(","), had = patched.get(patch);
  if (had?.key === key) return had.out;
  const out = { ...patch, ...Object.fromEntries(real) }; patched.set(patch, { key, out });
  return out;
}
/** One track with its automation applied for a place in the song. The same object when nothing is automated. */
export function automateTrack<T extends Auto>(t: T, step: number): T {
  const lanes = (t.auto ?? []).filter((l) => l.points.length);
  if (!lanes.length) return t;
  const targets = targetsOf(t), knobs: [string, number][] = []; let next: T = t;
  for (const lane of lanes) { const target = targets.find((x) => x.id === lane.target), v = valueAt(lane.points, step); if (!target || v === undefined) continue; const value = fromUnit(target, v);
    if (lane.target === "level") next = { ...next, level: value }; else if (lane.target === "pan") next = { ...next, pan: value };
    else if (lane.target.startsWith("s:")) knobs.push([lane.target.slice(2), value]);
    else if (lane.target.startsWith("m:")) { if (next.sampler && (next.sampler as Record<string, unknown>)[lane.target.slice(2)] !== value) next = { ...next, sampler: { ...next.sampler, [lane.target.slice(2)]: value } }; }
    else { const [, id, param] = lane.target.split(":"); next = { ...next, devices: next.devices.map((d) => (d.id === id ? { ...d, p: { ...d.p, [param!]: value } } : d)) }; } }
  if (knobs.length && t.patch) { const patch = withKnobs(t.patch, knobs); if (patch !== t.patch) next = { ...next, patch }; }
  return next;
}
/** The song as it stands at a place along it: every automated setting moved to where its lane says. */
export function automate<S extends WholeSong>(song: S, step: number): S {
  if (!hasAutomation(song)) return song;
  const tracks = song.tracks.map((t) => automateTrack(t, step)), returns = (song.returns ?? []).map((r) => automateTrack(r, step));
  let next: S = tracks.every((t, i) => t === song.tracks[i]) ? song : { ...song, tracks };
  if (returns.some((r, i) => r !== song.returns![i])) next = { ...next, returns };
  if (drawn({ auto: song.masterAuto })) { const m = masterStrip(song), moved = automateTrack(m, step); if (moved !== m) next = { ...next, volume: moved.level, masterFx: moved.devices }; }
  return next;
}
/**
 * A stretch of the song has moved (a clip was dragged): its automation goes with it. Points inside the old
 * stretch are moved by the same distance (copied when the clip was copied), replacing whatever was drawn
 * where they land. A lane with nothing in the old stretch is left alone.
 */
export function carryAuto(lanes: AutoLane[], from: number, to: number, length: number, copy = false): AutoLane[] {
  if (from === to) return lanes;
  let changed = false;
  const out = lanes.map((l) => { const moved = l.points.filter((p) => p.at >= from && p.at < from + length); if (!moved.length) return l; changed = true;
    const keep = l.points.filter((p) => (copy || !moved.includes(p)) && !(p.at >= to && p.at < to + length));
    return { ...l, points: sorted([...keep, ...moved.map((p) => ({ at: p.at + to - from, v: p.v }))]).slice(0, MAX_POINTS) }; });
  return changed ? out : lanes;
}
/**
 * Recording automation: the song was `before`, a control was moved and it is now `after`. Every setting that
 * a lane could move and that differs gets a point at this place in the song, on its lane (a new lane when
 * the track has room; when it has none, that setting is not recorded).
 */
export function recordMoves<S extends WholeSong>(before: S, after: S, step: number, steps: number): S {
  const one = <T extends Auto>(a: T, b: T): AutoLane[] | undefined => {
    let lanes = b.auto ?? [], touched = false;
    for (const t of targetsOf(b)) { const was = read(a, t.id), now = read(b, t.id); if (was === undefined || now === undefined || was === now) continue;
      let i = lanes.findIndex((l) => l.target === t.id); if (i < 0) { const grown = addLane(lanes, b, t.id); if (grown === lanes) continue; lanes = grown; i = lanes.length - 1; }
      const put = putPoint(lanes, i, { at: step, v: toUnit(t, now) }, steps); if (put.index >= 0) { lanes = put.lanes; touched = true; } }
    return touched ? lanes : undefined;
  };
  let next = after;
  const tracks = after.tracks.map((b, i) => { const a = before.tracks[i]; const lanes = a && (a as { id?: string }).id === (b as { id?: string }).id ? one(a, b) : undefined; return lanes ? { ...b, auto: lanes } : b; });
  if (tracks.some((t, i) => t !== after.tracks[i])) next = { ...next, tracks };
  const returns = (after.returns ?? []).map((b) => { const a = (before.returns ?? []).find((x) => x.id === b.id); const lanes = a ? one(a, b) : undefined; return lanes ? { ...b, auto: lanes } : b; });
  if (returns.some((r, i) => r !== after.returns![i])) next = { ...next, returns };
  const m = one(masterStrip(before), masterStrip(after)); if (m) next = { ...next, masterAuto: m };
  return next;
}
/** A strip's present value for a target, by the target's id; nothing when it has no such setting. */
function read(t: Auto, id: string): number | undefined {
  if (id === "level") return t.level; if (id === "pan") return t.pan;
  if (id.startsWith("s:")) return (t.patch as Record<string, unknown> | undefined)?.[id.slice(2)] as number | undefined;
  if (id.startsWith("m:")) return (t.sampler as Record<string, unknown> | undefined)?.[id.slice(2)] as number | undefined;
  const [, dev, param] = id.split(":"), d = t.devices.find((x) => x.id === dev); return d ? d.p[param!] ?? specOf(d.kind)?.params.find((p) => p.id === param)?.def : undefined;
}

// ---- edits ----
const sorted = (points: AutoPoint[]) => points.slice().sort((a, b) => a.at - b.at);
export const tidyPoint = (p: AutoPoint, steps: number): AutoPoint => ({ at: clamp(Math.round(p.at), 0, steps), v: Number(clamp(p.v, 0, 1).toFixed(4)) });
/** Add a lane for the first setting of the track that has none yet. */
export function addLane(lanes: AutoLane[], t: { devices: Device[]; patch?: object; sampler?: object; master?: boolean }, target?: string): AutoLane[] {
  if (lanes.length >= MAX_LANES) return lanes;
  const free = targetsOf(t).find((x) => (target ? x.id === target : !lanes.some((l) => l.target === x.id)));
  return free && !lanes.some((l) => l.target === free.id) ? [...lanes, { target: free.id, points: [] }] : lanes;
}
export const removeLane = (lanes: AutoLane[], i: number): AutoLane[] => lanes.filter((_, k) => k !== i);
/** Point a lane at another setting. Its points are kept (they are 0 to 1, so they mean "low" and "high" of the new setting). */
export const retargetLane = (lanes: AutoLane[], i: number, target: string): AutoLane[] => (lanes.some((l, k) => k !== i && l.target === target) ? lanes : lanes.map((l, k) => (k === i ? { ...l, target } : l)));
/** Put a point on a lane (replacing one already on that step). Gives the lanes and the point's place in its lane. */
export function putPoint(lanes: AutoLane[], i: number, p: AutoPoint, steps: number): { lanes: AutoLane[]; index: number } {
  const lane = lanes[i]; if (!lane) return { lanes, index: -1 };
  const point = tidyPoint(p, steps), rest = lane.points.filter((x) => x.at !== point.at);
  if (rest.length >= MAX_POINTS) return { lanes, index: -1 };
  const points = sorted([...rest, point]);
  return { lanes: lanes.map((l, k) => (k === i ? { ...l, points } : l)), index: points.indexOf(point) };
}
/** Move a point: up and down freely, sideways only as far as its neighbours. */
export function movePoint(lanes: AutoLane[], i: number, index: number, p: AutoPoint, steps: number): AutoLane[] {
  const lane = lanes[i], old = lane?.points[index]; if (!lane || !old) return lanes;
  const lo = index > 0 ? lane.points[index - 1]!.at + 1 : 0, hi = index < lane.points.length - 1 ? lane.points[index + 1]!.at - 1 : steps, next = tidyPoint({ at: clamp(Math.round(p.at), Math.min(lo, hi), Math.max(lo, hi)), v: p.v }, steps);
  return next.at === old.at && next.v === old.v ? lanes : lanes.map((l, k) => (k === i ? { ...l, points: l.points.map((x, j) => (j === index ? next : x)) } : l));
}
export const dropPoint = (lanes: AutoLane[], i: number, index: number): AutoLane[] => lanes.map((l, k) => (k === i ? { ...l, points: l.points.filter((_, j) => j !== index) } : l));
/** Lanes read back from storage, made safe. */
export function tidyAuto(raw: unknown, steps: number): AutoLane[] {
  const out: AutoLane[] = [];
  for (const g of Array.isArray(raw) ? raw : []) {
    if (!g || typeof g !== "object" || typeof g.target !== "string" || !/^[\w:.-]{1,60}$/.test(g.target) || out.length >= MAX_LANES || out.some((l) => l.target === g.target)) continue;
    const points: AutoPoint[] = [];
    for (const p of Array.isArray(g.points) ? g.points.slice(0, MAX_POINTS * 2) : []) { const at = Number(p?.at), v = Number(p?.v); if (Number.isFinite(at) && Number.isFinite(v)) { const t = tidyPoint({ at, v }, steps); if (!points.some((x) => x.at === t.at)) points.push(t); } }
    out.push({ target: g.target, points: sorted(points).slice(0, MAX_POINTS) });
  }
  return out;
}
