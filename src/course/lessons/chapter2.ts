// Chapter 2: filters. Lessons C2.1 to C2.7 and the chapter checkpoint. Scripts are in docs/lessons/.
import { effectiveCutoff, peakAboveBodyDb } from "../../synth/filter";
import { playedHz } from "../../synth/params";
import type { DemoTone, PlayableLesson, Snapshot } from "../types";

const between = (v: number, lo: number, hi: number) => v >= lo && v <= hi;
const patches = (list: DemoTone["patch"][], len = 1.3, note = 57): DemoTone[] => list.map((patch, i) => ({ patch, note, at: i * (len + 0.2), seconds: len }));
const K = ["keyboard", "hold"] as const;
const hz = (n: number) => (n >= 1000 ? `${(n / 1000).toFixed(n >= 10000 ? 1 : 2)} kHz` : `${Math.round(n)} Hz`);
/** How many octaves the cutoff has covered since the step began. */
const sweptOctaves = (s: Snapshot) => (s.range.cutoff ? Math.log2(s.range.cutoff.max / s.range.cutoff.min) : 0);
const moved = (s: Snapshot, key: keyof Snapshot["changes"]) => (s.changes[key] ?? 0) >= 1;
const F = { filterOn: true } as const;

export const CHAPTER_2: PlayableLesson[] = [
  {
    id: "C2.1", title: "Low-pass cutoff", earCheck: "brighter", buildsOn: ["C1.1"], minutes: 8, cardIds: ["lowpass-cutoff-resonance"],
    outcome: "Switch on a low-pass filter and use its cutoff to take brightness off a sound, from the top down.",
    demo: { caption: "The same bright note three times: untouched, with the top taken off, then with most of it gone.", tones: patches([{}, { ...F, cutoff: 2000 }, { ...F, cutoff: 500 }]) },
    idea: [
      "A filter turns down part of a sound and leaves the rest alone. A low-pass filter lets the low part pass and turns down everything above one frequency, the cutoff.",
      "You already know a bright sound is a long row of harmonics. Lowering the cutoff removes them from the top, one after another, so the same note goes from buzzy to rounded to dull. The curve on screen shows what gets through: flat on the left, falling away on the right.",
    ],
    steps: [
      { do: "Switch on Hold and play a note with the filter off.", show: [...K, "filterOn", "spectrum"], hear: "The plain bright tone, with its full row of peaks.", target: "Filter off, note held", check: (s) => !s.state.filterOn && s.held.length >= 1 },
      { do: "Switch the filter on. Its cutoff starts all the way up.", show: [...K, "filterOn", "curve"], hear: "No change yet: the cutoff is above everything in the sound.", target: "Filter on", check: (s) => s.state.filterOn },
      { do: "Bring Cutoff down slowly to about 1 kHz.", show: [...K, "cutoff", "curve"], hear: "The buzz fading from the top down.", target: "Cutoff between 800 Hz and 1.2 kHz", check: (s) => s.state.filterOn && between(s.state.cutoff, 800, 1200) },
      { do: "Keep going until only a dull hum is left.", show: [...K, "cutoff", "curve"], hear: "Almost a pure tone: only the lowest harmonics survive.", target: "Cutoff at 250 Hz or below", check: (s) => s.state.filterOn && s.state.cutoff <= 250,
        remark: (s) => {
          const n = Math.floor(s.state.cutoff / playedHz(s.state, s.lastNote ?? 57));
          return `At ${hz(s.state.cutoff)} ${n <= 1 ? "only the lowest harmonic of your note sits below the cutoff" : `only the lowest ${n} harmonics of your note sit below the cutoff`}. The rest are still there, but turned down more the higher they are.`;
        } },
      { do: "Now grab the dot on the filter curve and sweep it left and right a few times.", show: [...K, "curve"], hear: "The tone opening and closing, like a mouth saying “wow”.", target: "The dot dragged across at least two octaves", check: (s) => !!s.flags.curve && sweptOctaves(s) >= 2 },
      { do: "Settle on a cutoff where the sound is rounded but not dull.", show: [...K, "cutoff", "curve"], hear: "Your choice: softer than the raw tone, still clear.", target: "Cutoff between 400 Hz and 4 kHz, moved in this step", check: (s) => s.state.filterOn && moved(s, "cutoff") && between(s.state.cutoff, 400, 4000),
        remark: (s) => `You settled on ${hz(s.state.cutoff)}. ${s.state.cutoff < 1000 ? "That is on the dark side: good for basses and pads." : "That keeps a fair amount of edge."}` },
    ],
    recap: ["A low-pass filter passes the lows and turns down what is above the cutoff.", "Lowering the cutoff removes harmonics from the top down.", "The filter curve shows what gets through at each frequency."],
    inSerum: "From Init, switch on Filter 1 and bring CUTOFF down. Save it and drop it into “The filter” Serum task: the app checks that the filter is on and the cutoff has moved.",
  },
  {
    id: "C2.2", title: "Resonance", buildsOn: ["C2.1"], minutes: 7, cardIds: ["lowpass-cutoff-resonance"], initial: { ...F, cutoff: 1200 },
    outcome: "Add a resonant peak at the cutoff, hear what it does to a sweep, and judge when it is too much.",
    demo: { caption: "A filtered note, then the same note with a strong resonant peak.", tones: patches([{ ...F, cutoff: 800 }, { ...F, cutoff: 800, resonance: 70 }], 1.6) },
    idea: [
      "Resonance boosts a narrow band right at the cutoff. On the curve it is a bump that grows into a spike.",
      "Whatever harmonic sits under the bump is pushed forward, so the filter gains a pitch of its own, and a sweep turns from a plain fade into a whistle or a squelch. On this synth, as on many, the rest of the sound is turned down as the peak grows.",
    ],
    steps: [
      { do: "Switch on Hold and play a note. The filter is already on, with no resonance.", show: [...K, "resonance", "curve"], hear: "A rounded tone.", target: "Resonance at 0, note held", check: (s) => s.state.resonance === 0 && s.held.length >= 1 },
      { do: "Raise Resonance to about 50%.", show: [...K, "resonance", "curve"], hear: "A nasal edge; a bump appears on the curve at the cutoff.", target: "Resonance between 40% and 60%", check: (s) => between(s.state.resonance, 40, 60) },
      { do: "Sweep the cutoff up and down with the resonance left where it is.", show: [...K, "cutoff", "resonance", "curve"], hear: "A “wow” with an edge that follows the cutoff, picking out harmonics one at a time.", target: "Cutoff swept across two octaves, resonance still at 40% or more", check: (s) => s.state.resonance >= 40 && sweptOctaves(s) >= 2 },
      { do: "Push Resonance past 85%.", show: [...K, "cutoff", "resonance", "curve", "meter"], hear: "A sharp whistle, and less body underneath it.", target: "Resonance at 85% or more", check: (s) => s.state.resonance >= 85,
        remark: (s) => `At ${s.state.resonance}% the peak stands about ${Math.round(peakAboveBodyDb(s.state))} dB above the body of the sound. That is why the whistle dominates and everything else seems to shrink.` },
      { do: "Bring it back to a level that adds character without taking over.", show: [...K, "cutoff", "resonance", "curve"], hear: "Edge, but the note itself is still in charge.", target: "Resonance brought back to between 15% and 50%", check: (s) => between(s.state.resonance, 15, 50) && moved(s, "resonance"),
        remark: (s) => `You settled on ${s.state.resonance}%: a peak of about ${Math.round(peakAboveBodyDb(s.state))} dB.` },
    ],
    recap: ["Resonance is a boost right at the cutoff.", "It makes a sweep whistle or squelch, because it picks out harmonics one by one.", "A lot of resonance thins the body of the sound."],
    inSerum: "From Init, switch on Filter 1, lower CUTOFF and raise RES, then sweep. How RES reads on screen is not confirmed yet, so nothing is checked.",
  },
  {
    id: "C2.3", title: "High-pass, band-pass and notch", earCheck: "filterType", buildsOn: ["C2.2"], minutes: 8, cardIds: ["filter-types-and-slope"], initial: { ...F, cutoff: 1000 },
    outcome: "Choose between the four basic filter shapes by what each one keeps and what it removes.",
    demo: { caption: "One note through four filters: low-pass, high-pass, band-pass, notch.", tones: patches([{ ...F, cutoff: 1000 }, { ...F, cutoff: 1000, filterType: "high" }, { ...F, cutoff: 1000, filterType: "band", resonance: 30 }, { ...F, cutoff: 1000, filterType: "notch" }], 1.1) },
    idea: [
      "The same cutoff control can do four different jobs. Low-pass keeps what is below it. High-pass keeps what is above it. Band-pass keeps a slice around it. Notch removes a slice around it and keeps the rest.",
      "On the band-pass and notch shapes, resonance sets how narrow the slice is.",
    ],
    steps: [
      { do: "Switch on Hold and play a note on the low-pass filter.", show: [...K, "filterType", "curve"], hear: "The rounded tone from the last two lessons.", target: "Low-pass, note held", check: (s) => s.state.filterType === "low" && s.held.length >= 1 },
      { do: "Switch to High-pass.", show: [...K, "filterType", "curve"], hear: "Thin and buzzy: the body is gone and the top is left. The curve has flipped.", target: "High-pass selected", check: (s) => s.state.filterType === "high" },
      { do: "Raise the cutoff until only fizz is left.", show: [...K, "cutoff", "curve"], hear: "The note’s weight draining away from the bottom up.", target: "High-pass with the cutoff at 3 kHz or above", check: (s) => s.state.filterType === "high" && s.state.cutoff >= 3000 },
      { do: "Switch to Band-pass and bring the cutoff back to around 1 kHz.", show: [...K, "filterType", "cutoff", "curve"], hear: "A small, boxy sound, like a voice on a telephone.", target: "Band-pass with the cutoff between 700 Hz and 1.5 kHz", check: (s) => s.state.filterType === "band" && between(s.state.cutoff, 700, 1500) },
      { do: "Raise Resonance to narrow the band.", show: [...K, "resonance", "curve"], hear: "The slice closing in toward a single whistling harmonic.", target: "Band-pass with resonance at 50% or more", check: (s) => s.state.filterType === "band" && s.state.resonance >= 50 },
      { do: "Switch to Notch and sweep the cutoff.", show: [...K, "filterType", "cutoff", "resonance", "curve"], hear: "A subtle hollow spot moving through the sound.", target: "Notch, with the cutoff swept across two octaves", check: (s) => s.state.filterType === "notch" && sweptOctaves(s) >= 2,
        remark: () => "The notch is the quietest of the four because it removes so little: one narrow slice out of a full row of harmonics. It becomes obvious when it moves, which is how a phaser effect works." },
    ],
    recap: ["Low-pass keeps the lows; high-pass keeps the highs.", "Band-pass keeps a slice; notch removes one.", "On band-pass and notch, resonance sets the width of the slice."],
    inSerum: "On Filter 1, open the filter type menu and try a high-pass, a band-pass and a notch type while sweeping CUTOFF. Listening only: Serum has many more types than these four.",
  },
  {
    id: "C2.4", title: "Slope", buildsOn: ["C2.1"], minutes: 6, cardIds: ["filter-types-and-slope"], initial: { ...F, cutoff: 600 },
    outcome: "Hear the difference between a gentle and a steep filter, and pick one on purpose.",
    demo: { caption: "The same cutoff twice: first a gentle slope, then a steep one.", tones: patches([{ ...F, cutoff: 600 }, { ...F, cutoff: 600, slope: "24" }], 1.6) },
    idea: [
      "A filter does not cut everything past the cutoff at once. It turns things down more and more the further past the cutoff they are. Slope is how fast: it is measured in decibels per octave.",
      "With the gentle slope here, a harmonic one octave above the cutoff is 12 dB down. With the steep one it is 24 dB down. Steeper sounds darker and more decisive at the same cutoff.",
    ],
    steps: [
      { do: "Switch on Hold and play a note on the gentle slope.", show: [...K, "slope", "curve"], hear: "A darkened tone that still has some edge.", target: "Gentle slope, note held", check: (s) => s.state.slope === "12" && s.held.length >= 1 },
      { do: "Switch to the steep slope.", show: [...K, "slope", "curve", "spectrum"], hear: "Darker, though the cutoff has not moved. The curve falls twice as fast.", target: "Steep slope selected", check: (s) => s.state.slope === "24" },
      { do: "Switch back and forth a few times while the note sounds.", show: [...K, "slope", "curve", "spectrum"], hear: "The upper harmonics stepping down and up.", target: "Switched at least four times", check: (s) => (s.changes.slope ?? 0) >= 4 },
      { do: "On the steep slope, raise the cutoff until it is about as bright as the gentle slope was.", show: [...K, "slope", "cutoff", "curve"], hear: "Similar brightness, but with a cleaner edge to where the sound stops.", target: "Steep slope, cutoff between 750 Hz and 3 kHz, moved in this step", check: (s) => s.state.slope === "24" && moved(s, "cutoff") && between(s.state.cutoff, 750, 3000),
        remark: (s) => `You went from ${hz(s.start.cutoff)} to ${hz(s.state.cutoff)}. A steeper filter needs a higher cutoff for the same brightness, because it removes more of what lies above it.` },
      { do: "Add some resonance and sweep the cutoff on the steep slope.", show: [...K, "cutoff", "resonance", "curve"], hear: "A more dramatic sweep than the gentle slope gave.", target: "Steep slope, resonance 40% or more, cutoff swept across two octaves", check: (s) => s.state.slope === "24" && s.state.resonance >= 40 && sweptOctaves(s) >= 2 },
    ],
    recap: ["Slope is how fast the filter turns things down past the cutoff.", "It is counted in decibels per octave: 12 is gentle, 24 is steep.", "Steeper sounds darker at the same cutoff."],
    inSerum: "In Filter 1’s type menu, the number at the end of a type’s name is its slope in dB per octave (the manual lists 6, 12, 18 and 24). Compare a 12 and a 24 of the same family. Listening only.",
  },
  {
    id: "C2.5", title: "Drive", buildsOn: ["C2.1"], minutes: 7, cardIds: ["filter-drive-and-key-tracking"], initial: { ...F, cutoff: 900, octave: -1 },
    outcome: "Push a sound into the filter hard enough to distort it, and know what that adds.",
    demo: { caption: "A filtered bass note clean, then driven hard.", tones: patches([{ ...F, cutoff: 900, octave: -1 }, { ...F, cutoff: 900, octave: -1, drive: 80 }], 1.6) },
    idea: [
      "Drive turns the sound up on its way into the filter until the wave no longer fits and its peaks are squashed flat. Changing a wave’s shape adds harmonics, so the sound gets thicker and grittier.",
      "Because the squashing happens before the filter, the filter then smooths the new harmonics. Dark filter, heavy drive: warm and thick. Open filter, heavy drive: harsh.",
    ],
    steps: [
      { do: "Switch on Hold and play a low note with Drive at zero.", show: [...K, "drive", "scope"], hear: "A clean, rounded bass tone.", target: "Drive at 0, note held", check: (s) => s.state.drive === 0 && s.held.length >= 1 },
      { do: "Raise Drive to about 50%.", show: [...K, "drive", "scope", "spectrum"], hear: "Thicker and a little louder, with some grit.", target: "Drive between 40% and 60%", check: (s) => between(s.state.drive, 40, 60) },
      { do: "Push Drive all the way up.", show: [...K, "drive", "scope", "spectrum"], hear: "Squashed and aggressive.", target: "Drive at 90% or more", check: (s) => s.state.drive >= 90 },
      { do: "Leave Drive high and sweep the cutoff.", show: [...K, "drive", "cutoff", "curve"], hear: "The filter taming the grit when it closes and letting it out when it opens.", target: "Drive at 50% or more, cutoff swept across two octaves", check: (s) => s.state.drive >= 50 && sweptOctaves(s) >= 2 },
      { do: "Switch on Osc B and set its semitone to +7, so one key plays two notes into the drive.", show: [...K, "drive", "bOn", "bSemitone"], hear: "A growl: rougher than either note alone.", target: "Osc B on at +7 semitones, drive at 50% or more", check: (s) => s.state.bOn && s.state.bSemitone === 7 && s.state.drive >= 50,
        remark: () => "Distortion does more than add harmonics to each note. When two notes go in together it also creates new tones between and below them, which is why driven chords turn rough and driven single notes stay clear." },
      { do: "Pull Drive back to an amount you would actually use.", show: [...K, "drive", "cutoff", "curve"], hear: "Weight and a little grit, without the mush.", target: "Drive between 10% and 70%, moved in this step", check: (s) => moved(s, "drive") && between(s.state.drive, 10, 70),
        remark: (s) => `You settled on ${s.state.drive}%.` },
    ],
    recap: ["Drive squashes the wave before the filter, which adds harmonics.", "The filter then shapes those new harmonics.", "Single notes stay clear under drive; intervals and chords turn rough."],
    inSerum: "On Filter 1, raise DRIVE while holding a low note. The manual describes it as the gain into the filter circuit, which can add mild distortion. How DRIVE reads on screen is not confirmed yet, so nothing is checked.",
  },
  {
    id: "C2.6", title: "Key tracking", buildsOn: ["C2.2"], minutes: 6, cardIds: ["filter-drive-and-key-tracking"], initial: { ...F, cutoff: 700, resonance: 30 },
    outcome: "Make the filter follow the keyboard so low and high notes are equally bright.",
    demo: { caption: "A low and a high note through a fixed filter, then the same two notes with the filter following the keys.", tones: [
      { patch: { ...F, cutoff: 700, resonance: 30 }, note: 48, at: 0, seconds: 0.9 }, { patch: { ...F, cutoff: 700, resonance: 30 }, note: 79, at: 1.05, seconds: 0.9 },
      { patch: { ...F, cutoff: 700, resonance: 30, keyTrack: 100 }, note: 48, at: 2.5, seconds: 0.9 }, { patch: { ...F, cutoff: 700, resonance: 30, keyTrack: 100 }, note: 79, at: 3.55, seconds: 0.9 },
    ] },
    idea: [
      "A cutoff is a fixed frequency, but notes are not. A cutoff that leaves a low note bright can sit below a high note’s harmonics and leave it dull.",
      "Key tracking moves the cutoff with the key you play. At 100% it moves exactly as far as the pitch does, so every note keeps the same number of harmonics. Here it pivots on middle C: that key always gets the cutoff you set.",
    ],
    steps: [
      { do: "With Key track at 0, play a low key and then a high key.", show: ["keyboard", "keyTrack", "curve"], hear: "The low note bright, the high note dull: the cutoff stays put while the note moves past it.", target: "Key track at 0, two different keys played", check: (s) => s.state.keyTrack === 0 && s.distinctNotes >= 2 },
      { do: "Set Key track to 100%.", show: ["keyboard", "keyTrack", "curve"], hear: "Nothing until you play.", target: "Key track at 100%", check: (s) => s.state.keyTrack === 100 },
      { do: "Play the same low and high keys again and watch the curve.", show: ["keyboard", "keyTrack", "curve"], hear: "Both notes equally bright. The curve jumps to a new place for each key.", target: "Key track at 100%, two different keys played", check: (s) => s.state.keyTrack === 100 && s.distinctNotes >= 2,
        remark: (s) => `On the last key you played the cutoff sat at ${hz(effectiveCutoff(s.state, s.lastNote))}, though the control still says ${hz(s.state.cutoff)}.` },
      { do: "Set Key track to about 50% and play low and high again.", show: ["keyboard", "keyTrack", "curve"], hear: "A halfway house: high notes a little softer than low ones.", target: "Key track between 40% and 60%, two different keys played", check: (s) => between(s.state.keyTrack, 40, 60) && s.distinctNotes >= 2 },
      { do: "Choose the amount that sounds most even to you across the keyboard.", show: ["keyboard", "keyTrack", "curve"], hear: "Your choice.", target: "Key track moved in this step, two different keys played", check: (s) => moved(s, "keyTrack") && s.distinctNotes >= 2,
        remark: (s) => `You chose ${s.state.keyTrack}%. ${s.state.keyTrack >= 80 ? "Full or nearly full tracking is the usual choice when a sound has to play melodies." : "Less than full tracking lets high notes soften, the way many acoustic instruments do."}` },
    ],
    recap: ["A fixed cutoff makes high notes duller than low ones.", "Key tracking moves the cutoff with the key.", "At 100% every note keeps the same brightness."],
    inSerum: "Filter 1 has a keytrack switch beside CUTOFF. The manual says that with it on, one octave on the keyboard moves the cutoff one octave on most filter types. Serum’s is an on/off switch, not an amount. Play low and high notes with it on and off. Listening only.",
  },
  {
    id: "C2.7", title: "The filter as a tone", buildsOn: ["C2.2", "C2.6", "C1.7"], minutes: 7, cardIds: ["lowpass-cutoff-resonance"],
    initial: { ...F, cutoff: 800, aLevelDb: -48, noiseOn: true, noiseLevelDb: -4 },
    outcome: "Turn resonance up until the filter itself sounds like a note, and play that note from the keyboard.",
    demo: { caption: "Plain hiss, then the same hiss through a filter with its resonance right up: a whistle appears.", tones: patches([{ ...F, cutoff: 800, aLevelDb: -48, noiseOn: true, noiseLevelDb: -4 }, { ...F, cutoff: 800, aLevelDb: -48, noiseOn: true, noiseLevelDb: -4, resonance: 100 }], 1.8) },
    idea: [
      "At high resonance a filter rings at its cutoff, the way a glass rings when tapped. Feed it noise, which has energy at every frequency, and the ringing never stops: you hear a whistle with a clear pitch.",
      "On many synths, resonance at maximum makes the filter sing with nothing going in at all. That is called self-oscillation. This practice synth’s filter stops just short of it, so here it needs the noise to keep it going. The pitch still follows the cutoff, and with full key tracking you can play it.",
    ],
    steps: [
      { do: "Switch on Hold and play a note. Oscillator A is turned right down, so you hear only noise through the filter.", show: [...K, "resonance", "curve", "spectrum"], hear: "A dull hiss with no pitch.", target: "Resonance at 0, note held", check: (s) => s.state.resonance === 0 && s.held.length >= 1 },
      { do: "Raise Resonance all the way.", show: [...K, "resonance", "curve", "spectrum"], hear: "A wavering whistle rising out of the hiss.", target: "Resonance at 95% or more", check: (s) => s.state.resonance >= 95 },
      { do: "Move the cutoff and listen to the whistle.", show: [...K, "cutoff", "curve", "spectrum"], hear: "The whistle’s pitch following the cutoff.", target: "Cutoff moved by at least an octave", check: (s) => s.state.resonance >= 95 && sweptOctaves(s) >= 1,
        remark: (s) => `The whistle is now at about ${hz(s.state.cutoff)}: the cutoff frequency is its pitch.` },
      { do: "Set Key track to 100% and play at least three different keys.", show: ["keyboard", "hold", "keyTrack", "curve"], hear: "The whistle moving in step with the keys: a tune made of filtered noise.", target: "Key track at 100%, three different keys played", check: (s) => s.state.keyTrack === 100 && s.distinctNotes >= 3 },
      { do: "Set the cutoff to about 262 Hz, the pitch of middle C.", show: [...K, "cutoff", "keyTrack", "curve"], hear: "The whistle now in tune with the keys.", target: "Cutoff between 255 and 270 Hz, key track at 100%", check: (s) => s.state.keyTrack === 100 && between(s.state.cutoff, 255, 270),
        remark: () => "Key tracking pivots on middle C, so when the cutoff equals middle C’s frequency every key gets a cutoff equal to its own pitch." },
      { do: "Bring A level back up and play a few keys.", show: [...K, "aLevelDb", "curve", "spectrum"], hear: "The oscillator and the whistle together, the peak sitting on the note’s lowest harmonic.", target: "A level at -18 dB or above, a key played", check: (s) => s.state.aLevelDb >= -18 && s.played.mouse + s.played.keys + s.played.midi >= 1 },
    ],
    recap: ["High resonance makes the filter ring at its cutoff.", "The cutoff frequency is the pitch of that ring.", "With full key tracking the filter can be played like an oscillator."],
    inSerum: "Whether and how each of Serum’s filter types self-oscillates is not something this app can check or the manual passages in the library state, so there is no Serum task for this lesson.",
  },
  {
    id: "C2.C", title: "Checkpoint: filters by ear", buildsOn: ["C2.2", "C2.3", "C2.4", "C2.5"], minutes: 10, cardIds: [],
    outcome: "Recreate hidden sounds using the filter: its cutoff, resonance, type, slope and drive.",
    idea: [
      "Each round hides a filtered sound. Ask one question at a time. What is missing: the top, the bottom, or both? Is there a whistle or an edge at one frequency? Does it fall away gently or sharply? Is it clean or gritty?",
      "When you check, the app tells you which settings match and which way the others are off, never the numbers. Cutoff counts as matched within about a third of an octave.",
    ],
    steps: [],
    rounds: [
      { target: { cutoff: 700 }, match: ["cutoff"], from: { ...F, cutoff: 20000 } },
      { target: { cutoff: 1500, resonance: 70 }, match: ["cutoff", "resonance"], from: { ...F, cutoff: 5000, resonance: 0 } },
      { target: { filterType: "high", cutoff: 1200 }, match: ["filterType", "cutoff"], from: { ...F, filterType: "low", cutoff: 400, resonance: 0 } },
      { target: { filterType: "band", cutoff: 900, resonance: 55 }, match: ["filterType", "cutoff", "resonance"], from: { ...F, filterType: "low", cutoff: 3000, resonance: 0 } },
      { target: { slope: "24", cutoff: 500, drive: 75 }, match: ["slope", "cutoff", "drive"], from: { ...F, filterType: "low", slope: "12", cutoff: 2500, resonance: 0, drive: 0, octave: -1 } },
    ],
    recap: ["Ask what is missing first: that gives you the filter type and roughly where the cutoff is.", "A whistle or edge at one spot is resonance; grit and squashing is drive.", "Quick switching between target and yours beats long listening."],
  },
];
