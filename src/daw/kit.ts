// The drum kit: every drum is made from oscillators and noise by the browser, at the moment it is struck.
// There are no samples and nothing recorded, so nothing here is anybody else's sound.
import type { Voice } from "./drums";

export class Kit {
  readonly out: GainNode;
  private noise: AudioBuffer;
  /** The open hat that is still ringing, so a closed hat can cut it short, as on a real hi-hat. */
  private openHat?: GainNode;
  constructor(readonly ctx: BaseAudioContext, destination: AudioNode = ctx.destination) {
    this.out = ctx.createGain(); this.out.gain.value = 0.8; this.out.connect(destination);
    this.noise = ctx.createBuffer(1, Math.round(ctx.sampleRate * 1.2), ctx.sampleRate);
    const d = this.noise.getChannelData(0);
    let seed = 20261117;
    for (let i = 0; i < d.length; i++) { seed = (seed * 1664525 + 1013904223) >>> 0; d[i] = seed / 2147483648 - 1; } // the same noise every time, so a pattern always sounds the same
  }
  private tone(type: OscillatorType, t: number, from: number, to: number, drop: number, peak: number, decay: number): void {
    const osc = this.ctx.createOscillator(), amp = this.ctx.createGain();
    osc.type = type; osc.frequency.setValueAtTime(from, t); osc.frequency.exponentialRampToValueAtTime(Math.max(20, to), t + drop);
    amp.gain.setValueAtTime(0.0001, t); amp.gain.linearRampToValueAtTime(peak, t + 0.002); amp.gain.exponentialRampToValueAtTime(0.0001, t + decay);
    osc.connect(amp).connect(this.out); osc.start(t); osc.stop(t + decay + 0.02);
  }
  private hiss(t: number, kind: BiquadFilterType, hz: number, q: number, peak: number, decay: number, attack = 0.001): GainNode {
    const src = this.ctx.createBufferSource(), filter = this.ctx.createBiquadFilter(), amp = this.ctx.createGain();
    src.buffer = this.noise; filter.type = kind; filter.frequency.value = hz; filter.Q.value = q;
    amp.gain.setValueAtTime(0.0001, t); amp.gain.linearRampToValueAtTime(peak, t + attack); amp.gain.exponentialRampToValueAtTime(0.0001, t + decay);
    src.connect(filter).connect(amp).connect(this.out); src.start(t, (t * 7.3) % 0.5); src.stop(t + decay + 0.02);
    return amp;
  }
  /** Strike one drum at time `t` (the audio clock's seconds), `strength` 0..1. */
  hit(voice: Voice, t: number, strength: number): void {
    const v = Math.min(1, Math.max(0, strength));
    if (v <= 0) return;
    switch (voice) {
      case "kick": this.tone("sine", t, 165, 46, 0.1, 0.95 * v, 0.42); this.hiss(t, "lowpass", 2500, 0.5, 0.25 * v, 0.012); break;
      case "snare": this.tone("triangle", t, 210, 170, 0.05, 0.5 * v, 0.14); this.hiss(t, "highpass", 1400, 0.6, 0.6 * v, 0.19); break;
      case "clap": for (const d of [0, 0.011, 0.023]) this.hiss(t + d, "bandpass", 1250, 1.2, 0.5 * v, 0.02); this.hiss(t + 0.034, "bandpass", 1250, 0.9, 0.55 * v, 0.2); break;
      case "hat": if (this.openHat) { this.openHat.gain.cancelScheduledValues(t); this.openHat.gain.setTargetAtTime(0.0001, t, 0.008); this.openHat = undefined; } this.hiss(t, "highpass", 7500, 0.7, 0.4 * v, 0.05); break;
      case "openhat": this.openHat = this.hiss(t, "highpass", 7000, 0.7, 0.36 * v, 0.34); break;
      case "tomlow": this.tone("sine", t, 135, 82, 0.16, 0.8 * v, 0.34); break;
      case "tomhigh": this.tone("sine", t, 215, 138, 0.14, 0.7 * v, 0.27); break;
      case "rim": this.tone("triangle", t, 830, 800, 0.02, 0.5 * v, 0.035); this.hiss(t, "bandpass", 3200, 2, 0.3 * v, 0.02); break;
    }
  }
}
