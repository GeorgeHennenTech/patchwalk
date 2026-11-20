// End-of-lesson quiz questions: three per lesson, each tied to one of the lesson's recap points. Written from
// each lesson's own text (nothing here should say something its lesson does not). A test checks their shape.
import a from "./quiz-a.json";
import b from "./quiz-b.json";
import c from "./quiz-c.json";
import d from "./quiz-d.json";
import e from "./quiz-e.json";
import f from "./quiz-f.json";
import g from "./quiz-g.json";

export interface QuizItem { q: string; options: string[]; /** index of the right option */ answer: number; /** one line stating the right idea */ why: string; /** which recap point this tests */ point: number }
export const QUIZ: Record<string, QuizItem[]> = { ...a, ...b, ...c, ...d, ...e, ...f, ...g };

/** The options in a mixed order that stays the same for one go: `order[k]` is the original index shown in place k. */
export function shuffled(n: number, seed: number): number[] {
  const order = Array.from({ length: n }, (_, i) => i); let s = (seed % 2147483646) + 1;
  for (let i = n - 1; i > 0; i--) { s = (s * 16807) % 2147483647; const j = s % (i + 1); [order[i], order[j]] = [order[j]!, order[i]!]; }
  return order;
}
/** For each recap point: true if every question on it was answered right, false if any was not, undefined if none asked. */
export function pointsHad(items: readonly QuizItem[], chosen: readonly (number | undefined)[], points: number): (boolean | undefined)[] {
  return Array.from({ length: points }, (_, p) => {
    const mine = items.map((it, i) => ({ it, i })).filter(({ it }) => it.point === p);
    return mine.length ? mine.every(({ it, i }) => chosen[i] === it.answer) : undefined;
  });
}
