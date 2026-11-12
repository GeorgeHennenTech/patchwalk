# Track S: Serum 2 specifics

Status: **plan.** Lessons that teach Serum 2 itself, as opposed to synthesis in general. This is the unit left
open in `docs/COVERAGE_SYNTORIAL.md`. Lesson titles and descriptions are written for this app; the page numbers
point at the Serum 2 User Guide in the private library so the guide can cite it. Each lesson is a "Now in Serum"
walk-through: do it in Serum, save, drop the preset. Checks are limited to what the app reads reliably.

Uses: Serum, plus the guide and library.

## S1. Finding your way around (5)
| # | Lesson | You learn | Guide pages |
|---|---|---|---|
| S1.1 | The four pages | What lives on the oscillator, mixer, effects and matrix views | 16-36 |
| S1.2 | Presets and the browser | Loading, saving, tagging and finding presets | 327-339 |
| S1.3 | Editing values | Dragging, typing, fine adjustment, resetting a control | 18-36 |
| S1.4 | Drag-and-drop modulation | Assigning a source by dragging it onto a control | 187, 194 |
| S1.5 | Reading the displays | Waveform, filter and envelope displays as feedback | 39, 139 |

## S2. Oscillator extras (9)
| # | Lesson | You learn | Guide pages |
|---|---|---|---|
| S2.1 | OCT, SEM, FIN and CRS | The four pitch controls and when to use the continuous one | 40 |
| S2.2 | Phase, random phase and phase memory | PHASE and RAND, and carrying phase between notes | 41-44 |
| S2.3 | Unison in depth | DETUNE, BLEND, WIDTH, STACK, RANGE and the detune modes | 45-48 |
| S2.4 | Per-voice unison spreads | Spreading wavetable position and warp across unison voices | 47-48 |
| S2.5 | Warp families | Sync, the bend and asym group, remaps, filters, distortions, FM and PD from another oscillator | 49-56 |
| S2.6 | Two warps at once | WARP 1 and WARP 2 together, and swapping them | 49-56 |
| S2.7 | The sample oscillator | Loading, looping and slicing a sample | 68-84 |
| S2.8 | The granular oscillator | Grains from a sample inside Serum | 85-103 |
| S2.9 | The spectral oscillator | Resynthesis and spectral controls | 104-122 |

## S3. Sub, noise and mixer (4)
| # | Lesson | You learn | Guide pages |
|---|---|---|---|
| S3.1 | The sub oscillator | Shape, octave, PHASE, PAN, LEVEL and sending it past the filter | 123-127 |
| S3.2 | The noise oscillator as a sample player | Factory noises, your own samples, pitch tracking | 128-132 |
| S3.3 | Noise as a modulator | Using the noise oscillator inside the warp section | 128-132, 49-56 |
| S3.4 | The mixer | Levels, pans and routing each source to filters or direct out | 144-151 |

## S4. Filter extras (5)
| # | Lesson | You learn | Guide pages |
|---|---|---|---|
| S4.1 | The filter families | Normal, Multi, Flanges, Misc and New, by ear | 135-139 |
| S4.2 | The Var knob | How one knob changes job with the filter type (FAT, MORPH, SMOOTH and others) | 135-139 |
| S4.3 | Two filters | Running both filter modules in series or parallel | 133-143 |
| S4.4 | Character filters | Acid Ladder, MG Dirty, formant and comb types | 137-139 |
| S4.5 | Drawable filters | Drawing a response with the PZ SVF type | 139 |

## S5. Modulation extras (8)
| # | Lesson | You learn | Guide pages |
|---|---|---|---|
| S5.1 | ENV 1 and the others | Why ENV 1 is always the output volume; ATK, HOLD, DEC, SUS, REL and the curves | 184-187 |
| S5.2 | LFO modes | FREE, RETRIG and ENVELOPE, and the loopback point | 190-193 |
| S5.3 | LFO types | Normal, Path, the two chaos types and S&H | 190-193 |
| S5.4 | Drawing LFO shapes | Points, curves, the grid and step drawing | 189-193 |
| S5.5 | MONO, direction and host sync | One LFO for all voices; forward, reverse, ping-pong | 191-192 |
| S5.6 | Negative and bipolar depths | Setting direction and range of a modulation | 196 |
| S5.7 | Velocity and note sources | Shaping how velocity and key position modulate | 202-206 |
| S5.8 | The matrix | Sources, destinations, amounts, bypassing and moving rows | 209-214 |

## S6. Effects rack (6)
| # | Lesson | You learn | Guide pages |
|---|---|---|---|
| S6.1 | Working the rack | Adding, reordering, bypassing, copying and saving racks | 152-160 |
| S6.2 | The splitters | Low/high, low/mid/high and mid/side splits with different effects per band | 177-181 |
| S6.3 | Convolve and Bode | The two effects with no direct equivalent on the practice synth | 161, 164-166 |
| S6.4 | Hyper/Dimension | Thickening and widening after the oscillators | 173 |
| S6.5 | The multiband compressor | Single versus multiband mode | 162-163 |
| S6.6 | Utility | Width, mono bass and level at the end of the chain | 182 |

## S7. Performance and sequencing (5)
| # | Lesson | You learn | Guide pages |
|---|---|---|---|
| S7.1 | Voicing | MONO, LEGATO and POLY | 215-217 |
| S7.2 | Portamento | PORTA, CURVE, ALWAYS and SCALED | 218 |
| S7.3 | Macros | Assigning and naming them | 207-208 |
| S7.4 | The arpeggiator | Patterns and transposing | 244-266 |
| S7.5 | Clips | Storing and triggering note patterns inside a preset | 219-243 |

## S8. Making wavetables (5)
| # | Lesson | You learn | Guide pages |
|---|---|---|---|
| S8.1 | The wavetable editor | Frames, drawing tools and morphing | 274-290 |
| S8.2 | Importing audio | Turning a recording into a table | 291-303 |
| S8.3 | The formula parser | Generating frames from maths | 304-311 |
| S8.4 | Designing a table to sweep | Planning what the position knob will do | 274-290, 346-347 |
| S8.5 | Saving and reusing tables | Where tables live and how presets refer to them | 344-347 |

## S9. Housekeeping (3)
| # | Lesson | You learn | Guide pages |
|---|---|---|---|
| S9.1 | Global settings | Quality, tuning and the settings that affect every preset | 312-322 |
| S9.2 | Keeping Serum light | What costs processing power and how to reduce it | 348 |
| S9.3 | Shortcuts worth learning | The handful that speed up daily work | 349-353 |

Total: 50 lessons. The multisample instrument (pp. 58-67) and the preferences file (pp. 340-343) are left out
for now.
