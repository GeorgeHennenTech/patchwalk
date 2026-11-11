// Generate -> validate -> regenerate loop. The model call is injected so this is testable offline.
import { ModelOutputSchema, type Difficulty, type Lesson, type LessonRequest, type LessonResponse, type LessonResult, type LessonStep } from "./contract.js";
import { validateLesson, type PatchVocabulary } from "./validator.js";

export type ModelCall = (args: { difficulty: Difficulty; steps: LessonStep[]; patchText: string; feedback?: Record<string, string[]> }) => Promise<unknown>;

export const MAX_ATTEMPTS = 3;

export async function generateLessons(req: LessonRequest, callModel: ModelCall): Promise<LessonResponse> {
  const patch: PatchVocabulary = { text: req.patchText, tags: new Set(req.patchTags) };
  const results: Record<string, LessonResult> = {};
  let pending = req.steps;
  let feedback: Record<string, string[]> | undefined;

  for (let attempt = 1; attempt <= MAX_ATTEMPTS && pending.length; attempt++) {
    let lessons: Lesson[] = [];
    let failure: string | undefined;
    try {
      const parsed = ModelOutputSchema.safeParse(await callModel({ difficulty: req.difficulty, steps: pending, patchText: req.patchText, feedback }));
      if (parsed.success) lessons = parsed.data.lessons;
      else failure = "The response did not match the required JSON shape.";
    } catch (e) {
      failure = e instanceof Error ? e.message : "The model call failed.";
    }

    const next: LessonStep[] = [];
    const nextFeedback: Record<string, string[]> = {};
    for (const step of pending) {
      const lesson = lessons.find((l) => l.step_id === step.id);
      const problems = lesson ? validateLesson(step, lesson, patch) : [failure ?? "No lesson was returned for this step."];
      if (lesson && problems.length === 0) {
        results[step.id] = { ok: true, lesson, attempts: attempt };
      } else {
        results[step.id] = { ok: false, problems, attempts: attempt };
        next.push(step);
        nextFeedback[step.id] = problems;
      }
    }
    pending = next;
    feedback = nextFeedback;
  }
  return { results };
}
