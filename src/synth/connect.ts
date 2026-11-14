// Connecting a source to a knob by dropping it there. Pure: given the settings, which source was dragged and
// which knob it was dropped on, it says whether that is possible and what settings change. The rules follow
// what the panels and the matrix already allow, so a dropped connection is an ordinary one afterwards.
import { MACRO_COLORS } from "./macros";
import { SOURCES } from "./mod";
import { MACRO_DESTS, MACRO_SLOTS, MACROS, MATRIX_MAX, MOD_DESTS, type MatrixRow, type SynthState } from "./params";

/** What can be dragged: an envelope, LFO, velocity or key position ("lfo1"), or a macro ("macro2"). */
export type Draggable = string;
export const DRAGGABLE: Draggable[] = [...SOURCES.map((x) => x.id as string), ...MACROS.map((n) => `macro${n}`)];
export const dragName = (id: Draggable) => SOURCES.find((x) => x.id === id)?.name ?? `Macro ${id.slice(5)}`;
export const dragColor = (id: Draggable) => SOURCES.find((x) => x.id === id)?.color ?? MACRO_COLORS[Number(id.slice(5)) - 1] ?? "#fff";

export type Connection = { ok: true; change: Partial<SynthState>; said: string } | { ok: false; why: string };

/** The amount a freshly dropped connection starts with: enough to hear at once. */
export const DROP_AMOUNT = 30;

export function connect(s: SynthState, source: Draggable, knob: string): Connection {
  const read = s as unknown as Record<string, string | number>;
  if (source.startsWith("macro")) {
    const n = Number(source.slice(5));
    if (!MACRO_DESTS.includes(knob) || knob === "none") return { ok: false, why: "A macro cannot move this control." };
    if (MACRO_SLOTS.some((k) => read[`macro${n}Dest${k}`] === knob)) return { ok: false, why: `Macro ${n} already moves this.` };
    const free = MACRO_SLOTS.find((k) => read[`macro${n}Dest${k}`] === "none");
    if (!free) return { ok: false, why: `Macro ${n}’s three slots are all in use.` };
    const amount = (read[`macro${n}Amt${free}`] as number) || 50;
    return { ok: true, change: { [`macro${n}Dest${free}`]: knob, [`macro${n}Amt${free}`]: amount } as Partial<SynthState>, said: `Macro ${n}, slot ${free}` };
  }
  const info = SOURCES.find((x) => x.id === source);
  if (!info) return { ok: false, why: "That cannot be dropped on a knob." };
  if (!MOD_DESTS.includes(knob) || knob === "none") return { ok: false, why: `${info.name} cannot move this control.` };
  const own = read[`${source}Dest`] as string;
  if (own === knob || s.matrix.some((r) => r.source === source && r.dest === knob)) return { ok: false, why: `${info.name} already moves this.` };
  // the source's own connection is used first; after that, each drop adds a row to the matrix
  if (own === "none") return { ok: true, change: { [`${source}Dest`]: knob, [`${source}Amount`]: (read[`${source}Amount`] as number) || DROP_AMOUNT } as Partial<SynthState>, said: info.name };
  if (s.matrix.length >= MATRIX_MAX) return { ok: false, why: "The matrix is full. Remove a row first." };
  const row: MatrixRow = { source: source as MatrixRow["source"], dest: knob, amount: DROP_AMOUNT, way: info.kind === "lfo" ? (read[`${source}Way`] as MatrixRow["way"]) : "both" };
  return { ok: true, change: { matrix: [...s.matrix, row] }, said: `${info.name} (matrix row ${s.matrix.length + 1})` };
}

// What is being dragged right now. Browsers hide the dragged data until the drop, so it is kept here.
let dragging: Draggable | null = null;
export const startDrag = (id: Draggable) => { dragging = id; if (typeof document !== "undefined") document.body.classList.add("dragging-source"); };
export const endDrag = () => { dragging = null; if (typeof document !== "undefined") document.body.classList.remove("dragging-source"); };
export const currentDrag = () => dragging;
