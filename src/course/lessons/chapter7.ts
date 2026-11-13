// Chapter 7: effects. Distortion, EQ, compression, chorus, delay and reverb, one lesson each, and a by-ear
// checkpoint. The effects sit after the notes, in a fixed order, and are shared by every note. Statements
// about what each one does to the signal were measured on the engine (see fx.ts and the handoff).
import { crushLevels, delaySeconds, distGain, echoesToSilence } from "../../synth/fx";
import type { DemoTone, PlayableLesson, Snapshot } from "../types";

const between = (v: number, lo: number, hi: number) => v >= lo && v <= hi;
const K = ["keyboard", "hold"] as const;
const VIEWS = ["scope", "spectrum"] as const;
const struck = (s: Snapshot) => s.played.mouse + s.played.keys + s.played.midi;
const tones = (list: DemoTone["patch"][], len = 1.5, gap = 0.4, note = 57): DemoTone[] => list.map((patch, i) => ({ patch, note, at: i * (len + gap), seconds: len }));
const swept = (s: Snapshot, id: keyof Snapshot["range"], lo: number, hi: number) => !!s.range[id] && s.range[id]!.min <= lo && s.range[id]!.max >= hi;
const db = (times: number) => Math.round(20 * Math.log10(times));

const SUB = { shape: "sine", octave: -1 } as const;
const SAW = { shape: "saw", octave: -1 } as const;
const PLUCK = { shape: "saw", filterOn: true, cutoff: 1800, envA: 2, envD: 220, envS: 0, envR: 120 } as const;
const DYNAMIC = { shape: "saw", octave: -1, filterOn: true, cutoff: 1200, envA: 2, envD: 500, envS: 45, envR: 80, velDest: "noteLevel", velAmount: 100 } as const;

export const CHAPTER_7: PlayableLesson[] = [
  {
    id: "C7.1", title: "Distortion", buildsOn: ["C1.1", "C2.5"], minutes: 9, cardIds: ["fx-distortion"], initial: { ...SUB },
    outcome: "Add harmonics to a sound by pushing it past full level, and tell four kinds of distortion apart.",
    demo: { caption: "A low sine: clean, soft clipped, hard clipped, folded, then crushed.", tones: tones([{ ...SUB }, { ...SUB, distOn: true, distType: "soft", distDrive: 60 }, { ...SUB, distOn: true, distType: "hard", distDrive: 60 }, { ...SUB, distOn: true, distType: "fold", distDrive: 60 }, { ...SUB, distOn: true, distType: "crush", distDrive: 75 }], 1.1, 0.25) },
    idea: [
      "Distortion turns the signal up until it no longer fits, and then something has to happen to the part that sticks out. Whatever happens changes the shape of the wave, and a changed shape means new harmonics. So distortion is a way of adding brightness that was not there, as warp is, but applied to the finished sound.",
      "The kinds differ in what they do with the part that sticks out. Soft clip bends it over. Hard clip cuts it flat. Fold turns it back the way it came. Crush is different: it rounds every value to a coarse grid of steps.",
    ],
    steps: [
      { do: "Switch on Hold and play a low note. It is a sine.", show: [...K, ...VIEWS], hear: "A pure, low tone: one bar on the spectrum.", target: "A note held", check: (s) => s.held.length >= 1 },
      { do: "Switch on Distortion. It starts on Soft clip.", show: [...K, "distOn", "distType", "distDrive", ...VIEWS], hear: "A warmer, fuller tone. The tops of the wave on the scope are rounded off, and new bars have appeared.", target: "Distortion on, soft clip", check: (s) => s.state.distOn && s.state.distType === "soft" },
      { do: "Turn Drive up past 80%.", show: [...K, "distDrive", ...VIEWS], hear: "Buzzier and buzzier. The sine is being pushed toward a square: flat on top, steep at the sides.", target: "Drive at 80% or more", check: (s) => s.state.distOn && s.state.distDrive >= 80,
        remark: (s) => `At ${s.state.distDrive}% the signal is turned up about ${Math.round(distGain(s.state.distDrive))} times (${db(distGain(s.state.distDrive))} dB) before it is bent back to fit. The output is then turned down again so you hear the change of tone, not just more level.` },
      { do: "Bring Drive back to about 50% and change the type to Hard clip.", show: [...K, "distType", "distDrive", ...VIEWS], hear: "Harsher than soft clip at the same drive. On the scope the tops are cut dead flat, with sharp corners.", target: "Hard clip, drive between 40% and 60%", check: (s) => s.state.distType === "hard" && between(s.state.distDrive, 40, 60) },
      { do: "Change to Fold and sweep Drive slowly from about 10% to 90%.", show: [...K, "distType", "distDrive", ...VIEWS], hear: "A metallic, shifting tone. More drive does not just mean brighter: harmonics rise and fall as the wave folds over itself again and again.", target: "Fold; drive taken below 20% and above 85%", check: (s) => s.state.distType === "fold" && swept(s, "distDrive", 20, 85) },
      { do: "Change to Crush and set Drive to about 75%.", show: [...K, "distType", "distDrive", ...VIEWS], hear: "A gritty, digital fizz. The scope shows a staircase where the smooth wave was.", target: "Crush, drive between 65% and 85%", check: (s) => s.state.distType === "crush" && between(s.state.distDrive, 65, 85),
        remark: (s) => `At ${s.state.distDrive}% every value is rounded to one of ${crushLevels(s.state.distDrive)} steps each side of zero. Fewer steps, rougher sound.` },
      { do: "Go back to Soft clip at about 60% drive, and turn Mix down to about 50%.", show: [...K, "distType", "distDrive", "distMix", ...VIEWS], hear: "The clean sine and the distorted one together: the weight of the original with some of the edge.", target: "Soft clip, mix between 35% and 65%", check: (s) => s.state.distType === "soft" && between(s.state.distMix, 35, 65) },
    ],
    recap: ["Distortion adds harmonics by reshaping a signal that is too big to fit.", "Soft clip bends, hard clip cuts, fold turns back, crush rounds to steps.", "Mix blends the clean sound back in."],
    inSerum: "Serum's DISTORTION module has TYPE, DRIVE and MIX controls (page 168 of its guide). Which of its types match the four here is not confirmed, so nothing is checked.",
  },
  {
    id: "C7.2", title: "EQ", buildsOn: ["C2.3"], minutes: 8, cardIds: ["fx-eq"], initial: { ...SAW },
    outcome: "Boost or cut the low, middle and high parts of a sound, and find a frequency by sweeping a boost.",
    demo: { caption: "A saw bass: as it is, with the lows cut, with the highs cut, then with a boost in the middle.", tones: tones([{ ...SAW }, { ...SAW, eqOn: true, eqLow: -15 }, { ...SAW, eqOn: true, eqHigh: -15 }, { ...SAW, eqOn: true, eqMid: 14, eqMidHz: 900 }], 1.2, 0.3) },
    idea: [
      "A filter removes everything beyond a point. An equaliser, EQ, is gentler: it turns one region of the spectrum up or down by an amount you choose and leaves the rest alone. This one has three bands: low, middle and high. The middle band can be moved.",
      "Turning a band down is called a cut and turning it up a boost. A common way to find the part of a sound you want to change is to boost the middle band a lot, sweep its frequency until the thing you are looking for jumps out, and then set the amount you actually want.",
    ],
    steps: [
      { do: "Switch on Hold and play a low note, then switch on the EQ.", show: [...K, "eqOn", "spectrum"], hear: "No change at all: every band is at 0 dB.", target: "EQ on, note held", check: (s) => s.state.eqOn && s.held.length >= 1 },
      { do: "Turn Low down to about -12 dB, then up to about +9 dB.", show: [...K, "eqLow", "spectrum"], hear: "Thin with the cut, heavy with the boost. On the spectrum only the bars at the left move.", target: "Low taken below -9 dB, now between +6 and +12 dB", check: (s) => !!s.range.eqLow && s.range.eqLow.min <= -9 && between(s.state.eqLow, 6, 12) },
      { do: "Set Low back to 0 and turn High down to about -12 dB.", show: [...K, "eqLow", "eqHigh", "spectrum"], hear: "Duller, but not muffled the way a low-pass filter would make it: the high harmonics are quieter, not gone.", target: "Low at 0, High between -15 and -9 dB", check: (s) => s.state.eqLow === 0 && between(s.state.eqHigh, -15, -9) },
      { do: "Set High back to 0. Boost Mid to about +12 dB and sweep Mid frequency slowly across its whole range.", show: [...K, "eqHigh", "eqMid", "eqMidHz", "spectrum"], hear: "A peak travelling through the sound, picking out one group of harmonics after another, a little like a resonant filter.", target: "High at 0, Mid at +9 dB or more, frequency taken below 300 Hz and above 3 kHz", check: (s) => s.state.eqHigh === 0 && s.state.eqMid >= 9 && swept(s, "eqMidHz", 300, 3000) },
      { do: "Stop where the sound is most nasal or boxy to you, then turn Mid from a boost into a cut of about -9 dB.", show: [...K, "eqMid", "eqMidHz", "spectrum"], hear: "That quality removed. Search with a boost, then cut: the usual way to find and fix a problem.", target: "Mid between -12 and -6 dB", check: (s) => between(s.state.eqMid, -12, -6),
        remark: (s) => `You cut ${Math.abs(s.state.eqMid)} dB around ${s.state.eqMidHz} Hz. A cut of 6 dB halves the level of whatever sits there.` },
    ],
    recap: ["EQ turns a region up or down by a set amount; a filter removes everything past a point.", "Low and high bands tilt the ends; the middle band can be aimed.", "Sweep a boost to find a frequency, then set the amount you want."],
    inSerum: "Serum's EQ module has FREQ and GAIN controls for its bands (page 169 of its guide). Its layout differs from the three bands here, so nothing is checked.",
  },
  {
    id: "C7.3", title: "Compression", buildsOn: ["C5.3", "C3.1"], minutes: 10, cardIds: ["fx-compressor"], initial: { ...DYNAMIC },
    outcome: "Make soft and hard notes closer in level, and use the attack time to let the start of a note through.",
    demo: { caption: "A soft note and a hard note, uncompressed; then the same two through a compressor with make-up gain.", tones: [
      { patch: { ...DYNAMIC }, note: 57, at: 0, seconds: 0.8, velocity: 35 }, { patch: { ...DYNAMIC }, note: 57, at: 1, seconds: 0.8, velocity: 127 },
      { patch: { ...DYNAMIC, compOn: true, compThreshold: -40, compRatio: 8, compMakeup: 14 }, note: 57, at: 2.3, seconds: 0.8, velocity: 35 }, { patch: { ...DYNAMIC, compOn: true, compThreshold: -40, compRatio: 8, compMakeup: 14 }, note: 57, at: 3.3, seconds: 0.8, velocity: 127 },
    ] },
    idea: [
      "A compressor is an automatic volume control. Whenever the signal goes above a level you set, the threshold, it turns the signal down. The ratio says how firmly: at 4 to 1, every 4 dB over the threshold comes out as 1 dB over. Loud moments are reduced and quiet ones are left alone, so the two end up closer together. Make-up gain then turns everything back up.",
      "It takes a moment to react. Attack is how quickly it clamps down once the signal goes over, and release is how quickly it lets go afterwards. A slow attack lets the very start of a note through before the level is pulled down, which is one way of giving a note a harder front. In this lesson, clicking lower on a key strikes it harder.",
    ],
    steps: [
      { do: "Strike a key softly and then hard, a few times, watching the level meter.", show: ["keyboard", "meter"], hear: "A large difference: soft notes are much quieter than hard ones.", target: "One note at 50 or softer and one at 110 or harder", check: (s) => !!s.velocity && s.velocity.min <= 50 && s.velocity.max >= 110 },
      { do: "Switch on the Compressor. Set Threshold to about -40 dB and Ratio to about 8.", show: ["keyboard", "meter", "compOn", "compThreshold", "compRatio"], hear: "Hard notes are pulled down a long way and soft ones much less. Everything is quieter, and more even. Watch “Turning down by” move with each note.", target: "Compressor on, threshold between -46 and -34 dB, ratio between 6 and 10, a soft and a hard note played",
        check: (s) => s.state.compOn && between(s.state.compThreshold, -46, -34) && between(s.state.compRatio, 6, 10) && !!s.velocity && s.velocity.min <= 50 && s.velocity.max >= 110,
        remark: (s) => `At ${s.state.compRatio} to 1, a note that would have been ${s.state.compRatio * 2} dB over the threshold comes out 2 dB over it.` },
      { do: "Turn Make-up up to about 14 dB and play soft and hard again.", show: ["keyboard", "meter", "compMakeup"], hear: "The hard notes are back near where they were, and the soft notes are now much louder than before. That is what compression is usually for.", target: "Make-up between 10 and 18 dB, a soft and a hard note played", check: (s) => s.state.compOn && between(s.state.compMakeup, 10, 18) && !!s.velocity && s.velocity.min <= 50 && s.velocity.max >= 110 },
      { do: "Raise Threshold to 0 dB and play.", show: ["keyboard", "meter", "compThreshold"], hear: "The compressor has stopped working: nothing reaches the threshold, so nothing is turned down. “Turning down by” stays at zero.", target: "Threshold at 0 dB, a note played", check: (s) => s.state.compThreshold === 0 && struck(s) >= 1 },
      { do: "Threshold back to about -40 dB. Now set Attack to about 80 ms and strike hard notes.", show: ["keyboard", "meter", "compThreshold", "compAttack", "scope"], hear: "A sharper front on each note: the start gets through at full level before the compressor catches up.", target: "Threshold between -46 and -34 dB, attack between 50 and 120 ms, a hard note played", check: (s) => between(s.state.compThreshold, -46, -34) && between(s.state.compAttack, 50, 120) && !!s.velocity && s.velocity.max >= 110 },
      { do: "Compare with the fastest Attack, 1 ms.", show: ["keyboard", "meter", "compAttack", "scope"], hear: "The front is caught at once and the note is flatter and smoother.", target: "Attack at 1 ms, a hard note played", check: (s) => s.state.compAttack === 1 && !!s.velocity && s.velocity.max >= 110 },
    ],
    recap: ["A compressor turns down whatever goes over the threshold; the ratio says by how much.", "Make-up gain brings the level back, which lifts the quiet parts.", "A slow attack lets the start of a note through; a fast one flattens it."],
    inSerum: "Serum's COMPRESSOR module has THRESH, RATIO, ATTACK, RELEASE and GAIN controls (pages 163 and 164 of its guide). How its values read on screen is not confirmed, so nothing is checked.",
  },
  {
    id: "C7.4", title: "Chorus", buildsOn: ["C1.6"], minutes: 7, cardIds: ["fx-chorus"], initial: { shape: "saw" },
    outcome: "Thicken and widen a sound with drifting copies of itself, and tell chorus from unison.",
    demo: { caption: "A single saw, then the same saw through a chorus.", tones: tones([{ shape: "saw" }, { shape: "saw", chorusOn: true, chorusDepth: 60, chorusMix: 50 }], 2, 0.4) },
    idea: [
      "A chorus makes copies of the sound, delays each by a few hundredths of a second, and keeps slowly changing those delays. A delay that is getting longer lowers the pitch slightly, and one getting shorter raises it, so the copies drift a little flat and sharp against the original.",
      "It is the same family of sound as unison: nearly identical signals, slightly out of tune, beating against each other. The difference is where it happens. Unison is extra oscillators inside each note. A chorus is applied afterwards, to everything at once, whatever it is.",
    ],
    steps: [
      { do: "Switch on Hold and play a note, then switch on Chorus.", show: [...K, "chorusOn", ...VIEWS], hear: "One thin saw becomes wide and shimmering.", target: "Chorus on, note held", check: (s) => s.state.chorusOn && s.held.length >= 1 },
      { do: "Turn Depth down to 0, then up to 100%.", show: [...K, "chorusDepth", ...VIEWS], hear: "At 0 the copies are fixed in place: a hollow, static colour with no movement. At full depth the pitch visibly wavers.", target: "Depth taken to 0 and to 100%", check: (s) => swept(s, "chorusDepth", 0, 100) },
      { do: "Set Depth to about 50% and try Rate slow, about 0.3 Hz, then fast, about 4 Hz.", show: [...K, "chorusDepth", "chorusRate", ...VIEWS], hear: "Slow is a gentle swirl. Fast is a wobble that starts to sound out of tune.", target: "Depth between 35% and 65%; rate taken below 0.4 Hz and above 3 Hz", check: (s) => between(s.state.chorusDepth, 35, 65) && swept(s, "chorusRate", 0.4, 3) },
      { do: "Set Rate back near 0.8 Hz. Turn Mix from 0 up to 100% and settle near 50%.", show: [...K, "chorusRate", "chorusMix", ...VIEWS], hear: "At 0 there is no effect. At 100% the copies are as loud as the original. The swirl is strongest around the middle.", target: "Mix taken to 0 and above 90%, now between 35% and 65%", check: (s) => swept(s, "chorusMix", 0, 90) && between(s.state.chorusMix, 35, 65) },
      { do: "Switch Chorus off. Set Voices to 5 and Detune to about 25 cents, then switch Chorus on and off to compare.", show: [...K, "chorusOn", "voices", "detune", "spread", ...VIEWS], hear: "Unison is thick in a similar way, but made of separate oscillators. Both together is thicker still.", target: "Five voices, detune between 15 and 40 cents, chorus switched at least twice", check: (s) => s.state.voices === 5 && between(s.state.detune, 15, 40) && (s.changes.chorusOn ?? 0) >= 2 },
    ],
    recap: ["Chorus is slightly delayed copies whose delay keeps changing.", "Depth is how far they drift; rate is how fast.", "Unison happens inside each note; chorus is applied to the whole sound afterwards."],
    inSerum: "Serum's CHORUS module has RATE, DEPTH and MIX among its controls (page 162 of its guide). Nothing is checked.",
  },
  {
    id: "C7.5", title: "Delay", buildsOn: ["C3.2", "C4.4"], minutes: 8, cardIds: ["fx-delay"], initial: { ...PLUCK },
    outcome: "Add echoes to a sound, set how many there are, and put them in time with the beat.",
    demo: { caption: "A pluck alone, with a few echoes, and with many.", tones: [{ patch: { ...PLUCK }, note: 69, at: 0, seconds: 0.4 }, { patch: { ...PLUCK, delayOn: true, delayTime: 250, delayFeedback: 30 }, note: 69, at: 1.2, seconds: 0.4 }, { patch: { ...PLUCK, delayOn: true, delayTime: 250, delayFeedback: 75 }, note: 69, at: 3.2, seconds: 0.4 }] },
    idea: [
      "A delay records what goes into it and plays it back a moment later. Time is how much later. Feedback sends part of each echo back into the delay, so it is echoed again: no feedback gives a single echo, and more feedback gives a longer and longer train of them, each quieter than the last.",
      "Echoes that land on the beat become part of the rhythm. Set in beats, the delay time follows the tempo, so the echoes stay in time whatever the tempo is.",
    ],
    steps: [
      { do: "Play a few short notes, then switch on Delay.", show: ["keyboard", "delayOn", "delayTime", "delayFeedback", "delayMix"], hear: "Each note is followed by echoes that die away.", target: "Delay on, two notes played", check: (s) => s.state.delayOn && struck(s) >= 2 },
      { do: "Turn Feedback down to 0 and play a note.", show: ["keyboard", "delayFeedback"], hear: "Exactly one echo.", target: "Feedback at 0, a note played", check: (s) => s.state.delayFeedback === 0 && struck(s) >= 1 },
      { do: "Turn Feedback up to about 75% and play one note, then wait.", show: ["keyboard", "delayFeedback"], hear: "A long train of echoes, each a little quieter.", target: "Feedback between 65% and 85%, a note played", check: (s) => between(s.state.delayFeedback, 65, 85) && struck(s) >= 1,
        remark: (s) => `Each echo is ${s.state.delayFeedback}% of the one before. It takes about ${echoesToSilence(s.state.delayFeedback)} echoes, ${(echoesToSilence(s.state.delayFeedback) * delaySeconds(s.state)).toFixed(1)} seconds, to fade to a thousandth of where it started.` },
      { do: "Bring Feedback back to about 40%. Shorten Time to about 60 ms and play.", show: ["keyboard", "delayFeedback", "delayTime"], hear: "Too quick to hear as separate echoes: a metallic flutter stuck to the note.", target: "Feedback between 30% and 50%, time between 40 and 90 ms, a note played", check: (s) => between(s.state.delayFeedback, 30, 50) && between(s.state.delayTime, 40, 90) && struck(s) >= 1 },
      { do: "Switch on the Click, set Delay time in to Beats, and choose Half a beat. Play notes on the click.", show: ["keyboard", "clickOn", "bpm", "delaySync", "delayDiv"], hear: "Echoes landing exactly between the clicks.", target: "Click on, delay in beats, half a beat, two notes played", check: (s) => s.state.clickOn && s.state.delaySync === "beat" && s.state.delayDiv === "1/2" && struck(s) >= 2,
        remark: (s) => `At ${s.state.bpm} beats a minute, half a beat is ${Math.round(delaySeconds(s.state) * 1000)} ms.` },
      { do: "Change the Tempo and play again.", show: ["keyboard", "clickOn", "bpm", "delayDiv"], hear: "The echoes speed up or slow down with the click and stay in time.", target: "Tempo changed by 15 or more, a note played", check: (s) => s.state.delaySync === "beat" && Math.abs(s.state.bpm - s.start.bpm) >= 15 && struck(s) >= 1 },
    ],
    recap: ["Time is the gap between echoes; feedback is how many there are.", "Very short times stop sounding like echoes and colour the tone.", "Set in beats, the echoes follow the tempo."],
    inSerum: "Serum's DELAY module has FEEDBACK, a BPM/MS switch for its times, and MIX (page 166 of its guide). Nothing is checked.",
  },
  {
    id: "C7.6", title: "Reverb", buildsOn: ["C3.2"], minutes: 7, cardIds: ["fx-reverb"], initial: { ...PLUCK },
    outcome: "Put a sound in a space, and control how big the space seems and how far away the sound is.",
    demo: { caption: "A pluck with no reverb, in a small space, and in a very large one.", tones: [{ patch: { ...PLUCK }, note: 69, at: 0, seconds: 0.4 }, { patch: { ...PLUCK, reverbOn: true, reverbSize: 0.5, reverbMix: 40 }, note: 69, at: 1.1, seconds: 0.4 }, { patch: { ...PLUCK, reverbOn: true, reverbSize: 6, reverbMix: 40 }, note: 69, at: 2.6, seconds: 0.4 }] },
    idea: [
      "In a room, sound reaches you directly and also bounces off every surface, arriving as thousands of echoes too close together to hear separately. That wash is reverb. The bigger and harder the room, the longer it takes to die away.",
      "This reverb has two controls. Size is how long the tail lasts. Mix is how much of the tail you hear against the direct sound: a little puts a sound in a room, a lot pushes it to the far end of the room.",
    ],
    steps: [
      { do: "Play a few short notes, then switch on Reverb.", show: ["keyboard", "reverbOn", "reverbSize", "reverbMix"], hear: "Each note now rings on in a space after it stops.", target: "Reverb on, two notes played", check: (s) => s.state.reverbOn && struck(s) >= 2 },
      { do: "Turn Size down to about 0.4 seconds and play.", show: ["keyboard", "reverbSize"], hear: "A small, close room: a short bloom after each note.", target: "Size 0.6 s or less, a note played", check: (s) => s.state.reverbSize <= 0.6 && struck(s) >= 1 },
      { do: "Turn Size up to about 6 seconds, play one note and wait for it to die away.", show: ["keyboard", "reverbSize"], hear: "A huge hall. The note is long gone and the space is still sounding.", target: "Size 5 s or more, a note played", check: (s) => s.state.reverbSize >= 5 && struck(s) >= 1,
        remark: (s) => `The tail takes ${s.state.reverbSize} seconds to fall 60 dB, to a thousandth of its starting level. That time is how reverbs are usually measured.` },
      { do: "With Size at about 2 seconds, turn Mix from 0 up to 100% while playing, and settle between 15% and 35%.", show: ["keyboard", "reverbSize", "reverbMix"], hear: "At 0 the sound is dry and close. As Mix rises it moves away from you, until it is all room.", target: "Size between 1.2 and 3 s; mix taken to 0 and above 90%, now between 15% and 35%", check: (s) => between(s.state.reverbSize, 1.2, 3) && swept(s, "reverbMix", 0, 90) && between(s.state.reverbMix, 15, 35) },
      { do: "Play a fast run of notes, then a single note with a long gap after it.", show: ["keyboard", "reverbSize", "reverbMix"], hear: "Fast notes blur into each other in the tail; a single note has room to ring. Long reverbs suit sparse playing.", target: "Six notes played", check: (s) => struck(s) >= 6 },
    ],
    recap: ["Reverb is a dense wash of echoes that dies away.", "Size is how long the tail lasts; mix is how far away the sound seems.", "Long tails blur fast playing."],
    inSerum: "Serum's REVERB module has a TYPE menu, and SIZE and MIX among its controls (page 175 of its guide). Nothing is checked.",
  },
  {
    id: "C7.C", title: "Checkpoint: effects by ear", buildsOn: ["C7.1", "C7.2", "C7.5", "C7.6"], minutes: 9, cardIds: [],
    outcome: "Hear which effect setting differs from yours and match it.",
    idea: [
      "Each round hides a sound that differs from yours in one effect setting. Ask whether the difference is in the tone itself, in what follows the note, or in how long the space rings.",
      "The app tells you which settings match, never how the target is set.",
    ],
    steps: [],
    rounds: [
      { target: { distType: "fold" }, match: ["distType"], from: { ...SUB, distOn: true, distType: "soft", distDrive: 60 } },
      { target: { eqHigh: -12 }, match: ["eqHigh"], from: { ...SAW, eqOn: true, eqHigh: 6 } },
      { target: { delayTime: 150 }, match: ["delayTime"], from: { ...PLUCK, delayOn: true, delayTime: 500, delayFeedback: 45 } },
      { target: { reverbSize: 5 }, match: ["reverbSize"], from: { ...PLUCK, reverbOn: true, reverbSize: 0.6, reverbMix: 40 } },
    ],
    recap: ["A change in the tone itself points to distortion or EQ.", "Separate repeats are a delay; a smooth wash is a reverb.", "Count the gap between echoes to judge delay time."],
  },
];
