// The macro chapter. Most lessons here are "recipes": a named macro built from two or three slots, then swept
// and parked. A recipe is a few lines of data, and `recipe()` turns it into a full lesson, so adding another
// combination is cheap. The owner wants many of these: add to RECIPES. Scripts are in docs/lessons/.
import { applyMacros } from "../../synth/macros";
import { INITIAL, PARAMS, type SynthState } from "../../synth/params";
import type { DemoTone, LessonStep, MatchRound, Panel, PlayableLesson, Snapshot } from "../types";

const struck = (s: Snapshot) => s.played.mouse + s.played.keys + s.played.midi;
/** A knob's name as the learner sees it in a sentence ("Osc A level", not the bare "A level" printed inside its panel). */
const label = (id: string) => ({ aLevelDb: "Osc A level", bLevelDb: "Osc B level" } as Record<string, string>)[id] ?? PARAMS[id]!.label;
/** A value with its unit, for remarks. */
function shown(id: string, v: number): string {
  const unit = PARAMS[id]!.unit ?? "";
  if (id === "cutoff") return v >= 1000 ? `${(v / 1000).toFixed(2)} kHz` : `${Math.round(v)} Hz`;
  if (unit === "ms") return v >= 1000 ? `${(v / 1000).toFixed(2)} s` : `${Math.round(v)} ms`;
  if (id.endsWith("Rate")) return `${v.toFixed(1)} Hz`;
  return `${v}${unit === "%" ? "%" : unit ? ` ${unit}` : ""}`;
}
const dest = (s: Snapshot, k: number) => (s.state as unknown as Record<string, string>)[`macro1Dest${k}`];
const amt = (s: Snapshot, k: number) => (s.state as unknown as Record<string, number>)[`macro1Amt${k}`]!;

interface Slot { to: keyof SynthState; amount: number; hear: string }
interface Recipe {
  id: string; title: string; minutes: number; name: string; buildsOn: string[]; cardIds: string[];
  outcome: string; idea: [string, string];
  /** Where the patch starts. The macro's slots start empty; the learner wires them. */
  initial: Partial<SynthState>;
  slots: Slot[];
  /** Notes are struck and let go (for envelope recipes) instead of held with Hold. */
  strike?: boolean;
  /** Extra things to show while sweeping, such as the filter curve. */
  views?: Panel[];
  sweep: string;
  recap: [string, string, string];
  inSerum?: string;
}

/** The macro's slots as settings: what the learner ends up with. */
const wired = (r: Recipe, value: number): Partial<SynthState> => ({
  ...r.initial, macro1: value, macro1Name: r.name,
  ...Object.fromEntries(r.slots.flatMap((slot, i) => [[`macro1Dest${i + 1}`, slot.to], [`macro1Amt${i + 1}`, slot.amount]])),
} as Partial<SynthState>);

function recipe(r: Recipe): PlayableLesson {
  const K: Panel[] = r.strike ? ["keyboard"] : ["keyboard", "hold"];
  const knobs = r.slots.map((slot) => slot.to as Panel);
  const steps: LessonStep[] = [
    r.strike
      ? { do: "Strike a few keys. Macro 1 is at zero and not connected to anything.", show: [...K, "macro1"], hear: "The starting sound.", target: "Two notes played, macro at 0", check: (s) => s.state.macro1 === 0 && struck(s) >= 2 }
      : { do: "Switch on Hold and play a note. Macro 1 is at zero and not connected to anything.", show: [...K, "macro1"], hear: "The starting sound.", target: "Note held, macro at 0", check: (s) => s.state.macro1 === 0 && s.held.length >= 1 },
    ...r.slots.map((slot, i): LessonStep => {
      const k = i + 1;
      return {
        do: `In Macro 1, set slot ${k} to ${label(slot.to as string)}, and its amount to about ${slot.amount > 0 ? "+" : ""}${slot.amount}%.`,
        show: [...K, `macro1Dest${k}` as Panel, `macro1Amt${k}` as Panel, slot.to as Panel, "macro1"],
        hear: i === 0 ? "No change yet: the macro is still at zero. The destination knob gains a faint ring showing how far the macro can take it." : "Still no change: you are deciding what the macro will do, not doing it yet.",
        target: `Slot ${k} sent to ${label(slot.to as string)}, amount between ${slot.amount - 12}% and ${slot.amount + 12}%`,
        check: (s) => dest(s, k) === slot.to && Math.abs(amt(s, k) - slot.amount) <= 12 && amt(s, k) !== 0,
      };
    }),
    { do: `Give the macro a name that says what it does, such as “${r.name}”.`, show: [...K, "macro1Name" as Panel, "macro1"], hear: "Nothing changes. The name is for you, later, when a patch has several macros.", target: "A name of your own typed in",
      check: (s) => s.state.macro1Name.trim().length > 0 && s.state.macro1Name !== INITIAL.macro1Name },
    { do: r.strike ? "Turn the macro up in stages, striking a key at each stage, until it has been from one end to the other." : "Turn the macro slowly from zero all the way up, then back down.",
      show: [...K, "macro1", ...knobs, ...(r.views ?? [])], hear: r.sweep, target: r.strike ? "Macro taken below 5% and above 95%, three notes played" : "Macro taken below 5% and above 95%",
      check: (s) => (s.range.macro1?.min ?? 100) <= 5 && (s.range.macro1?.max ?? 0) >= 95 && (!r.strike || struck(s) >= 3) },
    { do: "Park the macro where it sounds best to you.", show: [...K, "macro1", ...knobs, ...(r.views ?? [])], hear: "Your choice.", target: "Macro moved in this step and left between 5% and 95%",
      check: (s) => (s.changes.macro1 ?? 0) >= 1 && s.state.macro1 >= 5 && s.state.macro1 <= 95,
      remark: (s) => {
        const now = applyMacros(s.state);
        const moved = r.slots.filter((slot) => now[slot.to] !== s.state[slot.to]).map((slot) => `${label(slot.to as string)} from ${shown(slot.to as string, s.state[slot.to] as number)} to ${shown(slot.to as string, now[slot.to] as number)}`);
        return `“${s.state.macro1Name}” at ${s.state.macro1}% has moved ${moved.length ? moved.join(", ") : "nothing yet"}. ${moved.length > 1 ? `One knob, ${moved.length} changes.` : ""}`.trim();
      } },
  ];
  const demo: DemoTone[] = [0, 50, 100].map((value, i) => ({ patch: wired(r, value), note: 57, at: i * 2.0, seconds: 1.6 }));
  return {
    id: r.id, title: r.title, buildsOn: r.buildsOn, minutes: r.minutes, cardIds: r.cardIds, initial: r.initial, outcome: r.outcome, idea: r.idea,
    demo: { caption: `The finished macro at zero, halfway and right up.`, tones: demo },
    steps, recap: r.recap, inSerum: r.inSerum ?? "Serum has eight macros in the bottom-left corner. Drag a macro onto each knob it should move, set each amount, and double-click the macro’s name to rename it.",
  };
}

const BASS = { filterOn: true, cutoff: 400, resonance: 10, octave: -1 } as const;

const RECIPES: Recipe[] = [
  {
    id: "C5M.1", title: "One knob, two settings", minutes: 7, name: "Bite", buildsOn: ["C5.1", "C2.2"], cardIds: ["macros"], initial: { ...BASS }, views: ["curve"],
    outcome: "Build a macro that moves two controls at once, and name it.",
    idea: [
      "A macro is a knob that does nothing by itself. You give it up to three slots. Each slot says: when I am turned up, move that knob, by this much. Turn the macro and every slot moves together.",
      "The point is performance. Instead of reaching for two knobs you reach for one, named for what it does to the sound and not for what it is wired to. Here: open the filter and add resonance at the same moment, which is how a bass is made to bite.",
    ],
    slots: [{ to: "cutoff", amount: 35, hear: "" }, { to: "resonance", amount: 45, hear: "" }],
    sweep: "The filter opening and the edge sharpening together. Watch Cutoff and Resonance: each has a ring that fills as the macro rises, and a dot showing where the macro has put it.",
    recap: ["A macro moves several knobs from one.", "Each slot is a destination and an amount.", "Name a macro for what it does to the sound."],
  },
  {
    id: "C5M.2", title: "Opposite directions: a crossfade", minutes: 7, name: "Morph", buildsOn: ["C5M.1", "C1.4"], cardIds: ["macro-multi"], initial: { bOn: true, bShape: "square", bLevelDb: -48, shape: "saw" }, views: ["spectrum"],
    outcome: "Make one macro turn something up while it turns something else down.",
    idea: [
      "A slot’s amount can be negative. Give one slot a positive amount and another a negative one, and the macro trades one thing for another as it turns.",
      "Here oscillator B starts silent. The macro brings B up and takes A down, so one knob fades from a saw to a square. The same idea blends any two layers: a clean and a dirty sound, a dark and a bright one.",
    ],
    slots: [{ to: "aLevelDb", amount: -100, hear: "" }, { to: "bLevelDb", amount: 100, hear: "" }],
    sweep: "A saw fading into a hollow square and back. On the spectrum, every other peak drops out as B takes over.",
    recap: ["A negative amount turns a knob down as the macro goes up.", "One positive and one negative slot make a crossfade.", "The middle of the macro is a blend of both."],
  },
  {
    id: "C5M.3", title: "Brightness: three slots at once", minutes: 8, name: "Bright", buildsOn: ["C5M.1", "C1.3", "C2.5"], cardIds: ["macro-multi"], initial: { filterOn: true, cutoff: 500, table: "bright", position: 10, octave: -1 }, views: ["curve", "spectrum"],
    outcome: "Use all three slots so one macro changes a sound’s brightness in three ways that reinforce each other.",
    idea: [
      "Brightness has more than one cause. The filter decides which harmonics get through. The wavetable position decides which harmonics exist to begin with. Drive adds new ones. Moving only one of them sounds like a knob being turned; moving all three sounds like the instrument itself getting brighter.",
      "That is the real use of a macro: several small moves that add up to one musical gesture.",
    ],
    slots: [{ to: "cutoff", amount: 30, hear: "" }, { to: "position", amount: 80, hear: "" }, { to: "drive", amount: 40, hear: "" }],
    sweep: "A dull tone turning bright, full and slightly gritty, all in one motion.",
    recap: ["Three slots can push one quality from three directions.", "Small amounts on several knobs beat a large amount on one.", "The result should sound like one change, not three."],
  },
  {
    id: "C5M.4", title: "Width without loudness", minutes: 7, name: "Wide", buildsOn: ["C5M.2", "C1.6"], cardIds: ["macro-multi", "unison-detune"], initial: { voices: 7, detune: 0, spread: 0 }, views: ["meter"],
    outcome: "Build a macro that widens a sound and turns it down slightly at the same time, so it gets bigger without getting louder.",
    idea: [
      "Detuned, spread-out unison sounds bigger, and bigger tends to be heard as louder. In a mix that is a problem: you wanted width, and you got a level jump as well.",
      "So the macro does two things for width and a third against them: detune up, spread up, level a little down. This kind of built-in compensation is what separates a macro that is nice to play from one that fights you.",
    ],
    slots: [{ to: "detune", amount: 35, hear: "" }, { to: "spread", amount: 80, hear: "" }, { to: "aLevelDb", amount: -10, hear: "" }],
    sweep: "One plain voice opening out into a wide, thick stack, with the meter staying roughly where it was.",
    recap: ["A slot can compensate for what the others do.", "Wider and thicker is often heard as louder.", "A small negative level slot keeps a width macro honest."],
  },
  {
    id: "C5M.5", title: "A wobble you can play", minutes: 8, name: "Wobble", buildsOn: ["C5M.1", "C4.2"], cardIds: ["macro-multi", "lfo-cutoff"], initial: { ...BASS, cutoff: 500, resonance: 40, lfo1Dest: "cutoff", lfo1Amount: 0, lfo1Rate: 1 }, views: ["curve"],
    outcome: "Send a macro to an LFO’s own settings, so one knob brings a wobble in and speeds it up.",
    idea: [
      "A macro’s destination does not have to be part of the sound. It can be a setting of an LFO or an envelope. Here LFO 1 is already sent to the cutoff, but with an amount of zero, so nothing moves.",
      "The macro raises that amount and the LFO’s rate together. At zero the bass is still. As you turn it, a wobble appears and gets faster. This is the knob people ride in a build-up.",
    ],
    slots: [{ to: "lfo1Amount", amount: 30, hear: "" }, { to: "lfo1Rate", amount: 40, hear: "" }],
    sweep: "A still bass note starting to wobble, deeper and faster as the macro rises.",
    recap: ["A macro can move an LFO’s amount and rate.", "Starting an amount at zero lets the macro bring the movement in.", "Depth and speed rising together reads as intensity."],
  },
  {
    id: "C5M.6", title: "Pluck to pad", minutes: 8, name: "Length", buildsOn: ["C5M.1", "C3.2"], cardIds: ["macro-multi", "amp-envelope"], initial: { envA: 5, envD: 300, envS: 20, envR: 80 }, strike: true, views: ["envelope"],
    outcome: "Morph an envelope with a macro, turning a short pluck into a slow pad from one knob.",
    idea: [
      "You met the pluck and the pad as two separate settings of the same four envelope controls. A macro can travel between them: attack longer, sustain higher, release longer, all at once.",
      "Envelope settings are read when a note starts, so you hear the change on the next note you strike, not on one that is already sounding.",
    ],
    slots: [{ to: "envA", amount: 55, hear: "" }, { to: "envS", amount: 65, hear: "" }, { to: "envR", amount: 45, hear: "" }],
    sweep: "Short plucks at the bottom of the macro, swelling pads at the top, and everything in between.",
    recap: ["A macro can morph an envelope’s whole shape.", "Envelope changes are heard on the next note.", "One knob can turn one kind of instrument into another."],
  },
  {
    id: "C5M.7", title: "Dirt", minutes: 7, name: "Dirt", buildsOn: ["C5M.3", "C1.7"], cardIds: ["macro-multi"], initial: { filterOn: true, cutoff: 1500, resonance: 10, noiseOn: true, noiseLevelDb: -48, octave: -1 }, views: ["spectrum", "scope"],
    outcome: "Build a macro that roughens a clean sound: drive, resonance and a layer of noise.",
    idea: [
      "Grit also has several ingredients. Drive squashes the wave. Resonance adds a hard edge at the cutoff. Noise fills the gaps between the harmonics. The noise oscillator is switched on here but turned right down, waiting.",
      "Together on one macro they take a sound from clean to filthy by degrees, which is far easier to control than three knobs.",
    ],
    slots: [{ to: "drive", amount: 80, hear: "" }, { to: "resonance", amount: 30, hear: "" }, { to: "noiseLevelDb", amount: 50, hear: "" }],
    sweep: "A clean bass note getting squashed, edgy and hissy, step by step.",
    recap: ["Dirt is drive, edge and noise together.", "A source can sit silent until a macro brings it in.", "By degrees is the point: stop where it is dirty enough."],
  },
];

const BITE = wired(RECIPES[0]!, 0), MORPH = wired(RECIPES[1]!, 0), WOBBLE = wired(RECIPES[4]!, 0), DIRT = wired(RECIPES[6]!, 0);
const round = (from: Partial<SynthState>, value: number): MatchRound => ({ target: { macro1: value }, match: ["macro1"], from });

export const MACRO_CHAPTER: PlayableLesson[] = [
  ...RECIPES.map(recipe),
  {
    id: "C5M.8", title: "Two macros on one sound", buildsOn: ["C5M.3", "C5M.5"], minutes: 8, cardIds: ["macro-multi"],
    initial: {
      filterOn: true, cutoff: 500, resonance: 35, octave: -1, table: "bright", position: 10, lfo1Dest: "cutoff", lfo1Amount: 0, lfo1Rate: 1,
      macro1Name: "Bright", macro1Dest1: "cutoff", macro1Amt1: 30, macro1Dest2: "position", macro1Amt2: 80,
      macro2Name: "Wobble", macro2Dest1: "lfo1Amount", macro2Amt1: 30, macro2Dest2: "lfo1Rate", macro2Amt2: 40,
    },
    outcome: "Play a sound with two macros, and let both of them reach the same knob.",
    idea: [
      "A finished patch usually has several macros, each for one musical idea. This one arrives with two already built: Bright, and Wobble. They are independent, so every combination of the two is a different sound.",
      "Two macros may also reach the same knob. Their pushes add, exactly as two LFOs on one knob did, and the knob wears a ring for each.",
    ],
    steps: [
      { do: "Switch on Hold and play a low note. Both macros are at zero.", show: ["keyboard", "hold", "macro1", "macro2"], hear: "A dull, still bass note.", target: "Note held, both macros at 0", check: (s) => s.held.length >= 1 && s.state.macro1 === 0 && s.state.macro2 === 0 },
      { do: "Turn Bright up past 60% and leave Wobble at zero.", show: ["keyboard", "hold", "macro1", "macro2", "curve"], hear: "A brighter, still note.", target: "Bright at 60% or more, Wobble at 0", check: (s) => s.state.macro1 >= 60 && s.state.macro2 === 0 },
      { do: "Bring Bright back to zero and turn Wobble up past 60%.", show: ["keyboard", "hold", "macro1", "macro2", "curve"], hear: "A dark note that wobbles.", target: "Bright at 0, Wobble at 60% or more", check: (s) => s.state.macro1 === 0 && s.state.macro2 >= 60 },
      { do: "Now turn both up, and try a few combinations.", show: ["keyboard", "hold", "macro1", "macro2", "curve"], hear: "Bright and wobbling. Two knobs, a whole map of sounds.", target: "Both macros above 40%", check: (s) => s.state.macro1 >= 40 && s.state.macro2 >= 40 },
      { do: "Give Wobble a third slot: send it to Cutoff as well, with an amount of about -15%.", show: ["keyboard", "hold", "macro2", "macro2Dest3", "macro2Amt3", "cutoff", "matrix"], hear: "As the wobble comes in, the filter also closes a little, so the wobble digs into a darker tone. Cutoff now wears a ring from each macro and one from the LFO.", target: "Wobble’s slot 3 sent to Cutoff, amount between -27% and -3%",
        check: (s) => s.state.macro2Dest3 === "cutoff" && s.state.macro2Amt3 <= -3 && s.state.macro2Amt3 >= -27,
        remark: (s) => { const now = applyMacros(s.state); return `With Bright at ${s.state.macro1}% and Wobble at ${s.state.macro2}%, the cutoff you set at ${shown("cutoff", s.state.cutoff)} is playing at ${shown("cutoff", now.cutoff)}. The Matrix lists every connection that got it there.`; } },
    ],
    recap: ["Each macro should stand for one musical idea.", "Independent macros multiply: every combination is a sound.", "Two macros on one knob add together."],
    inSerum: "Serum shows a small number on each macro for how many places it is sent, and lists them all on the MATRIX tab.",
  },
  {
    id: "C5M.C", title: "Checkpoint: macros by ear", buildsOn: ["C5M.1", "C5M.2", "C5M.5", "C5M.7"], minutes: 8, cardIds: [],
    outcome: "Hear how far a macro has been turned, and match it.",
    idea: [
      "Each round gives you a macro that is already built, and a target with that macro turned to a hidden position. Turn yours until the two sounds match.",
      "Because a macro moves several things at once, there is more to listen to than with a single knob: use whichever change you hear most clearly.",
    ],
    steps: [],
    rounds: [round(BITE, 70), round(MORPH, 50), round({ ...WOBBLE }, 80), round(DIRT, 40), round(BITE, 25)],
    recap: ["A macro position is one number, even when it changes three things.", "Listen for the change you find easiest to judge.", "Halfway on a crossfade is the hardest place to hear exactly."],
  },
];
