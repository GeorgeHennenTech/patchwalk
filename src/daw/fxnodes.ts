// The audio of each device, built from the settings and maths in `devices.ts`. Every device is wrapped the
// same way: the sound goes both through the effect and straight past it, and switching the device on or off
// crossfades between the two, so nothing clicks and nothing restarts.
import { CURVES, CAB_BUMP_Q, PRESENCE_HZ, TONE_HIGH_HZ, TONE_LOW_HZ, TONE_MID_HZ, ampDrive, cabinetOf, driveTable, pedalDrive, erosionSwing, ECHO_WOBBLE, FILTER_DELAY_LINES, autoFilterKind, echoDriveGain, echoSeconds, filterDelayLine, CHANNEL_CUT_HZ, CHANNEL_HIGH_HZ, CHANNEL_LOW_HZ, CHANNEL_MID_Q, DELAY_MAX_SECONDS, CHORUS_SWING, dbToGain, delayRouting, delayTimes, eq3Gains, eq8Band, lfoRateHz, mixGains, octavesToQ, overdriveGain, overdriveToneHz, panHarmonics, satTable, utilityMatrix, softClipTable, SOFT_CLIP_REACH, COLOUR_Q, DC_CUT_HZ, type Device } from "./devices";
import { stretchNode } from "./stretch";
import { FLANGER_BASE, FLANGER_SWING, PHASER_Q, PHASER_STAGES, PHASER_SWING_CENTS, reverbImpulse } from "../synth/fx";
import { DSP_KINDS } from "./dsp";
import workletUrl from "./dsp.worklet.ts?worker&url";

export interface LiveDevice { input: AudioNode; output: AudioNode; update(d: Device, bpm?: number, origin?: number): void; dispose(): void; /** where a second sound can be plugged in for the device to listen to (its input 1) */ side?: AudioNode; /** which input of `side` takes it (1 when left out) */ sideIn?: number; /** the sound at this point, for a device that shows it */ analyser?: AnalyserNode; /** dB the device is turning the sound down by, for those that say */ reduction?(): number }
interface Core { input: AudioNode; output: AudioNode; set(p: Record<string, number>, t: number, bpm: number, origin: number): void; nodes: AudioNode[]; reduction?(): number; side?: AudioNode; sideIn?: number; analyser?: AnalyserNode }
type P = Record<string, number>;
// The sample-by-sample effects run in an AudioWorklet, which the browser has to load before one can be made.
const loaded = new WeakMap<BaseAudioContext, Promise<void>>(), ready = new WeakSet<BaseAudioContext>();
/** Load the sample-by-sample effects into this audio context. Safe to call again. */
export function prepareDevices(ctx: BaseAudioContext): Promise<void> {
  let p = loaded.get(ctx);
  if (!p) { p = ctx.audioWorklet.addModule(workletUrl).then(() => { ready.add(ctx); }); loaded.set(ctx, p); p.catch(() => loaded.delete(ctx)); }
  return p;
}
export const devicesReady = (ctx: BaseAudioContext) => ready.has(ctx);
const needsWorklet = (kind: string) => (DSP_KINDS as readonly string[]).includes(kind);
/** Whether every device of a chain can be built right now. */
export const chainReady = (ctx: BaseAudioContext, chain: Device[]) => devicesReady(ctx) || !chain.some((d) => needsWorklet(d.kind));
function worklet(kind: string, inputs = 1) {
  return (ctx: BaseAudioContext, p0: P): Core => {
    const node = new AudioWorkletNode(ctx, "pw-dsp", { numberOfInputs: inputs, numberOfOutputs: 1, outputChannelCount: [2], processorOptions: { kind, p: p0 } });
    let reduction = 0, sent = "";
    node.port.onmessage = (e: MessageEvent) => { if (typeof e.data?.reduction === "number") reduction = e.data.reduction; };
    return { input: node, output: node, nodes: [node], reduction: () => reduction, side: inputs > 1 ? node : undefined,
      set(p, _t, bpm, origin) { const now = `${JSON.stringify(p)}|${bpm}|${origin}`; if (now !== sent) { sent = now; node.port.postMessage({ p, bpm, origin }); } } };
  };
}
const BUTTER_DB = 20 * Math.log10(Math.SQRT1_2);
const stereo = (ctx: BaseAudioContext) => { const g = ctx.createGain(); g.channelCount = 2; g.channelCountMode = "explicit"; g.channelInterpretation = "speakers"; return g; };
// While a device is being built its settings are put in place at once; after that they glide, so nothing clicks.
let building = false;
const to = (a: AudioParam, v: number, t: number) => { if (building) a.value = v; else a.setTargetAtTime(v, t, SMOOTH); };
const biquad = (ctx: BaseAudioContext, type: BiquadFilterType, f = 1000, q = BUTTER_DB) => { const b = ctx.createBiquadFilter(); b.type = type; b.frequency.value = f; b.Q.value = q; return b; };
const chain = (...n: AudioNode[]) => { for (let i = 0; i + 1 < n.length; i++) n[i]!.connect(n[i + 1]!); return n[n.length - 1]!; };
/** The dry and wet paths every device with a Dry / wet setting shares. `lag` holds the dry sound back when the effect itself is late. */
function mixer(ctx: BaseAudioContext, lag = 0) {
  const input = ctx.createGain(), output = ctx.createGain(), dry = ctx.createGain(), wet = ctx.createGain(), nodes: AudioNode[] = [input, output, dry, wet];
  if (lag > 0) { const d = ctx.createDelay(0.05); d.delayTime.value = lag; input.connect(d).connect(dry); nodes.push(d); } else input.connect(dry);
  dry.connect(output); wet.connect(output);
  return { input, output, wet, nodes, set(mix: number, t: number) { const [d, w] = mixGains(mix); to(dry.gain, d, t); to(wet.gain, w, t); } };
}
const SMOOTH = 0.012;

// Devices whose inside arrives a moment after they are built (the pitch shifter's is fetched and started by
// its own library). An export waits for them with `devicesSettled`.
const arriving = new WeakMap<BaseAudioContext, Set<Promise<unknown>>>();
export const devicesSettled = (ctx: BaseAudioContext): Promise<unknown> => Promise.allSettled([...(arriving.get(ctx) ?? [])]);
function pitchshift(ctx: BaseAudioContext): Core {
  const m = mixer(ctx);
  let node: Awaited<ReturnType<typeof stretchNode>> | undefined, want = { semitones: 0, formantCompensation: false }, sent = "";
  const send = () => { const now = JSON.stringify(want); if (node && now !== sent) { sent = now; node.schedule({ active: true, ...want }); } };
  const coming = stretchNode(ctx).then((n) => { node = n; m.input.connect(n); n.connect(m.wet); m.nodes.push(n); send(); }, () => undefined);
  const set = arriving.get(ctx) ?? new Set(); set.add(coming); arriving.set(ctx, set);
  return { input: m.input, output: m.output, nodes: m.nodes, set(p, t) {
    want = { semitones: (p.semis ?? 7) + (p.cents ?? 0) / 100, formantCompensation: !!p.formant };
    send(); m.set(p.mix ?? 100, t);
  } };
}
function utility(ctx: BaseAudioContext): Core {
  const input = ctx.createGain();
  input.channelCount = 2; input.channelCountMode = "explicit"; input.channelInterpretation = "speakers"; // a mono sound becomes the same on both sides
  const split = ctx.createChannelSplitter(2), merge = ctx.createChannelMerger(2), out = ctx.createGain();
  const ll = ctx.createGain(), rl = ctx.createGain(), lr = ctx.createGain(), rr = ctx.createGain();
  input.connect(split);
  split.connect(ll, 0); split.connect(lr, 0); split.connect(rl, 1); split.connect(rr, 1);
  ll.connect(merge, 0, 0); rl.connect(merge, 0, 0); lr.connect(merge, 0, 1); rr.connect(merge, 0, 1);
  // Bass mono: the sound is split in two at a frequency (two Butterworth filters each way, so the halves add
  // back flat), and the low half is made the same on both sides. Switched off, the sound takes the plain path.
  const plain = ctx.createGain(), split2 = ctx.createGain(), lows = [biquad(ctx, "lowpass", 120), biquad(ctx, "lowpass", 120)], highs = [biquad(ctx, "highpass", 120), biquad(ctx, "highpass", 120)], one = ctx.createGain(), sum = ctx.createGain();
  one.channelCount = 1; one.channelCountMode = "explicit"; one.channelInterpretation = "speakers";      // both sides added and halved
  merge.connect(plain).connect(sum); merge.connect(split2);
  chain(split2, lows[0]!, lows[1]!, one, sum); chain(split2, highs[0]!, highs[1]!, sum);
  // Remove offset: a high-pass far below hearing, or the plain path
  const keep = ctx.createGain(), cut = ctx.createGain(), dc = biquad(ctx, "highpass", DC_CUT_HZ);
  sum.connect(keep).connect(out); chain(sum, cut, dc, out);
  return { input, output: out, nodes: [input, split, merge, out, ll, rl, lr, rr, plain, split2, ...lows, ...highs, one, sum, keep, cut, dc], set(p, t) {
    const m = utilityMatrix(p);
    to(ll.gain, m.ll, t); to(rl.gain, m.rl, t); to(lr.gain, m.lr, t); to(rr.gain, m.rr, t); to(out.gain, m.gain, t);
    to(plain.gain, p.bassMono ? 0 : 1, t); to(split2.gain, p.bassMono ? 1 : 0, t); for (const f of [...lows, ...highs]) to(f.frequency, p.bassFreq ?? 120, t);
    to(keep.gain, p.dc ? 0 : 1, t); to(cut.gain, p.dc ? 1 : 0, t);
  } };
}

function eq3(ctx: BaseAudioContext): Core {
  const input = ctx.createGain(), out = ctx.createGain(), gl = ctx.createGain(), gm = ctx.createGain(), gh = ctx.createGain(), low = ctx.createGain(), rest = ctx.createGain();
  const at1 = [biquad(ctx, "lowpass"), biquad(ctx, "lowpass"), biquad(ctx, "highpass"), biquad(ctx, "highpass")];
  const at2 = [biquad(ctx, "lowpass"), biquad(ctx, "lowpass"), biquad(ctx, "highpass"), biquad(ctx, "highpass"), biquad(ctx, "lowpass"), biquad(ctx, "lowpass"), biquad(ctx, "highpass"), biquad(ctx, "highpass")];
  chain(input, at1[0]!, at1[1]!, low); chain(input, at1[2]!, at1[3]!, rest);
  chain(low, at2[0]!, at2[1]!, gl); chain(low, at2[2]!, at2[3]!, gl);      // the lows, through both halves of the upper split, which only turns their phase
  chain(rest, at2[4]!, at2[5]!, gm); chain(rest, at2[6]!, at2[7]!, gh);
  gl.connect(out); gm.connect(out); gh.connect(out);
  return { input, output: out, nodes: [input, out, gl, gm, gh, low, rest, ...at1, ...at2], set(p, t) {
    const [a, b, c] = eq3Gains(p); to(gl.gain, a, t); to(gm.gain, b, t); to(gh.gain, c, t);
    for (const f of at1) to(f.frequency, p.freqLow ?? 250, t);
    for (const f of at2) to(f.frequency, p.freqHigh ?? 2500, t);
  } };
}
function eq8(ctx: BaseAudioContext): Core {
  const bands = Array.from({ length: 8 }, () => biquad(ctx, "peaking", 1000, 1));
  chain(...bands);
  return { input: bands[0]!, output: bands[7]!, nodes: bands, set(p, t) {
    bands.forEach((f, i) => { const b = eq8Band(p, i + 1); if (f.type !== b.kind) f.type = b.kind;
      to(f.frequency, b.f, t); to(f.gain, b.gain, t); to(f.Q, b.kind === "lowpass" || b.kind === "highpass" ? 20 * Math.log10(b.q) : b.q, t); });
  } };
}
function channeleq(ctx: BaseAudioContext): Core {
  const cut = biquad(ctx, "highpass", 1), low = biquad(ctx, "lowshelf", CHANNEL_LOW_HZ), mid = biquad(ctx, "peaking", 1000, CHANNEL_MID_Q), high = biquad(ctx, "highshelf", CHANNEL_HIGH_HZ), out = ctx.createGain();
  chain(cut, low, mid, high, out);
  return { input: cut, output: out, nodes: [cut, low, mid, high, out], set(p, t) {
    to(cut.frequency, p.lowcut ? CHANNEL_CUT_HZ : 1, t); to(low.gain, p.low ?? 0, t); to(mid.gain, p.mid ?? 0, t); to(mid.frequency, p.midFreq ?? 1000, t); to(high.gain, p.high ?? 0, t); to(out.gain, dbToGain(p.out ?? 0), t);
  } };
}
function sat(ctx: BaseAudioContext): Core {
  const m = mixer(ctx), colour = biquad(ctx, "peaking", 1000, COLOUR_Q), shape = ctx.createWaveShaper(), still = biquad(ctx, "highpass", 5), out = ctx.createGain();
  // Soft clip, on the way out: turned down to fit the table, bent, turned back up; or the plain path
  const plain = ctx.createGain(), down = ctx.createGain(), bend = ctx.createWaveShaper(), up = ctx.createGain();
  bend.curve = softClipTable(); up.gain.value = 0;
  chain(m.input, colour, shape, still, out);       // the high-pass takes away the steady offset the uneven curve leaves
  out.connect(plain).connect(m.wet); chain(out, down, bend, up, m.wet);
  down.gain.value = 1 / SOFT_CLIP_REACH;
  let made = "";
  return { input: m.input, output: m.output, nodes: [...m.nodes, colour, shape, still, out, plain, down, bend, up], set(p, t) {
    const key = `${p.curve ?? 0}:${p.drive ?? 12}`;
    if (key !== made) { shape.curve = satTable(p.curve ?? 0, p.drive ?? 12); made = key; }
    to(colour.frequency, p.colourFreq ?? 1000, t); to(colour.gain, p.colour ? p.colourDb ?? 6 : 0, t);
    to(plain.gain, p.soft ? 0 : 1, t); to(up.gain, p.soft ? 1 : 0, t);
    to(out.gain, dbToGain(p.out ?? 0), t); m.set(p.mix ?? 100, t);
  } };
}
function overdrive(ctx: BaseAudioContext): Core {
  const m = mixer(ctx), band = biquad(ctx, "bandpass", 800, 1), shape = ctx.createWaveShaper(), tone = biquad(ctx, "lowpass", 8000);
  chain(m.input, band, shape, tone, m.wet);
  let made = -1;
  return { input: m.input, output: m.output, nodes: [...m.nodes, band, shape, tone], set(p, t) {
    const g = overdriveGain(p.drive ?? 50);
    if (g !== made) { const n = 4097, c = new Float32Array(n); for (let i = 0; i < n; i++) c[i] = Math.tanh(((2 * i) / (n - 1) - 1) * g); shape.curve = c; made = g; }
    to(band.frequency, p.freq ?? 800, t); to(band.Q, octavesToQ(p.width ?? 3), t); to(tone.frequency, overdriveToneHz(p.tone ?? 60), t); m.set(p.mix ?? 60, t);
  } };
}
function autopan(ctx: BaseAudioContext): Core {
  const input = stereo(ctx), split = ctx.createChannelSplitter(2), merge = ctx.createChannelMerger(2), gl = ctx.createGain(), gr = ctx.createGain();
  const ol = ctx.createOscillator(), or = ctx.createOscillator(), dl = ctx.createGain(), dr = ctx.createGain();
  input.connect(split); split.connect(gl, 0); split.connect(gr, 1); gl.connect(merge, 0, 0); gr.connect(merge, 0, 1);
  ol.connect(dl).connect(gl.gain); or.connect(dr).connect(gr.gain);
  const begin = ctx.currentTime; ol.start(begin); or.start(begin);
  let made = "";
  return { input, output: merge, nodes: [input, split, merge, gl, gr, ol, or, dl, dr], set(p, t, bpm) {
    const key = `${p.shape ?? 0}:${p.phase ?? 180}`;
    if (key !== made) { const h = panHarmonics(p.shape ?? 0), turn = ((p.phase ?? 180) / 360) * 2 * Math.PI, n = h.length + 1;
      const zero = new Float32Array(n), li = new Float32Array(n), rr = new Float32Array(n), ri = new Float32Array(n);
      h.forEach((b, i) => { li[i + 1] = b; ri[i + 1] = b * Math.cos((i + 1) * turn); rr[i + 1] = -b * Math.sin((i + 1) * turn); });
      ol.setPeriodicWave(ctx.createPeriodicWave(zero, li, { disableNormalization: true })); or.setPeriodicWave(ctx.createPeriodicWave(rr, ri, { disableNormalization: true })); made = key; }
    const a = Math.min(1, Math.max(0, (p.amount ?? 100) / 100)), hz = lfoRateHz(p, bpm);
    to(ol.frequency, hz, t); to(or.frequency, hz, t); to(gl.gain, 1 - a / 2, t); to(gr.gain, 1 - a / 2, t); to(dl.gain, a / 2, t); to(dr.gain, a / 2, t);
  } };
}
function chorus(ctx: BaseAudioContext): Core {
  const m = mixer(ctx), mono = ctx.createGain(), a = ctx.createDelay(0.06), b = ctx.createDelay(0.06), pa = ctx.createStereoPanner(), pb = ctx.createStereoPanner();
  mono.channelCount = 1; mono.channelCountMode = "explicit"; mono.gain.value = Math.SQRT1_2;
  const lfo = ctx.createOscillator(), up = ctx.createGain(), down = ctx.createGain(), fa = ctx.createGain(), fb = ctx.createGain();
  m.input.connect(mono); mono.connect(a); mono.connect(b); a.connect(pa).connect(m.wet); b.connect(pb).connect(m.wet);
  a.connect(fa).connect(a); b.connect(fb).connect(b);
  lfo.connect(up).connect(a.delayTime); lfo.connect(down).connect(b.delayTime); lfo.start(ctx.currentTime);
  return { input: m.input, output: m.output, nodes: [...m.nodes, mono, a, b, pa, pb, lfo, up, down, fa, fb], set(p, t) {
    const base = (p.delay ?? 12) / 1000, swing = Math.min(CHORUS_SWING, base - 0.0005) * Math.min(1, Math.max(0, (p.amount ?? 50) / 100)), w = (p.width ?? 100) / 100, f = Math.min(0.8, (p.feedback ?? 0) / 100);
    to(a.delayTime, base, t); to(b.delayTime, base, t); to(up.gain, swing, t); to(down.gain, -swing, t); to(lfo.frequency, p.rate ?? 0.8, t);
    to(pa.pan, -w, t); to(pb.pan, w, t); to(fa.gain, f, t); to(fb.gain, f, t); m.set(p.mix ?? 50, t);
  } };
}
function delay(ctx: BaseAudioContext): Core {
  const m = mixer(ctx), input = stereo(ctx), split = ctx.createChannelSplitter(2), merge = ctx.createChannelMerger(2);
  const dl = ctx.createDelay(DELAY_MAX_SECONDS + 0.1), dr = ctx.createDelay(DELAY_MAX_SECONDS + 0.1), fl = biquad(ctx, "bandpass", 1000, 1), fr = biquad(ctx, "bandpass", 1000, 1);
  const g = Array.from({ length: 8 }, () => ctx.createGain()), [ll, rl, lr, rr, selfL, selfR, crossLR, crossRL] = g as [GainNode, GainNode, GainNode, GainNode, GainNode, GainNode, GainNode, GainNode];
  m.input.connect(input).connect(split);
  split.connect(ll, 0); split.connect(lr, 0); split.connect(rl, 1); split.connect(rr, 1);
  ll.connect(dl); rl.connect(dl); lr.connect(dr); rr.connect(dr);
  dl.connect(fl); dr.connect(fr);
  fl.connect(selfL).connect(dl); fr.connect(selfR).connect(dr); fl.connect(crossLR).connect(dr); fr.connect(crossRL).connect(dl);
  // A loop in the browser is one block of 128 samples late. The delays are set that much short so every repeat
  // lands on time, and each side's way out waits one block so its first echo does too. In ping-pong the two
  // delays share one loop and the block falls on the hop from left to right (measured in Chrome), so there the
  // right delay keeps its full time and its way out does not wait.
  const block = 128 / ctx.sampleRate, lateL = ctx.createDelay(0.01), lateR = ctx.createDelay(0.01); lateL.delayTime.value = block;
  fl.connect(lateL).connect(merge, 0, 0); fr.connect(lateR).connect(merge, 0, 1); merge.connect(m.wet);
  return { input: m.input, output: m.output, nodes: [...m.nodes, input, split, merge, lateL, lateR, dl, dr, fl, fr, ...g], set(p, t, bpm) {
    const times = delayTimes(p, bpm), tl = Math.max(0, times[0] - block), tr = Math.max(0, times[1] - (p.pingpong ? 0 : block)), r = delayRouting(p), type: BiquadFilterType = p.filter ? "bandpass" : "peaking"; // a bell with no gain passes the echoes untouched
    to(lateR.delayTime, p.pingpong ? 0 : block, t);
    to(dl.delayTime, tl, t); to(dr.delayTime, tr, t);
    to(ll.gain, r.leftIn[0], t); to(rl.gain, r.leftIn[1], t); to(lr.gain, r.rightIn[0], t); to(rr.gain, r.rightIn[1], t);
    to(selfL.gain, r.self, t); to(selfR.gain, r.self, t); to(crossLR.gain, r.cross, t); to(crossRL.gain, r.cross, t);
    for (const f of [fl, fr]) { if (f.type !== type) f.type = type; to(f.frequency, p.filterFreq ?? 1000, t); to(f.Q, octavesToQ(p.filterWidth ?? 6), t); f.gain.value = 0; }
    m.set(p.mix ?? 30, t);
  } };
}
function reverb(ctx: BaseAudioContext): Core {
  const m = mixer(ctx), pre = ctx.createDelay(0.3), room = ctx.createConvolver(), low = biquad(ctx, "highpass", 120), high = biquad(ctx, "lowpass", 8000);
  room.normalize = false;
  chain(m.input, pre, room, low, high, m.wet);
  let made = -1;
  return { input: m.input, output: m.output, nodes: [...m.nodes, pre, room, low, high], set(p, t) {
    const seconds = p.decay ?? 1.8;
    if (seconds !== made) { const [l, r] = reverbImpulse(seconds, ctx.sampleRate), buf = ctx.createBuffer(2, l.length, ctx.sampleRate); buf.copyToChannel(l, 0); buf.copyToChannel(r, 1); room.buffer = buf; made = seconds; }
    to(pre.delayTime, (p.predelay ?? 10) / 1000, t); to(low.frequency, p.lowcut ?? 120, t); to(high.frequency, p.highcut ?? 8000, t); m.set(p.mix ?? 25, t);
  } };
}
/** An LFO whose shape can be changed: sine, triangle or square, built from harmonics so it swings exactly -1 to 1. */
function lfoOsc(ctx: BaseAudioContext) {
  const osc = ctx.createOscillator(); let made = -1; osc.start(ctx.currentTime);
  return { osc, shape(n: number) { if (n === made) return; const h = panHarmonics(n), im = new Float32Array(h.length + 1); h.forEach((b, i) => { im[i + 1] = b; }); osc.setPeriodicWave(ctx.createPeriodicWave(new Float32Array(h.length + 1), im, { disableNormalization: true })); made = n; } };
}
/**
 * Follows how loud a sound is: its output is about 1 for a full-level tone. `speed` sets how quickly it
 * follows. The smoothing is a one-pole filter made with the browser's exact (double precision) filter: its
 * ordinary low-pass set this low read a tenth short.
 */
function follower(ctx: BaseAudioContext) {
  const mono = ctx.createGain(), abs = ctx.createWaveShaper(), out = ctx.createGain();
  mono.channelCount = 1; mono.channelCountMode = "explicit";
  const c = new Float32Array(2049); for (let i = 0; i < c.length; i++) c[i] = Math.abs((2 * i) / (c.length - 1) - 1); abs.curve = c;
  out.gain.value = Math.PI / 2;                                    // a sine's average size is 2/pi of its peak
  mono.connect(abs);
  let smooth: IIRFilterNode | undefined, made = -1;
  const nodes: AudioNode[] = [mono, abs, out];
  return { input: mono, output: out, nodes, speed(ms: number, _t: number) {
    if (ms === made) return;
    const a = 1 - Math.exp(-1 / ((Math.max(1, ms) / 1000) * ctx.sampleRate)), next = ctx.createIIRFilter([a], [1, a - 1]);
    if (smooth) { abs.disconnect(smooth); smooth.disconnect(); nodes.splice(nodes.indexOf(smooth), 1); }
    abs.connect(next).connect(out); nodes.push(next); smooth = next; made = ms;
  } };
}
function autofilter(ctx: BaseAudioContext): Core {
  const f = biquad(ctx, "lowpass", 1200, 0), lfo = lfoOsc(ctx), depth = ctx.createGain(), fol = follower(ctx), env = ctx.createGain();
  lfo.osc.connect(depth).connect(f.detune);
  // what the follower listens to: this sound, or another track's (a sidechain) plugged into `other`
  const input = ctx.createGain(), own = ctx.createGain(), other = ctx.createGain(); input.connect(f); input.connect(own).connect(fol.input); other.connect(fol.input); fol.output.connect(env).connect(f.detune);
  return { input, output: f, side: other, sideIn: 0, nodes: [input, own, other, f, lfo.osc, depth, env, ...fol.nodes], set(p, t, bpm) {
    const side = (p.side ?? 0) > 0; to(own.gain, side ? 0 : 1, t); to(other.gain, side ? 1 : 0, t);
    const kind = autoFilterKind(p); if (f.type !== kind) f.type = kind;
    lfo.shape(p.shape ?? 0); to(lfo.osc.frequency, lfoRateHz(p, bpm), t); to(depth.gain, (p.lfo ?? 1) * 1200, t); to(env.gain, (p.env ?? 0) * 1200, t); fol.speed(p.envSpeed ?? 40, t);
    to(f.frequency, p.freq ?? 1200, t); to(f.Q, kind === "lowpass" || kind === "highpass" ? 20 * Math.log10(p.res ?? 1.5) : p.res ?? 1.5, t);
  } };
}
function phaser(ctx: BaseAudioContext): Core {
  const m = mixer(ctx), lfo = ctx.createOscillator(), stages = Array.from({ length: PHASER_STAGES }, () => biquad(ctx, "allpass", 800, PHASER_Q)), cents = ctx.createGain(), ph = ctx.createGain(), fl = ctx.createGain();
  const d = ctx.createDelay(0.05), swing = ctx.createGain(), fb = ctx.createGain(), half = ctx.createGain(); half.gain.value = 0.5;
  lfo.start(ctx.currentTime); lfo.connect(cents); for (const s of stages) cents.connect(s.detune);
  chain(m.input, ...stages, ph, half); m.input.connect(half);    // the wet sound is the untouched sound plus the shifted one, halved: where they are opposite, a notch
  lfo.connect(swing).connect(d.delayTime); chain(m.input, d, fl, half); d.connect(fb).connect(d);
  half.connect(m.wet);
  return { input: m.input, output: m.output, nodes: [...m.nodes, lfo, ...stages, cents, ph, fl, d, swing, fb, half], set(p, t) {
    const a = Math.min(1, Math.max(0, (p.amount ?? 60) / 100)), flange = !!p.mode;
    to(lfo.frequency, p.rate ?? 0.3, t); to(cents.gain, a * PHASER_SWING_CENTS, t); for (const s of stages) to(s.frequency, p.centre ?? 800, t);
    to(d.delayTime, FLANGER_BASE, t); to(swing.gain, a * FLANGER_SWING, t); to(fb.gain, flange ? Math.min(0.9, (p.feedback ?? 40) / 100) : 0, t);
    to(ph.gain, flange ? 0 : 1, t); to(fl.gain, flange ? 1 : 0, t); m.set(p.mix ?? 100, t);
  } };
}
function echo(ctx: BaseAudioContext): Core {
  const m = mixer(ctx), sum = ctx.createGain(), d = ctx.createDelay(DELAY_MAX_SECONDS + 0.1), low = biquad(ctx, "highpass", 150), high = biquad(ctx, "lowpass", 5000), shape = ctx.createWaveShaper(), fb = ctx.createGain();
  const block = 128 / ctx.sampleRate, late = ctx.createDelay(0.01), duck = ctx.createGain(), fol = follower(ctx), down = ctx.createGain(), lfo = ctx.createOscillator(), wob = ctx.createGain();
  late.delayTime.value = block; fol.speed(60, 0); lfo.start(ctx.currentTime);
  chain(m.input, sum, d, low, high, shape, late, duck, m.wet); shape.connect(fb).connect(sum);
  m.input.connect(fol.input); fol.output.connect(down).connect(duck.gain); lfo.connect(wob).connect(d.delayTime);
  let made = -1;
  return { input: m.input, output: m.output, nodes: [...m.nodes, sum, d, low, high, shape, fb, late, duck, down, lfo, wob, ...fol.nodes], set(p, t, bpm) {
    const g = echoDriveGain(p.drive ?? 0);
    if (g !== made) { if (g === 1) shape.curve = null; else { const n = 4097, c = new Float32Array(n); for (let i = 0; i < n; i++) c[i] = Math.tanh(((2 * i) / (n - 1) - 1) * g) / Math.tanh(g); shape.curve = c; } made = g; }
    to(d.delayTime, Math.max(0, echoSeconds(p, bpm) - block), t); to(fb.gain, Math.min(0.95, (p.feedback ?? 50) / 100), t); to(low.frequency, p.lowcut ?? 150, t); to(high.frequency, p.highcut ?? 5000, t);
    to(wob.gain, ((p.wobble ?? 0) / 100) * ECHO_WOBBLE, t); to(lfo.frequency, p.wobbleRate ?? 0.5, t); to(down.gain, -(p.duck ?? 0) / 100, t); m.set(p.mix ?? 35, t);
  } };
}
function filterdelay(ctx: BaseAudioContext): Core {
  const m = mixer(ctx), input = stereo(ctx), split = ctx.createChannelSplitter(2), block = 128 / ctx.sampleRate, nodes: AudioNode[] = [input, split];
  m.input.connect(input).connect(split);
  const lines = FILTER_DELAY_LINES.map((k) => { const fromL = ctx.createGain(), fromR = ctx.createGain(), d = ctx.createDelay(DELAY_MAX_SECONDS + 0.1), f = biquad(ctx, "bandpass", 1000, 1), fb = ctx.createGain(), late = ctx.createDelay(0.01), level = ctx.createGain(), pan = ctx.createStereoPanner();
    late.delayTime.value = block; split.connect(fromL, 0); split.connect(fromR, 1); fromL.connect(d); fromR.connect(d); chain(d, f, late, level, pan, m.wet); f.connect(fb).connect(d);
    nodes.push(fromL, fromR, d, f, fb, late, level, pan); return { k, fromL, fromR, d, f, fb, level, pan }; });
  return { input: m.input, output: m.output, nodes: [...m.nodes, ...nodes], set(p, t, bpm) {
    for (const l of lines) { const s = filterDelayLine(p, l.k, bpm); to(l.fromL.gain, s.hears[0], t); to(l.fromR.gain, s.hears[1], t); to(l.d.delayTime, Math.max(0, s.seconds - block), t); to(l.fb.gain, s.feedback, t);
      to(l.f.frequency, s.freq, t); to(l.f.Q, s.q, t); to(l.level.gain, s.level, t); to(l.pan.pan, s.pan, t); }
    m.set(p.mix ?? 40, t);
  } };
}
/** Two seconds of repeatable noise, different on each side. */
function noiseBuffer(ctx: BaseAudioContext): AudioBuffer {
  const buf = ctx.createBuffer(2, ctx.sampleRate * 2, ctx.sampleRate); let seed = 4242;
  for (let ch = 0; ch < 2; ch++) { const d = buf.getChannelData(ch); for (let i = 0; i < d.length; i++) { seed = (seed * 1664525 + 1013904223) >>> 0; d[i] = seed / 2147483648 - 1; } }
  return buf;
}
function erosion(ctx: BaseAudioContext): Core {
  const input = stereo(ctx), split = ctx.createChannelSplitter(2), merge = ctx.createChannelMerger(2), dl = ctx.createDelay(0.01), dr = ctx.createDelay(0.01);
  input.connect(split); split.connect(dl, 0); split.connect(dr, 1); dl.connect(merge, 0, 0); dr.connect(merge, 0, 1);
  const noise = ctx.createBufferSource(), band = biquad(ctx, "bandpass", 3000, 1), ns = ctx.createChannelSplitter(2), sine = ctx.createOscillator();
  noise.buffer = noiseBuffer(ctx); noise.loop = true; noise.start(ctx.currentTime); sine.start(ctx.currentTime); noise.connect(band).connect(ns);
  // what shakes each side: the same noise, a different noise for the right, or the sine
  const sameL = ctx.createGain(), sameR = ctx.createGain(), wideR = ctx.createGain(), sinL = ctx.createGain(), sinR = ctx.createGain();
  ns.connect(sameL, 0); ns.connect(sameR, 0); ns.connect(wideR, 1); sine.connect(sinL); sine.connect(sinR);
  sameL.connect(dl.delayTime); sinL.connect(dl.delayTime); sameR.connect(dr.delayTime); wideR.connect(dr.delayTime); sinR.connect(dr.delayTime);
  return { input, output: merge, nodes: [input, split, merge, dl, dr, noise, band, ns, sine, sameL, sameR, wideR, sinL, sinR], set(p, t) {
    const swing = erosionSwing(p), mode = p.mode ?? 0;
    to(dl.delayTime, swing, t); to(dr.delayTime, swing, t);         // rests exactly as far back as it can swing, so with no amount there is no delay at all
    to(band.frequency, p.freq ?? 3000, t); to(band.Q, octavesToQ(p.width ?? 1), t); to(sine.frequency, p.freq ?? 3000, t);
    to(sameL.gain, mode < 2 ? swing : 0, t); to(sameR.gain, mode === 0 ? swing : 0, t); to(wideR.gain, mode === 1 ? swing : 0, t); to(sinL.gain, mode === 2 ? swing : 0, t); to(sinR.gain, mode === 2 ? swing : 0, t);
  } };
}
/** Bass, middle and treble: a low shelf, a bell and a high shelf. */
function tone3(ctx: BaseAudioContext) {
  const low = biquad(ctx, "lowshelf", TONE_LOW_HZ), mid = biquad(ctx, "peaking", TONE_MID_HZ, 0.7), high = biquad(ctx, "highshelf", TONE_HIGH_HZ);
  low.connect(mid).connect(high);
  return { input: low, output: high, nodes: [low, mid, high] as AudioNode[], set(b: number, m: number, h: number, t: number) { to(low.gain, b, t); to(mid.gain, m, t); to(high.gain, h, t); } };
}
function amp(ctx: BaseAudioContext): Core {
  const rumble = biquad(ctx, "highpass", 60), shape = ctx.createWaveShaper(), still = biquad(ctx, "highpass", 10), tone = tone3(ctx), presence = biquad(ctx, "peaking", PRESENCE_HZ, 1), out = ctx.createGain();
  shape.oversample = "4x"; chain(rumble, shape, still, tone.input); chain(tone.output, presence, out);
  let made = "";
  return { input: rumble, output: out, nodes: [rumble, shape, still, ...tone.nodes, presence, out], set(p, t) {
    const key = `${p.type ?? 0}:${p.gain ?? 50}`; if (key !== made) { shape.curve = driveTable((x) => ampDrive(p.type ?? 0, p.gain ?? 50, x)); made = key; }
    tone.set(p.bass ?? 0, p.middle ?? 0, p.treble ?? 0, t); to(presence.gain, p.presence ?? 0, t); to(out.gain, dbToGain(p.volume ?? 0), t);
  } };
}
function pedal(ctx: BaseAudioContext): Core {
  const m = mixer(ctx), shape = ctx.createWaveShaper(), tone = tone3(ctx), out = ctx.createGain();
  chain(m.input, shape, tone.input); chain(tone.output, out, m.wet);
  let made = "";
  return { input: m.input, output: m.output, nodes: [...m.nodes, shape, ...tone.nodes, out], set(p, t) {
    const key = `${p.type ?? 0}:${p.gain ?? 50}`; if (key !== made) { shape.curve = driveTable((x) => pedalDrive(p.type ?? 0, p.gain ?? 50, x)); made = key; }
    tone.set(p.bass ?? 0, p.mid ?? 0, p.treble ?? 0, t); to(out.gain, dbToGain(p.out ?? 0), t); m.set(p.mix ?? 100, t);
  } };
}
function cabinet(ctx: BaseAudioContext): Core {
  const low = biquad(ctx, "highpass", 80), bump = biquad(ctx, "peaking", 100, CAB_BUMP_Q), top1 = biquad(ctx, "lowpass", 5000), top2 = biquad(ctx, "lowpass", 5000);
  chain(low, bump, top1, top2);
  return { input: low, output: top2, nodes: [low, bump, top1, top2], set(p, t) { const c = cabinetOf(p); to(low.frequency, c.low, t); to(bump.frequency, c.bump, t); to(bump.gain, c.lift, t); to(top1.frequency, c.top, t); to(top2.frequency, c.top, t); } };
}
/** A device that only shows the sound: it passes straight through, with a tap for the picture. */
function viewer(size: number) {
  return (ctx: BaseAudioContext): Core => { const pass = ctx.createGain(), a = ctx.createAnalyser(); a.fftSize = size; a.smoothingTimeConstant = 0.7; pass.connect(a); return { input: pass, output: pass, nodes: [pass, a], analyser: a, set() { /* nothing to set */ } }; };
}
const CORES: Record<string, (ctx: BaseAudioContext, p: P) => Core> = { comp: worklet("comp", 2), beatrepeat: worklet("beatrepeat"), vinyl: worklet("vinyl"), amp, pedal, cabinet, spectrum: viewer(4096), tuner: viewer(4096), glue: worklet("glue", 2), limiter: worklet("limiter"), gate: worklet("gate", 2), crush: worklet("crush"), resonators: worklet("resonators"), multiband: worklet("multiband", 2), drumbus: worklet("drumbus"), shifter: worklet("shifter"), pitchshift, erosion, autofilter, phaser, echo, filterdelay, utility, eq3, eq8, channeleq, sat, overdrive, autopan, chorus, delay, reverb };

/** The audio for one device, or nothing when the kind is unknown. */
export function buildDevice(ctx: BaseAudioContext, d: Device, bpm = 120, origin = 0): LiveDevice | undefined {
  const make = CORES[d.kind];
  if (!make || (needsWorklet(d.kind) && !devicesReady(ctx))) return undefined;
  const core = make(ctx, d.p), input = ctx.createGain(), output = ctx.createGain(), wet = ctx.createGain(), dry = ctx.createGain();
  input.connect(core.input); core.output.connect(wet).connect(output);
  input.connect(dry).connect(output);
  wet.gain.value = d.on ? 1 : 0; dry.gain.value = d.on ? 0 : 1;
  building = true; try { core.set(d.p, ctx.currentTime, bpm, origin); } finally { building = false; }
  // a device that draws a curve also shows the sound coming out of it, faintly, behind the curve
  let tap: AnalyserNode | undefined;
  if (!core.analyser && CURVES[d.kind]) { tap = ctx.createAnalyser(); tap.fftSize = 4096; tap.smoothingTimeConstant = 0.8; output.connect(tap); }
  return { input, output, reduction: core.reduction, side: core.side, sideIn: core.sideIn, analyser: core.analyser ?? tap,
    update(next, tempo = bpm, began = origin) { const t = ctx.currentTime; core.set(next.p, t, tempo, began); wet.gain.setTargetAtTime(next.on ? 1 : 0, t, SMOOTH); dry.gain.setTargetAtTime(next.on ? 0 : 1, t, SMOOTH); },
    dispose() { for (const n of [input, output, wet, dry, ...(tap ? [tap] : []), ...core.nodes]) { try { if (n instanceof OscillatorNode || n instanceof AudioBufferSourceNode) n.stop(); n.disconnect(); } catch { /* already apart */ } } },
  };
}
