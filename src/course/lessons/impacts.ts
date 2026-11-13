// The first impact lessons (track T in docs/IMPACTS.md): the start of a note, the kick as a falling pitch,
// how far and how fast it falls, sub drops, and bass notes treated as hits. They use only what the synth
// already has, plus the wide pitch destination. They describe what is done and what can be measured; they
// make no claims about how hearing works (those wait for a text in the library) or about any artist's method.
import { WIDE_SEMITONES } from "../../synth/mod";
import { noteToHz } from "../../synth/params";
import type { DemoTone, PlayableLesson, Snapshot } from "../types";

const between = (v: number, lo: number, hi: number) => v >= lo && v <= hi;
const struck = (s: Snapshot) => s.played.mouse + s.played.keys + s.played.midi;
const time = (ms: number) => (ms >= 1000 ? `${(ms / 1000).toFixed(1)} s` : `${Math.round(ms)} ms`);
const hits = (list: DemoTone["patch"][], len = 0.9, gap = 0.25, note = 57): DemoTone[] => list.map((patch, i) => ({ patch, note, at: i * (len + gap), seconds: len }));
const octaves = (amount: number) => (amount / 100) * (WIDE_SEMITONES / 12);
/** Where the last note's pitch starts and where it lands, for a fall of `amount` on the wide destination. */
const fall = (s: Snapshot) => { const end = noteToHz((s.lastNote ?? 57) + s.state.octave * 12 + s.state.semitone); return { end: Math.round(end), start: Math.round(end * 2 ** octaves(s.state.env2Amount)) }; };

const BASS = { shape: "saw", octave: -1, filterOn: true, cutoff: 300, resonance: 15 } as const;
const THUD = { shape: "sine", octave: -2, envA: 1, envD: 350, envS: 0, envR: 150, envBend: "eased" } as const;
const KICK = { ...THUD, env2Dest: "aPitchWide", env2Amount: 50, env2A: 1, env2D: 60, env2S: 0, env2Bend: "sharp" } as const;
const DROP = { shape: "sine", octave: -1, envA: 5, envD: 4000, envS: 0, envR: 800, env2Dest: "aPitchWide", env2Amount: 25, env2A: 1, env2D: 2500, env2S: 0, env2Bend: "straight" } as const;
const ENV1 = ["envA", "envD", "envS", "envR"] as const;

export const IMPACT_CHAPTER: PlayableLesson[] = [
  {
    id: "CT.1", title: "The start of a note", buildsOn: ["C3.1", "C2.1"], minutes: 7, cardIds: ["amp-envelope"], initial: { ...BASS, envA: 50, envD: 400, envS: 60, envR: 120 },
    outcome: "Hear how the first few thousandths of a second change a bass note, and set a start that is sharp without clicking.",
    demo: { caption: "The same bass note three times: starting over 50 ms, over 10 ms, and over 1 ms.", tones: hits([{ ...BASS, envA: 50, envD: 400, envS: 60 }, { ...BASS, envA: 10, envD: 400, envS: 60 }, { ...BASS, envA: 1, envD: 400, envS: 60 }]) },
    idea: [
      "A hit can be thought of as three parts in time: the start, the body and the tail. This lesson is about the start. On the synth it is Envelope 1’s Attack: how long the note takes to reach full level.",
      "Fifty thousandths of a second sounds like nothing, yet it is the difference between a note that swells in and one that strikes. Listen for it yourself: nothing else about the sound changes in this lesson, only how quickly it arrives.",
    ],
    steps: [
      { do: "Strike a few low keys. Attack is at 50 ms.", show: ["keyboard", "envelope", "envA", "scope"], hear: "A bass note that leans in: soft at the front.", target: "Three notes played", check: (s) => struck(s) >= 3 },
      { do: "Bring Attack down to about 10 ms and strike again.", show: ["keyboard", "envelope", "envA", "scope"], hear: "A firmer start.", target: "Attack between 6 and 15 ms, two notes played", check: (s) => between(s.state.envA, 6, 15) && struck(s) >= 2 },
      { do: "Now all the way down to 1 ms.", show: ["keyboard", "envelope", "envA", "scope"], hear: "The note arrives at once, and you may hear a small click on top of it: a level that jumps this fast is a sharp edge, and a sharp edge contains high frequencies.", target: "Attack at 1 ms, two notes played", check: (s) => s.state.envA === 1 && struck(s) >= 2,
        remark: (s) => `Your note is ${fall(s).end} Hz, so one cycle of it lasts ${(1000 / fall(s).end).toFixed(1)} ms. An attack of 1 ms is much shorter than a single cycle, which is why it adds an edge of its own.` },
      { do: "Find the shortest Attack that still has no click for you. It is usually between 2 and 8 ms.", show: ["keyboard", "envelope", "envA", "scope"], hear: "A start that strikes but stays clean. This is a judgment; the check only asks that you settle in that range.", target: "Attack between 2 and 8 ms, three notes played", check: (s) => between(s.state.envA, 2, 8) && struck(s) >= 3 },
      { do: "Shorten the body: Sustain to 0 and Decay to about 200 ms.", show: ["keyboard", "envelope", ...ENV1], hear: "A stab. With a short body the start is most of what there is, so its setting matters more.", target: "Sustain 0, decay 120 to 300 ms, attack still 8 ms or less, two notes played", check: (s) => s.state.envS === 0 && between(s.state.envD, 120, 300) && s.state.envA <= 8 && struck(s) >= 2 },
    ],
    recap: ["A hit has a start, a body and a tail.", "Attack sets the start; a few milliseconds change a swell into a strike.", "A very fast start adds a click, because a sudden jump is a sharp edge."],
    inSerum: "Use ENV 1’s ATK knob. How its values read on screen is not confirmed yet, so nothing is checked here.",
  },
  {
    id: "CT.2", title: "The kick as a falling pitch", buildsOn: ["C3.5", "CT.1"], minutes: 8, cardIds: [], initial: { ...THUD },
    outcome: "Build an electronic kick drum from one sine wave and two envelopes.",
    demo: { caption: "A low sine that just fades, then the same sine with its pitch falling fast at the start.", tones: hits([{ ...THUD }, { ...THUD }, { ...KICK }, { ...KICK }], 0.5, 0.15) },
    idea: [
      "Most electronic kick drums are a sine wave whose pitch falls very quickly at the start. Envelope 1 gives it a short life. Envelope 2 starts the pitch high and drops it to the note in a few hundredths of a second.",
      "The fall happens too fast to hear as a melody. What it leaves is a knock at the front of a low thump. The destination to use is Osc A pitch, wide, which can move the pitch by as much as four octaves.",
    ],
    steps: [
      { do: "Strike a low key a few times. This is a very low sine with a short fade.", show: ["keyboard", "scope"], hear: "A soft thud with no front to it. On small speakers you may hear almost nothing.", target: "Three notes played", check: (s) => struck(s) >= 3 },
      { do: "Send Envelope 2 to Osc A pitch, wide, and set its Amount to about 50%.", show: ["keyboard", "env2Dest", "env2Amount", "scope"], hear: "Each note now swoops down from high up: more laser than drum, because the fall is slow.", target: "Envelope 2 sent to Osc A pitch, wide; amount between 40% and 60%; a note played", check: (s) => s.state.env2Dest === "aPitchWide" && between(s.state.env2Amount, 40, 60) && struck(s) >= 1,
        remark: (s) => { const f = fall(s); return `At ${s.state.env2Amount}% the pitch starts ${octaves(s.state.env2Amount).toFixed(1)} octaves up: about ${f.start} Hz, falling to ${f.end} Hz.`; } },
      { do: "Shorten Envelope 2: Sustain 0, Decay about 60 ms, and set its Fall to Sharp.", show: ["keyboard", "envelope2", "env2D", "env2S", "env2Bend", "scope"], hear: "A kick drum. The swoop has shrunk to a knock.", target: "Envelope 2 sustain 0, decay 30 to 100 ms, fall sharp, two notes played", check: (s) => s.state.env2Dest === "aPitchWide" && s.state.env2S === 0 && between(s.state.env2D, 30, 100) && s.state.env2Bend === "sharp" && struck(s) >= 2 },
      { do: "Now shape its length with Envelope 1: try Decay at about 150 ms, then at about 600 ms.", show: ["keyboard", "envelope", "envD", "scope"], hear: "A tight, short kick, then a long booming one. The knock at the front is the same; the body changes.", target: "Envelope 1 decay taken below 200 ms and above 500 ms, two notes played", check: (s) => !!s.range.envD && s.range.envD.min <= 200 && s.range.envD.max >= 500 && struck(s) >= 2 },
      { do: "Play different keys.", show: ["keyboard", "scope"], hear: "The same drum at different tunings. The key you play is where the pitch lands.", target: "Three different keys played", check: (s) => s.distinctNotes >= 3 },
    ],
    recap: ["A basic electronic kick is a sine with a fast fall in pitch.", "Envelope 2 on pitch makes the knock; Envelope 1 sets the length of the body.", "The key played is the pitch the drum settles on."],
    inSerum: "In Serum, send an envelope to an oscillator’s coarse pitch with a large amount. Which pitch control to target and how the amount reads are not confirmed here, so nothing is checked.",
  },
  {
    id: "CT.3", title: "How far and how fast it falls", buildsOn: ["CT.2"], minutes: 8, cardIds: [], initial: { ...KICK },
    outcome: "Turn one kick into a thud, a knock or a zap by changing only the size and speed of the pitch fall.",
    demo: { caption: "Four kicks from the same patch: a small fall, a large fall, a very fast fall, and a slow one.", tones: hits([{ ...KICK, env2Amount: 15 }, { ...KICK, env2Amount: 75 }, { ...KICK, env2D: 15 }, { ...KICK, env2D: 350, env2Bend: "eased" }], 0.6, 0.2) },
    idea: [
      "Two numbers decide a kick’s character. The amount is how far above the note the pitch starts. The decay of Envelope 2 is how long it takes to come down.",
      "A small, quick fall is a soft thud. A large, quick fall is a hard knock, because the pitch passes through many more frequencies in the same instant. Slow the fall and it stops being a knock and becomes a pitch you can follow: the zap of early drum machines and lasers.",
    ],
    steps: [
      { do: "Strike the kick a few times to get it in your ear.", show: ["keyboard", "scope"], hear: "A medium kick.", target: "Three notes played", check: (s) => struck(s) >= 3 },
      { do: "Turn Envelope 2’s Amount down to about 15%.", show: ["keyboard", "env2Amount", "scope"], hear: "A soft, round thud. Little front.", target: "Amount between 8% and 22%, two notes played", check: (s) => between(s.state.env2Amount, 8, 22) && struck(s) >= 2 },
      { do: "Now up to about 75%.", show: ["keyboard", "env2Amount", "scope"], hear: "A hard knock, almost a click, in front of the same body.", target: "Amount between 65% and 85%, two notes played", check: (s) => between(s.state.env2Amount, 65, 85) && struck(s) >= 2,
        remark: (s) => { const f = fall(s); return `The pitch now starts at about ${f.start} Hz and lands on ${f.end} Hz: ${octaves(s.state.env2Amount).toFixed(1)} octaves in ${time(s.state.env2D)}.`; } },
      { do: "Leave the amount and slow the fall: Envelope 2 Decay up to about 350 ms.", show: ["keyboard", "envelope2", "env2D", "scope"], hear: "A zap. The fall is slow enough to follow as a falling note.", target: "Envelope 2 decay between 250 and 500 ms, two notes played", check: (s) => between(s.state.env2D, 250, 500) && struck(s) >= 2 },
      { do: "Make the fall as fast as it goes: Decay down to about 10 ms.", show: ["keyboard", "envelope2", "env2D", "scope"], hear: "The front has shrunk to a tick, and the body sounds almost like the plain thud again.", target: "Envelope 2 decay 15 ms or less, two notes played", check: (s) => s.state.env2D <= 15 && struck(s) >= 2 },
      { do: "Settle on a kick you like and play it.", show: ["keyboard", "envelope2", "env2Amount", "env2D", "envD", "scope"], hear: "Yours.", target: "Decay between 20 and 150 ms, amount 20% or more, three notes played", check: (s) => between(s.state.env2D, 20, 150) && s.state.env2Amount >= 20 && struck(s) >= 3,
        remark: (s) => `Your kick: a fall of ${octaves(s.state.env2Amount).toFixed(1)} octaves in ${time(s.state.env2D)}, and a body of ${time(s.state.envD)}.` },
    ],
    recap: ["Amount is how far the pitch falls; Envelope 2’s decay is how fast.", "Far and fast is a hard knock; near and fast is a soft thud.", "A slow fall is heard as a falling pitch: a zap."],
  },
  {
    id: "CT.4", title: "Sub drops", buildsOn: ["CT.2"], minutes: 7, cardIds: [], initial: { shape: "sine", octave: -1, envA: 5, envD: 4000, envS: 0, envR: 800 },
    outcome: "Make a long, slow fall in pitch under a hit, and control where it starts and ends.",
    demo: { caption: "A low note that fades, then the same note falling an octave as it fades.", tones: [{ patch: { shape: "sine", octave: -1, envA: 5, envD: 4000, envS: 0, envR: 800 }, note: 57, at: 0, seconds: 2.6 }, { patch: { ...DROP }, note: 57, at: 3, seconds: 2.6 }] },
    idea: [
      "A sub drop is the kick idea stretched out. The pitch still falls, but over seconds, not hundredths of a second, so you hear and feel the fall itself. It is usually placed under a big hit at the start of a section.",
      "Because the fall is slow, its shape matters. A straight fall moves at an even pace. An eased fall drops quickly at first and then lingers near the bottom.",
    ],
    steps: [
      { do: "Hold a low key for a few seconds.", show: ["keyboard", "scope"], hear: "A low sine fading slowly. Steady pitch.", target: "A note held for two seconds", check: (s) => s.longestHeld >= 2 },
      { do: "Send Envelope 2 to Osc A pitch, wide, with an Amount of about 25%.", show: ["keyboard", "env2Dest", "env2Amount", "scope"], hear: "A quick dip at the start of each note: Envelope 2 is still short.", target: "Envelope 2 sent to Osc A pitch, wide; amount between 15% and 35%; a note played", check: (s) => s.state.env2Dest === "aPitchWide" && between(s.state.env2Amount, 15, 35) && struck(s) >= 1 },
      { do: "Stretch it: Envelope 2 Sustain 0, Decay about 2.5 seconds, Fall set to Straight. Hold a key for three seconds.", show: ["keyboard", "envelope2", "env2D", "env2S", "env2Bend", "scope"], hear: "The note sliding down for as long as it sounds. On the scope the waves get wider as it falls.", target: "Envelope 2 decay 1.5 s or more, sustain 0, fall straight, a note held for three seconds", check: (s) => s.state.env2Dest === "aPitchWide" && s.state.env2D >= 1500 && s.state.env2S === 0 && s.state.env2Bend === "straight" && s.longestHeld >= 3,
        remark: (s) => { const f = fall(s); return `Your drop starts at about ${f.start} Hz and ends on ${f.end} Hz, ${octaves(s.state.env2Amount).toFixed(1)} octaves lower, over ${time(s.state.env2D)}.`; } },
      { do: "Change Fall to Eased and hold a key again.", show: ["keyboard", "envelope2", "env2Bend", "scope"], hear: "Most of the fall now happens early, and the note spends longer near the bottom.", target: "Fall set to eased, a note held for three seconds", check: (s) => s.state.env2Bend === "eased" && s.longestHeld >= 3 },
      { do: "Try a bigger fall: Amount at about 50%, and play a higher key so it has room to land.", show: ["keyboard", "env2Amount", "scope"], hear: "A longer journey down. The key you play is always where it ends.", target: "Amount between 40% and 60%, a note held for two seconds", check: (s) => between(s.state.env2Amount, 40, 60) && s.longestHeld >= 2 },
    ],
    recap: ["A sub drop is a slow fall in pitch on a low, pure tone.", "The key played is where it lands; the amount sets how far above it starts.", "Straight falls evenly; eased drops fast and lingers low."],
  },
  {
    id: "CT.5", title: "A bass note is a hit too", buildsOn: ["CT.1", "C3.4"], minutes: 9, cardIds: ["filter-envelope"], initial: { ...BASS, cutoff: 250, envA: 3, envR: 40 },
    outcome: "Give a plain bass note a bright front, a body and a clean end.",
    demo: { caption: "A flat bass note, then the same note with a filter snap at the front and a shaped body.", tones: hits([{ ...BASS, cutoff: 250 }, { ...BASS, cutoff: 250, env2Dest: "cutoff", env2Amount: 55, env2D: 90, env2S: 0, envD: 500, envS: 55 }, { ...BASS, cutoff: 250, env2Dest: "cutoff", env2Amount: 55, env2D: 90, env2S: 0, envD: 500, envS: 55 }], 0.7, 0.2) },
    idea: [
      "A bass note can be built like a drum hit: something sharp at the front, then a body, then an end. The front does not have to be louder. It can be brighter: a filter that opens for an instant at the start of every note and closes again.",
      "The body is Envelope 1: a strong start that settles to a lower level keeps a line of notes from turning into one continuous drone. And the end matters as much as the start. A short release leaves a gap before the next note.",
    ],
    steps: [
      { do: "Play a short line of low notes.", show: ["keyboard", "scope", "spectrum"], hear: "A dull, even bass. Every note is the same from start to finish.", target: "Four notes played", check: (s) => struck(s) >= 4 },
      { do: "Send Envelope 2 to Filter cutoff with an Amount of about 55%, Sustain 0 and a Decay of about 90 ms.", show: ["keyboard", "env2Dest", "env2Amount", "env2D", "env2S", "cutoff", "curve"], hear: "Each note now has a bright snap at the front that closes at once.", target: "Envelope 2 sent to Filter cutoff, amount 40% to 70%, sustain 0, decay 50 to 150 ms, two notes played",
        check: (s) => s.state.env2Dest === "cutoff" && between(s.state.env2Amount, 40, 70) && s.state.env2S === 0 && between(s.state.env2D, 50, 150) && struck(s) >= 2,
        remark: (s) => `For the first instant of each note the cutoff opens from ${s.state.cutoff} Hz toward about ${Math.round(s.state.cutoff * 2 ** ((s.state.env2Amount / 100) * 5))} Hz, and is most of the way back within ${time(s.state.env2D)}.` },
      { do: "Stretch the snap: Decay up to about 400 ms.", show: ["keyboard", "env2D", "curve"], hear: "No longer a snap. The note now says “wow” as the filter closes slowly: a different kind of bass.", target: "Envelope 2 decay between 300 and 600 ms, two notes played", check: (s) => between(s.state.env2D, 300, 600) && struck(s) >= 2 },
      { do: "Bring it back to a snap, about 90 ms. Then shape the body: Envelope 1 Decay about 500 ms and Sustain about 55%.", show: ["keyboard", "env2D", "envelope", "envD", "envS"], hear: "A note that strikes, then settles back a little while you hold it.", target: "Envelope 2 decay 50 to 150 ms; Envelope 1 sustain 40% to 70% and decay 300 to 800 ms; two notes played", check: (s) => between(s.state.env2D, 50, 150) && between(s.state.envS, 40, 70) && between(s.state.envD, 300, 800) && struck(s) >= 2 },
      { do: "Play a line of short notes with Release at about 40 ms, then again with Release at about 600 ms.", show: ["keyboard", "envelope", "envR"], hear: "With a short release there is silence between notes and each one lands separately. With a long one they smear together.", target: "Release taken below 60 ms and above 500 ms, four notes played", check: (s) => !!s.range.envR && s.range.envR.min <= 60 && s.range.envR.max >= 500 && struck(s) >= 4 },
    ],
    recap: ["A fast filter envelope gives every bass note a bright front.", "Envelope 1 shapes the body: strike, then settle.", "A short release leaves gaps, and the gaps separate the hits."],
    inSerum: "In Serum, send ENV 2 to the filter’s CUTOFF and keep its decay short. How the values read on screen is not confirmed here, so nothing is checked.",
  },
  {
    id: "CT.6", title: "Pitch at the front", buildsOn: ["CT.5", "CT.2"], minutes: 7, cardIds: [], initial: { ...BASS, cutoff: 600, envA: 3, envD: 500, envS: 55, envR: 40 },
    outcome: "Borrow the kick drum’s trick for a bass note: a tiny, fast fall in pitch at the start.",
    demo: { caption: "A bass note, then the same note with a small pitch fall at the front, then with too much.", tones: hits([{ ...BASS, cutoff: 600, envD: 500, envS: 55 }, { ...BASS, cutoff: 600, envD: 500, envS: 55, env2Dest: "aPitchWide", env2Amount: 12, env2D: 30, env2S: 0, env2Bend: "sharp" }, { ...BASS, cutoff: 600, envD: 500, envS: 55, env2Dest: "aPitchWide", env2Amount: 60, env2D: 120, env2S: 0, env2Bend: "sharp" }], 0.7, 0.2) },
    idea: [
      "The knock at the front of a kick comes from its pitch falling fast. The same thing, much smaller, can sit at the front of a bass note: the pitch starts a little high and lands on the note almost at once.",
      "Kept small and quick, it is not heard as a change of pitch. It is heard as part of how the note starts. Made larger or slower, it becomes an effect in its own right, and the note starts to sound like a drum.",
    ],
    steps: [
      { do: "Play a few low notes.", show: ["keyboard", "scope"], hear: "A plain bass note with a steady pitch.", target: "Three notes played", check: (s) => struck(s) >= 3 },
      { do: "Send Envelope 2 to Osc A pitch, wide. Set Amount to about 12%, Sustain 0, Decay about 30 ms, Fall Sharp.", show: ["keyboard", "env2Dest", "env2Amount", "env2D", "env2S", "env2Bend", "scope"], hear: "A small knock at the front of each note. The note itself is the same.", target: "Envelope 2 sent to Osc A pitch, wide; amount 6% to 20%; sustain 0; decay 15 to 50 ms; two notes played",
        check: (s) => s.state.env2Dest === "aPitchWide" && between(s.state.env2Amount, 6, 20) && s.state.env2S === 0 && between(s.state.env2D, 15, 50) && struck(s) >= 2,
        remark: (s) => `${s.state.env2Amount}% is a start ${(octaves(s.state.env2Amount) * 12).toFixed(0)} semitones above the note, gone in about ${time(s.state.env2D)}.` },
      { do: "Turn the Amount down to 0 and back up while playing, to hear what it adds.", show: ["keyboard", "env2Amount", "scope"], hear: "With it, the note has a front. Without it, the note simply begins.", target: "Amount taken to 0 and back above 6%, three notes played", check: (s) => !!s.range.env2Amount && s.range.env2Amount.min <= 0 && s.state.env2Amount >= 6 && struck(s) >= 3 },
      { do: "Overdo it: Amount to about 60% and Decay to about 120 ms.", show: ["keyboard", "env2Amount", "env2D", "scope"], hear: "Every note now swoops in. It has become a tom drum or a laser, which is sometimes exactly what is wanted.", target: "Amount 50% or more, decay 90 ms or more, two notes played", check: (s) => s.state.env2Amount >= 50 && s.state.env2D >= 90 && struck(s) >= 2 },
      { do: "Bring it back to something small and quick that you like.", show: ["keyboard", "env2Amount", "env2D", "scope"], hear: "A bass note with a defined front.", target: "Amount 4% to 25%, decay 60 ms or less, three notes played", check: (s) => between(s.state.env2Amount, 4, 25) && s.state.env2D <= 60 && struck(s) >= 3 },
    ],
    recap: ["A small, fast pitch fall gives a bass note a front.", "Small and quick reads as attack; large or slow reads as a swoop.", "It is the kick drum’s method at a fraction of the size."],
  },
  {
    id: "CT.C", title: "Checkpoint: hits by ear", buildsOn: ["CT.3", "CT.4", "CT.5"], minutes: 9, cardIds: [],
    outcome: "Hear how a hit differs from yours in its start, its fall or its front, and match it.",
    idea: [
      "Each round hides a hit that differs from yours in one or two settings. Ask whether the difference is at the very start, in how far or how fast the pitch falls, or in how long the body lasts.",
      "The app tells you which settings match, never how the target is set.",
    ],
    steps: [],
    rounds: [
      { target: { envA: 40 }, match: ["envA"], from: { ...BASS, envA: 2, envD: 400, envS: 60 } },
      { target: { env2Amount: 75 }, match: ["env2Amount"], from: { ...KICK, env2Amount: 25 } },
      { target: { env2D: 350 }, match: ["env2D"], from: { ...KICK, env2D: 40, env2Bend: "eased" } },
      { target: { envD: 900 }, match: ["envD"], from: { ...KICK, envD: 200 } },
    ],
    recap: ["Listen to the start first, then the fall, then the body.", "A fall you can follow as a pitch is a slow one.", "The body’s length is Envelope 1; the knock is Envelope 2."],
  },
];
