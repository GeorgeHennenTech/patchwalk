// Focus mode: a per-browser switch for learners who lose their place easily (see docs/LEARNING_RESEARCH.md,
// section B). It keeps time and steps left in view, remembers exactly where the learner was, and marks a
// good place to stop after each lesson. Nothing here punishes: there are no streaks to lose.
import type { PlayableLesson } from "./types";

const FOCUS = "patchwalk.focus.v1", PLACE = "patchwalk.place.v1";
type Store = Pick<Storage, "getItem" | "setItem" | "removeItem">;
const local = (): Store | undefined => { try { return globalThis.localStorage; } catch { return undefined; } };

export const focusOn = (s: Pick<Storage, "getItem"> | undefined = local()): boolean => { try { return s?.getItem(FOCUS) === "on"; } catch { return false; } };
export function setFocus(on: boolean, s: Store | undefined = local()): void { try { s?.setItem(FOCUS, on ? "on" : "off"); } catch { /* not remembered */ } }

/** Where the learner was: the lesson, the step, the synth's settings at that moment, and when. */
export interface Place { lessonId: string; stepIndex: number; state: Record<string, unknown>; at: number }
export function savePlace(p: Place | undefined, s: Store | undefined = local()): void {
  try { if (p) s?.setItem(PLACE, JSON.stringify(p)); else s?.removeItem(PLACE); } catch { /* not remembered */ }
}
/** The saved place, if it still makes sense: the lesson exists, is unfinished, and the step is one of its steps. */
export function loadPlace(lessons: readonly PlayableLesson[], done: readonly string[], s: Pick<Storage, "getItem"> | undefined = local()): Place | undefined {
  try {
    const p = JSON.parse(s?.getItem(PLACE) ?? "null") as Place | null;
    if (!p || typeof p.lessonId !== "string" || typeof p.stepIndex !== "number" || typeof p.state !== "object" || !p.state) return undefined;
    const lesson = lessons.find((l) => l.id === p.lessonId);
    if (!lesson || done.includes(lesson.id) || p.stepIndex < 0 || p.stepIndex >= lesson.steps.length) return undefined;
    return p;
  } catch { return undefined; }
}

/** The parts of a lesson that take time: each step, each match-by-ear round, and an ear check counted as two. */
const units = (l: PlayableLesson) => l.steps.length + (l.rounds?.length ?? 0) + (l.earCheck ? 2 : 0);
/** Roughly how many minutes of a lesson are left, from its stated length and how much of it is done. Never less than one while anything is left. */
export function minutesLeft(lesson: PlayableLesson, unitsDone: number): number {
  const all = units(lesson), left = Math.max(0, all - unitsDone);
  return left === 0 || all === 0 ? 0 : Math.max(1, Math.round((lesson.minutes * left) / all));
}
export const unitsIn = units;

/** How long ago, in plain words. */
export function ago(then: number, now: number): string {
  const min = Math.round((now - then) / 60000);
  if (min < 2) return "a moment ago";
  if (min < 60) return `${min} minutes ago`;
  const h = Math.round(min / 60);
  if (h < 24) return h === 1 ? "an hour ago" : `${h} hours ago`;
  const d = Math.round(h / 24);
  return d === 1 ? "yesterday" : `${d} days ago`;
}

/** What to say when a lesson is finished: always a good place to stop; after two in one sitting, a nudge to move. */
export function stopNote(finishedThisSitting: number): { title: string; text: string } {
  if (finishedThisSitting >= 2) return { title: "A good place to stop", text: `That is ${finishedThisSitting} lessons in this sitting. Stand up and move for a couple of minutes before another one: it helps the next one go in. Everything is saved.` };
  return { title: "A good place to stop", text: "This lesson is finished and saved. Stopping here loses nothing; so does carrying on." };
}
