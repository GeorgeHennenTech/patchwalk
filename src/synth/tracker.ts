// Records what the learner has done since a lesson step began, so steps can be checked from facts.
import type { Snapshot } from "../course/types";
import type { SynthState } from "./params";

export interface Track {
  start: SynthState;
  played: { mouse: number; keys: number; midi: number };
  notes: number[];
  range: Snapshot["range"];
  changes: Snapshot["changes"];
  flags: Record<string, boolean>;
  /** Clock time (seconds) at which the currently held note began, or null when nothing is held. */
  heldSince: number | null;
  /** Longest finished hold since the step began, in seconds. */
  longest: number;
  velocity: Snapshot["velocity"];
  lastNote: number | null;
}

export const newTrack = (state: SynthState): Track => ({
  start: state, played: { mouse: 0, keys: 0, midi: 0 }, notes: [], range: {}, changes: {}, flags: {}, heldSince: null, longest: 0, velocity: null, lastNote: null,
});

export function trackState(t: Track, prev: SynthState, next: SynthState): Track {
  const range = { ...t.range }, changes = { ...t.changes };
  for (const key of Object.keys(next) as (keyof SynthState)[]) {
    if (next[key] === prev[key]) continue;
    changes[key] = (changes[key] ?? 0) + 1;
    const v = next[key];
    if (typeof v === "number") {
      const before = typeof prev[key] === "number" ? (prev[key] as number) : v;
      const r = range[key] ?? { min: before, max: before };
      range[key] = { min: Math.min(r.min, v), max: Math.max(r.max, v) };
    }
  }
  return { ...t, range, changes };
}

export function trackNoteOn(t: Track, source: keyof Track["played"], note: number, now: number, velocity = 100): Track {
  return {
    ...t,
    velocity: { min: Math.min(t.velocity?.min ?? velocity, velocity), max: Math.max(t.velocity?.max ?? velocity, velocity) },
    played: { ...t.played, [source]: t.played[source] + 1 },
    notes: t.notes.includes(note) ? t.notes : [...t.notes, note],
    heldSince: t.heldSince ?? now,
    lastNote: note,
  };
}

export const trackAllReleased = (t: Track, now?: number): Track => ({ ...t, heldSince: null, longest: t.heldSince !== null && now !== undefined ? Math.max(t.longest, now - t.heldSince) : t.longest });
export const trackFlag = (t: Track, flag: string): Track => ({ ...t, flags: { ...t.flags, [flag]: true } });

export function snapshot(t: Track, state: SynthState, live: { audioRunning: boolean; held: number[]; holdOn: boolean; now: number }): Snapshot {
  return {
    state, start: t.start, audioRunning: live.audioRunning, held: live.held, holdOn: live.holdOn,
    played: t.played, distinctNotes: t.notes.length, velocity: t.velocity,
    heldSeconds: t.heldSince !== null && live.held.length ? live.now - t.heldSince : 0,
    longestHeld: Math.max(t.longest, t.heldSince !== null && live.held.length ? live.now - t.heldSince : 0),
    range: t.range, changes: t.changes, flags: t.flags,
    lastNote: live.held.length ? live.held[live.held.length - 1]! : t.lastNote,
  };
}
