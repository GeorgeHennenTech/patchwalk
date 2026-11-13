// The effects rack: distortion, EQ, compressor, chorus, delay and reverb, in that fixed order, between the
// notes and the main volume. The first half of this file is pure maths (curves, times, the reverb's
// impulse) that tests and pictures share; the second half is the Web Audio chain the engine drives.
// Every effect is always in the path: "off" means its own signal is turned down, so switching one on or
// off never restarts a note.
import { beatsOf } from "./mod";
import type { SynthState } from "./params";

export const FX_ORDER = ["dist", "eq", "comp", "chorus", "delay", "reverb"] as const;
export type FxId = (typeof FX_ORDER)[number];
export const FX_NAMES: Record<FxId, string> = { dist: "Distortion", eq: "EQ", comp: "Compressor", chorus: "Chorus", delay: "Delay", reverb: "Reverb" };

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
 * The reverb's impulse: noise that dies away, reaching 60 dB down after `seconds`. Playing any sound
 * through it gives that sound the same dying tail. The noise is generated from a fixed seed so the room is
 * the same every time; the two channels differ so the tail is wide.
 */
export function reverbImpulse(seconds: number, sampleRate: number): [Float32Array<ArrayBuffer>, Float32Array<ArrayBuffer>] {
  const len = Math.max(1, Math.round(seconds * sampleRate * 1.1)), k = Math.log(1000) / (seconds * sampleRate);
  let seed = 22222;
  const rnd = () => { seed = (seed * 1664525 + 1013904223) >>> 0; return seed / 2147483648 - 1; };
  const left = new Float32Array(len), right = new Float32Array(len);
  // the level is set so a longer room is not simply a louder one
  const level = Math.sqrt(k * 2);
  for (let i = 0; i < len; i++) { const e = Math.exp(-k * i) * level; left[i] = rnd() * e; right[i] = rnd() * e; }
  return [left, right];
}

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

type Fx = Pick<SynthState, "distOn" | "distType" | "distDrive" | "distMix" | "eqOn" | "eqLow" | "eqMid" | "eqMidHz" | "eqHigh" | "compOn" | "compThreshold" | "compRatio" | "compAttack" | "compRelease" | "compMakeup"
  | "chorusOn" | "chorusRate" | "chorusDepth" | "chorusMix" | "delayOn" | "delaySync" | "delayDiv" | "delayTime" | "delayFeedback" | "delayMix" | "reverbOn" | "reverbSize" | "reverbMix" | "bpm">;
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
  private readonly delay: DelayNode; private readonly feedback: GainNode; private readonly delayWet: GainNode;
  private readonly convolver: ConvolverNode; private readonly reverbWet: GainNode;
  private last: Partial<Fx> = {};

  constructor(private readonly ctx: AudioContext, s: Fx) {
    const gain = (v = 1) => { const g = ctx.createGain(); g.gain.value = v; return g; };
    this.input = gain(); this.output = gain();
    // distortion: dry and shaped side by side
    this.shaper = ctx.createWaveShaper(); this.shaper.oversample = "4x";
    this.distDry = gain(); this.distWet = gain(0);
    const afterDist = gain();
    this.input.connect(this.distDry).connect(afterDist);
    this.input.connect(this.shaper).connect(this.distWet).connect(afterDist);
    // EQ: three bands in a row; at 0 dB each passes everything unchanged
    const band = (type: BiquadFilterType, hz: number) => { const f = ctx.createBiquadFilter(); f.type = type; f.frequency.value = hz; f.gain.value = 0; f.Q.value = 1; return f; };
    this.eq = [band("lowshelf", EQ_LOW_HZ), band("peaking", s.eqMidHz), band("highshelf", EQ_HIGH_HZ)];
    afterDist.connect(this.eq[0]).connect(this.eq[1]).connect(this.eq[2]);
    // compressor
    this.comp = ctx.createDynamicsCompressor(); this.comp.knee.value = 0;
    this.compDry = gain(); this.compWet = gain(0);
    const afterComp = gain();
    this.eq[2].connect(this.compDry).connect(afterComp);
    this.eq[2].connect(this.comp).connect(this.compWet).connect(afterComp);
    // chorus: two short delays, one a side, whose lengths drift in opposite directions
    this.chorusLfo = ctx.createOscillator(); this.chorusLfo.frequency.value = s.chorusRate;
    this.chorusWet = gain(0);
    const merge = ctx.createChannelMerger(2), afterChorus = gain();
    this.chorusDepths = [gain(0), gain(0)];
    [0, 1].forEach((side) => {
      const d = ctx.createDelay(0.1); d.delayTime.value = 0.018 + side * 0.004;
      this.chorusLfo.connect(this.chorusDepths[side as 0 | 1]).connect(d.delayTime);
      afterComp.connect(d).connect(merge, 0, side);
    });
    merge.connect(this.chorusWet).connect(afterChorus);
    afterComp.connect(afterChorus);
    this.chorusLfo.start();
    // delay: echoes that feed back into themselves
    this.delay = ctx.createDelay(4.5); this.feedback = gain(0); this.delayWet = gain(0);
    const afterDelay = gain();
    afterChorus.connect(afterDelay);
    afterChorus.connect(this.delay).connect(this.delayWet).connect(afterDelay);
    this.delay.connect(this.feedback).connect(this.delay);
    // reverb
    this.convolver = ctx.createConvolver(); this.convolver.normalize = false; this.reverbWet = gain(0);
    afterDelay.connect(this.output);
    afterDelay.connect(this.convolver).connect(this.reverbWet).connect(this.output);
    this.apply(s, true);
  }

  /** How many dB the compressor is turning the signal down right now (0 or negative). */
  get reduction(): number { return this.last.compOn ? this.comp.reduction : 0; }

  /** Make the chain match the settings. Only what changed is touched. */
  apply(s: Fx, jump = false): void {
    const t = this.ctx.currentTime, p = this.last;
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
