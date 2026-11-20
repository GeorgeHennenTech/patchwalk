# Curriculum map

Status: **plan.** One line per lesson, so the whole shape can be reviewed and reordered before anything is
scripted in detail. Fully scripted lessons live in `docs/lessons/` (the first twelve are written).
The practice synth and lesson engine are described in `docs/COURSE_PLAN.md`.

## How the course is organised
- **Tracks** (letters) are subjects. **Units** group lessons inside a track. **Lessons** take five to ten minutes.
- **Any order.** Nothing is locked. Each lesson lists what it builds on; the guide suggests a next step, and a
  "path" view offers a sensible order for anyone who wants one.
- **Easy to grow.** A lesson is one file. Adding a lesson, a unit or a whole track means adding files; nothing
  else has to change. Ids are stable (`C1.5`), so progress survives reordering.
- **Every lesson is hands-on.** Each one uses one of four tools, shown per track as "Uses":
  - **Synth**: the built-in practice synth.
  - **Lab**: a listening lab that generates test sounds and runs blind comparisons.
  - **DAW**: the built-in mini DAW (planned last; tracks that need it can start as reading plus Lab).
  - **Serum**: an optional task in Serum checked by dropping the preset.
- **Sources.** Each unit names the subjects the private library should cover so the guide can answer from texts.

Counts: 17 tracks, about 475 lessons, including track S (Serum 2 specifics, 50 lessons) in
`docs/SERUM_EXTRAS.md`. Order of building is at the end.

---

## A. Sound and acoustics (12) — Uses: Lab
What sound physically is. Library: acoustics, physics of music.

| # | Lesson | You learn |
|---|---|---|
| A1 | Vibration and pressure waves | Sound as moving air; why it needs a medium |
| A2 | Frequency, period and wavelength | How the three relate; why low notes are physically large |
| A3 | Amplitude and decibels | What a decibel compares; why the scale is logarithmic |
| A4 | Phase | Two waves in and out of step; cancellation |
| A5 | The harmonic series | Why a pitched sound is a stack of related frequencies |
| A6 | Any sound is a sum of sines | Building a saw and a square from sine waves |
| A7 | Noise and inharmonic sounds | Why bells and drums do not sit in the harmonic series |
| A8 | Transients and steady state | The first milliseconds versus the body of a sound |
| A9 | Reflection and reverberation | Direct sound, early reflections, tail |
| A10 | Room modes and standing waves | Why bass is uneven in small rooms |
| A11 | Interference and comb filtering | What a short delay does to a spectrum |
| A12 | Digital audio | Sample rate, bit depth, aliasing in plain terms |

## B. Hearing and psychoacoustics (14) — Uses: Lab
How the ear and brain turn pressure into what you perceive. Library: psychoacoustics, auditory perception.

| # | Lesson | You learn |
|---|---|---|
| B1 | The ear in three parts | Outer, middle, inner; what each does |
| B2 | The range of hearing | Limits in frequency and level; protecting your hearing |
| B3 | Equal-loudness contours | Why bass and treble seem to vanish at low volume |
| B4 | Pitch perception | Pitch versus frequency; octave equivalence |
| B5 | The missing fundamental | Hearing a bass note that is not there |
| B6 | Critical bands | Why close frequencies interfere and distant ones do not |
| B7 | Masking | One sound hiding another; the basis of mix clarity |
| B8 | Roughness and beating | From slow beats to harshness to two separate tones |
| B9 | Loudness versus level | Why denser and brighter sounds seem louder |
| B10 | Timbre | What makes two instruments differ at the same pitch and level |
| B11 | Localisation | Level and timing differences between the ears |
| B12 | The precedence effect | Why the first arrival decides direction; width from short delays |
| B13 | Temporal effects | How short a sound can be and still have pitch; forward masking |
| B14 | Listening fatigue and reference level | Why judgment drifts; how to keep your ears honest |

## C. Synthesis foundations (64) — Uses: Synth, Serum
The nine chapters in `docs/COURSE_PLAN.md`, kept as written there: sound itself (C0, 5), oscillators (C1, 10),
filters (C2, 8), envelopes (C3, 7), LFOs (C4, 7), the modulation system (C5, 7), reshaping the source (C6, 6),
effects (C7, 9), playing feel (C8, 5). Every chapter ends with a cumulative recreate-by-ear checkpoint.
Coverage against the owner's Syntorial lesson titles is in `docs/COVERAGE_SYNTORIAL.md`. Library: synthesizer fundamentals.

## D. Synthesis methods (26) — Uses: Synth (extended), Lab
Ways of making sound beyond filtering a bright wave. Library: computer music, synthesis techniques.

| # | Lesson | You learn |
|---|---|---|
| D1.1 | FM: carrier and modulator | Why modulating frequency adds sidebands |
| D1.2 | FM: ratios | Whole ratios for harmonic tones, odd ratios for bells |
| D1.3 | FM: index and envelopes | Brightness that follows an envelope |
| D1.4 | FM: stacks and feedback | More than two operators; feedback as a saw |
| D1.5 | FM recipes | Electric piano, bell, metallic bass |
| D2.1 | Additive: building from partials | Setting each harmonic by hand |
| D2.2 | Additive: moving spectra | Harmonics that change independently |
| D2.3 | Additive versus subtractive | When each is the better tool |
| D3.1 | Sampling: playing a recording | Pitching, root note, start and end |
| D3.2 | Loops and crossfades | Sustaining a short sample |
| D3.3 | Multi-samples and velocity layers | Realism across the keyboard |
| D3.4 | The sampler as a synth | Filters and envelopes on recorded material |
| D3.5 | One-shots and slices | A break as playable pieces |
| D4.1 | Granular: grains | A sound as many tiny pieces |
| D4.2 | Position, size and density | The three controls that matter |
| D4.3 | Time stretch and freeze | Pitch and time made independent |
| D4.4 | Granular textures | Clouds, shimmers, smears |
| D5.1 | Physical modelling: a plucked string | A delay line and a filter as a string |
| D5.2 | Exciter and resonator | Separating how it is struck from what rings |
| D5.3 | Modal sounds | Bars, bells and membranes from resonances |
| D6.1 | Vocoding | Imposing one sound's spectrum on another |
| D6.2 | Spectral processing | Editing a sound in the frequency domain |
| D6.3 | Formants | Vowel shapes and why they sound vocal |
| D7.1 | Making a wavetable | Drawing and generating single cycles |
| D7.2 | Wavetables from audio | Turning a recording into a table |
| D7.3 | Designing a table to be swept | Planning the morph, not just the frames |

## E. Sound design (47) — Uses: Synth, Serum
Reaching specific sounds on purpose. Library: sound design, synth programming.

| # | Lesson | You learn |
|---|---|---|
| E1.1 | Describing a sound in words | Pitch, brightness, movement, envelope, space |
| E1.2 | Reference and target | Working toward a sound you can already hear |
| E1.3 | One change at a time | Isolating what each move does |
| E1.4 | Layering | Splitting a sound into jobs: sub, body, top, air |
| E2.1 | Sub bass | Pure low end that translates |
| E2.2 | Reese bass | Detuned movement |
| E2.3 | Acid bass | Resonant filter and glide |
| E2.4 | Wobble bass | Tempo-synced filter movement |
| E2.5 | Growl and neuro bass | Movement through filtering, distortion and resampling |
| E2.6 | FM bass | Metallic and vocal low end |
| E2.7 | Plucked and pulsed bass | Short envelopes, off-beat patterns |
| E2.8 | Layered bass | A clean sub under a moving mid layer |
| E3.1 | Supersaw lead | Stacked, wide, bright |
| E3.2 | Mono glide lead | Portamento and legato phrasing |
| E3.3 | Sync lead | The tearing sweep |
| E3.4 | Soft sine and triangle leads | Gentle leads that sit behind a mix |
| E3.5 | Vocal and formant leads | Vowel-like movement |
| E4.1 | Warm pad | Slow envelopes, gentle filtering |
| E4.2 | Evolving pad | Slow modulation across several targets |
| E4.3 | String-like pad | Unison, vibrato, filtered saws |
| E4.4 | Atmospheres and drones | Noise, granular and reverb as the instrument |
| E4.5 | Choir-like pad | Formants and unison |
| E5.1 | Pluck | Filter envelope plucks |
| E5.2 | Bell and mallet | FM and inharmonic partials |
| E5.3 | Electric piano | FM with velocity |
| E5.4 | Organ | Additive drawbars |
| E5.5 | Stab and chord hit | One-key chords and short envelopes |
| E6.1 | Synth kick | Pitch envelope on a sine |
| E6.2 | Synth snare and clap | Tone plus noise |
| E6.3 | Hats and cymbals | Filtered noise and inharmonic stacks |
| E6.4 | Toms and percussion | Tuned short tones |
| E6.5 | 808-style bass drum | A kick that holds a note |
| E6.6 | Layering drums | Transient, body and tail from different sources |
| E7.1 | Risers and falls | Pitch, filter and noise sweeps |
| E7.2 | Impacts and downlifters | Low hits and reversed tails |
| E7.3 | Sweeps and whooshes | Moving noise |
| E7.4 | Glitches and stutters | Very short repeats and cuts |
| E7.5 | Transitions that fit the key | Tuning effects to the track |
| E8.1 | Organic and water-like textures | Typical of psychedelic bass music and psydub |
| E8.2 | Squelches and zaps | Fast envelopes on resonant filters |
| E8.3 | Foley-style sounds from synthesis | Wind, rain, footsteps, engines |
| E8.4 | Sound for picture | Designing to an event and a mood |
| E8.5 | Resampling as design | Bouncing, re-pitching and processing again |
| E9.1 | Recreating a sound by ear | A full pass with no hints |
| E9.2 | Recreating from a preset | Using Rebuild a patch as the answer key |
| E9.3 | Making it yours | Changing a recreated sound into a new one |
| E9.4 | Building a personal library | Naming, tagging and macro conventions |

## F. Effects and signal processing (36) — Uses: Synth, Lab
What each processor does to a signal and when to reach for it. Library: audio effects, mixing engineering, DSP.

| # | Lesson | You learn |
|---|---|---|
| F1.1 | Filters as EQ | Shelves, bells, cuts |
| F1.2 | Q and bandwidth | Narrow versus broad moves |
| F1.3 | Subtractive EQ | Removing before adding |
| F1.4 | Phase and EQ | Why EQ shifts timing between frequencies |
| F1.5 | Dynamic EQ | EQ that reacts to level |
| F2.1 | Compression: threshold and ratio | What gets turned down and by how much |
| F2.2 | Attack and release | Shaping the front and the tail |
| F2.3 | Limiting | A ceiling the signal cannot pass |
| F2.4 | Expansion and gating | Making quiet parts quieter |
| F2.5 | Sidechain compression | One sound making room for another; pumping |
| F2.6 | Multiband and upward compression | Dense, forward sound |
| F3.1 | Saturation | Gentle harmonic addition |
| F3.2 | Clipping, hard and soft | Flat tops and what they add |
| F3.3 | Wavefolding and bit reduction | Aggressive and digital colour |
| F3.4 | Distortion placement | Before and after filters and EQ |
| F4.1 | Delay basics | Time, feedback, mix |
| F4.2 | Tempo-synced and ping-pong delay | Echoes as rhythm |
| F4.3 | Short delays | Comb filtering, flanging, doubling |
| F4.4 | Reverb types | Room, hall, plate, spring, convolution |
| F4.5 | Reverb controls | Pre-delay, decay, damping, size |
| F5.1 | Chorus | Width from drifting copies |
| F5.2 | Flanger | A swept comb |
| F5.3 | Phaser | Swept notches |
| F5.4 | Tremolo, auto-pan and ring modulation | Level, position and sidebands |
| F6.1 | Stereo width | Difference between left and right |
| F6.2 | Mid and side | Processing centre and edges separately |
| F6.3 | Mono compatibility | What disappears when summed |
| F6.4 | Panning and placement | Building a stage |
| F7.1 | Stutter and beat-repeat | Rhythmic repeats, central to glitch styles |
| F7.2 | Pitch shifting and time stretching | Changing one without the other |
| F7.3 | Frequency shifting | Why it differs from pitch shifting |
| F7.4 | Reverse and freeze | Reversed tails and held moments |
| F7.5 | Vocoder and filter banks as effects | Imposed rhythm and spectrum |
| F8.1 | Serial and parallel chains | Dry and wet as separate paths |
| F8.2 | Band splitting | Different treatment for lows, mids and highs |
| F8.3 | Resampling chains | Printing an effect and processing it again |

## G. Technical ear training (24) — Uses: Lab
Blind listening drills with instant answers. Each drill repeats at rising difficulty.

| # | Lesson | You learn |
|---|---|---|
| G1.1-G1.6 | Frequency bands | Naming a boost or cut by ear, from wide bands to third-octave |
| G2.1-G2.4 | Dynamics | Hearing compression amount, attack, release, and over-compression |
| G3.1-G3.2 | Distortion | Spotting saturation; telling types apart |
| G4.1-G4.4 | Time and space | Delay time, reverb length, pre-delay, wet level |
| G5.1-G5.2 | Stereo | Width, and what is lost in mono |
| G6.1-G6.6 | Synth settings by ear | Wave shape, filter cutoff and resonance, envelope times, LFO rate, unison amount, detune |

## H. Rhythm and drum programming (16) — Uses: DAW
Library: drum programming, rhythm.

| # | Lesson | You learn |
|---|---|---|
| H1 | Pulse, tempo and bars | Counting, BPM, time signatures |
| H2 | The grid | Subdivisions from quarters to thirty-seconds |
| H3 | Kick, snare, hat | The three roles |
| H4 | Four on the floor | The house and techno foundation |
| H5 | Backbeat and half-time | Where the snare falls and why it changes the feel |
| H6 | Breakbeats | Syncopated kick and snare patterns |
| H7 | Swing and shuffle | Delaying the off-beats |
| H8 | Velocity and accents | Making a pattern breathe |
| H9 | Ghost notes | The quiet hits between the loud ones |
| H10 | Micro-timing | Pushing and pulling against the grid |
| H11 | Fills and turnarounds | Marking the end of a phrase |
| H12 | Layering and tuning drums | Choosing sounds that fit together and fit the key |
| H13 | Chopping a break | Slicing and re-sequencing a recorded loop |
| H14 | Percussion and tops | Filling the upper rhythm |
| H15 | Polyrhythm and odd groupings | Threes against fours |
| H16 | Glitch edits | Stutters, cuts and fills made from the beat itself |

## I. Theory and keyboard for producers (18) — Uses: DAW, Synth
Enough theory to write, kept practical. Library: music theory for producers.

| # | Lesson | You learn |
|---|---|---|
| I1 | The keyboard and note names | Finding your way around |
| I2 | Intervals | Distances between notes and their character |
| I3 | Major and minor scales | The two home bases |
| I4 | Keys and staying in key | Choosing and using a key |
| I5 | Triads | Major, minor, diminished |
| I6 | Chords in a key | Which chords belong together |
| I7 | Chord progressions | Common movements and why they work |
| I8 | Inversions and voice leading | Smooth movement between chords |
| I9 | Seventh and extended chords | Colour beyond the triad |
| I10 | Modes | Dorian, Phrygian and friends, by sound |
| I11 | Pentatonic and blues scales | Safe and expressive note sets |
| I12 | Basslines | Roots, movement and rhythm |
| I13 | Melody | Contour, repetition, tension and release |
| I14 | Call and response | Phrases that answer each other |
| I15 | Harmony for bass music | Minor keys, pedal notes, one-chord tension |
| I16 | Tuning drums and effects to the key | Making everything agree |
| I17 | Rhythm of harmony | How often chords change |
| I18 | Borrowed chords and modulation | Stepping outside the key on purpose |

## J. Sampling and audio manipulation (12) — Uses: DAW
Library: sampling, audio editing.

| # | Lesson | You learn |
|---|---|---|
| J1 | Audio clips versus notes | Two kinds of material |
| J2 | Editing | Cuts, fades, crossfades, avoiding clicks |
| J3 | Warping to tempo | Fitting audio to the grid |
| J4 | Slicing | Turning a loop into playable hits |
| J5 | Pitch and time | Re-pitching versus stretching |
| J6 | Reverse and rearrange | New phrases from old ones |
| J7 | Layering samples | Combining sources without mud |
| J8 | Vocal chops | Short vocal pieces as an instrument |
| J9 | Resampling your own work | Bouncing and reusing |
| J10 | Field recordings | Recorded sound as raw material |
| J11 | Remixing from stems | Working with someone else's parts |
| J12 | Sampling and the law | What clearing a sample means; plain overview |

## K. Arrangement and composition (14) — Uses: DAW
Library: arrangement, electronic composition.

| # | Lesson | You learn |
|---|---|---|
| K1 | From loop to track | The eight-bar trap and getting out of it |
| K2 | Sections | Intro, build, drop, break, outro |
| K3 | Energy over time | Planning the shape of a whole track |
| K4 | Subtraction | Arranging by muting |
| K5 | Tension and release | Builds, pauses and payoffs |
| K6 | Transitions | Fills, risers, cuts and reverses |
| K7 | Variation | Keeping a repeated part alive |
| K8 | Call and response between parts | Bass and lead in conversation |
| K9 | Automation | Movement written into the arrangement |
| K10 | Space and contrast | Dense against sparse |
| K11 | Reference tracks | Mapping a finished track's structure |
| K12 | Generative ideas | Probability, randomness and rules as collaborators |
| K13 | Non-linear working | Sketching scenes before a timeline |
| K14 | Finishing | Deciding a track is done |

## L. Genre studies (about 96) — Uses: DAW, Synth
Each genre gets the same eight lessons, so adding a genre is filling in a template.

| # | Template lesson | You learn |
|---|---|---|
| 1 | Listening map | Tempo, feel, structure and palette, from reference listening |
| 2 | Drums | The defining pattern and its sounds |
| 3 | Bass | The role and design of the low end |
| 4 | Harmony and melody | Typical scales, chords and motifs |
| 5 | Signature sounds | The two or three sounds that say the genre's name |
| 6 | Signature techniques | The processing or editing the style is known for |
| 7 | Arrangement | How a track in this style unfolds |
| 8 | Write one | A guided sixteen-bar sketch, then a full arrangement |

The owner's selected genres and further proposals are in `docs/GENRES.md`. The table below is the first
handful with tempo ranges. Tempo ranges are typical figures to be confirmed against the library before lessons are written.

| Genre | Typical tempo (BPM) | Defining traits to teach |
|---|---|---|
| Glitch-hop | 80-115 | Swung hip-hop drums, chopped edits and stutters, mid-range bass movement |
| Breakbeat | 120-140 | Syncopated break patterns, chopped breaks, driving bass |
| Psydub | 60-100 | Dub basslines, deep delay and reverb, organic and psychedelic textures |
| Drum and bass | 160-180 | Fast breaks, sub and reese bass, half-time feel in the bass |
| Dubstep | around 140 | Half-time drums, sub weight, modulated mid bass |
| House | 118-130 | Four on the floor, off-beat hats, chord stabs |
| Techno | 120-150 | Driving kick, repetition, evolving timbre |
| Downtempo | 60-110 | Relaxed groove, texture, space |
| Trip-hop | 60-100 | Slow breaks, dark harmony, sampled character |
| Trap | 130-160 | Half-time feel, 808 bass, fast hat rolls |
| Trance | 128-145 | Rolling bass, long builds, supersaw leads |
| Dub techno / ambient | varies | Chords through delay and reverb, slow change |

## M. Mixing (20) — Uses: DAW, Lab
Library: mixing engineering.

| # | Lesson | You learn |
|---|---|---|
| M1 | What a mix is for | Balance, clarity, depth, impact |
| M2 | Gain staging | Healthy levels through the chain |
| M3 | Static balance | Faders and pans before any processing |
| M4 | The low end | Kick and bass sharing space |
| M5 | Carving with EQ | Giving each part its own range |
| M6 | Masking in practice | Finding and fixing clashes |
| M7 | Compression in a mix | Control versus character |
| M8 | Sidechain in a mix | Kick and bass, and beyond |
| M9 | Depth | Front to back with level, brightness and reverb |
| M10 | Width | Left to right without losing the centre |
| M11 | Reverb and delay sends | Shared spaces |
| M12 | Buses and groups | Processing families of sounds together |
| M13 | Parallel processing | Blending a processed copy |
| M14 | Automation in a mix | Rides and moves |
| M15 | Mixing drums | Punch and glue |
| M16 | Mixing bass music | Sub management and mid-bass presence |
| M17 | References and level matching | Comparing fairly |
| M18 | Monitoring | Speakers, headphones, rooms, and their lies |
| M19 | Translation | Checking on small speakers and in mono |
| M20 | Mix revision | Notes, fresh ears, and knowing when to stop |

## N. Mastering (8) — Uses: DAW, Lab
Library: mastering.

| # | Lesson | You learn |
|---|---|---|
| N1 | What mastering is and is not | Final polish, not rescue |
| N2 | Metering | Peak, loudness and true-peak readings |
| N3 | Tonal balance | Broad, gentle EQ |
| N4 | Master-bus dynamics | Glue without flattening |
| N5 | Limiting and loudness | Trading punch for level |
| N6 | Stereo and low-end checks | Mono bass, safe width |
| N7 | Loudness targets | How playback services normalise |
| N8 | Export | Sample rate, bit depth, dither, formats |

## O. Procedural audio and DSP (10) — Uses: Lab (advanced, optional)
For when you want to build tools, not only use them. Library: DSP, computer music programming.

| # | Lesson | You learn |
|---|---|---|
| O1 | Signals as numbers | Samples, buffers, rates |
| O2 | An oscillator from scratch | Phase accumulation |
| O3 | A filter from scratch | A one-pole low-pass |
| O4 | A delay line | The building block of half the effects in track F |
| O5 | An envelope follower | Level as a control signal |
| O6 | Waveshaping | A curve as a distortion |
| O7 | The Fourier transform, by ear and eye | Moving between time and frequency |
| O8 | Building a small effect | Chorus from a modulated delay |
| O9 | Sequencers and probability | Rules that write patterns |
| O10 | A patch of your own | Combining the pieces |

## P. Projects (8) — Uses: everything
Longer guided pieces of work that pull tracks together.

| # | Project | Draws on |
|---|---|---|
| P1 | Ten sounds from a blank patch | C, E |
| P2 | Recreate three presets by ear, then check | C, E, G |
| P3 | A drum kit made only from synthesis | E6, H |
| P4 | A sixteen-bar loop in a chosen genre | H, I, L |
| P5 | A full arrangement | K, L |
| P6 | A mix of your own track | M |
| P7 | A mastered release-ready file | N |
| P8 | A signature sound pack with macros and notes | E9 |

---

## Q. Physical modelling (about 60) — Uses: new sample-by-sample engines
Added at the owner's request on 13 Nov 2026. Full plan in `docs/PHYSICAL_MODELING.md`: strings, bars and bells,
drums, tubes and breath, bodies and hybrids, and the same ideas in Ableton's Collision, Tension, Electric and
Corpus. Replaces the one-line lessons D5.1 to D5.3.

## R. Bioacoustics and the psychedelic ear (about 45) — Uses: Synth, Lab, track Q
Added at the owner's request on 13 Nov 2026. Full plan in `docs/BIOACOUSTICS.md`: how animals make sound,
animal signals as sound design, choruses and soundscapes, what the ear does to sound, illusions and
ambiguity. Its explanations wait for source texts in the library.

## T. Impacts, hits and striking bass (about 50) — Uses: Synth, effects, DAW, track Q
Added at the owner's request on 13 Nov 2026. Full plan in `docs/IMPACTS.md`: what an impact is, building hits,
striking bass notes, weight and dirt, making room for the hit, impact effects, and why a drop lands.

## Coverage check against a university electronic-music programme
The owner supplied the course list for Berklee Online's electronic music production and sound design programme.
Only its topics were used, as a checklist. No course text was read or copied.

| Their subject area | Where it is covered here |
|---|---|
| Production basics | A12, J1-J2, M1-M3 |
| Sound design and synthesizers | C, D, E |
| Effects | C7, F |
| Sampling | D3, J |
| Drum programming | H, E6 |
| Composing and producing by genre | L, K |
| Mixing and mastering | M, N |
| Keyboard skills | I |
| Remixing | J11, K |
| Generative and non-linear composition | K12-K13, O9 |
| Procedural music and creative DSP | O |
| Electroacoustic composition | D4, D6, E8, J10 (partly) |
| Sound design for picture | E8.3-E8.4 (introductory) |
| Capstone | P |
| Tool-specific courses (a particular DAW) | Not planned: the mini DAW teaches the ideas, not one product |
| DJing and live performance | Not planned |

Beyond that list, tracks A, B and G (acoustics, psychoacoustics, ear training) are added because the owner asked
for them.

## Order of building
Lessons can be taken in any order, but they have to be built in some order. Each step needs the tool named.

1. Lesson engine and practice synth, then **C** (64) and the first twelve scripted lessons.
2. Listening lab, then **A**, **B** and **G** (50). These need no synth beyond test tones.
3. Extended synth, then **D**, **E**, **F** (109).
4. Guide and library, alongside steps 2 and 3 as texts arrive.
5. Mini DAW, then **H**, **I**, **J**, **K** (60).
6. **L** genre by genre, starting with glitch-hop, breakbeat and psydub; then **M**, **N**.
7. **O** and **P** as wanted.

What is realistic: steps 1 and 2 are a few substantial pieces of work each. The whole map is a long project.
Every lesson's script and card is a draft until the owner has reviewed it.

## Added by the owner on 17 Nov 2026 (planned, nothing built)

- **Drums from South Asia, the Middle East and beyond.** The owner wants to learn "eastern music drums and
  its drum patterns". Needs first: a text in the library (see `docs/LITERATURE.md`), a Studio grid that is
  not always sixteen steps in four beats (many of these cycles are 7, 10, 12 or 16 beats grouped unevenly),
  and sounds: these drums have several distinct strokes each, so they need the owner's own sample files or
  a proper model; the built-in tone-and-noise drums will not do.
- **Late-2000s club pop: drums and synth sounds.** The owner named the style by its artists and wants to put
  a psychedelic bass spin on it. Teach the general traits of the style (four-on-the-floor around 120 to
  130 bpm, claps on two and four, bright stacked-saw chords, plucks, pumping from sidechain) on the Studio
  and the synth. **Never claim how any named artist or producer made a sound, and do not name them in the
  app.** A "Club pop" starting pattern and a "Big saw chords" starting sound exist as a first step.
- **Drum-pattern lessons from literature.** Wait for the texts in `docs/LITERATURE.md` (Hockman's thesis
  first), then write lessons in the Studio from them.
- **Automation (owner, 17 Nov 2026).** Lessons on automation in the Studio once it has automation lanes:
  what a lane is, drawing and recording one, and many combinations (filter opening over a build, level
  and reverb swapping places, pitch and delay throws, two lanes working against each other), written
  as short recipes like the macro chapter's. Needs the lanes first.

## Added on 20 Nov 2026: ten chapters that fill holes found while reading the new literature

Reading the seventeen texts taken in on 20 Nov 2026 showed topics this map either lacked or named in one line
without the part that matters. Each chapter below lists its lessons in a teaching order. **A code in square
brackets, such as [A1] or [H30], is an entry in `docs/LESSON_IDEAS.md` (its section letter and number), where
the source and pages are given; it is not a lesson of this map.** A lesson marked **new** is not among those
305: it was written to close what was still open. A new lesson is either a fact about our own tools that can
be measured in the app (marked "tool"), or it needs a text before its explanation can be written (marked
"needs a source"): the standing rule that explanations come from the library still holds. Nothing here is built.

### 1. Reading your tools (sits in track C, straight after "Sound itself")
**Built on 20 Nov 2026: eight playable lessons** (`src/course/lessons/tools.ts`): peak and average [A1], decibels as times [A2], same reading not same loudness [A3], adding two sounds [A7], same ingredients different picture, reading a spectrogram, jumps and corners [B27], hunting harmonics [B16]. In the app the chapter sits after Filters, because two of its lessons use the filter. The rows below that are not in that list are still to do.

The scope, spectrum, spectrogram and meter are used in nearly every lesson and were never taught.

| # | Lesson | From |
|---|---|---|
| 1 | Peak and average level are different things | [A1] |
| 2 | Decibels count ratios, not amounts | [A2] |
| 3 | Same meter reading, not the same loudness | [A3] |
| 4 | Adding two sounds: +6, +3, or nothing | [A7] |
| 5 | Same harmonics, different picture: move the phase of a wave's harmonics and watch the scope change while the spectrum stays | **new** (tool) |
| 6 | Two rulers for one spectrum: harmonics are evenly spaced in Hz and bunch together on a ruler of notes | **new** (tool) |
| 7 | Why a pure tone has skirts on the analyser | [B19] |
| 8 | Seeing bass needs a long look | [B20] |
| 9 | Reading a spectrogram: time across, pitch up; find an envelope, a vibrato and a filter sweep in three pictures | **new** (tool) |
| 10 | Brightness lives in jumps and corners | [B27], [L2] |
| 11 | Hunting partials with a narrow band | [B16] |
| 12 | The meter needs time: a short click reads lower than it peaks | **new** (tool; measure our meter first) |
| 13 | The click test: what one click through an effect tells you | [H32] |
| 14 | Checkpoint: name the sound from its pictures (scope and spectrum shown, four sounds to choose from) | **new** (tool) |

### 2. When digital sound goes wrong (track C, after the envelope chapter)
Clicks, steps, false tones and offsets: the explanation for most "why is this harsh or clicky" moments.

| # | Lesson | From |
|---|---|---|
| 1 | Why an instant level change clicks, and how long a ramp it needs | [A4] |
| 2 | What may jump, and what must slide | [A37] |
| 3 | Zipper noise: a knob moved in steps | [A28] |
| 4 | Smoothing is low-pass filtering | [B4], [I13] |
| 5 | Clipping: what happens at the ceiling (flat tops on the scope, new harmonics on the spectrum, and how our guard differs from a hard clip) | **new** (tool) |
| 6 | The invisible offset that steals loudness | [B5] |
| 7 | Foldover: a note too high comes back down | [A26] |
| 8 | What fold-back sounds like on a saw | [L1], [A27], [B31] |
| 9 | How many harmonics fit under the ceiling | [L5] |
| 10 | Three ways synths avoid it | [B32], [M7] |
| 11 | A table too small: where the grit comes from | [A25] |
| 12 | Cutting one sound off for the next, cleanly | [A38] |
| 13 | Resonance is gain: turn the input down | [C25] |
| 14 | A late copy makes a comb: mix a sound with a copy that passed through a device that delays it (our limiter is 1.5 ms late) | **new** (tool) |
| 15 | Checkpoint: diagnose the fault (five sounds, one fault each: click, zipper, fold-back, offset, clipping) | **new** (tool) |

### 3. Expression: making a sound feel played (track C, after "Playing a line")
The map taught how to connect a source to a knob and never why a sound feels played. Mostly from the Yamaha
VL1 manuals, which are a maker's account: say "the maker's approach" in the lessons.

| # | Lesson | From |
|---|---|---|
| 1 | Pressure is not volume | [I2] |
| 2 | One gesture, several changes | [I10] |
| 3 | Louder and brighter together | [B14], [J12] |
| 4 | Play harder, get a different wave | [A14] |
| 5 | Hit harder, speak sooner | [I27] |
| 6 | A scoop at the start that depends on how you play | [I28] |
| 7 | A vibrato that sounds played | [I25] |
| 8 | Growl: breath that shakes fast | [I5] |
| 9 | Breath noise belongs to the note | [I8] |
| 10 | A resonance that stays put, or follows the note | [I24] |
| 11 | Never twice the same | [I26] |
| 12 | The response curve | [I12] |
| 13 | How fast you move, as a source | [I11] |
| 14 | A bend that changes tone as well as pitch | [I3] |
| 15 | Let go early, press again: what the envelope really does | [A34] |
| 16 | Wide range or easy to play | [I21] |
| 17 | Record a performance, then look at it: play a held line in the Studio with Record on, moving the wheel, and read the gestures back as automation | **new** (tool) |
| 18 | Edit a performance: redraw one gesture in the lane and hear the difference | **new** (tool) |
| 19 | Checkpoint: one line three ways (flat; velocity to tone; with wheel gestures), compared blind | **new** (tool) |

### 4. Rhythm, rebuilt on evidence (replaces the order of track H)
Track H had sixteen titles and nothing behind them. The groove papers, the breakbeat paper and the Groove MIDI
recordings give it a spine. What the studies found must stay in view: small or no effects for microtiming,
swing and syncopation, a large effect of the listener's own taste. No lesson may say a pattern "makes" groove.

| # | Lesson | From |
|---|---|---|
| 1 | Count the grid: bars, beats and sixteenths in the Studio (was H1, H2) | **new** (tool) |
| 2 | Three layers of a drum beat (H3) | [N1] |
| 3 | Four kick patterns (H4) | [N2] |
| 4 | Hats: quarters, eighths, sixteenths | [N4] |
| 5 | Half-time at 140 (H5) | [S9] |
| 6 | Open and closed: one hat cuts the other (choke groups) | **new** (tool) |
| 7 | Four loudness levels: loud, medium, soft, ghost (H8, H9) | [N7], [S4] |
| 8 | Hi-hat accents: the loudness pattern inside a bar | [S5] |
| 9 | What syncopation is, and what it costs (H6) | [N5] |
| 10 | A busy snare: the sixteenth-note backbeat | [N3] |
| 11 | More hits per beat | [N6] |
| 12 | Swing ratio: long-short pairs (H7) | [N8], [S6] |
| 13 | What microtiming is: milliseconds off the grid (H10) | [O1], [S2] |
| 14 | Quantized against as played: can you tell? | [O2], [S3] |
| 15 | The looseness dial | [O3], [O6] |
| 16 | One beat, four drummers | [S1] |
| 17 | Borrow a feel | [S7] |
| 18 | Which early note do you catch? Low or high | [P1], [P3] |
| 19 | Fills: what changes in the last bar (H11) | [S8] |
| 20 | The same pattern at four tempos (85, 110, 140, 170): what changes and what does not. One study found no best tempo [N11] | **new** (tool) |
| 21 | Two kicks on one step: what layering does to the level and the low end (H12) | **new** (tool; builds on [A7]) |
| 22 | Tune a drum to the song's key with the Tuner (H12) | **new** (tool) |
| 23 | What a breakbeat is; slice it; resequence it (H13) | [Q1], [Q2], [Q3] |
| 24 | Short slice, long gap; two breaks in one beat | [Q4], [Q7] |
| 25 | Pitch a break up; where kick and snare live; the transformation chain | [Q5], [Q6], [Q8] |
| 26 | Three against four: a triplet row over a straight row (H15) | **new** (tool; needs triplet steps in a drum clip) |
| 27 | Stutters and cuts from the beat itself, with Beat repeat and slices (H16) | **new** (tool) |
| 28 | Does your taste decide the groove? A self-test | [N9], [N10] |
| 29 | Checkpoint: rebuild a played bar by ear (a real take is heard; place and weight the hits to match) | **new** (needs the drum import) |

H14 (percussion and tops) keeps its place. The owner's wish for South Asian and Middle Eastern drums still
waits for its texts.

### 5. One delay, many effects (opens track F)
The map listed each effect separately. The texts show most of them are one thing at different lengths.

| # | Lesson | From |
|---|---|---|
| 1 | One copy, four results | [H29] |
| 2 | The comb: evenly spaced holes in the spectrum | [H30] |
| 3 | A flanger is a comb that moves; one knob from flanger to chorus | [H42], [I33] |
| 4 | Vibrato from a wobbling delay: what a chorus is | [H41] |
| 5 | Changing a delay's length bends the pitch | [H40] |
| 6 | Feedback: each echo is a fixed fraction of the last; why it stops at 100% | [H33], [H35] |
| 7 | Echoes so close they become a note | [H34] |
| 8 | An octave up by cancelling the odd harmonics | [H31] |
| 9 | Same spectrum, different sound: the all-pass | [C13] |
| 10 | Notch and peak from one trick; a filter that changes nothing you can see | [C16], [B12] |
| 11 | How a reverb is built from delays | [H37] |
| 12 | The reverb, part by part (eleven lessons) | [C1] to [C11], [C15] |
| 13 | Reverb time from two numbers; highs die first; freezing a sound | [H36], [H38], [H39] |
| 14 | A body from a tape measure; smearing a sharp start | [I37], [I20] |
| 15 | Echoes into the room, or beside it | [I32] |
| 16 | How a pitch shifter works, and why it warbles | [H43] |
| 17 | Effects that add nothing new, and effects that do | [H44] |
| 18 | One side late: delay the left by 10 ms, then fold to mono and watch the comb appear | **new** (tool; what the ear makes of the delay itself needs a source) |
| 19 | Something in the loop: a filter, then a pitch shifter, inside the feedback path | **new** (tool; needs a return track that can send to itself) |
| 20 | Checkpoint: which delay is it? (one click through an echo, a comb, a flanger, a chorus and a reverb, blind) | **new** (tool) |

### 6. Bells, metal and stretched tones (track D)
Inharmonic sound barely appeared in the map. Three texts cover it with numbers.

| # | Lesson | From |
|---|---|---|
| 1 | Three kinds of spectrum: harmonic, inharmonic, noisy | [H1] |
| 2 | Several sines fuse into one note, until one is moved | [A9] |
| 3 | A carrier between the harmonics clangs | [H7], [H5] |
| 4 | Ratios that are not whole numbers | [J8] |
| 5 | A bell from eleven sines | [A41] |
| 6 | An FM bell, a drum and a wood drum | [J16], [J17], [J18] |
| 7 | Stiff strings stretch their harmonics; where it is heard | [E5], [E6] |
| 8 | The drum that plays a note; which shape makes which harmonic | [F1], [F2] |
| 9 | Shifting frequency is not shifting pitch | [B17] |
| 10 | Metal from squares: how the Studio's own hats and rides are made (six square waves at ratios that do not line up, through a high-pass) | **new** (tool) |
| 11 | A clang on top of a clean sub: an inharmonic layer high-passed over a sine, for a bass that cuts through | **new** (tool) |
| 12 | From note to clang with one knob | **new** (tool; needs the FM ratio control) |
| 13 | What pitch is a bell? Listen, then compare with the tuner | **new** (needs a source: the book in the library says the rules are "complex and incompletely understood") |
| 14 | Checkpoint: harmonic or not? (blind, then checked on the spectrum) | **new** (tool) |

### 7. Fixing a broken sound (track C, late)
Nothing in the map taught how to find what is wrong.

| # | Lesson | From |
|---|---|---|
| 1 | Find the silent patch | [I39] |
| 2 | Follow the signal: switch stages off in order until the fault moves | **new** (tool) |
| 3 | Too quiet or too loud: where the level is lost or gained | **new** (tool; builds on [I23], [C25]) |
| 4 | It sounds thin: two sources cancelling, a filter shut too far, a stereo sound folded to mono | **new** (tool) |
| 5 | It is out of tune: octave, semitone and fine; an FM ratio; bend range; glide left on | **new** (tool) |
| 6 | Nothing moves: an amount at zero, the wrong destination, an LFO synced too slow, an envelope with full sustain | **new** (tool) |
| 7 | It clicks or crackles (points back to chapter 2) | **new** (tool) |
| 8 | Change one thing at a time: reset, compare, undo | **new** (tool) |
| 9 | Checkpoint: five broken sounds, one cause each | **new** (tool) |

### 8. Tuning (track I)

| # | Lesson | From |
|---|---|---|
| 1 | Semitones are equal multiplications | [A5] |
| 2 | Cents, and the smallest pitch change you notice | [A6] |
| 3 | The harmonics of a note are nearly notes of the scale | [A8] |
| 4 | A pure major chord: 4 to 5 to 6 | [A10] |
| 5 | Equal temperament and beat-free chords | [I31] |
| 6 | A chord where every note beats at its own speed | [A11] |
| 7 | Tune a sampled sound to the song: root key, the Tuner, and fine tune | **new** (tool) |

### 9. Voices (track C)

| # | Lesson | From |
|---|---|---|
| 1 | Voices: how many notes at once, and who gets cut | [A40] |
| 2 | Should the envelope start again or carry on? | [A39] |
| 3 | Between the notes | [I29] |
| 4 | Two instruments in one voice | [I30] |
| 5 | Long tails pile up: hold a chord with long releases and watch the level climb as notes overlap | **new** (tool; builds on [A7]) |
| 6 | Unison voices are not notes: seven voices on four keys is twenty-eight oscillators | **new** (tool) |

### 10. Sampler basics, then grains (opens track J)

| # | Lesson | From |
|---|---|---|
| 1 | A wavetable is a stored list read by a moving pointer | [A12], [L6] |
| 2 | Speed and pitch go together | [A16] |
| 3 | The chipmunk effect | [A17] |
| 4 | A sampler and an oscillator are the same machine; where counting ends | [A15], [A18] |
| 5 | Root key: telling the sampler which note the file is | **new** (tool) |
| 6 | Start, length and fades: trimming a sound | **new** (tool) |
| 7 | One-shot or held: which suits a drum and which a pad | **new** (tool) |
| 8 | Finding a loop that does not bump | **new** (tool; builds on [A20]) |
| 9 | From sample to model: what you can still change | [D11] |
| 10 | Grains: loop a tiny piece, window it, overlap it, slow it down | [A19] to [A22] |
| 11 | Scratching | [A23] |
| 12 | Stretch time without changing pitch | [B24], [B25] |
| 13 | Turn a recording into a wavetable | [B26] |

### Two holes the new texts did not fill

**Hearing (track B).** Two narrow studies are in. What they support: [R1] to [R6] (thresholds and loudness in
the bass), [P1] to [P3] (timing in a low and a high part), [E6] and [E10] (tolerances for stretched partials
and decay time), [A3], [A6], [A18] (rules of thumb, stated as such). Still with no source at all: masking,
pitch from harmonics, hearing direction, how loudness builds over time, protecting your hearing, and every
illusion in `docs/BIOACOUSTICS.md`. Until a hearing text arrives (Moore first), these can exist only as
**observe-first lessons: the learner does the test and records what they hear, and the page explains
nothing yet and says so.**

| # | Lesson | Status |
|---|---|---|
| 1 | A note with its bottom removed: play harmonics 2 to 6 with no fundamental; what note do you hear? | **new**; explanation needs a source |
| 2 | A tone under noise: lower a tone in steps under steady noise until it is gone, at three pitches | **new**; explanation needs a source |
| 3 | Left or right: move a sound sideways by level alone, then by a tiny delay alone | **new**; explanation needs a source |
| 4 | From beats to roughness to two notes: slide two sines apart from 1 Hz to a fifth | **new**; explanation needs a source |
| 5 | Short and long: is a 20 ms tone as loud as a 500 ms one at the same level? | **new**; explanation needs a source |
| 6 | Your own quietest tone at six pitches, on your own headphones (relative steps only) | [R5] |

**Mixing and mastering (tracks M and N).** No text is in the library, so the twenty-eight planned lessons have
nothing to stand on. What can be taught now is what the Studio itself measures:

| # | Lesson | From |
|---|---|---|
| 1 | Where you turn it down matters | [I23] |
| 2 | Headroom: watch the master meter as tracks are added | **new** (tool; builds on [A7]) |
| 3 | Bass is touchy: small fader moves, big loudness changes | [R2] |
| 4 | Where kick and snare live | [Q6] |
| 5 | Wet and dry: reverb on a return track | [C9], [I32] |
| 6 | The mono check: fold the song to mono and note what goes | **new** (tool) |
| 7 | Bass in mono: what the Utility's bass-mono switch changes below its frequency | **new** (tool) |
| 8 | A limiter's ceiling: what it does to peaks and what it does not do to the average | **new** (tool) |
| 9 | Export, read the loudest moment, fix it, export again | **new** (tool) |
| 10 | Your bass is not everyone's bass | [R5] |

Why a mix translates, what "glue" and "punch" are, and every question of taste wait for the mixing books on
the buy-or-borrow list.

### Counts for this section
Ten chapters and two partial tracks: 162 lesson rows (some rows hold several ideas), of which **52 are new**:
41 are facts about our own tools and can be written now, 4 need a small build first, and 7 need a source
before they can explain anything. The rest are the
ideas of `docs/LESSON_IDEAS.md` put in a teaching order. Ideas from that file not placed here stay where they
already belong: the FM, ring, distortion, sync and formant sets extend the existing chapters "Reshaping the
wave" and "Effects"; the string, piano and blown-instrument sets belong to track Q; the driver set to the
sound-systems track.

## Track G-H: the history of each genre (owner asked 20 Nov 2026; planned, nothing built)

The owner wants lessons on the history of each genre they are into, one genre at a time. Nu-skool breaks is
first. Glitch-hop, psydub and the others follow in the same shape when the owner names the next one.

**Rules for every history lesson** (they keep the standing rules, with one change the owner should confirm):
1. **History needs names.** The standing rule says the app never names artists. A history lesson cannot obey
   that, so here people, clubs, labels and records are named for what they **did and when** (founded a label,
   ran a night, released a record, charted). Still never: how anyone made a sound, what anyone intended, or
   that a technique "is" someone's. **Awaiting the owner's yes to this exception.**
2. Every fact carries its source and its weakness. `S1` to `S9` below are the pages read; "tagged" means the
   page itself flags the claim as unsourced. Where two sources disagree the lesson shows both and does not
   pick one.
3. A history lesson ends in sound: each one hands over to a playable lesson (a drum pattern in the Studio, a
   patch on the synth) that lets the learner hear the thing the history is about. The playable part teaches
   the common shape of the style, written for this app; it is never a copy of a record.
4. No record audio is played or stored. A lesson may name a record and its year so the learner can find it.
5. Nothing about what the music does to a listener.

### Nu-skool breaks: what was read (20 Nov 2026)
- `S1` Wikipedia, "Nu skool breaks" (read in full; tagged as needing more citations since 2012).
- `S2` Wikipedia, "Breakbeat" (history and subgenres read).
- `S3` Wikipedia, "Big beat" (style, history and decline read; several maintenance tags).
- `S4` Wikipedia, "Florida breaks" (body read; its main source is the Orlando Sentinel, 1997).
- `S5` Wikipedia, "Amen break" (read in full; rated a Good Article).
- `S6` Wikipedia, "Breakbeat hardcore"; `S7` "Electro (music)"; `S8` "UK garage" and "Dubstep" (origins only).
- `S9` Wikipedia pages on people and labels: Rennie Pilgrem (a stub), Adam Freeland, Plump DJs, Stanton
  Warriors, Hybrid, Freestylers, Finger Lickin' Records, Marine Parade Records. Most carry "needs more
  citations" tags.
- **Could not be opened from the build session** (its network does not allow these sites; search results
  showed they exist): Resident Advisor's 2002 feature "Breaks Pilgrem-age" (the source S1 leans on for who
  coined the name), Rennie Pilgrem's own biography page, MusicRadar's "The history of breaks in music
  production" (2022), the Flame Tree "Breakbeat" entry, two retrospectives ("These Are The Breaks", 2019;
  "Whatever Happened To Nu Skool Breaks", 2019), and the Breakspoll awards' list of past winners. There is
  no Wikipedia page for Botchit & Scarper or for Breakspoll. **So this first list rests almost wholly on
  Wikipedia. Before a lesson is written, read the primary pieces (the owner can paste them, or allow the
  sites) and Simon Reynolds's "Energy Flash", which is on the buy-or-borrow list.**

### Nu-skool breaks: the lessons (28)

**Part 1. Where a "break" comes from**

| # | Lesson | What it says | Source | Hands over to |
|---|---|---|---|---|
| 1 | What a break is | A drum break is the stretch of a funk, soul or jazz record where the band stops and the drummer plays alone. Breakbeat music is built on those stretches | S2 | Studio: hear a one-bar drum pattern alone, then looped |
| 2 | Two copies of one record | From 1973 a DJ in New York played the breaks of funk records one after another; another marked the record with a crayon to find the break again. (S2 itself tags one claim in this story as dubious: say so) | S2 | Studio: loop one bar, then two bars end to end |
| 3 | Seven seconds from 1969 | "Amen, Brother" by the Winstons, a B-side recorded in Atlanta in early 1969; a four-bar break of about seven seconds played by Gregory Coleman | S5 | Studio: the common shape of that kind of break as a pattern written for this app |
| 4 | How one break travelled | 1986: the record appears on a compilation made for DJs, and is sampled the same year. 1988: three well-known records use it. Early 1990s: British dance music takes it up | S5 | Timeline the learner puts in order |
| 5 | Who got paid | The band received no royalties for the sampling; the bandleader learned of it in 1996; in 2015 two British DJs raised over £18,000 for him; in 2026 the record entered the US National Recording Registry | S5 | Reading and a quiz; links to the sampling-law lesson when one exists |
| 6 | Machines that copy a drummer | Early-1980s electro: drum-machine patterns that S7 calls "electronic emulations of breakbeats", stiffer than a played break. "Planet Rock", 1982 | S7 | Studio: the same pattern played tight on the grid, then with a looser feel |

**Part 2. Britain before nu-skool**

| # | Lesson | What it says | Source | Hands over to |
|---|---|---|---|---|
| 7 | Hardcore: breaks meet the rave | Early 1990s Britain: four-on-the-floor kicks combined with sped-up breaks sampled from hip-hop, "hoover" sounds, house pianos. Home production on an Atari ST with Cubase | S6 | Studio: a break over a four-on-the-floor kick |
| 8 | The split of 1992 to 1994 | By late 1992 hardcore divides into darker, jungle and happy strands; jungle and drum and bass take the break faster. One writer of the time called breakbeat "the death-knell of rave" | S6, S2 | Studio: one break at three tempos |
| 9 | Meanwhile in Florida | A separate breaks scene in Orlando from the late 1980s or early 1990s (the sources disagree on the date), mixing breaks with electro and Miami bass; statewide by 1993; waning from 2000; reunion nights in the 2020s | S4, S2 | Listening list by year; no playable part yet |
| 10 | Big beat: breaks get loud | Mid-1990s Britain. Heavy, distorted breaks at 100 to 140 bpm, acid lines, loops from 1960s and 1970s records. A Brighton club night ran from 1995 to 2001. Peak 1995 to 1999, fading from 2001 | S3 | Synth and Studio: a distorted break with an acid line |
| 11 | Where a name comes from | Three accounts of "big beat": a musician's coinage reported in a London magazine in 1989; a club night's name; the music press from the mid-1990s. A lesson in how genre names are disputed | S3, S2 | Quiz: match each account to its source |
| 12 | The label that linked them | A west London label of the late 1990s where members of two later breaks acts met and released early records (1996 to 1998) | S9 | Timeline |

**Part 3. The nu-skool years**

| # | Lesson | What it says | Source | Hands over to |
|---|---|---|---|---|
| 13 | A Thursday night in London | The club night Friction at Bar Rumba, with a promoter and resident DJs. S1 dates its launch to 1996; another account found in search says 1998; accounts also differ on which of three DJs coined "nu skool breaks". Show all of them | S1 (and unread pieces) | Quiz on what is agreed and what is not |
| 14 | The name on a sleeve | 1998: two mix compilations titled "Nu Skool Breakz", the first recorded live at the club. S1's text names a UK label; the sleeve it cites names a US one | S1 | Reading |
| 15 | What made it "new" | As S1 describes it: 125 to 140 bpm, a dominant bass line, "more abstract, more technical sounds" borrowed from UK garage, electro and drum and bass; fewer hip-hop samples and acid lines than big beat; sounds made with synthesizers, effects and computers | S1 | Studio and synth: the same break dressed two ways, sample-led and synth-led |
| 16 | The tempo map | Where it sat: big beat 100 to 140, nu-skool 125 to 140, UK garage about 130, breaks as a whole 110 to 175 (drum and bass at the top) | S1, S2, S3, S8 | Studio: one pattern at each tempo |
| 17 | The labels of 1993 to 1998 | Thursday Club Recordings (1993), Marine Parade (1998, named after a street in Brighton), Finger Lickin' (1998), and four more S1 lists without dates | S1, S9 | Timeline; find one record from each |
| 18 | Breaks on the radio and in the shops | 1999 to 2001: a Friday night show on a London station; 2001: a breaks mix on a magazine's cover; breaks volumes in the big club mix series in 2003 and 2004 | S9 | Timeline |
| 19 | Breaks and garage trade drums | UK garage's 2-step pattern (kicks removed and shifted, from the mid-1990s), and "breakstep" in 2002. One act's page files it under both breakbeat and UK garage | S8, S9 | Studio: a 2-step pattern beside a breaks pattern, then a blend |
| 20 | The cinematic strand | Progressive breaks: breaks with trance and orchestral writing; a 1999 album S9 describes as "a combination of progressive house and nu skool breaks"; film-score work from 2004 | S2, S9 | Synth: a pad and strings over a break |
| 21 | Breaks in the charts | What actually charted in Britain, 2000 to 2004: mostly positions between 60 and 130, with a few in the top 40. A scene can fill clubs without filling the charts | S9 | Reading the numbers: a small chart the learner sorts |
| 22 | The awards | An international breakbeat awards ran from 2001 (first held 2002) to at least 2015, at London clubs; one label won best label four years running, 2002 to 2005 | S9, S1, search results (unread) | Timeline |
| 23 | Breaks around the world | Australia (album chart entries, a signed band), Spain's Andalusian scene with its own radio show and festivals from the mid-1990s, and the US South's Asian-American breaks scene | S2, S9 | Map the learner fills in |

**Part 4. After the peak**

| # | Lesson | What it says | Source | Hands over to |
|---|---|---|---|---|
| 24 | What the sources say about the decline, and what they do not | S1 says nothing. One act's contract with its label ended in 2009 and its next compilation was sold as "post-breaks". Retrospectives found in search blame drum and bass or later bass styles, but they are opinion and were not read. **Teach it as an open question** | S9; unread pieces | Discussion card: what evidence would settle it |
| 25 | Dubstep arrives next door | South London, early 2000s, grown from UK garage's 2-step; a night founded in 2001; the name in print by 2002. S8 lists breakbeat only among its roots | S8 | Studio: a half-time pattern beside a breaks pattern |
| 26 | Where the people went | Named moves after 2008: new labels, house and electro-leaning records, film and game music, one founder leaving music for painting in 2010 | S9 | Timeline |
| 27 | The break does not go away | Hardcore breaks in the 2000s at 145 to 180 bpm; breakbeats as "a common signature" of a 2020s pop artist; Florida reunion nights in 2023 to 2025 | S6, S2, S4 | Studio: write an eight-bar break at a tempo of the learner's choice |
| 28 | Checkpoint: put it in order | Twelve events from 1969 to 2015 to place on a line, and for each, which source says so and how sure it is | all | The line itself |

### Nu-skool breaks: what is thin, and what would fix it
- **Who coined the name, and when the night began**: Wikipedia against search summaries. The Resident Advisor
  feature and the founder's own page would settle what each party claims.
- **The decline**: no read source says anything. Needs the two retrospectives, magazine pieces of 2007 to
  2010, or Reynolds.
- **The sound itself**: one paragraph in S1. Hockman's thesis (in the library) covers how breaks are cut and
  re-ordered, and belongs with lessons 3, 7 and 15 for the "how", kept apart from the "who".
- **Record labels with no page** (Botchit & Scarper, the awards): need the labels' own or archived pages.
- **Dates that contradict within one page** (an album dated 2000 and 2003; a single dated 2000 and 2004):
  check against a discography before either is taught.

## Paths: which lessons make which kind of producer (owner asked 20 Nov 2026; planned, nothing built)

The owner's idea: once the course is large (it may reach thousands of lessons), mark which lessons you must
finish and master to be a given level of producer, in the owner's words "this is what the average house
artist pulling 1m listeners a month knows and nothing more".

**What can be built honestly, proposed to the owner and awaiting a reply:**
- A **path** is a named subset of lessons with an order: every lesson carries tags, and a path is a list of
  lesson ids. The learner picks a path and sees only its lessons, how many are done, and how many are
  mastered (passed, then recalled correctly when they come back weeks later: the spaced return that exists).
- **A path is defined by what a finished piece of work needs, not by what a real person knows.** For example
  "Finish a house track": every skill a complete, released-sounding house track demonstrably uses (a
  four-on-the-floor pattern, a bass patch, sidechain, an arrangement, a balanced mix). That can be checked
  against the track itself. What a particular artist knows cannot be known, and the standing rules forbid
  claiming it.
- **Listener numbers are not used as a level.** No source ties a skill list to an audience size, and
  audience depends on much besides production skill. If a study or survey of working producers' skills is
  found it can go in the library and inform the paths; none is in yet.
- Levels inside a path, by what the learner can do: "make it" (a working version), "finish it" (arranged and
  mixed), "make it your own" (sound design from scratch, variation). Each level ends in a project the
  learner makes in the Studio, which is the real test.
- Paths by genre (house, breaks, glitch-hop, psydub...) and by role (sound designer, beat maker, mixer).
- Needs first: a `tags` field on lessons, far more of the course built (mixing, arrangement and the genre
  tracks do not exist yet), and "mastered" stored with the account.
