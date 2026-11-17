# Patchwalk to-do

The working list for the owner and the assistant. Tick a box when a thing is done. The owner's live copy is the "Patchwalk To-Do" page
(https://claude.ai/artifact/7sHF6r2vvBuxa8DSkcfcPz); keep the two in step. `docs/HANDOFF.md` has the background.

## The queue ("proceed with the next task")
Agreed with the owner on 14 Nov 2026: they prompt from their phone with "proceed with the next task" and the
assistant does the first unticked item here, start to finish (build, test, check in a browser, push), ticks
it, and reports in a few lines. None of these needs the owner or spends credits. Rules for design are in
`docs/LEARNING_RESEARCH.md`.

- [x] 1. Focus mode (a switch, remembered per person): steps and minutes left always in view, a "good place to stop" marker after each lesson, and "you were here" when coming back
- [x] 2. End-of-lesson recall: two or three questions answered from memory in place of the recap being read, with the answer shown at once
- [ ] 2b. (Res 2 done 15 Nov; awaiting the owner's verdict before Vero, horn, driver) Sound-system diagrams, definition pass (owner asked 14 Nov 2026 after seeing the "Anatomy" Claude Code skill, MIT, github.com/wheresryan22/anatomy, which draws dense isometric SVG machines with a live readout). Keep our real 3D and our sourcing; borrow its craft: crisp edge lines on every part, far more small parts (bolts, handles, frames, cables) so no face is bare, one big live readout number per view in a card layout, moving sound drawn as an effect layer, and close-up screenshot checks. Start with the Res 2, then the horn, then Vero.
- [x] 3. Guide answers, new layout: the one-line answer first, quiet citations, "go deeper" follow-up buttons, one check question
- [x] 4. Small fixes: pointing at the Res 2's upper horns with the mouse; the eye button on the Account panel's password boxes; the Res 2 standing on a bass cabinet, since it needs one below 60 Hz
- [x] 5. "Why this matters" line on every lesson, tying it to music the learner wants to make
- [x] 6. Coming back: recall questions from finished lessons return after days, then weeks
- [x] 7. A mixed by-ear checkpoint that draws on several chapters at once (filter, envelope, LFO)
- [x] 8. Reorderable effects rack with a bypass per effect (needed before the processing-chains track)
- [x] 9. Second filter, with routing between the two, and two more filter types (peak and shelf)
- [x] 13. Lessons for the new controls: peak and shelf, two filters, Osc B voices and warp, the order of effects
- [x] 14. Saved sounds and lesson recall stored with the account
- [x] 15. Three more warp modes (Flip, Steps, Fold)
- [x] 16. Five more macro recipes (21 now)
- [x] 17. Blind ear checks for cutoff, filter type, and tremolo against vibrato
- [x] 18. Knowledge cards for FM, ring modulation and two filters
- [x] 19. A smooth drawn LFO shape
- [x] 20. A lesson on Fold, Steps and Flip; ear checks for attack and LFO speed
- [x] 21. Five free papers on classic synth wave shapes taken into the library; four wavetables built from their formulas (Phase saw, Analogue saw, Phase pulse, Formant)
- [x] 22. Physical-modelling literature: nine free texts taken into the library (two theses are scans with no text; the piano overview would not download)
- [ ] 23. More formula wavetables (done 15 Nov: Phase square, Driven square, Driven saw). Also done: a "Circuit fold" warp from the Lockhart wavefolder formula. Still to do: the CZ resonant shapes, a supersaw preset (the thesis link was dead), the Serge folder
- [x] 24. A lesson on the new wavetables ("Shapes from classic synths")
- [x] 25. String lab: a plucked string built from the papers (the first physical-modelling instrument), as its own tab
- [x] 25b. String lab: a second string for beating, and match a hidden string by ear
- [x] 25c. Drum lab: a drum head as ringing modes (round and square), click to hit it anywhere
- [x] 25d. Six lessons on the physical models (four on the string, two on the drum), with quizzes
- [x] 25e. Five more impact lessons: snares, booms, the filter snap, audible subs, risers
- [x] 25f. Tube lab: a blown tube with a reed (it only speaks inside a range of breath), with two lessons
- [x] 25g. The guide's search reaches technical papers from everyday words
- [x] 25h. Bow lab: a bowed string with a map of bow speed against pressure, and a lesson
- [x] 25i. "Circuit fold" warp from the Lockhart wavefolder paper
- [ ] 26. String lab next: make it an instrument the lesson engine can use (steps, checks, match by ear), then stiffness, two strings, a body, and a worklet for bends and bowing
- [ ] 27. Genre lessons that use the new wavetables
- [x] 10. Osc B as a full oscillator: unison and warp
- [x] 11. Vero: build your own column (choose cabinets and angles, see the coverage change)
- [x] 12. Save and load your own patches on the practice synth

Waiting on the owner, not in the queue: set `OWNER_EMAIL` in Vercel and make their account; a mail service
for "Forgot password?"; a real MIDI keyboard test; how the 3D views look on their screen.

## Build next
- [x] Envelope lessons: five lessons and a checkpoint, with an envelope drawing you can drag
- [x] Envelope hold and fall shape (straight, eased, sharp), with a lesson
- [x] Tempo, a click, and LFOs that sync to the beat, restart or run free, fade in, and can be drawn; three lessons
- [x] Warp, sync, FM and ring modulation on the synth, with five lessons and a by-ear checkpoint ("Reshaping the wave")
- [x] Knowledge cards for FM and ring modulation
- [ ] Lesson scripts in `docs/lessons/` for the lessons written straight into code
- [x] LFO lessons: three lessons and a checkpoint
- [x] Modulation lessons: routes and amounts, one way or both ways, modulating a modulator, and a checkpoint
- [x] Velocity and key position: as sources on the synth, and a lesson
- [x] Macro chapter: seven macro recipes, two macros on one sound, and a by-ear checkpoint
- [x] First impact lessons: note start, kick, fall size and speed, sub drop, bass note as a hit, pitch at the front, checkpoint
- [x] Effects rack (distortion, EQ, compressor, chorus, delay, reverb) and seven effects lessons
- [ ] Effects: ducking (sidechain), multiband, and effects as modulation destinations (reordering done 15 Nov)
- [x] Editable matrix: change any connection in one table, add rows so one source moves several things; a lesson on it
- [x] Eight more macro recipes using effects, warp, FM and the kick (16 recipes and lessons in the macro chapter now)
- [x] Any knob can be a destination for any source; a handle on each knob sets a source's depth there; two lessons
- [x] Drag a source onto a knob to connect it, with a lesson
- [x] Whole synth made compact: Synth / FX / Matrix pages, tabbed envelopes and LFOs, a small macro block as in Serum
- [x] List of every Serum 2 feature the practice synth is missing (docs/SERUM_GAPS.md, about 550 rows, with a suggested order)
- [ ] Close more Serum gaps (done so far: mono, legato and glide; wheels and MIDI; the matrix's "aux source"; Osc B's wavetable, pan, warp and unison; a second filter with routing; peak and shelf; Flip, Steps and Fold warps; reorderable effects; a smooth drawn LFO). Next in `docs/SERUM_GAPS.md`: per-source routing to each filter, an Osc C, more filter types, a second warp slot.
- [ ] More macro recipes (24 so far; the owner wants many; each is a few lines of data in the macro lesson file)
- [x] Scaling a route with a second source (mod wheel) and its lesson (done 14 Nov: the matrix's "Scaled by" column and its lesson)
- [x] Blind ear checks for the filter, envelope, LFO and modulation lessons (done 15 Nov for filter, envelope and LFO lessons: five kinds; none yet for modulation)
- [x] Pulse-width lesson in the oscillator chapter (covered by "Squeeze: pulse width and beyond" in Reshaping the wave)
- [ ] Processing chains track (owner, 14 Nov 2026): after the synth material and our own effect courses, lessons on stacking stock plugins after the synth. Needs a reorderable effects rack with a bypass per effect first.
- [ ] Sound systems track with high-definition diagrams (owner, 14 Nov 2026): needs a source text on loudspeakers; labelled diagrams drawn by code.
- [ ] A spoken intro clip at the top of every lesson (owner, 14 Nov 2026): test one with Higgsfield first; it spends credits.
- [ ] Music theory lessons that use the MIDI keyboard (owner, 14 Nov 2026): track I of the curriculum. First eleven built 15 Nov ("Notes and chords": semitones and octaves, intervals, major and minor chords, scales, chords from a scale, inversions, a four-chord progression, sevenths, changing key, reading the staff, playing a tune from the page, with sheet music that follows what you play); seven more planned.
- [ ] Source texts on sound systems for the owner to find: see `docs/LITERATURE.md`.
- [ ] Build from `docs/LEARNING_RESEARCH.md` (owner, 14 Nov 2026): Focus mode for ADHD, end-of-lesson recall, spaced return, mixed by-ear checkpoints, "why this matters" lines, fading guidance, optional noise, the new answer layout.
- [ ] Remaining synthesis chapters from the course plan (122 lessons built)

## Synth
- [x] Filter with a draggable curve
- [x] Module panels with knobs, in Serum's arrangement
- [x] Two envelopes and three LFOs, with neon rings on the knobs they move
- [x] Velvet-and-neon skin, with an on/off switch
- [x] Z and X keys move the computer keyboard down and up an octave
- [x] Sound views (scope, spectrum, spectrogram, level, filter curve) switchable at any step
- [x] Envelopes and LFOs can move wavetable position and resonance (done: any knob can be a destination)
- [x] Four macros with three slots each; any continuous knob can be a destination
- [x] Matrix view: every connection listed (read-only)
- [x] A full Matrix tab you can edit, as in Serum (owner asked; also lifts the one-destination-per-source limit)
- [x] More than one destination per envelope or LFO (done: matrix rows)
- [x] Drag a source onto a knob to connect it
- [x] Tempo clock and click; LFOs can sync to the beat
- [x] Effects: distortion, chorus, delay, reverb, EQ, compressor
- [x] MIDI keyboard input (built; not yet tried with a real keyboard)
- [ ] More views: stereo, tuner, loudness meter
- [x] LFO shapes now reach exactly full depth (the browser's built-in square was about 15% shallow)
- [x] One-way or both-ways switch on each LFO; LFO 1 rate as a destination

## Guide and library
- [x] Pictures from a cited page appear in the guide's answer, every time
- [x] Answers link to the practice lesson that covers the topic
- [x] Ableton Live 11 manual, pages 1 to 500: text and 428 pictures taken in
- [x] Ableton manual, pages 501 to 867: the whole manual is now in (814 pages of text, 743 pictures)
- [x] Rift manual (Minimal Audio): 64 pages of text and 137 pictures taken in
- [x] "Show me where": the guide boxes and labels the relevant places in a cited picture (owner to test how well it aims)
- [x] Guide: follow-up questions in one conversation, side notes set apart from the steps, chats saved in the browser
- [x] Database: "Who's playing?" with each person's lessons and chats on any device, answers and marked pictures shared, optional own Claude key
- [ ] Guide: an "this answer is good" button for the owner, so approved answers join the library
- [ ] Guide: mark up a walkthrough's pictures automatically, step by step (today it is one click per picture)
- [x] Guide: "Walk me through it": step-by-step walkthroughs written across all the texts, each part labelled "the text says" or "my synthesis", differences between texts stated, book maths explained, ending in a Serum 2 or Ableton recipe (16 Nov; owner to try it live)
- [ ] Guide: better search across many books (done 15 Nov: related technical words; done 16 Nov: long pages split into passages; still to do: have a small model pick the best)
- [x] Guide: "Draw this" on a walkthrough step: a formula as a graph with sliders, or a ready-made picture, chosen by the guide and drawn by the app (16 Nov; owner to try it live)
- [x] Guide: playable models for "Draw this": sidechain ducking, compressor, delay, beating, FM, wavefolding; boxes-and-arrows retired (16 Nov; owner to judge look and sound)
- [x] "Build this lesson in Serum 2" button on each practice lesson: written once from the Serum 2 User Guide, then kept in the database for everyone (16 Nov; owner to try it live)
- [ ] An owner-only "build every lesson for Serum 2" run, if wanted (about 100 paid calls)
- [ ] Guide: "Try it on the practice synth" from a walkthrough step, with the step's settings loaded
- [x] Guide: shared library of walkthroughs in the database and a "Walkthroughs" tab to browse it; everything anyone generates is kept for all (16 Nov; owner to try it live)
- [x] Guide: side threads on a walkthrough: highlight any words to ask about them; branches off answers, three deep, colour-coded, collapsible, with a way back (16 Nov; owner to try it live)
- [ ] Guide: keep each person's place, ticks and side threads in a walkthrough with their account (today per browser)
- [ ] Place library pictures inside lessons where they help
- [ ] Voice for the guide using Higgsfield (owner's choice): test quality, then generate each narration once and store it
- [ ] Remember what the learner found hard, not only what they finished
- [ ] Show why the system check rejected a first attempt
- [ ] Video walkthroughs the guide can pull up (much later; see the research note in the handoff)

## Bigger builds, later
- [ ] Listening lab: acoustics, psychoacoustics, ear training
- [ ] Extended synthesis methods (FM, granular and others)
- [x] Studio tab: drum programmer (17 Nov 2026): grid, swing, strengths, saved patterns; drums synthesized
- [x] Studio: upload your own drum sounds (kept in the browser), tune per drum, genre starting points (17 Nov 2026)
- [x] Studio: drum rack (16 pads, start/length/fade, pan, choke groups), track grid with clips, synth on tracks, piano roll, one clock (17 Nov 2026)
- [x] Studio: undo/redo, record from keys and pads, saved breaks and racks, MIDI files in and out (17 Nov 2026)
- [x] Library tab; Studio sounds, breaks, racks and songs kept in the database; nine more built-in drums (17 Nov 2026)
- [x] Studio laid out like Ableton's Arrangement View, with its shortcuts; note selection and draw mode; metronome (17 Nov 2026)
- [ ] **Stock plugins, one at a time (owner, 17 Nov 2026): see `docs/STOCK_PLUGINS.md`.** Done: the device chain, 1 Utility. Next: 2 Three-band EQ.
- [ ] **Automation (owner asked 17 Nov 2026):** automation lanes in the Studio (a line per track that moves a
  setting over time: a synth knob, a track's level, an effect), then lessons on automation with many
  different combinations of automations to try, in the way the macro chapter has many recipes
- [ ] Studio, Ableton-like, still missing: drag clips with the mouse, split and consolidate, zoom, grid sizes, Session View, per-track effects
- [ ] Owner to try: drop a sample in the Studio and check it shows in Library > Sounds on the live site
- [ ] Studio next: note loudness, copy/paste, per-track effects, export to a sound file, a kit as a zip of sound files, lessons that use it; earlier list: one clock shared with the synth, piano roll, chaining patterns, mixer, per-drum sound, a lesson using the grid
- [ ] Mini DAW: tracks, mixer, automation, export
- [ ] Genre lessons, starting with glitch-hop, breakbeat and psydub
- [ ] Lessons on Serum itself: the matrix tab and the rest of its specialist features (50 planned)
- [ ] The full curriculum: about 475 lessons across 17 tracks

## New tracks the owner asked for (13 Nov 2026)
- [ ] (string engine built 15 Nov as the String lab; lessons not yet) Physical modelling: string engine and the plucked-string chapter (plan in docs/PHYSICAL_MODELING.md, about 60 lessons)
- [ ] Physical modelling: bars, bells and plates (resonator bank)
- [ ] Physical modelling: drums, tubes and breath, bodies and hybrids
- [ ] Bioacoustics: formant filters on the synth, then "how animals make sound" (plan in docs/BIOACOUSTICS.md, about 45 lessons)
- [ ] Bioacoustics: animal signals, choruses and soundscapes
- [ ] The ear and illusions: a listening-lab page for the hearing and illusion lessons
- [ ] Source texts for bioacoustics and hearing (none in the library yet; the explanations wait for them)
- [ ] Lessons on the distortion plugin Rift (Minimal Audio); its manual is in the library
- [ ] Take in six research papers the owner listed (FM synthesis, infrasound and loudness, groove and microtiming, bass and timing); the files have not arrived yet
- [ ] Rhythm lessons drawing on the groove and microtiming papers
- [ ] Master Handbook of Acoustics: waiting for a copy the owner has bought or borrowed (the uploaded copy came from a piracy site and was not taken in)
- [ ] Impacts, hits and striking bass: about 50 lessons planned (docs/IMPACTS.md); the kick, sub-drop and bass-note lessons can be built on the synth as it is
- [ ] Literature: the full list of what is in, on its way and wanted is docs/LITERATURE.md

## Rebuild-a-patch accuracy
- [ ] Use the manual's screenshots to fix display values (for example sustain in dB)
- [ ] Replace guessed control labels with the manual's names
- [ ] Settle unverified readings from the owner's probe presets

## Owner
- [x] Upload the Ableton manual, pages 1 to 500
- [x] Upload the rest of the Ableton manual
- [x] Upload the Rift manual
- [ ] Find more books for the library (EPUB or text-based PDF)
- [ ] Review the 39 knowledge cards, 43 lesson scripts, 498 quiz questions and 98 "why this matters" lines (all drafts)
- [ ] Probe presets: start with the ten most useful (the assistant has explained what to do)
- [ ] Keep reporting how things sound and feel
