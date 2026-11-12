# Scripted lessons

One file per lesson. These are full scripts: what the learner does at each step, what is on screen, what the
app checks, and what the guide should notice. They are written before the lesson engine exists, in a fixed
shape so they can be converted to lesson data without rewriting.

Every file has the same sections:

- **You will be able to**: the outcome, in one or two lines.
- **Hear it first**: the before/after played at the start.
- **The idea**: the concept in a few sentences (the knowledge card carries the depth).
- **Steps**: a table. *Do* is the instruction; *On screen* is what the lesson reveals for that step; *Check* is
  what the app verifies from the practice synth's state; *You should hear* is the ear target.
- **Ear check**: blind listening questions the app can generate and mark.
- **In Serum**: the optional matching task, and what the app can check from the saved preset today.
- **Recap**: three lines.
- **Guide notes**: common mistakes, and what the guide should comment on. Guidance for the teacher, not shown.

Values in these scripts refer to the practice synth, whose units are exact. All scripts are `status: draft`
until the owner has reviewed them. Map of all lessons: `docs/CURRICULUM.md`.
