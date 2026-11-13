// Web Audio engine for the practice synth. Deliberately small: it renders SynthState and reports what is
// sounding. Built around a shared AudioContext clock and a per-instrument voice list so more instruments
// and a tempo clock (for the later mini DAW) can be added without rewriting it.
import { dbToGain, harmonic, playedHz, type Shape, type SynthState } from "./params";

const HARMONICS = 64;
const RAMP = 0.012; // seconds; short ramps avoid clicks when a value jumps

interface Voice {
  note: number;
  osc: OscillatorNode;
  amp: GainNode;
}

export class Engine {
  readonly ctx: AudioContext;
  readonly analyser: AnalyserNode;
  private readonly master: GainNode;
  private readonly waves = new Map<Shape, PeriodicWave>();
  private voices: Voice[] = [];
  private state: SynthState;

  constructor(state: SynthState, ctx: AudioContext = new AudioContext()) {
    this.ctx = ctx;
    this.state = state;
    this.master = ctx.createGain();
    this.master.gain.value = dbToGain(state.volumeDb);
    // A limiter-style compressor protects ears and speakers if several notes stack up.
    const guard = ctx.createDynamicsCompressor();
    guard.threshold.value = -6;
    guard.ratio.value = 12;
    guard.attack.value = 0.003;
    this.analyser = ctx.createAnalyser();
    this.analyser.fftSize = 4096;
    this.analyser.smoothingTimeConstant = 0.6;
    this.master.connect(guard).connect(this.analyser).connect(ctx.destination);
  }

  /** Browsers only allow sound after a click; call this from one. */
  async start(): Promise<void> {
    if (this.ctx.state !== "running") await this.ctx.resume();
  }
  get running(): boolean {
    return this.ctx.state === "running";
  }

  private wave(shape: Shape): PeriodicWave {
    let w = this.waves.get(shape);
    if (!w) {
      const real = new Float32Array(HARMONICS + 1), imag = new Float32Array(HARMONICS + 1);
      for (let n = 1; n <= HARMONICS; n++) imag[n] = harmonic(shape, n);
      w = this.ctx.createPeriodicWave(real, imag);
      this.waves.set(shape, w);
    }
    return w;
  }

  /** Apply new settings to everything that is sounding. */
  update(next: SynthState): void {
    const t = this.ctx.currentTime;
    const prev = this.state;
    this.state = next;
    if (next.volumeDb !== prev.volumeDb) this.master.gain.setTargetAtTime(dbToGain(next.volumeDb), t, RAMP);
    for (const v of this.voices) {
      if (next.shape !== prev.shape) v.osc.setPeriodicWave(this.wave(next.shape));
      v.osc.frequency.setTargetAtTime(playedHz(next, v.note), t, RAMP);
    }
  }

  noteOn(note: number): void {
    if (this.voices.some((v) => v.note === note)) return;
    const t = this.ctx.currentTime;
    const osc = this.ctx.createOscillator();
    osc.setPeriodicWave(this.wave(this.state.shape));
    osc.frequency.value = playedHz(this.state, note);
    const amp = this.ctx.createGain();
    amp.gain.setValueAtTime(0, t);
    amp.gain.linearRampToValueAtTime(0.5, t + 0.005);
    osc.connect(amp).connect(this.master);
    osc.start(t);
    this.voices.push({ note, osc, amp });
  }

  noteOff(note: number): void {
    const t = this.ctx.currentTime;
    for (const v of this.voices.filter((x) => x.note === note)) {
      v.amp.gain.cancelScheduledValues(t);
      v.amp.gain.setTargetAtTime(0, t, 0.01);
      v.osc.stop(t + 0.08);
    }
    this.voices = this.voices.filter((v) => v.note !== note);
  }

  allNotesOff(): void {
    for (const v of [...this.voices]) this.noteOff(v.note);
  }

  /**
   * Play a short tone that is independent of the learner's settings. Used by demos, ear checks and
   * match-by-ear challenges. `gainDb` is relative to the master volume.
   */
  audition(shape: Shape, hz: number, seconds = 0.9, when = 0, gainDb = -8): void {
    const t = this.ctx.currentTime + when;
    const osc = this.ctx.createOscillator();
    osc.setPeriodicWave(this.wave(shape));
    osc.frequency.value = hz;
    const amp = this.ctx.createGain();
    amp.gain.setValueAtTime(0, t);
    amp.gain.linearRampToValueAtTime(dbToGain(gainDb), t + 0.01);
    amp.gain.setTargetAtTime(0, t + seconds - 0.08, 0.02);
    osc.connect(amp).connect(this.master);
    osc.start(t);
    osc.stop(t + seconds + 0.1);
  }

  get held(): number[] {
    return this.voices.map((v) => v.note);
  }

  /** Peak level of what is playing now, in dB relative to full scale. -Infinity when silent. */
  peakDb(buffer: Float32Array<ArrayBuffer>): number {
    this.analyser.getFloatTimeDomainData(buffer);
    let peak = 0;
    for (let i = 0; i < buffer.length; i++) peak = Math.max(peak, Math.abs(buffer[i]!));
    return peak > 0 ? 20 * Math.log10(peak) : -Infinity;
  }
}
