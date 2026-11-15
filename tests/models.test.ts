import { describe, expect, it } from "vitest";
import { DRUM_LESSONS, STRING_LESSONS, type ModelLesson } from "../src/models/lessons";
import { DRUM_INITIAL } from "../src/modal/membrane";
import { STRING_INITIAL } from "../src/strings/string";

function sound<S>(lessons: ModelLesson<S>[], initial: S) {
  for (const l of lessons) {
    const start = { ...initial, ...l.initial };
    expect(l.steps.length, l.id).toBeGreaterThanOrEqual(3); expect(l.recap.length, l.id).toBe(3); expect(l.idea.length, l.id).toBe(2);
    // nothing is passed before the model has been played, and the first step is not passed by just playing unless it says so
    for (const s of l.steps) expect(s.check(start, { plays: 0, notes: [] }), `${l.id}: ${s.do}`).toBe(false);
    for (const s of l.steps.slice(1)) expect(s.check(start, { plays: 1, notes: [45] }), `${l.id}: ${s.do}`).toBe(false);
    expect(l.quiz.length, l.id).toBeGreaterThanOrEqual(3);
    expect(new Set(l.quiz.map((q) => q.point)).size, l.id).toBe(l.recap.length); // every recap point is asked about
    for (const q of l.quiz) {
      expect(q.options.length).toBe(4); expect(new Set(q.options).size).toBe(4); expect([0, 1, 2, 3]).toContain(q.answer);
      expect([q.q, q.why, ...q.options].join(" ")).not.toMatch(/[—–]|\bQ\d\.\d|all of the above|none of the above/i);
    }
    const shown = [l.title, l.outcome, ...l.idea, ...l.recap, ...l.steps.flatMap((s) => [s.do, s.hear, s.target])].join(" ");
    expect(shown, l.id).not.toMatch(/[—–]|\bQ\d\.\d|\bC\d+\.\d/);
  }
  expect(new Set(lessons.map((l) => l.id)).size).toBe(lessons.length);
}

describe("lessons on the physical models", () => {
  it("string lessons are well formed and none passes a step before it is done", () => sound(STRING_LESSONS, STRING_INITIAL));
  it("drum lessons are well formed and none passes a step before it is done", () => sound(DRUM_LESSONS, DRUM_INITIAL));
  it("each step can be passed by doing what it says", () => {
    const P = { plays: 1, notes: [45] };
    expect(STRING_LESSONS[0]!.steps[1]!.check({ ...STRING_INITIAL, exciter: "noise" }, { plays: 3, notes: [45, 48, 52] })).toBe(true);
    expect(STRING_LESSONS[1]!.steps[0]!.check({ ...STRING_INITIAL, bright: 5 }, P)).toBe(true);
    expect(STRING_LESSONS[2]!.steps[2]!.check({ ...STRING_INITIAL, pick: 33 }, P)).toBe(true);
    expect(STRING_LESSONS[3]!.steps[2]!.check({ ...STRING_INITIAL, pickup: 0, pair: 8 }, P)).toBe(true);
    expect(DRUM_LESSONS[0]!.steps[0]!.check({ ...DRUM_INITIAL, strike: 0 }, P)).toBe(true);
    expect(DRUM_LESSONS[1]!.steps[2]!.check({ ...DRUM_INITIAL, head: "square", strike: 50 }, P)).toBe(true);
  });
});
