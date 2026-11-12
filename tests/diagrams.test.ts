import { describe, expect, it } from "vitest";
import { analyze } from "../src/flow/build";
import { diagramsFor, type EnvelopeDiagram, type ShapeDiagram } from "../src/flow/diagrams";
import { INIT_BASELINE } from "../src/patch/baseline";
import { analyzeFile, has, PACK, probe } from "./fixtures";

const all = (a: ReturnType<typeof analyze>) => {
  const byId = new Map(a.modules.map((m) => [m.id, m]));
  return a.steps.flatMap((s) => diagramsFor(s, byId).map((d) => [s.id, d] as const));
};

describe("diagrams are computed from stored values", () => {
  it("draws the amp envelope with known stages solid and defaults dashed", () => {
    const a = analyze(probe((r) => (r.Env0.plainParams = { ...r.Env0.plainParams, kParamAttack: 0.25, kParamSustain: 0.5 })), INIT_BASELINE);
    const [stepId, d] = all(a)[0]! as [string, EnvelopeDiagram];
    expect(stepId).toBe("contour:Env0");
    expect(d.segments.map((s) => [s.name, s.label, s.isDefault])).toEqual([
      ["A", "A 250 ms", false], ["D", "D default", true], ["S", "S 0.5", false], ["R", "R default", true],
    ]);
    // sustain 0.5 sits halfway up; the trace is continuous and ends on the floor
    expect(d.segments[2]!.from[1]).toBe(d.height / 2);
    for (let i = 1; i < d.segments.length; i++) expect(d.segments[i]!.from).toEqual(d.segments[i - 1]!.to);
    expect(d.segments.at(-1)!.to).toEqual([d.width, d.height]);
  });
  it("a longer time is drawn wider", () => {
    const w = (attack: number) => (all(analyze(probe((r) => (r.Env0.plainParams = { ...r.Env0.plainParams, kParamAttack: attack })), INIT_BASELINE))[0]![1] as EnvelopeDiagram).segments[0]!.to[0];
    expect(w(2)).toBeGreaterThan(w(0.05));
    expect(w(0.05)).toBeGreaterThan(w(0.001));
  });
  it("no envelope diagram when only curves are stored (as in Init), and none for unused envelopes", () => {
    expect(all(analyze(probe(() => {}), INIT_BASELINE))).toEqual([]);
    expect(all(analyze(probe((r) => (r.Env2.plainParams = { ...r.Env2.plainParams, kParamAttack: 1 })), INIT_BASELINE))).toEqual([]);
  });
  it("draws a stored LFO shape point for point, and skips malformed curve data", () => {
    const withShape = (curveData: object) => analyze(probe((r) => {
      r.LFO0 = { ...r.LFO0, curveData };
      r.ModSlot0 = { plainParams: { kParamAmount: 50 }, source: [6, 0], destModuleID: 0, destModuleParamID: 0, destModuleParamName: "kParamVolume", destModuleTypeString: "Oscillator" };
    }), INIT_BASELINE);
    const d = all(withShape({ numPoints: 2, xVals: [0, 0.5, 1], yVals: [1, 0, 1], curveVals: [0.5, 0.5, 0.5] }))[0]![1] as ShapeDiagram;
    expect(d.points).toEqual([[0, d.height], [d.width / 2, 0], [d.width, d.height]]);
    expect(all(withShape({ xVals: [0, 1], yVals: [1] }))).toEqual([]);
    expect(all(withShape({ xVals: [0, "x"], yVals: [1, 0] }))).toEqual([]);
  });
  it.skipIf(!has(PACK.hype))("70s hype: the filter envelope is drawn on its motion step", () => {
    const found = all(analyzeFile(PACK.hype));
    expect(found.map(([id, d]) => [id, d.title])).toEqual([["motion:source3", "Env 2 shape"]]);
    expect((found[0]![1] as EnvelopeDiagram).segments.map((s) => s.label)).toEqual(["A 65.4 ms", "D 6.35 s", "S 0", "R 574 ms"]);
  });
  it.skipIf(!has(PACK.rando))("rando bass: both drawn LFO shapes appear", () => {
    expect(all(analyzeFile(PACK.rando)).map(([, d]) => d.title)).toEqual(["LFO 1 drawn shape", "LFO 2 drawn shape"]);
  });
});
