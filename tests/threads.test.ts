import { describe, expect, it } from "vitest";
import { canBranch, contextFor, depthOf, dropThread, historyFor, pathTo, quoteOf, startThread, stepsWithThreads, MAX_DEPTH, MAX_QUOTE, MAX_THREADS, type Thread } from "../src/guide/threads";
import { joinShared, type Walk } from "../src/guide/walk";
import type { AskOutcome } from "../src/guide/ask";

const ok = (text: string): AskOutcome => ({ kind: "ok", answer: { covered: true, segments: [{ text, sources: [] }], sources: [] } });
const turn = (q: string, a?: string) => ({ question: q, ...(a ? { outcome: ok(a) } : {}) });

describe("side threads on a walkthrough", () => {
  it("highlighted words become a tidy quote, or nothing if there is too little", () => {
    expect(quoteOf("  the  loss\nfilter ")).toBe("the loss filter"); expect(quoteOf(" a ")).toBeUndefined();
    const long = quoteOf("x".repeat(900))!; expect(long.length).toBe(MAX_QUOTE); expect(long.endsWith("…")).toBe(true);
  });
  const a = { ...startThread([], { step: 2 }, "loss filter", "a"), turns: [turn("Why do highs die first?", "Because of the loss filter."), turn("And lows?", "They last.")] };
  const b = { ...startThread([a], { thread: "a", turn: 0 }, "the loss filter", "b"), turns: [turn("What is a one-pole filter?", "A simple low-pass.")] };
  const c = { ...startThread([a, b], { thread: "b", turn: 0 }, "low-pass", "c"), turns: [turn("unanswered")] };
  const other = { ...startThread([a, b, c], { step: 2 }, "decay", "o"), turns: [turn("A different rabbit hole?", "Yes.")] };
  const all: Thread[] = [a, b, c, other];
  it("a branch hangs off one answer of its parent, stays on its step, and wears its own colour", () => {
    expect(b).toMatchObject({ step: 2, parent: { id: "a", turn: 0 }, quote: "the loss filter" });
    expect(new Set(all.map((t) => t.colour)).size).toBe(4);
    expect(depthOf(all, "a")).toBe(1); expect(depthOf(all, "c")).toBe(3);
    expect(pathTo(all, "c").map((t) => t.id)).toEqual(["a", "b", "c"]); expect(pathTo(all, undefined)).toEqual([]);
    expect([...stepsWithThreads(all)]).toEqual([2]);
  });
  it("goes three deep and no further, and a walkthrough holds only so many", () => {
    expect(MAX_DEPTH).toBe(3);
    expect(canBranch(all, { thread: "b", turn: 0 }).ok).toBe(true); expect(canBranch(all, { thread: "c", turn: 0 })).toMatchObject({ ok: false });
    expect(canBranch(all, { step: 0 }).ok).toBe(true);
    expect(canBranch(Array.from({ length: MAX_THREADS }, (_, i) => ({ ...a, id: `x${i}` })), { step: 0 })).toMatchObject({ ok: false });
  });
  it("a branch is told only its own path: the parent's turns up to the answer it left from, never a neighbour's", () => {
    expect(historyFor(all, "b").map((h) => h.question)).toEqual(["Why do highs die first?", "What is a one-pole filter?"]); // not "And lows?", asked after the branch point
    expect(historyFor(all, "c").map((h) => h.question)).toEqual(["Why do highs die first?", "What is a one-pole filter?"]); // its own unanswered turn is not history
    expect(historyFor(all, "a").map((h) => h.question)).toEqual(["Why do highs die first?", "And lows?"]);
    for (const id of ["a", "b", "c"]) expect(historyFor(all, id).some((h) => h.question.includes("rabbit hole"))).toBe(false);
    expect(historyFor(all, "b")[0]!.answer).toBe("Because of the loss filter.");
  });
  it("the search is steered by the step and the highlighted words, and the step's own words go along", () => {
    const ctx = contextFor("A plucked string", "Loss is tone", "TEXT: The loop loses highs first.", b);
    expect(ctx.split("\n")[0]).toBe("Loss is tone: the loss filter");
    expect(ctx).toContain('highlighted these words to ask about: "the loss filter"'); expect(ctx).toContain("The loop loses highs first."); expect(ctx.length).toBeLessThanOrEqual(2000);
    expect(contextFor("W", "S", "y".repeat(5000), b).length).toBe(2000);
  });
  it("deleting a thread takes its branches with it and leaves neighbours alone", () => {
    expect(dropThread(all, "a").map((t) => t.id)).toEqual(["o"]); expect(dropThread(all, "b").map((t) => t.id)).toEqual(["a", "o"]); expect(dropThread(all, "c").map((t) => t.id)).toEqual(["a", "b", "o"]);
  });
  it("threads stay with the learner's copy when a walkthrough is opened from the library, unless its steps changed", () => {
    const steps = [{ title: "One", find: "xx", kind: "idea" as const }, { title: "Two", find: "yy", kind: "recipe" as const }];
    const doc = { id: "a".repeat(24), question: "q?", title: "T", tool: "serum" as const, by: "Ada", at: "x", updated: "y", steps };
    const local: Walk = { id: doc.id, question: "q?", title: "T", tool: "serum", at: 0, savedAt: "z", steps, threads: all };
    expect(joinShared(doc, local).threads).toHaveLength(4);
    expect(joinShared(doc).threads).toBeUndefined();
    expect(joinShared({ ...doc, steps: [{ ...steps[0]!, title: "Changed" }, steps[1]!] }, local).threads).toBeUndefined();
  });
});
