// A rule-based guess at what kind of sound a patch is, from its settings alone. No audio is
// analysed, so this is a labelled guess. Code picks the label and lists the settings behind it.
import { resolveParam } from "../display/registry";
import { isEnabled } from "../patch/activity";
import { nodeLabel } from "../patch/labels";
import type { ModuleNode, ParamValue } from "../patch/model";
import type { Analysis } from "./build";

export interface SoundTypeGuess {
  /** e.g. "Mono bass". Undefined when the settings do not point anywhere. */
  label?: string;
  /** One line per setting that led to the label, in display form. */
  reasons: string[];
  /** Things the guess could not take into account. */
  caveats: string[];
}

const num = (v: ParamValue | undefined): number | undefined => (typeof v === "number" ? v : undefined);

export function guessSoundType(analysis: Analysis): SoundTypeGuess {
  const byId = new Map(analysis.modules.map((m) => [m.id, m]));
  const reasons: string[] = [];
  const cite = (node: ModuleNode, param: string) => {
    const v = node.params[param];
    if (v !== undefined) reasons.push(`${nodeLabel(node)} ${resolveParam(node.type, param, v).label}: ${resolveParam(node.type, param, v).display.text}`);
  };
  const caveats = ["Based on stored settings only; the app cannot hear the patch.", "Envelope times are read as seconds, which is unverified."];

  const oscs = analysis.modules.filter((m) => m.type === "Oscillator" && isEnabled(m));
  const pitched = oscs.filter((o) => o.index <= 2);
  const sub = oscs.find((o) => o.index === 4);
  const global = byId.get("Global0");
  const env = byId.get("Env0");

  if (pitched.length === 0) {
    if (sub) return { label: "Sub bass", reasons: ["Only the sub oscillator is switched on."], caveats };
    if (oscs.some((o) => o.index === 3)) return { label: "Noise or effect sound", reasons: ["Only the noise oscillator is switched on."], caveats };
    return { reasons: ["No oscillator is switched on."], caveats };
  }

  // Register: average octave of the pitched oscillators plus the global transpose.
  const transpose = num(global?.params.kParamTranspose) ?? 0;
  const register = pitched.reduce((sum, o) => sum + (num(o.params.kParamOctave) ?? 0), 0) / pitched.length + transpose / 12;
  const low = register <= -1;
  const high = register >= 1;

  const mono = global?.params.kParamMonoToggle === 1;
  const attack = num(env?.params.kParamAttack);
  const decay = num(env?.params.kParamDecay);
  const sustain = num(env?.params.kParamSustain);
  const release = num(env?.params.kParamRelease);
  const plucky = sustain !== undefined && sustain <= 0.15 && (decay === undefined || decay <= 1.5);
  const slow = attack !== undefined && attack >= 0.08;
  const longTail = release !== undefined && release >= 0.6;

  const citeRegister = () => {
    pitched.forEach((o) => cite(o, "kParamOctave"));
    if (global && transpose) cite(global, "kParamTranspose");
  };
  const citeMono = () => {
    if (!global) return;
    cite(global, "kParamMonoToggle");
    cite(global, "kParamLegato");
    cite(global, "kParamPortamentoTime");
  };

  let label: string | undefined;
  if (low) {
    citeRegister();
    if (sub) reasons.push("The sub oscillator is switched on.");
    if (plucky) { label = "Plucked bass"; cite(env!, "kParamSustain"); cite(env!, "kParamDecay"); }
    else if (mono) { label = "Mono bass"; citeMono(); }
    else label = "Bass";
  } else if (plucky) {
    label = "Pluck";
    cite(env!, "kParamSustain"); cite(env!, "kParamDecay");
    if (high) citeRegister();
  } else if (slow || (longTail && !mono)) {
    label = "Pad";
    if (slow) cite(env!, "kParamAttack");
    if (longTail) cite(env!, "kParamRelease");
    if (!mono) reasons.push("The patch is polyphonic (mono is off).");
  } else if (mono) {
    label = "Lead";
    citeMono();
    if (high) citeRegister();
    else reasons.push("The oscillators sit in the middle register or above.");
  } else {
    const changed = analysis.diffs.some((d) => d.params.length || d.extras.length);
    if (!changed) return { reasons: ["Nothing differs from the Init preset, so there is no sound design to classify yet."], caveats };
    label = "Polyphonic synth (keys or chords)";
    reasons.push("The patch is polyphonic (mono is off).", "The amp envelope is neither plucked nor slow.");
    const stacked = pitched.find((o) => (num(o.params.kParamUnison) ?? 1) > 1);
    if (stacked) cite(stacked, "kParamUnison");
  }
  return { label, reasons, caveats };
}
