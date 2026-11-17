# Stock plugins for the Studio

The owner asked (17 Nov 2026) to build "all of the stock plugins that we planned on implementing", one by
one. This is the list and its order. The reference is the list of devices in the Ableton Live 11 manual
(library, "Live Audio Effect Reference" and "Live MIDI Effect Reference"), because the planned
processing-chain lessons end in "the same chain with Ableton's stock devices".

**What these are.** Each is our own device that does the same job, built in the browser from what that kind
of effect does. None is a copy of Ableton's code, sound or look, and none will sound identical to Ableton's.
Each carries `like`: the Ableton device that does the same job. Where a number is our own choice, the device
or its lesson must say so. Each is measured where it can be; nobody has judged any by ear until the owner does.

**How they work here.** Every track has a chain of up to eight devices after its instrument
(`track.devices`; `src/daw/devices.ts` is the settings and maths, `src/daw/fxnodes.ts` the audio,
`src/ui/studio/DeviceChain.tsx` the row of devices in the Device view, and "Effects" in the browser adds
one). A device can be switched off, moved earlier or later, and removed. To add a device: a `DeviceSpec` in
`DEVICES`, its maths as a pure function beside `utilityMatrix`, a `Core` in `fxnodes.ts`, a test of the
maths, and a measurement in a browser (`transport.levels()` reads the left and right level of the output).

## Done
- [x] The chain itself: devices on every track, in order, switchable, saved with the song (17 Nov 2026)
- [x] 1. **Utility** (like Utility): gain, pan as a balance, width, mono, flip left or right, mute.
  Measured: +6 and -12 dB gave 6.0 and -11.9 dB; hard left silenced the right; flip-left with mono
  cancelled a centred sound; switched off, a +12 dB setting changed nothing.

- [x] 2. **Three-band EQ** (EQ Three), 3. **Eight-band EQ** (EQ Eight), 29. **Channel EQ** (Channel EQ) (17 Nov 2026).
  Each draws its curve from the maths the sound is made with. Measured at eight frequencies, several
  settings each: the sound matched the drawn curve to 0.00 dB, and all three change nothing at their
  starting settings. The three-band split is two Butterworth filters in a row each way (24 dB an octave).
- [x] 4. **Compressor** (Compressor): threshold, ratio, attack, release, make-up, dry/wet. Built on the
  browser's compressor with its hidden make-up cancelled. Measured on a steady tone 20 dB over the
  threshold at 4:1: out 0.5 dB above the maths; at 20:1, 0.9 dB above (the browser's curve is not quite a
  sharp corner). Dry/wet at 50% with ratio 1 was flat at 100 Hz, 3 kHz and 9 kHz (the dry sound is held
  back 6 ms to line up). **Not built: knee, a reduction meter, sidechain from another track.**
- [x] 8. **Saturator** (Saturator): four curves of our own (Soft, Hard, Fold, Uneven), drive, output,
  dry/wet. Measured: harmonics 1 to 5 within 0.1 dB of the curve applied directly; Uneven adds even
  harmonics, the others none. No oversampling (the browser's adds a delay that would comb with the dry sound).
- [x] 9. **Overdrive** (Overdrive): a band, drive, tone, dry/wet. A general design, numbers our own.
  Measured only that drive adds harmonics and tone removes them.
- [x] 13. **Auto pan** (Auto Pan): amount, sine/triangle/square, speed in Hz or beats, how far the right
  side runs behind (0 degrees is a tremolo). Measured: both sides' gain within 0.005 of the maths (0.014
  on the square's edges); "1/4" at 120 bpm turned twice a second. A speed in beats does not start on the bar line.
- [x] 14. **Chorus** (Chorus-Ensemble): two copies whose delay drifts opposite ways, one each side;
  speed, amount, delay, feedback, width, dry/wet. Measured only: stable at full feedback, sides differ, mix 0 is untouched.
- [x] 16. **Delay** (Delay): left and right times in beats or ms, feedback, a band-pass on the echoes,
  ping-pong, dry/wet. Measured with one click: every echo on the exact sample and level the maths gives
  (0.375, 0.750, 1.125 s at 1, 0.5, 0.25), ping-pong alternating sides; the filter two octaves wide was
  8.7 dB down two octaves either side. A browser loop is one block (128 samples)
  late; the delays are shortened to cancel it (where the block falls in ping-pong was measured in Chrome only).
- [x] 19. **Reverb** (Reverb): decay, pre-delay, low cut, high cut, dry/wet. Fading noise through the
  browser's convolver. Measured: the tail fell 29.7 and 30.0 dB over half the decay time (30 expected);
  a 100 ms pre-delay gave first sound at 100.0 ms. No early reflections; character not tuned by ear.

Settings can now be menus, sliders that move in ratios (`log`), groups shown one at a time (`group`), and
shown only when they apply (`when`); a device can carry a `note` (what the page must admit) and a curve
(`CURVES`). The audio is told the song's tempo. A device's first settings are put in place at once; later
changes glide. Each was measured by building it on an `OfflineAudioContext` in a browser
(`buildDevice(ctx, device, bpm)`), which is the quickest way to measure the next ones.

## To build, in this order
- [ ] 5. **Glue compressor** (Glue Compressor): a slower bus-style compressor with fixed choices
- [ ] 6. **Limiter** (Limiter): a ceiling the sound cannot pass
- [ ] 7. **Gate** (Gate): silence below a threshold, with attack, hold, release
- [ ] 10. **Bit and rate crusher** (Redux)
- [ ] 11. **Erosion** (Erosion): a short delay shaken by noise or a sine
- [ ] 12. **Auto filter** (Auto Filter): a filter moved by its own LFO and by the sound's level
- [ ] 15. **Phaser and flanger** (Phaser-Flanger)
- [ ] 17. **Echo** (Echo): a delay with its own modulation, filter, drive and ducking
- [ ] 18. **Filter delay** (Filter Delay): three filtered delays
- [ ] 20. **Drum bus** (Drum Buss): drive, crunch, transient shaping and a low boom, for a drum track
- [ ] 21. **Multiband dynamics** (Multiband Dynamics): three bands, each compressed or expanded
- [ ] 22. **Beat repeat** (Beat Repeat): catches a slice and repeats it on the grid
- [ ] 23. **Grain delay** (Grain Delay)
- [ ] 24. **Shifter** (Shifter, Frequency Shifter): pitch or frequency shift
- [ ] 25. **Resonators** (Resonators): five tuned comb filters
- [ ] 26. **Amp, cabinet and pedal** (Amp, Cabinet, Pedal, Dynamic Tube): guitar-style drive and speaker colour
- [ ] 27. **Vinyl distortion** (Vinyl Distortion)
- [ ] 28. **Spectrum and tuner** (Spectrum, Tuner): devices that only show, not change, the sound
- [ ] 30. **MIDI effects** (Arpeggiator, Chord, Note Length, Pitch, Random, Scale, Velocity): these change
  notes before the instrument, so they need a second kind of slot in front of it

## Hard, or needs something the browser's ready-made parts cannot do (an AudioWorklet); last
- [ ] Corpus (a modelled resonating body), Vocoder, Hybrid Reverb, Spectral Resonator, Spectral Time, Looper

## Not possible here
- External Audio Effect (sends sound out to hardware and back)

## Already in the practice synth (inside each synth track, before the chain)
Distortion, three-band EQ, compressor, chorus, flanger, phaser, delay, reverb (`src/synth/fx.ts`). The Studio's devices are separate from these.

## Next
5 Glue compressor, 6 Limiter, 7 Gate and 10 the crusher need exact sample-by-sample control, which means the
browser's lower-level audio code (an AudioWorklet): build that base once, then those four (and a compressor
with a knee, meter and sidechain) sit on it. 12 Auto filter, 15 Phaser and flanger, 17 Echo, 18 Filter
delay, 20 Drum bus and 25 Resonators can be made from ready-made parts like this batch.
