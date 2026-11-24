// Time-stretch and pitch-shift, done by Signalsmith Stretch (MIT; Geraint Luff, Signalsmith Audio): a
// ready-made, well-regarded method that runs as WebAssembly on the audio thread. It is the one piece of
// sound code here that is not ours. It is fetched only when first needed.
//
// Two uses: `stretchSamples` works a whole sound out ahead of time (a break made to fit a tempo, a sample
// moved in pitch without changing its length), and `stretchNode` shifts a live sound's pitch in an effect
// chain. A live shift comes out late by the method's own delay (about an eighth of a second).

interface StretchNode extends AudioNode {
  schedule(change: { output?: number; active?: boolean; input?: number; rate?: number; semitones?: number; tonalityHz?: number; formantCompensation?: boolean }): void;
  addBuffers(channels: Float32Array[]): Promise<number>;
  latency(): number;
}
type Factory = (ctx: BaseAudioContext, options?: AudioWorkletNodeOptions) => Promise<StretchNode>;
let factory: Promise<Factory> | undefined;
const load = () => (factory ??= import("signalsmith-stretch").then((m) => (m as unknown as { default: Factory }).default));

/** A node that shifts whatever is played into it, keeping its speed. It does nothing until `schedule({ active: true, semitones })`. */
export async function stretchNode(ctx: BaseAudioContext): Promise<StretchNode> {
  return (await load())(ctx, { numberOfInputs: 1, numberOfOutputs: 1, outputChannelCount: [2] });
}
/** How long a sound of `seconds` lasts once played at `rate` (0.5 is half speed, so twice as long). */
export const stretchedSeconds = (seconds: number, rate: number) => seconds / Math.min(4, Math.max(0.25, rate));
/** The speed that makes a loop of `seconds` last exactly `beats` beats at `bpm`. */
export const rateToFit = (seconds: number, beats: number, bpm: number) => seconds / ((beats * 60) / bpm);
/** The whole number of beats (a power of two, 1 to 64) a loop of `seconds` is nearest to at `bpm`: a guess at what it was cut as. */
export function beatsNear(seconds: number, bpm: number): number {
  const beats = (seconds * bpm) / 60;
  return [1, 2, 4, 8, 16, 32, 64].reduce((best, b) => (Math.abs(Math.log2(beats / b)) < Math.abs(Math.log2(beats / best)) ? b : best), 4);
}
/**
 * A sound played at another speed without changing its pitch, at another pitch without changing its speed,
 * or both. Worked out ahead of time, faster than real time. `channels` is one array per side.
 */
export async function stretchSamples(channels: Float32Array[], sampleRate: number, change: { rate?: number; semitones?: number }): Promise<Float32Array[]> {
  const rate = Math.min(4, Math.max(0.25, change.rate ?? 1)), semitones = Math.min(24, Math.max(-24, change.semitones ?? 0));
  const frames = channels[0]?.length ?? 0, sides = Math.min(2, Math.max(1, channels.length));
  if (!frames) return channels;
  const out = Math.max(1, Math.round(frames / rate));
  const loud = (list: Float32Array[]) => list.some((c) => { for (let i = 0; i < c.length; i += 7) if (Math.abs(c[i]!) > 1e-5) return true; return false; });
  // The stretcher is told what to do by messages to the audio thread. If the working-out starts before they
  // have landed the result is silence, so a moment is left for them, and a silent result from a sound that
  // is not silent is worked out again with a longer wait.
  const once = async (wait: number): Promise<Float32Array[]> => {
    const ctx = new OfflineAudioContext(sides, out, sampleRate), node = await (await load())(ctx, { numberOfInputs: 0, numberOfOutputs: 1, outputChannelCount: [sides] });
    node.connect(ctx.destination);
    await node.addBuffers(channels.slice(0, sides));
    node.schedule({ active: true, input: 0, rate, semitones, output: 0 });
    await new Promise<void>((r) => setTimeout(r, wait));
    const done = await ctx.startRendering();
    return Array.from({ length: sides }, (_, c) => done.getChannelData(c).slice());
  };
  const heard = loud(channels.slice(0, sides));
  for (const wait of [40, 150, 400]) { const got = await once(wait); if (!heard || loud(got)) return got; }
  throw new Error("the stretcher gave silence");
}
