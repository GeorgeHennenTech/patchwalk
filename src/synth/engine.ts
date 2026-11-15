// Web Audio engine for the practice synth. It renders SynthState and reports what is sounding.
// Built around a shared AudioContext clock and a per-instrument voice list so more instruments and a
// tempo clock (for the later mini DAW) can be added without rewriting it.
import { applyMacros } from "./macros";
import { adsr, fallConstant, isLevel, keyValue, lfoCoefficients, lfoHz, lfoStartPhase, modDepth, noteLevelBase, routeLayout, routes, slowModulate, velocityValue, type Adsr, type Route } from "./mod";
import { FxChain } from "./fx";
import { DRIVE_RANGE, driveCurve, filter2Stage, filterStages, resonanceTrim, sideBySide, type Stage } from "./filter";
import { dbToGain, isDrawn, fmIndex, FM_MAX_INDEX, harmonic, spectrumA, HARMONICS, playedHz, playedHzB, subHz, unisonOffsets, unisonPans, type Shape, type SynthState, spectrumB } from "./params";

const RAMP = 0.012; // seconds; short ramps avoid clicks when a value jumps
const OSC_GAIN = 0.4;

interface Voice {
  note: number;
  /** Start phase of oscillator A for this note, in cycles (includes the random part). */
  phaseA: number;
  /** How hard the note was struck, 1 to 127. */
  velocity: number;
  /** Audio-clock times the note started and (once let go) was released: what control-rate modulation follows. */
  startedAt: number; releasedAt?: number;
  /** The whole note's level, after the envelope: where "Note level" routes land. */
  out: GainNode;
  a: { osc: OscillatorNode; gain: GainNode; pan: StereoPannerNode }[];
  /** Oscillator B's voices: one, or several spread in pitch and across the two sides. */
  b?: { osc: OscillatorNode; gain: GainNode; pan: StereoPannerNode }[];
  /**
   * A silent copy of oscillator B that every note has, whether or not B is heard. `fm` scales it into a
   * swing of A's frequency; `wet` is A multiplied by it (ring modulation) and `dry` is A left alone.
   */
  modB: { osc: OscillatorNode; fm: GainNode; dry: GainNode; wet: GainNode };
  sub?: { osc: OscillatorNode; gain: GainNode };
  noise?: { src: AudioBufferSourceNode; gain: GainNode };
  /** Every source feeds `mix`, then drive, then the two filter stages, then the resonance level trim. */
  /** One entry per connected envelope or LFO: its signal, and a depth control feeding the destination. */
  mods: { route: Route; src: OscillatorNode | ConstantSourceNode; depth: GainNode; bias: ConstantSourceNode; fade: GainNode; phase: number; /** where it leaves from: `fade`, or the gate of a scaling source */ out: GainNode; aux?: { src: OscillatorNode | ConstantSourceNode; phase: number; gate: GainNode } }[];
  filter: { mix: GainNode; shaper: WaveShaperNode; one: BiquadFilterNode; two: BiquadFilterNode; trim: GainNode; drive: number; three: BiquadFilterNode; after: GainNode; beside: GainNode; past: GainNode };
  amp: GainNode;
  /** A pitch offset in cents that every oscillator of the note follows: it starts at the distance from the previous note and runs down to nothing, which is the slide. */
  glide: ConstantSourceNode;
}

/** Settings whose change means rebuilding the sounding notes (the set of sound sources changes). */
const STRUCTURAL: (keyof SynthState)[] = ["voiceMode", "voices", "bVoices", "bOn", "subOn", "noiseOn", "noiseType", "randomPhase", "env2Dest", "lfo1Dest", "lfo2Dest", "lfo3Dest", "velDest", "keyDest", "wheelDest", "lfo1Trig", "lfo2Trig", "lfo3Trig"];
/** Stop changing a value from `t` on, keeping whatever it has reached (older browsers: drop what was planned). */
/** Cancel a slide: the pitch goes straight to the note. */
const holdAtZero = (p: AudioParam, t: number) => { p.cancelScheduledValues(t); p.setValueAtTime(0, t); };
/** A unison voice's place between the speakers, moved by the oscillator's own pan and kept within the two sides. */
/** How far oscillator B's unison voices are spread across the two sides (it has no knob of its own). */
const B_SPREAD = 70;
/** Where in its cycle each of B's unison voices starts: spread over half a cycle, so they neither pile up into one loud start nor cancel each other out when the detune is zero. */
const bStart = (i: number, voices: number) => (voices > 1 ? i / (2 * voices) : 0);
const panOf = (spread: number, pan: number) => Math.min(1, Math.max(-1, spread + pan / 100));
const holdAt = (p: AudioParam, t: number) => (p.cancelAndHoldAtTime ? p.cancelAndHoldAtTime(t) : p.cancelScheduledValues(t));

export class Engine {
  readonly ctx: AudioContext;
  readonly analyser: AnalyserNode;
  private readonly master: GainNode;
  /** The effects rack: every note goes in here, and it feeds the main volume. */
  readonly fx: FxChain;
  private fxRestore: ReturnType<typeof setTimeout> | undefined;
  private voices: Voice[] = [];
  /** The settings being played right now: after macros and after control-rate modulation. */
  private state: SynthState;
  /** The settings after macros, before control-rate modulation: what `state` is worked out from. */
  private base: SynthState;
  private slowTimer: ReturnType<typeof setInterval> | undefined;
  /** A sound being auditioned (a demo or a target), with its own settings, kept moving like a held note. */
  private auditions: { voice: Voice; base: SynthState; played: SynthState; until: number }[] = [];
  private noiseBuffers: Partial<Record<"white" | "pink", AudioBuffer>> = {};
  private lfoCache: ({ shape: SynthState["lfo1Shape"]; steps: number[] } & ReturnType<typeof lfoCoefficients>) | undefined;
  private clickTimer: ReturnType<typeof setInterval> | undefined;
  private clickNext = 0;
  /** The metronome goes straight to the speakers through this, so the scope and meter show only the synth. */
  readonly clickBus: GainNode;
  private curve: { drive: number; data: Float32Array<ArrayBuffer> } | undefined;

  constructor(state: SynthState, ctx: AudioContext = new AudioContext()) {
    this.ctx = ctx;
    this.base = applyMacros(state);
    this.state = this.base;
    this.clickBus = ctx.createGain();
    this.clickBus.gain.value = 0.25;
    this.clickBus.connect(ctx.destination);
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
    this.fx = new FxChain(ctx, this.state);
    this.fx.output.connect(this.master);
  }

  /** Browsers only allow sound after a click; call this from one. */
  async start(): Promise<void> {
    if (this.ctx.state !== "running") await this.ctx.resume();
    this.syncClick(this.state);
    // Control-rate modulation: about fifty times a second, knobs that sources move by code are brought up to date.
    this.slowTimer ??= setInterval(() => this.tick(), 20);
  }
  get running(): boolean {
    return this.ctx.state === "running";
  }

  /**
   * A periodic wave from harmonic amplitudes, started `phase` cycles into its period. Shifting a wave in
   * time rotates harmonic n by n times the shift, which is why a half-cycle shift cancels a square against
   * itself but turns two saws into one an octave up.
   */
  private wave(h: Float32Array, phase: number, cos?: Float32Array): PeriodicWave {
    const real = new Float32Array(h.length), imag = new Float32Array(h.length);
    for (let n = 1; n < h.length; n++) {
      const angle = 2 * Math.PI * n * phase, c = cos?.[n] ?? 0;
      real[n] = h[n]! * Math.sin(angle) + c * Math.cos(angle);
      imag[n] = h[n]! * Math.cos(angle) - c * Math.sin(angle);
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
    if (jump) node.gain.setValueAtTime(stage.gainDb ?? 0, t); else node.gain.setTargetAtTime(stage.gainDb ?? 0, t, RAMP);
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
    // Filter 2 is always in the path. After filter 1: filter 1 feeds it. Beside: the sources feed it too, and
    // filter 1 also goes straight on. Three gains crossfade between the two, so nothing restarts.
    this.setStage(f.three, filter2Stage(s, this.ctx.sampleRate), t, jump);
    const side = sideBySide(s) ? 1 : 0;
    for (const [g, value] of [[f.after, 1 - side], [f.beside, side], [f.past, side]] as const) {
      if (jump) g.gain.setValueAtTime(value, t); else g.gain.setTargetAtTime(value, t, RAMP);
    }
  }

  /**
   * Give an LFO its shape, swinging exactly from -1 to 1 and starting `phase` of a cycle in. The browser's
   * built-in square and saw are scaled down (a square measured about 86% of full depth), which would leave a
   * "one way" trill out of tune, so every shape is built from its harmonics with the browser's own scaling
   * switched off. The harmonics come from `lfoCoefficients` in mod.ts, which matches `lfoValue`.
   */
  private setLfoShape(osc: OscillatorNode, s: SynthState, id: "lfo1" | "lfo2" | "lfo3", phase: number): void {
    const shape = s[`${id}Shape`], steps = s[`${id}Steps`];
    if (this.lfoCache?.shape !== shape || this.lfoCache.steps !== steps) this.lfoCache = { shape, steps, ...lfoCoefficients(shape, steps) };
    const c = this.lfoCache, N = c.sin.length, real = new Float32Array(N), imag = new Float32Array(N);
    // starting part-way through a cycle turns each harmonic by n times that much
    for (let n = 1; n < N; n++) {
      const angle = 2 * Math.PI * n * phase, co = Math.cos(angle), si = Math.sin(angle);
      real[n] = c.cos[n]! * co + c.sin[n]! * si;
      imag[n] = c.sin[n]! * co - c.cos[n]! * si;
    }
    osc.setPeriodicWave(this.ctx.createPeriodicWave(real, imag, { disableNormalization: true }));
  }
  /** The average of an LFO's shape: zero for the basic shapes, but a drawn shape may sit mostly above or below. */
  private lfoMean(s: SynthState, id: "lfo1" | "lfo2" | "lfo3"): number {
    return isDrawn(s[`${id}Shape`]) ? lfoCoefficients("drawn", s[`${id}Steps`], 2).mean : 0;
  }

  /** Each of oscillator B's voices' level: several voices share the level of one. */
  private bGain(s: SynthState): number { return (OSC_GAIN / Math.sqrt(s.bVoices)) * dbToGain(s.bLevelDb); }
  /** Each of oscillator A's voices' level: nothing when A is switched off. */
  private levelA(s: SynthState): number {
    return s.aOn ? (OSC_GAIN / Math.sqrt(s.voices)) * dbToGain(s.aLevelDb) : 0;
  }
  /** The level that a route's destination is set to, for scaling level modulation. */
  private baseLevel(s: SynthState, dest: Route["dest"]): number {
    return dest === "aLevelDb" ? this.levelA(s) : dest === "bLevelDb" ? OSC_GAIN * dbToGain(s.bLevelDb)
      : dest === "subLevelDb" ? OSC_GAIN * dbToGain(s.subLevelDb) : dest === "noiseLevelDb" ? dbToGain(s.noiseLevelDb) : 1;
  }
  private depthOf(s: SynthState, r: Route, note: number): number {
    return modDepth(r.dest, r.amount) * (isLevel(r.dest) ? this.baseLevel(s, r.dest) : r.dest === "fmAmount" ? FM_MAX_INDEX * playedHzB(s, note) : 1);
  }
  /** The audio settings a destination stands for on one note. */
  private targets(v: Voice, dest: Route["dest"]): AudioParam[] {
    switch (dest) {
      case "cutoff": return [v.filter.one.detune, v.filter.two.detune];
      case "fine": case "aPitchWide": return v.a.map((x) => x.osc.detune);
      case "bFine": return [...(v.b ?? []).map((x) => x.osc.detune), v.modB.osc.detune];
      case "fmAmount": return [v.modB.fm.gain];
      case "aLevelDb": return v.a.map((x) => x.gain.gain);
      case "bLevelDb": return (v.b ?? []).map((x) => x.gain.gain);
      case "subLevelDb": return v.sub ? [v.sub.gain.gain] : [];
      case "noiseLevelDb": return v.noise ? [v.noise.gain.gain] : [];
      // an LFO's speed, moved in octaves through its detune setting
      case "noteLevel": return [v.out.gain];
      default: return []; // every other knob is moved at control rate (see slowModulate), not here
      case "lfo1Rate": return v.mods.flatMap((m) => (m.route.source.id === "lfo1" && m.src instanceof OscillatorNode ? [m.src.detune] : []));
    }
  }
  /** One source for one note: an LFO oscillator, or a constant that carries an envelope, velocity, key position or the mod wheel. `unit` makes key position run 0 to 1 (for scaling) instead of -1 to 1. */
  private makeSource(v: Voice, s: SynthState, source: Route["source"], t: number, unit: boolean): { src: OscillatorNode | ConstantSourceNode; phase: number; rise: number } {
    let src: OscillatorNode | ConstantSourceNode, phase = 0, rise = 0;
    if (source.kind === "lfo") {
      const id = source.id as "lfo1" | "lfo2" | "lfo3";
      src = this.ctx.createOscillator();
      phase = lfoStartPhase(s, id, t);
      this.setLfoShape(src, s, id, phase);
      src.frequency.value = lfoHz(s, id);
      rise = s[`${id}Rise`] / 1000;
    } else if (source.kind === "note") {
      // fixed for the whole note (how hard it was struck, where on the keyboard it is), or the mod wheel
      src = this.ctx.createConstantSource();
      src.offset.value = source.id === "vel" ? velocityValue(v.velocity) : source.id === "wheel" ? s.wheel / 100 : unit ? (keyValue(v.note) + 1) / 2 : keyValue(v.note);
    } else {
      src = this.ctx.createConstantSource();
      src.offset.setValueAtTime(0, t);
      this.scheduleEnvelope(src.offset, adsr(s, 2), t);
    }
    return { src, phase, rise };
  }
  /** Start this note's connected envelopes and LFOs at time `t`. LFOs restart with each note. */
  private buildMods(v: Voice, s: SynthState, t: number): void {
    const list = routes(s);
    // First make every source, then connect them: one source may be moving another (LFO 2 on LFO 1's rate).
    for (const route of list) {
      const { src, phase, rise } = this.makeSource(v, s, route.source, t, false);
      const depth = this.ctx.createGain(), bias = this.ctx.createConstantSource();
      const [swing, lift] = this.swingAndLift(s, route, v.note);
      depth.gain.value = swing;
      bias.offset.value = lift;
      // everything a source sends passes through `fade`, which is how an LFO's rise (fade-in) is done
      const fade = this.ctx.createGain();
      if (rise > 0) { fade.gain.setValueAtTime(0, t); fade.gain.linearRampToValueAtTime(1, t + rise); }
      src.connect(depth).connect(fade);
      bias.connect(fade);
      // A scaling source: what the connection sends then passes through a gate that the second source opens,
      // from shut at its lowest to fully open at its highest.
      let out: GainNode = fade, aux: Voice["mods"][number]["aux"];
      if (route.aux) {
        const a = this.makeSource(v, s, route.aux, t, true), gate = this.ctx.createGain();
        if (a.src instanceof OscillatorNode) {
          // an LFO swings -1 to 1: halve it and lift it so the gate runs from shut to open
          const half = this.ctx.createGain();
          half.gain.value = 0.5;
          gate.gain.value = 0.5 * (1 + this.lfoMean(s, route.aux.id as "lfo1"));
          a.src.connect(half).connect(gate.gain);
        } else { gate.gain.value = 0; a.src.connect(gate.gain); }
        fade.connect(gate);
        out = gate;
        aux = { src: a.src, phase: a.phase, gate };
      }
      v.mods.push({ route, src, depth, bias, fade, phase, out, aux });
    }
    for (const m of v.mods) {
      for (const p of this.targets(v, m.route.dest)) m.out.connect(p);
      m.src.start(t);
      m.bias.start(t);
      m.aux?.src.start(t);
    }
  }
  /**
   * An LFO swings from -1 to 1. Both ways, that is the whole depth each side of the knob. One way, it is
   * squeezed to half the size and lifted by the same amount, so it runs from the knob to the full depth.
   */
  private swingAndLift(s: SynthState, route: Route, note: number): [number, number] {
    const depth = this.depthOf(s, route, note);
    if (route.source.kind !== "lfo") return [depth, 0];
    // a drawn shape's average is added back here, because the oscillator itself cannot carry it
    const mean = this.lfoMean(s, route.source.id as "lfo1");
    return route.oneWay ? [depth / 2, depth / 2 + (depth / 2) * mean] : [depth, depth * mean];
  }

  /** Start an envelope on a setting at time `t`: up over the attack, held at the top, then down to sustain. */
  private scheduleEnvelope(p: AudioParam, e: Adsr, t: number): void {
    const top = t + e.attack, fall = top + (e.hold ?? 0);
    p.setValueAtTime(0, t);
    p.linearRampToValueAtTime(1, top);
    if (e.sustain >= 1) return;
    if (fall > top) p.setValueAtTime(1, fall);
    if (e.bend === "straight") p.linearRampToValueAtTime(e.sustain, fall + Math.max(0.001, e.decay));
    else p.setTargetAtTime(e.sustain, fall, fallConstant(e.bend, e.decay));
  }
  /** Begin an envelope's release at time `t`, from wherever it has got to. Returns when it is over. */
  private scheduleRelease(p: AudioParam, e: Adsr, t: number): number {
    holdAt(p, t);
    // A straight fall needs to know where it starts from, which only "stop and hold" gives; without it, ease.
    if (e.bend === "straight" && "cancelAndHoldAtTime" in p) { const end = t + Math.max(0.005, e.release); p.linearRampToValueAtTime(0, end); return end + 0.03; }
    const tc = Math.max(0.003, fallConstant(e.bend === "straight" ? "eased" : e.bend, e.release));
    p.setTargetAtTime(0, t, tc);
    return t + Math.max(tc * 7, e.release) + 0.03;
  }

  /** Let a note go at time `t`: envelope 1's release fades it, then everything stops. */
  private releaseAt(v: Voice, s: SynthState, t: number): void {
    v.releasedAt = t;
    const stopAt = this.scheduleRelease(v.amp.gain, adsr(s, 1), t);
    for (const m of v.mods) if (m.route.source.kind === "env" && m.src instanceof ConstantSourceNode) this.scheduleRelease(m.src.offset, adsr(s, 2), t);
    for (const m of v.mods) if (m.route.aux?.kind === "env" && m.aux?.src instanceof ConstantSourceNode) this.scheduleRelease(m.aux.src.offset, adsr(s, 2), t);
    for (const x of v.a) x.osc.stop(stopAt);
    v.b?.forEach((x) => x.osc.stop(stopAt));
    v.modB.osc.stop(stopAt);
    v.glide.stop(stopAt);
    v.sub?.osc.stop(stopAt);
    v.noise?.src.stop(stopAt);
    for (const m of v.mods) { m.src.stop(stopAt); m.bias.stop(stopAt); m.aux?.src.stop(stopAt); }
  }

  private build(note: number, phaseA: number, t = this.ctx.currentTime, velocity = 100, slideFrom?: number): Voice {
    const s = this.state;
    const glide = this.ctx.createConstantSource();
    glide.offset.value = 0;
    if (slideFrom !== undefined && slideFrom !== note && s.glide > 0) { glide.offset.setValueAtTime((slideFrom - note) * 100, t); glide.offset.linearRampToValueAtTime(0, t + s.glide / 1000); }
    glide.start(t);
    const amp = this.ctx.createGain();
    // Envelope 1: a straight rise over the attack, then easing down to the sustain level.
    const env = adsr(s, 1);
    this.scheduleEnvelope(amp.gain, env, t);
    const out = this.ctx.createGain();
    out.gain.value = noteLevelBase(s);
    amp.connect(out).connect(this.fx.input);
    const filter = { mix: this.ctx.createGain(), shaper: this.ctx.createWaveShaper(), one: this.ctx.createBiquadFilter(), two: this.ctx.createBiquadFilter(), trim: this.ctx.createGain(), three: this.ctx.createBiquadFilter(), after: this.ctx.createGain(), beside: this.ctx.createGain(), past: this.ctx.createGain(), drive: -1 };
    filter.mix.gain.value = 1 / DRIVE_RANGE; // the shaper's curve covers inputs of -1..1
    filter.mix.connect(filter.shaper).connect(filter.one).connect(filter.two).connect(filter.trim);
    filter.trim.connect(filter.after).connect(filter.three).connect(amp);
    filter.shaper.connect(filter.beside).connect(filter.three);
    filter.trim.connect(filter.past).connect(amp);
    const into = filter.mix;

    const offsets = unisonOffsets(s.voices, s.detune), pans = unisonPans(s.voices, s.spread);
    const base = playedHz(s, note), hA = spectrumA(s);
    // Oscillator B again, unheard: the modulator for FM and ring modulation. It starts in step with the B you hear.
    const modOsc = this.ctx.createOscillator();
    const hB = spectrumB(s);
    modOsc.setPeriodicWave(this.wave(hB.sin, s.bPhase / 360, hB.cos));
    modOsc.frequency.value = playedHzB(s, note);
    const modB = { osc: modOsc, fm: this.ctx.createGain(), dry: this.ctx.createGain(), wet: this.ctx.createGain() };
    modB.fm.gain.value = fmIndex(s.fmAmount) * playedHzB(s, note);
    modOsc.connect(modB.fm);
    glide.connect(modOsc.detune); this.bendSource().connect(modOsc.detune);
    // ring modulation: `times` is a volume control that B itself turns, so what passes is A times B
    const times = this.ctx.createGain();
    times.gain.value = 0;
    modOsc.connect(times.gain);
    modB.dry.gain.value = 1 - s.ringAmount / 100;
    modB.wet.gain.value = s.ringAmount / 100;
    times.connect(modB.wet).connect(into);
    modB.dry.connect(into);
    modOsc.start(t);
    const a = offsets.map((cents, i) => {
      const osc = this.ctx.createOscillator();
      // The centre voice keeps the set phase; the others start elsewhere so a stack does not begin as one spike.
      osc.setPeriodicWave(this.wave(hA.sin, phaseA + (s.voices > 1 ? i / s.voices : 0), hA.cos));
      modB.fm.connect(osc.frequency);
      glide.connect(osc.detune); this.bendSource().connect(osc.detune);
      osc.frequency.value = base * 2 ** (cents / 1200);
      const gain = this.ctx.createGain();
      gain.gain.value = this.levelA(s);
      const pan = this.ctx.createStereoPanner();
      pan.pan.value = panOf(pans[i]!, s.aPan);
      osc.connect(gain).connect(pan);
      pan.connect(modB.dry);
      pan.connect(times);
      osc.start(t);
      return { osc, gain, pan };
    });

    const voice: Voice = { note, phaseA, velocity, startedAt: t, out, a, modB, mods: [], filter, amp, glide };
    this.applyFilter(voice, s, true, t);
    if (s.bOn) {
      const off = unisonOffsets(s.bVoices, s.bDetune), bPans = unisonPans(s.bVoices, B_SPREAD), hz = playedHzB(s, note);
      voice.b = off.map((cents, i) => {
        const osc = this.ctx.createOscillator();
        osc.setPeriodicWave(this.wave(hB.sin, s.bPhase / 360 + bStart(i, s.bVoices), hB.cos));
        osc.frequency.value = hz * 2 ** (cents / 1200);
        const gain = this.ctx.createGain();
        gain.gain.value = this.bGain(s);
        const pan = this.ctx.createStereoPanner();
        pan.pan.value = panOf(bPans[i]!, s.bPan);
        osc.connect(gain).connect(pan).connect(into);
        glide.connect(osc.detune); this.bendSource().connect(osc.detune);
        osc.start(t);
        return { osc, gain, pan };
      });
    }
    if (s.subOn) {
      const osc = this.ctx.createOscillator();
      osc.type = "sine";
      osc.frequency.value = subHz(s, note);
      const gain = this.ctx.createGain();
      gain.gain.value = OSC_GAIN * dbToGain(s.subLevelDb);
      osc.connect(gain).connect(into);
      glide.connect(osc.detune); this.bendSource().connect(osc.detune);
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

  /** What the control-rate modulation follows: the most recently played note that is still held. */
  /** The note the screen should follow: the most recent one held, or failing that a sound being auditioned. */
  get liveNote(): ReturnType<Engine["noteNow"]> {
    return this.noteNow(this.voices[this.voices.length - 1] ?? this.auditions.find((a) => a.voice.startedAt <= this.ctx.currentTime)?.voice);
  }
  noteNow(v: Voice | undefined): { note: number; velocity: number; age: number; held: number; startedAt: number } | undefined {
    if (!v) return undefined;
    const now = this.ctx.currentTime;
    return { note: v.note, velocity: v.velocity, age: now - v.startedAt, held: v.releasedAt === undefined ? Infinity : v.releasedAt - v.startedAt, startedAt: v.startedAt };
  }
  /** Bring the knobs that sources move by code up to date. Runs about fifty times a second while audio is on. */
  private tick(): void {
    const now = this.ctx.currentTime;
    this.auditions = this.auditions.filter((a) => a.until > now);
    for (const a of this.auditions) {
      if (now < a.voice.startedAt) continue;
      const next = slowModulate(a.base, this.noteNow(a.voice));
      if (next === a.played) continue;
      this.applyVoice(a.voice, next, a.played);
      this.fx.apply(next);
      a.played = next;
    }
    const next = slowModulate(this.base, this.noteNow(this.voices[this.voices.length - 1]));
    if (next !== this.state) this.render(next);
  }

  /** Apply new settings to everything that is sounding. */
  update(next: SynthState): void {
    this.base = applyMacros(next);
    this.render(slowModulate(this.base, this.noteNow(this.voices[this.voices.length - 1])));
  }
  private render(next: SynthState): void {
    const t = this.ctx.currentTime, prev = this.state;
    this.state = next;
    if (next.clickOn !== prev.clickOn || next.bpm !== prev.bpm) this.syncClick(next);
    if (next.bendRange !== prev.bendRange && this.bendPos !== 0) this.bendSource().offset.setTargetAtTime(this.bendPos * next.bendRange * 100, t, RAMP);
    if (next.volumeDb !== prev.volumeDb) this.master.gain.setTargetAtTime(dbToGain(next.volumeDb), t, RAMP);
    if (!this.fxRestore) this.fx.apply(next);
    if (STRUCTURAL.some((k) => next[k] !== prev[k]) || (next.matrix !== prev.matrix && routeLayout(next) !== routeLayout(prev))) {
      // The set of sources changed: restart the sounding notes with the new layout.
      const notes = this.voices.map((v) => [v.note, v.velocity] as const);
      this.voices.forEach((v) => this.release(v));
      this.voices = (next.voiceMode === "mono" ? notes.slice(-1) : notes).map(([n, velocity]) => this.build(n, this.startPhase(), undefined, velocity));
      this.stack = next.voiceMode === "mono" ? this.voices.map((v) => v.note) : [];
      return;
    }
    for (const v of this.voices) this.applyVoice(v, next, prev);
  }

  /** Make one sounding note match new settings, changing only what differs from the settings it had. */
  private applyVoice(v: Voice, next: SynthState, prev: SynthState): void {
    const t = this.ctx.currentTime;
    const waveB = next.bShape !== prev.bShape || next.bPhase !== prev.bPhase || next.bTable !== prev.bTable || next.bPosition !== prev.bPosition || next.bWarp !== prev.bWarp || next.bWarpAmount !== prev.bWarpAmount;
    const waveA = next.shape !== prev.shape || next.table !== prev.table || next.position !== prev.position || next.phase !== prev.phase || next.warp !== prev.warp || next.warpAmount !== prev.warpAmount;
    const hA = waveA ? spectrumA(next) : undefined;
    const offsets = unisonOffsets(next.voices, next.detune), pans = unisonPans(next.voices, next.spread);
    this.applyFilter(v, next, false);
    v.out.gain.setTargetAtTime(noteLevelBase(next), t, RAMP);
    for (const m of v.mods) {
      // amounts and LFO settings follow the controls; a changed destination rebuilds the note (see STRUCTURAL)
      const route = routes(next).find((r) => r.key === m.route.key);
      if (!route) continue;
      m.route = route;
      const [swing, lift] = this.swingAndLift(next, route, v.note);
      m.depth.gain.setTargetAtTime(swing, t, RAMP);
      m.bias.offset.setTargetAtTime(lift, t, RAMP);
      // the mod wheel is the one fixed-value source that moves while a note sounds
      if (route.source.id === "wheel" && m.src instanceof ConstantSourceNode) m.src.offset.setTargetAtTime(next.wheel / 100, t, RAMP);
      if (m.src instanceof OscillatorNode) {
        const id = route.source.id as "lfo1" | "lfo2" | "lfo3";
        if (next[`${id}Shape`] !== prev[`${id}Shape`] || next[`${id}Steps`] !== prev[`${id}Steps`]) this.setLfoShape(m.src, next, id, m.phase);
        m.src.frequency.setTargetAtTime(lfoHz(next, id), t, RAMP);
      }
      // the scaling source follows its own settings in the same way
      if (m.aux && route.aux) {
        if (route.aux.id === "wheel" && m.aux.src instanceof ConstantSourceNode) m.aux.src.offset.setTargetAtTime(next.wheel / 100, t, RAMP);
        if (m.aux.src instanceof OscillatorNode) {
          const id = route.aux.id as "lfo1" | "lfo2" | "lfo3";
          if (next[`${id}Shape`] !== prev[`${id}Shape`] || next[`${id}Steps`] !== prev[`${id}Steps`]) { this.setLfoShape(m.aux.src, next, id, m.aux.phase); m.aux.gate.gain.setTargetAtTime(0.5 * (1 + this.lfoMean(next, id)), t, RAMP); }
          m.aux.src.frequency.setTargetAtTime(lfoHz(next, id), t, RAMP);
        }
      }
    }
    if (next.phase !== prev.phase) v.phaseA += (next.phase - prev.phase) / 360;
    const base = playedHz(next, v.note);
    v.a.forEach((x, i) => {
      if (hA) x.osc.setPeriodicWave(this.wave(hA.sin, v.phaseA + (next.voices > 1 ? i / next.voices : 0), hA.cos));
      x.osc.frequency.setTargetAtTime(base * 2 ** (offsets[i]! / 1200), t, RAMP);
      x.pan.pan.setTargetAtTime(panOf(pans[i]!, next.aPan), t, RAMP);
      if (next.aLevelDb !== prev.aLevelDb || next.aOn !== prev.aOn) x.gain.gain.setTargetAtTime(this.levelA(next), t, RAMP);
    });
    const hB = waveB ? spectrumB(next) : undefined;
    if (hB) v.modB.osc.setPeriodicWave(this.wave(hB.sin, next.bPhase / 360, hB.cos));
    v.modB.osc.frequency.setTargetAtTime(playedHzB(next, v.note), t, RAMP);
    v.modB.fm.gain.setTargetAtTime(fmIndex(next.fmAmount) * playedHzB(next, v.note), t, RAMP);
    v.modB.dry.gain.setTargetAtTime(1 - next.ringAmount / 100, t, RAMP);
    v.modB.wet.gain.setTargetAtTime(next.ringAmount / 100, t, RAMP);
    if (v.b) {
      const off = unisonOffsets(next.bVoices, next.bDetune), bPans = unisonPans(next.bVoices, B_SPREAD), hz = playedHzB(next, v.note);
      v.b.forEach((x, i) => {
        if (hB) x.osc.setPeriodicWave(this.wave(hB.sin, next.bPhase / 360 + bStart(i, next.bVoices), hB.cos));
        x.osc.frequency.setTargetAtTime(hz * 2 ** ((off[i] ?? 0) / 1200), t, RAMP);
        x.gain.gain.setTargetAtTime(this.bGain(next), t, RAMP);
        x.pan.pan.setTargetAtTime(panOf(bPans[i] ?? 0, next.bPan), t, RAMP);
      });
    }
    if (v.sub) {
      v.sub.osc.frequency.setTargetAtTime(subHz(next, v.note), t, RAMP);
      v.sub.gain.gain.setTargetAtTime(OSC_GAIN * dbToGain(next.subLevelDb), t, RAMP);
    }
    if (v.noise) v.noise.gain.gain.setTargetAtTime(dbToGain(next.noiseLevelDb), t, RAMP);
  }

  private startPhase(): number {
    return this.state.phase / 360 + Math.random() * (this.state.randomPhase / 100);
  }

  /** `velocity` is how hard the key was struck, 1 to 127. */
  /** The pitch-bend wheel: one offset in cents that every oscillator of every note follows. */
  private bendNode?: ConstantSourceNode;
  private bendPos = 0;
  private bendSource(): ConstantSourceNode {
    if (!this.bendNode) { this.bendNode = this.ctx.createConstantSource(); this.bendNode.offset.value = 0; this.bendNode.start(); }
    return this.bendNode;
  }
  /** Where the bend wheel is, -1 (fully down) to 1 (fully up). The range in semitones is the Bend range setting. */
  setBend(position: number): void {
    this.bendPos = Math.min(1, Math.max(-1, position));
    this.bendSource().offset.setTargetAtTime(this.bendPos * this.state.bendRange * 100, this.ctx.currentTime, 0.004);
  }
  get bend(): number { return this.bendPos; }

  /** Mono: the keys held, oldest first, so letting go of one falls back to the one before. */
  private stack: number[] = [];
  /** The last note started, for sliding to the next one. */
  private lastNote: number | undefined;

  /**
   * Carry a sounding note over to another key without starting it again (legato): its oscillators jump to
   * the new pitch and the slide offset is set to the distance just covered, so what is heard is a slide.
   */
  private moveVoice(v: Voice, note: number): void {
    const s = this.state, t = this.ctx.currentTime, from = v.note;
    v.note = note;
    const base = playedHz(s, note), offsets = unisonOffsets(s.voices, s.detune);
    v.a.forEach((x, i) => x.osc.frequency.setValueAtTime(base * 2 ** (offsets[i]! / 1200), t));
    v.modB.osc.frequency.setValueAtTime(playedHzB(s, note), t);
    v.modB.fm.gain.setValueAtTime(fmIndex(s.fmAmount) * playedHzB(s, note), t);
    { const off = unisonOffsets(s.bVoices, s.bDetune); v.b?.forEach((x, i) => x.osc.frequency.setValueAtTime(playedHzB(s, note) * 2 ** ((off[i] ?? 0) / 1200), t)); }
    v.sub?.osc.frequency.setValueAtTime(subHz(s, note), t);
    this.applyFilter(v, s, true, t);
    // wherever the slide had got to, plus the new distance
    const left = v.glide.offset.value + (from - note) * 100;
    holdAt(v.glide.offset, t);
    if (s.glide > 0) { v.glide.offset.setValueAtTime(left, t); v.glide.offset.linearRampToValueAtTime(0, t + s.glide / 1000); }
    else v.glide.offset.setValueAtTime(0, t);
  }

  /**
   * `velocity` is how hard the key was struck, 1 to 127. `latch` is set when Hold is on: the new note then
   * replaces whatever was latched instead of joining it.
   */
  noteOn(note: number, velocity = 100, latch = false): void {
    const s = this.state, overlapping = this.voices.length > 0;
    // the pitch slides from the previous note: on every note, or only when keys overlap
    const slideFrom = s.glide > 0 && (s.glideMode === "always" || overlapping) ? this.lastNote : undefined;
    this.lastNote = note;
    if (s.voiceMode === "mono") {
      if (latch) this.stack = [];
      this.stack = [...this.stack.filter((n) => n !== note), note];
      const v = this.voices[0];
      if (v && v.note === note) return;
      if (v && s.legato === "on") { this.moveVoice(v, note); if (slideFrom === undefined) holdAtZero(v.glide.offset, this.ctx.currentTime); return; }
      if (v) { this.release(v); this.voices = []; }
      this.voices = [this.build(note, this.startPhase(), undefined, velocity, slideFrom)];
      return;
    }
    if (this.voices.some((v) => v.note === note)) return;
    this.voices.push(this.build(note, this.startPhase(), undefined, velocity, slideFrom));
  }

  noteOff(note: number): void {
    if (this.state.voiceMode === "mono") {
      this.stack = this.stack.filter((n) => n !== note);
      const v = this.voices[0];
      if (!v || v.note !== note) return;
      const back = this.stack[this.stack.length - 1];
      // another key is still down: go back to it, as a mono synth does
      if (back !== undefined) {
        this.lastNote = back;
        if (this.state.legato === "on") { this.moveVoice(v, back); return; }
        this.release(v);
        this.voices = [this.build(back, this.startPhase(), undefined, v.velocity, this.state.glide > 0 ? note : undefined)];
        return;
      }
      this.release(v); this.voices = [];
      return;
    }
    this.voices.filter((v) => v.note === note).forEach((v) => this.release(v));
    this.voices = this.voices.filter((v) => v.note !== note);
  }

  allNotesOff(): void {
    this.stack = [];
    for (const v of [...this.voices]) { this.release(v); }
    this.voices = [];
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

  /**
   * Play one note of the current sound at an exact time on the audio clock, for a set length. Used by the
   * arpeggiator, whose steps must land on the tempo grid more exactly than a timer can manage.
   */
  playAt(note: number, at: number, seconds: number, velocity = 100): void {
    const s = this.state, start = Math.max(at, this.ctx.currentTime);
    const v = this.build(note, s.phase / 360, start, velocity);
    this.releaseAt(v, s, start + seconds);
    this.auditions.push({ voice: v, base: this.base, played: s, until: start + seconds + s.envR / 1000 + 0.5 });
  }

  /** Play a whole patch for a moment, without disturbing held notes or the learner's settings. */
  auditionPatch(patch: SynthState, note: number, seconds = 1.2, when = 0, velocity = 100, slideFrom?: number): void {
    patch = applyMacros(patch);
    const keep = this.state, at = this.ctx.currentTime + when;
    this.state = patch;
    const v = this.build(note, patch.phase / 360, at, velocity, slideFrom);
    this.state = keep;
    this.releaseAt(v, patch, at + seconds - 0.08);
    this.auditions.push({ voice: v, base: patch, played: patch, until: at + seconds + 0.5 });
    // The effects are shared by every note, so for the length of this sound they are set to the patch's own,
    // then handed back to the learner's settings a moment after it ends (long enough for a short tail).
    setTimeout(() => this.fx.apply(patch), Math.max(0, when * 1000 - 20));
    if (this.fxRestore) clearTimeout(this.fxRestore);
    this.fxRestore = setTimeout(() => { this.fxRestore = undefined; this.fx.apply(this.state); }, (when + seconds) * 1000 + 700);
  }

  /**
   * The click that marks the beat. Beats are counted from the moment the audio clock started, the same
   * clock a "free" LFO runs against, so a tempo-synced free LFO always turns over on the click.
   */
  private syncClick(s: SynthState): void {
    if (this.clickTimer) { clearInterval(this.clickTimer); this.clickTimer = undefined; }
    if (!s.clickOn) return;
    const beat = 60 / s.bpm;
    this.clickNext = Math.ceil((this.ctx.currentTime + 0.03) / beat);
    const schedule = () => {
      while (this.clickNext * beat < this.ctx.currentTime + 0.2) {
        const at = this.clickNext * beat, osc = this.ctx.createOscillator(), g = this.ctx.createGain();
        osc.frequency.value = this.clickNext % 4 === 0 ? 1760 : 1175; // the first beat of each four is higher
        g.gain.setValueAtTime(0, at); g.gain.linearRampToValueAtTime(1, at + 0.001); g.gain.setTargetAtTime(0, at + 0.012, 0.008);
        osc.connect(g).connect(this.clickBus);
        osc.start(at); osc.stop(at + 0.08);
        this.clickNext++;
      }
    };
    schedule();
    this.clickTimer = setInterval(schedule, 50);
  }
  /** Stop everything that runs by itself. Call when the synth leaves the screen. */
  dispose(): void {
    if (this.clickTimer) clearInterval(this.clickTimer);
    this.clickTimer = undefined;
    if (this.fxRestore) clearTimeout(this.fxRestore);
    this.fxRestore = undefined;
    if (this.slowTimer) clearInterval(this.slowTimer);
    this.slowTimer = undefined;
    this.allNotesOff();
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
