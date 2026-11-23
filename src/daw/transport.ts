// Plays a song: every track on one audio clock. Each step is handed to the clock a little before it is due,
// so the beat never depends on how busy the page is, and the song is read afresh for every step, so an edit
// made while it plays is heard the next time that step comes round.
import { Engine } from "../synth/engine";
import { Kit } from "./kit";
import { audibleOf, stepSeconds, stepTime, type Pad } from "./drums";
import { chainShape, type Device } from "./devices";
import { chainReady, devicesSettled, prepareDevices } from "./fxnodes";
import { buildDevice, type LiveDevice } from "./fxnodes";
import { masterGain, sendGain, songEvents, type Song } from "./song";
import { automate, hasAutomation } from "./automation";
import { playSample, type SampleVoice } from "./sampler";

/** The id of the strip that holds the effects on everything. */
export const MASTER = "master";
const AHEAD = 0.12, EVERY_MS = 25;
export interface Loop { start: number; bars: number }

export class Transport {
  ctx?: AudioContext;
  private kit?: Kit;
  private master?: GainNode;
  /** Per track: where its instrument plays into, its effects, and its level. Instrument -> ins -> effects -> outs -> master. */
  private ins = new Map<string, GainNode>();
  private outs = new Map<string, GainNode>();
  private chains = new Map<string, { shape: string; live: Map<string, LiveDevice>; /** what the track's input was plugged into */ first: AudioNode; /** sidechain wires: from another track's input to a device here */ sides: [AudioNode, AudioNode, number][] }>();
  private meterL?: AnalyserNode;
  private meterR?: AnalyserNode;
  private engines = new Map<string, { engine: Engine; patch: unknown }>();
  /** Per track, after its level: where it sits between left and right, and a tap for its meter. */
  private pans = new Map<string, StereoPannerNode>();
  private taps = new Map<string, AnalyserNode>();
  /** Send wires, by "track>return": a gain from the track (after its level and pan) into the return's input. */
  private sends = new Map<string, GainNode>();
  /** Per synth track: a gate between its synth and its input, shut while the track plays a sampler instead. */
  private gates = new Map<string, GainNode>();
  private timer?: number;
  /** The audio-clock time of step 0 of this run, and the next step (counting on for ever) not yet handed over. */
  private began = 0;
  private next = 0;
  private due: { step: number; at: number }[] = [];
  private shown = -1;
  /** The place in the song (in steps) that automation is read at; -1 when the song is not playing. */
  private place = -1;
  loop?: Loop;
  /** The metronome: a click on every beat while the song plays. */
  click = false;
  /** `given`: a context to make the sound in instead of the speakers' own (used to work a whole song out as a file). */
  constructor(private read: () => Song, private readonly given?: BaseAudioContext) {}
  get playing(): boolean { return this.timer !== undefined; }
  private boot(): void {
    if (this.ctx) return;
    this.ctx = (this.given ?? new AudioContext()) as AudioContext;
    this.master = this.ctx.createGain(); this.master.gain.value = 0.9; this.master.connect(this.ctx.destination);
    const split = this.ctx.createChannelSplitter(2);
    this.meterL = this.ctx.createAnalyser(); this.meterR = this.ctx.createAnalyser();
    this.meterL.fftSize = this.meterR.fftSize = 2048;
    this.master.connect(split); split.connect(this.meterL, 0); split.connect(this.meterR, 1);
    this.kit = new Kit(this.ctx, this.master);
    void prepareDevices(this.ctx).then(() => this.sync(), () => undefined);
  }
  /** Bring the audio in line with the song: a gain per track, a synth per synth track, levels, mutes and sounds. */
  /** Automation lanes switched off for now: a control was moved by hand, and it stays where it was put until the learner asks for the automation back. */
  autoOff: ReadonlySet<string> = new Set();
  sync(): void {
    if (!this.ctx) return;
    // while the song plays, automated settings are where their lanes put them at this moment
    const ctx = this.ctx, song = this.place >= 0 ? automate(this.read(), this.place, this.autoOff) : this.read(), on = audibleOf(song.tracks), t = ctx.currentTime;
    this.master!.gain.setTargetAtTime(masterGain(song.volume), t, 0.015);
    // every track and every return track has the same strip: input -> effects -> level -> pan -> master
    const strips: { id: string; level: number; pan: number; devices: Device[]; heard: boolean }[] = [{ id: MASTER, level: 80, pan: 0, devices: song.masterFx ?? [], heard: true }, ...song.tracks.map((x, i) => ({ id: x.id, level: x.level, pan: x.pan, devices: x.devices, heard: on[i]! })), ...song.returns.map((x) => ({ id: x.id, level: x.level, pan: x.pan, devices: x.devices, heard: !x.mute }))];
    for (const strip of strips) if (!this.outs.has(strip.id)) { const out = ctx.createGain(), pan = ctx.createStereoPanner(), tap = ctx.createAnalyser(); out.gain.value = 0; tap.fftSize = 1024; out.connect(pan); pan.connect(strip.id === MASTER ? this.master! : this.ins.get(MASTER)!); pan.connect(tap);   // every strip plays into the master's effects; the master's own strip (made first) plays into the master volume
      this.outs.set(strip.id, out); this.pans.set(strip.id, pan); this.taps.set(strip.id, tap); this.ins.set(strip.id, ctx.createGain()); }
    for (const strip of strips) {
      const out = this.outs.get(strip.id)!, input = this.ins.get(strip.id)!;
      out.gain.setTargetAtTime(strip.heard ? strip.level / 80 : 0, t, 0.015);
      this.pans.get(strip.id)?.pan.setTargetAtTime(strip.pan / 100, t, 0.015);
      // The effects: wired again only when a device is added, removed or moved, or told to listen to a different
      // track; a setting is changed in place. "~": some devices are still loading and are passed by until they are.
      const listens = (d: Device) => ((d.p.side ?? 0) > 0 ? song.tracks[d.p.side! - 1]?.id : undefined);
      const shape = chainShape(strip.devices) + (chainReady(ctx, strip.devices) ? "" : "~") + strip.devices.map((d) => `@${listens(d) ?? ""}`).join(""), have0 = this.chains.get(strip.id);
      if (!have0 || have0.shape !== shape) {
        if (have0) { try { input.disconnect(have0.first); } catch { /* already apart */ } for (const [from, to, at] of have0.sides) { try { from.disconnect(to, 0, at); } catch { /* already apart */ } } have0.live.forEach((l) => l.dispose()); }
        const live = new Map<string, LiveDevice>(), sides: [AudioNode, AudioNode, number][] = [];
        let from: AudioNode = input, first: AudioNode | undefined;
        for (const d of strip.devices) { const l = buildDevice(ctx, d, song.bpm, this.began); if (!l) continue; from.connect(l.input); first ??= l.input; from = l.output; live.set(d.id, l);
          const heard = listens(d), source = heard ? this.ins.get(heard) : undefined;       // a sidechain: the other track's sound before its effects and level
          if (l.side && source) { const at = l.sideIn ?? 1; source.connect(l.side, 0, at); sides.push([source, l.side, at]); } }
        from.connect(out);
        this.chains.set(strip.id, { shape, live, first: first ?? out, sides });
      } else for (const d of strip.devices) have0.live.get(d.id)?.update(d, song.bpm, this.began);
    }
    // Sends: some of a track, after its level and pan, into a return track's input. A wire is made the first
    // time a send is turned up and taken away when its track or its return goes.
    const wanted = new Set<string>();
    for (const track of song.tracks) for (const ret of song.returns) {
      const v = track.sends?.[ret.id] ?? 0, key = `${track.id}>${ret.id}`; let wire = this.sends.get(key);
      if (!wire && v > 0) { wire = ctx.createGain(); wire.gain.value = 0; this.pans.get(track.id)!.connect(wire); wire.connect(this.ins.get(ret.id)!); this.sends.set(key, wire); }
      if (wire) { wire.gain.setTargetAtTime(sendGain(v), t, 0.015); wanted.add(key); }
    }
    for (const [key, wire] of this.sends) if (!wanted.has(key)) { wire.disconnect(); const from = this.pans.get(key.split(">")[0]!); try { from?.disconnect(wire); } catch { /* already apart */ } this.sends.delete(key); }
    for (const track of song.tracks) {
      if (track.kind !== "synth") continue;
      const have = this.engines.get(track.id), input = this.ins.get(track.id)!;
      if (!have) { const gate = ctx.createGain(); gate.connect(input); this.gates.set(track.id, gate); const engine = new Engine(track.patch, ctx, gate); if (ctx.state === "running") void engine.start(); this.engines.set(track.id, { engine, patch: track.patch }); }
      else if (have.patch !== track.patch) { have.engine.update(track.patch); have.patch = track.patch; }
      this.gates.get(track.id)?.gain.setTargetAtTime(track.sampler ? 0 : 1, t, 0.01);    // a sampler track's synth is still there for the keys' hook, but is not heard
    }
    for (const [id, out] of this.outs) {
      if (strips.some((x) => x.id === id)) continue;
      const e = this.engines.get(id);
      if (e) { e.engine.stopScheduled(); e.engine.dispose(); this.engines.delete(id); this.gates.get(id)?.disconnect(); this.gates.delete(id); }
      out.disconnect(); this.pans.get(id)?.disconnect(); this.pans.delete(id); this.taps.delete(id); this.outs.delete(id); this.ins.get(id)?.disconnect(); this.ins.delete(id); this.chains.get(id)?.live.forEach((l) => l.dispose()); this.chains.delete(id);
    }
  }
  /** Make sure sound can be made (call from a click or a key press). */
  ready(): void {
    this.boot();
    void this.ctx!.resume().then(() => { for (const e of this.engines.values()) void e.engine.start(); });
    this.sync();
  }
  /** The synth of a synth track, once there is one. */
  engine(trackId: string): Engine | undefined { this.boot(); this.sync(); return this.engines.get(trackId)?.engine; }
  /** Decode one of the learner's sounds. Works before anything has been played. Gives back its length in seconds. */
  load(id: string, bytes: ArrayBuffer): Promise<number> { this.boot(); return this.kit!.load(id, bytes); }
  forget(id: string): void { this.kit?.forget(id); }
  /** A stored sound's samples, one array per side, and its rate; nothing when it is not loaded. */
  sound(id: string): { channels: Float32Array[]; rate: number } | undefined { const b = this.kit?.buffer(id); return b ? { channels: Array.from({ length: Math.min(2, b.numberOfChannels) }, (_, c) => b.getChannelData(c)), rate: b.sampleRate } : undefined; }
  peaks(id: string, n?: number): number[] { return this.kit?.peaks(id, n) ?? []; }
  seconds(id: string): number { return this.kit?.seconds(id) ?? 0; }
  /** How loud the left and right sides of everything are right now, in dB (very low when silent). */
  levels(): { left: number; right: number } {
    const read = (a?: AnalyserNode) => { if (!a) return -120; const b = new Float32Array(a.fftSize); a.getFloatTimeDomainData(b); let s = 0; for (const v of b) s += v * v; return 10 * Math.log10(s / b.length + 1e-12); };
    return { left: read(this.meterL), right: read(this.meterR) };
  }
  /** How loud one track is right now, after its level and pan: its peak in dB (very low when silent). */
  trackLevel(trackId: string): number { const a = this.taps.get(trackId); if (!a) return -120; const b = new Float32Array(a.fftSize); a.getFloatTimeDomainData(b); let m = 0; for (const v of b) { const x = Math.abs(v); if (x > m) m = x; } return 20 * Math.log10(m + 1e-6); }
  /**
   * Work the whole song out as sound, start to finish, faster than it plays: for saving it as a file. Only on a
   * transport that was given an offline context. Every hit and note is handed over at once, then the browser
   * renders. `tail` seconds are left at the end for echoes and reverb to die away.
   */
  async render(): Promise<AudioBuffer> {
    this.boot();
    const ctx = this.ctx as unknown as OfflineAudioContext, song = this.read();
    await prepareDevices(ctx);
    this.began = 0.05; this.sync();
    await devicesSettled(ctx);   // a device whose inside is fetched (the pitch shifter) must be in place before the first sample
    for (let n = 0; n < song.bars * 16; n++) for (const e of songEvents(song, n, n + 1)) {
      const at = this.began + e.at;
      if (e.kind === "hit") this.kit!.hit(e.pad, at, e.strength, this.ins.get(e.track) ?? this.master!, e.track);
      else this.playNote(song, e.track, e.note, at, e.seconds, e.velocity);
    }
    // automation: the browser is paused at every sixteenth to move the automated settings, then let go again
    if (hasAutomation(song)) for (let n = 0; n < song.bars * 16; n++) { const at = this.began + n * stepSeconds(song.bpm); void ctx.suspend(at).then(() => { this.place = n; this.sync(); void ctx.resume(); }).catch(() => undefined); }
    const buf = await ctx.startRendering(); this.place = -1;
    return buf;
  }
  /** The sound at a device that shows it (spectrum, tuner). */
  analyser(trackId: string, deviceId: string): AnalyserNode | undefined { return this.chains.get(trackId)?.live.get(deviceId)?.analyser; }
  /** How many dB a device is turning the sound down by right now, when it is one that says. */
  reduction(trackId: string, deviceId: string): number | undefined { return this.chains.get(trackId)?.live.get(deviceId)?.reduction?.(); }
  /** Strike one pad now, for trying a sound. */
  hitPad(trackId: string, pad: Pad, strength = 0.85): void {
    this.ready();
    this.kit!.hit(pad, this.ctx!.currentTime + 0.005, strength * (pad.level / 100), this.ins.get(trackId) ?? this.master!, trackId);
  }
  /** Play one note of a synth track now, for trying a key. */
  note(trackId: string, note: number, seconds = 0.3, velocity = 100): void {
    this.ready();
    this.playNote(this.read(), trackId, note, this.ctx!.currentTime + 0.005, seconds, velocity);
  }
  /** One note of a track at a time: through its sampler when it has one (and the file is loaded), otherwise its synth. */
  private playNote(song: Song, trackId: string, note: number, at: number, seconds: number, velocity: number): void {
    const t = song.tracks.find((x) => x.id === trackId), set = t?.kind === "synth" ? t.sampler : undefined;
    if (!set) { this.engines.get(trackId)?.engine.playAt(note, at, seconds, velocity); return; }
    const buffer = this.kit!.buffer(set.sample), to = this.ins.get(trackId);
    if (buffer && to) playSample(this.ctx!, buffer, set, note, at, velocity, to, seconds);
  }
  /** A key played by hand on a sampler track: down starts the note, up lets it go. Says whether the track has a sampler (so the synth should stay silent). */
  private keys = new Map<string, SampleVoice>();
  samplerKey(trackId: string, note: number, on: boolean, velocity = 100): boolean {
    const t = this.read().tracks.find((x) => x.id === trackId), set = t?.kind === "synth" ? t.sampler : undefined;
    if (!set) return false;
    this.ready();
    const id = `${trackId}:${note}`, ctx = this.ctx!;
    this.keys.get(id)?.release(ctx.currentTime); this.keys.delete(id);
    if (on) { const buffer = this.kit!.buffer(set.sample), to = this.ins.get(trackId); const v = buffer && to ? playSample(ctx, buffer, set, note, ctx.currentTime + 0.003, velocity, to) : undefined; if (v) this.keys.set(id, v); }
    return true;
  }
  /** Where the song was when it was last stopped, in steps: Shift+Space carries on from the start of that bar. */
  stoppedAt = 0;
  /** Play. `from`: the step of the song to start on (ignored while a loop is set: a loop starts at its own beginning). */
  start(from = 0, /** bars of clicks before the song starts (for recording) */ countIn = 0): void {
    if (this.playing) return;
    this.ready();
    const song0 = this.read(), first = this.loop ? 0 : Math.max(0, Math.min(song0.bars * 16 - 1, Math.round(from)));
    const lead = Math.max(0, Math.round(countIn)) * 16 * stepSeconds(song0.bpm), t0 = this.ctx!.currentTime + 0.08;
    for (let k = 0; k < Math.round(countIn) * 4; k++) this.kit!.tick(t0 + k * 4 * stepSeconds(song0.bpm), k % 4 === 0);
    this.began = t0 + lead - stepTime(first, song0.bpm, song0.swing); this.next = first; this.due = []; this.shown = -1;
    this.sync();                                                   // devices that follow the bar (beat repeat) are told where bar 1 now is
    const pump = () => {
      const ctx = this.ctx!, song = this.read();
      if (hasAutomation(song)) { this.place = Math.max(0, this.position()); this.sync(); } else if (this.place >= 0) { this.place = -1; this.sync(); }
      while (this.began + stepTime(this.next, song.bpm, song.swing) < ctx.currentTime + AHEAD) {
        let step = -1;
        for (const e of songEvents(song, this.next, this.next + 1, this.loop)) {
          const at = this.began + e.at;
          if (e.kind === "hit") this.kit!.hit(e.pad, at, e.strength, this.ins.get(e.track) ?? this.master!, e.track);
          else this.playNote(song, e.track, e.note, at, e.seconds, e.velocity);
          step = e.step;
        }
        if (this.click && this.next % 4 === 0) this.kit!.tick(this.began + stepTime(this.next, song.bpm, song.swing), this.next % 16 === 0);
        if (step < 0) { const first = (this.loop?.start ?? 0) * 16, span = (this.loop?.bars ?? song.bars) * 16; step = first + (this.next % span); }
        this.due.push({ step, at: this.began + stepTime(this.next, song.bpm, song.swing) });
        this.next++;
      }
    };
    pump();
    this.timer = window.setInterval(pump, EVERY_MS);
  }
  /** Tempo or swing is about to change: re-anchor so the step being played keeps its place and only the spacing after it changes. */
  retime(before: { bpm: number; swing: number }): void {
    if (!this.playing) return;
    const after = this.read();
    this.began += stepTime(this.next, before.bpm, before.swing) - stepTime(this.next, after.bpm, after.swing);
    this.sync();
  }
  stop(): void {
    if (this.playing) { const at = this.step(); if (at >= 0) this.stoppedAt = at; }
    if (this.timer !== undefined) window.clearInterval(this.timer);
    this.timer = undefined; this.due = []; this.shown = -1;
    for (const e of this.engines.values()) e.engine.stopScheduled();
    if (this.place >= 0) { this.place = -1; this.sync(); }      // back to where the knobs were left
  }
  /** Where the song has got to, in steps and parts of a step (swing left out), or -1 when stopped. For writing down what is played. */
  position(): number {
    if (!this.playing || !this.ctx) return -1;
    const song = this.read(), n = (this.ctx.currentTime - this.began) / stepSeconds(song.bpm);
    if (n < 0) return -1;
    const first = (this.loop?.start ?? 0) * 16, span = (this.loop?.bars ?? song.bars) * 16;
    return first + (n % span);
  }
  /** The step of the song that is sounding now, or -1 when stopped. */
  step(): number {
    if (!this.playing || !this.ctx) return -1;
    while (this.due.length && this.due[0]!.at <= this.ctx.currentTime) this.shown = this.due.shift()!.step;
    return this.shown;
  }
  dispose(): void {
    this.stop();
    for (const e of this.engines.values()) e.engine.dispose();
    this.engines.clear(); this.outs.clear(); this.ins.clear(); this.chains.clear();
    void (this.ctx as { close?: () => Promise<void> } | undefined)?.close?.(); this.ctx = undefined;   // an offline context has nothing to close this.kit = undefined; this.master = undefined;
  }
}
