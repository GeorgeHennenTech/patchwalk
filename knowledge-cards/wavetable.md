---
id: wavetable
title: Wavetables and wavetable position
stages: []
applies_to: [wavetable, kParamTablePos]
status: draft
reading: Wavetable synthesis (Wikipedia) | https://en.wikipedia.org/wiki/Wavetable_synthesis
---

## What it is
A wavetable is a series of single-cycle wave shapes stored side by side. The oscillator plays one of them, and the position control chooses which. Moving the position morphs from one shape to the next.

## Why it works
The shape of one cycle fixes which harmonics are present and how strong each is, and that mix is what the ear hears as tone colour. A smooth shape has few harmonics and sounds pure; a jagged shape has many and sounds bright or buzzy. Because a table holds many related shapes, sweeping the position changes the harmonic mix continuously, something a fixed waveform cannot do.

## Listen for
Move the position slowly on a held note. The pitch stays the same while the colour changes, sometimes gradually and sometimes in steps, depending on how the table was made.

## Goes with
Position is a favourite modulation target: an envelope, LFO or macro on it gives movement before the filter is even involved. A table stored inside a preset may not exist in your own library.
