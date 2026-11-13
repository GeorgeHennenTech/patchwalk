# Track Q: Physical modelling

Requested by the owner on 13 Nov 2026: "a large section of lessons on physical modelling". This replaces the
three one-line lessons D5.1 to D5.3 in `CURRICULUM.md` with a full track. Status: **planned, nothing built.**

Physical modelling makes sound by imitating how an object vibrates, instead of shaping a ready-made wave.
The controls are physical ideas (how hard, where, how stiff, how damped), which is why the results move and
respond like real things. It suits the owner's aims: organic, "alive" textures that are hard to get from
oscillators and filters.

## What has to be built first

The practice synth's engine is made of the browser's ready-made audio parts. Those cannot do a delay loop
shorter than about three thousandths of a second, which a plucked string needs for any note above roughly
the E above middle C. So this track needs a new kind of sound engine written sample by sample (an
"AudioWorklet"). Build order:

1. **String engine**: an exciter (noise burst, pick, bow-like noise), a delay loop with a damping filter and a
   fractional delay for tuning, pick position, pickup position, stiffness. Gives chapters Q1 to Q3.
2. **Resonator bank**: a set of tuned ringing filters with per-mode decay, for bars, bells, plates, drums.
   This can be done with the existing parts (band-pass filters fed by an impulse). Gives Q4 and Q5.
3. **Tube engine**: a delay loop with a non-linear "reed" or "lip" element and a breath input. Gives Q6.
4. **Body and coupling**: fixed resonant bodies (short convolution or a few resonators), sympathetic strings.
   Gives Q7.

Each instrument gets the same lesson furniture as the practice synth: panels with knobs, a picture drawn from
the settings (the string's shape, the modes of a bar), views, hear-it-first, match by ear.

## Lessons (about 60)

### Q0. The idea (4)
| # | Lesson | You learn |
|---|---|---|
| Q0.1 | Shaping a wave versus building an object | Why a model responds where a preset does not |
| Q0.2 | Exciter and resonator | Every instrument as something that puts energy in and something that rings |
| Q0.3 | A delay is a string | One trip down the string and back is one cycle of the note |
| Q0.4 | Loss is tone | Why what is lost on each trip decides how the note sounds and fades |

### Q1. The plucked string (9)
| # | Lesson | You learn |
|---|---|---|
| Q1.1 | A burst of noise becomes a note | The simplest string: noise into a delay loop |
| Q1.2 | Tuning the string | Loop length is pitch; why fine tuning needs a fraction of a sample |
| Q1.3 | Damping: bright and dull strings | The filter in the loop; nylon against steel |
| Q1.4 | Decay time | How long the string rings, and why high notes die sooner |
| Q1.5 | Where you pluck | Pick position removes harmonics; near the bridge against the middle |
| Q1.6 | What you pluck with | Soft thumb against hard pick: the shape of the first burst |
| Q1.7 | Where you listen | Pickup position, as on an electric guitar |
| Q1.8 | Muting and harmonics | Palm mutes, and touching the string at a half or a third |
| Q1.C | Checkpoint | Match plucked strings by ear: brightness, decay, pick position |

### Q2. Strings with character (8)
| # | Lesson | You learn |
|---|---|---|
| Q2.1 | Stiffness | Why piano and bell-like strings go slightly out of tune with themselves |
| Q2.2 | Two strings almost in tune | Beating and the double decay of a piano note |
| Q2.3 | Sympathetic strings | Strings that ring because others are played: sitar and harp shimmer |
| Q2.4 | Buzz | A bridge that the string slaps against: the sitar's jawari, a rattling fret |
| Q2.5 | Bowing | Continuous energy: slip and stick, pressure and speed |
| Q2.6 | Bends, slides and vibrato | Changing the length while it rings |
| Q2.7 | Impossible strings | Negative feedback, metal that never decays, strings a mile long |
| Q2.C | Checkpoint | Build a pluck, a piano-like tone and a bowed drone from one model |

### Q3. Struck and scraped strings as sound design (6)
| # | Lesson | You learn |
|---|---|---|
| Q3.1 | The string as a filter | Feeding any sound through a string instead of plucking it |
| Q3.2 | Tuned resonance on drums | A string after a snare or a click: pitched tails |
| Q3.3 | Comb textures | Very short loops as metallic colour, swept |
| Q3.4 | Karplus-style bass | Plucked-string basses and why they cut through |
| Q3.5 | Evolving plucks | Modulating damping and position during the note |
| Q3.C | Checkpoint | Turn a plain click into three different pitched instruments |

### Q4. Modes: bars, bells and plates (10)
| # | Lesson | You learn |
|---|---|---|
| Q4.1 | A ringing filter is a mode | One resonance, struck: pitch and decay |
| Q4.2 | A few modes make an object | Building a tone from three or four resonances |
| Q4.3 | Harmonic against inharmonic | Why a string sounds like a note and a bell sounds like a bell |
| Q4.4 | The bar | Marimba, vibraphone, kalimba: where the modes of a bar fall |
| Q4.5 | The bell | Hum, prime, tierce: why bells seem to have several pitches |
| Q4.6 | The plate and the gong | Dense, shimmering modes that bloom after the strike |
| Q4.7 | Material | Wood, metal, glass: decay against frequency as the signature of a material |
| Q4.8 | Size | Scaling every mode: the same object, bigger |
| Q4.9 | Where and how hard you strike | Strike position picks modes; a harder mallet is a brighter burst |
| Q4.C | Checkpoint | Match a wooden bar, a glass and a small bell by ear |

### Q5. Membranes and drums (7)
| # | Lesson | You learn |
|---|---|---|
| Q5.1 | The drum head | Why a drum's modes are not harmonic |
| Q5.2 | Tension and the pitch drop | A hit that starts sharp and settles: tom and kick |
| Q5.3 | The shell and the air | A resonant body under the head |
| Q5.4 | Snares and rattles | Noise that the head switches on |
| Q5.5 | Hand drums | Tabla and conga: where the hand lands and how it damps |
| Q5.6 | Modelled percussion in a beat | Tuning a kit so it sits with the bass |
| Q5.C | Checkpoint | Build a kick, a tom and a hand drum from one head |

### Q6. Tubes and breath (9)
| # | Lesson | You learn |
|---|---|---|
| Q6.1 | A tube is a string made of air | The same loop, with air and reflections |
| Q6.2 | Open and closed ends | Why a clarinet is hollow-sounding and a flute is not |
| Q6.3 | The reed | A valve that the tube itself opens and closes |
| Q6.4 | Breath pressure | Quiet to loud is also dull to bright, and then it squeals |
| Q6.5 | The flute and the jet | Blowing across an edge: breath noise as part of the tone |
| Q6.6 | Lips and brass | A tube driven by a buzzing valve |
| Q6.7 | Overblowing | Jumping to the next mode by blowing harder |
| Q6.8 | The voice as a tube | A buzzing source and a bendable tube: leads into bioacoustics |
| Q6.C | Checkpoint | A breathy flute, a reed and a growl from one tube |

### Q7. Bodies, coupling and hybrids (7)
| # | Lesson | You learn |
|---|---|---|
| Q7.1 | The body | Why a string alone sounds thin: guitar and violin bodies as fixed resonances |
| Q7.2 | Swapping bodies | The same string in a box, a tube, a tin |
| Q7.3 | Coupled objects | A string that drives a plate, a plate that drives a string |
| Q7.4 | Models driven by oscillators | Wavetable in, object out: the practice synth as an exciter |
| Q7.5 | Modulating the physics | LFOs and envelopes on size, damping and position |
| Q7.6 | Feedback instruments | Loops that play themselves and how to keep them musical |
| Q7.C | Checkpoint | Design an instrument that could not exist and still sounds physical |

### Q8. In the tools the owner has (4)
| # | Lesson | You learn |
|---|---|---|
| Q8.1 | Comb and resonator filters in Serum | The nearest things Serum has to a string (filter families, guide pp. 135-139) |
| Q8.2 | Ableton's Collision | Mallets and resonators (Ableton manual, Live Instrument Reference) |
| Q8.3 | Ableton's Tension and Electric | Strings and electric pianos as models (same chapter) |
| Q8.4 | Corpus and Resonators | Putting any track through a modelled object (Live Audio Effect Reference) |

## Sources to draw on
Already in the library: the Ableton Live 11 manual's instrument and effect references for Collision,
Tension, Electric, Corpus and Resonators. Free and suggested to the owner: Julius O. Smith, *Physical Audio
Signal Processing* (CCRMA, online). Worth buying: Perry Cook, *Real Sound Synthesis for Interactive
Applications*; Fletcher and Rossing, *The Physics of Musical Instruments*. None of the last three has been
supplied; lessons must not claim a source that is not in the library.
