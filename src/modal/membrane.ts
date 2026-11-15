// A drum head as a set of ringing modes, as pure maths. A stretched skin can only vibrate in certain
// patterns ("modes"), each with its own frequency. Hitting it sets several going at once, and where you hit
// decides how much of each: a pattern that stands still at that spot is not excited at all.
//
// Sources in the library. Round head: the patterns are Bessel functions and the frequencies are set by
// their zeros (Avanzini and Marogna, IEEE TASLP 2010, page 2 of avanzini-membrane-percussion). Square head:
// the frequencies are proportional to the square root of (m squared + n squared) (Van Duyne and Smith, ICMC
// 1993, page 4 of vanduyne-waveguide-mesh, citing Morse and Ingard). How fast each mode dies away here is
// this app's own simple rule, not taken from a source.
import { noteToHz } from "../synth/params";

export const HEADS = ["round", "square"] as const;
export interface DrumState {
  head: (typeof HEADS)[number];
  /** The pitch of the lowest mode, as a note number. */
  note: number;
  /** Where it is hit: 0 is the centre, 100 the edge (round) or a corner (square). */
  strike: number;
  /** How long the lowest mode takes to fall 60 dB, in seconds. */
  decay: number;
  /** How much sooner the higher modes die than the lowest, 0..100. */
  damp: number;
}
export const DRUM_INITIAL: DrumState = { head: "round", note: 45, strike: 35, decay: 1.2, damp: 50 };
export const DRUM_RANGES: Record<Exclude<keyof DrumState, "head">, { min: number; max: number; step: number; unit: string; label: string }> = {
  note: { min: 28, max: 72, step: 1, unit: "", label: "Tuning" },
  strike: { min: 0, max: 95, step: 1, unit: "% out from the centre", label: "Where it is hit" },
  decay: { min: 0.1, max: 4, step: 0.1, unit: "s", label: "Ring time" },
  damp: { min: 0, max: 100, step: 1, unit: "%", label: "Damping of the high modes" },
};

/** The first zeros of the Bessel functions J0 to J5: row m, column n - 1. A test checks each against `besselJ`. */
export const BESSEL_ZEROS = [
  [2.40483, 5.52008, 8.65373, 11.79153],
  [3.83171, 7.01559, 10.17347, 13.32369],
  [5.13562, 8.41724, 11.61984, 14.79595],
  [6.38016, 9.76102, 13.0152, 16.22347],
  [7.58834, 11.06471, 14.37254, 17.61597],
  [8.77148, 12.3386, 15.70017, 18.98013],
];
/** The Bessel function of the first kind, of whole order m, worked out from its integral form. */
export function besselJ(m: number, x: number): number {
  const N = 400; let sum = 0;
  for (let i = 0; i < N; i++) { const t = ((i + 0.5) / N) * Math.PI; sum += Math.cos(m * t - x * Math.sin(t)); }
  return sum / N;
}

export interface Mode { label: string; /** frequency as a multiple of the lowest mode's */ ratio: number; /** how strongly this hit excites it, -1..1 */ amount: number }

/** Every mode this model uses, lowest first, with how strongly a hit at `strike` sets each one going. */
export function modes(s: Pick<DrumState, "head" | "strike">): Mode[] {
  const r = Math.min(0.95, Math.max(0, s.strike / 100)), out: Mode[] = [];
  if (s.head === "round") {
    const lowest = BESSEL_ZEROS[0]![0]!;
    BESSEL_ZEROS.forEach((row, m) => row.forEach((zero, k) => out.push({ label: `${m} across, ${k + 1} round`, ratio: zero / lowest, amount: besselJ(m, zero * r) })));
  } else {
    // from the centre toward a corner; the patterns are sines across and sines up
    const x = 0.5 + r / 2;
    for (let m = 1; m <= 5; m++) for (let n = 1; n <= 5; n++) out.push({ label: `${m} by ${n}`, ratio: Math.sqrt(m * m + n * n) / Math.SQRT2, amount: Math.sin(m * Math.PI * x) * Math.sin(n * Math.PI * x) });
  }
  return out.sort((a, b) => a.ratio - b.ratio);
}
/** How long a mode rings: the higher its frequency, the sooner it dies, by an amount the damping control sets (this app's own rule). */
export const modeDecay = (s: Pick<DrumState, "decay" | "damp">, ratio: number) => Math.max(0.02, s.decay / ratio ** ((2 * Math.min(100, Math.max(0, s.damp))) / 100));

/** One hit as samples: every mode is a sine that starts at its excited size and dies away at its own rate. */
export function renderDrum(s: DrumState, sampleRate: number, seconds: number): Float32Array {
  const f0 = noteToHz(s.note), total = Math.max(1, Math.round(seconds * sampleRate)), out = new Float32Array(total);
  for (const mode of modes(s)) {
    const hz = f0 * mode.ratio;
    if (hz > sampleRate * 0.45 || Math.abs(mode.amount) < 1e-4) continue;
    const w = (2 * Math.PI * hz) / sampleRate, fall = Math.exp(-6.9078 / (modeDecay(s, mode.ratio) * sampleRate));
    let level = mode.amount;
    for (let n = 0; n < total; n++) { out[n]! += level * Math.sin(w * n); level *= fall; }
  }
  let peak = 1e-9;
  for (const v of out) peak = Math.max(peak, Math.abs(v));
  const fade = Math.min(total, Math.round(0.01 * sampleRate));
  for (let n = 0; n < total; n++) out[n] = (out[n]! / peak) * 0.7 * (n >= total - fade ? (total - 1 - n) / fade : 1);
  return out;
}
