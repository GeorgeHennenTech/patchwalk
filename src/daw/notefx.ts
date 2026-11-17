// Note effects: devices that sit in front of a synth track's instrument and change the notes before they are
// played (the Studio's versions of a DAW's MIDI effects). Plain data and rules; nothing here makes sound.
// They work on the notes written in a clip, in sixteenth steps from the clip's start. Our own rules, named
// for what they do.
import { arpCycle, type ArpMode } from "../synth/arp";
import type { Device, DeviceSpec, ParamSpec } from "./devices";

/** A note as a clip holds it. After note effects, starts and lengths need not be whole steps. */
export interface FxNote { note: number; start: number; length: number; velocity: number }

const KEYS = ["C", "C#", "D", "D#", "E", "F", "F#", "G", "G#", "A", "A#", "B"];
/** The scales a note can be kept to, as semitones above the key note. */
export const SCALES: { name: string; steps: number[] }[] = [
  { name: "Major", steps: [0, 2, 4, 5, 7, 9, 11] }, { name: "Minor", steps: [0, 2, 3, 5, 7, 8, 10] }, { name: "Dorian", steps: [0, 2, 3, 5, 7, 9, 10] }, { name: "Mixolydian", steps: [0, 2, 4, 5, 7, 9, 10] },
  { name: "Harmonic minor", steps: [0, 2, 3, 5, 7, 8, 11] }, { name: "Major pentatonic", steps: [0, 2, 4, 7, 9] }, { name: "Minor pentatonic", steps: [0, 3, 5, 7, 10] }, { name: "Blues", steps: [0, 3, 5, 6, 7, 10] },
];
export const ARP_STYLES = ["Up", "Down", "Up and down", "As written", "Random"];
export const ARP_RATES = [{ name: "1/32", steps: 0.5 }, { name: "1/16 triplet", steps: 2 / 3 }, { name: "1/16", steps: 1 }, { name: "1/8 triplet", steps: 4 / 3 }, { name: "1/8", steps: 2 }, { name: "1/4", steps: 4 }];
const num = (id: string, label: string, min: number, max: number, def: number, extra: Partial<ParamSpec> = {}): ParamSpec => ({ id, label, min, max, step: 1, def, ...extra });
const menu = (id: string, label: string, choices: string[], def = 0, extra: Partial<ParamSpec> = {}): ParamSpec => ({ id, label, min: 0, max: choices.length - 1, step: 1, def, choices, ...extra });

export const NOTE_FX: DeviceSpec[] = [
  { kind: "n-arp", midi: true, name: "Arpeggiator", like: "Arpeggiator", note: "It plays the notes written in the clip, not keys played live. It starts again whenever the held notes change.", about: "Turns held notes into a run: one note at a time, up, down or at random, at a speed you choose.", params: [
    menu("style", "Order", ARP_STYLES), menu("rate", "Speed", ARP_RATES.map((r) => r.name), 2), num("gate", "Note length", 10, 200, 80, { unit: "%" }), num("octaves", "Octaves", 1, 3, 1),
  ] },
  { kind: "n-chord", midi: true, name: "Chord", like: "Chord", about: "Adds up to four notes to every note, each a set number of semitones away, so one note plays a chord.", params: [
    num("shift1", "Note 2 (semitones)", -24, 24, 4), num("shift2", "Note 3 (semitones)", -24, 24, 7), num("shift3", "Note 4 (semitones)", -24, 24, 0), num("shift4", "Note 5 (semitones)", -24, 24, 0),
  ] },
  { kind: "n-length", midi: true, name: "Note length", like: "Note Length", about: "Makes every note the same length, or a percentage of what was written.", params: [
    menu("mode", "Mode", ["Fixed", "Percent"]), { id: "steps", label: "Length (sixteenths)", min: 0.25, max: 16, step: 0.25, def: 1, when: (p) => !p.mode }, num("percent", "Of the written length", 10, 200, 50, { unit: "%", when: (p) => !!p.mode }),
  ] },
  { kind: "n-pitch", midi: true, name: "Pitch", like: "Pitch", about: "Moves every note up or down by a number of semitones.", params: [num("semis", "Semitones", -48, 48, 12)] },
  { kind: "n-random", midi: true, name: "Random", like: "Random", note: "The dice are the same every time the clip plays, so a pattern you like stays.", about: "Moves some notes by a random number of semitones. Follow it with Scale to keep the surprises in key.", params: [
    num("chance", "Chance", 0, 100, 50, { unit: "%" }), num("range", "Up to (semitones)", 1, 24, 12), menu("way", "Direction", ["Up", "Down", "Both"], 2),
  ] },
  { kind: "n-scale", midi: true, name: "Scale", like: "Scale", about: "Keeps every note in a key: a note outside the scale moves to the nearest note inside it.", params: [menu("root", "Key", KEYS), menu("scale", "Scale", SCALES.map((s) => s.name))] },
  { kind: "n-velocity", midi: true, name: "Velocity", like: "Velocity", about: "Squeezes or stretches how hard notes are played, and can add a little randomness to it.", params: [
    num("low", "Softest becomes", 1, 127, 1), num("high", "Hardest becomes", 1, 127, 127), num("random", "Random, up to", 0, 64, 0),
  ] },
];

/** A repeatable random number from 0 to 1 made from two whole numbers. */
export function dice(a: number, b: number): number {
  let x = (Math.imul(a + 1, 2654435761) ^ Math.imul(b + 7, 40503)) >>> 0; x = Math.imul(x ^ (x >>> 15), 2246822519) >>> 0; x = Math.imul(x ^ (x >>> 13), 3266489917) >>> 0;
  return ((x ^ (x >>> 16)) >>> 0) / 4294967296;
}
/** The nearest note that is in the scale; a note exactly between two goes down. */
export function toScale(note: number, root: number, steps: readonly number[]): number {
  const inScale = (n: number) => steps.includes((((n - root) % 12) + 12) % 12);
  for (let d = 0; d < 12; d++) { if (inScale(note - d)) return note - d; if (inScale(note + d)) return note + d; }
  return note;
}
const clampVel = (v: number) => Math.min(127, Math.max(1, Math.round(v)));
const inRange = (n: FxNote) => n.note >= 0 && n.note <= 127 && n.length > 0;

/** The arpeggiator: at each tick, the next of the notes held at that moment. */
export function arpeggiate(notes: readonly FxNote[], p: Record<string, number>, steps: number): FxNote[] {
  const rate = (ARP_RATES[p.rate ?? 2] ?? ARP_RATES[2]!).steps, style = p.style ?? 0, mode: ArpMode = (["up", "down", "updown", "played", "played"] as const)[style] ?? "up";
  const out: FxNote[] = []; let index = 0, was = "";
  for (let k = 0; k * rate < steps - 1e-9; k++) {
    const t = k * rate, held = notes.filter((n) => n.start <= t + 1e-9 && t < n.start + n.length - 1e-9), sig = held.map((n) => n.note).join(",");
    if (!held.length) { was = ""; index = 0; continue; }
    if (sig !== was) { was = sig; index = 0; }
    const cycle = arpCycle(held.map((n) => n.note), mode, p.octaves ?? 1), pick = style === 4 ? Math.floor(dice(k, cycle.length) * cycle.length) : index % cycle.length, note = cycle[pick]!;
    const from = held.find((n) => (note - n.note) % 12 === 0 && note >= n.note) ?? held[0]!;
    out.push({ note, start: t, length: Math.min(rate * ((p.gate ?? 80) / 100), steps - t), velocity: from.velocity }); index++;
  }
  return out;
}

/** One note effect applied to a clip's notes. `steps` is the clip's length in sixteenths. */
export function applyOne(d: Device, notes: readonly FxNote[], steps: number): FxNote[] {
  const p = d.p;
  switch (d.kind) {
    case "n-pitch": return notes.map((n) => ({ ...n, note: n.note + (p.semis ?? 0) }));
    case "n-velocity": return notes.map((n, i) => ({ ...n, velocity: clampVel((p.low ?? 1) + ((n.velocity - 1) / 126) * ((p.high ?? 127) - (p.low ?? 1)) + (dice(i, Math.round(n.start * 4)) * 2 - 1) * (p.random ?? 0)) }));
    case "n-random": return notes.map((n, i) => { if (dice(i, Math.round(n.start * 4) + 1000) >= (p.chance ?? 50) / 100) return n; const by = 1 + Math.floor(dice(i + 31, n.note) * (p.range ?? 12)), up = p.way === 0 || (p.way !== 1 && dice(i + 97, n.note) < 0.5); return { ...n, note: n.note + (up ? by : -by) }; });
    case "n-scale": return notes.map((n) => ({ ...n, note: toScale(n.note, p.root ?? 0, (SCALES[p.scale ?? 0] ?? SCALES[0]!).steps) }));
    case "n-chord": return notes.flatMap((n) => [n, ...[p.shift1, p.shift2, p.shift3, p.shift4].filter((s): s is number => !!s).map((s) => ({ ...n, note: n.note + s }))]);
    case "n-length": return notes.map((n) => ({ ...n, length: Math.min(steps - n.start, p.mode ? n.length * ((p.percent ?? 50) / 100) : p.steps ?? 1) }));
    case "n-arp": return arpeggiate(notes, p, steps);
    default: return [...notes];
  }
}
/** A chain of note effects applied in order (devices switched off are passed by). Notes pushed off the keyboard are dropped. */
export function applyNoteFx(chain: readonly Device[], notes: readonly FxNote[], steps: number): FxNote[] {
  let out: FxNote[] = [...notes];
  for (const d of chain) if (d.on) out = applyOne(d, out, steps).filter(inRange);
  return out.sort((a, b) => a.start - b.start || a.note - b.note);
}
