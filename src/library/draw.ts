// "Draw this": a picture for one step of a walkthrough. The guide only chooses WHAT to draw, from a fixed
// catalogue, and supplies settings; the app draws it. The guide never writes a picture or any code. Whatever
// it returns is cleaned here before anything is drawn, and a choice that does not hold up (a formula that
// cannot be read, a range that makes no sense) becomes "nothing to draw" with the reason.
//
// A drawing is always the guide's own, never a book's: the page says so. Each number is marked as stated in
// the step's text or as the guide's choice; a slider's range is always the guide's choice.
import { z } from "zod";
import { compile, RESERVED } from "./formula.js";

export const DRAW_KINDS = ["formula", "envelope", "filter", "harmonics", "lfo", "duck", "none"] as const;
/** "chain" (boxes joined by arrows) was retired: it only repeated a step's words. It stays as a type so walkthroughs saved with one still open. */
export type DrawKind = (typeof DRAW_KINDS)[number] | "chain";

/** What the model returns. Every field is always present; the ones a kind does not use are left empty. */
export const DrawModelSchema = z.object({
  kind: z.enum(DRAW_KINDS).describe("which drawing fits this step; none if no drawing in the catalogue would help"),
  title: z.string().describe("a short name for the drawing"),
  caption: z.string().describe("one or two sentences on what to notice, or, for none, why nothing fits"),
  expression: z.string().describe("formula only: the right-hand side in plain arithmetic, e.g. 10^(-3/(f*T)); empty otherwise"),
  outputLabel: z.string().describe("formula only: what the formula gives, in plain words"),
  outputUnit: z.string().describe("formula only: its unit, or empty"),
  xVariable: z.string().describe("formula only: the variable to put along the bottom of the graph"),
  variables: z.array(z.object({
    name: z.string().describe("the symbol as used in the expression: letters and digits only"),
    label: z.string().describe("what it stands for, in plain words"),
    unit: z.string(), min: z.number(), max: z.number(), value: z.number(),
    stated: z.boolean().describe("true only if this value is stated in the step's text"),
  })).describe("formula: every symbol in the expression. Other kinds: the settings named in the instructions"),
  choice: z.string().describe("filter: low, high, band or notch. harmonics and lfo: sine, triangle, square or saw. Empty otherwise"),
  stages: z.array(z.string()).describe("not used: leave empty"),
});
export type DrawModel = z.infer<typeof DrawModelSchema>;

export interface DrawVar { name: string; label: string; unit: string; min: number; max: number; value: number; /** Stated in the step's text; otherwise the guide's own choice. */ stated: boolean; log?: boolean }
export interface Drawing {
  kind: DrawKind;
  title: string;
  caption: string;
  /** formula */
  expression?: string;
  output?: { label: string; unit: string };
  x?: string;
  variables: DrawVar[];
  /** filter type, or a wave or LFO shape */
  choice?: string;
  stages?: string[];
  /** Shown again from the site's memory, with no new call. */
  remembered?: boolean;
}

/** The settings each ready-made drawing takes: name, label, unit, lowest, highest, and the value used if the guide gives none. */
const SETTINGS: Partial<Record<DrawKind, [string, string, string, number, number, number, boolean?][]>> = {
  envelope: [["attack", "Attack", "ms", 0, 4000, 10], ["decay", "Decay", "ms", 0, 4000, 300], ["sustain", "Sustain", "%", 0, 100, 60], ["release", "Release", "ms", 0, 4000, 400]],
  filter: [["cutoff", "Cutoff", "Hz", 20, 20000, 1000, true], ["resonance", "Resonance", "%", 0, 100, 20]],
  lfo: [["rate", "Rate", "Hz", 0.1, 20, 2, true]],
  harmonics: [],
  duck: [["amount", "How far the bass is turned down", "dB", 0, 24, 12], ["attack", "Attack", "ms", 0, 60, 5], ["release", "Release", "ms", 20, 600, 180], ["tempo", "Tempo", "bpm", 80, 170, 120]],
};
const CHOICES: Partial<Record<DrawKind, string[]>> = { filter: ["low", "high", "band", "notch"], harmonics: ["saw", "square", "triangle", "sine"], lfo: ["sine", "triangle", "square", "saw"] };
export const MAX_VARIABLES = 6, MAX_STAGES = 8;

export const DRAW_SYSTEM = `You choose a drawing for one step of a walkthrough in a private app that teaches sound synthesis, Serum 2 and Ableton Live to a beginner. You are given the step as it was written: each paragraph is marked as what a text says or as the guide's own synthesis. You do not draw anything yourself. You pick one drawing from a fixed catalogue and give its settings; the app draws it.

The catalogue:
- formula: a graph of a formula the step gives, with a slider for each symbol. Use it only when the step contains a formula. Write its right-hand side in "expression" using only + - * / ^, brackets, numbers, pi, e, and these functions: sin cos tan asin acos atan sinh cosh tanh exp ln log (base 10) log2 sqrt abs floor round sign min(a,b) max(a,b) pow(a,b). Write multiplication with *. List every symbol in "variables" with a short name of letters only, what it stands for, its unit, and a range a beginner would actually meet. Put the symbol the step is about in "xVariable".
- envelope: the rise and fall of a level over a note. Variables named attack (ms), decay (ms), sustain (%), release (ms).
- filter: a filter's curve. "choice" is low, high, band or notch. Variables named cutoff (Hz) and resonance (%).
- harmonics: the harmonics of a basic wave. "choice" is sine, triangle, square or saw.
- lfo: a slow repeating movement. "choice" is its shape; a variable named rate (Hz).
- duck: a working model of sidechain compression (ducking): a kick drum turning a bass down on every hit, shown moving and playable so the learner hears it with the ducking on and off. Use it for sidechain compression, ducking or pumping. Variables named amount (dB the bass is turned down), attack (ms), release (ms) and tempo (bpm).
- none: nothing in the catalogue fits. Choose this for anything with a physical shape (an instrument, a loudspeaker, a room), for a screen layout, and whenever a drawing would add nothing. Say why in the caption.

Rules:
- Set "stated" to true only for a value the step's text states. Every other value, and every range, is your own choice; do not present it as the book's.
- The caption says what to look for in the drawing, in one or two plain sentences. Add no fact the step does not contain.
- A drawing must show something the words cannot: a shape, a movement, a sound. Never choose one that would only repeat the step in other words. When in doubt, choose none: no drawing is better than a pointless one.
- Fill every field; leave the ones this drawing does not use empty.`;

const tidy = (text: string, max: number) => text.replace(/\*\*|^#{1,6} /gm, "").replace(/\s+/g, " ").trim().slice(0, max);
const none = (reason: string): Drawing => ({ kind: "none", title: "", caption: reason, variables: [] });
const NAME = /^[A-Za-z][A-Za-z0-9_]{0,11}$/;

/** The guide's choice made safe to draw, or "nothing to draw" with the reason. */
export function cleanDrawing(raw: DrawModel): Drawing {
  const title = tidy(raw.title, 90), caption = tidy(raw.caption, 400);
  if (raw.kind === "none") return none(caption || "The guide found no drawing that would help with this step.");

  if (raw.kind === "formula") {
    const variables: DrawVar[] = [];
    for (const v of raw.variables.slice(0, MAX_VARIABLES)) {
      const name = v.name.trim();
      if (!NAME.test(name) || RESERVED.has(name) || variables.some((x) => x.name === name)) return none(`The formula could not be drawn: "${tidy(v.name, 20)}" cannot be used as a symbol.`);
      if (![v.min, v.max, v.value].every(Number.isFinite) || !(v.max > v.min)) return none(`The formula could not be drawn: the range given for ${name} makes no sense.`);
      const value = Math.min(v.max, Math.max(v.min, v.value));
      variables.push({ name, label: tidy(v.label, 60) || name, unit: tidy(v.unit, 16), min: v.min, max: v.max, value, stated: v.stated === true && value === v.value, ...(v.min > 0 && v.max / v.min >= 100 ? { log: true } : {}) });
    }
    if (!variables.length || raw.variables.length > MAX_VARIABLES) return none("The formula could not be drawn: it has no symbols to move, or too many.");
    const expression = raw.expression.trim();
    const read = compile(expression, variables.map((v) => v.name));
    if (!read.ok) return none(`The formula could not be drawn: ${read.reason}.`);
    const x = variables.some((v) => v.name === raw.xVariable.trim()) ? raw.xVariable.trim() : variables[0]!.name;
    // it has to give real numbers over most of the graph, or there is nothing to look at
    const xv = variables.find((v) => v.name === x)!, at = Object.fromEntries(variables.map((v) => [v.name, v.value]));
    let real = 0;
    for (let i = 0; i <= 40; i++) if (Number.isFinite(read.fn({ ...at, [x]: sweep(xv, i / 40) }))) real++;
    if (real < 24) return none("The formula could not be drawn: it gives no real numbers over the range chosen.");
    return { kind: "formula", title: title || "The formula", caption, expression, output: { label: tidy(raw.outputLabel, 60) || "Result", unit: tidy(raw.outputUnit, 16) }, x, variables };
  }

  const settings = SETTINGS[raw.kind] ?? [];
  const variables: DrawVar[] = settings.map(([name, label, unit, min, max, fallback, log]) => {
    const given = raw.variables.find((v) => v.name.trim().toLowerCase() === name);
    const ok = !!given && Number.isFinite(given.value);
    const value = ok ? Math.min(max, Math.max(min, given!.value)) : fallback;
    return { name, label, unit, min, max, value, stated: ok && given!.stated === true && value === given!.value, ...(log ? { log: true } : {}) };
  });
  const allowed = CHOICES[raw.kind];
  const choice = allowed ? (allowed.includes(raw.choice.trim().toLowerCase()) ? raw.choice.trim().toLowerCase() : undefined) : undefined;
  if (allowed && !choice) return none(`The drawing could not be made: "${tidy(raw.choice, 20)}" is not one of ${allowed.join(", ")}.`);
  return { kind: raw.kind, title: title || raw.kind, caption, variables, ...(choice ? { choice } : {}) };
}

/** A variable's value at a fraction of the way along its range: evenly, or by ratio for a range spanning many times its start. */
export const sweep = (v: Pick<DrawVar, "min" | "max" | "log">, t: number) => (v.log ? v.min * (v.max / v.min) ** t : v.min + (v.max - v.min) * t);
/** The other way: where in its range (0..1) a value sits. */
export const place = (v: Pick<DrawVar, "min" | "max" | "log">, value: number) => (v.log ? Math.log(value / v.min) / Math.log(v.max / v.min) : (value - v.min) / (v.max - v.min));

/** The levels of the first `count` harmonics of a basic wave (the largest is 1). */
export function waveHarmonics(shape: string, count = 16): number[] {
  return Array.from({ length: count }, (_, i) => { const n = i + 1; return shape === "saw" ? 1 / n : shape === "square" ? (n % 2 ? 1 / n : 0) : shape === "triangle" ? (n % 2 ? 1 / (n * n) : 0) : n === 1 ? 1 : 0; });
}

/**
 * Ducking, as the working model draws and plays it: how much of the bass is let through, `t` seconds after a
 * kick lands. It is turned down by `amountDb` over the attack time, held there while the kick's thump lasts,
 * then let back up over the release time (to within a hair of full after about three release times). This is
 * a simplified picture of a sidechain compressor, not a model of any product's detector circuit.
 */
export const KICK_HOLD = 0.05;
export function duckGain(t: number, amountDb: number, attackMs: number, releaseMs: number): number {
  if (!(t >= 0) || !(amountDb > 0)) return 1;
  const floor = 10 ** (-amountDb / 20), attack = Math.max(0.0005, attackMs / 1000), release = Math.max(0.005, releaseMs / 1000);
  if (t < attack) return 1 - (1 - floor) * (t / attack);
  if (t < attack + KICK_HOLD) return floor;
  return 1 - (1 - floor) * Math.exp((-(t - attack - KICK_HOLD) * 3) / release);
}
/** The same over a repeating beat: the gain at time `t` when a kick lands every `beat` seconds (the last two kicks count). */
export function duckGainLooped(t: number, beat: number, amountDb: number, attackMs: number, releaseMs: number): number {
  const since = ((t % beat) + beat) % beat;
  return Math.min(duckGain(since, amountDb, attackMs, releaseMs), duckGain(since + beat, amountDb, attackMs, releaseMs));
}
