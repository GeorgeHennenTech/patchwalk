// Container layout, confirmed on every fixture (see CLAUDE.md "Format facts"):
//   "XferJson\0" | u64 LE header length | JSON header | u32 LE decompressed size | u32 LE flag (2) | zstd frame
import { Decompress } from "fzstd";
import { PresetError } from "./errors";

const MAGIC = new TextEncoder().encode("XferJson\0");
const SUPPORTED_FLAG = 2;

/** Limits. Embedded sample audio can be large, so these are generous but finite. */
export const LIMITS = {
  fileBytes: 256 * 1024 * 1024,
  headerBytes: 1024 * 1024,
  decompressedBytes: 512 * 1024 * 1024,
} as const;

export interface Container {
  /** Raw JSON header text, exactly as stored. */
  headerText: string;
  declaredSize: number;
  flag: number;
  compressedSize: number;
  /** Decompressed CBOR bytes. */
  payload: Uint8Array;
}

function startsWith(bytes: Uint8Array, prefix: Uint8Array): boolean {
  if (bytes.length < prefix.length) return false;
  for (let i = 0; i < prefix.length; i++) if (bytes[i] !== prefix[i]) return false;
  return true;
}

function ascii(bytes: Uint8Array, start: number, end: number): string {
  return String.fromCharCode(...bytes.subarray(start, end));
}

export function readContainer(bytes: Uint8Array, limits: typeof LIMITS = LIMITS): Container {
  if (bytes.length > limits.fileBytes) {
    throw new PresetError("too-large", `File is ${bytes.length} bytes, over the ${limits.fileBytes}-byte limit.`);
  }
  if (!startsWith(bytes, MAGIC)) {
    // Serum 1 presets are VST .fxp chunks: "CcnK" .... "FPCh" .... "XfsX"
    if (bytes.length >= 20 && ascii(bytes, 0, 4) === "CcnK" && ascii(bytes, 16, 20) === "XfsX") {
      throw new PresetError(
        "serum1-fxp",
        "This is a Serum 1 preset (.fxp). Only Serum 2 .SerumPreset files are supported for now.",
      );
    }
    throw new PresetError("bad-magic", "Not a Serum 2 preset: the file does not start with the XferJson marker.");
  }

  const view = new DataView(bytes.buffer, bytes.byteOffset, bytes.byteLength);
  let offset = MAGIC.length;
  if (bytes.length < offset + 8) throw new PresetError("truncated", "File ends before the header length.");
  const headerLength = view.getBigUint64(offset, true);
  offset += 8;
  if (headerLength > BigInt(limits.headerBytes)) {
    throw new PresetError("bad-header", `Header claims ${headerLength} bytes, over the ${limits.headerBytes}-byte limit.`);
  }
  const headerEnd = offset + Number(headerLength);
  if (bytes.length < headerEnd + 8) {
    throw new PresetError("truncated", "File ends inside the header or before the payload sizes.");
  }
  let headerText: string;
  try {
    headerText = new TextDecoder("utf-8", { fatal: true }).decode(bytes.subarray(offset, headerEnd));
  } catch {
    throw new PresetError("bad-header", "Header is not valid UTF-8.");
  }

  const declaredSize = view.getUint32(headerEnd, true);
  const flag = view.getUint32(headerEnd + 4, true);
  if (flag !== SUPPORTED_FLAG) {
    throw new PresetError("unsupported-flag", `Unknown payload flag ${flag} (only ${SUPPORTED_FLAG} is understood).`);
  }
  if (declaredSize > limits.decompressedBytes) {
    throw new PresetError(
      "too-large",
      `Preset declares ${declaredSize} bytes of data, over the ${limits.decompressedBytes}-byte limit.`,
    );
  }
  const compressed = bytes.subarray(headerEnd + 8);
  if (compressed.length === 0) throw new PresetError("truncated", "File ends before the compressed data.");

  return {
    headerText,
    declaredSize,
    flag,
    compressedSize: compressed.length,
    payload: inflate(compressed, declaredSize),
  };
}

/**
 * Streaming zstd decompression that stops as soon as output exceeds the declared size,
 * so a small file cannot expand without bound.
 */
function inflate(compressed: Uint8Array, declaredSize: number): Uint8Array {
  const out = new Uint8Array(declaredSize);
  let written = 0;
  const overflow = () =>
    new PresetError("size-mismatch", `Compressed data expands past the ${declaredSize} bytes the file declares.`);

  const stream = new Decompress((chunk) => {
    if (written + chunk.length > declaredSize) throw overflow();
    out.set(chunk, written);
    written += chunk.length;
  });

  const STEP = 16 * 1024; // small input slices keep each output chunk bounded
  try {
    for (let i = 0; i < compressed.length; i += STEP) {
      const end = Math.min(i + STEP, compressed.length);
      stream.push(compressed.subarray(i, end), end === compressed.length);
    }
  } catch (e) {
    if (e instanceof PresetError) throw e;
    throw new PresetError("bad-zstd", `Compressed data is damaged (${e instanceof Error ? e.message : String(e)}).`);
  }
  if (written !== declaredSize) {
    throw new PresetError("size-mismatch", `File declares ${declaredSize} bytes of data but contains ${written}.`);
  }
  return out;
}
