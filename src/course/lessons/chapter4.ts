// Chapter 4: LFOs. Scripts are in docs/lessons/.
import { CUTOFF_OCTAVES, PITCH_SEMITONES } from "../../synth/mod";
import type { DemoTone, PlayableLesson, Snapshot } from "../types";

const between = (v: number, lo: number, hi: number) => v >= lo && v <= hi;
const K = ["keyboard", "hold"] as const;
const patches = (list: DemoTone["patch"][], len = 2.0, gap = 0.4, note = 57): DemoTone[] => list.map((patch, i) => ({ patch, note, at: i * (len + gap), seconds: len }));
const sweptOctaves = (s: Snapshot) => (s.range.cutoff ? Math.log2(s.range.cutoff.max / s.range.cutoff.min) : 0);
/** A low, dark, slightly resonant sound: the usual starting point for a wobble. */
const BASS = { filterOn: true, cutoff: 500, resonance: 40, octave: -1 } as const;
const WOBBLE = { ...BASS, lfo1Dest: "cutoff", lfo1Amount: 60, lfo1Rate: 3 } as const;

export const CHAPTER_4: PlayableLesson[] = [
  {
    id: "C4.1", title: "A slow repeating shape", buildsOn: ["C1.1", "C3.1"], minutes: 8, cardIds: ["lfo-basics"], initial: { lfo1Amount: 80 },
    outcome: "Explain what an LFO is, and set its rate and shape while it moves a control.",
    demo: { caption: "A steady note, then the same note with an LFO moving its level slowly, then quickly.", tones: patches([{}, { lfo1Dest: "aLevelDb", lfo1Amount: 80, lfo1Rate: 1.5 }, { lfo1Dest: "aLevelDb", lfo1Amount: 80, lfo1Rate: 9 }], 2.0) },
    idea: [
      "An LFO is a low-frequency oscillator: the same repeating shapes you met in the oscillator chapter, but far too slow to hear as a pitch. You do not listen to it. You send it to a control, and it turns that control up and down for you, over and over.",
      "Rate is how many times a second it repeats. Shape is the path it takes: a sine glides, a square jumps between two positions, a saw ramps and snaps back. An envelope moves a control once per note; an LFO keeps going.",
    ],
    steps: [
      { do: "Switch on Hold and play a note. LFO 1 is not connected to anything yet.", show: [...K, "lfo1Dest"], hear: "A steady note.", target: "LFO 1 sent to nothing, note held", check: (s) => s.state.lfo1Dest === "none" && s.held.length >= 1 },
      { do: "Set LFO 1’s “Sends to” to Osc A level.", show: [...K, "lfo1Dest", "lfo1Rate", "aLevelDb"], hear: "The note swelling and fading twice a second. Osc A’s Level knob now wears a cyan ring.", target: "LFO 1 sent to Osc A level", check: (s) => s.state.lfo1Dest === "aLevelDb" },
      { do: "Slow the Rate down to about half a cycle a second.", show: [...K, "lfo1Rate", "aLevelDb", "meter"], hear: "A slow swell you can count: up for a second, down for a second.", target: "Rate between 0.3 and 0.7 Hz", check: (s) => s.state.lfo1Dest === "aLevelDb" && between(s.state.lfo1Rate, 0.3, 0.7) },
      { do: "Speed it up to about 8 cycles a second.", show: [...K, "lfo1Rate", "aLevelDb", "meter"], hear: "A flutter.", target: "Rate between 6 and 10 Hz", check: (s) => between(s.state.lfo1Rate, 6, 10) },
      { do: "Bring the Rate back to about 2, then try each Shape. Finish on Saw.", show: [...K, "lfo1Shape", "lfo1Rate"], hear: "Sine glides, triangle is similar, square chops the note on and off, saw ramps up and drops.", target: "Rate between 1 and 4 Hz, shape changed at least twice, now on Saw",
        check: (s) => between(s.state.lfo1Rate, 1, 4) && (s.changes.lfo1Shape ?? 0) >= 2 && s.state.lfo1Shape === "saw" },
      { do: "Now turn the Rate all the way up.", show: [...K, "lfo1Rate", "spectrum"], hear: "The movement blurs into a buzz that is part of the tone.", target: "Rate at 25 Hz or more", check: (s) => s.state.lfo1Rate >= 25,
        remark: (s) => `At ${s.state.lfo1Rate.toFixed(0)} cycles a second the swells come too fast to hear one by one. Past roughly 20 a second, the ear stops hearing a rhythm and starts hearing a roughness in the tone. That boundary is why it is called a low-frequency oscillator.` },
    ],
    recap: ["An LFO is an oscillator too slow to hear, used to move a control.", "Rate is how often it repeats; shape is the path it takes.", "Very fast movement stops sounding like movement and becomes part of the tone."],
    inSerum: "Serum’s LFOs are in the row under the oscillators, as here. Drag LFO 1 onto a LEVEL knob and change RATE. Serum’s LFO shapes can also be drawn, which this synth cannot do yet.",
  },
  {
    id: "C4.2", title: "Wobble: an LFO on the filter", buildsOn: ["C4.1", "C2.2"], minutes: 8, cardIds: ["lfo-cutoff"], initial: { ...BASS },
    outcome: "Make the classic moving-filter bass and control its depth, speed and character.",
    demo: { caption: "A dark bass note, then the same note with an LFO opening and closing the filter.", tones: patches([{ ...BASS }, { ...WOBBLE }, { ...WOBBLE, lfo1Shape: "saw", lfo1Rate: 5 }], 2.0) },
    idea: [
      "Send an LFO to the cutoff and the filter opens and closes by itself. With some resonance, each sweep has a vowel-like “wow” to it. This is the wobble bass, and slower versions of the same thing are how pads are made to breathe.",
      "Three settings carry the character. Amount is how far the cutoff swings. Rate is how fast. Shape is whether it glides, snaps or ramps. The cutoff knob sets the middle of the swing.",
    ],
    steps: [
      { do: "Switch on Hold and play a low note. The filter is on, dark, with some resonance.", show: [...K, "lfo1Dest", "cutoff"], hear: "A dull, steady bass note.", target: "LFO 1 sent to nothing, note held", check: (s) => s.state.lfo1Dest === "none" && s.held.length >= 1 },
      { do: "Send LFO 1 to Filter cutoff.", show: [...K, "lfo1Dest", "lfo1Amount", "cutoff", "curve"], hear: "A gentle “wow-wow”. Watch the filter curve move, and the cyan ring on Cutoff.", target: "LFO 1 sent to Filter cutoff", check: (s) => s.state.lfo1Dest === "cutoff" },
      { do: "Raise Amount to about 60%.", show: [...K, "lfo1Amount", "cutoff", "curve"], hear: "A much deeper sweep.", target: "Amount between 50% and 75%", check: (s) => s.state.lfo1Dest === "cutoff" && between(s.state.lfo1Amount, 50, 75),
        remark: (s) => `At ${s.state.lfo1Amount}% the cutoff swings about ${((s.state.lfo1Amount / 100) * CUTOFF_OCTAVES).toFixed(1)} octaves either side of where the knob is set.` },
      { do: "Set Rate to about 3 cycles a second.", show: [...K, "lfo1Rate", "lfo1Amount", "curve"], hear: "A steady “wub wub wub”.", target: "Rate between 2.5 and 4 Hz", check: (s) => between(s.state.lfo1Rate, 2.5, 4) },
      { do: "Try each Shape and finish on Saw.", show: [...K, "lfo1Shape", "curve"], hear: "Square flips between two filter positions. Saw gives each wub a rising sweep and a snap shut.", target: "Shape changed at least twice, now on Saw", check: (s) => (s.changes.lfo1Shape ?? 0) >= 2 && s.state.lfo1Shape === "saw" },
      { do: "While it wobbles, turn the Cutoff knob up and down.", show: [...K, "cutoff", "curve"], hear: "The whole wobble moving brighter and darker: you are shifting the middle of the swing.", target: "Cutoff moved across at least an octave", check: (s) => s.state.lfo1Dest === "cutoff" && sweptOctaves(s) >= 1 },
    ],
    recap: ["An LFO on the cutoff opens and closes the filter by itself.", "Amount is depth, rate is speed, shape is character.", "The cutoff knob sets the middle of the swing."],
    inSerum: "From Init, switch on Filter 1, lower CUTOFF, and drag LFO 1 onto the CUTOFF knob. Save it and drop it into the “LFOs and modulation” Serum task to see what the app can read from it.",
  },
  {
    id: "C4.3", title: "Tremolo and vibrato", buildsOn: ["C4.1", "C1.2"], minutes: 7, cardIds: ["tremolo", "pitch-lfo"],
    outcome: "Tell an LFO on level from an LFO on pitch, and run two LFOs at once.",
    demo: { caption: "Tremolo, where the level moves; then vibrato, where the pitch moves.", tones: patches([{ lfo1Dest: "aLevelDb", lfo1Amount: 60, lfo1Rate: 6 }, { lfo1Dest: "fine", lfo1Amount: 3, lfo1Rate: 6 }], 2.2) },
    idea: [
      "The same LFO gives two classic effects depending on where it is sent. On level it is tremolo: the note pulses louder and quieter. On pitch it is vibrato: the note wavers sharp and flat, the way a singer or violinist does.",
      "Pitch is far more sensitive than level. A tremolo needs a large amount to be heard; a vibrato needs a tiny one, and more than that turns it into a siren.",
    ],
    steps: [
      { do: "Switch on Hold and play a note. Send LFO 1 to Osc A level and raise its Amount to about 60%.", show: [...K, "lfo1Dest", "lfo1Amount", "aLevelDb"], hear: "The note pulsing: tremolo.", target: "LFO 1 sent to Osc A level, amount 50% or more, note held", check: (s) => s.state.lfo1Dest === "aLevelDb" && s.state.lfo1Amount >= 50 && s.held.length >= 1 },
      { do: "Set Rate to about 6 cycles a second.", show: [...K, "lfo1Rate", "lfo1Amount"], hear: "The speed of a classic guitar-amp tremolo.", target: "Rate between 5 and 8 Hz", check: (s) => s.state.lfo1Dest === "aLevelDb" && between(s.state.lfo1Rate, 5, 8) },
      { do: "Now send LFO 1 to Osc A pitch, and bring Amount right down to 2 or 3%. Click the knob and use the arrow keys for small steps.", show: [...K, "lfo1Dest", "lfo1Amount", "fine"], hear: "A gentle waver in pitch: vibrato.", target: "LFO 1 sent to Osc A pitch, amount between 1% and 4%", check: (s) => s.state.lfo1Dest === "fine" && between(s.state.lfo1Amount, 1, 4),
        remark: (s) => `${s.state.lfo1Amount}% is about ${Math.round((s.state.lfo1Amount / 100) * PITCH_SEMITONES * 100)} cents each way: less than half a semitone, and already obvious. The ear forgives level changes and notices pitch changes.` },
      { do: "Raise Amount to 40% or more.", show: [...K, "lfo1Amount", "fine"], hear: "A siren: the pitch is now sweeping across several notes.", target: "Amount at 40% or more", check: (s) => s.state.lfo1Dest === "fine" && s.state.lfo1Amount >= 40 },
      { do: "Bring LFO 1 back to a small vibrato. Then send LFO 2 to Osc A level as well.", show: [...K, "lfo1Amount", "lfo2Dest", "lfo2Amount", "lfo2Rate", "fine", "aLevelDb"], hear: "Vibrato and tremolo together, at different speeds. Two knobs now wear rings: cyan for LFO 1, green for LFO 2.", target: "LFO 1 on pitch at 1% to 4%, LFO 2 sent to Osc A level",
        check: (s) => s.state.lfo1Dest === "fine" && between(s.state.lfo1Amount, 1, 4) && s.state.lfo2Dest === "aLevelDb" },
    ],
    recap: ["An LFO on level is tremolo; on pitch it is vibrato.", "Pitch needs a tiny amount; level needs a large one.", "Several LFOs can run at once, each on its own control and at its own speed."],
    inSerum: "Drag LFO 1 onto an oscillator’s LEVEL for tremolo, or onto its FIN (fine pitch) for vibrato, and keep the amount small. Listening only: how the amount reads on screen is not confirmed.",
  },
  {
    id: "C4.4", title: "In time with the music", buildsOn: ["C4.2"], minutes: 8, cardIds: ["lfo-cutoff"], initial: { ...WOBBLE, lfo1Trig: "free" },
    outcome: "Lock an LFO to a tempo, so its movement falls on the beat and follows the tempo when it changes.",
    demo: { caption: "A wobble once a beat, then twice a beat, then three times a beat, all at the same tempo.", tones: patches([{ ...WOBBLE, lfo1Sync: "beat", lfo1Div: "1" }, { ...WOBBLE, lfo1Sync: "beat", lfo1Div: "1/2" }, { ...WOBBLE, lfo1Sync: "beat", lfo1Div: "1/3" }], 2.0) },
    idea: [
      "So far an LFO’s speed has been a number of cycles per second. Music is counted in beats, and a wobble at an arbitrary speed drifts against the beat. Setting the speed in beats ties it to the tempo: once a beat, twice a beat, once a bar.",
      "Change the tempo and a synced LFO changes with it, staying in the same place in the bar. A third of a beat gives the rolling, three-against-the-beat feel called a triplet. This LFO is set to run free, which here means it keeps time with the click however late or early you press a key.",
    ],
    steps: [
      { do: "Switch on the Click, then switch on Hold and play a low note.", show: [...K, "clickOn", "bpm", "lfo1Sync"], hear: "A wobble at its own speed, drifting against the click.", target: "Click on, speed in Hz, note held", check: (s) => s.state.clickOn && s.state.lfo1Sync === "hz" && s.held.length >= 1 },
      { do: "Change LFO 1’s “Speed in” to Beats.", show: [...K, "clickOn", "lfo1Sync", "lfo1Div", "curve"], hear: "One wobble for every click, landing on it.", target: "Speed in beats, repeating every 1 beat", check: (s) => s.state.lfo1Sync === "beat" && s.state.lfo1Div === "1" },
      { do: "Set “Repeats every” to half a beat.", show: [...K, "clickOn", "lfo1Div", "curve"], hear: "Two wobbles per click.", target: "Repeating every half a beat", check: (s) => s.state.lfo1Sync === "beat" && s.state.lfo1Div === "1/2" },
      { do: "Now a third of a beat.", show: [...K, "clickOn", "lfo1Div", "curve"], hear: "Three wobbles per click: a rolling triplet feel.", target: "Repeating every third of a beat", check: (s) => s.state.lfo1Sync === "beat" && s.state.lfo1Div === "1/3" },
      { do: "Go back to 1 beat, then turn the Tempo down below 100 and up above 140.", show: [...K, "clickOn", "bpm", "lfo1Div", "curve"], hear: "The click and the wobble slowing down and speeding up together.", target: "Repeating every 1 beat; tempo taken below 100 and above 140", check: (s) => s.state.lfo1Div === "1" && (s.range.bpm?.min ?? 999) < 100 && (s.range.bpm?.max ?? 0) > 140,
        remark: (s) => `At ${s.state.bpm} beats a minute, one beat lasts ${(60 / s.state.bpm).toFixed(2)} seconds, so the wobble is running at ${(s.state.bpm / 60).toFixed(2)} cycles a second. You never had to work that out: that is the point of syncing.` },
      { do: "Set “Repeats every” to 4 beats.", show: [...K, "clickOn", "lfo1Div", "curve"], hear: "One slow sweep per bar, turning over on the higher click.", target: "Repeating every 4 beats", check: (s) => s.state.lfo1Div === "4" },
    ],
    recap: ["An LFO can be set in beats instead of cycles per second.", "A synced LFO follows the tempo and stays in place in the bar.", "A third of a beat is a triplet."],
    inSerum: "Each Serum LFO has a BPM switch beside RATE; with it on, RATE reads in beat divisions, with TRIP and DOT buttons for triplet and dotted values (guide, LFO section from p. 187). Serum follows your DAW’s tempo.",
  },
  {
    id: "C4.5", title: "Restart or run free, and fading in", buildsOn: ["C4.1", "C4.3"], minutes: 8, cardIds: ["lfo-basics", "pitch-lfo"], initial: { filterOn: true, cutoff: 500, resonance: 40, lfo1Dest: "cutoff", lfo1Amount: 60, lfo1Rate: 0.5, lfo1Shape: "saw" },
    outcome: "Choose whether an LFO starts again with every note or keeps running, and make its movement fade in.",
    demo: { caption: "A vibrato that is there from the start of the note, then one that fades in after the note has begun.", tones: patches([{ lfo1Dest: "fine", lfo1Amount: 3, lfo1Rate: 6 }, { lfo1Dest: "fine", lfo1Amount: 3, lfo1Rate: 6, lfo1Rise: 1200 }], 2.6) },
    idea: [
      "An LFO set to Restart begins its shape again every time you strike a key, so every note moves the same way. Set to Free, it runs on regardless of your playing, and each note catches it wherever it happens to be. Restart is predictable, which suits basses and anything rhythmic. Free is varied, which suits pads and anything that should not sound mechanical.",
      "Rise is a separate idea: a fade-in for the LFO’s effect. With a rise, each note starts steady and the movement grows in. Singers and string players do this with vibrato on long notes.",
    ],
    steps: [
      { do: "LFO 1 is a slow ramp on the filter, set to Restart. Strike the same key four or five times, not in any rhythm.", show: ["keyboard", "lfo1Trig", "curve"], hear: "Every note begins the same way: dark, then opening.", target: "Restart, four notes played", check: (s) => s.state.lfo1Trig === "retrig" && s.played.mouse + s.played.keys + s.played.midi >= 4 },
      { do: "Switch Start to Free and strike the key four or five times again.", show: ["keyboard", "lfo1Trig", "curve"], hear: "Each note begins somewhere different: some bright, some dark.", target: "Free, four notes played", check: (s) => s.state.lfo1Trig === "free" && s.played.mouse + s.played.keys + s.played.midi >= 4 },
      { do: "Go back to Restart. Send LFO 1 to Osc A pitch instead, with Shape on Sine, Rate about 6 and Amount at 3%.", show: ["keyboard", "lfo1Trig", "lfo1Dest", "lfo1Shape", "lfo1Rate", "lfo1Amount"], hear: "A vibrato that is on from the first instant of every note.", target: "Restart, sent to Osc A pitch, sine, rate 5 to 8 Hz, amount 1% to 4%",
        check: (s) => s.state.lfo1Trig === "retrig" && s.state.lfo1Dest === "fine" && s.state.lfo1Shape === "sine" && between(s.state.lfo1Rate, 5, 8) && between(s.state.lfo1Amount, 1, 4) },
      { do: "Raise Rise to about one second, then hold a key for a few seconds.", show: ["keyboard", "lfo1Rise", "lfo1Amount"], hear: "A steady note at first, with the vibrato growing in.", target: "Rise between 700 ms and 1.5 s, a note held for two seconds", check: (s) => between(s.state.lfo1Rise, 700, 1500) && s.longestHeld >= 2,
        remark: (s) => `With a rise of ${(s.state.lfo1Rise / 1000).toFixed(1)} seconds, short notes get almost no vibrato and long notes get all of it. The same patch now treats fast and slow playing differently, without you touching anything.` },
      { do: "Play a mix of short and long notes.", show: ["keyboard", "lfo1Rise"], hear: "Short notes plain, long notes singing.", target: "Four notes played, one of them held for a second and a half", check: (s) => s.played.mouse + s.played.keys + s.played.midi >= 4 && s.longestHeld >= 1.5 },
    ],
    recap: ["Restart begins the LFO again with every note; Free lets it run on.", "Restart is consistent; Free is varied.", "Rise fades the movement in, so long notes get more of it than short ones."],
    inSerum: "Serum’s LFO has three modes: RETRIG, FREE and ENVELOPE (guide p. 191), and RISE and DELAY knobs. ENVELOPE, where the shape plays once and stops, is not in the practice synth yet.",
  },
  {
    id: "C4.6", title: "Drawing a shape", buildsOn: ["C4.4"], minutes: 9, cardIds: ["lfo-basics"], initial: { ...WOBBLE, lfo1Trig: "free", lfo1Sync: "beat", lfo1Div: "4", clickOn: true },
    outcome: "Draw your own LFO shape, and use it as a repeating pattern in time with the beat.",
    demo: { caption: "A wobble with a plain sine shape, then with a drawn pattern of steps.", tones: [
      { patch: { ...WOBBLE, lfo1Sync: "beat", lfo1Div: "4", bpm: 120 }, note: 45, at: 0, seconds: 2.0 },
      { patch: { ...WOBBLE, lfo1Sync: "beat", lfo1Div: "4", bpm: 120, lfo1Shape: "drawn", lfo1Steps: [1, 1, -1, -1, 0.5, -1, 1, -1, 1, 1, -1, 0, 0.5, -0.5, 1, -1] }, note: 45, at: 2.4, seconds: 2.0 },
    ] },
    idea: [
      "The four basic shapes are only a start. A drawn shape is sixteen steps, each at a height you choose. The LFO plays through them in order and starts again, so what you draw is a repeating pattern.",
      "Here the LFO is synced to four beats, so each of the sixteen steps lasts a quarter of a beat. That makes the drawing a rhythm: tall bars are moments when the filter is open, short ones when it is closed. One held note becomes a moving bassline of brightness.",
    ],
    steps: [
      { do: "Switch on Hold and play a low note. LFO 1 is a slow sine, once per bar, with the click on.", show: [...K, "lfo1Shape", "curve"], hear: "A smooth sweep that takes a whole bar.", target: "Sine shape, note held", check: (s) => s.state.lfo1Shape === "sine" && s.held.length >= 1 },
      { do: "Change the Shape to Drawn.", show: [...K, "lfo1Shape", "curve"], hear: "A staircase: the filter stepping down through the bar, two clicks of the sixteen at a time.", target: "Drawn shape selected", check: (s) => s.state.lfo1Shape === "drawn" },
      { do: "Drag across the bars to draw a pattern of your own. Change at least six of them.", show: [...K, "lfo1Shape", "curve"], hear: "The filter jumping to your pattern, repeating every bar in time with the click.", target: "At least six bars changed by dragging", check: (s) => !!s.flags.lfoDraw && (s.changes.lfo1Steps ?? 0) >= 6 },
      { do: "Make a rhythm: push four or more bars right down to the bottom and leave at least four at the top.", show: [...K, "lfo1Shape", "curve"], hear: "Bright bursts with dark gaps between them: the held note now has a rhythm.", target: "Four or more bars at the bottom and four or more at the top",
        check: (s) => s.state.lfo1Shape === "drawn" && s.state.lfo1Steps.filter((v) => v <= -0.875).length >= 4 && s.state.lfo1Steps.filter((v) => v >= 0.875).length >= 4,
        remark: (s) => `Your bar, with a tall step as x and anything else as a dot: ${s.state.lfo1Steps.map((v) => (v >= 0.875 ? "x" : ".")).join(" ")} (the same grid a drum machine uses).` },
      { do: "Set “Repeats every” to 2 beats.", show: [...K, "lfo1Div", "curve"], hear: "The same pattern, twice as fast.", target: "Repeating every 2 beats", check: (s) => s.state.lfo1Shape === "drawn" && s.state.lfo1Div === "2" },
    ],
    recap: ["A drawn shape is a row of steps the LFO plays in order.", "Synced to the beat, the steps become a rhythm.", "One held note with a drawn LFO on the filter is already a pattern."],
    inSerum: "Serum’s LFO display is a drawing surface: click to add points, drag to bend lines, and set a grid so points snap to divisions of the cycle (guide, LFO section from p. 187). It draws smooth curves as well as steps.",
  },
  {
    id: "C4.C", title: "Checkpoint: LFOs by ear", buildsOn: ["C4.2", "C4.3"], minutes: 10, cardIds: [],
    outcome: "Recreate hidden moving sounds: how fast they move, what path they take, how far, and what is being moved.",
    idea: [
      "Each round hides a sound that moves. Ask: what is moving, the loudness, the pitch or the brightness? How fast? Does it glide, jump or ramp? How far does it go?",
      "Rates count as matched within double or half of the target. The app tells you which way you are off, never the numbers.",
    ],
    steps: [],
    rounds: [
      { target: { lfo1Rate: 6 }, match: ["lfo1Rate"], from: { lfo1Dest: "aLevelDb", lfo1Amount: 80, lfo1Rate: 1, lfo1Shape: "sine" } },
      { target: { lfo1Shape: "square", lfo1Rate: 3 }, match: ["lfo1Shape", "lfo1Rate"], from: { ...WOBBLE, lfo1Shape: "sine", lfo1Rate: 0.8 } },
      { target: { lfo1Amount: 80 }, match: ["lfo1Amount"], from: { ...WOBBLE, lfo1Amount: 20 } },
      { target: { lfo1Dest: "fine" }, match: ["lfo1Dest"], from: { lfo1Dest: "aLevelDb", lfo1Amount: 60, lfo1Rate: 4, lfo1Shape: "sine" } },
      { target: { lfo1Dest: "cutoff", lfo1Shape: "saw", lfo1Rate: 5 }, match: ["lfo1Dest", "lfo1Shape", "lfo1Rate"], from: { ...BASS, lfo1Dest: "aLevelDb", lfo1Amount: 60, lfo1Rate: 1.2, lfo1Shape: "sine" } },
    ],
    recap: ["First decide what is moving: loudness, pitch or brightness.", "Then speed, then the path it takes, then how far.", "Counting the movement against a slow steady beat helps with rate."],
  },
];
