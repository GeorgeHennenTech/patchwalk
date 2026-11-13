// Match-by-ear: compare the learner's settings with a hidden target and say which way each one is off,
// without revealing the target's numbers.
import type { SynthState } from "../synth/params";

export type MatchVerdict = "match" | "too low" | "too high" | "different";

/** How close a numeric setting has to be to count. Pitch in cents is the only one with slack. */
const TOLERANCE: Partial<Record<keyof SynthState, number>> = { fine: 10, freeHz: 0, volumeDb: 2 };

export function compareSetting(key: keyof SynthState, mine: SynthState, target: Partial<SynthState>): MatchVerdict {
  const a = mine[key], b = target[key];
  if (typeof a === "number" && typeof b === "number") {
    const slack = key === "freeHz" ? b * 0.03 : (TOLERANCE[key] ?? 0);
    if (Math.abs(a - b) <= slack) return "match";
    return a < b ? "too low" : "too high";
  }
  return a === b ? "match" : "different";
}

export function compareToTarget(mine: SynthState, target: Partial<SynthState>, keys: (keyof SynthState)[]): Record<string, MatchVerdict> {
  return Object.fromEntries(keys.map((k) => [k, compareSetting(k, mine, target)]));
}

export const allMatch = (verdicts: Record<string, MatchVerdict>) => Object.values(verdicts).every((v) => v === "match");
