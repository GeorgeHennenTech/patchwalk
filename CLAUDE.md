# Patchwalk (working name)

A web app that teaches people to recreate a Serum 2 patch. The user drops in a `.SerumPreset`; the app decodes it
in the browser, works out which parts matter, and walks them through building the sound in signal-flow order.
Each step says what to do, why it works, and what to listen for. A difficulty toggle changes the explanation.

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
Checked against five fixtures: `fixtures/init/Initial_Preset.SerumPreset` (2.0.24, format 9) and four pack presets
in `fixtures/local/patches/` (2.0.17-2.0.24, formats 7, 8, 9). The TypeScript decoder was cross-checked against an
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
- `knowledge-cards/` — 30 cards, all `status: draft` (written by Claude, not yet reviewed by the owner). Change
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
- `src/skin.css` + `src/assets/skin/` — patchwork skin. Artwork generated with Higgsfield for this project; display
  font is Shrikhand (OFL) from `@fontsource`, self-hosted. The page makes no third-party requests.

Inferences that still need probes (all flagged "unverified" in the UI): on/off rule, mod source ids,
FX rack order, module index-to-name labels, every display conversion. FX parameters are shown as stored.

## Long-term direction (owner's stated goals; not yet scheduled or built)
- **Private, single-user.** The owner has said this program is strictly for them and will never be distributed.
  Design for one user; do not add accounts, sharing or public pages. Rule 4 still applies to the name and look.
- **Course:** `docs/CURRICULUM.md` maps 16 tracks and about 400 lessons (one line each); `docs/lessons/` holds
  fully scripted lessons in a fixed shape (12 so far, all drafts); `docs/COURSE_PLAN.md` describes the practice
  synth and lesson engine. A university programme's topic list was used only as a coverage checklist.
  See also `docs/COURSE_PLAN.md`. Guided lessons on a built-in practice synth; lessons can be taken in any
  order; each lesson is its own data file so chapters are easy to add. Tracks are to grow well beyond synthesis
  (acoustics, psychoacoustics, sound design, effects, ear training, mixing).
- **Teacher/guide:** one consistent voice, remembers progress, comments on what the learner just did, answers
  questions. Patch facts stay strict (rule 5). Concept answers come from a private library of the owner's texts
  via retrieval, with citations. This is retrieval, not model training.
- **Mini DAW (later):** tracks, a step sequencer / piano roll, drums and samples, a mixer, for genre-writing
  lessons (glitch-hop, breakbeat, psydub...). Build the practice synth's audio engine with a shared tempo clock
  and more than one instrument in mind so it can become the DAW's instrument instead of being rewritten.
- **Library rules.** `library/` holds copyrighted text (currently Xfer's Serum 2 User Guide; the owner confirmed
  this is OK for private use under rule 4). It is committed to this **private** repo because that is the only
  route to the deployment. NEVER make this repo public, fork it publicly, or publish a build with `library/` in
  it. Library text must never be imported by anything under `src/` (a test enforces this), bundled into the
  browser build, or shown in full in the UI; only the few passages retrieved for a question go to the model.
  To add a text: one JSON file in `library/` shaped `{ id, title, pages: [{ page, chapter, text }] }`.

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
- Skin: content must stay on solid panels for legibility; fabric textures are for chrome only (header, tabs,
  drop zones, page background). Keep both light and dark schemes working.

## Fixtures
- `fixtures/init/` — Init, committed. Owner confirmed this is a personal build.
- `fixtures/local/` — gitignored: commercial pack presets and Serum 1 `.fxp` files. Never commit or deploy these.
