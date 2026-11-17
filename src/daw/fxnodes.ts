// The audio of each device, built from the settings and maths in `devices.ts`. Every device is wrapped the
// same way: the sound goes both through the effect and straight past it, and switching the device on or off
// crossfades between the two, so nothing clicks and nothing restarts.
import { utilityMatrix, type Device } from "./devices";

export interface LiveDevice { input: AudioNode; output: AudioNode; update(d: Device): void; dispose(): void }
interface Core { input: AudioNode; output: AudioNode; set(p: Record<string, number>, t: number): void; nodes: AudioNode[] }
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
    ll.gain.setTargetAtTime(m.ll, t, SMOOTH); rl.gain.setTargetAtTime(m.rl, t, SMOOTH); lr.gain.setTargetAtTime(m.lr, t, SMOOTH); rr.gain.setTargetAtTime(m.rr, t, SMOOTH);
    out.gain.setTargetAtTime(m.gain, t, SMOOTH);
  } };
}
const CORES: Record<string, (ctx: BaseAudioContext) => Core> = { utility };

/** The audio for one device, or nothing when the kind is unknown. */
export function buildDevice(ctx: BaseAudioContext, d: Device): LiveDevice | undefined {
  const make = CORES[d.kind];
  if (!make) return undefined;
  const core = make(ctx), input = ctx.createGain(), output = ctx.createGain(), wet = ctx.createGain(), dry = ctx.createGain();
  input.connect(core.input); core.output.connect(wet).connect(output);
  input.connect(dry).connect(output);
  wet.gain.value = d.on ? 1 : 0; dry.gain.value = d.on ? 0 : 1;
  core.set(d.p, ctx.currentTime);
  return { input, output,
    update(next) { const t = ctx.currentTime; core.set(next.p, t); wet.gain.setTargetAtTime(next.on ? 1 : 0, t, SMOOTH); dry.gain.setTargetAtTime(next.on ? 0 : 1, t, SMOOTH); },
    dispose() { for (const n of [input, output, wet, dry, ...core.nodes]) { try { n.disconnect(); } catch { /* already apart */ } } },
  };
}
