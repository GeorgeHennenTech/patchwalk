// The effects rack: distortion, EQ, compressor, chorus, delay and reverb, between the notes and the main
// volume, in an order the learner can change (`fxOrder`; `FX_ORDER` is the order they start in). The first half of this file is pure maths (curves, times, the reverb's
// impulse) that tests and pictures share; the second half is the Web Audio chain the engine drives.
// Every effect is always in the path: "off" means its own signal is turned down, so switching one on or
// off never restarts a note.
import { plateImpulse } from "./plate";
import { beatsOf } from "./mod";
import { stageResponse } from "./filter";
import type { SynthState } from "./params";

export const FX_ORDER = ["dist", "eq", "comp", "chorus", "flanger", "phaser", "delay", "reverb"] as const;
export type FxId = (typeof FX_ORDER)[number];
export const FX_NAMES: Record<FxId, string> = { dist: "Distortion", eq: "EQ", comp: "Compressor", chorus: "Chorus", flanger: "Flanger", phaser: "Phaser", delay: "Delay", reverb: "Reverb" };

/** Flanger: the swept delay rests at this length and swings this far either way at full depth (seconds). */
export const FLANGER_BASE = 0.005, FLANGER_SWING = 0.002;
/** Where the flanger's k-th notch falls (k = 0 is the lowest) for a delay of `seconds`: half a cycle, one and a half, and so on fit in the delay. */
export const flangerNotchHz = (seconds: number, k: number) => (k + 0.5) / seconds;
/** Phaser: how many all-pass stages, how sharp each is, and how far the sweep goes either way at full depth (cents). */
export const PHASER_STAGES = 4, PHASER_Q = 0.7, PHASER_SWING_CENTS = 2400;
/** How much a phaser at rest lets through at `hz` with its wet path at full level, in dB (the dry sound plus the all-passed sound). */
export function phaserDb(centre: number, hz: number, sampleRate = 48000): number {
  let re = 1, im = 0;
  for (let i = 0; i < PHASER_STAGES; i++) { const [a, b] = stageResponse({ type: "allpass", hz: centre, q: PHASER_Q }, hz, sampleRate); [re, im] = [re * a - im * b, re * b + im * a]; }
  return 10 * Math.log10(Math.max(1e-12, (1 + re) ** 2 + im ** 2));
}

/** A usable order from whatever is stored: every effect once, unknown names dropped, any missing ones added at the end. */
export function fxOrderOf(order: readonly string[] | undefined): FxId[] {
  const seen = (order ?? []).filter((id, i, a): id is FxId => (FX_ORDER as readonly string[]).includes(id) && a.indexOf(id) === i);
  return [...seen, ...FX_ORDER.filter((id) => !seen.includes(id))];
}
/** The order with one effect moved a place earlier (-1) or later (+1). At either end it stays where it is. */
export function moveFx(order: readonly string[] | undefined, id: FxId, by: -1 | 1): FxId[] {
  const o = fxOrderOf(order), i = o.indexOf(id), j = i + by;
  if (j < 0 || j >= o.length) return o;
  [o[i], o[j]] = [o[j]!, o[i]!];
  return o;
}

/** Drive of 0..100% is a boost of up to this many times before the shaping (about 30 dB). */
export const DIST_MAX_GAIN = 32;
export const distGain = (drive: number) => 1 + (Math.min(100, Math.max(0, drive)) / 100) * (DIST_MAX_GAIN - 1);
/** Crush: how many levels each side of zero the signal is rounded to. Fewer levels is rougher. */
export const crushLevels = (drive: number) => Math.max(1, Math.round(64 * 2 ** (-6 * (Math.min(100, Math.max(0, drive)) / 100))));

/**
 * What the distortion does to one sample `x` (-1..1). Each type is a different rule for values that would
 * go past full level: soft bends them over, hard cuts them flat, fold turns them back, and crush is not
 * about level at all (it rounds every value to a coarse grid).
 */
export function distort(type: SynthState["distType"], drive: number, x: number): number {
  const g = distGain(drive), y = x * g;
  switch (type) {
    case "soft": return Math.tanh(y);
    case "hard": return Math.max(-1, Math.min(1, y));
    case "fold": { const t = (((y + 1) % 4) + 4) % 4; return t < 2 ? t - 1 : 3 - t; }
    case "crush": { const n = crushLevels(drive); return Math.round(x * n) / n; }
  }
}
const CURVE_POINTS = 4097;
export function distCurve(type: SynthState["distType"], drive: number): Float32Array<ArrayBuffer> {
  const c = new Float32Array(CURVE_POINTS);
  for (let i = 0; i < CURVE_POINTS; i++) c[i] = distort(type, drive, (2 * i) / (CURVE_POINTS - 1) - 1);
  return c;
}
/** Driven hard, the shaped signal sits near full level; this turns it down so the effect is not simply louder. */
export const distTrim = (type: SynthState["distType"], drive: number) => (type === "crush" ? 1 : 1 / Math.sqrt(distGain(drive)));

/** The delay's echo spacing in seconds: its Time knob, or a division of the beat at the current tempo. */
export const delaySeconds = (s: Pick<SynthState, "delaySync" | "delayDiv" | "delayTime" | "bpm">) => (s.delaySync === "beat" ? (beatsOf(s.delayDiv) * 60) / s.bpm : s.delayTime / 1000);
/** How many echoes it takes for the delay's repeats to fall 60 dB (to a thousandth). Infinity at 100%. */
export const echoesToSilence = (feedback: number) => (feedback <= 0 ? 1 : feedback >= 100 ? Infinity : Math.ceil(Math.log(0.001) / Math.log(feedback / 100)));

/**
 * The reverb's impulse, reaching 60 dB down after `seconds`: a plate reverb (Dattorro 1997, see `plate.ts`)
 * struck once and written down. Playing any sound through it gives that sound the same tail. It is the
 * same every time, and its two sides are different sounds, so the tail is wide.
 */
export const reverbImpulse = (seconds: number, sampleRate: number): [Float32Array<ArrayBuffer>, Float32Array<ArrayBuffer>] => plateImpulse(seconds, sampleRate);

/**
 * The browser's compressor quietly turns its own output up, by 0.6 of the reduction a full-level signal
 * would get. A compressor in a lesson should only turn things down until the learner adds make-up gain, so
 * this is the gain (in dB, zero or negative) that cancels the browser's boost.
 */
export const compAutoMakeupCancelDb = (threshold: number, ratio: number) => 0.6 * threshold * (1 - 1 / Math.max(1, ratio));
/** A steady signal `over` dB above the threshold comes out this many dB quieter. */
export const compReductionDb = (over: number, ratio: number) => (over <= 0 ? 0 : over * (1 - 1 / Math.max(1, ratio)));

/** Centre frequencies of the EQ's three bands. The middle one can be moved. */
export const EQ_LOW_HZ = 150, EQ_HIGH_HZ = 5000;

type Fx = Pick<SynthState, "fxOrder" | "distOn" | "distType" | "distDrive" | "distMix" | "eqOn" | "eqLow" | "eqMid" | "eqMidHz" | "eqHigh" | "compOn" | "compThreshold" | "compRatio" | "compAttack" | "compRelease" | "compMakeup"
  | "chorusOn" | "chorusRate" | "chorusDepth" | "chorusMix" | "flangerOn" | "flangerRate" | "flangerDepth" | "flangerFeedback" | "flangerMix" | "phaserOn" | "phaserRate" | "phaserDepth" | "phaserCentre" | "phaserMix" | "delayOn" | "delaySync" | "delayDiv" | "delayTime" | "delayFeedback" | "delayMix" | "reverbOn" | "reverbSize" | "reverbMix" | "bpm">;
const RAMP = 0.015;

/** The chain itself. `input` takes the notes; `output` goes on to the main volume. */
export class FxChain {
  readonly input: GainNode;
  readonly output: GainNode;
  private readonly shaper: WaveShaperNode;
  private readonly distDry: GainNode; private readonly distWet: GainNode;
  private readonly eq: [BiquadFilterNode, BiquadFilterNode, BiquadFilterNode];
  private readonly comp: DynamicsCompressorNode;
  private readonly compDry: GainNode; private readonly compWet: GainNode;
  private readonly chorusLfo: OscillatorNode; private readonly chorusDepths: [GainNode, GainNode]; private readonly chorusWet: GainNode;
  private readonly flangerLfo: OscillatorNode; private readonly flangerDepth: GainNode; private readonly flangerFb: GainNode; private readonly flangerWet: GainNode;
  private readonly phaserLfo: OscillatorNode; private readonly phaserDepth: GainNode; private readonly phaserStages: BiquadFilterNode[]; private readonly phaserWet: GainNode;
  private readonly delay: DelayNode; private readonly feedback: GainNode; private readonly delayWet: GainNode;
  private readonly convolver: ConvolverNode; private readonly reverbWet: GainNode;
  private last: Partial<Fx> = {};
  /** Each effect's own way in and way out, so they can be joined in any order. */
  private readonly units = {} as Record<FxId, { in: GainNode; out: GainNode }>;
  private order: FxId[] = [];

  constructor(private readonly ctx: AudioContext, s: Fx) {
    const gain = (v = 1) => { const g = ctx.createGain(); g.gain.value = v; return g; };
    this.input = gain(); this.output = gain();
    // distortion: dry and shaped side by side
    this.shaper = ctx.createWaveShaper(); this.shaper.oversample = "4x";
    this.distDry = gain(); this.distWet = gain(0);
    const unit = (id: FxId) => (this.units[id] = { in: gain(), out: gain() });
    const dist = unit("dist");
    dist.in.connect(this.distDry).connect(dist.out);
    dist.in.connect(this.shaper).connect(this.distWet).connect(dist.out);
    // EQ: three bands in a row; at 0 dB each passes everything unchanged
    const band = (type: BiquadFilterType, hz: number) => { const f = ctx.createBiquadFilter(); f.type = type; f.frequency.value = hz; f.gain.value = 0; f.Q.value = 1; return f; };
    this.eq = [band("lowshelf", EQ_LOW_HZ), band("peaking", s.eqMidHz), band("highshelf", EQ_HIGH_HZ)];
    const eq = unit("eq");
    eq.in.connect(this.eq[0]).connect(this.eq[1]).connect(this.eq[2]).connect(eq.out);
    // compressor
    this.comp = ctx.createDynamicsCompressor(); this.comp.knee.value = 0;
    this.compDry = gain(); this.compWet = gain(0);
    const comp = unit("comp");
    comp.in.connect(this.compDry).connect(comp.out);
    comp.in.connect(this.comp).connect(this.compWet).connect(comp.out);
    // chorus: two short delays, one a side, whose lengths drift in opposite directions
    this.chorusLfo = ctx.createOscillator(); this.chorusLfo.frequency.value = s.chorusRate;
    this.chorusWet = gain(0);
    const merge = ctx.createChannelMerger(2), chorus = unit("chorus");
    this.chorusDepths = [gain(0), gain(0)];
    [0, 1].forEach((side) => {
      const d = ctx.createDelay(0.1); d.delayTime.value = 0.018 + side * 0.004;
      this.chorusLfo.connect(this.chorusDepths[side as 0 | 1]).connect(d.delayTime);
      chorus.in.connect(d).connect(merge, 0, side);
    });
    merge.connect(this.chorusWet).connect(chorus.out);
    chorus.in.connect(chorus.out);
    this.chorusLfo.start();
    // flanger: one very short delay whose length sweeps, added to the dry sound, with some of it fed back
    this.flangerLfo = ctx.createOscillator(); this.flangerLfo.frequency.value = s.flangerRate;
    this.flangerDepth = gain(0); this.flangerFb = gain(0); this.flangerWet = gain(0);
    const flanger = unit("flanger"), sweep = ctx.createDelay(0.05); sweep.delayTime.value = FLANGER_BASE;
    this.flangerLfo.connect(this.flangerDepth).connect(sweep.delayTime);
    flanger.in.connect(flanger.out);
    flanger.in.connect(sweep).connect(this.flangerWet).connect(flanger.out);
    sweep.connect(this.flangerFb).connect(sweep);
    this.flangerLfo.start();
    // phaser: four all-pass stages whose turning point sweeps, added to the dry sound
    this.phaserLfo = ctx.createOscillator(); this.phaserLfo.frequency.value = s.phaserRate;
    this.phaserDepth = gain(0); this.phaserWet = gain(0);
    const phaser = unit("phaser");
    this.phaserStages = Array.from({ length: PHASER_STAGES }, () => { const f = ctx.createBiquadFilter(); f.type = "allpass"; f.frequency.value = s.phaserCentre; f.Q.value = PHASER_Q; this.phaserLfo.connect(this.phaserDepth).connect(f.detune); return f; });
    phaser.in.connect(phaser.out);
    this.phaserStages.reduce<AudioNode>((from, f) => from.connect(f), phaser.in).connect(this.phaserWet).connect(phaser.out);
    this.phaserLfo.start();
    // delay: echoes that feed back into themselves
    this.delay = ctx.createDelay(4.5); this.feedback = gain(0); this.delayWet = gain(0);
    const delay = unit("delay");
    delay.in.connect(delay.out);
    delay.in.connect(this.delay).connect(this.delayWet).connect(delay.out);
    this.delay.connect(this.feedback).connect(this.delay);
    // reverb
    this.convolver = ctx.createConvolver(); this.convolver.normalize = false; this.reverbWet = gain(0);
    const reverb = unit("reverb");
    reverb.in.connect(reverb.out);
    reverb.in.connect(this.convolver).connect(this.reverbWet).connect(reverb.out);
    this.wire(fxOrderOf(s.fxOrder));
    this.apply(s, true);
  }

  /** Join the effects in this order: the notes into the first, each into the next, the last to the main volume. */
  private wire(order: FxId[]): void {
    if (order.join() === this.order.join()) return;
    this.input.disconnect();
    for (const id of FX_ORDER) this.units[id].out.disconnect();
    let from: AudioNode = this.input;
    for (const id of order) { from.connect(this.units[id].in); from = this.units[id].out; }
    from.connect(this.output);
    this.order = [...order];
  }

  /** How many dB the compressor is turning the signal down right now (0 or negative). */
  get reduction(): number { return this.last.compOn ? this.comp.reduction : 0; }

  /** Make the chain match the settings. Only what changed is touched. */
  apply(s: Fx, jump = false): void {
    const t = this.ctx.currentTime, p = this.last;
    this.wire(fxOrderOf(s.fxOrder));
    const set = (param: AudioParam, v: number) => (jump ? param.setValueAtTime(v, t) : param.setTargetAtTime(v, t, RAMP));
    if (s.distType !== p.distType || s.distDrive !== p.distDrive) this.shaper.curve = distCurve(s.distType, s.distDrive);
    const wet = s.distOn ? s.distMix / 100 : 0;
    set(this.distDry.gain, 1 - wet);
    set(this.distWet.gain, wet * distTrim(s.distType, s.distDrive));
    set(this.eq[0].gain, s.eqOn ? s.eqLow : 0); set(this.eq[1].gain, s.eqOn ? s.eqMid : 0); set(this.eq[2].gain, s.eqOn ? s.eqHigh : 0);
    set(this.eq[1].frequency, s.eqMidHz);
    set(this.comp.threshold, s.compThreshold); set(this.comp.ratio, s.compRatio); set(this.comp.attack, s.compAttack / 1000); set(this.comp.release, s.compRelease / 1000);
    set(this.compDry.gain, s.compOn ? 0 : 1); set(this.compWet.gain, s.compOn ? 10 ** ((s.compMakeup + compAutoMakeupCancelDb(s.compThreshold, s.compRatio)) / 20) : 0);
    set(this.chorusLfo.frequency, s.chorusRate);
    const swing = (s.chorusDepth / 100) * 0.006;
    set(this.chorusDepths[0].gain, swing); set(this.chorusDepths[1].gain, -swing);
    set(this.chorusWet.gain, s.chorusOn ? s.chorusMix / 100 : 0);
    set(this.flangerLfo.frequency, s.flangerRate);
    set(this.flangerDepth.gain, (s.flangerDepth / 100) * FLANGER_SWING);
    set(this.flangerFb.gain, s.flangerOn ? s.flangerFeedback / 100 : 0);
    set(this.flangerWet.gain, s.flangerOn ? s.flangerMix / 100 : 0);
    set(this.phaserLfo.frequency, s.phaserRate);
    set(this.phaserDepth.gain, (s.phaserDepth / 100) * PHASER_SWING_CENTS);
    for (const f of this.phaserStages) set(f.frequency, s.phaserCentre);
    set(this.phaserWet.gain, s.phaserOn ? s.phaserMix / 100 : 0);
    const seconds = delaySeconds(s);
    // a jump in delay time is heard as a pitch swoop, so glide to it a little more slowly
    if (jump) this.delay.delayTime.setValueAtTime(seconds, t); else this.delay.delayTime.setTargetAtTime(seconds, t, 0.05);
    set(this.feedback.gain, s.delayOn ? s.delayFeedback / 100 : 0);
    set(this.delayWet.gain, s.delayOn ? s.delayMix / 100 : 0);
    if (s.reverbSize !== p.reverbSize) {
      const [l, r] = reverbImpulse(s.reverbSize, this.ctx.sampleRate), buf = this.ctx.createBuffer(2, l.length, this.ctx.sampleRate);
      buf.copyToChannel(l, 0); buf.copyToChannel(r, 1);
      this.convolver.buffer = buf;
    }
    set(this.reverbWet.gain, s.reverbOn ? s.reverbMix / 100 : 0);
    this.last = { ...s };
  }
}
