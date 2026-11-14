// Browser side of the lesson call. Sends rendered instructions and cards — never the preset.
import { guideHeaders } from "../guide/me.js";
import type { Card } from "./cards";
import { cardsFor } from "./cards";
import type { Difficulty, Lesson, LessonRequest, LessonResponse, LessonStep } from "./contract";
import type { RenderedStep } from "./render";
import { validateLesson } from "./validator";

export function toLessonStep(step: RenderedStep, cards: Card[]): LessonStep {
  return {
    id: step.id, stage: step.stage, title: step.title, goal: step.goal,
    lines: step.lines.map((l) => l.text), notes: step.notes,
    facts: step.facts.map((f) => ({ id: f.id, label: `${f.moduleLabel} ${f.label}${f.known ? "" : " (not interpreted)"}`.trim(), value: f.display.text })),
    cards: cardsFor(step, cards).map((c) => ({ id: c.id, title: c.title, body: c.body })),
  };
}

export function buildRequest(steps: RenderedStep[], cards: Card[], difficulty: Difficulty): LessonRequest | undefined {
  const all = steps.map((s) => toLessonStep(s, cards));
  // Steps without a knowledge card get no "why": the narrator must not improvise one.
  const withCards = all.filter((s) => s.cards.length > 0 && s.facts.length > 0);
  if (!withCards.length) return undefined;
  return {
    difficulty,
    steps: withCards,
    patchText: all.flatMap((s) => [s.title, ...s.lines, ...s.notes]).join("\n"),
    patchTags: [...new Set(steps.flatMap((s) => s.facts.flatMap((f) => f.tags)))],
  };
}

export type LessonOutcome =
  | { kind: "ok"; lessons: Record<string, Lesson>; rejected: Record<string, string[]> }
  | { kind: "unavailable"; message: string };

const BATCH = 12;

export async function fetchLessons(req: LessonRequest, fetchImpl: typeof fetch = fetch): Promise<LessonOutcome> {
  const lessons: Record<string, Lesson> = {};
  const rejected: Record<string, string[]> = {};
  const patch = { text: req.patchText, tags: new Set(req.patchTags) };
  for (let i = 0; i < req.steps.length; i += BATCH) {
    const batch = req.steps.slice(i, i + BATCH);
    let res: Response;
    try {
      res = await fetchImpl("/api/lesson", { method: "POST", headers: guideHeaders(), body: JSON.stringify({ ...req, steps: batch }) });
    } catch {
      return { kind: "unavailable", message: "Could not reach the explanation service." };
    }
    if (!res.ok) {
      const body = (await res.json().catch(() => ({}))) as { message?: string };
      return { kind: "unavailable", message: body.message ?? `The explanation service returned an error (${res.status}).` };
    }
    const data = (await res.json()) as LessonResponse;
    for (const step of batch) {
      const r = data.results?.[step.id];
      if (!r) { rejected[step.id] = ["No explanation was returned."]; continue; }
      if (!r.ok) { rejected[step.id] = r.problems; continue; }
      // Never trust the server blindly: re-run the validator before showing anything.
      const problems = validateLesson(step, r.lesson, patch);
      if (problems.length) rejected[step.id] = problems;
      else lessons[step.id] = r.lesson;
    }
  }
  return { kind: "ok", lessons, rejected };
}
