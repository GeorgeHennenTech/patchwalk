// Browser side of "Build this lesson in Serum 2". Sends the lesson's own wording (its title, outcome and what
// each step asks for) and gets back the same lesson as steps for Serum 2. Looking whether one has been built
// is free; building one is a paid call, made once, after which everyone signed in gets it from the database.
import { guideHeaders } from "./me";
import type { PlayableLesson as Lesson } from "../course/types";
import type { StepBody } from "../library/walk";

export interface SerumLesson extends StepBody { built: boolean; by?: string; at?: string; message?: string }
export type SerumOutcome = { kind: "ok"; value: SerumLesson } | { kind: "unavailable"; message: string };

/** What is sent about a lesson: only what the learner is asked to do, never the app's checks. */
export const lessonForSerum = (lesson: Pick<Lesson, "id" | "title" | "outcome" | "steps">, chapter?: string) => ({
  lesson: lesson.id, title: lesson.title, ...(chapter ? { chapter } : {}), ...(lesson.outcome ? { outcome: lesson.outcome.slice(0, 500) } : {}),
  steps: lesson.steps.slice(0, 16).map((s) => s.do.slice(0, 700)),
});

export async function serumLesson(lesson: Pick<Lesson, "id" | "title" | "outcome" | "steps">, chapter: string | undefined, how: { peek?: boolean; fresh?: boolean } = {}, fetchImpl: typeof fetch = fetch): Promise<SerumOutcome> {
  let res: Response;
  try { res = await fetchImpl("/api/serum", { method: "POST", headers: guideHeaders(), body: JSON.stringify({ ...lessonForSerum(lesson, chapter), ...how }) }); } catch { return { kind: "unavailable", message: "Could not reach the guide." }; }
  const data = (await res.json().catch(() => undefined)) as (SerumLesson & { message?: string }) | undefined;
  if (!res.ok || !data) return { kind: "unavailable", message: data?.message ?? `The guide returned an error (${res.status}).` };
  return { kind: "ok", value: data };
}
