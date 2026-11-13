---
id: C5M.2
title: Opposite directions: a crossfade
builds_on: [C5M.1, C1.4]
uses: [Synth, Serum]
minutes: 7
cards: [macro-multi]
status: draft
---

## You will be able to
Make one macro turn something up while it turns something else down.

## Hear it first
The finished macro at zero, halfway and right up.

## The idea
A slot’s amount can be negative. Give one slot a positive amount and another a negative one, and the macro trades one thing for another as it turns. Here oscillator B starts silent. The macro brings B up and takes A down, so one knob fades from a saw to a square. The same idea blends any two layers: a clean and a dirty sound, a dark and a bright one.

## Steps
| Do | On screen | Check | You should hear |
|---|---|---|---|
| Switch on Hold and play a note. Macro 1 is at zero and not connected to anything. | Macro 1 | Note held, macro at 0 | The starting sound. |
| In Macro 1, set slot 1 to Osc A level, and its amount to about -100%. | Macro 1 slot 1 sends to, Macro 1 slot 1 amount, A level, Macro 1 | Slot 1 sent to Osc A level, amount between -112% and -88% | No change yet: the macro is still at zero. The destination knob gains a faint ring showing how far the macro can take it. |
| In Macro 1, set slot 2 to Osc B level, and its amount to about +100%. | Macro 1 slot 2 sends to, Macro 1 slot 2 amount, B level, Macro 1 | Slot 2 sent to Osc B level, amount between 88% and 112% | Still no change: you are deciding what the macro will do, not doing it yet. |
| Give the macro a name that says what it does, such as “Morph”. | Macro 1 name, Macro 1 | A name of your own typed in | Nothing changes. The name is for you, later, when a patch has several macros. |
| Turn the macro slowly from zero all the way up, then back down. | Macro 1, A level, B level, Spectrum | Macro taken below 5% and above 95% | A saw fading into a hollow square and back. On the spectrum, every other peak drops out as B takes over. |
| Park the macro where it sounds best to you. | Macro 1, A level, B level, Spectrum | Macro moved in this step and left between 5% and 95% | Your choice. |

## Ear check
Not built per lesson; the chapter checkpoint matches a macro's position by ear.

## In Serum
Serum has eight macros in the bottom-left corner. Drag a macro onto each knob it should move, set each amount, and double-click the macro’s name to rename it.

In the guide: macros and the Mod Matrix.

## Recap
- A negative amount turns a knob down as the macro goes up.
- One positive and one negative slot make a crossfade.
- The middle of the macro is a blend of both.

## Guide notes
Built by `recipe()` in `src/course/lessons/macros.ts` from a few lines of data; add more combinations there. The parked-position remark lists each knob the macro moved, from and to. Negative amounts. Oscillator B starts silent so the macro can bring it in.
