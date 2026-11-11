// Rule 5: the narrator may only talk about values and settings that are in the parsed patch.
// This runs on the server before a lesson is returned, and again in the browser before it is shown.
import type { Lesson, LessonStep } from "./contract.js";
import { VOCAB } from "./vocab.js";

const NUMBER = /(?<![A-Za-z0-9_.])[-+−]?\d+(?:[.,]\d+)?/g;
const WORDS: Record<string, number> = {
  two: 2, three: 3, four: 4, five: 5, six: 6, seven: 7, eight: 8, nine: 9, ten: 10, eleven: 11, twelve: 12,
  sixteen: 16, twenty: 20, fifty: 50, hundred: 100,
};
const WORD_RE = new RegExp(`\\b(${Object.keys(WORDS).join("|")})\\b`, "gi");
export const MAX_FIELD_CHARS = 700;

/** Numbers as magnitudes, so "-2 oct" in the patch allows "2 octaves down" in prose. */
export function numbersIn(text: string): number[] {
  const out: number[] = [];
  for (const m of text.matchAll(NUMBER)) out.push(Math.abs(Number(m[0].replace("−", "-").replace(",", "."))));
  return out;
}

function numberWordsIn(text: string): { word: string; value: number }[] {
  return [...text.matchAll(WORD_RE)].map((m) => ({ word: m[0], value: WORDS[m[0].toLowerCase()]! }));
}

export function allowedText(step: LessonStep): string {
  return [step.title, step.goal, ...step.lines, ...step.notes, ...step.facts.map((f) => `${f.label} ${f.value}`)].join("\n");
}

export interface PatchVocabulary {
  /** All instruction text for the whole patch. */
  text: string;
  tags: Set<string>;
}

export function validateLesson(step: LessonStep, lesson: Lesson, patch: PatchVocabulary): string[] {
  const problems: string[] = [];
  if (lesson.step_id !== step.id) problems.push(`step_id "${lesson.step_id}" does not match "${step.id}".`);

  const fields: [string, string][] = [["do", lesson.do], ["why", lesson.why], ["listen_for", lesson.listen_for]];
  for (const [name, value] of fields) {
    if (!value.trim()) problems.push(`"${name}" is empty.`);
    if (value.length > MAX_FIELD_CHARS) problems.push(`"${name}" is longer than ${MAX_FIELD_CHARS} characters.`);
  }

  const factIds = new Set(step.facts.map((f) => f.id));
  for (const ref of lesson.param_refs) if (!factIds.has(ref)) problems.push(`param_refs cites "${ref}", which is not a fact of this step.`);
  if (step.facts.length > 0 && lesson.param_refs.length === 0) problems.push("param_refs is empty; cite the facts the text relies on.");

  const allowed = new Set(numbersIn(allowedText(step)));
  for (const [name, value] of fields) {
    for (const n of numbersIn(value)) {
      if (!allowed.has(n)) problems.push(`"${name}" mentions the number ${n}, which is not a value in this step.`);
    }
    for (const { word, value: n } of numberWordsIn(value)) {
      if (!allowed.has(n)) problems.push(`"${name}" mentions "${word}", which is not a value in this step.`);
    }
    for (const entry of VOCAB) {
      if (!entry.re.test(value)) continue;
      const inPatch = entry.tags.some((t) => patch.tags.has(t)) || entry.re.test(patch.text);
      if (!inPatch) problems.push(`"${name}" mentions ${entry.term}, which this patch does not use.`);
    }
  }
  return [...new Set(problems)];
}
