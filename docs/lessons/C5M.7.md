---
id: C5M.7
title: Dirt
builds_on: [C5M.3, C1.7]
uses: [Synth, Serum]
minutes: 7
cards: [macro-multi]
status: draft
---

## You will be able to
Build a macro that roughens a clean sound: drive, resonance and a layer of noise.

## Hear it first
The finished macro at zero, halfway and right up.

## The idea
Grit also has several ingredients. Drive squashes the wave. Resonance adds a hard edge at the cutoff. Noise fills the gaps between the harmonics. The noise oscillator is switched on here but turned right down, waiting. Together on one macro they take a sound from clean to filthy by degrees, which is far easier to control than three knobs.

## Steps
| Do | On screen | Check | You should hear |
|---|---|---|---|
| Switch on Hold and play a note. Macro 1 is at zero and not connected to anything. | Macro 1 | Note held, macro at 0 | The starting sound. |
| In Macro 1, set slot 1 to Drive, and its amount to about +80%. | Macro 1 slot 1 sends to, Macro 1 slot 1 amount, Drive, Macro 1 | Slot 1 sent to Drive, amount between 68% and 92% | No change yet: the macro is still at zero. The destination knob gains a faint ring showing how far the macro can take it. |
| In Macro 1, set slot 2 to Resonance, and its amount to about +30%. | Macro 1 slot 2 sends to, Macro 1 slot 2 amount, Resonance, Macro 1 | Slot 2 sent to Resonance, amount between 18% and 42% | Still no change: you are deciding what the macro will do, not doing it yet. |
| In Macro 1, set slot 3 to Noise level, and its amount to about +50%. | Macro 1 slot 3 sends to, Macro 1 slot 3 amount, Noise level, Macro 1 | Slot 3 sent to Noise level, amount between 38% and 62% | Still no change: you are deciding what the macro will do, not doing it yet. |
| Give the macro a name that says what it does, such as “Dirt”. | Macro 1 name, Macro 1 | A name of your own typed in | Nothing changes. The name is for you, later, when a patch has several macros. |
| Turn the macro slowly from zero all the way up, then back down. | Macro 1, Drive, Resonance, Noise level, Spectrum, Scope | Macro taken below 5% and above 95% | A clean bass note getting squashed, edgy and hissy, step by step. |
| Park the macro where it sounds best to you. | Macro 1, Drive, Resonance, Noise level, Spectrum, Scope | Macro moved in this step and left between 5% and 95% | Your choice. |

## Ear check
Not built per lesson; the chapter checkpoint matches a macro's position by ear.

## In Serum
Serum has eight macros in the bottom-left corner. Drag a macro onto each knob it should move, set each amount, and double-click the macro’s name to rename it.

In the guide: macros and the Mod Matrix.

## Recap
- Dirt is drive, edge and noise together.
- A source can sit silent until a macro brings it in.
- By degrees is the point: stop where it is dirty enough.

## Guide notes
Built by `recipe()` in `src/course/lessons/macros.ts` from a few lines of data; add more combinations there. The parked-position remark lists each knob the macro moved, from and to. Noise is switched on but silent until the macro raises it.
