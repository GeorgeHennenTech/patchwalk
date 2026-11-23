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
- [ ] Practice synth effects: ducking (sidechain) and effects as modulation destinations (reordering done 15 Nov; multiband is in the Studio as a stock plugin)
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
- [x] Studio: effects on every track, in a chain you can reorder and switch (17 Nov 2026)
- [x] Stock plugins, first 24 of 30, each measured (17 Nov 2026; none heard by the owner yet): Utility, Three-band EQ, Eight-band EQ, Channel EQ, Compressor with knee and meter, Glue compressor, Limiter, Gate, Multiband dynamics, Saturator, Overdrive, Crusher, Drum bus, Erosion, Auto filter, Auto pan, Chorus, Phaser and flanger, Delay, Echo, Filter delay, Reverb, Resonators, Shifter
- [x] Patchwalk installs as a desktop app from the browser (17 Nov 2026; owner to check Chrome offers Install on the live site)
- [x] Stock plugins, seven more (17 Nov 2026): Beat repeat, Amp, Cabinet, Pedal, Vinyl distortion, Spectrum, Tuner; and the compressor can listen to another track (sidechain). 31 devices in all
- [x] Note effects in front of the synth (17 Nov 2026): Arpeggiator, Chord, Note length, Pitch, Random, Scale, Velocity. Every numbered stock plugin is now built except Dynamic Tube
- [ ] Stock plugins still to build (see `docs/STOCK_PLUGINS.md`): Dynamic Tube; the hard ones (vocoder, spectral effects, grain delay, looper); note effects on keys played live
- [ ] Owner to listen to the 31 stock plugins and say which sound wrong (known weak spots: the pitch shifter warbles, the reverb is plain)
- [ ] Lessons on automation with many combinations to try (owner asked 17 Nov 2026; the lanes themselves are built)
- [x] Studio, closer to Ableton, first pass (17 Nov 2026): EQ dots drag; clips drag to move, Alt-drag to copy, resize from the right edge; Ctrl/Cmd+E split, Ctrl/Cmd+J consolidate; loudness lane under the piano roll
- [x] Studio, closer to Ableton, second pass (17 Nov 2026): pan and a level meter on every track, a Master row with volume and a meter, and "Download .wav" (the whole song as a sound file)
- [x] Studio, closer to Ableton, third pass (17 Nov 2026): the EQs show the live spectrum behind their curves; automation lanes (an A button on each track: level, pan or any effect slider, live and in exported files)
- [x] Studio, closer to Ableton, fourth pass (17 Nov 2026): automation of the synth's own knobs; faders and effect sliders that move while automated; zoom (+ and −); return tracks with sends
- [x] Studio: the effect chain drawn like Ableton's device view (knobs, grey panels, drag to reorder, drag in from the browser); the synth is a small device at the front of the rack that opens on demand (17 Nov 2026)
- [x] Read the whole Ableton manual against the Studio and list what is missing, in a suggested order: `docs/ABLETON_GAPS.md` (17 Nov 2026)
- [x] Studio quick wins, first batch (17 Nov 2026): tap tempo, note tools, ×2 clip length, key highlighting, note chance, play from a bar and Shift+Space, F1-F8, browser search, effects on the master, note echo
- [x] Studio quick wins, second batch (17 Nov 2026): sidechain on gate and glue compressor, markers, count-in when recording, hear a drum or sample before loading, Fold to the key
- [x] Studio: a finer grid in the piano roll (1/32 and triplets, a Grid menu, Quantize with Ctrl/Cmd+U) (17 Nov 2026)
- [x] Studio: a sampler instrument (one sound file played across the keys; held, looping or one-shot) (17 Nov 2026)
- [x] Studio: slice a sound onto pads (4, 8 or 16), Decay and Tone on built-in drums, automation of the sampler's knobs (17 Nov 2026)
- [x] Studio: automation moves with its clip (with a Lock switch), lanes on return tracks and the master, automation recorded by moving a control (17 Nov 2026)
- [x] Studio: clips of 1 to 16 bars (drums 1 to 4), and ready-made automation shapes on every lane
- [x] Studio: clips on any beat, cut at a time marker, curved automation, automated controls marked with "Back to automation"
- [x] Studio quick wins, third batch (18 Nov 2026): jump between markers, Space plays from the time marker, Random loud, a choice of count-in and an Overdub switch (off: recording replaces), sidechain on the auto filter and multiband, Utility's bass mono / one side only / remove offset, the Saturator's colour and soft clip
- [ ] Studio quick wins still open: hear a break or sound before loading it, the rest of the shortcuts (halve or double the loop, insert silence, A for automation); then the loop brace, cut / duplicate / delete time, a filter and saturator per pad (see `docs/ABLETON_GAPS.md`)
- [ ] An extensive Ableton course: a lesson for every Studio feature, done in the Studio and ending with the same thing in Ableton Live (owner asked 17 Nov 2026; needs the lesson engine to know the Studio)
- [ ] Studio, closer to Ableton, next (owner's standing instruction): a time marker and free-length clips; grid sizes; Session View; note effects on live keys; synth knobs that move on screen while automated; automation on return tracks
- [ ] Owner to try: drop a sample in the Studio and check it shows in Library > Sounds on the live site
- [ ] Studio next: a kit as a zip of sound files, lessons that use it; earlier list: one clock shared with the synth, piano roll, chaining patterns, mixer, per-drum sound, a lesson using the grid
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
- [x] Take in the literature the owner uploaded on 20 Nov 2026: seventeen documents (Chowning on FM; Rajala on infrasound; Senn 2016 and 2018 and Hove 2014 on groove, microtiming and bass timing; Hockman and Davies on breakbeats; Puckette's book; both Yamaha VL1 manuals; Karjalainen on plucked strings; Bank on piano; Dattorro on reverb; Stilson and Smith on alias-free waveforms; Szabo on the supersaw; the Buchla wavefolder paper; Raman 1920 on Indian drums; a Knowles white paper) and the Groove MIDI Dataset
- [ ] Still to arrive from the owner's list of six papers: Frühauf, Kopiez and Platz, "Music on the timing grid"
- [x] Library tab: a Sources shelf listing every text like a database, with a search inside them (20 Nov 2026)
- [x] Read every text uploaded on 20 Nov in full and write out lesson ideas: 305 in `docs/LESSON_IDEAS.md`, with what each needs and a suggested order
- [x] Course map: ten new chapters for the holes the reading exposed, with the 305 ideas slotted in and 52 new lessons written for what was still open (`docs/CURRICULUM.md`, last section) (20 Nov 2026)
- [ ] Write the new chapters' lessons, in this order unless the owner says otherwise: Reading your tools; When digital sound goes wrong; Expression; One delay, many effects; Rhythm rebuilt on evidence; Bells, metal and stretched tones; Fixing a broken sound; Tuning; Voices; Sampler basics
- [x] Lessons, chapter "Reading your tools": eight playable lessons after Filters (peak and average, decibels as times, same reading not same loudness, adding two sounds, scope against spectrum, the spectrogram, jumps and corners, hunting harmonics), with quizzes; the meter now shows peak and average (20 Nov 2026)
- [x] Course map: history of nu-skool breaks, 28 lessons in four parts with sources and what is thin (`docs/CURRICULUM.md`, "Track G-H: the history of each genre") (20 Nov 2026)
- [ ] Genre histories: owner to confirm that history lessons may name people, clubs, labels and records; read the primary pieces that could not be opened; then the next genre the owner names
- [ ] Paths (owner's idea, 20 Nov): mark which lessons make which kind of producer, by what a finished track needs; needs tags on lessons and much more of the course first (`docs/CURRICULUM.md`, "Paths")
- [x] Researched books for the thin tracks: mixing, mastering, hearing, arrangement, ear training, theory, genre history (`docs/LITERATURE.md`, last section) (21 Nov 2026)
- [ ] Take in the three free texts found: Open Music Theory, Shelvock's mastering thesis, Dancecult articles (after checking each licence)
- [x] Course map: the owner's answers on what was missing, with "Put it together" milestones, a Finishing section and nine new tracks outlined (`docs/CURRICULUM.md`, last section) (21 Nov 2026)
- [ ] Write milestones W1 to W4 ("Your first complete sound" to "A sound with space"): they need nothing built
- [x] Twenty-three more wavetables on the synth (34 choices now), in a grouped drop-down with a note under each; every harmonic measured within 1 dB (21 Nov 2026)
- [x] Wavetable editor on Osc A and B: drawing tools, harmonic editing, frame/sort/single/all/morph menus, formulas, audio and picture import, export (22 Nov 2026)
- [x] Eleven free texts taken into the library after the owner allowed more hosts: Luke's Computational Music Synthesis, Witek 2014, Butler 2001, eight Dancecult articles (22 Nov 2026)
- [ ] Wavetables next: raise the synth's 64-harmonic limit; store tables with the account; a 3D view; lessons on the editor and the new tables
- [x] Synth keeps 512 harmonics instead of 64 (23 Nov 2026)
- [ ] Lessons, next chapters in order: "When digital sound goes wrong", "Expression", "One delay, many effects", then the rest of the ten (`docs/CURRICULUM.md`, last section)
- [ ] Write the 85 or so lessons from `docs/LESSON_IDEAS.md` that need nothing built (FM, ring and distortion, sync and formants, drum layers and breaks, expressive playing)
- [ ] Small builds that each open several lessons (click source, peak and RMS meter, Q readout, invert on Osc B, flanger time knob, distortion bias, sample-and-hold LFO, per-note random, response curves, reverb freeze, sampler reverse, ghost strength, slice names): list in `docs/LESSON_IDEAS.md`
- [ ] Build from the new texts (owner to choose the order): a supersaw from Szabo; FM lessons from Chowning; a better reverb from Dattorro; a Buchla-style fold; groove and microtiming lessons with the Groove MIDI data; breakbeat lessons; physical-modelling lessons (still waiting on Fletcher and Rossing)
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
