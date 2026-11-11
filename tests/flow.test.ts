import { describe, expect, it } from "vitest";
import { analyze } from "../src/flow/build";
import { STAGES } from "../src/flow/facts";
import { INIT_BASELINE } from "../src/patch/baseline";
import { analyzeFile, has, INIT, PACK, probe } from "./fixtures";

const order = STAGES.map((s) => s.id);
const titles = (a: ReturnType<typeof analyze>) => a.steps.map((s) => `${s.stage}|${s.title}`);

describe("step list", () => {
  it("Init is one step plus Osc A", () => {
    expect(titles(analyzeFile(INIT))).toEqual(["init|Load the Init preset", "core|Osc A: source and pitch"]);
  });

  it.each(Object.entries(PACK).filter(([, p]) => has(p)))("%s: stages are in signal-flow order, ids unique, no empty steps", (_n, path) => {
    const a = analyzeFile(path);
    const idx = a.steps.map((s) => order.indexOf(s.stage));
    expect(idx).toEqual([...idx].sort((x, y) => x - y));
    expect(new Set(a.steps.map((s) => s.id)).size).toBe(a.steps.length);
    expect(a.steps.filter((s) => s.stage !== "init" && s.facts.length === 0)).toEqual([]);
    const factIds = a.steps.flatMap((s) => s.facts.map((f) => f.id));
    expect(new Set(factIds).size).toBe(factIds.length);
    // deterministic
    expect(titles(analyzeFile(path))).toEqual(titles(a));
  });

  it.skipIf(!has(PACK.hype))("70s hype lead: expected walk-through", () => {
    expect(titles(analyzeFile(PACK.hype))).toEqual([
      "init|Load the Init preset",
      "core|Osc A: source and pitch",
      "character|Osc A: warp",
      "filter|Filter 1: switch on and set",
      "motion|Env 2 → Filter 1 Cutoff",
      "motion|LFO 1 → Env 2 Decay curve",
      "space|FX rack 1: Distortion",
      "space|FX rack 2: Chorus",
      "space|FX rack 3: Filter (FX)",
      "space|FX rack 4: Compressor",
      "space|FX rack 5: Delay",
      "space|FX rack 6: Reverb",
      "space|FX rack 7: Utility",
      "performance|Macros",
      "performance|Mod wheel",
      "performance|Voicing and global settings",
    ]);
  });

  it.skipIf(!has(PACK.hype))("cross-references modulation onto the step it affects", () => {
    const filter = analyzeFile(PACK.hype).steps.find((s) => s.id === "filter:VoiceFilter0")!;
    expect(filter.notes).toContain("Filter 1 Cutoff is also driven by Env 2.");
    expect(filter.notes).toContain('Filter 1 Resonance is also driven by Macro 1 "RESONANCE".');
  });

  it.skipIf(!has(PACK.gfunk))("flags an embedded wavetable instead of naming a factory table", () => {
    const wt = analyzeFile(PACK.gfunk).steps.flatMap((s) => s.facts).find((f) => f.id === "Oscillator0.WTOsc0#embeddedWTData")!;
    expect(wt.display.text).toContain("stored inside the preset");
    expect(wt.note).toMatch(/embedded/);
  });

  it.skipIf(!has(PACK.reese))("labels duplicate FX by rack position", () => {
    const a = analyzeFile(PACK.reese);
    expect(a.steps.find((s) => s.id === "motion:source6")!.title).toBe("LFO 1 → EQ (rack 4) Freq 1");
  });
});

describe("things the app cannot interpret (rule 6)", () => {
  it("an unknown oscillator param is listed as stored, flagged unknown", () => {
    const a = analyze(probe((r) => (r.Oscillator0.plainParams = { kParamMystery: 0.4 })), INIT_BASELINE);
    const f = a.steps.flatMap((s) => s.facts).find((x) => x.key === "kParamMystery")!;
    expect(f).toMatchObject({ known: false, status: "raw", label: "Mystery" });
  });
  it("an unknown mod source says so", () => {
    const a = analyze(probe((r) => (r.ModSlot0 = { plainParams: { kParamAmount: 50 }, source: [20, 0], destModuleID: 0, destModuleParamID: 3, destModuleParamName: "kParamFreq", destModuleTypeString: "VoiceFilter" })), INIT_BASELINE);
    const route = a.steps.flatMap((s) => s.facts).find((x) => x.key === "route")!;
    expect(route.display.text).toBe("Unrecognised source #20 → Filter 1 Cutoff");
    expect(route.known).toBe(false);
    expect(route.note).toMatch(/not recognised/);
  });
  it("a changed module with no home goes to the 'not interpreted' stage", () => {
    const a = analyze(probe((r) => (r.VoicePanel0.plainParams = { kParamWhatever: 3 })), INIT_BASELINE);
    const other = a.steps.find((s) => s.stage === "other")!;
    expect(other.facts.map((f) => [f.moduleLabel, f.label, f.known])).toEqual([["VoicePanel 1", "Whatever", false]]);
  });
});
