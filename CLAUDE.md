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
- `knowledge-cards/` — 32 cards (two, on filter shapes/slope and drive/key tracking, are used only by the practice lessons: empty `stages` and `applies_to` keep them out of rebuilt-patch steps), all `status: draft` (written by Claude, not yet reviewed by the owner). Change
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
    `lessons/chapter3.ts` holds the envelope chapter (C3.1, C3.2, C3.4, C3.5, C3.6 and the checkpoint C3.C; the
    plan's C3.3 on curves and hold is not built because the envelopes have neither).
    **Twenty-eight playable lessons; chapters 0 to 3 are built.**
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
    LFOs and Env 2 move pitch and cutoff. In Chromium a square LFO reached about 85% of the set depth; other
    shapes were not measured for depth. Not done: wavetable position and resonance as destinations, more than
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
  - Not built yet: effects, MIDI input, a shared tempo clock, lessons for LFOs, envelope curves and hold.
    Chapter 4 (LFOs) is next and has no scripts yet; the controls it needs exist except tempo sync.
  - The old ten Serum-task lessons are now the "Serum tasks" tab.
- **Pictures and lesson links in answers (13 Nov 2026, owner's rule).** When the guide cites a page that has
  pictures, the pictures are shown with the answer **every time**: code attaches them (`images` on a passage,
  read from `library/images/<book>/index.json` in `api/ask.ts`; pictures under 300 by 120 are treated as icons
  and left out; at most three per cited page, largest first), the model does not choose. They are served by
  `api/image.ts`, behind the same password check, by exact file name only; they are still never bundled into
  the browser build. Under each answer, `src/course/related.ts` (code, not the model) offers up to two practice
  lessons whose subject matches the question; clicking one opens it. Not yet verified on the live site: that
  Vercel packages `library/images/**` with the image function (`vercel.json`).
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
  Design for one user; do not add accounts, sharing or public pages. Rule 4 still applies to the name and look.
- **Course:** `docs/CURRICULUM.md` maps 16 tracks and about 400 lessons (one line each); `docs/lessons/` holds
  fully scripted lessons in a fixed shape (24 so far, all drafts); `docs/COURSE_PLAN.md` describes the practice
  synth and lesson engine. A university programme's topic list was used only as a coverage checklist.
  See also `docs/COURSE_PLAN.md`. Guided lessons on a built-in practice synth; lessons can be taken in any
  order; each lesson is its own data file so chapters are easy to add. Tracks are to grow well beyond synthesis
  (acoustics, psychoacoustics, sound design, effects, ear training, mixing).
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
  under chapter names ("Sound itself", "Oscillators", "Filters", "Envelopes"; `CHAPTERS` in `src/course/lessons/index.ts`),
  numbered within the chapter, with "Filters · lesson 5 of 8" above the title. A test stops lesson text from
  citing another lesson by code. Add the chapter's name to `CHAPTERS` when starting a new chapter.
- Skin: content must stay on solid panels for legibility; fabric textures are for chrome only (header, tabs,
  drop zones, page background). Keep both light and dark schemes working.

## Fixtures
- `fixtures/init/` — Init, committed. Owner confirmed this is a personal build.
- `fixtures/patches/` — four Serum 2 presets, committed. The owner stated on 13 Nov 2026 that they made these
  presets, so they are fine to keep in the repo and use as test fixtures.
- `fixtures/local/` — gitignored: Serum 1 `.fxp` files from the first upload. Never commit or deploy these.
