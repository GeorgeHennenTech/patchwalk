---
id: filter-envelope
title: An envelope on the filter cutoff
stages: []
applies_to: [combo:filter-envelope]
status: draft
---

## What it is
An envelope is routed to the filter cutoff, so each note opens the filter and then lets it settle according to the envelope's shape.

## Why it works
Brightness that changes over the course of a note is one of the strongest cues the ear uses to recognise an instrument. Plucked and struck sounds start bright and darken quickly; bowed and blown sounds brighten as they build. An envelope on the cutoff recreates that. When the envelope's sustain is at the bottom, the cutoff returns to its resting position while the key is still held, giving a pluck that is made by the filter rather than by the volume. The route amount sets how far the cutoff travels; the decay time sets how long the bright part lasts.

## Listen for
A bright "bite" at the start of each note that closes down into a rounder tone. Shortening the decay makes it snappier; raising the resting cutoff makes the effect subtler.

## Goes with
Resonance makes the sweep more audible. In a mono patch with legato, the envelope does not restart on overlapping notes, so only the first note of a run gets the bite.
