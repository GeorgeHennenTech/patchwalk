import { describe, expect, it } from "vitest";
import { time, trim, humanize } from "../src/display/format";
import { allSpecs, filterTypeName, resolveParam } from "../src/display/registry";
import { analyzeFile, has, PACK } from "./fixtures";

// One row per registry entry: stored value -> text shown. Values marked (fixture) were read from the
// named pack preset; the rest are representative. NONE of the expected texts has been checked against
// Serum's screen, which is why every entry is still "unverified" or "raw".
const CASES: [string, string, number | string, string][] = [
  ["Oscillator", "kParamEnable", 1, "On"],
  ["Oscillator", "kParamVolume", 0.5625, "75%"], // g_funk Sub (fixture)
  ["Oscillator", "kParamOctave", -2, "-2 oct"], // reese (fixture)
  ["Oscillator", "kParamPitch", 6.999999999999999, "+7 st"], // g_funk Osc B (fixture)
  ["Oscillator", "kParamFine", -39.99999761581421, "-40 cents"], // reese (fixture)
  ["Oscillator", "kParamUnison", 3, "3"], // g_funk (fixture)
  ["Oscillator", "kParamDetune", 0.25, "0.25"],
  ["Oscillator", "kParamUnisonStereo", 0, "0"],
  ["Oscillator", "kParamUnisonBlend", 0.5, "0.5"],
  ["Oscillator", "kParamPan", 0.5, "0.5"],
  ["WTOsc", "kParamTablePos", 92.71052604913712, "92.7"], // rando (fixture)
  ["WTOsc", "kParamWarpMenu", "kBendPos", "Bend +"], // rando (fixture)
  ["WTOsc", "kParamWarp", 0.5, "0.5"],
  ["WTOsc", "kParamWarpMenu2", "kFilterHPF", "HPF (Filter)"], // rando (fixture)
  ["WTOsc", "kParamWarp2", 0.20614035427570343, "0.206"], // rando (fixture)
  ["WTOsc", "kParamRandomPhase", 0, "0"],
  ["WTOsc", "kParamInitialPhase", 15.234375, "15.2"],
  ["NoiseOsc", "kParamNoiseType", "White", "White"],
  ["NoiseOsc", "kParamColor", 0.7719298005104065, "0.772"],
  ["NoiseOsc", "kParamInitialPhase", 15.234375, "15.2"],
  ["VoiceFilter", "kParamEnable", 1, "On"],
  ["VoiceFilter", "kParamType", "MgL24", "MG Low 24"], // 70s_hype (fixture)
  ["VoiceFilter", "kParamFreq", 0.46052631735801697, "0.461"], // 70s_hype (fixture)
  ["VoiceFilter", "kParamReso", 14.385965466499329, "14%"], // rando (fixture)
  ["VoiceFilter", "kParamDrive", 42.105260491371155, "42%"], // rando (fixture)
  ["VoiceFilter", "kParamVar", 39.47368562221527, "39%"], // rando (fixture)
  ["VoiceFilter", "kParamMix", 100, "100%"],
  ["Env", "kParamAttack", 0.0005153631860372516, "0.52 ms"], // g_funk (fixture)
  ["Env", "kParamDecay", 6.351779421350291, "6.35 s"], // 70s_hype (fixture)
  ["Env", "kParamRelease", 0.573987443841753, "574 ms"], // 70s_hype (fixture)
  ["Env", "kParamHold", 0.02, "20 ms"],
  ["Env", "kParamSustain", 0.9342105388641357, "0.934"], // g_funk (fixture)
  ["Env", "kParamCurve1", 50, "50"], // Init (fixture)
  ["Env", "kParamCurve2", 66.60000000000001, "66.6"], // Init (fixture)
  ["Env", "kParamCurve3", 66.60000000000001, "66.6"], // Init (fixture)
  ["LFO", "kParamRate", 17.078820419579653, "17.08"], // rando (fixture)
  ["LFO", "kParamBeatSync", 0, "Off"],
  ["LFO", "kParamMode", "Free", "FREE"],
  ["LFO", "kParamType", "RandomSH", "S&H"], // rando (fixture)
  ["LFO", "kParamRise", 2.2280702590942383, "2.23"],
  ["LFO", "kParamDelay", 1, "1"],
  ["LFO", "kParamSmooth", 85.52631735801697, "86%"],
  ["LFO", "kParamMono", 1, "On"],
  ["LFO", "kParamDotted", 1, "On"],
  ["LFO", "kParamTriplets", 1, "On"],
  ["LFO", "kParamRate10x", 1, "On"],
  ["LFO", "kParamDefaultMode", 0, "0"],
  ["Macro", "kParamValue", 10.526315867900848, "11%"],
  ["ModSlot", "kParamAmount", -33.77193212509155, "-34%"], // reese (fixture)
  ["ModSlot", "kParamBipolar", 1, "On"],
  ["ModSlot", "kParamOut", 2.0000021904706955, "2"],
  ["Global", "kParamMasterVolume", 0.5494190132610619, "0.549"],
  ["Global", "kParamTranspose", -12, "-12 st"], // rando (fixture)
  ["Global", "kParamMonoToggle", 1, "On"],
  ["Global", "kParamLegato", 1, "On"],
  ["Global", "kParamPortamentoTime", 0.06108125617897561, "61.1 ms"], // 70s_hype (fixture)
  ["Global", "kParamPortaAlways", 1, "On"],
  ["Global", "kParamBendRangeUp", 6, "+6 st"], // reese (fixture)
  ["Global", "kParamBendRangeDn", -24, "-24 st"], // reese (fixture)
  ["Global", "kParamModWheel", 59.05511975288391, "59.1"],
  ["Global", "kParamLimitSameNotePolyphony", 1, "On"],
  ["Global", "kParamS1Compatibility", 1, "On"],
  ["Global", "kParamMasterTuning", 0, "0"],
  ["RoutingSlot", "kParamRoutingDest", "kRoutingDestDirect", "Routing Dest Direct"], // reese (fixture)
  ["FXDelay", "kParamWet", 0, "0%"],
];

describe("display registry", () => {
  it.each(CASES)("%s.%s: %s -> %s", (type, param, raw, text) => {
    expect(resolveParam(type, param, raw).display.text).toBe(text);
  });

  it("every registry entry has a case above", () => {
    const covered = new Set(CASES.map(([t, p]) => `${t.startsWith("FX") ? "FX*" : t}.${p}`));
    const missing = allSpecs().map((s) => `${s.moduleType}.${s.param}`).filter((k) => !covered.has(k));
    expect(missing).toEqual([]);
  });

  it("nothing is marked verified without a confirming probe fixture (rule 7)", () => {
    for (const { moduleType, param, spec } of allSpecs()) {
      if (spec.status === "verified") expect(spec.confirmedBy, `${moduleType}.${param}`).toBeTruthy();
      expect(spec.basis.length, `${moduleType}.${param} needs a basis`).toBeGreaterThan(10);
    }
  });

  it("names from the Serum 2 User Guide are marked documented, and only when the token is recognised", () => {
    expect(resolveParam("VoiceFilter", "kParamType", "MgL24")).toMatchObject({ status: "documented", display: { text: "MG Low 24" } });
    expect(resolveParam("VoiceFilter", "kParamType", "Mystery9")).toMatchObject({ status: "unverified", display: { text: "Mystery 9" } });
    expect(resolveParam("WTOsc", "kParamWarpMenu", "kBendPos").status).toBe("documented");
    expect(resolveParam("WTOsc", "kParamWarpMenu", "kSomethingElse").status).toBe("unverified");
    expect(resolveParam("LFO", "kParamType", "Lorenz")).toMatchObject({ status: "documented", display: { text: "Chaos: Lorenz" } });
    // a documented name never turns into "verified": that still needs the owner's probe
    expect(allSpecs().every(({ spec }) => spec.status !== "verified")).toBe(true);
  });

  it("the filter's Var knob takes the guide's name for the selected filter type", () => {
    expect(resolveParam("VoiceFilter", "kParamVar", 39, { kParamType: "LadderAcid" }).label).toBe("Var (SMOOTH)");
    expect(resolveParam("VoiceFilter", "kParamVar", 39, { kParamType: "MgL24" }).label).toBe("Var (FAT)");
    expect(resolveParam("VoiceFilter", "kParamVar", 39, {}).label).toBe("Var (FAT)"); // Init's default type is MG Low 6
    expect(resolveParam("VoiceFilter", "kParamVar", 39, { kParamType: "Mystery9" }).label).toBe("Var");
    expect(resolveParam("VoiceFilter", "kParamVar", 39).label).toBe("Var");
  });

  it("an unknown param is shown as stored and flagged", () => {
    const r = resolveParam("Oscillator", "kParamSomethingNew", 0.123456);
    expect(r).toMatchObject({ known: false, status: "raw", label: "Something New" });
    expect(r.display.text).toBe("0.123");
  });

  it("formatting helpers", () => {
    expect(trim(-0.0001, 2)).toBe("0");
    expect(time(0.0147).text).toBe("14.7 ms");
    expect(time(2).text).toBe("2 s");
    expect(humanize("kParamUnisonBlend")).toBe("Unison Blend");
    expect(filterTypeName("LadderAcid")).toEqual({ text: "Acid Ladder", status: "documented" });
    expect(filterTypeName("SomethingNew").status).toBeUndefined();
  });

  it.skipIf(!has(PACK.hype))("fixture facts carry their status through to the lesson", () => {
    const facts = analyzeFile(PACK.hype).steps.flatMap((s) => s.facts);
    const cutoff = facts.find((f) => f.id === "VoiceFilter0:kParamFreq")!;
    expect(cutoff).toMatchObject({ status: "raw", label: "Cutoff" });
    expect(facts.find((f) => f.id === "VoiceFilter0:kParamType")!.display.text).toBe("MG Low 24");
    expect(facts.every((f) => f.status !== "verified")).toBe(true);
  });
});
