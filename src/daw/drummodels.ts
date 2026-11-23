// Three drum models ported from the source code of Plaits (the files analog_bass_drum.h, analog_snare_drum.h
// and hi_hat.h, with the filter they use from stmlib), which its author published under the MIT licence:
//
//   Copyright 2016 Emilie Gillet (emilie.o.gillet@gmail.com)
//
//   Permission is hereby granted, free of charge, to any person obtaining a copy of this software and
//   associated documentation files (the "Software"), to deal in the Software without restriction, including
//   without limitation the rights to use, copy, modify, merge, publish, distribute, sublicense, and/or sell
//   copies of the Software, and to permit persons to whom the Software is furnished to do so, subject to
//   the following conditions:
//
//   The above copyright notice and this permission notice shall be included in all copies or substantial
//   portions of the Software.
//
//   THE SOFTWARE IS PROVIDED "AS IS", WITHOUT WARRANTY OF ANY KIND, EXPRESS OR IMPLIED, INCLUDING BUT NOT
//   LIMITED TO THE WARRANTIES OF MERCHANTABILITY, FITNESS FOR A PARTICULAR PURPOSE AND NONINFRINGEMENT. IN
//   NO EVENT SHALL THE AUTHORS OR COPYRIGHT HOLDERS BE LIABLE FOR ANY CLAIM, DAMAGES OR OTHER LIABILITY,
//   WHETHER IN AN ACTION OF CONTRACT, TORT OR OTHERWISE, ARISING FROM, OUT OF OR IN CONNECTION WITH THE
//   SOFTWARE OR THE USE OR OTHER DEALINGS IN THE SOFTWARE.
//
// Each model follows the circuit of a classic analogue drum machine's voice: a short pulse strikes one or
// more ringing filters. What is the original's: the structure and every number inside the three models.
// What is ours: the translation to TypeScript, the settings each drum is played with (`MODEL_SETTINGS`),
// rendering a hit whole into a buffer, the repeatable noise, and the level trim. The originals' "sustain"
// mode (a drum that never dies) is left out. This is a derivative work and carries none of the original
// module's names.

/** The models' time constants are written in samples at this rate, so hits are always worked out at it. */
export const MODEL_RATE = 48000;
const ratio = (semitones: number) => 2 ** (semitones / 12);
const clamp = (v: number, lo: number, hi: number) => Math.min(hi, Math.max(lo, v));
const softClip = (x: number) => (x < -3 ? -1 : x > 3 ? 1 : (x * (27 + x * x)) / (27 + 9 * x * x));
/** stmlib's state-variable filter: `f` is a share of the sample rate, `q` the resonance. */
class Svf {
  private g = 0; private r = 0; private h = 0; private s1 = 0; private s2 = 0;
  lp = 0; bp = 0; hp = 0;
  set(f: number, q: number): void { this.g = Math.tan(Math.PI * Math.min(0.497, Math.max(0, f))); this.r = 1 / q; this.h = 1 / (1 + this.r * this.g + this.g * this.g); }
  run(x: number): void {
    this.hp = (x - this.r * this.s1 - this.g * this.s1 - this.s2) * this.h;
    this.bp = this.g * this.hp + this.s1; this.s1 = this.g * this.hp + this.bp;
    this.lp = this.g * this.bp + this.s2; this.s2 = this.g * this.bp + this.lp;
  }
}
const noiseFrom = (seed: number) => { let s = seed >>> 0; return () => { s = (Math.imul(s, 1664525) + 1013904223) >>> 0; return s / 4294967296; }; };

export interface KickSet { hz: number; tone: number; decay: number; attackFm: number; selfFm: number }
/** The bass drum: a pulse into one ringing filter whose pitch is pushed up at the start and by its own swing. */
export function modelKick(set: KickSet, accent: number, seconds: number): Float32Array {
  const n = Math.round(seconds * MODEL_RATE), out = new Float32Array(n), f0 = set.hz / MODEL_RATE, { tone, decay } = set;
  const diode = (x: number) => (x >= 0 ? x : (0.7 * (2 * x)) / (1 + Math.abs(2 * x)));
  const pulseDecay = 0.2e-3 * MODEL_RATE, pulseFilter = 0.1e-3 * MODEL_RATE, retrigTime = 0.05 * MODEL_RATE;
  const scale = 0.001 / f0, q = 1500 * ratio(decay * 80), toneF = Math.min(4 * f0 * ratio(tone * 108), 1), leak = 0.08 * (tone + 0.25);
  let pulseLeft = Math.trunc(1.0e-3 * MODEL_RATE), fmLeft = Math.trunc(6.0e-3 * MODEL_RATE), pulseHeld = 0, pulseLp = 0, fmLp = 0, retrig = 0, lpOut = 0, toneLp = 0;
  const height = 3 + 7 * accent, res = new Svf();
  for (let i = 0; i < n; i++) {
    let pulse: number;
    if (pulseLeft) { pulseLeft--; pulse = pulseLeft ? height : height - 1; pulseHeld = pulse; } else { pulseHeld *= 1 - 1 / pulseDecay; pulse = pulseHeld; }
    pulseLp += (1 / pulseFilter) * (pulse - pulseLp);
    pulse = diode(pulse - pulseLp + pulse * 0.044);
    let fmPulse = 0;
    if (fmLeft) { fmLeft--; fmPulse = 1; retrig = fmLeft ? 0 : -0.8; } else retrig *= 1 - 1 / retrigTime;
    fmLp += (1 / pulseFilter) * (fmPulse - fmLp);
    const punch = 0.7 + diode(10 * lpOut - 1);
    const f = clamp(f0 * (1 + fmLp * 1.7 * set.attackFm + punch * 0.08 * set.selfFm), 0, 0.4);
    res.set(f, 1 + q * f); res.run((pulse - retrig * 0.2) * scale); lpOut = res.lp;
    toneLp += toneF * (pulse * leak + res.bp - toneLp);
    out[i] = toneLp;
  }
  return out;
}

export interface SnareSet { hz: number; tone: number; decay: number; snappy: number }
export const SNARE_MODES = [1.0, 2.0, 3.18, 4.16, 5.62] as const;
/** The snare: a pulse into up to five ringing filters (the shell) beside a burst of filtered noise (the wires). */
export function modelSnare(set: SnareSet, accent: number, seconds: number, seed = 1): Float32Array {
  const n = Math.round(seconds * MODEL_RATE), out = new Float32Array(n), f0 = set.hz / MODEL_RATE, { decay } = set, rnd = noiseFrom(seed);
  const decayXt = decay * (1 + decay * (decay - 1)), pulseDecay = 0.1e-3 * MODEL_RATE, q = 2000 * ratio(decayXt * 84);
  const noiseFall = 1 - 0.0017 * ratio(-decay * (50 + set.snappy * 10)), leak = set.snappy * (2 - set.snappy) * 0.1, snappy = clamp(set.snappy * 1.1 - 0.05, 0, 1);
  const f = SNARE_MODES.map((m) => Math.min(f0 * m, 0.499)), shellRes = f.map((fi, i) => { const s = new Svf(); s.set(fi, 1 + fi * (i === 0 ? q : q * 0.25)); return s; });
  const gain = [0, 0, 0, 0, 0]; let tone = set.tone;
  if (tone < 0.666667) { tone *= 1.5; gain[0] = 1.5 + (1 - tone) * (1 - tone) * 4.5; gain[1] = 2 * tone + 0.15; }
  else { tone = (tone - 0.666667) * 3; gain[0] = 1.5 - tone * 0.5; gain[1] = 2.15 - tone * 0.7; for (let i = 2; i < 5; i++) { gain[i] = tone; tone *= tone; } }
  const fNoise = clamp(f0 * 16, 0, 0.499), noiseFilter = new Svf(); noiseFilter.set(fNoise, 1 + fNoise * 1.5);
  let pulseLeft = Math.trunc(1.0e-3 * MODEL_RATE), pulseHeld = 0, pulseLp = 0, noiseEnv = 2;
  const height = 3 + 7 * accent;
  for (let i = 0; i < n; i++) {
    let pulse: number;
    if (pulseLeft) { pulseLeft--; pulse = pulseLeft ? height : height - 1; pulseHeld = pulse; } else { pulseHeld *= 1 - 1 / pulseDecay; pulse = pulseHeld; }
    pulseLp += 0.75 * (pulse - pulseLp);
    let shell = 0;
    for (let m = 0; m < 5; m++) { const hit = m === 0 ? pulse - pulseLp + 0.006 * pulse : 0.026 * pulse; shellRes[m]!.run(hit); shell += gain[m]! * (shellRes[m]!.bp + hit * leak); }
    shell = softClip(shell);
    let noise = Math.max(0, 2 * rnd() - 1);
    noiseEnv *= noiseFall; noise *= noiseEnv * snappy * 2;
    noiseFilter.run(noise);
    out[i] = noiseFilter.bp + shell * (1 - snappy);
  }
  return out;
}

export interface HatSet { hz: number; tone: number; decay: number; noisiness: number }
/** The six square waves a classic hi-hat circuit mixes, as multiples of the first. */
export const HAT_RATIOS = [1.0, 1.304, 1.466, 1.787, 1.932, 2.536] as const;
/** The hi-hat: six square waves that do not line up, through a resonant band-pass, an uneven amplifier and a high-pass. */
export function modelHat(set: HatSet, accent: number, seconds: number, seed = 1): Float32Array {
  const n = Math.round(seconds * MODEL_RATE), out = new Float32Array(n), f0 = set.hz / MODEL_RATE, { tone, decay } = set, rnd = noiseFrom(seed);
  const fall = 1 - 0.003 * ratio(-decay * 84), step = HAT_RATIOS.map((r) => Math.min(2 * f0 * r, 0.499)), phase = [0, 0, 0, 0, 0, 0];
  const cutoff = clamp((150 / MODEL_RATE) * ratio(tone * 72), 0, 16000 / MODEL_RATE), colour = new Svf(), hpf = new Svf();
  colour.set(cutoff, 3 + 3 * tone); hpf.set(cutoff, 0.5);
  const noisy = set.noisiness * set.noisiness, noiseF = clamp(f0 * (16 + 16 * (1 - noisy)), 0, 0.5);
  let env = (1.5 + 0.5 * (1 - decay)) * (0.3 + 0.7 * accent), clock = 0, held = 0;
  for (let i = 0; i < n; i++) {
    let high = 0;
    for (let k = 0; k < 6; k++) { phase[k] = (phase[k]! + step[k]!) % 1; if (phase[k]! >= 0.5) high++; }
    colour.run(0.33 * high - 1);
    let s = colour.bp;
    clock += noiseF; if (clock >= 1) { clock -= 1; held = rnd() - 0.5; }
    s += noisy * (held - s);
    env *= fall;
    s *= s > 0 ? 4 : 0.1; s = s / (1 + Math.abs(s));
    hpf.run((s + 0.1) * env);
    out[i] = hpf.hp;
  }
  return out;
}

export type ModelVoice = "mkick" | "msnare" | "mhat" | "mohat";
/** The settings each modelled drum is played with here, and how long it rings. Our choices, not the originals'. */
export const MODEL_SETTINGS = {
  mkick: { hz: 52, tone: 0.45, decay: 0.55, attackFm: 0.8, selfFm: 0.35, seconds: 1.2 },
  msnare: { hz: 185, tone: 0.5, decay: 0.45, snappy: 0.6, seconds: 0.6 },
  mhat: { hz: 207, tone: 0.75, decay: 0.3, noisiness: 0.25, seconds: 0.3 },
  mohat: { hz: 207, tone: 0.75, decay: 0.78, noisiness: 0.25, seconds: 1.4 },
} as const;
/**
 * One hit of a modelled drum, ready to play at MODEL_RATE. `strength` is how hard (0 to 1), `decay` scales
 * the ring (1 is the usual), `tone` (-1 to 1) darkens or brightens. The level is trimmed so the hardest hit
 * of each drum peaks at the same height; softer hits come out quieter by themselves, as the models intend.
 */
export function modelHit(voice: ModelVoice, strength: number, decay = 1, tone = 0): Float32Array {
  const s = MODEL_SETTINGS[voice], d = clamp(s.decay + 0.25 * Math.log2(clamp(decay, 0.25, 4)), 0.02, 0.98), t = clamp(s.tone + 0.3 * clamp(tone, -1, 1), 0, 1), secs = s.seconds * clamp(decay, 0.5, 3);
  const make = (accent: number): Float32Array => voice === "mkick" ? modelKick({ ...MODEL_SETTINGS.mkick, decay: d, tone: t }, accent, secs)
    : voice === "msnare" ? modelSnare({ ...MODEL_SETTINGS.msnare, decay: d, tone: t }, accent, secs)
    : modelHat({ ...MODEL_SETTINGS[voice], decay: d, tone: t }, accent, secs);
  const key = `${voice}|${d.toFixed(3)}|${t.toFixed(3)}`;
  let full = PEAKS.get(key);
  if (full === undefined) { full = make(1).reduce((p, v) => Math.max(p, Math.abs(v)), 1e-9); PEAKS.set(key, full); }
  // the models answer a soft hit mostly by changing tone; the snare's noise does not answer at all, so (our choice) a soft hit is also turned down a little
  const v = clamp(strength, 0, 1), out = make(v), k = (0.9 / full) * (0.45 + 0.55 * v), fade = Math.min(out.length, Math.round(0.01 * MODEL_RATE));
  for (let i = 0; i < out.length; i++) out[i] = out[i]! * k * (i >= out.length - fade ? (out.length - i) / fade : 1);
  return out;
}
const PEAKS = new Map<string, number>();
