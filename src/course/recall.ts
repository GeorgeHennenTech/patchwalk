// End-of-lesson recall (docs/LEARNING_RESEARCH.md: recalling beats re-reading, and the right answer must
// always follow). The learner types what they remember, takes a short quiz, and then sees the recap. Which
// recap points the quiz showed as shaky is kept, per browser, so those points can be brought back another
// day. Nothing is scored against the learner.
const KEY = "patchwalk.recall.v1";
type Store = Pick<Storage, "getItem" | "setItem">;
const local = (): Store | undefined => { try { return globalThis.localStorage; } catch { return undefined; } };

/** One go at recalling a lesson: when, and for each recap point whether it was remembered (undefined = not marked). */
export interface RecallRecord { at: number; had: (boolean | undefined)[] }
export type RecallLog = Record<string, RecallRecord>;

export function loadRecall(s: Pick<Storage, "getItem"> | undefined = local()): RecallLog {
  try {
    const v = JSON.parse(s?.getItem(KEY) ?? "{}") as RecallLog;
    return v && typeof v === "object" && !Array.isArray(v) ? v : {};
  } catch { return {}; }
}
export function saveRecall(lessonId: string, record: RecallRecord, s: Store | undefined = local()): void {
  try { s?.setItem(KEY, JSON.stringify({ ...loadRecall(s), [lessonId]: record })); } catch { /* not remembered */ }
}

/** The recap points a learner marked as missed the last time they recalled this lesson. */
export function missed(record: RecallRecord | undefined, recap: readonly string[]): string[] {
  return record ? recap.filter((_, i) => record.had[i] === false) : [];
}
/** A plain, kind line about the recap points, after the quiz: which came back and which to read again. */
export function recallNote(had: readonly (boolean | undefined)[]): string {
  const asked = had.filter((h) => h !== undefined).length, got = had.filter((h) => h === true).length, shaky = asked - got;
  if (asked === 0) return "";
  if (shaky === 0) return "Every point the quiz asked about came back to you.";
  if (got === 0) return "None of these came back yet, and that is normal straight after a first go: trying, then reading the answer, is what makes it stick. These points will come round again.";
  return `${got} of the ${asked} points the quiz asked about came back to you. The ${shaky === 1 ? "other is" : "others are"} marked to read again, and will come round another day.`;
}
