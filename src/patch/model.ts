// Turns the decoded CBOR root into a flat list of modules, wherever they are nested.
import type { Cbor } from "../format";

export type ParamValue = number | string | boolean;

export interface ModuleNode {
  /** Path-like id: "Oscillator0", "Oscillator0.WTOsc0", "FXRack0.FX[2].FXEQ". */
  id: string;
  /** Module type without its index: "Oscillator", "WTOsc", "FXEQ". */
  type: string;
  /** Trailing index of the key, or position in the FX array. */
  index: number;
  parentId?: string;
  /** Explicitly stored (non-default) params. Empty when plainParams is "default". */
  params: Record<string, ParamValue>;
  /** Other fields stored beside plainParams (wavetable path, mod source, names, curves...). */
  extras: Record<string, Cbor>;
}

function isMap(v: unknown): v is Record<string, Cbor> {
  return typeof v === "object" && v !== null && !Array.isArray(v) && !(v instanceof Uint8Array);
}

export function isModule(v: unknown): v is Record<string, Cbor> {
  return isMap(v) && "plainParams" in v;
}

export function splitKey(key: string): { type: string; index: number } {
  const m = /^(.*?)(\d+)$/.exec(key);
  return m ? { type: m[1]!, index: Number(m[2]) } : { type: key, index: 0 };
}

function visit(key: string, id: string, mod: Record<string, Cbor>, parentId: string | undefined, out: ModuleNode[], fxIndex?: number) {
  const { type, index } = splitKey(key);
  const pp = mod.plainParams;
  const node: ModuleNode = {
    id,
    type,
    index: fxIndex ?? index,
    parentId,
    params: isMap(pp) ? (pp as Record<string, ParamValue>) : {},
    extras: {},
  };
  out.push(node);
  for (const [k, v] of Object.entries(mod)) {
    if (k === "plainParams") continue;
    if (isModule(v)) {
      visit(k, `${id}.${k}`, v, id, out);
    } else if (k === "FX" && Array.isArray(v)) {
      v.forEach((entry, i) => {
        if (!isMap(entry)) return;
        for (const [fk, fv] of Object.entries(entry)) {
          if (!isModule(fv)) continue;
          const before = out.length;
          visit(fk, `${id}.FX[${i}].${fk}`, fv, id, out, i);
          // keep the entry's sibling fields (type code etc.) on the FX node
          const fx = out[before]!;
          for (const [sk, sv] of Object.entries(entry)) if (sk !== fk) fx.extras[sk] = sv;
        }
      });
    } else {
      node.extras[k] = v;
    }
  }
}

/** Every module in the preset, in file order. Root keys without plainParams (UI state, metadata) are skipped. */
export function collectModules(root: Record<string, Cbor>): ModuleNode[] {
  const out: ModuleNode[] = [];
  for (const [key, value] of Object.entries(root)) {
    if (isModule(value)) visit(key, key, value, undefined, out);
  }
  return out;
}

/** Natural sort so that ModSlot2 comes before ModSlot10. */
export function byNaturalId(a: { id: string }, b: { id: string }): number {
  return a.id.localeCompare(b.id, undefined, { numeric: true });
}
