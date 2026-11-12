import { describe, expect, it } from "vitest";
import { compare, tally } from "../src/compare/compare";
import { analyze } from "../src/flow/build";
import { INIT_BASELINE } from "../src/patch/baseline";
import { analyzeFile, has, INIT, PACK, probe } from "./fixtures";

const make = (osc: object, filter?: object) => analyze(probe((r) => {
  r.Oscillator0.plainParams = osc;
  if (filter) r.VoiceFilter0.plainParams = filter;
}), INIT_BASELINE);
const target = make({ kParamOctave: -1, kParamUnison: 5 }, { kParamEnable: 1, kParamFreq: 0.4, kParamReso: 30 });

describe("drop your attempt", () => {
  it("an identical copy matches everywhere", () => {
    const t = tally(compare(target, make({ kParamOctave: -1, kParamUnison: 5 }, { kParamEnable: 1, kParamFreq: 0.4, kParamReso: 30 })));
    expect(t).toMatchObject({ close: 0, different: 0, missing: 0, extra: 0 });
    expect(t.match).toBeGreaterThan(4);
  });
  it("Init as the attempt is missing every changed setting", () => {
    const steps = compare(target, analyzeFile(INIT));
    const t = tally(steps);
    expect(t.missing).toBe(5);
    expect(t.different + t.close + t.extra).toBe(0);
    expect(steps.find((s) => s.id === "filter:VoiceFilter0")!.verdict).toBe("missing");
  });
  it("grades a near miss as close and a wrong value as different, with both values in the text", () => {
    const steps = compare(target, make({ kParamOctave: -2, kParamUnison: 5 }, { kParamEnable: 1, kParamFreq: 0.42, kParamReso: 30 }));
    const facts = steps.flatMap((s) => s.facts);
    expect(facts.find((f) => f.target?.id === "VoiceFilter0:kParamFreq")).toMatchObject({ verdict: "close", text: "Filter 1 Cutoff: target 0.4, yours 0.42." });
    expect(facts.find((f) => f.target?.id === "Oscillator0:kParamOctave")).toMatchObject({ verdict: "different", text: "Osc A Octave (OCT): target -1 oct, yours -2 oct." });
    expect(steps.find((s) => s.id === "core:Oscillator0")!.verdict).toBe("different");
  });
  it("reports settings and whole steps that only the attempt has", () => {
    const attempt = analyze(probe((r) => {
      r.Oscillator0.plainParams = { kParamOctave: -1, kParamUnison: 5, kParamFine: 12 };
      r.VoiceFilter0.plainParams = { kParamEnable: 1, kParamFreq: 0.4, kParamReso: 30 };
      r.Global0.plainParams = { kParamMonoToggle: 1 };
    }), INIT_BASELINE);
    const steps = compare(target, attempt);
    expect(steps.flatMap((s) => s.facts).filter((f) => f.verdict === "extra").map((f) => f.attempt!.id).sort()).toEqual(["Global0:kParamMonoToggle", "Oscillator0:kParamFine"]);
    expect(steps[steps.length - 1]!.title).toBe("Voicing and global settings (only in your patch)");
  });
  it.skipIf(!has(PACK.hype))("a real preset matches itself", () => {
    const a = analyzeFile(PACK.hype);
    const t = tally(compare(a, analyzeFile(PACK.hype)));
    expect(t.different + t.close + t.missing + t.extra).toBe(0);
  });
});
