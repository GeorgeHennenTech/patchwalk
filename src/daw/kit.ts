// The drum kit. A pad is either built in (made from oscillators and noise by the browser at the moment it
// is struck: nothing recorded, so nothing here is anybody else's sound) or one of the learner's own sound
// files, decoded once and played back from a chosen start, for a chosen length, with a fade.
import { padWindow, tuneRate, type Pad } from "./drums";

export class Kit {
  readonly out: GainNode;
  private noise: AudioBuffer;
  private buffers = new Map<string, AudioBuffer>();
  /** What is still ringing in each choke group, so the next pad of that group can cut it off. */
  private ringing = new Map<string, GainNode[]>();
  private rate = 1;
  /** For the built-in drum being struck: how long it rings against its usual length, and how far its filters are moved. */
  private ring = 1;
  private bright = 1;
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
  /** The decoded sound of a stored file, for the sampler; nothing when it is not loaded. */
  buffer(id: string): AudioBuffer | undefined { return this.buffers.get(id); }
  forget(id: string): void { this.buffers.delete(id); }
  /** A sound file's length in seconds, or 0 when it is not loaded. */
  seconds(id: string): number { return this.buffers.get(id)?.duration ?? 0; }
  /** The loudest point in each of `n` slices of a sound file, 0 to 1, for drawing it. */
  peaks(id: string, n = 240): number[] {
    const b = this.buffers.get(id);
    if (!b) return [];
    const d = b.getChannelData(0), size = Math.max(1, Math.floor(d.length / n)), out: number[] = [];
    for (let i = 0; i < n; i++) { let m = 0; for (let j = i * size, end = Math.min(d.length, j + size); j < end; j += Math.max(1, Math.floor(size / 64))) m = Math.max(m, Math.abs(d[j]!)); out.push(m); }
    const top = Math.max(...out, 1e-6);
    return out.map((v) => v / top);
  }
  private tone(to: AudioNode, type: OscillatorType, t: number, from: number, down: number, drop: number, peak: number, decay: number): void {
    const osc = this.ctx.createOscillator(), amp = this.ctx.createGain();
    osc.type = type; osc.frequency.setValueAtTime(from * this.rate, t); osc.frequency.exponentialRampToValueAtTime(Math.max(20, down * this.rate), t + drop);
    amp.gain.setValueAtTime(0.0001, t); amp.gain.linearRampToValueAtTime(peak, t + 0.002); amp.gain.exponentialRampToValueAtTime(0.0001, t + decay * this.ring);
    osc.connect(amp).connect(to); osc.start(t); osc.stop(t + decay * this.ring + 0.02);
  }
  private hiss(to: AudioNode, t: number, kind: BiquadFilterType, hz: number, q: number, peak: number, decay: number): void {
    const src = this.ctx.createBufferSource(), filter = this.ctx.createBiquadFilter(), amp = this.ctx.createGain();
    src.buffer = this.noise; filter.type = kind; filter.frequency.value = Math.min(18000, Math.max(60, hz * this.rate * this.bright)); filter.Q.value = q;
    amp.gain.setValueAtTime(0.0001, t); amp.gain.linearRampToValueAtTime(peak, t + 0.001); amp.gain.exponentialRampToValueAtTime(0.0001, t + decay * this.ring);
    src.connect(filter).connect(amp).connect(to); src.loop = true; src.start(t, (t * 7.3) % 0.5); src.stop(t + decay * this.ring + 0.02);
  }
  /** A cymbal's ring: six square waves at ratios that do not line up, with the low part taken off. The ratios and every number are our own. */
  private metal(to: AudioNode, t: number, base: number, floorHz: number, peak: number, decay: number): void {
    const cut = this.ctx.createBiquadFilter(), amp = this.ctx.createGain();
    cut.type = "highpass"; cut.frequency.value = Math.min(16000, Math.max(60, floorHz * this.rate * this.bright)); cut.Q.value = 0.8;
    amp.gain.setValueAtTime(0.0001, t); amp.gain.linearRampToValueAtTime(peak, t + 0.002); amp.gain.exponentialRampToValueAtTime(peak * 0.35, t + decay * this.ring * 0.12); amp.gain.exponentialRampToValueAtTime(0.0001, t + decay * this.ring);
    cut.connect(amp).connect(to);
    for (const ratio of [1, 1.483, 1.764, 2.317, 2.891, 3.469]) { const osc = this.ctx.createOscillator(); osc.type = "square"; osc.frequency.value = base * ratio * this.rate; osc.connect(cut); osc.start(t); osc.stop(t + decay * this.ring + 0.02); }
  }
  /** The metronome's click: higher on the first beat of a bar. */
  tick(t: number, first: boolean): void { this.rate = 1; this.tone(this.out, "sine", t, first ? 1760 : 1175, first ? 1760 : 1175, 0.02, 0.22, 0.03); }
  /**
   * Strike a pad at time `t` (the audio clock's seconds), `strength` 0..1, into `to`. `scope` keeps one
   * track's choke groups apart from another's.
   */
  hit(pad: Pad, t: number, strength: number, to: AudioNode = this.out, scope = ""): void {
    const v = Math.min(1, Math.max(0, strength));
    if (v <= 0) return;
    this.rate = tuneRate(pad.tune); this.ring = (pad.decay ?? 100) / 100; this.bright = 2 ** (((pad.tone ?? 0) / 100) * 1.5);
    const bus = this.ctx.createGain();
    if (pad.pan) { const pan = this.ctx.createStereoPanner(); pan.pan.value = pad.pan / 100; bus.connect(pan).connect(to); } else bus.connect(to);
    if (pad.choke) {
      const key = `${scope}:${pad.choke}`;
      for (const g of this.ringing.get(key) ?? []) { g.gain.cancelScheduledValues(t); g.gain.setTargetAtTime(0.0001, t, 0.008); }
      this.ringing.set(key, [bus]);
    }
    const own = pad.sample ? this.buffers.get(pad.sample) : undefined;
    if (own) {
      const src = this.ctx.createBufferSource(), amp = this.ctx.createGain(), w = padWindow(pad, own.duration);
      const lasts = w.span / this.rate, fade = Math.max(pad.length < 100 ? 0.004 : 0, w.fade / this.rate);
      src.buffer = own; src.playbackRate.value = this.rate; amp.gain.setValueAtTime(v, t);
      if (fade > 0) { amp.gain.setValueAtTime(v, t + Math.max(0, lasts - fade)); amp.gain.linearRampToValueAtTime(0, t + lasts); }
      src.connect(amp).connect(bus); src.start(t, w.offset, w.span);
      return;
    }
    switch (pad.voice) {
      case "kick": this.tone(bus, "sine", t, 165, 46, 0.1, 0.95 * v, 0.42); this.hiss(bus, t, "lowpass", 2500, 0.5, 0.25 * v, 0.012); break;
      case "snare": this.tone(bus, "triangle", t, 210, 170, 0.05, 0.5 * v, 0.14); this.hiss(bus, t, "highpass", 1400, 0.6, 0.6 * v, 0.19); break;
      case "clap": for (const d of [0, 0.011, 0.023]) this.hiss(bus, t + d, "bandpass", 1250, 1.2, 0.5 * v, 0.02); this.hiss(bus, t + 0.034, "bandpass", 1250, 0.9, 0.55 * v, 0.2); break;
      case "hat": this.hiss(bus, t, "highpass", 7500, 0.7, 0.4 * v, 0.05); break;
      case "openhat": this.hiss(bus, t, "highpass", 7000, 0.7, 0.36 * v, 0.34); break;
      case "tomlow": this.tone(bus, "sine", t, 135, 82, 0.16, 0.8 * v, 0.34); break;
      case "tomhigh": this.tone(bus, "sine", t, 215, 138, 0.14, 0.7 * v, 0.27); break;
      case "ride": this.metal(bus, t, 412, 4200, 0.075 * v, 1.3); this.hiss(bus, t, "bandpass", 6200, 1.5, 0.22 * v, 0.03); break;
      case "ridebell": this.metal(bus, t, 412, 1500, 0.06 * v, 0.9); this.tone(bus, "sine", t, 1180, 1180, 0.05, 0.3 * v, 0.55); this.tone(bus, "sine", t, 1770, 1770, 0.05, 0.16 * v, 0.4); break;
      case "crash": this.metal(bus, t, 337, 2600, 0.085 * v, 2.2); this.hiss(bus, t, "highpass", 5000, 0.5, 0.32 * v, 1.1); break;
      case "shaker": this.hiss(bus, t, "bandpass", 6800, 1.1, 0.34 * v, 0.07); break;
      case "tambourine": this.metal(bus, t, 1190, 6000, 0.05 * v, 0.22); this.hiss(bus, t, "highpass", 8000, 0.7, 0.3 * v, 0.12); break;
      case "cowbell": this.tone(bus, "square", t, 562, 562, 0.05, 0.2 * v, 0.32); this.tone(bus, "square", t, 845, 845, 0.05, 0.16 * v, 0.28); break;
      case "clave": this.tone(bus, "sine", t, 2500, 2450, 0.02, 0.6 * v, 0.045); break;
      case "snap": this.hiss(bus, t, "bandpass", 2300, 3, 0.7 * v, 0.03); this.hiss(bus, t + 0.012, "bandpass", 1700, 2, 0.45 * v, 0.07); break;
      case "sub": this.tone(bus, "sine", t, 150, 44, 0.07, 0.95 * v, 1.1); this.hiss(bus, t, "lowpass", 1800, 0.5, 0.2 * v, 0.01); break;
      case "congahigh": this.tone(bus, "sine", t, 420, 330, 0.04, 0.7 * v, 0.2); this.hiss(bus, t, "bandpass", 1900, 1.5, 0.25 * v, 0.02); break;
      case "congalow": this.tone(bus, "sine", t, 280, 215, 0.05, 0.75 * v, 0.28); this.hiss(bus, t, "bandpass", 1300, 1.5, 0.22 * v, 0.02); break;
      case "rim": this.tone(bus, "triangle", t, 830, 800, 0.02, 0.5 * v, 0.035); this.hiss(bus, t, "bandpass", 3200, 2, 0.3 * v, 0.02); break;
    }
  }
}
