// Plays a pattern round and round in time. Each step is handed to the audio clock a little before it is due,
// so the beat never depends on how busy the page is. The pattern is read afresh for every step, so an edit
// made while it plays is heard on the next pass of that step.
import { Kit } from "./kit";
import { stepTime, strikes, type Pattern, type Voice } from "./drums";

const AHEAD = 0.12, EVERY_MS = 25;

export class DrumMachine {
  private ctx?: AudioContext;
  private kit?: Kit;
  private timer?: number;
  /** The audio-clock time of step 0 of this run, and the next step (counting on for ever) not yet handed over. */
  private began = 0;
  private next = 0;
  /** Steps handed over but not yet sounding, so the page can show the step that is actually heard. */
  private due: { step: number; at: number }[] = [];
  private shown = -1;
  constructor(private read: () => Pattern) {}
  get playing(): boolean { return this.timer !== undefined; }
  private ready(): Kit {
    if (!this.ctx) { this.ctx = new AudioContext(); this.kit = new Kit(this.ctx); }
    void this.ctx.resume();
    return this.kit!;
  }
  /** Strike one drum now, for trying a sound. */
  audition(voice: Voice, strength = 0.85): void { const kit = this.ready(); kit.hit(voice, this.ctx!.currentTime + 0.005, strength); }
  start(): void {
    if (this.playing) return;
    this.ready();
    this.began = this.ctx!.currentTime + 0.06; this.next = 0; this.due = []; this.shown = -1;
    const pump = () => {
      const ctx = this.ctx!, p = this.read();
      // tempo and swing may have been changed since the last step: keep time from the step last handed over, not from the start
      while (this.began + stepTime(this.next, p.bpm, p.swing) < ctx.currentTime + AHEAD) {
        for (const s of strikes(p, this.next, this.next + 1)) this.kit!.hit(s.voice, this.began + s.at, s.strength);
        this.due.push({ step: this.next % p.length, at: this.began + stepTime(this.next, p.bpm, p.swing) });
        this.next++;
      }
    };
    pump();
    this.timer = window.setInterval(pump, EVERY_MS);
  }
  /** Tempo is about to change: re-anchor so the step being played keeps its place and only the spacing after it changes. */
  retime(before: Pattern): void {
    if (!this.playing || !this.ctx) return;
    const after = this.read();
    this.began += stepTime(this.next, before.bpm, before.swing) - stepTime(this.next, after.bpm, after.swing);
  }
  stop(): void {
    if (this.timer !== undefined) window.clearInterval(this.timer);
    this.timer = undefined; this.due = []; this.shown = -1;
  }
  /** The step that is sounding now, or -1 when stopped. */
  step(): number {
    if (!this.playing || !this.ctx) return -1;
    while (this.due.length && this.due[0]!.at <= this.ctx.currentTime) this.shown = this.due.shift()!.step;
    return this.shown;
  }
  dispose(): void { this.stop(); void this.ctx?.close(); this.ctx = undefined; this.kit = undefined; }
}
