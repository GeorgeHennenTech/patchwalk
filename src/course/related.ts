// Which practice lessons cover the topic of a question. Chosen by code from the lessons' own words, so the
// guide can point to a lesson without the model deciding anything.
import { tokenize } from "../library/search";
import type { PlayableLesson } from "./types";

/** Words too common across lessons to tell one from another. */
const COMMON = new Set(["sound", "note", "synth", "play", "hear", "tone", "make", "use", "one", "two", "set", "serum", "knob", "control", "change", "work", "mean"]);

/** Trim common endings so "detuned", "detune" and "detuning" count as one word. */
const stem = (t: string) => (t.length > 4 ? t.replace(/(ing|ed|es|e|d)$/, "") : t);
const words = (text: string) => new Set(tokenize(text).filter((t) => !COMMON.has(t) && !/^\d+$/.test(t)).map(stem));

/**
 * Up to `max` lessons whose subject matches the question. A word in the title counts most; words in what the
 * lesson teaches count a little. One stray title word is not enough ("track" must not bring up "Key tracking"):
 * a lesson is offered when its whole title is in the question, or a title word plus more.
 */
export function relatedLessons(question: string, lessons: PlayableLesson[], max = 2): PlayableLesson[] {
  const asked = words(question);
  if (asked.size === 0) return [];
  return lessons
    .map((lesson) => {
      const title = words(lesson.title), body = words([lesson.outcome, ...lesson.idea, ...lesson.recap].join(" "));
      let score = 0;
      for (const w of asked) score += title.has(w) ? 3 : body.has(w) ? 1 : 0;
      return { lesson, score, whole: [...title].every((w) => asked.has(w)) };
    })
    .filter((x) => x.score >= 4 || (x.whole && x.score >= 3))
    .sort((a, b) => b.score - a.score)
    .slice(0, max)
    .map((x) => x.lesson);
}
