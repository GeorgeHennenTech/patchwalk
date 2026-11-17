// Effects that have to be worked out one sample at a time: compressor, limiter, gate, crusher. The browser's
// ready-made parts cannot do these exactly, so they run in an AudioWorklet (`dsp.worklet.ts` wraps this file).
// Nothing here touches the browser, so tests run the very same code the sound is made with.
// The designs are the standard textbook ones; every fixed number is our own choice.
export type P = Record<string, number>;
export interface Dsp { set(p: P): void; run(inL: Float32Array, inR: Float32Array, outL: Float32Array, outR: Float32Array): void; /** how many dB the sound is being turned down right now */ reduction?(): number }

const dbToGain = (db: number) => 10 ** (db / 20);
const toDb = (v: number) => 20 * Math.log10(v + 1e-10);
/** How much of the way a smoothed value moves each sample to get about two thirds of the way there in `ms`. */
export const stepFor = (ms: number, sampleRate: number) => (ms <= 0 ? 1 : 1 - Math.exp(-1 / ((ms / 1000) * sampleRate)));

/**
 * A compressor's rule: a sound at `inDb` comes out at this level. Below the threshold nothing happens; above
 * it the extra is divided by the ratio; `knee` dB wide around the threshold the corner is rounded.
 */
export function compCurveDb(inDb: number, threshold: number, ratio: number, knee = 0): number {
  const over = inDb - threshold, r = Math.max(1, ratio);
  if (knee > 0 && 2 * Math.abs(over) <= knee) return inDb + ((1 / r - 1) * (over + knee / 2) ** 2) / (2 * knee);
  return over <= 0 ? inDb : threshold + over / r;
}
export const GLUE_ATTACKS = [0.01, 0.1, 0.3, 1, 3, 10, 30], GLUE_RELEASES = [100, 200, 400, 600, 800, 1200], GLUE_RATIOS = [2, 4, 10];
export const GLUE_KNEE = 6, RMS_MS = 10;

/**
 * Compressor. The level is read from the louder side, so both sides are turned down together. In "peak"
 * reading the level follows each peak at once and falls back over the release time; in "average" reading
 * (the glue compressor) it is the average power over about 10 ms and the gain itself is let back up over
 * the release time. The gain is taken down over the attack time.
 */
export class CompDsp implements Dsp {
  private env = 0; private sq = 0; private y = 0; private worst = 0;
  private p = { threshold: -18, ratio: 4, knee: 0, makeup: 1, dry: 0, wet: 1, att: 1, relDecay: 1, rel: 1, clip: false };
  constructor(private readonly sampleRate: number, private readonly glue = false) {}
  set(p: P): void {
    const glue = this.glue, mix = Math.min(1, Math.max(0, (p.mix ?? 100) / 100));
    const attack = glue ? GLUE_ATTACKS[p.attack ?? 3] ?? 1 : p.attack ?? 10, release = glue ? GLUE_RELEASES[p.release ?? 2] ?? 400 : p.release ?? 120;
    this.p = { threshold: p.threshold ?? -18, ratio: glue ? GLUE_RATIOS[p.ratio ?? 1] ?? 4 : p.ratio ?? 4, knee: glue ? GLUE_KNEE : p.knee ?? 0, makeup: dbToGain(p.makeup ?? 0), dry: 1 - mix, wet: mix,
      att: stepFor(attack, this.sampleRate), relDecay: Math.exp(-1 / ((release / 1000) * this.sampleRate)), rel: stepFor(release, this.sampleRate), clip: glue && !!p.clip };
  }
  run(inL: Float32Array, inR: Float32Array, outL: Float32Array, outR: Float32Array): void {
    const p = this.p, rms = stepFor(RMS_MS, this.sampleRate);
    let { env, sq, y } = this, worst = 0;
    for (let i = 0; i < inL.length; i++) {
      const l = inL[i]!, r = inR[i]!, a = Math.max(Math.abs(l), Math.abs(r));
      let level: number;
      if (this.glue) { sq += (a * a - sq) * rms; level = Math.sqrt(sq); } else { env = a > env ? a : env * p.relDecay; level = env; }
      const inDb = toDb(level), want = compCurveDb(inDb, p.threshold, p.ratio, p.knee) - inDb;    // zero or negative
      y += (want - y) * (want < y ? p.att : this.glue ? p.rel : 1);
      if (y < worst) worst = y;
      const g = dbToGain(y) * p.makeup;
      let wl = l * g, wr = r * g;
      if (p.clip) { wl = Math.tanh(wl); wr = Math.tanh(wr); }
      outL[i] = l * p.dry + wl * p.wet; outR[i] = r * p.dry + wr * p.wet;
    }
    this.env = env < 1e-9 ? 0 : env; this.sq = sq < 1e-18 ? 0 : sq; this.y = y; this.worst = -worst;
  }
  reduction(): number { return this.worst; }
}

export const LIMIT_LOOK_MS = 1.5;
/**
 * Limiter: nothing comes out above the ceiling. It looks 1.5 ms ahead (so it is that late): the gain each
 * sample needs is found, the lowest needed in the window ahead is taken, and that is smoothed over the same
 * window, so the gain is already down when a peak arrives and never jumps.
 */
export class LimiterDsp implements Dsp {
  private readonly n: number; private readonly need: Float32Array; private readonly low: Float32Array; private readonly dl: Float32Array; private readonly dr: Float32Array;
  private at = 0; private r = 1; private sum = 0; private worst = 0;
  private p = { drive: 1, ceiling: 1, rel: 1 };
  constructor(private readonly sampleRate: number) {
    this.n = Math.max(2, Math.round((LIMIT_LOOK_MS / 1000) * sampleRate));
    this.need = new Float32Array(this.n).fill(1); this.low = new Float32Array(this.n).fill(1); this.dl = new Float32Array(this.n); this.dr = new Float32Array(this.n);
    this.sum = this.n;
  }
  /** How late the sound comes out, in samples. */
  get lag(): number { return this.n - 1; }
  set(p: P): void { this.p = { drive: dbToGain(p.gain ?? 0), ceiling: dbToGain(p.ceiling ?? -0.3), rel: stepFor(p.release ?? 100, this.sampleRate) }; }
  run(inL: Float32Array, inR: Float32Array, outL: Float32Array, outR: Float32Array): void {
    const { n, need, low, dl, dr } = this, p = this.p;
    let { at, r, sum } = this, worst = 1;
    for (let i = 0; i < inL.length; i++) {
      const l = inL[i]! * p.drive, rr = inR[i]! * p.drive, a = Math.max(Math.abs(l), Math.abs(rr)), g = a > p.ceiling ? p.ceiling / a : 1;
      r = Math.min(g, r + (1 - r) * p.rel);                       // down at once, back up over the release time
      need[at] = r;
      let m = 1; for (let k = 0; k < n; k++) if (need[k]! < m) m = need[k]!;       // the lowest gain needed in the window
      sum += m - low[at]!; low[at] = m;                           // ...averaged over a window of the same length
      const next = (at + 1) % n, gain = Math.min(1, sum / n);
      if (gain < worst) worst = gain;
      dl[at] = l; dr[at] = rr;
      outL[i] = dl[next]! * gain; outR[i] = dr[next]! * gain;     // the sound from n - 1 samples ago
      at = next;
    }
    this.at = at; this.r = r; this.sum = sum; this.worst = -toDb(worst);
  }
  reduction(): number { return this.worst; }
}

export const GATE_LEVEL_MS = 8;
/**
 * Gate: while the sound is under the threshold it is turned down to the floor. It opens when the level
 * passes the threshold, stays open until the level has been under (threshold - return) for the hold time,
 * and moves between open and shut over the attack and release times.
 */
export class GateDsp implements Dsp {
  private env = 0; private open = false; private quiet = 0; private g = 0; private worst = 0;
  private p = { on: 1, off: 1, hold: 0, floor: 0, att: 1, rel: 1 };
  private readonly decay: number;
  constructor(private readonly sampleRate: number) { this.decay = Math.exp(-1 / ((GATE_LEVEL_MS / 1000) * sampleRate)); }
  set(p: P): void {
    const th = p.threshold ?? -40;
    this.p = { on: dbToGain(th), off: dbToGain(th - (p.back ?? 3)), hold: ((p.hold ?? 20) / 1000) * this.sampleRate, floor: (p.floor ?? -80) <= -80 ? 0 : dbToGain(p.floor ?? -80), att: stepFor(p.attack ?? 1, this.sampleRate), rel: stepFor(p.release ?? 80, this.sampleRate) };
  }
  run(inL: Float32Array, inR: Float32Array, outL: Float32Array, outR: Float32Array): void {
    const p = this.p; let { env, open, quiet, g } = this, worst = 1;
    for (let i = 0; i < inL.length; i++) {
      const l = inL[i]!, r = inR[i]!, a = Math.max(Math.abs(l), Math.abs(r));
      env = a > env ? a : env * this.decay;
      if (env >= p.on) { open = true; quiet = 0; } else if (open && env < p.off && ++quiet > p.hold) open = false; else if (env >= p.off) quiet = 0;
      const want = open ? 1 : p.floor;
      g += (want - g) * (want > g ? p.att : p.rel);
      if (g < worst) worst = g;
      outL[i] = l * g; outR[i] = r * g;
    }
    this.env = env < 1e-9 ? 0 : env; this.open = open; this.quiet = quiet; this.g = g < 1e-9 && !open ? p.floor : g; this.worst = -toDb(worst);
  }
  reduction(): number { return Math.min(80, this.worst); }
}

/** A sample rounded to one of the levels that `bits` bits can hold. */
export const crushValue = (x: number, bits: number) => { const steps = 2 ** (Math.min(16, Math.max(1, bits)) - 1); return Math.round(x * steps) / steps; };
/** Crusher: fewer levels (bits) and fewer samples a second (each kept sample is held for `hold` samples). */
export class CrushDsp implements Dsp {
  private count = 0; private hl = 0; private hr = 0;
  private p = { bits: 16, hold: 1, dry: 0, wet: 1 };
  constructor(_sampleRate: number) {}
  set(p: P): void { const mix = Math.min(1, Math.max(0, (p.mix ?? 100) / 100)); this.p = { bits: p.bits ?? 16, hold: Math.max(1, Math.round(p.hold ?? 1)), dry: 1 - mix, wet: mix }; }
  run(inL: Float32Array, inR: Float32Array, outL: Float32Array, outR: Float32Array): void {
    const p = this.p; let { count, hl, hr } = this;
    for (let i = 0; i < inL.length; i++) {
      if (count <= 0) { hl = crushValue(inL[i]!, p.bits); hr = crushValue(inR[i]!, p.bits); count = p.hold; }
      count--;
      outL[i] = inL[i]! * p.dry + hl * p.wet; outR[i] = inR[i]! * p.dry + hr * p.wet;
    }
    this.count = count; this.hl = hl; this.hr = hr;
  }
}

export const RESONATORS = 5, RES_NAMES = ["I", "II", "III", "IV", "V"];
/** The frequency of each of the five resonators: the first sits on the note, the others a number of semitones from it. */
export const resonatorHz = (p: P): number[] => RES_NAMES.map((_, i) => 440 * 2 ** (((p.note ?? 48) + (i ? p[`r${i + 1}pitch`] ?? 0 : 0) - 69) / 12));
/** How much of a trip round a resonator's loop is kept, so that it rings down 60 dB in `decay` seconds. */
export const resonatorKeep = (hz: number, decay: number) => 10 ** (-3 / (hz * Math.max(0.01, decay)));
/**
 * Resonators: five tuned loops (a delay one period long that feeds itself), each ringing at its own note
 * when the sound passing through excites it. Colour takes the top off each trip, so high partials die first.
 */
export class ResonatorDsp implements Dsp {
  private readonly size: number; private readonly buf: Float32Array[]; private at = 0; private readonly lp = new Float32Array(RESONATORS * 2);
  private p = { len: [1, 1, 1, 1, 1], keep: [0, 0, 0, 0, 0], gain: [0, 0, 0, 0, 0], open: 1, dry: 0, wet: 1 };
  constructor(private readonly sampleRate: number) { this.size = Math.ceil(sampleRate / 20) + 4; this.buf = Array.from({ length: RESONATORS * 2 }, () => new Float32Array(this.size)); }
  set(p: P): void {
    const hz = resonatorHz(p), mix = Math.min(1, Math.max(0, (p.mix ?? 100) / 100));
    this.p = { len: hz.map((f) => Math.min(this.size - 3, Math.max(2, this.sampleRate / f))), keep: hz.map((f) => resonatorKeep(f, p.decay ?? 1.5)),
      gain: RES_NAMES.map((_, i) => ((p[`r${i + 1}on`] ?? 1) ? dbToGain(p[`r${i + 1}gain`] ?? 0) : 0)), open: 0.05 + 0.95 * Math.min(1, Math.max(0, (p.colour ?? 100) / 100)) ** 2, dry: 1 - mix, wet: mix };
  }
  run(inL: Float32Array, inR: Float32Array, outL: Float32Array, outR: Float32Array): void {
    const { size, buf, lp } = this, p = this.p; let at = this.at;
    for (let i = 0; i < inL.length; i++) {
      for (let side = 0; side < 2; side++) {
        const x = side ? inR[i]! : inL[i]!; let sum = 0;
        for (let k = 0; k < RESONATORS; k++) {
          if (!p.gain[k]) continue;
          const b = buf[k * 2 + side]!, n = k * 2 + side, where = at - p.len[k]! + size, i0 = Math.floor(where), f = where - i0, back = b[i0 % size]! * (1 - f) + b[(i0 + 1) % size]! * f;
          lp[n] = lp[n]! + (back - lp[n]!) * p.open;                 // the loop's loss: a little off the top each trip
          const y = x + lp[n]! * p.keep[k]!;
          b[at] = y; sum += y * (1 - p.keep[k]!) * p.gain[k]!;
        }
        (side ? outR : outL)[i] = x * p.dry + sum * p.wet;
      }
      at = (at + 1) % size;
    }
    this.at = at;
  }
}

export const DSP_KINDS = ["comp", "glue", "limiter", "gate", "crush", "resonators"] as const;
export function makeDsp(kind: string, sampleRate: number): Dsp | undefined {
  return kind === "comp" ? new CompDsp(sampleRate) : kind === "glue" ? new CompDsp(sampleRate, true) : kind === "limiter" ? new LimiterDsp(sampleRate) : kind === "gate" ? new GateDsp(sampleRate) : kind === "crush" ? new CrushDsp(sampleRate) : kind === "resonators" ? new ResonatorDsp(sampleRate) : undefined;
}
