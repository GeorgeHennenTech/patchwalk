# M7 — Knowledge cards

## Facts
- Cards are short markdown written by the owner; they are the model's only source for "why".

## Acceptance
- `knowledge-cards/_template.md` with front matter (id, applies-to params/modules, difficulty notes) and body sections.
- Three example cards (proposed: unison detune, low-pass cutoff + resonance, amp envelope attack/release).
- Cards are selected by code from a step's facts; a step with no matching card says so rather than improvising.
- Lint test: every card parses and references only known params.

## Sources
- Owner. General synthesis knowledge, no Xfer manual text copied.
