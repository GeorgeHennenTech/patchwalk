// The drum kit. A drum is either built in (made from oscillators and noise by the browser at the moment it
// is struck: nothing recorded, so nothing here is anybody else's sound) or one of the learner's own sound
// files, decoded once and played back.
import { tuneRate, type Voice } from "./drums";

export class Kit {
  readonly out: GainNode;
  private noise: AudioBuffer;
  private buffers = new Map<string, AudioBuffer>();
  /** The open hat that is still ringing, so a closed hat can cut it short, as on a real hi-hat. */
  private openHat?: GainNode;
  private rate = 1;
  constructor(readonly ctx: BaseAudioContext, destination: AudioNode = ctx.destination) {
    this.out = ctx.createGain(); this.out.gain.value = 0.8; this.out.connect(destination);
    this.noise = ctx.createBuffer(1, Math.round(ctx.sampleRate * 1.2), ctx.sampleRate);
    const d = this.noise.getChannelData(0);
    let seed = 20261117;
    for (let i = 0; i < d.length; i++) { seed = (seed * 1664525 + 1013904223) >>> 0; d[i] = seed / 2147483648 - 1; } // the same noise every time, so a pattern always sounds the same
  }
  /** Decode one of the learner's sound files so it can be struck. Throws if the browser cannot read it as sound. */
  async load(id: string, bytes: ArrayBuffer): Promise<number> {
    const buffer = await this.ctx.decodeAudioData(bytes.slice(0));
    this.buffers.set(id, buffer);
    return buffer.duration;
  }
  has(id: string): boolean { return this.buffers.has(id); }
  forget(id: string): void { this.buffers.delete(id); }
  private tone(type: OscillatorType, t: number, from: number, to: number, drop: number, peak: number, decay: number): void {
    const osc = this.ctx.createOscillator(), amp = this.ctx.createGain();
    osc.type = type; osc.frequency.setValueAtTime(from * this.rate, t); osc.frequency.exponentialRampToValueAtTime(Math.max(20, to * this.rate), t + drop);
    amp.gain.setValueAtTime(0.0001, t); amp.gain.linearRampToValueAtTime(peak, t + 0.002); amp.gain.exponentialRampToValueAtTime(0.0001, t + decay);
    osc.connect(amp).connect(this.out); osc.start(t); osc.stop(t + decay + 0.02);
  }
  private hiss(t: number, kind: BiquadFilterType, hz: number, q: number, peak: number, decay: number, attack = 0.001): GainNode {
    const src = this.ctx.createBufferSource(), filter = this.ctx.createBiquadFilter(), amp = this.ctx.createGain();
    src.buffer = this.noise; filter.type = kind; filter.frequency.value = Math.min(18000, hz * this.rate); filter.Q.value = q;
    amp.gain.setValueAtTime(0.0001, t); amp.gain.linearRampToValueAtTime(peak, t + attack); amp.gain.exponentialRampToValueAtTime(0.0001, t + decay);
    src.connect(filter).connect(amp).connect(this.out); src.start(t, (t * 7.3) % 0.5); src.stop(t + decay + 0.02);
    return amp;
  }
  private choke(t: number): void {
    if (!this.openHat) return;
    this.openHat.gain.cancelScheduledValues(t); this.openHat.gain.setTargetAtTime(0.0001, t, 0.008); this.openHat = undefined;
  }
  /** Strike one drum at time `t` (the audio clock's seconds), `strength` 0..1. With `sample`, the learner's own sound is played instead of the built-in drum. */
  hit(voice: Voice, t: number, strength: number, sample?: string, tune = 0): void {
    const v = Math.min(1, Math.max(0, strength));
    if (v <= 0) return;
    this.rate = tuneRate(tune);
    if (voice === "hat") this.choke(t);
    const own = sample ? this.buffers.get(sample) : undefined;
    if (own) {
      const src = this.ctx.createBufferSource(), amp = this.ctx.createGain();
      src.buffer = own; src.playbackRate.value = this.rate; amp.gain.setValueAtTime(v, t);
      src.connect(amp).connect(this.out); src.start(t);
      if (voice === "openhat") this.openHat = amp;
      return;
    }
    switch (voice) {
      case "kick": this.tone("sine", t, 165, 46, 0.1, 0.95 * v, 0.42); this.hiss(t, "lowpass", 2500, 0.5, 0.25 * v, 0.012); break;
      case "snare": this.tone("triangle", t, 210, 170, 0.05, 0.5 * v, 0.14); this.hiss(t, "highpass", 1400, 0.6, 0.6 * v, 0.19); break;
      case "clap": for (const d of [0, 0.011, 0.023]) this.hiss(t + d, "bandpass", 1250, 1.2, 0.5 * v, 0.02); this.hiss(t + 0.034, "bandpass", 1250, 0.9, 0.55 * v, 0.2); break;
      case "hat": this.hiss(t, "highpass", 7500, 0.7, 0.4 * v, 0.05); break;
      case "openhat": this.openHat = this.hiss(t, "highpass", 7000, 0.7, 0.36 * v, 0.34); break;
      case "tomlow": this.tone("sine", t, 135, 82, 0.16, 0.8 * v, 0.34); break;
      case "tomhigh": this.tone("sine", t, 215, 138, 0.14, 0.7 * v, 0.27); break;
      case "rim": this.tone("triangle", t, 830, 800, 0.02, 0.5 * v, 0.035); this.hiss(t, "bandpass", 3200, 2, 0.3 * v, 0.02); break;
    }
  }
}
