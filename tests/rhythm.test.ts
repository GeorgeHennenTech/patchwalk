import { describe, expect, it } from "vitest";
import { EXERCISES, ON, clicksBetween, cycleSeconds, even, hasIt, inWords, judge, phaseAt, summary, verdict } from "../src/rhythm/count";

describe("counting: cycles, clicks and taps", () => {
  it("every exercise has rising hits inside the cycle, a count for each, and a layer to tap", () => {
    expect(new Set(EXERCISES.map((e) => e.id)).size).toBe(EXERCISES.length);
    for (const e of EXERCISES) {
      expect(e.layers.length).toBeGreaterThan(0); expect(e.layers[e.tap]).toBeDefined(); expect(e.idea.length).toBeGreaterThan(40);
      for (const l of e.layers) { expect(l.count).toHaveLength(l.hits.length); expect(l.hits[0]).toBe(0); l.hits.forEach((h, i) => { expect(h).toBeGreaterThanOrEqual(0); expect(h).toBeLessThan(1); if (i) expect(h).toBeGreaterThan(l.hits[i - 1]!); }); }
    }
  });
  it("three against two meet only at the start; four against three likewise", () => {
    const meet = (a: number, b: number) => even("a", a).hits.filter((h) => even("b", b).hits.some((x) => Math.abs(x - h) < 1e-9));
    expect(meet(3, 2)).toEqual([0]); expect(meet(4, 3)).toEqual([0]);
  });
  it("a cycle is four beats long, and a moment's place in it wraps round", () => {
    expect(cycleSeconds(120)).toBe(2); expect(cycleSeconds(60)).toBe(4);
    expect(phaseAt(5, 1, 2)).toBeCloseTo(0); expect(phaseAt(2.5, 1, 2)).toBeCloseTo(0.75); expect(phaseAt(0.5, 1, 2)).toBeCloseTo(0.75);
  });
  it("a tap is judged against the nearest click, early or late, round the end of the cycle too", () => {
    const three = even("Three", 3), cycle = 3;                 // clicks at 0 s, 1 s, 2 s
    expect(judge(three, 1.02 / 3, cycle)).toMatchObject({ hit: 1 }); expect(judge(three, 1.02 / 3, cycle).off).toBeCloseTo(0.02);
    expect(judge(three, 0.9 / 3, cycle).off).toBeCloseTo(-0.1);
    const late = judge(three, 2.97 / 3, cycle);                // just before the next cycle's first click
    expect(late.hit).toBe(0); expect(late.off).toBeCloseTo(-0.03);
    expect(verdict(0.02)).toBe("on"); expect(verdict(-ON - 0.01)).toBe("early"); expect(verdict(ON + 0.01)).toBe("late");
    expect(inWords(-0.1)).toBe("100 ms early"); expect(inWords(0.012)).toBe("on it (12 ms)");
  });
  it("sums a run up and says when the learner has it", () => {
    expect(summary([0.01, -0.02, 0.1])).toMatchObject({ on: 2, of: 3 }); expect(summary([0.02, 0.04]).lean).toBeCloseTo(0.03);
    expect(hasIt(Array.from({ length: 15 }, () => 0))).toBe(false);
    expect(hasIt(Array.from({ length: 16 }, (_, i) => (i < 3 ? 0.2 : 0.01)))).toBe(true);
    expect(hasIt(Array.from({ length: 16 }, (_, i) => (i < 4 ? 0.2 : 0.01)))).toBe(false);
    expect(hasIt([...Array.from({ length: 30 }, () => 0.3), ...Array.from({ length: 16 }, () => 0)])).toBe(true);
  });
  it("hands the audio clock every click in a stretch of time, once each", () => {
    const layers = [even("Two", 2), even("Three", 3)], all = clicksBetween(layers, 10, 6, 10, 22);   // two cycles of 6 s
    expect(all.filter((c) => c.layer === 0).map((c) => c.at)).toEqual([10, 13, 16, 19]);
    expect(all.filter((c) => c.layer === 1).map((c) => c.at)).toEqual([10, 12, 14, 16, 18, 20]);
    const a = clicksBetween(layers, 10, 6, 10, 15), b = clicksBetween(layers, 10, 6, 15, 22);
    expect(a.length + b.length).toBe(all.length);
  });
});
