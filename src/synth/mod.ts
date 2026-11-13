// Envelopes and LFOs as modulation sources: what they are called, their colours, where they can be sent, and
// how far a given amount moves a destination. Pure data and maths; the engine and the knob rings share it.
import type { Dest, SynthState } from "./params";

export type ModSource = "env2" | "lfo1" | "lfo2" | "lfo3";
export interface SourceInfo { id: ModSource; name: string; kind: "env" | "lfo"; color: string }
/** Each source has its own neon colour; a knob it moves wears a ring of that colour. */
export const SOURCES: SourceInfo[] = [
  { id: "env2", name: "Env 2", kind: "env", color: "#ffe14a" },
  { id: "lfo1", name: "LFO 1", kind: "lfo", color: "#3df5ff" },
  { id: "lfo2", name: "LFO 2", kind: "lfo", color: "#7dff5c" },
  { id: "lfo3", name: "LFO 3", kind: "lfo", color: "#ff9a3d" },
];
/** Envelope 1 always shapes the level of every note; it has a colour for its panel but is not routed. */
export const ENV1_COLOR = "#ff5cb4";

export type ModDest = Dest;

export interface Route {
  source: SourceInfo; dest: Exclude<ModDest, "none">; amount: number;
  /** True when the source only pushes one way from the knob: every envelope, and an LFO set to "one way". */
  oneWay: boolean;
}

/** The connections that are in use: a source with a destination chosen. */
export function routes(s: SynthState): Route[] {
  return SOURCES.flatMap((source) => {
    const dest = s[`${source.id}Dest`], amount = s[`${source.id}Amount`];
    const oneWay = source.kind === "env" || s[`${source.id as "lfo1"}Way`] === "up";
    return dest === "none" ? [] : [{ source, dest, amount, oneWay }];
  });
}
/** The sources moving one setting, for drawing its rings. Sources with an amount of zero do nothing. */
export const routesTo = (s: SynthState, id: keyof SynthState) => routes(s).filter((r) => r.dest === id && r.amount !== 0);

/** At an amount of 100%, cutoff moves this many octaves and pitch this many semitones (each way, for an LFO). */
export const CUTOFF_OCTAVES = 5;
export const PITCH_SEMITONES = 12;
/** ...and an LFO's rate this many octaves (so it can run from a quarter to four times its set speed). */
export const RATE_OCTAVES = 2;
export const isLevel = (dest: ModDest) => dest.endsWith("LevelDb");

/**
 * How far a route moves its destination at the source's peak: in cents for cutoff and pitch, and as a
 * fraction of the destination's own level for levels (1 means "from silence to twice as much").
 */
export function modDepth(dest: ModDest, amount: number): number {
  const a = amount / 100;
  if (dest === "cutoff") return a * CUTOFF_OCTAVES * 1200;
  if (dest === "fine" || dest === "bFine") return a * PITCH_SEMITONES * 100;
  if (dest === "lfo1Rate") return a * RATE_OCTAVES * 1200;
  return dest === "none" ? 0 : a;
}

export interface Adsr { attack: number; decay: number; sustain: number; release: number }
/** Envelope times are stored in milliseconds and sustain in percent; this gives seconds and a 0..1 level. */
export const adsr = (s: SynthState, which: 1 | 2): Adsr => (which === 1
  ? { attack: s.envA / 1000, decay: s.envD / 1000, sustain: s.envS / 100, release: s.envR / 1000 }
  : { attack: s.env2A / 1000, decay: s.env2D / 1000, sustain: s.env2S / 100, release: s.env2R / 1000 });

/**
 * The level of an envelope `t` seconds after a note starts, for a note held `held` seconds. Attack is a
 * straight line; decay and release ease toward their target, as the audio does (a quarter of the knob time
 * is the time constant, so the stage is effectively finished when the knob time has passed).
 */
export function envLevel(e: Adsr, t: number, held: number): number {
  const during = (x: number) => (x < e.attack ? x / e.attack : e.sustain + (1 - e.sustain) * Math.exp(-(x - e.attack) / Math.max(1e-4, e.decay / 4)));
  if (t <= held) return during(Math.max(0, t));
  return during(held) * Math.exp(-(t - held) / Math.max(1e-4, e.release / 4));
}

/** One cycle of an LFO shape at position `t` (0..1), from -1 to 1. Matches the browser's oscillator shapes. */
export function lfoValue(shape: SynthState["lfo1Shape"], t: number): number {
  const x = t - Math.floor(t);
  switch (shape) {
    case "sine": return Math.sin(2 * Math.PI * x);
    case "triangle": return x < 0.25 ? 4 * x : x < 0.75 ? 2 - 4 * x : 4 * x - 4;
    case "saw": return x < 0.5 ? 2 * x : 2 * x - 2;
    case "square": return x < 0.5 ? 1 : -1;
  }
}
