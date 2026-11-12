# Coverage check against Syntorial

The owner owns Syntorial and supplied its lesson titles (three levels, 33 lesson groups, about 219 items).
Only the titles were used, as a topic checklist. No lesson text, video or exercise was read or copied, and our
lessons are written from scratch. The pasted list was cut off at the end and abbreviated in three places
(groups 15, 18 and 21), so a few titles may be missing.

Lesson ids refer to `docs/COURSE_PLAN.md` (C chapters) and `docs/CURRICULUM.md` (other tracks).

| # | Their topic | Covered by | Status |
|---|---|---|---|
| 1 | Saw and pulse waveforms | C1.1 | Covered |
| 1 | Pulse width | C1.9 | **Added** |
| 1 | Wavetables in Serum | C1.3 | Covered |
| 2 | Low-pass filter, cutoff, main volume | C2.1, C0.3 | Covered |
| 3 | Amp envelope attack and release | C3.1 | Covered |
| 4 | Doubling and transposing | C1.4, C1.2 | Covered |
| 5 | Filter envelope attack and release | C3.4 | Covered |
| 6 | Delay time, feedback, spread | C7.5, F4.1, F4.2 | Covered |
| 7 | Amp envelope sustain and decay | C3.1, C3.2 | Covered |
| 8 | Doubling and detuning | C1.5 | Covered |
| 9 | Filter envelope decay and sustain | C3.4 | Covered |
| 10 | Sub oscillator | C1.7 | Covered |
| 11 | LFO destination, amount, waveform, rate | C4.1, C4.2, C4.3 | Covered |
| 12 | Filter resonance, with envelope and with LFO | C2.2, C3.4, C4.2 | Covered |
| 13 | Mono and poly voice modes | C8.1 | Covered |
| 13 | Poly mode and amp release | C8.1 | **Widened** |
| 14 | Unison, detune, spread | C1.6 | Covered |
| 14 | Unison with multiple oscillators | C1.6, checkpoint 1.C | Covered |
| 15 | Reverb size and mix | C7.6, F4.4, F4.5 | Covered |
| 16 | Legato and portamento | C8.1, C8.2 | Covered |
| 17 | Triangle waveform, mixing it, with cutoff | C1.1, C1.4 | Covered |
| 18 | Chorus | C7.4, F5.1 | Covered |
| 18 | Types of pulsation | C7.8 | **Added** |
| 19 | Mod envelope on pitch | C3.5 | Covered |
| 20 | Oscillator sync, with envelope and LFO | C6.2 | Covered |
| 21 | High-pass, band-pass, all filter types | C2.3 | Covered |
| 22 | FM amount and tuning, with envelope | C6.4, D1 | Covered |
| 23 | Layering noise | C1.7 | Covered |
| 24 | Filter envelope on high-pass and band-pass | C3.6 | **Added** |
| 25 | Distortion, with oscillators and filter envelope | C7.1, F3 | Covered |
| 26 | Ring mod | C6.5 | **Added** |
| 27 | Phaser mix and feedback | F5.3 | Covered (in track F, not C) |
| 28 | LFO trigger | C4.5 | Covered |
| 28 | LFO in poly mode | C4.5 | **Widened** |
| 29 | Mod wheel to cutoff, resonance, LFO amount and rate | C5.5 | Covered |
| 30 | Key tracking, with filter type | C2.6 | Covered |
| 30 | Self-oscillation | C2.7 | **Added** |
| 31 | Velocity to volume, cutoff, filter envelope | C5.3 | Covered |
| 32 | Pitch bend range | C8.4 | **Added** |
| 33 | Final challenges | E9.1, P1, P2 | Covered |
| 33 | Custom wavetables in Serum | D7.1 to D7.3 | Covered |
| 33 | Serum filter, oscillator, noise and modulation extras | Track S (`docs/SERUM_EXTRAS.md`): S2, S3, S4, S5 | **Planned** |
| all | Quizzes | Ear check in every lesson | Covered |
| all | Cumulative "group" challenges | Checkpoint at the end of chapters 0 to 8 | **Added** |

## What changed in our plan
- Six lessons added: pulse width, self-oscillation, envelopes on high-pass and band-pass filters, ring
  modulation, kinds of pulsation compared, pitch bend.
- Two lessons widened: poly mode with long releases; one LFO for all notes versus one per note.
- Nine checkpoints added, one per chapter: a cumulative recreate-by-ear challenge.
- Track C goes from 49 to 64 lessons.

## Still open
- **Serum-specific extras.** Now planned as track S in `docs/SERUM_EXTRAS.md` (50 lessons), from the Serum 2
  User Guide.
- **Ordering.** Their order interleaves subjects (delay and the sub oscillator arrive early) instead of
  finishing one module before the next. Our lessons can be taken in any order, so a second suggested path that
  interleaves in the same spirit can be offered beside the chapter-by-chapter one.
