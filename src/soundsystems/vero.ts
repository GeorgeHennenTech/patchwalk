// Funktion-One's Vero system, for the 3D array view. Every figure is from the maker's Vero user guide
// (library book "funktion-one-vero"; page numbers are the guide's own). What is illustrative is said so.

export type VeroKind = "V60" | "V90" | "V315" | "V221";
export interface VeroCabinet {
  kind: VeroKind; name: string; job: string; drivers: string; band: string; coverage: string; weight: string; page: number;
  /** metres */ size: [width: number, height: number, depth: number];
  /** Coverage angles in degrees, when the guide gives them for one cabinet. */ beam?: { across: number; upDown: number };
  color: string;
}

export const VERO: Record<VeroKind, VeroCabinet> = {
  V60: { kind: "V60", name: "V60", job: "Mids and highs in a narrow beam, for the far part of the audience.", drivers: "Two 10-inch cone drivers and three 1.4-inch compression drivers", band: "200 Hz to 18 kHz",
    coverage: "60° across; up to 6° between one V60 and the next for unbroken coverage", weight: "115 kg", page: 108, size: [1.679, 0.43, 0.716], beam: { across: 60, upDown: 6 }, color: "#3d7bff" },
  V90: { kind: "V90", name: "V90", job: "Mids and highs in a wide beam, for the near and middle audience.", drivers: "Two 10-inch cone drivers and two 1.4-inch compression drivers", band: "200 Hz to 18 kHz",
    coverage: "90° across; up to 12.5° between one V90 and the next", weight: "107 kg", page: 109, size: [1.679, 0.43, 0.716], beam: { across: 90, upDown: 12.5 }, color: "#ffd23d" },
  V315: { kind: "V315", name: "V315", job: "Mid-bass: the punch of drums and the body of bass notes. It is flown in the column with the others.", drivers: "Three horn-loaded 15-inch cone drivers", band: "50 Hz to 250 Hz",
    coverage: "70° across at 200 Hz; how tall its beam is depends on how many hang together", weight: "116 kg", page: 110, size: [1.679, 0.43, 0.716], color: "#ff4d4d" },
  V221: { kind: "V221", name: "V221", job: "Bass. It stands on the ground in front of the stage.", drivers: "Two 21-inch cone drivers", band: "40 Hz to 150 Hz",
    coverage: "Depends on how the bass cabinets are arranged", weight: "130 kg", page: 110, size: [1.688, 0.589, 1.002], color: "#b9a1ff" },
};

/**
 * "A typical 12-cabinet arena array" from the top down (guide, page 67), with the angle in degrees between
 * each cabinet and the one below it from the guide's worked example (page 62).
 */
export const ARENA_ARRAY: { kind: VeroKind; angleBelow: number }[] = [
  { kind: "V60", angleBelow: 2 }, { kind: "V60", angleBelow: 2 }, { kind: "V60", angleBelow: 3 }, { kind: "V60", angleBelow: 0 },
  { kind: "V315", angleBelow: 0 }, { kind: "V315", angleBelow: 0 }, { kind: "V315", angleBelow: 1 },
  { kind: "V90", angleBelow: 2 }, { kind: "V90", angleBelow: 1 },
  { kind: "V315", angleBelow: 1 },
  { kind: "V90", angleBelow: 5 }, { kind: "V90", angleBelow: 0 },
];

/** How far each cabinet is tipped down from level: the angles above it added up (the top one hangs level). */
export function tilts(array: readonly { angleBelow: number }[]): number[] {
  const out: number[] = []; let t = 0;
  for (const c of array) { out.push(t); t += c.angleBelow; }
  return out;
}

/** How far a beam tipped down by `tiltDeg` from a height of `height` metres travels before its centre reaches the ground. Level or upward: never. */
export const reach = (height: number, tiltDeg: number) => (tiltDeg <= 0 ? Infinity : height / Math.tan((tiltDeg * Math.PI) / 180));

/** Where each cabinet of a column hangs: the height of the middle of its front above the ground, how far back from the top cabinet's front it sits, and its tilt. `top` is the height of the top of the column. */
export function hang(array: readonly { kind: VeroKind; angleBelow: number }[], top: number): { height: number; back: number; tilt: number }[] {
  const t = tilts(array); let y = top, z = 0;
  return array.map((c, i) => {
    const h = VERO[c.kind].size[1], a = (t[i]! * Math.PI) / 180;
    const at = { height: y - (h / 2) * Math.cos(a), back: z + (h / 2) * Math.sin(a), tilt: t[i]! };
    y -= h * Math.cos(a); z += h * Math.sin(a);
    return at;
  });
}
/**
 * The stretch of ground a beam covers: its lower edge lands at `near`, its upper edge at `far` (never, if that
 * edge is level or points up). Straight-line geometry from the coverage angle only: real sound does not stop at an edge.
 */
export function footprint(height: number, tiltDeg: number, upDown: number): { near: number; far: number } {
  return { near: reach(height, tiltDeg + upDown / 2), far: reach(height, tiltDeg - upDown / 2) };
}

/** A standing listener's ears above the ground, metres. */
export const EAR = 1.7;
type Hung = readonly { kind: VeroKind; angleBelow: number }[];
/**
 * The mid-high cabinet pointed most nearly at a listener standing `distance` metres out from the top cabinet's
 * front: the one whose aim is closest to the line from it to the listener's ears. `inside` says whether the
 * listener is within that cabinet's stated up-and-down coverage. Straight-line geometry only.
 */
export function aimedAt(array: Hung, top: number, distance: number): { index: number; inside: boolean; off: number } | undefined {
  let best: { index: number; inside: boolean; off: number } | undefined;
  hang(array, top).forEach((at, index) => {
    const beam = VERO[array[index]!.kind].beam; if (!beam) return;
    const down = (Math.atan2(at.height - EAR, distance + at.back) * 180) / Math.PI, off = Math.abs(down - at.tilt);
    if (!best || off < best.off) best = { index, off, inside: off <= beam.upDown / 2 };
  });
  return best;
}
/** The field cut into stretches by which mid-high cabinet is pointed at each: from `from` to `to` metres out. */
export function zones(array: Hung, top: number, from = 2, to = 120, step = 0.5): { index: number; inside: boolean; from: number; to: number }[] {
  const out: { index: number; inside: boolean; from: number; to: number }[] = [];
  for (let d = from; d < to; d += step) {
    const a = aimedAt(array, top, d + step / 2); if (!a) continue;
    const last = out[out.length - 1];
    if (last && last.index === a.index && last.inside === a.inside) last.to = d + step; else out.push({ index: a.index, inside: a.inside, from: d, to: d + step });
  }
  return out;
}
/** Seconds for sound to travel a distance in air at about 20 °C. */
export const travelTime = (metres: number) => metres / 343;
