// "Drop your attempt": both presets go through the same pipeline and are compared fact by fact.
import { sameValue } from "../patch/diff";
import type { Analysis } from "../flow/build";
import type { Fact, StageId, Step } from "../flow/facts";

export type Verdict = "match" | "close" | "different" | "missing" | "extra";

export interface FactComparison {
  verdict: Verdict;
  /** The target's fact (absent for "extra"). */
  target?: Fact;
  /** The attempt's fact (absent for "missing"). */
  attempt?: Fact;
  text: string;
}

export interface StepComparison {
  id: string;
  stage: StageId;
  title: string;
  /** Worst verdict among the facts; "match" when everything lines up. */
  verdict: Verdict;
  facts: FactComparison[];
}

/** A numeric value within this fraction of the target counts as "close". */
export const CLOSE_TOLERANCE = 0.1;

function isClose(a: Fact, b: Fact): boolean {
  if (typeof a.raw !== "number" || typeof b.raw !== "number") return false;
  const scale = Math.max(Math.abs(a.raw), Math.abs(b.raw));
  return scale > 0 && Math.abs(a.raw - b.raw) <= CLOSE_TOLERANCE * scale;
}

function compareFact(target: Fact, attempt: Fact | undefined): FactComparison {
  const who = `${target.moduleLabel} ${target.label}`;
  if (!attempt) {
    return { verdict: "missing", target, text: `${who}: the target has ${target.display.text}; your patch leaves this as it is in Init.` };
  }
  const same = target.raw !== null || attempt.raw !== null ? sameValue(target.raw, attempt.raw) : target.display.text === attempt.display.text;
  if (same) return { verdict: "match", target, attempt, text: `${who}: ${target.display.text}.` };
  const verdict: Verdict = isClose(target, attempt) ? "close" : "different";
  return { verdict, target, attempt, text: `${who}: target ${target.display.text}, yours ${attempt.display.text}.` };
}

const RANK: Record<Verdict, number> = { match: 0, close: 1, extra: 2, different: 3, missing: 3 };
const worst = (facts: FactComparison[]): Verdict => facts.reduce<Verdict>((w, f) => (RANK[f.verdict] > RANK[w] ? f.verdict : w), "match");

export function compare(target: Analysis, attempt: Analysis): StepComparison[] {
  const attemptFacts = new Map(attempt.steps.flatMap((s) => s.facts).map((f) => [f.id, f]));
  const targetIds = new Set(target.steps.flatMap((s) => s.facts).map((f) => f.id));
  const out: StepComparison[] = [];

  for (const step of target.steps) {
    if (step.stage === "init") continue;
    const facts = step.facts.map((f) => compareFact(f, attemptFacts.get(f.id)));
    // extras that belong to the same step in the attempt
    const twin = attempt.steps.find((s) => s.id === step.id);
    for (const f of twin?.facts ?? []) {
      if (!targetIds.has(f.id)) facts.push({ verdict: "extra", attempt: f, text: `${f.moduleLabel} ${f.label}: yours is ${f.display.text}; the target leaves this as it is in Init.` });
    }
    out.push({ id: step.id, stage: step.stage, title: step.title, verdict: worst(facts), facts });
  }

  // steps that exist only in the attempt
  const targetStepIds = new Set(target.steps.map((s) => s.id));
  for (const step of attempt.steps as Step[]) {
    if (targetStepIds.has(step.id) || step.stage === "init") continue;
    const facts = step.facts.filter((f) => !targetIds.has(f.id)).map<FactComparison>((f) => ({
      verdict: "extra", attempt: f, text: `${f.moduleLabel} ${f.label}: yours is ${f.display.text}; the target does not use this.`,
    }));
    if (facts.length) out.push({ id: step.id, stage: step.stage, title: `${step.title} (only in your patch)`, verdict: "extra", facts });
  }
  return out;
}

export function tally(steps: StepComparison[]): Record<Verdict, number> {
  const t: Record<Verdict, number> = { match: 0, close: 0, different: 0, missing: 0, extra: 0 };
  for (const s of steps) for (const f of s.facts) t[f.verdict]++;
  return t;
}
