// The audio thread's side of `dsp.ts`: one processor that runs whichever effect it is asked for.
import { makeDsp, type Dsp, type P } from "./dsp";

declare const sampleRate: number;
declare const currentFrame: number;
declare class AudioWorkletProcessor { readonly port: MessagePort; constructor(options?: unknown); }
declare function registerProcessor(name: string, ctor: unknown): void;

class PwDsp extends AudioWorkletProcessor {
  private readonly dsp: Dsp | undefined; private readonly zero = new Float32Array(128); private since = 0;
  constructor(options: { processorOptions?: { kind?: string; p?: P; bpm?: number; origin?: number } }) {
    super(options);
    this.dsp = makeDsp(options.processorOptions?.kind ?? "", sampleRate);
    this.dsp?.set(options.processorOptions?.p ?? {});
    const clock = (c?: { bpm?: number; origin?: number }) => { if (c && typeof c.bpm === "number") this.dsp?.clock?.(c.bpm, Math.round((c.origin ?? 0) * sampleRate)); };
    clock(options.processorOptions);
    this.port.onmessage = (e: MessageEvent) => { if (e.data?.p) this.dsp?.set(e.data.p as P); clock(e.data); };
  }
  process(inputs: Float32Array[][], outputs: Float32Array[][]): boolean {
    const out = outputs[0]!, outL = out[0]!, outR = out[1] ?? new Float32Array(outL.length), input = inputs[0] ?? [];
    const zero = this.zero.length === outL.length ? this.zero : new Float32Array(outL.length), inL = input[0] ?? zero, inR = input[1] ?? inL;   // a mono sound is the same on both sides
    if (!this.dsp) { outL.set(inL); outR.set(inR); return true; }
    const side = inputs[1] ?? [];
    this.dsp.run(inL, inR, outL, outR, { frame: currentFrame, sideL: side[0], sideR: side[1] ?? side[0] });
    if (this.dsp.reduction && (this.since += outL.length) >= 2048) { this.since = 0; this.port.postMessage({ reduction: this.dsp.reduction() }); }
    return true;
  }
}
registerProcessor("pw-dsp", PwDsp);
