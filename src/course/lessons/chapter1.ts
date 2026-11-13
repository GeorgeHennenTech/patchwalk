// Chapter 1, lessons C1.3 to C1.8 and the chapter checkpoint. Converted from docs/lessons/.
import { beatHz, brightness, harmonicsA, PARAMS } from "../../synth/params";
import type { DemoTone, PlayableLesson, Snapshot } from "../types";

const total = (s: Snapshot) => s.played.mouse + s.played.keys + s.played.midi;
const between = (v: number, lo: number, hi: number) => v >= lo && v <= hi;
const gap = (s: Snapshot) => s.state.bFine - s.state.fine;
const phaseApart = (s: Snapshot) => (((s.state.bPhase - s.state.phase) % 360) + 360) % 360;
const samePitch = (s: Snapshot) => s.state.octave === s.state.bOctave && s.state.semitone === s.state.bSemitone && s.state.fine === s.state.bFine;
const patches = (list: DemoTone["patch"][], len = 1.3, note = 57): DemoTone[] => list.map((patch, i) => ({ patch, note, at: i * (len + 0.2), seconds: len }));
/** How bright the brightest frame of the current table is, for "find the brightest frame". */
const peakBrightness = (s: Snapshot) => Math.max(...Array.from({ length: 101 }, (_, position) => brightness(harmonicsA({ ...s.state, position }))));
const K = ["keyboard", "hold"] as const;

export const CHAPTER_1: PlayableLesson[] = [
  {
    id: "C1.3", title: "Wavetables", buildsOn: ["C1.1"], minutes: 8, cardIds: ["wavetable"],
    outcome: "Choose a wavetable and use its position control to move between shapes.",
    demo: { caption: "One note at the start, middle and end of a wavetable.", tones: patches([{ table: "basic", position: 0 }, { table: "basic", position: 50 }, { table: "basic", position: 100 }]) },
    idea: [
      "A wavetable is a row of single-cycle shapes. The oscillator plays one at a time, and Position chooses which.",
      "Between neighbours the shapes blend, so sweeping the position changes the harmonics smoothly while the pitch stays put. That is something a single fixed shape cannot do.",
    ],
    steps: [
      { do: "Switch on Hold, play a note, and choose the “Basic morph” wavetable.", show: [...K, "table", "spectrum"], hear: "It depends on the frame; at the start of this table, a pure tone.", target: "Basic morph selected, note held", check: (s) => s.state.table === "basic" && s.held.length >= 1 },
      { do: "Sweep Position slowly from one end to the other.", show: [...K, "table", "position", "spectrum", "scope"], hear: "The colour changing while the pitch stays the same.", target: "Position has visited both ends", check: (s) => (s.range.position?.min ?? 100) <= 5 && (s.range.position?.max ?? 0) >= 95 },
      { do: "Stop somewhere in the middle that you like.", show: [...K, "position", "spectrum", "scope"], hear: "Your chosen colour.", target: "Position between 10% and 90%", check: (s) => between(s.state.position, 10, 90) && (s.changes.position ?? 0) >= 1,
        remark: (s) => `You stopped at ${s.state.position}%. In this table that sits between ${["sine and triangle", "triangle and square", "square and saw"][Math.min(2, Math.floor((s.state.position / 100) * 3))]}.` },
      { do: "Choose a different wavetable and sweep Position again.", show: [...K, "table", "position", "spectrum", "scope"], hear: "A different kind of change.", target: "Another table, position swept most of the way",
        check: (s) => s.state.table !== "basic" && s.state.table !== "none" && (s.range.position?.max ?? 0) - (s.range.position?.min ?? 0) >= 80 },
      { do: "Find the brightest frame in this table.", show: [...K, "position", "spectrum"], hear: "The buzziest colour the table has.", target: "Position at the brightest part of the table",
        check: (s) => s.state.table !== "none" && (s.changes.position ?? 0) >= 1 && brightness(harmonicsA(s.state)) >= 0.95 * peakBrightness(s),
        remark: (s) => `The brightest part of ${PARAMS.table!.names![s.state.table]} is around ${s.state.position}%: that is where the most energy sits in the upper harmonics.` },
    ],
    recap: ["A wavetable is a row of shapes.", "Position picks one and blends between neighbours.", "Sweeping it changes colour without changing pitch."],
    inSerum: "From Init, load any other wavetable into Osc A and move WT POS. Save it and drop it into the “Wavetables” Serum task: the app checks that the table and the position both changed. The practice synth’s tables are made for this app and will not match Serum’s.",
  },
  {
    id: "C1.4", title: "Two oscillators", buildsOn: ["C1.2"], minutes: 7, cardIds: ["oscillator-level"],
    outcome: "Layer a second oscillator, balance it against the first, and make one key play an interval.",
    demo: { caption: "Oscillator A alone, then B added an octave above, then B a fifth above.", tones: patches([{}, { bOn: true, bOctave: 1, bLevelDb: -6 }, { bOn: true, bSemitone: 7, bLevelDb: -3 }]) },
    idea: [
      "A second oscillator is a second source in the same patch. At the same pitch it thickens the tone. An octave apart it adds weight or sparkle.",
      "At other intervals one key plays two notes. Their levels are a small mix: the louder one sets the character.",
    ],
    steps: [
      { do: "Switch on Hold and play a note with only oscillator A.", show: [...K, "bOn"], hear: "The single tone.", target: "Osc B off, note held", check: (s) => !s.state.bOn && s.held.length >= 1 },
      { do: "Switch on Osc B, at the same pitch and shape as A.", show: [...K, "bOn", "bShape", "spectrum"], hear: "Louder and slightly fuller.", target: "Osc B on, same shape, octave and semitone as A",
        check: (s) => s.state.bOn && s.state.bShape === s.state.shape && s.state.bOctave === s.state.octave && s.state.bSemitone === s.state.semitone },
      { do: "Set Osc B one octave up.", show: [...K, "bOctave", "spectrum"], hear: "Added brightness on top.", target: "B octave is +1", check: (s) => s.state.bOn && s.state.bOctave === 1 },
      { do: "Lower Osc B’s level until it supports A and does not dominate.", show: [...K, "bLevelDb", "spectrum"], hear: "A still the main tone, with a sheen above it.", target: "B at least 6 dB below A", check: (s) => s.state.bOn && s.state.bLevelDb <= -6,
        remark: (s) => `You put B ${-s.state.bLevelDb} dB under A. ${s.state.bLevelDb <= -18 ? "That is very quiet: more of a hint than a layer." : "That keeps A in charge while B colours it."}` },
      { do: "Set Osc B’s octave back to 0 and its semitone to +7.", show: [...K, "bOctave", "bSemitone"], hear: "One key playing a fifth.", target: "B octave 0, semitone +7", check: (s) => s.state.bOn && s.state.bOctave === 0 && s.state.bSemitone === 7 },
    ],
    recap: ["A second oscillator thickens, adds register, or adds an interval.", "Their levels are a mix.", "The louder oscillator defines the sound."],
    inSerum: "From Init, switch on Osc B and set its OCT one step above Osc A. Level is the LEVEL knob on each oscillator.",
  },
  {
    id: "C1.5", title: "Detune and beating", buildsOn: ["C1.4"], minutes: 8, cardIds: ["detuned-pair"], initial: { bOn: true, octave: -1, bOctave: -1 },
    outcome: "Make two oscillators beat against each other and control how fast the movement is.",
    demo: { caption: "Two oscillators exactly in tune, then nudged apart: a still tone turning into a slow roll.", tones: patches([{ bOn: true, octave: -1, bOctave: -1 }, { bOn: true, octave: -1, bOctave: -1, fine: -8, bFine: 8 }], 2.4) },
    idea: [
      "Two tones at almost the same frequency drift in and out of step. In step they add; out of step they cancel. You hear that as a swell that repeats.",
      "The swell repeats at a rate equal to the difference between the two frequencies. A wider gap beats faster, and the same gap in cents beats faster on higher notes.",
    ],
    steps: [
      { do: "Switch on Hold and play a low note. Both oscillators start at the same pitch.", show: [...K, "fine", "bFine", "beat"], hear: "A steady tone.", target: "Both fine controls at 0, note held", check: (s) => s.state.fine === 0 && s.state.bFine === 0 && s.held.length >= 1 },
      { do: "Move A’s Fine to about -5 cents and B’s to about +5.", show: [...K, "fine", "bFine", "beat"], hear: "A slow swell.", target: "A gap of 8 to 12 cents", check: (s) => between(gap(s), 8, 12) && s.state.fine < 0 },
      { do: "Widen the gap until the beat rate reads about 4 per second.", show: [...K, "fine", "bFine", "beat"], hear: "A faster roll.", target: "3.5 to 4.5 beats per second on the key you are holding",
        check: (s) => s.lastNote !== null && between(beatHz(s.state, s.lastNote), 3.5, 4.5),
        remark: (s) => `You reached ${beatHz(s.state, s.lastNote ?? 57).toFixed(1)} beats per second with a gap of ${Math.abs(gap(s))} cents.` },
      { do: "Keep the gap and play a key an octave higher.", show: [...K, "beat"], hear: "The roll speeding up.", target: "A higher key played, beat rate above 6.5 per second",
        check: (s) => total(s) >= 1 && s.lastNote !== null && beatHz(s.state, s.lastNote) >= 6.5 && (s.changes.fine ?? 0) + (s.changes.bFine ?? 0) === 0,
        remark: () => "Same gap in cents, but an octave up every frequency doubles, so the difference between the two doubles as well." },
      { do: "Go back to a low key and find a gap you like for a bass sound.", show: [...K, "fine", "bFine", "beat"], hear: "A restless, moving low tone.", target: "Any gap over 4 cents, changed in this step",
        check: (s) => Math.abs(gap(s)) > 4 && (s.changes.fine ?? 0) + (s.changes.bFine ?? 0) >= 1,
        remark: (s) => (Math.abs(gap(s)) > 50 ? `A ${Math.abs(gap(s))} cent gap is past a quarter-tone: it has stopped sounding like one note and started sounding out of tune.` : `You chose a ${Math.abs(gap(s))} cent gap.`) },
    ],
    recap: ["Two near-equal pitches beat.", "Beat speed is the frequency difference.", "Wider gaps and higher notes beat faster."],
    inSerum: "From Init, switch on Osc B and set FIN on A and B in opposite directions. Save it and drop it into the “A second oscillator” Serum task: the app checks that B is on and the two fine values differ.",
  },
  {
    id: "C1.6", title: "Unison", buildsOn: ["C1.5"], minutes: 8, cardIds: ["unison-detune"],
    outcome: "Thicken a single oscillator with unison and judge when it turns from wide to blurry.",
    demo: { caption: "One voice, then seven voices spread apart.", tones: patches([{}, { voices: 7, detune: 35, spread: 70 }], 1.8) },
    idea: [
      "Unison is the detuning trick done inside one oscillator: several copies, spread slightly in pitch. With many copies the individual beats average out into a smooth thickness.",
      "Spreading the copies across left and right adds width.",
    ],
    steps: [
      { do: "Switch on Hold and play a note with one voice.", show: [...K, "voices"], hear: "The plain tone.", target: "One voice, note held", check: (s) => s.state.voices === 1 && s.held.length >= 1 },
      { do: "Raise Voices to 3, leaving Detune at zero.", show: [...K, "voices", "detune"], hear: "Much the same tone: the copies are identical.", target: "3 voices, detune 0", check: (s) => s.state.voices === 3 && s.state.detune === 0 },
      { do: "Raise Detune slowly.", show: [...K, "voices", "detune", "scope"], hear: "A swirl appearing.", target: "Detune above zero", check: (s) => s.state.detune > 0 },
      { do: "Raise Voices to 7.", show: [...K, "voices", "detune"], hear: "Smoother and thicker.", target: "7 voices", check: (s) => s.state.voices === 7 },
      { do: "Push Detune until the note sounds sour, then back off to where it is thick but still in tune.", show: [...K, "detune"], hear: "The edge of “too much”.", target: "Detune taken above 60, then brought back at least 15",
        check: (s) => (s.range.detune?.max ?? 0) >= 60 && s.state.detune <= (s.range.detune?.max ?? 0) - 15 && s.state.detune > 0,
        remark: (s) => `You went as far as ${s.range.detune?.max} cents and settled on ${s.state.detune}. ${s.state.detune > 45 ? "That is still a wide, obvious detune." : "That is in the range most thick-but-tuned patches use."}` },
      { do: "Raise Spread.", show: [...K, "spread"], hear: "The sound opening out to the sides (headphones make this clearest).", target: "Spread above zero", check: (s) => s.state.spread > 0 },
    ],
    recap: ["Unison stacks detuned copies.", "More voices sound smoother.", "Too much detune blurs the pitch."],
    inSerum: "From Init, give Osc A three or more UNISON voices and raise DETUNE. Save it and drop it into the “Unison” Serum task: the app checks the stored voice count.",
  },
  {
    id: "C1.7", title: "Sub and noise", buildsOn: ["C1.4"], minutes: 6, cardIds: ["noise-and-sub"], initial: { octave: 0 },
    outcome: "Add a sub for weight and noise for air, and keep both in proportion.",
    demo: { caption: "A bright tone alone, then with a sub underneath, then with a layer of noise on top.", tones: patches([{}, { subOn: true, subLevelDb: -3 }, { subOn: true, subLevelDb: -3, noiseOn: true, noiseLevelDb: -14 }]) },
    idea: [
      "A sub oscillator is a simple low tone under the main pitch. It anchors the low end and stays steady even when the main oscillators are detuned.",
      "Noise has no pitch: its energy is spread across the spectrum, so it reads as breath, air or grit.",
    ],
    steps: [
      { do: "Switch on Hold and play a note in the middle of the keyboard.", show: [...K, "subOn", "noiseOn", "spectrum"], hear: "The main tone.", target: "Sub and noise off, note held", check: (s) => !s.state.subOn && !s.state.noiseOn && s.held.length >= 1 },
      { do: "Switch on the sub, one octave down.", show: [...K, "subOn", "subOctave", "spectrum"], hear: "Weight underneath; a new peak at the far left of the spectrum.", target: "Sub on at -1 octave", check: (s) => s.state.subOn && s.state.subOctave === -1 },
      { do: "Push the sub level up until it is obvious, then pull it back so it supports the tone.", show: [...K, "subLevelDb", "spectrum"], hear: "The low end swelling, then settling under the main tone.", target: "Sub level taken to -2 dB or above, then back to -6 dB or below",
        check: (s) => (s.range.subLevelDb?.max ?? -99) >= -2 && s.state.subLevelDb <= -6 },
      { do: "Switch on white noise at a low level.", show: [...K, "noiseOn", "noiseType", "noiseLevelDb", "spectrum"], hear: "A hiss; the spectrum filling in everywhere.", target: "White noise on, at -12 dB or below", check: (s) => s.state.noiseOn && s.state.noiseType === "white" && s.state.noiseLevelDb <= -12 },
      { do: "Switch the noise to pink.", show: [...K, "noiseType", "spectrum"], hear: "A darker, softer hiss.", target: "Pink noise selected", check: (s) => s.state.noiseOn && s.state.noiseType === "pink",
        remark: (s) => (s.state.noiseLevelDb > -12 ? "Your noise is fairly loud; it usually works best well under the tone." : "Pink noise has less energy at the top than white, which is why it sounds darker.") },
    ],
    recap: ["The sub adds steady weight.", "Noise adds unpitched texture.", "Both work best quiet."],
    inSerum: "The sub oscillator has PHASE, PAN and LEVEL; the noise oscillator is a sample player with many noise types. Nothing is checked yet: how these settings read on screen is not confirmed.",
  },
  {
    id: "C1.8", title: "Phase and the start of a note", buildsOn: ["C1.4"], minutes: 6, cardIds: ["oscillator-level"], initial: { shape: "square", bShape: "square" },
    outcome: "Explain why the same note can start differently each time, and choose fixed or random phase on purpose.",
    idea: [
      "Phase is where in its cycle a wave starts. With fixed phase every note begins identically, which is tight and repeatable. With random phase each note begins somewhere different, which sounds more natural but varies.",
      "When two oscillators are layered, their relative phase decides whether they add or cancel. Two identical square waves half a cycle apart cancel completely. Two saws half a cycle apart do not: what is left is a saw an octave higher.",
    ],
    steps: [
      { do: "With Random phase at 0, strike one note four times and watch where the scope starts.", show: ["keyboard", "randomPhase", "scope"], hear: "Identical starts.", target: "Random phase 0, four notes played", check: (s) => s.state.randomPhase === 0 && total(s) >= 4 },
      { do: "Raise Random phase to 100% and strike the note four more times.", show: ["keyboard", "randomPhase", "scope"], hear: "Slightly different starts each time.", target: "Random phase 100%, four notes played", check: (s) => s.state.randomPhase === 100 && total(s) >= 4 },
      { do: "Set Random phase back to 0, switch on Hold and Osc B, play a note, and move B’s phase to 180°.", show: [...K, "randomPhase", "bOn", "bPhase", "scope", "meter"], hear: "The sound almost vanishing.", target: "Osc B on at the same pitch and shape, phases half a cycle apart",
        check: (s) => s.state.bOn && s.state.randomPhase === 0 && s.state.bShape === s.state.shape && samePitch(s) && between(phaseApart(s), 170, 190),
        remark: () => "Half a cycle apart, every harmonic of one square wave is the mirror image of the other, so they cancel. Try the same thing with two saws later: you will hear a saw an octave up instead of silence." },
      { do: "Bring B’s phase back to match A.", show: [...K, "bPhase", "scope", "meter"], hear: "Full level again.", target: "Phases equal", check: (s) => s.state.bOn && phaseApart(s) === 0 && (s.changes.bPhase ?? 0) >= 1 },
      { do: "Switch Osc B off again and leave Random phase at 0, the usual choice for a bass.", show: [...K, "bOn", "randomPhase"], hear: "Every note hitting the same way.", target: "Osc B off, random phase 0", check: (s) => !s.state.bOn && s.state.randomPhase === 0 && (s.changes.bOn ?? 0) >= 1 },
    ],
    recap: ["Phase is where the cycle starts.", "Fixed is consistent; random is natural.", "Opposite phases cancel when the two waves are otherwise identical."],
    inSerum: "On each oscillator, PHASE sets the start point and RAND sets how much it varies. Nothing is checked yet: how these settings read on screen is not confirmed.",
  },
  {
    id: "C1.C", title: "Checkpoint: oscillators by ear", buildsOn: ["C1.3", "C1.4", "C1.5", "C1.6", "C1.7"], minutes: 10, cardIds: [],
    outcome: "Recreate hidden sounds using everything in this chapter: a second oscillator, unison, the sub, and wavetable position.",
    idea: [
      "Each round hides a target built from the controls you have learned. Listen for one thing at a time: is there a second pitch, is it thick, is there weight underneath, how bright is it?",
      "When you check, the app tells you which settings match and which way the others are off, never the numbers.",
    ],
    steps: [],
    rounds: [
      { target: { bOn: true, bOctave: 1 }, match: ["bOn", "bOctave"], from: { bOn: false, bOctave: 0, bLevelDb: -6 } },
      { target: { voices: 5, detune: 30 }, match: ["voices", "detune"], from: { voices: 1, detune: 0, spread: 50 } },
      { target: { shape: "square", subOn: true, subOctave: -1 }, match: ["shape", "subOn", "subOctave"], from: { shape: "saw", subOn: false, subOctave: -2, subLevelDb: -3 } },
      { target: { table: "bright", position: 70 }, match: ["table", "position"], from: { table: "basic", position: 0 } },
      { target: { bOn: true, bSemitone: 7, voices: 3, detune: 20 }, match: ["bOn", "bSemitone", "voices", "detune"], from: { bOn: false, bSemitone: 0, voices: 1, detune: 0, bLevelDb: -4, spread: 40 } },
    ],
    recap: ["Take one quality at a time: pitch content, thickness, weight, brightness.", "Quick switching between target and yours beats long listening.", "“Too high” and “too low” are enough to home in."],
  },
];
