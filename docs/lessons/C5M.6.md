---
id: C5M.6
title: Pluck to pad
builds_on: [C5M.1, C3.2]
uses: [Synth, Serum]
minutes: 8
cards: [macro-multi, amp-envelope]
status: draft
---

## You will be able to
Morph an envelope with a macro, turning a short pluck into a slow pad from one knob.

## Hear it first
The finished macro at zero, halfway and right up.

## The idea
You met the pluck and the pad as two separate settings of the same four envelope controls. A macro can travel between them: attack longer, sustain higher, release longer, all at once. Envelope settings are read when a note starts, so you hear the change on the next note you strike, not on one that is already sounding.

## Steps
| Do | On screen | Check | You should hear |
|---|---|---|---|
| Strike a few keys. Macro 1 is at zero and not connected to anything. | Macro 1 | Two notes played, macro at 0 | The starting sound. |
| In Macro 1, set slot 1 to Env 1 attack, and its amount to about +55%. | Macro 1 slot 1 sends to, Macro 1 slot 1 amount, Env 1 attack, Macro 1 | Slot 1 sent to Env 1 attack, amount between 43% and 67% | No change yet: the macro is still at zero. The destination knob gains a faint ring showing how far the macro can take it. |
| In Macro 1, set slot 2 to Env 1 sustain, and its amount to about +65%. | Macro 1 slot 2 sends to, Macro 1 slot 2 amount, Env 1 sustain, Macro 1 | Slot 2 sent to Env 1 sustain, amount between 53% and 77% | Still no change: you are deciding what the macro will do, not doing it yet. |
| In Macro 1, set slot 3 to Env 1 release, and its amount to about +45%. | Macro 1 slot 3 sends to, Macro 1 slot 3 amount, Env 1 release, Macro 1 | Slot 3 sent to Env 1 release, amount between 33% and 57% | Still no change: you are deciding what the macro will do, not doing it yet. |
| Give the macro a name that says what it does, such as “Length”. | Macro 1 name, Macro 1 | A name of your own typed in | Nothing changes. The name is for you, later, when a patch has several macros. |
| Turn the macro up in stages, striking a key at each stage, until it has been from one end to the other. | Macro 1, Env 1 attack, Env 1 sustain, Env 1 release, Envelope 1 drawing | Macro taken below 5% and above 95%, three notes played | Short plucks at the bottom of the macro, swelling pads at the top, and everything in between. |
| Park the macro where it sounds best to you. | Macro 1, Env 1 attack, Env 1 sustain, Env 1 release, Envelope 1 drawing | Macro moved in this step and left between 5% and 95% | Your choice. |

## Ear check
Not built per lesson; the chapter checkpoint matches a macro's position by ear.

## In Serum
Serum has eight macros in the bottom-left corner. Drag a macro onto each knob it should move, set each amount, and double-click the macro’s name to rename it.

In the guide: macros and the Mod Matrix.

## Recap
- A macro can morph an envelope’s whole shape.
- Envelope changes are heard on the next note.
- One knob can turn one kind of instrument into another.

## Guide notes
Built by `recipe()` in `src/course/lessons/macros.ts` from a few lines of data; add more combinations there. The parked-position remark lists each knob the macro moved, from and to. Notes are struck, not held: envelope settings apply to the next note.
