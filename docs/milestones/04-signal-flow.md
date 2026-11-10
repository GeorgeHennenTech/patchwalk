# M4 — Signal-flow graph and step list (no AI)

## Facts
- Fixed order: init · core tone (osc, wavetable, position) · thickness (unison/detune) · character (warp) ·
  tone shaping (filter) · contour (amp env) · motion (mod env, LFO, matrix) · space (FX rack order) · performance.
- Unverified: how oscillator-to-filter routing, FX order, and `ModSlot` source/destination are encoded.

## Acceptance
- Each fixture produces a deterministic ordered step list; every step carries its facts (param, raw, display, verified).
- Empty stages are omitted. FX appear in the rack order stored in the file.
- Uninterpretable keys produce an explicit "could not interpret" step item (rule 6).
- Snapshot tests per fixture.

## Sources
- Owner fixtures, including probes for routing, FX reorder, and one mod-matrix slot.
