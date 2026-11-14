// Chapter 5: the modulation system. Scripts are in docs/lessons/. Built so far: routes and amounts, one way
// versus both ways, and modulating a modulator. Waiting for synth controls: velocity and key position as
// sources (C5.3), macros (C5.4), and scaling a route with a second source such as the mod wheel (C5.5).
import { PITCH_SEMITONES, RATE_OCTAVES, routes } from "../../synth/mod";
import { destName } from "../../synth/params";
import type { DemoTone, PlayableLesson, Snapshot } from "../types";

const between = (v: number, lo: number, hi: number) => v >= lo && v <= hi;
const K = ["keyboard", "hold"] as const;
const struck = (s: Snapshot) => s.played.mouse + s.played.keys + s.played.midi;
const patches = (list: DemoTone["patch"][], len = 2.2, gap = 0.4, note = 57): DemoTone[] => list.map((patch, i) => ({ patch, note, at: i * (len + gap), seconds: len }));
const sweptOctaves = (s: Snapshot) => (s.range.cutoff ? Math.log2(s.range.cutoff.max / s.range.cutoff.min) : 0);
const BASS = { filterOn: true, cutoff: 500, resonance: 40, octave: -1 } as const;
const WOBBLE = { ...BASS, lfo1Dest: "cutoff", lfo1Amount: 60, lfo1Rate: 3 } as const;

export const CHAPTER_5: PlayableLesson[] = [
  {
    id: "C5.1", title: "Routes and amounts", buildsOn: ["C4.2", "C3.4"], minutes: 8, cardIds: ["mod-routing"], initial: { ...BASS },
    outcome: "Describe any modulation as a source, a destination and an amount, and stack several sources on one knob.",
    demo: { caption: "One filter knob moved by one source, then by two at once, then by three.", tones: patches([{ ...WOBBLE, lfo1Amount: 40 }, { ...WOBBLE, lfo1Amount: 40, lfo3Dest: "cutoff", lfo3Rate: 0.5 }, { ...WOBBLE, lfo1Amount: 40, lfo3Dest: "cutoff", lfo3Rate: 0.5, env2Dest: "cutoff", env2Amount: 60 }], 2.3) },
    idea: [
      "Every connection you have made so far has the same three parts. A source is something that moves: an envelope or an LFO. A destination is the knob it moves. The amount is how far. Together they are called a route.",
      "The knob itself still matters: it sets where the movement is centred. And one knob can have several routes at once. Their movements simply add together, which is how complicated motion is built from simple parts.",
    ],
    steps: [
      { do: "Switch on Hold and play a low note. Send LFO 1 to Filter cutoff.", show: [...K, "lfo1Dest", "lfo1Amount", "cutoff", "curve"], hear: "A wobble.", target: "LFO 1 sent to Filter cutoff, note held", check: (s) => s.state.lfo1Dest === "cutoff" && s.held.length >= 1 },
      { do: "Turn LFO 1’s Amount to exactly 0. Double-click resets a knob; here use the arrow keys.", show: [...K, "lfo1Amount", "cutoff", "curve"], hear: "Nothing moving. The route still exists, but an amount of zero does nothing, and the ring on Cutoff has gone.", target: "Amount at 0, still sent to Filter cutoff", check: (s) => s.state.lfo1Dest === "cutoff" && s.state.lfo1Amount === 0 },
      { do: "Bring Amount up to about 40%.", show: [...K, "lfo1Amount", "cutoff", "curve"], hear: "The wobble returning, as deep as you make it.", target: "Amount between 30% and 50%", check: (s) => s.state.lfo1Dest === "cutoff" && between(s.state.lfo1Amount, 30, 50) },
      { do: "Turn the Cutoff knob up and down while it wobbles.", show: [...K, "cutoff", "curve"], hear: "The same movement, shifted brighter or darker. The knob is the centre; the route adds to it.", target: "Cutoff moved across at least an octave", check: (s) => sweptOctaves(s) >= 1 },
      { do: "Send LFO 3 to Filter cutoff as well.", show: [...K, "lfo3Dest", "lfo3Amount", "lfo3Rate", "cutoff", "curve"], hear: "The fast wobble now riding up and down on a slow sweep. Cutoff wears two rings: cyan and orange.", target: "LFO 1 and LFO 3 both sent to Filter cutoff", check: (s) => s.state.lfo1Dest === "cutoff" && s.state.lfo3Dest === "cutoff" },
      { do: "Send Envelope 2 to Filter cutoff too, then strike a new key.", show: [...K, "env2Dest", "env2Amount", "cutoff", "curve"], hear: "Each new note also starts bright and settles. Three movements, one knob.", target: "Envelope 2, LFO 1 and LFO 3 all sent to Filter cutoff, a note played", check: (s) => s.state.env2Dest === "cutoff" && s.state.lfo1Dest === "cutoff" && s.state.lfo3Dest === "cutoff" && struck(s) >= 1,
        remark: (s) => `Your routes: ${routes(s.state).map((r) => `${r.source.name} to ${destName(r.dest).toLowerCase()} at ${r.amount}%`).join("; ")}. Listed like that, it is what Serum calls the mod matrix.` },
    ],
    recap: ["A route is a source, a destination and an amount.", "The knob sets the centre; routes add movement to it.", "Several routes on one knob add together."],
    inSerum: "Serum lists every route on its MATRIX tab: source, destination and amount in one row each. Dragging a source onto a knob adds a row there. Lessons on the matrix itself come later.",
  },
  {
    id: "C5.2", title: "One way or both ways", buildsOn: ["C5.1", "C4.3"], minutes: 7, cardIds: ["mod-routing", "pitch-lfo"], initial: { lfo1Dest: "fine", lfo1Amount: 8, lfo1Rate: 5 },
    outcome: "Choose whether a source pushes a control both ways from its knob, or one way only.",
    demo: { caption: "A vibrato that wavers around the note, then one that only goes above it.", tones: patches([{ lfo1Dest: "fine", lfo1Amount: 8, lfo1Rate: 5 }, { lfo1Dest: "fine", lfo1Amount: 8, lfo1Rate: 5, lfo1Way: "up" }], 2.2) },
    idea: [
      "An LFO normally swings both ways: above the knob’s setting and below it by the same distance. That is called bipolar. Set to one way, it only moves between the knob’s setting and one side of it. That is called unipolar.",
      "On pitch the difference is easy to hear. Both ways, the note wavers around its true pitch and still sounds in tune. One way, it only ever goes sharp, so the whole note sounds raised. An envelope is always one way: it starts from the knob and pushes in one direction.",
    ],
    steps: [
      { do: "Switch on Hold and play a note. LFO 1 is on Osc A pitch, moving both ways.", show: [...K, "lfo1Way", "lfo1Amount", "fine"], hear: "A wide vibrato centred on the note.", target: "Both ways, note held", check: (s) => s.state.lfo1Way === "both" && s.held.length >= 1 },
      { do: "Switch LFO 1’s Direction to One way.", show: [...K, "lfo1Way", "lfo1Amount", "fine"], hear: "The waver now sits above the note, so it sounds sharp. The ring on Fine now reaches one side only.", target: "One way selected", check: (s) => s.state.lfo1Way === "up" },
      { do: "Change the Shape to Square, slow the Rate to about 2, and set Amount to 17%.", show: [...K, "lfo1Shape", "lfo1Rate", "lfo1Amount", "lfo1Way"], hear: "A trill: your note, then the note a whole tone above, back and forth.", target: "Square, one way, rate 1 to 3 Hz, amount between 15% and 19%", check: (s) => s.state.lfo1Way === "up" && s.state.lfo1Shape === "square" && between(s.state.lfo1Rate, 1, 3) && between(s.state.lfo1Amount, 15, 19),
        remark: (s) => `${s.state.lfo1Amount}% of ${PITCH_SEMITONES} semitones is about ${((s.state.lfo1Amount / 100) * PITCH_SEMITONES).toFixed(1)} semitones. One way, the square spends half its time on your note and half that far above it.` },
      { do: "Switch back to Both ways and listen to the same trill.", show: [...K, "lfo1Way"], hear: "Now it jumps between a note below and a note above. The key you are holding is never heard.", target: "Both ways selected", check: (s) => s.state.lfo1Way === "both" && (s.changes.lfo1Way ?? 0) >= 1 },
      { do: "Go back to One way and turn Amount below zero.", show: [...K, "lfo1Way", "lfo1Amount"], hear: "A trill downward: your note and a note below it.", target: "One way, amount below zero", check: (s) => s.state.lfo1Way === "up" && s.state.lfo1Amount < 0 },
    ],
    recap: ["Both ways (bipolar) swings either side of the knob.", "One way (unipolar) moves from the knob to one side only.", "With one way, the knob’s own setting is always one end of the movement."],
    inSerum: "On Serum’s MATRIX tab each route has a direction switch that chooses between one way and both ways. Its exact labels are not confirmed here, so nothing is checked.",
  },
  {
    id: "C5.3", title: "Playing harder, playing higher", buildsOn: ["C5.1", "C2.6"], minutes: 8, cardIds: ["mod-routing"], initial: { filterOn: true, cutoff: 400, resonance: 20 },
    outcome: "Use how hard a key is struck, and which key it is, as sources.",
    demo: { caption: "A soft note and a hard note that sound the same, then the same two with velocity sent to the filter.", tones: [
      { patch: { filterOn: true, cutoff: 400, resonance: 20 }, note: 57, at: 0, seconds: 0.8, velocity: 30 }, { patch: { filterOn: true, cutoff: 400, resonance: 20 }, note: 57, at: 0.95, seconds: 0.8, velocity: 127 },
      { patch: { filterOn: true, cutoff: 400, resonance: 20, velDest: "cutoff", velAmount: 70 }, note: 57, at: 2.2, seconds: 0.8, velocity: 30 }, { patch: { filterOn: true, cutoff: 400, resonance: 20, velDest: "cutoff", velAmount: 70 }, note: 57, at: 3.15, seconds: 0.8, velocity: 127 },
    ] },
    idea: [
      "Envelopes and LFOs move by themselves. Two other sources come from your hands. Velocity is how hard a key is struck, and Key position is how high or low the key is. Each is fixed for the length of a note: one number, decided the moment the note starts.",
      "On a real instrument, playing harder is louder and also brighter, and high notes behave differently from low ones. Sending these two sources to the right knobs is what makes a synth respond to playing. Here, click lower on a key to strike harder, or use C and V to set how hard the letter keys strike.",
    ],
    steps: [
      { do: "Strike a key softly and then hard: click near the top of a key, then near its bottom.", show: ["keyboard", "velDest"], hear: "No difference at all. Nothing is listening to how hard you play.", target: "Velocity sent to nothing; one note at 60 or softer and one at 100 or harder",
        check: (s) => s.state.velDest === "none" && !!s.velocity && s.velocity.min <= 60 && s.velocity.max >= 100 },
      { do: "Send Velocity to Note level, then strike soft and hard again.", show: ["keyboard", "velDest", "velAmount"], hear: "Soft notes quiet, hard notes loud.", target: "Velocity sent to Note level; a soft note and a hard note played",
        check: (s) => s.state.velDest === "noteLevel" && !!s.velocity && s.velocity.min <= 60 && s.velocity.max >= 100 },
      { do: "Now send Velocity to Filter cutoff instead, and strike soft and hard.", show: ["keyboard", "velDest", "velAmount", "cutoff", "curve"], hear: "Soft notes dull, hard notes bright, at the same loudness. Cutoff wears a red ring.", target: "Velocity sent to Filter cutoff; a soft note and a hard note played",
        check: (s) => s.state.velDest === "cutoff" && !!s.velocity && s.velocity.min <= 60 && s.velocity.max >= 100,
        remark: (s) => `Your softest note was ${s.velocity?.min} and your hardest ${s.velocity?.max}, out of 127. Real instruments do both things at once: louder and brighter. A synth needs two routes for that, and has only one velocity source here, which is a good reason to want a matrix.` },
      { do: "Send Key position to Filter cutoff as well, and play low and high keys. Z and X move the letter keys by octaves.", show: ["keyboard", "keyDest", "keyAmount", "cutoff", "curve"], hear: "High notes brighter than low ones. This is key tracking, built from a route.", target: "Key position sent to Filter cutoff; three different keys played",
        check: (s) => s.state.keyDest === "cutoff" && s.distinctNotes >= 3 },
      { do: "Send Key position to Note level instead and turn its Amount below zero. Play low and high keys.", show: ["keyboard", "keyDest", "keyAmount"], hear: "High notes quieter than low ones: a way to stop a bright sound getting piercing at the top.", target: "Key position sent to Note level, amount below zero; two different keys played",
        check: (s) => s.state.keyDest === "noteLevel" && s.state.keyAmount < 0 && s.distinctNotes >= 2 },
    ],
    recap: ["Velocity is how hard a note is struck; key position is which key it is.", "Both are fixed for the length of a note.", "Sent to level and brightness, they make a synth respond to playing."],
    inSerum: "Serum has VELO and NOTE sources beside the LFOs; drag either onto a knob. A new preset already sends velocity to level.",
  },
  {
    id: "C5.4", title: "The matrix: one source, several places", buildsOn: ["C5.1", "C5.3"], minutes: 9, cardIds: ["mod-routing"], initial: { ...WOBBLE, lfo1Amount: 25 },
    outcome: "Read and edit every connection in one table, and send a single source to more than one knob.",
    demo: { caption: "A wobble on the filter alone, then the same LFO also bending the pitch, then also pulsing the level.", tones: patches([{ ...WOBBLE }, { ...WOBBLE, matrix: [{ source: "lfo1", dest: "fine", amount: 6, way: "both" }] }, { ...WOBBLE, matrix: [{ source: "lfo1", dest: "fine", amount: 6, way: "both" }, { source: "lfo1", dest: "aLevelDb", amount: 50, way: "both" }] }], 2.3) },
    idea: [
      "Each source’s panel connects it to one knob. The matrix is a table of every connection in the sound: one row each, with the source, what it moves, how far, and which way. Changing a row here is the same as changing it on the panel.",
      "The matrix can also do something the panels cannot. Add a row and the same source goes somewhere else as well. One LFO moving the filter, the pitch and the level together makes them move as one gesture, which sounds very different from three separate LFOs.",
    ],
    steps: [
      { do: "Switch on Hold and play a low note. LFO 1 is wobbling the filter. Find its row in the matrix.", show: [...K, "matrix", "cutoff"], hear: "A gentle wobble.", target: "A note held", check: (s) => s.held.length >= 1 },
      { do: "In the matrix, change LFO 1’s amount to about 50.", show: [...K, "matrix", "lfo1Amount", "cutoff"], hear: "A deeper wobble. The Amount knob on the LFO 1 panel has moved too: it is the same setting.", target: "LFO 1 amount between 40% and 60%, changed in the matrix", check: (s) => between(s.state.lfo1Amount, 40, 60) && !!s.flags.matrix },
      { do: "Click Add a row. Leave its source as LFO 1, set it to move Osc A pitch, with an amount of about 5.", show: [...K, "matrix", "cutoff", "fine"], hear: "The pitch now dips and rises in step with the filter: one movement, felt in two places. Fine wears a cyan ring as well.", target: "A row sending LFO 1 to Osc A pitch at 2% to 10%", check: (s) => s.state.matrix.some((r) => r.source === "lfo1" && r.dest === "fine" && between(r.amount, 2, 10)),
        remark: (s) => `LFO 1 is now doing ${routes(s.state).filter((r) => r.source.id === "lfo1").length} jobs: ${routes(s.state).filter((r) => r.source.id === "lfo1").map((r) => `${destName(r.dest).toLowerCase()} at ${r.amount}%`).join(" and ")}.` },
      { do: "Add another row: LFO 1 to Osc A level, amount about 50.", show: [...K, "matrix", "cutoff", "fine", "aLevelDb"], hear: "Brighter, higher and louder together, then darker, lower and quieter. The sound seems to breathe.", target: "Rows sending LFO 1 to Osc A pitch and to Osc A level (30% to 70%)", check: (s) => s.state.matrix.some((r) => r.source === "lfo1" && r.dest === "fine" && r.amount !== 0) && s.state.matrix.some((r) => r.source === "lfo1" && r.dest === "aLevelDb" && between(r.amount, 30, 70)) },
      { do: "Turn the level row upside down: make its amount about -50.", show: [...K, "matrix", "aLevelDb"], hear: "Now the sound is quietest when it is brightest. Same source, opposite direction on one of its jobs.", target: "The LFO 1 to Osc A level row between -70% and -30%", check: (s) => s.state.matrix.some((r) => r.source === "lfo1" && r.dest === "aLevelDb" && between(r.amount, -70, -30)) },
      { do: "Remove the pitch row.", show: [...K, "matrix", "fine"], hear: "The pitch is steady again; the filter and level still move together.", target: "No row sends LFO 1 to Osc A pitch; the level row remains", check: (s) => !s.state.matrix.some((r) => r.dest === "fine") && s.state.matrix.some((r) => r.dest === "aLevelDb") && (s.changes.matrix ?? 0) >= 1 },
    ],
    recap: ["The matrix lists every connection: source, destination, amount, direction.", "A row in the matrix and the control on the panel are the same setting.", "Extra rows send one source to several knobs, so they move as one gesture."],
    inSerum: "Serum’s MATRIX tab works the same way: one row per connection, and a source can appear in as many rows as you like. Its column names and how amounts read are not confirmed here, so nothing is checked.",
  },
  {
    id: "C5.5", title: "Setting depth on the knob itself", buildsOn: ["C5.1"], minutes: 6, cardIds: ["mod-routing"], initial: { ...WOBBLE, lfo1Amount: 20, env2Dest: "cutoff", env2Amount: 20, env2D: 500 },
    outcome: "Change how far a source moves a knob from the knob itself, using the small coloured handle it wears.",
    demo: { caption: "The same wobble at three depths, as set from the handle on the Cutoff knob.", tones: patches([{ ...WOBBLE, lfo1Amount: 15 }, { ...WOBBLE, lfo1Amount: 45 }, { ...WOBBLE, lfo1Amount: 80 }], 2.2) },
    idea: [
      "A knob that a source is moving wears a ring showing the stretch it sweeps. It also wears a small dot in that source’s colour, at its top right. The dot is a handle: drag it up or down and you change that source’s amount for this knob, watching the ring grow or shrink as you do.",
      "This is the quick way to work. You hear a wobble that is too shallow, and you fix it where you are looking, without finding the LFO’s panel. With two sources on one knob there are two dots, one each. The amount it sets is the same amount as on the source’s panel and in the matrix.",
    ],
    steps: [
      { do: "Switch on Hold and play a low note. Cutoff wears two dots: cyan for LFO 1 and yellow for Envelope 2.", show: [...K, "cutoff", "curve"], hear: "A shallow wobble.", target: "A note held", check: (s) => s.held.length >= 1 },
      { do: "Drag the cyan dot upward until LFO 1’s amount is about 60%. The readout under the knob shows it as you drag.", show: [...K, "cutoff", "curve"], hear: "The wobble deepening as the cyan ring grows.", target: "LFO 1 amount between 50% and 70%, set from the handle", check: (s) => between(s.state.lfo1Amount, 50, 70) && !!s.flags.depth,
        remark: (s) => `LFO 1 now swings the cutoff ${((s.state.lfo1Amount / 100) * 5).toFixed(1)} octaves each way. You set that without touching the LFO’s panel.` },
      { do: "Now drag the yellow dot downward, below zero, to about -40%, and strike a new key.", show: [...K, "cutoff", "curve"], hear: "Each new note now starts darker and opens up, because the envelope pushes the cutoff down from the knob and then lets go.", target: "Envelope 2 amount between -50% and -30%, a note played", check: (s) => between(s.state.env2Amount, -50, -30) && struck(s) >= 1 },
      { do: "Double-click the cyan dot.", show: [...K, "cutoff", "curve"], hear: "The wobble stops: a double-click sets that source’s amount to zero. The ring has gone but the dot stays, because the connection is still there, doing nothing.", target: "LFO 1 amount at 0, still sent to Filter cutoff", check: (s) => s.state.lfo1Amount === 0 && s.state.lfo1Dest === "cutoff" },
      { do: "Look at the LFO 1 panel. Bring the amount back up to about 30% from there.", show: [...K, "cutoff", "lfo1Amount", "curve"], hear: "The wobble returns, and the cyan ring is back on Cutoff. The dot and the panel’s knob are one setting.", target: "LFO 1 amount between 20% and 40%", check: (s) => between(s.state.lfo1Amount, 20, 40) && (s.changes.lfo1Amount ?? 0) >= 1 },
    ],
    recap: ["A knob wears a dot for each source that moves it.", "Drag the dot to set that source’s amount; double-click for zero.", "The dot, the source’s Amount knob and the matrix row are the same setting."],
    inSerum: "In Serum, a knob with a source assigned shows a small arc beside it; dragging that arc sets the amount. Its exact appearance and behaviour are not confirmed here, so nothing is checked.",
  },
  {
    id: "C5.6", title: "Modulating a modulator", buildsOn: ["C5.1"], minutes: 7, cardIds: ["mod-of-mod"], initial: { ...WOBBLE },
    outcome: "Send one source to another source’s settings, so the movement itself changes over time.",
    demo: { caption: "A steady wobble, then a wobble whose speed is itself being moved.", tones: patches([{ ...WOBBLE }, { ...WOBBLE, lfo2Dest: "lfo1Rate", lfo2Amount: 80, lfo2Rate: 0.4, lfo2Shape: "sine" }], 3.0) },
    idea: [
      "A destination does not have to be part of the sound. It can be a setting of another source. Send a slow LFO to a fast LFO’s rate and the wobble speeds up and slows down by itself. Send an envelope there and every note’s wobble starts fast and settles.",
      "This is how sounds are made to feel alive: the movement is never quite the same twice. It is also where patches get hard to follow, so add one layer at a time.",
    ],
    steps: [
      { do: "Switch on Hold and play a low note. LFO 1 is already wobbling the filter at a steady speed.", show: [...K, "lfo1Rate", "lfo2Dest", "curve"], hear: "A steady “wub wub wub”.", target: "LFO 2 sent to nothing, note held", check: (s) => s.state.lfo2Dest === "none" && s.held.length >= 1 },
      { do: "Send LFO 2 to LFO 1 rate. Slow LFO 2’s own Rate right down to about 0.3 and raise its Amount to 60% or more.", show: [...K, "lfo2Dest", "lfo2Rate", "lfo2Amount", "lfo1Rate", "curve"], hear: "The wobble speeding up and slowing down in a slow cycle. LFO 1’s Rate knob wears a green ring.", target: "LFO 2 sent to LFO 1 rate, its rate 0.1 to 0.5 Hz, its amount 60% or more",
        check: (s) => s.state.lfo2Dest === "lfo1Rate" && between(s.state.lfo2Rate, 0.1, 0.5) && s.state.lfo2Amount >= 60,
        remark: (s) => `At ${s.state.lfo2Amount}% the wobble’s speed swings about ${((s.state.lfo2Amount / 100) * RATE_OCTAVES).toFixed(1)} octaves either side of its setting: from roughly ${(s.state.lfo1Rate / 2 ** ((s.state.lfo2Amount / 100) * RATE_OCTAVES)).toFixed(1)} to ${(s.state.lfo1Rate * 2 ** ((s.state.lfo2Amount / 100) * RATE_OCTAVES)).toFixed(0)} wobbles a second.` },
      { do: "Change LFO 2’s Shape to Square.", show: [...K, "lfo2Shape", "lfo2Rate", "lfo1Rate"], hear: "Two speeds taking turns: slow wobble, fast wobble, slow, fast.", target: "LFO 2 on Square", check: (s) => s.state.lfo2Dest === "lfo1Rate" && s.state.lfo2Shape === "square" },
      { do: "Set LFO 2’s “Sends to” back to Nothing. Send Envelope 2 to LFO 1 rate instead, with a long Decay, and strike a new key.", show: [...K, "lfo2Dest", "env2Dest", "env2Amount", "env2D", "lfo1Rate"], hear: "Each note’s wobble starting fast and slowing to its normal speed.", target: "LFO 2 sent to nothing, envelope 2 sent to LFO 1 rate, decay 1 s or more, a note played",
        check: (s) => s.state.lfo2Dest === "none" && s.state.env2Dest === "lfo1Rate" && s.state.env2D >= 1000 && struck(s) >= 1 },
    ],
    recap: ["A source’s own settings can be destinations.", "A slow LFO on a fast LFO’s rate makes the movement itself move.", "An envelope there gives every note its own change of speed."],
    inSerum: "In Serum you can drag one LFO onto another LFO’s RATE knob, or onto a route’s amount. The app’s rebuilt-patch view reports these as “modulated modulators” when it finds them in a preset.",
  },
  {
    id: "C5.7", title: "Any knob can be a destination", buildsOn: ["C5.1", "C5.6"], minutes: 9, cardIds: ["mod-routing", "mod-of-mod"], initial: { ...BASS, shape: "saw", warp: "sync", warpAmount: 30, distOn: true, distType: "soft", distDrive: 0 },
    outcome: "Send a source to any knob on the synth, including another source’s knobs and the effects.",
    demo: { caption: "A bass whose resonance pulses, then whose sync tears open and shut by itself, then both with the tearing speeding up and slowing down.", tones: patches([{ ...BASS, resonance: 30, lfo1Dest: "resonance", lfo1Amount: 100, lfo1Rate: 2 }, { ...BASS, warp: "sync", warpAmount: 40, lfo2Dest: "warpAmount", lfo2Amount: 80, lfo2Rate: 1 }, { ...BASS, warp: "sync", warpAmount: 40, lfo2Dest: "warpAmount", lfo2Amount: 80, lfo2Rate: 1, lfo3Dest: "lfo2Rate", lfo3Amount: 60, lfo3Rate: 0.4, lfo3Shape: "sine" }], 2.2) },
    idea: [
      "Every source’s “sends to” menu lists every knob on the synth, grouped by the panel it lives on: oscillator settings such as warp, filter settings such as resonance, the envelopes’ times, the other sources’ rates and amounts, and the effects. If it is a knob, something can move it.",
      "One difference is worth knowing. The destinations at the top of the menu, marked Smoothest, are moved inside the sound itself, separately for every note, and stay perfectly smooth at any speed. The rest are moved about fifty times a second and follow the note you played last. That is ample for slow and medium movement, but a very fast LFO on one of them will sound grainy.",
    ],
    steps: [
      { do: "Switch on Hold and play a low note.", show: [...K, "curve", "spectrum"], hear: "A steady bass with a little sync edge.", target: "A note held", check: (s) => s.held.length >= 1 },
      { do: "Send LFO 1 to Resonance (under Filter in the menu) and set its amount to about 100%.", show: [...K, "lfo1Dest", "lfo1Amount", "lfo1Rate", "resonance", "curve"], hear: "The peak at the cutoff rising and falling: an edge that pulses. Resonance wears a cyan ring and dot.", target: "LFO 1 sent to Resonance, amount 80% or more", check: (s) => s.state.lfo1Dest === "resonance" && s.state.lfo1Amount >= 80 },
      { do: "Send LFO 2 to Warp amount (under Oscillator A), amount about 80%, and slow its rate to about 1 Hz.", show: [...K, "lfo2Dest", "lfo2Amount", "lfo2Rate", "warpAmount", "scope", "spectrum"], hear: "The sync sweep now plays itself, tearing open and closing once a second.", target: "LFO 2 sent to Warp amount, amount 60% or more, rate between 0.5 and 2 Hz", check: (s) => s.state.lfo2Dest === "warpAmount" && s.state.lfo2Amount >= 60 && between(s.state.lfo2Rate, 0.5, 2) },
      { do: "Now move a source’s own knob. Send LFO 3 to LFO 2 rate (under LFO 2), amount about 60%.", show: [...K, "lfo3Dest", "lfo3Amount", "lfo3Rate", "lfo2Rate", "scope"], hear: "The tearing speeds up and slows down. LFO 2’s Rate knob wears an orange ring: a source’s knobs are knobs like any other.", target: "LFO 3 sent to LFO 2 rate, amount 40% or more", check: (s) => s.state.lfo3Dest === "lfo2Rate" && s.state.lfo3Amount >= 40,
        remark: (s) => `Your routes: ${routes(s.state).map((r) => `${r.source.name} to ${destName(r.dest).toLowerCase()} at ${r.amount}%`).join("; ")}.` },
      { do: "Last, an effect. Send Envelope 2 to Distortion drive (under Distortion), amount about 100%, then strike a new key.", show: [...K, "env2Dest", "env2Amount", "env2D", "distDrive"], hear: "Each note starts dirty and cleans up as the envelope falls. The effect is shared by all notes, so it follows the last note you played.", target: "Envelope 2 sent to Distortion drive, amount 80% or more, a note played", check: (s) => s.state.env2Dest === "distDrive" && s.state.env2Amount >= 80 && struck(s) >= 1 },
    ],
    recap: ["Any knob can be a destination: oscillator, filter, envelopes, other sources, effects.", "Destinations marked Smoothest are moved inside the sound; the rest about fifty times a second.", "Effects are shared by all notes, so a source on an effect follows the last note played."],
    inSerum: "In Serum, nearly every knob can be a destination: drag a source’s tile onto the knob, or pick the destination on the MATRIX tab. Details of each are not confirmed here, so nothing is checked.",
  },
  {
    id: "C5.8", title: "Drag a source onto a knob", buildsOn: ["C5.5", "C5.4"], minutes: 6, cardIds: ["mod-routing"], initial: { ...BASS },
    outcome: "Connect an LFO, an envelope or a macro to any knob by dragging it there.",
    demo: { caption: "A plain bass, then with an LFO dropped on the cutoff, then with the same LFO dropped on the resonance too.", tones: patches([{ ...BASS }, { ...BASS, lfo1Dest: "cutoff", lfo1Amount: 45, lfo1Rate: 3 }, { ...BASS, lfo1Dest: "cutoff", lfo1Amount: 45, lfo1Rate: 3, matrix: [{ source: "lfo1", dest: "resonance", amount: 60, way: "both" }] }], 2.2) },
    idea: [
      "Every source has a small handle marked ✥ beside its name. Drag that handle onto a knob and let go: the source is now connected to that knob, with a modest amount so you hear it straight away. While you drag, a knob that can take the source lights up green as you pass over it.",
      "The first knob you drop a source on becomes its own connection, the one shown on its panel. Drop the same source on another knob and a row is added to the matrix for you. A macro dropped on a knob takes its next free slot. Nothing new is created by dragging: it is a faster way of making the connections you already know.",
    ],
    steps: [
      { do: "Switch on Hold and play a low note.", show: [...K, "lfo1Rate", "cutoff", "resonance", "curve"], hear: "A steady bass.", target: "A note held", check: (s) => s.held.length >= 1 },
      { do: "Drag the ✥ handle on the LFO 1 panel onto the Cutoff knob, and let go.", show: [...K, "lfo1Rate", "cutoff", "resonance", "curve"], hear: "A wobble starts at once. Cutoff now wears a cyan ring and dot.", target: "LFO 1 connected to Filter cutoff by dropping it there", check: (s) => s.state.lfo1Dest === "cutoff" && !!s.flags.dropped },
      { do: "Use the cyan dot on Cutoff to set the depth to about 50%.", show: [...K, "lfo1Rate", "cutoff", "resonance", "curve"], hear: "A deeper wobble.", target: "LFO 1 amount between 40% and 60%", check: (s) => s.state.lfo1Dest === "cutoff" && between(s.state.lfo1Amount, 40, 60) },
      { do: "Drag the same handle onto Resonance as well.", show: [...K, "lfo1Rate", "cutoff", "resonance", "curve", "matrix"], hear: "The edge now pulses with the wobble. In the matrix a new row has appeared: LFO 1 to Resonance.", target: "A matrix row sending LFO 1 to Resonance", check: (s) => s.state.lfo1Dest === "cutoff" && s.state.matrix.some((r) => r.source === "lfo1" && r.dest === "resonance"),
        remark: (s) => `Your routes: ${routes(s.state).map((r) => `${r.source.name} to ${destName(r.dest).toLowerCase()} at ${r.amount}%`).join("; ")}. Two drops, two connections.` },
      { do: "Now a macro. Drag the ✥ handle on Macro 1 onto the Drive knob, then turn Macro 1 up past 60%.", show: [...K, "macro1", "drive", "cutoff", "curve"], hear: "The bass growing dirtier as the macro rises. The drop used the macro’s first free slot.", target: "Macro 1 connected to Drive; macro at 60% or more", check: (s) => [1, 2, 3].some((k) => (s.state as unknown as Record<string, string>)[`macro1Dest${k}`] === "drive") && s.state.macro1 >= 60 },
    ],
    recap: ["Drag a source’s ✥ handle onto a knob to connect it.", "The first drop is the source’s own connection; later drops add matrix rows.", "A macro dropped on a knob takes its next free slot."],
    inSerum: "Serum works the same way: its guide describes clicking and dragging from an LFO’s tab to a knob, with a + sign on the pointer over a valid knob (page 194). Nothing is checked.",
  },
  {
    id: "C5.C", title: "Checkpoint: routes by ear", buildsOn: ["C5.2", "C5.6"], minutes: 9, cardIds: [],
    outcome: "Work out by ear how a moving sound is wired: what is sent where, and which way it pushes.",
    idea: [
      "Each round hides a sound with one route you have to find. Ask what is moving, whether the movement is centred on your sound or sits to one side of it, and whether the movement itself changes.",
      "The app tells you which settings match, never how the target is set.",
    ],
    steps: [],
    rounds: [
      { target: { lfo1Way: "up" }, match: ["lfo1Way"], from: { lfo1Dest: "fine", lfo1Amount: 10, lfo1Rate: 5, lfo1Way: "both" } },
      { target: { lfo3Dest: "cutoff" }, match: ["lfo3Dest"], from: { ...WOBBLE, lfo1Amount: 35, lfo3Dest: "none", lfo3Amount: 45, lfo3Rate: 0.7, lfo3Shape: "sine" } },
      { target: { lfo2Dest: "lfo1Rate" }, match: ["lfo2Dest"], from: { ...WOBBLE, lfo2Dest: "none", lfo2Amount: 80, lfo2Rate: 0.5, lfo2Shape: "sine" } },
      { target: { env2Dest: "lfo1Rate" }, match: ["env2Dest"], from: { ...WOBBLE, env2Dest: "none", env2Amount: 90, env2D: 1800 } },
    ],
    recap: ["Find what is moving before asking how.", "Movement that sits to one side of your sound is a one-way route.", "Movement whose speed changes has a second source on its rate."],
  },
];
