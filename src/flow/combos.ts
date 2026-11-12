// Detects settings that only make sense together (a detuned pair, a macro that switches an effect in,
// an LFO on level...). Code decides that the pattern is present and states it as a fact; the narrator
// may then explain it from the matching knowledge card. Nothing here guesses at an artist's intent.
import { resolveParam } from "../display/registry";
import { isEnabled, type ModSlotInfo } from "../patch/activity";
import type { ModuleDiff } from "../patch/diff";
import type { ModuleNode, ParamValue } from "../patch/model";
import { resolveSource, type ModSource } from "../patch/sources";
import type { Fact, Step } from "./facts";

export interface ComboContext {
  diffs: ModuleDiff[];
  byId: Map<string, ModuleDiff>;
  slots: ModSlotInfo[];
  /** Human label for a module ("Osc A", "EQ (rack 2)"). */
  label: (n: ModuleNode) => string;
  /** Where a route points, as a label, plus the module it resolved to. */
  dest: (s: ModSlotInfo) => { moduleId?: string; label: string; resolved: boolean };
  /** ` "NAME"` for a named macro, otherwise an empty string. */
  macroName: (src: ModSource) => string;
}

const num = (v: ParamValue | undefined): number | undefined => (typeof v === "number" ? v : undefined);
const show = (type: string, param: string, v: ParamValue) => resolveParam(type, param, v).display.text;

function fact(tag: string, n: number, text: string, extraTags: string[] = []): Fact {
  return {
    id: `combo:${tag}#${n}`, moduleId: "combo", moduleType: "Combo", moduleLabel: "", key: "combo", label: "Interplay", concept: tag,
    raw: null, display: { text }, status: "unverified", known: true,
    basis: "This pattern is detected from stored settings. It relies on readings (mod source names, display values) that are not yet confirmed.",
    tags: [`combo:${tag}`, ...extraTags],
  };
}

const step = (tag: string, title: string, goal: string, facts: Fact[], notes: string[] = []): Step => ({
  id: `interplay:${tag}`, stage: "interplay", title, goal, moduleIds: [], facts, notes,
});

const list = (items: string[]) => (items.length <= 1 ? items.join("") : `${items.slice(0, -1).join(", ")} and ${items[items.length - 1]}`);

export function detectCombos(ctx: ComboContext): Step[] {
  const { diffs, byId, slots, label, dest, macroName } = ctx;
  const out: Step[] = [];
  const src = (s: ModSlotInfo) => resolveSource(s.source);
  const named = (s: ModSource) => `${s.label}${macroName(s)}`;
  const amount = (s: ModSlotInfo) => (typeof s.node.params.kParamAmount === "number" ? ` (amount ${show("ModSlot", "kParamAmount", s.node.params.kParamAmount)})` : "");

  // 1. Two oscillators at the same pitch, fine-tuned apart.
  const pitched = diffs.map((d) => d.node).filter((n) => n.type === "Oscillator" && n.index <= 2 && isEnabled(n));
  const pairs: Fact[] = [];
  for (let i = 0; i < pitched.length; i++) {
    for (let j = i + 1; j < pitched.length; j++) {
      const a = pitched[i]!, b = pitched[j]!;
      const coarse = (n: ModuleNode) => (num(n.params.kParamOctave) ?? 0) * 12 + (num(n.params.kParamPitch) ?? 0);
      const fa = num(a.params.kParamFine) ?? 0, fb = num(b.params.kParamFine) ?? 0;
      if (coarse(a) !== coarse(b) || Math.abs(fa - fb) < 4) continue;
      const f = (n: ModuleNode, v: number) => `${label(n)} Fine is ${n.params.kParamFine === undefined ? "at its default" : show("Oscillator", "kParamFine", v)}`;
      pairs.push(fact("detuned-pair", pairs.length, `${f(a, fa)} and ${f(b, fb)}, with both oscillators at the same octave and semitone.`, ["kParamFine"]));
    }
  }
  if (pairs.length) out.push(step("detuned-pair", "Detuned oscillator pair", "Two oscillators tuned slightly apart beat against each other", pairs));

  // 2. Effects parked at zero mix and brought in by a macro.
  const gated: Fact[] = [];
  for (const s of slots) {
    if (src(s).kind !== "macro" || !s.destType.startsWith("FX") || s.destParam !== "kParamWet") continue;
    const to = dest(s);
    const fx = to.moduleId ? byId.get(to.moduleId)?.node : undefined;
    if (!fx || fx.params.kParamWet !== 0) continue;
    const macro = byId.get(src(s).moduleId!)?.node;
    const value = macro && typeof macro.params.kParamValue === "number" ? `, which is saved at ${show("Macro", "kParamValue", macro.params.kParamValue)}` : ", which is saved at its default";
    gated.push(fact("macro-fx", gated.length, `${label(fx)} Mix (wet) is set to 0%, and ${named(src(s))} raises it${amount(s)}${value}.`, [fx.type, "Macro"]));
  }
  if (gated.length) out.push(step("macro-fx", "Macros bring the effects in", "Effects stay silent until their macro is turned", gated));

  // 3. One macro, several destinations.
  const multi: Fact[] = [];
  const byMacro = new Map<number, ModSlotInfo[]>();
  for (const s of slots) if (src(s).kind === "macro") byMacro.set(s.source, [...(byMacro.get(s.source) ?? []), s]);
  for (const [id, routes] of [...byMacro].sort((a, b) => a[0] - b[0])) {
    if (routes.length < 2) continue;
    multi.push(fact("macro-multi", multi.length, `${named(resolveSource(id))} drives ${routes.length} settings at once: ${list(routes.map((r) => dest(r).label))}.`, ["Macro"]));
  }
  if (multi.length) out.push(step("macro-multi", "One macro, several jobs", "A single knob moves several settings together", multi));

  // 4. Mod wheel -> macro -> something else.
  const chain: Fact[] = [];
  for (const s of slots) {
    if (src(s).kind !== "modwheel" || s.destType !== "Macro") continue;
    const macroId = 25 + s.destIndex;
    const macro = resolveSource(macroId);
    const scaled = slots.filter((r) => r.aux === macroId);
    const driven = slots.filter((r) => r.source === macroId);
    const parts = [
      scaled.length ? `scales ${list(scaled.map((r) => `the route ${src(r).label} → ${dest(r).label}`))}` : "",
      driven.length ? `drives ${list(driven.map((r) => dest(r).label))}` : "",
    ].filter(Boolean);
    chain.push(fact("wheel-chain", chain.length, `The mod wheel turns ${named(macro)}${amount(s)}${parts.length ? `, which ${parts.join(" and ")}` : ""}.`, ["modwheel", "Macro"]));
  }
  if (chain.length) out.push(step("wheel-chain", "Mod wheel chain", "The mod wheel controls the movement through a macro", chain));

  // 5. Envelope on filter cutoff.
  const envCut: Fact[] = [];
  for (const s of slots) {
    if (src(s).kind !== "env" || s.destType !== "VoiceFilter" || s.destParam !== "kParamFreq") continue;
    const env = byId.get(src(s).moduleId!)?.node;
    const sustain = num(env?.params.kParamSustain);
    const closes = sustain !== undefined && sustain <= 0.15 ? `, and ${src(s).label} Sustain is ${show("Env", "kParamSustain", sustain)}, so the cutoff falls back while the note is still held` : "";
    envCut.push(fact("filter-envelope", envCut.length, `${src(s).label} moves ${dest(s).label}${amount(s)}${closes}.`, ["Env", "VoiceFilter", "VoiceFilter.kParamFreq"]));
  }
  if (envCut.length) out.push(step("filter-envelope", "Envelope on the filter cutoff", "An envelope opens and closes the filter on every note", envCut));

  // 6. LFO destinations with a recognisable result.
  const lfoRoutes = slots.filter((s) => src(s).kind === "lfo");
  const group = (tag: string, title: string, goal: string, pick: (s: ModSlotInfo) => boolean, phrase: string, tags: string[]) => {
    const bySource = new Map<number, ModSlotInfo[]>();
    for (const s of lfoRoutes.filter(pick)) bySource.set(s.source, [...(bySource.get(s.source) ?? []), s]);
    const facts = [...bySource].sort((a, b) => a[0] - b[0]).map(([id, routes], i) =>
      fact(tag, i, `${resolveSource(id).label} moves ${list(routes.map((r) => `${dest(r).label}${amount(r)}`))}${phrase}.`, ["LFO", ...tags]));
    if (facts.length) out.push(step(tag, title, goal, facts));
  };
  group("lfo-cutoff", "LFO on the filter cutoff", "An LFO sweeps the filter", (s) => s.destType === "VoiceFilter" && s.destParam === "kParamFreq", ", a repeating filter sweep", ["VoiceFilter", "VoiceFilter.kParamFreq"]);
  group("tremolo", "LFO on oscillator level", "An LFO pulses the volume", (s) => s.destType === "Oscillator" && s.destParam === "kParamVolume", ", a repeating change in loudness (tremolo)", ["kParamVolume"]);
  group("pitch-lfo", "LFO on pitch", "An LFO moves the pitch", (s) => ["kParamMasterTuning", "kParamFine", "kParamPitch", "kParamOctave"].includes(s.destParam), ", a repeating change in pitch", ["kParamFine"]);

  // 7. A modulator whose own settings are modulated.
  const meta: Fact[] = [];
  for (const s of slots) {
    if (s.destType !== "LFO" && s.destType !== "Env") continue;
    meta.push(fact("mod-of-mod", meta.length, `${named(src(s))} changes ${dest(s).label}${amount(s)}, so a modulator is itself being modulated.`, [s.destType]));
  }
  if (meta.length) out.push(step("mod-of-mod", "Modulating a modulator", "The movement itself changes over time or under your control", meta));

  // 8. Mono + legato + portamento.
  const g = byId.get("Global0")?.node;
  if (g && g.params.kParamMonoToggle === 1 && (g.params.kParamLegato === 1 || g.params.kParamPortamentoTime !== undefined)) {
    const parts = ["Mono is on"];
    if (g.params.kParamLegato === 1) parts.push("Legato is on");
    if (g.params.kParamPortamentoTime !== undefined) parts.push(`Portamento time is ${show("Global", "kParamPortamentoTime", g.params.kParamPortamentoTime)}`);
    if (g.params.kParamPortaAlways === 1) parts.push("Portamento always is on");
    out.push(step("glide", "Mono, legato and glide", "Notes slide into each other like a single voice", [fact("glide", 0, `${list(parts)}.`, ["kParamMonoToggle", "kParamLegato", "kParamPortamentoTime"])]));
  }

  return out;
}
