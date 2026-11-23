// A plate reverb after Jon Dattorro, "Effect Design, Part 1: Reverberator and Other Filters", J. Audio Eng.
// Soc. 45(9), 1997 (in the library as `dattorro-effect-design-1`). The network is figure 1 of the paper
// (page 662): the two sides summed, a low-pass on the way in, four all-pass "input diffusers", then a "tank"
// of two halves that feed each other in a figure of eight. Each half is a modulated all-pass, a delay, a
// low-pass ("damping"), a gain ("decay"), another all-pass and another delay. The output is fourteen taps
// from inside the tank (table 2, page 664). Every delay length, tap place and default setting below is the
// paper's, given there for a sample rate of 29,761 Hz and scaled here to the rate in use.
//
// Ours, not the paper's: turning a wanted fade time into the decay gain (`plateDecay`), the level trim, and
// rendering the reverb once into an impulse (which freezes the slow wobble the paper puts on two delays).

/** The sample rate the paper's delay lengths are written for. */
export const PLATE_RATE = 29761;
/** Table 1 of the paper. */
export const PLATE = { excursion: 16, decay: 0.5, decayDiffusion1: 0.7, decayDiffusion2: 0.5, inputDiffusion1: 0.75, inputDiffusion2: 0.625, bandwidth: 0.9995, damping: 0.0005 } as const;
/** Figure 1: the four input diffusers, then each half of the tank (modulated all-pass, delay, all-pass, delay). */
export const PLATE_INPUT = [142, 107, 379, 277] as const;
export const PLATE_TANK = { left: { mod: 672, delay1: 4453, allpass: 1800, delay2: 3720 }, right: { mod: 908, delay1: 4217, allpass: 2656, delay2: 3163 } } as const;
/** Table 2: where the two outputs are read, as [which line, how far in, sign]. Each tap is weighted 0.6. */
type Line = "l1" | "la" | "l2" | "r1" | "ra" | "r2";
export const PLATE_TAPS: { left: [Line, number, 1 | -1][]; right: [Line, number, 1 | -1][] } = {
  left: [["r1", 266, 1], ["r1", 2974, 1], ["ra", 1913, -1], ["r2", 1996, 1], ["l1", 1990, -1], ["la", 187, -1], ["l2", 1066, -1]],
  right: [["l1", 353, 1], ["l1", 3627, 1], ["la", 1228, -1], ["l2", 2673, 1], ["r1", 2111, -1], ["ra", 335, -1], ["r2", 121, -1]],
};
/** Once round the whole tank, in samples at the paper's rate: the sound meets the decay gain four times on the way. */
export const PLATE_LOOP = 672 + 4453 + 1800 + 3720 + 908 + 4217 + 2656 + 3163;
/** Our rule: the decay gain for which the tail falls 60 dB in `seconds` (four gains per trip round the tank). */
export const plateDecay = (seconds: number) => Math.min(0.97, 10 ** ((-3 * (PLATE_LOOP / PLATE_RATE)) / (4 * Math.max(0.05, seconds))));

class Delay {
  private readonly buf: Float32Array; private at = 0;
  constructor(readonly length: number) { this.buf = new Float32Array(Math.max(2, length + 1)); }
  /** What went in `back` samples ago (1 is the newest). */
  tap(back: number): number { const n = this.buf.length; return this.buf[(((this.at - Math.min(n - 1, Math.max(1, Math.round(back)))) % n) + n) % n]!; }
  /** Between two samples, for the modulated lines. */
  tapBetween(back: number): number { const whole = Math.floor(back), f = back - whole, n = this.buf.length, i = (((this.at - whole) % n) + n) % n, j = (i - 1 + n) % n; return this.buf[i]! * (1 - f) + this.buf[j]! * f; }
  get out(): number { return this.tap(this.length); }
  push(v: number): void { this.buf[this.at] = v; this.at = (this.at + 1) % this.buf.length; }
}
/** The paper's all-pass lattice: `g` positive for the input and "decay diffusion 2" stages, negative ("note sign") for "decay diffusion 1". */
class Allpass {
  readonly line: Delay;
  constructor(length: number) { this.line = new Delay(length); }
  run(x: number, g: number, delayed = this.line.out): number { const v = x - g * delayed; this.line.push(v); return delayed + g * v; }
}

export interface PlateSettings { decay?: number; damping?: number; bandwidth?: number; /** 0 keeps the two modulated delays still */ excursion?: number }
/** The reverb itself, one sample at a time. The same code makes the impulse below and could run live. */
export class Plate {
  private readonly k: number;
  private readonly inputs: Allpass[]; private readonly modL: Allpass; private readonly modR: Allpass; private readonly apL: Allpass; private readonly apR: Allpass;
  private readonly lines: Record<Line, Delay>;
  private readonly taps: { left: [Delay, number, number][]; right: [Delay, number, number][] };
  private band = 0; private dampL = 0; private dampR = 0; private phase = 0;
  decay: number; damping: number; bandwidth: number; excursion: number;
  constructor(readonly sampleRate: number, s: PlateSettings = {}) {
    const k = (this.k = sampleRate / PLATE_RATE), len = (n: number) => Math.max(1, Math.round(n * k));
    this.decay = s.decay ?? PLATE.decay; this.damping = s.damping ?? PLATE.damping; this.bandwidth = s.bandwidth ?? PLATE.bandwidth; this.excursion = s.excursion ?? PLATE.excursion;
    this.inputs = PLATE_INPUT.map((n) => new Allpass(len(n)));
    const L = PLATE_TANK.left, R = PLATE_TANK.right, room = len(PLATE.excursion) + 2;
    this.modL = new Allpass(len(L.mod) + room); this.modR = new Allpass(len(R.mod) + room);
    this.apL = new Allpass(len(L.allpass)); this.apR = new Allpass(len(R.allpass));
    this.lines = { l1: new Delay(len(L.delay1)), la: this.apL.line, l2: new Delay(len(L.delay2)), r1: new Delay(len(R.delay1)), ra: this.apR.line, r2: new Delay(len(R.delay2)) };
    const place = (list: [Line, number, 1 | -1][]) => list.map(([line, at, sign]): [Delay, number, number] => [this.lines[line], Math.max(1, Math.round(at * k)), 0.6 * sign]);
    this.taps = { left: place(PLATE_TAPS.left), right: place(PLATE_TAPS.right) };
  }
  /** One sample in (the two sides), one sample out (all wet). */
  step(inL: number, inR: number, out: [number, number]): void {
    const k = this.k;
    // the two sides summed and halved, then the input low-pass ("bandwidth")
    this.band += this.bandwidth * ((inL + inR) / 2 - this.band);
    let x = this.band;
    x = this.inputs[0]!.run(x, PLATE.inputDiffusion1); x = this.inputs[1]!.run(x, PLATE.inputDiffusion1);
    x = this.inputs[2]!.run(x, PLATE.inputDiffusion2); x = this.inputs[3]!.run(x, PLATE.inputDiffusion2);
    // the slow wobble on the two modulated delays: about 1 Hz (the paper's footnote 14), the two sides a quarter turn apart
    this.phase += (2 * Math.PI) / this.sampleRate; if (this.phase > 2 * Math.PI) this.phase -= 2 * Math.PI;
    const swing = this.excursion * k * 0.5, { l1, l2, r1, r2 } = this.lines;
    // each half takes the input plus the far end of the other half, times the decay gain
    let a = x + this.decay * r2.out;
    a = this.modL.run(a, -PLATE.decayDiffusion1, this.modL.line.tapBetween(PLATE_TANK.left.mod * k + swing * (1 + Math.sin(this.phase))));
    const l1out = l1.out; l1.push(a);
    this.dampL = l1out * (1 - this.damping) + this.dampL * this.damping;
    const l2out = l2.out; l2.push(this.apL.run(this.dampL * this.decay, PLATE.decayDiffusion2));
    let b = x + this.decay * l2out;
    b = this.modR.run(b, -PLATE.decayDiffusion1, this.modR.line.tapBetween(PLATE_TANK.right.mod * k + swing * (1 + Math.cos(this.phase))));
    const r1out = r1.out; r1.push(b);
    this.dampR = r1out * (1 - this.damping) + this.dampR * this.damping;
    r2.push(this.apR.run(this.dampR * this.decay, PLATE.decayDiffusion2));
    let yl = 0, yr = 0;
    for (const [line, at, w] of this.taps.left) yl += w * line.tap(at);
    for (const [line, at, w] of this.taps.right) yr += w * line.tap(at);
    out[0] = yl; out[1] = yr;
  }
}

/**
 * The plate struck once and written down: its impulse, for a reverb that works by convolution. `seconds`
 * is the time the tail takes to fall 60 dB. `damping` (0 to 1; the paper's default is nearly none) takes the top off the tail as it goes round.
 * The level is set so that a longer plate is not simply a louder one (the tail's energy is held steady).
 */
export function plateImpulse(seconds: number, sampleRate: number, damping: number = PLATE.damping): [Float32Array<ArrayBuffer>, Float32Array<ArrayBuffer>] {
  const len = Math.max(1, Math.round(seconds * sampleRate * 1.1)), plate = new Plate(sampleRate, { decay: plateDecay(seconds), damping, excursion: 0 });
  const left = new Float32Array(len), right = new Float32Array(len), out: [number, number] = [0, 0];
  let energy = 0;
  for (let i = 0; i < len; i++) { plate.step(i === 0 ? 1 : 0, i === 0 ? 1 : 0, out); left[i] = out[0]; right[i] = out[1]; energy += out[0] * out[0] + out[1] * out[1]; }
  // the same energy the reverb's earlier impulse (fading noise) had, so the Mix knob means what it did
  const trim = energy > 0 ? Math.sqrt(2 / 3 / energy) : 0;
  // a short fade at the very end, so the cut is silent
  const fade = Math.min(len, Math.round(0.05 * sampleRate));
  for (let i = 0; i < len; i++) { const f = i >= len - fade ? (len - i) / fade : 1; left[i] = left[i]! * trim * f; right[i] = right[i]! * trim * f; }
  return [left, right];
}
