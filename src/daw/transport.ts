// Plays a song: every track on one audio clock. Each step is handed to the clock a little before it is due,
// so the beat never depends on how busy the page is, and the song is read afresh for every step, so an edit
// made while it plays is heard the next time that step comes round.
import { Engine } from "../synth/engine";
import { Kit } from "./kit";
import { audibleOf, stepTime, type Pad } from "./drums";
import { songEvents, type Song } from "./song";

const AHEAD = 0.12, EVERY_MS = 25;
export interface Loop { start: number; bars: number }

export class Transport {
  ctx?: AudioContext;
  private kit?: Kit;
  private master?: GainNode;
  private outs = new Map<string, GainNode>();
  private engines = new Map<string, { engine: Engine; patch: unknown }>();
  private timer?: number;
  /** The audio-clock time of step 0 of this run, and the next step (counting on for ever) not yet handed over. */
  private began = 0;
  private next = 0;
  private due: { step: number; at: number }[] = [];
  private shown = -1;
  loop?: Loop;
  constructor(private read: () => Song) {}
  get playing(): boolean { return this.timer !== undefined; }
  private boot(): void {
    if (this.ctx) return;
    this.ctx = new AudioContext();
    this.master = this.ctx.createGain(); this.master.gain.value = 0.9; this.master.connect(this.ctx.destination);
    this.kit = new Kit(this.ctx, this.master);
  }
  /** Bring the audio in line with the song: a gain per track, a synth per synth track, levels, mutes and sounds. */
  sync(): void {
    if (!this.ctx) return;
    const ctx = this.ctx, song = this.read(), on = audibleOf(song.tracks), t = ctx.currentTime;
    song.tracks.forEach((track, i) => {
      let out = this.outs.get(track.id);
      if (!out) { out = ctx.createGain(); out.gain.value = 0; out.connect(this.master!); this.outs.set(track.id, out); }
      out.gain.setTargetAtTime(on[i] ? track.level / 80 : 0, t, 0.015);
      if (track.kind !== "synth") return;
      const have = this.engines.get(track.id);
      if (!have) { const engine = new Engine(track.patch, ctx, out); if (ctx.state === "running") void engine.start(); this.engines.set(track.id, { engine, patch: track.patch }); }
      else if (have.patch !== track.patch) { have.engine.update(track.patch); have.patch = track.patch; }
    });
    for (const [id, out] of this.outs) {
      if (song.tracks.some((x) => x.id === id)) continue;
      const e = this.engines.get(id);
      if (e) { e.engine.stopScheduled(); e.engine.dispose(); this.engines.delete(id); }
      out.disconnect(); this.outs.delete(id);
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
  /** Strike one pad now, for trying a sound. */
  hitPad(trackId: string, pad: Pad, strength = 0.85): void {
    this.ready();
    this.kit!.hit(pad, this.ctx!.currentTime + 0.005, strength * (pad.level / 100), this.outs.get(trackId) ?? this.master!, trackId);
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
    const pump = () => {
      const ctx = this.ctx!, song = this.read();
      while (this.began + stepTime(this.next, song.bpm, song.swing) < ctx.currentTime + AHEAD) {
        let step = -1;
        for (const e of songEvents(song, this.next, this.next + 1, this.loop)) {
          const at = this.began + e.at;
          if (e.kind === "hit") this.kit!.hit(e.pad, at, e.strength, this.outs.get(e.track) ?? this.master!, e.track);
          else this.engines.get(e.track)?.engine.playAt(e.note, at, e.seconds, e.velocity);
          step = e.step;
        }
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
  }
  stop(): void {
    if (this.timer !== undefined) window.clearInterval(this.timer);
    this.timer = undefined; this.due = []; this.shown = -1;
    for (const e of this.engines.values()) e.engine.stopScheduled();
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
    this.engines.clear(); this.outs.clear();
    void this.ctx?.close(); this.ctx = undefined; this.kit = undefined; this.master = undefined;
  }
}
