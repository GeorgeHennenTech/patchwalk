# Patchwalk (working name)

A web app that teaches people to recreate a Serum 2 patch. The user drops in a `.SerumPreset`; the app decodes it
in the browser, works out which parts matter, and walks them through building the sound in signal-flow order.
Each step says what to do, why it works, and what to listen for. A difficulty toggle changes the explanation.

**New session? Read `docs/HANDOFF.md` first.** It summarises goals, decisions, state and what to do next, and is
written so a fresh assistant can continue without the owner re-explaining anything. Keep it up to date when
something significant changes.

## Scope for now
Preset reading: Serum 2 `.SerumPreset` only, parsed entirely in the browser. No screenshots, Serum 1 `.fxp`,
or plugin, and no recording or analysis of audio from Serum.
Audio: the owner has since asked for a built-in practice synth (and later a mini DAW) that makes sound in the
browser for lessons. That is planned, not built: see `docs/COURSE_PLAN.md` and `docs/CURRICULUM.md`.

## Stack
Vite + React + TypeScript, Zod, Vitest, Vercel. The lesson-generation call to Claude goes through a Vercel
serverless function (`api/`), so the API key never reaches the browser.

## Rules
1. Reference `node-serum2-preset-packager` (MIT) and `serum2-preset-loader` (MIT). Do NOT copy code from
   `KennethWussmann/serum-preset-packager` (no license) or `serum2vital` (GPL-3.0).
2. Never decompile or disassemble Serum. Learn the format only from public sources and the fixture presets.
3. Process files locally. Never upload or store a user's preset. Only code-selected facts go to the lesson API.
4. Don't ship any Xfer content (factory presets, wavetables). No "Serum" or "Xfer" in the product name.
5. The LLM is a narrator, not an analyst. Code decides which facts matter, the order, and every number. The LLM
   only writes the "why" for facts it is given, using the knowledge cards. A validator rejects any lesson text
   that mentions a value or setting not in the parsed patch, and regenerates.
6. If a key can't be interpreted, say so in the lesson. Never invent an explanation.
7. Any display-value conversion not confirmed in Serum 2 by the owner is marked `unverified` in code and in the UI.

## Format facts
Checked against five fixtures: `fixtures/init/Initial_Preset.SerumPreset` (2.0.24, format 9) and four presets made by the owner
in `fixtures/patches/` (2.0.17-2.0.24, formats 7, 8, 9). The TypeScript decoder was cross-checked against an
independent Python decode (zstandard + cbor2): identical output on all five.

Confirmed on all five:
- Layout: `"XferJson\0"` (9 bytes), u64 LE JSON-header length, JSON metadata, u32 LE decompressed size,
  u32 LE flag (= 2), one zstd frame of CBOR running to end of file. Declared size always equals actual size.
- CBOR root is a map with the same 175 keys in every file, regardless of format version. Module keys carry an
  index suffix (`Env0`..`3`, `LFO0`..`9`, `ModSlot0`..`63`, `Macro0`..`7`, `Oscillator0`..`4`, `VoiceFilter0`..`1`,
  `FXRack0`..`2`, `RoutingSlot0`..`6`, plus arp/clip modules).
- `plainParams` is `"default"` or a map of `kParam*` values. Values are numbers, or strings for menus
  (`kParamType: "MgL24"`, `"LadderAcid"`; `kParamWarpMenu: "kBendPos"`; `kParamNoiseType: "White"`).
- `version` is a float (7.0, 8.0, 9.0) in both the JSON header and the CBOR root.
- Init's filter type is MG Low 6 according to the Serum 2 User Guide (p. 139), matching the `MgL6` token.
- Factory wavetables are stored by path (`WTOsc0.relativePathToWT`, e.g. `"Analog/Sweep20.wav"`).
- User/embedded wavetables: `WTOsc.embeddedWTData` is a CBOR array of floats (14336 and 2048 samples in
  `TSP_S2PNJ_Lead_g_funk`), with `tableDisplayName`; the header gains the tag `"Embedded-Data"`.
- **"default" is not the same as Init.** Init's `Env0`..`3` carry non-default `kParamCurve1..3` (50, 66.6, 66.6).
  The M2 diff must compare against Init's values.
- Oscillators are nested: `Oscillator0..2` each contain `WTOsc`, `SampleOsc`, `MultiSampleOsc`, `GranularOsc`,
  `SpectralOsc` sub-modules with their own `plainParams`; `Oscillator3` holds `NoiseOsc3`, `Oscillator4` `SubOsc4`.
  Pitch/level/unison params live on the outer `OscillatorN`; table position and warp on the inner `WTOscN`.
- The root also holds non-module keys: un-suffixed UI-state entries (`Osc`, `WTOsc`, `Filter`, `SerumGUI`, ...
  with `kUIParam*` values), a copy of the header metadata, and `mpe*`, `lock*`, `scalars`. Exclude UI state from lessons.

Observed in the pack presets (structure is clear, meaning still needs probes):
- Enable flag: `kParamEnable: 1.0` appears on `Oscillator1/3/4` and `VoiceFilter0` when switched on. Osc A is on
  in Init without it, so the default of `kParamEnable` differs per module. How "Osc A switched off" is stored is unseen.
- FX rack: `FXRack0.FX` is an ordered array of `{ "<FXType>": { plainParams, ... }, "type": <int> }`.
  Seen types: 0 FXDistortion, 3 FXChorus, 4 FXDelay, 5 FXComp, 6 FXReverb, 7 FXEQ, 8 FXFilter, 13 FXSplit; also
  FXUtils and FXHyperD by name. Array order is presumably rack order (unverified).
- Mod matrix: `ModSlotN` = `{ source: [id, aux], destModuleTypeString, destModuleID, destModuleParamName,
  destModuleParamID, plainParams: { kParamAmount, kParamBipolar?, ... } }`. For FX destinations, `destModuleID`
  looks like the index into the `FX` array. Source ids are numeric; from macro names and targets, 25-32 look like
  Macro 1-8 (unverified). Other ids seen: 1, 3, 6, 7, 8, 29.
- Macros carry a `name`; LFOs carry `curveData` (`xVals`, `yVals`, `curveVals`, `numPoints`) for drawn shapes.
- Routing: `RoutingSlotN.plainParams.kParamRoutingDest` = `"kRoutingDestFilter"` / `"kRoutingDestDirect"`.

Still unverified:
- `version` as `{"value": n}` and negative zero: neither occurs in any fixture. Both are handled and covered by
  synthetic tests.
- Embedded sample audio (only embedded wavetables seen). Every raw-to-display conversion.

Out of scope: Serum 1 `.fxp` starts `CcnK`...`FPCh`...`XfsX` followed by zlib data. The decoder recognises
this and says so rather than reporting a corrupt file.

When a fixture confirms or contradicts a fact, update this list and cite the fixture file.

## How to work
One milestone at a time, each a quick demoable win. After each: stop, say in 2-3 sentences what works, how to
see it, and what is needed from the owner, then wait. Milestone specs live in `docs/milestones/`.

## Milestones
1. Drop a preset, see decoded JSON. Tests against every fixture.
2. "Active modules" view: diff against Init, hide defaults and disabled modules.
3. Display-value table for the ~40 most important params, each with a fixture test; list of unverified + probe presets.
4. Signal-flow graph and ordered step list, no AI.
5. LLM "why" per step as `{do, why, listen_for, param_refs}` + validator.
6. Difficulty toggle: one fact graph, three renderings.
7. Knowledge-cards folder, template, 3 example cards.
8. "Drop your attempt": compare against target, explain differences step by step.

## Status
All eight milestones have a first working version. The owner asked to build straight through, so the
stop-after-each-milestone rule was waived for milestones 2-8; it applies again to new work.

- M1 `src/format/` — container, zstd with size cap, CBOR, Zod.
- M2 `src/patch/` — module model, diff against the Init baseline, activity (active/disabled/unused).
- M3 `src/display/` — registry of 65 entries. **None verified.** `docs/PROBES.md` lists the probes to make.
- M4 `src/flow/` — facts, ordered steps, flow graph. No AI.
- M5 `src/lesson/` + `api/lesson.ts` — narrator call, validator, regenerate loop (3 attempts, then code-only).
  Exercised live by the owner on 12 Nov 2026 via the System check: passed, on the second attempt (the
  validator rejected the first reply and the regeneration loop recovered).
- M6 `src/lesson/render.ts` — beginner / intermediate / advanced from one fact graph.
- M7 `knowledge-cards/` — template + 3 cards. Steps without a card get no "why" by design.
- M8 `src/compare/` — attempt vs target, per step.

Added after the first eight milestones (owner asked for all four in one go):
- `src/flow/soundtype.ts` — rule-based sound-type guess with the settings that led to it. Shown as a guess.
- `src/flow/combos.ts` — "How it works together" stage: code detects combinations (detuned pair, macro-gated
  effects, mod wheel chain, envelope/LFO routes with a recognisable result, modulated modulators, glide) and
  states each as a fact; a card per pattern lets the narrator explain it. It never claims an artist's intent.
- `src/flow/diagrams.ts` + `src/ui/Diagrams.tsx` — envelope, drawn-LFO-shape and modulation-map diagrams,
  computed from stored values. Diagrams are always drawn by code, never by the narrator.
- `src/learn/course.ts` + `src/ui/LearnView.tsx` — ten-lesson beginner course. Each exercise is checked from the
  saved preset using stored values only. Progress lives in localStorage.
- `knowledge-cards/` — 36 cards (two, on filter shapes/slope and drive/key tracking, are used only by the practice lessons: empty `stages` and `applies_to` keep them out of rebuilt-patch steps), all `status: draft` (written by Claude, not yet reviewed by the owner). Change
  to `reviewed` after the owner has read one. Reading links were each loaded and title-checked in Nov 2026.
- `src/lesson/selftest.ts` + "System check" tab — one-click end-to-end test of the explanation service with a
  built-in step; reports in plain words where a failure is (network, password, API key, validator).
- **Serum 2 User Guide** (owner supplied the PDF, 354 pages). Used three ways:
  1. `src/display/registry.ts`: a `documented` status for names taken from the guide (filter types, warp modes,
     LFO types and modes, the filter Var knob's per-type name, OCT/SEM/FIN, ATK/DEC/SUS/REL). Shown with a
     "from the manual" badge. `documented` is not `verified`: rule 7 still needs the owner's on-screen check, and
     the link from stored token to guide name is by spelling.
  2. `docs/SERUM_EXTRAS.md` (track S, 50 lessons) and guide page references in each scripted lesson.
  3. `library/serum-2-user-guide.json`: the guide's text, page by page, for the guide's answers.
- **Ask the guide** — `api/ask.ts`, `src/library/` (BM25 search, cited answers), `src/ui/AskView.tsx`. Retrieves
  up to six passages (guide pages and knowledge cards), sends only those to Claude with citations enabled, and
  shows each claim's page and quoted words. Says "not in the library" instead of answering from memory.
  Exercised live by the owner on 12 Nov 2026: a correct, cited answer from pages 135, 136 and 142. It does not
  yet see the learner's patch or remember progress. The guide's text is extracted in reading order (plain
  `pdftotext`, not `-layout`) so table cells stay together; table-of-contents pages are dropped.
- **Practice synth and playable lessons** (first milestone of `docs/COURSE_PLAN.md`):
  - `src/synth/` — `params.ts` (one typed state object with exact units, plus the maths: note-to-Hz, beat rate,
    unison offsets, harmonic tables, generated wavetables, brightness), `engine.ts` (Web Audio: oscillator A
    with basic shapes or a generated wavetable, unison voices with detune and stereo spread, oscillator B, a
    sine sub, white/pink noise, start phase and random phase, master level, analyser, a guard compressor),
    `tracker.ts` (what the learner did since a step began), `useSynth.ts` (React hook, computer-keyboard notes).
    Phase is done by rotating each harmonic of the periodic wave, so two squares half a cycle apart cancel
    and two saws leave a saw an octave up, as on a real synth. Changing which sources exist (voices, B, sub,
    noise) restarts the sounding notes; everything else updates in place.
  - `src/course/` — `types.ts` (a lesson is data: steps with `show`, `check(snapshot)`, optional code-written
    `remark`), `lessons/index.ts` (C0.1-C0.4, C1.1, C1.2, C1.M) and `lessons/chapter1.ts` (C1.3-C1.8 and the
    checkpoint C1.C), `match.ts`, `progress.ts`. `lessons/chapter2.ts` holds the filter chapter (C2.1-C2.7 and the checkpoint C2.C).
    `lessons/chapter3.ts` holds the envelope chapter (C3.1 to C3.6 and the checkpoint C3.C; C3.3, on hold and
    the shape of the fall, was added once the envelopes had those controls).
    `lessons/chapter4.ts` holds the LFO chapter (C4.1 to C4.6 and the checkpoint C4.C).
    `lessons/chapter5.ts` holds the modulation chapter (C5.1, C5.2, C5.6 and the checkpoint C5.C; C5.3 velocity
    and key position, C5.4 macros and C5.5 scaling a route wait for those controls).
    C5.3 (velocity and key position) was added to chapter 5 once those sources existed.
    `lessons/macros.ts` holds the macro chapter (C5M.1 to C5M.8 and the checkpoint C5M.C): most are "recipes",
    a few lines of data each that `recipe()` turns into a full lesson. **The owner wants many macro
    combinations: add to `RECIPES`.** Chapter order is `CHAPTER_ORDER`, not the key order of `CHAPTERS`.
    `lessons/chapter6.ts` holds "Reshaping the wave" (C6.1 bend and mirror, C6.2 sync, C6.3 squeeze and pulse
    width, C6.4 FM, C6.5 ring modulation, and the checkpoint C6.C).
    `lessons/impacts.ts` holds the first impact lessons from `docs/IMPACTS.md` (ids CT.1 to CT.6 and CT.C,
    chapter "Impacts": the start of a note, the kick as a falling pitch, how far and how fast it falls, sub
    drops, a bass note as a hit, pitch at the front, and a by-ear checkpoint). They needed one new
    destination, "Osc A pitch, wide" (`aPitchWide`, four octaves at 100%; it has no knob, so no ring).
    Measured: at 25% a 440 Hz note started near 880 Hz and landed on 440; at 50%, near 1760 Hz.
    `lessons/chapter7.ts` holds "Effects" (C7.1 distortion, C7.2 EQ, C7.3 compression, C7.4 chorus, C7.5
    delay, C7.6 reverb, and the checkpoint C7.C), listed between "Reshaping the wave" and "Impacts".
    C5.4, "The matrix: one source, several places", was added to chapter 5 once the matrix could be edited.
    Eight more macro recipes (C5M.9 to C5M.16, `MORE_RECIPES`, listed after "Two macros on one sound") use the
    effects, warp, FM and the wide pitch destination: Space, Throw, Heat, Tear, Growl, Squash, Shimmer, Knock.
    C5.5 ("Setting depth on the knob itself") and C5.7 ("Any knob can be a destination") were added to chapter 5
    with the depth handles and the wider destination list.
    C5.8 ("Drag a source onto a knob") was added with drag-and-drop.
    `lessons/chapter8.ts` holds "Playing a line" (C8.1 one note at a time, C8.2 glide, C8.3 the bend and mod wheels), listed between
    "Effects" and "Impacts".
    C5.9 ("One source scaling another") was added to chapter 5 with the matrix's Scaled by column.
    C1.9 ("Left and right, and a second wavetable") was added to chapter 1 with pan and Osc B's wavetable.
    **130 playable lessons** (122 on 15 Nov 2026; eight more, the chapter "Reading your tools", on 20 Nov 2026: see "Lessons from the literature begin").
  - `src/ui/PlayView.tsx` ("Lessons" tab) and `src/ui/synth/` — spotlighted controls per step, live targets,
    scope, spectrum, meter, on-screen keyboard, Hold, blind ear checks, recap, guide remarks and suggestion.
  - "Hear it first" demos (`demo` on a lesson), match-by-ear rounds (`rounds`, compared by `src/course/match.ts`:
    feedback is "matches / too low / too high / different", never the target's numbers), and a browser
    read-aloud button. Lesson C1.M is a four-round match-by-ear challenge. Seven lessons in total.
  - Verified in a headless browser with real audio: a 12 dB volume change moves the meter 12 dB; the square
    wave shows odd harmonics on the spectrum; two squares half a cycle apart drop about 15 dB; the beat-rate
    readout doubles an octave up. Level readings need about a second to settle in automated checks.
    **How it sounds has not been judged by a person yet.**
  - **Filter (chapter 2, added 13 Nov 2026).** `src/synth/filter.ts` is the filter as pure maths: low-pass,
    high-pass, band-pass and notch; cutoff; resonance (0-100% maps to Q 0.707-40, with a level trim on
    low/high-pass so the body drops as the peak grows); gentle (12) or steep (24 dB/oct) slope as one or two
    two-pole stages; drive (a soft clip before the filter, straight line at 0); key tracking pivoting on
    middle C. The engine builds every note's filter from `filterStages`, and `FilterCurve` in
    `src/ui/synth/Views.tsx` draws from the same functions, with the live spectrum faint behind it and a dot
    that drags (sideways cutoff, up/down resonance; sets the `curve` flag lessons can check). The chain is
    always in the signal path; "off" is two pass-everything stages and a straight drive curve, so switching it
    does not restart notes. Browsers read Q in dB for low/high-pass and as a plain number for band/notch.
    Oscillator A gained a level control (`aLevelDb`). Match-by-ear judges cutoff in octaves (0.4 either way).
    Measured in a headless browser: at eleven harmonics the output matched the drawn curve within 0.1 dB for
    every type, both slopes, resonance and key tracking, and filter-off was unchanged from before. To measure
    the analyser, set its smoothing to 0 and average several reads: smoothing is applied per read, not per second.
    The filter does not truly self-oscillate: C2.7 feeds it noise and says so. No ear checks for chapter 2 yet.
  - **Views on demand (13 Nov 2026).** A "Show:" row in the lesson synth lets the learner switch the scope,
    spectrum, spectrogram (new: the spectrum scrolling over time), level meter and filter curve on at any
    step; the choice is remembered in the browser. Hidden during match-by-ear, where seeing the target would
    defeat the exercise. The views only need the engine's analyser, so the later mini DAW can reuse them.
  - **Rack layout and knobs (13 Nov 2026, owner's request).** The owner asked for the synth to be laid out as
    much like Serum as possible, with knobs. `src/ui/synth/Rack.tsx` draws module panels in Serum's left-to-right
    order (Sub, Osc A, Osc B, Noise, Filter), each with its on/off switch and name on top, a picture (the wave
    computed from its harmonics, or the filter curve), then choices, number boxes and knobs; main volume and the
    level meter sit top right; views and the keyboard are below. **Only the arrangement follows Serum. The look
    stays our own patchwork skin**: no Serum colours, artwork, fonts or name (rule 4 and the "never imitate
    Serum's interface" decision are read as covering appearance; the owner has now explicitly asked for the
    arrangement). In a lesson step only the panels and controls that step needs appear, larger; "Show the whole
    synth" gives the full rack. `Control` in `Controls.tsx` renders every numeric setting as a knob (or a number
    box for octave, semitone, voices): drag up/down to turn (Shift = fine), click then arrow keys for exact
    steps (Shift or Page Up/Down = ten steps; cutoff moves about 1% per press), Home/End, double-click to reset.
    Knobs are `role="slider"` elements, not inputs, so computer-keyboard notes still play while one has focus.
    Labels drop the module prefix ("B level" shows as LEVEL inside the Osc B panel).
  - **Envelopes, LFOs and neon rings (13 Nov 2026, owner's request).** `src/synth/mod.ts` holds the sources
    and their maths. Envelope 1 always shapes each note's level (attack, decay, sustain, release; the defaults
    keep the old instant on/off behaviour). Envelope 2 and LFOs 1-3 each have a "sends to" menu (filter cutoff,
    Osc A or B pitch, the four source levels; one destination each) and a -100..100% amount; at 100% cutoff
    moves 5 octaves, pitch 12 semitones, a level between silence and double. LFOs restart with each note.
    Changing a destination restarts sounding notes; everything else updates in place. Each source has a neon
    colour (Env 2 yellow, LFO 1 cyan, LFO 2 green, LFO 3 orange; Env 1 pink): its panel is lit in it, and any
    knob it moves wears a glowing ring of that colour showing the stretch it sweeps (`ringSpan`), one ring per
    source. Panels sit in a row under the oscillators and filter, as in Serum. Measured in a headless browser:
    attack/decay/sustain/release shape the level as set, a 4 Hz LFO on level gives 4 swells a second, and
    LFOs and Env 2 move pitch and cutoff. (A square LFO first measured about 85% of the set depth; fixed later, see the modulation chapter.) Not done: wavetable position and resonance as destinations, more than
    one destination per source, drag-to-assign, tempo sync, and any lessons (chapters 3-5 are not scripted).
  - **Synth skin (13 Nov 2026).** The synth is a velvet-black instrument in both colour schemes (variables are
    re-scoped on `.synth`): fabric name patches on the module headers with the name on a solid tab, neon-pink
    lines and value rings, dashed stitching. CSS only; no new artwork.
  - **Skin switch and octave keys (13 Nov 2026).** A "Skin: on/off" button in the synth's "Show:" row puts the
    class `plain` on `.synth`; the whole skin is one nested block under `.synth:not(.plain)` in `skin.css`, so
    anything that must work without the skin goes outside that block. Z and X move the computer keyboard down
    and up an octave (three either way); each held letter remembers the note it started, so nothing sticks.
  - **Envelope chapter (13 Nov 2026).** `EnvCurve` in `Views.tsx` is a draggable envelope (panels `envelope`
    and `envelope2`; sets the flag of the same name): the first point is attack, the second decay and sustain,
    the last release. Each stage's width follows its knob's travel, so it shows shape and order, not seconds,
    and its caption says so. Envelope lessons strike notes and do not use Hold, so the snapshot gained
    `longestHeld` (a "hold for two seconds" step must still count after the key is let go). Match-by-ear
    judges times and rates as ratios (within double or half). No blind ear checks for chapter 3 yet.
  - **LFO chapter (13 Nov 2026).** LFO lessons use Hold. An LFO panel shows its shape whenever its controls
    are on screen. In match-by-ear, a sound with an LFO plays for 2.8 s so its movement can be heard.
  - **Modulation chapter (13 Nov 2026).** Each LFO has a direction switch (`lfoNWay`: both ways, or one way,
    which squeezes the swing to half and lifts it so it runs from the knob to the full depth; `Route.oneWay`
    also covers envelopes and drives the ring's shape). "LFO 1 rate" is a destination (two octaves of speed at
    100%, through the LFO oscillator's detune), so sources are all created before any are connected. **LFO
    shapes are now built from their harmonics with the browser's scaling off** (`setLfoShape`): the built-in
    square reached only about 86% depth, which put a one-way trill out of tune. Measured after the change:
    both ways 220/880 Hz and one way 440/880 Hz on a 440 Hz note at 100%, saw and triangle full range, and a
    4 Hz tremolo driven one octave each way by a square LFO gave about 8 then 2 swells a second.
  - **Macros, velocity, key position, matrix view (13 Nov 2026, owner's request).**
    `src/synth/macros.ts`: four macros, each a 0-100 knob with a name and three slots (destination + amount).
    A destination is any continuous knob (`MACRO_DESTS`; not number boxes, not other macros). A macro is not
    an audio signal: `applyMacros(state)` adds each slot's push (macro position x amount, as a fraction of the
    destination knob's travel) to the settings, and **the engine plays the settings after macros** (it calls
    `applyMacros` itself in its constructor, `update` and `auditionPatch`). Knobs keep showing where the
    learner left them, with a dim ring for a macro's reach, a bright part for how far it is turned, and a dot
    at the played position; `synth.effective` is the after-macros state, used by the pictures. Lesson checks
    read `s.state` (the knobs as left) and call `applyMacros` when they need the played values.
    Velocity (1-127; from how low a key is clicked, or the C and V keys for the letter keys) and key position
    (-1..1 around middle C) are sources fixed for the length of a note, with one destination each like the
    others. "Note level" is a destination for all sources (a gain after the envelope; a positive one-way
    amount lowers the starting level so soft notes are quieter and the hardest is full level).
    `Matrix` in `Views.tsx` (a "Matrix" toggle in the Show row) lists every route and macro slot; it is
    read-only. **The owner wants a full editable Matrix tab later.** Measured: velocity 32/64/127 to Note
    level at 100% gave -12/-6/0 dB; a macro slot of 20% on cutoff moved a resonant whistle 500/1000/2000 Hz
    at 0/50/100%; key position at 40% on cutoff gave two octaves at the top key.
  - **Envelope hold and fall (13 Nov 2026).** Both envelopes have Hold (0-2000 ms at full level after the
    attack) and Fall (`envBend`: straight, eased or sharp; one setting for decay and release). `fallShape` and
    `fallConstant` in `mod.ts` are the single definition; the engine's `scheduleEnvelope` and
    `scheduleRelease`, `envLevel` and the envelope drawing all use them. A straight release needs the
    browser's "cancel and hold"; without it the release eases. Measured: halfway through a 1 s decay the
    level was 0.55 / 0.17 / 0.016 of full for straight / eased / sharp, and a 600 ms hold stayed at full level.
    When measuring envelope levels, compare against a separately measured steady note, not a reading taken
    just after the note starts (the analyser lags).
  - **Tempo, click and the rest of the LFO (13 Nov 2026).** `bpm` and `clickOn` (Master). The click is
    scheduled from the audio clock's zero (beat k is at k x 60/bpm) and goes to the speakers through
    `engine.clickBus`, not through the analyser, so views show only the synth. Per LFO: speed in Hz or beats
    (`lfoNSync`, `lfoNDiv`; `lfoHz` in `mod.ts`), Restart or Free (`lfoNTrig`; Free starts each note's LFO at
    the phase the clock has reached, by rotating its harmonics, so a synced free LFO turns over on the click),
    Rise (a fade-in through a `fade` gain every source now passes through), and a "drawn" shape of sixteen
    steps (`lfoNSteps`, an array replaced on every edit; `LfoDraw` in `Rack.tsx`). `lfoCoefficients` gives
    every shape's harmonics; a drawn shape's average is added through the bias source because an oscillator
    cannot carry it. Measured: synced speeds 2, 4 and 4.5 a second at 120 bpm/1 beat, 120/half, 90/third; a
    drawn shape on pitch gave 883 and 312 Hz for steps of +1 and -0.5; a free square LFO was high in the
    first half of each clock second and low in the second; six clicks in three seconds at 120 bpm.
    Not built: Serum's ENVELOPE mode (play the shape once), Delay, smooth drawn curves.
  - **Warp, FM and ring modulation (13 Nov 2026).** Osc A has a Warp menu (Bend, Mirror, Sync, Squeeze) and
    amount: `warpPhase` in `params.ts` says where in the wave to read, and `spectrumA` draws one cycle, reads
    it through the warp and measures it again as 64 harmonics (sine and cosine parts), so warp is a new
    wavetable, updated in place. Every note also has a silent copy of oscillator B (`modB`), whether or not B
    is heard: "FM from B" scales it into A's frequency (100% is an index of 8, `fmIndex`) and "Ring from B"
    crossfades A with A times B. "FM from B" is a destination for sources (100% covers half the knob); warp
    amount and ring amount can be moved by macros only. Measured: ring at 100% with sines left only the sum
    and difference, each 6 dB under the lone note; FM at an index of 2.4 removed the played frequency (52 dB
    down) and at an index of 1 gave the expected sideband levels; sync at 100% played a sine at four times
    the pitch and at 33% at twice; a fully mirrored saw had odd harmonics only.
    Not built: warp amount and ring amount as source destinations, B shaken by A, Serum's other warp modes.
  - **Effects rack (13 Nov 2026).** `src/synth/fx.ts`: distortion (soft clip, hard clip, fold, crush; drive,
    mix), a three-band EQ (shelves at 150 Hz and 5 kHz, a movable middle band), a compressor (threshold,
    ratio, attack, release, make-up, and a live "Turning down by" meter), chorus, delay (ms or beats,
    feedback) and reverb (generated noise impulse; size is the time to fall 60 dB). Fixed order, after the
    notes and before the main volume, shared by all notes; every effect is always in the path and "off" turns
    its own signal down, so switching never restarts notes. The first half of the file is pure maths shared
    with tests; `FxChain` is the audio. **The browser's compressor adds its own make-up gain** (0.6 of the
    reduction a full-level signal would get); `compAutoMakeupCancelDb` cancels it, with the knee at 0.
    `auditionPatch` sets the shared effects to the patch's for the length of the sound and hands them back
    0.7 s after it ends (`fxRestore`), so demos and match-by-ear targets can have their own effects.
    Shown as a third rack row (`FX_MODULES`). All effect knobs are macro destinations; none is a source
    destination yet. Measured: effects off left the level unchanged; hard clip added odd harmonics; EQ mid
    +12 dB gave +12 dB; compressor output fell by the meter's reading (6.4 and 26.8 dB) and make-up of 12 dB
    gave 12 dB back; a 300 ms delay at 50% feedback echoed about 6 dB down each time; reverb tails fell at
    roughly 60 dB per "size". Not built: reordering, sidechain/ducking, multiband, effects as modulation
    destinations, more reverb controls.
  - **Editable matrix (13 Nov 2026, owner's request).** `Matrix` in `Views.tsx` (the "Matrix" toggle in the
    Show row, and the `matrix` panel a lesson step can show) is now a table you edit: each source's own
    connection (the same settings as its panel), then up to eight extra rows (`state.matrix`, an array of
    `{ source, dest, amount, way }` replaced on every edit) that send a source somewhere else as well. Rows
    can be added and removed; macro slots are listed read-only. `routes()` returns both kinds, each with a
    `key` (the source id, or `m0`, `m1`...), and `routeLayout` says when sounding notes must be rebuilt (a
    connection appears, moves or goes; never for an amount). Editing in the matrix sets the `matrix` flag.
    Measured: a square LFO with its own route on level and a matrix row on pitch moved both together
    (883/215 Hz with the level swing); halving the row's amount in place halved the pitch swing; removing
    the row left the level route alone. Its labels start "Matrix:" so they do not clash with the knobs'.
  - **Any knob as a destination, and depth handles (14 Nov 2026, owner's request after a friend tried the
    LFOs).** Two kinds of destination now. `FAST_DESTS` (the original list) are moved inside the audio, per
    note, smooth at any speed. `SLOW_DESTS` is every other continuous knob (not number boxes, main volume,
    tempo, random phase or reverb size): `slowModulate` in `mod.ts` works out each source's value for the
    most recently played note (`sourceValue`: shape, start phase, rise, one way, envelope, velocity, key) and
    pushes the knob by amount/200 of its travel, the same stretch the ring shows. The engine keeps `base`
    (after macros) and `state` (what is playing) and a 20 ms timer (`tick`) re-renders when a slow
    connection is in use; with no note held everything returns to the knobs. Auditioned patches are kept
    moving the same way (`auditions`). The per-note update was split out as `applyVoice`. `MOD_DESTS` is now
    a plain string list (`Dest` is `string`), menus are grouped (`DestOptions`: "Smoothest" first, then by
    panel), and `spectrumA` caches many warp amounts so a moving warp does not recompute.
    **Depth handles:** every knob wears a small dot per connection that targets it (`DepthHandle` in
    `Controls.tsx`), in the source's colour; drag it or use the arrow keys to set that connection's amount
    (`withRouteAmount`, which also handles matrix rows), double-click for zero; the readout under the knob
    shows the amount while a handle has focus; using one sets the `depth` flag. A handle stays when its amount
    is zero (so it can be dragged through zero) although the ring goes.
    Measured: a square LFO on ring amount alternated sidebands-only and note-only; on warp (sync) it
    alternated 440 and 1760 Hz, one way 440 and a 2.5-times read; Envelope 2 on EQ mid gave +18 dB at the
    start and 0 later; an LFO on another LFO's amount switched a trill on and off; an auditioned patch moved
    the same and the learner's own settings came back afterwards.
    Limits to keep in mind: slow destinations follow one note (the last played), step every 20 ms (grainy
    with very fast LFOs), and a source's rate being moved by another source is not followed by the slow path.
  - **Compact whole synth, pages, Serum-style macros, drag-and-drop (14 Nov 2026, owner's request).** The
    whole-synth view (`all` in `Rack`, class `whole` on `.synth`) went from about 3,800 px tall to about
    1,000. It has three pages chosen by tabs at the top, as Serum has: **Synth** (sources row, then a row
    of a small **Macros** block at the bottom left, an Envelopes panel with Env 1 / Env 2 tabs, an LFOs
    panel with LFO 1-3 tabs, and a "from the keys" panel with Vel / Key tabs), **FX** (the effects row) and
    **Matrix**. Views (scope, spectrum, spectrogram, matrix) no longer all open by themselves in the whole
    synth: they open from the Show row. `MacroGrid` is a 2 by 2 block of small knobs, each with its name
    (click it to open that macro's name and slots underneath) and a drag handle. Lesson steps are unchanged:
    they still show only the panels a step needs, large, with the old `MacroPanel`.
    **Drag-and-drop:** every source has a `Grip` (the ✥ handle: on its panel header in a step, on its tab in
    the whole synth, on each macro). Dropping it on a knob calls `connect` in `src/synth/connect.ts`: a
    source's own connection is used first, later drops add matrix rows, a macro takes its next free slot;
    knobs that cannot be destinations, a knob already connected, a full matrix or a full macro refuse, and
    the knob says why while the source is over it (green outline for yes, red for no). A drop sets the
    `dropped` flag. The tabs holding grips are `div role="tab"`, not buttons: browsers will not start a drag
    from inside a button. HTML drag-and-drop does not work on touch screens. In automated tests, move the
    mouse in steps with short waits and keep both ends on screen; Playwright's `dragTo` was unreliable here.
  - **Pitch reports from the owner, and an Osc A switch (14 Nov 2026).** The owner said Z/X, octave and
    semitone "aren't working". Measured through the real page they do change pitch, so nothing was broken in
    the engine; what was fixed is everything that made it look broken: Z and X now move a note that is
    already sounding (latched with Hold, or a letter still held) instead of waiting for the next key; they
    also move the on-screen keyboard, so clicks follow the octave and the lit key stays in view; letter keys
    and Z/X work while a menu still has focus (they used to be swallowed); number boxes (octave, semitone,
    voices) step with a plain click, right half up and left half down, as well as by dragging; and the one
    fixed-frequency lesson ("Pitch is speed") says under the keyboard that keys, octave and semitone do not
    change the note there. **If the owner still reports it, ask which lesson and whether Hold was on.**
    `aOn` switches oscillator A's sound off (its level goes to zero, nothing restarts; it can still be shaken
    by FM). In development the engine is on `window.__patchwalkEngine` so tests can listen to the real page.
  - **Seeing the movement (14 Nov 2026, owner's request).** `modulated(state, note, true)` in `mod.ts` gives
    the settings with every connection that lands on a knob applied for this instant (fast ones too; the
    audio never uses it). `synth.live()` returns it for the note sounding now (`engine.liveNote`), worked
    out at most once a frame. Three things draw from it: `FilterCurve` (so the curve and its dot move with
    an LFO or envelope), `LivePointer` on any knob a source is moving (a coloured pointer and dot that
    follow the movement, drawn straight onto the page each frame; the knob's own pointer stays where it was
    left), and `Playhead` on each LFO's picture (a line showing where in its cycle it is). All stop when no
    note sounds. Pitch knobs follow the ring's convention (amount/200 of travel), not literal cents.
    "Draw your own shape" under an LFO's picture turns the current shape into sixteen draggable bars (the
    Drawn shape, which already existed). In the one fixed-frequency lesson the Osc A panel now says its
    pitch is pinned and offers "Follow the keys instead": the owner had reported that B's pitch controls
    worked and A's did not, which is exactly that lesson's whole-synth view.
  - **Second pass on the skin, and motion (14 Nov 2026, owner's request).** A second block at the end of
    `skin.css` (still under `.synth:not(.plain)`): knobs gained a metal rim, a domed cap and a highlight
    (two gradients defined once in a hidden `<svg>` in `SynthPanel`, plus `knob-rim` and `knob-shine` in
    each knob); panels are bevelled; the wave pictures sit on a faint grid; the page tabs, the six effects
    and the Matrix page wear the same fabric name patches as the oscillators (`matrix-head`); an effect
    that is switched on has a lit edge; the keyboard has depth. **Motion**: `SynthPanel` sets `--level` (0
    to 1, from the output's peak, up at once and down gently) on the synth about twenty times a second, and
    the CSS uses it for a glow that follows the sound; the fabric drifts slowly, the stitched outline
    breathes, a sheen crosses an effect that is on, a page arrives with a small lift. A "Motion: on/off"
    button sits beside "Skin" (class `still`, remembered in the browser); all motion is also off when the
    system asks for reduced motion, and with the skin off. CSS and two gradients only; no new artwork.
  - **Mono, legato and glide (14 Nov 2026; first item of `docs/SERUM_GAPS.md`).** A Voicing panel (its own
    panel in a lesson step; the "Voice" tab beside Vel and Key in the whole synth): `voiceMode` (poly/mono),
    `legato`, `glide` (0-2000 ms) and `glideMode` (every note, or only notes pressed while another sounds).
    In mono the engine keeps a stack of held keys, so letting one go falls back to the one before. Glide is
    one constant source per note, in cents, wired to the detune of every oscillator of that note; it starts
    at the distance from the previous note and runs straight down to zero, so it never fights the frequency
    updates. Legato moves the sounding note (`moveVoice`) without touching its envelopes. With Hold on in
    mono the engine does the replacing (`latch`), so legato and glide still work. A demo tone can carry
    `from` (the note it slides from). Glide can be moved by a macro, not by a source. Measured: poly held
    two notes, mono one; mono fell back from 880 to 440 Hz when the upper key was let go; a 1 s glide from
    440 to 880 read 474, 544, 624, 716, 824, 877 Hz at 0.2 s steps; on "overlapped notes" a separated note
    did not slide and an overlapped one did; with a slow attack a new key dipped the level without legato
    and did not with it. Not built: glide curve, glide scaled by distance, a note limit, legato for LFOs
    on slow destinations.
  - **Wheels and MIDI keyboard (14 Nov 2026; second item of `docs/SERUM_GAPS.md`).** Two wheels sit at the
    left of the on-screen keyboard (`Wheel` in `Controls.tsx`; shown in the whole synth, or in a step that
    lists the `wheels` panel). **Bend** springs back and is not a setting: `synth.setBend(-1..1)` drives one
    engine-wide constant source in cents wired to every oscillator's detune (`engine.setBend`); `bendRange`
    (1-24 semitones, a number box in Voicing) sets its reach; pushing it to either end sets the `bentUp` /
    `bentDown` flags for lessons. **Mod** is the setting `wheel` (0-100) and a source (`wheel` in `SOURCES`,
    kind "note", one way, blue): its own destination and amount, matrix rows, drag-and-drop, like velocity,
    except that it moves while a note sounds (`applyVoice` updates its constant source). Neither `wheel` nor
    `bendRange` can be a destination for sources. "Connect a MIDI keyboard" under the keys asks the browser
    for MIDI (Chrome and Edge): notes with velocity, controller 1 to the mod wheel, pitch bend to the bend
    wheel (`midiMessage` in `useSynth.ts` is the pure reader; a keyboard plugged in later is picked up).
    Measured: bend at range 2 gave 495 and 393 Hz on a 441 Hz note, at range 12 gave 877 and 221; the wheel
    on Osc A pitch at 100% gave 441, 624, 877 Hz at 0, 50, 100%; the wheel on LFO 1's amount took a trill
    from nothing to its full depth; stand-in MIDI messages played a note, bent it and moved the wheel.
    **Not tried with a real MIDI keyboard** (the build session has none). Not built: aftertouch, sustain
    pedal, MIDI learn, separate bend ranges up and down, pitch bend as a source.
  - **Wave pictures follow the movement; more motion (14 Nov 2026, owner's request).** `Display` in
    `Rack.tsx` redraws the Osc A and Osc B pictures each frame from `synth.live()` while a note sounds, so
    an LFO, envelope, wheel or macro on wavetable position, warp amount, phase or shape is seen as well as
    heard; they return to the settings when the note stops. Checked in a browser: the picture changed
    continuously with an LFO on position, on warp amount and on phase, and stayed still with it on cutoff.
    Under "Connect a MIDI keyboard" a "How to connect one" section gives the steps and what to try if
    nothing happens. Motion added to the skin (all under the Motion switch): `StitchThread` in `Views.tsx`,
    a line of stitches across the top of the synth sewn into the shape of the sound, with a needle at its
    end (never drawn during match-by-ear, where it would give the target away); a band of coloured light
    orbiting the instrument's edge, brighter with level; a connected LFO's panel pulsing once per turn of
    that LFO (`--period` on the panel); knob rims that turn while held or while a source moves them; keys
    that flash and send up a ring when struck; name patches that swell with the sound.
  - **A row scaled by a second source (14 Nov 2026; Serum's AUX SOURCE, third item of `docs/SERUM_GAPS.md`).**
    A matrix row can carry `aux` (a source id): the "Scaled by" column. The second source is read as 0 to 1
    (`auxValue` in `mod.ts`: an LFO from its lowest point to its highest, key position from the bottom of
    its range to the top) and multiplies what the row sends. For fast destinations the engine puts a gate
    (a gain) after the row's `fade` and the second source drives the gate's gain (`makeSource` builds either
    kind of source; an LFO is halved and lifted); for slow destinations `modulated` multiplies. A source's
    own connection cannot be scaled, only matrix rows; changing the scaler rebuilds sounding notes
    (`routeLayout` includes it). Measured: a square LFO on pitch at 100% scaled by the wheel gave no
    movement, half an octave and a full octave each way at 0, 50 and 100%; scaled by velocity 32 it gave a
    quarter of the depth; scaled by Envelope 2 with a 3 s attack the depth grew over the note; scaled by a
    slow square LFO it switched on and off. The knob's ring still shows the row's full amount.
  - **Pan, and a wavetable for Osc B (14 Nov 2026; part of the fourth item of `docs/SERUM_GAPS.md`).**
    `aPan` and `bPan` (-100 to 100): A's pan is added to each unison voice's place and kept within the two
    sides (`panOf`); B has its own panner. `bTable` and `bPosition` give B the same generated wavetables as A
    (`harmonicsB`), and the silent copy of B used for FM and ring follows them too. All four are ordinary
    knobs, so sources and macros can move them, and B's picture follows live. Measured with a left and a
    right analyser: pan at 100 or -100 left the other side silent, -50 put A 7 dB louder on the left; B on
    Bright sweep went from one harmonic to twenty across its position, and an LFO on B's position moved it.
    Still missing on B: unison, warp, and FM or ring from A; there is no Osc C.
  - Not built yet: drag-and-drop on touch screens, reordering effects. **Owner's order (13 Nov 2026), after
    warp/FM/ring which is done: the first impact lessons (they need nothing new); then physical modelling
    and bioacoustics.**
  - The old ten Serum-task lessons are now the "Serum tasks" tab.
- **Pictures and lesson links in answers (13 Nov 2026, owner's rule).** When the guide cites a page that has
  pictures, the pictures are shown with the answer **every time**: code attaches them (`images` on a passage,
  read from `library/images/<book>/index.json` in `api/ask.ts`; pictures under 300 by 120 are treated as icons
  and left out; at most three per cited page, largest first), the model does not choose. They are served by
  `api/image.ts`, behind the same password check, by exact file name only; they are still never bundled into
  the browser build. Under each answer, `src/course/related.ts` (code, not the model) offers up to two practice
  lessons whose subject matches the question; clicking one opens it. Not yet verified on the live site: that
  Vercel packages `library/images/**` with the image function (`vercel.json`).
- **"Show me where" (13 Nov 2026, owner's request).** Each picture in an answer has a "Show me where" link:
  `api/point.ts` sends that one picture, its page's text and the question to Claude (vision, structured
  output) and gets back up to five boxes with labels; `cleanMarks` in `src/library/point.ts` clamps and
  filters them; `SourceImage` in `Answer.tsx` draws numbered boxes over the picture and lists the labels,
  with a note that they are the guide's pointing, not the manual's. One paid call per click; nothing is
  cached. **Not yet run against the real API** (no key in the build session): the drawing was checked in a
  browser with a stand-in reply, so how well the model aims is unknown until the owner tries it.
- **Conversations, side notes and saved chats (14 Nov 2026, owner's request).** The Ask tab is a thread: a
  follow-up is sent with the last four finished turns as plain text (`history` on the request, `historyOf` in
  `src/guide/ask.ts`), and the search includes the previous question. The earlier turns are context only: the
  model is told they are not a source and must still answer from the documents. The model is asked to put
  anything that is not part of the steps last, in a paragraph beginning "Side note:"; `toParagraphs` in
  `src/library/answer.ts` splits the answer at blank lines and marks that paragraph, and `Answer.tsx` boxes
  and labels it. "Save this chat" keeps a conversation in the browser's localStorage (`src/guide/chats.ts`,
  key `patchwalk.chats.v1`, newest first, at most 60, per browser, never sent anywhere); saved chats can be
  reopened, continued, saved again and deleted. The model is also told to bring passages from different
  books into one answer and say which book each part comes from. Checked in a browser with a stand-in reply;
  **not yet run against the real API**, so whether the model reliably writes "Side note:" is unconfirmed.
  The owner's direction for the guide: answers synthesised across many texts, walkthroughs with marked-up
  screenshots, follow-up questions, saved chats. Still to do for that: marks drawn automatically on a
  walkthrough's pictures (today "Show me where" is a click per picture), and search that copes with many
  books (BM25 over pages may need chunking or reranking once the library grows).
- **Guide polish after the owner's review (14 Nov 2026).** (1) Headings: the model may write "## Heading" on
  its own line (and numbered steps); `withHeading` in `answer.ts` lifts a heading, or a bold lead-in, out of a
  paragraph and `Answer.tsx` shows it as a heading. (2) "Show me where" is now a visible button under each
  picture; the reply also carries `about` (what the picture shows, and what the manual's own printed numbers
  mean, from the page text); marks are lettered A, B, C because manuals print numbers on pictures, and drawn in cyan because
  manuals (Serum's at least) draw their own boxes and numbers in red; the
  answer's text is sent along so marks can follow its steps ("Step 2: ..."). The owner found a cited
  picture with the manual's 1-5 callouts confusing because nothing explained it: `about` is the fix, at the
  cost of a click. (3) Memory on the device (`src/guide/cache.ts`, localStorage, 30 days, 200 entries): the
  first question of a chat that was answered before is shown again with no call ("Ask again fresh" asks
  anew), and a picture already marked for the same question is shown again ("Look again"). Follow-ups are
  never served from memory. This is per browser; sharing it between people needs a database. (4) A version
  stamp at the bottom of every page (`__BUILD__`, commit and build time) so the owner can tell which build
  is live. **The owner ran "Show me where" live on 14 Nov 2026**: asked how to assign an LFO, it boxed the
  LFO 2 tab on the guide's page-188 picture, which is the right control. One sample; aim elsewhere is untested.
  **Open with the owner:** a database (shared answer and picture memory, logins or a "who's playing" picker,
  per-person keys), and a search upgrade once more books are in (plan given: split pages into passages,
  widen the keyword search, then have a small model pick the best passages).
- **Database, "Who's playing?", shared memory, own keys (14 Nov 2026, owner's request).** The owner connected
  an Upstash Redis store to the Vercel project (free plan). `src/store/kv.ts` talks to it over its REST API
  with plain `fetch` (no new dependency), finding the settings under `KV_REST_API_URL`/`_TOKEN`,
  `UPSTASH_REDIS_REST_URL`/`_TOKEN`, or a custom prefix. **Everything works without it**: no store, or one
  that fails, means the app behaves as before. Server files under `src/store/` use `.js` import suffixes.
  - **Accounts (14 Nov 2026, owner's instruction: "nobody can use my credits whatsoever unless its me under
    my name", and an email and password for each user). This replaced the "Who's playing?" name picker.**
    `src/store/accounts.ts` holds the rules, `api/account.ts` the endpoint, `src/guide/sync.ts` the browser
    side, `src/ui/Account.tsx` the screens (`SignInGate`, `AccountBar`). Everyone signs up with a name, an
    email and a password (8 or more characters); the page shows nothing but the sign-in screen until then.
    Passwords are stored only as a salted scrypt hash; a session is a random token in an HttpOnly cookie
    (`pw_session`, 30 days), and the database holds only a hash of it; eight wrong passwords lock an email
    for fifteen minutes; at most 12 accounts. Keys: `pw:accounts` (list), `pw:acct:<id>` (hash),
    `pw:a:<id>` (finished lessons and saved chats), `pw:sess:<hash>`. The old `pw:players` and `pw:p:*`
    keys are no longer read.
    **Who pays (`payer`, called by `api/ask.ts`, `api/point.ts` and `api/lesson.ts`): a signed-in person's
    own key if they sent one; the site's key only for the account whose email equals the `OWNER_EMAIL`
    environment variable; anyone else is refused (402 `needs-key`), and so is anyone not signed in, even
    with a key.** It fails closed: `OWNER_EMAIL` unset means nobody is the owner; on Vercel with no
    database, or with the database unreachable, every paid call is refused. Never weaken this. Off Vercel
    with no database (local development) there are no accounts and the local key is used.
    Emails are not verified (the site sends no mail), so the owner must make their own account before or
    right after setting `OWNER_EMAIL` and check that the Account panel says "owner". **Forgot password (same day, owner's request):** `forgot` emails
    a link (`/?reset=<token>`, one use, 30 minutes, only a hash stored, at most one mail per address every
    two minutes, the same answer whether or not the address has an account) and `recover` sets the new
    password and signs in. It needs a mail service the owner signs up for: `src/store/mail.ts` understands
    Resend (`RESEND_API_KEY`) or Brevo (`BREVO_API_KEY`), plus `MAIL_FROM` (a sender address that service
    has approved). Without those the button says to ask the owner. **Not yet sent through a real mail
    service** (checked in a browser with a stand-in for it). Either way the owner can set a new password for someone from the Account panel (which lists
    everyone, for the owner only) or removes them; anyone can change their own password or delete their
    account. Work already in a browser from before accounts is kept under the account made or signed into
    there; a browser holding one account's things never hands them to another (`enter` in `sync.ts`).
    A person without a key who is not the owner sees a panel explaining that the guide needs their own
    key, with the steps (`KeySteps`); lessons and the synth need no key.
    Checked end to end in a browser against the real endpoints with a stand-in database: signed out, the
    guide answered 401; a friend's account got 402; the owner's account reached Claude. **Not yet run on
    the live site: the owner has to set `OWNER_EMAIL` in Vercel.**
  - Shared memory (`src/store/shared.ts`): `api/ask.ts` returns a stored answer for an opening question
    (no history, no lesson context) that anyone has asked before, keyed by a hash of the tidied question and
    a fingerprint of the library, kept 90 days; `api/point.ts` does the same per picture and question.
    `fresh: true` on the request asks anew. The reply carries `remembered: true`.
  - Own key: a person can enter their own Claude key in the picker; it is kept in that browser only
    (`src/guide/me.ts`) and sent as `x-anthropic-key` with guide, picture and lesson requests; the server
    uses it for that request and never stores or logs it.
  Tested with a store kept in memory and, in a browser, with a stand-in for `/api/store`. **Not yet run
  against the real database** (the build session has no access to it): the System check tab's "Check the
  database" button is the first real test.
- **Guide in context** — `src/ui/Answer.tsx` (`AskBox`): an ask box inside each practice lesson (sends lesson,
  step, current synth settings and finished lessons) and at the top of a rebuilt patch (sends only the
  code-written instructions, per rule 5; never the preset). The first line of the context is the retrieval
  topic. Code, not the model, writes step remarks and picks the suggested next lesson.
- `src/skin.css` + `src/assets/skin/` — patchwork skin. Artwork generated with Higgsfield for this project; display
  font is Shrikhand (OFL) from `@fontsource`, self-hosted. The page makes no third-party requests.

Inferences that still need probes (all flagged "unverified" in the UI): on/off rule, mod source ids,
FX rack order, module index-to-name labels, every display conversion. FX parameters are shown as stored.

## Long-term direction (owner's stated goals; not yet scheduled or built)
- **Private, single-user.** The owner has said this program is strictly for them and will never be distributed.
  Design for one user; do not add accounts, sharing or public pages (superseded in part on 14 Nov 2026: the
  owner asked for a "Who's playing?" picker so a few friends each keep their own progress; still no passwords,
  no public pages). On 14 Nov 2026 the owner said they
  were giving the link and password to one friend: a private share behind the same single password, which
  changes nothing in the design (progress is per browser; the friend's guide questions bill the owner's key). Rule 4 still applies to the name and look.
- **Course:** `docs/CURRICULUM.md` maps 16 tracks and about 400 lessons (one line each); `docs/lessons/` holds
  fully scripted lessons in a fixed shape (43 so far, all drafts); `docs/COURSE_PLAN.md` describes the practice
  synth and lesson engine. A university programme's topic list was used only as a coverage checklist.
  See also `docs/COURSE_PLAN.md`. Guided lessons on a built-in practice synth; lessons can be taken in any
  order; each lesson is its own data file so chapters are easy to add. Tracks are to grow well beyond synthesis
  (acoustics, psychoacoustics, sound design, effects, ear training, mixing).
- **`docs/SERUM_GAPS.md` (14 Nov 2026, owner's request):** every Serum 2 feature in the User Guide that the
  practice synth lacks or has in part, by area in the manual's order, with page numbers, a status and a rough
  size, ending in a suggested order of fifteen. About 550 rows. Written from the manual's text only (pictures
  were not read) by a helper that read all 343 pages; it lists what it could not pin down at the end. Top of
  its order: mono/legato/portamento; mod wheel, pitch bend and MIDI input; the matrix's AUX SOURCE; Osc B as
  a full oscillator and pan; a second filter with routing; more filter types; more warp modes. Update it
  when a gap is closed.
- **Two tracks added by the owner on 13 Nov 2026, planned and not built:** physical modelling
  (`docs/PHYSICAL_MODELING.md`, about 60 lessons; needs AudioWorklet engines because the browser's ready-made
  delay cannot loop faster than one 128-sample block) and bioacoustics with hearing and illusions
  (`docs/BIOACOUSTICS.md`, about 45 lessons; teaches mechanisms, never claims an artist's method or that sound
  alters the brain; explanations wait for texts in the library).
- **Processing chains (owner asked 14 Nov 2026), planned and not built.** After the learner has finished the
  synthesizer material, and after our own in-depth effect courses (EQ, compression and the rest: track F in
  `docs/CURRICULUM.md`), a track on stacking stock plugins after the synth in a chain. Agreed shape, pending
  the owner's reply: practised in the app on our own effects rack (the app cannot run a DAW's plugins), with
  each lesson ending in "the same chain with Ableton's stock devices", cited from the Ableton manual in the
  library; "stock plugins" is assumed to mean Ableton Live's. Needs first: a reorderable rack with a bypass
  per effect (`docs/SERUM_GAPS.md`, effects), and the effect courses. Order of work: synth gaps, effect
  courses, then chains.
- **Sound systems track and spoken lesson intros (owner asked 14 Nov 2026), planned and not built.**
  (1) Full sections on sound systems (loudspeakers and how each part works, and the system around them),
  with high-definition diagrams. Proposed to the owner, awaiting a reply: every labelled, technical diagram
  is drawn by code (the standing rule: diagrams are never left to an image generator, which garbles labels
  and invents parts), with Higgsfield or Blender used for unlabelled hero pictures that code then labels;
  the facts must come from a text in the library, and none on loudspeakers is in yet. (2) A playable audio
  clip at the top of every lesson saying what the learner will learn. Today there is only the browser's
  "Read aloud". Proposed: a short intro script per lesson written from the lesson's own outcome and idea,
  voiced once with Higgsfield and stored (it spends the owner's credits, so one lesson is to be tested and
  approved first). **One test clip exists (14 Nov 2026):** `src/assets/intros/C2.1.mp3` (Filters, lesson 1;
  50 s; Higgsfield `seed_audio`, preset voice "Arthur"; 4.4 credits). `PlayView.tsx` shows an audio player
  at the top of any lesson that has a file named by its id in `src/assets/intros/`. **The owner approved it on 14 Nov 2026: keep the voice "Arthur" for everything from now on, and keep
  this length and level of detail. No other voices are to be tried.** No further clips have been made; all 87 would cost about 380 credits, more than the owner's
  balance of about 220 at the time.
- **Music theory (owner, 14 Nov 2026).** With a MIDI keyboard now working, the owner wants music theory
  built in eventually. Track I of `docs/CURRICULUM.md` ("Theory and keyboard for producers", 18 lessons)
  is the plan; nothing is built. Lessons can check what is played from the keyboard (notes, intervals,
  chords, scales) the way synth lessons check knobs.
- **`docs/LEARNING_RESEARCH.md` (owner's request, 14 Nov 2026): design rules for lessons and guide answers
  drawn from PubMed, each with its DOI, in two sets: for every learner, and for a learner with ADHD. The
  owner has ADHD and called tailoring the courses to it "super super important".** Read it before
  designing or changing lessons, answers or their layout. It ends with a build order (a per-person Focus
  mode first, then end-of-lesson recall, spaced return, mixed by-ear checkpoints, "why this matters",
  fading guidance, optional noise while reading). Most ADHD studies are on children, so the owner's own
  report of what helps outranks the papers. It is design guidance, not medical advice.
- **Focus mode (14 Nov 2026; first item of the build order in `docs/LEARNING_RESEARCH.md` and of the
  queue in `docs/TODO.md`).** A "Focus mode" switch beside the chapter line of every lesson, off by
  default, remembered in the browser (`patchwalk.focus.v1`; not yet stored with the account). With it on:
  a bar that stays at the top of the lesson shows the step number, minutes left (`minutesLeft` in
  `src/course/focus.ts`: the lesson's stated minutes scaled by the steps, by-ear rounds and ear check
  still to do), a segment per part, and the current instruction; the lesson list is folded behind "All
  lessons"; later steps are dimmed and reading is spaced wider with shorter lines; the page opens where
  the learner left off with a stitched "You were here" patch (how long ago, which step, the last thing
  done) and **the synth set as they left it** (`Place` in localStorage, `patchwalk.place.v1`, saved on
  every step and when the page is hidden; it is saved whether or not Focus is on, used only when it is);
  and a finished lesson shows "A good place to stop", which after two lessons in one sitting suggests
  moving for a couple of minutes. Nothing counts streaks or marks failure. Checked in a browser: the bar
  counted down, a saved place in the filter lesson came back on step 3 with the cutoff where it was and
  the step already passing, and with Focus off none of it showed. In development React runs a lesson's
  start-up twice, so that code must give the same result both times (it once wiped the saved place).
- **End of a lesson: write, quiz, recap (14 Nov 2026; second item of the queue, reshaped the same day by
  the owner, who loved being asked to type what they remember and asked for a quiz that is checked before
  the recap is shown).** `RecallCard` (`src/ui/Recall.tsx`) has three parts. (1) "What do you remember?":
  a box to type the lesson back in your own words (never saved), with the lesson's outcome as a nudge.
  (2) A quiz on that lesson, options in a mixed order, checked only when all are
  answered: each then shows the right answer, the learner's own, and one line of why. (3) The recap,
  with each point the quiz asked about tagged "you had this" or "read this one again". A quiet "Skip to
  the recap" link stays, so nobody is trapped. **620 questions over the 130 lessons (579 over the first 122) (the ten lessons added on 15 Nov 2026 have questions the assistant wrote itself), from 3 to 8 a lesson, in
  `src/course/quiz/quiz-a.json` to `quiz-f.json`: the owner asked that the number per lesson come from what
  that lesson teaches, not from a formula, so each lesson was audited (list every distinct thing worth
  remembering, one question per thing, duplicates dropped) and most have 4 to 6** (`{ q, options[4], answer, why, point }`, `point`
  being the recap line it tests). They were written by helper agents from each lesson's own text under
  strict rules (nothing the lesson does not say, one clearly right answer, short, no codes), checked by a
  test for shape and by the assistant reading a sample; **the owner has not reviewed them, so treat
  them as drafts and fix any that read wrong.** A new lesson needs its questions added (at least three, every recap point covered) or that test
  fails. Which recap points were shaky is kept per lesson in the browser (`patchwalk.recall.v1`,
  `src/course/recall.ts`; not yet stored with the account) for the spaced return that is item 6 of the
  queue: the wording says they "will come round again", true only once that is built. The typed recall is
  not checked by anything; checking it would need a paid call to Claude.
- **Blender for 3D teaching pictures (owner asked 14 Nov 2026; first test made).** Blender runs in the build
  session without a screen as a Python module (`pip install bpy` in a virtual environment, Python 3.13;
  Cycles on the processor, about a minute for a 2700 by 1400 picture at 96 samples). `scripts/blender/driver.py`
  builds a cutaway of a cone loudspeaker driver from revolved outlines (every part is an `(r, z)` outline
  swept round the axis with a wedge left out), renders it with no text, and writes where each part is in
  the picture; `scripts/blender/label.py` then draws the names, one-line jobs and leader lines. The result
  is `docs/diagrams/driver-cutaway.jpg`. The proportions are illustrative, not taken from a source, and the
  part descriptions are general knowledge, not yet from a text in the library: check both against a
  loudspeaker text before it goes into a lesson. Use Blender only for 3D objects with hidden parts
  (drivers, horns, cabinets); labels are always drawn by code, never by an image generator.
  **Interactive version in the app ("Sound systems" tab, `src/ui/DriverDiagram.tsx`, 14 Nov 2026):**
  `driver.py -- <dir> 64 --frames` renders the cone at seven positions (6 mm in to 6 mm out; the coil,
  former, cone and dust cap move, the surround and spider flex, the rest stays) and, for each, a "map" of
  the same view with every part one flat colour (`src/assets/diagrams/driver/`, 260 KB in all; the maps
  are palette PNGs). The page reads the map under the pointer to know which part is there (`partAt` in
  `src/soundsystems/driver.ts`) and tints that part; a list of part buttons does the same for the
  keyboard. A slider and "Move it" step through the positions. "Name the parts" lights each part in turn
  and offers four names, with the answer and its job shown at once and a first-try score at the end
  (the recall rule in `docs/LEARNING_RESEARCH.md`). Checked in a browser: pointing named the cone, magnet,
  pole piece and surround correctly, and background gave nothing. It is the pattern for further
  diagrams: render frames plus maps, then let code do the interaction. **Live 3D model (14 Nov 2026, owner's request):** `src/ui/Driver3D.tsx` draws the same model in the
  browser with `three` (MIT; the one new dependency, fetched only when the view is opened: `DriverPage`
  loads it lazily). `driver.py -- <file.glb> --glb` exports one object per part, and gives the surround
  and spider a second shape ("out") so the page can bend them; the page moves the coil, former, cone and
  dust cap along the axis and blends the two suspensions. Drag turns it, scroll zooms, pointing or the
  part buttons light a part and say what it does, a slider sets the cone's position, and "Play a tone
  and watch" plays a quiet sine (30 to 200 Hz) while the cone follows it 50 times slower than real, with
  the travel exaggerated (the page says both). The "Sound systems" tab opens on the 3D view; the
  rendered picture with the naming exercise is the second view. Checked in a headless browser with
  software 3D: it drew, turned, named the cone under the pointer, and the picture changed with the slider
  and while a tone played. Not built: the cone following the practice synth's own sound, a cut that
  opens and closes, naming practice in the 3D view, touch testing.
- **Impact sounds (owner asked 13 Nov 2026):** `docs/IMPACTS.md`, about 50 lessons on hits, striking bass
  notes, weight, making room, impact effects and contrast. The first seven are built (see `lessons/impacts.ts`);
  the rest wait for effects, physical modelling, the mini DAW and library texts on hearing.
- **`docs/LITERATURE.md`** lists every text in the library, expected, or wanted. Texts are only taken in from
  copies the owner has bought or borrowed, or that the maker or author gives away; never from piracy sites.
- **Teacher/guide:** one consistent voice, remembers progress, comments on what the learner just did, answers
  questions. Patch facts stay strict (rule 5). Concept answers come from a private library of the owner's texts
  via retrieval, with citations. This is retrieval, not model training.
- **Voice.** The owner asked about generated voiceovers. Today there is only the browser's built-in read-aloud.
  **The owner chose Higgsfield (13 Nov 2026).** Not built: test its narration quality on one lesson first, then
  generate each narration once and store the audio. It spends the owner's Higgsfield credits.
- **Owner's video walkthroughs (planned, not built).** The owner wants to record short screen-capture
  walkthroughs (e.g. in Ableton) and have the guide pull up the right one when a question matches, such as
  "how do I automate the BPM of my track?". Design agreed in principle: each video gets a small entry (title,
  the question it answers, a short description or transcript, optional timestamps) that is indexed in the
  library like any other passage, so the guide can answer from the owner's own words, cite the video, and the
  app plays it. Video files are too big for git; host them elsewhere (options given to the owner: unlisted
  YouTube, or private file storage on Vercel) and store only the entry and link in the repo. Awaiting the
  owner's choice of hosting and whether they will narrate (a transcript makes matching much better).
- **Mini DAW (later):** tracks, a step sequencer / piano roll, drums and samples, a mixer, for genre-writing
  lessons (glitch-hop, breakbeat, psydub...). Build the practice synth's audio engine with a shared tempo clock
  and more than one instrument in mind so it can become the DAW's instrument instead of being rewritten.
- **Library rules.** `library/` holds copyrighted text (currently Xfer's Serum 2 User Guide; the owner confirmed
  this is OK for private use under rule 4). It is committed to this **private** repo because that is the only
  route to the deployment. NEVER make this repo public, fork it publicly, or publish a build with `library/` in
  it. Library text must never be imported by anything under `src/` (a test enforces this), bundled into the
  browser build, or shown in full in the UI; only the few passages retrieved for a question go to the model.
  To add a text: one JSON file in `library/` shaped `{ id, title, pages: [{ page, chapter, text }] }`.
- **Ableton Live 11 Reference Manual (owner supplied all 867 pages on 13 Nov 2026, in nine PDFs).**
  `library/ableton-live-11-manual.json` (814 pages of text; contents pages 1-22, blank separator pages and the
  index at the back left out; chapters read from each page's running header, 37 chapters including the audio
  effect, MIDI effect and instrument references, Max for Live and Push) and
  `library/images/ableton-live-11-manual/` (738 pictures, 12.3 MB). The
  guide searches it alongside the Serum guide and is told not to carry one product's facts over to another.
  The owner tried it live and reported that it works well.
- **Rift manual (Minimal Audio; owner supplied 13 Nov 2026).** `library/rift-manual.json` (64 pages; cover and
  contents left out; chapters such as "Advanced View: Feedback" read from the letter-spaced headings with the
  script's `--running` and `--headings` options) and `library/images/rift-manual/` (112 pictures; 25 blank drop-shadow shapes were removed after one
  showed up in an answer, and the ingest script now drops such pictures, `is_blank`). The
  owner wants lessons on Rift; none written yet.
- **Kolbrek, "Horn Theory: An Introduction", parts 1 and 2 (audioXpress, 2008; owner asked 14 Nov 2026).**
  `library/kolbrek-horn-theory.json` (17 pages, numbered straight through the two parts; chapters "Part 1"
  and "Part 2") and `library/images/kolbrek-horn-theory/` (45 pictures). Downloaded from the publisher's
  own site, where the articles are given away. The first text for the sound-systems track. 
- **Funktion-One documents (owner asked 14 Nov 2026).** `library/funktion-one-documents.json` (537 pages
  of text from 71 documents, numbered 1 to 555 straight through; each document is a chapter, such as
  "Resolution 4 series user guide" or "Res4E spec sheet") and `library/images/funktion-one-documents/`
  (508 pictures, 19 MB). Downloaded from the maker's site (funktion-one.com; files on
  funktion-one.cdn.prismic.io). Left out on purpose: engineering drawings, rigging hardware sheets, three
  near-duplicate powered-speaker guides, and the Vero VX brochure and rigging manual (their text is
  pictures, so nothing to search; Vero is still without a searchable source). `scripts/ingest_pdf.py` now
  copes with a PDF whose picture list and written files disagree, puts a picture with see-through parts
  on white through its mask (`smask`), and drops pictures that are black nearly all over (`is_dark`): the
  owner was shown a black box with a fragment of the magazine's logo as the picture for a Kolbrek page.
  Some photographs in the Evolution brochure are dark by design and were kept.
- **What is inside a Funktion-One (owner, 14 Nov 2026: "that's the most important part").** Two public
  sources were found and taken in. (1) **US Patent 6,650,760, "Loudspeaker"** (Andrews, Hunt, Newsham;
  assigned to Funktion One; granted 2003): `library/funktion-one-patent-us6650760.json` (8 pages) and four
  drawings as whole-page pictures in `library/images/funktion-one-patent-us6650760/` (FIG. 1 and 2 are
  cross-sections with every part named). It describes an upper bass/low mid horn: a cone driver, a
  **central member** fixed to the pole piece that reaches into the cone, a ring-shaped channel that first
  widens (inside the cone) and then narrows (a "constriction"), then a throat and a horn; it says the
  plug keeps the top of the range coherent and the constriction lowers the bottom from about 150-200 Hz
  to about 75 Hz, covering about 75 to 750 Hz, and that the mechanism "is not fully understood".
  **It is not known which products use this exact device, and it is not established that it is the
  "Axhead" on the Res 5's 8-inch midrange: never say a Res contains it without a source.** (2) **The
  maker's own drawing files** in `library/cad/funktion-one/`: dimensioned 2D drawings (DXF, millimetres)
  of the Res 1, Res 2 and Res 2SH, 3D drawings (DWG, not yet opened: no converter in the session) of the
  Res 2, Res 2SH and Res 4E, and measured coverage data (EASE) for the Res 4 and Res 2SH. `ezdxf` reads
  the DXFs; the Res 2 one gives a body 522 wide at the front, 344 at the back (a 28 degree taper), 920 high and 445 deep; 560 is its depth on the optional wheelboard and 810 the distance between flypoints (an earlier note here read 560 and 810 as width and depth: wrong). The owner is studying
  Funktion-One specifically, so models may be named as theirs; no logo artwork is needed. Other leads not
  yet followed: the UK patent GB2270606B (Andrews, "Loudspeaker enclosure"), the Justia list of patents
  assigned to Funktion One, and Tony Andrews's earlier Turbosound patents.
- **The system Tipper's shows use is Funktion-One's Vero (found 14 Nov 2026; the owner asked for "whatever
  one Tipper plays on").** Trade press and Funktion-One's own news report Vero mains with F124 and F221
  bass and Evo 7 fills at Tipper & Friends shows (The Gorge: 24 Vero, 34 subs; Orion Amphitheater: 20 Vero,
  12 F124, 12 F221; rental company One-Source Productions). This is what was hired for those shows, a fact
  about the rig; it says nothing about how Tipper makes sounds. Vero has three flown cabinets: V60 (two
  10-inch mids, three 1.4-inch high drivers, 60 by 6 degrees), V90 (two 10-inch, two 1.4-inch, 90 by 12
  degrees) and V315 (three horn-loaded 15-inch, 50 to 200 Hz). `library/funktion-one-vero.json` (185 pages:
  the 153-page Vero user guide, the brochure, V60/V90/V315 spec sheets, and the F124 and F221 technical
  and detail drawings; each a chapter) and `library/images/funktion-one-vero/` (235 pictures, 7 MB); the
  four bass drawings are also kept as PDFs in `library/cad/funktion-one/`. The user guide is about
  setting up and flying the system; it does not describe the horns' insides. **The sound-systems models
  should be of Vero first** (V90 or V60, V315, and the F221 and F124 bass), not the Resolution range.
- **Res 2 model (14 Nov 2026, owner asked for a Res model, "whichever is most relevant").** The Res 2 was
  chosen: the maker's sheet calls it "the classic horn-loaded, full range Funktion-One loudspeaker", it is
  one cabinet holding all three ways, and it is the only Res with both a spec sheet and a dimensioned
  drawing we can read. `src/soundsystems/res2.ts` (sizes and the three front openings measured off
  `R2-webdxf.dxf`; drivers, 60 Hz to 18 kHz, the 250 Hz crossover, 50 by 25 degree coverage, weight and
  connectors from the spec sheet, Funktion-One documents page 537) and `src/ui/Res2View.tsx` (second view
  of the "Sound systems" tab). A frequency slider (20 Hz to 20 kHz, with the nearest note, landmark
  buttons such as "Kick thump" and a quiet tone) lights the horn that frequency comes out of and says so
  in words, including "below this cabinet's range" under 60 Hz; "See the drivers" fades the walls and
  shows stand-in drivers at the stated sizes; "Coverage" draws the 50 by 25 degree wedge with its width
  and height at a chosen distance; "Sizes" shows the drawing's dimensions. **Not drawn because not
  published: the horns' inner shapes, where the drivers sit, and where the 8-inch hands over to the
  1-inch (the page says each).** The shaped piece the drawing shows in the mid horn's mouth is modelled
  but nothing is claimed about it; the drawing's block for the mid-high section is named "AX88", which
  is a name only and proves nothing about the Axhead. No logo is drawn. Checked with software 3D only.
  A stitched "What's missing here" patch under the model (owner's request) lists the four things the
  diagram lacks and why each matters (horn shape: how low and how wide; driver positions: timing;
  the handover frequency; the piece in the mid horn). The owner wants this kind of note on diagrams that
  leave things out. Its "why" lines are general acoustics; only the horn-shape one has a text in the
  library behind it (Kolbrek), so check the others when a loudspeaker text arrives.
- **Definition pass, Res 2 first (15 Nov 2026).** The owner saw the "Anatomy" Claude Code skill (MIT,
  github.com/wheresryan22/anatomy: dense isometric SVG machines with a big live readout), asked for a
  survey of ways to make the diagrams better, said they only use the site in a computer browser, and
  approved this plan: keep real 3D and our sourcing, and add (1) models built in Blender with baked
  shading, (2) a technical-drawing finish, (3) sound drawn as a moving effect; judge it on the Res 2
  before doing Vero, the horn and the driver. Built for the Res 2: `scripts/blender/res2.py` models the
  cabinet from the maker's drawing (rounded edges; the three horns cut out of the body as real cavities;
  the grey moulding; hand slots in top, sides and back; screws; flypoints; connector plate; the strut the
  photograph shows in the bass horn), separates it into named parts, bakes ambient occlusion into one
  shared picture, and exports `src/assets/diagrams/res2/res2.glb` (190 KB) and `ao.webp` (330 KB).
  `Res2View.tsx` loads it, lays the shading over it (`aoMap`), draws an ink line along every real edge
  (`EdgesGeometry`), shows a figure card over the view with one big live number (frequency, note, which
  horn, wavelength), and sends pink wavefronts out of whichever horn is playing: outlines of the piece
  of a sphere inside 50 by 25 degrees, one true wavelength apart (`frontGap` in `res2.ts`: every nth when
  closer than 12 cm, and the card says so), travelling at 0.55 m/s. The page says the fronts are a
  picture, not a measurement, and that low notes really spread wider. To rebuild: the Blender module is
  in the scratchpad's `blender/venv` (`pip install bpy` if it is gone). Checked with software 3D only;
  **the owner has not yet judged it. If approved: Vero cabinets and field next, then horn, then driver.**
- **Res 2, "How an engineer sees it" (15 Nov 2026).** The owner asked whether our way of drawing sound is
  how a professional would do it. It is not: professionals read level maps, polar plots and beamwidth
  charts made from measured cabinet data in prediction software (Funktion-One's is called Projection; the
  Vero guide walks through it). The owner asked for both, with a switch. The Res 2 view now has "Simple
  view" (the wavefronts) and "How an engineer sees it" (remembered in the browser), the second drawn
  from **Funktion-One's own measurements**: `library/cad/funktion-one/RES2SH_EaseData.zip` holds EASE
  "CF2" files for the Res 2SH, the mid-high section of a Res 2. `scripts/ease_cf2.py` documents the
  layout (worked out by inspecting the files: 32-bit floats; a header table of 30 third-octave bands,
  25 Hz to 20 kHz; then level in dB against straight ahead for 72 meridians by 37 points every 5 degrees)
  and **proves the reading: the beamwidths computed from the level data equal the beamwidth table stored
  in each file, for all 20 bands.** It writes `src/soundsystems/res2-directivity.json` (73 KB; a derived,
  compact copy, one byte per value) read by `src/soundsystems/directivity.ts` (`level`, `levelAt`,
  `bandNear`, `levelColour`; tested). The view shows a 3D "balloon" at the horn (distance from the horn =
  level in that direction), a level map on the floor at ear height in 3 dB colour steps with a legend, a
  polar plot and a beamwidth-against-frequency chart (`src/ui/Directivity.tsx`, SVG by code), and a card
  with the band and its measured -6 dB width. What the data shows, and the simple view cannot: the spread
  is not one angle (side to side about 150 degrees at 315 Hz, 33 at 2.5 kHz, 94 at 10 kHz, against the
  sheet's nominal 50). The 8-inch file covers 250 Hz to 5 kHz and the 1-inch file 6.3 kHz to 20 kHz, so
  the files place the handover between those bands (read off the files, not stated by the maker). Limits
  the page states: each driver alone, no crossover region, no bass horn (no file), open air only (6 dB
  per doubling of distance, no floor or walls), levels relative to 1 m straight ahead. The `.gll` file in
  the same zip is a compiled format and was not opened. EASE files for the Res 4 are there too, unused.
  **Vero has no such files in the library, so its field stays a geometry sketch.**
- **Batch of 15 Nov 2026 (the owner said to do tasks that need no decision from them until told to stop).**
  All tested, measured where they make sound, and pushed. **None of it has been seen or heard by the owner yet.**
  - **Vero measurement files: none are public.** Funktion-One publishes no EASE data for the V60, V90 or
    V315 (coverage data for Vero lives in their own Projection software, which needs a licence). Found and
    saved: `library/cad/funktion-one/Funktion-One_Vero_VX90_v2.1.gll` (Vero VX, the smaller system; a sealed
    format we do not open; the owner can view it in AFMG's free GLL Viewer). So the Vero field stays a
    geometry sketch.
  - **"Why this matters"** line on every lesson (`src/course/why/`, `WHY`; shown under the title; a test
    holds them to 12-28 words, no hype, no names). **Coming back** (`dueLessons`, `afterReturn`, `GAPS` of
    2, 7, 21, 60, 120 days in `src/course/recall.ts`; `ReturnCard` in `Recall.tsx`): finished lessons'
    questions return after days, then weeks; a miss shortens the gap, nothing is counted against anyone.
    **Mixed checkpoint** `CX.1` (chapter "X", "Mixed practice", after the LFO chapter): by-ear rounds drawn
    from four chapters. **Guide answers**: a one-line "Short answer" first, "Go deeper" follow-up buttons,
    one "Check yourself" question, sources folded away (`layout` in `src/library/answer.ts`); checked with a
    stand-in reply only.
  - **Effects can be reordered** (`fxOrder`, `wire`, `moveFx` in `fx.ts`; ◀ ▶ on each effect in the whole
    synth, or in a step that shows `fxOrder`). Measured: clip then EQ against EQ then clip differ 10.4 dB at
    the ninth harmonic. **Saved sounds** (`src/synth/patches.ts`, `PatchBar`): save, load, delete, export
    and import the whole synth under a name. **Vero: build your own column** (choose cabinets and angles).
  - **Osc B has its own warp and unison** (`bWarp`, `bWarpAmount`, `bVoices`, `bDetune`, `spectrumB`; a
    voice's `b` is now an array). Unison voices start spread over half a cycle (`bStart`): spread over a
    whole cycle they cancelled to near silence at zero detune.
  - **Second filter, routing, peak and shelf** (`filter2On`, `filter2Type`, `cutoff2`, `resonance2`,
    `filterRoute`: "series" after filter 1, "parallel" beside it). Filter 2 is one stage, always in the
    path; three gains (`after`, `beside`, `past`) crossfade the routing so notes never restart. Peak lifts a
    band (resonance is its height, up to `SHAPE_MAX_DB` = 24 dB), Shelf turns the top down by that much; on
    both the Resonance knob is "how much". `filterResponseDb` adds dB in series and adds the two paths as
    complex numbers in parallel (`stageResponse`), so the drawn curve is still what is heard. Measured on a
    saw's harmonics: within 0.1 dB of the drawn curve for peak, shelf, series and parallel.
  - **Three more warp modes**: Flip (the end of the cycle upside down), Steps (the cycle cut into 64 down to
    2 flat steps, `stepCount`), Fold (turned up 1 to 5 times and folded back, `foldGain`). Flip and Fold
    change the wave's height (`warpValue`), not where it is read. Our own rules: not claimed to match
    Serum's modes of similar names. Measured: flip at 50% on a sine removed the first harmonic and left the
    second; fold added the third; steps at 8 added the 7th and 9th.
  - **A smooth drawn LFO shape** (`"curve"`, shown as "Drawn, smooth"; `isDrawn` covers both): the sixteen
    values joined by straight lines, round the end of the cycle too.
  - **Ten lessons**: `lessons/additions.ts` (slotted before each chapter's checkpoint by `slot` in
    `index.ts`): C1.10 Osc B voices and warp, C2.8 Peak and shelf, C2.9 Two filters, C7.7 The order of
    effects, C6.6 Fold, steps and flip; and five macro recipes C5M.17 to C5M.21 (Radio, Crowd, Talk, Bits, Metal), 21 recipes now;
    plus CX.1. **Blind ear checks** are now data in `src/course/ear.ts` (`EAR`: shape, higher, brighter,
    filterType, movement, attack, faster) and five more lessons have one (low-pass cutoff, filter types,
    tremolo and vibrato, the envelope's stages, a slow repeating shape). Three knowledge cards: `fm`, `ring-modulation`, `two-filters` (39 cards, all drafts).
  - **Saved sounds and lesson recall are stored with the account** (`patches`, `recall` on the account's
    data; `mergePatches`: newest of each name; `mergeRecall`: latest record of each lesson). Focus mode's
    switch and the saved place are still per browser.
- **Wave shapes from papers (15 Nov 2026, owner's request).** The owner asked for research papers showing
  classic synths' wavetables, to fill the synth and for genre lessons. No paper catalogues the stored
  tables of the PPG, Korg DW, Prophet VS or Ensoniq machines, and those tables are the makers' data: **never
  copy a maker's wavetable data in; build shapes by code from published formulas.** Five free papers were
  taken into the library (`pekonen-moog-sawtooth`, `lazzarini-adaptive-phase-distortion`,
  `kleimola-vector-phaseshaping`, `lazzarini-distortion-synthesis`, `esqueda-wavefolders`; each paper is one
  chapter). Four wavetables were built from them (`pdsaw` "Phase saw", `moogsaw` "Analogue saw", `pdpulse`
  "Phase pulse", `formant` "Formant"): `phaseShape`, `pdWave`, `moogRise` (the paper's fit of the rise time
  to recordings of a Minimoog Voyager, equation 6) and `formantWave` in `params.ts`. A table frame can now
  carry cosine parts (`Frame`, `fromWave`, `cosinesA`, `magnitudesA`); `harmonicsA` is the sine parts only,
  so use `magnitudesA` for loudness or brightness. `TABLE_NOTES` says where each comes from and is shown
  under the wave picture. Measured on the engine: each harmonic within 0.7 dB of the calculated level (the
  analyser's own error). Three more were added the same day: `pdsquare` "Phase square" (two bends per cycle:
  odd harmonics only), `tanhsquare` "Driven square" and `tanhsaw` "Driven saw" (a sine through a hyperbolic
  tangent, and that times a raised cosine; Lazzarini and Timoney 2010, equations 16-17 and "sawtooth from
  square"). The lesson "Shapes from classic synths" (C1.11) uses the first four and "Three roads to a square" (C1.12) the other three. A ninth warp mode, `diode` "Circuit fold", is one stage
  of the Lockhart wavefolder from the Esqueda paper's equation 28 (`lockhartFold`, `lambertW`, part values
  from its table 2; the 7.5 kilohm load and the 0.15 to 1.5 volt drive range are our choices). Not done: the CZ's
  resonant shapes, the JP-8000 supersaw (the thesis link was dead), the Serge folder and a chain of several Lockhart stages, and
  lessons on the three later tables. The Adventure Kid Waveforms collection (about 4,300 single cycles) is a
  possible bulk source; its licence is reported two ways and must be read first.
  A long list of **physical-modelling literature** (found by search, nothing opened) is in
  `docs/LITERATURE.md`; most free copies are on ccrma.stanford.edu, which the session's network does not
  yet allow.
- **Physical modelling begins: the String lab (15 Nov 2026).** Nine free texts on physical modelling were
  taken into the library (Smith's 1992 waveguide paper and 2004 review, the 2-D waveguide mesh, a bowed-string
  paper, the NESS project, "Four Decades of Digital Waveguides", modal synthesis, membrane percussion, and
  McIntyre, Schumacher and Woodhouse's "On the Oscillations of Musical Instruments"; ids in
  `docs/LITERATURE.md`). Not taken in: Scavone's and Cook's theses (scanned pages with no text; they would
  need reading by picture), the piano overview (its site refused the download), and Smith's online book
  (no licence stated). **`src/strings/string.ts`** is a plucked string as pure maths: a delay loop whose
  length is the note, a two-sample weighted average as the loss filter (`lossWeight`: brightness), a
  one-coefficient all-pass for fine tuning, a per-trip gain set from the decay time (`tripGain`), and an
  excitation one period long (`excitation`: a pluck whose harmonics are sin(n pi position)/n, softened by
  pick hardness and thinned again by the listening position; or a repeatable burst of noise). This is the
  Karplus-Strong method as Smith's 1992 paper gives it (library page 18). **A note is worked out whole
  (`renderString`) and played from a buffer: no AudioWorklet, so a ringing note cannot be changed** (no
  bends, mutes or bowing yet; those need a worklet). `src/ui/StringLab.tsx` is the "String lab" tab: the
  string's picture with pluck and listening points, the harmonics the pluck leaves in, the note's fade,
  sliders, a two-and-a-half-octave keyboard (letter keys A to K), eight "Things to try" that tick
  themselves, and a "What is missing here" note. Tests (`tests/strings.test.ts`): in tune within 3 cents
  from note 28 to 96, the fundamental falls 60 dB in the decay time, plucking at a half removes even
  harmonics and at a third every third, highs die sooner on a dull string. Checked in a browser; **not yet
  heard by anyone.** Not built: the lesson engine does not know this instrument (the lab is a page of its
  own, not lessons), match by ear, stiffness, two strings, body, bowing.
- **Physical models tab (15 Nov 2026, later).** The tab is now "Physical models" (`src/ui/ModelLabs.tsx`)
  with two views. **Plucked string** gained a second string a few cents away (`pair`, `pairBeatHz`) and
  **match by ear** (`stringTarget`, `judgeString`: a hidden string differing in brightness, decay time and
  pluck position; the verdict says which way each is off, never the numbers). **Drum head**
  (`src/modal/membrane.ts`, `src/ui/DrumLab.tsx`): a skin as a set of ringing modes. Round head: mode
  frequencies from the zeros of Bessel functions (`BESSEL_ZEROS`, each checked by a test against `besselJ`),
  and a hit at radius r excites mode (m, n) by J_m(zero x r), so a dead-centre hit excites only the m = 0
  modes (source: Avanzini and Marogna 2010, in the library). Square head: frequencies as the root of m
  squared plus n squared (Van Duyne and Smith 1993, in the library). **How fast each mode dies
  (`modeDecay`) is our own rule, not sourced, and the page says so.** Click the head to hit it there; bars
  show each mode's frequency and how strongly the hit excites it, against faint lines where harmonics would
  be; five "Things to try". Like the string, a hit is rendered whole and played from a buffer. Tests in
  `tests/membrane.test.ts`. Checked in a browser; not heard by anyone. Neither lab is known to the lesson
  engine yet.
- **Realism pass on the physical models (16 Nov 2026; the owner said the drum "sounds super electronic" and the
  tube and string "sound awful").** Drum (`membrane.ts`): 84 modes for the round head (zeros found by
  `besselZeros`) and 64 for the square; `stick` (a softer stick lets fewer high modes through, `stickShare`),
  `force` (a hard hit starts up to 7% sharp and settles in `STRETCH_TIME`, `stretch`), `second` (a copy of
  every mode `SECOND_HEAD` times higher); the bars show what the stick lets through. String (`string.ts`):
  the loop's loss is now a one-pole low-pass set so that a harmonic near `highHz` lasts `highsLast(bright)`
  of the fundamental's time (`lossPole`; before, a low note's highs rang for seconds), and the note is heard
  through `throughBody` (`BODY_MODES`, four broad resonances; `body` 0 is the bare string). Tube (`tube.ts`):
  the open end is a two-stage low-pass at `bellHz` (900 Hz to 4.4 kHz, never under four times the note), so
  the harmonics fall away instead of a square-wave buzz (ninth harmonic over 20 dB under the third); the
  breath swells in and eases off, wanders a few percent, and its noise has the top taken off. **All these
  numbers are our own choices and each lab's "What is missing here" says so. Checked by measurement and
  tests only: the assistant cannot hear, so the owner's ear is the judge.** The bowed string was not changed.
- **Physical models tab is on hold (owner, 16 Nov 2026).** The owner does not think the page earns its place
  as it is and would rather have lessons built on the literature once they have uploaded it; the page may be
  kept only if it can then be made genuinely good. **Do no further work on the four labs until the texts
  arrive** (first of all Fletcher and Rossing). Then: write the lessons from the texts, and keep a model only
  where a lesson needs something to play and its numbers can come from a source. Not removed meanwhile.
- **Lessons on the physical models (15 Nov 2026, later still).** `src/models/lessons.ts` holds six lessons
  as data (`ModelLesson<S>`: outcome, two idea paragraphs, steps with `check(settings, played)`, recap, and
  their own quiz questions): string Q1.1 "A burst of noise becomes a note", Q1.2 "Loss is tone", Q1.3
  "Where you pluck, and what with", Q1.4 "Where you listen, and a second string"; drum Q4.1 "Modes: why a
  drum is not a string", Q4.2 "Damping and shape". `useModelLesson` in `src/ui/ModelLesson.tsx` runs them
  inside each lab: a chooser ("Free play" or a lesson), the idea, one step at a time (a step is passed by
  playing the model with the settings it asks for), then the same write / quiz / recap card as the synth
  lessons (`RecallCard` now takes its questions through `items`). Finished model lessons are kept in the
  browser (`patchwalk.models.v1`), not yet with the account, and they are **not** in `LESSONS`: they do
  not count in the 99, do not appear in the Lessons tab, and have no "why this matters" line, Focus mode
  or spaced return. `tests/models.test.ts` checks their shape. Run through in a browser; not yet tried by
  the owner.
- **Five more impact lessons (15 Nov 2026).** `IMPACT_ADDITIONS` in `lessons/additions.ts`, slotted before
  the impacts checkpoint: CT.7 Snares (a tone and a burst of noise), CT.8 Booms (size from length), CT.9
  The filter snap, CT.10 Harmonics make a sub audible, CT.11 Risers (one long-attack envelope to pitch, and
  to the filter through a matrix row), CT.12 Pluck, stab and growl. Thirteen lessons in the Impacts chapter. Like the first ones they
  claim nothing about hearing. A test walks every step of every lesson added that day with the settings its instruction asks for; **none was clicked through in a browser.**
- **Blown tube (15 Nov 2026).** A third physical model, `src/modal/tube.ts` and `src/ui/TubeLab.tsx` ("Blown
  tube" in the Physical models tab). A delay line half a period long (the wave returns from the open end
  upside down, times 0.95, through the same two-sample loss filter as the string); at the mouthpiece the
  outgoing wave is mouth pressure plus the reflected part of (returning wave minus mouth pressure), the
  reflected share coming from `reedReflection`, a straight line limited to -1..1. The structure follows
  the single-reed section of Smith 1992 (library page 19); **the reed's curve and its numbers are our own,
  and the page says so.** It sounds only while blown, and only inside a range of breath: `speaks` and
  `speakingRange` try the model itself and the lab draws that range with the learner's breath marked.
  Tested: in tune within 6 cents from note 40 to 84, odd harmonics present and even ones under 2%, silent
  below the range and above it, a looser reed speaking with less breath and choking sooner, the range
  always one unbroken stretch. Notes are blown for a fixed 1.4 s (rendered whole, like the others). Two
  lessons, Q6.1 "Breath: too little, enough, too much" and Q6.2 "A hollow tone", in `TUBE_LESSONS`
  (eight model lessons in all). Checked in a browser; not heard by anyone.
- **Bowed string (15 Nov 2026).** A fourth physical model, `src/strings/bowed.ts` and `src/ui/BowLab.tsx`
  ("Bowed string" in the Physical models tab). Two delay lines, bow to nut and bow to bridge, carrying
  velocity; the nut sends the wave back upside down, the bridge upside down through a one-pole low-pass; at
  the bow the string is given `d x bowGrip(d)` where d is bow speed minus string speed and `bowGrip` is 1
  when stuck and falls off as it slips (sooner under light pressure). Structure from Smith 1992's bowed
  string section (library page 20) and the stick-slip account in McIntyre, Schumacher and Woodhouse 1983;
  **the grip curve and its numbers are our own, and the page says so.** Behaviour, all from the model and
  tested: in tune within 6 cents from note 36 to 81; all harmonics, odd and even (saw-like); silent with a
  still bow; louder with a faster bow; with the bow too fast for its pressure the second harmonic takes
  over ("the note jumps up"); it rings on and fades after the bow lifts. `bowResult` (silent / note /
  jumped) tries the model at 24 kHz, and `bowMap` gives a 7 by 7 map of speed against pressure for the
  last note played, drawn with the learner's place marked; a test holds the quick trial to 85% agreement
  with the full-rate note. One lesson, Q2.5 "Bowing: stick and slip" (`BOW_LESSONS`; nine model lessons in
  all). A hard fast bow is several times louder than a gentle one, so the lab plays through a limiter.
  Checked in a browser; not heard by anyone.
- **Music theory begins: "Notes and chords" (15 Nov 2026; track I of the curriculum, which the owner asked
  for once a MIDI keyboard worked).** `lessons/theory.ts`, chapter "N", listed between "Playing a line" and
  "Impacts": CN.1 Notes, semitones and octaves; CN.2 Intervals: fifths and thirds; CN.3 Major and minor
  chords; CN.4 Scales: major and minor; CN.5 Chords that belong to a scale; CN.6 Inversions; CN.7 A four-chord
  progression (`chordRun` reads the last twelve notes three at a time); CN.8 Seventh chords; CN.9 Changing key (the Semitone box moves the letter keys to another key); CN.10 and CN.11 read from a staff (see "Sheet music that follows along"). They are checked from what is
  played, not from knobs: the notes sounding together (`s.held`, compared as steps above the lowest, or as
  pitch classes) and the notes played in order (`s.sequence`, new on the snapshot and the tracker: every
  note-on since the step began, the last 64). Everything can be done on the letter keys A to K (C to C);
  the mouse or a MIDI keyboard works too, in any octave and from any starting note that fits. Run through
  in a browser for the first lesson (single notes, two in a row, two held together). **Holding three
  letter keys at once depends on the computer keyboard; most allow it, some do not.**
- **Sheet music that follows along (15 Nov 2026; the owner asked for the theory lessons to "play like sheet
  music but be interactive", not like a rhythm game).** `src/course/score.ts`: a `Score` is a row of items
  (`notes`: one MIDI number or several for a chord; `beats`); `staffPlace` puts a note on the treble staff
  (steps above the bottom line E, sharp or not, its name, and the letter key that plays it), `ledgerLines`,
  `timing`, and `follow(score, sequence)`: how far the played notes have got. **Following goes by note name
  (any octave), waits on a wrong note without penalty, takes a chord's notes in any order, and does not
  judge timing.** `src/ui/Score.tsx` (`ScoreView`) draws the staff by code (the clef is the Unicode
  character, in whatever music or symbol font the computer has): played notes green, the next one ringed,
  red while the last note was wrong, note names and letter keys underneath (a switch, remembered), and
  "Listen", which plays the page at the synth's tempo through `engine.playAt` with a marker moving along.
  A lesson step shows one by carrying `score`. Lessons CN.10 "Reading notes on the staff" and CN.11 "Play
  a tune from the page" (the opening of Beethoven's "Ode to Joy", then four chords), and the two scale
  steps of CN.4 show their scales as notation. Checked in a browser: notes turned green as played, a wrong
  note left the ring where it was, the step passed at the end, a chord played on three letter keys moved
  the page on, and Listen moved the marker. Not built: bass clef, key signatures, rests, flats (black keys
  are always written as sharps), notes shorter than a beat, more than one line of music, and any check of
  rhythm.
- **Flanger and phaser (15 Nov 2026).** Two more effects in `fx.ts`, between chorus and delay in the default
  order (eight effects now). Flanger: a delay resting at 5 ms and swinging up to 2 ms either way (it must
  stay above one 128-sample block because it sits in a feedback loop), with feedback and mix; the dry sound
  always passes. Phaser: four all-pass stages (Q 0.7) whose frequency is swept up to two octaves either
  way through `detune`, added to the dry sound; no feedback (the browser forbids a loop without a delay).
  `flangerNotchHz` and `phaserDb` are the maths. Measured through the engine: a still flanger at full mix
  removed 100 and 300 Hz (over 70 dB down) and lifted 200 and 400 Hz by 6.0 dB; a still phaser cut 40 dB at
  its calculated lowest notch and matched the calculated level elsewhere to 0.1 dB. Lesson C7.8 "Flanger
  and phaser", and three macro recipes that use them (C5M.22 Jet, C5M.23 Swirl, C5M.24 Going under; 24 recipes now). Old saved orders and lesson orders that list six effects get the two new ones added at the
  end (`fxOrderOf`).
- **Arpeggiator (15 Nov 2026).** `src/synth/arp.ts` (the rules: `arpCycle` for up, down, up and down, as
  played, over one to three octaves; `arpStepSeconds`; `nextArpTime`) and the hook (`useSynth.ts`): with
  `arpOn` "on", pressed keys are kept in `arpKeys` and not sounded; a 25 ms timer schedules each step about
  a tenth of a second ahead on the audio clock with `engine.playAt(note, at, seconds, velocity)` (a voice of
  the current sound at an exact time, kept in the engine's `auditions`, not in `held`), on the same grid as
  the click. Settings are in the Voicing group (`arpOn`, `arpMode`, `arpDiv` steps per beat, `arpOctaves`,
  `arpGate` note length). With Hold on the keys stay latched; a fresh press starts a new set. Measured in
  a browser: three held keys at 120 bpm, two steps a beat, played C E G round and round with every step
  exactly 0.2500 s apart, and stopped when the keys were let go. (A first version driven by timers alone
  wandered between 0.19 and 0.50 s.) Because arpeggiated notes are not in `held`, a lesson step cannot
  check which note is sounding, only the settings and the keys pressed. Lesson C8.4 "The arpeggiator".
- **Studio tab: the DAW begins with the drum programmer (17 Nov 2026, owner's request; "we can use elements of
  the DAW in lessons").** `src/daw/drums.ts` is the pattern as plain data and maths (eight drums, 16 or 32
  steps, each cell off / soft / normal / accent; tempo 60-200, swing 0-75% delaying every second step; mute,
  solo, level per row; `strikes(p, from, until)` is the one place that decides what is heard and when;
  `STARTERS` are five common shapes, not anyone's recorded beat; `tidyPattern` makes stored data safe).
  `src/daw/kit.ts` makes every drum from oscillators and noise at the moment it is struck: **no samples, our
  own recipes, not a model of any drum machine, not tuned by ear** (a closed hat cuts a ringing open hat).
  `src/daw/machine.ts` hands each step to the audio clock about a tenth of a second ahead and reads the
  pattern afresh every step, so edits and tempo changes are heard while it plays (`retime` keeps the current
  step's place). `src/ui/DrumGrid.tsx` holds `useDrumMachine` and `DrumGrid` (reusable; `lanes` shows only
  chosen drums, for a lesson); `src/ui/DawView.tsx` is the tab: Play/Stop (Space), tempo, swing, 1 or 2
  bars, click to place, drag to paint, Shift-click or right-click for strength, a moving step marker,
  starting points, and patterns saved by name in the browser (`src/daw/store.ts`, `patchwalk.pattern.v1`
  and `patchwalk.patterns.v1`; not yet with the account). Measured in a browser: kicks exactly 0.4839 s
  apart at 124 bpm and 0.4000 s after changing to 150 while playing; edits, save and reload worked.
  **Not heard by anyone.** It has its own audio context, separate from the practice synth: joining them
  (one clock, the synth as an instrument, a mixer) is the next piece. Not built: choosing or shaping each
  drum's sound, notes for the synth (piano roll), chaining patterns, effects, and any lesson that uses the grid.
- **Studio: your own drum sounds, and genre starting points (17 Nov 2026, owner's requests).** The ♪ button
  on a drum's row opens its sound drawer: "Upload a sound…", "Use the built-in drum", a Tune slider (-12 to
  12 semitones: `tuneRate`, playback speed for a file, pitch of the tones for a built-in drum), and the
  learner's stored sounds to click onto that drum or delete. A file can also be dragged onto a row.
  `src/daw/samples.ts` keeps the files in the browser's IndexedDB (`patchwalk-samples`; 12 MB a file, 64
  files; `checkFile` says in words why a file is refused). (At first files never left the browser; since
  the Library tab they are also sent to the site's database, see below), so a pattern opened in another browser plays the
  built-in drum and says the sound is not there. A lane carries `sample` (the stored file's id) and `tune`;
  `Kit.load` decodes a file once and `hit` plays it whole (no trim, fade or start point yet).
  `GENRE_STARTERS` (Glitch-hop, Breakbeat, Psydub, Trip-hop, Dubstep half-time, Drum and bass, Two-step
  garage, Glitch stutter over two bars) sit under the basic starting points: common shapes for each style
  written for this page, not anyone's recorded beat. Checked in a browser with a generated WAV: a text file
  was refused with its reason; the kick row then played the file, not the built-in kick, 0.4839 s apart at
  124 bpm, at double speed with Tune at +12; it was still there after a reload; deleting it returned the
  drum to built-in. Not heard by anyone. **Agreed next piece: an Ableton-style pad rack** (a grid of pads,
  any number of sounds, per pad: start, length, fade, tune, level, pan, choke group; the step grid then
  programs the pads). Arrangement only, our own look, as with the synth.
- **Studio is now a small DAW: tracks, clips, a drum rack and the synth on tracks (17 Nov 2026, owner's request:
  "build the drum rack, then build the actual grid where i can open the synthesizer on tracks and build pads
  and also lay down drums"). This replaces the single-pattern page described in the two entries above; what
  they say about the kit, timing, samples and starters still holds.**
  - **Song** (`src/daw/song.ts`, pure, tested in `tests/song.test.ts`): `Song { name, bpm, swing, bars (4, 8,
    16 or 32), tracks }`, up to 8 tracks. A **drum track** owns `pads` and its clips hold `hits` (a row of
    steps per pad id; 1 or 2 bars). A **synth track** owns `patch` (the practice synth's whole `SynthState`)
    and its clips hold `notes` (`{ note, start, length, velocity }` in sixteenth steps; 1, 2 or 4 bars).
    Clips sit on whole bars and cannot overlap (`isFree`); `addClip`, `duplicateClip` (next free place),
    `moveClip`, `setClipBars`, `removeClip`. `songEvents(song, from, until, loop?)` is the one place that
    decides what sounds and when (hits and notes together; track and pad mute/solo). `clipPattern` /
    `withPattern` show a drum clip to the step grid as a `Pattern` and put it back (pads to the track, rows
    to the clip). `setSongTempo` writes the tempo into every synth track's patch. `SOUNDS` are five starting
    sounds for a synth track (Soft pad, Bass, Pluck, Lead, Plain saw): our own settings.
  - **Drum rack** (`src/ui/studio/DrumRack.tsx`; `Pad` in `drums.ts`): up to 16 pads in a 4-wide block; a
    pad plays a built-in drum (chosen from a menu) or one of the learner's sound files, with name, start,
    length, fade out (files only; `padWindow`), tune, level, pan and a choke group (1 to 4: pads of a group
    cut each other; the two hats start in group 1). A file's shape is drawn with the part that plays lit.
    Files can be dropped on a pad. The step grid (`src/ui/DrumGrid.tsx`, now only a component) has a row per pad.
  - **Transport** (`src/daw/transport.ts`): one `AudioContext` for everything. One `Kit` for all drum
    tracks, a gain per track (level, mute, solo), and **one synth `Engine` per synth track on the shared
    context** (`Engine` takes a destination now; `stopScheduled` lets go of notes when the song stops).
    Steps are handed to the audio clock 0.12 s ahead; notes go through `engine.playAt`. "Loop the open
    clip" plays only that clip's bars. In development it is on `window.__patchwalkTransport`.
  - **The synth on a track** (`src/ui/studio/TrackSynth.tsx`): `useSynth(host)` can now be given an engine,
    starting settings and an `onChange`, so the same hook and the lessons' whole-synth panel (`SynthPanel`,
    exported from `PlayView.tsx`) edit a track's sound; letter keys play it live; saved sounds load into it.
    The synth's own tempo knob is overridden by the song. **Class names `synth` and `rack` belong to the
    synth's skin: do not reuse them** (the track grid uses `k-drums` / `k-synth`, the drum rack `drack`).
  - **Piano roll** (`src/ui/studio/PianoRoll.tsx`): C2 to C6, click to add a note (drag right for length),
    drag to move, drag the right end to resize, double-click or right-click to remove; every note is 100
    loud for now.
  - **Track grid** (`src/ui/studio/Arrangement.tsx`): tracks down the side (name, M, S, level, delete),
    bars along the top, + on an empty bar adds a clip, clips show a small picture of their contents, a
    play line moves across. Songs are kept in the browser (`patchwalk.song.v1` as you go,
    `patchwalk.songs.v1` saved by name, 20 at most; not with the account). A first visit gets an example
    song built from the pattern the learner had before.
  - Measured in a browser: kicks 0.4839 s apart at 124 bpm; the synth chord's first note started at exactly
    the same clock time as the first kick; a pad with Start 50%, Length 40% on a 1 s file played from 0.5 s
    for 0.2 s; a looped one-bar clip repeated every 1.935 s; a note was added in the roll by dragging;
    the whole synth opened on a track; everything survived a reload. **Nobody has heard any of it.**
  - Not built: note loudness in the roll, copy/paste, automation,
    effects per track, a master meter, export to a sound file, dragging clips, lessons that use the Studio.
- **Studio: undo, recording, saved breaks and racks, MIDI files (17 Nov 2026, owner's request: save "full
  breaks" and racks, "in the same format that ableton takes so that they can be transitioned back and
  forth").** **What was answered and must stay honest: only Standard MIDI Files move both ways.** Ableton's
  own rack, preset, clip and set files (`.adg`, `.adv`, `.alc`, `.als`) are an undocumented private format
  and our synth is not an Ableton device, so none are written; never claim otherwise. A MIDI file carries
  notes and tempo, not sounds, swing, mutes or levels.
  - `src/daw/midi.ts` (pure; `tests/midi.test.ts`): `writeMidi` (format 1, 480 ticks a beat, a tempo track
    then a track per part), `readMidi` (any tick rate, running status, note-on at zero as note-off; film-frame
    timing refused), `hitsToMidi` / `midiToHits` (**pad 1 is C1, note 36, pad 2 the next key up, in pad
    order: where a DAW's drum rack keeps its pads; not the General MIDI drum map**; soft / normal / accent
    are 50 / 96 / 127 and read back by `hitOf`; drums on channel 10), `notesToMidi` / `midiToNotes` (snapped
    to sixteenths), `songToMidi`. In the Studio: "Download .mid" and "Bring in .mid" on the open clip (a
    file replaces the clip's contents and says how many notes did not fit), and "Download .mid" for the
    whole song. The files were read back by an independent parser (Python `mido`): right type, tempo,
    tracks, channels and notes. **Not opened in Ableton by anyone yet.**
  - Saved breaks and racks (`Break`, `Rack`, `withNamed`, `rackOnto` in `src/daw/store.ts`; keys
    `patchwalk.breaks.v1`, `patchwalk.racks.v1`, 60 each, browser only): a break is a drum clip's rows with
    its length, tempo and pad names, put back by pad order; a rack is the pads with all their settings,
    and loading one gives its pads the ids of the pads they replace so the track's clips keep their rows.
    A rack saved here remembers a sound file by its id, so it finds the file only in the same browser.
    Synth sounds, with their macros, are saved by the synth's own "My patches".
  - Undo and redo (`useStudio`: up to 100 earlier songs; changes within half a second of each other count
    as one, so a dragged slider is one step; Ctrl+Z, Ctrl+Shift+Z and two buttons).
  - Record (`rec` in `DawView.tsx`): while it is on and the song plays, a key played on a synth track
    (letter keys or MIDI; `useSynth`'s host takes `onNote`) is written into the open clip from the nearest
    step to the step it was let go, and a pad struck by hand is written as a hit. `Transport.position()`
    gives the place in steps and parts of a step, swing left out. Recording does not count in, does not
    record loudness for pads, and writes only into the open clip.
  - Checked in a browser: undo and redo put a hit back and forth; a clip downloaded as MIDI and brought
    into an empty clip gave the same 12 hits; a saved break filled a cleared clip; a key held while
    recording became a note in the roll; breaks and racks were still there after a reload.
- **Rides (17 Nov 2026, owner's request).** Two more built-in drums in `kit.ts`: `ride` and `ridebell`
  (`metal`: six square waves at ratios that do not line up, through a high-pass, with a long fall; the bell
  adds two sine tones). Our own numbers, not a model of any cymbal or drum machine, not heard by anyone.
  A new rack has nine pads, the ninth a ride (`DEFAULT_VOICES`); **a rack made before this keeps its eight
  pads: "Add a pad" and choose Ride or Ride bell from the Drum menu.** A "Ride groove" starting point was added.
- **Library tab, and Studio work kept in the database (17 Nov 2026, owner's request: "whatever samples we
  drop in gets saved to a database as well... a full blown database tab instead of just a walkthrough tab").**
  The "Walkthroughs" tab is now **"Library"** (`src/ui/LibraryView.tsx`): shelves for Walkthroughs (the old
  page), Sounds, Breaks, Racks and Songs. **This replaces "files never leave the browser" for Studio sound
  files: the owner asked for them to be stored and shared with everyone signed in.** (Rule 3 is about
  presets and is unchanged.)
  - Server: `src/store/library.ts` + `api/library.ts` (`list`, `get`, `put`, `remove`; keys
    `pw:lib:<kind>:index` and `pw:lib:<kind>:doc:<id>`, no expiry). **No call to Claude, so it needs the
    password and a signed-in account and no key; anyone signed in may add; only the adder or the owner may
    remove.** A sound is at most 2 MB (150 MB in all, 300 sounds) and its id is made from its bytes
    (`soundId`: `h` + 24 hex of SHA-256), so one file is one entry whoever adds it. Breaks, racks and songs
    are JSON up to 300 KB, one per person per name. Tested with a stand-in database
    (`tests/shared-library.test.ts`; **`tests/library.test.ts` is the book library's file: do not overwrite it**).
  - Browser: `src/guide/library.ts` (`libList`, `libGet`, `libPut`, `libRemove`, `soundHash`, `shareSound`).
    A sound file added in the Studio now gets the byte-made id, is kept in IndexedDB and, if 2 MB or under,
    sent to the library; the rack says which happened. Sounds kept before this are moved to byte-made ids
    on the next visit and their pads, saved songs and saved racks are rewritten (`renameSamples`).
    **A pad whose sound is not in the browser is fetched from the library once and kept** (`useStudio`), so
    a rack, song or break opens with its sounds on any computer. "Save this break", "Save this rack" and
    saving a song also put them in the library. The Library tab's "Add to my ..." copies an item into the
    browser's own lists after making it safe again (`tidyBreak`, `tidyRack`, `tidySong`); Sounds can be played.
  - Checked in a browser with a stand-in for `/api/library`: a dropped file reached the library; a break,
    rack and song were kept; each shelf listed them; after the browser's own sound store was wiped the pad's
    sound came back from the library. **Not yet run against the real database: whether Upstash accepts a
    value of nearly 3 MB (a 2 MB sound as text) is unknown.** If it refuses, the rack says the sound was kept
    in the browser only; the remedy would be Vercel Blob for the files (the owner would have to add it).
  - **More built-in drums** (`kit.ts`, chosen from a pad's Drum menu; not given pads of their own): crash,
    shaker, tambourine, cowbell, clave, finger snap, long sub kick, high and low conga. Our own recipes, not
    heard by anyone. A "Club pop" starting pattern and a "Big saw chords" starting sound were added.
  - Literature on drum patterns and breakbeat was searched for and listed in `docs/LITERATURE.md`
    (Hockman's McGill thesis on breakbeats, Butler's book and article, Witek 2014, the Groove MIDI Dataset);
    nothing was taken in. The owner's wishes for eastern drums and late-2000s club pop are in
    `docs/CURRICULUM.md`.
- **Studio laid out like Ableton's Arrangement View, with its shortcuts (17 Nov 2026, owner's request: "copy all
  of the ableton shortcuts into our studio... make this DAW look more like ableton and be organized like
  ableton").** `src/ui/DawView.tsx` was rewritten; root class `daw2` (flat neutral greys, dense, clips in
  their track's colour; all its CSS is under `.daw2` at the end of `styles.css`; it breaks out of the page
  column to about 1,560 px). **It is Ableton's organisation and a plain flat look in that spirit: no Ableton
  artwork, logo or fonts are used.**
  - **Layout:** a control bar (tempo and swing as number boxes, Click, position as bar.beat.sixteenth, play,
    stop, record, Loop, Draw, Keys, undo, redo, Shortcuts); a **browser** on the left (Sounds, Drums, Samples,
    Breaks, Racks, Songs: one click puts the thing on the selected track or clip; `Ctrl+Alt+B` hides it);
    the **arrangement** (`Arrangement.tsx`) with bars on the left and each track's name, on/off, solo, level
    and delete **at the right end of its lane**; a **detail view** along the bottom with **Clip** (piano roll
    or step grid, clip commands) and **Device** (the synth or the drum rack) tabs; a status line. A clip is
    added by **double-clicking** an empty bar. `TrackSynth` stays mounted in both tabs (`show`), so the keys
    play the selected synth track either way.
  - **Shortcuts (checked against the "Live Keyboard Shortcuts" chapter of the manual in the library):** Space;
    Home (play from the start); F9 record; Ctrl/Cmd+Z, Ctrl+Y or Cmd+Shift+Z; **Ctrl/Cmd+D duplicate**; Ctrl/
    Cmd+C, X, V; Delete; Ctrl/Cmd+A; Ctrl/Cmd+L loop the selection; Ctrl/Cmd+Shift+M insert a clip; Ctrl/Cmd+R
    rename; Ctrl/Cmd+S save; 0 deactivate (a clip, or with none selected the track); S solo; arrows (move
    notes; Shift+up/down an octave; Shift+left/right length; with no notes selected, move between tracks and
    clips); B draw mode; M computer MIDI keyboard; Z/X and C/V; Shift+Tab Clip/Device; Ctrl/Cmd+Alt+B browser;
    Esc. Each acts on the selected notes if there are any, otherwise on the selected clip. Each command is
    its own undo step (`studio.mark()`). **Not possible in a browser: Ctrl/Cmd+T (new track), and anything
    else the browser keeps for tabs and windows. Not built because the Studio lacks the thing: split (Ctrl+E),
    consolidate (Ctrl+J), quantize (notes are always on the grid), grid sizes (Ctrl+1 to 5), zoom, automation,
    Session View (Tab), groups.** The list is shown by the Shortcuts button (`KEYS`).
  - **Piano roll** (`PianoRoll.tsx`) now works as Live's does: with Draw off, drag on empty space selects notes
    with a box, click selects (Shift adds or removes), drag moves the selection, a right end resizes it,
    double-click adds or removes; with Draw on (B), click or drag writes notes and a click removes one.
    `noteKey`, `shiftNotes`, `stretchNotes`, `duplicateNotes` in `song.ts` are the rules (tested).
  - **Also new:** a clip can be switched off (`off`, silent but kept; `toggleClipOff`); `pasteClip`; a
    metronome (`transport.click`, `Kit.tick`); `useSynth`'s host takes `keysOff` (the M switch: with the
    computer keyboard off, letters are shortcuts, so S solos).
  - Checked in a browser: Ctrl+D, copy/paste, Delete and undo on clips; 0; Ctrl+Shift+M; Ctrl+A, click and box
    selection, Ctrl+D, arrows and Delete on notes; B, M then S, Shift+Tab, Ctrl+R, Ctrl+L; the browser filled
    a clip with a break and added a synth track. Cmd on a Mac was not tried (the test browser is Linux).
- **Studio: a break replaces only what is selected; several clips at once; upload in Samples (17 Nov 2026,
  owner's requests).** Clicking a break or a starting point in the browser replaces the selected drum clip
  and nothing else: **it does not set the song's tempo or swing, except when nothing else is written in the
  song** (`hasOtherMusic`: no hit or note outside the clips being replaced; the owner's rule). The status
  line says which happened. Shift- or Ctrl/Cmd-click selects more clips on the same track (`also` in `DawView.tsx`); a
  break then fills all of them in one undo step, and Delete and 0 act on all of them (`fillWith`,
  `targets`). The browser's Samples list has "Upload sound files…" (several at once; each is kept in the
  browser and sent to the library as before) and a × to delete one. Checked in a browser: with one of three
  clips selected only it changed and the tempo stayed; with two selected both changed and the third did
  not; one undo put both back; a saved break appeared under "Your breaks" and filled only the selected
  clip; two sound files and a text file gave two samples and a note.
- **Stock plugins: the device chain and the list (17 Nov 2026, owner: "lets build all of the stock plugins that we
  planned on implementing. make a list and we'll knock them out 1 by 1").** **`docs/STOCK_PLUGINS.md` is the
  list, the order and the recipe for adding one: read it before building the next.** Thirty numbered items
  taken from the Ableton manual's device list, each our own device doing the same job (never Ableton's code,
  sound or look; `like` names the Ableton device so a chain can be rebuilt there). Built so far: the chain
  itself and **1. Utility**. Every track has `devices` (up to eight) after its instrument:
  `src/daw/devices.ts` (specs, edits, `tidyDevices`, `chainShape`, and each device's maths such as
  `utilityMatrix`), `src/daw/fxnodes.ts` (`buildDevice`: the audio, each device wrapped so on/off crossfades
  with the untouched sound), `src/ui/studio/DeviceChain.tsx` (the row in the Device view) and an "Effects"
  list in the browser. `Transport` now runs instrument -> `ins` -> devices -> `outs` (level) -> master,
  rewires a track only when `chainShape` changes, and has `levels()` (left and right level in dB) for
  measuring. Measured for Utility in a browser: gain +6 and -12 dB gave 6.0 and -11.9; pan hard left
  silenced the right; flip-left with mono cancelled a centred sound; switched off, it changed nothing.
  **The owner wants these knocked out one at a time: after each, say what it does and what was measured.**
  **Batch of ten (17 Nov 2026, owner: "start on what you can"):** Three-band EQ, Eight-band EQ, Channel EQ,
  Compressor, Saturator, Overdrive, Auto pan, Chorus, Delay, Reverb (eleven devices now; the measurements
  are in `docs/STOCK_PLUGINS.md`). The EQs matched their drawn curves exactly; delay echoes land on the
  exact sample (a browser feedback loop is 128 samples late, cancelled in `delay()`); the compressor is
  within 1 dB of its maths and has no knee, meter or sidechain. A `ParamSpec` can be a menu, `log`, in a
  `group`, or shown `when`; a `DeviceSpec` can be `wide`, carry a `note`, and draw a curve (`CURVES`).
  `buildDevice(ctx, d, bpm)` works on an `OfflineAudioContext`, which is how each was measured. **Nobody
  has heard any of them.**
  **Sample-by-sample devices (17 Nov 2026, owner: "continue"):** the Compressor was rebuilt, and Glue
  compressor, Limiter, Gate and Crusher added (fifteen devices), on an AudioWorklet. `src/daw/dsp.ts` holds
  the code with no browser parts (`CompDsp`, `LimiterDsp`, `GateDsp`, `CrushDsp`, `compCurveDb`), so
  `tests/dsp.test.ts` runs exactly what makes the sound; `dsp.worklet.ts` wraps it (imported with
  `?worker&url`, which bundles it for the built site: checked with `vite preview`); `prepareDevices(ctx)`
  loads it and a chain marks itself `~` and passes such devices by until it has. Compressor, glue, limiter
  and gate show a "Turning down by" meter (`transport.reduction`). Measured: compressor within 0.03 dB of
  its rule; limiter exactly at its ceiling, 1.5 ms late. Not built: a sidechain. Next devices are listed
  under "Next" in `docs/STOCK_PLUGINS.md`.
  **Five more the same day (twenty devices):** Auto filter, Phaser and flanger, Echo, Filter delay
  (ready-made parts) and Resonators (`ResonatorDsp` in the worklet). Measurements in `docs/STOCK_PLUGINS.md`.
  **Four more (twenty-four devices):** Multiband dynamics, Drum bus and Shifter (worklet: `MultibandDsp`,
  `DrumBusDsp`, `ShifterDsp`) and Erosion (ready parts). The pitch shifter's known flaw: its strongest line
  can sit a few Hz off the interval (13 cents flat on an octave up). **The owner asked (17 Nov 2026) whether
  the handoff doc is kept up to date: it had not been for three batches. `docs/HANDOFF.md` now ends with a
  "State" paragraph for the devices; update it with every push that adds one.**
  **Seven more and the sidechain (thirty-one devices):** Beat repeat and Vinyl distortion (worklet), Amp,
  Cabinet, Pedal (ready parts), Spectrum and Tuner (`view` on the spec; `transport.analyser`; `detectPitch`
  and `nearestNote` in `dsp.ts`). The compressor's "Listens to" menu is a sidechain: its worklet node has a
  second input (`LiveDevice.side`) and `Transport.sync` plugs the chosen track's `ins` into it (before that
  track's effects and level), rewiring when the choice changes; a track's input is now unplugged only from
  its own chain (`first`), never from everything, so sidechain wires survive. Devices are told the tempo and
  when bar 1 began (`Dsp.clock`, `buildDevice(ctx, d, bpm, origin)`); `Dsp.run` takes an `Extra` (the block's
  first sample number and the side sound). **When checking the Studio page by script, loop bar 1: the
  example song is empty after its first bars, which reads as silence** (this cost an hour).
  **Note effects (17 Nov 2026):** Arpeggiator, Chord, Note length, Pitch, Random, Scale, Velocity:
  `src/daw/notefx.ts` (`NOTE_FX` specs with `midi: true`, `applyNoteFx`, `arpeggiate`, `toScale`, `dice`),
  a second chain `noteFx` on every synth track, shown above the synth in the Device view
  (`DeviceChain kind="note"`) and under the sound effects in the browser. `playedNotes` in `song.ts` is what
  `songEvents` plays (cached per notes array and chain); a note may now start part-way through a step.
  `tidyDevices(raw, "note")` keeps the two families apart. They change clip notes only: not live keys, not
  MIDI export. Every numbered item in `docs/STOCK_PLUGINS.md` is built except Dynamic Tube.
  **Closer to Ableton, first pass (17 Nov 2026; the owner reported the EQ's dots could not be dragged and
  asked to "continue to go through this daw and continue to get it functioning closer and closer to how
  ableton works": a standing instruction).** (1) The dots on every curve drag: `HANDLES` in `devices.ts`
  says what each dot changes (sideways frequency, up and down gain, or sharpness where there is no gain;
  wheel for sharpness; double-click for zero; arrow keys); `Curve` in `DeviceChain.tsx` handles the pointer;
  eight-band, three-band and channel EQ and the auto filter. (2) Clips drag in the arrangement: to another
  bar, to another track of the same kind, Alt to copy, right edge to change length (`placeClip` in
  `song.ts`; a ghost shows where it will land, red when it cannot). (3) Ctrl/Cmd+E splits a clip into
  one-bar clips and Ctrl/Cmd+J consolidates neighbouring clips (`splitClip`, `joinClips`; clips still sit
  on whole bars, so a split is at bar lines, not at a time marker). (4) A loudness lane under the piano
  roll sets each note's velocity (`setVelocity`; selected notes move together; notes are drawn fainter when
  soft; new notes take the last velocity set). Checked in a browser. **Still unlike Ableton, next
  candidates:** a time marker and free-length clips (clips are whole bars), zoom and grid sizes, a mixer
  with pan and meters per track, a master track, automation lanes, Session View, groups, track freeze,
  audio tracks, export to a sound file, note effects on live keys.
  **Closer to Ableton, second pass (17 Nov 2026, owner: "proceed"): mixer and export.** Every track has a
  pan (`track.pan`, a `StereoPannerNode` after its level) and a level meter under its fader
  (`transport.trackLevel`, `LevelBar` in `Arrangement.tsx`: green, amber within 6 dB of full, red over); a
  **Master** row under the tracks has the song's `volume` (`masterGain`; 85 is the starting place) and its
  own meter. **"Download .wav"** beside "Download .mid" saves the whole song as a 16-bit, 44.1 kHz stereo
  file: `renderSong` in `src/daw/render.ts` plays the song on a second `Transport` given an
  `OfflineAudioContext` (`Transport.render` hands over every hit and note at once), with a 2.5 s tail, and
  `encodeWav` in `wav.ts` writes the file; the status line gives its length and loudest moment and says if
  it clips. Checked in a browser: hard-left pan took the right side down 24 dB within the reading window,
  halving the master took about 6 dB off, the file opened in Python's `wave` as 2 channels, 16 bit, 18.03 s
  with sound in the bars that have clips, and drums alone, synth alone and synth through a limiter and
  reverb all rendered. **Limit: knobs moved by the synth's "slow" modulation (the 20 ms timer) stand still
  in an exported file, because the file is worked out faster than real time.** Nobody has listened to an
  exported file. Still unlike Ableton: a time marker and free-length clips, zoom and grid sizes, automation
  lanes, Session View, groups, sends and return tracks, audio tracks, note effects on live keys.
  **Closer to Ableton, third pass (17 Nov 2026): spectrum in the EQs, and automation lanes.** The owner
  reported that the EQ showed no frequency spectrum: every device with a curve now has a tap on its output
  (`buildDevice` makes an analyser when `CURVES` has the kind) and `Curve` draws the live spectrum faintly
  behind the curve while sound passes (20 Hz to 20 kHz, top is -12 dB, bottom -96). **Automation**
  (`src/daw/automation.ts`, tested in `tests/automation.test.ts`): every track has `auto`, up to four
  lanes, each `{ target, points }` with points as `{ at (sixteenths from the song's start), v (0 to 1) }`;
  straight lines between points, held before the first and after the last. Targets (`targetsOf`): the
  track's level, its pan, and every slider of every effect on it (`d:<device>:<param>`; not menus or
  switches; frequencies and times move in ratios). `automate(song, step)` gives the song as it stands at
  a place; `Transport.sync` uses it while playing (the pump sets `place` every 25 ms) and goes back to the
  knobs on stop; an exported file follows it too (the offline context is paused at every sixteenth).
  In the arrangement an **A** button on each track shows its lanes (`AutoLaneRow`): click to add a point,
  drag it (sideways only as far as its neighbours), double-click or Delete to remove, arrow keys to nudge;
  a menu chooses what the lane moves; "+ Automation lane" adds another. Checked in a browser: a level lane
  from full to silent across bar 1 took the drum track's gain 1.11, 0.68, 0.21, then 0.04 in bar 2, and
  back to the fader on stop; the exported file fell from -6.6 dB to -16.9 dB through bar 1 and was silent
  in bar 2. **Limits: sliders and faders do not move on screen while automated; the synth's own knobs and
  the note effects cannot be automated yet; lanes follow the song, not clips, so moving a clip leaves its
  automation behind; no curved segments; automating the reverb's decay rebuilds its room on every change.
  The owner also wants lessons on automation: not written.** Next candidates: a time marker and
  free-length clips, zoom and grid sizes, sends and return tracks, Session View, automating synth knobs.
  **Closer to Ableton, fourth pass (17 Nov 2026, owner: "continue with next candidates").** (1) **Automation
  reaches the synth's own knobs**: on a synth track the lane menu (now grouped: Track, Effects, Synth: Filter
  and so on) lists every continuous knob (`SYNTH_TARGETS`, ids `s:<knob>`; not tempo, random phase or reverb
  size). `automateTrack` writes them into the track's `patch` and hands back the same object while values
  stand still, so the engine is only told when something moved. (2) **Faders, pan and effect sliders are
  drawn where automation has put them while the song plays** (`live` in `DawView.tsx`, passed to
  `Arrangement` and the effect chain). The synth's own knobs do not move on screen yet. (3) **Zoom**: − and
  + beside "Tracks", or the + and − keys; five widths (`ZOOMS`, remembered as `patchwalk.zoom.v1`); zoomed in,
  the bars scroll sideways, the track column stays at the right and the view follows the play line.
  (4) **Return tracks and sends**: "+ Return track" adds up to two (`song.returns`, ids `ra` and `rb`; A
  starts with a reverb and B with a delay, both at Dry / wet 100); every track gets a send slider per return
  (`track.sends`, `sendGain`: 100 is the whole track, 50 a quarter; taken after the track's level and pan).
  `Transport.sync` treats tracks and returns as the same "strip" and keeps send wires in `sends`. Clicking a
  return row shows its effects in the detail view (`ret` in `DawView.tsx`); effects clicked in the browser
  then go onto it. Returns have no automation, no solo and no sends of their own. Checked in a browser: an
  automated cutoff ran 172 Hz to 5.9 kHz through bar 1 and went back to 1800 on stop while the drum fader
  moved 89 to 21 on screen; zoom widened the bars from 1308 to 1930 px with the track column still in view;
  a return was silent at send 0, -21.8 dB at 100, about 11 dB lower at 50, silent when switched off.
  **Nobody has heard it.** Next candidates: a time marker and free-length clips, grid sizes, Session View,
  note effects on live keys, synth knobs that move on screen, automation on returns.
  **The effect chain drawn like Live's device view, and the synth as a device (17 Nov 2026, owner: "make the
  audio effect chain area look identical to ableton", then "the synth shouldnt always be open under device").
  This changes the earlier "our own look" rule for this one area, at the owner's request: the chain copies
  the arrangement, proportions and colour scheme of Live's device view (checked against the device pictures
  in the manual in the library), all drawn by our own CSS and SVG. Still never used: Ableton's artwork,
  fonts or logo; and it is not pixel-identical, because our devices are not Ableton's devices.**
  `DeviceChain.tsx` and the `.chain` block in `styles.css`: a dark strip of one height (214 px; 150 for note
  effects); each device a grey rounded panel with a title bar (round orange on/off, bold name, small round
  buttons for earlier, later and remove, an "i" whose tooltip is the device's note); **`Knob`** (round, black
  track, cyan arc that fills from the top on two-way knobs, name above and value below; drag up and down,
  Shift fine, wheel, arrows, double-click or Delete to reset); switches as square buttons that turn orange,
  two to a cell; menus as boxes; settings flow in columns of three (`Cells`); a device with bands shows the
  open band's knobs on the left, the dark display in the middle with band buttons under it, and the rest on
  the right (`Body`); the "turning down by" meter is an upright bar. A device's title bar can be **dragged to
  another place in the chain**, effects can be **dragged in from the browser's list** (`DRAG_DEVICE`), a
  focused title bar takes Delete (remove) and 0 (on/off), and the empty end says "Drop Audio Effects Here"
  with a menu as the other way in. **The synth is the first device in a synth track's rack** (`lead` on
  `DeviceChain`, class `inst`): a small panel with Open / Close; the whole synth is drawn under the rack
  only while open (`synthOpen` in `DawView.tsx`, closed to start with), and the keys play the track either
  way. Checked in a browser: knob drag and reset, Delete, drag to reorder, drag from the browser, open and
  close. Real mouse dragging was checked with drag events sent by script, not by hand. Not done: the drum
  rack as a device in the row, small level meters between devices, typing a value into a knob.
  **`docs/ABLETON_GAPS.md` (17 Nov 2026, owner: "read the whole ableton manual and see what else we could
  add").** Four helpers read the manual in the library (pages 49-690 and 811-856; not the Push chapters)
  against the Studio and listed what it lacks, with page numbers and rough sizes; the file puts it in a
  suggested order (quick wins, the biggest limits, bigger pieces, deeper versions of our devices, missing
  devices, what a browser cannot do). **Choose the next Studio work from it and tick items off there.**
  **Quick wins from the gap list, first batch (17 Nov 2026, owner: "begin building").** (1) **Tap** beside the
  tempo (three or more clicks; `tap` in `DawView.tsx`). (2) **Note tools** on a synth clip (Reverse, Invert,
  ÷2, ×2, Legato; `reverseNotes`, `invertNotes`, `scaleTime`, `legatoNotes` in `song.ts`): they change the
  selected notes, or all of them when none is selected. (3) **×2 length** on any clip (`doubleClip`: twice as
  long, contents written again). (4) **Key**: `song.scale { root, name }` chosen beside the note tools; the
  piano roll lights the rows in the key and its key note more strongly (`inKey`; scales are `SCALES` in
  `notefx.ts`). No fold yet. (5) **Note chance**: `NoteEv.chance` (percent; left out means always); the lane
  under the roll switches between Loud and Chance by clicking its name; `songEvents` rolls a dice each time
  round (its last argument is the dice, for tests); such notes are drawn striped. An arpeggiator drops the
  chance; other note effects keep it. (6) **Play from a bar**: click a bar number (`Transport.start(from)`,
  `playFrom` in `useStudio`); **Shift+Space** plays on from the bar where the song was stopped
  (`transport.stoppedAt`); ignored while a loop is set. (7) **F1 to F8** switch tracks on and off. (8) A
  **search box** at the top of every browser list. (9) **Effects on the master**: `song.masterFx`; click the
  Master row to see and add them; in `Transport.sync` the first strip is `MASTER`, every other strip plays
  into its input and it plays into the master volume. The click and a struck pad with no track bypass it.
  (10) **Note echo** note effect (`n-echo`). Checked in a browser: tap gave a tempo, play started at bar 2,
  Shift+Space resumed there, F2 muted track 2, Invert and ÷2 changed the notes, the key lit 29 rows, a
  chance of 50 was written, search narrowed the list, and a Utility on the master at -6 dB took 5.5 dB off
  the whole song. **Nobody has heard it.**
  **Quick wins, second batch (17 Nov 2026, owner: "proceed").** (1) **Sidechain on the Gate and the Glue
  compressor**: each has a "Listens to" menu like the Compressor's (their worklets have a second input; the
  gate opens on the other track's level). (2) **Markers**: `song.markers [{ bar, name }]`, `setMarker`;
  right-click or double-click a bar number to name, rename or (empty name) remove; the name shows beside
  the number; a click still plays from there. (3) **Count-in**: pressing Record while stopped plays one bar
  of clicks first and starts at the selected clip's bar (`Transport.start(from, countIn)`; the position
  reads -1 during the count). (4) **Hear before loading**: a ▶ beside every drum and sample in the browser
  (`br-hear`). (5) **Fold** in the piano roll (shown when the song has a key): only the key's rows, plus any
  row that already has a note; `shown` / `rowOf` replace the fixed row arithmetic, and a dragged note moves
  by rows of the key. Checked in a browser: a marker was written and shown; after Record the position
  stayed at -1 for a bar and then ran; fold took 49 rows to 23 and a note added there was in key; a pad
  through a gate listening to the drums swung between -47 and -21 dB against -29 and -17 listening to itself.
  **A finer grid (17 Nov 2026, owner: "continue building features").** Notes no longer have to sit on
  sixteenths. A note's start and length are kept to twenty-fourths of a step (`FINE`, `snapStep` in
  `song.ts`), which holds thirty-seconds, sixty-fourths and their triplets exactly; `MIN_NOTE` (a quarter of
  a step) is the shortest note. The piano roll has a **Grid** menu (`GRIDS`: 1/4, 1/8, 1/16, 1/32 and the
  1/8, 1/16 and 1/32 triplets; remembered as `patchwalk.grid.v1`; held in `DawView.tsx` and passed down): it
  sets what a written or moved note snaps to, the length of a new note, how far an arrow key moves the
  selection, and where a recorded note lands. **Quantize** (button, Ctrl/Cmd+U; `quantizeNotes`, which also
  takes an amount the page does not offer yet) pulls starts onto the grid. A MIDI file brought in keeps its
  triplets (`midiToNotes`). Drum clips are still sixteen steps a bar. Checked in a browser: a 1/32 note
  landed on step 1.5, triplet notes on 2 and 2.667, an arrow moved one a triplet on, Quantize pulled all
  three onto sixteenths, and the notes were played 0.1815, 0.2419 and 0.4032 s into the bar at a step of
  0.1210 s, which is exactly their places.
  **Sampler (17 Nov 2026).** A synth track's instrument can be a sampler: one sound file played across the
  keys. `src/daw/sampler.ts` (`SamplerSet`: sample, root key, mode classic or one-shot, start, length, loop,
  fade in, fade out, tune, level; `samplerRate`: double speed an octave up, so higher notes are also
  shorter, there is no time-stretching; `playSample`), `SynthTrack.sampler`, `setSampler`,
  `src/ui/studio/SamplerPanel.tsx`. With a synth track selected, clicking a sound under Samples in the
  browser makes the track a sampler; its panel is the first device in the rack (the file's shape with the
  used stretch lit, a menu of sound files, knobs, One-shot and Loop, and × to go back to the synth). The
  track keeps its clips, piano roll, note effects, effects and automation. In `Transport`, `playNote` sends
  a note to the sampler or the synth, `samplerKey` plays keys held by hand, and a gate (`gates`) between a
  track's synth and its input is shut while the track is a sampler (the synth is still there because the
  keys' hook needs it). The sound file is fetched from the library like a pad's (`samplesUsed`). Measured
  in a browser with a 440 Hz file: 438.7 Hz on the root key, 880.2 an octave up, 220.7 an octave down,
  659.5 a fifth up; a letter key played it; the song played it; nothing was heard from the synth behind it.
  Not built: its own filter and LFO, loop crossfade, slicing a break onto pads, automation of its knobs.
  **Slicing, drum knobs, sampler automation (17 Nov 2026, owner: "proceed").** (1) **Slice onto pads**: a ✂
  beside each sound under Samples asks for 4, 8 or 16 and makes a new drum track with one pad for each
  equal slice and a one-bar clip that plays them in order (`slicePads` in `drums.ts`, `sliceToTrack` in
  `song.ts`). A pad's `length` is a share of what is left after its `start`, so slice i of n is
  100 / (n - i) percent; pad start and length now keep two decimals. Equal slices only: nothing looks for
  the hits. (2) **Decay and Tone on built-in drums** (`pad.decay` 25 to 400 percent of the usual ring,
  `pad.tone` -100 to 100 moving the noise and metal filters by up to an octave and a half; sliders in the
  rack for pads with no sound file; `ring` and `bright` in `kit.ts`). Our own choices, like the drums.
  (3) **The sampler's knobs can be automated** (`m:<knob>`: start, length, tune, fade in, fade out, level),
  listed in place of the synth's on a sampler track. Measured in a browser: a file of eight equal tones
  sliced in eight gave pads at 301, 598, 899, 1200, 1502, 1798, 2099 and 2401 Hz; a kick 0.7 s after the
  hit was silent as usual and at -37 dB with Decay at 400; a closed hat's spectrum centred on 7.2, 9.9 and
  17 kHz with Tone at -100, 0 and +100. **What can be automated now: a track's level and pan, every knob of
  every effect on it, every continuous synth knob or the sampler's knobs; since the next entry also returns and the master.
  Not: drum pads, note effects, menus and switches, the tempo.**
  **Automation: follows clips, returns and master, recording (17 Nov 2026, owner: "proceed").** (1) **A clip
  moved along its track takes its automation with it** (`carryAuto` in `automation.ts`, called from
  `moveClip` and `placeClip`; Alt-copy copies the points; what was drawn where it lands is replaced; a move
  to another track leaves the lines, because the settings there are different ones). **Lock auto** in the
  control bar (`song.lockAuto`) keeps automation where it is. (2) **Lanes on return tracks and the master**:
  an A button on each (`ReturnTrack.auto`, `song.masterAuto`; the master's first target is "Master
  volume"); `automate` moves `song.returns`, `song.volume` and `song.masterFx`, so playback and export
  follow them. `Strip` in `Arrangement.tsx` is what a lane row needs to know. (3) **Recording automation**:
  with Record on and the song playing, moving a fader, pan, effect knob, synth knob or sampler knob writes
  a point where the song has got to (`recordMoves`, through the wrapped `change` in `DawView.tsx`); a lane
  is made if the track has room for one. The knob's resting value changes too. Checked in a browser: a
  master lane took the master gain 0.89, 0.72, 0.55, 0.39, 0.24 through bar 1 and back to 0.9 on stop; the
  drum fader moved to 30 and then 70 while recording gave points at steps 5 and 10. **Not built: marking
  automated controls, a "back to automation" button after touching one, ready-made shapes, curves.**
  **Longer clips and automation shapes (17 Nov 2026, owner: "proceed").** (1) A note clip can be any whole
  number of bars from 1 to 16 and a drum clip 1 to 4 (`CLIP_BARS` in `song.ts`; `Pattern.length` is now any
  number; a saved break keeps up to 4 bars). The clip's length is a menu ("Clip length in bars"); a drum grid
  longer than 32 steps scrolls sideways (class `long`). Clips still start on a bar line. (2) Every automation
  lane has a **Shape…** menu (`SHAPES`, `shapePoints`, `drawShape` in `automation.ts`: Ramp up, Ramp down,
  Triangle, Sine, Square, Saw) that draws the shape over the selected clip's bars, or over the whole song
  when no clip is selected, replacing what was drawn there. Checked in a browser: a note clip set to 7 bars
  took a note in bar 6; a drum clip set to 4 bars showed 64 steps; a triangle over that clip gave points at
  steps 0, 32 and 63. Not built: clips that start or end off a bar line, splitting at any place, curved
  segments, marking automated controls.
  **Clips on beats, a time marker, curved automation, automated controls marked (18 Nov 2026, owner: "proceed
  with all of it").** (1) **Clips start and end on a beat** (a quarter of a bar: `BEAT`, `snapBar`, `okBars`,
  `placeName` in `song.ts`; `clip.start` and `clip.bars` are still in bars but may be 2.75 or 1.5). The
  arrangement's grid has four columns a bar; dragging a clip or its right edge moves a beat at a time; a
  double-click in a gap shorter than a bar makes a clip that fills it (`addClip`). `songEvents` finds the
  clip by the step, not the bar. A drum clip of 3 beats has 12 steps. (2) **Time marker**: a click on a
  track's lane or on a clip puts a dashed line on the nearest beat (`mark` in `DawView.tsx`, not saved);
  **Ctrl/Cmd+E cuts the selected clip in two there** (`splitClip(s, track, clip, at)`), or at every bar line
  when the marker is not inside it. Space does not play from the marker. (3) **Curved automation**: a point
  can carry `c` (-1 to 1), the bend of the line that leaves it (`bent`, `bendPoint`, `lanePath`); hold Alt
  and drag a line up or down to bend it, Alt and double-click for straight, or Alt+Up/Down on a point.
  Playback and export follow the bend. (4) **Automated controls are marked and can be taken over**: a
  fader or pan with automation is red, an effect knob with automation has a red square by its name
  (`marks` on `DeviceChain`). Moving such a control by hand while not recording switches its lane off
  (`movedLanes`, `overKey`; `over` in `DawView.tsx`, `transport.autoOff`, the third argument of `automate`):
  the control stays where it was put, its lane and mark go grey, and a red **Back to automation** button
  in the top bar switches every lane on again. Not saved with the song; an exported file always follows
  the automation. **Layout trap found on the way: a grid item narrower than its own text widened every
  column (the arrangement became 4,900 px wide); clips, slots and bar numbers now have
  `contain: inline-size`.** Checked in a browser: a clip dragged two beats sat at bar 1 beat 3, shortened
  to 3 beats, was cut in two at the marker; a bent level line held the gain at 0.075 for five steps and
  then rose to 1.09 by step 16; moving the fader held the gain at 0.5 and the button gave it back to the
  line. Not built: cuts off the beat, the synth's and sampler's own knobs marked, play from the marker.
  **Quick wins, third batch (18 Nov 2026, from the handoff's "next step").** (1) **Marker jumps**: |◀ and ▶|
  either side of the position go to the marker before or after (`markerFrom` in `song.ts`): playing, the song
  jumps there; stopped, the time marker is put there. (2) **Space plays from the time marker** when one is set
  (`act.play`; Esc takes the marker away, Home always plays from the start, a loop still starts at its own
  beginning). **A click on a clip sets the marker, so Space after selecting a clip plays from that click: when
  checking by script, press Esc first if the song should start at bar 1.** (3) **Random loud** among the note
  tools (`randomVelocity`: up to 20 of 127 either way a click, selected notes or all). (4) **Count-in** is a
  menu (none, 1, 2, 4 bars; `patchwalk.countin.v1`) and there is an **Overdub** switch (`patchwalk.overdub.v1`,
  on to start with): off, recording replaces, meaning the notes or hits the clip held are taken away as the
  song passes over them (an effect on `local` in `DawView.tsx`; what the take itself wrote is kept in `taken`,
  so a loop coming round does not wipe it). **With Overdub off, recording a fader move also wipes the open
  clip as the song passes: that is how replace works, and why Overdub starts on.** (5) **Sidechain on the
  auto filter** ("Loudness of": its follower listens to another track; a `Core` may now give `sideIn`, the
  input of `side` to plug into, 0 for an ordinary node and 1 for a worklet) **and on Multiband dynamics**
  (the other track is split into the same three bands and each band's compressor reads its own). (6)
  **Utility**: "Takes" (both sides, left only, right only, swapped; in `utilityMatrix`), Bass mono below a
  frequency (two Butterworth filters each way so the halves add back flat; the low half summed), Remove
  offset (a 10 Hz high-pass). **Saturator**: Colour (a band lifted or lowered before the curve) and Soft clip
  on the output (`softClip`: untouched to half level, never over full level). Measured in a browser: a
  left-only 60 Hz tone came out equal on both sides with bass mono at 300 Hz while 2 kHz stayed on the left
  (77 dB down on the right), and a sound the same on both sides was unchanged to 0.0 dB at 60, 300 and
  2000 Hz; an offset of 0.5 fell to 0.0000; soft clip held a peak of 2.0 to 0.9975 and left a quiet tone
  alone; colour of +6 dB gave +6.0 dB at its frequency and 0.1 at 100 Hz; an auto filter set to open by four
  octaves let a 4 kHz tone through at -36.5 dB with the other track silent and -1.9 dB with it loud;
  multiband left a 6 kHz tone alone with the other track silent or loud only in the lows, and took 16.5 dB
  off with it loud in the highs. On the page: the jumps, Space from bar 3, a 2-bar count-in, and a half-bar
  replace take that cleared the first eight steps of every row and came back with one undo.
  "Hear a note as you click or move it" was already there and is ticked. **Nobody has heard any of it.**
  **Lessons on all of this (owner, 17 Nov 2026: "we are also going to have to make lessons on all of these
  new features. this ableton course will be extensive").** Nothing is written and the lesson engine does
  not know the Studio; the plan is at the top of `docs/ABLETON_GAPS.md`. Every Studio feature needs one.
  **Two to-do lists, and both must be updated with every push (owner asked 17 Nov 2026 why the widget was
  behind):** `docs/TODO.md` (what the `/todo` pane in Claude Code reads) and the owner's "Patchwalk To-Do"
  page (https://claude.ai/artifact/7sHF6r2vvBuxa8DSkcfcPz, rows in its `todos` collection, written with
  `ArtifactData`). They are not copies of each other: the page also holds the owner's own tasks and the
  literature lists, so their counts differ. After a push: tick or add the line in `docs/TODO.md`, and add a
  done row (or update the open row) in the page's matching section.
- **"Walk me through it" (16 Nov 2026, owner's go-ahead with two rules of their own).** A second mode on the
  Ask tab (a switch, remembered): a how-to question becomes a walkthrough of steps shown one at a time.
  `api/walk.ts` answers two kinds of request: `plan` (one call with structured output over ten passages:
  title, tool, two to seven steps each with search words and a kind of `idea`, `maths` or `recipe`) and
  `step` (one call with citations over five passages found for that step alone). The browser asks for a
  step only when the learner reaches it, so a step never opened is never paid for. `src/library/walk.ts`
  holds the rules, all tested offline (`tests/walk.test.ts`):
  **(1) Sources apart from inference.** The model writes each paragraph under a label (DO, TEXT, SYNTHESIS,
  DISAGREE, MATHS, RECIPE, MISSING); **`labelBlocks` then decides the label shown from the citations, not
  from the model's word**: a "TEXT" paragraph with no citation is shown as "My synthesis" and marked as
  moved; an unlabelled paragraph is the guide's own; a formula, recipe or disagreement with no citation is
  flagged. The page shows "The text says" with the book and page, "My synthesis", "The texts differ" (for
  different claims, names, conventions or units: never blended), "The maths", "In Serum 2", "Not in the
  library". **(2) It ends in the learner's tools.** `cleanPlan` forces the last step to be a recipe in
  Serum 2 or Ableton Live (added if the model left it out, moved if misplaced; none only when the subject
  is not done in either), and `stepSearch` gives a recipe step **only that product's manual**
  (`TOOL_BOOKS`). A maths step keeps the book's formula as written and explains every symbol and unit.
  Walkthroughs are kept in the browser (`patchwalk.walks.v1`, `src/guide/walk.ts`, 30 at most, with the
  steps read and ticked; not yet stored with the account) and outlines and steps are also remembered for
  everyone in the database (`walkKey`). Ordinary answers were told the same two things in words ("My
  reading:" for a conclusion no document states; say where documents differ). Same password and who-pays
  rules as the rest of the guide. Checked in a browser with a stand-in reply. **Not yet run against the
  real API: whether the model keeps to the labels, and how good its plans are, is unknown until the owner
  tries it.** Not built: marks drawn on a step's pictures automatically, Rift as a recipe tool, a check
  that the learner really did a step.
- **"Draw this" on a walkthrough step (16 Nov 2026, owner's go-ahead).** A button under any written step
  asks the guide, in one paid call with structured output (`kind: "draw"` on `api/walk.ts`), to **choose** a
  drawing from a fixed catalogue and give its settings; **the app draws it, the guide never writes a
  picture or code** (the standing diagram rule). `src/library/draw.ts`: the catalogue (`formula`,
  `envelope`, `filter`, `harmonics`, `lfo`, `chain`, `none`), the instructions, and `cleanDrawing`, which
  makes the choice safe or turns it into "nothing to draw" with the reason. `src/library/formula.ts` is a
  small calculator that reads plain arithmetic into a function (`compile`): nothing is ever handed to the
  JavaScript engine, and names such as `constructor` are refused. `src/ui/Drawing.tsx` draws: a formula as
  a graph with a slider per symbol, a readout of the result, and a choice of which symbol runs along the
  bottom; the ready-made pictures from the synth's own maths (`filterResponseDb`, `lfoValue`), also with
  sliders. Every drawing is tagged "The guide's drawing" and says it is not from a book; each slider says
  whether it starts at a value the step's text states or at the guide's choice, and a value pulled into
  range stops counting as the text's. The model is sent the step as labelled text (`stepForDrawing`). The
  drawing is kept with the step in the saved walkthrough and in the shared memory. Checked in a browser
  with a stand-in reply; **not yet run against the real API**. Not built: "try it on the practice synth"
  with the step's settings, and anything with a physical shape (the guide is told to answer `none`).
- **Drawings must be real models, not words in boxes (owner, 16 Nov 2026).** The owner saw a "chain" drawing
  (boxes joined by arrows) on a sidechain step and called it "text slop": they want an actual picture or an
  interactive model. **The `chain` kind was retired**: the guide can no longer choose it, the instructions
  now say a drawing must show something the words cannot and that none is better than a pointless one, and
  a walkthrough saved with one shows a note and "Choose a different drawing". In its place for that case:
  **`duck`, a working model of sidechain ducking** (`DuckModel` in `Drawing.tsx`): a kick on each beat and a
  held bass, the bass's level drawn from `duckGainLooped` (`draw.ts`: down by a set amount over the attack,
  held for the kick, back up over the release; a simplified picture, and the page says so), **played as
  sound** from the same curve (rendered with an `OfflineAudioContext` and looped), a line showing where the
  sound has got to, a switch to hear it with the ducking off, and sliders for amount, attack, release and
  tempo. **The rule for new drawing kinds: each is a hand-built model that moves or sounds; if none fits,
  the guide draws nothing. Generated images are still not used for technical drawings.** Candidates not
  built: a compressor's input-against-output curve, echoes on a timeline, FM sidebands, detuned voices
  beating, wavefolding. Also fixed from the same screenshot: a step on sidechaining a bass had been given a
  Funktion-One bass cabinet's spec sheet and photograph, because "bass" and "sub" are loudspeaker words;
  `stepSearch` now keeps the loudspeaker books (`SYSTEM_BOOKS`) out of any walkthrough that ends in a synth
  or a DAW. Checked in a browser (drew, played, the play line moved, the switch changed the picture); the
  sound was not measured and has not been heard by anyone.
- **Five more playable models for "Draw this" (16 Nov 2026, owner said "build").** `src/ui/Models.tsx`
  (`MODELS`, by drawing kind) with the maths in `src/synth/models.ts` (tested in
  `tests/models-maths.test.ts`): **compressor** (input-against-output curve with the threshold marked, and
  four hits, loud and quiet, shown and heard before and after; `compOutDb`, a sharp corner with no attack
  or release, which the page says), **delay** (one sound and its echoes on a three-second timeline;
  `echoes`), **beating** (two saws a few cents apart; the picture is the pair's loudness swelling;
  `beatsPerSecond`), **fm** (the partials FM adds either side of the note, from Bessel functions;
  `fmPartials`), **fold** (a sine folded back, its cycle and its harmonics; `foldBack`, `foldDrive`: the
  plain triangle fold, not a circuit). Two ways of sounding: `useLoop` works a fixed pattern out whole with
  an `OfflineAudioContext` and loops it with a play line (compressor, delay, and the ducking model's own
  copy of the same idea); `useLive` holds a note on live audio nodes so the sliders change it as it sounds
  (beating, FM, fold). Shared drawing pieces moved to `src/ui/drawkit.tsx`. Sliders now show a chip only
  when a value comes from the step's text ("starts at the text's value"); the "guide's choice" chip on
  every slider was clutter. Checked in a browser: each drew, played without errors, and its picture
  followed its slider. **The sound was not measured and nobody has heard them.** Eleven kinds of drawing
  now: formula, envelope, filter, harmonics, lfo, duck and these five.
- **"Build this lesson in Serum 2" (16 Nov 2026, owner's request).** A button on every practice lesson that
  has steps (not the "Notes and chords" chapter, and not lessons that are only by-ear rounds) rewrites the
  lesson as steps to follow in Serum 2, so the learner can mimic it there. The owner asked whether to build
  on demand with a database or all at once; **chosen: on demand, built once, kept in the database with no
  end date** (the build session has no API key, so it cannot pre-build them; an owner-only "build them all"
  could be added). `api/serum.ts` + `src/library/serum.ts` + `src/guide/serum.ts` + `src/ui/SerumVersion.tsx`.
  The browser sends only the lesson's title, chapter, outcome and each step's `do` text (`lessonForSerum`;
  the server cannot import lesson files). The server makes one search per step **in the Serum 2 User Guide
  only** (up to 14 passages) and one call with citations; the reply is labelled and checked by the same
  `writeStep`/`labelBlocks` as a walkthrough step (DO "Step N: ...", RECIPE, TEXT, SYNTHESIS for the guide's
  own mapping of our controls onto Serum's and for any value, MISSING when the pages do not cover a step or
  Serum has no such control). Stored under `serumKey(lesson, the exact wording sent)`, so a reworded lesson
  is built afresh and nobody can overwrite what honest browsers are served. **Opening a lesson asks, for
  free, whether it is built (`peek`); a built one is given to anyone signed in; building is one paid call
  under the usual who-pays rule** (a friend without a key gets 402 until the owner or a key-holder has
  built it), tested against the real endpoint with a stand-in database. The panel says it was written from
  the manual and not checked in Serum 2 by a person, and offers "Build it again". Checked in a browser with
  a stand-in reply. **Not yet run against the real API: how well the guide maps our synth's steps onto
  Serum's controls is unknown.** Lessons using things Serum may not have under our names (our generated
  wavetables, our own warp modes) should come back with MISSING or SYNTHESIS notes; watch for invention.
- **Shared library of walkthroughs, and a "Walkthroughs" tab (16 Nov 2026, owner's request: whatever the owner
  or their friends have generated is saved so everyone can use it, with a tab to go through it).**
  `src/store/walks.ts`: one walkthrough per question (`walkId`, a hash of the tidied question), kept in the
  database under `pw:walks:doc:<id>` with a list of summaries in `pw:walks:index` (newest first, 300 at
  most, **no expiry**: unlike the 90-day answer memory these stay until the owner removes them).
  `api/walk.ts` puts every outline (`savePlan`), written step (`saveStep`) and drawing (`saveDraw`) there
  as it is made, under the first asker's account name; the same outline asked again keeps what was written,
  a different outline replaces it. Three free requests: `list`, `open` and `remove`. **They need the
  password and a signed-in account but no key; `remove` is the owner's only. Writing a step that nobody
  has opened yet is still a paid call under the usual who-pays rule** (a friend without their own key gets
  402), which a test checks against the real endpoint with a stand-in database. A database that fails
  never stops an answer. `WalkLibrary` in `src/ui/Walkthrough.tsx` is the tab (search by title, question,
  tool or person; steps written, drawings, who asked, when; the owner sees Remove); `WalkPlayer` is the
  shared step-by-step viewer, used there and on the Ask tab. A plan's reply carries the shared `id`, which
  the browser's copy uses as its own id; `joinShared` joins the library's copy with the browser's.
  **Older walkthroughs are taken in automatically** (owner asked how to save one made before the library):
  on opening the Ask or Walkthroughs tab the browser offers each walkthrough it holds that has no library
  id (`shareLocal`, request kind `share`). **The server trusts nothing the browser sends as content**: the
  outline must equal the one the site remembers making for that question, and each step and drawing is
  taken from the site's own 90-day memory (`walkKey`). No paid call. One taken in gets the library's id and
  keeps the browser's place and ticks; one the site no longer remembers is offered once and left alone.
  **A person's place and ticks are still kept per browser, not with the account.** With no database the
  tab says so. Checked in a browser with a stand-in; **not yet run against the real database.**
- **Side threads on a walkthrough, by highlighting (16 Nov 2026, owner's request and design choice).** The
  owner wants to turn a walkthrough into a conversation and split off into side topics when rabbit-holing,
  with it obvious where each one stems from and everything collapsible; they chose **highlighting text**
  as the way in. Highlight any words in a step, or in an answer inside a thread, and an "Ask about this"
  button appears; asking starts a thread that hangs off those words. `src/guide/threads.ts` is the data and
  rules (tested in `tests/threads.test.ts`): a `Thread` has its step, the `quote` it stems from, an optional
  `parent` (thread and which answer), its turns and a colour; three levels deep at most (`MAX_DEPTH`), 40 a
  walkthrough; **`historyFor` sends only a branch's own path** (each thread above it up to the answer it
  left from, then its own turns), never a neighbour's; `contextFor` puts the step's title and the quote in
  the first line, which is what steers the search. Questions go through the ordinary `api/ask.ts`, so the
  same citation rules and who-pays rule apply; one paid call each. `src/ui/Threads.tsx` draws them: indented
  under what they came from with a dashed line in the branch's colour, the header showing the quote and the
  first question; only the branch being read is open, the rest fold to one line; a trail ("Step 1 › … › …")
  with "Back to the walkthrough" folds everything; a dot marks steps that have threads. **The quoted words
  are coloured in place with the browser's highlight layer** (`CSS.highlights`, `paintQuotes`; matched with
  all spacing removed, so a quote across several pieces of text still marks; browsers without it mark
  nothing). Elements whose text can be asked about carry `data-anchor` (`step`, or `t:<thread>:<turn>`).
  Threads are the learner's own: kept on the walkthrough in the browser (`walk.threads`), **never put in the
  shared library**, and kept by `joinShared` only while the steps are the same. Checked in a browser with
  stand-in replies. Not built: threads stored with the account, sharing a thread, asking about the whole
  walkthrough without highlighting, highlighting on touch screens.
- **Literature taken in on 20 Nov 2026 (the owner uploaded seventeen documents and a dataset; list with ids in
  `docs/LITERATURE.md`, "Taken in on 20 Nov 2026").** The library now holds 38 texts (4,069 passages).
  New tools: `scripts/ingest_pdf.py --png` (lets poppler decode every picture; for old manuals) and
  **`scripts/library_post.py`** with three finishing steps: `renumber <book> <offset>` (the book's own page
  numbers, front matter dropped, picture files renamed), `chapter <book> "<name>"` (one chapter for a
  paper), and `figures <book> <offset> <pdfs...> [--graphics]`, which **renders a whole page as a picture
  when it has a figure caption but no embedded picture** (most papers and Puckette's book draw figures as
  lines; the VL1 manuals' diagrams are one-bit "stencils"). Such entries carry `whole_page: true` in the
  picture index. Done by hand, not by script: Puckette's chapters (read from its running headers, which
  were then removed from the text; index pages dropped), the VL1 manuals' chapters (from "Getting Started ●
  Voice Selection" lines; contents and index pages dropped: a test forbids a section called "Index"),
  the 1920 Nature letter (typed from the scan, page 500), and the first two lines of Karjalainen's paper.
  `RELATED` in `search.ts` gained tabla, aliasing and supersaw; `SYSTEM_BOOKS` gained "knowles". Checked on
  the real library: questions on FM sidebands, the supersaw, microtiming, bass and rhythm, plate reverb,
  aliasing, the tabla, breath pressure on the VL1, wavetables and the piano hammer each reached the right
  new text, and Ableton and Serum questions still land in their manuals. **Not yet asked on the live site.**
  The Groove MIDI Dataset is kept as the publisher's zip in `library/data/groove-midi/` (CC BY 4.0: credit
  it in anything made from it); it is not bundled with any server function and nothing reads it yet.
  **Uploaded PDFs are not in the repo; only the extracted text and pictures are.** Still missing from the
  owner's list of six papers: Frühauf, Kopiez and Platz. The Physical models tab stays on hold: the owner's
  condition was Fletcher and Rossing, which has not arrived, though Karjalainen, Bank and the VL1 manuals
  now give sourced material for strings, piano and wind models.
- **Sources shelf in the Library tab (20 Nov 2026, owner: "we need a tab in patchwalk where you can view all of
  these sources like a database").** The Library tab's first shelf is now **Sources**: a table of every text
  (title, by, year, kind, subject, pages, pictures) that sorts and filters, opens to show what a source covers,
  a "keep in mind" note, its chapters with page ranges, and a search inside it; and a search inside all of
  them. `src/library/catalog.ts` (shared by page and server; `.js`-free, no imports): `SOURCES` (the card for
  each text: by, year, kind, topic, about, added, note; **a test fails if a text in `library/` has no card or
  a card has no text, so add a card with every new book**), `summarise` (a book as counts and chapters, none
  of its words), `snippet`. `api/sources.ts` (`list`, `search`; password and a signed-in account, no key, no
  call to Claude; refused on the deployed site with no database), `loadCatalog` in `api/_library.ts`,
  `src/guide/sources.ts`, `src/ui/Sources.tsx`. **The texts are not shown whole, by design: a search returns
  at most twelve excerpts of about 320 characters, one per page, with book, page and chapter, and there is no
  request that returns a page.** This keeps the rule that library text is never shown in full; the owner was
  told and can ask for a page reader. Pictures are not shown on this shelf either (many are whole pages).
  Checked in a browser: 38 rows, a search for "supersaw detune" led with the thesis's page 8, a hit opened
  its source, the subject filter and the sort worked, and a search inside one book stayed inside it.
- **Lesson ideas from the new literature (20 Nov 2026, owner: "go through each individual one and pull/create
  a lesson for each one of these concepts that you deem useful and not repetitive").** Eight helpers each read
  a group of the texts taken in that day in full, against the list of existing lessons, under strict rules
  (only what the text says, with pages; nothing about what sound does to a listener beyond what was measured;
  no artist's technique). **`docs/LESSON_IDEAS.md` holds the result: 305 ideas (about 280 distinct), each with
  pages, where it is done, what must be built first and its value; then what is worth building with the exact
  numbers the papers give (Dattorro's reverb, the seven-saw stack, the FM recipes, the five-cell fold), a
  suggested order, and cautions.** Nothing in it is built. The numbers were copied from helpers' reports of
  extracted text: check each against the PDF's page picture before coding. Found on the way: the Raman letter
  never says "tabla"; Dattorro has no shelving filter, DC blocker or size control; neither string paper gives
  enough numbers for a sourced guitar or piano (values come from calibration against recordings); the VL1
  manuals give no numbers for the model itself; the groove studies found small or no effects for microtiming,
  swing and syncopation and a large effect of the listener's own taste.
- **Ten new chapters in the course map (20 Nov 2026, owner: "are there any new holes in our lesson plan",
  then "yes, and write new lesson ideas for the gaps that aren't covered").** `docs/CURRICULUM.md` ends with
  "Added on 20 Nov 2026: ten chapters that fill holes found while reading the new literature": Reading your
  tools; When digital sound goes wrong; Expression; Rhythm rebuilt on evidence (replaces track H's order);
  One delay, many effects; Bells, metal and stretched tones; Fixing a broken sound; Tuning; Voices; Sampler
  basics then grains; plus what can be taught now in Hearing and in Mixing. 162 lesson rows. **A code in
  square brackets there (such as [A1]) is an entry in `docs/LESSON_IDEAS.md`, not a lesson id of the map.**
  52 rows are new lessons written for what the texts did not cover: 41 are measurable facts about our own
  tools, 4 need a small build, 7 need a source. **Hearing lessons with no text behind them are "observe
  first": the learner does the test and the page explains nothing yet and says so.** Still with no source:
  most of hearing (Moore first) and all of mixing and mastering. Nothing in the section is built.
- **Lessons from the literature begin: "Reading your tools" (20 Nov 2026, owner: "begin writing lessons").**
  `src/course/lessons/tools.ts` (`TOOLS_CHAPTER`, chapter key `"V"`, listed after Filters; ids CV.1 to CV.8):
  CV.1 Peak and average; CV.2 Decibels count how many times; CV.3 The same reading is not the same loudness;
  CV.4 Adding two sounds: six, three or nothing; CV.5 Same ingredients, different picture; CV.6 Reading a
  spectrogram; CV.7 Brightness lives in jumps and corners; CV.8 Hunting harmonics with a narrow band. The
  facts are Puckette's (library id `puckette-electronic-music`: peak and RMS pp. 3-4, decibels pp. 5-6,
  adding signals pp. 10-11, the swept band-pass p. 258, jumps and corners pp. 295-307; the file's header
  lists them); CV.5 and CV.6 are facts about our own views. **Where the ear is the judge (CV.3, CV.5) the
  step asks the learner to listen and claims nothing more than the book does.** Quizzes are in
  `quiz/quiz-g.json` and why-lines in `why/why-g.json` (new files for lessons from the literature); each
  lesson has a walk-through test (`from(...)` in `WALKS` gives where a step began, for steps that check a
  change). No demos, ear checks or "in Serum" lines yet.
  - **The level meter shows two readings**: peak and average (RMS), "-22.8 dB peak · -25.8 average", with a
    white line on the bar for the average (`levelsDb` on the engine, `levelsOf`, `Meter` in `Views.tsx`).
  - **Engine fix found on the way: every oscillator of a note now starts at one instant** (`together`,
    `START_LEAD` of 4 ms in `build`). Before, each was started "now", which the browser does not line up:
    when it was busy building a new wave, Osc B began one or two audio blocks after Osc A, so switching B on
    during a held note gave anything from +6 dB to a partial cancel. Notes sound 4 ms later than before.
  - Measured on the engine (20 Nov): a sine reads 3.0 dB between peak and average on every key; volume down
    6 and 20 dB moved both readings by exactly that; two identical sines read +6.0 dB, half a cycle apart
    silent, a fifth or an octave apart +3.0 dB average with the peak still at +6; a narrow band-pass on a
    harmonic of a saw read about 19 dB above the gap between harmonics (37 dB with the steep slope), and a
    square's second harmonic was 20 dB under where the saw's was. CV.4 was clicked through in the real page
    with the real knobs: every step passed and the meter read the predicted numbers.
  - **Known oddity the lessons work around:** the scope and meter read the sound after the whole chain, which
    bends the flat parts of a saw or square (their peak-to-average gaps are 11 and 6 dB here, not the
    textbook figures), so no lesson quotes a gap for any shape but the sine, and CV.7 says the scope bends
    flat parts. The cause was not tracked down.
  - Not buildable yet from that chapter of the map: the two frequency rulers (needs a linear/log switch on
    the spectrum), analyser skirts and the long look (need our own FFT with window controls), the click
    test, a checkpoint. **Next chapters in order: "When digital sound goes wrong", "Expression", "One delay,
    many effects" (`docs/CURRICULUM.md`). Nobody has taken these lessons or heard them.**
- **Genre histories begin in the course map (20 Nov 2026, owner: "research and put a bunch of lessons on the
  history of each genre im into. lets start with nu-skool breakbeats").** `docs/CURRICULUM.md` ends with
  "Track G-H: the history of each genre": rules for history lessons and 28 nu-skool breaks lessons in four
  parts (where a break comes from; Britain before nu-skool; the nu-skool years; after the peak), each with
  its source and the playable lesson it hands over to. **Researched on the web, not from the library:
  fifteen Wikipedia pages were read; the primary pieces (Resident Advisor 2002, a founder's own page,
  MusicRadar, two retrospectives, the awards' winners list) could not be opened because the session's
  network does not allow those sites.** The section lists what is thin (who coined the name, the 1996 or
  1998 start, the decline, which no read source describes). **Open with the owner: history lessons must
  name people, clubs, labels and records for what they did and when, which the "never name artists in the
  app" rule forbids; the section proposes that exception and still forbids saying how anyone made a sound.
  Do not build a history lesson until the owner has said yes.** Nothing is built. Next genres when the
  owner names them, in the same shape.
- **Paths (owner's idea, 20 Nov 2026; planned, not built).** The owner wants the finished course to show
  which lessons must be completed and mastered to be a given level of producer ("what the average house
  artist pulling 1m listeners a month knows and nothing more"). Written up at the end of
  `docs/CURRICULUM.md` ("Paths"): a path is a named, ordered subset of lessons, **defined by what a finished
  piece of work needs, never by what a real person knows or by listener numbers** (no source ties skills to
  audience size, and the rules forbid claims about artists). Awaiting the owner's reply to that framing.
- **What the plan was missing, and the owner's answers (21 Nov 2026).** Asked how much of "all things music"
  the plan lacks, the owner was given fourteen gaps and decided each: **yes** to "put it together"
  walkthroughs at set points in the lessons plus a section on finishing tracks (their own idea); **later**
  for studying reference tracks; **no** to recording and microphones, and **no** to playing live and DJing
  (do not plan either); **yes** to room and monitoring, vocals (not recording them), melodies and bass lines,
  groove across a track, choosing sounds, resampling, working with others, the business side, and other
  tools. `docs/CURRICULUM.md` ends with the result: milestones W1 to W10 (W1 to W4 can be written now),
  ten finishing lessons, and nine outlined tracks, each line marked "now" or "source". Books for the thin
  tracks were researched the same day (`docs/LITERATURE.md`, last section: about 30, three of them free;
  six listed from memory and marked unconfirmed; none read). Nothing is built.
- **Twenty-three more wavetables (21 Nov 2026, owner: "we have nothing compared to serum").** `TABLES` in
  `params.ts` now has 33 tables plus Off, all built by code (still never a maker's table data):
  `tilt`, `oddeven`, `ladder` (one harmonic per frame), `scatter` (a saw's harmonics with their timing
  turned: the picture changes, the strengths do not), `pwm`, `tricorner` (Puckette pp. 305-307), `syncsaw`,
  `bits`, `rect`, `power`, `blit` (Stilson and Smith 1996), `fm1`/`fm2`/`fm3` (Chowning 1973: ratio 1:2
  gives odd harmonics only, 1:3 drops every third), `sinefold`, `vowels` (**band places are approximate
  figures from the assistant's memory with no source in the library; the note under the table says so and
  that they only hold near a low A**), `band`, `gap`, `stack`, `organ`, `comb`, `glass`, `grain` (a fixed
  random list, `fixedRandom`). `level()` gives recipe frames a saw's energy; `TABLE_NOTES` has a line for
  every new table, shown under the menu; `TABLE_GROUPS` orders the menu in six groups and **the wavetable
  chooser is now a drop-down (`kind: "menu"`, `TableOptions` in `Controls.tsx`), not a row of buttons.**
  Measured through the engine at both ends of every new table: each harmonic within 1.0 dB of its design.
  The browser scales every wave to the same peak, so spiky tables (Impulse train, the bright end of Dark to
  bright) read 10 to 18 dB lower on the average meter than a saw; that was already so for the older
  tables. **Nobody has heard them.** No lesson uses them yet. Still far short of Serum: no editor, no
  import, no tables made from recorded sound. **No book on designing wavetables exists** (searched twice);
  the papers and chapters that do are at the end of `docs/LITERATURE.md`.
- **Wavetable editor (22 Nov 2026, owner: "lets make one as good as what Serum has... research all of the
  features that they have and clone it").** The feature list was taken from the Serum 2 User Guide in the
  library (pages 274 to 311 and 346 to 347: the editor, importing audio, the formula parser, the appendix).
  **What is copied is what the editor can do; the code, wording and look are ours, and no Xfer table, preset
  formula or artwork is used (rule 4).** Opened by "Wavetable editor" on Osc A or Osc B in the whole synth.
  - `src/synth/wtedit.ts` (pure, tested in `tests/wtedit.test.ts`): a frame is 2048 samples, a table up to 256
    frames. `fft`, `toBins`/`fromBins` (strength and phase of each harmonic); the twelve drawing tools with a
    grid and Mirror (`draw`); the harmonic area's commands (`binCommand`: clear all, above, below; make a saw;
    random low, with halves, all; random gaps; fade the top; octave up and down; repeat a group) and `setBin`;
    frame commands (insert, remove ranges, keep, every nth, move, copy and paste, eight sorts); the Single and
    All menus (normalise each or together, offset, flips, zero crossing, fades and crossfades, keep the lowest
    harmonics, sample-rate reduction, remove the first harmonic, low spectra and phases, split in halves, join
    pairs, pulse width from a frame, line up first harmonics, strengths or phases from this frame or from the
    other oscillator, subtract the other oscillator, blur across harmonics or across frames); morphing
    (`morphAt`: none, crossfade, spectral; `renderMorph` writes the in-between frames out); import
    (`periodOf` by autocorrelation, `averagePeriod`, `splitFixed`, `splitFollowing` with or without zero
    snapping, `splitByHarmonics`, `splitSpectral` for blocks of 256 to 2048, `fromImage`, `splitSizeOf` for a
    typed length or note name, `readWav`); export (`tableWav` 16-bit and 32-bit, `table8bit`).
  - `src/synth/wtformula.ts`: our own safe reader for the guide's formula language (its functions, operators,
    a `? :` choice, and the variables w, x, y, z, q, in, sel, rand). y or z writes every frame (a one-frame
    table grows to 64); q writes harmonics. `FORMULA_EXAMPLES` are ours, not Serum's presets.
  - Tables the learner makes: `Table` is now a built-in name or `u:<id>` (`isUserTable`). `params.ts` keeps a
    registry (`setUserTable`, `userTables`, `tablesRevision`, `onTables`, `tableSamples`, `tableMorph`);
    `blend` plays a table's own morph mode. `src/synth/tablestore.ts` keeps them in the browser's IndexedDB
    (`patchwalk-tables`; `holdTable` plays an edit at once and saves 0.7 s later; `loadTables` runs when a
    synth starts). The engine has `refreshWaves()` so sounding notes follow an edit. The wavetable menu lists
    "Your tables" first. **A saved sound or Studio track stores only the table's id: on another computer the
    table is missing and the basic shape plays. Tables are not yet stored with the account or the Library tab.**
  - `src/ui/synth/TableEditor.tsx` (drawn over the page through a portal, on plain panels): wave display to
    draw on, harmonic display (strengths on top, phases underneath; right-click for the commands; even or odd
    only, snap to quarters, scale by number), formula box with starting formulas, menus for Frames, Sort, This
    frame, All frames, Morph, Bring in and Save as a file, a strip of frame pictures (click, Shift-click a
    range, drag to reorder, drop a file on one), Undo and Redo (80 steps, Ctrl+Z), Hold a note, a position
    slider. Opening it on a built-in table starts from a copy of that table.
  - Checked in a browser: a formula `q<=3` gave the synth harmonics 1,1,1,0; drawing changed them and Undo
    put them back; an every-frame formula made 64 frames; every 8th, a spectral morph and a reverse sort
    worked; "Make a saw" and dragging a bar to zero did what they say; a 441 Hz WAV with a second harmonic
    came in as 256 frames cut every 100.0 samples and **played back with the second harmonic 6.3 dB under the
    first and the third 80 dB down**; a 16-bit WAV of 256 frames was saved; the table was listed under "Your
    tables" and was still there after a reload. **Nobody has heard it or used it by hand.**
  - **Where it still falls short of Serum, honestly:** (the 64-harmonic limit named here at first was raised
    to 512 on 23 Nov 2026, see below.) No 3D view of the table. Import was tested on clean tones only; the pitch-following modes are
    simple. No "send to noise oscillator", no text-file overrides, no saving of the learner's own formulas,
    no Serum-format WAV header (so Serum will not know the morph mode of a file saved here), no Osc C.
    Where the guide does not say exactly what a command does (the grid's meaning in Filter and Sample redux,
    "Nudge all phases", the random commands' ranges) the choice is ours and is written in `wtedit.ts`.
- **Free texts fetched (21 to 22 Nov 2026, owner: "find all of these free ones").** The session's network
  blocked nearly every host, so the owner approved adding fourteen hosts to the `patchwalk` environment's
  allowed list. A helper then took in **eleven texts** (list, sources and licences in `docs/LITERATURE.md`,
  "Taken in on 21 Nov 2026 (free texts)"; cards in `SOURCES`): Sean Luke's *Computational Music Synthesis*
  (CC BY-ND; 173 pages), Witek and others 2014 on syncopation and groove (CC BY), Butler's "Turning the Beat
  Around" (saved under the journal's terms: storing and sharing for research allowed, republishing not), and
  eight *Dancecult* articles on breakbeat, jungle, the hardcore continuum, IDM, the bass drop, sampling,
  dubstep and psytrance (CC BY-NC-SA). The library holds 49 texts. **Nobody has read their bodies: the cards
  were written from abstracts.** Solberg's "bass drop" paper measured no listeners and must not be used to
  claim a technique causes a feeling. Not obtained, with the reason for each in that section: Open Music
  Theory (its site refuses automated requests), Shelvock's and Hockman's theses (they redirect to hosts not
  allowed: `hdl.handle.net`, `mcgill.scholaris.ca`), Understanding Basic Music Theory, Välimäki 2006 (a bot
  check), Raman 1934 (site under maintenance), Holzapfel 2014 (Zenodo refused), Fontana and Rocchesso (no
  file), Cook's PhISM (not found), Synth Secrets (the site forbids reproduction), Smith's online book (no
  licence), Scavone's and Cook's theses (scanned), Knowles and Sonion. **DeSantis's *Making Music* is not
  free: Ableton's site gives 24 of its 74 chapters.** The owner can download any of these and upload them.
- **The synth keeps 512 harmonics, not 64 (23 Nov 2026, owner: "raise the 64 harmonic limit").** `HARMONICS` in
  `params.ts` is 512, the wavetable editor's own count, so a frame is played as drawn and a low saw is as
  bright as a real one. To keep it fast, measuring a drawn cycle and drawing one out go through the editor's
  FFT (`measureCycle`, `drawCycle`; `CYCLE` is 8192 points), used by `fromWave`, `tableSamples` and the warp
  in `spectrumA` (about 2 ms a warp setting; before the change the same code would have taken about 30).
  The "Dark to bright" table's last frame is the full saw; the impulse-train table still stops at 64 on
  purpose. `wavePath` in `Rack.tsx` draws only the harmonics its 160 points can show. Measured: in the
  browser a 55 Hz saw's harmonics 64, 100, 200 and 300 were within 0.15 dB of 1/n (with 64 kept, the 65th was
  161 dB down, that is, absent); a 2,093 Hz saw had nothing that was not a harmonic above -126 dB, so high
  notes do not fold back (the browser leaves out harmonics past half the sample rate for each note);
  through the real engine and page the same low note read within 1 dB of 1/n at harmonics 100 to 300.
  **Nobody has heard it: low notes of saws, squares and bright tables are now noticeably buzzier, which is
  correct, and lessons that describe a sound's brightness were not re-read.** Checks in lessons and tests
  did not need changing.
- **Long pages are searched in parts (16 Nov 2026).** `splitText` in `src/library/search.ts` cuts a page over
  2,400 characters into overlapping parts of about 1,500 (ids `book#page~1`, `~2`, with `of` naming the
  page); `pageOf` and `cite` count parts of one page as one source, and `search` takes at most two parts of
  a page (`perPage`) and can be kept to chosen books (`only`). The library loader moved to
  `api/_library.ts` (the underscore keeps it from being a route; nothing under `src/` may read files).
- **Guide search widened (15 Nov 2026).** The library now holds over twenty texts (2,242 passages). `search`
  in `src/library/search.ts` adds related technical words to a question at half weight (`RELATED`: drum to
  membrane and mode, pitch to frequency, echo to delay, speaker to loudspeaker and driver, and so on), so a
  plain-language question reaches papers that only use the technical words; the asker's own words still
  count in full. Checked on the real library: "why does a drum not have a clear pitch" now reaches the
  membrane paper, and manual questions still land on the same pages. Splitting long pages into passages
  and having a small model pick the best ones are still to do.
- **Realism pass on the 3D views (14 Nov 2026, owner's request).** `src/ui/three/look.ts`: surfaces drawn
  by code onto small canvases (textured speaker paint, a perforated grille, grass, plywood, paper pulp,
  steel), an open sky with haze, a studio table that shows only shadows, and `truss` (laced lighting
  truss as one instanced mesh). `makeStage` now casts soft shadows from its main light (`sun`, `shadow`).
  Vero: cabinets follow the guide's photographs by eye (V60/V90 a curved perforated grille; V315 and the
  bass an open front divided into horn mouths; steel end plates, pins, handles, and the coloured dial that
  really tells the kinds apart, in place of the old coloured stripe), hung from a flying frame on chain
  hoists under a truss tower, one column each side of a stage with a roof, bass cabinets in a row in
  front, on grass under a sky; beams fade with distance. Horn: plywood housing, paper cone, steel motor.
  Driver: shadows on a table. No artwork was added and no logos are drawn. Checked with software 3D only.
- **"Who covers where" on the Vero field (14 Nov 2026; the owner asked how to make it obvious which
  parts of the sound hit which parts of the field, and to pick the best of several ideas).** Chosen: paint
  the ground by the mid-high cabinet pointed most nearly at a listener standing there, plus a listener you
  move with a "Stand" slider. `aimedAt` and `zones` in `vero.ts` (tested) give, for a distance, the cabinet
  whose aim is closest to the line to the listener's ears (1.7 m) and whether that is inside its stated
  angle; the scene paints each stretch in that cabinet's colour with its number (grey = outside every
  beam, as right under the column), draws a pink figure with a line from that cabinet, and runs white
  ripples out along the ground 30 times slower than sound. A panel under the picture says in words what
  reaches the listener: which cabinet for mids and highs, the V315s for mid-bass, the ground cabinets for
  bass (neither drawn as a patch: the guide gives no vertical angle for V315s, and bass spreads widely),
  and the travel time at 343 m/s. On by default; the old beam wedges are now off by default. Left column
  only; real cabinets overlap and blend, which the page says. Considered and not built: a loudness
  heat map (we have no level data, so it would be invented) and a music visualiser (pretty, teaches little).
- **Res 2 colours (same day, owner's request):** deep purple cabinet and a pale grey moulded panel
  holding the mid and high horns, after the maker's photograph (`p537-1.webp`), with a dark piece in the
  mid horn and a purple bass horn.
- **Measurements on the Vero field (14 Nov 2026, owner's request).** A "Measurements" switch (on by
  default): signs every 20 m along the field (faint lines every 10 m), a height scale up the near tower,
  and for the cabinet pointed at or picked, a line down the middle of its beam, a patch on the ground
  where its beam lands with "starts" and "ends" distances, and its height and tilt beside it. `hang` and
  `footprint` in `src/soundsystems/vero.ts` are the maths (tested); `sign` in `look.ts` draws the labels
  (by code). The info panel gives the same figures in words. These are straight-line geometry from
  height, tilt and coverage angle, and the column height is illustrative: the page says both.
- **Vero array in 3D (14 Nov 2026, owner's go-ahead).** `src/ui/VeroScene.tsx`, the first view of the
  "Sound systems" tab, drawn with `three` from `src/soundsystems/vero.ts`: the Vero user guide's "typical
  12-cabinet arena array" (page 67: four V60, three V315, two V90, one V315, two V90, from the top) hung
  to scale with the inter-cabinet angles of the guide's worked example (page 62), each cabinet tipped by
  the angles above it added up (`tilts`); V60 cabinets carry a 60 by 6 degree beam and V90 a 90 by 12.5
  degree one; six V221 bass cabinets stand on the ground. Colours follow the real cabinets' index dials
  (V60 blue, V90 yellow, V315 red). Clicking a cabinet gives its job, drivers, band, coverage, weight, how
  far it is tipped and where the middle of its beam meets the ground (`reach`), with the guide's page.
  Three camera views and a beams switch. The page says what is from the guide and what is drawn for
  illustration (column height, beam length, number of subs, stage, cabinet outline). `src/ui/three/stage.ts`
  is the shared 3D set-up (renderer, camera, lights, pointing) for new views. **The patented horn as a cutaway**
  is the tab's second view (`src/ui/HornCutaway.tsx`, `src/soundsystems/horn.ts`): the loudspeaker of US
  patent 6,650,760 with its top off, drawn after FIG. 1 and 2 by eye (cone driver, plug, baffle, housing
  with flat parallel top and bottom). A "Follow the sound" slider moves a frame from the cone to the mouth
  and a bar shows the room the channel gives the sound (`channelArea`), which widens, narrows at the
  constriction, widens slowly in the throat and quickly in the horn, as the patent's words say; a test
  holds the shapes to that. The page says it is the patent's device and not the inside of a Vero or any
  cabinet. Not built: V315 and bass coverage, changing the array yourself, sound moving through the horn.
- **Letters on marked pictures never overlap (owner's report, 14 Nov 2026).** The owner sent a "Show me
  where" result where two letters sat on top of each other. `layoutMarks` in `src/library/point.ts` (code,
  not the model) now places every letter: on a corner of its own box when there is room, otherwise beside
  the box with an arrow back to it (always so for a box too small to carry a letter), never within a
  letter's width of another letter and never on top of another mark's small box. `SourceImage` draws the
  boxes, an SVG layer of arrows and the letters as three layers. The model is also told not to box the
  same thing twice. Checked in a browser on the owner's own case (the Ableton page-180 picture).
- **Side notes in answers (owner's request, 14 Nov 2026).** A side note now sits in the free space to the
  right of the steps (`.answer-body.with-notes` is a two-column grid; underneath on narrow screens and
  inside lessons) as a fabric patch: a textured frame from the skin's artwork, a solid panel inside for
  the words, dashed stitching, corner cross-stitches and a "Side note" tag. Its text is set in Patrick
  Hand (OFL, self-hosted through `@fontsource/patrick-hand`), larger than body text so it stays legible.
- **`scripts/ingest_pdf.py`** is the standard way to take in any PDF book, text and pictures together, from one
  or more parts numbered straight through (`--skip-pages` for contents pages, `--append <last page>` to add
  later parts). A test checks every book's text and picture index agree.
- **Library images.** `library/images/<book-id>/` holds the pictures embedded in a book's PDF plus an
  `index.json` (file, page, chapter, size, and caption candidates found on the same page). For the Serum 2 User
  Guide: 413 images from 247 pages, about 6 MB. The owner wants these in the repo only, for the assistant and
  the guide to consult or to place in a lesson when useful; there is deliberately no gallery in the app, and
  they are not deployed with the server functions. Same privacy rules as library text.
  **Standard procedure for every new book: extract text and images together** (`pdftotext` in reading order;
  `pdfimages -all -p`, drop masks, tiny images and duplicates, convert to WebP). Drawn (vector) diagrams are
  not embedded pictures and are not captured by this; render the page with `pdftoppm` and crop if one is needed.
- **Read off the guide's own screenshots (not yet used in code):** the envelope display shows sustain in dB
  (e.g. "-14.3 dB") and times as "0.5 ms", "1.15 s", "15 ms" (`p186-1.webp`), which supports reading stored
  envelope times as seconds and means `Env.kParamSustain` needs a dB conversion; the oscillator panel shows
  OCT, SEM, FIN, CRS, WT POS, UNISON, DETUNE, BLEND, PHASE, RAND, PAN, LEVEL (`p049-1.webp`); the filter panel
  shows CUTOFF, RES, PAN, DRIVE, FAT, MIX, LEVEL (`p135-1.webp`).

## Desktop app (17 Nov 2026, owner's request)
The site can be installed as an app in its own window (a web app manifest, `public/manifest.webmanifest`,
linked from `index.html` with `crossorigin="use-credentials"`; its two icons are inside the file as data, drawn
from `favicon.svg`). **The password check was not changed and nothing is served without it.** It is still the
website: it needs the internet, asks for the site password when the browser has forgotten it, and updates
itself with every deploy. No offline copy is kept (no service worker), on purpose: the library must not be
stored outside the server. Not checked on the live site: whether Chrome offers "Install" behind the password.

## Commands
- `npm run dev` — app at http://localhost:5173; `/api/lesson` is served locally too. Put the key in `.env.local`.
- `npm test` — Vitest. Tests that need the pack presets skip when `fixtures/local/` is absent.
- `npm run build` — typecheck + production build.
- `UPDATE_BASELINE=1 npx vitest run tests/baseline.test.ts` — regenerate `src/patch/init-baseline.json` from Init.

## Deploy
Vercel: import the repo (framework: Vite) and set three Environment Variables: `APP_PASSWORD`,
`ANTHROPIC_API_KEY` and `OWNER_EMAIL` (the email of the owner's account: the only one allowed to spend the key). Without the API key the app still works; "Explain why" reports that explanations are off.

## Access control
The product is private to the owner. `middleware.ts` (Vercel Routing Middleware) puts HTTP Basic Auth in front
of every route, and `api/lesson.ts` repeats the check (`src/lesson/auth.ts`). It fails closed: on Vercel, with
`APP_PASSWORD` unset, every request gets 503. Any user name is accepted; only the password matters.
Never weaken this to "open when unset" for deployed builds.

## Layout
See `docs/STRUCTURE.md`. Dependencies: `fzstd` (MIT) for zstd, `cborg` (Apache-2.0) for CBOR (returns floats
exactly as stored), `@anthropic-ai/sdk` (server only). Files under `src/lesson/` that `api/lesson.ts` imports
use explicit `.js` import suffixes so they load as plain Node ESM.

## Conventions
- A fact's `status` is `verified`, `unverified` (conversion applied, unconfirmed), `raw` (stored number shown),
  or `structural` (copied from the file). `known: false` means the app has no interpretation (rule 6).
- To verify a conversion: add the probe to `fixtures/probes/`, add a test asserting the on-screen reading,
  set `status: "verified"` and `confirmedBy` in `src/display/registry.ts`.
- New knowledge cards: copy `knowledge-cards/_template.md`. Avoid numbers in cards. Only add reading links
  that have been opened and checked.
- **Lesson labels.** Codes such as `C2.5` are for code, scripts and plans only. The learner sees lessons grouped
  under chapter names ("Sound itself", "Oscillators", "Filters", "Reading your tools", "Envelopes", "LFOs", "Mixed practice", "Modulation", "Macros", "Reshaping the wave", "Effects", "Playing a line", "Notes and chords", "Impacts"; `CHAPTERS` in `src/course/lessons/index.ts`),
  numbered within the chapter, with "Filters · lesson 5 of 8" above the title. A test stops lesson text from
  citing another lesson by code. Add the chapter's name to `CHAPTERS` when starting a new chapter.
- **"Builds on" patch (owner's request, 14 Nov 2026).** The lessons a lesson builds on are shown in their own
  box styled as a patch stitched onto the page (`.builds-on` in `skin.css`: tilted slightly, dashed stitching,
  a cross-stitch in each corner, a "Builds on" tag), each lesson a button that opens it, finished ones
  ticked. It is shown whenever a lesson builds on others, not only when some are unfinished. The owner
  likes important side information set apart in this stitched style; reuse it for similar call-outs.
  The same day the owner's screenshot showed "Playing as" a name in the header, so the "Who's playing?"
  picker and its database work on the live site.
- Skin: content must stay on solid panels for legibility; fabric textures are for chrome only (header, tabs,
  drop zones, page background). Keep both light and dark schemes working.

## Fixtures
- `fixtures/init/` — Init, committed. Owner confirmed this is a personal build.
- `fixtures/patches/` — four Serum 2 presets, committed. The owner stated on 13 Nov 2026 that they made these
  presets, so they are fine to keep in the repo and use as test fixtures.
- `fixtures/local/` — gitignored: Serum 1 `.fxp` files from the first upload. Never commit or deploy these.
