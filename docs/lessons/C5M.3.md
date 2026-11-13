---
id: C5M.3
title: Brightness: three slots at once
builds_on: [C5M.1, C1.3, C2.5]
uses: [Synth, Serum]
minutes: 8
cards: [macro-multi]
status: draft
---

## You will be able to
Use all three slots so one macro changes a sound’s brightness in three ways that reinforce each other.

## Hear it first
The finished macro at zero, halfway and right up.

## The idea
Brightness has more than one cause. The filter decides which harmonics get through. The wavetable position decides which harmonics exist to begin with. Drive adds new ones. Moving only one of them sounds like a knob being turned; moving all three sounds like the instrument itself getting brighter. That is the real use of a macro: several small moves that add up to one musical gesture.

## Steps
| Do | On screen | Check | You should hear |
|---|---|---|---|
| Switch on Hold and play a note. Macro 1 is at zero and not connected to anything. | Macro 1 | Note held, macro at 0 | The starting sound. |
| In Macro 1, set slot 1 to Cutoff, and its amount to about +30%. | Macro 1 slot 1 sends to, Macro 1 slot 1 amount, Cutoff, Macro 1 | Slot 1 sent to Cutoff, amount between 18% and 42% | No change yet: the macro is still at zero. The destination knob gains a faint ring showing how far the macro can take it. |
| In Macro 1, set slot 2 to Position, and its amount to about +80%. | Macro 1 slot 2 sends to, Macro 1 slot 2 amount, Position, Macro 1 | Slot 2 sent to Position, amount between 68% and 92% | Still no change: you are deciding what the macro will do, not doing it yet. |
| In Macro 1, set slot 3 to Drive, and its amount to about +40%. | Macro 1 slot 3 sends to, Macro 1 slot 3 amount, Drive, Macro 1 | Slot 3 sent to Drive, amount between 28% and 52% | Still no change: you are deciding what the macro will do, not doing it yet. |
| Give the macro a name that says what it does, such as “Bright”. | Macro 1 name, Macro 1 | A name of your own typed in | Nothing changes. The name is for you, later, when a patch has several macros. |
| Turn the macro slowly from zero all the way up, then back down. | Macro 1, Cutoff, Position, Drive, Filter curve, Spectrum | Macro taken below 5% and above 95% | A dull tone turning bright, full and slightly gritty, all in one motion. |
| Park the macro where it sounds best to you. | Macro 1, Cutoff, Position, Drive, Filter curve, Spectrum | Macro moved in this step and left between 5% and 95% | Your choice. |

## Ear check
Not built per lesson; the chapter checkpoint matches a macro's position by ear.

## In Serum
Serum has eight macros in the bottom-left corner. Drag a macro onto each knob it should move, set each amount, and double-click the macro’s name to rename it.

In the guide: macros and the Mod Matrix.

## Recap
- Three slots can push one quality from three directions.
- Small amounts on several knobs beat a large amount on one.
- The result should sound like one change, not three.

## Guide notes
Built by `recipe()` in `src/course/lessons/macros.ts` from a few lines of data; add more combinations there. The parked-position remark lists each knob the macro moved, from and to. Three slots pushing one quality. Uses the generated Bright sweep wavetable.
