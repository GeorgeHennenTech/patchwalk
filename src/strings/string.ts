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
}
export const STRING_INITIAL: StringState = { exciter: "pluck", bright: 60, decay: 3, pick: 20, hard: 60, pickup: 0 };
export const STRING_RANGES: Record<Exclude<keyof StringState, "exciter">, { min: number; max: number; step: number; unit: string; label: string }> = {
  bright: { min: 0, max: 100, step: 1, unit: "%", label: "Brightness" },
  decay: { min: 0.2, max: 8, step: 0.1, unit: "s", label: "Decay time" },
  pick: { min: 2, max: 50, step: 1, unit: "% along", label: "Pluck position" },
  hard: { min: 0, max: 100, step: 1, unit: "%", label: "Pick hardness" },
  pickup: { min: 0, max: 50, step: 1, unit: "% along", label: "Listening position" },
};

const clamp = (v: number, lo: number, hi: number) => Math.min(hi, Math.max(lo, v));

/** The loss filter's weight on the older of its two samples: 0.5 is the plain average (dullest), near 0 passes almost everything. */
export const lossWeight = (bright: number) => 0.5 * (1 - clamp(bright, 0, 100) / 100) ** 1.5 + 0.004;
/** How much of a sine at `hz` the loss filter lets through on one trip (1 at the bottom, less higher up). */
export function lossGain(bright: number, hz: number, sampleRate: number): number {
  const s = lossWeight(bright), w = (2 * Math.PI * hz) / sampleRate;
  return Math.sqrt((1 - s) ** 2 + s * s + 2 * s * (1 - s) * Math.cos(w));
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

/** The loop's settings for a note: its whole-sample length, the fine-tuning filter's coefficient, and what is kept per trip. */
export function loopFor(s: StringState, hz: number, sampleRate: number): { delay: number; allpass: number; gain: number; weight: number } {
  const weight = lossWeight(s.bright), period = sampleRate / hz;
  // the loss filter itself delays by about `weight` samples; the all-pass makes up the rest of the fraction
  let delay = Math.floor(period - weight - 0.1), fraction = period - weight - delay;
  if (fraction < 0.1) { delay -= 1; fraction += 1; }
  const gain = Math.min(0.99995, tripGain(hz, s.decay) / lossGain(s.bright, hz, sampleRate));
  return { delay: Math.max(1, delay), allpass: (1 - fraction) / (1 + fraction), gain, weight };
}

/** One whole note as samples: the excitation goes into the loop once, and the loop does the rest. */
export function renderString(s: StringState, note: number, sampleRate: number, seconds: number): Float32Array {
  const hz = noteToHz(note), { delay, allpass, gain, weight } = loopFor(s, hz, sampleRate);
  const input = excitation(s, hz, sampleRate), total = Math.max(1, Math.round(seconds * sampleRate)), out = new Float32Array(total);
  const line = new Float32Array(delay + 2); // the string: what went in `delay` samples ago comes out now
  let at = 0, older = 0, apIn = 0, apOut = 0;
  for (let n = 0; n < total; n++) {
    const back = line[at]!;                          // the wave returning from its trip
    const lost = (1 - weight) * back + weight * older; // the loss filter: a weighted average of two samples
    older = back;
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
