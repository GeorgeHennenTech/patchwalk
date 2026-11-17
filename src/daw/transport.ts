// Plays a song: every track on one audio clock. Each step is handed to the clock a little before it is due,
// so the beat never depends on how busy the page is, and the song is read afresh for every step, so an edit
// made while it plays is heard the next time that step comes round.
import { Engine } from "../synth/engine";
import { Kit } from "./kit";
import { audibleOf, stepSeconds, stepTime, type Pad } from "./drums";
import { chainShape, type Device } from "./devices";
import { chainReady, prepareDevices } from "./fxnodes";
import { buildDevice, type LiveDevice } from "./fxnodes";
import { songEvents, type Song } from "./song";

const AHEAD = 0.12, EVERY_MS = 25;
export interface Loop { start: number; bars: number }

export class Transport {
  ctx?: AudioContext;
  private kit?: Kit;
  private master?: GainNode;
  /** Per track: where its instrument plays into, its effects, and its level. Instrument -> ins -> effects -> outs -> master. */
  private ins = new Map<string, GainNode>();
  private outs = new Map<string, GainNode>();
  private chains = new Map<string, { shape: string; live: Map<string, LiveDevice>; /** what the track's input was plugged into */ first: AudioNode; /** sidechain wires: from another track's input to a device here */ sides: [AudioNode, AudioNode][] }>();
  private meterL?: AnalyserNode;
  private meterR?: AnalyserNode;
  private engines = new Map<string, { engine: Engine; patch: unknown }>();
  private timer?: number;
  /** The audio-clock time of step 0 of this run, and the next step (counting on for ever) not yet handed over. */
  private began = 0;
  private next = 0;
  private due: { step: number; at: number }[] = [];
  private shown = -1;
  loop?: Loop;
  /** The metronome: a click on every beat while the song plays. */
  click = false;
  constructor(private read: () => Song) {}
  get playing(): boolean { return this.timer !== undefined; }
  private boot(): void {
    if (this.ctx) return;
    this.ctx = new AudioContext();
    this.master = this.ctx.createGain(); this.master.gain.value = 0.9; this.master.connect(this.ctx.destination);
    const split = this.ctx.createChannelSplitter(2);
    this.meterL = this.ctx.createAnalyser(); this.meterR = this.ctx.createAnalyser();
    this.meterL.fftSize = this.meterR.fftSize = 2048;
    this.master.connect(split); split.connect(this.meterL, 0); split.connect(this.meterR, 1);
    this.kit = new Kit(this.ctx, this.master);
    void prepareDevices(this.ctx).then(() => this.sync(), () => undefined);
  }
  /** Bring the audio in line with the song: a gain per track, a synth per synth track, levels, mutes and sounds. */
  sync(): void {
    if (!this.ctx) return;
    const ctx = this.ctx, song = this.read(), on = audibleOf(song.tracks), t = ctx.currentTime;
    for (const track of song.tracks) if (!this.outs.has(track.id)) { const out = ctx.createGain(); out.gain.value = 0; out.connect(this.master!); this.outs.set(track.id, out); this.ins.set(track.id, ctx.createGain()); }
    song.tracks.forEach((track, i) => {
      const out = this.outs.get(track.id)!, input = this.ins.get(track.id)!;
      out.gain.setTargetAtTime(on[i] ? track.level / 80 : 0, t, 0.015);
      // The effects: wired again only when a device is added, removed or moved, or told to listen to a different
      // track; a setting is changed in place. "~": some devices are still loading and are passed by until they are.
      const listens = (d: Device) => ((d.p.side ?? 0) > 0 ? song.tracks[d.p.side! - 1]?.id : undefined);
      const shape = chainShape(track.devices) + (chainReady(ctx, track.devices) ? "" : "~") + track.devices.map((d) => `@${listens(d) ?? ""}`).join(""), have0 = this.chains.get(track.id);
      if (!have0 || have0.shape !== shape) {
        if (have0) { try { input.disconnect(have0.first); } catch { /* already apart */ } for (const [from, to] of have0.sides) { try { from.disconnect(to, 0, 1); } catch { /* already apart */ } } have0.live.forEach((l) => l.dispose()); }
        const live = new Map<string, LiveDevice>(), sides: [AudioNode, AudioNode][] = [];
        let from: AudioNode = input, first: AudioNode | undefined;
        for (const d of track.devices) { const l = buildDevice(ctx, d, song.bpm, this.began); if (!l) continue; from.connect(l.input); first ??= l.input; from = l.output; live.set(d.id, l);
          const heard = listens(d), source = heard ? this.ins.get(heard) : undefined;       // a sidechain: the other track's sound before its effects and level
          if (l.side && source) { source.connect(l.side, 0, 1); sides.push([source, l.side]); } }
        from.connect(out);
        this.chains.set(track.id, { shape, live, first: first ?? out, sides });
      } else for (const d of track.devices) have0.live.get(d.id)?.update(d, song.bpm, this.began);
      if (track.kind !== "synth") return;
      const have = this.engines.get(track.id);
      if (!have) { const engine = new Engine(track.patch, ctx, input); if (ctx.state === "running") void engine.start(); this.engines.set(track.id, { engine, patch: track.patch }); }
      else if (have.patch !== track.patch) { have.engine.update(track.patch); have.patch = track.patch; }
    });
    for (const [id, out] of this.outs) {
      if (song.tracks.some((x) => x.id === id)) continue;
      const e = this.engines.get(id);
      if (e) { e.engine.stopScheduled(); e.engine.dispose(); this.engines.delete(id); }
      out.disconnect(); this.outs.delete(id); this.ins.get(id)?.disconnect(); this.ins.delete(id); this.chains.get(id)?.live.forEach((l) => l.dispose()); this.chains.delete(id);
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
  peaks(id: string, n?: number): number[] { return this.kit?.peaks(id, n) ?? []; }
  seconds(id: string): number { return this.kit?.seconds(id) ?? 0; }
  /** How loud the left and right sides of everything are right now, in dB (very low when silent). */
  levels(): { left: number; right: number } {
    const read = (a?: AnalyserNode) => { if (!a) return -120; const b = new Float32Array(a.fftSize); a.getFloatTimeDomainData(b); let s = 0; for (const v of b) s += v * v; return 10 * Math.log10(s / b.length + 1e-12); };
    return { left: read(this.meterL), right: read(this.meterR) };
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
    this.engines.get(trackId)?.engine.playAt(note, this.ctx!.currentTime + 0.005, seconds, velocity);
  }
  start(): void {
    if (this.playing) return;
    this.ready();
    this.began = this.ctx!.currentTime + 0.08; this.next = 0; this.due = []; this.shown = -1;
    this.sync();                                                   // devices that follow the bar (beat repeat) are told where bar 1 now is
    const pump = () => {
      const ctx = this.ctx!, song = this.read();
      while (this.began + stepTime(this.next, song.bpm, song.swing) < ctx.currentTime + AHEAD) {
        let step = -1;
        for (const e of songEvents(song, this.next, this.next + 1, this.loop)) {
          const at = this.began + e.at;
          if (e.kind === "hit") this.kit!.hit(e.pad, at, e.strength, this.ins.get(e.track) ?? this.master!, e.track);
          else this.engines.get(e.track)?.engine.playAt(e.note, at, e.seconds, e.velocity);
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
    if (this.timer !== undefined) window.clearInterval(this.timer);
    this.timer = undefined; this.due = []; this.shown = -1;
    for (const e of this.engines.values()) e.engine.stopScheduled();
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
    void this.ctx?.close(); this.ctx = undefined; this.kit = undefined; this.master = undefined;
  }
}
