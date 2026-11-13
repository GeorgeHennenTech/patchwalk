# Track T: Impacts, hits and striking bass

Requested by the owner on 13 Nov 2026: "I also want to study impact sounds/fx so that I could just make more
striking bass music in general." Status: **the first seven lessons are built** (13 Nov 2026, `src/course/lessons/impacts.ts`): T1.3, T2.1, T2.2, T2.7, T3.1 with T3.3, T3.4 and a checkpoint. The rest is planned.

The aim is practical: why some hits and bass notes land hard and others do not, and how to build the ones
that do. An impact is treated as three parts in time (the first few thousandths of a second, the body, the
tail) plus everything around it (what came just before, what gets out of its way).

Limits: it teaches mechanisms; it does not claim to know how any artist made a particular sound. Statements
about hearing (loudness, masking, timing) must come from a text in the library. The groove and low-pitch
timing papers the owner listed, and an acoustics text, are the intended sources; **none is in the library
yet**, so the sound-making parts can be built first and the explanations follow.

## What the app needs
- **Already there:** pitch envelopes, noise, sub, drive, filter envelopes, velocity, macros. Enough for T1,
  most of T2 and parts of T3.
- **Effects** (distortion, compression with sidechain, reverb, delay, EQ): on the build list. Needed for T4, T5.
- **Physical modelling** (track Q): struck bodies, for T2.6 and T6.
- **The mini DAW**: several sounds in time, for layering, placement and the drop lessons (T5, T7).
- **A transient view**: a zoomed-in picture of the first 50 ms of a sound, and a loudness-over-time trace.

## Lessons (about 50)

### T1. What an impact is (7)
| # | Lesson | You learn |
|---|---|---|
| T1.1 | Three parts of a hit | The first instant, the body and the tail, heard separately |
| T1.2 | The first instant | Why the first few thousandths of a second decide how hard a sound seems |
| T1.3 | Attack time and punch | The same sound with a 1, 10 and 50 ms start |
| T1.4 | A click on top | Adding a tiny burst of noise or a high tone to define the start |
| T1.5 | The body | Where the weight is: pitch, length and level of the low part |
| T1.6 | The tail | Ring, room or nothing: how the end changes the size of the hit |
| T1.C | Checkpoint | Match three hits by ear: start, body and tail |

### T2. Building hits from scratch (9)
| # | Lesson | You learn |
|---|---|---|
| T2.1 | The kick as a falling pitch | A sine with a fast pitch drop: the basis of most electronic kicks |
| T2.2 | How far and how fast it falls | Thud, knock or "pew": the pitch envelope's amount and decay |
| T2.3 | Kick tuning | Putting the body on a note that suits the bass |
| T2.4 | Snares and claps | Tone plus noise, and why a clap is several bursts |
| T2.5 | Metal and glass | Inharmonic tones for hits that cut through |
| T2.6 | Struck objects | Hits from modelled bars, plates and drums (uses track Q) |
| T2.7 | Sub drops | A long fall in pitch under a hit, and why it feels like falling |
| T2.8 | Booms | Low, long and slightly distorted: size from length |
| T2.C | Checkpoint | Build a kick, a snare, a metallic hit and a sub drop |

### T3. Striking bass notes (9)
| # | Lesson | You learn |
|---|---|---|
| T3.1 | A bass note is a hit too | Giving every bass note a start, a body and an end |
| T3.2 | Pluck, stab and growl | Three bass shapes from the envelope and filter |
| T3.3 | The filter snap | A fast filter envelope as the "front" of a bass note |
| T3.4 | Pitch at the front | A tiny pitch drop at the start of each note |
| T3.5 | Velocity as force | Harder notes brighter and louder, softer notes rounder |
| T3.6 | Sub and mid as separate jobs | A clean sub for weight, a dirty mid layer for character |
| T3.7 | Movement inside the note | Wavetable position, wobble and macro rides that keep a long note alive |
| T3.8 | Gaps | Short notes and silence between them as part of the rhythm |
| T3.C | Checkpoint | Three bass patches that hit three different ways |

### T4. Weight, loudness and dirt (8)
| # | Lesson | You learn |
|---|---|---|
| T4.1 | Harmonics make bass audible | Why a pure sub vanishes on small speakers and how distortion fixes it |
| T4.2 | Kinds of distortion | Soft clip, hard clip, fold and bit reduction, by ear and on the scope |
| T4.3 | Distortion before and after the filter | Thick against harsh |
| T4.4 | Multiband dirt | Distorting the mids and leaving the sub clean |
| T4.5 | Compression as punch | Letting the start through and holding the rest down |
| T4.6 | Clipping the peak | Trading a little of the first instant for a lot of loudness |
| T4.7 | Loud is not the same as hard | Why crushing everything makes hits smaller |
| T4.C | Checkpoint | Make one bass sound heavier three ways and say what each cost |

### T5. Making room for the hit (7)
| # | Lesson | You learn |
|---|---|---|
| T5.1 | Kick and bass in the same place | Why two low sounds at once blur each other |
| T5.2 | Ducking | Turning the bass down for an instant when the kick lands |
| T5.3 | Taking turns in pitch | Tuning and carving so each owns a region |
| T5.4 | Taking turns in time | Writing the bass around the kick |
| T5.5 | Mono lows, wide tops | Where width helps and where it steals impact |
| T5.6 | Room and reverb on low hits | Size without mud: short rooms, filtered tails |
| T5.C | Checkpoint | Fix a kick and bass that are fighting |

### T6. Impact effects (6)
| # | Lesson | You learn |
|---|---|---|
| T6.1 | Risers | Rising pitch, rising brightness, rising noise: building expectation |
| T6.2 | Downlifters and falls | The same, falling, after the hit |
| T6.3 | Reverse and suck-in | A tail played backwards into the hit |
| T6.4 | Layered impacts | A low boom, a mid crack and a high splash as one event |
| T6.5 | Whooshes and passes | Filtered noise with pitch and pan movement |
| T6.C | Checkpoint | Build a riser, an impact and a fall that belong together |

### T7. Contrast: why a drop lands (6)
| # | Lesson | You learn |
|---|---|---|
| T7.1 | Quiet before loud | A hit is judged against the moment before it |
| T7.2 | Taking the bass away | Removing lows before the drop so their return is felt |
| T7.3 | The gap | A beat of silence, and how short it can be |
| T7.4 | Narrow before wide, dull before bright | Other things to withhold and give back |
| T7.5 | Timing against the grid | Early, late and exactly on: small shifts and how hard a hit feels |
| T7.C | Checkpoint | Arrange eight bars so the same hit lands harder |

## Ties to other plans
- Track Q (physical modelling) for struck objects; track R (hearing) for loudness, masking and timing.
- The Rift lessons (Minimal Audio's distortion plugin, manual now in the library) sit beside T4.
- The groove and microtiming papers feed T7.5 and the rhythm track.
- The macro chapter: an "impact" macro and a "weight" macro are natural recipes to add.
