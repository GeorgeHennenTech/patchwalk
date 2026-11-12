// Decoded preset -> facts -> ordered steps. No AI anywhere in this file.
import type { Cbor, DecodedPreset } from "../format";
import { humanize, type Display } from "../display/format";
import { resolveParam, type Stage } from "../display/registry";
import { classify, isEnabled, readModSlot, type Activity, type ModSlotInfo } from "../patch/activity";
import { diffModule, type Baseline, type ModuleDiff, type ParamChange } from "../patch/diff";
import { fxName, isSubOsc, labelFor, nodeLabel } from "../patch/labels";
import { byNaturalId, collectModules, type ModuleNode } from "../patch/model";
import { resolveSource, type ModSource } from "../patch/sources";
import { detectCombos } from "./combos";
import type { Fact, FlowGraph, StageId, Step } from "./facts";

export interface Analysis {
  modules: ModuleNode[];
  diffs: ModuleDiff[];
  activity: Map<string, Activity>;
  steps: Step[];
  graph: FlowGraph;
}

/**
 * Module labeller for the analysis in progress. analyze() is synchronous, so it sets this once at
 * the start; it adds the rack position to FX that appear more than once ("EQ (rack 2)").
 */
let L: (n: ModuleNode) => string = nodeLabel;

function paramFact(node: ModuleNode, change: ParamChange): Fact {
  const base = {
    id: `${node.id}:${change.param}`,
    moduleId: node.id,
    moduleType: node.type,
    moduleLabel: L(node),
    key: change.param,
    tags: [node.type, change.param, `${node.type}.${change.param}`],
  };
  if (change.value === undefined) {
    // Init stores an explicit value here, this preset stores none: it sits at the factory default.
    const r = resolveParam(node.type, change.param, change.init!);
    return {
      ...base, label: r.label, concept: r.concept, raw: null, known: r.known, status: "raw",
      display: { text: "factory default" },
      init: r.display.text,
      note: "This preset does not store a value here, so it is at the factory default. That number is not in the file.",
    };
  }
  const r = resolveParam(node.type, change.param, change.value);
  return {
    ...base, label: r.label, concept: r.concept, raw: change.value, known: r.known, status: r.status, basis: r.basis,
    display: r.display,
    init: change.init === undefined ? "default" : resolveParam(node.type, change.param, change.init).display.text,
  };
}

function structural(node: ModuleNode, key: string, label: string, concept: string, display: Display, extra: Partial<Fact> = {}): Fact {
  return {
    id: `${node.id}#${key}`, moduleId: node.id, moduleType: node.type, moduleLabel: L(node), key, label, concept,
    raw: null, display, status: "structural", known: true, tags: [node.type, key], ...extra,
  };
}

function stageOfParam(node: ModuleNode, param: string, fallback: StageId): StageId {
  const spec = resolveParam(node.type, param, 0);
  if (spec.stage) return spec.stage as Stage;
  if (node.type === "Oscillator" || isSubOsc(node.type)) {
    if (/Unison|Detune/.test(param)) return "thickness";
    if (/Warp/.test(param)) return "character";
  }
  return fallback;
}

/** Facts for fields stored beside plainParams that matter to the sound. */
function extraFacts(d: ModuleDiff, always = false): Fact[] {
  const n = d.node, out: Fact[] = [];
  const changed = (k: string) => d.extras.some((e) => e.key === k);
  if (n.type === "WTOsc") {
    const embedded = n.extras.embeddedWTData;
    if (Array.isArray(embedded)) {
      const name = typeof n.extras.tableDisplayName === "string" && n.extras.tableDisplayName ? n.extras.tableDisplayName : "unnamed";
      out.push(structural(n, "embeddedWTData", "Wavetable", "wavetable", { text: `custom table "${name}" stored inside the preset` }, {
        note: "This wavetable is embedded in the file, so it may not exist in your library. Import or redraw it; a factory table will only approximate it.",
        tags: ["WTOsc", "wavetable", "embedded"],
      }));
    } else if (typeof n.extras.relativePathToWT === "string" && (always || changed("relativePathToWT"))) {
      out.push(structural(n, "relativePathToWT", "Wavetable", "wavetable", { text: n.extras.relativePathToWT }, {
        init: changed("relativePathToWT") ? undefined : "same as Init", tags: ["WTOsc", "wavetable"],
      }));
    }
  }
  if (n.type === "NoiseOsc" && typeof n.extras.relativePathToNoiseSample === "string" && changed("relativePathToNoiseSample")) {
    out.push(structural(n, "relativePathToNoiseSample", "Noise sample", "noise", { text: n.extras.relativePathToNoiseSample }));
  }
  if (n.type === "LFO" && changed("curveData")) {
    const cd = n.extras.curveData as Record<string, Cbor> | undefined;
    const points = typeof cd?.numPoints === "number" ? cd.numPoints : undefined;
    const name = typeof n.extras.curveDisplayName === "string" ? n.extras.curveDisplayName : undefined;
    out.push(structural(n, "curveData", "Shape", "shape", { text: `drawn shape${name ? ` "${name}"` : ""}${points !== undefined ? ` (${points} points stored)` : ""}` }, {
      note: "The exact curve is in the file but is not turned into drawing instructions yet. Open the decoded data to see its points.",
      tags: ["LFO", "shape"],
    }));
  }
  if (n.type === "Macro" && typeof n.extras.name === "string" && changed("name")) {
    out.push(structural(n, "name", "Name", "macro", { text: n.extras.name }));
  }
  return out;
}

const HANDLED_EXTRAS: Record<string, string[]> = {
  WTOsc: ["embeddedWTData", "relativePathToWT", "tableDisplayName", "flex"],
  NoiseOsc: ["relativePathToNoiseSample"],
  LFO: ["curveData", "curveDisplayName", "pathData"],
  Macro: ["name"],
  ModSlot: ["source", "destModuleID", "destModuleParamID", "destModuleParamName", "destModuleTypeString"],
  FXRack: ["FX", "displayName"],
};

function leftoverExtraFacts(d: ModuleDiff): Fact[] {
  const handled = HANDLED_EXTRAS[d.node.type] ?? [];
  const fxSiblings = d.node.type.startsWith("FX") ? ["type", "flex"] : [];
  return d.extras
    .filter((e) => !handled.includes(e.key) && !fxSiblings.includes(e.key))
    .map((e) => structural(d.node, e.key, humanize(e.key), e.key, { text: summarise(e.value) }, { known: false, status: "raw" }));
}

function summarise(v: Cbor | undefined): string {
  if (v === undefined) return "removed";
  if (Array.isArray(v)) return `list of ${v.length} items`;
  if (v && typeof v === "object") return `${Object.keys(v).length} stored fields`;
  return String(v);
}

const ENV_ORDER = ["shape", "rate", "mode", "attack", "hold", "decay", "sustain", "release", "curves"];

/** Stable sort by concept order; concepts not listed keep their place at the end. */
function byConcept(facts: Fact[], order: string[]): Fact[] {
  const rank = (f: Fact) => (order.indexOf(f.concept) + 99) % 99;
  return facts.map((f, i) => [f, i] as const).sort((a, b) => rank(a[0]) - rank(b[0]) || a[1] - b[1]).map(([f]) => f);
}

export function analyze(preset: DecodedPreset, baseline: Baseline): Analysis {
  const modules = collectModules(preset.root);
  const diffs = modules.map((m) => diffModule(m, baseline));
  const activity = classify(diffs);
  const byId = new Map(diffs.map((d) => [d.node.id, d]));
  const children = (id: string) => diffs.filter((d) => d.node.parentId === id);
  const fxTypeCount = new Map<string, number>();
  for (const m of modules) if (m.type.startsWith("FX") && m.type !== "FXRack") fxTypeCount.set(m.type, (fxTypeCount.get(m.type) ?? 0) + 1);
  L = (n) => ((fxTypeCount.get(n.type) ?? 0) > 1 ? `${nodeLabel(n)} (rack ${n.index + 1})` : nodeLabel(n));
  const used = new Set<string>(); // module ids already placed in a step
  const steps: Step[] = [];
  const push = (s: Step) => {
    if (s.facts.length || s.stage === "init") steps.push(s);
    s.moduleIds.forEach((m) => used.add(m));
  };

  steps.push({ id: "init", stage: "init", title: "Load the Init preset", goal: "Start from the Init preset", moduleIds: [], facts: [], notes: [] });

  // ---- oscillators: core tone / thickness / character -------------------------------------
  const oscStages: Record<"core" | "thickness" | "character", Step[]> = { core: [], thickness: [], character: [] };
  for (const d of diffs.filter((x) => x.node.type === "Oscillator").sort((a, b) => byNaturalId(a.node, b.node))) {
    const osc = d.node, label = L(osc);
    const kids = children(osc.id);
    const group = [d, ...kids];
    const ids = group.map((g) => g.node.id);
    const enabled = isEnabled(osc);
    if (!enabled) {
      ids.forEach((i) => used.add(i));
      if (osc.params.kParamEnable === 0) {
        // on in Init, switched off here
        oscStages.core.push({ id: `core:${osc.id}`, stage: "core", title: `${label}: switch off`, goal: `Silence ${label}`, moduleIds: ids,
          facts: d.params.filter((p) => p.param === "kParamEnable").map((p) => paramFact(osc, p)), notes: [] });
      }
      continue;
    }
    const buckets: Record<"core" | "thickness" | "character", Fact[]> = { core: [], thickness: [], character: [] };
    for (const g of group) {
      for (const f of extraFacts(g, osc.index <= 2)) buckets.core.push(f);
      for (const p of g.params) buckets[stageOfParam(g.node, p.param, "core") as "core"].push(paramFact(g.node, p));
      for (const f of leftoverExtraFacts(g)) buckets.core.push(f);
    }
    const order = ["enable", "wavetable", "noise", "pitch", "level", "pan", "phase"];
    buckets.core.sort((a, b) => (order.indexOf(a.concept) + 99) % 99 - (order.indexOf(b.concept) + 99) % 99);
    const notes: string[] = [];
    if (kids.filter((k) => k.params.length && k.node.type !== "WTOsc" && osc.index <= 2).length) {
      notes.push("This oscillator stores settings for more than one oscillator type. Which type is selected is not decoded yet.");
    }
    oscStages.core.push({ id: `core:${osc.id}`, stage: "core", title: `${label}: source and pitch`, goal: `Set up ${label} as a sound source`, moduleIds: ids, facts: buckets.core, notes });
    oscStages.thickness.push({ id: `thickness:${osc.id}`, stage: "thickness", title: `${label}: unison`, goal: `Thicken ${label} with unison`, moduleIds: ids, facts: buckets.thickness, notes: [] });
    oscStages.character.push({ id: `character:${osc.id}`, stage: "character", title: `${label}: warp`, goal: `Reshape ${label}'s waveform with warp`, moduleIds: ids, facts: buckets.character, notes: [] });
  }
  (["core", "thickness", "character"] as const).forEach((k) => oscStages[k].forEach(push));

  // ---- filters and routing ---------------------------------------------------------------
  for (const d of diffs.filter((x) => x.node.type === "VoiceFilter").sort((a, b) => byNaturalId(a.node, b.node))) {
    used.add(d.node.id);
    if (!isEnabled(d.node)) continue;
    const order = ["enable", "type", "cutoff", "resonance", "drive"];
    const facts = d.params.map((p) => paramFact(d.node, p)).sort((a, b) => (order.indexOf(a.concept) + 99) % 99 - (order.indexOf(b.concept) + 99) % 99);
    push({ id: `filter:${d.node.id}`, stage: "filter", title: `${L(d.node)}: switch on and set`, goal: `Shape the tone with ${L(d.node)}`, moduleIds: [d.node.id], facts, notes: [] });
  }
  const routing = diffs.filter((x) => x.node.type === "RoutingSlot" && x.params.length);
  if (routing.length) {
    push({ id: "filter:routing", stage: "filter", title: "Routing", goal: "Choose what goes through the filter", moduleIds: routing.map((r) => r.node.id),
      facts: routing.flatMap((r) => r.params.map((p) => paramFact(r.node, p))),
      notes: ["Which routing slot belongs to which oscillator has not been confirmed, so slots are shown by number."] });
  }
  diffs.filter((x) => x.node.type === "RoutingSlot").forEach((r) => used.add(r.node.id));

  // ---- amp envelope ------------------------------------------------------------------------
  const env0 = byId.get("Env0");
  if (env0) {
    push({ id: "contour:Env0", stage: "contour", title: "Env 1: amp envelope", goal: "Shape how each note starts and ends", moduleIds: ["Env0"], facts: byConcept(env0.params.map((p) => paramFact(env0.node, p)), ENV_ORDER), notes: [] });
    used.add("Env0");
  }

  // ---- mod matrix --------------------------------------------------------------------------
  const slots = diffs.map((d) => readModSlot(d.node)).filter((s): s is ModSlotInfo => !!s && s.source !== 0).sort((a, b) => byNaturalId(a.node, b.node));
  const rackFx = diffs.filter((d) => d.node.parentId === "FXRack0" && d.node.type.startsWith("FX"));
  const dest = (s: ModSlotInfo): { moduleId?: string; label: string; resolved: boolean } => {
    let moduleId: string | undefined;
    if (s.destType === "Oscillator") moduleId = `Oscillator${s.destIndex}`;
    else if (isSubOsc(s.destType)) moduleId = `Oscillator${s.destIndex}.${s.destType}${s.destIndex}`;
    else if (s.destType.startsWith("FX")) moduleId = rackFx.find((f) => f.node.index === s.destIndex && f.node.type === s.destType)?.node.id;
    else moduleId = `${s.destType}${s.destIndex}`;
    const node = moduleId ? byId.get(moduleId)?.node : undefined;
    const paramLabel = resolveParam(s.destType, s.destParam, 0).label;
    if (!node) return { label: `${humanize(s.destType)} #${s.destIndex} ${paramLabel}`, resolved: false };
    return { moduleId: node.id, label: `${L(node)} ${paramLabel}`, resolved: true };
  };
  const macroName = (src: ModSource) => {
    const name = src.kind === "macro" && src.moduleId ? byId.get(src.moduleId)?.node.extras.name : undefined;
    return typeof name === "string" && name ? ` "${name}"` : "";
  };
  const slotFacts = (s: ModSlotInfo): Fact[] => {
    const src = resolveSource(s.source), aux = resolveSource(s.aux), to = dest(s);
    const d = byId.get(s.node.id)!;
    const facts: Fact[] = [
      structural(s.node, "route", "Route", "route", { text: `${src.label}${macroName(src)} → ${to.label}` }, {
        known: src.kind !== "unknown" && to.resolved,
        status: "unverified",
        basis: "Source numbers were matched to names by comparing fixtures (macro names, LFO shapes). Not confirmed with a probe preset.",
        note: src.kind === "unknown" ? "This source number is not recognised yet." : !to.resolved ? "The destination module could not be located in the preset." : undefined,
        tags: ["ModSlot", "route", src.kind, s.destType, s.destParam, `${s.destType}.${s.destParam}`],
      }),
    ];
    if (aux.kind !== "none") {
      facts.push(structural(s.node, "aux", "Scaled by", "route", { text: `${aux.label}${macroName(aux)}` }, { status: "unverified", known: aux.kind !== "unknown", tags: ["ModSlot", aux.kind] }));
    }
    if (!("kParamAmount" in s.node.params)) {
      facts.push(structural(s.node, "amount-default", "Amount", "amount", { text: "factory default" }, { status: "raw", note: "No amount is stored for this route, so it is at the factory default. That number is not in the file." }));
    }
    facts.push(...d.params.map((p) => paramFact(s.node, p)));
    return facts;
  };

  const motionSources = new Map<number, ModSlotInfo[]>();
  const perfSlots: ModSlotInfo[] = [];
  for (const s of slots) {
    const kind = resolveSource(s.source).kind;
    if (kind === "macro" || kind === "modwheel") perfSlots.push(s);
    else motionSources.set(s.source, [...(motionSources.get(s.source) ?? []), s]);
    used.add(s.node.id);
  }
  for (const [id, list] of [...motionSources].sort((a, b) => a[0] - b[0])) {
    const src = resolveSource(id);
    const srcDiff = src.moduleId ? byId.get(src.moduleId) : undefined;
    const facts: Fact[] = [];
    if (srcDiff && src.moduleId !== "Env0") {
      facts.push(...extraFacts(srcDiff), ...byConcept(srcDiff.params.map((p) => paramFact(srcDiff.node, p)), ENV_ORDER), ...leftoverExtraFacts(srcDiff));
      used.add(srcDiff.node.id);
    }
    list.forEach((s) => facts.push(...slotFacts(s)));
    const targets = [...new Set(list.map((s) => dest(s).label))].join(", ");
    push({ id: `motion:source${id}`, stage: "motion", title: `${src.label} → ${targets}`, goal: `Add movement with ${src.label}`,
      moduleIds: [...(srcDiff && src.moduleId !== "Env0" ? [srcDiff.node.id] : []), ...list.map((s) => s.node.id)], facts,
      notes: src.moduleId === "Env0" ? ["Env 1 is the amp envelope set in the Contour stage; here it is also used as a modulation source."] : [] });
  }

  // ---- FX rack -----------------------------------------------------------------------------
  for (const rack of diffs.filter((d) => d.node.type === "FXRack").sort((a, b) => byNaturalId(a.node, b.node))) {
    used.add(rack.node.id);
    const entries = children(rack.node.id).filter((c) => c.node.type.startsWith("FX")).sort((a, b) => a.node.index - b.node.index);
    for (const fx of entries) {
      const pos = fx.node.index + 1;
      const where = nodeLabel(rack.node);
      const facts: Fact[] = [
        structural(fx.node, "position", "Rack position", "position", { text: `${pos} of ${entries.length}`, num: pos }, {
          status: "unverified", basis: "The order of the FX list in the file is assumed to be the rack order.", tags: [fx.node.type, "position"],
        }),
        ...fx.params.map((p) => paramFact(fx.node, p)),
        ...leftoverExtraFacts(fx),
      ];
      push({ id: `space:${fx.node.id}`, stage: "space", title: `${where} ${pos}: ${fxName(fx.node.type)}`, goal: `Add ${fxName(fx.node.type)} to the ${where}`, moduleIds: [fx.node.id], facts, notes: [] });
    }
    const own = [...rack.params.map((p) => paramFact(rack.node, p)), ...leftoverExtraFacts(rack)];
    if (own.length) push({ id: `space:${rack.node.id}`, stage: "space", title: `${L(rack.node)} settings`, goal: `Adjust the ${L(rack.node)}`, moduleIds: [rack.node.id], facts: own, notes: [] });
  }

  // ---- performance: macros, mod wheel, global ---------------------------------------------
  const macroFacts: Fact[] = [];
  const macroIds: string[] = [];
  for (const d of diffs.filter((x) => x.node.type === "Macro").sort((a, b) => byNaturalId(a.node, b.node))) {
    used.add(d.node.id);
    const mine = perfSlots.filter((s) => resolveSource(s.source).moduleId === d.node.id);
    if (activity.get(d.node.id) !== "active") continue;
    macroIds.push(d.node.id, ...mine.map((s) => s.node.id));
    macroFacts.push(...extraFacts(d), ...d.params.map((p) => paramFact(d.node, p)), ...mine.flatMap(slotFacts));
  }
  push({ id: "performance:macros", stage: "performance", title: "Macros", goal: "Wire up the macro knobs", moduleIds: macroIds, facts: macroFacts,
    notes: macroFacts.length ? ["A macro's value adds to whatever it controls, so a knob that reads zero can still be audible if its macro is turned up."] : [] });
  const wheel = perfSlots.filter((s) => resolveSource(s.source).kind === "modwheel");
  push({ id: "performance:modwheel", stage: "performance", title: "Mod wheel", goal: "Assign the mod wheel", moduleIds: wheel.map((s) => s.node.id), facts: wheel.flatMap(slotFacts), notes: [] });
  const global = byId.get("Global0");
  if (global) {
    push({ id: "performance:global", stage: "performance", title: "Voicing and global settings", goal: "Set voicing, glide and overall level", moduleIds: ["Global0"],
      facts: [...global.params.map((p) => paramFact(global.node, p)), ...leftoverExtraFacts(global)], notes: [] });
    used.add("Global0");
  }

  // ---- combinations ------------------------------------------------------------------------
  detectCombos({ diffs, byId, slots, label: (n) => L(n), dest, macroName }).forEach((s) => steps.push(s));

  // ---- anything left that changed and is in use -------------------------------------------
  const leftovers: Fact[] = [];
  const leftoverIds: string[] = [];
  for (const d of diffs) {
    if (used.has(d.node.id) || activity.get(d.node.id) !== "active") continue;
    if (d.node.type === "ArpClip" || d.node.type === "MidiClip") continue; // pattern names only; arp/clip content is out of scope
    const facts = [...d.params.map((p) => ({ ...paramFact(d.node, p), known: false })), ...leftoverExtraFacts(d)];
    if (facts.length) { leftovers.push(...facts); leftoverIds.push(d.node.id); }
  }
  push({ id: "other", stage: "other", title: "Other stored changes", goal: "Other changes", moduleIds: leftoverIds, facts: leftovers,
    notes: leftovers.length ? ["These settings differ from Init but the app does not know what they do yet. They are listed exactly as stored."] : [] });

  // ---- cross-references: tell each step what else moves its settings ------------------------
  for (const s of slots) {
    const to = dest(s), src = resolveSource(s.source);
    if (!to.moduleId) continue;
    const target = steps.find((st) => st.moduleIds.includes(to.moduleId!) && !st.moduleIds.includes(s.node.id));
    const note = `${to.label} is also driven by ${src.label}${macroName(src)}.`;
    if (target && !target.notes.includes(note)) target.notes.push(note);
  }

  // ---- graph -------------------------------------------------------------------------------
  const graph: FlowGraph = {
    sources: diffs.filter((d) => d.node.type === "Oscillator" && isEnabled(d.node)).map((d) => ({ id: d.node.id, label: L(d.node) })),
    filters: diffs.filter((d) => d.node.type === "VoiceFilter" && isEnabled(d.node)).map((d) => ({
      id: d.node.id, label: L(d.node),
      type: typeof d.node.params.kParamType === "string" ? resolveParam("VoiceFilter", "kParamType", d.node.params.kParamType).display.text : undefined,
    })),
    fx: rackFx.sort((a, b) => a.node.index - b.node.index).map((d) => ({ id: d.node.id, label: fxName(d.node.type) })),
    mods: slots.map((s) => {
      const src = resolveSource(s.source);
      const amount = s.node.params.kParamAmount;
      return { from: `${src.label}${macroName(src)}`, to: dest(s).label, amount: typeof amount === "number" ? resolveParam("ModSlot", "kParamAmount", amount).display.text : undefined };
    }),
    caveats: [
      "Per-oscillator routing is not decoded yet, so every source is drawn going through the enabled filters.",
      "Mod source names and FX order are inferred from the fixtures and have not been confirmed in Serum.",
    ],
  };

  return { modules, diffs, activity, steps, graph };
}

export { labelFor };
