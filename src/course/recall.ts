// End-of-lesson recall (docs/LEARNING_RESEARCH.md: recalling beats re-reading, and the right answer must
// always follow). The learner first tries to bring the lesson back from memory, then sees the recap and marks
// each point as one they had or one they had missed. What was missed is kept, per browser, so those points
// can be brought back another day. Nothing is scored against the learner.
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
/** A plain, kind line about how the recall went. Never a mark out of anything unless every point was marked. */
export function recallNote(had: readonly (boolean | undefined)[]): string {
  const marked = had.filter((h) => h !== undefined).length, got = had.filter((h) => h === true).length;
  if (marked === 0) return "Mark each point as one you had or one you had missed, if you like. It only helps choose what to bring back later.";
  if (marked < had.length) return `${got} of the ${marked} marked so far came back to you.`;
  if (got === had.length) return "All of it came back to you. That is the lesson, in your own head.";
  if (got === 0) return "None of it came back yet, and that is normal straight after a first go: trying, then reading the answer, is what makes it stick. These points will come round again.";
  return `${got} of ${had.length} came back to you. The ${had.length - got === 1 ? "one you missed is" : "ones you missed are"} worth one more read now; ${had.length - got === 1 ? "it" : "they"} will come round again.`;
}
