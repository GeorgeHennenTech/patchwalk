import type { Display } from "../display/format";
import type { DisplayStatus } from "../display/registry";
import type { ParamValue } from "../patch/model";

export type StageId = "init" | "core" | "thickness" | "character" | "filter" | "contour" | "motion" | "space" | "performance" | "interplay" | "other";

export const STAGES: { id: StageId; title: string; blurb: string }[] = [
  { id: "init", title: "Start", blurb: "Begin from a clean slate." },
  { id: "core", title: "Core tone", blurb: "Oscillators, wavetables and pitch." },
  { id: "thickness", title: "Thickness", blurb: "Unison and detune." },
  { id: "character", title: "Character", blurb: "Warp modes that reshape the wave." },
  { id: "filter", title: "Tone shaping", blurb: "Filters and routing." },
  { id: "contour", title: "Contour", blurb: "The amp envelope." },
  { id: "motion", title: "Motion", blurb: "Envelopes, LFOs and the mod matrix." },
  { id: "space", title: "Space", blurb: "The FX rack, in order." },
  { id: "performance", title: "Performance", blurb: "Macros, voicing and global settings." },
  { id: "interplay", title: "How it works together", blurb: "Settings that only make sense as a combination." },
  { id: "other", title: "Not interpreted", blurb: "Changes the app can see but cannot explain yet." },
];

/**
 * One thing that is true about the patch. Lessons are built only from facts, and the validator
 * only accepts text whose numbers and settings appear in them.
 */
export interface Fact {
  id: string;
  moduleId: string;
  moduleType: string;
  moduleLabel: string;
  /** Stored key: a kParam name, or the name of a field beside plainParams. */
  key: string;
  label: string;
  concept: string;
  raw: ParamValue | null;
  display: Display;
  /** Init's value as text, or "default" when Init does not store it. Absent for structural facts. */
  init?: string;
  /** "structural" = copied straight from the file (paths, names, routes); nothing to convert. */
  status: DisplayStatus | "structural";
  basis?: string;
  /** False when the app has no interpretation for this key and shows it exactly as stored. */
  known: boolean;
  note?: string;
  /** Vocabulary tags used by the lesson validator. */
  tags: string[];
}

export interface Step {
  id: string;
  stage: StageId;
  title: string;
  /** Goal-only phrasing, used by the advanced rendering. Contains no values. */
  goal: string;
  moduleIds: string[];
  facts: Fact[];
  notes: string[];
}

export interface FlowGraph {
  sources: { id: string; label: string }[];
  filters: { id: string; label: string; type?: string }[];
  fx: { id: string; label: string }[];
  mods: { from: string; to: string; amount?: string }[];
  caveats: string[];
}
