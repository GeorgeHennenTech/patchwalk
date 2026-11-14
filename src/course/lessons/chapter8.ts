// Chapter 8: one line at a time. Mono, legato and glide: how the synth behaves when keys overlap. What each
// switch does was measured on the engine (one note sounding in mono, the pitch part-way between two notes
// during a glide, no new attack with legato on).
import type { DemoTone, PlayableLesson, Snapshot } from "../types";

const between = (v: number, lo: number, hi: number) => v >= lo && v <= hi;
const struck = (s: Snapshot) => s.played.mouse + s.played.keys + s.played.midi;
const time = (ms: number) => (ms >= 1000 ? `${(ms / 1000).toFixed(1)} s` : `${Math.round(ms)} ms`);
const K = ["keyboard", "hold"] as const;
const swept = (s: Snapshot, id: keyof Snapshot["range"], lo: number, hi: number) => !!s.range[id] && s.range[id]!.min <= lo && s.range[id]!.max >= hi;
const LEAD = { shape: "saw", filterOn: true, cutoff: 2200, resonance: 10, envA: 5, envD: 300, envS: 70, envR: 150 } as const;

export const CHAPTER_8: PlayableLesson[] = [
  {
    id: "C8.1", title: "One note at a time", buildsOn: ["C3.1"], minutes: 8, cardIds: ["glide"], initial: { ...LEAD },
    outcome: "Switch the synth between playing chords and playing a single line, and choose whether overlapped notes start afresh.",
    idea: [
      "So far every key you hold has sounded, so two keys make two notes. That is called poly. Many basses and leads are played the other way, mono: only one note can sound, and a new key takes over from the old one. Hold a key, press another, let the second go, and the first comes back.",
      "In mono there is one more choice. When a new key is pressed while another is still down, the note can start again from the beginning of its envelopes, or it can simply change pitch and carry on. Carrying on is called legato. With legato on, how you play decides the result: overlapped keys run together as one long note, separated keys each get their own start.",
    ],
    steps: [
      { do: "Hold one key and press a second while the first is still down.", show: ["keyboard"], hear: "Two notes together.", target: "Two notes sounding at once", check: (s) => s.held.length >= 2 },
      { do: "Let go, then set Voices play to Mono. Hold a key and press a second one while the first is still down.", show: ["keyboard", "voiceMode"], hear: "The second note replaces the first. Only one sounds, however many keys are down.", target: "Mono; two different notes played, one sounding", check: (s) => s.state.voiceMode === "mono" && s.distinctNotes >= 2 && s.held.length === 1 },
      { do: "Hold a low key. Tap a higher key several times without letting go of the low one.", show: ["keyboard", "voiceMode"], hear: "Each time the higher key is let go, the low note comes back by itself. This is how fast trills are played with one hand.", target: "Mono; four or more notes struck", check: (s) => s.state.voiceMode === "mono" && struck(s) >= 4 },
      { do: "Turn Envelope 1's Attack up to about 400 ms and play overlapping notes again.", show: ["keyboard", "voiceMode", "envA"], hear: "Every note swells in from quiet, even when the keys overlap: each new key starts the envelope again.", target: "Attack between 300 and 600 ms; two notes struck", check: (s) => between(s.state.envA, 300, 600) && struck(s) >= 2 },
      { do: "Switch Legato on. Play a run of overlapping notes, then some separated ones.", show: ["keyboard", "voiceMode", "legato", "envA"], hear: "Overlapped notes change pitch with no new swell: one unbroken note. Separated notes each swell in as before.", target: "Legato on; four or more notes struck", check: (s) => s.state.voiceMode === "mono" && s.state.legato === "on" && struck(s) >= 4,
        remark: (s) => `With an attack of ${time(s.state.envA)}, a note that starts afresh takes that long to arrive. An overlapped note with legato on skips it, because the envelope is already running.` },
    ],
    recap: ["Poly sounds every key held; mono sounds one, and the newest key wins.", "In mono, letting go of a key falls back to one still held.", "Legato carries the envelopes on through overlapped notes instead of starting them again."],
    inSerum: "Serum has MONO and LEGATO switches in its voicing section (page 216 of its guide). Switch both on, give Envelope 1 a slow attack, and play overlapped then separated notes.",
  },
  {
    id: "C8.2", title: "Glide", buildsOn: ["C8.1", "C1.2"], minutes: 8, cardIds: ["glide"], initial: { ...LEAD, voiceMode: "mono" },
    outcome: "Make the pitch slide from one note to the next, set how long the slide takes, and choose which notes slide.",
    demo: { caption: "A low note then a high one, three times: jumping, sliding quickly, then sliding slowly.", tones: [0, 120, 700].flatMap((glide, i): DemoTone[] => [
      { patch: { ...LEAD, glide }, note: 45, at: i * 2.3, seconds: 0.6 }, { patch: { ...LEAD, glide }, note: 64, from: 45, at: i * 2.3 + 0.6, seconds: 1.4 }]) },
    idea: [
      "Until now a new note has started exactly on its pitch. Glide makes the pitch travel there from the previous note instead, taking the time you set. A short glide is a small scoop into each note. A long one is a siren between them.",
      "The time is the same whatever the distance, so a wide jump moves faster than a narrow one. A second switch chooses which notes slide: every note, or only those pressed while another key is still held. The second way lets your fingers decide: overlap two keys for a slide, separate them for a clean jump.",
    ],
    steps: [
      { do: "Play a low key, let go, then a high key. Do it a couple of times.", show: ["keyboard"], hear: "Each note starts exactly on its pitch.", target: "Three or more notes struck", check: (s) => struck(s) >= 3 },
      { do: "Turn Glide up to about 150 ms and play low and high keys again.", show: ["keyboard", "glide"], hear: "A quick scoop into every note, up or down from wherever the last one was.", target: "Glide between 100 and 250 ms; two notes struck", check: (s) => between(s.state.glide, 100, 250) && struck(s) >= 2 },
      { do: "Turn Glide up to about 1 second. Play a low key, then one far above it, and hold it.", show: ["keyboard", "glide"], hear: "A long, even climb that arrives on the note and stops.", target: "Glide between 800 ms and 1.5 s; a note held for over a second", check: (s) => between(s.state.glide, 800, 1500) && s.longestHeld >= 1.2,
        remark: (s) => `The slide takes ${time(s.state.glide)} whether the jump is one key or two octaves, so wider jumps travel faster.` },
      { do: "Bring Glide back to about 200 ms and set Glide on to Overlapped notes. Play separated notes, then overlapped ones.", show: ["keyboard", "glide", "glideMode"], hear: "Separated notes jump cleanly. A note pressed while another is still held slides.", target: "Overlapped notes; glide between 120 and 320 ms; four notes struck", check: (s) => s.state.glideMode === "legato" && between(s.state.glide, 120, 320) && struck(s) >= 4 },
      { do: "Switch Legato on as well, and play a line that mixes overlapped and separated notes.", show: ["keyboard", "glide", "glideMode", "legato"], hear: "Overlapped notes slide and run together as one; separated notes start afresh on their pitch. This is the classic way a mono bass or lead is set up.", target: "Mono, legato on, glide on overlapped notes; six notes struck", check: (s) => s.state.voiceMode === "mono" && s.state.legato === "on" && s.state.glideMode === "legato" && s.state.glide > 0 && struck(s) >= 6 },
    ],
    recap: ["Glide slides the pitch from the previous note over a set time.", "The time is fixed, so wide jumps move faster.", "Glide can act on every note, or only on notes pressed while another is held."],
    inSerum: "Serum's glide time is the PORTA knob, with ALWAYS, SCALED and CURVE options beside it (page 218 of its guide). Which of its options matches the switch here is not confirmed, so nothing is checked.",
  },
  {
    id: "C8.3", title: "The bend and mod wheels", buildsOn: ["C5.1", "C4.2"], minutes: 9, cardIds: ["wheels"], initial: { ...LEAD, cutoff: 500, resonance: 25 },
    outcome: "Bend a note's pitch by hand, set how far the bend reaches, and use the mod wheel to open a filter and to bring in vibrato.",
    idea: [
      "Envelopes and LFOs move a sound by themselves. The two wheels beside the keys let you move it by hand while a note is sounding. On the screen you drag them; on a MIDI keyboard they are the two wheels at the left.",
      "The bend wheel moves pitch and nothing else. It springs back to the middle when you let go, and the Bend range setting says how many semitones it reaches at either end. The mod wheel stays where you leave it. It is a source, like velocity: it does nothing until it is sent somewhere, and then its position decides how much of its amount is applied.",
    ],
    steps: [
      { do: "Switch on Hold and play a note. Drag the Bend wheel to the top, then let go.", show: [...K, "wheels"], hear: "The pitch slides up a little and snaps back to the note when you let go.", target: "A note held; Bend pushed to the top", check: (s) => s.held.length >= 1 && !!s.flags.bentUp },
      { do: "Now drag Bend to the bottom and let go.", show: [...K, "wheels"], hear: "The same distance downward, and back.", target: "Bend pulled to the bottom", check: (s) => !!s.flags.bentDown,
        remark: (s) => `Bend range is ${s.state.bendRange} semitones, so the top and bottom of the wheel are that far above and below the note.` },
      { do: "Set Bend range to 12 and push Bend to the top again.", show: [...K, "wheels", "bendRange"], hear: "A whole octave of slide: the same hand movement now travels six times as far.", target: "Bend range 12; Bend pushed to the top", check: (s) => s.state.bendRange === 12 && !!s.flags.bentUp },
      { do: "Set Mod wheel sends to: Filter cutoff, with an amount of about +60%.", show: [...K, "wheels", "wheelDest", "wheelAmount", "cutoff"], hear: "Nothing yet. The wheel is at the bottom, so none of its amount is applied.", target: "Mod wheel sent to Filter cutoff, amount between 45% and 75%", check: (s) => s.state.wheelDest === "cutoff" && between(s.state.wheelAmount, 45, 75) },
      { do: "With the note still sounding, drag the Mod wheel slowly from the bottom to the top and back.", show: [...K, "wheels", "wheelAmount", "cutoff", "curve"], hear: "The filter opens with your hand and closes again. Watch the curve follow the wheel.", target: "Mod wheel taken above 90% and back below 10%", check: (s) => s.state.wheelDest === "cutoff" && swept(s, "wheel", 10, 90) && s.state.wheel <= 10 },
      { do: "Now the classic use. Set Mod wheel sends to: LFO 1 amount, with an amount of about +5%. Raise the Mod wheel slowly.", show: [...K, "wheels", "wheelDest", "wheelAmount", "lfo1Amount", "lfo1Rate"], hear: "A steady note at the bottom of the wheel; a wobble in pitch that deepens as the wheel rises. The wheel is not moving the pitch itself: it is turning up how far the LFO moves it.",
        preset: { lfo1Dest: "fine", lfo1Amount: 0, lfo1Rate: 5.5, lfo1Shape: "sine", wheel: 0 }, target: "Mod wheel sent to LFO 1 amount, amount between 2% and 12%, wheel above 80%", check: (s) => s.state.wheelDest === "lfo1Amount" && between(s.state.wheelAmount, 2, 12) && s.state.wheel >= 80 },
    ],
    recap: ["The bend wheel moves pitch by hand and springs back; Bend range sets how far.", "The mod wheel is a source: a destination, an amount, and your hand deciding how much.", "Sent to another connection's amount, the mod wheel fades movement such as vibrato in and out."],
    inSerum: "Serum lists Mod Wheel and Pitch Bend among its modulation sources (page 211 of its guide). Send the mod wheel to an LFO's amount in the matrix and raise it while holding a note.",
  },
];
