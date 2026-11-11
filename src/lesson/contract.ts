// Shapes shared by the browser, the serverless function and the validator.
// NOTE: files under src/lesson that the serverless function imports use explicit ".js" import
// suffixes so they also load as plain Node ESM on Vercel.
import { z } from "zod";

export const DIFFICULTIES = ["beginner", "intermediate", "advanced"] as const;
export type Difficulty = (typeof DIFFICULTIES)[number];

/** What the narrator is told about one step. Everything here was chosen and worded by code. */
export const LessonStepSchema = z.object({
  id: z.string().max(200),
  stage: z.string().max(40),
  title: z.string().max(300),
  goal: z.string().max(300),
  /** The instructions the learner sees, already rendered for the chosen difficulty. */
  lines: z.array(z.string().max(600)).max(60),
  notes: z.array(z.string().max(600)).max(30),
  facts: z.array(z.object({ id: z.string().max(200), label: z.string().max(200), value: z.string().max(300) })).max(60),
  cards: z.array(z.object({ id: z.string().max(100), title: z.string().max(200), body: z.string().max(6000) })).max(4),
});
export type LessonStep = z.infer<typeof LessonStepSchema>;

export const LessonRequestSchema = z.object({
  difficulty: z.enum(DIFFICULTIES),
  steps: z.array(LessonStepSchema).min(1).max(40),
  /** Every instruction line and note in the whole patch: the vocabulary the narrator may use. */
  patchText: z.string().max(60000),
  patchTags: z.array(z.string().max(120)).max(600),
});
export type LessonRequest = z.infer<typeof LessonRequestSchema>;

export const LessonSchema = z.object({
  step_id: z.string(),
  do: z.string(),
  why: z.string(),
  listen_for: z.string(),
  param_refs: z.array(z.string()),
});
export type Lesson = z.infer<typeof LessonSchema>;

export const ModelOutputSchema = z.object({ lessons: z.array(LessonSchema) });

export type LessonResult = { ok: true; lesson: Lesson; attempts: number } | { ok: false; problems: string[]; attempts: number };
export interface LessonResponse {
  results: Record<string, LessonResult>;
}
