// Chapter 8: one line at a time. Mono, legato and glide: how the synth behaves when keys overlap. What each
// switch does was measured on the engine (one note sounding in mono, the pitch part-way between two notes
// during a glide, no new attack with legato on).
import type { DemoTone, PlayableLesson, Snapshot } from "../types";

const between = (v: number, lo: number, hi: number) => v >= lo && v <= hi;
const struck = (s: Snapshot) => s.played.mouse + s.played.keys + s.played.midi;
const time = (ms: number) => (ms >= 1000 ? `${(ms / 1000).toFixed(1)} s` : `${Math.round(ms)} ms`);
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
];
