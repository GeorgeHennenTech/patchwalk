// Macros: one knob that moves several others. A macro is a hand-turned control, not a moving signal, so it
// is applied to the settings themselves: the engine plays "the settings after the macros", and the knobs on
// screen keep showing where the learner left them, with a ring for each macro that reaches them.
import { fromTravel, MACRO_SLOTS, MACROS, PARAMS, toTravel, type SynthState } from "./params";

/** Each macro has its own colour, distinct from the envelopes' and LFOs'. */
export const MACRO_COLORS = ["#c79bff", "#5cffc8", "#8fd0ff", "#ff9ecb"] as const;

export interface MacroSlot { macro: number; slot: number; dest: keyof SynthState; amount: number; value: number; color: string; name: string }

/** The slots that are in use: a destination chosen that is a real knob. */
export function macroSlots(s: SynthState): MacroSlot[] {
  const read = s as unknown as Record<string, string | number>;
  return MACROS.flatMap((n) => MACRO_SLOTS.flatMap((k) => {
    const dest = read[`macro${n}Dest${k}`] as string;
    const spec = PARAMS[dest];
    if (!spec || spec.kind !== "range") return [];
    return [{ macro: n, slot: k, dest: dest as keyof SynthState, amount: read[`macro${n}Amt${k}`] as number, value: read[`macro${n}`] as number, color: MACRO_COLORS[n - 1]!, name: read[`macro${n}Name`] as string }];
  }));
}
export const slotsTo = (s: SynthState, id: keyof SynthState) => macroSlots(s).filter((m) => m.dest === id && m.amount !== 0);

/**
 * How far along its travel a slot pushes its destination right now: the macro's position times the slot's
 * amount. An amount of 100 with the macro right up moves the knob across its whole travel.
 */
export const slotPush = (m: MacroSlot) => (m.value / 100) * (m.amount / 100);

/** The settings the synth actually plays: every macro's push added to the knobs it reaches. */
export function applyMacros(s: SynthState): SynthState {
  const pushes = new Map<keyof SynthState, number>();
  for (const m of macroSlots(s)) if (m.value !== 0 && m.amount !== 0) pushes.set(m.dest, (pushes.get(m.dest) ?? 0) + slotPush(m));
  if (pushes.size === 0) return s;
  const out = { ...s } as unknown as Record<string, unknown>;
  for (const [dest, push] of pushes) {
    const spec = PARAMS[dest]!, base = s[dest] as number;
    out[dest] = fromTravel(spec, toTravel(spec, base) + push);
  }
  return out as unknown as SynthState;
}
