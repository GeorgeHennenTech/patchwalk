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
  /** How hard it is hit, 0..100. A hard hit stretches the skin, so every mode starts sharp and settles (the pitch dip). */
  force: number;
  /** How hard the stick is, 0..100: a soft mallet stays on the skin longer and sets fewer high modes going. */
  stick: number;
  /** How much of a second head, tuned a little apart, rings along: 0 is one head alone. */
  second: number;
}
export const DRUM_INITIAL: DrumState = { head: "round", note: 45, strike: 35, decay: 1.2, damp: 55, force: 60, stick: 55, second: 30 };
export const DRUM_RANGES: Record<Exclude<keyof DrumState, "head">, { min: number; max: number; step: number; unit: string; label: string }> = {
  note: { min: 28, max: 72, step: 1, unit: "", label: "Tuning" },
  strike: { min: 0, max: 95, step: 1, unit: "% out from the centre", label: "Where it is hit" },
  decay: { min: 0.1, max: 4, step: 0.1, unit: "s", label: "Ring time" },
  damp: { min: 0, max: 100, step: 1, unit: "%", label: "Damping of the high modes" },
  force: { min: 0, max: 100, step: 1, unit: "%", label: "How hard" },
  stick: { min: 0, max: 100, step: 1, unit: "%", label: "Stick hardness" },
  second: { min: 0, max: 100, step: 1, unit: "%", label: "Second head" },
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

/** How many patterns across (0 to ACROSS - 1) and round (1 to ROUND) the round head uses, and the square head's rows and columns. */
const ACROSS = 12, ROUND = 7, GRID = 8;
let zerosFound: number[][] | undefined;
/**
 * The zeros of J0 to J11, seven of each, found by stepping along each function and closing in on every change
 * of sign. The first four of the first six orders are the listed `BESSEL_ZEROS` (a test checks they agree).
 */
export function besselZeros(): number[][] {
  if (zerosFound) return zerosFound;
  zerosFound = Array.from({ length: ACROSS }, (_, m) => {
    const found: number[] = [];
    let x = Math.max(0.5, m), before = besselJ(m, x);
    while (found.length < ROUND && x < 60) {
      const next = x + 0.1, after = besselJ(m, next);
      if (before * after < 0) {
        let lo = x, hi = next, flo = before;
        for (let i = 0; i < 40; i++) { const mid = (lo + hi) / 2, f = besselJ(m, mid); if (flo * f <= 0) hi = mid; else { lo = mid; flo = f; } }
        found.push((lo + hi) / 2);
      }
      x = next; before = after;
    }
    return found;
  });
  return zerosFound;
}

export interface Mode { label: string; /** frequency as a multiple of the lowest mode's */ ratio: number; /** how strongly this hit excites it, -1..1 */ amount: number }

/**
 * Every mode this model uses, lowest first, with how strongly a hit at `strike` sets each one going. A real
 * skin has a great many modes; the high ones are packed close together and die at once, and are heard as the
 * slap of the hit, not as separate notes (Avanzini and Marogna, page 5). Using too few sounds artificial.
 */
export function modes(s: Pick<DrumState, "head" | "strike">): Mode[] {
  const r = Math.min(0.95, Math.max(0, s.strike / 100)), out: Mode[] = [];
  if (s.head === "round") {
    const zeros = besselZeros(), lowest = zeros[0]![0]!;
    // each pattern's share is its height at the hit point over its own overall size
    zeros.forEach((row, m) => row.forEach((zero, k) => out.push({ label: `${m} across, ${k + 1} round`, ratio: zero / lowest, amount: besselJ(m, zero * r) / Math.max(0.05, Math.abs(besselJ(m + 1, zero))) })));
  } else {
    // from the centre toward a corner; the patterns are sines across and sines up
    const x = 0.5 + r / 2;
    for (let m = 1; m <= GRID; m++) for (let n = 1; n <= GRID; n++) out.push({ label: `${m} by ${n}`, ratio: Math.sqrt(m * m + n * n) / Math.SQRT2, amount: Math.sin(m * Math.PI * x) * Math.sin(n * Math.PI * x) });
  }
  const top = Math.max(1e-9, ...out.map((m) => Math.abs(m.amount)));
  return out.map((m) => ({ ...m, amount: m.amount / top })).sort((a, b) => a.ratio - b.ratio);
}
/**
 * How much of a mode at `hz` a stick of this hardness sets going. A stick stays on the skin for a moment, and
 * a longer touch cannot excite vibrations much faster than itself. (The contact times are this app's choice:
 * about 6 thousandths of a second for the softest mallet down to a third of one for the hardest stick.)
 */
export function stickShare(stick: number, hz: number): number {
  const contact = 0.006 * (0.055 ** (Math.min(100, Math.max(0, stick)) / 100));
  return 1 / (1 + (2 * hz * contact) ** 2);
}
/** How sharp every mode starts after a hit this hard, as a fraction (0.05 is 5% sharp), and how quickly that settles (seconds). */
export const STRETCH_TIME = 0.09;
export const stretch = (force: number) => 0.07 * (Math.min(100, Math.max(0, force)) / 100) ** 2;
/** The second head rings this much higher than the first (this app's choice), which makes each pair of modes beat. */
export const SECOND_HEAD = 1.017;
/** How long a mode rings: the higher its frequency, the sooner it dies, by an amount the damping control sets (this app's own rule). */
export const modeDecay = (s: Pick<DrumState, "decay" | "damp">, ratio: number) => Math.max(0.02, s.decay / ratio ** ((2 * Math.min(100, Math.max(0, s.damp))) / 100));

/**
 * One hit as samples. Every mode is a sine that starts at its excited size and dies away at its own rate.
 * After a hard hit all of them start sharp and settle over about a tenth of a second, because the stretched
 * skin is tighter (the paper's "tension modulation"). A second head, tuned a little apart, adds a copy of
 * each mode that beats against the first.
 */
export function renderDrum(s: DrumState, sampleRate: number, seconds: number): Float32Array {
  const f0 = noteToHz(s.note), total = Math.max(1, Math.round(seconds * sampleRate)), out = new Float32Array(total);
  const sharp = stretch(s.force), settle = Math.exp(-1 / (STRETCH_TIME * sampleRate)), second = Math.min(100, Math.max(0, s.second)) / 100;
  // how far ahead in phase the early sharpness leaves every mode, worked out once and shared
  const lead = new Float32Array(total);
  if (sharp > 0) { let extra = sharp, sum = 0; for (let n = 0; n < total; n++) { lead[n] = sum; sum += extra; extra *= settle; } }
  const level = 0.35 + 0.65 * (Math.min(100, Math.max(0, s.force)) / 100);
  for (const mode of modes(s)) {
    for (const [tune, share] of second > 0 ? [[1, 1], [SECOND_HEAD, 0.55 * second]] as const : [[1, 1]] as const) {
      const hz = f0 * mode.ratio * tune;
      const start = mode.amount * share * stickShare(s.stick, hz) * level;
      if (hz * (1 + sharp) > sampleRate * 0.45 || Math.abs(start) < 2e-4) continue;
      const w = (2 * Math.PI * hz) / sampleRate, fall = Math.exp(-6.9078 / (modeDecay(s, mode.ratio) * sampleRate));
      let size = start;
      for (let n = 0; n < total && Math.abs(size) > 1e-5; n++) { out[n]! += size * Math.sin(w * (n + lead[n]!)); size *= fall; }
    }
  }
  let peak = 1e-9;
  for (const v of out) peak = Math.max(peak, Math.abs(v));
  const fade = Math.min(total, Math.round(0.01 * sampleRate)), gain = (0.35 + 0.45 * (Math.min(100, Math.max(0, s.force)) / 100)) / peak;
  for (let n = 0; n < total; n++) out[n] = out[n]! * gain * (n >= total - fade ? (total - 1 - n) / fade : 1);
  return out;
}
