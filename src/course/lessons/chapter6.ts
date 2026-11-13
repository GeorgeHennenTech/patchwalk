// Chapter 6: reshaping the wave. Warp (bend, mirror, sync, squeeze), FM from oscillator B and ring modulation.
// Every claim about what appears in the spectrum was measured on the engine: sync at 100% plays a sine four
// times as fast, a fully mirrored saw has only odd harmonics, FM at an index of 2.4 removes the played
// frequency, and ring modulation at 100% leaves only the sum and the difference.
import { fmIndex, playedHz, playedHzB, spectrumA, SYNC_MAX } from "../../synth/params";
import type { DemoTone, PlayableLesson, Snapshot } from "../types";

const between = (v: number, lo: number, hi: number) => v >= lo && v <= hi;
const K = ["keyboard", "hold"] as const;
const A = ["shape", "warp", "warpAmount"] as const;
const VIEWS = ["scope", "spectrum"] as const;
const struck = (s: Snapshot) => s.played.mouse + s.played.keys + s.played.midi;
const patches = (list: DemoTone["patch"][], len = 1.6, gap = 0.35, note = 57): DemoTone[] => list.map((patch, i) => ({ patch, note, at: i * (len + gap), seconds: len }));
const swept = (s: Snapshot, id: "warpAmount" | "fmAmount" | "ringAmount" | "macro1", lo = 5, hi = 95) => !!s.range[id] && s.range[id]!.min <= lo && s.range[id]!.max >= hi;
/** Share of the wave's energy that is not in its first harmonic, as a whole percentage. */
const bright = (s: Snapshot["state"]) => { const sp = spectrumA(s), h = new Float32Array(sp.sin.length); for (let n = 1; n < h.length; n++) h[n] = Math.hypot(sp.sin[n]!, sp.cos[n]!) ** 2; const all = h.reduce((x, y) => x + y, 0); return all ? Math.round((1 - h[1]! / all) * 100) : 0; };
const note = (s: Snapshot) => s.lastNote ?? 57;
const ratio = (s: Snapshot) => playedHzB(s.state, note(s)) / playedHz(s.state, note(s));
const SINES = { shape: "sine", bShape: "sine" } as const;
const BELL = { ...SINES, bOctave: 1, bSemitone: 6, env2Dest: "fmAmount", env2Amount: 70, env2D: 500, env2S: 0, envD: 1500, envS: 0, envR: 600 } as const;

export const CHAPTER_6: PlayableLesson[] = [
  {
    id: "C6.1", title: "Warp: bend and mirror", buildsOn: ["C1.1", "C1.3"], minutes: 8, cardIds: ["warp"], initial: { shape: "sine" },
    outcome: "Add harmonics to a wave by changing its outline, with no filter and no second oscillator.",
    demo: { caption: "A plain sine, the same sine bent, then a saw and the same saw mirrored.", tones: patches([{ shape: "sine" }, { shape: "sine", warp: "bend", warpAmount: 80 }, { shape: "saw" }, { shape: "saw", warp: "mirror", warpAmount: 100 }]) },
    idea: [
      "A filter can only take harmonics away. Warp works at the source: it changes the outline of the wave itself, and a different outline is a different set of harmonics. The note you play does not change, because the wave still repeats just as often.",
      "Warp does this by reading the wave at an uneven speed. Bend reads slowly at first and then faster, squashing the wave toward the end of its cycle. Mirror reads the wave forwards and then backwards.",
    ],
    steps: [
      { do: "Switch on Hold and play a note. It is a sine: one harmonic.", show: [...K, ...VIEWS], hear: "A pure tone, and a single bar on the spectrum.", target: "A note held", check: (s) => s.held.length >= 1 },
      { do: "Set Warp to Bend and turn Warp amount up past 60%.", show: [...K, ...A, ...VIEWS], hear: "The tone growing brighter and more nasal. New bars appear on the spectrum, and the wave on the scope leans over.", target: "Bend, amount at 60% or more", check: (s) => s.state.warp === "bend" && s.state.warpAmount >= 60,
        remark: (s) => `A sine is one harmonic and nothing else. Bent by ${s.state.warpAmount}%, ${bright(s.state)}% of its energy has moved into new harmonics above the first.` },
      { do: "Sweep Warp amount slowly from 0 to 100% and back, watching the scope.", show: [...K, "warpAmount", ...VIEWS], hear: "A smooth change from pure to buzzy. It can sound like a filter opening, but there is no filter here.", target: "Amount taken below 5% and above 95%", check: (s) => s.state.warp === "bend" && swept(s, "warpAmount") },
      { do: "Change the shape to Saw, set Warp to Mirror and the amount to 100%.", show: [...K, ...A, ...VIEWS], hear: "The saw turning soft and hollow. Read forwards then backwards, a saw becomes a triangle, and every second bar on the spectrum disappears.", target: "Saw, Mirror, amount at 100%", check: (s) => s.state.shape === "saw" && s.state.warp === "mirror" && s.state.warpAmount === 100,
        remark: (s) => `An ordinary saw has ${bright({ ...s.state, warpAmount: 0 })}% of its energy above its first harmonic. Mirrored fully, it has ${bright(s.state)}%: nearly everything is in the first harmonic, as in a triangle.` },
      { do: "Bring the amount down to about 50%.", show: [...K, "warpAmount", ...VIEWS], hear: "Something between saw and triangle: the turn-around point has moved, so the ramp up is longer than the ramp down.", target: "Mirror, amount between 40% and 60%", check: (s) => s.state.warp === "mirror" && between(s.state.warpAmount, 40, 60) },
    ],
    recap: ["Warp changes the wave's outline, which changes its harmonics.", "It can add harmonics; a filter can only remove them.", "The pitch stays the same because the wave repeats just as often."],
    inSerum: "Serum's oscillators have a warp menu and a warp knob. Its guide lists Bend +, Bend - and Mirror among the modes (pages 50 and 51). Serum's versions are not identical to the ones here, so nothing is checked.",
  },
  {
    id: "C6.2", title: "Sync", buildsOn: ["C6.1", "C5M.1"], minutes: 8, cardIds: ["warp"], initial: { shape: "saw", warp: "sync", warpAmount: 0 },
    outcome: "Make the tearing, vowel-like sweep of oscillator sync, and put it under one knob.",
    demo: { caption: "A saw with sync swept by hand positions: none, a little, more, all the way.", tones: patches([{ shape: "saw", warp: "sync", warpAmount: 0 }, { shape: "saw", warp: "sync", warpAmount: 30 }, { shape: "saw", warp: "sync", warpAmount: 65 }, { shape: "saw", warp: "sync", warpAmount: 100 }], 1.2, 0.2) },
    idea: [
      "Sync reads the wave faster than normal, and starts it again every time the cycle ends, however far the reading has got. So the note stays the same, but inside each cycle there is now more than one copy of the wave, the last one usually cut short.",
      "That cut is a sharp edge, and sharp edges are bright. As you turn the amount, the cut moves, and a strong peak sweeps up through the harmonics. It is one of the classic lead and bass sounds.",
    ],
    steps: [
      { do: "Switch on Hold and play a low note. Warp is set to Sync with the amount at 0.", show: [...K, "warpAmount", ...VIEWS], hear: "An ordinary saw.", target: "A note held", check: (s) => s.held.length >= 1 },
      { do: "Turn Warp amount slowly all the way up, watching the scope.", show: [...K, "warpAmount", ...VIEWS], hear: "A tearing, talking sweep. On the scope, extra teeth squeeze into each cycle.", target: "Amount taken above 95%", check: (s) => !!s.range.warpAmount && s.range.warpAmount.max >= 95 },
      { do: "Find the place, about a third of the way up, where the sound is simply an octave higher.", show: [...K, "warpAmount", ...VIEWS], hear: "A clean saw an octave up: exactly two whole teeth fit in each cycle, so nothing is cut short.", target: "Amount between 32% and 35%", check: (s) => between(s.state.warpAmount, 32, 35),
        remark: (s) => `At ${s.state.warpAmount}% the wave is read ${(1 + (SYNC_MAX - 1) * (s.state.warpAmount / 100)).toFixed(2)} times in each cycle. Whole numbers sound clean; anything between has a cut tooth, and that is the sync sound.` },
      { do: "Send Macro 1 to Warp amount with its slot amount at 100%, and set Warp amount itself back to 0.", show: [...K, "macro1Dest1", "macro1Amt1", "macro1", "warpAmount"], hear: "Nothing yet: the macro is at zero.", target: "Macro 1 slot 1 sent to Warp amount at 100%; Warp amount at 0", check: (s) => s.state.macro1Dest1 === "warpAmount" && s.state.macro1Amt1 === 100 && s.state.warpAmount === 0 },
      { do: "Sweep Macro 1 up and down while the note holds.", show: [...K, "macro1", ...VIEWS], hear: "The sync sweep, now on a knob you could name and play.", target: "Macro 1 taken below 5% and above 95%", check: (s) => s.state.macro1Dest1 === "warpAmount" && swept(s, "macro1") },
    ],
    recap: ["Sync restarts the wave at the end of every cycle, so the pitch holds.", "The cut-short copy is what sounds torn and bright.", "Sweeping the amount is the sound; put it on a macro or a source."],
    inSerum: "Serum's warp menu has Sync modes; its guide (page 50) describes a range from traditional hard sync to a soft sync. Which mode matches this one most closely is not confirmed here, so nothing is checked.",
  },
  {
    id: "C6.3", title: "Squeeze: pulse width and beyond", buildsOn: ["C6.1"], minutes: 7, cardIds: ["warp"], initial: { shape: "square", warp: "pd", warpAmount: 0 },
    outcome: "Narrow a square into a thin pulse, and brighten a sine, by hurrying through half of the wave.",
    demo: { caption: "A square, then the same square squeezed into narrower and narrower pulses.", tones: patches([{ shape: "square" }, { shape: "square", warp: "pd", warpAmount: 40 }, { shape: "square", warp: "pd", warpAmount: 75 }, { shape: "square", warp: "pd", warpAmount: 100 }], 1.2, 0.2) },
    idea: [
      "Squeeze hurries through the first half of the wave and lets the second half take up the time that is left. On a square, whose first half is high and second half low, that makes the high part shorter: a pulse. How much of the cycle is spent high is called the pulse width.",
      "A square has only odd harmonics. A narrower pulse lets the even ones in and sounds thinner and more nasal. The same squeeze on a sine tilts it toward a saw. Reshaping a wave by changing its reading speed like this is known as phase distortion.",
    ],
    steps: [
      { do: "Switch on Hold and play a note. It is a square.", show: [...K, ...VIEWS], hear: "Hollow. On the spectrum, every second bar is missing.", target: "A note held", check: (s) => s.held.length >= 1 },
      { do: "Turn Warp amount up to about 50%.", show: [...K, "warpAmount", ...VIEWS], hear: "Thinner and more nasal. On the scope the high part is now shorter than the low part, and the missing bars have filled in.", target: "Squeeze, amount between 40% and 60%", check: (s) => s.state.warp === "pd" && between(s.state.warpAmount, 40, 60),
        remark: (s) => `At ${s.state.warpAmount}% the wave is high for ${Math.round((0.5 - 0.45 * (s.state.warpAmount / 100)) * 100)}% of each cycle instead of 50%.` },
      { do: "Take it all the way to 100%.", show: [...K, "warpAmount", ...VIEWS], hear: "A thin, reedy buzz with much less body: the wave is a narrow spike.", target: "Amount at 100%", check: (s) => s.state.warp === "pd" && s.state.warpAmount === 100 },
      { do: "Move the amount slowly back and forth between about 20% and 80%.", show: [...K, "warpAmount", ...VIEWS], hear: "A rich, shifting tone. Moved by a slow LFO this is the classic pulse-width sound of string and pad patches.", target: "Amount taken below 25% and above 75%", check: (s) => s.state.warp === "pd" && swept(s, "warpAmount", 25, 75) },
      { do: "Change the shape to Sine and sweep the amount from 0 to 100%.", show: [...K, ...A, ...VIEWS], hear: "A pure tone leaning over into something close to a saw, as if a filter were opening.", target: "Sine, Squeeze, amount taken below 5% and above 95%", check: (s) => s.state.shape === "sine" && s.state.warp === "pd" && swept(s, "warpAmount") },
    ],
    recap: ["Squeezing a square changes its pulse width.", "A square has only odd harmonics; a narrower pulse has the even ones too.", "Moving the pulse width slowly gives a rich, animated tone."],
    inSerum: "Serum's guide lists PD modes in the warp menu that use another oscillator (page 55), which is a different thing from this squeeze. For pulse width in Serum, look for a pulse-width warp mode; its exact name is not confirmed here, so nothing is checked.",
  },
  {
    id: "C6.4", title: "FM: one oscillator shaking another", buildsOn: ["C1.4", "C3.4"], minutes: 10, cardIds: [], initial: { ...SINES },
    outcome: "Use oscillator B to shake oscillator A's pitch so fast that it becomes tone: bright, bell-like or growling.",
    demo: { caption: "A sine; the same sine with FM from B; then a bell made with an envelope on the FM amount.", tones: [{ patch: { ...SINES }, note: 57, at: 0, seconds: 1.3 }, { patch: { ...SINES, fmAmount: 35 }, note: 57, at: 1.6, seconds: 1.3 }, { patch: { ...BELL }, note: 69, at: 3.2, seconds: 2.2 }] },
    idea: [
      "A slow LFO on pitch is vibrato. Speed the wobble up until it is as fast as a note and you stop hearing the pitch move. You hear new harmonics instead. That is frequency modulation, FM. Here oscillator B does the shaking and oscillator A is what you hear. B does not have to be switched on to be used this way.",
      "Two things decide the result. The amount sets how many new partials appear: more amount, brighter. The pitch of B compared with A sets where they fall. When B is at the same pitch or a whole number of octaves away, they land on harmonics and the tone stays musical. In between, they land elsewhere and you get bells and clangs.",
    ],
    steps: [
      { do: "Switch on Hold and play a note. Both oscillators are sines, and B is off.", show: [...K, ...VIEWS], hear: "A pure tone.", target: "A note held", check: (s) => s.held.length >= 1 },
      { do: "Turn FM from B up slowly to about 15%.", show: [...K, "fmAmount", ...VIEWS], hear: "The sine growing brighter, as bars appear on the spectrum one at a time.", target: "FM from B between 8% and 25%", check: (s) => between(s.state.fmAmount, 8, 25) },
      { do: "Keep going, past 60%.", show: [...K, "fmAmount", ...VIEWS], hear: "A hard, buzzing tone. Notice the bars do not grow steadily: some rise and fall again as you turn.", target: "FM from B at 60% or more", check: (s) => s.state.fmAmount >= 60,
        remark: (s) => `At ${s.state.fmAmount}% B swings A's frequency by ${fmIndex(s.state.fmAmount).toFixed(1)} times B's own frequency. That number is called the index: the bigger it is, the more partials.` },
      { do: "Bring FM back to about 25% and set B's Octave to 1.", show: [...K, "fmAmount", "bOctave", ...VIEWS], hear: "A hollower tone. The new bars are now twice as far apart, because B is twice as high.", target: "FM between 15% and 35%, B one octave up", check: (s) => between(s.state.fmAmount, 15, 35) && s.state.bOctave === 1 && s.state.bSemitone === 0 },
      { do: "Now set B's Semitone to 6.", show: [...K, "bSemitone", "bOctave", ...VIEWS], hear: "A clang. The new partials no longer line up with the note's harmonics, which is what metal and bells sound like.", target: "B one octave and 6 semitones up", check: (s) => s.state.bOctave === 1 && s.state.bSemitone === 6,
        remark: (s) => `B is now at ${ratio(s).toFixed(2)} times A's frequency. Whole numbers give harmonic tones; ${ratio(s).toFixed(2)} does not, so the partials sit between the harmonics.` },
      { do: "Turn FM from B down to 0, send Envelope 2 to FM from B with an amount of about 70%, and strike a few keys without Hold.", show: ["keyboard", "fmAmount", "env2Dest", "env2Amount", "env2D", ...VIEWS], preset: { envD: 1500, envS: 0, envR: 600, env2D: 500, env2S: 0 }, hear: "A bell: each note starts bright and clangorous and mellows to a pure tone as it rings out.", target: "FM from B at 0, Envelope 2 sent to FM from B at 50% or more, a note struck",
        check: (s) => s.state.fmAmount === 0 && s.state.env2Dest === "fmAmount" && s.state.env2Amount >= 50 && struck(s) >= 1 },
    ],
    recap: ["FM is pitch modulation fast enough to be heard as tone.", "The amount sets how many partials; B's pitch against A's sets where they fall.", "An envelope on the FM amount gives a bright strike that mellows: bells and electric pianos."],
    inSerum: "Serum's warp menu has FM (from other oscillator) modes such as FM (B); its guide notes that the other oscillator must be enabled for this (page 54). That differs from this synth, where B can stay switched off. Nothing is checked.",
  },
  {
    id: "C6.5", title: "Ring modulation", buildsOn: ["C6.4"], minutes: 8, cardIds: [], initial: { ...SINES },
    outcome: "Multiply two oscillators, predict the two tones that come out, and tell ring modulation from FM.",
    demo: { caption: "Two sines a fifth apart: A alone, then A multiplied by B. Then the same with saws.", tones: patches([{ ...SINES, bSemitone: 7 }, { ...SINES, bSemitone: 7, ringAmount: 100 }, { shape: "saw", bShape: "saw", bSemitone: 7 }, { shape: "saw", bShape: "saw", bSemitone: 7, ringAmount: 100 }]) },
    idea: [
      "Ring modulation multiplies one signal by another. For two pure tones the result is exactly two new tones: one at the sum of their frequencies and one at the difference. The original two are gone.",
      "With richer waves every harmonic of one pairs with every harmonic of the other, so the result is dense. When the two pitches are simply related the sums and differences still fit together; when they are not, you get the metallic, robotic sound ring modulation is known for. As with FM, B is used here without being heard itself.",
    ],
    steps: [
      { do: "Switch on Hold and play a note. Turn Ring from B all the way up. B is at the same pitch as A.", show: [...K, "ringAmount", ...VIEWS], hear: "The note jumps up an octave. The sum of two equal frequencies is double; the difference is zero, which is no sound at all.", target: "Ring from B at 100%, note held", check: (s) => s.state.ringAmount === 100 && s.held.length >= 1 },
      { do: "Set B's Semitone to 7.", show: [...K, "bSemitone", "ringAmount", ...VIEWS], hear: "Two tones, neither of them the note you are holding. The spectrum shows two bars with a gap where your note was.", target: "B 7 semitones up, Ring at 100%", check: (s) => s.state.bSemitone === 7 && s.state.ringAmount === 100,
        remark: (s) => { const a = playedHz(s.state, note(s)), b = playedHzB(s.state, note(s)); return `Your note is ${Math.round(a)} Hz and B is ${Math.round(b)} Hz. What you hear is their sum, ${Math.round(a + b)} Hz, and their difference, ${Math.round(Math.abs(a - b))} Hz.`; } },
      { do: "Bring Ring from B down to about 50%.", show: [...K, "ringAmount", ...VIEWS], hear: "Your own note back in the middle, with the two new tones either side of it.", target: "Ring between 40% and 60%", check: (s) => between(s.state.ringAmount, 40, 60) },
      { do: "Back to 100%, and change both A's shape and B's shape to Saw.", show: [...K, "shape", "bShape", "ringAmount", ...VIEWS], hear: "A dense, metallic, robotic tone: every harmonic of A is paired with every harmonic of B.", target: "Both saws, Ring at 100%", check: (s) => s.state.shape === "saw" && s.state.bShape === "saw" && s.state.ringAmount === 100 },
      { do: "Compare with FM. Set both shapes back to Sine, Ring to 0, and FM from B to about 30%.", show: [...K, "shape", "bShape", "ringAmount", "fmAmount", ...VIEWS], hear: "Your note is still there, with several new bars each side of it. Ring modulation makes exactly one pair and removes the note; FM keeps adding pairs as you turn it up.", target: "Both sines, Ring at 0, FM between 20% and 40%", check: (s) => s.state.shape === "sine" && s.state.bShape === "sine" && s.state.ringAmount === 0 && between(s.state.fmAmount, 20, 40) },
    ],
    recap: ["Ring modulation multiplies two signals.", "Two pure tones give their sum and their difference, and nothing else.", "FM makes many pairs of partials; ring modulation makes one pair per pair of harmonics."],
    inSerum: "Serum's warp menu has RM (from other oscillator) modes such as RM (B) (page 56 of its guide). Nothing is checked.",
  },
  {
    id: "C6.C", title: "Checkpoint: reshaping by ear", buildsOn: ["C6.2", "C6.3", "C6.5"], minutes: 9, cardIds: [],
    outcome: "Tell by ear which kind of reshaping a sound has had, and how much.",
    idea: [
      "Each round hides a sound that differs from yours in one way. Ask whether the note itself is still there, whether the brightness is smooth or torn, and whether the new partials sit on the harmonics or between them.",
      "The app tells you which settings match, never how the target is set.",
    ],
    steps: [],
    rounds: [
      { target: { warp: "sync" }, match: ["warp"], from: { shape: "saw", warp: "bend", warpAmount: 60 } },
      { target: { warpAmount: 85 }, match: ["warpAmount"], from: { shape: "square", warp: "pd", warpAmount: 10 } },
      { target: { fmAmount: 0, ringAmount: 100 }, match: ["fmAmount", "ringAmount"], from: { ...SINES, bSemitone: 7, fmAmount: 30, ringAmount: 0 } },
      { target: { bOctave: 1 }, match: ["bOctave"], from: { ...SINES, fmAmount: 25, bOctave: 0 } },
    ],
    recap: ["If the played note has vanished, suspect ring modulation.", "A torn, vowel-like brightness is sync; a smooth one is bend or squeeze.", "With FM, B's pitch sets how far apart the new partials are."],
  },
];
