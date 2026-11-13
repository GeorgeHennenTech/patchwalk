---
id: C5M.4
title: Width without loudness
builds_on: [C5M.2, C1.6]
uses: [Synth, Serum]
minutes: 7
cards: [macro-multi, unison-detune]
status: draft
---

## You will be able to
Build a macro that widens a sound and turns it down slightly at the same time, so it gets bigger without getting louder.

## Hear it first
The finished macro at zero, halfway and right up.

## The idea
Detuned, spread-out unison sounds bigger, and bigger tends to be heard as louder. In a mix that is a problem: you wanted width, and you got a level jump as well. So the macro does two things for width and a third against them: detune up, spread up, level a little down. This kind of built-in compensation is what separates a macro that is nice to play from one that fights you.

## Steps
| Do | On screen | Check | You should hear |
|---|---|---|---|
| Switch on Hold and play a note. Macro 1 is at zero and not connected to anything. | Macro 1 | Note held, macro at 0 | The starting sound. |
| In Macro 1, set slot 1 to Detune, and its amount to about +35%. | Macro 1 slot 1 sends to, Macro 1 slot 1 amount, Detune, Macro 1 | Slot 1 sent to Detune, amount between 23% and 47% | No change yet: the macro is still at zero. The destination knob gains a faint ring showing how far the macro can take it. |
| In Macro 1, set slot 2 to Spread, and its amount to about +80%. | Macro 1 slot 2 sends to, Macro 1 slot 2 amount, Spread, Macro 1 | Slot 2 sent to Spread, amount between 68% and 92% | Still no change: you are deciding what the macro will do, not doing it yet. |
| In Macro 1, set slot 3 to Osc A level, and its amount to about -10%. | Macro 1 slot 3 sends to, Macro 1 slot 3 amount, A level, Macro 1 | Slot 3 sent to Osc A level, amount between -22% and 2% | Still no change: you are deciding what the macro will do, not doing it yet. |
| Give the macro a name that says what it does, such as “Wide”. | Macro 1 name, Macro 1 | A name of your own typed in | Nothing changes. The name is for you, later, when a patch has several macros. |
| Turn the macro slowly from zero all the way up, then back down. | Macro 1, Detune, Spread, A level, Level meter | Macro taken below 5% and above 95% | One plain voice opening out into a wide, thick stack, with the meter staying roughly where it was. |
| Park the macro where it sounds best to you. | Macro 1, Detune, Spread, A level, Level meter | Macro moved in this step and left between 5% and 95% | Your choice. |

## Ear check
Not built per lesson; the chapter checkpoint matches a macro's position by ear.

## In Serum
Serum has eight macros in the bottom-left corner. Drag a macro onto each knob it should move, set each amount, and double-click the macro’s name to rename it.

In the guide: macros and the Mod Matrix.

## Recap
- A slot can compensate for what the others do.
- Wider and thicker is often heard as louder.
- A small negative level slot keeps a width macro honest.

## Guide notes
Built by `recipe()` in `src/course/lessons/macros.ts` from a few lines of data; add more combinations there. The parked-position remark lists each knob the macro moved, from and to. Introduces compensation: a slot that works against the others.
