# Lesson ideas from the literature (20 Nov 2026)

The owner asked (20 Nov 2026) for every text uploaded that day to be read in full and for a lesson to be
proposed for each concept that is useful and not a repeat. Eight readers each read a group of texts from
start to finish against the list of lessons that already exist. This file is their findings, condensed.

How to read an entry: **title** (pages in the source), what the learner does and the idea it teaches, then
in brackets where it is done, what has to be built first ("ready" means nothing), and how much it is worth.
Page numbers are the library's. "Ours" marks a bridge to practice that the text does not itself make.
Nothing here is built. Rules that hold for every lesson written from this list: say only what the text says,
cite the page, never claim what sound does to a listener beyond what a study measured, never attribute a
technique to an artist, and mark a maker's claims as the maker's.

Counts are at the end, with the things worth building and a suggested order.

---

## A. Puckette, *The Theory and Technique of Electronic Music*, chapters 1 to 4

### Chapter 1: sinusoids, amplitude and frequency
1. **Peak and average level are different things** (pp. 3-4). A square, a sine and a spiky pulse at the same peak show different average (RMS) bars. Level has no single definition; RMS never exceeds peak. [Synth; meter showing peak and RMS together; high]
2. **Decibels count ratios, not amounts** (pp. 4-5). Volume in 6 dB steps doubles or halves the wave on the scope; 20 dB is ten times; doubling power is 3 dB. [Synth and formula graph; ready; high]
3. **Same meter reading, not the same loudness** (pp. 5-6). A low sine and a bright saw matched in RMS do not sound equally loud. Amplitude and loudness are only loosely tied. [Synth; ready; the choice of sounds is ours; medium]
4. **Why an instant level change clicks** (pp. 8-10, 21-22). Switch a sine on with ramps of 0, 5, 15, 30 ms, then noise, which needs none. A sine is the least forgiving sound, so test fades on it. [Synth; ready; high]
5. **Semitones are equal multiplications** (pp. 6-7). Each key multiplies Hz by about 1.059, so gaps in Hz grow going up. [Synth and graph; a Hz readout; medium]
6. **Cents, and the smallest pitch change you notice** (p. 7). Pairs of tones 50 down to 1 cent apart; the text's rule of thumb is about three cents. [Listening test; a two-tone test; medium]
7. **Adding two sounds: +6, +3, or nothing** (pp. 10-11). Identical in phase adds 6 dB, unrelated adds 3 dB, opposite cancels. Explains layering and unison levels (that link is ours). [Synth; ready; high]
8. **The harmonics of a note are nearly notes of the scale** (p. 12). Step through harmonics 1 to 8 against the nearest key: octave, fifth, two octaves, a third 14 cents flat. Why 3:2 is a fifth and 5:4 a third. [Synth; a harmonic picker; high]
9. **Several sines fuse into one note** (pp. 12-15, 23-24). Switch in harmonics 2, 3, 4 and hear one richer tone, not a chord; detune one and it separates (the detune step is ours). [Synth; additive panel of 8 to 16 harmonic sliders; high]
10. **A pure major chord: 4 to 5 to 6** (pp. 12, 22). Three sines at exact ratios against keyboard tuning, where the third is 14 cents off and beats. [Synth; exact-ratio voices; medium]
11. **A chord where every note beats at its own speed** (pp. 24-25). Three notes each as a pair of sines a fraction of a hertz apart. [Synth; detune in Hz; low, close to an existing lesson]

### Chapter 2: wavetables and samplers
12. **A wavetable is a stored list read by a moving pointer** (pp. 27-31). Watch a pointer sweep a stored cycle; change its speed, reverse it, stop it. [New mini-model "table and pointer"; high]
13. **The position knob is a crossfade, and phases matter** (pp. 29-31). Sweep between frames with matched phases (smooth) and unmatched (a hollow dip halfway). [Synth; one wavetable with deliberately mismatched phases; medium]
14. **Play harder, get a different wave** (p. 31). Velocity to wavetable position. [Synth; ready; medium]
15. **A sampler and an oscillator are the same machine** (pp. 32-34). Loop a short recording and raise the repeat rate through 20 to 40 a second until repeats become a pitch. [Studio sampler; a loop-rate control; high]
16. **Speed and pitch go together** (pp. 32-33). Double speed is an octave up and half as long; backwards keeps the pitch. [Studio sampler; a reverse switch; high]
17. **The chipmunk effect** (pp. 33-34). A spoken word an octave up has a smaller "mouth": transposing a recording moves its strong regions with the pitch. [Sampler and synth; a spoken-word file; high]
18. **About thirty a second: where counting ends** (pp. 32, 34). Speed a click train from 4 to 60 a second. [Listening test; a click train; medium]
19. **Loop a tiny piece, then move it** (pp. 34-36, 52). Granular synthesis from three controls: repeat rate, segment size, location. [New Studio instrument, a grain looper; high]
20. **Take the thump out of a loop** (pp. 36-38, 52). A rise-and-fall shape on each pass removes the seam's click. [Grain looper; a per-pass window; high]
21. **Two overlapping loops make an unbroken sound** (pp. 37, 54-56). A second copy half a cycle later fills the gaps. [Grain looper; overlap switch; medium]
22. **Slow a sound down without lowering it** (pp. 56-57). Let the read point creep at its own rate: half speed, frozen, backwards, pitch unchanged. [Grain looper; a travel-speed control; high]
23. **Scratching: your hand's speed is the pitch** (pp. 33, 50-54). Drag a read point along a waveform; unsmoothed it turns to grit. [New mini-model; medium]
24. **Squeeze the wave, stretch the spectrum** (pp. 37-43, 48-50). Packing the cycle into half the time moves the whole harmonic pattern twice as far up. Gives the existing Squeeze lesson its reason. [Synth; a contour line on the spectrum; medium]
25. **A table too small: where the grit comes from** (pp. 43-46). A sine stored in 4 to 128 points with three ways of reading between them. [New mini-model; medium]

### Chapter 3: audio and control computations
26. **Foldover: a note too high comes back down** (pp. 59-61, 78). A rising sine at a low sample rate bounces off the ceiling on the spectrogram. [New mini-model; high]
27. **Why a raw digital saw sounds dirty up high** (pp. 60-61, 78-80). Extra tones that are not harmonics and move the wrong way when the pitch bends. [Synth; a "raw ramp" shape; medium]
28. **Zipper noise: a knob moved in steps** (pp. 64-66, 80). A level updated 50 times a second buzzes; a ramp is clean. Our own slow modulation path steps at the same rate (ours). [Synth; ready; medium]
29. **Tight timing needs sample accuracy** (pp. 62, 66-67, 80-82). A sound repeated 100 times a second with exact and with rounded timing. [Listening test; low]
30. **A gate that does not chatter** (pp. 69-71). Two thresholds, or a hold time, stop a gate stuttering on a wobbly sound. [Studio Gate; check it has both; high]
31. **Following a sound's level** (pp. 69, 82-83). A level follower drawn as a line; a short window is fast and jittery, a long one slow and steady. [Studio auto filter; a picture of the follower; medium]
32. **Sample and hold** (pp. 54, 71-74, 83). Freeze a moving value on every tick and send the steps to the filter. [Synth; a sample-and-hold LFO shape; high]
33. **A sequencer built from two locked ramps** (pp. 71-72, 83-84). A drawn stepped LFO on pitch plus a faster locked LFO reshaping the level each step. [Synth; ready; medium]

### Chapter 4: automation and voice management
34. **Let go early, press again: what the envelope really does** (pp. 89-91). Short taps never reach the top; a re-press starts from the present level. [Synth; a live dot on the envelope picture; medium]
35. **A straight fade does not sound straight** (pp. 92-94, 106-107). A ten-second fade three ways: straight line, steady decibels, fourth power. [Studio automation or a model; ready; high]
36. **Pitch sweeps want a curve too** (pp. 106-107). A sweep in a straight line of Hz rushes through the bottom octaves. [New mini-model; medium]
37. **What may jump, and what must slide** (pp. 94-95). A square LFO on pitch is clean; on level it clicks. [Synth; ready; high]
38. **Cutting one sound off for the next, cleanly** (pp. 81-82, 94-98). Hard cut, 5 ms ramp, and "switch and ramp". [Studio drum rack; a choke mode per pad; medium]
39. **Should the envelope start again or carry on?** (p. 94). [Synth; a restart switch on Envelope 2; low]
40. **Voices: how many notes at once, and who gets cut** (pp. 98-100). A limit of two voices and a display of the oldest being stolen. [Synth; voice limit and display; medium]
41. **A bell from eleven sines** (pp. 107-110). Solo and mute partials: inharmonic ratios, unequal decay times, two beating pairs. The eleven sets of values are printed in figure 4.16. [New additive instrument; high]
42. **A fixed tone shape that notes move under** (pp. 110-111). Draw level against frequency; the "vowel" stays while the pitch moves. The opposite of the chipmunk effect. [Additive instrument; high]
43. **The tone that rises forever** (pp. 110-111). Sines sliding up under a hump that is silent at both edges. The text explains how it is built, not why it fools a listener. [Additive instrument; high]

## B. Puckette, chapters 8 to 10

### Chapter 8: filters
1. **No filter is a brick wall** (pp. 224-226). Passband, transition band and stopband labelled on the curve. [Synth; labels; medium]
2. **Bandwidth, centre and Q** (pp. 227, 249). Read a band's width 3 dB below its top; the same Q an octave up is wider in Hz. [Synth; a Q and bandwidth readout; high]
3. **A narrow filter rings** (pp. 246-249). One click through a band-pass becomes a ping that lasts longer as resonance rises. [Synth; a click source; high]
4. **Smoothing is low-pass filtering** (pp. 236, 252, 254). A smooth control on a stepped LFO rounds the steps and makes it lag. [Synth; a lag amount on a source; medium]
5. **The invisible offset that steals loudness** (p. 237). A lopsided distortion sits off-centre on the scope; "Remove offset" re-centres it with no change in sound. [Studio Utility; a scope in the Studio; medium]
6. **A notch is a peak turned all the way down** (pp. 227-228, 238-240). Then remove one whistle from a sound. [Studio EQ; the Peak type must cut as well as lift; medium]
7. **What is inside a parametric EQ** (p. 227). Two shelves and two or three peaks. [Studio; ready; low]
8. **A cut can exactly undo a boost** (pp. 232, 249). [Studio; measure ours first; low]
9. **Pull and push points: how a filter curve is made** (pp. 229-240). Drag a pole and a zero and watch the curve. [New mini-model; low, abstract]
10. **Low-pass, shelf and high-pass are one family** (pp. 240-242). [Mini-model; low]
11. **Moving a ringing filter fast** (pp. 245-247). [Synth; check ours misbehaves first; low]
12. **A filter that changes nothing you can see** (pp. 249-250, 261). The phaser's shifted signal alone sounds like the dry sound; the notches exist only when the two are mixed. [Synth; a "shifted only" switch; medium]
13. **The filter multiplies the spectrum** (pp. 250-251). The same filter on a saw, noise and an FM tone: pitch and roughness stay, the outline changes. [Synth; ready; medium]
14. **Louder and brighter together** (p. 250). One envelope on both level and cutoff. [Synth; ready; medium]
15. **How a machine measures loudness** (pp. 252-254, 257). A loudness line over a drum loop with a speed slider. Underlies compressors, gates and sidechain. [New mini-model; high]
16. **Hunting partials with a narrow band** (pp. 257-258). Sweep a narrow band-pass up a held note and hear each harmonic pop out; then on a ring-modulated tone. [Synth; ready; high]
17. **Shifting frequency is not shifting pitch** (pp. 254-255, 259). Adding 100 Hz to every partial breaks the harmonic pattern. [Studio; a frequency shifter device; medium]

### Chapter 9: Fourier analysis and resynthesis
18. **Build a square from sine waves** (pp. 263-265, 305, 310). Switch on harmonics 1, 3, 5, 7... at the book's strengths. [Synth; a harmonic-bar editor; high]
19. **Why a pure tone has skirts on the analyser** (pp. 269-273). [Synth; our own spectrum with a window switch; medium]
20. **Seeing bass needs a long look** (pp. 273-275). A short slice blurs a low note into one hump; about four cycles are needed to separate harmonics. [Synth views; a slice-length control; high]
21. **Draw any EQ curve** (pp. 274-276, 287-289). Including a sheer cliff no ordinary filter can make. [Studio; a spectral EQ device; medium]
22. **A gate for every band** (pp. 276-278, 290). Learn the noise floor band by band and remove only what sits below it. [Studio; a spectral gate; medium]
23. **Stamp one sound's shape onto another** (pp. 278-279, 291-292). A drum loop or speech shapes a held chord: the vocoder. [Studio; a vocoder device; high]
24. **Stretch time without changing pitch** (pp. 279-283, 292-293). Half speed at the same pitch; freeze on one instant. [Studio sampler; a stretch mode; high]
25. **Why stretched sounds go "phasey"** (pp. 283-284, 292). [Studio; a lock switch; low]
26. **Turn a recording into a wavetable** (pp. 284-286, 294). Raw frames lurch; with phases aligned they scan smoothly. [Synth; wavetable import; high]

### Chapter 10: classical waveforms
27. **Brightness lives in jumps and corners** (pp. 295-296, 302-307). A jump gives harmonics falling as one over the number; a corner as one over its square. [Synth; guide lines on the spectrum; high]
28. **From triangle to saw: sharpening one edge** (pp. 305-308). [Synth; perhaps ready with Bend; medium]
29. **Even and odd harmonics from one saw** (pp. 297-299, 313). A saw plus its half-cycle copy is a saw an octave up; minus it, a square. [Synth; an invert switch on Osc B; high]
30. **A pulse wave is two saws** (pp. 300-301, 313-314). Pulse-width modulation is two opposite saws drifting in phase. [Synth; the invert switch; high]
31. **Aliasing: notes that are not there** (p. 307). A raw digital saw played up the keyboard; a low-pass afterwards cannot remove them. [Synth; a raw saw option; high]
32. **Three ways synths avoid aliasing** (pp. 307-312, 316). [Synth; three generators; medium]
33. **An LFO shape that works as an envelope** (p. 316). A clipped triangle is a trapezoid: slow it is an envelope, fast it is a pulse wave. [Synth; ready for the slow half; medium]

## C. Dattorro, "Effect Design, Part 1: Reverberator and Other Filters"

What it holds: one plate-class reverb (pp. 2-7), then a notch, resonator and parametric band built from one
all-pass, and the Chamberlin (state-variable) filter (pp. 7-24). It has no shelving design, no DC blocker,
no "size" control, and predelay appears only as a box in a figure.

1. **A reverb is five parts in a row** (pp. 3-6). Switch each part off in turn on a snare. [Rebuilt reverb with a bypass per stage; high]
2. **Input diffusion: smearing a click** (pp. 4-5). From a click at 0 to a soft burst in the middle to a buzz near 1. [Rebuilt reverb; high]
3. **Why drums need diffusion** (p. 4). Without it the loop's recirculation is heard as a repeating echo. [Studio; high]
4. **The tank: a loop that traps sound** (p. 4). Decay is how much goes round each lap; near 1 it never dies. [Rebuilt reverb; high]
5. **Hearing the loop, and hiding it** (pp. 4-5). Decay diffusion at 0 repeats a pattern; raised, an even wash. [Rebuilt reverb; high]
6. **Damping: the highs die first** (pp. 4-5). A low-pass inside the loop acts every lap; the input filter acts once. [Rebuilt reverb and spectrogram; high]
7. **Why the tank is wobbled** (pp. 5-6). A slow wobble of two delay lengths breaks up ringing on drums and adds faint vibrato to held notes. [Rebuilt reverb; high]
8. **Stereo from a mono reverb** (pp. 5-6). Left and right are tapped from different places in one loop. [Rebuilt reverb; medium]
9. **Wet and dry** (pp. 4, 6). The reverb is all wet and meant for a return track. [Studio; ready; medium]
10. **Plate or room: how fast the echoes arrive** (p. 4). [Listening test; a room-like comparison; medium]
11. **A reverb has its own notes** (pp. 4, 7). Freeze a tail and find its peaks: the paper says it is "not colourless". [Rebuilt reverb; medium]
12. **Why a thin tail flutters** (p. 7). Two to ten fading tones at random spacings: beating becomes shimmer. [New mini-model; high]
13. **Same spectrum, different sound: the all-pass** (pp. 5, 7). A click becomes a row of echoes while the spectrum stays flat. [New mini-model; high]
14. **Reverb roughens a smooth fade** (p. 2). Dry and wet level traces side by side. [Synth; a two-take level trace; medium]
15. **Predelay: a gap before the tail** (p. 3, figure only). What it does for the listener is ours. [Rebuilt reverb; medium]
16. **Notch and peak from one trick** (pp. 9-10). A sound plus its all-pass copy cancels one frequency; minus it, keeps only that one. Explains phaser notches. [New mini-model; high]
17. **One knob from notch to boost** (pp. 10-13). What a parametric EQ band is. [Same model; medium]
18. **A cut and a boost undo each other** (pp. 12-13). [Studio; check ours; medium] (same idea as B8: teach once)
19. **How wide is a gentle EQ dip?** (pp. 7-9). [Curve view; low]
20. **A good notch leaves the rest alone** (pp. 8-9). [Studio; a prepared loop; medium]
21. **Pings: a click through a resonator** (p. 9). Pitched pings from clicks; play a tune of them. [Studio Resonators; ready; high] (pairs with B3)
22. **Where it rings and where it peaks** (p. 14). [Mini-model; low]
23. **The musician's low-pass has a bump** (p. 15). Two identical peaked filters in series fall more steeply. [Synth; ready; medium]
24. **One filter, three outputs** (p. 17). Low-pass, band-pass and high-pass at once from one circuit. [New mini-model; medium]
25. **Resonance is gain: turn the input down** (pp. 19, 23). [Synth; switch off our level trim; medium]
26. **Each bit is 6 dB of quiet** (pp. 20-24). [Studio Crusher and Spectrum; low]

## D. Karjalainen, Välimäki, Tolonen, "Plucked-String Models"

1. **A string is two waves passing through each other** (pp. 1-2). Slow-motion picture of two bumps travelling apart and flipping at the ends. [Physical model view; high]
2. **Two knobs for how a string dies** (p. 5). How long the note lasts, and how much sooner the highs die. [String model; medium]
3. **Why a delay alone plays out of tune** (p. 5). High notes land on wrong pitches without a fine-tuning filter. [String model; a bypass switch and cents readout; medium]
4. **Pluck position is a comb** (pp. 5, 7). Then the same hollow colour on any sound with a very short delay (the synth half is ours). [String model, then a comb effect; medium]
5. **The same string through a pickup** (pp. 8-9). A second comb that moves with the pickup. [String model; the pickup's cutoff would be our choice; medium]
6. **Soft pluck, sharp pluck, and why it must follow the pitch** (p. 5). [String model; medium]
7. **The body is hidden inside the pluck** (pp. 5, 9, 10, 13). A bare click against a recorded knock of an instrument body as the excitation. The most direct fix for "electronic". [String model; a body recording the owner makes or owns; high]
8. **Two strings in one: beating** (pp. 10-11). A string vibrates in two directions at slightly different pitches. [String model; high]
9. **Fast at first, then slow: the two-stage decay** (pp. 10-11). [String model; a level trace in dB; high]
10. **Strings you did not pluck** (pp. 10-13). An open string an octave up fades in on its own. [String model; coupling; high]
11. **From sample to model: what you can still change** (p. 9). [String model and sampler; medium]

## E. Bank and others, "Piano Sound Synthesis: A Research Overview"

1. **A piano in three blocks** (pp. 2-3). Hammer, string, soundboard. [Diagram, later a model; medium]
2. **Felt that hardens: why loud is brighter** (p. 3). Force rises faster than squeeze, so a hard hit meets a stiffer hammer. [Formula graph; ready for the graph; high]
3. **A different hammer for every part of the keyboard** (p. 3, table 1). Real values for three notes. [Formula graph; ready; medium]
4. **Two thousandths of a second** (p. 4). The hammer is pushed by its own reflections while still touching. [Piano model; medium]
5. **Stiff strings stretch their harmonics** (p. 6). One stiffness slider spreads the partials: organ-like, piano-like, bell-like. [New mini-model; check the formula against the PDF; high]
6. **Where stretched harmonics are heard** (pp. 6-7). [Listening test; medium]
7. **Three strings per key** (p. 7). (Teach with D8 and D9, once.) [high]
8. **The sustain pedal: every string joins in** (pp. 6, 8). [Piano model; costly; medium]
9. **The soundboard's knock** (pp. 8-9). [Needs a measured response the paper does not publish; medium]
10. **How wrong can a decay be before you notice?** (p. 6). Same-or-different rounds; one cited study found no change perceived between about -25% and +40%. [Listening test; ready; high]

## F. Raman and Kumar, "Musical Drums with Harmonic Overtones"

The letter does not use the word tabla or name any drum: name one only with another source.

1. **The drum that plays a note** (p. 500). A plain skin's partials fall between the harmonic lines; a loaded skin's sit on 1, 2, 3, 4, 5. [Drum model; a loaded-head setting; high]
2. **Which shape makes which harmonic** (p. 500). Two different patterns share the third harmonic. [Drum model pictures; medium]
3. **A pitched drum as a bass voice** (the fact p. 500; the use is ours). [Studio; a harmonic drum voice; medium]

## G. Knowles white paper (every claim is the maker's)

1. **Inside a balanced armature driver** (p. 1). A cutaway with a reed tipping between two magnets. [Sound systems tab; a drawn diagram; high]
2. **What moves: coil or reed?** (p. 1). Beside the cone driver. [Sound systems tab; medium]
3. **The air behind the driver** (p. 2). Boxes drawn to scale. [Sound systems tab; medium]
4. **Three decibels is double the power** (p. 3). [Formula graph; ready; medium]
5. **An amplifier that is only ever on or off** (pp. 3-4). A fast square wave carrying audio in its pulse width. [New mini-model; medium]
6. **A driver is not one resistance** (pp. 3-4). [Reading only; low]

## H. Puckette, chapters 5 to 7

### Chapter 5: modulation
1. **Three kinds of spectrum: harmonic, inharmonic, noisy** (pp. 119-121). A saw, the saw ring-modulated at an unrelated pitch, and noise, on the spectrum. [Synth; ready; high]
2. **The outline of a spectrum** (pp. 120-121, 147). The lines move with the note; the hump a filter makes stays put. Pitch and outline are separate controls. [Synth; ready; high]
3. **Tremolo sped up becomes two new notes** (pp. 122-124). A slow multiplier is a volume wobble; faster, it is one tone above and one below. [Synth; Osc B tunable below hearing; high]
4. **When the difference goes below zero it bounces back** (pp. 123-125). [Synth; ready; medium]
5. **Ring-modulating a rich sound: denser, or shifted** (pp. 125-126, 134-135). A low carrier crowds the spectrum; a high one moves the outline up. [Synth; ready; high]
6. **An octave down from ring modulation** (pp. 126, 135-138). A sine carrier an octave below gives an odd-harmonic sound an octave lower; mix the original back for the rest. [Synth; ready; high]
7. **A carrier on a harmonic: same note, new colour** (pp. 126, 135, 138). Exact multiples keep the pitch; in between, it clangs. [Synth; ready; medium]
8. **Multiplying a tone by itself: an octave up** (pp. 123, 127-129). Plus a steady offset that depends on the phase between the two. [Synth; ready; medium]
9. **Distortion turns loudness into tone** (pp. 126-128). A fading sine into a clip starts square and ends pure; the same fade after the clip changes only level. [Synth; ready; high]
10. **Two notes into distortion make a third** (pp. 129-130, 138-139). 300 and 225 Hz give a 75 Hz tone; other intervals give mud. Why distorted chords behave as they do. [Synth; exact 4:3 tuning; high]
11. **Symmetric curves give even harmonics, lopsided ones give odd** (pp. 131-132, 141, 143). An offset before the curve blends the two. [Distortion; a bias control; high]
12. **Higher powers, higher harmonics** (pp. 130-131, 140). Why drive brightens. [New mini-model, a curve explorer; medium]
13. **A curve that makes exactly one harmonic** (pp. 132, 139-140). [Curve explorer; low]
14. **A curve that brightens in an orderly way** (pp. 140-142, 151). Against a fold, which spreads unevenly. [Curve explorer; medium]
15. **Vibrato sped up becomes tone colour** (p. 132). FM is pitch change too fast to follow. [Synth; ready if an LFO reaches the hundreds of Hz; high]
16. **FM ratios: when it is a note and when it is a bell** (pp. 133-134, 144). (Teach with Chowning 4, 5 and 8.) [Synth; ready; high]
17. **FM amount moves energy outward, and the middle can vanish** (pp. 133, 144-145). (With Chowning 3.) [Synth; ready; medium]
18. **Why FM, ring and distortion are relatives** (pp. 133-134, 144). [Picture; low]

### Chapter 6: designer spectra
19. **Formants: a peak has a place, a height and a width** (pp. 147-148). Two band-passes in parallel on a saw: the "vowel" stays while the pitch changes. [Synth; ready; high]
20. **A narrower pulse is a wider spectrum** (pp. 151-153, 163-166). Pulse width is a bandwidth control. [Synth; a smooth-pulse wavetable; medium]
21. **Why sync sounds like a moving peak** (pp. 156-157, 164-167). A faster sine restarted every cycle keeps the note; its own pitch becomes where the peak sits. [Synth; ready; high]
22. **Ring sweep against sync sweep** (pp. 156-158, 164, 167). Ring clangs except at exact multiples; sync stays a note all the way. [Synth; ready; high]
23. **The edge at the restart, and smoothing it away** (pp. 154, 156-157). [Synth; a window switch on sync; medium]
24. **A wave packet: a formant you can place** (pp. 154-157, 164-167). Two knobs, peak and width. [Synth; a packet oscillator; high]
25. **Cross-fading two harmonics to slide a peak** (pp. 157-158, 167-168). [Mini-model; low]
26. **Two formant knobs, one oscillator** (pp. 158-164, 169-172). Vowels designed by numbers, holding across notes. [Synth; a new formant oscillator; the book says the method was patented in 1994, so check before building; high]
27. **Smooth peaks against peaks with side bumps** (pp. 154-156). [Mini-model; low]
28. **A pluck as a narrowing spectrum** (pp. 147, 172). [Formant oscillator; low]

### Chapter 7: time shifts and delays
29. **One copy, four results** (pp. 175, 184, 209). Sweep one delay from a second to a millisecond: a second part, an echo, a doubled hit, a change of tone. [Studio or synth delay; time down to 1 ms; high]
30. **The comb: evenly spaced holes in the spectrum** (pp. 180-184, 209). Peaks at multiples of one over the delay time. Explains flangers and phase problems. [Synth; a delay-time knob on the flanger; high]
31. **An octave up by cancelling the odd harmonics** (pp. 184, 215-216). [Synth; a comb whose time follows the key; medium]
32. **The click test** (pp. 181, 185-186). What comes out when one click goes in tells you what an effect does to anything. [Studio; a scope that holds one hit; medium]
33. **Feedback: each echo is a fixed fraction of the last** (pp. 184-186, 194). [Synth delay and the echoes model; ready; medium]
34. **Echoes so close they become a note** (pp. 187-189, 209-213). High feedback and a few milliseconds: clicks ring at a pitch. Where plucked strings come from. [Synth flanger or Studio Resonators; high]
35. **Why feedback stops at 100%** (pp. 185, 193-194, 211). [Echoes model, picture only above 100%; medium]
36. **Reverb time from two numbers** (pp. 194-196). Loop length and loss per trip give the time to fall 60 dB. [Formula graph; ready; medium]
37. **How a reverb is built from delays** (pp. 193-196, 218-220). From one ringing comb to a room, a step at a time. (Pairs with the Dattorro set.) [New mini-model, a reverb builder; high]
38. **Highs die first in a room** (pp. 196, 218). (Same idea as C6: teach once.) [Studio; medium]
39. **Freezing a sound in an endless reverb** (pp. 196-197). Grab half a second of a note and it hangs; stack a chord from one note at a time. [Reverb; a freeze setting; high]
40. **Changing a delay's length bends the pitch** (pp. 198-201). Lengthening drops it, shortening raises it. [Delay; ready if the time glides; high]
41. **Vibrato from a wobbling delay: what a chorus is** (pp. 202-204). Chorus fully wet is plain vibrato. [Synth; chorus mix to 100%; high]
42. **A flanger is a comb that moves** (p. 211). (Fold into 30.) [Synth; ready; low]
43. **How a pitch shifter works, and why it warbles** (pp. 202-208, 218-221). Small windows flutter, large ones echo. Explains our own Shifter's known flaw. [Studio Shifter; a window-size control and a picture; medium]
44. **Effects that add nothing new, and effects that do** (pp. 130, 180). One sine through EQ, delay and reverb stays one line; through distortion and ring, new lines appear. Sorts every effect into two kinds. [Synth; ready; high]
45. **A shaker: partials rising and falling on their own** (pp. 216-218). [Studio; a small new effect; low]

## I. Yamaha VL1 manuals (a maker's account; the model's own numbers are not given anywhere in them)

### Getting Started (GS)
1. **An instrument is two parts: a driver and a resonator** (GS pp. 10-11). Mute the tube and hear the bare reed. [Physical model; high]
2. **Pressure is not volume** (GS pp. 12, 40). One control on level only, then on level, brightness and FM together. Blowing harder changes tone as well as loudness. [Synth; ready; high]
3. **Embouchure: a control that bends pitch and tone together** (GS pp. 12, 39-40). [Model; or pitch bend as a source on the synth; high]
4. **Tonguing: closing the gap at the reed** (GS pp. 12, 40). [Model; medium]
5. **Growl: breath that shakes fast** (GS pp. 12, 40; FR pp. 74, 141-142). A fast, slightly irregular wobble of level and noise, raised with the wheel. [Synth; ready; an LFO randomness amount would complete it; high]
6. **Scream: pushing a system until it breaks up** (GS pp. 12, 40-43). The manual does not say what it changes inside. [Model; medium]
7. **The player's throat is part of the instrument** (GS pp. 12, 40; FR pp. 75-76, 91-92). [Model; medium]
8. **Breath noise belongs to the note** (GS p. 40; FR pp. 73, 86-87). Band-limited noise whose level rises with the note; the same every note, or different. [Synth; a high-pass and low-pass on the noise, a restart switch; high]
9. **Damping and absorption: where the energy goes** (GS pp. 12, 40; FR pp. 80-81). [Model; medium]
10. **One gesture, several changes** (GS pp. 12, 39, 41). The reason behind the existing lesson on one source going several places. [Synth; ready; medium]
11. **Breath attack: how fast you move, as a source** (GS p. 39; FR p. 36). A filter opens only on a fast move of the wheel. [Synth; a new "wheel speed" source; high]
12. **The response curve** (GS pp. 44-45; FR pp. 65, 157). A connection has a shape as well as a depth. [Synth; a curve per connection; high]
13. **Nothing acoustic answers instantly** (GS p. 46; FR p. 85). A millisecond or two of smoothing turns a click into an onset. [Synth; a lag on the wheel and velocity; medium]
14. **Three places to listen: driver, pipe and tap** (GS pp. 48-50). Mixing two points along the pipe cancels some harmonics. [Model; high]
15. **Tone shaping stays inside the family** (GS p. 51). Pick the starting sound nearest the goal. [Synth; ready; medium]
16. **A sound modulated by a piece of itself** (GS pp. 51-53). The manual never says what kind of modulation. [Model; medium]
17. **What happens at a reed** (GS p. 52). Four moving traces under a blown note. [Model view; high]
18. **A half-filtered sound** (GS p. 54). Blend the unfiltered sound back in. [Synth; a filter mix knob, which Serum has; medium]
19. **Different settings for different parts of the keyboard** (GS pp. 53, 55). [Synth; a breakpoint curve for key position; medium]
20. **Smearing a sharp start** (GS pp. 14, 56). A cloud of tiny delays standing in for a body. [Studio; a small new device; medium]
21. **Wide range or easy to play** (GS p. 33). [Synth; ready; low]

### Feature Reference (FR)
22. **In a model, everything moves the tuning** (FR pp. 65-81, 180). Breath, lip and losses each drift the pitch. The biggest difference from an oscillator. [Model with a tuner; high]
23. **Where you turn it down matters** (FR p. 71). Before a distortion it cleans up; after, it is only quieter. Gain staging in one move. [Synth or Studio; ready; high]
24. **A resonance that stays put, or follows the note** (FR pp. 91-92). A body's own resonance against a colour that travels with pitch. [Synth; ready; high]
25. **A vibrato that sounds played** (FR pp. 69, 135-136). Delay and fade-in, brightness moving with pitch, the wheel raising depth and speed, a little irregularity. [Synth; mostly ready; high]
26. **Never twice the same** (FR pp. 37, 87, 136, 142). A small random offset per note removes the machine-gun effect. [Synth; a per-note random source; high]
27. **Hit harder, speak sooner** (FR pp. 129-130, 143-144). Velocity to attack time. [Synth; ready; medium]
28. **A scoop at the start that depends on how you play** (FR pp. 130-131). [Synth; ready; medium]
29. **Between the notes** (FR p. 85). [Synth; a note-change crossfade; low]
30. **Two instruments in one voice** (FR pp. 31-37, 104). Layer, split, crossfade across the keys. [Synth; ready; medium]
31. **Equal temperament and beat-free chords** (FR p. 42). Pure tuning is beat-free in one key only. (With A10.) [Synth; a tuning choice, with cents from another source; high]
32. **Echoes into the room, or beside it** (FR p. 45). Series against parallel. [Studio; ready; medium]
33. **One delay knob from flanger to chorus** (FR pp. 47-48). (With H30 and H41.) [Synth; the flanger's time knob; medium]
34. **Distortion and then a speaker** (FR pp. 51-52). The speaker removes the harsh top distortion adds. [Studio Overdrive and Cabinet; ready; medium]
35. **Echoes that get duller** (FR pp. 54-57). [Studio; ready; low]
36. **Reverb: the gap before, and highs that die first** (FR pp. 60-62). (With C6 and C15.) [Reverb; pre-delay and a low cut; high]
37. **A body from a tape measure** (FR pp. 126-127). Each dimension in centimetres divided by 34 gives milliseconds for five short delays. [Studio; a "body" device; high]
38. **Narrowing a stereo sound** (FR pp. 38-39). [Studio Utility; low]
39. **Find the silent patch** (FR pp. 178-180). Five sounds that make no noise, each with one cause. [Synth; five broken presets; medium]

## J. Chowning, "The Synthesis of Complex Audio Spectra by Means of Frequency Modulation"

Every recipe is a sine carrier (Osc A) and a sine modulator (Osc B). Using ratios in place of the paper's Hz is ours.

1. **Where the new partials land** (p. 2). Above and below A, spaced by exactly B's pitch. [Synth; ready; high]
2. **The amount knob is a brightness knob** (pp. 2, 4-5). Energy is "stolen" from the carrier and spread outward. [Synth; an index readout; high]
3. **Partials that vanish and come back** (pp. 2-3, 5). [Synth and a graph; ready; medium]
4. **Whole-number ratios make a note** (pp. 3-4). [Synth; a ratio readout; high]
5. **The ratio picks which harmonics you get** (p. 4). 1 to 1 all, 1 to 2 odd only, 1 to 3 every third missing. [Synth; ready; high]
6. **Partials that bounce off zero** (pp. 3-4). Why 1 to 1 gives a full harmonic series. [FM sidebands model, extended; medium]
7. **A half-hertz offset brings it to life** (p. 7). [Synth; ready; high]
8. **Ratios that are not whole numbers: clang** (p. 4). B six semitones above A. [Synth; ready; high]
9. **A spectrum that moves: an envelope on the index** (pp. 1, 4, 6). The paper's main point: change over time is what tells timbres apart. [Synth; ready; high]
10. **Sweep the index a long way** (pp. 4-5, 8). [Synth; index above 8; medium]
11. **Brass: brighter as it gets louder** (pp. 6-7). 1 to 1, index 0 to 5 on the level's own envelope, 0.6 s. [Synth; a source must reach index 5; high]
12. **Hit harder, get brighter** (p. 7). Velocity to level and FM together. [Synth; ready; high]
13. **Woodwind: start on a higher harmonic** (p. 7). Carrier three times the modulator, index 0 to 2. [Synth; exact ratios; medium]
14. **A reed: odd harmonics, and an index that falls as the note rises** (p. 7). 3 to 2, index 4 down to 2. [Synth; ready; medium]
15. **The ending need not mirror the beginning** (pp. 7-8). [Synth; ready; low]
16. **A bell** (p. 8). Modulator 1.4 times the carrier, index 10 down to 0 over 15 s. [Synth; index to 10; high]
17. **Same recipe, short and narrow: a drum** (p. 8). 0.2 s, index from 2. [Synth; ready; high]
18. **A wood drum: a burst, then a ring** (p. 8). 80 and 55 Hz, index from 25 collapsing at once. [Synth; index to 25; high]
19. **A second carrier adds a peak** (pp. 8-9). [Synth; a second FM carrier; medium]

## K. Szabo, "How to Emulate the Super Saw"

1. **Seven saws, one in the middle** (pp. 13-15). Spaced unevenly and not quite mirrored. [Synth; a measured unison layout; medium]
2. **The detune knob is a curve, not a line** (pp. 15-18). Half way gives under a tenth of the spread. Knob feel is design. [Synth and a graph; a curve on detune; high]
3. **Mix: thick without getting louder** (pp. 19-21). The centre falls in a line while the sides rise on a parabola. [Synth; a centre-against-sides mix; high]
4. **Why every note starts differently** (pp. 26-28). Random start phase per saw, per note. [Synth; check per-voice random phase; high]
5. **A high-pass that follows the note** (pp. 22-25). [Synth; ready; medium]
6. **Fold-back noise as "air"** (pp. 22-24, 29). The author's opinion. [Needs a naive saw; low]
7. **Build the stack: a wide pad and a chord stab** (pp. 29-30). [Synth then Studio; after 1 to 3; medium]

## L. Stilson and Smith, "Alias-Free Digital Synthesis of Classic Analog Waveforms"

1. **What fold-back sounds like** (pp. 1-3, 7). (One lesson with A26, A27, B31.) [Mini-model; a naive saw; high]
2. **A jump or a corner: how fast the harmonics fade** (pp. 1, 3, 9). (Same as B27: teach once.) [Synth; ready; medium]
3. **One click per cycle becomes a saw** (pp. 4, 8-9). A click train summed once is a saw; twice, a triangle. [Mini-model and a "Clicks" wavetable; medium]
4. **Pulse width is the gap between two click trains** (p. 9). [Same model; low]
5. **How many harmonics fit under the ceiling** (pp. 3-4, 6). Every shape becomes a sine at the top. [Mini-model; medium]
6. **A wavetable is one cycle read at different speeds** (pp. 3-4). (With A12.) [low]
7. **Harmonics that pop in and out on a glide** (pp. 6-7). [Listening test; low]

## M. Esqueda and others, "Virtual Analog Buchla 259 Wavefolder"

1. **Two roads to a bright sound** (p. 1). A saw through a closing low-pass against a sine with fold turned down. [Synth; ready; high]
2. **Folding is not clipping: harmonics come and go** (pp. 1, 6). [Synth; ready; high]
3. **In a folder, level is tone** (pp. 3, 6). [Synth; ready; medium]
4. **Why this fold has only odd harmonics** (p. 6). [Synth; an offset before the fold; medium]
5. **A fold built from five simple pieces** (pp. 2-4). [New mini-model; medium]
6. **The gentle filter after the fold** (p. 4). [Synth; ready; low]
7. **Corners make fold-back** (pp. 4, 6). [Naive-against-clean comparison; low]

## N. Senn and others 2018, "Groove in drum patterns"

What it found, which every lesson must respect: liking the style and thinking you know the tune explained about
15% of groove ratings; the patterns themselves under 10%; syncopation and density about 1% each; residual
microtiming, beat salience and tempo nothing or next to nothing. Correlations only. Never say a pattern type
"makes" groove.

1. **Three layers of a drum beat** (p. 16). Downbeat (kick), backbeat (snare), pulse (hat). [Studio; ready; high]
2. **Four kick patterns** (pp. 16-19). 1 and 3, four on the floor, eighths, sixteenths. [Studio; four patterns of our own; high]
3. **A busy snare: the sixteenth-note backbeat** (pp. 17-19). [Studio; ready; medium]
4. **Hats: quarters, eighths, sixteenths** (pp. 16-17, 22). [Studio; ready; medium]
5. **What syncopation is, and what it costs** (pp. 2, 13-14, 21). More interesting (r = 0.38) but the beat slightly harder to find. [Studio; ready; high]
6. **More hits per beat** (pp. 13, 21-22, 25). [Studio; a hits-per-beat readout; medium]
7. **Four loudness levels: loud, medium, soft, ghost** (p. 6). [Studio; a fourth, quieter strength; high]
8. **Swing ratio: long-short pairs** (pp. 13, 20). Under half a percent of ratings across 248 real patterns. [Studio; a ratio readout; medium]
9. **Does your taste decide the groove? A self-test** (pp. 16, 23-27). The paper's main finding, tried on yourself. [Listening test; a rating page; high]
10. **Musicians and non-musicians heard it differently** (pp. 22-23, 26). [Listening test; medium]
11. **Steady tempo** (pp. 12, 20-21). [Reading; low]

## O. Senn and others 2016, "Expert performance microtiming and groove"

What it found: from fully quantized up to 20% exaggerated, no difference on any scale; quantized and as-played
were rated equally. Exaggerating by 40% or more lowered ratings. One duo, two 20-second clips.

1. **What microtiming is: milliseconds off the grid** (pp. 2-5). [Studio; a per-hit timing nudge on drums and an offset readout; high]
2. **Quantized against as played: can you tell?** (pp. 8-9, 15). Blind. [Studio; a played pattern from the Groove data; high]
3. **The looseness dial: where it starts to bother you** (pp. 3, 5, 8-10). One slider from -100% to +100%. [Studio; a timing-scale control on a clip; high]
4. **Trained ears notice sooner** (pp. 10, 12-13). Repeat after a few weeks. [Listening test; medium]
5. **One late hit on a perfect grid sticks out** (p. 14). The authors' untested hypothesis. [Studio; medium]
6. **Timing as a fraction of the beat** (pp. 13-14). The same milliseconds are a bigger share at a fast tempo. [Studio; medium]
7. **Wanting to move and moving are not the same measure** (pp. 11-14). [Reading; low]

## P. Hove and others 2014, "Superior time perception for lower musical pitch"

What it measured: two piano tones (196 and 466 Hz), one 50 ms early. A bigger automatic EEG response and a tap
shifted 3 ms more when the lower one was early. "Low" means the lower of two, not sub-bass.

1. **Which early note do you catch? Low or high** (pp. 1-2, 5). [Studio piano roll; a random early-note player; high]
2. **Your taps follow the lower note** (pp. 2, 5-6). [Listening test; a tap-along page; medium]
3. **Why a low-first flam sounds like one hit** (pp. 3-4). A model result. [Studio and spectrogram; ready; medium]
4. **Tight low layer, loose top layer** (pp. 1, 3). The habit is ours, not a finding. [Studio; medium]
5. **Melody on top, rhythm underneath** (pp. 1-3). [Studio; low]

## Q. Hockman and Davies, "Breakbeat classification and resequencing"

The famous breaks are copyrighted recordings and cannot be shipped; a break rendered from a credited Groove
take on our own kit can.

1. **What a breakbeat is, and what a sampler made possible** (pp. 1-2). [Studio sampler; a break we may ship; high]
2. **Slice it: one pad per hit** (pp. 1, 5). [Studio; ready for equal slices; high]
3. **Resequence: a new bar from two old bars** (p. 5). Repeats and omissions. The core technique. [Studio; slice names on the pads; high]
4. **Short slice, long gap** (p. 5). [Studio; ready; medium]
5. **Pitch a break up, and the kick becomes something else** (pp. 1, 6). [Studio; ready; medium]
6. **Where kick and snare live** (pp. 2-5). About 50 to 325 Hz and 430 to 5000 Hz. [Studio; ready; medium]
7. **Two breaks in one beat** (p. 2). [Studio; ready; medium]
8. **The transformation chain** (pp. 1, 5). Resequence, pitch, filter, distort. [Studio; ready; medium]
9. **Breaks have fingerprints** (pp. 2-4). [Listening test; low]

## R. Rajala and others 2022, "Hearing threshold, loudness and annoyance of infrasonic frequencies"

19 people, pure tones, a sealed chamber. Nothing transfers to music on a club system without saying so, and no
lesson may ask the learner to play loud low tones to feel them.

1. **How low can you hear? The threshold climbs steeply** (pp. 2-4, 9). From a few dB at 1 kHz to nearly 80 dB at 20 Hz. Why subs need power. [Synth and a chart drawn from Table 1; high]
2. **Bass is touchy** (pp. 2-3, 12-13). The same dB step is a bigger loudness step in the bass. [Synth and a chart; high]
3. **Why harmonics make a sub audible** (p. 5). The sourced reason behind an existing lesson. [Synth; ready; high]
4. **Below about 20 Hz there is no note** (p. 2). [Synth scope; ready; medium]
5. **Your bass is not everyone's bass** (pp. 9, 11, 13). Thresholds differed by about 20 dB between people. [Listening test; medium]
6. **Loud is not the same as annoying** (pp. 3, 12-13). [Listening test; ready; medium]
7. **What people reported feeling at very high bass levels** (pp. 2, 9-13). [Reading only; low]

## S. The Groove MIDI Dataset (CC BY 4.0: credit Gillick, Roberts, Engel, Eck, Bamman, Google Magenta, on anything built)

1,150 takes, 13.6 hours; 503 beats and 647 fills; ten drummers, two of whom played 73%; almost all 4/4; mostly
rock, funk, jazz, latin and hip hop. Two files are labelled breakbeat and none glitch-hop, psydub, jungle or
drum and bass. The MIDI itself has not been opened: measure before any lesson states a figure.

1. **One beat, four drummers** (ten set grooves were each played by four). [Studio; a MIDI import that keeps off-grid timing and loudness; high]
2. **See a drummer's timing: the offset picture** [Studio; a new "feel view"; high]
3. **Snap it, and listen** Blind: a real take, its quantized copy, and a copy at one loudness. [Studio; high]
4. **Ghost notes are quiet on purpose** [Studio; a loudness histogram, full-range loudness on drum hits; high]
5. **Hi-hat accents: the loudness pattern inside a bar** [Studio; medium]
6. **Measure the swing in a real shuffle** [Studio; medium]
7. **Borrow a feel** Move timing and loudness from a real take onto your own pattern, with an amount slider. [Studio; a groove template; high]
8. **Fills: what changes in the last bar** [Studio; a fill browser; medium]
9. **Half-time at 140** [Studio; one take only, check it first; medium]
10. **Styles the grid presets do not cover** [Studio; triplet and 6/8 drum clips; low]

---

## Where these sit in the course

`docs/CURRICULUM.md` ("Added on 20 Nov 2026: ten chapters...") puts these ideas into a teaching order under
ten new chapters, using the codes of this file (section letter and number, such as A1 or H30), and adds 52
new lessons for what these texts did not cover.

## Counts

| Source | Ideas |
|---|---|
| Puckette, chapters 1-4 | 43 |
| Puckette, chapters 5-7 | 45 |
| Puckette, chapters 8-10 | 33 |
| Yamaha VL1, both manuals | 39 |
| Dattorro | 26 |
| Chowning | 19 |
| Karjalainen | 11 |
| Senn 2018 | 11 |
| Bank | 10 |
| Groove MIDI Dataset | 10 |
| Hockman and Davies | 9 |
| Szabo, Stilson and Smith, Buchla wavefolder, Senn 2016, Rajala | 7 each (35) |
| Knowles | 6 |
| Hove | 5 |
| Raman and Kumar | 3 |
| **Total** | **305** |

About 25 are the same idea met in two texts (marked "teach once" or "with ..."), so roughly **280 distinct
lessons**. About 85 of them need nothing built first, and 133 are marked high value (39 of those need nothing built).

## What is worth building, with the numbers the texts give

Each of these unlocks a group of lessons. The numbers are copied from the readers' reports: **check every one
against the PDF before coding**, since several figures and equations were garbled in the extracted text.

**1. A rebuilt reverb (Dattorro pp. 3-6; unlocks C1-C11, C15, H37-H39, I36).** Mono in, stereo out. All
lengths in samples at 29,761 Hz. Input: left plus right, halved; predelay; a one-pole low-pass (bandwidth
0.9995); four input diffusers in series of 142 and 107 (coefficient 0.750), 379 and 277 (0.625). Tank: two
halves in a figure eight, each fed the diffused input plus the other half's output times decay. Left half:
modulated all-pass 672 (+ excursion), delay 4453, damping low-pass then times decay, all-pass 1800, delay 3720,
times decay. Right half: 908 (+ excursion), 4217, damping, 2656, 3163. Defaults: decay 0.50, decay diffusion 1
0.70, decay diffusion 2 0.50, damping 0.0005, excursion 16 (a footnote says about 8 used, at about 1 Hz). Total
22,494 samples, which matches the paper's "22K words". Output taps (each times 0.6): left = +[4217 line at
266] +[4217 line at 2974] -[2656 line at 1913] +[3163 line at 1996] -[4453 line at 1990] -[1800 line at 187]
-[3720 line at 1066]; right = +[4453 line at 353] +[4453 line at 3627] -[1800 line at 1228] +[3720 line at
2673] -[4217 line at 2111] -[2656 line at 335] -[3163 line at 121]. The tap table was badly garbled: its signs
are a reassembly. The paper gives no rule for other sample rates (scaling the lengths is ours), tuned
everything by ear, and has no "size" control. Needs a bypass per stage, listen points and a freeze.

**2. A seven-saw stack (Szabo pp. 13-30; unlocks K1-K7 and the supersaw on the to-do list).** Ratios at full
detune: 0.88997686, 0.93711560, 0.98047643, 1, 1.01991221, 1.06216538, 1.10745242. Detune curve, knob against
share of full spread: 0.055 0.0097, 0.118 0.0220, 0.181 0.0340, 0.244 0.0468, 0.307 0.0591, 0.370 0.0715,
0.433 0.0839, 0.496 0.0967, 0.559 0.1215, 0.622 0.1471, 0.685 0.1935, 0.748 0.2434, 0.811 0.2934, 0.874
0.3433, 0.937 0.3928, 1 1. Mix: centre = -0.55366x + 0.99785; each side = -0.73764x^2 + 1.2841x + 0.044372.
Random phase per saw at each note. Then a high-pass at the note's fundamental. Use our own name for it.

**3. FM to the paper's reach (Chowning; unlocks J10-J18).** A ratio control and index readout; index up to 25;
a source able to reach index 5. Recipes: brass 1:1, index 0-5, 0.6 s; woodwind 3:1, index 0-2, and 5:1, index
0-1.5; reed 3:2, index 4 down to 2; bell 1:1.4, index 10 to 0, 15 s; drum the same, 0.2 s, index from 2; wood
drum 80 and 55 Hz, 0.2 s, index from 25. Three envelope shapes must be read off the paper's figures.

**4. A five-cell fold (Buchla paper p. 4; unlocks M4, M5).** Output = -12.000 V1 - 27.777 V2 - 21.428 V3 +
17.647 V4 + 36.363 V5 + 5.000 Vin, each Vk = gain x Vin - offset x sign(Vin) above its threshold, else 0.
Gain, offset, threshold: V1 0.8333, 0.5000, 0.6000; V2 0.3768, 1.1281, 2.9940; V3 0.2829, 1.5446, 5.4600; V4
0.5743, 1.0338, 1.8000; V5 0.2673, 1.0907, 4.0800. Then a one-pole low-pass near 1.33 kHz. Values come from a
hobbyist redrawing of the circuit. Use our own name.

**5. An additive instrument (Puckette pp. 12-15, 107-111; unlocks A8-A10, A41-A43, B18, E5).** Harmonic
sliders; the eleven-partial bell with the printed values; a drawn outline that notes move under; a tone that
rises forever; a stiffness slider.

**6. A grain looper (Puckette pp. 34-38, 52-57; unlocks A19-A22).** Repeat rate, segment size, location, a
window per pass, two overlapped readers, travel speed separate from pitch.

**7. Real drum feel in the Studio (Groove data, Senn 2016; unlocks O1-O6, S1-S9, P4).** A timing nudge and
full-range loudness on drum hits; a MIDI import that keeps both; a timing-scale slider (-100% to +100%); a
feel view (offset against step); a loudness histogram; a groove template with an amount; a blind A/B. Always
with the dataset's credit shown.

**8. One "naive against clean" oscillator comparison (unlocks A26, A27, B31, B32, L1, L5, K6, M7).**

**9. Small things, each a few hours:** a click source for the synth (B3, C21, H32); peak and RMS on the meter
(A1, A7); Q and bandwidth readout (B2); an invert switch on Osc B (B29, B30); a delay-time knob on the flanger
and a key-tracked comb (H30, H31, H34, I33); a bias control on the distortion (H11, M4); a sample-and-hold LFO
shape (A32); a per-note random source (I26); a response curve and a lag per connection (I12, I13, B4); a
"wheel speed" source (I11); freeze on the reverb (H39); a reverse switch and loop-rate control on the sampler
(A15, A16); a fourth "ghost" strength in the drum grid (N7); slice names on pads (Q3).

**10. Larger pieces:** a spectral device family (spectral EQ, gate, vocoder, time stretch: B21-B25); a
wavetable made from a recording (B26); a formant oscillator (H24, H26; check the patent note); a string model
rebuilt around a recorded body, two directions and coupling (D7-D10); a live-controllable blown model in the
VL1's layout (I1-I9, I14-I17, I22), which needs an AudioWorklet and whose numbers must come from another text.

## Suggested order

1. **The 85 or so lessons that need nothing built**, in batches by subject: FM from Chowning and Puckette;
   ring modulation and distortion (H1-H10, H44); sync and formants with what exists (H19, H21, H22); drum
   layers, syncopation and breaks in the Studio (N1-N5, Q2-Q8); the expressive-playing lessons from the VL1
   that work on the synth today (I2, I5, I10, I15, I23-I25, I27, I28, I30).
2. **The small builds (9 above)**, each of which opens several lessons.
3. **The seven-saw stack and the FM reach**, since both were already wanted.
4. **The rebuilt reverb**, with its lesson set.
5. **Real drum feel in the Studio.**
6. **The additive instrument and the grain looper.**
7. The larger pieces, as the owner chooses.

## Cautions that apply across the list

- The groove papers found small effects or none for the things producers argue about (microtiming, swing,
  syncopation) and a large effect of the listener's own taste. Lessons report that, and let the learner test
  their own ear.
- Hove's "low" is 196 Hz against 466 Hz. It says nothing about sub-bass.
- Rajala is about pure tones at very high levels in a sealed chamber.
- The Raman letter names no drum and does not use the word tabla.
- The VL1 manuals, the Knowles paper and Szabo's "air" remark are a maker's or an author's own claims.
- Puckette's thresholds (about 3 cents, about 30 events a second, about 30 ms) are rules of thumb he states
  without measurements.
- Dattorro's reverb values were set by ear, by his own account.
- Named artists, songs and products in these texts are not carried into lessons.
