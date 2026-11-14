// The parts of a cone loudspeaker driver, for the interactive cutaway. The picture is rendered by
// scripts/blender/driver.py at several cone positions, each with a "map": the same view with every part
// painted one flat colour, so the page can tell which part is under the pointer.
// DRAFT: the wording is general knowledge and the proportions are illustrative; neither has been checked
// against a loudspeaker text in the library yet.

export interface DriverPart { name: string; job: string; moves: "with the cone" | "flexes" | "stays still" }

export const DRIVER_PARTS: DriverPart[] = [
  { name: "Back plate", job: "Steel. Carries the magnet's field across to the pole piece.", moves: "stays still" },
  { name: "Pole piece", job: "Steel post up the middle. Guides the field to the inside of the gap.", moves: "stays still" },
  { name: "Magnet", job: "A permanent magnet. It supplies the magnetic field the coil sits in.", moves: "stays still" },
  { name: "Top plate", job: "Steel. Guides the field to the outside of the gap.", moves: "stays still" },
  { name: "Former", job: "A thin tube. The coil is wound on it, and it joins the coil to the cone.", moves: "with the cone" },
  { name: "Voice coil", job: "A winding of wire in the gap. The signal's current flows through it, and the field pushes it in and out.", moves: "with the cone" },
  { name: "Cone", job: "The part that pushes the air. It moves in and out with the coil.", moves: "with the cone" },
  { name: "Dust cap", job: "Covers the centre and keeps dust out of the gap.", moves: "with the cone" },
  { name: "Surround", job: "The flexible outer edge. It lets the cone move and keeps it centred.", moves: "flexes" },
  { name: "Spider", job: "A springy ridged disc. It keeps the coil centred in the gap.", moves: "flexes" },
  { name: "Basket", job: "The rigid frame. It holds every other part in line.", moves: "stays still" },
];

export type Rgb = readonly [number, number, number];

/** Which part a map pixel belongs to: the part whose colour it matches closely, or -1 for background and blurred edges. */
export function partAt(maps: readonly Rgb[], r: number, g: number, b: number, tolerance = 48): number {
  let best = -1, bestD = tolerance + 1;
  maps.forEach(([mr, mg, mb], i) => { const d = Math.max(Math.abs(mr - r), Math.abs(mg - g), Math.abs(mb - b)); if (d < bestD) { best = i; bestD = d; } });
  return best;
}

/** The names offered for one "name this part" question: the right one and `count - 1` others, in an order fixed by `seed`. */
export function nameChoices(names: readonly string[], answer: number, seed: number, count = 4): string[] {
  let s = (seed * 2654435761 + answer * 40503) >>> 0;
  const rnd = () => { s = (s * 1664525 + 1013904223) >>> 0; return s / 4294967296; };
  const others = names.filter((_, i) => i !== answer).map((n) => [rnd(), n] as const).sort((a, b) => a[0] - b[0]).slice(0, count - 1).map((x) => x[1]);
  return [...others, names[answer]!].map((n) => [rnd(), n] as const).sort((a, b) => a[0] - b[0]).map((x) => x[1]);
}

/** The order parts are asked in: every part once, shuffled by `seed`. */
export function quizOrder(count: number, seed: number): number[] {
  let s = (seed * 2246822519 + 7) >>> 0;
  const rnd = () => { s = (s * 1664525 + 1013904223) >>> 0; return s / 4294967296; };
  return Array.from({ length: count }, (_, i) => [rnd(), i] as const).sort((a, b) => a[0] - b[0]).map((x) => x[1]);
}
