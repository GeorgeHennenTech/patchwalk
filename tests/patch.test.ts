import { describe, expect, it } from "vitest";
import { analyze } from "../src/flow/build";
import { INIT_BASELINE } from "../src/patch/baseline";
import { sameValue } from "../src/patch/diff";
import { collectModules } from "../src/patch/model";
import { resolveSource } from "../src/patch/sources";
import { analyzeFile, decodeFile, has, INIT, PACK, probe } from "./fixtures";

const changed = (a: ReturnType<typeof analyze>) => a.diffs.filter((d) => d.params.length || d.extras.length);

describe("module model", () => {
  it("finds nested oscillator modules in Init", () => {
    const ids = collectModules(decodeFile(INIT).root).map((m) => m.id);
    expect(ids).toContain("Oscillator0.WTOsc0");
    expect(ids).toContain("Oscillator3.NoiseOsc3");
    expect(ids).not.toContain("SerumGUI"); // UI state is not a module
    expect(ids.length).toBe(166);
  });
});

describe("diff against Init", () => {
  it("Init diffs to nothing, with only Osc A active", () => {
    const a = analyzeFile(INIT);
    expect(changed(a)).toEqual([]);
    expect([...a.activity].filter(([, v]) => v !== "untouched")).toEqual([["Oscillator0", "active"]]);
  });

  it("a one-param probe diffs to exactly that param", () => {
    const a = analyze(probe((r) => (r.Oscillator0.plainParams = { kParamOctave: -1 })), INIT_BASELINE);
    expect(changed(a).map((d) => [d.node.id, d.params])).toEqual([["Oscillator0", [{ param: "kParamOctave", value: -1, init: undefined }]]]);
  });

  it("compares with Init's stored values, not with 'default'", () => {
    // Env curves are explicit in Init, so repeating them is not a change...
    const same = analyze(probe((r) => (r.Env1.plainParams = { ...r.Env1.plainParams, kParamCurve1: 49.95 })), INIT_BASELINE);
    expect(changed(same)).toEqual([]);
    // ...and dropping them back to "default" is.
    const reset = analyze(probe((r) => (r.Env0.plainParams = "default")), INIT_BASELINE);
    expect(changed(reset)[0]!.params.map((p) => [p.param, p.value])).toEqual([["kParamCurve1", undefined], ["kParamCurve2", undefined], ["kParamCurve3", undefined]]);
    expect(reset.steps.find((s) => s.id === "contour:Env0")!.facts[0]!.display.text).toBe("factory default");
  });

  it("treats float32 round-trips as equal but real changes as different", () => {
    expect(sameValue(66.60000085830688, 66.60000000000001)).toBe(true);
    expect(sameValue(50, 52)).toBe(false);
    expect(sameValue("MgL24", "MgL12")).toBe(false);
  });
});

describe("activity", () => {
  it("hides a disabled oscillator even when it has stored settings", () => {
    const a = analyze(probe((r) => (r.Oscillator1.plainParams = { kParamOctave: 2 })), INIT_BASELINE);
    expect(a.activity.get("Oscillator1")).toBe("disabled");
    expect(a.steps.some((s) => s.moduleIds.includes("Oscillator1") && s.facts.length)).toBe(false);
  });
  it("shows it once enabled", () => {
    const a = analyze(probe((r) => (r.Oscillator1.plainParams = { kParamEnable: 1, kParamOctave: 2 })), INIT_BASELINE);
    expect(a.activity.get("Oscillator1")).toBe("active");
    expect(a.graph.sources.map((s) => s.label)).toEqual(["Osc A", "Osc B"]);
  });
  it("marks an edited LFO nothing listens to as unused", () => {
    const a = analyze(probe((r) => (r.LFO3.plainParams = { kParamRate: 2 })), INIT_BASELINE);
    expect(a.activity.get("LFO3")).toBe("unused");
    expect(a.steps.flatMap((s) => s.facts).some((f) => f.moduleId === "LFO3")).toBe(false);
  });
  it("maps the mod source numbers seen in fixtures", () => {
    expect(resolveSource(1).label).toBe("Mod Wheel");
    expect(resolveSource(3)).toMatchObject({ kind: "env", moduleId: "Env1", label: "Env 2" });
    expect(resolveSource(6)).toMatchObject({ kind: "lfo", moduleId: "LFO0", label: "LFO 1" });
    expect(resolveSource(25)).toMatchObject({ kind: "macro", moduleId: "Macro0", label: "Macro 1" });
    expect(resolveSource(20).kind).toBe("unknown");
  });
  it.skipIf(!has(PACK.reese))("reese bass: two oscillators and a sub are active, no filter", () => {
    const a = analyzeFile(PACK.reese);
    expect(a.graph.sources.map((s) => s.label)).toEqual(["Osc A", "Osc B", "Sub"]);
    expect(a.graph.filters).toEqual([]);
    expect(a.graph.fx.map((f) => f.label)).toEqual(["Splitter", "EQ", "Distortion", "EQ", "Compressor", "Chorus", "Delay", "Reverb", "Utility"]);
  });
});
