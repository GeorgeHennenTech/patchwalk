---
id: C5M.5
title: A wobble you can play
builds_on: [C5M.1, C4.2]
uses: [Synth, Serum]
minutes: 8
cards: [macro-multi, lfo-cutoff]
status: draft
---

## You will be able to
Send a macro to an LFO’s own settings, so one knob brings a wobble in and speeds it up.

## Hear it first
The finished macro at zero, halfway and right up.

## The idea
A macro’s destination does not have to be part of the sound. It can be a setting of an LFO or an envelope. Here LFO 1 is already sent to the cutoff, but with an amount of zero, so nothing moves. The macro raises that amount and the LFO’s rate together. At zero the bass is still. As you turn it, a wobble appears and gets faster. This is the knob people ride in a build-up.

## Steps
| Do | On screen | Check | You should hear |
|---|---|---|---|
| Switch on Hold and play a note. Macro 1 is at zero and not connected to anything. | Macro 1 | Note held, macro at 0 | The starting sound. |
| In Macro 1, set slot 1 to LFO 1 amount, and its amount to about +30%. | Macro 1 slot 1 sends to, Macro 1 slot 1 amount, LFO 1 amount, Macro 1 | Slot 1 sent to LFO 1 amount, amount between 18% and 42% | No change yet: the macro is still at zero. The destination knob gains a faint ring showing how far the macro can take it. |
| In Macro 1, set slot 2 to LFO 1 rate, and its amount to about +40%. | Macro 1 slot 2 sends to, Macro 1 slot 2 amount, LFO 1 rate, Macro 1 | Slot 2 sent to LFO 1 rate, amount between 28% and 52% | Still no change: you are deciding what the macro will do, not doing it yet. |
| Give the macro a name that says what it does, such as “Wobble”. | Macro 1 name, Macro 1 | A name of your own typed in | Nothing changes. The name is for you, later, when a patch has several macros. |
| Turn the macro slowly from zero all the way up, then back down. | Macro 1, LFO 1 amount, LFO 1 rate, Filter curve | Macro taken below 5% and above 95% | A still bass note starting to wobble, deeper and faster as the macro rises. |
| Park the macro where it sounds best to you. | Macro 1, LFO 1 amount, LFO 1 rate, Filter curve | Macro moved in this step and left between 5% and 95% | Your choice. |

## Ear check
Not built per lesson; the chapter checkpoint matches a macro's position by ear.

## In Serum
Serum has eight macros in the bottom-left corner. Drag a macro onto each knob it should move, set each amount, and double-click the macro’s name to rename it.

In the guide: macros and the Mod Matrix.

## Recap
- A macro can move an LFO’s amount and rate.
- Starting an amount at zero lets the macro bring the movement in.
- Depth and speed rising together reads as intensity.

## Guide notes
Built by `recipe()` in `src/course/lessons/macros.ts` from a few lines of data; add more combinations there. The parked-position remark lists each knob the macro moved, from and to. A macro on an LFO's own settings. LFO 1 starts connected with an amount of zero.
