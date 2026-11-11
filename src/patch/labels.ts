// Human names for modules. Index-to-name mapping (0 -> "A", 0 -> "1") is inferred, not confirmed.
import type { ModuleNode } from "./model";

const OSC = ["Osc A", "Osc B", "Osc C", "Noise", "Sub"];
const FX_NAMES: Record<string, string> = {
  FXDistortion: "Distortion", FXChorus: "Chorus", FXDelay: "Delay", FXComp: "Compressor", FXReverb: "Reverb",
  FXEQ: "EQ", FXFilter: "Filter (FX)", FXHyperD: "Hyper/Dimension", FXUtils: "Utility", FXSplit: "Splitter",
  FXFlanger: "Flanger", FXPhaser: "Phaser",
};
const SUB_OSC = new Set(["WTOsc", "SampleOsc", "MultiSampleOsc", "GranularOsc", "SpectralOsc", "NoiseOsc", "SubOsc"]);

export function isSubOsc(type: string): boolean {
  return SUB_OSC.has(type);
}

export function fxName(type: string): string {
  return FX_NAMES[type] ?? type.replace(/^FX/, "");
}

export function labelFor(type: string, index: number): string {
  if (type === "Oscillator" || SUB_OSC.has(type)) return OSC[index] ?? `Oscillator ${index + 1}`;
  if (type === "VoiceFilter") return `Filter ${index + 1}`;
  if (type === "Env") return `Env ${index + 1}`;
  if (type === "LFO") return `LFO ${index + 1}`;
  if (type === "Macro") return `Macro ${index + 1}`;
  if (type === "ModSlot") return `Mod slot ${index + 1}`;
  if (type === "FXRack") return index === 0 ? "FX rack" : `FX rack ${index + 1}`;
  if (type === "Global") return "Global";
  if (type === "RoutingSlot") return `Routing slot ${index + 1}`;
  if (type.startsWith("FX")) return fxName(type);
  return `${type} ${index + 1}`;
}

export function nodeLabel(node: ModuleNode): string {
  return labelFor(node.type, node.index);
}
