// Counting: one cycle (a bar) that repeats, with one or two layers of clicks in it, and taps judged against a layer.
// Pure rules, shared by the page and the tests. A layer's hits are places in the cycle from 0 (its start) up to 1.

export interface Layer { name: string; /** places of its clicks in the cycle, 0 up to 1, rising */ hits: number[]; /** what to say on each click: "1", "2", "and"... */ count: string[] }
export interface Exercise { id: string; title: string; /** two or three plain sentences */ idea: string; /** beats a minute to start at, counting the cycle as four beats */ bpm: number; layers: Layer[]; /** which layer to tap first */ tap: number }

/** `n` clicks spread evenly through the cycle, counted 1 to n. */
export const even = (name: string, n: number): Layer => ({ name, hits: Array.from({ length: n }, (_, i) => i / n), count: Array.from({ length: n }, (_, i) => String(i + 1)) });
/** A layer from chosen steps of a cycle cut into `of` equal steps. */
export const steps = (name: string, of: number, at: number[], count: string[]): Layer => ({ name, hits: at.map((i) => i / of), count });

export const EXERCISES: Exercise[] = [
  { id: "four", title: "A steady four", bpm: 90, tap: 0, idea: "Four even clicks to a cycle. Count them aloud: one, two, three, four. Tap on every click. The readout says how many thousandths of a second early or late each tap was.", layers: [even("Four", 4)] },
  { id: "three", title: "A steady three", bpm: 90, tap: 0, idea: "The same length of cycle, now cut in three. Count one, two, three. Each click is further from the last than it was in four: the cycle is the same, the slices are bigger.", layers: [even("Three", 3)] },
  { id: "threes-in-a-beat", title: "Three to a beat", bpm: 70, tap: 1, idea: "The low click is the beat: four to a cycle. The high one plays three for each beat. Count one-and-a, two-and-a. Tap the threes while the beat keeps you in place.", layers: [even("Beat", 4), { ...even("Threes", 12), count: ["1", "and", "a", "2", "and", "a", "3", "and", "a", "4", "and", "a"] }] },
  { id: "shuffle", title: "Shuffle", bpm: 80, tap: 1, idea: "A shuffle is three to a beat with the middle one left out: long, short, long, short. Count one-(and)-a, two-(and)-a and tap only the one and the a.", layers: [even("Beat", 4), steps("Shuffle", 12, [0, 2, 3, 5, 6, 8, 9, 11], ["1", "a", "2", "a", "3", "a", "4", "a"])] },
  { id: "three-two", title: "Three against two", bpm: 60, tap: 1, idea: "Two clicks and three clicks share one cycle. They meet only at the start. Tap the three while the two plays, then swap. Together the two hands make one shape: together, right, left, right.", layers: [even("Two", 2), even("Three", 3)] },
  { id: "four-three", title: "Four against three", bpm: 50, tap: 1, idea: "Three clicks and four clicks share one cycle and meet only at the start. It is slower to find than three against two. Start by tapping one layer with the other switched off, then bring it back.", layers: [even("Three", 3), even("Four", 4)] },
  { id: "bell", title: "A bell pattern over four", bpm: 60, tap: 1, idea: "Twelve small steps to the cycle, with a beat every three. The bell plays seven of the twelve in an uneven shape: long long short, long long long short. Tap the bell and keep hearing the four beats under it.", layers: [even("Beat", 4), steps("Bell", 12, [0, 2, 4, 5, 7, 9, 11], ["1", "2", "3", "4", "5", "6", "7"])] },
];

/** How long one cycle lasts, in seconds, when the cycle is four beats at `bpm`. */
export const cycleSeconds = (bpm: number): number => 240 / Math.min(240, Math.max(30, bpm));
/** Where in the cycle a moment is, 0 up to 1. `start` is when a cycle began. */
export const phaseAt = (time: number, start: number, cycle: number): number => { const p = ((time - start) / cycle) % 1; return p < 0 ? p + 1 : p; };
/** The click of a layer nearest to a tap, and how far off the tap was in seconds (negative: early). */
export function judge(layer: Layer, phase: number, cycle: number): { hit: number; off: number } {
  let best = 0, off = Infinity;
  layer.hits.forEach((h, i) => { let d = phase - h; if (d > 0.5) d -= 1; if (d < -0.5) d += 1; if (Math.abs(d) < Math.abs(off)) { off = d; best = i; } });
  return { hit: best, off: off * cycle };
}
/** How close counts as on the click, in seconds. */
export const ON = 0.04;
export const verdict = (off: number): "on" | "early" | "late" => (Math.abs(off) <= ON ? "on" : off < 0 ? "early" : "late");
/** A tap in words: "on it", "25 ms early". */
export const inWords = (off: number): string => (verdict(off) === "on" ? `on it (${Math.round(Math.abs(off) * 1000)} ms)` : `${Math.round(Math.abs(off) * 1000)} ms ${off < 0 ? "early" : "late"}`);
/** What a run of taps shows: how many were on the click, and which way they lean on average (seconds; negative is early). */
export function summary(offs: number[]): { on: number; of: number; lean: number } {
  return { on: offs.filter((o) => Math.abs(o) <= ON).length, of: offs.length, lean: offs.length ? offs.reduce((a, b) => a + b, 0) / offs.length : 0 };
}
/** Enough to say the learner has it: the last sixteen taps, at least thirteen of them on the click. */
export const NEEDED = 16, NEEDED_ON = 13;
export const hasIt = (offs: number[]): boolean => offs.length >= NEEDED && offs.slice(-NEEDED).filter((o) => Math.abs(o) <= ON).length >= NEEDED_ON;
/** The clicks of every layer that fall in a stretch of time, for handing to the audio clock. */
export function clicksBetween(layers: Layer[], start: number, cycle: number, from: number, until: number): { at: number; layer: number; hit: number }[] {
  const out: { at: number; layer: number; hit: number }[] = [];
  for (let c = Math.max(0, Math.floor((from - start) / cycle)); start + c * cycle < until; c++) layers.forEach((l, li) => l.hits.forEach((h, hi) => { const at = start + (c + h) * cycle; if (at >= from && at < until) out.push({ at, layer: li, hit: hi }); }));
  return out.sort((a, b) => a.at - b.at);
}
