import { describe, expect, it } from "vitest";
import { beatsPerSecond, compOutDb, echoes, fmPartials, foldBack, foldDrive, foldedHarmonics, foldedSine } from "../src/synth/models";
import { cleanDrawing, DRAW_KINDS, DRAW_SYSTEM, type DrawModel } from "../src/library/draw";

describe("the maths behind the playable models", () => {
  it("compressor: untouched below the threshold, 1 dB out for every ratio dB in above it, plus make-up", () => {
    expect(compOutDb(-30, -18, 4)).toBe(-30); expect(compOutDb(-18, -18, 4)).toBe(-18); expect(compOutDb(-6, -18, 4)).toBe(-15);
    expect(compOutDb(-6, -18, 4, 6)).toBe(-9); expect(compOutDb(-6, -18, 1)).toBe(-6); expect(compOutDb(0, -20, 20)).toBe(-19);
    // an 18 dB gap between a loud and a quiet hit shrinks, and never grows
    for (const ratio of [1, 2, 4, 20]) expect(compOutDb(-6, -18, ratio) - compOutDb(-24, -18, ratio)).toBeLessThanOrEqual(18);
    expect(compOutDb(-6, -18, 4) - compOutDb(-24, -18, 4)).toBe(9);
  });
  it("delay: echoes come one delay time apart, each the one before times the feedback, and stop when too quiet or too late", () => {
    const e = echoes(300, 50, 100);
    expect(e[0]).toEqual({ t: 0, level: 1 });
    expect(e.slice(1, 4).map((x) => [Number(x.t.toFixed(3)), x.level])).toEqual([[0.3, 1], [0.6, 0.5], [0.9, 0.25]]);
    expect(e.every((x) => x.t < 3 && x.level >= 0.01)).toBe(true);
    expect(echoes(300, 50, 0)).toHaveLength(1); expect(echoes(300, 0, 50)).toHaveLength(2); expect(echoes(1000, 90, 100).length).toBe(3);
    expect(echoes(300, 50, 50)[1]!.level).toBe(0.5);
  });
  it("beating: the swelling is the difference between the two frequencies", () => {
    expect(beatsPerSecond(440, 0)).toBe(0); expect(beatsPerSecond(440, 1200)).toBeCloseTo(440, 9);
    expect(beatsPerSecond(220, 12)).toBeCloseTo(1.53, 2); expect(beatsPerSecond(440, 12)).toBeCloseTo(2 * beatsPerSecond(220, 12), 9);
  });
  it("FM: no amount leaves the note alone; more amount spreads strength into partials one modulator apart", () => {
    expect(fmPartials(220, 1, 0)).toEqual([{ hz: 220, level: 1 }]);
    const p = fmPartials(220, 3, 1);
    expect(p.map((x) => x.hz)).toEqual(expect.arrayContaining([220, 440, 880]));      // 440 is the partial that would have been at -440
    for (const x of p) expect((x.hz - 220) % 660 === 0 || (x.hz + 220) % 660 === 0).toBe(true);
    expect(p.find((x) => x.hz === 880)!.level).toBeCloseTo(0.44, 2);                 // J1(1)
    // at an index of about 2.4 the played note all but vanishes (J0's first zero)
    expect(fmPartials(220, 3.5, 2.405).find((x) => x.hz === 220)?.level ?? 0).toBeLessThan(0.01);
    expect(fmPartials(220, 1, 6).length).toBeGreaterThan(fmPartials(220, 1, 1).length);
  });
  it("folding: inside the limits nothing changes, outside the wave is turned back, and folding adds odd harmonics", () => {
    for (const x of [-1, -0.4, 0, 0.7, 1]) expect(foldBack(x)).toBeCloseTo(x, 12);
    expect(foldBack(1.5)).toBeCloseTo(0.5, 12); expect(foldBack(3)).toBeCloseTo(-1, 12); expect(foldBack(-1.5)).toBeCloseTo(-0.5, 12); expect(foldBack(5)).toBeCloseTo(1, 12);
    for (let x = -7; x <= 7; x += 0.13) expect(Math.abs(foldBack(x))).toBeLessThanOrEqual(1 + 1e-12);
    expect(foldDrive(0)).toBe(1); expect(foldDrive(100)).toBe(6);
    expect(foldedSine(0.25, 0)).toBeCloseTo(1, 9);
    const none = foldedHarmonics(0), some = foldedHarmonics(60);
    expect(none[0]).toBe(1); expect(none.slice(1).every((h) => h < 1e-3)).toBe(true);
    expect(Math.max(some[2]!, some[4]!, some[6]!)).toBeGreaterThan(0.2); expect([some[1]!, some[3]!, some[5]!].every((h) => h < 1e-3)).toBe(true); // odd harmonics appear; the even ones do not
  });
  it("the guide can choose each model, and its settings are held to the model's own ranges", () => {
    const raw = (kind: DrawModel["kind"], variables: DrawModel["variables"] = []): DrawModel => ({ kind, title: "T", caption: "c", expression: "", outputLabel: "", outputUnit: "", xVariable: "", variables, choice: "", stages: [] });
    for (const kind of ["compressor", "delay", "beating", "fm", "fold"] as const) { expect(DRAW_KINDS).toContain(kind); expect(DRAW_SYSTEM).toContain(`- ${kind}:`); expect(cleanDrawing(raw(kind)).kind).toBe(kind); }
    expect(cleanDrawing(raw("compressor", [{ name: "ratio", label: "", unit: "", min: 0, max: 0, value: 99, stated: true }, { name: "threshold", label: "", unit: "", min: 0, max: 0, value: -24, stated: true }])).variables.map((v) => [v.name, v.value, v.stated]))
      .toEqual([["threshold", -24, true], ["ratio", 20, false], ["makeup", 0, false]]);
    expect(cleanDrawing(raw("fm")).variables.map((v) => v.name)).toEqual(["amount", "ratio", "note"]);
  });
});
