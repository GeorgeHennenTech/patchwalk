// "Show me where": the guide points at places in one library picture that matter for the learner's question.
// This file is the shared, testable part: the request and reply shapes, the instructions, and the clean-up
// that turns whatever the model returns into marks that are safe to draw. The marks are the model's pointing,
// not the manual's: the UI says so, and nothing here is treated as a fact about the product.
import { z } from "zod";

export const MAX_POINT_ANSWER = 3000;
export const PointRequestSchema = z.object({
  book: z.string().regex(/^[a-z0-9][a-z0-9-]{0,80}$/),
  file: z.string().regex(/^p\d{1,5}-\d{1,3}\.webp$/),
  question: z.string().trim().min(3).max(600),
  /** The guide's answer to that question, so the marks can follow its steps. Optional. */
  answer: z.string().max(MAX_POINT_ANSWER).optional(),
  /** Look again even if this picture has been marked for this question before. */
  fresh: z.boolean().optional(),
});
export type PointRequest = z.infer<typeof PointRequestSchema>;

/** What the model is asked to return: boxes in the picture's own pixels, each with a short label. */
export const PointModelSchema = z.object({
  /** What the picture shows and how it bears on the question, in a sentence or two. */
  about: z.string(),
  marks: z.array(z.object({
    label: z.string(),
    left: z.number(), top: z.number(), width: z.number(), height: z.number(),
  })),
});
export type PointModelReply = z.infer<typeof PointModelSchema>;

/** A mark ready to draw: a box as fractions of the picture (0..1), a number and a label. */
export interface Mark { n: number; /** A, B, C...: letters, because manuals print their own numbers on pictures. */ letter: string; label: string; x: number; y: number; w: number; h: number }
export interface PointResponse { about: string; marks: Mark[]; /** Shown again from the site's memory, with no new call. */ remembered?: boolean }
/** The model's sentence about the picture, tidied and kept short. */
export const cleanAbout = (about: string) => about.replace(/\*\*|^#{1,6} /gm, "").replace(/\s+/g, " ").trim().slice(0, 600);

export const MAX_MARKS = 5;
const clamp01 = (v: number) => Math.min(1, Math.max(0, v));

/**
 * Turn the model's boxes into drawable marks: inside the picture, not vanishingly small, not covering nearly
 * the whole picture (which points at nothing), with a label, and at most MAX_MARKS of them.
 */
export function cleanMarks(reply: Pick<PointModelReply, "marks">, width: number, height: number): Mark[] {
  const out: Mark[] = [];
  for (const m of reply.marks) {
    const label = m.label.replace(/\s+/g, " ").trim().slice(0, 80);
    if (!label || ![m.left, m.top, m.width, m.height].every(Number.isFinite) || m.width <= 0 || m.height <= 0) continue;
    const x0 = clamp01(m.left / width), y0 = clamp01(m.top / height), x1 = clamp01((m.left + m.width) / width), y1 = clamp01((m.top + m.height) / height);
    let w = x1 - x0, h = y1 - y0;
    if (w <= 0 || h <= 0 || w * h > 0.85) continue;
    // very small targets get a box big enough to see, centred on the same spot
    const minW = Math.min(1, 14 / width), minH = Math.min(1, 14 / height);
    let x = x0, y = y0;
    if (w < minW) { x = clamp01(x0 + w / 2 - minW / 2); w = Math.min(minW, 1 - x); }
    if (h < minH) { y = clamp01(y0 + h / 2 - minH / 2); h = Math.min(minH, 1 - y); }
    out.push({ n: out.length + 1, letter: String.fromCharCode(65 + out.length), label, x, y, w, h });
    if (out.length === MAX_MARKS) break;
  }
  return out;
}

export const POINT_SYSTEM = `You help a beginner read a screenshot or diagram taken from a product manual. You are given the picture, its size in pixels, the text of the manual page it came from, the learner's question and, when there is one, the answer the learner has just been given.

First, in "about", say in one or two plain sentences what the picture shows and how it bears on the question. If the picture carries the manual's own numbered or lettered markers, say what each one refers to, using the page text. If the picture has little to do with the question, say so plainly.

Then mark the places in the picture that the learner should look at: the controls, menu entries, readouts or parts of a diagram that the question and answer involve.

- Return at most ${MAX_MARKS} marks. If the answer gives steps, mark where each step happens, in the order of the steps, and begin that label with "Step" and its number. Otherwise put the most important first. Fewer is better.
- Each mark is a box in the picture's own pixel coordinates: left and top of the box's corner, then its width and height. Draw the box tightly around the thing itself.
- Each label is a few plain words saying what the thing is and, if it helps, what to do with it. Use the name printed in the picture or on the manual page when there is one. Do not state settings or behaviour that the page text does not state.
- Only mark things you can actually see in the picture. If nothing in the picture is relevant, or you cannot make it out, return no marks. No marks is a good answer; a guess is not.
- No Markdown.`;
