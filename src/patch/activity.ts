// Decides which modules take part in the sound. Rules are inferred from fixtures and flagged as such.
import type { ModuleDiff } from "./diff";
import type { ModuleNode } from "./model";
import { resolveSource } from "./sources";

export type Activity =
  | "active" // contributes to the sound
  | "disabled" // has an on/off switch and it is off
  | "unused" // a mod source nothing listens to, or an empty slot
  | "untouched"; // identical to Init

export interface ModSlotInfo {
  node: ModuleNode;
  source: number;
  aux: number;
  destType: string;
  destIndex: number;
  destParam: string;
}

export function readModSlot(node: ModuleNode): ModSlotInfo | undefined {
  if (node.type !== "ModSlot") return undefined;
  const src = node.extras.source;
  const destType = node.extras.destModuleTypeString;
  const destParam = node.extras.destModuleParamName;
  if (!Array.isArray(src) || typeof src[0] !== "number" || typeof destType !== "string" || typeof destParam !== "string") {
    return undefined;
  }
  return {
    node,
    source: src[0],
    aux: typeof src[1] === "number" ? src[1] : 0,
    destType,
    destIndex: typeof node.extras.destModuleID === "number" ? node.extras.destModuleID : 0,
    destParam,
  };
}

/**
 * On/off state. Inferred: modules that are off in Init store kParamEnable: 1 when switched on;
 * Osc A is on in Init and stores nothing. "Osc A switched off" has not been seen in a fixture.
 */
export function isEnabled(node: ModuleNode): boolean | undefined {
  const flag = node.params.kParamEnable;
  if (node.type === "Oscillator") return flag !== undefined ? flag !== 0 : node.index === 0;
  if (node.type === "VoiceFilter") return flag !== undefined ? flag !== 0 : false;
  return undefined; // no on/off switch known for this module type
}

export function classify(diffs: ModuleDiff[]): Map<string, Activity> {
  const byId = new Map(diffs.map((d) => [d.node.id, d]));
  const slots = diffs.map((d) => readModSlot(d.node)).filter((s): s is ModSlotInfo => !!s && s.source !== 0);
  const usedSources = new Set<string>();
  for (const s of slots) {
    for (const id of [s.source, s.aux]) {
      const m = resolveSource(id).moduleId;
      if (m) usedSources.add(m);
    }
  }

  const out = new Map<string, Activity>();
  const parentOff = (n: ModuleNode): boolean => {
    for (let p = n.parentId; p; p = byId.get(p)?.node.parentId) {
      const parent = byId.get(p)?.node;
      if (parent && isEnabled(parent) === false) return true;
    }
    return false;
  };

  for (const d of diffs) {
    const n = d.node;
    const changed = d.params.length > 0 || d.extras.length > 0 || !d.inInit;
    let a: Activity;
    if (isEnabled(n) === false || parentOff(n)) a = changed ? "disabled" : "untouched";
    else if (n.type === "ModSlot") a = slots.some((s) => s.node === n) ? "active" : changed ? "unused" : "untouched";
    else if (n.type === "LFO" || n.type === "Macro" || (n.type === "Env" && n.index > 0)) {
      a = usedSources.has(n.id) ? "active" : changed ? "unused" : "untouched";
    } else a = changed ? "active" : "untouched";
    // Osc A (and anything enabled by default) is part of the sound even when identical to Init.
    if (a === "untouched" && isEnabled(n) === true) a = "active";
    out.set(n.id, a);
  }
  return out;
}
