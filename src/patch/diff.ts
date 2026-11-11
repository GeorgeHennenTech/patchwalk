// Compares a preset's modules with the Init baseline.
// "default" in a file is NOT the same as Init: Init itself stores a few non-default params.
import type { Cbor } from "../format";
import type { ModuleNode, ParamValue } from "./model";

/** Float32 round-trips and tiny version-to-version drifts (49.95 vs 50) are treated as equal. */
export const REL_TOLERANCE = 2e-3;

export function sameValue(a: unknown, b: unknown): boolean {
  if (typeof a === "number" && typeof b === "number") {
    if (a === b) return true;
    return Math.abs(a - b) <= REL_TOLERANCE * Math.max(Math.abs(a), Math.abs(b), 1e-9);
  }
  if (Array.isArray(a) && Array.isArray(b)) return a.length === b.length && a.every((v, i) => sameValue(v, b[i]));
  if (a && b && typeof a === "object" && typeof b === "object" && !Array.isArray(a) && !Array.isArray(b)) {
    const ka = Object.keys(a), kb = Object.keys(b);
    return ka.length === kb.length && ka.every((k) => k in b && sameValue((a as any)[k], (b as any)[k]));
  }
  return a === b;
}

export interface ParamChange {
  param: string;
  /** Value in this preset. `undefined` = not stored, i.e. the factory default (number unknown). */
  value: ParamValue | undefined;
  /** Value in Init. `undefined` = factory default. */
  init: ParamValue | undefined;
}

export interface ExtraChange {
  key: string;
  value: Cbor | undefined;
  init: Cbor | undefined;
}

export interface ModuleDiff {
  node: ModuleNode;
  /** False when Init has no module with this id (FX entries, mostly). */
  inInit: boolean;
  params: ParamChange[];
  extras: ExtraChange[];
}

export interface Baseline {
  [moduleId: string]: { params: Record<string, ParamValue>; extras: Record<string, Cbor> };
}

/** Extras that are playback/UI state rather than sound design. */
const IGNORED_EXTRAS = new Set(["lfophasor", "lfo", "kUIParamMixOrGain", "detuneFactor", "numChannels", "numFrames", "sampleRate", "interpolateAfterLoad", "activeClip"]);

export function diffModule(node: ModuleNode, baseline: Baseline): ModuleDiff {
  const base = baseline[node.id];
  const params: ParamChange[] = [];
  const baseParams = base?.params ?? {};
  for (const [param, value] of Object.entries(node.params)) {
    if (!(param in baseParams) || !sameValue(value, baseParams[param])) {
      params.push({ param, value, init: baseParams[param] });
    }
  }
  for (const [param, init] of Object.entries(baseParams)) {
    if (!(param in node.params)) params.push({ param, value: undefined, init });
  }
  const extras: ExtraChange[] = [];
  const baseExtras = base?.extras ?? {};
  for (const key of new Set([...Object.keys(node.extras), ...Object.keys(baseExtras)])) {
    if (IGNORED_EXTRAS.has(key)) continue;
    const value = node.extras[key], init = baseExtras[key];
    if (!sameValue(value, init)) extras.push({ key, value, init });
  }
  return { node, inInit: base !== undefined, params, extras };
}

export function toBaseline(nodes: ModuleNode[]): Baseline {
  return Object.fromEntries(nodes.map((n) => [n.id, { params: n.params, extras: n.extras }]));
}
