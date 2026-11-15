// The arpeggiator, as pure rules: which notes it plays, in what order, and how often. Held keys are not
// sounded together; they are played one at a time, in step with the tempo clock, round and round.
export const ARP_MODES = ["up", "down", "updown", "played"] as const;
export type ArpMode = (typeof ARP_MODES)[number];
/** Steps per beat: quarter notes, eighths, sixteenths, or triplet eighths. */
export const ARP_DIVS = ["1", "2", "3", "4"] as const;

/** One trip through the pattern for these held keys (in the order they were pressed). */
export function arpCycle(keys: readonly number[], mode: ArpMode, octaves: number): number[] {
  const unique = keys.filter((n, i) => keys.indexOf(n) === i);
  if (!unique.length) return [];
  const base = mode === "played" ? unique : [...unique].sort((a, b) => a - b);
  const span = Array.from({ length: Math.max(1, Math.min(3, Math.round(octaves))) }, (_, o) => base.map((n) => n + 12 * o)).flat();
  if (mode === "down") return span.reverse();
  // up and back down without repeating the top or bottom note, so the turn-rounds are even
  if (mode === "updown") return span.length > 2 ? [...span, ...span.slice(1, -1).reverse()] : span;
  return span;
}
/** How long one step lasts, in seconds. */
export const arpStepSeconds = (bpm: number, div: string) => 60 / Math.max(20, bpm) / Math.max(1, Number(div) || 1);
/** The time of the next step on the tempo clock's grid at or after `now` (step k is at k times the step length). */
export const nextArpTime = (now: number, step: number) => Math.ceil((now - 1e-6) / step) * step;
