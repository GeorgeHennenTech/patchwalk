// Mod-matrix source ids. Inferred from the pack fixtures by matching sources to macro names,
// LFO shapes and preset descriptions (see CLAUDE.md). Not confirmed with probe presets yet.
export type SourceKind = "none" | "modwheel" | "env" | "lfo" | "macro" | "unknown";

export interface ModSource {
  id: number;
  kind: SourceKind;
  /** Root module id this source refers to, when there is one. */
  moduleId?: string;
  label: string;
}

export const SOURCE_TABLE_VERIFIED = false;

export function resolveSource(id: number): ModSource {
  if (id === 0) return { id, kind: "none", label: "None" };
  if (id === 1) return { id, kind: "modwheel", label: "Mod Wheel" };
  if (id >= 2 && id <= 5) return { id, kind: "env", moduleId: `Env${id - 2}`, label: `Env ${id - 1}` };
  if (id >= 6 && id <= 15) return { id, kind: "lfo", moduleId: `LFO${id - 6}`, label: `LFO ${id - 5}` };
  if (id >= 25 && id <= 32) return { id, kind: "macro", moduleId: `Macro${id - 25}`, label: `Macro ${id - 24}` };
  return { id, kind: "unknown", label: `Unrecognised source #${id}` };
}
