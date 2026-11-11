# Probe presets

Nothing in the display-value table is verified yet (rule 7). Each probe below is **Init with one change**,
saved from Serum 2. For each one, save the preset into `fixtures/probes/` under the file name given and note
the value **Serum shows on screen** next to it (in `fixtures/probes/READINGS.md`, one line per file).
With the file and the reading, the conversion can be fixed if wrong and marked `verified` with
`confirmedBy` pointing at the probe.

Where two points are needed to pin down a curve, two probes are listed.

## Structure (highest value: these change what the lesson says)

| File | Change from Init | What it settles |
|---|---|---|
| `osc-a-off.SerumPreset` | Switch Osc A off | How "off" is stored for a module that is on by default |
| `osc-b-on.SerumPreset` | Switch Osc B on | Enable flag; Osc B's routing default |
| `filter-on.SerumPreset` | Switch Filter 1 on | Enable flag; default filter type and cutoff |
| `mod-lfo1-cutoff.SerumPreset` | Filter on, LFO 1 → Filter 1 cutoff, amount left as created | Source id for LFO 1; default route amount |
| `mod-env2-cutoff.SerumPreset` | Filter on, Env 2 → Filter 1 cutoff | Source id for Env 2 |
| `mod-env1-wtpos.SerumPreset` | Env 1 → Osc A WT position | Source id for Env 1 |
| `mod-velocity-cutoff.SerumPreset` | Filter on, Velocity → cutoff | Source id for velocity (unknown today) |
| `mod-note-cutoff.SerumPreset` | Filter on, Note/Keytrack → cutoff | Another unknown source id |
| `mod-macro1-cutoff.SerumPreset` | Filter on, Macro 1 → cutoff | Source id for Macro 1 |
| `fx-order.SerumPreset` | Add Reverb, then Delay, then drag Delay above Reverb | Whether file order = rack order |
| `fx-bypassed.SerumPreset` | Add Reverb and bypass it | How a bypassed effect is stored |
| `osc-a-direct.SerumPreset` | Filter on, route Osc A straight to output (not through filter) | Which routing slot belongs to which oscillator |
| `osc-a-sample.SerumPreset` | Change Osc A's type from wavetable to sample | How the oscillator type is stored |
| `sample-embedded.SerumPreset` | Load a short user sample into Osc A | Embedded audio format and size |
| `wt-user.SerumPreset` | Draw a one-frame wavetable in Osc A | Embedded wavetable layout (frames, samples per frame) |

## Display conversions

| File | Change from Init | Reading to note | Entry it confirms |
|---|---|---|---|
| `osc-level-50.SerumPreset` | Osc A level to 50% | on-screen level | `Oscillator.kParamVolume` (currently sqrt guess) |
| `osc-level-25.SerumPreset` | Osc A level to 25% | on-screen level | same, second point |
| `osc-pan-left.SerumPreset` | Osc A pan fully left | on-screen pan | `Oscillator.kParamPan` |
| `osc-oct-semi-fine.SerumPreset` | Osc A: oct +1, semi +7, fine +25 | all three | `kParamOctave`, `kParamPitch`, `kParamFine` |
| `osc-wtpos-64.SerumPreset` | Osc A WT position to frame 64 | position shown | `WTOsc.kParamTablePos` |
| `osc-wtpos-max.SerumPreset` | Osc A WT position to the last frame | position shown | same, second point |
| `unison-7.SerumPreset` | Osc A unison to 7 voices | voices, detune, blend shown | `kParamUnison` + unison defaults |
| `unison-detune-50.SerumPreset` | Unison 7, detune to 0.50 | detune shown | `kParamDetune` |
| `unison-blend-stereo.SerumPreset` | Unison 7, blend 25, stereo 50 | both | `kParamUnisonBlend`, `kParamUnisonStereo` |
| `warp-each-mode.SerumPreset` | Osc A warp set to "Bend +" amount 50% | menu name and amount | `kParamWarpMenu` names, `kParamWarp` scale |
| `filter-types.md` | (list, no preset) | For each filter type name in the menu, the stored token from a saved preset | `VoiceFilter.kParamType` names |
| `filter-cutoff-100hz.SerumPreset` | Filter on, cutoff 100 Hz | Hz shown | `VoiceFilter.kParamFreq` |
| `filter-cutoff-1khz.SerumPreset` | Filter on, cutoff 1000 Hz | Hz shown | same, second point |
| `filter-cutoff-10khz.SerumPreset` | Filter on, cutoff 10 kHz | Hz shown | same, third point (curve shape) |
| `filter-res-drive.SerumPreset` | Filter on, res 50%, drive 50% | both | `kParamReso`, `kParamDrive` |
| `env1-adsr.SerumPreset` | Env 1: A 100 ms, D 500 ms, S -6 dB (or 50%), R 1 s | all four exactly as shown | `Env.kParamAttack/Decay/Sustain/Release` |
| `env1-hold.SerumPreset` | Env 1 hold to 100 ms | hold shown | `Env.kParamHold` |
| `env1-curves.SerumPreset` | Drag Env 1's attack curve fully one way | any curve reading | `Env.kParamCurve1` |
| `lfo1-rate-free.SerumPreset` | LFO 1 BPM sync off, rate 2 Hz | rate shown | `LFO.kParamRate` (free) |
| `lfo1-rate-sync.SerumPreset` | LFO 1 BPM sync on, rate 1/4 | rate shown | `LFO.kParamRate` (synced) |
| `lfo1-rate-sync-8.SerumPreset` | LFO 1 BPM sync on, rate 1/8 | rate shown | same, second point |
| `lfo1-rise-delay.SerumPreset` | LFO 1 rise 1 s, delay 0.5 s | both | `kParamRise`, `kParamDelay` |
| `lfo1-modes.md` | (list) | Stored token for each trigger mode and LFO type | `kParamMode`, `kParamType` |
| `global-master.SerumPreset` | Master volume to -6 dB (or 50%) | reading shown | `Global.kParamMasterVolume` |
| `global-porta.SerumPreset` | Mono + legato on, portamento 100 ms | time shown | `kParamPortamentoTime` |
| `global-bend.SerumPreset` | Pitch bend range +12 / -12 | both | `kParamBendRangeUp/Dn` |
| `macro-50.SerumPreset` | Macro 1 to 50% | value shown | `Macro.kParamValue` |
| `mod-amount-50.SerumPreset` | Filter on, LFO 1 → cutoff at 50, bipolar on | amount shown | `ModSlot.kParamAmount`, `kParamBipolar` |

## What is not covered yet
FX parameters. Every effect's settings are shown exactly as stored, with the stored name re-spaced. When you
want a particular effect explained properly, make three probes for it (one knob each at a known reading) and
its entries can be added the same way.
