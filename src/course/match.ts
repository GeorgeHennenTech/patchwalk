// Match-by-ear: compare the learner's settings with a hidden target and say which way each one is off,
// without revealing the target's numbers.
import type { SynthState } from "../synth/params";

export type MatchVerdict = "match" | "too low" | "too high" | "different";

/** How close a numeric setting has to be to count. Pitch in cents is the only one with slack. */
const TOLERANCE: Partial<Record<keyof SynthState, number>> = { fine: 10, bFine: 10, freeHz: 0, volumeDb: 2, detune: 12, position: 12, spread: 20, bLevelDb: 4, subLevelDb: 4, noiseLevelDb: 5, aLevelDb: 4, resonance: 20, drive: 25, keyTrack: 20, envS: 20, env2S: 20, env2Amount: 20, lfo1Amount: 20, lfo2Amount: 20, lfo3Amount: 20 };
/** Cutoff is judged in octaves, as the ear hears it: within about a third of an octave counts. */
const CUTOFF_OCTAVES = 0.4;
/** Times and rates are judged as ratios too: within double or half counts, which is about how the ear hears them. */
const RATIO_KEYS = new Set<keyof SynthState>(["envA", "envD", "envR", "env2A", "env2D", "env2R", "lfo1Rate", "lfo2Rate", "lfo3Rate"]);

export function compareSetting(key: keyof SynthState, mine: SynthState, target: Partial<SynthState>): MatchVerdict {
  const a = mine[key], b = target[key];
  if (key === "cutoff" && typeof a === "number" && typeof b === "number") {
    const octaves = Math.log2(a / b);
    return Math.abs(octaves) <= CUTOFF_OCTAVES ? "match" : octaves < 0 ? "too low" : "too high";
  }
  if (RATIO_KEYS.has(key) && typeof a === "number" && typeof b === "number") {
    const doublings = Math.log2(a / b);
    return Math.abs(doublings) <= 1 ? "match" : doublings < 0 ? "too low" : "too high";
  }
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
