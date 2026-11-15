// The practice synth's filter, as pure maths. The audio engine builds its filter from `filterStages`, and the
// filter-curve drawing is computed from the same stages, so what is drawn is what is heard.
import type { SynthState } from "./params";

export type FilterType = SynthState["filterType"];

/** Key tracking pivots on middle C: that key always gets exactly the set cutoff. */
export const KEYTRACK_NOTE = 60;
const FLAT_Q = Math.SQRT1_2; // no peak and no sag at the cutoff
const MAX_Q = 40;

/** Resonance (0..100%) as the filter's Q: from flat to a tall, narrow peak. */
export const resonanceQ = (resonance: number) => FLAT_Q * (MAX_Q / FLAT_Q) ** (Math.min(100, Math.max(0, resonance)) / 100);

/** The cutoff actually used for a key, after key tracking. `note` null means "no key yet": the set cutoff. */
export function effectiveCutoff(s: Pick<SynthState, "cutoff" | "keyTrack">, note: number | null, sampleRate = 48000): number {
  const follow = note === null ? 1 : 2 ** (((note - KEYTRACK_NOTE) / 12) * (s.keyTrack / 100));
  return Math.min(Math.min(20000, sampleRate * 0.45), Math.max(20, s.cutoff * follow));
}

/**
 * Level trim that goes with resonance on the low-pass and high-pass types: as the peak grows, the rest is
 * turned down, so a resonant sweep does not simply get louder. This is why high resonance "thins the body".
 */
export function resonanceTrim(s: Pick<SynthState, "filterOn" | "filterType" | "resonance">): number {
  if (!s.filterOn || (s.filterType !== "low" && s.filterType !== "high")) return 1;
  return (resonanceQ(s.resonance) / FLAT_Q) ** -0.5;
}

export interface Stage {
  type: "lowpass" | "highpass" | "bandpass" | "notch" | "allpass" | "peaking" | "highshelf";
  hz: number;
  /** Plain (linear) Q. */
  q: number;
  /** Peak and shelf only: how far the band is lifted (peak) or the top is turned down (shelf), in dB. */
  gainDb?: number;
}

const NODE_TYPE = { low: "lowpass", high: "highpass", band: "bandpass", notch: "notch", peak: "peaking", shelf: "highshelf" } as const;
/** The peak type is a bump this wide (Q); its height comes from the resonance knob. */
const PEAK_Q = 3;
/** Peak and shelf: the resonance knob sets the size, up to this many dB (a lift for peak, a cut for shelf). */
export const SHAPE_MAX_DB = 24;

/** One stage for a type, cutoff and resonance. For peak and shelf the resonance knob is "how much". */
function stageFor(kind: FilterType, hz: number, resonance: number, q = resonanceQ(resonance)): Stage {
  const amount = (Math.min(100, Math.max(0, resonance)) / 100) * SHAPE_MAX_DB;
  if (kind === "peak") return { type: "peaking", hz, q: PEAK_Q, gainDb: amount };
  if (kind === "shelf") return { type: "highshelf", hz, q: FLAT_Q, gainDb: -amount };
  return { type: NODE_TYPE[kind], hz, q };
}

/**
 * The filter as two stages in a row. Each stage is 12 dB per octave. The gentle slope uses one and leaves the
 * other as a pass-everything stage; the steep slope uses both. A switched-off filter is two pass-everything stages.
 */
export function filterStages(s: SynthState, note: number | null, sampleRate = 48000): [Stage, Stage] {
  const hz = effectiveCutoff(s, note, sampleRate);
  const through: Stage = { type: "allpass", hz, q: FLAT_Q };
  if (!s.filterOn) return [through, through];
  const stage = stageFor(s.filterType, hz, s.resonance);
  if (s.slope === "12") return [stage, through];
  // Steep: for low-pass and high-pass the first stage stays flat and the second carries the resonance.
  const first = s.filterType === "low" || s.filterType === "high" ? stageFor(s.filterType, hz, s.resonance, FLAT_Q) : stage;
  return [first, stage];
}

/** The second filter: one stage, its own type, cutoff and resonance. Pass-everything when it is off. */
export function filter2Stage(s: SynthState, sampleRate = 48000): Stage {
  const hz = Math.min(Math.min(20000, sampleRate * 0.45), Math.max(20, s.cutoff2));
  return s.filter2On ? stageFor(s.filter2Type, hz, s.resonance2) : { type: "allpass", hz, q: FLAT_Q };
}

/** True when the two filters sit side by side (each hears the sources, and their outputs are added). */
export const sideBySide = (s: Pick<SynthState, "filter2On" | "filterRoute">) => s.filter2On && s.filterRoute === "parallel";

type Three = [number, number, number];
/** A stage's coefficients: the standard two-pole filter formulas, as the browser uses. */
function coefficients(stage: Stage, sampleRate: number): { b: Three; a: Three } {
  const w0 = (2 * Math.PI * stage.hz) / sampleRate, cos = Math.cos(w0), sin = Math.sin(w0), alpha = sin / (2 * stage.q);
  const a: Three = [1 + alpha, -2 * cos, 1 - alpha];
  switch (stage.type) {
    case "lowpass": return { b: [(1 - cos) / 2, 1 - cos, (1 - cos) / 2], a };
    case "highpass": return { b: [(1 + cos) / 2, -(1 + cos), (1 + cos) / 2], a };
    case "bandpass": return { b: [alpha, 0, -alpha], a };
    case "notch": return { b: [1, -2 * cos, 1], a };
    case "allpass": return { b: [1 - alpha, -2 * cos, 1 + alpha], a };
    case "peaking": {
      const A = 10 ** ((stage.gainDb ?? 0) / 40);
      return { b: [1 + alpha * A, -2 * cos, 1 - alpha * A], a: [1 + alpha / A, -2 * cos, 1 - alpha / A] };
    }
    case "highshelf": {
      const A = 10 ** ((stage.gainDb ?? 0) / 40), k = 2 * Math.sqrt(A) * (sin / 2) * Math.SQRT2;
      return {
        b: [A * (A + 1 + (A - 1) * cos + k), -2 * A * (A - 1 + (A + 1) * cos), A * (A + 1 + (A - 1) * cos - k)],
        a: [A + 1 - (A - 1) * cos + k, 2 * (A - 1 - (A + 1) * cos), A + 1 - (A - 1) * cos - k],
      };
    }
  }
}

/** What one stage does to a sine at frequency `f`: size and turn, as a complex number [real, imaginary]. */
export function stageResponse(stage: Stage, f: number, sampleRate = 48000): [number, number] {
  const { b, a } = coefficients(stage, sampleRate), w = (2 * Math.PI * f) / sampleRate;
  const at = (k: Three): [number, number] => [k[0] + k[1] * Math.cos(w) + k[2] * Math.cos(2 * w), -(k[1] * Math.sin(w) + k[2] * Math.sin(2 * w))];
  const [nr, ni] = at(b), [dr, di] = at(a), d = dr * dr + di * di;
  return [(nr * dr + ni * di) / d, (ni * dr - nr * di) / d];
}

const toDb = (power: number) => (power > 1e-12 ? 10 * Math.log10(power) : -120);

/** How much one stage lets through at frequency `f`, in dB. */
export function stageDb(stage: Stage, f: number, sampleRate = 48000): number {
  if (stage.type === "allpass") return 0;
  const [re, im] = stageResponse(stage, f, sampleRate);
  return toDb(re * re + im * im);
}

/**
 * How much the whole filter section lets through at frequency `f` for a key, in dB. 0 everywhere when both
 * filters are off. One after the other, the two filters' effects add up (in dB). Side by side, their outputs
 * are added as waves, so where one is turned round against the other they can partly cancel.
 */
export function filterResponseDb(s: SynthState, f: number, note: number | null, sampleRate = 48000): number {
  const [one, two] = filterStages(s, note, sampleRate), three = filter2Stage(s, sampleRate), trim = resonanceTrim(s);
  if (!sideBySide(s)) return 20 * Math.log10(trim) + stageDb(one, f, sampleRate) + stageDb(two, f, sampleRate) + stageDb(three, f, sampleRate);
  const mul = (x: [number, number], y: [number, number]): [number, number] => [x[0] * y[0] - x[1] * y[1], x[0] * y[1] + x[1] * y[0]];
  const first = mul(stageResponse(one, f, sampleRate), stageResponse(two, f, sampleRate)), second = stageResponse(three, f, sampleRate);
  const re = trim * first[0] + second[0], im = trim * first[1] + second[1];
  return toDb(re * re + im * im);
}

/** Height of the resonant peak above the level well inside the pass band, in dB (low-pass and high-pass). */
export function peakAboveBodyDb(s: SynthState, sampleRate = 48000): number {
  const hz = effectiveCutoff(s, null, sampleRate);
  const body = s.filterType === "high" ? Math.min(sampleRate * 0.45, hz * 16) : hz / 16;
  let peak = -Infinity;
  for (let i = -12; i <= 12; i++) peak = Math.max(peak, filterResponseDb(s, hz * 2 ** (i / 48), null, sampleRate));
  return peak - filterResponseDb(s, body, null, sampleRate);
}

/** The drive stage sits before the filter and works on signals up to this size either way. */
export const DRIVE_RANGE = 4;
const DRIVE_MAX_DB = 30;

/**
 * Drive (0..100%) as a transfer curve for a wave-shaper covering inputs from -DRIVE_RANGE to +DRIVE_RANGE.
 * At 0 it is a straight line (no change). Above that the signal is pushed into a soft clip, which flattens
 * the wave's peaks and so adds harmonics.
 */
export function driveCurve(drive: number, points = 2049): Float32Array<ArrayBuffer> {
  const out = new Float32Array(points);
  const gain = 10 ** (((Math.min(100, Math.max(0, drive)) / 100) * DRIVE_MAX_DB) / 20);
  for (let i = 0; i < points; i++) {
    const u = ((i / (points - 1)) * 2 - 1) * DRIVE_RANGE;
    out[i] = drive <= 0 ? u : Math.tanh(gain * u) / gain ** 0.3;
  }
  return out;
}
