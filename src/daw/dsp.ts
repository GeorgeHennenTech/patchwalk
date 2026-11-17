// Effects that have to be worked out one sample at a time: compressor, limiter, gate, crusher. The browser's
// ready-made parts cannot do these exactly, so they run in an AudioWorklet (`dsp.worklet.ts` wraps this file).
// Nothing here touches the browser, so tests run the very same code the sound is made with.
// The designs are the standard textbook ones; every fixed number is our own choice.
export type P = Record<string, number>;
/** What an effect may be told besides the sound itself: which sample this block starts at, and a second sound to listen to (a sidechain). */
export interface Extra { frame?: number; sideL?: Float32Array; sideR?: Float32Array }
export interface Dsp { set(p: P): void; /** the song's tempo, and the sample at which its first bar began */ clock?(bpm: number, originFrame: number): void; run(inL: Float32Array, inR: Float32Array, outL: Float32Array, outR: Float32Array, extra?: Extra): void; /** how many dB the sound is being turned down right now */ reduction?(): number }

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
  private p = { threshold: -18, ratio: 4, knee: 0, makeup: 1, dry: 0, wet: 1, att: 1, relDecay: 1, rel: 1, clip: false, side: false };
  constructor(private readonly sampleRate: number, private readonly glue = false) {}
  set(p: P): void {
    const glue = this.glue, mix = Math.min(1, Math.max(0, (p.mix ?? 100) / 100));
    const attack = glue ? GLUE_ATTACKS[p.attack ?? 3] ?? 1 : p.attack ?? 10, release = glue ? GLUE_RELEASES[p.release ?? 2] ?? 400 : p.release ?? 120;
    this.p = { threshold: p.threshold ?? -18, ratio: glue ? GLUE_RATIOS[p.ratio ?? 1] ?? 4 : p.ratio ?? 4, knee: glue ? GLUE_KNEE : p.knee ?? 0, makeup: dbToGain(p.makeup ?? 0), dry: 1 - mix, wet: mix,
      att: stepFor(attack, this.sampleRate), relDecay: Math.exp(-1 / ((release / 1000) * this.sampleRate)), rel: stepFor(release, this.sampleRate), clip: glue && !!p.clip, side: (p.side ?? 0) > 0 };
  }
  run(inL: Float32Array, inR: Float32Array, outL: Float32Array, outR: Float32Array, extra?: Extra): void {
    const p = this.p, rms = stepFor(RMS_MS, this.sampleRate);
    // with a sidechain chosen, the level is read from that other sound (silence if it is not playing), and this sound is what gets turned down
    const side = p.side, sl = extra?.sideL, sr = extra?.sideR ?? sl;
    let { env, sq, y } = this, worst = 0;
    for (let i = 0; i < inL.length; i++) {
      const l = inL[i]!, r = inR[i]!, a = side ? (sl ? Math.max(Math.abs(sl[i]!), Math.abs(sr![i]!)) : 0) : Math.max(Math.abs(l), Math.abs(r));
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

/** One two-pole filter, for both sides at once. Low-pass, high-pass or band-pass, by the usual cookbook formulas. */
class Bq {
  private b0 = 1; private b1 = 0; private b2 = 0; private a1 = 0; private a2 = 0;
  private readonly x1 = [0, 0]; private readonly x2 = [0, 0]; private readonly y1 = [0, 0]; private readonly y2 = [0, 0];
  set(kind: "lowpass" | "highpass" | "bandpass", f: number, q: number, sampleRate: number): void {
    const w = (2 * Math.PI * Math.min(sampleRate * 0.49, Math.max(1, f))) / sampleRate, cos = Math.cos(w), al = Math.sin(w) / (2 * q), a0 = 1 + al;
    if (kind === "lowpass") { this.b0 = (1 - cos) / 2 / a0; this.b1 = (1 - cos) / a0; this.b2 = this.b0; }
    else if (kind === "highpass") { this.b0 = (1 + cos) / 2 / a0; this.b1 = -(1 + cos) / a0; this.b2 = this.b0; }
    else { this.b0 = al / a0; this.b1 = 0; this.b2 = -al / a0; }
    this.a1 = (-2 * cos) / a0; this.a2 = (1 - al) / a0;
  }
  tick(x: number, ch: number): number {
    let y = this.b0 * x + this.b1 * this.x1[ch]! + this.b2 * this.x2[ch]! - this.a1 * this.y1[ch]! - this.a2 * this.y2[ch]!;
    if (Math.abs(y) < 1e-20) y = 0;
    this.x2[ch] = this.x1[ch]!; this.x1[ch] = x; this.y2[ch] = this.y1[ch]!; this.y1[ch] = y;
    return y;
  }
}
const BUTTER = Math.SQRT1_2;

export const BANDS = ["l", "m", "h"] as const, MULTI_MAX_LIFT = 30, MULTI_SILENCE = -70;
/**
 * Multiband dynamics' rule for one band: how many dB to change a sound at `inDb`. Above the upper threshold
 * it is turned down (the extra divided by the ratio); below the lower threshold it is lifted towards that
 * threshold (the shortfall divided by the lift ratio), which brings quiet detail up. Near silence nothing is lifted.
 */
export function multibandChangeDb(inDb: number, above: number, ratio: number, below: number, lift: number): number {
  if (inDb > above) return (inDb - above) * (1 / Math.max(1, ratio) - 1);
  if (inDb < below && inDb > MULTI_SILENCE) return Math.min(MULTI_MAX_LIFT, (below - inDb) * (1 - 1 / Math.max(1, lift)));
  return 0;
}
/** Multiband dynamics: the sound split in three (the same split as the three-band EQ), each band with its own compressor. */
export class MultibandDsp implements Dsp {
  private readonly f = Array.from({ length: 12 }, () => new Bq());
  private readonly env = [0, 0, 0]; private readonly y = [0, 0, 0]; private worst = 0;
  private p = { above: [-24, -24, -24], ratio: [1, 1, 1], below: [-50, -50, -50], lift: [1, 1, 1], gain: [1, 1, 1], amount: 1, out: 1, att: 1, relDecay: 1 };
  private readonly band = [[0, 0], [0, 0], [0, 0]];
  constructor(private readonly sampleRate: number) { this.set({}); }
  set(p: P): void {
    const f1 = p.freqLow ?? 120, f2 = p.freqHigh ?? 2500, sr = this.sampleRate, f = this.f;
    f[0]!.set("lowpass", f1, BUTTER, sr); f[1]!.set("lowpass", f1, BUTTER, sr); f[2]!.set("highpass", f1, BUTTER, sr); f[3]!.set("highpass", f1, BUTTER, sr);
    for (const i of [4, 5, 8, 9]) f[i]!.set("lowpass", f2, BUTTER, sr);
    for (const i of [6, 7, 10, 11]) f[i]!.set("highpass", f2, BUTTER, sr);
    const each = (name: string, def: number) => BANDS.map((k) => p[`${k}${name}`] ?? def);
    this.p = { above: each("above", -24), ratio: each("ratio", 3), below: each("below", -50), lift: each("lift", 1), gain: each("gain", 0).map(dbToGain), amount: Math.min(1, Math.max(0, (p.amount ?? 100) / 100)), out: dbToGain(p.out ?? 0),
      att: stepFor(p.attack ?? 10, sr), relDecay: Math.exp(-1 / (((p.release ?? 150) / 1000) * sr)) };
  }
  run(inL: Float32Array, inR: Float32Array, outL: Float32Array, outR: Float32Array): void {
    const f = this.f, p = this.p, band = this.band; let worst = 0;
    for (let i = 0; i < inL.length; i++) {
      for (let ch = 0; ch < 2; ch++) {
        const x = ch ? inR[i]! : inL[i]!, low = f[1]!.tick(f[0]!.tick(x, ch), ch), rest = f[3]!.tick(f[2]!.tick(x, ch), ch);
        band[0]![ch] = f[5]!.tick(f[4]!.tick(low, ch), ch) + f[7]!.tick(f[6]!.tick(low, ch), ch);   // the lows, through both halves of the upper split, which only turns their phase
        band[1]![ch] = f[9]!.tick(f[8]!.tick(rest, ch), ch); band[2]![ch] = f[11]!.tick(f[10]!.tick(rest, ch), ch);
      }
      let l = 0, r = 0;
      for (let b = 0; b < 3; b++) {
        const bl = band[b]![0]!, br = band[b]![1]!, a = Math.max(Math.abs(bl), Math.abs(br));
        this.env[b] = a > this.env[b]! ? a : this.env[b]! * p.relDecay;
        const want = multibandChangeDb(toDb(this.env[b]!), p.above[b]!, p.ratio[b]!, p.below[b]!, p.lift[b]!) * p.amount;
        this.y[b] = this.y[b]! + (want - this.y[b]!) * (want < this.y[b]! ? p.att : p.att * 0.25);
        if (this.y[b]! < worst) worst = this.y[b]!;
        const g = dbToGain(this.y[b]!) * p.gain[b]!;
        l += bl * g; r += br * g;
      }
      outL[i] = l * p.out; outR[i] = r * p.out;
    }
    for (let b = 0; b < 3; b++) if (this.env[b]! < 1e-9) this.env[b] = 0;
    this.worst = -worst;
  }
  reduction(): number { return this.worst; }
}

export const BUS_MARGIN = 0.25, BUS_MAX_DRIVE = 8, BUS_CRUNCH_HZ = 1500, BUS_PUNCH = 2, BUS_SOFTEN = 0.8;
/**
 * Drum bus: a channel strip for a drum track. Drive rounds the peaks; crunch distorts only the top;
 * transients makes the very start of each hit louder or softer than its body (it compares a fast reading of
 * the level with a slow one: they differ only while a hit is arriving); boom is a ringing low tone set off
 * by the drums; damp takes the top off. Every number here is our own.
 */
export class DrumBusDsp implements Dsp {
  private readonly hp = new Bq(); private readonly boom = new Bq(); private readonly lp = new Bq();
  private fast = 0; private slow = 0;
  private p = { g: 1, norm: 1, crunch: 0, tr: 0, boom: 0, damp: false, out: 1, dry: 0, wet: 1 };
  private readonly cf: number; private readonly cr: number; private readonly cs: number;
  constructor(private readonly sampleRate: number) { this.cf = stepFor(0.5, sampleRate); this.cr = stepFor(40, sampleRate); this.cs = stepFor(15, sampleRate); this.set({}); }
  set(p: P): void {
    const g = 1 + (Math.min(100, Math.max(0, p.drive ?? 0)) / 100) * (BUS_MAX_DRIVE - 1), mix = Math.min(1, Math.max(0, (p.mix ?? 100) / 100)), damp = p.damp ?? 20000;
    this.hp.set("highpass", BUS_CRUNCH_HZ, BUTTER, this.sampleRate); this.boom.set("bandpass", p.boomFreq ?? 55, 2 + ((p.boomDecay ?? 50) / 100) * 28, this.sampleRate); this.lp.set("lowpass", damp, BUTTER, this.sampleRate);
    this.p = { g, norm: g === 1 ? 1 : 1 / Math.tanh(g), crunch: (p.crunch ?? 0) / 100, tr: (p.transients ?? 0) / 100, boom: ((p.boom ?? 0) / 100) * 4, damp: damp < 19900, out: dbToGain(p.out ?? 0), dry: 1 - mix, wet: mix };
  }
  run(inL: Float32Array, inR: Float32Array, outL: Float32Array, outR: Float32Array): void {
    const p = this.p; let { fast, slow } = this;
    for (let i = 0; i < inL.length; i++) {
      const a = Math.max(Math.abs(inL[i]!), Math.abs(inR[i]!));
      fast += (a - fast) * (a > fast ? this.cf : this.cr); slow += (a - slow) * (a > slow ? this.cs : this.cr);
      // a steady sound keeps the two readings a little apart, so only a clear gap counts as a hit arriving
      const t = Math.max(0, (fast - slow) / (fast + 1e-6) - BUS_MARGIN) / (1 - BUS_MARGIN), punch = 1 + p.tr * (p.tr > 0 ? BUS_PUNCH : BUS_SOFTEN) * t;
      for (let ch = 0; ch < 2; ch++) {
        const x = ch ? inR[i]! : inL[i]!;
        let v = p.g === 1 ? x : Math.tanh(x * p.g) * p.norm;
        if (p.crunch > 0) { const top = this.hp.tick(v, ch); v += p.crunch * (Math.tanh(top * 6) - top); }
        v *= punch;
        if (p.boom > 0) v += this.boom.tick(x, ch) * p.boom;
        if (p.damp) v = this.lp.tick(v, ch);
        (ch ? outR : outL)[i] = x * p.dry + v * p.out * p.wet;
      }
    }
    this.fast = fast < 1e-9 ? 0 : fast; this.slow = slow < 1e-9 ? 0 : slow;
  }
}

// The two all-pass chains that turn a sound into a pair a quarter-cycle apart (a "Hilbert" pair), from which a
// sound can be moved up or down by a fixed number of Hz. The eight numbers are the widely published
// half-band set (O. Niemitalo); each stage is y[n] = c squared times (x[n] + y[n-2]), minus x[n-2].
const HILBERT_A = [0.6923878, 0.9360654322959, 0.988229522686, 0.9987488452737], HILBERT_B = [0.4021921162426, 0.856171088242, 0.9722909545651, 0.9952884791278];
class AllpassChain {
  private readonly x1 = new Float64Array(4); private readonly x2 = new Float64Array(4); private readonly y1 = new Float64Array(4); private readonly y2 = new Float64Array(4);
  private readonly c: number[];
  constructor(c: number[]) { this.c = c.map((v) => v * v); }
  tick(x: number): number {
    for (let k = 0; k < 4; k++) { const y = this.c[k]! * (x + this.y2[k]!) - this.x2[k]!; this.x2[k] = this.x1[k]!; this.x1[k] = x; this.y2[k] = this.y1[k]!; this.y1[k] = y; x = y; }
    return x;
  }
}
/** The ratio between two notes `semis` semitones and `cents` cents apart. */
export const shiftRatio = (semis: number, cents = 0) => 2 ** ((semis + cents / 100) / 12);
/**
 * Shifter. Pitch mode: the sound is read back from a short delay that keeps getting shorter (higher) or
 * longer (lower); two such readings half a window apart are crossfaded so the jumps back are never heard
 * alone. It multiplies every frequency, so chords stay chords, but it warbles a little. Frequency mode:
 * every frequency is moved by the same number of Hz, so harmonics stop lining up and the sound turns metallic.
 */
export class ShifterDsp implements Dsp {
  private readonly size: number; private readonly buf: Float32Array[]; private at = 0; private phase = 0; private turn = 0;
  private readonly ha = [new AllpassChain(HILBERT_A), new AllpassChain(HILBERT_A)]; private readonly hb = [new AllpassChain(HILBERT_B), new AllpassChain(HILBERT_B)]; private readonly held = [0, 0];
  private p = { freq: false, window: 2880, step: 0, hz: 0, dry: 0, wet: 1 };
  constructor(private readonly sampleRate: number) { this.size = Math.ceil(sampleRate * 0.25) + 4; this.buf = [new Float32Array(this.size), new Float32Array(this.size)]; this.set({}); }
  set(p: P): void {
    const mix = Math.min(1, Math.max(0, (p.mix ?? 100) / 100)), window = Math.max(64, ((p.window ?? 60) / 1000) * this.sampleRate);
    this.p = { freq: !!p.mode, window, step: (1 - shiftRatio(p.semis ?? 0, p.cents ?? 0)) / window, hz: p.hz ?? 0, dry: 1 - mix, wet: mix };
  }
  run(inL: Float32Array, inR: Float32Array, outL: Float32Array, outR: Float32Array): void {
    const p = this.p, size = this.size; let { at, phase, turn } = this;
    for (let i = 0; i < inL.length; i++) {
      const sin = Math.sin(turn), cos = Math.cos(turn), g1 = Math.sin(Math.PI * phase) ** 2, second = phase + 0.5 - Math.floor(phase + 0.5);
      for (let ch = 0; ch < 2; ch++) {
        const x = ch ? inR[i]! : inL[i]!; let v: number;
        if (p.freq) { const a = this.ha[ch]!.tick(x), b = this.hb[ch]!.tick(x); v = this.held[ch]! * cos + b * sin; this.held[ch] = a; }
        else { const b = this.buf[ch]!; b[at] = x;
          const read = (ph: number) => { const where = at - 1 - ph * p.window + size * 2, i0 = Math.floor(where), f = where - i0; return b[i0 % size]! * (1 - f) + b[(i0 + 1) % size]! * f; };
          v = read(phase) * g1 + read(second) * (1 - g1); }
        (ch ? outR : outL)[i] = x * p.dry + v * p.wet;
      }
      at = (at + 1) % size; phase += p.step; phase -= Math.floor(phase);
      turn += (2 * Math.PI * p.hz) / this.sampleRate; if (turn > Math.PI) turn -= 2 * Math.PI; else if (turn < -Math.PI) turn += 2 * Math.PI;
    }
    this.at = at; this.phase = phase; this.turn = turn;
  }
}

export const REPEAT_INTERVALS = [4, 8, 16, 32, 64], REPEAT_GRIDS = [0.5, 1, 2, 4, 8], REPEAT_FADE_MS = 2;
/** A repeatable random number from 0 to 1 for the nth interval, so the same song repeats the same way each time. */
export const repeatChance = (n: number) => { let x = (Math.imul(n + 1, 2654435761) ^ 0x9e3779b9) >>> 0; x = Math.imul(x ^ (x >>> 15), 2246822519) >>> 0; x ^= x >>> 13; return (x >>> 0) / 4294967296; };
/**
 * Beat repeat. Once every interval (counted from the start of the song, plus an offset), it may catch a slice
 * one grid step long and play it again and again for the gate time, each repeat a little quieter if decay is
 * set. "Mix" adds the repeats to the sound, "Insert" plays them in its place, "Gate" lets only the repeats
 * through. All times are in sixteenth notes at the song's tempo; swing is not followed.
 */
export class BeatRepeatDsp implements Dsp {
  private readonly size: number; private readonly buf: Float32Array[]; private bpm = 120; private origin = 0; private count = 0;
  private last = -1; private state: "idle" | "catching" | "repeating" = "idle"; private pos = 0; private len = 0; private left = 0; private gain = 1;
  private p = { interval: 16, offset: 0, grid: 1, gate: 8, chance: 1, decay: 0, mode: 0 };
  constructor(private readonly sampleRate: number) { this.size = Math.ceil(sampleRate * 2.2); this.buf = [new Float32Array(this.size), new Float32Array(this.size)]; }
  set(p: P): void {
    this.p = { interval: REPEAT_INTERVALS[p.interval ?? 2] ?? 16, offset: p.offset ?? 0, grid: REPEAT_GRIDS[p.grid ?? 1] ?? 1, gate: p.gate ?? 8, chance: (p.chance ?? 100) / 100, decay: Math.min(1, Math.max(0, (p.decay ?? 0) / 100)), mode: p.mode ?? 0 };
  }
  clock(bpm: number, originFrame: number): void { this.bpm = bpm; this.origin = originFrame; }
  run(inL: Float32Array, inR: Float32Array, outL: Float32Array, outR: Float32Array, extra?: Extra): void {
    const p = this.p, perStep = (this.sampleRate * 15) / this.bpm, start = extra?.frame ?? this.count, fade = Math.max(1, Math.round((REPEAT_FADE_MS / 1000) * this.sampleRate));
    for (let i = 0; i < inL.length; i++) {
      const step = (start + i - this.origin) / perStep, n = Math.floor((step - p.offset) / p.interval);
      if (n !== this.last) { const first = this.last === -1 && step - p.offset - n * p.interval > 0.5; this.last = n;      // not when switched on in the middle of an interval
        if (!first && n >= 0 && repeatChance(n) < p.chance) { this.state = "catching"; this.pos = 0; this.len = Math.min(this.size, Math.max(8, Math.round(p.grid * perStep))); this.left = Math.round(p.gate * perStep); this.gain = 1; } }
      const l = inL[i]!, r = inR[i]!; let rl = 0, rr = 0, repeating = false;
      if (this.state === "catching") { this.buf[0]![this.pos] = l; this.buf[1]![this.pos] = r; if (++this.pos >= this.len) { this.state = "repeating"; this.pos = 0; this.left -= this.len; } }
      else if (this.state === "repeating") {
        if (this.left <= 0) this.state = "idle";
        else { repeating = true; const edge = Math.min(1, this.pos / fade, (this.len - 1 - this.pos) / fade, this.left / fade), g = this.gain * edge;
          rl = this.buf[0]![this.pos]! * g; rr = this.buf[1]![this.pos]! * g; this.left--;
          if (++this.pos >= this.len) { this.pos = 0; this.gain *= 1 - p.decay * 0.5; } }
      }
      if (p.mode === 0) { outL[i] = l + rl; outR[i] = r + rr; } else if (p.mode === 1) { outL[i] = repeating ? rl : l; outR[i] = repeating ? rr : r; } else { outL[i] = rl; outR[i] = rr; }
    }
    this.count = start + inL.length;
  }
}

export const VINYL_POP_MS = 0.4;
/**
 * Vinyl distortion: the kinds of wear a record adds. "Tracing" bends one band of the sound unevenly, which
 * adds its second harmonic; "pinch" bends it evenly and oppositely on the two sides, which adds a third
 * harmonic that widens the sound and disappears in mono; "crackle" adds short random pops. A sketch of
 * those three effects, with our own numbers, not a measurement of any record or player.
 */
export class VinylDsp implements Dsp {
  private readonly band = new Bq(); private readonly dc = new Bq(); private seed = 987654321; private pop = 0; private popSide = 0;
  private p = { tracing: 0, pinch: 0, perSample: 0, level: 0, decay: 0 };
  constructor(private readonly sampleRate: number) { this.dc.set("highpass", 15, BUTTER, sampleRate); this.set({}); }
  set(p: P): void {
    this.band.set("bandpass", p.freq ?? 1500, 1, this.sampleRate);
    this.p = { tracing: ((p.tracing ?? 0) / 100) * 2, pinch: ((p.pinch ?? 0) / 100) * 4, perSample: (p.crackle ?? 0) / this.sampleRate, level: dbToGain(p.crackleLevel ?? -24), decay: Math.exp(-1 / ((VINYL_POP_MS / 1000) * this.sampleRate)) };
  }
  private rnd(): number { this.seed = (Math.imul(this.seed, 1664525) + 1013904223) >>> 0; return this.seed / 4294967296; }
  run(inL: Float32Array, inR: Float32Array, outL: Float32Array, outR: Float32Array): void {
    const p = this.p;
    for (let i = 0; i < inL.length; i++) {
      let l = inL[i]!, r = inR[i]!;
      if (p.tracing > 0 || p.pinch > 0) {
        const bl = this.band.tick(l, 0), br = this.band.tick(r, 1), m = (bl + br) / 2;
        if (p.tracing > 0) { l += this.dc.tick(p.tracing * bl * bl, 0); r += this.dc.tick(p.tracing * br * br, 1); }      // squaring adds the octave above; the high-pass removes the steady push it also adds
        if (p.pinch > 0) { const d = p.pinch * m * m * m; l += d; r -= d; }
      }
      if (p.perSample > 0 && this.rnd() < p.perSample) { this.pop = (this.rnd() * 2 - 1) * p.level; this.popSide = this.rnd(); }
      if (this.pop !== 0) { l += this.pop * (1 - this.popSide * 0.7); r += this.pop * (0.3 + this.popSide * 0.7); this.pop *= p.decay; if (Math.abs(this.pop) < 1e-6) this.pop = 0; }
      outL[i] = l; outR[i] = r;
    }
  }
}

/**
 * The note a steady sound is playing, found by sliding the sound along itself and looking for the shift at
 * which it best matches (autocorrelation). Gives 0 when the sound is too quiet or has no clear pitch.
 */
export function detectPitch(x: Float32Array, sampleRate: number, lowHz = 40, highHz = 2000): number {
  const n = x.length, minLag = Math.floor(sampleRate / highHz), maxLag = Math.min(Math.floor(sampleRate / lowHz), Math.floor(n / 2));
  let energy = 0; for (let i = 0; i < n; i++) energy += x[i]! * x[i]!;
  if (energy / n < 1e-6 || maxLag <= minLag + 2) return 0;
  const at = (lag: number) => { let s = 0, a = 0, b = 0; for (let i = 0; i + lag < n; i++) { s += x[i]! * x[i + lag]!; a += x[i]! * x[i]!; b += x[i + lag]! * x[i + lag]!; } return s / (Math.sqrt(a * b) + 1e-12); };
  const c = new Float32Array(maxLag + 2); let top = 0; for (let lag = minLag; lag <= maxLag + 1; lag++) { c[lag] = at(lag); if (c[lag]! > top) top = c[lag]!; }
  if (top < 0.5) return 0;
  // the first clear peak, not the highest: a match at one period also matches at two and three
  let lag = minLag + 1; while (lag < maxLag && !(c[lag]! > 0.9 * top && c[lag]! >= c[lag - 1]! && c[lag]! >= c[lag + 1]!)) lag++;
  if (lag >= maxLag) return 0;
  const a = c[lag - 1]!, b = c[lag]!, d = c[lag + 1]!, shift = a - 2 * b + d === 0 ? 0 : (0.5 * (a - d)) / (a - 2 * b + d);
  return sampleRate / (lag + shift);
}
const NAMES = ["C", "C#", "D", "D#", "E", "F", "F#", "G", "G#", "A", "A#", "B"];
/** The nearest note to a frequency, and how many cents sharp (+) or flat (-) of it the frequency is. */
export function nearestNote(hz: number): { name: string; note: number; cents: number } {
  const exact = 69 + 12 * Math.log2(hz / 440), note = Math.round(exact);
  return { name: `${NAMES[((note % 12) + 12) % 12]}${Math.floor(note / 12) - 1}`, note, cents: Math.round((exact - note) * 100) };
}

export const DSP_KINDS = ["comp", "glue", "limiter", "gate", "crush", "resonators", "multiband", "drumbus", "shifter", "beatrepeat", "vinyl"] as const;
export function makeDsp(kind: string, sampleRate: number): Dsp | undefined {
  return kind === "comp" ? new CompDsp(sampleRate) : kind === "glue" ? new CompDsp(sampleRate, true) : kind === "limiter" ? new LimiterDsp(sampleRate) : kind === "gate" ? new GateDsp(sampleRate) : kind === "crush" ? new CrushDsp(sampleRate) : kind === "resonators" ? new ResonatorDsp(sampleRate)
    : kind === "multiband" ? new MultibandDsp(sampleRate) : kind === "drumbus" ? new DrumBusDsp(sampleRate) : kind === "shifter" ? new ShifterDsp(sampleRate)
    : kind === "beatrepeat" ? new BeatRepeatDsp(sampleRate) : kind === "vinyl" ? new VinylDsp(sampleRate) : undefined;
}
