# Patchwalk to-do

The working list for the owner and the assistant. Tick a box when a thing is done. The owner's live copy is the "Patchwalk To-Do" page
(https://claude.ai/artifact/7sHF6r2vvBuxa8DSkcfcPz); keep the two in step. `docs/HANDOFF.md` has the background.

## Build next
- [x] Envelope lessons: five lessons and a checkpoint, with an envelope drawing you can drag
- [x] Envelope hold and fall shape (straight, eased, sharp), with a lesson
- [x] Tempo, a click, and LFOs that sync to the beat, restart or run free, fade in, and can be drawn; three lessons
- [x] Warp, sync, FM and ring modulation on the synth, with five lessons and a by-ear checkpoint ("Reshaping the wave")
- [ ] Knowledge cards for FM and ring modulation; lesson scripts for the six new lessons
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
- [ ] Close the top Serum gaps: mono, legato and glide; mod wheel, pitch bend and MIDI keyboard; "aux source" in the matrix; Osc B as a full oscillator and pan; a second filter and routing; more filter types; more warp modes
- [ ] More macro recipes (the owner wants many; each is a few lines of data in the macro lesson file)
- [ ] Scaling a route with a second source (mod wheel) and its lesson
- [ ] Blind ear checks for the filter, envelope, LFO and modulation lessons
- [ ] Pulse-width lesson in the oscillator chapter
- [ ] Remaining synthesis chapters from the course plan (82 lessons built)

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
