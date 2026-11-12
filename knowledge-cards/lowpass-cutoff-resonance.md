---
id: lowpass-cutoff-resonance
title: Low-pass cutoff and resonance
stages: [filter]
applies_to: [VoiceFilter]
status: draft
reading: 
---

## What it is
A low-pass filter lets the low part of the sound through and turns down everything above its cutoff point. Resonance boosts a narrow band right at that point.

## Why it works
A raw wavetable is rich in upper harmonics, and those harmonics are what the ear reads as brightness. Lowering the cutoff removes them from the top down, so the same note goes from buzzy to rounded to dull. Resonance feeds some of the filter's output back into itself, which emphasises whatever harmonics sit at the cutoff and gives the filter an audible pitch of its own. Steeper filter types remove the upper harmonics more abruptly; driving the filter input adds saturation before the harmonics are removed, which thickens the low mids.

## Listen for
Sweep the cutoff and the tone should open and close like a vowel. With resonance up, the sweep gains a whistling or squelching edge that follows the cutoff. Too much resonance thins the body of the sound and can ring on its own.

## Goes with
Because the cutoff is so audible, it is the most common target for an envelope, an LFO or a macro. A low resting cutoff with strong modulation gives plucks and wobbles; a high resting cutoff mostly just tames harshness.
