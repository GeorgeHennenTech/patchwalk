// Chapter 3: envelopes. Scripts are in docs/lessons/. The plan's lesson on curves and hold (C3.3) is not here:
// the practice synth's envelopes have no curve or hold controls yet.
import { PITCH_SEMITONES } from "../../synth/mod";
import type { DemoTone, PlayableLesson, Snapshot } from "../types";

const between = (v: number, lo: number, hi: number) => v >= lo && v <= hi;
const struck = (s: Snapshot) => s.played.mouse + s.played.keys + s.played.midi;
const moved = (s: Snapshot, key: keyof Snapshot["changes"]) => (s.changes[key] ?? 0) >= 1;
const time = (ms: number) => (ms >= 1000 ? `${(ms / 1000).toFixed(2)} s` : `${ms} ms`);
const patches = (list: DemoTone["patch"][], len = 1.2, gap = 0.9, note = 57): DemoTone[] => list.map((patch, i) => ({ patch, note, at: i * (len + gap), seconds: len }));
/** A dark, slightly resonant filter with envelope 2 already sent to its cutoff. */
const SWEPT = { filterOn: true, cutoff: 300, resonance: 30, env2Dest: "cutoff", env2Amount: 60, env2D: 500 } as const;

export const CHAPTER_3: PlayableLesson[] = [
  {
    id: "C3.1", title: "Attack, decay, sustain, release", earCheck: "attack", buildsOn: ["C0.3"], minutes: 9, cardIds: ["amp-envelope"],
    outcome: "Shape how a note’s loudness starts, settles and ends, using the four stages of an envelope.",
    demo: { caption: "The same note three ways: switched straight on and off, fading in slowly, then ringing on after it is let go.", tones: patches([{}, { envA: 600 }, { envR: 1200 }], 1.1, 1.3) },
    idea: [
      "So far every note has switched on and off like a light. An envelope gives a note a shape in time. Attack is how long it takes to reach full level. Decay is how long it then takes to fall to the sustain level. Sustain is the level it stays at while you hold the key. Release is how long it takes to fade after you let go.",
      "Three of the four are times; sustain is a level. Envelope 1 on this synth always controls loudness. The drawing shows the shape, and you can drag its points.",
    ],
    steps: [
      { do: "Strike a few keys, some short and some long. Do not use Hold in this lesson.", show: ["keyboard", "envelope"], hear: "Notes that start and stop at once, like a switch.", target: "Three notes played", check: (s) => struck(s) >= 3 },
      { do: "Raise Attack to about half a second, then strike a key and hold it.", show: ["keyboard", "envelope", "envA"], hear: "The note fading in.", target: "Attack between 400 and 700 ms, a note played", check: (s) => between(s.state.envA, 400, 700) && struck(s) >= 1 },
      { do: "Bring Attack back down to almost nothing. Set Sustain to 0 and Decay to about 300 ms, then hold a key.", show: ["keyboard", "envelope", "envA", "envD", "envS"], hear: "A pluck: the note dies away though you are still holding the key.", target: "Attack 20 ms or less, sustain 0, decay 200 to 500 ms, a note played",
        check: (s) => s.state.envA <= 20 && s.state.envS === 0 && between(s.state.envD, 200, 500) && struck(s) >= 1 },
      { do: "Raise Sustain to about 50% and hold a key for a couple of seconds.", show: ["keyboard", "envelope", "envD", "envS"], hear: "A strong start that drops, then stays at a lower level for as long as you hold.", target: "Sustain between 40% and 60%, a note held for two seconds", check: (s) => between(s.state.envS, 40, 60) && s.longestHeld >= 2 },
      { do: "Raise Release to about one second and play a few short notes.", show: ["keyboard", "envelope", "envR"], hear: "Each note ringing on after you let go, overlapping the next.", target: "Release between 700 ms and 1.5 s, two notes played", check: (s) => between(s.state.envR, 700, 1500) && struck(s) >= 2,
        remark: (s) => `Your envelope now: attack ${time(s.state.envA)}, decay ${time(s.state.envD)}, sustain ${s.state.envS}%, release ${time(s.state.envR)}. Three times and one level.` },
      { do: "Now drag the points on the drawing itself to make a shape of your own, and play it.", show: ["keyboard", "envelope", "envA", "envD", "envS", "envR"], hear: "Whatever you drew.", target: "A point dragged on the drawing, a note played", check: (s) => !!s.flags.envelope && struck(s) >= 1 },
    ],
    recap: ["Attack, decay and release are times; sustain is a level.", "Sustain only matters while the key is held; release only after it is let go.", "A note with no sustain is a pluck; a note with full sustain is an organ."],
    inSerum: "ENV 1 controls level in Serum too, with ATK, HOLD, DEC, SUS and REL knobs. From Init, raise ATK and REL and play. The “The amp envelope” Serum task checks a saved preset.",
  },
  {
    id: "C3.2", title: "Pluck, pad and organ", buildsOn: ["C3.1"], minutes: 9, cardIds: ["amp-envelope"],
    outcome: "Set up the three classic loudness shapes from the same four controls, and match an envelope by ear.",
    demo: { caption: "One note as an organ, a pluck and a pad.", tones: patches([{}, { envS: 0, envD: 300, envR: 300 }, { envA: 700, envS: 80, envR: 1200 }], 1.2, 1.3) },
    idea: [
      "Most sounds fall into one of three loudness shapes. An organ switches on and off: no attack, full sustain, no release. A pluck starts at once and dies away by itself: no sustain, and the decay sets its length. A pad swells in and fades out: long attack, high sustain, long release.",
      "The oscillators can stay exactly the same. The shape in time is often what tells you what kind of instrument you are hearing.",
    ],
    steps: [
      { do: "The synth starts as an organ. Play a few notes, short and long.", show: ["keyboard", "envelope", "envA", "envD", "envS", "envR"], hear: "On and off at once, at full level in between.", target: "Attack 10 ms or less, sustain 100%, release 50 ms or less, two notes played",
        check: (s) => s.state.envA <= 10 && s.state.envS === 100 && s.state.envR <= 50 && struck(s) >= 2 },
      { do: "Make it a pluck: Sustain to 0, Decay somewhere between a fifth and half a second, and a little Release.", show: ["keyboard", "envelope", "envA", "envD", "envS", "envR"], hear: "A short note that dies away however long you hold the key.", target: "Attack 10 ms or less, sustain 10% or less, decay 150 to 600 ms, release 100 to 600 ms, two notes played",
        check: (s) => s.state.envA <= 10 && s.state.envS <= 10 && between(s.state.envD, 150, 600) && between(s.state.envR, 100, 600) && struck(s) >= 2,
        remark: (s) => `Your pluck lasts about ${time(s.state.envD)}. Shorter is more percussive; longer is more like a plucked string.` },
      { do: "Make it a pad: a long Attack, Sustain up high, and a long Release. Hold a key, then let go.", show: ["keyboard", "envelope", "envA", "envD", "envS", "envR"], hear: "A swell in, a steady level, and a slow fade.", target: "Attack 400 ms or more, sustain 60% or more, release 800 ms or more, a note played",
        check: (s) => s.state.envA >= 400 && s.state.envS >= 60 && s.state.envR >= 800 && struck(s) >= 1 },
    ],
    rounds: [
      { target: { envA: 600 }, match: ["envA"], from: { envA: 5, envD: 300, envS: 100, envR: 30 } },
      { target: { envS: 0, envD: 250 }, match: ["envD", "envS"], from: { envA: 5, envD: 1200, envS: 100, envR: 150 } },
      { target: { envR: 1500 }, match: ["envR"], from: { envA: 5, envD: 300, envS: 100, envR: 30 } },
    ],
    recap: ["Organ: instant on and off, full sustain.", "Pluck: instant start, no sustain; decay sets the length.", "Pad: slow attack, high sustain, slow release."],
    inSerum: "From Init, make a pluck on ENV 1: SUS all the way down and DEC short. How ENV 1’s values read on screen is not confirmed yet, so nothing is checked here.",
  },
  {
    id: "C3.3", title: "Hold, and how a note falls", buildsOn: ["C3.2"], minutes: 7, cardIds: ["amp-envelope"], initial: { envA: 5, envD: 500, envS: 0, envR: 300 },
    outcome: "Keep a note at full level for a moment before it falls, and choose the shape of the fall.",
    demo: { caption: "The same pluck falling in three shapes: straight, eased, sharp. Then with a short hold at the top.", tones: [
      { patch: { envA: 5, envD: 500, envS: 0, envR: 300, envBend: "straight" }, note: 57, at: 0, seconds: 0.9 },
      { patch: { envA: 5, envD: 500, envS: 0, envR: 300, envBend: "eased" }, note: 57, at: 1.2, seconds: 0.9 },
      { patch: { envA: 5, envD: 500, envS: 0, envR: 300, envBend: "sharp" }, note: 57, at: 2.4, seconds: 0.9 },
      { patch: { envA: 5, envD: 500, envS: 0, envR: 300, envBend: "sharp", envH: 250 }, note: 57, at: 3.6, seconds: 0.9 },
    ] },
    idea: [
      "Two more controls finish the envelope. Hold keeps the note at full level for a set time after the attack, before the decay begins. It adds weight to the front of a note without making the whole note longer.",
      "Fall is the shape of the decay and release. Straight loses level at an even rate. Eased drops quickly at first and then slows, which is how most plucked and struck things behave. Sharp does that more strongly: most of the level is gone almost at once, with a long quiet tail. The decay time is the same in all three; what changes is where in that time the sound goes.",
    ],
    steps: [
      { do: "Strike a few keys. This is a pluck with an eased fall.", show: ["keyboard", "envelope", "envBend"], hear: "A note that drops away naturally.", target: "Eased fall, two notes played", check: (s) => s.state.envBend === "eased" && struck(s) >= 2 },
      { do: "Switch Fall to Straight and strike again.", show: ["keyboard", "envelope", "envBend"], hear: "The note seems longer and flatter, then stops rather suddenly.", target: "Straight fall, two notes played", check: (s) => s.state.envBend === "straight" && struck(s) >= 2 },
      { do: "Switch Fall to Sharp and strike again.", show: ["keyboard", "envelope", "envBend"], hear: "A hard, snappy front and a thin tail. The same decay time, but it sounds much shorter.", target: "Sharp fall, two notes played", check: (s) => s.state.envBend === "sharp" && struck(s) >= 2,
        remark: () => "All three had the same half-second decay. Halfway through it, the straight fall is still at half level, the eased one is down to about an eighth, and the sharp one to about a hundredth. That is why they feel so different." },
      { do: "Stay on Sharp and raise Hold to about 200 ms.", show: ["keyboard", "envelope", "envH", "envBend"], hear: "A solid block of sound at the front, then the snap. Punchier, without ringing on.", target: "Sharp fall, hold between 120 and 300 ms, two notes played", check: (s) => s.state.envBend === "sharp" && between(s.state.envH, 120, 300) && struck(s) >= 2 },
      { do: "Choose the Fall and Hold you like best for a pluck.", show: ["keyboard", "envelope", "envH", "envD", "envBend"], hear: "Your choice.", target: "Fall or hold changed in this step, a note played", check: (s) => (moved(s, "envBend") || moved(s, "envH")) && struck(s) >= 1,
        remark: (s) => `You chose a ${s.state.envBend} fall with ${s.state.envH === 0 ? "no hold" : `${time(s.state.envH)} of hold`}.` },
    ],
    recap: ["Hold keeps a note at full level before it starts to fall.", "The shape of the fall changes how long a note seems, at the same decay time.", "Eased and sharp falls sound struck or plucked; a straight fall sounds mechanical."],
    inSerum: "ENV 1 in Serum has a HOLD knob between ATK and DEC, and each stage of the envelope drawing can be dragged into a curve. Listening only.",
  },
  {
    id: "C3.4", title: "Envelope on the filter", buildsOn: ["C3.1", "C2.2"], minutes: 9, cardIds: ["filter-envelope"], initial: { filterOn: true, cutoff: 300, resonance: 30 },
    outcome: "Send a second envelope to the filter’s cutoff so each note changes brightness as it sounds.",
    demo: { caption: "A dull filtered note, then the same note with an envelope opening the filter at its start.", tones: patches([{ filterOn: true, cutoff: 300, resonance: 30 }, { ...SWEPT }, { ...SWEPT, env2D: 120, env2Amount: 80 }], 1.1, 0.4) },
    idea: [
      "An envelope is only a shape in time. Envelope 1 is wired to loudness, but Envelope 2 can be sent to other controls. Sent to the cutoff, it pushes the cutoff up at the start of each note and lets it fall back: a bright start that closes down. That is the sound of most synth basses and plucks.",
      "Amount sets how far the envelope pushes. The cutoff knob stays where you set it; it grows a yellow ring showing the stretch the envelope moves it across.",
    ],
    steps: [
      { do: "Strike a key. The filter is on and set dark, and Envelope 2 is not connected.", show: ["keyboard", "env2Dest", "cutoff"], hear: "A dull, steady note.", target: "Envelope 2 sent to nothing, a note played", check: (s) => s.state.env2Dest === "none" && struck(s) >= 1 },
      { do: "Set Envelope 2’s “Sends to” to Filter cutoff, and strike a few keys.", show: ["keyboard", "env2Dest", "env2Amount", "cutoff", "envelope2"], hear: "Each note starting brighter and closing down. Look for the yellow ring on Cutoff.", target: "Envelope 2 sent to Filter cutoff, two notes played", check: (s) => s.state.env2Dest === "cutoff" && struck(s) >= 2 },
      { do: "Raise Amount to about 80%.", show: ["keyboard", "env2Amount", "cutoff", "envelope2"], hear: "A much brighter start: the envelope is pushing the cutoff further.", target: "Amount between 70% and 100%, a note played", check: (s) => s.state.env2Dest === "cutoff" && between(s.state.env2Amount, 70, 100) && struck(s) >= 1 },
      { do: "Shorten Envelope 2’s Decay to about 100 ms.", show: ["keyboard", "env2D", "env2Amount", "cutoff", "envelope2"], hear: "A tight click of brightness at the front of each note.", target: "Decay between 60 and 160 ms, a note played", check: (s) => between(s.state.env2D, 60, 160) && struck(s) >= 1 },
      { do: "Now lengthen it to about a second and a half, and hold a key.", show: ["keyboard", "env2D", "env2Amount", "cutoff", "envelope2"], hear: "A slow “wow” as the filter closes.", target: "Decay between 1 and 2.5 s, a note played", check: (s) => between(s.state.env2D, 1000, 2500) && struck(s) >= 1,
        remark: (s) => `With decay at ${time(s.state.env2D)} the sweep is slow enough to hear as a movement of its own. At 100 ms it was part of the note’s attack.` },
      { do: "Raise the Cutoff knob to about 2 kHz and turn Amount below zero.", show: ["keyboard", "env2Amount", "cutoff", "envelope2"], hear: "The other way round: each note starts muffled and opens up.", target: "Cutoff at 1.5 kHz or above, amount below zero, a note played", check: (s) => s.state.cutoff >= 1500 && s.state.env2Amount < 0 && struck(s) >= 1 },
    ],
    recap: ["A second envelope can be sent to the cutoff.", "Amount sets how far it pushes; decay sets how long the change takes.", "A negative amount turns the shape upside down."],
    inSerum: "In Serum, drag ENV 2 onto Filter 1’s CUTOFF knob to connect it; a ring on the knob shows the range. Save it and drop it into the “LFOs and modulation” Serum task to see what the app can read from it.",
  },
  {
    id: "C3.5", title: "Envelope on pitch", buildsOn: ["C3.4", "C1.4"], minutes: 7, cardIds: ["oscillator-pitch"],
    outcome: "Send an envelope to pitch to make drops, zaps and scoops.",
    demo: { caption: "A plain note, then a pitch drop at its start, then a very fast one.", tones: patches([{}, { env2Dest: "fine", env2Amount: 100, env2D: 400 }, { env2Dest: "fine", env2Amount: 100, env2D: 60 }], 1.0, 0.4) },
    idea: [
      "The same envelope can be sent to pitch. A note that starts high and falls quickly to its real pitch has a hard, percussive front: that is how synth kick drums and laser zaps are made. A note that starts a little low and rises sounds like a singer scooping up to it.",
      "Short and large reads as an impact. Long and small reads as expression.",
    ],
    steps: [
      { do: "Set Envelope 2’s “Sends to” to Osc A pitch and strike a few keys.", show: ["keyboard", "env2Dest", "env2Amount", "envelope2", "fine"], hear: "Each note dropping into place: “pyew”.", target: "Envelope 2 sent to Osc A pitch, two notes played", check: (s) => s.state.env2Dest === "fine" && struck(s) >= 2 },
      { do: "Raise Amount all the way and shorten Decay to about 60 ms. Play low keys.", show: ["keyboard", "env2D", "env2Amount", "envelope2"], hear: "A thump: the drop is too fast to hear as a slide.", target: "Amount at 90% or more, decay between 30 and 100 ms, a note played", check: (s) => s.state.env2Amount >= 90 && between(s.state.env2D, 30, 100) && struck(s) >= 1,
        remark: (s) => `At ${s.state.env2Amount}% each note starts ${Math.round((s.state.env2Amount / 100) * PITCH_SEMITONES)} semitones high and falls in ${time(s.state.env2D)}.` },
      { do: "Lengthen Decay to about 300 ms and set Amount a little below zero.", show: ["keyboard", "env2D", "env2Amount", "envelope2"], hear: "Each note scooping up to its pitch from below.", target: "Amount between -40% and -5%, decay between 150 and 500 ms, a note played", check: (s) => between(s.state.env2Amount, -40, -5) && between(s.state.env2D, 150, 500) && struck(s) >= 1 },
      { do: "Switch on Osc B and send Envelope 2 to Osc B pitch instead, with Amount back above 50%.", show: ["keyboard", "bOn", "env2Dest", "env2Amount", "envelope2"], hear: "A steady note from A with a falling one from B on top: a knock at the front of the sound.", target: "Osc B on, envelope 2 sent to Osc B pitch, amount 50% or more, a note played", check: (s) => s.state.bOn && s.state.env2Dest === "bFine" && s.state.env2Amount >= 50 && struck(s) >= 1 },
    ],
    recap: ["An envelope on pitch makes each note slide into place.", "Fast and far is an impact; slow and slight is a scoop.", "Sending it to one oscillator only adds a knock on top of a steady tone."],
    inSerum: "In Serum, drag ENV 2 onto an oscillator’s CRS (coarse pitch) control for a drop. Listening only: how the amount reads on screen is not confirmed.",
  },
  {
    id: "C3.6", title: "Envelopes and the other filter shapes", buildsOn: ["C3.4", "C2.3"], minutes: 6, cardIds: ["filter-envelope", "filter-types-and-slope"], initial: { ...SWEPT },
    outcome: "Predict what a cutoff envelope does on a high-pass or band-pass filter.",
    demo: { caption: "The same envelope on a low-pass, a high-pass and a band-pass filter.", tones: patches([{ ...SWEPT }, { ...SWEPT, filterType: "high" }, { ...SWEPT, filterType: "band", resonance: 60 }], 1.1, 0.4) },
    idea: [
      "The envelope always does the same thing: it pushes the cutoff up and lets it fall. What you hear depends on which side of the cutoff the filter keeps.",
      "On a low-pass, a falling cutoff takes brightness away. On a high-pass, a falling cutoff lets the low end back in, so the body of the note arrives late. On a band-pass, the slice that gets through slides downward, which sounds like a vowel changing.",
    ],
    steps: [
      { do: "Strike a few keys on the low-pass filter. Envelope 2 is already sent to the cutoff.", show: ["keyboard", "filterType", "curve", "envelope2"], hear: "Bright start, closing down.", target: "Low-pass, two notes played", check: (s) => s.state.filterType === "low" && struck(s) >= 2 },
      { do: "Switch to High-pass and strike again.", show: ["keyboard", "filterType", "curve", "envelope2"], hear: "A thin start that fills in: the weight of the note arrives a moment late.", target: "High-pass, two notes played", check: (s) => s.state.filterType === "high" && struck(s) >= 2 },
      { do: "Switch to Band-pass and raise Resonance to about 60%.", show: ["keyboard", "filterType", "resonance", "curve", "envelope2"], hear: "A “yow”: one narrow slice sliding down through the harmonics.", target: "Band-pass, resonance 50% or more, a note played", check: (s) => s.state.filterType === "band" && s.state.resonance >= 50 && struck(s) >= 1 },
      { do: "Raise the Cutoff to about 1 kHz and turn Envelope 2’s Amount below zero.", show: ["keyboard", "cutoff", "env2Amount", "curve", "envelope2"], hear: "The slice sliding upward: “woy”.", target: "Band-pass, cutoff 700 Hz or above, amount below zero, a note played", check: (s) => s.state.filterType === "band" && s.state.cutoff >= 700 && s.state.env2Amount < 0 && struck(s) >= 1,
        remark: () => "Same envelope, same destination, four different results so far. The filter shape decides what a moving cutoff means." },
    ],
    recap: ["The envelope moves the cutoff the same way on every filter shape.", "On a high-pass, a falling cutoff brings the low end in late.", "On a band-pass, it slides a slice through the sound, like a vowel."],
    inSerum: "With ENV 2 on Filter 1’s CUTOFF, step through a low-pass, a high-pass and a band-pass type and play the same note. Listening only.",
  },
  {
    id: "C3.C", title: "Checkpoint: envelopes by ear", buildsOn: ["C3.2", "C3.4", "C3.6"], minutes: 10, cardIds: [],
    outcome: "Recreate hidden sounds by their shape in time: how they start, settle and end, and how their brightness moves.",
    idea: [
      "Each round hides a sound whose shape in time differs from yours. Ask: does it start at once or fade in? Does it hold or die away? Does it ring on? Does its brightness move, which way, and how fast?",
      "Times count as matched when they are within about double or half of the target, because that is how coarsely the ear judges them. The app tells you which way you are off, never the numbers.",
    ],
    steps: [],
    rounds: [
      { target: { envA: 500 }, match: ["envA"], from: { envA: 5, envD: 300, envS: 100, envR: 30 } },
      { target: { envS: 0, envD: 300 }, match: ["envD", "envS"], from: { envA: 5, envD: 1500, envS: 100, envR: 200 } },
      { target: { env2Amount: 85 }, match: ["env2Amount"], from: { ...SWEPT, env2Amount: 15, env2D: 400 } },
      { target: { env2D: 1500 }, match: ["env2D"], from: { ...SWEPT, env2D: 120 } },
      { target: { filterType: "high", env2Amount: -60 }, match: ["filterType", "env2Amount"], from: { ...SWEPT, cutoff: 900, filterType: "low", env2Amount: 60 } },
    ],
    recap: ["Listen to the start, the middle and the end of the note separately.", "A change in brightness during the note is an envelope on the filter.", "“Too long” and “too short” are enough to home in on a time."],
  },
];
