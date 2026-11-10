# M3 — Display-value table (~40 params)

## Facts (unverified)
- Raw values differ from on-screen values: envelope times and curves, filter type names (`MgL6`), likely
  detune, cutoff, and LFO rate.
- Target groups: oscillator (level, pan, octave/semi/fine, wavetable position), unison (voices, detune, blend),
  warp (mode, amount), filter (type, cutoff, resonance, drive, mix), envelopes (ADSR + curves), LFOs (rate, sync, shape).

## Acceptance
- Every registry entry has `verified: boolean` and a `source`. Unverified entries show a badge in the UI.
- Every conversion has a test tied to a named fixture and the value the owner read off Serum's screen.
- A conversion with no confirming fixture cannot be marked verified (enforced by a test).
- Deliverable includes: list of unverified conversions and the exact probe presets to make (one change from Init each).

## Sources
- Owner probes with on-screen readings. Public references for candidate formulas only.
