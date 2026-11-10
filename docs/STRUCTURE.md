# Proposed file structure (awaiting approval — no app code exists yet)

```
CLAUDE.md
docs/milestones/01..08-*.md     one spec per milestone: Facts / Acceptance / Sources
fixtures/                        owner's presets (test input only; never bundled, never deployed)
  init/  probes/  patches/       Init, one-change-from-Init probes, real multi-module patches
knowledge-cards/                 markdown cards + _template.md (M7)
api/
  lesson.ts                      Vercel function: facts + cards in, lesson JSON out. Holds the API key.
src/
  format/                        M1 — bytes to plain JS, no musical meaning
    container.ts                 magic, lengths, flag, zstd frame, size cap
    cbor.ts                      decode; keeps -0, generic version field
    schema.ts                    Zod: header, root map, plainParams = "default" | map
    errors.ts                    typed, user-readable failures
  patch/                         M2 — what is actually in use
    baseline.ts                  default values learned from the Init fixture
    diff.ts                      non-default params per module
    activity.ts                  enabled / disabled / untouched
  display/                       M3 — raw value to on-screen value
    registry.ts                  one entry per param: convert(), unit, verified: boolean, source
    conversions/                 osc, unison, warp, filter, envelope, lfo
  flow/                          M4 — the fact graph
    facts.ts                     Fact type: id, module, param, raw, display, verified
    graph.ts                     routing: osc > filter > amp > FX, plus mod sources
    steps.ts                     the fixed nine-stage order
  lesson/                        M5-M6
    contract.ts                  Zod for {do, why, listen_for, param_refs}
    validator.ts                 rejects text citing anything outside the given facts
    render/                      beginner / intermediate / advanced
    client.ts                    calls /api/lesson
  compare/                       M8 — attempt vs target, reported per step
  ui/                            DropZone, JsonView, ActiveModules, StepList, DifficultyToggle
tests/                           mirrors src/; fixture loop lives in tests/fixtures.test.ts
```

Dependency direction is one-way: format > patch > display > flow > lesson > ui. Nothing below `lesson/`
knows the LLM exists, so milestones 1-4 work with no network.

## Decisions to confirm
- **zstd + CBOR libraries**: `fzstd` (decompress-only, pure JS, streamable so the size cap is enforceable) and
  `cbor-x` or `cborg`. Licenses and -0 handling get checked at M1 before they are added.
- **Fixtures in git**: fine for presets the owner made. Factory presets must stay out (rule 4); if any are needed
  for local testing they go in a gitignored `fixtures/local/`.
- **Init baseline**: `baseline.ts` would hold default values learned from the owner's saved Init. That is a table of
  numbers, not the preset file, but it ships to browsers — owner to confirm this is acceptable under rule 4.
