# M2 — Active modules view

## Facts (unverified)
- `plainParams` is `"default"` or a map of non-default `kParam*` values.
- Init has 175 top-level keys (confirmed).
- Init is not all-default: `Env0`..`Env3` carry non-default curve params. Diff against Init's values (confirmed).
- Oscillator sub-modules are nested (`Oscillator0.WTOsc0`); the diff must recurse (confirmed).
- Un-suffixed root keys holding `kUIParam*` values are UI state and are excluded (confirmed present).
- How "disabled" is stored (an enable param? absence?) is unknown; determine from probes.

## Acceptance
- View lists only modules that differ from Init and are enabled; a toggle reveals the rest.
- A fixture identical to Init shows nothing active beyond what Init itself has on.
- Keys absent from Init are shown as "unknown module", not dropped.
- Tests: Init diffs to empty; each one-change probe diffs to exactly one param.

## Sources
- Owner fixtures: Init plus probes that enable/disable one module each.
