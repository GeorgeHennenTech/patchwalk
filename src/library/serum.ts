// "Build this lesson in Serum 2": a practice lesson, taught on this app's own synth, rewritten as steps the
// learner can follow in Serum 2 itself. It is written once per lesson from the Serum 2 User Guide's own
// pages, with citations, and kept in the site's database for everyone. The same two rules as a walkthrough:
// what the manual says is kept apart from the guide's own mapping of one synth's controls onto the other's,
// and where Serum has no such control, or the manual pages found do not cover it, that is said plainly.
// Server files use ".js" import suffixes.
import { z } from "zod";

export const MAX_LESSON_STEPS = 16;
export const SerumRequestSchema = z.object({
  /** The lesson's code, e.g. "C2.1". Only used to name what is stored. */
  lesson: z.string().regex(/^[A-Za-z0-9.]{2,12}$/),
  title: z.string().trim().min(2).max(120),
  chapter: z.string().trim().max(60).optional(),
  outcome: z.string().trim().max(500).optional(),
  /** What each step asks the learner to do on the practice synth, in order. */
  steps: z.array(z.string().trim().min(2).max(700)).min(1).max(MAX_LESSON_STEPS),
  /** Only look whether it has been built already: never a paid call. */
  peek: z.boolean().optional(),
  /** Build it again even if it exists. */
  fresh: z.boolean().optional(),
});
export type SerumRequest = z.infer<typeof SerumRequestSchema>;

export const SERUM_SYSTEM = `You are the guide in a private app that teaches sound synthesis to one learner, a beginner. The app has its own simple practice synth, and each lesson is taught on it. Your job is to rewrite one lesson so the learner can do the same thing in Serum 2, the synth they own, using only the pages of the Serum 2 User Guide supplied with it. Quote-level citations are attached automatically to what you draw from those pages.

Go through the lesson's steps in order. For each one write a short group of paragraphs, separated by blank lines, each beginning with one of these labels in capitals followed by a colon:

DO: "Step N:" and then, in one sentence, what the learner does in Serum 2 for this step. Always first in the group.
RECIPE: the clicks, as numbered lines (1., 2., 3., each on its own line), using control names exactly as the User Guide prints them, and saying which panel or tab each is on when the pages say so.
TEXT: what the User Guide says about that control, close to its own words, when it helps the learner understand what they are turning.
SYNTHESIS: your own mapping. The practice synth is not Serum 2: its controls have plain names, different ranges and sometimes no twin. Whenever you decide that a control on the practice synth corresponds to a control in Serum 2, or suggest a value, say so here, not under RECIPE or TEXT. A number from the lesson is a setting on the practice synth: offer it only as a place to start, and tell the learner to finish by ear.
MISSING: use this when the supplied pages do not show how to do the step in Serum 2, or when Serum 2 as described in them has nothing that does what the step needs. Say which, plainly. Do not fill the gap from memory.

Rules:
- Describe only what the supplied pages describe. Do not add controls, menu items, values or behaviour they do not state.
- Keep each step short. A beginner should be able to follow it with Serum 2 open beside the lesson.
- Steps that are only about listening, or about the app's own pictures (its scope, spectrum, meter or on-screen keyboard), need one DO line saying what to listen for or do in Serum 2, and nothing else.
- Use no Markdown: no asterisks, bullet symbols, headings or tables.
- If the pages cover none of the lesson, write a single MISSING paragraph and nothing else.`;

/** The text sent with the manual pages. */
export function serumPrompt(req: Pick<SerumRequest, "title" | "chapter" | "outcome" | "steps">): string {
  return `The lesson, as taught on the app's practice synth:\n\nTitle: ${req.title}${req.chapter ? `\nChapter: ${req.chapter}` : ""}${req.outcome ? `\nWhat the learner should be able to do afterwards: ${req.outcome}` : ""}\n\nIts steps:\n${req.steps.map((s, i) => `${i + 1}. ${s}`).join("\n")}\n\nRewrite it for Serum 2, step by step.`;
}
/** One search per step, plus one for the lesson as a whole: each looks only in the Serum 2 User Guide. */
export const serumQueries = (req: Pick<SerumRequest, "title" | "chapter" | "steps">): string[] => [`${req.title} ${req.chapter ?? ""}`, ...req.steps.map((s) => `${s} ${req.title}`)];
export const SERUM_BOOK = "serum-2-user-guide";
/** How many manual passages a lesson is written from at most, and how many each search may add. */
export const MAX_SERUM_PASSAGES = 14, PER_QUERY = 2;
