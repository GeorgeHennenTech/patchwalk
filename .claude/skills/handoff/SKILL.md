---
name: handoff
description: Bring docs/HANDOFF.md up to date so a brand-new chat can continue this project with no explanation from the owner. Use when the owner types /handoff, says "handoff", "update the handoff", "wrap up", "I'm starting a new chat", or when the conversation is getting long.
---

# Handoff

The owner is not a programmer and pays for every token. `/handoff` means: **write down where we are, do not
start new work.** Never treat it as "do the next item in the handoff".

## Steps

1. **Finish or park what is in flight.** If work is half-done, either complete it if it is minutes away, or
   leave it in a working state and describe exactly what remains. Never hand off a broken build.
2. **Check the real state**, do not rely on memory: `git status`, `git log --oneline -5`, `npx tsc --noEmit`,
   `npx vitest run` (note the passing-test count), and count the lessons, cards and scripts if they changed.
3. **Update `docs/HANDOFF.md`** in place, keeping its eleven numbered sections and plain language:
   - top line: "Last updated" date and the latest commit title
   - section 1: the expected test count
   - section 5 and 6: anything newly built, newly proven, or still unproven (be honest: "measured, not heard")
   - section 8 "What to do next": mark finished items done with the date, and make the first open item the
     real next step, with enough detail to start without asking
   - section 9 "Waiting on the owner": add new questions, remove answered ones, record the answers given
   - section 10: anything that exists only outside the repo (uploads, accounts, settings, scratch files)
   - section 11: one line of history for this session
   Record decisions and the owner's stated preferences with their date. Remove anything no longer true.
   Never write passwords, API keys or the owner's email into it.
4. **Update `CLAUDE.md`** only where a fact changed (status, counts, format facts, rules). Keep it pointing
   at `docs/HANDOFF.md`.
5. **Commit and push** to `main` with the usual attribution lines, then confirm the remote has the commit.
6. **Send the owner the file** `docs/HANDOFF.md` and reply in a few short lines:
   - what state things are in
   - the next step the new chat will take
   - how to continue: start a new session on the `patchwalk` repo and say "continue" (the notes load on their
     own), or drop the file into any new chat
   Then stop. Do not begin the next item.

## A good handoff

A fresh assistant who reads only `CLAUDE.md` and `docs/HANDOFF.md` should be able to say what the product is,
what the rules are, what works, what is unproven, and what to do first, without asking the owner anything.
