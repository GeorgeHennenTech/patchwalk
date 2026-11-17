// Automation: a line drawn along the song that moves a setting while it plays (a track's level or pan, or any
// numeric setting of one of its effects). Plain data and rules; `Transport` reads `automate` as the song plays.
// A lane is a list of points; between two points the setting moves in a straight line, before the first and
// after the last it stays where that point put it. A lane with no points leaves the setting alone.
import { specOf, type Device, type ParamSpec } from "./devices";

/** `at`: sixteenth steps from the start of the song. `v`: 0 (the setting's lowest) to 1 (its highest). */
export interface AutoPoint { at: number; v: number }
export interface AutoLane { target: string; points: AutoPoint[] }
export interface AutoTarget { id: string; label: string; min: number; max: number; step: number; unit?: string; log?: boolean }
export const MAX_LANES = 4, MAX_POINTS = 64;
const clamp = (v: number, lo: number, hi: number) => Math.min(hi, Math.max(lo, v));
type Auto = { level: number; pan: number; devices: Device[]; auto?: AutoLane[] };

/** What can be automated on a track: its level, its pan, and every slider of every effect on it (not menus or switches). */
export function targetsOf(t: { devices: Device[] }): AutoTarget[] {
  const out: AutoTarget[] = [{ id: "level", label: "Track level", min: 0, max: 100, step: 1 }, { id: "pan", label: "Track pan", min: -100, max: 100, step: 1 }];
  t.devices.forEach((d, i) => { const spec = specOf(d.kind); for (const p of spec?.params ?? []) if (!p.choices) out.push({ id: `d:${d.id}:${p.id}`, label: `${i + 1} ${spec!.name}: ${p.group ? `${p.group} ` : ""}${p.label}`, min: p.min, max: p.max, step: p.step, unit: p.unit, log: p.log }); });
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
export const hasAutomation = (s: { tracks: { auto?: AutoLane[] }[] }) => s.tracks.some((t) => (t.auto ?? []).some((l) => l.points.length > 0));
/** One track with its automation applied for a place in the song. The same object when nothing is automated. */
export function automateTrack<T extends Auto>(t: T, step: number): T {
  const lanes = (t.auto ?? []).filter((l) => l.points.length);
  if (!lanes.length) return t;
  const targets = targetsOf(t); let next: T = t;
  for (const lane of lanes) { const target = targets.find((x) => x.id === lane.target), v = valueAt(lane.points, step); if (!target || v === undefined) continue; const value = fromUnit(target, v);
    if (lane.target === "level") next = { ...next, level: value }; else if (lane.target === "pan") next = { ...next, pan: value };
    else { const [, id, param] = lane.target.split(":"); next = { ...next, devices: next.devices.map((d) => (d.id === id ? { ...d, p: { ...d.p, [param!]: value } } : d)) }; } }
  return next;
}
/** The song as it stands at a place along it: every automated setting moved to where its lane says. */
export function automate<S extends { tracks: Auto[] }>(song: S, step: number): S {
  if (!hasAutomation(song)) return song;
  const tracks = song.tracks.map((t) => automateTrack(t, step));
  return tracks.every((t, i) => t === song.tracks[i]) ? song : { ...song, tracks };
}

// ---- edits ----
const sorted = (points: AutoPoint[]) => points.slice().sort((a, b) => a.at - b.at);
export const tidyPoint = (p: AutoPoint, steps: number): AutoPoint => ({ at: clamp(Math.round(p.at), 0, steps), v: Number(clamp(p.v, 0, 1).toFixed(4)) });
/** Add a lane for the first setting of the track that has none yet. */
export function addLane(lanes: AutoLane[], t: { devices: Device[] }, target?: string): AutoLane[] {
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
