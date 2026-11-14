// What the learner has finished, and what to suggest next. Code decides the suggestion; the guide only
// phrases around it. Stored in the browser as a convenience: the course works without it.
import type { PlayableLesson } from "./types";

const KEY = "patchwalk.play.done";

export function loadDone(storage: Pick<Storage, "getItem"> | undefined = globalThis.localStorage): string[] {
  try {
    const v = JSON.parse(storage?.getItem(KEY) ?? "[]");
    return Array.isArray(v) ? v.filter((x) => typeof x === "string") : [];
  } catch {
    return [];
  }
}
/** Called after finished lessons change, so they can be copied to the site's database. Set by the app. */
let changed: () => void = () => {};
export const onProgressChanged = (fn: () => void) => { changed = fn; };
export function saveDone(ids: string[], storage: Pick<Storage, "setItem"> | undefined = globalThis.localStorage, report = false): void {
  try {
    storage?.setItem(KEY, JSON.stringify(ids));
    if (report) changed();
  } catch {
    /* private window or blocked storage: progress is just not remembered */
  }
}

/** The first unfinished lesson whose prerequisites are all done; failing that, the first unfinished one. */
export function suggestNext(lessons: PlayableLesson[], done: string[]): PlayableLesson | undefined {
  const open = lessons.filter((l) => !done.includes(l.id));
  return open.find((l) => l.buildsOn.every((b) => done.includes(b))) ?? open[0];
}

/** A short, factual note for the guide about where the learner is. First line is the topic. */
export function guideContext(lesson: PlayableLesson, stepIndex: number, settings: string, lessons: PlayableLesson[], done: string[]): string {
  const step = lesson.steps[Math.min(stepIndex, lesson.steps.length - 1)];
  const finished = lessons.filter((l) => done.includes(l.id)).map((l) => l.title);
  return [
    `${lesson.title}`,
    step
      ? `Practice-synth lesson ${lesson.id}. The learner is on step ${Math.min(stepIndex + 1, lesson.steps.length)} of ${lesson.steps.length}: ${step.do}`
      : `Practice-synth lesson ${lesson.id}: a match-by-ear challenge with a hidden target sound.`,
    `Practice synth settings right now: ${settings}.`,
    finished.length ? `Lessons already finished: ${finished.join("; ")}.` : "No lessons finished yet.",
    "The practice synth is this app's own teaching instrument, not Serum.",
  ].join("\n");
}
