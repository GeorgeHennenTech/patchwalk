// The beginner course. Each lesson pairs knowledge cards with a hands-on exercise in Serum that the
// app can check from the saved preset. Checks read stored values only, so they do not depend on any
// unverified display conversion.
import type { Analysis } from "../flow/build";
import { isEnabled, readModSlot } from "../patch/activity";
import type { ModuleNode } from "../patch/model";
import { resolveSource } from "../patch/sources";

export interface CheckItem {
  ok: boolean;
  text: string;
}

export interface CourseLesson {
  id: string;
  title: string;
  /** One line shown in the lesson list. */
  summary: string;
  intro: string[];
  cardIds: string[];
  exercise: { goal: string; steps: string[]; check: (a: Analysis) => CheckItem[] };
}

const node = (a: Analysis, id: string): ModuleNode | undefined => a.modules.find((m) => m.id === id);
const num = (n: ModuleNode | undefined, key: string): number | undefined => (typeof n?.params[key] === "number" ? (n.params[key] as number) : undefined);
const changedCount = (a: Analysis) => a.diffs.filter((d) => d.params.length || d.extras.length).length;
const item = (ok: boolean, yes: string, no: string): CheckItem => ({ ok, text: ok ? yes : no });
const routesTo = (a: Analysis, type: string, param: string) =>
  a.modules.map(readModSlot).filter((s) => !!s && s.source !== 0 && s.destType === type && s.destParam === param).map((s) => s!);

export const COURSE: CourseLesson[] = [
  {
    id: "start",
    title: "The starting point",
    summary: "What a synth does, and how this course checks your work.",
    intro: [
      "A synthesizer builds a sound in stages, and every patch you will ever open is some arrangement of the same few stages. This course walks through them one at a time, in the order the sound travels.",
      "Each lesson ends with a small task in Serum 2. You do it, save the preset, and drop the file here. The app reads the saved settings and tells you whether the task is done. Nothing is uploaded; the file is read in this browser tab.",
      "Start by getting that loop working with the simplest possible preset: the untouched starting patch.",
    ],
    cardIds: ["signal-path"],
    exercise: {
      goal: "Save the Init preset without changing anything, and drop it here.",
      steps: ["In Serum 2, open the preset menu and choose Init Preset.", "Play a few notes and listen: a plain, bright, steady tone.", "Save it as a new preset (any name) and drop the saved file below."],
      check: (a) => [
        item(changedCount(a) === 0, "Nothing differs from Init. This is the blank slate every lesson starts from.", `This preset differs from Init in ${changedCount(a)} place(s). Load Init again and save it untouched.`),
      ],
    },
  },
  {
    id: "pitch",
    title: "Oscillators and pitch",
    summary: "Where the sound starts, and how to put it in a register.",
    intro: [
      "The oscillator is the source. It repeats a wave shape so fast that you hear it as a pitched tone, and the key you press sets how fast.",
      "The oscillator's pitch controls move it relative to that key. This is the first decision in most patches: is this a bass, something in the middle, or something high?",
    ],
    cardIds: ["oscillator-pitch"],
    exercise: {
      goal: "Drop Osc A by one octave.",
      steps: ["Start from Init.", "On Osc A, set the octave control one step down.", "Play the same key before and after to hear the change, then save and drop the preset."],
      check: (a) => {
        const oct = num(node(a, "Oscillator0"), "kParamOctave");
        return [item(oct === -1, "Osc A is one octave down.", oct === undefined ? "Osc A's octave has not been changed." : `Osc A's octave is stored as ${oct}; the task asks for one octave down.`)];
      },
    },
  },
  {
    id: "wavetable",
    title: "Wavetables",
    summary: "Choosing the raw tone colour.",
    intro: [
      "The oscillator has to repeat some shape, and the shape decides the tone colour before anything else touches it. Serum's oscillators read their shapes from wavetables: sets of related shapes you can move through.",
      "Picking the table and where to sit in it is like picking the instrument.",
    ],
    cardIds: ["wavetable"],
    exercise: {
      goal: "Load a different wavetable into Osc A and move its position.",
      steps: ["Start from Init.", "Click the wavetable name on Osc A and pick any other table.", "Move the wavetable position knob while holding a note and stop somewhere you like.", "Save and drop the preset."],
      check: (a) => {
        const wt = a.diffs.find((d) => d.node.id === "Oscillator0.WTOsc0");
        const tableChanged = !!wt?.extras.some((e) => e.key === "relativePathToWT" || e.key === "embeddedWTData");
        const posChanged = !!wt?.params.some((p) => p.param === "kParamTablePos");
        return [
          item(tableChanged, "Osc A uses a different wavetable from Init.", "Osc A is still on Init's wavetable."),
          item(posChanged, "The wavetable position has been moved.", "The wavetable position is still where Init leaves it."),
        ];
      },
    },
  },
  {
    id: "two-oscillators",
    title: "A second oscillator",
    summary: "Layering sources and tuning them apart.",
    intro: [
      "One oscillator gives a clean, static tone. Add a second at the same pitch and tune the two very slightly apart, and the sound starts to move on its own.",
      "This is one of the oldest tricks in synthesis and the basis of many bass and lead sounds.",
    ],
    cardIds: ["detuned-pair", "oscillator-level"],
    exercise: {
      goal: "Switch on Osc B and fine-tune the two oscillators apart.",
      steps: ["Start from Init.", "Switch on Osc B.", "Set Osc A's fine tune a little below centre and Osc B's a little above.", "Hold one low note and listen for the slow rolling movement, then save and drop the preset."],
      check: (a) => {
        const A = node(a, "Oscillator0"), B = node(a, "Oscillator1");
        const on = !!B && isEnabled(B) === true;
        const gap = Math.abs((num(A, "kParamFine") ?? 0) - (num(B, "kParamFine") ?? 0));
        return [
          item(on, "Osc B is switched on.", "Osc B is still off."),
          item(gap >= 4, "The two oscillators are fine-tuned apart.", "The two oscillators have the same fine tune (or nearly). Move them further apart."),
        ];
      },
    },
  },
  {
    id: "unison",
    title: "Unison",
    summary: "Making one oscillator sound like many.",
    intro: [
      "Unison does the detuning trick inside a single oscillator: it stacks several copies and spreads them slightly in pitch.",
      "It is the quickest way to make a thin sound wide and thick, and it is easy to overdo.",
    ],
    cardIds: ["unison-detune"],
    exercise: {
      goal: "Give Osc A at least three unison voices.",
      steps: ["Start from Init.", "Raise Osc A's unison voice count to three or more.", "Sweep the detune knob while holding a chord and settle where it sounds thick but still in tune.", "Save and drop the preset."],
      check: (a) => {
        const v = num(node(a, "Oscillator0"), "kParamUnison");
        return [item((v ?? 1) >= 3, `Osc A has ${v} unison voices.`, v === undefined ? "Osc A's unison count has not been changed." : `Osc A has ${v} unison voices; the task asks for three or more.`)];
      },
    },
  },
  {
    id: "filter",
    title: "The filter",
    summary: "Carving the tone.",
    intro: [
      "Oscillators give you more brightness than you usually want. The filter removes part of the sound, and the low-pass filter, which removes the top, is the one that defines the character of most synth sounds.",
      "In Init the filter is switched off, so the first step is always to turn it on.",
    ],
    cardIds: ["lowpass-cutoff-resonance"],
    exercise: {
      goal: "Switch on Filter 1 and bring the cutoff down.",
      steps: ["Start from Init.", "Switch on Filter 1.", "Hold a note and sweep the cutoff down until the tone is clearly darker.", "Try raising resonance a little and sweeping again.", "Save and drop the preset."],
      check: (a) => {
        const f = node(a, "VoiceFilter0");
        return [
          item(!!f && isEnabled(f) === true, "Filter 1 is switched on.", "Filter 1 is still off."),
          item(num(f, "kParamFreq") !== undefined, "The cutoff has been moved from its default.", "The cutoff is still at its default position."),
        ];
      },
    },
  },
  {
    id: "envelope",
    title: "The amp envelope",
    summary: "How a note starts, holds and ends.",
    intro: [
      "So far every note switches on and off like a light. The amp envelope gives a note a shape in time: how quickly it arrives, where it settles, and how it fades.",
      "The same four stages describe a pluck, a pad and everything between.",
    ],
    cardIds: ["amp-envelope"],
    exercise: {
      goal: "Turn the sound into a pluck: bring Env 1's sustain right down.",
      steps: ["Start from Init.", "On Env 1, pull the sustain to the bottom.", "Set the decay so a held key fades out in well under a second.", "Hold a key: the note should die away on its own. Save and drop the preset."],
      check: (a) => {
        const s = num(node(a, "Env0"), "kParamSustain");
        return [item(s !== undefined && s <= 0.2, "Env 1's sustain is at or near the bottom, so held notes fade out.", s === undefined ? "Env 1's sustain has not been changed." : "Env 1's sustain is still fairly high, so held notes keep sounding. Pull it lower.")];
      },
    },
  },
  {
    id: "lfo",
    title: "LFOs and modulation",
    summary: "Making a setting move by itself.",
    intro: [
      "Everything so far is a fixed setting. Modulation makes settings move, and the LFO is the simplest source of movement: a slow shape that repeats.",
      "You connect a source to a destination with a modulation route. The classic first route is an LFO on the filter cutoff.",
    ],
    cardIds: ["lfo-basics", "mod-routing", "lfo-cutoff"],
    exercise: {
      goal: "Route LFO 1 to Filter 1's cutoff.",
      steps: ["Start from Init and switch on Filter 1 with the cutoff about halfway.", "Drag LFO 1 onto the cutoff knob (or add the route in the mod matrix).", "Raise the route's amount until you clearly hear the filter moving.", "Save and drop the preset."],
      check: (a) => {
        const f = node(a, "VoiceFilter0");
        const routes = routesTo(a, "VoiceFilter", "kParamFreq");
        const lfo = routes.find((r) => resolveSource(r.source).kind === "lfo");
        const seen = routes.map((r) => `${resolveSource(r.source).label} (stored source number ${r.source})`).join(", ");
        return [
          item(!!f && isEnabled(f) === true, "Filter 1 is switched on.", "Filter 1 is still off, so there is nothing for the LFO to move."),
          item(!!lfo, `A route from ${lfo ? resolveSource(lfo.source).label : "an LFO"} to the cutoff is present.`,
            routes.length ? `There is a route to the cutoff, but the app reads its source as ${seen}, not an LFO. If you did use an LFO, tell the developer: the source numbers are not confirmed yet.` : "No modulation route to Filter 1's cutoff was found."),
        ];
      },
    },
  },
  {
    id: "effects",
    title: "Effects",
    summary: "Space, width and grit after the synth itself.",
    intro: [
      "The effects rack processes the finished sound. Reverb and delay place it in a space, chorus widens it, distortion roughens it, and their order matters.",
      "Start with the most obvious one.",
    ],
    cardIds: ["fx-reverb", "fx-rack-order", "fx-delay"],
    exercise: {
      goal: "Add a reverb to the FX rack.",
      steps: ["Start from Init.", "Open the FX page and add a Reverb.", "Raise its mix until you hear a tail after each note.", "Save and drop the preset."],
      check: (a) => {
        const fx = a.modules.filter((m) => m.parentId === "FXRack0" && m.type.startsWith("FX"));
        const reverb = fx.find((m) => m.type === "FXReverb");
        return [item(!!reverb, `Reverb is in the rack at position ${reverb ? reverb.index + 1 : ""} of ${fx.length}.`, fx.length ? "The rack has effects in it, but no reverb." : "The FX rack is empty.")];
      },
    },
  },
  {
    id: "performance",
    title: "Macros and playing feel",
    summary: "Controls for your hands, and how notes connect.",
    intro: [
      "A finished patch is something you play, not just something that sounds. Macros put the important controls on the front panel, and the voicing settings decide how one note leads into the next.",
      "Most basses and leads are mono with glide; most pads and keys are not.",
    ],
    cardIds: ["macros", "glide", "macro-fx"],
    exercise: {
      goal: "Make it a mono patch with glide, and put the filter cutoff on Macro 1.",
      steps: ["Start from Init and switch on Filter 1.", "Turn on Mono and Legato, and raise the portamento time a little.", "Drag Macro 1 onto the filter cutoff and give the macro a name.", "Play overlapping notes to hear the slide, turn the macro to hear the filter, then save and drop the preset."],
      check: (a) => {
        const g = node(a, "Global0");
        const route = routesTo(a, "VoiceFilter", "kParamFreq").find((r) => resolveSource(r.source).kind === "macro");
        return [
          item(g?.params.kParamMonoToggle === 1, "Mono is on.", "Mono is still off."),
          item(g?.params.kParamLegato === 1 || num(g, "kParamPortamentoTime") !== undefined, "Legato or portamento has been set.", "Neither legato nor portamento time has been changed."),
          item(!!route, `${route ? resolveSource(route.source).label : "A macro"} is routed to the filter cutoff.`, "No macro is routed to Filter 1's cutoff."),
        ];
      },
    },
  },
];
