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
    **Eighty-seven playable lessons.**
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
  - `api/store.ts` + `src/store/players.ts`: the list of people (`pw:players`, at most 12, names unique) and
    each person's saved things (`pw:p:<id>`: finished lessons and saved chats). No passwords: the site's one
    password is the gate; the picker only keeps people's things apart. `?check=1` does a write-and-read for
    the System check tab (`DatabaseCheck`).
  - `src/ui/Players.tsx`: the "Who's playing?" panel under the header, shown only when a store is
    configured: pick a name, add yourself, remove someone, stop playing on this browser. The first name
    chosen on a browser that already held progress adopts it. `src/guide/sync.ts`: the browser's storage
    stays the working copy; `playAs` brings a person's things down (then reloads), `schedulePush` copies
    changes up 1.5 s later, and `pushNow` reads the database's copy first and joins the two (`merge`: every
    lesson, newest version of each chat) so a stale browser never overwrites newer work; a deletion pushes
    the exact copy instead. The Serum-tasks progress is not synced.
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

## Commands
- `npm run dev` — app at http://localhost:5173; `/api/lesson` is served locally too. Put the key in `.env.local`.
- `npm test` — Vitest. Tests that need the pack presets skip when `fixtures/local/` is absent.
- `npm run build` — typecheck + production build.
- `UPDATE_BASELINE=1 npx vitest run tests/baseline.test.ts` — regenerate `src/patch/init-baseline.json` from Init.

## Deploy
Vercel: import the repo (framework: Vite) and set two Environment Variables: `APP_PASSWORD` and
`ANTHROPIC_API_KEY`. Without the API key the app still works; "Explain why" reports that explanations are off.

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
  under chapter names ("Sound itself", "Oscillators", "Filters", "Envelopes", "LFOs", "Modulation", "Macros", "Reshaping the wave", "Effects", "Playing a line", "Impacts"; `CHAPTERS` in `src/course/lessons/index.ts`),
  numbered within the chapter, with "Filters · lesson 5 of 8" above the title. A test stops lesson text from
  citing another lesson by code. Add the chapter's name to `CHAPTERS` when starting a new chapter.
- Skin: content must stay on solid panels for legibility; fabric textures are for chrome only (header, tabs,
  drop zones, page background). Keep both light and dark schemes working.

## Fixtures
- `fixtures/init/` — Init, committed. Owner confirmed this is a personal build.
- `fixtures/patches/` — four Serum 2 presets, committed. The owner stated on 13 Nov 2026 that they made these
  presets, so they are fine to keep in the repo and use as test fixtures.
- `fixtures/local/` — gitignored: Serum 1 `.fxp` files from the first upload. Never commit or deploy these.
