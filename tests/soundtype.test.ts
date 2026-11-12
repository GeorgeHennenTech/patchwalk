import { describe, expect, it } from "vitest";
import { analyze } from "../src/flow/build";
import { guessSoundType } from "../src/flow/soundtype";
import { INIT_BASELINE } from "../src/patch/baseline";
import { analyzeFile, has, INIT, PACK, probe } from "./fixtures";

const guess = (edit: (r: Record<string, any>) => void) => guessSoundType(analyze(probe(edit), INIT_BASELINE));
const env = (r: Record<string, any>, p: object) => (r.Env0.plainParams = { ...r.Env0.plainParams, ...p });

describe("sound type guess", () => {
  it("makes no guess for Init", () => {
    const g = guessSoundType(analyzeFile(INIT));
    expect(g.label).toBeUndefined();
    expect(g.reasons[0]).toMatch(/Nothing differs from the Init preset/);
  });
  it("low register + mono -> mono bass, citing the settings", () => {
    const g = guess((r) => { r.Oscillator0.plainParams = { kParamOctave: -2 }; r.Global0.plainParams = { kParamMonoToggle: 1, kParamLegato: 1 }; });
    expect(g.label).toBe("Mono bass");
    expect(g.reasons).toEqual(["Osc A Octave (OCT): -2 oct", "Global Mono: On", "Global Legato: On"]);
  });
  it("transpose counts towards the register", () => {
    expect(guess((r) => (r.Global0.plainParams = { kParamTranspose: -12 })).label).toBe("Bass");
  });
  it("zero sustain with a short decay -> pluck", () => {
    expect(guess((r) => env(r, { kParamSustain: 0, kParamDecay: 0.3 })).label).toBe("Pluck");
    expect(guess((r) => { r.Oscillator0.plainParams = { kParamOctave: -1 }; env(r, { kParamSustain: 0, kParamDecay: 0.3 }); }).label).toBe("Plucked bass");
  });
  it("slow attack -> pad; long release only counts when polyphonic", () => {
    expect(guess((r) => env(r, { kParamAttack: 0.4, kParamRelease: 1.2 })).label).toBe("Pad");
    expect(guess((r) => { env(r, { kParamRelease: 1.2 }); r.Global0.plainParams = { kParamMonoToggle: 1 }; }).label).toBe("Lead");
  });
  it("only noise or only sub", () => {
    expect(guess((r) => { r.Oscillator0.plainParams = { kParamEnable: 0 }; r.Oscillator3.plainParams = { kParamEnable: 1 }; }).label).toBe("Noise or effect sound");
    expect(guess((r) => { r.Oscillator0.plainParams = { kParamEnable: 0 }; r.Oscillator4.plainParams = { kParamEnable: 1 }; }).label).toBe("Sub bass");
  });
  it("always says it is a guess from settings", () => {
    expect(guess((r) => (r.Oscillator0.plainParams = { kParamUnison: 5 })).caveats[0]).toMatch(/cannot hear/);
  });
  // The pack presets happen to say what they are in their file names; the guess never reads the name.
  it.skipIf(!has(PACK.reese))("pack presets: guesses agree with what the pack calls them", () => {
    expect(guessSoundType(analyzeFile(PACK.reese)).label).toBe("Mono bass");
    expect(guessSoundType(analyzeFile(PACK.rando)).label).toBe("Bass");
    expect(guessSoundType(analyzeFile(PACK.hype)).label).toBe("Lead");
    expect(guessSoundType(analyzeFile(PACK.gfunk)).label).toBe("Lead");
  });
});
