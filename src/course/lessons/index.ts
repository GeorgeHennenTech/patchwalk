import { INITIAL, noteToHz, type SynthState } from "../../synth/params";
import type { DemoTone, MatchRound, PlayableLesson, Snapshot } from "../types";
import { FILTER_ADDITIONS, FX_ADDITIONS, OSC_ADDITIONS, WARP_ADDITIONS } from "./additions";
import { CHAPTER_1 } from "./chapter1";
import { CHAPTER_2 } from "./chapter2";
import { CHAPTER_3 } from "./chapter3";
import { CHAPTER_4 } from "./chapter4";
import { CHAPTER_5 } from "./chapter5";
import { CHAPTER_6 } from "./chapter6";
import { CHAPTER_7 } from "./chapter7";
import { CHAPTER_8 } from "./chapter8";
import { IMPACT_CHAPTER } from "./impacts";
import { MACRO_CHAPTER } from "./macros";

const anyNote = (s: Snapshot) => s.played.mouse + s.played.keys + s.played.midi;
const within = (v: number | null, lo: number, hi: number) => v !== null && v >= lo && v <= hi;
const hz = (n: number) => `${Math.round(n)} Hz`;

const A3 = noteToHz(57), A4 = noteToHz(69);
/** Tones one after another, each `len` seconds with a short gap. */
export const seq = (tones: Omit<DemoTone, "at" | "seconds">[], len = 0.8): DemoTone[] => tones.map((t, i) => ({ ...t, at: i * (len + 0.15), seconds: len }));

/**
 * Playable lessons, converted from the scripts in docs/lessons/. Steps the practice synth cannot yet
 * support (MIDI input, hovering harmonics) are adapted and noted in the script.
 */
const BASE: PlayableLesson[] = [
  {
    id: "C0.1", title: "Playing the synth", buildsOn: [], minutes: 5, cardIds: ["signal-path"],
    outcome: "Make sound on the practice synth with the mouse or your computer keyboard, and hold a note while you adjust something.",
    idea: [
      "Everything in this course is learned by changing one thing while a note sounds. So the first skill is getting a note to play and stay playing.",
      "The starting patch is deliberately plain: one steady tone that starts and stops instantly.",
    ],
    steps: [
      { do: "Click “Start audio”.", show: ["start"], hear: "Nothing yet.", target: "Audio is running", check: (s) => s.audioRunning },
      { do: "Click any key on the on-screen keyboard.", show: ["keyboard"], hear: "A plain, bright tone.", target: "A note played with the mouse", check: (s) => s.played.mouse >= 1 },
      { do: "Play a note from your computer keyboard: the row starting A S D F is the white keys.", show: ["keyboard"], hear: "The same tone at another pitch.", target: "A note played from the computer keyboard", check: (s) => s.played.keys >= 1 },
      { do: "Switch on Hold, then play a note.", show: ["keyboard", "hold"], hear: "A note that keeps sounding after you let go.", target: "Hold is on and a note is sounding", check: (s) => s.holdOn && s.held.length >= 1 },
      { do: "Turn the volume down to a comfortable level, then switch Hold off.", show: ["keyboard", "hold", "volumeDb"], hear: "The note getting quieter, then silence.", target: "Volume lowered, nothing held",
        check: (s) => s.state.volumeDb < s.start.volumeDb && !s.holdOn && s.held.length === 0,
        remark: (s) => `You settled on ${s.state.volumeDb} dB, ${s.start.volumeDb - s.state.volumeDb} dB below where it started.` },
    ],
    recap: ["Audio starts only after you click.", "Hold keeps a note sounding so your hands are free.", "The starting patch is one plain tone; every lesson changes it from there."],
    inSerum: "Load the Init preset and play a few notes. Save it untouched and drop it into the first Serum task: the app confirms nothing differs from Init.",
  },
  {
    id: "C0.2", title: "Pitch is speed", buildsOn: ["C0.1"], minutes: 6, cardIds: ["oscillator-pitch"], initial: { freeHz: 300, shape: "sine" }, earCheck: "higher",
    demo: { caption: "One tone at 220 Hz, then 440, then 880: the same note in three octaves.", tones: seq([{ shape: "sine", hz: 220 }, { shape: "sine", hz: 440 }, { shape: "sine", hz: 880 }]) },
    outcome: "Explain pitch as how fast a wave repeats, and predict what doubling or halving that speed does.",
    idea: [
      "A pitched sound is a shape that repeats. The number of repeats per second is its frequency, measured in hertz. More repeats per second sounds higher.",
      "Double the frequency and you hear the same note one octave up; halve it and you hear it one octave down.",
    ],
    steps: [
      { do: "Switch on Hold, play a note, and watch the scope for a moment.", show: ["keyboard", "hold", "scope"], hear: "A steady tone; a wave standing still on the scope.", target: "A note held for two seconds", check: (s) => s.heldSeconds >= 2 },
      { do: "Drag the frequency slider up slowly, by at least an octave.", show: ["keyboard", "hold", "scope", "freeHz"], hear: "Pitch rising; the waves on the scope getting narrower.", target: "Frequency at least doubled",
        check: (s) => (s.state.freeHz ?? 0) >= (s.start.freeHz ?? Infinity) * 2 },
      { do: "Set the frequency to 220 Hz.", show: ["keyboard", "hold", "scope", "freeHz"], hear: "A low A.", target: "215 to 225 Hz", check: (s) => within(s.state.freeHz, 215, 225) },
      { do: "Now set it to 440 Hz.", show: ["keyboard", "hold", "scope", "freeHz"], hear: "The same note, one octave higher.", target: "435 to 445 Hz", check: (s) => within(s.state.freeHz, 435, 445) },
      { do: "Predict the next octave up, then set it.", show: ["keyboard", "hold", "scope", "freeHz"], hear: "Another octave up.", target: "870 to 890 Hz", check: (s) => within(s.state.freeHz, 870, 890),
        remark: (s) => `You landed on ${hz(s.state.freeHz ?? 0)}. Twice 440 is 880: each octave is a doubling, so the steps in hertz get bigger as you go up.` },
    ],
    recap: ["Frequency is repeats per second, in hertz.", "Higher frequency sounds higher in pitch.", "Each octave is a doubling."],
  },
  {
    id: "C0.3", title: "Loud and quiet", buildsOn: ["C0.1"], minutes: 6, cardIds: ["oscillator-level"], initial: { volumeDb: -6 },
    demo: { caption: "The same note three times, each 6 dB quieter than the last.", tones: seq([{ shape: "saw", hz: A3, gainDb: -6 }, { shape: "saw", hz: A3, gainDb: -12 }, { shape: "saw", hz: A3, gainDb: -18 }]) },
    outcome: "Read a level meter, say what a decibel change means in practice, and set a safe listening level.",
    idea: [
      "Level is how big the wave is. It is measured in decibels, a scale built on ratios, so equal decibel steps sound like equal steps in loudness.",
      "The meter shows level; your ears judge loudness. The two do not always agree, because brighter and denser sounds seem louder at the same level.",
    ],
    steps: [
      { do: "Switch on Hold, play a note, and watch the meter.", show: ["keyboard", "hold", "meter"], hear: "A steady reading.", target: "A note held for two seconds", check: (s) => s.heldSeconds >= 2 },
      { do: "Lower the volume by 6 dB.", show: ["keyboard", "hold", "meter", "volumeDb"], hear: "Clearly quieter, but not half as loud.", target: "5 to 7 dB below the start", check: (s) => within(s.start.volumeDb - s.state.volumeDb, 5, 7) },
      { do: "Lower it another 6 dB.", show: ["keyboard", "hold", "meter", "volumeDb"], hear: "About half as loud as where you began.", target: "5 to 7 dB lower again", check: (s) => within(s.start.volumeDb - s.state.volumeDb, 5, 7) },
      { do: "Bring it back up 12 dB, to where the lesson started.", show: ["keyboard", "hold", "meter", "volumeDb"], hear: "The original loudness.", target: "11 to 13 dB above this step's start", check: (s) => within(s.state.volumeDb - s.start.volumeDb, 11, 13) },
      { do: "Set your device volume so this is comfortable to hear for minutes at a time, then confirm.", show: ["keyboard", "hold", "meter", "ack"], hear: "A level you could talk over.", target: "Confirmed", check: (s) => !!s.flags.ack },
    ],
    recap: ["Decibels describe ratios; equal steps sound equal.", "Roughly 10 dB sounds like twice or half as loud. That is a rule of thumb, not a law.", "Loud listening tires your ears and hides detail."],
  },
  {
    id: "C0.4", title: "Tone colour", buildsOn: ["C0.2"], minutes: 7, cardIds: ["wavetable"], initial: { shape: "sine" }, shapes: ["sine", "saw"],
    demo: { caption: "The same note as a pure tone, then as a bright one.", tones: seq([{ shape: "sine", hz: A3 }, { shape: "saw", hz: A3 }], 1.1) },
    outcome: "Explain why two sounds at the same pitch and loudness can sound different, and read that difference on a spectrum.",
    idea: [
      "Almost every pitched sound is a stack of simpler tones called harmonics: one at the pitch you hear, and others at whole multiples of it.",
      "Which harmonics are present, and how strong each is, gives a sound its colour. The spectrum shows them as peaks from left (low) to right (high).",
    ],
    steps: [
      { do: "Switch on Hold and play a note on the pure tone.", show: ["keyboard", "hold", "spectrum", "shape"], hear: "A soft, hollow tone; one peak on the spectrum.", target: "Pure tone, note held for two seconds", check: (s) => s.state.shape === "sine" && s.heldSeconds >= 2 },
      { do: "Switch to the bright tone.", show: ["keyboard", "hold", "spectrum", "shape"], hear: "A buzzy tone; a row of peaks.", target: "Bright tone selected", check: (s) => s.state.shape === "saw" },
      { do: "Play a different note and watch the peaks.", show: ["keyboard", "hold", "spectrum", "shape"], hear: "The whole row of peaks moving together.", target: "Two different notes played", check: (s) => s.distinctNotes >= 2 },
      { do: "Switch back and forth between the two tones while a note sounds.", show: ["keyboard", "hold", "spectrum", "shape"], hear: "Same pitch, different colour.", target: "Switched at least four times", check: (s) => (s.changes.shape ?? 0) >= 4 },
    ],
    recap: ["A pitched sound is a stack of harmonics.", "The mix of harmonics is the tone colour.", "More and stronger high harmonics sound brighter."],
  },
  {
    id: "C1.1", title: "The four basic shapes", buildsOn: ["C0.4"], minutes: 8, cardIds: ["wavetable"], initial: { shape: "sine" }, earCheck: "shape",
    demo: { caption: "One note as sine, triangle, square and saw, in that order.", tones: seq([{ shape: "sine", hz: A3 }, { shape: "triangle", hz: A3 }, { shape: "square", hz: A3 }, { shape: "saw", hz: A3 }]) },
    outcome: "Recognise sine, triangle, saw and square by ear and by their spectra, and say roughly what each contains.",
    idea: [
      "The oscillator repeats a shape, and the shape decides the harmonics. A sine is a single harmonic. A triangle adds a few quiet odd harmonics.",
      "A square has strong odd harmonics, which sounds hollow. A saw has every harmonic, which sounds bright and full. Most classic synth sounds start from a saw or a square because there is plenty to carve away later.",
    ],
    steps: [
      { do: "Switch on Hold and play a note on Sine.", show: ["keyboard", "hold", "scope", "spectrum", "shape"], hear: "Pure and soft; one peak.", target: "Sine, note held", check: (s) => s.state.shape === "sine" && s.held.length >= 1 },
      { do: "Switch to Triangle.", show: ["keyboard", "hold", "scope", "spectrum", "shape"], hear: "Slightly brighter, still soft.", target: "Triangle selected", check: (s) => s.state.shape === "triangle" },
      { do: "Switch to Square.", show: ["keyboard", "hold", "scope", "spectrum", "shape"], hear: "Hollow, like a clarinet; every other peak missing.", target: "Square selected", check: (s) => s.state.shape === "square" },
      { do: "Switch to Saw.", show: ["keyboard", "hold", "scope", "spectrum", "shape"], hear: "Bright and buzzy; every peak present.", target: "Saw selected", check: (s) => s.state.shape === "saw" },
      { do: "Play a low note and a high note on Saw, then switch to Sine and play both again.", show: ["keyboard", "hold", "scope", "spectrum", "shape"], hear: "Saw stays bright everywhere; a low sine is hard to hear on small speakers.", target: "Two notes played, ending on Sine",
        check: (s) => s.distinctNotes >= 2 && s.state.shape === "sine" && (s.changes.shape ?? 0) >= 1 },
    ],
    recap: ["Sine: one harmonic. Triangle: a few quiet odd ones.", "Square: strong odd harmonics, hollow.", "Saw: all harmonics, bright."],
    inSerum: "Load Init and step Osc A’s wavetable position (WT POS) through the default table’s shapes while holding a note. Listening only; nothing to check.",
  },
  {
    id: "C1.2", title: "Octave, semitone and fine", buildsOn: ["C0.2"], minutes: 7, cardIds: ["oscillator-pitch"],
    demo: { caption: "One key three ways: as played, an octave down, then up a fifth.", tones: seq([{ shape: "saw", hz: A4 }, { shape: "saw", hz: A4 / 2 }, { shape: "saw", hz: noteToHz(76) }]) },
    outcome: "Place an oscillator in a register and offset it by a musical interval or a few cents.",
    idea: [
      "Three controls move an oscillator relative to the key you press. Octave moves it in doublings. Semitone moves it in keyboard steps, twelve to the octave.",
      "Fine moves it in cents, a hundred to the semitone, which is too small to hear as a new note.",
    ],
    steps: [
      { do: "Switch on Hold, play a middle note, and set Octave to -1.", show: ["keyboard", "hold", "octave"], hear: "The same note, lower.", target: "Octave is -1", check: (s) => s.state.octave === -1 },
      { do: "Set Octave to -2.", show: ["keyboard", "hold", "octave"], hear: "Bass register.", target: "Octave is -2", check: (s) => s.state.octave === -2,
        remark: () => "Two octaves down puts this in bass territory: the same key now plays a quarter of the frequency." },
      { do: "Return Octave to 0 and set Semitone to +7.", show: ["keyboard", "hold", "octave", "semitone"], hear: "A different note: a fifth above the key.", target: "Octave 0, semitone +7", check: (s) => s.state.octave === 0 && s.state.semitone === 7 },
      { do: "Set Semitone back to 0 and move Fine to about +20 cents.", show: ["keyboard", "hold", "semitone", "fine"], hear: "Barely any change.", target: "Semitone 0, fine between 15 and 25", check: (s) => s.state.semitone === 0 && within(s.state.fine, 15, 25),
        remark: (s) => `You set ${s.state.fine} cents. On its own that is almost inaudible; it starts to matter when a second oscillator is there to compare with.` },
      { do: "Reset Fine to 0.", show: ["keyboard", "hold", "fine"], hear: "No change you can name.", target: "Fine is 0", check: (s) => s.state.fine === 0 && (s.changes.fine ?? 0) >= 1 },
    ],
    recap: ["Octave sets register.", "Semitones make intervals.", "Fine tune only matters next to another sound."],
    inSerum: "Start from Init and set Osc A’s OCT one step down. Save it and drop it into the “Oscillators and pitch” Serum task: the app checks the stored octave.",
  },
  {
    id: "C1.M", title: "Match by ear: shape and pitch", buildsOn: ["C1.1", "C1.2"], minutes: 8, cardIds: [],
    outcome: "Recreate a hidden sound using only your ears: pick its wave shape and find its octave and interval.",
    idea: [
      "This is the skill the whole course builds toward. You hear a target sound and your own sound on the same key, and you change your settings until the two match.",
      "The target's settings stay hidden. When you check, the app tells you which settings match and which way the others are off, never the numbers.",
    ],
    steps: [],
    rounds: [
      { target: { shape: "square" }, match: ["shape"], from: { shape: "saw", octave: 0, semitone: 0, fine: 0 } },
      { target: { shape: "saw", octave: -1 }, match: ["shape", "octave"], from: { shape: "sine", octave: 0, semitone: 0, fine: 0 } },
      { target: { shape: "triangle", octave: 1, semitone: 0 }, match: ["shape", "octave", "semitone"], from: { shape: "saw", octave: 0, semitone: 0, fine: 0 } },
      { target: { shape: "square", octave: -1, semitone: 7 }, match: ["shape", "octave", "semitone"], from: { shape: "sine", octave: 0, semitone: 0, fine: 0 } },
    ],
    recap: ["Listen for one quality at a time: colour first, then register, then interval.", "Switching quickly between target and yours makes differences obvious.", "Being told “too high” or “too low” is enough; you do not need the number."],
  },
];

/** Every playable lesson, in suggested order. */
/**
 * A checkpoint that mixes the four by-ear checkpoints before it, so the learner has to work out WHICH part of
 * the synth is different before fixing it (docs/LEARNING_RESEARCH.md: mixing kinds is what teaches telling
 * things apart). It borrows rounds from those checkpoints. Each round starts from a clean synth, and shows
 * the controls of all four parts, not only the ones that matter.
 */
function mixedCheckpoint(): PlayableLesson {
  const round = (id: string, i: number) => [...CHAPTER_1, ...CHAPTER_2, ...CHAPTER_3, ...CHAPTER_4].find((l) => l.id === id)!.rounds![i]!;
  const picked = [round("C2.C", 1), round("C4.C", 1), round("C1.C", 1), round("C3.C", 1), round("C4.C", 3), round("C2.C", 2), round("C3.C", 2), round("C1.C", 0)];
  const keys = [...new Set(picked.flatMap((r) => [...Object.keys(r.from), ...Object.keys(r.target)]))] as (keyof SynthState)[];
  const clean = Object.fromEntries(keys.map((k) => [k, INITIAL[k]])) as Partial<SynthState>;
  // one control from each part is always on show, plus whatever the round is really about
  const always: (keyof SynthState)[] = ["voices", "detune", "cutoff", "resonance", "envA", "envS", "lfo1Rate", "lfo1Amount"];
  const rounds: MatchRound[] = picked.map((r) => ({ ...r, from: { ...clean, ...r.from }, controls: [...new Set([...always, ...(r.controls ?? r.match)])] }));
  return {
    id: "CX.1", title: "Mixed checkpoint: which part is it?", buildsOn: ["C1.C", "C2.C", "C3.C", "C4.C"], minutes: 14, cardIds: [],
    outcome: "Hear a hidden sound and work out which part of the synth makes it different: the oscillators, the filter, an envelope or an LFO.",
    idea: [
      "In the checkpoints so far you always knew where to look. Here you do not. Each round hides a sound that differs from yours in one part of the synth, and the controls of all four parts are in front of you.",
      "Ask in this order. Is the tone itself thicker or thinner? That is the oscillators. Is the top or bottom missing, or is there a whistle? That is the filter. Does it change once over the note? That is an envelope. Does it keep moving in a repeating way? That is an LFO.",
    ],
    steps: [], rounds,
    recap: ["Work out which part is different before touching anything.", "A change that happens once per note is an envelope; one that keeps repeating is an LFO.", "A steady difference in tone is the oscillators or the filter: thickness for one, missing top or bottom for the other."],
  };
}

/** Later lessons go into their chapter just before its checkpoint (or at the end, if it has none). */
const slot = (chapter: PlayableLesson[], extra: PlayableLesson[], checkpoint: string): PlayableLesson[] => {
  const at = chapter.findIndex((l) => l.id === checkpoint);
  return at < 0 ? [...chapter, ...extra] : [...chapter.slice(0, at), ...extra, ...chapter.slice(at)];
};
export const LESSONS: PlayableLesson[] = [...BASE, ...slot(CHAPTER_1, OSC_ADDITIONS, "C1.C"), ...slot(CHAPTER_2, FILTER_ADDITIONS, "C2.C"), ...CHAPTER_3, ...CHAPTER_4, mixedCheckpoint(), ...CHAPTER_5, ...MACRO_CHAPTER, ...slot(CHAPTER_6, WARP_ADDITIONS, "C6.C"), ...slot(CHAPTER_7, FX_ADDITIONS, "C7.C"), ...CHAPTER_8, ...IMPACT_CHAPTER];

/**
 * Chapter names, by the number in a lesson's id ("C2.5" is in chapter 2). Ids are for code, scripts and
 * plans; the learner sees the chapter name, the lesson's place in it, and its title.
 */
export const CHAPTERS: Record<string, string> = { "0": "Sound itself", "1": "Oscillators", "2": "Filters", "3": "Envelopes", "4": "LFOs", "5": "Modulation", "5M": "Macros", "6": "Reshaping the wave", "7": "Effects", "X": "Mixed practice", "8": "Playing a line", "T": "Impacts" };
/** The order chapters are listed in. (An object's number-like keys sort themselves, which would misplace "5M".) */
export const CHAPTER_ORDER = ["0", "1", "2", "3", "4", "X", "5", "5M", "6", "7", "8", "T"];
export const chapterOf = (lesson: PlayableLesson) => lesson.id.slice(1, lesson.id.indexOf("."));
/** Where a lesson sits: its chapter's name, its number within the chapter, and how many the chapter has. */
export function placeOf(lesson: PlayableLesson, lessons: PlayableLesson[] = LESSONS): { chapter: string; number: number; of: number } {
  const mates = lessons.filter((l) => chapterOf(l) === chapterOf(lesson));
  return { chapter: CHAPTERS[chapterOf(lesson)] ?? `Chapter ${chapterOf(lesson)}`, number: mates.indexOf(lesson) + 1, of: mates.length };
}

export { anyNote };
