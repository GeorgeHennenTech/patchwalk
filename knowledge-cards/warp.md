---
id: warp
title: Warp modes
stages: [character]
applies_to: [kParamWarpMenu, kParamWarp, kParamWarpMenu2, kParamWarp2]
status: draft
reading: Phase distortion synthesis (Wikipedia) | https://en.wikipedia.org/wiki/Phase_distortion_synthesis
---

## What it is
Warp reshapes the oscillator's wave before it goes anywhere else. A menu picks the kind of reshaping and a knob sets how much.

## Why it works
Every warp mode changes how the stored wave is read out: squeezing it to one side, bending it, reading it at a different speed and restarting it, or mirroring it. Each of those changes the outline of the cycle, and a changed outline means a changed set of harmonics. This is tone shaping at the source, so it adds harmonics that were not in the table, where a filter can only remove them.

## Listen for
With the amount at its resting position most modes do nothing. As it rises, the tone should get brighter, hollower, more nasal or more aggressive depending on the mode, while the note stays the same.

## Goes with
Warp amount is commonly modulated so the tone moves over time. Because warp can add a lot of high harmonics, it is often followed by a filter to keep the result under control.
