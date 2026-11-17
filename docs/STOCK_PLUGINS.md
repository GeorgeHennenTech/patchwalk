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

## To build, in this order (basics first, then colour, then time, then the unusual ones)
- [ ] 2. **Three-band EQ** (EQ Three): low, mid, high with two crossover points and a kill per band
- [ ] 3. **Eight-band EQ** (EQ Eight): eight bands, each bell / shelf / cut, with the curve drawn
- [ ] 4. **Compressor** (Compressor): threshold, ratio, attack, release, knee, make-up, meter; later a
  sidechain from another track
- [ ] 5. **Glue compressor** (Glue Compressor): a slower bus-style compressor with fixed choices
- [ ] 6. **Limiter** (Limiter): a ceiling the sound cannot pass
- [ ] 7. **Gate** (Gate): silence below a threshold, with attack, hold, release
- [ ] 8. **Saturator** (Saturator): soft clipping with a choice of curves, drive, output
- [ ] 9. **Overdrive** (Overdrive): a band-passed drive with tone
- [ ] 10. **Bit and rate crusher** (Redux)
- [ ] 11. **Erosion** (Erosion): a short delay shaken by noise or a sine
- [ ] 12. **Auto filter** (Auto Filter): a filter moved by its own LFO and by the sound's level
- [ ] 13. **Auto pan** (Auto Pan): level moved left and right by an LFO; also tremolo
- [ ] 14. **Chorus** (Chorus-Ensemble)
- [ ] 15. **Phaser and flanger** (Phaser-Flanger)
- [ ] 16. **Delay** (Delay): left and right times in beats or ms, feedback, filter, ping-pong
- [ ] 17. **Echo** (Echo): a delay with its own modulation, filter, drive and ducking
- [ ] 18. **Filter delay** (Filter Delay): three filtered delays
- [ ] 19. **Reverb** (Reverb): size, decay, pre-delay, damping, mix
- [ ] 20. **Drum bus** (Drum Buss): drive, crunch, transient shaping and a low boom, for a drum track
- [ ] 21. **Multiband dynamics** (Multiband Dynamics): three bands, each compressed or expanded
- [ ] 22. **Beat repeat** (Beat Repeat): catches a slice and repeats it on the grid
- [ ] 23. **Grain delay** (Grain Delay)
- [ ] 24. **Shifter** (Shifter, Frequency Shifter): pitch or frequency shift
- [ ] 25. **Resonators** (Resonators): five tuned comb filters
- [ ] 26. **Amp, cabinet and pedal** (Amp, Cabinet, Pedal, Dynamic Tube): guitar-style drive and speaker colour
- [ ] 27. **Vinyl distortion** (Vinyl Distortion)
- [ ] 28. **Spectrum and tuner** (Spectrum, Tuner): devices that only show, not change, the sound
- [ ] 29. **Channel EQ** (Channel EQ): a quick three-knob EQ
- [ ] 30. **MIDI effects** (Arpeggiator, Chord, Note Length, Pitch, Random, Scale, Velocity): these change
  notes before the instrument, so they need a second kind of slot in front of it

## Hard, or needs something the browser's ready-made parts cannot do (an AudioWorklet); last
- [ ] Corpus (a modelled resonating body), Vocoder, Hybrid Reverb, Spectral Resonator, Spectral Time, Looper

## Not possible here
- External Audio Effect (sends sound out to hardware and back)

## Already in the practice synth (inside each synth track, before the chain)
Distortion, three-band EQ, compressor, chorus, flanger, phaser, delay, reverb (`src/synth/fx.ts`). Their
maths can be reused for items 2, 4, 8, 14, 15, 16 and 19, which makes those quick.
