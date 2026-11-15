// The Res 2's mid and high horns as the maker measured them: how loud the sound is in every direction, for
// each third-octave band from 250 Hz to 20 kHz. Read out of Funktion-One's own EASE files for the Res 2SH
// (the mid-high section of a Res 2) by scripts/ease_cf2.py, which also proves the reading against the
// beamwidth table inside each file. There is no such file for the bass horn here.
import raw from "./res2-directivity.json";

export interface Band { hz: number; /** which driver's file the band comes from */ driver: string; /** dB at 1 m, as the file states it */ sensitivity: number;
  /** degrees between the two directions where the level is 6 dB down: side to side, and up and down */ across: number; upDown: number }
export const BANDS: Band[] = raw.bands;
export const SOURCE: string = raw.source;
const { meridians: M, points: P, low: LOW, step: STEP } = raw, PER = M * P;
let bytes: Uint8Array | undefined;
const data = () => (bytes ??= Uint8Array.from(atob(raw.data), (c) => c.charCodeAt(0)));
const at = (band: number, m: number, p: number) => data()[band * PER + (((m % M) + M) % M) * P + p]! * STEP + LOW;

/** Level in dB relative to straight ahead. `theta`: degrees away from straight ahead (0 to 180). `phi`: degrees round the axis; 0 is up, 90 to the side. */
export function level(band: number, theta: number, phi: number): number {
  const t = Math.min(180, Math.max(0, theta)) / 5, f = (((phi % 360) + 360) % 360) / 5;
  const p0 = Math.min(P - 2, Math.floor(t)), m0 = Math.floor(f), u = t - p0, v = f - m0;
  return (at(band, m0, p0) * (1 - u) + at(band, m0, p0 + 1) * u) * (1 - v) + (at(band, m0 + 1, p0) * (1 - u) + at(band, m0 + 1, p0 + 1) * u) * v;
}
/** The direction of a point from the horn, as the two angles `level` takes. x is across, y up, z straight ahead. */
export function towards(x: number, y: number, z: number): { theta: number; phi: number } {
  const d = Math.hypot(x, y, z) || 1;
  return { theta: (Math.acos(Math.max(-1, Math.min(1, z / d))) * 180) / Math.PI, phi: (Math.atan2(x, y) * 180) / Math.PI };
}
/** Level at a point, in dB relative to 1 m straight ahead: the direction's level, less 6 dB for every doubling of distance. Open air: no floor, walls or other cabinets. */
export function levelAt(band: number, x: number, y: number, z: number): number {
  const { theta, phi } = towards(x, y, z), d = Math.max(0.25, Math.hypot(x, y, z));
  return level(band, theta, phi) - 20 * Math.log10(d);
}
/** The measured band a frequency falls in, or undefined below the lowest one (the bass horn's range) or above the highest. */
export function bandNear(hz: number): number | undefined {
  if (hz < BANDS[0]!.hz / 2 ** (1 / 6) || hz > BANDS[BANDS.length - 1]!.hz * 2 ** (1 / 6)) return undefined;
  let best = 0;
  BANDS.forEach((b, i) => { if (Math.abs(Math.log(b.hz / hz)) < Math.abs(Math.log(BANDS[best]!.hz / hz))) best = i; });
  return best;
}
/** Colours for levels, in 3 dB steps from 0 (red) down to -36 dB and below (deep blue), as prediction programs draw them. */
const STOPS: [number, [number, number, number]][] = [[0, [215, 25, 28]], [-6, [253, 174, 97]], [-12, [255, 255, 191]], [-18, [171, 221, 164]], [-24, [43, 131, 186]], [-36, [37, 52, 148]]];
export function levelColour(db: number): [number, number, number] {
  const q = Math.max(-36, Math.min(0, Math.ceil(db / 3) * 3));
  for (let i = 0; i < STOPS.length - 1; i++) {
    const [a, ca] = STOPS[i]!, [b, cb] = STOPS[i + 1]!;
    if (q <= a && q >= b) { const t = (a - q) / (a - b); return [0, 1, 2].map((k) => Math.round(ca[k]! + (cb[k]! - ca[k]!) * t)) as [number, number, number]; }
  }
  return STOPS[STOPS.length - 1]![1];
}
export const LEGEND = [0, -3, -6, -9, -12, -15, -18, -21, -24, -27, -30, -33, -36];
