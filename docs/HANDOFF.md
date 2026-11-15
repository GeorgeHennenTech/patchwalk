# Patchwalk — handoff document

**To the assistant reading this:** you are taking over an ongoing project from a previous session. The owner
has dropped this file into a new chat to save context and will often say nothing else. Do not ask them to
re-explain anything here. Read this file, do the "Start here" steps, then carry on with "What to do next".
Write to the owner the way section 2 describes.

Last updated: 13 November 2026, after commit "Add the filter chapter to the practice synth".

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
   Expect 323 passing tests, none skipped.
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
| **Lessons** | The practice synth (two oscillators, unison, sub, noise, phase, generated wavetables, a filter with a draggable curve, two envelopes, three LFOs, velocity and key position as sources, four macros, and warp, FM and ring modulation on oscillator A; shown as a rack of panels with knobs) and eighty-seven playable lessons (including seven "Effects" lessons on a new effects rack of distortion, EQ, compressor, chorus, delay and reverb, and the first seven "Impacts" lessons: kick, sub drop and bass notes as hits; all built 13 Nov 2026): chapters 0 to 5 (oscillators, filters, envelopes, LFOs, modulation), a macro chapter and chapter 6 "Reshaping the wave" (warp, sync, squeeze, FM, ring modulation, checkpoint; built 13 Nov 2026), a match-by-ear lesson (C1.M) and the chapter checkpoints (C1.C, C2.C, C3.C, C4.C, C5.C). Each lesson: optional "Hear it first" demo, idea text, a knowledge card, guided steps with only the needed controls shown and live targets, guide remarks written by code, optional blind ear check, optional match-by-ear rounds, recap, suggested next lesson, read-aloud, and an ask box. Any order; progress saved in the browser. |
| **Serum tasks** | The older ten lessons: a task done in Serum, checked by dropping the saved preset. |
| **Ask the guide** | Answers a typed question from the library (the Serum 2 User Guide, the Ableton Live 11 manual, and the knowledge cards) with page citations, quoted source text, the cited page's pictures, and links to matching lessons. Says "not in the library" instead of guessing. Each picture has a "Show me where" link that asks Claude to box and label the relevant places in it (built 13 Nov 2026; aim not yet tested against the real API). |
| **System check** | One-click end-to-end test of the explanation service. |

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

**Later the same day:** five papers on classic synth wave shapes and nine on physical modelling went into the library; four wavetables were built from formulas, with a lesson (99 lessons now); and the first physical-modelling instrument exists as the "String lab" tab (`src/strings/string.ts`, `src/ui/StringLab.tsx`; see CLAUDE.md). Next for it: make the lesson engine able to use it.

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
- **Six research papers** for the library: Chowning 1973 on FM synthesis (JAES); Rajala et al. 2022 on
  infrasound, loudness and annoyance (Applied Acoustics); Senn et al. on groove in drum patterns (PLOS ONE);
  Hove et al. 2014 on timing perception for low pitch (PNAS); Frühauf, Kopiez and Platz on microtiming and
  groove ("Music on the timing grid"); and a study of expert microtiming and groove in swing and funk. **They
  were listed but not attached**; ask for the files. They feed the FM chapter, the hearing lessons in
  `docs/BIOACOUSTICS.md`, and a set of rhythm and groove lessons (track H).
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
