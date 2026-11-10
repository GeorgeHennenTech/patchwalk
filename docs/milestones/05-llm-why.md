# M5 — LLM "why" per step + validator

## Facts
- Output contract: `{do, why, listen_for, param_refs}`. `do` and all numbers come from code; the model writes prose
  only for facts it is given, using the knowledge cards.
- The request carries selected facts and cards, never the preset file.

## Acceptance
- `/api/lesson` holds the key; browser bundle contains no key (checked by a build test).
- Validator rejects a response if: a number is not in the step's facts, a param or setting name is not in
  `param_refs`' allowed set, `param_refs` cites an unknown id, or the JSON fails the schema.
- Rejection triggers regeneration, bounded; after the limit the step falls back to the code-only text from M4.
- Validator tests use hand-written bad responses (invented value, invented module, wrong unit).
- Unverified facts are passed with that flag and the lesson says so.

## Sources
- Knowledge cards (M7). Claude API docs for structured output.
