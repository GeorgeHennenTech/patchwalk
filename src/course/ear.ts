// Blind ear checks: short listening questions made by code at the end of a lesson. Each kind says what is
// asked, which answers are offered, and how to make one question (the sounds to play and the right answer).
// The sounds are whole numbers and settings the app chose, so the answer is known exactly.
import { INITIAL, noteToHz, SHAPES, type Shape, type SynthState } from "../synth/params";

export type EarKind = "shape" | "higher" | "brighter" | "filterType" | "movement";
export interface EarTone { shape?: Shape; hz?: number; patch?: SynthState; note?: number; seconds: number; at: number }
export interface EarQuestion { answer: string; tones: EarTone[] }
export interface EarSpec { ask: string; options: string[]; label: (option: string) => string; make: (rand?: () => number) => EarQuestion }

const pick = (rand: () => number, n: number) => Math.min(n - 1, Math.floor(rand() * n));
const SAW: SynthState = { ...INITIAL, shape: "saw" };
const FILTER_NAMES: Record<string, string> = { low: "Low-pass", high: "High-pass", band: "Band-pass" };
const MOVES: Record<string, string> = { aLevelDb: "Tremolo (loudness)", fine: "Vibrato (pitch)" };

export const EAR: Record<EarKind, EarSpec> = {
  shape: {
    ask: "A wave shape is played with the controls hidden. Which one is it?", options: [...SHAPES], label: (o) => o,
    make: (rand = Math.random) => { const answer = SHAPES[pick(rand, 4)]!; return { answer, tones: [{ shape: answer, hz: noteToHz(48 + pick(rand, 25)), seconds: 0.9, at: 0 }] }; },
  },
  higher: {
    ask: "Two tones are played one after the other. Which is higher?", options: ["first", "second"], label: (o) => `The ${o}`,
    make: (rand = Math.random) => {
      const a = noteToHz(52 + pick(rand, 20)), up = rand() < 0.5, ratio = 2 ** ((1 + pick(rand, 6)) / 12);
      return { answer: up ? "second" : "first", tones: [{ shape: "sine", hz: a, seconds: 0.7, at: 0 }, { shape: "sine", hz: up ? a * ratio : a / ratio, seconds: 0.7, at: 0.85 }] };
    },
  },
  // the same note twice through a low-pass filter, the cutoffs at least an octave apart
  brighter: {
    ask: "The same note is played twice through a low-pass filter. Which one has the higher cutoff: which is brighter?", options: ["first", "second"], label: (o) => `The ${o}`,
    make: (rand = Math.random) => {
      const note = 45 + pick(rand, 12), low = 300 * 2 ** (rand() * 2), high = low * 2 ** (1 + rand() * 1.5), up = rand() < 0.5;
      const tone = (cutoff: number, at: number): EarTone => ({ patch: { ...SAW, filterOn: true, filterType: "low", cutoff }, note, seconds: 0.8, at });
      return { answer: up ? "second" : "first", tones: [tone(up ? low : high, 0), tone(up ? high : low, 1)] };
    },
  },
  // a plain saw, then the same note through one of three filter types
  filterType: {
    ask: "A plain saw is played, then the same note through a filter. Which type of filter is it?", options: ["low", "high", "band"], label: (o) => FILTER_NAMES[o]!,
    make: (rand = Math.random) => {
      const answer = (["low", "high", "band"] as const)[pick(rand, 3)]!, note = 45 + pick(rand, 12);
      return { answer, tones: [{ patch: SAW, note, seconds: 0.8, at: 0 }, { patch: { ...SAW, filterOn: true, filterType: answer, cutoff: 700 * 2 ** rand(), resonance: 15 }, note, seconds: 1, at: 1 }] };
    },
  },
  // one LFO, sent either to loudness or to pitch
  movement: {
    ask: "A note is played with an LFO moving one thing. Is it the loudness or the pitch?", options: ["aLevelDb", "fine"], label: (o) => MOVES[o]!,
    make: (rand = Math.random) => {
      const answer = rand() < 0.5 ? "aLevelDb" : "fine";
      return { answer, tones: [{ patch: { ...INITIAL, shape: "triangle", lfo1Dest: answer, lfo1Amount: answer === "fine" ? 50 : 70, lfo1Rate: 4 + pick(rand, 4) }, note: 57 + pick(rand, 12), seconds: 2, at: 0 }] };
    },
  },
};
