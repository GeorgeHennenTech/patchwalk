import { describe, expect, it } from "vitest";
import { analyze } from "../src/flow/build";
import { INIT_BASELINE } from "../src/patch/baseline";
import { analyzeFile, has, INIT, PACK, probe } from "./fixtures";

const combos = (a: ReturnType<typeof analyze>) => Object.fromEntries(a.steps.filter((s) => s.stage === "interplay").map((s) => [s.id.replace("interplay:", ""), s.facts.map((f) => f.display.text)]));
const slot = (source: number[], type: string, id: number, param: string, amount = 50) => ({ plainParams: { kParamAmount: amount }, source, destModuleID: id, destModuleParamID: 0, destModuleParamName: param, destModuleTypeString: type });
const run = (edit: (r: Record<string, any>) => void) => combos(analyze(probe(edit), INIT_BASELINE));

describe("combination detection", () => {
  it("finds nothing in Init", () => {
    expect(combos(analyzeFile(INIT))).toEqual({});
  });
  it("detuned pair: needs the same coarse pitch and a real fine-tune gap", () => {
    expect(run((r) => { r.Oscillator0.plainParams = { kParamFine: -12 }; r.Oscillator1.plainParams = { kParamEnable: 1, kParamFine: 12 }; })["detuned-pair"])
      .toEqual(["Osc A Fine is -12 cents and Osc B Fine is +12 cents, with both oscillators at the same octave and semitone."]);
    expect(run((r) => { r.Oscillator0.plainParams = { kParamFine: -12 }; r.Oscillator1.plainParams = { kParamEnable: 1, kParamFine: 12, kParamOctave: 1 }; })["detuned-pair"]).toBeUndefined();
    expect(run((r) => { r.Oscillator0.plainParams = { kParamFine: 1 }; r.Oscillator1.plainParams = { kParamEnable: 1 }; })["detuned-pair"]).toBeUndefined();
    expect(run((r) => { r.Oscillator0.plainParams = { kParamFine: -12 }; r.Oscillator1.plainParams = { kParamFine: 12 }; })["detuned-pair"]).toBeUndefined(); // Osc B is off
  });
  it("envelope on cutoff, and whether it closes again", () => {
    const base = (sustain?: number) => run((r) => {
      r.VoiceFilter0.plainParams = { kParamEnable: 1 };
      r.Env1.plainParams = { ...r.Env1.plainParams, ...(sustain === undefined ? { kParamDecay: 0.3 } : { kParamSustain: sustain }) };
      r.ModSlot0 = slot([3, 0], "VoiceFilter", 0, "kParamFreq", 80);
    })["filter-envelope"];
    expect(base()).toEqual(["Env 2 moves Filter 1 Cutoff (amount 80%)."]);
    expect(base(0)).toEqual(["Env 2 moves Filter 1 Cutoff (amount 80%), and Env 2 Sustain is 0, so the cutoff falls back while the note is still held."]);
  });
  it("LFO destinations: cutoff, level, pitch", () => {
    const c = run((r) => {
      r.VoiceFilter0.plainParams = { kParamEnable: 1 };
      r.ModSlot0 = slot([6, 0], "VoiceFilter", 0, "kParamFreq");
      r.ModSlot1 = slot([7, 0], "Oscillator", 0, "kParamVolume", 20);
      r.ModSlot2 = slot([8, 0], "Oscillator", 0, "kParamFine", 5);
    });
    expect(c["lfo-cutoff"]).toEqual(["LFO 1 moves Filter 1 Cutoff (amount 50%), a repeating filter sweep."]);
    expect(c["tremolo"]).toEqual(["LFO 2 moves Osc A Level (amount 20%), a repeating change in loudness (tremolo)."]);
    expect(c["pitch-lfo"]).toEqual(["LFO 3 moves Osc A Fine (amount 5%), a repeating change in pitch."]);
  });
  it("mono + legato + portamento", () => {
    expect(run((r) => (r.Global0.plainParams = { kParamMonoToggle: 1, kParamLegato: 1, kParamPortamentoTime: 0.1 }))["glide"]).toEqual(["Mono is on, Legato is on and Portamento time is 100 ms."]);
    expect(run((r) => (r.Global0.plainParams = { kParamMonoToggle: 1 }))["glide"]).toBeUndefined();
  });
  it("combination steps come after performance and never repeat a fact id", () => {
    const a = analyze(probe((r) => (r.Global0.plainParams = { kParamMonoToggle: 1, kParamLegato: 1 })), INIT_BASELINE);
    expect(a.steps.map((s) => s.stage)).toEqual(["init", "core", "performance", "interplay"]);
  });

  it.skipIf(!has(PACK.reese))("reese bass: detuned pair and macro-gated effects", () => {
    const c = combos(analyzeFile(PACK.reese));
    expect(c["detuned-pair"]).toEqual(["Osc A Fine is -40 cents and Osc B Fine is +40 cents, with both oscillators at the same octave and semitone."]);
    expect(c["macro-fx"]).toContain('Reverb Mix (wet) is set to 0%, and Macro 4 "REVERB" raises it (amount 100%), which is saved at 16%.');
    expect(c["macro-multi"]).toEqual(['Macro 1 "SUB VOL" drives 2 settings at once: Sub Level and EQ (rack 2) Freq 1.']);
  });
  it.skipIf(!has(PACK.hype))("70s hype: mod wheel chain, filter envelope and a modulated envelope", () => {
    const c = combos(analyzeFile(PACK.hype));
    expect(c["wheel-chain"]).toEqual(['The mod wheel turns Macro 2 "MOD ON" (amount 100%), which scales the route LFO 1 → Env 2 Decay curve.']);
    expect(c["filter-envelope"]).toEqual(["Env 2 moves Filter 1 Cutoff (amount 100%), and Env 2 Sustain is 0, so the cutoff falls back while the note is still held."]);
    expect(c["mod-of-mod"]).toEqual(["LFO 1 changes Env 2 Decay curve (amount 13%), so a modulator is itself being modulated."]);
    expect(c["glide"]).toEqual(["Mono is on, Legato is on and Portamento time is 61.1 ms."]);
  });
  it.skipIf(!has(PACK.gfunk))("g funk: tremolo and a macro with several jobs", () => {
    const c = combos(analyzeFile(PACK.gfunk));
    expect(c["tremolo"]![0]).toMatch(/^LFO 1 moves Osc A Level \(amount 16%\) and Osc B Level \(amount 13%\), a repeating change in loudness \(tremolo\)\.$/);
    expect(c["macro-multi"]).toEqual(['Macro 6 "DIMENSION" drives 3 settings at once: Hyper/Dimension Dim E Wet, Osc A Unison stereo and Osc B Unison stereo.']);
    expect(c["mod-of-mod"]!.length).toBe(2);
  });
});
