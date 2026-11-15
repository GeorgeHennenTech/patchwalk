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
  if (unit === ":1") return `${v} to 1`;
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

/** More recipes, added once the synth had effects, warp, FM and the wide pitch destination. Listed after "Two macros on one sound". */
const PLUCK = { shape: "saw", filterOn: true, cutoff: 1800, envA: 2, envD: 220, envS: 0, envR: 120 } as const;
const MORE_RECIPES: Recipe[] = [
  {
    id: "C5M.9", title: "Near to far", minutes: 7, name: "Space", buildsOn: ["C5M.1", "C7.6"], cardIds: ["macro-fx", "fx-reverb"], strike: true,
    initial: { ...PLUCK, reverbOn: true, reverbMix: 0, reverbSize: 0.6 },
    outcome: "Put distance on one knob: a macro that makes the room bigger as it makes it louder.",
    idea: [
      "A reverb has a size and a level, and they usually want to move together. A little of a small room reads as close; a lot of a big room reads as far away. Turning only one of them gives odd results: a huge hall you can barely hear, or a tiny room that swamps the sound.",
      "So the macro raises both. At zero the sound is dry and in front of you. Turned up, it walks to the back of a hall.",
    ],
    slots: [{ to: "reverbMix", amount: 60, hear: "" }, { to: "reverbSize", amount: 50, hear: "" }],
    sweep: "A dry pluck gaining a short bloom, then a long tail, as if it were moving away from you.",
    recap: ["Reverb size and level usually belong on one control.", "Small and quiet is close; large and loud is far.", "An effect that starts at zero mix can be brought in by a macro."],
  },
  {
    id: "C5M.10", title: "The echo throw", minutes: 7, name: "Throw", buildsOn: ["C5M.1", "C7.5"], cardIds: ["macro-fx", "fx-delay"], strike: true,
    initial: { ...PLUCK, delayOn: true, delayMix: 0, delayFeedback: 20, delayTime: 280 },
    outcome: "Build a macro that throws a note into a long train of echoes, and takes them away again.",
    idea: [
      "A delay left on all the time clutters a busy part. A common trick is to keep it silent and open it for a single note or the end of a phrase, so just that moment echoes away. That needs two things at once: the echoes turned up, and enough feedback for them to carry on.",
      "One macro does both. Flick it up on the note you want to throw, then bring it back down.",
    ],
    slots: [{ to: "delayMix", amount: 70, hear: "" }, { to: "delayFeedback", amount: 50, hear: "" }],
    sweep: "No echo at all at zero. Turned up, each note is followed by a long, fading train of repeats.",
    recap: ["A delay can sit silent until a macro opens it.", "Echo level and feedback rise together for a throw.", "Bring the macro back down and the tail dies away naturally."],
  },
  {
    id: "C5M.11", title: "Heat without the fizz", minutes: 7, name: "Heat", buildsOn: ["C5M.4", "C7.1", "C7.2"], cardIds: ["macro-fx", "fx-distortion"],
    initial: { shape: "saw", octave: -1, distOn: true, distType: "soft", distDrive: 0, eqOn: true },
    outcome: "Build a distortion macro that tames its own harshness as it goes.",
    idea: [
      "Distortion adds harmonics all the way up, and past a certain point the top end turns to fizz. The usual cure is to turn the highs down after the distortion. The EQ comes after the distortion in the rack, so it can do exactly that.",
      "The macro pushes the drive up and pulls the high band down in the same move. The more heat, the more the top is rounded off. This is compensation again, as with the width macro, now for tone.",
    ],
    slots: [{ to: "distDrive", amount: 70, hear: "" }, { to: "eqHigh", amount: -30, hear: "" }],
    sweep: "A clean bass thickening into a warm, heavy growl, without the top turning harsh.",
    recap: ["Distortion adds highs; an EQ after it can take some back.", "A macro can apply the cure in step with the cause.", "Order matters: the EQ only tames the fizz because it comes after."],
  },
  {
    id: "C5M.12", title: "The sync tear", minutes: 7, name: "Tear", buildsOn: ["C5M.1", "C6.2"], cardIds: ["macro-multi", "warp"], views: ["scope", "spectrum"],
    initial: { shape: "saw", octave: -1, warp: "sync", warpAmount: 0, filterOn: true, cutoff: 900, resonance: 10 },
    outcome: "Put a sync sweep and the filter on one knob, so the tear opens up as it rises.",
    idea: [
      "The sync sweep is a sound you play, not a setting you leave. A macro is the natural home for it: one knob you turn by hand.",
      "On its own the sweep can be thin at the bottom and piercing at the top. Opening the filter along with it keeps the low end of the sweep dark and lets the top through only when the sweep gets there.",
    ],
    slots: [{ to: "warpAmount", amount: 100, hear: "" }, { to: "cutoff", amount: 25, hear: "" }],
    sweep: "A dark saw tearing open into a bright, vowel-like scream and closing again.",
    recap: ["Warp amount belongs on a macro.", "A second slot on the filter shapes how the sweep opens.", "A macro is the way to move a control that sources cannot reach."],
  },
  {
    id: "C5M.13", title: "A growl you can ride", minutes: 8, name: "Growl", buildsOn: ["C5M.5", "C6.4"], cardIds: ["macro-multi"], views: ["spectrum"],
    initial: { shape: "sine", bShape: "sine", octave: -1, bOctave: -1, lfo1Dest: "fmAmount", lfo1Amount: 0, lfo1Rate: 2, lfo1Shape: "triangle" },
    outcome: "Combine FM and an LFO under one macro: more FM, moving more, moving faster.",
    idea: [
      "A growling bass is often FM whose amount keeps changing, so the tone snarls and relaxes. Three settings make it: how much FM there is, how far an LFO swings that amount, and how fast.",
      "LFO 1 is already sent to FM from B with an amount of zero. The macro raises the FM itself, the LFO’s amount and the LFO’s rate together, so one knob goes from a plain sine to a fast, snarling growl.",
    ],
    slots: [{ to: "fmAmount", amount: 30, hear: "" }, { to: "lfo1Amount", amount: 40, hear: "" }, { to: "lfo1Rate", amount: 35, hear: "" }],
    sweep: "A pure low sine growing an edge, then starting to snarl, faster and deeper as the macro rises.",
    recap: ["FM whose amount moves is a growl.", "One macro can raise an effect, its movement and the speed of that movement.", "Starting the LFO’s amount at zero lets the macro bring the motion in."],
  },
  {
    id: "C5M.14", title: "Squash", minutes: 8, name: "Squash", buildsOn: ["C5M.4", "C7.3"], cardIds: ["macro-fx", "fx-compressor"], strike: true, views: ["meter"],
    initial: { shape: "saw", octave: -1, filterOn: true, cutoff: 1200, envA: 2, envD: 500, envS: 45, envR: 80, velDest: "noteLevel", velAmount: 100, compOn: true, compThreshold: 0, compRatio: 4, compMakeup: 0 },
    outcome: "Put a compressor on one knob: threshold down, ratio up, and make-up gain to keep the level.",
    idea: [
      "Compressing harder means three moves: lower the threshold so more of the signal is caught, raise the ratio so it is held more firmly, and add make-up gain because the result is quieter. Do only the first two and the sound just shrinks.",
      "The macro makes all three. At zero the compressor does nothing. Turned up, soft and hard notes come closer and closer together while the overall level stays roughly put. Click lower on a key to strike it harder.",
    ],
    slots: [{ to: "compThreshold", amount: -60, hear: "" }, { to: "compRatio", amount: 40, hear: "" }, { to: "compMakeup", amount: 40, hear: "" }],
    sweep: "Soft and hard notes far apart at zero, and nearly the same level with the macro right up. Watch “Turning down by” grow.",
    recap: ["More compression is threshold down, ratio up, make-up up.", "The make-up slot is the compensation that keeps the macro playable.", "At zero the compressor is in the path but doing nothing."],
  },
  {
    id: "C5M.15", title: "Shimmer", minutes: 7, name: "Shimmer", buildsOn: ["C5M.3", "C7.4"], cardIds: ["macro-fx", "fx-chorus"],
    initial: { shape: "saw", chorusOn: true, chorusMix: 0, chorusDepth: 20, eqOn: true },
    outcome: "Build a macro that makes a plain sound wide, moving and airy in one gesture.",
    idea: [
      "Three small changes add up to a sound seeming to open out: chorus copies fading in, those copies drifting further, and a little more top end. None of them is dramatic alone.",
      "As with the brightness macro, the aim is for the three to be heard as one change. Keep the amounts moderate: a macro that goes too far at the top is one you never turn all the way up.",
    ],
    slots: [{ to: "chorusMix", amount: 50, hear: "" }, { to: "chorusDepth", amount: 50, hear: "" }, { to: "eqHigh", amount: 25, hear: "" }],
    sweep: "One thin saw spreading into a wide, glistening pad-like tone.",
    recap: ["Several gentle effect moves read as one change.", "Moderate amounts keep the whole of the macro’s travel usable.", "Width, movement and brightness reinforce each other."],
  },
  {
    id: "C5M.16", title: "Knock", minutes: 7, name: "Knock", buildsOn: ["C5M.1", "CT.3", "C7.1"], cardIds: ["macro-fx"], strike: true, views: ["scope"],
    initial: { shape: "sine", octave: -2, envA: 1, envD: 350, envS: 0, envR: 150, env2Dest: "aPitchWide", env2Amount: 10, env2A: 1, env2D: 60, env2S: 0, env2Bend: "sharp", distOn: true, distType: "soft", distDrive: 0 },
    outcome: "Make a kick drum harder with one knob: a bigger pitch fall and some distortion together.",
    idea: [
      "Two things make a kick drum hit harder at the front. A larger fall in pitch gives a sharper knock. Distortion adds harmonics, so the drum is heard on speakers that cannot reproduce its lowest note.",
      "The macro raises both. At zero it is a soft, round thud; turned up, a hard, bright kick. The same drum, from gentle to aggressive.",
    ],
    slots: [{ to: "env2Amount", amount: 25, hear: "" }, { to: "distDrive", amount: 50, hear: "" }],
    sweep: "A soft thud growing a sharper knock and a rougher, louder-seeming body.",
    recap: ["A kick’s hardness is partly the size of its pitch fall.", "Distortion adds harmonics that carry on small speakers.", "A macro can move an envelope’s amount as well as a knob."],
  },
  // ---- added with the second filter, the peak type, Osc B's voices and the Steps and Fold warps
  {
    id: "C5M.17", title: "Full range to small radio", minutes: 7, name: "Radio", buildsOn: ["C5M.2", "C2.9"], cardIds: ["macro-multi", "filter-types-and-slope"], views: ["curve"],
    initial: { shape: "saw", filterOn: true, cutoff: 20000, filter2On: true, filter2Type: "high", cutoff2: 20 },
    outcome: "Close a sound down to a narrow band from both ends at once, with two filters on one knob.",
    idea: [
      "A small speaker has no bass and no top. To imitate one you need two cuts: a low-pass coming down from above and a high-pass coming up from below, one after the other, so only a band in the middle is left.",
      "The macro moves the two cutoffs toward each other. At zero both filters are wide open. Turned up, the sound shrinks to a small radio. It is the opposite-directions idea again, on two filters.",
    ],
    slots: [{ to: "cutoff", amount: -40, hear: "" }, { to: "cutoff2", amount: 50, hear: "" }],
    sweep: "The full saw closing in from both ends until only a boxy middle band is left. On the curve, two slopes walk toward each other.",
    recap: ["Two filters in a row leave a band between their cutoffs.", "One slot down and one slot up moves both edges of the band together.", "At zero both filters are open, so the macro starts from the full sound."],
  },
  {
    id: "C5M.18", title: "One player to a crowd", minutes: 7, name: "Crowd", buildsOn: ["C5M.1", "C1.10"], cardIds: ["macro-multi", "unison-detune"],
    initial: { shape: "saw", voices: 5, detune: 0, spread: 0, bOn: true, bShape: "saw", bOctave: 1, bLevelDb: -9, bVoices: 5, bDetune: 0 },
    outcome: "Take two oscillators from tight and single to wide and many with one knob.",
    idea: [
      "Both oscillators here already have five voices each, but with no detune the voices sit on top of one another and sound like one. Thickness comes from the voices drifting apart in pitch, and width from placing them across the speakers.",
      "The macro raises the detune of both oscillators and the spread of Osc A together. At zero: one tight, narrow note. Turned up: a wide, slowly moving crowd.",
    ],
    slots: [{ to: "detune", amount: 35, hear: "" }, { to: "bDetune", amount: 40, hear: "" }, { to: "spread", amount: 80, hear: "" }],
    sweep: "A single hard note loosening into a wide, swirling mass, and tightening again as you bring the macro down.",
    recap: ["Voices only sound like many once they are detuned.", "Detune gives thickness; spread gives width.", "One macro can thicken two oscillators at the same moment."],
  },
  {
    id: "C5M.19", title: "A talking band", minutes: 7, name: "Talk", buildsOn: ["C5M.1", "C2.8"], cardIds: ["macro-multi", "filter-types-and-slope"], views: ["curve"],
    initial: { shape: "saw", octave: -1, filterOn: true, filterType: "peak", cutoff: 350, resonance: 55 },
    outcome: "Make a sound seem to change vowel by sliding a lifted band with one knob.",
    idea: [
      "A voice changes vowel by moving the bands it emphasises, not by getting brighter or duller overall. The Peak filter type does the same thing: it lifts one band and leaves the rest alone.",
      "The macro slides that band upward and makes it a little taller on the way. The note keeps all its weight and all its top; only the emphasis moves.",
    ],
    slots: [{ to: "cutoff", amount: 35, hear: "" }, { to: "resonance", amount: 25, hear: "" }],
    sweep: "The same note seeming to say different vowels as the bump on the curve travels up through it.",
    recap: ["Moving an emphasised band sounds like a change of vowel.", "Peak lifts a band without removing anything.", "A second slot can make the band taller as it rises."],
  },
  {
    id: "C5M.20", title: "Smooth to steps", minutes: 7, name: "Bits", buildsOn: ["C5M.4", "C6.1", "C7.1"], cardIds: ["macro-fx", "warp"], views: ["scope"],
    initial: { shape: "saw", octave: -1, warp: "steps", warpAmount: 0, distOn: true, distType: "crush", distDrive: 0, distMix: 100 },
    outcome: "Roughen a sound in two places at once: the oscillator's wave and the finished signal.",
    idea: [
      "There are two different ways to make a sound blocky. The Steps warp cuts each cycle of the wave into flat steps, so the roughness follows the pitch. Crush rounds the finished signal's level to a coarse grid, whatever the note.",
      "The macro brings in both. The result is grittier than either alone, and it goes from clean to broken across one knob.",
    ],
    slots: [{ to: "warpAmount", amount: 70, hear: "" }, { to: "distDrive", amount: 55, hear: "" }],
    sweep: "A clean saw turning into a buzzing staircase. The scope shows the ramp breaking into blocks.",
    recap: ["Steps roughens the wave inside the oscillator, so it follows the pitch.", "Crush roughens the finished signal's level.", "A macro can reach into the oscillator and the effects at once."],
  },
  {
    id: "C5M.21", title: "Fold and tame", minutes: 7, name: "Metal", buildsOn: ["C5M.4", "C6.1"], cardIds: ["macro-multi", "warp"], views: ["scope", "spectrum"],
    initial: { shape: "sine", octave: -1, warp: "fold", warpAmount: 0, filterOn: true, cutoff: 20000 },
    outcome: "Turn a pure tone metallic by folding it, while a filter holds back the harshest part.",
    idea: [
      "The Fold warp turns the wave up and folds back whatever passes the top. A sine has one harmonic; each fold adds more, and they rise and fall in an uneven, metallic way as the amount grows.",
      "Left alone, heavy folding gets shrill. So the macro's second slot lowers the filter as the folding rises: the compensation idea from the loudness lessons, applied to brightness.",
    ],
    slots: [{ to: "warpAmount", amount: 90, hear: "" }, { to: "cutoff", amount: -25, hear: "" }],
    sweep: "A soft sine growing bright, hollow and bell-like, without ever turning to hiss.",
    recap: ["Folding adds harmonics to a plain wave.", "The harmonics shift unevenly as the fold grows, which sounds metallic.", "A filter slot moving the other way keeps the top under control."],
  },
  // ---- added with the flanger and the phaser
  {
    id: "C5M.22", title: "Jet", minutes: 7, name: "Jet", buildsOn: ["C5M.1", "C7.8"], cardIds: ["macro-fx"], views: ["spectrum"],
    initial: { shape: "saw", octave: -1, flangerOn: true, flangerMix: 0, flangerFeedback: 0, flangerRate: 0.25, flangerDepth: 90 },
    outcome: "Bring a flanger in from nothing to a full metallic sweep with one knob.",
    idea: [
      "A flanger left on all the time soon tires the ear. It works best as a gesture: absent, then sweeping in, then gone. Two of its controls make that gesture together: how much of the delayed copy is mixed in, and how much is fed back.",
      "The macro raises both. At zero the sound is untouched. Half way there is a gentle whoosh. Fully up, the feedback turns it into a ringing, metallic jet.",
    ],
    slots: [{ to: "flangerMix", amount: 90, hear: "" }, { to: "flangerFeedback", amount: 80, hear: "" }],
    sweep: "A plain saw, then a soft whoosh, then a sharp metallic sweep with a whistle in it.",
    recap: ["An effect that starts at zero mix can be brought in as a gesture.", "Flanger mix and feedback rise together: more of the copy, and a sharper edge.", "Fully up, feedback turns the whoosh metallic."],
  },
  {
    id: "C5M.23", title: "Swirl", minutes: 7, name: "Swirl", buildsOn: ["C5M.3", "C7.8"], cardIds: ["macro-fx"], views: ["spectrum"],
    initial: { shape: "saw", voices: 3, detune: 12, phaserOn: true, phaserMix: 0, phaserDepth: 20, phaserRate: 0.15 },
    outcome: "Make a still pad start to turn, slowly at first and then faster, from one control.",
    idea: [
      "Movement in a phaser has three parts: how much of the effect is heard, how far its notches travel, and how fast they travel. Raising only the amount gives a hollow tone that barely moves. Raising only the speed gives a nervous flutter.",
      "The macro raises all three, so the sound goes from still, to turning slowly, to spinning. One knob then stands for “how much motion”, which is what you actually want to play.",
    ],
    slots: [{ to: "phaserMix", amount: 85, hear: "" }, { to: "phaserDepth", amount: 60, hear: "" }, { to: "phaserRate", amount: 45, hear: "" }],
    sweep: "A still pad that begins to turn, then swirls faster and wider.",
    recap: ["A phaser's motion has three parts: amount, distance and speed.", "Raising all three together reads as one thing: more motion.", "A macro can stand for a musical idea, not a single setting."],
  },
  {
    id: "C5M.24", title: "Going under", minutes: 7, name: "Under", buildsOn: ["C5M.2", "C7.8", "C7.6"], cardIds: ["macro-multi", "macro-fx"], views: ["curve"],
    initial: { shape: "saw", filterOn: true, cutoff: 20000, phaserOn: true, phaserMix: 0, phaserCentre: 1500, phaserRate: 0.3, reverbOn: true, reverbMix: 0, reverbSize: 2.5 },
    outcome: "Sink a sound as if under water: darker, swirling and further away, all at once.",
    idea: [
      "Some changes are really three changes heard as one. A sound going under water gets duller, because the highs are lost; it wavers, because the surface moves; and it seems further off. Each has a control: the filter, a phaser, a reverb.",
      "The macro closes the filter while it brings in the phaser and the reverb. Two slots go up and one comes down, and the ear hears a single event.",
    ],
    slots: [{ to: "cutoff", amount: -55, hear: "" }, { to: "phaserMix", amount: 80, hear: "" }, { to: "reverbMix", amount: 45, hear: "" }],
    sweep: "A bright saw sinking: dulling, beginning to waver, and drifting away.",
    recap: ["Several changes made together can be heard as one event.", "Slots can move in opposite directions inside one macro.", "Filter, phaser and reverb together give darker, wavering and further away."],
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
  ...MORE_RECIPES.map(recipe),
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
