---
id: C5M.8
title: Two macros on one sound
builds_on: [C5M.3, C5M.5]
uses: [Synth, Serum]
minutes: 8
cards: [macro-multi]
status: draft
---

## You will be able to
Play a sound with two macros, and let both of them reach the same knob.

## Hear it first
None.

## The idea
A finished patch usually has several macros, each for one musical idea. This one arrives with two already built: Bright, and Wobble. They are independent, so every combination of the two is a different sound. Two macros may also reach the same knob. Their pushes add, exactly as two LFOs on one knob did, and the knob wears a ring for each.

## Steps
| Do | On screen | Check | You should hear |
|---|---|---|---|
| Switch on Hold and play a low note. Both macros are at zero. | Macro 1, Macro 2 | Note held, both macros at 0 | A dull, still bass note. |
| Turn Bright up past 60% and leave Wobble at zero. | Macro 1, Macro 2, Filter curve | Bright at 60% or more, Wobble at 0 | A brighter, still note. |
| Bring Bright back to zero and turn Wobble up past 60%. | Macro 1, Macro 2, Filter curve | Bright at 0, Wobble at 60% or more | A dark note that wobbles. |
| Now turn both up, and try a few combinations. | Macro 1, Macro 2, Filter curve | Both macros above 40% | Bright and wobbling. Two knobs, a whole map of sounds. |
| Give Wobble a third slot: send it to Cutoff as well, with an amount of about -15%. | Macro 2, Macro 2 slot 3 sends to, Macro 2 slot 3 amount, Cutoff, Matrix | Wobble’s slot 3 sent to Cutoff, amount between -27% and -3% | As the wobble comes in, the filter also closes a little, so the wobble digs into a darker tone. Cutoff now wears a ring from each macro and one from the LFO. |

## Ear check
None.

## In Serum
Serum shows a small number on each macro for how many places it is sent, and lists them all on the MATRIX tab.

In the guide: the Mod Matrix.

## Recap
- Each macro should stand for one musical idea.
- Independent macros multiply: every combination is a sound.
- Two macros on one knob add together.

## Guide notes
Arrives with two macros built. Ends by sending the second macro to a knob the first already reaches, and shows the Matrix view.
