// One fact graph, three renderings. Difficulty changes grouping and wording, never which facts exist.
import { trim } from "../display/format";
import type { Fact, StageId, Step } from "../flow/facts";
import type { Difficulty } from "./contract";

export interface RenderedLine {
  factId: string;
  text: string;
  /** Advanced only: the exact-value line, shown when the learner asks for values. */
  hidden: boolean;
  unverified: boolean;
  /** The app has no interpretation for this setting (rule 6). */
  uninterpreted: boolean;
  note?: string;
  basis?: string;
}

export interface RenderedStep {
  id: string;
  /** Id of the step in the fact graph this was rendered from. */
  sourceId: string;
  stage: StageId;
  title: string;
  goal: string;
  lines: RenderedLine[];
  notes: string[];
  facts: Fact[];
}

const EXACT_UNITS = new Set(["oct", "st", "cents", ""]);

/** Intermediate: a value becomes a range to aim for. Whole-number musical values stay exact. */
export function rangeText(f: Fact): string | undefined {
  const { num, unit = "", decimals = 0 } = f.display;
  if (num === undefined || f.status === "structural") return undefined;
  if (decimals === 0 && EXACT_UNITS.has(unit)) return undefined;
  if (num === 0) return undefined;
  const spread = Math.max(Math.abs(num) * 0.1, 10 ** -decimals);
  let lo = num - spread, hi = num + spread;
  if (unit === "%") { lo = Math.max(lo, -100); hi = Math.min(hi, 100); }
  if (num > 0) lo = Math.max(lo, 0);
  if (num < 0) hi = Math.min(hi, 0);
  const d = Math.abs(num) >= 100 ? 0 : decimals;
  const a = trim(lo, d), b = trim(hi, d);
  if (a === b) return undefined;
  const u = unit ? (unit === "%" ? "%" : ` ${unit}`) : "";
  return `${a} to ${b}${u}`;
}

function exactLine(f: Fact): string {
  const who = `${f.moduleLabel} ${f.label}`;
  if (!f.known) return `${f.moduleLabel} stores "${f.label}" = ${f.display.text}. The app cannot interpret this setting yet.`;
  if (f.display.text === "factory default") return `Reset ${who} to its factory default.`;
  switch (f.key) {
    case "route": return `Add a modulation route: ${f.display.text}.`;
    case "aux": return `Scale that route by ${f.display.text}.`;
    case "position": return `Add ${f.moduleLabel} to the rack at position ${f.display.text}.`;
    case "embeddedWTData": return `${f.moduleLabel} uses a ${f.display.text}.`;
    case "relativePathToWT": return f.init === "same as Init" ? `Keep ${f.moduleLabel} on the Init wavetable (${f.display.text}).` : `Load the wavetable ${f.display.text} into ${f.moduleLabel}.`;
    case "relativePathToNoiseSample": return `Load the noise sample ${f.display.text}.`;
    case "name": return `Name ${f.moduleLabel} "${f.display.text}".`;
    case "curveData": return `Give ${f.moduleLabel} a ${f.display.text}.`;
    case "kParamEnable": return `Switch ${f.moduleLabel} ${f.display.text.toLowerCase()}.`;
  }
  if (f.display.text === "On" || f.display.text === "Off") return `Turn ${who} ${f.display.text.toLowerCase()}.`;
  return `Set ${who} to ${f.display.text}.`;
}

function line(f: Fact, difficulty: Difficulty): RenderedLine {
  let text = exactLine(f);
  // Init's own value is only worth showing when the file states it; "default" carries no number.
  if (difficulty === "beginner" && f.known && f.init && f.init !== "same as Init" && f.init !== "default" && f.display.text !== "factory default") {
    text += ` (Init: ${f.init})`;
  }
  if (difficulty === "intermediate" && f.known) {
    const range = rangeText(f);
    if (range) text = `Set ${f.moduleLabel} ${f.label} somewhere around ${range}.`;
  }
  return {
    factId: f.id, text, hidden: difficulty === "advanced",
    unverified: f.status === "unverified" || f.status === "raw",
    uninterpreted: !f.known, note: f.note, basis: f.basis,
  };
}

const cap = (s: string) => s.charAt(0).toUpperCase() + s.slice(1);

export function render(steps: Step[], difficulty: Difficulty): RenderedStep[] {
  const out: RenderedStep[] = [];
  for (const step of steps) {
    if (difficulty !== "beginner" || step.facts.length === 0) {
      out.push({ id: step.id, sourceId: step.id, stage: step.stage, title: difficulty === "advanced" ? step.goal : step.title, goal: step.goal,
        lines: step.facts.map((f) => line(f, difficulty)), notes: step.notes, facts: step.facts });
      continue;
    }
    // Beginner: one concept per step. Facts about the same module and concept stay together.
    const groups: Fact[][] = [];
    for (const f of step.facts) {
      const last = groups[groups.length - 1];
      if (last && last[0]!.moduleId === f.moduleId && last[0]!.concept === f.concept) last.push(f);
      else groups.push([f]);
    }
    groups.forEach((facts, i) => {
      const head = facts[0]!;
      out.push({
        id: groups.length === 1 ? step.id : `${step.id}/${i + 1}`, sourceId: step.id, stage: step.stage,
        title: groups.length === 1 ? step.title : `${head.moduleLabel}: ${cap(facts.length === 1 ? head.label : head.concept)}`,
        goal: step.goal, lines: facts.map((f) => line(f, difficulty)),
        notes: i === groups.length - 1 ? step.notes : [], facts,
      });
    });
  }
  return out;
}
