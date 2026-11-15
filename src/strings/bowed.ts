// A bowed string, as pure maths. The string is two delay lines, one from the bow to the nut and back and
// one from the bow to the bridge and back. Where the bow touches, the string either sticks to the bow hair
// and is carried along at the bow's speed, or slips back against it. Sticking and slipping in turn, once per
// cycle, is what keeps a bowed note going for as long as the bow moves.
//
// Structure from Julius O. Smith, "Physical Modeling Using Digital Waveguides" (1992), the section on bowed
// strings (library: smith-digital-waveguides, page 20): velocity waves in the delay lines, and the bow as
// one look-up from the difference between bow speed and string speed, with no memory. The physics of
// sticking and slipping is set out in McIntyre, Schumacher and Woodhouse (1983), also in the library. The
// look-up curve used here and every number in it are this app's own choices.
import { measuredHarmonics } from "../modal/tube";
import { noteToHz } from "../synth/params";

export interface BowState {
  /** How fast the bow moves, 0..100. */
  speed: number;
  /** How hard the bow presses on the string, 0..100. */
  pressure: number;
  /** Where the bow sits, as a percentage of the string's length from the bridge (3..40). */
  position: number;
  /** How much of the highs survive each trip, 0..100. */
  bright: number;
  /** How long the bow takes to get up to speed, in ms. */
  attack: number;
}
export const BOW_INITIAL: BowState = { speed: 40, pressure: 60, position: 12, bright: 60, attack: 80 };
export const BOW_RANGES: Record<keyof BowState, { min: number; max: number; step: number; unit: string; label: string }> = {
  speed: { min: 0, max: 100, step: 1, unit: "%", label: "Bow speed" },
  pressure: { min: 0, max: 100, step: 1, unit: "%", label: "Bow pressure" },
  position: { min: 3, max: 40, step: 1, unit: "% along", label: "Bow position" },
  bright: { min: 0, max: 100, step: 1, unit: "%", label: "Brightness" },
  attack: { min: 5, max: 800, step: 5, unit: "ms", label: "Bow start" },
};
const clamp = (v: number, lo: number, hi: number) => Math.min(hi, Math.max(lo, v));

/** How firmly the bow grips, 0..1, for a difference `d` between bow speed and string speed: 1 is stuck. (Our own curve.) */
export function bowGrip(d: number, pressure: number): number {
  const slope = 5 - 4 * (clamp(pressure, 0, 100) / 100);
  return Math.min(1, (Math.abs(d) * slope + 0.75) ** -4);
}

/** A note bowed for `bowed` seconds and then left to ring, as samples. */
export function renderBowed(s: BowState, note: number, sampleRate: number, bowed: number, tail = 0.4): Float32Array {
  const hz = noteToHz(note), period = sampleRate / hz, where = clamp(s.position, 3, 40) / 100;
  const keep = 0.25 + 0.72 * (clamp(s.bright, 0, 100) / 100); // one-pole low-pass at the bridge: share of the new sample
  // the low-pass delays the wave a little; take that off the bridge side so the note stays in tune
  const lag = (1 - keep) / keep;
  const bridgeLen = Math.max(2, period * where - lag), nutLen = Math.max(2, period * (1 - where));
  const nut = new Float32Array(Math.ceil(nutLen) + 2), bridge = new Float32Array(Math.ceil(bridgeLen) + 2);
  const read = (line: Float32Array, at: number, length: number) => { // a delay of a whole number plus a fraction, by a straight line between two samples
    const pos = at - length, i = Math.floor(pos), f = pos - i, n = line.length;
    return line[((i % n) + n) % n]! * (1 - f) + line[(((i + 1) % n) + n) % n]! * f;
  };
  const total = Math.round((bowed + tail) * sampleRate), out = new Float32Array(total);
  const rise = Math.max(1, (s.attack / 1000) * sampleRate), top = 0.03 + 0.25 * (clamp(s.speed, 0, 100) / 100);
  let low = 0;
  for (let n = 0; n < total; n++) {
    const on = n < bowed * sampleRate;
    const bow = on ? top * Math.min(1, n / rise) : 0;
    const fromNut = -read(nut, n, nutLen);                 // back from the nut, upside down
    low += keep * (read(bridge, n, bridgeLen) - low);      // back from the bridge, with its highs softened
    const fromBridge = -0.98 * low;
    const d = bow - (fromNut + fromBridge);                // bow speed minus the string's own speed
    const push = on && s.speed > 0 ? d * bowGrip(d, s.pressure) : 0; // what the bow adds: all of the difference when stuck
    nut[n % nut.length] = fromBridge + push;
    bridge[n % bridge.length] = fromNut + push;
    out[n] = fromBridge;
  }
  return out;
}

export type BowResult = "silent" | "note" | "jumped";
/**
 * What these settings give, found by a quick, coarse trial of the model itself: no sound, a steady note, or
 * a note that has jumped up (the string slipping twice per cycle, so the second harmonic outweighs the first).
 */
export function bowResult(s: BowState): BowResult {
  const sr = 12000, hz = noteToHz(45), y = renderBowed({ ...s, attack: 30 }, 45, sr, 0.7, 0);
  let peak = 0;
  for (let i = Math.round(0.45 * sr); i < Math.round(0.68 * sr); i++) peak = Math.max(peak, Math.abs(y[i]!));
  if (peak < 0.01) return "silent";
  const h = measuredHarmonics(y, hz, sr, 3);
  return h[1]! > h[0]! * 1.2 || h[2]! > h[0]! * 1.2 ? "jumped" : "note";
}
export const BOW_GRID = { speeds: [5, 20, 35, 50, 65, 80, 95], pressures: [95, 80, 65, 50, 35, 20, 5] };
/** The result for every combination of bow speed (across) and pressure (down, hardest first), for the map. */
export const bowMap = (s: BowState): BowResult[][] => BOW_GRID.pressures.map((pressure) => BOW_GRID.speeds.map((speed) => bowResult({ ...s, speed, pressure })));
