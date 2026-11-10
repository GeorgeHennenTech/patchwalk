import { decode } from "cborg";
import { PresetError } from "./errors";

/** Anything CBOR can hold once decoded to plain JS. Negative zero is preserved as -0. */
export type Cbor =
  | null
  | undefined
  | boolean
  | number
  | bigint
  | string
  | Uint8Array
  | Cbor[]
  | { [key: string]: Cbor };

export function decodeCbor(bytes: Uint8Array): Cbor {
  try {
    return decode(bytes, { useMaps: false, allowBigInt: true, rejectDuplicateMapKeys: true }) as Cbor;
  } catch (e) {
    throw new PresetError("bad-cbor", `Preset data could not be decoded (${e instanceof Error ? e.message : String(e)}).`);
  }
}
