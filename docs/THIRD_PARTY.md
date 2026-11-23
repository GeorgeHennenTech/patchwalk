# Other people's work in this project

Code and methods that are not our own, with their licences. Keep this up to date when one is added.

## Code that ships in the site
- **Signalsmith Stretch** (`signalsmith-stretch` on npm; Geraint Luff, Signalsmith Audio; MIT). Time-stretch
  and pitch-shift in `src/daw/stretch.ts`. Used as published, fetched by the browser only when first needed.
- **Plaits drum models** (Emilie Gillet; MIT; from the STM32 part of the `pichenettes/eurorack` repository,
  files `plaits/dsp/drums/analog_bass_drum.h`, `analog_snare_drum.h`, `hi_hat.h` and the filter from
  `stmlib`). Ported to TypeScript in `src/daw/drummodels.ts`, which carries the copyright notice and the
  licence text. The author asks that derivative works do not use the module's or the maker's names: the
  drums are listed as "circuit model" and the maker's name appears only in the credit.
- `three` (MIT), `fzstd` (MIT), `cborg` (Apache-2.0), `zod` (MIT), `react` (MIT), `@anthropic-ai/sdk` (MIT),
  the two `@fontsource` fonts (OFL).

## Methods taken from published papers (our own code)
- The plate reverb in `src/synth/plate.ts`: Jon Dattorro, "Effect Design, Part 1", J. Audio Eng. Soc. 1997.
- The wavetables and warp modes credited in `src/synth/params.ts` (`TABLE_NOTES`).

## Tools used to build and check (not shipped)
- `@playwright/test` (Apache-2.0), `vitest` (MIT), `fast-check` (MIT), `oxlint` (MIT), `knip` (ISC).
- Tesseract (Apache-2.0) and poppler for reading PDFs in `scripts/ingest_pdf.py`.

## Looked at and not used
GPL, AGPL and LGPL code is not copied in (Rubber Band, Surge XT, Essentia.js, PyMuPDF, SoundTouch, lamejs).
