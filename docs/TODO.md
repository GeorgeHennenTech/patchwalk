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
- [ ] Effects: reordering, ducking (sidechain), multiband, and effects as modulation destinations
- [x] Editable matrix: change any connection in one table, add rows so one source moves several things; a lesson on it
- [x] Eight more macro recipes using effects, warp, FM and the kick (16 recipes and lessons in the macro chapter now)
- [x] Any knob can be a destination for any source; a handle on each knob sets a source's depth there; two lessons
- [x] Drag a source onto a knob to connect it, with a lesson
- [x] Whole synth made compact: Synth / FX / Matrix pages, tabbed envelopes and LFOs, a small macro block as in Serum
- [x] List of every Serum 2 feature the practice synth is missing (docs/SERUM_GAPS.md, about 550 rows, with a suggested order)
- [ ] Close the top Serum gaps (mono, legato and glide, the mod wheel, pitch bend and MIDI keyboard, and the matrix's "aux source" are done): Osc B as a full oscillator and pan; a second filter and routing; more filter types; more warp modes
- [ ] More macro recipes (the owner wants many; each is a few lines of data in the macro lesson file)
- [ ] Scaling a route with a second source (mod wheel) and its lesson
- [ ] Blind ear checks for the filter, envelope, LFO and modulation lessons
- [ ] Pulse-width lesson in the oscillator chapter
- [ ] Processing chains track (owner, 14 Nov 2026): after the synth material and our own effect courses, lessons on stacking stock plugins after the synth. Needs a reorderable effects rack with a bypass per effect first.
- [ ] Sound systems track with high-definition diagrams (owner, 14 Nov 2026): needs a source text on loudspeakers; labelled diagrams drawn by code.
- [ ] A spoken intro clip at the top of every lesson (owner, 14 Nov 2026): test one with Higgsfield first; it spends credits.
- [ ] Music theory lessons that use the MIDI keyboard (owner, 14 Nov 2026): track I of the curriculum.
- [ ] Source texts on sound systems for the owner to find: see `docs/LITERATURE.md`.
- [ ] Build from `docs/LEARNING_RESEARCH.md` (owner, 14 Nov 2026): Focus mode for ADHD, end-of-lesson recall, spaced return, mixed by-ear checkpoints, "why this matters" lines, fading guidance, optional noise, the new answer layout.
- [ ] Remaining synthesis chapters from the course plan (97 lessons built)

## Synth
- [x] Filter with a draggable curve
- [x] Module panels with knobs, in Serum's arrangement
- [x] Two envelopes and three LFOs, with neon rings on the knobs they move
- [x] Velvet-and-neon skin, with an on/off switch
- [x] Z and X keys move the computer keyboard down and up an octave
- [x] Sound views (scope, spectrum, spectrogram, level, filter curve) switchable at any step
- [ ] Envelopes and LFOs can move wavetable position and resonance
- [x] Four macros with three slots each; any continuous knob can be a destination
- [x] Matrix view: every connection listed (read-only)
- [ ] A full Matrix tab you can edit, as in Serum (owner asked; also lifts the one-destination-per-source limit)
- [ ] More than one destination per envelope or LFO
- [ ] Drag a source onto a knob to connect it
- [x] Tempo clock and click; LFOs can sync to the beat
- [ ] Effects: distortion, chorus, delay, reverb, EQ, compressor
- [ ] MIDI keyboard input
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
- [ ] Guide: better search across many books once more texts are in
- [ ] Place library pictures inside lessons where they help
- [ ] Voice for the guide using Higgsfield (owner's choice): test quality, then generate each narration once and store it
- [ ] Remember what the learner found hard, not only what they finished
- [ ] Show why the system check rejected a first attempt
- [ ] Video walkthroughs the guide can pull up (much later; see the research note in the handoff)

## Bigger builds, later
- [ ] Listening lab: acoustics, psychoacoustics, ear training
- [ ] Extended synthesis methods (FM, granular and others)
- [ ] Mini DAW: piano roll, drum sequencer, tracks, mixer, automation, export
- [ ] Genre lessons, starting with glitch-hop, breakbeat and psydub
- [ ] Lessons on Serum itself: the matrix tab and the rest of its specialist features (50 planned)
- [ ] The full curriculum: about 475 lessons across 17 tracks

## New tracks the owner asked for (13 Nov 2026)
- [ ] Physical modelling: string engine and the plucked-string chapter (plan in docs/PHYSICAL_MODELING.md, about 60 lessons)
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
- [ ] Review the 32 knowledge cards and 43 lesson scripts (all drafts)
- [ ] Probe presets: start with the ten most useful (the assistant has explained what to do)
- [ ] Keep reporting how things sound and feel
