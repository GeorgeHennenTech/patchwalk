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
  if (!s.filterOn || s.filterType === "band" || s.filterType === "notch") return 1;
  return (resonanceQ(s.resonance) / FLAT_Q) ** -0.5;
}

export interface Stage {
  type: "lowpass" | "highpass" | "bandpass" | "notch" | "allpass";
  hz: number;
  /** Plain (linear) Q. */
  q: number;
}

const NODE_TYPE = { low: "lowpass", high: "highpass", band: "bandpass", notch: "notch" } as const;

/**
 * The filter as two stages in a row. Each stage is 12 dB per octave. The gentle slope uses one and leaves the
 * other as a pass-everything stage; the steep slope uses both. A switched-off filter is two pass-everything stages.
 */
export function filterStages(s: SynthState, note: number | null, sampleRate = 48000): [Stage, Stage] {
  const hz = effectiveCutoff(s, note, sampleRate);
  const through: Stage = { type: "allpass", hz, q: FLAT_Q };
  if (!s.filterOn) return [through, through];
  const type = NODE_TYPE[s.filterType], q = resonanceQ(s.resonance);
  if (s.slope === "12") return [{ type, hz, q }, through];
  // Steep: for low-pass and high-pass the first stage stays flat and the second carries the resonance.
  const first = s.filterType === "low" || s.filterType === "high" ? FLAT_Q : q;
  return [{ type, hz, q: first }, { type, hz, q }];
}

/** How much one stage lets through at frequency `f`, in dB. Standard two-pole filter formulas, as the browser uses. */
export function stageDb(stage: Stage, f: number, sampleRate = 48000): number {
  if (stage.type === "allpass") return 0;
  const w0 = (2 * Math.PI * stage.hz) / sampleRate, cos = Math.cos(w0), alpha = Math.sin(w0) / (2 * stage.q);
  let b: [number, number, number];
  switch (stage.type) {
    case "lowpass": b = [(1 - cos) / 2, 1 - cos, (1 - cos) / 2]; break;
    case "highpass": b = [(1 + cos) / 2, -(1 + cos), (1 + cos) / 2]; break;
    case "bandpass": b = [alpha, 0, -alpha]; break;
    case "notch": b = [1, -2 * cos, 1]; break;
  }
  const a: [number, number, number] = [1 + alpha, -2 * cos, 1 - alpha];
  const w = (2 * Math.PI * f) / sampleRate, c1 = Math.cos(w), c2 = Math.cos(2 * w);
  const power = (k: [number, number, number]) => k[0] * k[0] + k[1] * k[1] + k[2] * k[2] + 2 * (k[0] * k[1] + k[1] * k[2]) * c1 + 2 * k[0] * k[2] * c2;
  const ratio = power(b) / power(a);
  return ratio > 1e-12 ? 10 * Math.log10(ratio) : -120;
}

/** How much the whole filter lets through at frequency `f` for a key, in dB. 0 everywhere when the filter is off. */
export function filterResponseDb(s: SynthState, f: number, note: number | null, sampleRate = 48000): number {
  const [one, two] = filterStages(s, note, sampleRate);
  return 20 * Math.log10(resonanceTrim(s)) + stageDb(one, f, sampleRate) + stageDb(two, f, sampleRate);
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
