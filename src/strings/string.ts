// A plucked string, as pure maths. This is the first physical-modelling instrument (docs/PHYSICAL_MODELING.md).
// The sound is not a stored wave being shaped: it is what comes out of a loop. One trip round the loop is one
// trip down the string and back, so the loop's length is the note. Each trip the wave passes a gentle
// low-pass filter and loses a little, which is why the note fades and why its highs fade first.
//
// Method: the delay loop with a two-point average in it is the Karplus-Strong algorithm, here in the form
// Julius O. Smith gives in "Physical Modeling Using Digital Waveguides" (Computer Music Journal, 1992,
// figure 17 and the text around it; in the library as smith-digital-waveguides, page 18). The fine tuning
// uses a one-coefficient all-pass filter in the loop, as in Jaffe and Smith's extensions of that algorithm.
// A note is worked out whole, as a list of samples, and then played: nothing here runs while it sounds.
import { noteToHz } from "../synth/params";

export const EXCITERS = ["pluck", "noise"] as const;
export interface StringState {
  /** How the string is set going: a clean pluck with a shape of its own, or a burst of noise (the original trick). */
  exciter: (typeof EXCITERS)[number];
  /** Brightness, 0..100: how little the highs lose on each trip. 0 is the dullest (a plain average of two samples). */
  bright: number;
  /** How long the note's fundamental takes to fall 60 dB, in seconds. */
  decay: number;
  /** Where the string is plucked, as a percentage of its length from the bridge (1..50; 50 is the middle). */
  pick: number;
  /** How hard the thing plucking it is, 0..100: a soft thumb to a hard pick. */
  hard: number;
  /** Where the string is listened to, as a percentage of its length (0 is at the bridge: everything is heard). */
  pickup: number;
  /** How much of a hollow wooden body the string is heard through, 0..100. 0 is the bare string, as a pickup hears it. */
  body: number;
  /** A second string beside the first, this many cents sharp (0 is one string alone). The two drift against each other. */
  pair: number;
}
export const STRING_INITIAL: StringState = { exciter: "pluck", bright: 45, decay: 3, pick: 20, hard: 45, pickup: 0, pair: 0, body: 60 };
export const STRING_RANGES: Record<Exclude<keyof StringState, "exciter">, { min: number; max: number; step: number; unit: string; label: string }> = {
  bright: { min: 0, max: 100, step: 1, unit: "%", label: "Brightness" },
  decay: { min: 0.2, max: 8, step: 0.1, unit: "s", label: "Decay time" },
  pick: { min: 2, max: 50, step: 1, unit: "% along", label: "Pluck position" },
  hard: { min: 0, max: 100, step: 1, unit: "%", label: "Pick hardness" },
  pickup: { min: 0, max: 50, step: 1, unit: "% along", label: "Listening position" },
  pair: { min: 0, max: 30, step: 1, unit: "cents apart", label: "Second string" },
  body: { min: 0, max: 100, step: 1, unit: "%", label: "Wooden body" },
};

const clamp = (v: number, lo: number, hi: number) => Math.min(hi, Math.max(lo, v));

/** How long the highs last compared with the lowest part of the note: 2% as long on the dullest string, about half on the brightest. */
export const highsLast = (bright: number) => 0.02 + 0.5 * (clamp(bright, 0, 100) / 100) ** 2;
/** The frequency at which "the highs" are judged for a note of `hz`: 2 kHz, or two octaves above a high note. */
export const highHz = (hz: number, sampleRate: number) => Math.min(sampleRate * 0.4, Math.max(2000, 4 * hz));
/** How much of a sine at `hz` a one-pole low-pass with coefficient `pole` lets through (1 at the very bottom). */
export function lossGain(pole: number, hz: number, sampleRate: number): number {
  const w = (2 * Math.PI * hz) / sampleRate;
  return (1 - pole) / Math.sqrt(1 - 2 * pole * Math.cos(w) + pole * pole);
}
/**
 * The loss filter's coefficient for a note. A real string's highs die much sooner than its lows, and the
 * two-sample average of the first version could not take enough away on low notes, so the highs rang on
 * for seconds: the main reason it sounded electronic. This is a one-pole low-pass in the loop, set so that
 * a harmonic near `highHz` lasts `highsLast` times as long as the fundamental.
 */
export function lossPole(s: Pick<StringState, "bright" | "decay">, hz: number, sampleRate: number): number {
  const ref = highHz(hz, sampleRate), decay = Math.max(0.05, s.decay);
  const want = 10 ** ((-3 / hz) * (1 / (decay * highsLast(s.bright)) - 1 / decay)); // what the highs must keep per trip, relative to the fundamental
  let lo = 0, hi = 0.985;
  for (let i = 0; i < 40; i++) { const mid = (lo + hi) / 2; if (lossGain(mid, ref, sampleRate) / lossGain(mid, hz, sampleRate) > want) lo = mid; else hi = mid; }
  return (lo + hi) / 2;
}
/** How much is kept on one trip round the loop for the fundamental to fall 60 dB in `decay` seconds. */
export const tripGain = (hz: number, decay: number) => 10 ** (-3 / (hz * Math.max(0.05, decay)));

/**
 * The size of each harmonic at the moment of the pluck (index 1 upward). Plucking a string at one point
 * leaves out every harmonic that has a still point there: at a half, every 2nd; at a third, every 3rd.
 * Listening at a point does the same again for that point. A softer pick rounds the corner of the string's
 * first shape, which takes away the high harmonics.
 */
export function pluckHarmonics(s: StringState, hz: number, sampleRate: number): Float32Array {
  const top = Math.max(1, Math.floor((sampleRate * 0.45) / hz)), out = new Float32Array(top + 1);
  const pick = clamp(s.pick, 1, 50) / 100, pickup = clamp(s.pickup, 0, 50) / 100;
  const corner = 2 + 60 * (clamp(s.hard, 0, 100) / 100) ** 2; // the harmonic above which a soft pick has smoothed things away
  for (let n = 1; n <= top; n++) {
    const heard = pickup > 0 ? Math.sin(n * Math.PI * pickup) : 1;
    out[n] = ((Math.sin(n * Math.PI * pick) / n) * heard) / Math.sqrt(1 + (n / corner) ** 2);
  }
  return out;
}

/** A repeatable stream of random numbers from -1 to 1, so that the same settings always give the same note. */
function noise(seed: number): () => number {
  let a = seed >>> 0 || 1;
  return () => { a ^= a << 13; a >>>= 0; a ^= a >>> 17; a ^= a << 5; a >>>= 0; return a / 2147483648 - 1; };
}

/** What sets the string going: one period long. Either the pluck's own shape, or noise softened by the pick's hardness. */
export function excitation(s: StringState, hz: number, sampleRate: number): Float32Array {
  const length = Math.max(2, Math.round(sampleRate / hz)), out = new Float32Array(length);
  if (s.exciter === "noise") {
    const next = noise(12345), keep = 0.02 + 0.98 * (clamp(s.hard, 0, 100) / 100) ** 2;
    let y = 0;
    for (let i = 0; i < length; i++) { y += keep * (next() - y); out[i] = y; }
  } else {
    const h = pluckHarmonics(s, hz, sampleRate);
    for (let i = 0; i < length; i++) { let y = 0; for (let n = 1; n < h.length; n++) if (h[n]) y += h[n]! * Math.sin((2 * Math.PI * n * i) / length); out[i] = y; }
  }
  let mean = 0, peak = 1e-9;
  for (const v of out) mean += v / length;
  for (let i = 0; i < length; i++) { out[i]! -= mean; peak = Math.max(peak, Math.abs(out[i]!)); }
  for (let i = 0; i < length; i++) out[i] = (out[i]! / peak) * 0.6;
  return out;
}

/** The loop's settings for a note: its whole-sample length, the fine-tuning filter's coefficient, what is kept per trip, and the loss filter's coefficient. */
export function loopFor(s: StringState, hz: number, sampleRate: number): { delay: number; allpass: number; gain: number; pole: number } {
  const pole = lossPole(s, hz, sampleRate), period = sampleRate / hz, w = (2 * Math.PI * hz) / sampleRate;
  // the loss filter itself delays the note's lowest part by this many samples; the all-pass makes up the rest of the fraction
  const lag = Math.atan2(pole * Math.sin(w), 1 - pole * Math.cos(w)) / w;
  let delay = Math.floor(period - lag - 0.1), fraction = period - lag - delay;
  if (fraction < 0.1) { delay -= 1; fraction += 1; }
  const gain = Math.min(0.99995, tripGain(hz, s.decay) / lossGain(pole, hz, sampleRate));
  return { delay: Math.max(1, delay), allpass: (1 - fraction) / (1 + fraction), gain, pole };
}

/** How many times a second two strings `cents` apart drift in and out of step, at a note of `hz`. */
export const pairBeatHz = (hz: number, cents: number) => hz * (2 ** (cents / 1200) - 1);

/**
 * The body's own resonances: [frequency in Hz, sharpness, share]. A string by itself moves almost no air;
 * what is heard from an acoustic instrument is its hollow body being shaken by the string, and the body
 * rings at frequencies of its own whatever note is played. These four are this app's choice for "a small
 * hollow wooden box", not measurements of any instrument.
 */
export const BODY_MODES: [number, number, number][] = [[105, 9, 1], [205, 12, 0.8], [390, 8, 0.6], [640, 6, 0.4]];
/** The string heard through the body: the bare string turned down and softened on top, plus what each body resonance picks out of it. */
export function throughBody(y: Float32Array, amount: number, sampleRate: number): Float32Array {
  const m = clamp(amount, 0, 100) / 100;
  if (m <= 0) return y;
  const out = new Float32Array(y.length), soft = Math.exp((-2 * Math.PI * 4500) / sampleRate);
  let low = 0;
  for (let n = 0; n < y.length; n++) { low = (1 - soft) * y[n]! + soft * low; out[n] = (1 - m) * y[n]! + m * 0.55 * low; }
  for (const [hz, q, share] of BODY_MODES) {
    const w = (2 * Math.PI * hz) / sampleRate, alpha = Math.sin(w) / (2 * q), a0 = 1 + alpha, b0 = alpha / a0, a1 = (-2 * Math.cos(w)) / a0, a2 = (1 - alpha) / a0;
    let x1 = 0, x2 = 0, y1 = 0, y2 = 0;
    for (let n = 0; n < y.length; n++) { const x = y[n]!, v = b0 * x - b0 * x2 - a1 * y1 - a2 * y2; x2 = x1; x1 = x; y2 = y1; y1 = v; out[n]! += m * share * 0.9 * v; }
  }
  return out;
}

/** One whole note as samples. With a second string, the two are worked out separately and added; then the body. */
export function renderString(s: StringState, note: number, sampleRate: number, seconds: number): Float32Array {
  const one = renderOne(s, note, sampleRate, seconds);
  if (s.pair > 0) { const two = renderOne(s, note + s.pair / 100, sampleRate, seconds); for (let i = 0; i < one.length; i++) one[i] = 0.6 * (one[i]! + two[i]!); }
  return throughBody(one, s.body, sampleRate);
}

/** One string: the excitation goes into the loop once, and the loop does the rest. */
function renderOne(s: StringState, note: number, sampleRate: number, seconds: number): Float32Array {
  const hz = noteToHz(note), { delay, allpass, gain, pole } = loopFor(s, hz, sampleRate);
  const input = excitation(s, hz, sampleRate), total = Math.max(1, Math.round(seconds * sampleRate)), out = new Float32Array(total);
  const line = new Float32Array(delay + 2); // the string: what went in `delay` samples ago comes out now
  let at = 0, older = 0, apIn = 0, apOut = 0;
  for (let n = 0; n < total; n++) {
    const back = line[at]!;                          // the wave returning from its trip
    const lost = (1 - pole) * back + pole * older;      // the loss filter: each trip takes a little, and more from the highs
    older = lost;
    const tuned = allpass * lost + apIn - allpass * apOut; // the fine-tuning filter: delays by a fraction of a sample
    apIn = lost; apOut = tuned;
    const y = (n < input.length ? input[n]! : 0) + gain * tuned;
    line[at] = y;
    at = (at + 1) % delay;
    out[n] = y;
  }
  // a short fade at the very end, so a note cut off by the length of the list does not click
  const fade = Math.min(total, Math.round(0.02 * sampleRate));
  for (let i = 0; i < fade; i++) out[total - 1 - i]! *= i / fade;
  return out;
}

/** The string's shape just after the pluck, for the picture: a straight line up to the pluck point and down again (0..1 along, 0..1 high). */
export const pluckShape = (s: StringState, x: number) => { const p = clamp(s.pick, 1, 50) / 100; return x <= p ? x / p : (1 - x) / (1 - p); };

/** A hidden string to copy by ear: only brightness, decay time and pluck position differ from the starting settings. */
export function stringTarget(rand: () => number = Math.random): StringState {
  const pickOf = <T,>(list: T[]) => list[Math.min(list.length - 1, Math.floor(rand() * list.length))]!;
  return { ...STRING_INITIAL, bright: pickOf([10, 35, 65, 95]), decay: pickOf([0.5, 1.5, 4, 7]), pick: pickOf([6, 15, 30, 50]) };
}
export type Verdict = "matches" | "low" | "high";
/**
 * How an attempt compares with the target, one word per control and never the target's numbers.
 * Brightness within 15 points, decay within half as long again, pluck position within 6 points.
 */
export function judgeString(mine: StringState, target: StringState): { bright: Verdict; decay: Verdict; pick: Verdict; all: boolean } {
  const by = (off: number, slack: number): Verdict => (Math.abs(off) <= slack ? "matches" : off < 0 ? "low" : "high");
  const bright = by(mine.bright - target.bright, 15), decay = by(Math.log(mine.decay / target.decay), Math.log(1.5) + 1e-9), pick = by(mine.pick - target.pick, 6);
  return { bright, decay, pick, all: bright === "matches" && decay === "matches" && pick === "matches" && mine.exciter === target.exciter };
}
