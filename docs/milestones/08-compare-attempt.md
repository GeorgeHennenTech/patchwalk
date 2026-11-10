# M8 — Drop your attempt

## Facts
- Both files go through the same decode > diff > facts pipeline; comparison is on facts, not raw bytes.

## Acceptance
- Dropping a second preset shows, per step: matched, close (within a code-defined tolerance), or different, with both values.
- Extra modules in the attempt and missing ones are both reported.
- Target vs identical copy reports all matched; target vs Init reports every step.
- Explanations reuse the M5 path and validator; neither file leaves the browser.

## Sources
- Owner fixtures: at least one target plus a deliberate near-miss attempt.
