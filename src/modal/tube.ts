// A blown tube with a reed, as pure maths: the simplest clarinet-like model. The tube is a delay line: a
// pressure wave travels to the open end, most of it is reflected back upside down with its highs softened,
// and it returns to the mouthpiece. There the reed decides how much of the difference between the pressure
// in the mouth and the pressure coming back is reflected into the tube again. With enough breath the loop
// feeds itself and a note holds for as long as you blow.
//
// Structure from Julius O. Smith, "Physical Modeling Using Digital Waveguides" (1992), the section on
// single-reed instruments (library: smith-digital-waveguides, page 19): a cylindrical bore as a delay line,
// a bell that reflects the lows, and a reed with no mass worked as one look-up from the pressure difference
// to a reflection amount. The reed's own curve here (a straight line, limited at both ends) and every
// number in it are this app's choices, not taken from a source.
import { noteToHz } from "../synth/params";

export interface TubeState {
  /** How hard you blow, 0..100. */
  breath: number;
  /** How stiffly the reed is held, 0..100: a loose reed closes easily; a tight one stays open. */
  reed: number;
  /** How much of the highs the open end sends back, 0..100. */
  bright: number;
  /** How long the breath takes to build, in ms. */
  attack: number;
  /** Breath noise mixed into the blowing, 0..100. */
  noise: number;
}
export const TUBE_INITIAL: TubeState = { breath: 65, reed: 50, bright: 60, attack: 40, noise: 10 };
export const TUBE_RANGES: Record<keyof TubeState, { min: number; max: number; step: number; unit: string; label: string }> = {
  breath: { min: 0, max: 100, step: 1, unit: "%", label: "Breath" },
  reed: { min: 0, max: 100, step: 1, unit: "%", label: "Reed stiffness" },
  bright: { min: 0, max: 100, step: 1, unit: "%", label: "Brightness" },
  attack: { min: 5, max: 600, step: 5, unit: "ms", label: "Breath build-up" },
  noise: { min: 0, max: 100, step: 1, unit: "%", label: "Breath noise" },
};
const clamp = (v: number, lo: number, hi: number) => Math.min(hi, Math.max(lo, v));

/**
 * The reed: how much of the pressure difference `d` (bore minus mouth) is reflected back into the tube, -1..1.
 * A loose reed rests nearly shut, so it speaks with little breath and is blown shut by a lot; a stiff reed
 * rests further open, so it needs more breath and can take more. (This app's own curve.)
 */
export function reedReflection(d: number, reed: number): number {
  const rest = 0.72 - 0.22 * (clamp(reed, 0, 100) / 100);
  return clamp(rest - 0.45 * d, -1, 1);
}
/** The open end's loss filter weight (as in the string): 0.5 is dullest. */
const bellWeight = (bright: number) => 0.5 * (1 - clamp(bright, 0, 100) / 100) ** 1.2 + 0.02;
const BELL = 0.95; // how much of the wave the open end sends back

/** A note blown for `blown` seconds and then let go, as samples. */
export function renderTube(s: TubeState, note: number, sampleRate: number, blown: number, tail = 0.25): Float32Array {
  const hz = noteToHz(note), weight = bellWeight(s.bright), half = sampleRate / (2 * hz) - weight;
  // the wave comes back upside down, so the loop repeats every two trips: its length is half a period
  let delay = Math.floor(half - 0.1), fraction = half - delay;
  if (fraction < 0.1) { delay -= 1; fraction += 1; }
  delay = Math.max(1, delay);
  const allpass = (1 - fraction) / (1 + fraction), total = Math.round((blown + tail) * sampleRate), out = new Float32Array(total), line = new Float32Array(delay + 1);
  const rise = Math.max(1, (s.attack / 1000) * sampleRate), full = clamp(s.breath, 0, 100) / 100, hiss = (clamp(s.noise, 0, 100) / 100) * 0.25;
  let seed = 22222, at = 0, older = 0, apIn = 0, apOut = 0, dcIn = 0, dcOut = 0;
  const rand = () => { seed ^= seed << 13; seed >>>= 0; seed ^= seed >>> 17; seed ^= seed << 5; seed >>>= 0; return seed / 2147483648 - 1; };
  for (let n = 0; n < total; n++) {
    const blowing = n < blown * sampleRate ? Math.min(1, n / rise) : Math.max(0, 1 - (n - blown * sampleRate) / (0.03 * sampleRate));
    const mouth = full * blowing * (1 + hiss * rand());
    const arrived = line[at]!;                                   // the wave reaching the open end
    const lost = (1 - weight) * arrived + weight * older; older = arrived;
    const tuned = allpass * lost + apIn - allpass * apOut; apIn = lost; apOut = tuned;
    const back = -BELL * tuned;                                  // sent back upside down, a little smaller
    const d = back - mouth;                                      // what the reed feels
    line[at] = mouth + d * reedReflection(d, s.reed);            // mouth pressure plus the reflected part of the difference
    at = (at + 1) % delay;
    const y = arrived - dcIn + 0.995 * dcOut; dcIn = arrived; dcOut = y; // take out the steady push of the breath
    out[n] = y;
  }
  return out;
}

/** Whether a breath of this strength makes the tube sound at all (a quick, coarse trial of the model itself). */
export function speaks(s: TubeState, breath: number): boolean {
  const sr = 12000, y = renderTube({ ...s, breath, attack: 20, noise: 10 }, 57, sr, 0.6, 0);
  let peak = 0;
  for (let i = Math.round(0.42 * sr); i < Math.round(0.58 * sr); i++) peak = Math.max(peak, Math.abs(y[i]!));
  return peak > 0.05;
}
/** The breaths (0, 5, ... 100) at which the tube sounds, for the picture of where it speaks. */
export const speakingRange = (s: TubeState): boolean[] => Array.from({ length: 21 }, (_, i) => speaks(s, i * 5));
/** The size of the first `count` harmonics of a rendered note, measured from its steady part (the largest is 1). */
export function measuredHarmonics(y: Float32Array, hz: number, sampleRate: number, count = 12): number[] {
  const i0 = Math.round(y.length * 0.35), i1 = Math.round(y.length * 0.7), out: number[] = [];
  for (let n = 1; n <= count; n++) {
    let a = 0, b = 0;
    if (hz * n < sampleRate * 0.45) for (let i = i0; i < i1; i++) { const w = (2 * Math.PI * hz * n * i) / sampleRate, win = 0.5 - 0.5 * Math.cos((2 * Math.PI * (i - i0)) / (i1 - i0)); a += y[i]! * win * Math.sin(w); b += y[i]! * win * Math.cos(w); }
    out.push(Math.hypot(a, b));
  }
  const top = Math.max(1e-12, ...out);
  return out.map((v) => v / top);
}
