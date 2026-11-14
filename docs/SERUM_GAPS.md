# Serum 2 features the practice synth does not have

**Date:** 14 Nov 2026.

**What this is.** A side-by-side comparison of the Serum 2 User Guide (manual version 1.0.3, all 343 pages of
text in `library/serum-2-user-guide.json`) with the practice synth in `src/synth/`. Every Serum feature the
manual describes that the practice synth lacks, or has only in part, is listed below, in the manual's order.

**How to read the tables.**

- **Status** is one of: **Missing** (we have nothing like it), **Partly** (we have some of it; the note says
  what is still missing), **Have it**.
- **Size** is a rough guess at the work needed in a browser synth built on the Web Audio API:
  **Small** (hours to a day), **Medium** (a few days), **Large** (a week or more, or needs a new kind of
  audio engine).
- Control names in CAPITALS are printed that way in the manual. Everything else is in our own words.
- Page numbers are the manual's own page numbers.
- This is a list of gaps, not a plan to copy Serum. The look, the name and the factory content stay out
  (rule 4).

**Biggest gaps, in one paragraph.** Serum has three full oscillators (A, B, C) that can each be one of five
kinds (Wavetable, Multisample, Sample, Granular, Spectral); we have one wavetable-style oscillator, a plain
second oscillator and no sample playback of any kind. Serum's warp menu has about forty modes and two warp
slots per oscillator; we have four modes and one slot. Serum has two filters with around eighty filter
types and free routing between oscillators, filters, two effect busses and a direct output; we have one
filter with four types and one fixed path. Serum has thirteen effects that can be reordered, duplicated and
split by frequency band; we have six in a fixed order. Serum has four envelopes with a curve per stage, ten
LFOs with freely drawn shapes and several running modes, eight macros, and a 64-row matrix with curves and
a second "aux" source per row; ours are smaller in every one of those. Finally, Serum can play itself
(a clip player with a piano roll, and an arpeggiator), slide between notes (mono, legato, portamento),
answer to a MIDI keyboard (mod wheel, pitch bend, aftertouch, MPE), and edit or import wavetables. We have
none of those yet.

---

## 1. Oscillators in general (pages 17, 28-36)

Already covered: switching an oscillator on and off; OCT, SEM and FIN pitch controls; LEVEL (Osc A and B).

| Feature | What it does | Page(s) | Status | Size |
|---|---|---|---|---|
| OSC C | A third full oscillator | 17, 39 | Missing | Medium |
| Five oscillator kinds per slot | Each of A, B, C can be Wavetable, Multisample, Sample, Granular or Spectral | 17 | Partly: A is wavetable-like, B is basic shapes only | Large |
| Osc B as a full oscillator | B has everything A has (wavetable, unison, warp, pan) | 39 | Partly: B has shape, pitch, phase and level only | Medium |
| CRS (coarse pitch) | Smooth, unstepped pitch offset in semitones, meant for big sweeps | 29-30 | Partly: "Osc A pitch, wide" exists as a destination but there is no knob, and nothing for B | Small |
| Octave/semitone mode: Semitones, Harmonics, Ratio, Step | Sets pitch by harmonic number, by a ratio to another oscillator, or by microtuning steps instead of semitones | 30 | Missing (semitones only) | Medium |
| PAN per oscillator | Places each oscillator left or right | 57 | Missing | Small |
| Routing button (Filter, Main, Direct, None) | Chooses where each oscillator's sound goes | 31-32 | Missing (see section 9) | Medium |
| Enable Pitch Tracking (off) | Oscillator ignores the key played; plays a fixed pitch (drones, drums, or as a slow LFO) | 35 | Partly: `freeHz` exists for early lessons but is not a general switch | Small |
| Pitch Bend Tracking | Whether pitch bend still moves an oscillator that ignores the keys | 36 | Missing (no pitch bend at all) | Small |
| Lock Module | Keeps a module's settings when another preset loads | 33 | Missing (no presets to load) | Small |
| Init Module | Resets one module and removes its modulation | 34 | Missing | Small |
| Copy / Copy (w/mods) / Paste / swap modules | Copies one oscillator or filter onto another, with or without its modulation; dragging swaps two | 34 | Missing | Medium |
| Embed in Preset | Stores a custom wavetable or sample inside the preset file | 22 | Missing (no user content yet) | Small |

## 2. Wavetable oscillator (pages 37-57)

Already covered: PHASE; RAND (random phase); WT POS (on three built-in tables); UNISON voices with DETUNE and
stereo width; LEVEL; a picture of the wave; warp modes Sync, Mirror and two of our own (see the warp table).

| Feature | What it does | Page(s) | Status | Size |
|---|---|---|---|---|
| Real wavetables of up to 256 frames | A table is a row of single-cycle waves, 2048 samples each, that WT POS moves through | 38 | Partly: three small generated tables (4 to 7 frames, 64 harmonics) | Medium |
| Loading a wavetable from a menu or file | Pick any table from a library, or step with the arrows | 40 | Missing (and no factory tables may be shipped, rule 4) | Medium |
| 3D waveform view | Shows all frames at once with the current one highlighted | 39 | Missing | Medium |
| Frame number readout | Shows which frame WT POS is on | 39 | Missing | Small |
| Smooth Interpretation (WT POS menu) | Blends between frames as the position moves, without altering the table | 45 | Have it (our position always blends) | - |
| Phase Legato | Chooses whether the wave restarts when notes overlap | 43 | Missing | Small |
| Phase memory: All Voices, Contiguous, Per Voice | How the start phase is chosen for each new note | 44 | Partly: only the "All Voices" behaviour | Small |
| UNISON up to 16 voices | Stacks up to sixteen copies | 45 | Partly: up to 7 | Small |
| Unison level compensation | Keeps loudness steady as voices are added | 45 | Not checked in our engine | Small |
| Unison MODE: Linear, Super, Exp, Inv, Random | Five ways of spacing the detuned voices | 46-47 | Partly: one spacing | Small |
| Unison STACK: Off, 12 (1-3x), 12+7 (1-3x), Center-12, Center-24 | Puts some unison voices octaves or fifths apart | 47 | Missing | Small |
| Unison WIDTH | Stereo spread of the voices | 47 | Have it (our Spread) | - |
| Unison RANGE | The largest detune the DETUNE knob can reach | 48 | Missing | Small |
| Unison WT POS | Spreads the voices across different frames | 48 | Missing | Medium |
| Unison WARP 1 / WARP 2 | Spreads the warp amount across the voices | 48 | Missing | Medium |
| BLEND | Balance between the centre voice(s) and the detuned ones | 48 | Missing | Small |
| Unison on Osc B | Unison for the second oscillator | 45 | Missing | Small |
| Two warp slots (WARP 1 and WARP 2) | Two warps at once per oscillator | 48-49 | Partly: one slot | Medium |
| Swap Warps | Exchanges the two warp slots | 56 | Missing | Small |
| Warp on B and C | Warp for every oscillator | 49 | Missing | Medium |
| Warp shown live in the 2D picture | The picture bends as the knob turns | 49 | Have it | - |
| Opening the Wavetable Editor from the oscillator | The pencil button on the wave picture | 40 | Missing (see section 19) | Large |

### Warp modes, one by one (pages 50-56)

| Warp mode | What it does | Page(s) | Status | Size |
|---|---|---|---|---|
| Sync | Reads the wave faster and restarts it each cycle, adding harmonics without changing pitch | 50 | Have it | - |
| Sync WARP Var (hard to soft sync) | Softens the restart | 50 | Missing | Small |
| Bend + | Pinches the wave toward the middle of the cycle | 50 | Missing | Small |
| Bend - | Pulls the wave out toward the edges | 50 | Missing | Small |
| Bend +/- | Both, with no change at the knob's centre | 50 | Missing | Small |
| PWM | Pushes the whole wave to the left; the classic pulse-width sound on a square | 50 | Partly: our "Squeeze" is close but not the same rule | Small |
| Asym + | Bends the whole wave to the right | 50 | Partly: our "Bend" behaves like this | Small |
| Asym - | Bends the whole wave to the left | 50 | Missing | Small |
| Asym +/- | Either direction from the knob's centre | 50 | Missing | Small |
| Flip | Turns the wave upside down from a chosen point in the cycle | 50 | Missing | Small |
| Mirror | Plays the wave forwards then backwards within one cycle | 51 | Have it | - |
| Remap 1 | A curve you draw decides where in the wave to read | 51 | Missing | Medium |
| Remap 2 | The same, applied to each half (mirrored) | 51 | Missing | Medium |
| Remap 3 | A ready-made sine-shaped remap | 51 | Missing | Small |
| Remap 4 | The curve applied four times per cycle | 51 | Missing | Medium |
| Quantize | Turns the wave into steps (a sample-rate crush that follows the pitch) | 51 | Missing | Small |
| Odd/Even | Fades between odd harmonics only, the original, and even harmonics only | 51 | Missing | Small |
| LPF | A low-pass filter built into the oscillator | 52 | Missing | Small |
| HPF | A high-pass filter built into the oscillator | 52 | Missing | Small |
| Tube | Valve-style distortion of the wave | 52 | Missing | Small |
| Soft Clip | Gentle rounding of the peaks | 52 | Missing in the oscillator (we have it as an effect) | Small |
| Hard Clip | Flat cutting of the peaks | 52 | Missing in the oscillator (we have it as an effect) | Small |
| Diode 1 | Diode-circuit style clipping | 52 | Missing | Small |
| Diode 2 | A sine-shaped curve that clips harder with drive | 52 | Missing | Small |
| Linear Fold | Folds peaks back on themselves in straight lines | 52 | Missing in the oscillator (we have fold as an effect) | Small |
| Sine Fold | Folds peaks back along a sine curve | 52 | Missing | Small |
| Zero-Square | Quiet parts forced to silence, loud parts squared off | 53 | Missing | Small |
| Asym (distortion) | Different shaping for the top and bottom halves | 53 | Missing | Small |
| Rectify | Flips or removes one half of the wave | 53 | Missing | Small |
| Sine Shaper | Shapes the wave through a sine curve | 53 | Missing | Small |
| Stomp Box | Guitar-pedal style overdrive | 53 | Missing | Small |
| Tape Sat. | Tape-style saturation | 53 | Missing | Small |
| Soft Sat. | Very gentle saturation | 54 | Missing | Small |
| FM (B), FM (C), FM (Noise), FM (Sub), FM (Filter 1), FM (Filter 2) | Another oscillator or a filter's output shakes this oscillator's frequency | 54 | Partly: FM from B only, and only on A | Medium |
| FM type: Thru-Zero | The carrier keeps going correctly when pushed below zero frequency | 54 | Not confirmed which of the three our FM matches | Medium |
| FM type: Exp | Exponential FM: brighter and harsher, pitch drifts | 55 | Missing | Small |
| FM type: Linear | Linear FM that stops at zero instead of passing through it | 55 | Not confirmed which of the three our FM matches | Small |
| PD (B), PD (C), PD (Noise), PD (Sub), PD (Filter 1), PD (Filter 2), PD (Self) | Phase distortion: another source shakes the phase instead of the frequency | 55 | Missing | Medium |
| AM (B), AM (C), AM (Noise), AM (Sub), AM (Filter 1), AM (Filter 2) | Another source changes this oscillator's loudness at audio speed | 56 | Missing | Small |
| RM (B), RM (C), RM (Noise), RM (Sub), RM (Filter 1), RM (Filter 2) | Ring modulation: multiplies two signals | 56 | Partly: Ring from B only, and only on A | Small |
| Warp amount and ring amount as LFO/envelope destinations | Any source can move the warp knob | 49 | Partly: the slow path can (20 ms steps); only FM amount is smooth | Medium |

## 3. Multisample oscillator (pages 58-67)

Already covered: nothing. The practice synth cannot play recorded sound.

| Feature | What it does | Page(s) | Status | Size |
|---|---|---|---|---|
| Multisample mode | Plays a set of recordings of a real instrument, choosing by key and by how hard it is played | 58-60 | Missing | Large |
| Load SFZ | Loads an instrument described by an `.sfz` text file | 59 | Missing | Large |
| Zone display | Shows which recording each note uses; clicking shows the last note's wave | 60 | Missing | Medium |
| Multisample envelope with OVERRIDE | Its own DELAY, A, H, D, S, R envelope that can replace the one in the SFZ file | 61-62 | Missing | Medium |
| DELAY with BPM Sync | Waits before the envelope starts, in ms or beats | 61 | Missing | Small |
| VEL TRACK | How strongly key velocity affects the level | 62 | Missing | Small |
| RAND (sample start) | Random start point per note | 62 | Missing | Small |
| TIMBRE | Shifts which recording is used against the pitch, changing the tone | 63 | Missing | Medium |
| Unison, DETUNE, BLEND, warp, PAN, LEVEL for multisamples | The same extras as the wavetable oscillator | 63-66 | Missing | Medium |
| Switch to Single Sample | Turns the last note played into a single sample | 67 | Missing | Small |
| Switch to Wavetable | Turns that sample into a wavetable | 67 | Missing | Large |

## 4. Sample oscillator (pages 68-84)

Already covered: nothing.

| Feature | What it does | Page(s) | Status | Size |
|---|---|---|---|---|
| Sample mode | Plays one recording at different pitches across the keys | 68-70 | Missing | Medium |
| Load Sample / drag a file in | Brings in your own audio file | 70 | Missing | Medium |
| Root note from the file name | Reads the sample's pitch from a note name at the end of the file name, or from the WAV file | 68 | Missing | Small |
| Start and end markers | Choose which part of the recording plays | 71 | Missing | Small |
| Show Marker Animation | Markers move to show modulation | 72 | Missing | Small |
| Zoom to Start and End, zoom and pan | Looking closely at the recording | 72 | Missing | Small |
| Snap Off, Snap to Zero, Snap to Beats, Snap to Loop | What the markers stick to | 72-73 | Missing | Small |
| Fade Edges | Short fade in and out (1 to 128 ms) to stop clicks | 73 | Missing | Small |
| Normalize | Brings the recording up to full level | 73 | Missing | Small |
| Reverse | Plays the recording backwards | 73 | Missing | Small |
| Trim | Cuts the recording down to the markers | 73 | Missing | Small |
| Reload Sample | Undoes every edit | 73 | Missing | Small |
| Slicing: Slicing Off, Slice Auto, Slice Manual | Cuts a recording into pieces, one per key, with a sensitivity line or by hand | 74-75 | Missing | Large |
| Play Slice to End | A slice plays on to the end of the recording | 76 | Missing | Small |
| Play Single Slice | Every key plays the same slice at different speeds; a source can pick the slice | 76 | Missing | Small |
| Root Note (slices) | Which key plays the first slice | 76 | Missing | Small |
| Send to Selected Clip / Auto-Sync to Clip | Writes the slices into the clip player as notes | 76 | Missing | Medium |
| Loop modes: One-shot, Fwd Loop, Rev Loop, Fwd/Rwd Loop, Tailed | How the recording repeats while a key is held | 77-78 | Missing | Medium |
| Relative Loop, Link Loop Length, Exit Loop on Release | Loop options for moving loops and for leaving the loop on release | 78 | Missing | Small |
| LS / LE fields and loop markers | Set the loop's start and end | 79 | Missing | Small |
| Loop crossfade | Blends the loop's join so it does not click | 79 | Missing | Medium |
| SCAN | Speed and direction of playback | 80 | Missing | Small |
| Scan Range (±200%, ±400%, ±800%), Reverse, Lock Scan Rate (to Tempo), Sample Length to BPM (RATE) | Options for the scan knob, including fitting the recording to the tempo | 80 | Missing | Medium |
| Sample unison with START and SPAN | Unison where each voice starts at a slightly different place | 81-83 | Missing | Medium |
| Warp, PAN, LEVEL on samples | The warp menu works on samples too | 83-84 | Missing | Medium |
| Switch to Wavetable | Converts the sample to a wavetable | 84 | Missing | Large |

## 5. Granular oscillator (pages 85-103)

Already covered: nothing.

| Feature | What it does | Page(s) | Status | Size |
|---|---|---|---|---|
| Granular mode | Plays a recording as a cloud of tiny overlapping pieces ("grains") | 85-87 | Missing | Large |
| SCAN | How fast the play position moves through the recording; zero freezes it, negative runs backwards | 99 | Missing | Small (once the engine exists) |
| Scan options: Range, Reverse, Key Track, Lock Scan Rate (to Tempo), Sample Length to BPM | As for samples, plus scan speed following the key | 100 | Missing | Small |
| DENS (density): Free, BPM Sync, Grains | How often grains start: in Hz, in beats (Triplet, Dotted), or as a fixed number sounding | 101 | Missing | Medium |
| Jump Start | Full density from the first instant of a note | 101 | Missing | Small |
| Max Grains | A ceiling on grains at once | 101 | Missing | Small |
| LENGTH: Free, BPM Sync, Percent | How long each grain lasts | 101-102 | Missing | Small |
| Grain window AMOUNT and SKEW | How much each grain fades in and out, and whether the fade leans early or late; each with its own randomness | 91 | Missing | Medium |
| Grain window SHAPE: Hann, Welch, Gaussian, Blackman-Harris, Sinc, Tukey, Triangle, Trapezoid, ExpDec, Exp Dec Rev | Ten fade shapes for a grain | 91-93 | Missing | Small |
| Randomisation: OFFSET, DIR, PITCH, RAND (LENGTH), RAND (PAN), RAND (LEVEL) | Per-grain randomness of position, direction, pitch, length, pan and level | 102 | Missing | Medium |
| Reverse Grains | Flips the direction of all grains | 103 | Missing | Small |
| Loop Grains | Grains respect the loop markers | 89 | Missing | Small |
| Manual mode and X\|Y dot | The play position stands still and is moved by hand or by a source; the dot's height can drive a second setting | 89, 96 | Missing | Medium |
| Y axis targets: Level, Warp, Warp 2, Density, Grain Length, Window Amt, Window Skew, Rand Offset, Rand Dir, Rand Pitch, Rand Length, Rand Pan, Rand Gain, Rand Window, Rand Skew, Rand Warp, Rand Warp 2 | What the dot's up-down position controls | 97-98 | Missing | Medium |
| Grain crossfade | Crossfade applied to grain playback (needs Loop Grains) | 90 | Missing | Small |
| Granular unison with SPAWN PATTERN: Together, Even, Exp, Random | Unison where the voices' grains start together or staggered | 93-95 | Missing | Medium |
| Warp, PAN, LEVEL; sample operations, slicing and loop menu | Shared with the sample oscillator | 88-90, 99, 102 | Missing | Medium |
| Switch to Wavetable | Converts the recording to a wavetable | 103 | Missing | Large |

## 6. Spectral oscillator (pages 104-122)

Already covered: nothing as an oscillator. (We do have a spectrogram *view* of the output.)

| Feature | What it does | Page(s) | Status | Size |
|---|---|---|---|---|
| Spectral mode | Breaks a recording into its frequencies and rebuilds it, so speed and pitch are separate | 104-106 | Missing | Large |
| Spectrogram display with zoom | Shows the recording as frequency over time | 106 | Missing | Medium |
| High and low frequency markers | Keep only the frequencies between two limits; both can be modulated | 107 | Missing | Medium |
| Smooth / Post Warp | Softer edges for those limits; apply them after warping | 107 | Missing | Small |
| Show Waveform Display | Shows the ordinary wave under the spectrogram | 108 | Missing | Small |
| SCAN with Range, Reverse, Key Track, Lock Scan Rate (to Tempo), Sample Length to BPM | Playback speed, independent of pitch | 116-117 | Missing | Medium |
| Phase Lock | Keeps tonal sounds from smearing | 117 | Missing | Large |
| Transients | Keeps drum hits sharp | 117 | Missing | Large |
| CUT | Cutoff of the spectral filter | 117 | Missing | Small |
| FILTER (curve you draw) | A filter shape drawn point by point in the spectral filter editor, with GRID | 117-119 | Missing | Medium |
| Filter presets | Ready-made spectral filter shapes; save your own | 120 | Missing | Small |
| Wavetable as filter / Curve Filter | Uses a wavetable's shape as the filter | 120-121 | Missing | Medium |
| MIX | Balance of filtered and unfiltered sound | 121 | Missing | Small |
| Manual mode and X\|Y dot; Y axis: Level, Warp, Warp 2, Spec Flt Cutoff, Spec Flt Wet/Dry, Freq Lo, Freq Hi | Hand or source control of the play position and one more setting | 109, 114-115 | Missing | Medium |
| Spectral unison with SPAN and START | Unison for the spectral oscillator | 111-113 | Missing | Medium |
| Warp, PAN, LEVEL; sample operations, slicing, loop menu, crossfade | Shared with the sample oscillator | 108-110, 121 | Missing | Medium |
| Switch to Wavetable | Converts the recording to a wavetable | 122 | Missing | Large |

## 7. Sub oscillator (pages 123-127)

Already covered: on/off; a sine sub; OCT (one or two octaves down); LEVEL.

| Feature | What it does | Page(s) | Status | Size |
|---|---|---|---|---|
| Waveforms: Sine, Rounded Rect, Triangle, Saw, Square, Pulse | Six shapes for the sub | 124-126 | Partly: sine only | Small |
| OCT full range | Sub octave setting | 124 | Partly: -1 and -2 only | Small |
| CRS | Smooth pitch offset for the sub | 124 | Missing | Small |
| PHASE | Where the sub's wave starts | 127 | Missing | Small |
| Contiguous (PHASE menu) | New notes carry on from the last note's phase | 127 | Missing | Small |
| PAN | Left-right placement | 127 | Missing | Small |
| Sub routing (Filter / Main / Direct) | The sub can skip the filter and effects | 31, 145 | Missing | Medium |
| Sub as a warp source (FM (Sub), PD, AM, RM) | The sub shakes another oscillator | 54-56 | Missing | Small |

## 8. Noise oscillator (pages 128-132)

Already covered: on/off; White and Pink; LEVEL.

| Feature | What it does | Page(s) | Status | Size |
|---|---|---|---|---|
| Brown noise | Deeper, rumbling noise | 130 | Missing | Small |
| Geiger noise | Random clicks | 130 | Missing | Small |
| STEREO (colour noises) | From mono to completely different left and right | 129 | Missing | Small |
| FILTER (colour noises) | One knob that low-passes or high-passes the noise | 129 | Missing | Small |
| Noise as a sample player | The noise slot plays any mono or stereo recording | 128, 130 | Missing | Medium |
| Load Sample / drag a file / Embed in Preset | Use your own recording as the noise | 130 | Missing | Medium |
| One Shot / Looping | Play the recording once (for an attack click) or loop it | 131 | Missing | Small |
| START | Where in the recording playback begins | 131 | Missing | Small |
| RAND | Random start so chords do not all get the same noise | 131 | Missing | Small |
| PITCH and FINE | Tunes the noise recording | 132 | Missing | Small |
| Key track switch | The noise's pitch follows the keys | 132 | Missing | Small |
| PAN | Left-right placement | 132 | Missing | Small |
| Noise as a warp source (FM (Noise), PD, AM, RM) | Noise shakes another oscillator | 54-56, 128 | Missing | Small |

## 9. Filters (pages 133-143)

Already covered: one filter with on/off; low-pass, high-pass, band-pass and notch; 12 and 24 dB slopes;
CUTOFF; RES; DRIVE; key tracking (as an amount); a curve picture with the live spectrum behind it;
dragging in the picture to set cutoff and resonance together.

| Feature | What it does | Page(s) | Status | Size |
|---|---|---|---|---|
| FILTER 2 | A second filter | 133-134 | Missing | Medium |
| S / A / B / C / N routing switches | Choose which oscillators pass through each filter | 134 | Missing (everything goes through our one filter) | Medium |
| Filter-to-filter routing | Filter 1 into Filter 2, or side by side | 149 | Missing | Medium |
| 6 and 18 dB slopes | Gentler and in-between slopes | 135-136 | Missing | Small |
| MG Low 6/12/18/24 | Ladder low-pass in the style of a classic synth | 135 | Missing | Medium |
| Low 6/12/18/24, High 6/12/18/24 | State-variable low-pass and high-pass | 135-136 | Partly: 12 and 24 only, plain browser filter | Small |
| Band 12/24, Peak 12/24, Notch 12/24 | Band-pass, peak and notch in two slopes | 136 | Partly: band and notch, no peak | Small |
| FAT (Var knob on the Normal filters) | Saturation in the resonance path; tames and thickens | 135-136 | Missing | Medium |
| Multi: LH, LB, LP, LN, HB, HP, HN, BP, BN, PP, PN, NN (Var = FREQ) | Two filters in one; the Var knob sets the second cutoff | 136 | Missing | Medium |
| Morphing: LBH, LPH, LNH, BPN (Var = MORPH) | Slides smoothly between filter shapes | 136 | Missing | Medium |
| Flanges: Cmb L, Flg L, Phs L (Var = LP FREQ) | Comb, flanger and phaser with a low-pass in the feedback loop | 136 | Missing | Medium |
| Flanges: Cmb H, Flg H, Phs H (Var = HP FREQ) | The same with a high-pass in the loop | 136 | Missing | Medium |
| Flanges: Cmb HL, Flg HL, Phs HL (Var = HL WID) | The same with both; Var sets the width let through | 136 | Missing | Medium |
| Misc: Low EQ 6/12, Band EQ 6/12, High EQ 6/12 (Var = DB +/-) | Filters that turn into EQ shelves and boosts | 137 | Missing | Small |
| Misc: Ring Mod, Ring Modx2 (Var = SPREAD) | Ring modulation at the cutoff frequency; x2 has two | 137 | Missing | Small |
| Misc: SampHold, SampHold- | Sample-and-hold crush; the minus version outputs the difference | 137 | Missing | Medium |
| Misc: Combs, Allpasses, Reverb (Var = DAMP) | Delay and all-pass networks that smear the sound | 137 | Missing | Medium |
| Misc: French LP (Var = BOEUF) | A distorting low-pass with a second resonance | 137 | Missing | Large |
| Misc: German LP | A "zero-delay feedback" low-pass | 137 | Missing | Large |
| Misc: Add Bass (Var = THRU) | A phase-shifted low-pass with a little drive | 137 | Missing | Medium |
| Misc: Formant-I, Formant-II, Formant-III (Var = FORMNT) | Vowel filters; CUTOFF moves between vowels | 138 | Missing | Medium |
| Misc: Bandreject (Var = WIDTH) | A wide notch | 138 | Missing | Small |
| Misc: Dist.Comb 1 LP, Dist.Comb 1 BP, Dist.Comb 2 LP, Dist.Comb 2 BP (Var = COMBFRQ) | A comb filter inside a pass filter's feedback | 138 | Missing | Large |
| Misc: Scream LP, Scream BP (Var = SCREAM) | High-feedback screaming filter; DRIVE sets how much | 138 | Missing | Large |
| New: Wsp (Var = MORPH) | Model of a buzzy classic filter, low-pass to notch to high-pass | 138 | Missing | Large |
| New: DJ Mixer | One-knob DJ-style filter | 138 | Missing | Small |
| New: Diffusor (Var = STAGES) | All-pass stages for a blurry, phasey sound | 139 | Missing | Medium |
| New: MG Ladder, Acid Ladder, EMS Ladder (Var = SMOOTH) | Circuit models of three famous ladder filters | 139 | Missing | Large |
| New: MG Dirty (Var = PAIN) | The ladder model overdriven | 139 | Missing | Large |
| New: PZ SVF (Var = SMOOTH) | "Drawable" filters | 139 | Missing | Large |
| New: Comb 2 (Var = FRQ2) | A comb with very strong resonance | 139 | Missing | Medium |
| New: Exp MM (Var = MIX), Exp BPF | Outputs of a classic expander module's filter | 139 | Missing | Large |
| The Var knob | A fourth knob whose job changes with the filter type | 142 | Missing | Small (frame), then per type |
| True self-oscillation | The filter whistles by itself at high resonance | 142 | Missing (we say so in the lesson) | Large |
| Clean Mode (DRIVE menu) | Lowers the level into the filter and restores it after, for less saturation | 142 | Missing | Small |
| Filter PAN | Pushes left and right cutoff apart | 143 | Missing | Medium |
| Filter MIX | Balance of filtered and unfiltered sound | 143 | Missing | Small |
| Filter LEVEL | Output level of the filter | 143 | Missing | Small |
| Key track following portamento | Tracking follows the gliding pitch of the first tracked oscillator | 141 | Missing (no glide) | Small |
| Display: Frequency Response & FFT | Curve with live spectrum | 140 | Have it | - |
| Display: Phase Response & FFT | Shows how the filter shifts phase | 141 | Missing | Medium |
| Filter output as a warp or modulation source | FM (Filter 1), using a filter as a source | 54, 208 | Missing | Medium |

## 10. Mixer and routing (pages 144-151)

Already covered: a level per source (A, B, Sub, Noise); main volume; a level meter.

| Feature | What it does | Page(s) | Status | Size |
|---|---|---|---|---|
| MIX tab | One page with a channel strip for every source, filter and bus | 144-145 | Missing | Medium |
| Channel routing: Filter, Main, Direct, None | Send a source to the filters, straight to the effects, straight to the output, or nowhere (for use as a modulator only) | 146 | Missing | Medium |
| Filter 1 / Filter 2 balance knob | How much of a source goes to each filter | 146 | Missing | Small (after Filter 2) |
| ENV 1 button on a channel | Lets a source ignore the level envelope and run freely | 146 | Missing | Small |
| BUS 1 and BUS 2 sends | Each source and filter can send some signal to two side chains of effects | 146-147 | Missing | Medium |
| Bus routing: Main, Direct, the other bus | Where each bus goes next | 150 | Missing | Small |
| PAN per channel | Left-right position for every source | 147 | Missing | Small |
| Filter channel: route, PAN, MIX, level | Mixing the filters' outputs | 148-149 | Missing | Small |
| MAIN and DIRECT levels | Separate faders for the effected and the clean path | 151 | Partly: main volume only | Small |
| FX bypass buttons per bus | Switch a whole effects chain off from the mixer | 150-151 | Missing | Small |
| Stereo output meter | Left and right levels | 27 | Partly: one meter | Small |

## 11. Effects (pages 152-182)

Already covered: Distortion (soft clip, hard clip, fold, crush; DRIVE, MIX); EQ (low shelf, movable mid,
high shelf); Compressor (THRESH, RATIO, ATTACK, RELEASE, GAIN, a gain-reduction meter); Chorus (RATE, DEPTH,
MIX); Delay (ms or beats, FEEDBACK, MIX); Reverb (SIZE, MIX); on/off per effect; macros can move every
effect knob.

### The rack

| Feature | What it does | Page(s) | Status | Size |
|---|---|---|---|---|
| Three racks: MAIN, BUS 1, BUS 2 | Three separate effect chains | 153 | Partly: one | Medium |
| Add any module, several of the same | Build the chain from an empty rack | 152, 155 | Missing (fixed set of six) | Medium |
| Reordering | Drag effects into any order | 156 | Missing (fixed order) | Medium |
| Copy a module, with or without modulation | Duplicate an effect in the rack | 156 | Missing | Small |
| Bypass / remove | Skip an effect for a moment, or take it out | 157 | Partly: on/off only | Small |
| Rack presets, Save FX Bus / Load FX Bus | Save and recall a whole chain | 154, 158 | Missing | Small |
| Cut / Copy / Paste / Clear FX Bus | Move a whole chain between racks | 158 | Missing | Small |
| Lock FX Bus / Lock All FX Busses | Keep the effects when a preset changes | 158 | Missing | Small |
| Module menu: Factory presets, Save FX Preset, Save as Default Preset, Duplicate, Remove | Per-effect presets | 160 | Missing | Small |
| Effects as destinations for LFOs and envelopes | Any source moves an effect knob | 159 | Partly: the slow path only (20 ms steps, follows one note) | Medium |
| LEVEL on every module | An output level per effect | 161-182 | Missing | Small |
| Expanded rack view | A taller rack | 152-153 | Missing | Small |

### Effects we do not have

| Feature | What it does | Page(s) | Status | Size |
|---|---|---|---|---|
| BODE (frequency shifter): MONO INPUT, SHIFT (Retrig), RANGE, DIR, WIDTH, DELAY, BPM, FEED, BALANCE, BLUR, MIX | Moves every frequency by the same number of Hz (not a pitch shift), with a built-in delay | 161 | Missing | Large |
| CONVOLVE: IMPULSE, SIZE, TONE, ϕ MIN, PRE-DLY, BPM, ATTACK, DECAY, DAMP, IR GAIN, MIX | Stamps the sound of a recorded room (or any short sound) onto the signal | 164-165 | Partly: our reverb is a convolution of generated noise; no loading, shaping or choice | Medium |
| FILTER (as an effect) | The whole filter module again, after the notes are mixed, with all types and Key Track | 170-172 | Missing | Medium |
| FLANGER: RATE, BPM, DEPTH, FEEDBACK, PHASE, MIX | A very short moving delay giving a sweeping, jet-like tone | 172-173 | Missing | Small |
| HYPER: RATE, UNISON, DETUNE, RETRIG, MIX | A many-voice micro-delay chorus that imitates unison cheaply | 173 | Missing | Medium |
| DIMENSION: SIZE, MIX | Four out-of-phase delays that widen a mono sound | 174 | Missing | Small |
| PHASER: RATE, BPM, POLES, DEPTH, DEPTH 2, FREQ, FEEDBACK, PHASE, MIX | Moving notches in the spectrum | 174-175 | Missing | Medium |
| SPLITTER L/H: SPLIT FREQ | Splits the sound into lows and highs, each with its own chain of effects | 177-178 | Missing | Large |
| SPLITTER L/M/H: two SPLIT FREQ | The same with three bands | 179-180 | Missing | Large |
| SPLITTER M/S | Splits into middle and sides, each with its own chain | 180-181 | Missing | Large |
| UTILITY: POLARITY INV, LPF, HPF, MONO BASS / FREQ, WIDTH, PAN, MIX | Housekeeping: flip polarity, simple filters, mono bass, stereo width, balance | 182 | Missing | Small |

### Controls missing from effects we do have

| Feature | What it does | Page(s) | Status | Size |
|---|---|---|---|---|
| Chorus BPM sync | Chorus speed in beats | 162 | Missing | Small |
| Chorus DELAY 1 and DELAY 2 | The delay of each pair of chorus voices | 162 | Missing | Small |
| Chorus FEEDBACK | Feeds the chorus back into itself for a ringing tone | 162 | Missing | Small |
| Chorus LPF/HPF | A filter on the chorus signal | 162 | Missing | Small |
| Compressor MODE: MULTIBAND | Three bands compressed separately, up and down | 163 | Missing | Large |
| Multiband controls: X-LOW, X-HIGH, BELOW, H, M, L | Crossovers, the ratio below the threshold, and a gain per band | 164 | Missing | Large |
| Ratio at maximum becomes Limit | A true peak limiter instead of a compressor | 163 | Missing | Medium |
| Limiter Latency Comp | Reports the limiter's delay to the host | 163 | Missing (no host) | - |
| Compressor MIX | Blend with the uncompressed sound (parallel compression) | 164 | Missing | Small |
| Sidechain-style ducking by modulating the bands | Making room for a kick by moving a band's gain | 163 | Missing | Medium |
| Delay MODE: NORMAL (independent left and right) | A different time on each side | 166 | Missing | Small |
| Delay MODE: PING-PONG | Echoes bounce left and right | 166 | Missing | Small |
| Delay MODE: TAP-> DELAY | One single echo, then a normal delay | 166 | Missing | Small |
| Delay time offsets (triplet / dotted), LINK | A multiplier per side with Trip and Dot stops; link left and right | 166 | Partly: six beat lengths, no triplet or dotted | Small |
| Delay filter: FREQ and Q, draggable display | Filters each repeat so echoes get darker or thinner | 166-167 | Missing | Small |
| Delay High Quality | Better-sounding time changes | 166 | Missing | Medium |
| Distortion: 13 types | The manual says thirteen; it names Tube, Downsample, X-Shaper and X-Shaper (Asym) in this chapter | 167-168 | Partly: four types | Medium |
| Distortion filter: OFF/PRE/POST, TYPE (low to band to high), FREQ (Key Track), Q | A filter before or after the distortion | 168 | Missing | Small |
| X-Shaper and X-Shaper (Asym) | Two shaping curves you draw (Edit A, Edit B); DRIVE fades between them | 169 | Missing | Medium |
| Downsample | DRIVE lowers the sample rate | 168 | Partly: our crush reduces levels, not sample rate | Small |
| Drag in the distortion picture | Sets drive from the display | 168 | Missing | Small |
| EQ band type switches: Shelf / Peak / High Pass (left), Shelf / Peak / Low Pass (right) | Each band can change kind | 169-170 | Missing | Small |
| EQ FREQ and Q for both bands | Movable frequency and width on both bands | 169-170 | Partly: only our middle band moves; no Q | Small |
| Reverb TYPE: PLATE (LO CUT, HI CUT, SIZE, PRE-DLY, DAMP, WIDTH) | A plate reverb | 175 | Missing | Medium |
| Reverb TYPE: HALL (adds DECAY, SPIN RATE, SPIN DEPTH) | A hall with slow movement inside the tail | 175-176 | Missing | Large |
| Reverb TYPE: VINTAGE (ER SIZE, DECAY, DAMP, DIFF A, DIFF B, CHORUS) | An older-style reverb with early reflections | 176 | Missing | Large |
| Reverb TYPE: NITROUS (FEEDBACK, DIFFUSION, MODE: Space, Marble, Rectangle, Hexagon, Box, CHORUS) | A special-effect reverb with five modes | 176-177 | Missing | Large |
| Reverb TYPE: BASIN (FEEDBACK, CHORUS) | Another special-effect reverb | 177 | Missing | Large |
| Reverb LO CUT / HI CUT | Keep bass or treble out of the reverb | 175 | Missing | Small |
| Reverb PRE-DLY | A gap before the reverb starts | 175-176 | Missing | Small |
| Reverb DAMP | How fast the treble dies in the tail | 175 | Missing | Small |
| Reverb WIDTH | Stereo width of the tail | 175 | Missing | Small |
| Reverb size as a destination | Moving the size while it sounds | 175 | Missing (our size rebuilds the impulse) | Medium |

## 12. Envelopes (pages 183-187)

Already covered: ENV 1 always shapes the level; ENV 2 assignable; ATK, HOLD, DEC, SUS, REL; three shapes for
the fall; a draggable envelope picture; drag-and-drop assignment.

| Feature | What it does | Page(s) | Status | Size |
|---|---|---|---|---|
| ENV 3 and ENV 4 | Two more envelopes | 183 | Missing | Small |
| Attack curve | Bend the rise | 186 | Missing | Small |
| Separate decay curve and release curve, continuously adjustable | Drag each stage's curve by any amount | 186 | Partly: one of three fixed shapes, shared by decay and release | Small |
| MS / BPM switch | Envelope times in milliseconds or in beats | 185 | Missing | Small |
| Legato Inverted | One envelope does the opposite of the LEGATO switch | 185 | Missing (no legato) | Small |
| Lock / zoom | The picture always fills the display, or can be zoomed by hand | 184-185 | Missing (ours shows order, not time) | Small |
| Grid: Time or Beats | Background lines in ms or beats | 185 | Missing | Small |
| True time axis | The picture shows real seconds | 184 | Missing | Small |
| ENV 1 shown faintly behind the others | Compare an envelope with the level envelope | 185 | Missing | Small |
| ENV 1 as a source for other controls | The level envelope can also move any knob | 185 | Missing (Env 1 only shapes level) | Small |
| Sustain shown in dB | The readout on the envelope picture | 186 (picture) | Missing (we use %) | Small |
| Bypass and remove from the tab's menu | Switch all of an envelope's connections off, or delete them | 187 | Missing | Small |
| Envelopes per voice, or shared when LEGATO is on | Each note has its own envelope run | 216 | Partly: per note for fast destinations; slow destinations follow one note | Medium |

## 13. LFOs (pages 188-200)

Already covered: three LFOs; sine, triangle, square, saw and a 16-step drawn shape; RATE in Hz or beats;
Restart (RETRIG) or Free; RISE; one-way or both-ways; a shape picture; drag-and-drop assignment.

| Feature | What it does | Page(s) | Status | Size |
|---|---|---|---|---|
| LFO 4 to LFO 10 | Ten LFOs in all | 188 | Partly: three | Small |
| Freely drawn shape with points and curves | Any number of points, each segment bendable | 188-190 | Partly: sixteen flat steps | Medium |
| Drawing tools: Point, Flat, Ramp Up, Ramp Down | Stamp flat or sloped pieces at the grid size | 189 | Missing | Medium |
| Point editing: add/remove, snap to grid, move all curves, select several, relative move | Fine editing of the shape | 190 | Missing | Medium |
| GRID (horizontal and vertical) | Sets the grid the tools snap to | 192 | Partly: fixed at sixteen steps | Small |
| SHAPE presets, save your own | A menu of ready-made shapes | 191 | Missing (and no factory shapes may be shipped) | Small |
| LFO Editor | A big window for drawing | 193 | Missing | Small |
| TYPE: Normal | The drawn-shape LFO | 191 | Partly | - |
| TYPE: Path | Listed in the manual, not explained there | 191 | Missing | Unknown |
| TYPE: Chaos: Lorenz | A never-repeating wandering signal | 191 | Missing | Medium |
| TYPE: Chaos: Rossler | A second kind of wandering signal | 191 | Missing | Medium |
| TYPE: S&H | Sample and hold: a new random value at each step | 191 | Missing | Small |
| MODE: ENVELOPE | The shape plays once and stops, like an extra envelope | 191 | Missing | Medium |
| Loopback point | In ENVELOPE mode, play through and then loop from a chosen point | 190-191 | Missing | Medium |
| MONO | One LFO shared by all notes instead of one per note | 191 | Missing | Medium |
| DIRECTION: Forward, Reverse, Ping Pong | Which way the shape is read | 191 | Missing | Small |
| HOST | Ties the LFO's position to the song position | 192-193 | Partly: our Free mode follows the tempo clock | Small |
| TRIP / DOT | Triplet and dotted speeds | 192 | Partly: one triplet-like setting (1/3), no dotted | Small |
| Full range of beat speeds | Many note lengths | 192 | Partly: six | Small |
| Swing (RATE menu) | The LFO follows the keyboard's SWING | 192 | Missing | Small |
| 10x (RATE menu) | Ten times faster in Hz, up toward audio speed | 192 | Missing | Small |
| DELAY | A wait before the rise begins | 193 | Missing | Small |
| SMOOTH | Rounds off sudden jumps in the output | 193 | Missing | Small |
| PHASE, with Snap to Grid | Where in the shape the LFO starts | 193 | Missing | Small |
| LFO rate as a destination for LFO 2 and 3 | Any LFO's speed can be moved | 194 | Partly: LFO 1 rate only (smoothly) | Small |
| Copy LFO settings to another LFO | Drag one tab onto another | 189 | Missing | Small |
| Wavetable A/B/C to LFO | Copies the oscillator's current frame into the LFO shape | 197 | Missing | Small |
| LFO shape to wavetable | Copies the LFO's shape into an oscillator as a wave | 198 | Missing | Medium |
| Modulating LFO points (LFO busses, Modulate X / Modulate Y) | A source moves individual points of the shape while it plays | 198-200 | Missing | Large |
| Destination count on the tab | A small number showing how many places a source goes | 194 | Missing | Small |
| Hover to list a source's destinations | A tooltip naming them | 195 | Partly: the matrix lists them | Small |
| Bypass / remove from the tab's menu | Switch off or delete all of an LFO's connections | 195 | Missing | Small |

## 14. Other modulation sources and how modulation is set (pages 195-208, 210-211)

Already covered: velocity; key position (Serum's NOTE); four macros with names; a coloured ring on each
modulated knob; a depth handle per connection; negative amounts; one-way or both-ways; drag a source onto
a knob.

| Feature | What it does | Page(s) | Status | Size |
|---|---|---|---|---|
| VELO graph | A curve you draw that reshapes how velocity acts | 202-203 | Missing (straight line only) | Medium |
| NOTE graph | The same for key position | 204-205 | Missing (straight line only) | Medium |
| Legato (Portamento Time) on VELO / NOTE | The value glides between overlapping notes | 202, 204 | Missing | Small |
| Init Graph | Reset the graph to a straight line | 202 | Missing | Small |
| Macros 5 to 8 | Eight macros | 206 | Partly: four | Small |
| Unlimited destinations per macro | A macro can go to as many knobs as the matrix has rows | 207-208 | Partly: three slots each | Small |
| Macro as a destination | Another source can turn a macro | 206 | Missing | Medium |
| Swap macros | Drag one macro onto another to exchange them | 208 | Missing | Small |
| Apply and Delete Macros | "Bakes" the macros' current effect into the knobs and removes the macros | 214 | Missing | Small |
| Oscillator output as a modulation source | An oscillator (including NOISE and SUB) moves any knob at audio speed | 208, 210 | Missing | Large |
| Filter output as a modulation source | A filter's output moves any knob | 208, 210 | Missing | Large |
| Mod Wheel | The wheel on a keyboard as a source | 211 | Missing | Small |
| Pitch Bend | The pitch wheel, as pitch bend and as a source | 211 | Missing | Small |
| Aftertouch (channel pressure) | Pressing harder after the key is down | 211 | Missing | Small |
| Poly Aftertouch | The same, per key | 211 | Missing | Small |
| Release Velocity | How fast the key is let go | 210 | Missing | Small |
| Expression / MPE X, Y, Z | Per-note slide, tilt and pressure from an MPE controller | 210 | Missing | Medium |
| Note-On Rand 1 and Note-On Rand 2 | A new random value at each note | 210 | Missing | Small |
| Note-On Rand (Discrete) | A different random value for each destination at each note | 210 | Missing | Small |
| Note-On Alt. 1 and Note-On Alt. 2 | Flips between two values on every other note | 210 | Missing | Small |
| Active Voices | How many notes are sounding, as a fraction of the POLY limit | 210 | Missing | Small |
| Voice Index | Where the note falls in the Voice Control sequence | 210 | Missing | Small |
| Voice Mod 1 and Voice Mod 2 | Values from the Voice Control sequence | 210 | Missing | Medium |
| Fixed | A constant "source", so a row just adds a set amount | 211 | Missing | Small |
| Several sources on one knob, each with its own halo | The selected source's ring is coloured, others grey | 196 | Have it (one coloured ring per source) | - |
| Option/Alt-drag the knob to set depth | A shortcut for the depth | 196 | Missing | Small |
| Automatic one-way or both-ways on drop | Centred knobs get both-ways, others one-way | 196 | Missing (always starts the same) | Small |
| Limit Mod depth on drop | The first depth is trimmed so it cannot pass the knob's end | 314 | Missing | Small |
| Knob right-click menu: Mod Source, Aux Source, Edit Custom Curve, Bypass Modulator, Remove Modulator, Remove All Modulators | Connect and manage modulation from the knob | 26, 200-201 | Missing | Medium |
| Tooltip listing a knob's sources | Hover to see what moves a knob | 24 | Missing | Small |
| Main Tuning / Amp as destinations | Global pitch for all oscillators; overall level | 30, 214 | Partly: "Note level" exists; no global pitch | Small |
| Wavetable position and resonance moved smoothly | Smooth, per-note movement of WT POS and RES | 187 | Partly: slow path only | Medium |

## 15. Modulation matrix (pages 209-214)

Already covered: a matrix page; rows with source, destination, amount and direction; add and remove rows;
changes show on the knobs and the other way round.

| Feature | What it does | Page(s) | Status | Size |
|---|---|---|---|---|
| 64 slots | Up to 64 connections | 209 | Partly: one per source plus 8 extra rows plus 12 macro slots | Small |
| 49 sources | Every source in section 14 | 209 | Partly: 6 sources in rows (macros separate) | Medium |
| CRV (source curve) | Bends how the source acts (slow start, fast start) | 211 | Missing | Small |
| Editable Curve with RISE and FALL | A drawn remap of the source, plus smoothing that limits how fast it can rise or fall | 211 | Missing | Medium |
| POL (polarity) | One-way or both-ways | 211 | Have it | - |
| OUT graph | A small picture of the row's output | 211 | Missing | Small |
| AUX SOURCE | A second source that scales the first (for example, the mod wheel sets how deep an LFO goes) | 211 | Missing | Medium |
| INV | Flips the aux source so more means less | 211 | Missing | Small |
| Aux CRV | A curve for the aux source | 212 | Missing | Small |
| OUTPUT | A final fine scale on the row | 212 | Missing | Small |
| Bypass a row | Switch a connection off without deleting it | 213 | Missing | Small |
| Move rows | Drag rows into a different order | 213 | Missing | Small |
| Sort by Source / Sort by Destination | Tidy the list | 214 | Missing | Small |
| Lock Matrix | Keep the connections when a preset changes | 214 | Missing | Small |
| Create Vibrato (Unused LFO->Pitch via Wheel) | One click: an unused LFO to pitch, with depth on the mod wheel | 214 | Missing | Small (after aux source and mod wheel) |
| Create Velo->Amp Assignment | One click: velocity to loudness | 214 | Missing | Small |
| Macro rows editable in the matrix | Macro connections are ordinary rows | 209 | Partly: macro slots are listed read-only | Small |
| Expanded matrix view | A taller list | 212 | Missing | Small |

## 16. Voicing and portamento (pages 215-218)

Already covered: playing several notes at once.

| Feature | What it does | Page(s) | Status | Size |
|---|---|---|---|---|
| MONO | Only one note at a time; a new note takes over the old one | 216 | **Built** (Voices play: Mono; falls back to a key still held) | Medium |
| LEGATO | In mono, overlapping notes do not restart the envelopes and LFOs | 216 | **Built** | Medium |
| LEGATO with MONO off | Envelopes shared across notes ("paraphonic" behaviour) | 216 | Missing | Medium |
| POLY | The most notes allowed at once | 216 | Missing | Small |
| Voice count readout | Shows voices sounding against the limit (unison and grains count) | 216 | Missing | Small |
| Limit Same Note Poly to 1 | Replaying a key does not stack a second copy | 217 | Missing | Small |
| Voice Steal Priority: Newest, Oldest, Highest, Lowest, Velocity | Which note is cut when the limit is reached | 217 | Missing | Small |
| PORTA | Glide time between notes | 218 | **Built** (Glide, 0 to 2 s, a straight slide in pitch) | Medium |
| CURVE | The shape of the glide (fast then slow, or slow then fast) | 218 | Missing | Small |
| ALWAYS | Glide even when no note was held | 218 | **Built** (Glide on: Every note / Overlapped notes) | Small |
| SCALED | Shorter glides for small intervals, longer for big ones | 218 | Missing | Small |

## 17. Clips (pages 219-243)

Already covered: nothing. (A tempo and a click exist, and a mini DAW is planned.)

| Feature | What it does | Page(s) | Status | Size |
|---|---|---|---|---|
| CLIP module | A built-in player of short note patterns for the current sound | 219-220 | Missing | Large |
| 12 clip slots per bank | Twelve patterns to switch between | 220, 235 | Missing | Medium |
| Clip banks: load, Init, Save Clip Bank | Sets of twelve clips, saved and recalled | 221-223 | Missing | Small |
| TRIGGER MODE: MONO / POLY | One clip at a time, or several together | 221 | Missing | Small |
| EDIT ALL | A setting change applies to every clip | 221 | Missing | Small |
| Piano roll: add, select, move, resize notes | Draw the notes on a grid | 224-226 | Missing | Large |
| Time-range select, cut, copy, paste | Work on a stretch of time instead of notes | 225 | Missing | Medium |
| Note operations: Cut, Copy, Paste, Duplicate, Delete, Chop | Editing commands | 226 | Missing | Medium |
| Conform to Scale | Move notes onto the chosen scale | 227 | Missing | Small |
| Legato (notes) | Stretch each note to meet the next | 227 | Missing | Small |
| Mute | Silence chosen notes | 227 | Missing | Small |
| Quantize | Snap notes to the grid | 227 | Missing | Small |
| Reverse | Reverse the order of chosen notes | 227 | Missing | Small |
| Scale Time 50% / 200% | Halve or double chosen notes' timing | 227 | Missing | Small |
| Double Entire clip, Scale Entire clip 50% / 200% | Change the whole clip's length | 227 | Missing | Small |
| Hear notes when selected (headphones) | A note sounds when clicked | 227 | Missing | Small |
| Grid size | The step size of the piano roll | 228 | Missing | Small |
| Zoom, scroll, zoom to a marquee | Moving around the piano roll | 228-229 | Missing | Medium |
| Fold | Hide unused notes, or show only notes in the scale | 230-231 | Missing | Small |
| Clip start, end and start offset markers | Where the clip begins, ends, and first starts | 232 | Missing | Small |
| Wrap Clip to Begin Here; Quantize (offset marker) | Rotate the clip to start at the marker; snap the marker when modulated | 233 | Missing | Small |
| Note velocity and expression per note | Loudness and per-note expression in the clip | 233 | Missing | Medium |
| Automation lanes, recording macro moves | Macro movements stored in the clip | 227, 241 | Missing | Large |
| LENGTH | Clip length in bars, beats and 16ths | 234 | Missing | Small |
| KB SPAN: Mono, Poly, Offset, Off | Keys transpose the clip, or start it from different places | 234 | Missing | Medium |
| TRANS | Transpose the clip | 234 | Missing | Small |
| MODE: Random, Rand.No Dup, Rand.Start, Rand.End, Static (and the normal directions) | How the play position moves, including random jumps between slices | 234 | Missing | Medium |
| RATE | Clip speed | 234 | Missing | Small |
| LAUNCH QUANT | A started clip waits for the next beat or bar | 234 | Missing | Small |
| RETRIG | Restart on trigger, or join the clock mid-way | 234 | Missing | Small |
| VELO TRIG | The triggering key's velocity scales the clip's velocities | 234 | Missing | Small |
| NOTE GATE | Letting go of the key stops the clip | 234 | Missing | Small |
| Clip menu: Rename Clip, Copy Clip, Paste Clip, Erase Clip | Managing slots | 235 | Missing | Small |
| Set as Preview Clip | The clip that plays when the preset is previewed | 235 | Missing | Small |
| Triggering from the CLIP keyboard / MIDI Input Trigger Octave | A set of keys starts and stops clips | 236, 241 | Missing | Small |
| Recording: OVERDUB, EXTEND, metronome, commit, undo | Record what you play into a clip | 237-238 | Missing | Large |
| MIDI OUT: Off, Clip Player, On | Send the generated notes to another instrument | 239-240 | Missing | Medium |
| Lock Module (clips) | Keep the clips when a preset changes | 241 | Missing | Small |
| Macros assigned to clip settings | A macro can turn, for example, a clip's RATE | 241-243 | Missing | Small |

## 18. Arpeggiator (pages 244-266)

Already covered: nothing.

| Feature | What it does | Page(s) | Status | Size |
|---|---|---|---|---|
| ARP module | Turns a held chord into a running pattern of single notes | 244-245 | Missing | Medium |
| 12 arp slots per bank; arp banks: load, Init, Save Arp Bank | Twelve arpeggiators to switch between, saved as a set | 245-248 | Missing | Small |
| LAUNCH QUANT | A started arp waits for the beat | 246 | Missing | Small |
| EDIT ALL | Changes apply to every slot | 246 | Missing | Small |
| SHAPE menu (up/down patterns, Converge, Diverge, random shapes, Pattern) | The order the chord's notes are played in | 248 | Missing | Medium |
| RATE in BPM or HZ, TRIP, DOT | Arp speed | 248 | Missing | Small |
| Custom pattern editor (arp graph) | Draw your own pattern of steps | 249-253 | Missing | Large |
| Pattern LENGTH | Pattern length | 251 | Missing | Small |
| Pattern MODE: Normal, Reverse, Pendulum, Random, Rand Start, Rand End, One Shot, Static | How the pattern is read | 251 | Missing | Medium |
| TIME | How often random modes jump | 251 | Missing | Small |
| STEP MODE: Normal, New Only, Chord, Chord (new) | Whether a step plays one note or the whole chord | 251 | Missing | Medium |
| WRAP, PITCH, RANGE | What happens when the pattern asks for more notes than are held | 251 | Missing | Medium |
| Accent lane, Strum lane, automation lanes | Per-step emphasis, strumming and control changes | 253 | Missing | Large |
| Load / Save / Rename Pattern | Pattern presets | 249-252 | Missing | Small |
| TRANSPOSE: SHIFT and RANGE | Repeats the pattern transposed by an interval, a set number of times | 254 | Missing | Small |
| Range shapes: Up, Down, Up/Down, Down/Up, Up+Down, Down+Up, Thumb Up, Thumb UD, Pinky Up, Pinky UD, Converge, Diverge, Con+Diverge, Chord, Random, Rnd.NoDup, Rnd.Drift, Rnd.Once | The order of those transpositions | 255-261 | Missing | Medium |
| LATCH | Keeps playing after the keys are released | 261 | Missing | Small |
| THRU | The held notes sound as well as the arp | 261 | Missing | Small |
| OFFSET | Rotates the note order | 262 | Missing | Small |
| REPEATS | How many times the pattern and its transpositions repeat | 262 | Missing | Small |
| GATE | Note length relative to the rate | 262 | Missing | Small |
| CHANCE (with Pre) | The odds that each note plays | 262 | Missing | Small |
| RETRIGGER: LAUNCH, RATE, NOTE, FIRST | When the pattern starts over | 262 | Missing | Small |
| VELOCITY: RETRIG, DECAY, TARGET | Velocities drift toward a target over time | 262 | Missing | Small |
| Slot menu: Rename / Copy / Paste / Erase Pattern, Show Pattern Names | Managing slots | 263 | Missing | Small |
| ARP keyboard / MIDI Input Trigger Octave | A set of keys picks the arp | 264, 266 | Missing | Small |
| Sustain pedal controls latch | CC64 holds the arp | 262 | Missing | Small |
| MIDI OUT for the arp | Send arp notes to another instrument | 265 | Missing | Medium |
| Lock Module (arp) | Keep the arps when a preset changes | 266 | Missing | Small |

## 19. Keyboard, MIDI and MPE (pages 25-27, 267-273, 325-326, 341-343)

Already covered: an on-screen keyboard; computer-keyboard notes with octave keys; Hold; velocity from where a
key is clicked.

| Feature | What it does | Page(s) | Status | Size |
|---|---|---|---|---|
| MIDI keyboard input | Play from a real keyboard | 18, 25 | Missing | Small (Web MIDI) |
| Keyboard shows notes from clips and arp | Keys light up for generated notes | 25 | Missing | Small |
| TRANSPOSE (-24 to +24) | Shift everything by semitones | 267 | Partly: octave keys only | Small |
| KEY and SCALE | Notes outside the chosen scale are moved onto it | 268 | Missing | Small |
| SWING and swing division | Pushes off-beat notes late for groove | 269 | Missing | Small |
| OSC MAPPING: key ranges | Each oscillator (and the arp) answers only to part of the keyboard: splits and layers | 269-271 | Missing | Medium |
| FOLD | Notes outside a range are moved into it | 271 | Missing | Small |
| WARP checkbox | An oscillator still acts as a warp source outside its range | 271 | Missing | Small |
| Velocity ranges (VEL mapping) | Each oscillator answers only to part of the velocity range | 272-273 | Missing | Small |
| MIDI Learn / Remove MIDI cc | Tie a hardware knob to an on-screen knob | 26, 201 | Missing | Medium |
| Load MIDI Map / Save MIDI Map, default map | Save and recall those ties | 27, 325 | Missing | Small |
| Sustain pedal | Holds notes | 262 | Missing (Hold button only) | Small |
| MPE Enabled | Per-note pitch, slide and pressure from an MPE controller | 325 | Missing | Medium |
| MPE: XYZ -> Macro 1,2,3; MPE: YZ -> Macro 1,2; MPE: Y -> Mod Wheel | Ready-made MPE mappings | 325-326 | Missing | Small |
| MPE Bend Range | Per-note bend range, 1 to 96 semitones | 326 | Missing | Small |
| VST3 Note Expression | Per-note expression from a host | 325 | Missing (no host) | - |
| Preset and oscillator stepping from MIDI CC or notes | Buttons on a controller step through presets or tables | 341-343 | Missing | Small |

## 20. Wavetable editor and importing audio (pages 274-303, 346-347)

Already covered: nothing. Our three tables are generated by code from harmonic recipes.

| Feature | What it does | Page(s) | Status | Size |
|---|---|---|---|---|
| Wavetable Editor | A full screen for drawing and processing wavetables | 274 | Missing | Large |
| Frame thumbnails: select, reorder, select a range | Managing the frames of a table | 275 | Missing | Medium |
| Drawing tools: Flat Line, Sine, Slope Up, Slope Down, Curve up, Curve down, Half sine (peak), Half sine (valley), Interpolate linear, Interpolate curved, Nudge, Noise, Mirror | Draw the wave by hand at the grid size | 276-277 | Missing | Medium |
| FFT area: harmonic bars and phase bars | Draw the loudness and phase of each harmonic | 278 | Missing | Medium |
| FFT menu: Clear All, Clear HF, Clear LF, Generate Saw, Randomize Low x Bins (and with Half), Randomize All, Create Random Series Gaps, Progressive Fade, Shift Octave Up / Down, Repeat Bin Group, Draw Even / Odd Harmonics Only, Snap Vertical Draw to Quarters, Scale Freq Values by Bin Index | Commands on the harmonics | 279-280 | Missing | Medium |
| COPY / PASTE frames | Copy frames within a table | 282 | Missing | Small |
| REMOVE menu: Init All, Insert, Remove, Remove: multiselection, Remove: beginning->selected, Remove: selected->end, Remove All (except Selected), Reduce to | Add, delete and thin out frames | 282-283 | Missing | Small |
| SORT menu: by Peak Spect, Average Spect, Peak Amount, Num w/Spect, Highest w/Spect, Fundamental Amt.; Sort Randomize; Reverse Entire Table Order | Reorder frames by a property of their spectrum | 283 | Missing | Medium |
| SINGLE menu: Normalize, Remove DC Offset, Flip Vertical, Flip Horizontal, Shift Horizontal to Zero Crossing, Init (Silence), Fade Edges, X-Fade Edges, Filter, Sample Redux, Send to Noise Oscillator | Processing for the current frame | 286 | Missing | Medium |
| ALL menu: Normalize Each / Same, Remove DC Offset, Flip Vertical / Horizontal, Fade Edges, X-Fade Edges (Grid Size / 16 Samples), Filter, Remove Fundamental (HPF), Remove Low Spectra, Remove Low Phases, Sample Redux, Resize Tables to be Half / Double, Create PWM from This Table to All, Nudge All Phases for Fundamental to 50%, Set Spectra / Phases (This Frame to All), Set Spectra / Phases from Other Osc, Subtract Spectra from Other Osc, Blur Spectra / Phases Adjacent Bins, Blur Spectra / Phases Adjacent Frames, Shift Horizontal to Zero-Crossing | Processing for every frame | 287-288 | Missing | Large |
| MORPH menu: Morph - Crossfade, Morph - Spectral, Morph - Spectral (Zero Fund. Phase), Morph - Spectral (Zero All Phases), Remove Morph Tables | Fill in in-between frames so the table moves smoothly | 289 | Partly: we always blend neighbouring frames' harmonics | Medium |
| Export: 8-bit (.256), 16-bit (.wav), 32-bit (.wav), Single-Cycle Waves, Export Selection | Save a wavetable to a file | 285 | Missing | Medium |
| Save Table | Save a table so it appears in the menu | 290 | Missing | Small |
| Import by drag-and-drop or the Import menu | Bring audio in as a wavetable | 285, 291, 298 | Missing | Large |
| Import: DYNAMIC PITCH - ZERO SNAP | Follows a changing pitch, cutting at zero crossings | 292 | Missing | Large |
| Import: DYNAMIC PITCH - FOLLOW | Follows a changing pitch without looking for zero crossings | 292 | Missing | Large |
| Import: FREQUENCY ESTIMATION | Works out the note and its harmonics first | 293 | Missing | Large |
| Import: Constant framesize (PITCH AVERAGE) | One fixed cycle length for the whole file | 293 | Missing | Medium |
| Import: FFT 256 / 512 / 1024 / 2048 | Takes the "flavour" of the spectrum in small time slices | 293-294 | Missing | Medium |
| Import: Switch OSC type | Load the file as a Sample, Granular or Spectral source instead | 294 | Missing | Small (after those exist) |
| Samples-per-cycle or note name typed in the formula box | Tell the importer the exact cycle length | 294 | Missing | Small |
| Text file overrides (`.txt`, `FolderInfo.txt`) | A side file that sets cycle length and interpolation for imports | 295 | Missing | Small |
| Importing single-cycle waves (one, or many at once) | Each file becomes one frame | 296-297 | Missing | Medium |
| Importing a PNG image | Brightness becomes wave height; width becomes the number of frames | 300-301 | Missing | Medium |
| Stereo import (left to A and C, right to B) | A stereo file is shared between oscillators | 291 | Missing | Small |
| Missing-files dialog and search path | Finding a moved audio file again | 302 | Missing | Small |
| Render OSC Warp | Turns the current frame into 256 frames spanning the whole warp knob | 324 | Missing | Medium |
| Resample to | Plays the sound for one bar and turns the result into a wavetable | 324 | Missing | Large |
| Mod Wheel -> WT Pos while the editor is open | The wheel scans the frames | 315 | Missing | Small |

## 21. Formula parser (pages 304-311)

Already covered: nothing a learner can type. (Our tables are made by formulas in code.)

| Feature | What it does | Page(s) | Status | Size |
|---|---|---|---|---|
| Formula field | Type maths to draw a wave or a whole table | 304 | Missing | Medium |
| Functions: sin, cos, tan, asin, acos, atan, sinh, cosh, tanh, asinh, acosh, atanh, log2, log10, log, ln, exp, sqrt, sign, rint, abs, min, max, sum, avg | The maths functions it understands | 304-305 | Missing | Medium |
| Operators: && \|\| <= >= != == > < + - * / ^ (and the ?: choice and % seen in examples) | Comparisons and arithmetic | 305, 310 | Missing | Medium |
| Variables: pi, e, w, x, y, z, q, in, sel, rand | Position in the wave, frame number, harmonic number, the existing wave, a random value | 306 | Missing | Medium |
| `q` formulas | Write to the harmonics instead of the wave shape | 309-310 | Missing | Small (after the parser) |
| `y` / `z` formulas | Fill the whole table, a different wave per frame | 306 | Missing | Small (after the parser) |
| Formula presets: Singles, Multis, User Singles, User Multis | Ready-made and saved formulas | 307 | Missing | Small |
| Save Formula; editing the formula text files | Keep your own formulas | 308-309 | Missing | Small |

## 22. Global settings (pages 312-322, 340)

Already covered: tooltips of our own; knob double-click resets; values shown while turning; a tempo.

| Feature | What it does | Page(s) | Status | Size |
|---|---|---|---|---|
| Help Tooltips on/off | Switch hover help on or off | 313 | Missing (no switch) | Small |
| Param value tooltips | Show the number while a knob turns | 313 | Have it (readout under the knob) | - |
| Double-click params: reset or type a value | Choose what double-click does | 313 | Partly: reset only; no typing a value | Small |
| Mouse wheel param control | Turn knobs with the scroll wheel | 314 | Missing | Small |
| Keyboard shortcuts on/off | Stop the synth taking computer keys | 314 | Missing | Small |
| Default waveform view (2D / 3D) | Which picture oscillators open with | 314 | Missing (no 3D) | - |
| MPE preferences: MPE enabled by default; MPE Pitch Bend (also) maps to Expr X; MPE Expr Y acts bi-directional | How MPE is read | 314 | Missing | Small |
| Limit Mod depth on drop | See section 14 | 314 | Missing | Small |
| Silence note + FX tails when host transport stops | Cut reverb and delay tails on stop | 315 | Missing | Small |
| Load MIDI Map from Presets | Whether a preset brings its own hardware map | 315 | Missing | - |
| Use Ultra quality when rendering | Best quality for offline bounces | 315 | Missing (no rendering) | - |
| VOICE CONTROL: a sequence of 1 to 8 steps with SEQ lanes per voice | Each new note steps through a short list of per-note values | 316-317 | Missing | Medium |
| Voice Control applies to chosen oscillators | Pick which oscillators it affects | 316 | Missing | Small |
| RANDOM: PAN, DETUNE, CUTOFF, ENVS | A little random pan, tuning, cutoff and envelope time per note, for an "analogue" feel | 318 | Missing | Small |
| Scaling for all envelopes | One control that stretches or shrinks every envelope time | 318 | Missing | Small |
| Scaling for all LFOs (percentage or rate) | One control that speeds or slows every LFO | 318 | Missing | Small |
| Voice Control presets | Save and load these settings | 316-317, 319 | Missing | Small |
| Quality: Draft (1x), High (2x), Ultra (4x) oversampling | Higher quality reduces harsh digital artefacts at more processing cost | 319 | Missing | Large |
| Quality lock | Keep the quality setting when presets change | 319 | Missing | - |
| S1 Compatibility Mode | Makes Serum 1 presets sound as before | 319 | Missing (not relevant) | - |
| Disable Smoothing | Knob changes take effect instantly instead of gliding | 320 | Missing | Small |
| Concert pitch | The frequency of A (440 Hz by default) | 320 | Missing (fixed at 440) | Small |
| TUN FILE: Load Tuning / Clear Tuning | Other tuning systems from a `.tun` file | 320 | Missing | Medium |
| MTS-ESP, MTS-ESP Note-On Only | Tuning shared across instruments from one master | 321 | Missing (no host) | - |
| Tuning lock | Keep the tuning when presets change | 321 | Missing | - |
| Default Author in the preferences file | A default artist name | 340 | Missing | - |

## 23. Presets, browser, menus and general workflow (pages 18-27, 33-36, 323-339, 349-353)

Already covered: starting from an "init" state (the lesson's starting patch); a main volume with a meter;
Shift for fine knob moves; reset on double-click.

| Feature | What it does | Page(s) | Status | Size |
|---|---|---|---|---|
| Saving and loading presets | Keep a sound and bring it back | 21, 324 | Missing in the practice synth | Medium |
| Init Preset | Reset everything | 20, 324 | Partly: each lesson has a start state; no button | Small |
| Init LFOs + LFO Mods; Init Modulations | Reset only the LFOs, or only the connections | 324 | Missing | Small |
| Revert to Saved | Throw away changes since the last save | 324 | Missing | Small |
| Save as Default Preset | Choose what a new instance starts with | 324 | Missing | Small |
| ARTIST and DESC fields | Notes saved with a preset | 21 | Missing | Small |
| Preset menu with < > arrows | Step through presets | 18 | Missing | Small |
| Presets browser: folders, list, search by name | Find presets | 327-329 | Missing | Medium |
| CATEGORIES and TAGS | Filter by kind of sound | 330, 332-333 | Missing | Medium |
| Ratings (one to five stars) | Mark and filter favourites | 330, 333 | Missing | Small |
| Preset metadata pane | Artist, category, description, comments, date, tags | 331 | Missing | Small |
| Previews, Auto-Play Previews, Preview Fallback Clip | Hear a preset before loading it | 19, 328, 335 | Partly: lessons have "hear it first" demos | Small |
| Macros usable while previewing | Turn a preset's macros during preview | 329 | Missing | Small |
| Load Random Preset | A random preset | 334 | Missing | Small |
| Hybridize / Hybridize Favoring Selected Preset | A new sound mixed from four presets | 334 | Missing | Medium |
| Delete, Rename/Move, Show in Finder | File management | 335-336 | Missing | Small |
| Rescan Database / Erase and Rebuild Database | Refresh the preset list | 335 | Missing | - |
| Import Preset Pack; Create and Export Pack | Bundles of presets with name, author, artwork | 324, 337-339 | Missing | Medium |
| Reading `.SerumPreset` into the practice synth | Loading a real Serum preset | 21 | Missing (the app decodes presets for lessons, but the synth cannot play them) | Large |
| Undo and Redo | Step back and forward through changes | 27 | Missing | Medium |
| Reset Control (Cmd/Ctrl-click) | Reset one knob | 26 | Have it (double-click) | - |
| Type an exact value | Double-click a knob and type a number | 25 | Missing | Small |
| Lock Parameter | A knob keeps its value when presets change | 26 | Missing | Small |
| Drag audio to a DAW / Renders folder | Exports the last note or chord as a WAV file | 22-23 | Missing | Medium |
| Resizing the window | Scale the whole interface | 36 | Partly: the page scales with the browser | - |
| Main menu: About, Read the manual, Check for updates, Open presets folder, Rescan Folders | Housekeeping | 324 | Missing (not relevant) | - |
| Keyboard shortcuts for presets, modules, LFOs, clips, wavetable editor | Speed keys | 349-353 | Missing | Small |
| Serum FX version | Serum's effects as a plug-in for other audio | 324 | Missing (not relevant) | - |

---

## Suggested order

Ranked by how much each gap would add to *learning sound design on this synth* compared with the work.

1. **Done 14 Nov 2026, except CURVE and SCALED.** **Mono, legato and portamento (PORTA, CURVE, ALWAYS, SCALED).** Glide and "one note at a time" are basic
   to basses and leads and already appear in the rebuilt-patch lessons ("glide" is a detected combination);
   medium work, no new audio parts.
2. **Mod wheel, pitch bend and MIDI keyboard input.** Small work with the browser's MIDI support, and it
   makes every existing lesson playable from real keys; the wheel is also Serum's most used performance
   source.
3. **AUX SOURCE in the matrix (with INV), then "Create Vibrato".** "One source sets how much another
   does" is a central idea (wheel-controlled vibrato) that we can only half-show with "LFO moves LFO amount".
4. **Osc B as a full oscillator (wavetable, unison, warp) and PAN on every source.** Two equal oscillators
   are needed for most real patches; pan is small and opens stereo lessons.
5. **Filter 2 and routing (A/B/Sub/Noise switches, Filter/Main/Direct).** Lets lessons show "sub goes
   round the filter", series against parallel filters, and split sounds; medium work.
6. **More filter types: 6 and 18 dB, Peak, comb/flanger/phaser family, Formant, and FAT.** A few
   well-chosen types teach far more than the full list; combs and formants sound unlike anything we have.
7. **More warp modes: Bend +/-, PWM, Asym, Flip, Odd/Even, Quantize, the folds, plus AM and PD and a
   second warp slot.** Each is a small maths rule in the place warp already lives, and each makes one clear
   lesson.
8. **Envelope curves per stage, ENV 3 and 4, and LFO ENVELOPE mode with DELAY, SMOOTH and PHASE.** Small
   items that remove the most common "Serum has this knob and we do not" moments in the envelope and LFO
   chapters.
9. **Freely drawn LFO shapes (points and curves), S&H and DIRECTION.** The drawn LFO is how most modern
   Serum movement is made; sixteen flat steps cannot make a smooth custom curve.
10. **Reorderable effects, plus Flanger, Phaser, Utility and the missing delay and reverb controls
    (PING-PONG, delay filter, PRE-DLY, LO CUT / HI CUT, DAMP).** Order of effects is a lesson in itself;
    the added modules are small.
11. **A simple arpeggiator (SHAPE, RATE, GATE, LATCH, octave RANGE).** Medium work on top of the existing
    tempo clock, and a big step toward the planned mini DAW; the full pattern editor can wait.
12. **Sub waveforms, sub PHASE and routing; Brown noise, noise FILTER and STEREO.** Very small additions
    that finish two modules.
13. **Sample playback (one-shot and loop) in the noise slot, then a Sample oscillator.** Needed for the
    planned impact lessons (attack clicks, layered hits) and the first step toward Granular and Spectral.
14. **A small wavetable editor: harmonic bars, a few drawing tools, Morph, and the formula `q` idea.**
    Teaches what a wavetable *is* better than any amount of reading; large, so do the harmonic-bar part
    first.
15. **Granular, Spectral, Multisample, the clip piano roll, multiband compression and the splitters.**
    Each is a large project of its own. Granular is the most rewarding for sound design; the clip player is
    best folded into the mini DAW rather than built twice.

## Things in the manual that could not be pinned down

- **LFO TYPE "Path"** is listed (page 191) but not explained anywhere in the text.
- **Chaos: Lorenz, Chaos: Rossler and S&H** are listed without their controls being described.
- **Distortion types:** the manual says there are thirteen (page 167) but the text names only Tube,
  Downsample, X-Shaper and X-Shaper (Asym). The full list is in a menu picture, not in the text.
- **Scale list and arpeggiator SHAPE list:** described as long menus (pages 248, 268) but not written out.
- **Voice Control (pages 316-317):** the text says "SEQ controls" and "per voice settings" without naming
  which settings the sequence holds; Voice Index and Voice Mod 1/2 in the matrix are its outputs.
- **Clip MODE and Voice Steal Priority tables (pages 234, 217):** the extracted text has descriptions that
  look shifted against their names (for example "Rand.Start" and "Rand.End"), so the table above names the
  options without relying on those descriptions.
- **Sub oscillator "Pulse" (page 126):** the description is cut short.
- **Unison level compensation and which FM type ours matches:** these need a check in our engine, not in
  the manual.
- **Pages 3-12** (contents) are not in the library file by design. Drawn menus and screenshots were not
  read for this list; anything that appears only in a picture may be missing here.
