# Patchwalk — handoff document

**To the assistant reading this:** you are taking over an ongoing project from a previous session. The owner
has dropped this file into a new chat to save context and will often say nothing else. Do not ask them to
re-explain anything here. Read this file, do the "Start here" steps, then carry on with "What to do next".
Write to the owner the way section 2 describes.

Last updated: 20 November 2026, after commit "Library: a Sources shelf, and lesson ideas from the new literature".
**The newest state is the block "Latest (18 Nov 2026)" at the top of section 8 and the dated notes at the end of this file. Where an older paragraph disagrees with them or with `CLAUDE.md`, the newer one is right.**

---

## 1. Start here (every new session)

1. **Get the code.** Repository: `GeorgeHennenTech/patchwalk` on GitHub (private). If it is not already in your
   workspace, attach or clone it. `CLAUDE.md` at its root is the authoritative, more detailed project record;
   read it after this file. If you cannot reach the repo, say so in one line and ask the owner to connect it.
2. **Install and check.**
   ```bash
   npm install
   ```
   ```bash
   npm test
   ```
   Expect 787 passing tests in 38 files (20 Nov 2026).
3. **Run it.** `npm run dev` serves the app at http://localhost:5173 including the two server functions.
   The Claude calls report "no API key" locally unless `.env.local` has `ANTHROPIC_API_KEY`; that is expected.
4. **Then continue with section 8** without waiting for instructions, unless the owner's message says otherwise.

---

## 2. The owner, and how to work with them

- **Who:** one person building this for their own use only. A complete beginner at synthesis and not a
  programmer. They own Serum 2 and Syntorial. Musical taste: glitch-hop, breakbeat, psydub and neighbours.
- **Their goal, in their words:** go "from a complete noob into one of the best sound designers/audio
  engineers", with an understanding of acoustics and psychoacoustics. Their "real dream" is a teacher inside
  the app that draws on many texts and synthesises across them without making things up.
- **How to write to them:** plain language, no code or file-path dumps unless useful, short sections, lead
  with what works and what you need from them. Be honest about what is untested. They cannot judge code; they
  judge by using the live site.
- **How they give direction:** often brief ("go", "continue with whatever", "done"). Treat that as go-ahead
  for the next item in section 8. They like momentum. They dislike being asked things already decided.
- **Working rhythm (from `CLAUDE.md`):** one milestone at a time, each a demoable win; then stop and say in a
  few sentences what works, how to see it, and what you need. The owner has several times waived the stop and
  asked for several items in one go; follow whatever they last said.
- **Always:** run the tests, check new UI in a real browser (Playwright with Chromium is the pattern used so
  far), commit, and push to `main`. Vercel redeploys from `main` automatically.
- **You cannot hear.** Audio features are verified by measurement only. Always ask the owner to listen.

---

## 3. What the product is

A private website, working name **Patchwalk**, live at **https://patchwalk.vercel.app** behind a password.
The name and look must never use "Serum" or "Xfer" or copy Serum's appearance (colours, artwork, fonts). On
13 Nov 2026 the owner asked for the practice synth's *arrangement* to follow Serum's so skills transfer; that is done.

It began as: drop in a Serum 2 preset, get a step-by-step lesson for rebuilding it. It has grown into a
synthesis course with its own practice synth and an AI guide that answers from a private library.

### What exists today (all live unless noted)

| Tab | What it does |
|---|---|
| **Rebuild a patch** | Reads a `.SerumPreset` in the browser (never uploaded). Shows a sound-type guess, a lesson in signal-flow order at three difficulty levels, "Explain why" (Claude writes why each step works), envelope and LFO diagrams, a signal-flow view with a modulation map, an active-modules view, "compare your attempt", a display-value table and raw data. An ask box lets the guide answer about the patch. |
| **Lessons** | The practice synth (two oscillators, unison, sub, noise, phase, generated wavetables, a filter with a draggable curve, two envelopes, three LFOs, velocity and key position as sources, four macros, and warp, FM and ring modulation on oscillator A; shown as a rack of panels with knobs) and 122 playable lessons (including seven "Effects" lessons on a new effects rack of distortion, EQ, compressor, chorus, delay and reverb, and the first seven "Impacts" lessons: kick, sub drop and bass notes as hits; all built 13 Nov 2026): chapters 0 to 5 (oscillators, filters, envelopes, LFOs, modulation), a macro chapter and chapter 6 "Reshaping the wave" (warp, sync, squeeze, FM, ring modulation, checkpoint; built 13 Nov 2026), a match-by-ear lesson (C1.M) and the chapter checkpoints (C1.C, C2.C, C3.C, C4.C, C5.C). Each lesson: optional "Hear it first" demo, idea text, a knowledge card, guided steps with only the needed controls shown and live targets, guide remarks written by code, optional blind ear check, optional match-by-ear rounds, recap, suggested next lesson, read-aloud, and an ask box. Any order; progress saved in the browser. |
| **Serum tasks** | The older ten lessons: a task done in Serum, checked by dropping the saved preset. |
| **Ask the guide** | Answers a typed question from the library (the Serum 2 User Guide, the Ableton Live 11 manual, and the knowledge cards) with page citations, quoted source text, the cited page's pictures, and links to matching lessons. Says "not in the library" instead of guessing. Each picture has a "Show me where" link that asks Claude to box and label the relevant places in it (built 13 Nov 2026; aim not yet tested against the real API). |
| **Sound systems** | 3D views: a Funktion-One Vero array on a field (who covers where, measurements, build your own column), a Res 2 cabinet (simple view and "How an engineer sees it" from the maker's own measurements), a patented horn cut open, and a cone driver. |
| **Physical models** (new 15 Nov 2026) | Four instruments that make sound by imitating an object: a plucked string, a bowed string, a drum head and a blown tube with a reed. Each has its own controls, pictures, lessons with quizzes (nine in all) and, for the string, a match-by-ear game. Each note is worked out whole and then played, so a sounding note cannot be changed. |
| **System check** | One-click end-to-end test of the explanation service. |

Also new on 15 Nov 2026 (see "Batch of 15 Nov 2026" and the notes after it in `CLAUDE.md`): accounts with
email and password (only the owner's account may spend the site's Claude key); a second filter with
routing, peak and shelf types; seven wavetables built from published formulas; more warp modes; reorderable
effects; saved sounds; a library of over twenty texts (manuals, Funktion-One documents, and fourteen
research papers on synthesis and physical modelling).

The look is a "thrifted patchwork" skin the owner asked for: quilt backdrop, tiger-stripe name patch, leopard,
mohair and shag fabric buttons, stitched borders. Content must stay on solid panels for legibility.

---

## 4. Rules that must not be broken

These are the owner's rules. They are also in `CLAUDE.md`.

1. Format knowledge may reference `node-serum2-preset-packager` and `serum2-preset-loader` (both MIT). Do not
   copy code from `KennethWussmann/serum-preset-packager` (no licence) or `serum2vital` (GPL-3.0).
2. Never decompile or disassemble Serum. Learn only from public sources and the owner's files.
3. Presets are processed in the browser. Never upload or store one. Only code-selected facts go to Claude.
4. Do not ship Xfer content (factory presets, wavetables). No "Serum" or "Xfer" in the product name.
5. **The LLM is a narrator, not an analyst.** Code decides which facts matter, the order, and every number. A
   validator rejects lesson text that mentions a value or setting not in the patch, and regenerates.
6. If something cannot be interpreted, say so. Never invent an explanation.
7. Any display-value conversion not confirmed by the owner on Serum's screen is marked unverified in code and
   in the interface.

Further standing decisions:

- **Private, single user.** No accounts, sharing or public pages. The whole site sits behind HTTP Basic Auth
  (`middleware.ts`), repeated inside each server function. It fails closed: no password set means nobody gets
  in. Never weaken this.
- **The library holds copyrighted text** (`library/`, currently Xfer's Serum 2 User Guide). The owner approved
  this for private use. It is committed to the private repo because that is the only route to the deployment.
  **Never make the repo public or publish a build containing `library/`.** Nothing under `src/` may import
  library text (a test enforces it); only the few passages retrieved for a question are sent to Claude.
- **"Trained on textbooks" means retrieval, not model training.** This was explained to and accepted by the owner.
- **Diagrams are drawn by code from real values, never by the model.**
- **Guide remarks and next-lesson suggestions are written or chosen by code.**
- **Other people's course material is used as topic checklists only** (Berklee Online's catalogue, Syntorial's
  lesson titles). Never copy their text, videos or exercises.
- **Reading links on cards** must be opened and checked before being added.
- **Secrets:** the owner types passwords and API keys into Vercel themselves. Never ask for them in chat.

---

**Accounts and who pays (14 Nov 2026).** Everyone signs in with an email and a password. Only the account
whose email equals the `OWNER_EMAIL` setting in Vercel may spend the site's Claude key; everyone else must
add a key of their own, and nobody signed out can call Claude at all. This fails closed and must stay that
way. Details in `CLAUDE.md` under "Accounts".

## 5. How it is built

Stack: Vite, React, TypeScript, Zod, Vitest, deployed on Vercel. Claude is called only from server functions.

| Area | Where | Notes |
|---|---|---|
| Preset decoding | `src/format/` | Container, capped zstd (`fzstd`), CBOR (`cborg`), schemas. Cross-checked against an independent decode. |
| Diff against Init | `src/patch/` | Module model, baseline learned from the owner's Init preset, active / disabled / unused. |
| Display values | `src/display/registry.ts` | Each entry has a status: `verified` (none yet), `documented` (name from the Serum 2 User Guide), `unverified` (reasoned guess), `raw` (stored number shown). |
| Facts and steps | `src/flow/` | `build.ts` (ordered steps), `combos.ts` (combination detection), `soundtype.ts`, `diagrams.ts`. No AI. |
| Lesson narration | `src/lesson/`, `api/lesson.ts` | Contract `{do, why, listen_for, param_refs}`, validator, three-attempt regenerate loop, difficulty rendering, knowledge-card selection, self-test. |
| Compare attempt | `src/compare/` | Fact-by-fact comparison of two presets. |
| Library and guide | `src/library/`, `api/ask.ts`, `src/guide/`, `library/` | Keyword (BM25) search over manual pages and cards; Claude answers with citations enabled. |
| Practice synth | `src/synth/` | `params.ts` (one typed state, exact units), `filter.ts` (filter maths, shared by sound and drawing), `engine.ts` (Web Audio), `tracker.ts`, `useSynth.ts`. |
| Playable lessons | `src/course/` | `types.ts`, `lessons/index.ts`, `match.ts`, `progress.ts`. A lesson is data. |
| Older Serum tasks | `src/learn/course.ts` | Ten lessons with preset-drop checks. |
| Interface | `src/ui/`, `src/skin.css`, `src/styles.css` | `PlayView.tsx` is the lesson player; `synth/Rack.tsx` the module panels; `synth/Controls.tsx` the knobs. |
| Knowledge cards | `knowledge-cards/*.md` | 36 cards with a template. Four fixed sections each. |
| Plans and scripts | `docs/` | See section 7. |

Things that are easy to get wrong:

- Files that server functions import (`src/lesson/*`, `src/library/*`) use explicit `.js` import suffixes so
  they load on Vercel. Keep doing that for anything a function in `api/` imports.
- Model id is `claude-opus-5-5` in both functions. Structured output is used for lessons; citations for the
  guide. Citations and structured output cannot be combined in one call.
- The manual's text was extracted with plain `pdftotext` (reading order), not `-layout`, so table cells stay
  together. Contents pages were dropped. Format: `{ id, title, pages: [{ page, chapter, text }] }`.
- Card bodies put a `## Heading` directly above its paragraph with no blank line; `src/ui/Markdown.tsx`
  handles that. An earlier version did not and rendered whole cards as headings.
- Browser audio only starts after a click. Computer-keyboard notes must still work while a checkbox or slider
  has focus (this was a bug once).
- Lesson codes (`C2.5`) are never shown to the learner (owner asked, 13 Nov 2026). The list is grouped by named
  chapter and numbered within it. A new chapter needs its name added to `CHAPTERS` in `src/course/lessons/index.ts`.
- React keys must be unique among siblings (a duplicate-key bug came from two components keyed by lesson id).
- Environment variables on Vercel: `APP_PASSWORD` and `ANTHROPIC_API_KEY`. Both are set.

---

## 6. What is proven, and what is not

**Proven on the live site by the owner (12 Nov 2026):** the password gate; "Explain why" (the system check
passed on its second attempt, meaning the validator rejected the first reply and the retry recovered); "Ask
the guide" (a correct, cited answer about the filter's FAT knob from pages 135, 136 and 142).

**Proven by measurement only:** the practice synth makes signal; a 12 dB volume change moves the meter 12 dB;
the square wave shows odd harmonics; two squares half a cycle apart nearly cancel; beat rate doubles an octave up. The filter's output matches its drawn curve within 0.1 dB at every harmonic checked, for all types, slopes, resonance and key tracking. All lessons were played through in a headless browser.

**Not yet judged by a person:** how the knobs feel; the envelopes and LFOs by ear; how the practice synth sounds, the filter especially (resonance loudness, how
harsh full drive is, whether the noise whistle in C2.7 is clear); how the filter curve feels to drag; whether the lesson format feels right; the ask
box used with lesson or patch context; the match-by-ear difficulty.

**Still unverified against Serum:** every numeric display conversion, the on/off rule, mod-matrix source
numbers, effect order, module name labels. `docs/PROBES.md` lists 43 one-change-from-Init presets the owner
could make to settle them. None have been made. Effect parameters are shown exactly as stored.

**Drafts awaiting the owner's review:** all 32 knowledge cards (`status: draft`), the forty-three lesson scripts in
`docs/lessons/`, every lesson in the app.

---

## 7. The plans (all in `docs/`)

| File | What it holds |
|---|---|
| `COURSE_PLAN.md` | The practice synth and lesson engine: lesson anatomy, how controls appear, 77 synthesis lessons in 11 chapters, an eight-stage build order (A to H). |
| `CURRICULUM.md` | The whole course map: 17 tracks, about 475 lessons, one line each (acoustics, psychoacoustics, synthesis, methods, sound design, effects, ear training, rhythm, theory, sampling, arrangement, genres, mixing, mastering, procedural audio, projects, Serum specifics). |
| `SERUM_EXTRAS.md` | Track S: 50 lessons on Serum 2 itself, with manual page references. |
| `PHYSICAL_MODELING.md` | Track Q (owner asked 13 Nov 2026): about 60 lessons on physical modelling and the new engines they need. Planned, not built. |
| `BIOACOUSTICS.md` | Track R (same day): about 45 lessons on bioacoustics, hearing and illusions, aimed at the psychedelic quality the owner wants. Planned; explanations wait for source texts. Makes no claims about any artist's methods or about sound altering the brain. |
| `IMPACTS.md` | Track T (owner asked 13 Nov 2026): about 50 lessons on impact sounds and making bass music hit harder. Planned, not built; T1, most of T2 and parts of T3 need nothing new on the synth. |
| `LITERATURE.md` | Every text in the library, on its way, or wanted, with what each is for. The owner asked for this list on the to-do page; keep the two in step. |
| `GENRES.md` | The owner's closed list of 92 genres, each to use an eight-lesson template; also what they declined. |
| `COVERAGE_SYNTORIAL.md` | Mapping of Syntorial's lesson titles onto our lessons, and what was added as a result. |
| `lessons/` | Thirty fully scripted lessons (C0.1 to C0.4, C1.1 to C1.8, C2.1 to C2.7, C3.1 to C3.6, C4.1 to C4.6, C5.1 to C5.3, C5.6, and C5M.1 to C5M.8) in a fixed shape. |
| `PROBES.md` | Probe presets for verifying display values. |
| `milestones/`, `STRUCTURE.md` | The original eight milestones and file layout. All eight are done. |

Decisions already made about the course: lessons can be taken in any order; each lesson is data so chapters
are easy to add; every chapter ends with a recreate-by-ear checkpoint; built-in audio is in scope; a mini DAW
comes later for genre-writing lessons, so the audio engine should grow toward a shared tempo clock and more
than one instrument instead of being rewritten.

---

## 8. What to do next

**Latest (18 Nov 2026). The work in hand is the Studio tab (the DAW).** The owner's standing instruction
(17 Nov): "continue to go through this daw and continue to get it functioning closer and closer to how
ableton works", and "keep going, don't ask again". Nothing is half-done: the tree is clean, built and pushed.
- **Done later on 18 Nov (third batch of quick wins; `CLAUDE.md`, "Quick wins, third batch"):** jumps between
  markers, Space playing from the time marker, Random loud, a choice of count-in, an Overdub switch (off:
  recording replaces), sidechain on the auto filter and multiband, Utility's bass mono / one side / remove
  offset, the Saturator's colour and soft clip. Measured and checked by script; not heard by anyone.
- **Next step: take the next unticked items in `docs/ABLETON_GAPS.md`**: the two quick wins left (hear a
  break or sound before loading it; the remaining shortcuts), then its "biggest limits" (a loop brace you
  drag; cut, duplicate and delete time; click, drive, a filter and a saturator per pad), then "bigger
  pieces". Small loose end: the red "automated" mark on the synth's and sampler's own knobs.
- **Branches:** this session's cloud environment allowed pushes only to `claude/new-session-dfvcsr`, not
  `main`. If that branch is ahead of `main`, the live site is behind until it is merged: tell the owner.
- **Then, or when the owner says: the Ableton course.** The owner (17 Nov) wants a lesson for every Studio
  feature ("this ableton course will be extensive"). Nothing is written and the lesson engine does not know
  the Studio; the plan is at the top of `docs/ABLETON_GAPS.md`. The owner chose "continue building features"
  when offered the choice, so do not start the course unasked.
- With every push: `CLAUDE.md` (a dated entry just before the paragraph "Lessons on all of this"), this
  file, `docs/ABLETON_GAPS.md` (tick the item), `docs/TODO.md`, and the owner's to-do page (section 10).
- How to check Studio work: tests, then a real browser by script (notes in `CLAUDE.md`: loop bar 1 when
  measuring; scroll a lane into view before clicking it). **Everything in the Studio is measured, not heard.**
- On hold, do not touch: the Physical models tab (until the owner uploads texts), more Higgsfield voice clips.

**Later the same day:** five papers on classic synth wave shapes and nine on physical modelling went into the library; four wavetables were built from formulas, with a lesson (122 lessons now, plus six on the physical models); and the first physical-modelling instrument exists as the "String lab" tab (`src/strings/string.ts`, `src/ui/StringLab.tsx`; see CLAUDE.md). Next for it: make the lesson engine able to use it.

**Latest (15 Nov 2026).** The owner asked for a long run of tasks that need no decision from them. Done and
pushed: everything listed under "Batch of 15 Nov 2026" in `CLAUDE.md` (a second filter with routing, peak
and shelf types, three more warp modes, a smooth drawn LFO shape, Osc B's own warp and unison, reorderable
effects, saved sounds, eleven more lessons making 98, more ear checks, three knowledge cards, saved sounds and
recall stored with the account). **None of it has been seen or heard by the owner.** Still waiting on the
owner: a verdict on the Res 2 "definition pass" and its engineer's view (which decides whether Vero, the
horn and the driver get the same treatment), and a read of the quiz and "why this matters" wording.
Good next tasks that need no decision: lesson scripts in `docs/lessons/` for lessons written straight into
code; an engineer's view from the Res 4 EASE files; per-source routing to each filter; an Osc C; more
blind ear checks (envelopes, LFO speed).

**First: `docs/TODO.md` has a numbered queue at the top.** When the owner says "proceed with the next task", do the first unticked item there, tick it, and report briefly. They are working from their phone.

Take these in order. After each, test, check in a browser, commit, push, and report briefly.

1. **Done (13 Nov 2026): chapter 1.** The synth now has a second oscillator, unison, sub, noise, phase and
   generated wavetables, and lessons C1.3 to C1.8 plus the checkpoint C1.C are playable. Two scripted lessons
   were adapted to what the synth has: C1.6 holds one note instead of a chord (Hold latches one note), and
   C1.7 raises and lowers the sub level instead of muting oscillator A (A has no level control yet). C1.9
   (pulse width) is in the plan but not scripted or built.
2. **Done (13 Nov 2026): filter chapter (C2).** The synth has a filter (four shapes, cutoff, resonance, two
   slopes, drive, key tracking) and a filter curve that is drawn from the settings and can be dragged. Lessons
   C2.1 to C2.7 and the checkpoint C2.C are scripted and playable. Oscillator A gained a level control. C2.7
   was adapted: this filter rings but does not truly self-oscillate, so the lesson feeds it noise and says so.
   Chapter 2 has no blind ear checks yet (each script names the one planned).
   Also added at the owner's suggestion: a "Show:" row to switch the scope, spectrum, a new scrolling
   spectrogram, the level meter and the filter curve on at any step (remembered; hidden in match-by-ear). The
   Also at the owner's request: lesson codes are hidden (chapters are named), and the synth is now a rack of
   module panels with knobs in Serum's arrangement (Sub, Osc A, Osc B, Noise, Filter; main volume top right).
   Only the arrangement follows Serum; the look stays our own skin. Details in `CLAUDE.md`. Then, also on
   request: two envelopes and three LFOs in a row under the rack (Env 1 is the note's level; Env 2 and the LFOs
   each send to one destination), a glowing ring in the source's own neon colour on every knob it moves, and a
   dark "velvet and neon" skin for the synth. **There are no lessons for envelopes or LFOs yet**; the controls
   only show in "Show the whole synth". The
   owner wants the same toggles in the piano roll when the mini DAW exists; ideas not built yet are a stereo
   (left/right) view, a tuner/pitch readout and a loudness meter.
3. **Done (13 Nov 2026): envelope lessons (C3)**, five lessons and a checkpoint with a draggable envelope
   drawing; C3.3 (curves and hold) waits for those controls. **Done too: LFO lessons (C4)**, three and a checkpoint; C4.4 to C4.6 wait for tempo
   sync, trigger modes and drawn shapes. **Done as far as the synth allows: the modulation system (C5)**: routes and amounts,
   one way or both ways, modulating a modulator, and a checkpoint. **What is left in chapters 3 to 5 all needs
   new synth controls first** (envelope curves and hold; LFO tempo sync, trigger modes, drawn shapes; velocity,
   macros, mod wheel). Chapter 6 (warp, sync, FM, ring mod) needs new oscillator features. **The owner then chose the order (13 Nov
   2026): (1) macros and velocity, done, with a whole macro chapter because they want to teach "an absurd
   amount of macro combinations" (add recipes to `src/course/lessons/macros.ts`); (2) envelope hold and fall, and tempo-synced,
   restart-or-free, fading-in and drawable LFOs with a tempo and click: all done; (3) then warp, sync, FM and ring modulation; (4) then the two
   tracks they added the same day, physical modelling (`docs/PHYSICAL_MODELING.md`) and bioacoustics
   (`docs/BIOACOUSTICS.md`), and "whatever" as they find more literature.
   They also want a full editable Matrix tab "at some point"; a read-only Matrix view exists now.**
4. **Guide improvements** alongside: remember more than finished lessons (for example what the learner found
   hard), and add more texts to the library as the owner supplies them.
5. Later, in the order in `CURRICULUM.md`: listening lab for acoustics, psychoacoustics and ear training;
   extended synthesis methods; the mini DAW; genres starting with glitch-hop, breakbeat and psydub.

Smaller items to pick up when convenient:

- **Owner's video walkthroughs (planned, not built).** The owner wants to record short screen-capture
  walkthroughs (e.g. in Ableton) and have the guide pull up the right one when a question matches, such as
  "how do I automate the BPM of my track?". Design agreed in principle: each video gets a small entry (title,
  the question it answers, a short description or transcript, optional timestamps) that is indexed in the
  library like any other passage, so the guide can answer from the owner's own words, cite the video, and the
  app plays it. Video files are too big for git; host them elsewhere (options given to the owner: unlisted
  YouTube, or private file storage on Vercel) and store only the entry and link in the repo. Awaiting the
  owner's choice of hosting and whether they will narrate (a transcript makes matching much better).
- The system check does not show why a first attempt was rejected; surface the first attempt's reasons so
  validator strictness can be judged.
- Use the manual's screenshots in `library/images/` to improve display values: sustain is shown in dB, and the
  panels confirm many control names. Mark anything taken from them as `documented`, not `verified`.
- The in-app guide cannot show library images in its answers yet. If wanted, serve them from a
  password-protected server route; never bundle them into the browser build.
- A few registry labels still use earlier guesses where the manual has names (unison DETUNE, BLEND, WIDTH;
  PORTA, CURVE, ALWAYS, SCALED). Changing them means updating test expectations.
- MIDI keyboard input for the practice synth.
- An interleaved "suggested path" through the lessons, in the spirit of Syntorial's ordering (offered to the
  owner, not yet answered).

---

## 8b. The to-do list
`docs/TODO.md` is the repository's copy of the working list, with tick boxes.

**What the owner actually looks at is a page:** "Patchwalk To-Do", https://claude.ai/artifact/7sHF6r2vvBuxa8DSkcfcPz
(private to the owner; made 13 Nov 2026). Its items live in the page's own database (collection `todos`, one
document per item: `section`, `sectionOrder`, `order`, `text`, `done`), so the owner can tick and add items
there and the assistant can add or tick them with the `ArtifactData` tool without republishing. **When
something is finished or added, update both the page and `docs/TODO.md`.** Read the page's items first: the
owner may have ticked or added things. In a new conversation, pass that URL to the Artifact tool to keep the
same page.

**The page is ranked (owner asked, 13 Nov 2026).** Open build items carry a `rank` number and items waiting
on the owner an `ownerRank`; the page's "Order: priority" view lists them first, lowest number first. Current
build order: (done: warp, sync, FM and ring modulation, chapter 6) (done: the first seven impact lessons) (done: effects rack and its seven lessons) (done: the editable matrix and its lesson, C5.4); (5) wavetable position and resonance as destinations; (6) formant filters and the first
bioacoustics lessons; (7) the string engine for physical modelling; (8) more macro recipes; (9) blind ear
checks; then Rift lessons, groove lessons, the mini DAW and the rest. When a new item is added, give it a
rank that fits, or leave it unranked to sit in its section.

A second mod, "patchwalk-usage", puts a row above the prompt with context fill, usage limits and session
cost in the Patchwalk neons (`/usage-row` hides or shows it). Like the first, it lives only in the session's
container, and whether the owner's desktop app draws it was not confirmed.

A Claude Code mod ("patchwalk-todo", `/todo`) was tried first because the owner asked for one. In the
owner's set-up (desktop app, cloud session) its side pane was never drawn, so the page replaced it. The mod
only lived in that session's container.

## 9. Waiting on the owner

- **Set `OWNER_EMAIL` in Vercel** (Project, Settings, Environment Variables) to the email of their own
  account, then redeploy. Until then the site's Claude key is off for everyone, the owner included.

Ask about these only when relevant; do not block on them.

0. **Studio (asked 17-18 Nov, no answers yet):** how the drums, devices, sampler and an exported .wav sound;
   whether a .mid or .wav opens properly in Ableton; how dragging feels in the effect chain and arrangement
   (only checked by script); whether a new track should start empty until an instrument is dragged on;
   whether Cmd shortcuts work on a Mac. Sounds over 2 MB and the real database for the Library tab are untested.

1. **Listening feedback** on the Lessons tab: are tones clean and at a sensible volume, does the step format
   feel right, are the match-by-ear rounds too easy or too hard?
2. **Voice for the guide: answered, Higgsfield.** Not built yet. Test quality on one lesson before generating many.
3. **More books for the library.** The whole Ableton Live 11 manual (867 pages) is in (13 Nov 2026), and the
   owner confirmed the guide answers from it well on the live site. More books may follow; take each in with
   `scripts/ingest_pdf.py`.
   Uploaded PDFs live outside the repo and are gone in a new session; only the extracted text and pictures stay. Extract text and pictures together (procedure in `CLAUDE.md`, "Library
   images"), and merge the sections into one book with the manual's own page numbers. Suggestions given to the
   owner are listed at the end of this section.
4. **Genres: answered.** The heady psychedelic genres stay; see `docs/GENRES.md`. The owner's reason for the
   whole project is Dave Tipper, which should steer what is taught first.
5. **Review** of the knowledge cards and scripted lessons.
6. **Probe presets** from `docs/PROBES.md`. The owner did not know what was wanted; it was explained on
   13 Nov 2026 as: start from Init, change one thing, save, and tell the assistant what Serum shows on screen.
7. The Syntorial list was complete; nothing was cut off.
8. Sharing with a friend: closed. Do not build a guest password.
9. Serum's look: the owner confirmed that copying the arrangement only is right. Lessons on the matrix tab and
   Serum's other specialist features come later; do not add them now.
10. **Video walkthroughs: much later.** The owner asked whether the assistant could record Ableton tutorials
   itself. Researched 13 Nov 2026 (one web search each, not verified against the projects' own pages): several
   community "Ableton MCP" servers let an assistant drive Live (tracks, clips, devices, transport), and several
   OBS MCP servers can start and stop screen recording through OBS's built-in WebSocket server. Both run on the
   owner's computer, so they need a session on that computer (Claude Code or the desktop app), not this cloud
   one. Nothing suitable is in Claude's own connector directory. Not set up; revisit when videos are wanted.

**Later the same day the owner asked for three more things.**
- Lessons on the distortion plugin **Rift (Minimal Audio)**, now that its manual is in the library (`library/rift-manual.json`, 64 pages, 137 pictures; taken in 13 Nov 2026). Lessons not written yet; Rift itself cannot run in the browser, so they will be read-and-do lessons or use a built-in distortion that follows the same ideas.
- **Six research papers**: five arrived and were taken in on 20 Nov 2026 with twelve other documents (see
  the note at the end of this file). Still missing: Frühauf, Kopiez and Platz, "Music on the timing grid".
- **Master Handbook of Acoustics, 7th ed., pages 1-500.** The uploaded files were named for a well-known
  piracy site, so the assistant did not take them in and told the owner why. Take the book in when the owner
  supplies a copy they have bought or borrowed (publisher ebook, library loan). Do not ingest the pirated
  files if they appear again. **They did appear again the same day**, described as "the clean version": the
  same five files, byte for byte (checked by checksum), with only the site's name removed from the file
  names. Declined again. Compare checksums before accepting any later copy.

**Books suggested to the owner (13 Nov 2026), for them to source legally:** Ableton's *Making Music* (Dennis
DeSantis); Welsh's *Synthesizer Cookbook*; Russ, *Sound Synthesis and Sampling*; Roads, *The Computer Music
Tutorial* and *Microsound*; Farnell, *Designing Sound*; Everest and Pohlmann, *Master Handbook of Acoustics*;
Moore, *An Introduction to the Psychology of Hearing*; Senior, *Mixing Secrets for the Small Studio*; Izhaki,
*Mixing Audio*; Katz, *Mastering Audio*; the Sound On Sound "Synth Secrets" series; and the manuals of the tools
they own. Not yet supplied.

---

## 10. Things outside the repo that a new session will not have

- **The owner's to-do page** (a Claude artifact, "Patchwalk To-Do"; its link is in `CLAUDE.md` under "Two to-do lists"). Rows live in its `todos` collection and are written with the `ArtifactData` tool; the latest done rows are `t111` (Studio) and `L37` (literature). Read a row before changing it (a write needs its version).
- **The owner's two Claude Code widgets** (the to-do pane that shows `docs/TODO.md`, and a usage pane) live only in a session's own folder. Their source is saved in `tools/mods/`; when the owner asks for the to-do widget, follow `tools/mods/README.md` to put them back.
- Test scripts for the Studio were in the session's scratchpad and are gone; they are quick to rewrite from the notes in `CLAUDE.md`.

- **Test presets are in the repo.** The four Serum 2 presets used as fixtures (bass rando, reese wailer, lead
  g funk, lead 70s hype) are committed in `fixtures/patches/`; the owner confirmed they made them. Only the
  Serum 1 `.fxp` files from the very first upload are left out, and nothing needs them.
- **The Serum 2 User Guide PDFs** are not in the repo; the extracted text in `library/` is, and that is all the
  guide needs. The owner does not have to re-upload anything for the guide to work in a new chat. The PDF would
  only be needed to redo the extraction (they split it into four parts last time because of size).
- **Images from books are extracted and stored.** `library/images/serum-2-user-guide/` holds 413 pictures from
  the manual with an `index.json`. The owner wants them in the repo only, for you and the guide to consult or
  to place in a lesson when useful, with no gallery in the app. For every new book, extract text and images
  together; the procedure is in `CLAUDE.md` under "Library images". The manual's screenshots also show how
  Serum displays values (for example sustain in dB), which can replace some guessed conversions.
- **Network access.** The old session ran in a cloud environment named "patchwalk" that allows Higgsfield's
  image host, Wikipedia, Ableton's Learning Synths and Sound On Sound. Other sites were blocked; Vercel's own
  site was unreachable. If you need a new site, propose adding it and explain why.
- **Higgsfield** is connected to the owner's account (about 268 credits left; an image costs about 0.25). It
  was used for the skin's artwork. The skin brief: "hippie thrifted patchwork clothes, leopard print, pink
  tiger print, fuzzy purse or sweater patches in crazy colours".
- **Vercel and GitHub** are the owner's accounts. The previous session could push to the repo but could not
  create repos, see deployments, or reach Vercel. The owner used a separate desktop agent to install the
  GitHub app and to deploy; write them a self-contained brief if something similar is needed again.

---

## 11. Short history, for context

(Newest first here; the numbered list below is the early history.)
- 17-18 Nov 2026: the Studio grew from a drum grid into a small DAW laid out like Ableton's Arrangement View:
  tracks and clips on beats, drum rack, sampler, thirty-one effects and eight note effects of our own, a
  Live-style device chain, mixer, returns, master effects, automation (lanes, shapes, curves, recording,
  take-over), MIDI and WAV export, a shared Library tab, and `docs/ABLETON_GAPS.md` from a full read of the manual.

1. Decoded the preset format and built the eight original milestones (decode, active modules, display values,
   signal-flow steps, AI "why" with validator, difficulty levels, knowledge cards, compare attempt).
2. Deployed to Vercel and put the whole site behind a password when the owner said nobody else may use it.
3. Added the sound-type guess, combination detection, diagrams, a ten-lesson Serum course and the skin.
4. Planned the full curriculum, checked it against Berklee Online's catalogue and Syntorial's titles, and
   fixed the genre list at 92.
5. Took in the Serum 2 User Guide: manual-based names in the app, a Serum-specifics track, and the library
   with "Ask the guide". Both Claude calls were then proven live.
6. Built the practice synth, seven playable lessons, "Hear it first", match-by-ear, read-aloud, and the guide
   in context. Later extended the synth and completed chapter 1 (fourteen lessons).
8. Added the filter, its draggable curve and chapter 2 (twenty-two lessons in all).
7. Fixed knowledge-card text that rendered as one block of capitals, and wrote this handoff.

## 16 Nov 2026: physical models made less electronic
The owner reported the drum, string and tube sound electronic or awful. Drum, string and tube were reworked
(see "Realism pass on the physical models" in `CLAUDE.md`). Waiting for the owner to say whether they now sound
better; if not, ask which instrument and what is wrong (too bright, too dull, too short, too clean). The bowed
string has not been touched.

## 16 Nov 2026: "Walk me through it" and the physical models on hold
- The guide has a second mode, step-by-step walkthroughs (see `CLAUDE.md`, "Walk me through it"). It has only
  been checked with a stand-in reply. **First thing to ask the owner: did a real walkthrough keep its labels
  ("the text says" / "my synthesis"), and was the outline sensible?** Fix the prompts in `src/library/walk.ts`
  from what they report.
- The Physical models tab is on hold until the owner uploads the literature (list given to them on 16 Nov;
  `docs/LITERATURE.md`). Then lessons come first, written from the texts.


## 17 Nov 2026: Studio tab (the DAW begins)
The owner asked to start the working DAW as its own tab, drums first, with parts reusable in lessons. Built:
the drum programmer (`src/daw/`, `src/ui/DrumGrid.tsx`, `src/ui/DawView.tsx`; details in `CLAUDE.md` under
"Studio tab"). Timing was measured in a browser; nobody has heard the drums, which are synthesized by our own
recipes. Next pieces, in this order unless the owner says otherwise: a lesson or two that uses the grid; one
audio clock shared with the practice synth; a piano roll so the synth plays notes; chaining patterns; a mixer.
Also built since the last entry and described in `CLAUDE.md`: "Draw this" playable models, the shared
Walkthroughs library, side threads by highlighting, and "Build this lesson in Serum 2".

Later the same day the Studio became a small DAW: a song of tracks and clips, a 16-pad drum rack with the
learner's own sound files, the practice synth on synth tracks with a piano roll, all on one audio clock
(`CLAUDE.md`, "Studio is now a small DAW"). Timing and trimming were measured; nobody has heard it. Good next
steps: recording from the keys or a MIDI keyboard, undo, note loudness, per-track effects, export, and the
first lessons that use the Studio.

Then: undo and redo, recording into the open clip, saved breaks and racks, and MIDI files out and in (the
only format that moves both ways with Ableton; its own rack and set files are private and are not written).
Nobody has opened one of our MIDI files in Ableton yet: ask the owner how it went.

Later still: the Walkthroughs tab became the Library tab, with shelves for sounds, breaks, racks and songs
kept in the site's database (the owner asked for dropped-in samples to be stored and shared). Not yet run
against the real database. Drum-pattern literature leads are in `docs/LITERATURE.md`; the owner's wishes for
eastern drums and late-2000s club pop are in `docs/CURRICULUM.md`.

The Studio was then rebuilt in the organisation of Ableton's Arrangement View (control bar, browser, track
headers at the right, Clip/Device detail view) with Live's keyboard shortcuts for everything it has
(`CLAUDE.md`, "Studio laid out like Ableton's Arrangement View"). The owner wants it to keep moving toward
Ableton's look and organisation; likely next: dragging clips with the mouse, split, zoom, Session View.

The owner then asked for all the planned stock plugins, one by one. `docs/STOCK_PLUGINS.md` has the list of
thirty, the order and how to add one. The device chain and Utility are built and measured; next is the
three-band EQ. After each one, report what it does and what was measured, then go on to the next.

**State at the end of 17 Nov 2026 (update this paragraph with every push that adds a device).** Thirty-one
devices are built and measured: Utility, Three-band EQ, Eight-band EQ, Channel EQ, Compressor (knee, meter,
sidechain from another track), Glue compressor, Limiter, Gate, Multiband dynamics, Saturator, Overdrive,
Amp, Cabinet, Pedal, Crusher, Drum bus, Erosion, Vinyl distortion, Auto filter, Auto pan, Chorus, Phaser and
flanger, Delay, Echo, Filter delay, Beat repeat, Reverb, Resonators, Shifter, Spectrum, Tuner.
Two kinds of device: ones made from the browser's ready parts (`fxnodes.ts`) and ones worked out sample by
sample in an AudioWorklet (`dsp.ts`, tested directly in `tests/dsp.test.ts`). Every device was measured by
building it on an `OfflineAudioContext` in a headless browser; the numbers are in `docs/STOCK_PLUGINS.md`.
Synth tracks also have a second chain in front of the synth, the seven note effects (Arpeggiator, Chord,
Note length, Pitch, Random, Scale, Velocity; `notefx.ts`), which change the notes written in clips but not
keys played live. **The owner has heard none of them: ask which sound wrong and fix those first.** Every
numbered item on the list is now built except Dynamic Tube. Still to build: the hard ones (vocoder,
spectral effects, grain delay, looper), and note effects on live keys. Known weak spots: the pitch shifter warbles and can sit a few Hz off the exact
interval; the reverb is plain; the phaser has no feedback; amp, cabinet, pedal, drum bus and vinyl are
general shapes with our own numbers, so they most need the owner's ear.

The site can also be installed as a desktop app from the browser (`CLAUDE.md`, "Desktop app"). Not checked
on the live site behind the password: ask the owner whether Chrome offered Install.

**Standing instruction from the owner (17 Nov 2026): keep going through the Studio and make it work more and
more like Ableton.** First pass done the same day: EQ dots drag; clips drag to move, Alt-drag to copy, and
resize from the right edge; Ctrl/Cmd+E split and Ctrl/Cmd+J consolidate; a loudness (velocity) lane under
the piano roll. The list of what is still unlike Ableton is in `CLAUDE.md` ("Closer to Ableton, first
pass"): pick from the top of it each time, check in a browser with bar 1 looped, and update both to-do lists.
Second pass, same day: a mixer (pan and a meter on every track, a Master row with volume and a meter) and
"Download .wav", which renders the whole song to a sound file. Known limit: the synth's slow modulation
stands still in an exported file. Next candidates are listed in `CLAUDE.md` ("Closer to Ableton, second pass").
Third pass: the EQ curves show the live spectrum behind them (the owner reported it missing), and
**automation lanes** exist: an A button on each track opens lines along the song that move its level, pan
or any effect slider, live and in exported files (`src/daw/automation.ts`). Not yet: automating the synth's
own knobs, sliders that move on screen, and the automation lessons the owner asked for.
Fourth pass: automation now reaches every continuous knob of a synth track's synth; faders, pan and effect
sliders move on screen while automated (the synth's own knobs do not yet); the arrangement zooms (+ and −);
and there are **return tracks with sends** (up to two; A starts with a reverb, B with a delay). Details and
measurements are in `CLAUDE.md` ("Closer to Ableton, fourth pass"). Still to do there: a time marker and
free-length clips, grid sizes, Session View, note effects on live keys, and the automation lessons.
The effect chain is now drawn after Live's device view (grey panels of one height, round knobs with cyan
arcs, orange switches, dark displays; drag a title bar to reorder, drag effects in from the browser), and
the synth is a small device at the front of the rack that opens only when "Open" is clicked. The owner
asked for the Ableton look here, which replaces the "our own look" rule for the chain only; no Ableton
artwork, fonts or logo. See `CLAUDE.md` ("The effect chain drawn like Live's device view").
**`docs/ABLETON_GAPS.md` (17 Nov 2026) lists everything in the Ableton manual the Studio lacks, in a
suggested order with page numbers; pick the next Studio work from it and tick items off there.**
First batch of its quick wins is built (tap tempo, note tools, clip doubling, key highlighting, note
chance, play from a bar, F1-F8, browser search, effects on the master, note echo). Still open in the
quick-win group: count-in and overdub, locators, hearing a sample before loading, sidechain on more
devices, Utility and Saturator extras, fold to scale, the rest of the shortcuts.
Second batch: sidechain on the gate and glue compressor, markers, a one-bar count-in when recording,
hear-before-loading in the browser, and Fold to the key. **The owner wants an extensive Ableton course:
a lesson for every Studio feature. Not started; the plan is at the top of `docs/ABLETON_GAPS.md`.**
The piano roll now has a finer grid (thirty-seconds and triplets, a Grid menu, Quantize). Next from the
list: break slicing, clips of any length, knobs on the built-in drums.
A **sampler** is built: click a sound under Samples with a synth track selected and the track plays that
file across the keys (`src/daw/sampler.ts`, `SamplerPanel.tsx`).
Also built: slicing a sound onto pads (✂ under Samples), Decay and Tone on the built-in drums, and
automation of the sampler's knobs. Automation now moves with its clip (Lock auto stops that), works on
return tracks and the master, and can be recorded by moving a control while Record is on. Note clips can be 1 to 16 bars and drum clips 1 to 4, and every automation lane has a
Shape menu (ramps, triangle, sine, square, saw) drawn over the selected clip. Since 18 Nov clips start and end on any beat (Ctrl/Cmd+E
cuts at the time marker set by a click), automation lines can be bent (Alt-drag), and an automated fader or
effect knob is marked red; moving one by hand switches its line off until "Back to automation" is pressed.
Still open: the next unticked items in `docs/ABLETON_GAPS.md`, and the Ableton course (no lessons yet).
Later on 18 Nov: the quick wins are done except hearing a break or sound before loading and a few shortcuts
(see the "Latest" block in section 8). Recording now has a count-in menu and an Overdub switch.

## 20 Nov 2026: a large batch of literature taken in
The owner uploaded seventeen documents and the Groove MIDI Dataset; all are in the library (38 texts now)
and pushed. The list, with library ids, is in `docs/LITERATURE.md` ("Taken in on 20 Nov 2026"); how it was
done and the new script `scripts/library_post.py` are in `CLAUDE.md` ("Literature taken in on 20 Nov 2026").
The owner's question was "what should we plan to do first?": they were told the texts go in first, then
lessons, and were offered an order (a supersaw from Szabo, FM lessons from Chowning, a better reverb from
Dattorro, groove and microtiming lessons using the Groove MIDI data, breakbeat lessons). **Wait for the
owner's choice of what to build first from the new texts; the Studio's standing instruction still holds
otherwise.** Still missing: Frühauf, Kopiez and Platz (the sixth paper); Fletcher and Rossing (the owner's
condition for un-pausing the Physical models tab); every book on the "to buy or borrow" lists; any text on
hearing or bioacoustics. Nobody has asked the live guide a question from the new texts yet.
The to-do and usage widgets' source is in `tools/mods/` (its README says how to put them back); in the
owner's app the side pane is not drawn, so `/todo` prints the list and the To-Do page is the real view.

## 20 Nov 2026, later: a Sources shelf, and 305 lesson ideas
- The Library tab opens on a new **Sources** shelf: every text as a sortable table with a search inside them
  (`CLAUDE.md`, "Sources shelf in the Library tab"). Texts are deliberately not shown whole; the owner may ask
  for a page reader. A new book needs a card in `SOURCES` (`src/library/catalog.ts`) or a test fails.
- **`docs/LESSON_IDEAS.md`** is the answer to the owner's request for a lesson from every useful concept in
  the new texts: 305 ideas with pages, what each needs, the builds they depend on (with the papers' numbers)
  and a suggested order. **Next: the owner chooses where to start; the default is the 85 lessons that need
  nothing built, FM first.** Write lessons from the library text itself, not from that file's one-liners.
- Expect 787 passing tests in 38 files.

- Later still on 20 Nov: the owner asked what holes the reading exposed and had them written into the course
  map: ten new chapters at the end of `docs/CURRICULUM.md` (162 rows, 52 of them new lessons). **When the
  owner says go, write lessons chapter by chapter from there; "Reading your tools" is first in teaching
  order.** Codes in square brackets there point into `docs/LESSON_IDEAS.md`.

## 20 Nov 2026, last: lesson writing has begun
The owner said "begin writing lessons". The first chapter from the new course map is built: **"Reading your
tools"**, eight playable lessons after Filters (`src/course/lessons/tools.ts`, ids CV.1 to CV.8; details and
measurements in `CLAUDE.md`, "Lessons from the literature begin"). With it: the level meter now shows peak
and average, and an engine fix (all of a note's oscillators start at one instant). 130 playable lessons,
620 quiz questions, **789 passing tests in 38 files**.
**Next step: keep writing, chapter by chapter, in the order at the end of `docs/CURRICULUM.md`: "When
digital sound goes wrong" next, then "Expression", then "One delay, many effects".** For each lesson: read
the pages in `library/` first (not the one-line idea), measure every number through the real engine in a
browser before a remark quotes it, add quiz questions to `quiz-g.json`, a why-line to `why-g.json` and a walk
in `WALKS`. All of today's work (literature, Sources shelf, ideas, course map, these lessons) is on branch
`claude/new-session-dfvcsr` and **not on the live site: the owner has not yet said "yes" to copying it to
main.**
