// The audio of each device, built from the settings and maths in `devices.ts`. Every device is wrapped the
// same way: the sound goes both through the effect and straight past it, and switching the device on or off
// crossfades between the two, so nothing clicks and nothing restarts.
import { CHANNEL_CUT_HZ, CHANNEL_HIGH_HZ, CHANNEL_LOW_HZ, CHANNEL_MID_Q, DELAY_MAX_SECONDS, CHORUS_SWING, dbToGain, delayRouting, delayTimes, eq3Gains, eq8Band, lfoRateHz, mixGains, octavesToQ, overdriveGain, overdriveToneHz, panHarmonics, satTable, utilityMatrix, type Device } from "./devices";
import { compAutoMakeupCancelDb, reverbImpulse } from "../synth/fx";

export interface LiveDevice { input: AudioNode; output: AudioNode; update(d: Device, bpm?: number): void; dispose(): void }
interface Core { input: AudioNode; output: AudioNode; set(p: Record<string, number>, t: number, bpm: number): void; nodes: AudioNode[] }
type P = Record<string, number>;
/** The browser's compressor looks this far ahead, so the untouched sound is held back the same time before the two are mixed. */
export const COMP_LAG = 0.006;
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

function utility(ctx: BaseAudioContext): Core {
  const input = ctx.createGain();
  input.channelCount = 2; input.channelCountMode = "explicit"; input.channelInterpretation = "speakers"; // a mono sound becomes the same on both sides
  const split = ctx.createChannelSplitter(2), merge = ctx.createChannelMerger(2), out = ctx.createGain();
  const ll = ctx.createGain(), rl = ctx.createGain(), lr = ctx.createGain(), rr = ctx.createGain();
  input.connect(split);
  split.connect(ll, 0); split.connect(lr, 0); split.connect(rl, 1); split.connect(rr, 1);
  ll.connect(merge, 0, 0); rl.connect(merge, 0, 0); lr.connect(merge, 0, 1); rr.connect(merge, 0, 1);
  merge.connect(out);
  return { input, output: out, nodes: [input, split, merge, out, ll, rl, lr, rr], set(p, t) {
    const m = utilityMatrix(p);
    to(ll.gain, m.ll, t); to(rl.gain, m.rl, t); to(lr.gain, m.lr, t); to(rr.gain, m.rr, t); to(out.gain, m.gain, t);
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
function comp(ctx: BaseAudioContext): Core {
  const m = mixer(ctx, COMP_LAG), c = ctx.createDynamicsCompressor(), up = ctx.createGain();
  c.knee.value = 0;
  chain(m.input, c, up, m.wet);
  return { input: m.input, output: m.output, nodes: [...m.nodes, c, up], set(p, t) {
    const th = p.threshold ?? -18, ratio = p.ratio ?? 4;
    to(c.threshold, th, t); to(c.ratio, ratio, t); to(c.attack, (p.attack ?? 10) / 1000, t); to(c.release, (p.release ?? 120) / 1000, t);
    to(up.gain, dbToGain((p.makeup ?? 0) + compAutoMakeupCancelDb(th, ratio)), t); m.set(p.mix ?? 100, t);
  } };
}
function sat(ctx: BaseAudioContext): Core {
  const m = mixer(ctx), shape = ctx.createWaveShaper(), still = biquad(ctx, "highpass", 5), out = ctx.createGain();
  chain(m.input, shape, still, out, m.wet);       // the high-pass takes away the steady offset the uneven curve leaves
  let made = "";
  return { input: m.input, output: m.output, nodes: [...m.nodes, shape, still, out], set(p, t) {
    const key = `${p.curve ?? 0}:${p.drive ?? 12}`;
    if (key !== made) { shape.curve = satTable(p.curve ?? 0, p.drive ?? 12); made = key; }
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
const CORES: Record<string, (ctx: BaseAudioContext) => Core> = { utility, eq3, eq8, channeleq, comp, sat, overdrive, autopan, chorus, delay, reverb };

/** The audio for one device, or nothing when the kind is unknown. */
export function buildDevice(ctx: BaseAudioContext, d: Device, bpm = 120): LiveDevice | undefined {
  const make = CORES[d.kind];
  if (!make) return undefined;
  const core = make(ctx), input = ctx.createGain(), output = ctx.createGain(), wet = ctx.createGain(), dry = ctx.createGain();
  input.connect(core.input); core.output.connect(wet).connect(output);
  input.connect(dry).connect(output);
  wet.gain.value = d.on ? 1 : 0; dry.gain.value = d.on ? 0 : 1;
  building = true; try { core.set(d.p, ctx.currentTime, bpm); } finally { building = false; }
  return { input, output,
    update(next, tempo = bpm) { const t = ctx.currentTime; core.set(next.p, t, tempo); wet.gain.setTargetAtTime(next.on ? 1 : 0, t, SMOOTH); dry.gain.setTargetAtTime(next.on ? 0 : 1, t, SMOOTH); },
    dispose() { for (const n of [input, output, wet, dry, ...core.nodes]) { try { if (n instanceof OscillatorNode) n.stop(); n.disconnect(); } catch { /* already apart */ } } },
  };
}
