// Web Audio engine for the practice synth. It renders SynthState and reports what is sounding.
// Built around a shared AudioContext clock and a per-instrument voice list so more instruments and a
// tempo clock (for the later mini DAW) can be added without rewriting it.
import { adsr, isLevel, modDepth, routes, type Route } from "./mod";
import { DRIVE_RANGE, driveCurve, filterStages, resonanceTrim, type Stage } from "./filter";
import { dbToGain, harmonic, harmonicsA, HARMONICS, playedHz, playedHzB, subHz, unisonOffsets, unisonPans, type Shape, type SynthState } from "./params";

const RAMP = 0.012; // seconds; short ramps avoid clicks when a value jumps
const OSC_GAIN = 0.4;

interface Voice {
  note: number;
  /** Start phase of oscillator A for this note, in cycles (includes the random part). */
  phaseA: number;
  a: { osc: OscillatorNode; gain: GainNode; pan: StereoPannerNode }[];
  b?: { osc: OscillatorNode; gain: GainNode };
  sub?: { osc: OscillatorNode; gain: GainNode };
  noise?: { src: AudioBufferSourceNode; gain: GainNode };
  /** Every source feeds `mix`, then drive, then the two filter stages, then the resonance level trim. */
  /** One entry per connected envelope or LFO: its signal, and a depth control feeding the destination. */
  mods: { route: Route; src: OscillatorNode | ConstantSourceNode; depth: GainNode }[];
  filter: { mix: GainNode; shaper: WaveShaperNode; one: BiquadFilterNode; two: BiquadFilterNode; trim: GainNode; drive: number };
  amp: GainNode;
}

/** Settings whose change means rebuilding the sounding notes (the set of sound sources changes). */
const STRUCTURAL: (keyof SynthState)[] = ["voices", "bOn", "subOn", "noiseOn", "noiseType", "randomPhase", "env2Dest", "lfo1Dest", "lfo2Dest", "lfo3Dest"];
const LFO_TYPE = { sine: "sine", triangle: "triangle", saw: "sawtooth", square: "square" } as const;
/** Stop changing a value from `t` on, keeping whatever it has reached (older browsers: drop what was planned). */
const holdAt = (p: AudioParam, t: number) => (p.cancelAndHoldAtTime ? p.cancelAndHoldAtTime(t) : p.cancelScheduledValues(t));

export class Engine {
  readonly ctx: AudioContext;
  readonly analyser: AnalyserNode;
  private readonly master: GainNode;
  private voices: Voice[] = [];
  private state: SynthState;
  private noiseBuffers: Partial<Record<"white" | "pink", AudioBuffer>> = {};
  private curve: { drive: number; data: Float32Array<ArrayBuffer> } | undefined;

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

  /**
   * A periodic wave from harmonic amplitudes, started `phase` cycles into its period. Shifting a wave in
   * time rotates harmonic n by n times the shift, which is why a half-cycle shift cancels a square against
   * itself but turns two saws into one an octave up.
   */
  private wave(h: Float32Array, phase: number): PeriodicWave {
    const real = new Float32Array(h.length), imag = new Float32Array(h.length);
    for (let n = 1; n < h.length; n++) {
      const angle = 2 * Math.PI * n * phase;
      real[n] = h[n]! * Math.sin(angle);
      imag[n] = h[n]! * Math.cos(angle);
    }
    return this.ctx.createPeriodicWave(real, imag);
  }
  private shapeHarmonics(shape: Shape): Float32Array {
    const h = new Float32Array(HARMONICS + 1);
    for (let n = 1; n <= HARMONICS; n++) h[n] = harmonic(shape, n);
    return h;
  }

  private noiseBuffer(type: "white" | "pink"): AudioBuffer {
    let buf = this.noiseBuffers[type];
    if (!buf) {
      const len = this.ctx.sampleRate * 2;
      buf = this.ctx.createBuffer(1, len, this.ctx.sampleRate);
      const d = buf.getChannelData(0);
      // Pink noise: white noise through a standard set of one-pole filters (equal energy per octave).
      let b0 = 0, b1 = 0, b2 = 0, b3 = 0, b4 = 0, b5 = 0, b6 = 0;
      for (let i = 0; i < len; i++) {
        const w = Math.random() * 2 - 1;
        if (type === "white") { d[i] = w * 0.5; continue; }
        b0 = 0.99886 * b0 + w * 0.0555179; b1 = 0.99332 * b1 + w * 0.0750759; b2 = 0.969 * b2 + w * 0.153852;
        b3 = 0.8665 * b3 + w * 0.3104856; b4 = 0.55 * b4 + w * 0.5329522; b5 = -0.7616 * b5 - w * 0.016898;
        d[i] = (b0 + b1 + b2 + b3 + b4 + b5 + b6 + w * 0.5362) * 0.11;
        b6 = w * 0.115926;
      }
      this.noiseBuffers[type] = buf;
    }
    return buf;
  }

  /** The drive curve for these settings. Drive belongs to the filter: with the filter off it does nothing. */
  private driveFor(s: SynthState): { drive: number; data: Float32Array<ArrayBuffer> } {
    const drive = s.filterOn ? s.drive : 0;
    if (this.curve?.drive !== drive) this.curve = { drive, data: driveCurve(drive) };
    return this.curve;
  }

  private setStage(node: BiquadFilterNode, stage: Stage, t: number, jump: boolean): void {
    if (node.type !== stage.type) node.type = stage.type;
    // The browser reads Q in decibels for low-pass and high-pass, and as a plain number for the others.
    const q = stage.type === "lowpass" || stage.type === "highpass" ? 20 * Math.log10(stage.q) : stage.q;
    if (jump) { node.frequency.setValueAtTime(stage.hz, t); node.Q.setValueAtTime(q, t); }
    else { node.frequency.setTargetAtTime(stage.hz, t, RAMP); node.Q.setTargetAtTime(q, t, RAMP); }
  }

  /** Make one note's drive and filter match the settings. `jump` sets values at once (for a new note). */
  private applyFilter(v: Voice, s: SynthState, jump: boolean, t = this.ctx.currentTime): void {
    const f = v.filter;
    const curve = this.driveFor(s);
    if (f.drive !== curve.drive) {
      f.drive = curve.drive;
      f.shaper.curve = null;
      f.shaper.curve = curve.data;
      f.shaper.oversample = curve.drive > 0 ? "4x" : "none";
    }
    const [one, two] = filterStages(s, v.note, this.ctx.sampleRate);
    this.setStage(f.one, one, t, jump);
    this.setStage(f.two, two, t, jump);
    if (jump) f.trim.gain.setValueAtTime(resonanceTrim(s), t);
    else f.trim.gain.setTargetAtTime(resonanceTrim(s), t, RAMP);
  }

  /** The level that a route's destination is set to, for scaling level modulation. */
  private baseLevel(s: SynthState, dest: Route["dest"]): number {
    return dest === "aLevelDb" ? (OSC_GAIN / Math.sqrt(s.voices)) * dbToGain(s.aLevelDb) : dest === "bLevelDb" ? OSC_GAIN * dbToGain(s.bLevelDb)
      : dest === "subLevelDb" ? OSC_GAIN * dbToGain(s.subLevelDb) : dest === "noiseLevelDb" ? dbToGain(s.noiseLevelDb) : 1;
  }
  private depthOf(s: SynthState, r: Route): number {
    return modDepth(r.dest, r.amount) * (isLevel(r.dest) ? this.baseLevel(s, r.dest) : 1);
  }
  /** The audio settings a destination stands for on one note. */
  private targets(v: Voice, dest: Route["dest"]): AudioParam[] {
    switch (dest) {
      case "cutoff": return [v.filter.one.detune, v.filter.two.detune];
      case "fine": return v.a.map((x) => x.osc.detune);
      case "bFine": return v.b ? [v.b.osc.detune] : [];
      case "aLevelDb": return v.a.map((x) => x.gain.gain);
      case "bLevelDb": return v.b ? [v.b.gain.gain] : [];
      case "subLevelDb": return v.sub ? [v.sub.gain.gain] : [];
      case "noiseLevelDb": return v.noise ? [v.noise.gain.gain] : [];
    }
  }
  /** Start this note's connected envelopes and LFOs at time `t`. LFOs restart with each note. */
  private buildMods(v: Voice, s: SynthState, t: number): void {
    for (const route of routes(s)) {
      let src: OscillatorNode | ConstantSourceNode;
      if (route.source.kind === "lfo") {
        const id = route.source.id as "lfo1" | "lfo2" | "lfo3";
        src = this.ctx.createOscillator();
        src.type = LFO_TYPE[s[`${id}Shape`]];
        src.frequency.value = s[`${id}Rate`];
      } else {
        const e = adsr(s, 2);
        src = this.ctx.createConstantSource();
        src.offset.setValueAtTime(0, t);
        src.offset.linearRampToValueAtTime(1, t + e.attack);
        src.offset.setTargetAtTime(e.sustain, t + e.attack, Math.max(0.001, e.decay / 4));
      }
      const depth = this.ctx.createGain();
      depth.gain.value = this.depthOf(s, route);
      src.connect(depth);
      for (const p of this.targets(v, route.dest)) depth.connect(p);
      src.start(t);
      v.mods.push({ route, src, depth });
    }
  }

  /** Let a note go at time `t`: envelope 1's release fades it, then everything stops. */
  private releaseAt(v: Voice, s: SynthState, t: number): void {
    const release = adsr(s, 1).release, tc = Math.max(0.003, release / 4);
    holdAt(v.amp.gain, t);
    v.amp.gain.setTargetAtTime(0, t, tc);
    for (const m of v.mods) if (m.src instanceof ConstantSourceNode) { holdAt(m.src.offset, t); m.src.offset.setTargetAtTime(0, t, Math.max(0.003, adsr(s, 2).release / 4)); }
    const stopAt = t + tc * 7 + 0.03;
    for (const x of v.a) x.osc.stop(stopAt);
    v.b?.osc.stop(stopAt);
    v.sub?.osc.stop(stopAt);
    v.noise?.src.stop(stopAt);
    for (const m of v.mods) m.src.stop(stopAt);
  }

  private build(note: number, phaseA: number, t = this.ctx.currentTime): Voice {
    const s = this.state;
    const amp = this.ctx.createGain();
    // Envelope 1: a straight rise over the attack, then easing down to the sustain level.
    const env = adsr(s, 1);
    amp.gain.setValueAtTime(0, t);
    amp.gain.linearRampToValueAtTime(1, t + env.attack);
    if (env.sustain < 1) amp.gain.setTargetAtTime(env.sustain, t + env.attack, Math.max(0.001, env.decay / 4));
    amp.connect(this.master);
    const filter = { mix: this.ctx.createGain(), shaper: this.ctx.createWaveShaper(), one: this.ctx.createBiquadFilter(), two: this.ctx.createBiquadFilter(), trim: this.ctx.createGain(), drive: -1 };
    filter.mix.gain.value = 1 / DRIVE_RANGE; // the shaper's curve covers inputs of -1..1
    filter.mix.connect(filter.shaper).connect(filter.one).connect(filter.two).connect(filter.trim).connect(amp);
    const into = filter.mix;

    const offsets = unisonOffsets(s.voices, s.detune), pans = unisonPans(s.voices, s.spread);
    const base = playedHz(s, note), hA = harmonicsA(s);
    const a = offsets.map((cents, i) => {
      const osc = this.ctx.createOscillator();
      // The centre voice keeps the set phase; the others start elsewhere so a stack does not begin as one spike.
      osc.setPeriodicWave(this.wave(hA, phaseA + (s.voices > 1 ? i / s.voices : 0)));
      osc.frequency.value = base * 2 ** (cents / 1200);
      const gain = this.ctx.createGain();
      gain.gain.value = (OSC_GAIN / Math.sqrt(s.voices)) * dbToGain(s.aLevelDb);
      const pan = this.ctx.createStereoPanner();
      pan.pan.value = pans[i]!;
      osc.connect(gain).connect(pan).connect(into);
      osc.start(t);
      return { osc, gain, pan };
    });

    const voice: Voice = { note, phaseA, a, mods: [], filter, amp };
    this.applyFilter(voice, s, true, t);
    if (s.bOn) {
      const osc = this.ctx.createOscillator();
      osc.setPeriodicWave(this.wave(this.shapeHarmonics(s.bShape), s.bPhase / 360));
      osc.frequency.value = playedHzB(s, note);
      const gain = this.ctx.createGain();
      gain.gain.value = OSC_GAIN * dbToGain(s.bLevelDb);
      osc.connect(gain).connect(into);
      osc.start(t);
      voice.b = { osc, gain };
    }
    if (s.subOn) {
      const osc = this.ctx.createOscillator();
      osc.type = "sine";
      osc.frequency.value = subHz(s, note);
      const gain = this.ctx.createGain();
      gain.gain.value = OSC_GAIN * dbToGain(s.subLevelDb);
      osc.connect(gain).connect(into);
      osc.start(t);
      voice.sub = { osc, gain };
    }
    if (s.noiseOn) {
      const src = this.ctx.createBufferSource();
      src.buffer = this.noiseBuffer(s.noiseType);
      src.loop = true;
      const gain = this.ctx.createGain();
      gain.gain.value = dbToGain(s.noiseLevelDb);
      src.connect(gain).connect(into);
      src.start(t, Math.random());
      voice.noise = { src, gain };
    }
    this.buildMods(voice, s, t);
    return voice;
  }

  private release(v: Voice): void {
    this.releaseAt(v, this.state, this.ctx.currentTime);
  }

  /** Apply new settings to everything that is sounding. */
  update(next: SynthState): void {
    const t = this.ctx.currentTime, prev = this.state;
    this.state = next;
    if (next.volumeDb !== prev.volumeDb) this.master.gain.setTargetAtTime(dbToGain(next.volumeDb), t, RAMP);
    if (STRUCTURAL.some((k) => next[k] !== prev[k])) {
      // The set of sources changed: restart the sounding notes with the new layout.
      const notes = this.voices.map((v) => v.note);
      this.voices.forEach((v) => this.release(v));
      this.voices = notes.map((n) => this.build(n, this.startPhase()));
      return;
    }
    const waveA = next.shape !== prev.shape || next.table !== prev.table || next.position !== prev.position || next.phase !== prev.phase;
    const hA = waveA ? harmonicsA(next) : undefined;
    const offsets = unisonOffsets(next.voices, next.detune), pans = unisonPans(next.voices, next.spread);
    for (const v of this.voices) {
      this.applyFilter(v, next, false);
      for (const m of v.mods) {
        // amounts and LFO settings follow the controls; a changed destination rebuilds the note (see STRUCTURAL)
        const route = routes(next).find((r) => r.source.id === m.route.source.id);
        if (!route) continue;
        m.route = route;
        m.depth.gain.setTargetAtTime(this.depthOf(next, route), t, RAMP);
        if (m.src instanceof OscillatorNode) {
          const id = route.source.id as "lfo1" | "lfo2" | "lfo3";
          if (m.src.type !== LFO_TYPE[next[`${id}Shape`]]) m.src.type = LFO_TYPE[next[`${id}Shape`]];
          m.src.frequency.setTargetAtTime(next[`${id}Rate`], t, RAMP);
        }
      }
      if (next.phase !== prev.phase) v.phaseA += (next.phase - prev.phase) / 360;
      const base = playedHz(next, v.note);
      v.a.forEach((x, i) => {
        if (hA) x.osc.setPeriodicWave(this.wave(hA, v.phaseA + (next.voices > 1 ? i / next.voices : 0)));
        x.osc.frequency.setTargetAtTime(base * 2 ** (offsets[i]! / 1200), t, RAMP);
        x.pan.pan.setTargetAtTime(pans[i]!, t, RAMP);
        if (next.aLevelDb !== prev.aLevelDb) x.gain.gain.setTargetAtTime((OSC_GAIN / Math.sqrt(next.voices)) * dbToGain(next.aLevelDb), t, RAMP);
      });
      if (v.b) {
        if (next.bShape !== prev.bShape || next.bPhase !== prev.bPhase) v.b.osc.setPeriodicWave(this.wave(this.shapeHarmonics(next.bShape), next.bPhase / 360));
        v.b.osc.frequency.setTargetAtTime(playedHzB(next, v.note), t, RAMP);
        v.b.gain.gain.setTargetAtTime(OSC_GAIN * dbToGain(next.bLevelDb), t, RAMP);
      }
      if (v.sub) {
        v.sub.osc.frequency.setTargetAtTime(subHz(next, v.note), t, RAMP);
        v.sub.gain.gain.setTargetAtTime(OSC_GAIN * dbToGain(next.subLevelDb), t, RAMP);
      }
      if (v.noise) v.noise.gain.gain.setTargetAtTime(dbToGain(next.noiseLevelDb), t, RAMP);
    }
  }

  private startPhase(): number {
    return this.state.phase / 360 + Math.random() * (this.state.randomPhase / 100);
  }

  noteOn(note: number): void {
    if (this.voices.some((v) => v.note === note)) return;
    this.voices.push(this.build(note, this.startPhase()));
  }

  noteOff(note: number): void {
    this.voices.filter((v) => v.note === note).forEach((v) => this.release(v));
    this.voices = this.voices.filter((v) => v.note !== note);
  }

  allNotesOff(): void {
    for (const v of [...this.voices]) this.noteOff(v.note);
  }

  /**
   * Play a short sound that is independent of what the learner is holding. Used by demos, ear checks and
   * match-by-ear. Give either a basic shape and frequency, or a whole settings object and a key.
   */
  audition(shape: Shape, hz: number, seconds = 0.9, when = 0, gainDb = -8): void {
    const t = this.ctx.currentTime + when;
    const osc = this.ctx.createOscillator();
    osc.setPeriodicWave(this.wave(this.shapeHarmonics(shape), 0));
    osc.frequency.value = hz;
    const amp = this.ctx.createGain();
    amp.gain.setValueAtTime(0, t);
    amp.gain.linearRampToValueAtTime(dbToGain(gainDb), t + 0.01);
    amp.gain.setTargetAtTime(0, t + seconds - 0.08, 0.02);
    osc.connect(amp).connect(this.master);
    osc.start(t);
    osc.stop(t + seconds + 0.1);
  }

  /** Play a whole patch for a moment, without disturbing held notes or the learner's settings. */
  auditionPatch(patch: SynthState, note: number, seconds = 1.2, when = 0): void {
    const keep = this.state, at = this.ctx.currentTime + when;
    this.state = patch;
    const v = this.build(note, patch.phase / 360, at);
    this.state = keep;
    this.releaseAt(v, patch, at + seconds - 0.08);
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
