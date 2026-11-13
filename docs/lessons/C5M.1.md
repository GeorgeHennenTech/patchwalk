---
id: C5M.1
title: One knob, two settings
builds_on: [C5.1, C2.2]
uses: [Synth, Serum]
minutes: 7
cards: [macros]
status: draft
---

## You will be able to
Build a macro that moves two controls at once, and name it.

## Hear it first
The finished macro at zero, halfway and right up.

## The idea
A macro is a knob that does nothing by itself. You give it up to three slots. Each slot says: when I am turned up, move that knob, by this much. Turn the macro and every slot moves together. The point is performance. Instead of reaching for two knobs you reach for one, named for what it does to the sound and not for what it is wired to. Here: open the filter and add resonance at the same moment, which is how a bass is made to bite.

## Steps
| Do | On screen | Check | You should hear |
|---|---|---|---|
| Switch on Hold and play a note. Macro 1 is at zero and not connected to anything. | Macro 1 | Note held, macro at 0 | The starting sound. |
| In Macro 1, set slot 1 to Cutoff, and its amount to about +35%. | Macro 1 slot 1 sends to, Macro 1 slot 1 amount, Cutoff, Macro 1 | Slot 1 sent to Cutoff, amount between 23% and 47% | No change yet: the macro is still at zero. The destination knob gains a faint ring showing how far the macro can take it. |
| In Macro 1, set slot 2 to Resonance, and its amount to about +45%. | Macro 1 slot 2 sends to, Macro 1 slot 2 amount, Resonance, Macro 1 | Slot 2 sent to Resonance, amount between 33% and 57% | Still no change: you are deciding what the macro will do, not doing it yet. |
| Give the macro a name that says what it does, such as “Bite”. | Macro 1 name, Macro 1 | A name of your own typed in | Nothing changes. The name is for you, later, when a patch has several macros. |
| Turn the macro slowly from zero all the way up, then back down. | Macro 1, Cutoff, Resonance, Filter curve | Macro taken below 5% and above 95% | The filter opening and the edge sharpening together. Watch Cutoff and Resonance: each has a ring that fills as the macro rises, and a dot showing where the macro has put it. |
| Park the macro where it sounds best to you. | Macro 1, Cutoff, Resonance, Filter curve | Macro moved in this step and left between 5% and 95% | Your choice. |

## Ear check
Not built per lesson; the chapter checkpoint matches a macro's position by ear.

## In Serum
Serum has eight macros in the bottom-left corner. Drag a macro onto each knob it should move, set each amount, and double-click the macro’s name to rename it.

In the guide: macros and the Mod Matrix.

## Recap
- A macro moves several knobs from one.
- Each slot is a destination and an amount.
- Name a macro for what it does to the sound.

## Guide notes
Built by `recipe()` in `src/course/lessons/macros.ts` from a few lines of data; add more combinations there. The parked-position remark lists each knob the macro moved, from and to. The first macro: two slots, a name, a sweep.
