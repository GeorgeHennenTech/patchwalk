import { decodeCbor, type Cbor } from "./cbor";
import { LIMITS, readContainer } from "./container";
import { PresetError } from "./errors";
import { HeaderSchema, PlainParamsSchema, RootSchema, type Header } from "./schema";

export { PresetError } from "./errors";
export { LIMITS } from "./container";
export type { Cbor } from "./cbor";
export type { Header } from "./schema";

export interface DecodedPreset {
  header: Header;
  /** The CBOR root map: module name -> module. */
  root: Record<string, Cbor>;
  stats: {
    fileBytes: number;
    compressedBytes: number;
    decompressedBytes: number;
    flag: number;
    rootKeys: number;
    /** Number of `plainParams` entries found at any depth, and how many are non-default. */
    paramBlocks: number;
    nonDefaultParamBlocks: number;
  };
}

function isObject(v: unknown): v is Record<string, Cbor> {
  return typeof v === "object" && v !== null && !Array.isArray(v) && !(v instanceof Uint8Array);
}

/** Validate every `plainParams` in the tree, wherever it is nested. */
function checkParams(node: Cbor, path: string, tally: { all: number; nonDefault: number }): void {
  if (Array.isArray(node)) {
    node.forEach((child, i) => checkParams(child, `${path}[${i}]`, tally));
  } else if (isObject(node)) {
    for (const [key, child] of Object.entries(node)) {
      const here = path ? `${path}.${key}` : key;
      if (key === "plainParams") {
        const parsed = PlainParamsSchema.safeParse(child);
        if (!parsed.success) {
          throw new PresetError("schema", `Unexpected shape at ${here}: expected "default" or a map of values.`);
        }
        tally.all++;
        if (parsed.data !== "default") tally.nonDefault++;
      } else {
        checkParams(child, here, tally);
      }
    }
  }
}

/** Decode a .SerumPreset entirely in memory. Throws PresetError with a user-readable message. */
export function decodePreset(bytes: Uint8Array, limits: typeof LIMITS = LIMITS): DecodedPreset {
  const container = readContainer(bytes, limits);

  let headerJson: unknown;
  try {
    headerJson = JSON.parse(container.headerText);
  } catch {
    throw new PresetError("bad-header", "Header is not valid JSON.");
  }
  const header = HeaderSchema.safeParse(headerJson);
  if (!header.success) {
    const issue = header.error.issues[0];
    throw new PresetError("schema", `Unexpected header: ${issue?.path.join(".")} ${issue?.message}`);
  }

  const root = RootSchema.safeParse(decodeCbor(container.payload));
  if (!root.success) throw new PresetError("schema", "Preset data is not a map of modules.");
  const tally = { all: 0, nonDefault: 0 };
  checkParams(root.data as Record<string, Cbor>, "", tally);

  return {
    header: header.data,
    root: root.data as Record<string, Cbor>,
    stats: {
      fileBytes: bytes.length,
      compressedBytes: container.compressedSize,
      decompressedBytes: container.payload.length,
      flag: container.flag,
      rootKeys: Object.keys(root.data).length,
      paramBlocks: tally.all,
      nonDefaultParamBlocks: tally.nonDefault,
    },
  };
}
