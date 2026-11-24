# Long checks of the Studio's effects

Too slow for the kept browser tests (`npm run e2e`), so they are run by hand when an effect is added or
changed. Each needs `npm run dev` running and uses the demo song (`src/daw/demos/glitchhop.json`). They write
their results into the folder they are run from.

- `every-effect-render.mjs <worker> <workers>`: two bars of the demo through each effect on the master,
  three ways: as it comes, pushed hard, and switched off. With the dice fixed, "off" must match the bare
  song to the last bit (about -86 dB, the file's own rounding), the two viewers must change nothing, and a
  pushed effect must change the sound. Run four at once (`0 4`, `1 4`, `2 4`, `3 4`): about five minutes.
- `every-note-effect.mjs`: each note effect on the demo's pluck: what it does to the notes, and that
  switched off it does nothing.
- `every-effect-on-page.mjs`: on the real page with the song playing, clicks each effect and note effect
  onto a track, turns a knob, sets a menu and a switch, switches it off and on, and removes it.

The paths at the top of each file are the build session's (`/home/user/patchwalk`).
