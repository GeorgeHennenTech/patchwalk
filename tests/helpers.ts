// Builds synthetic presets for tests. Uses hand-made zstd frames (raw / RLE blocks)
// so no compressor dependency is needed.
const enc = new TextEncoder();

function u32(n: number): number[] {
  return [n & 0xff, (n >>> 8) & 0xff, (n >>> 16) & 0xff, (n >>> 24) & 0xff];
}

function blockHeader(last: boolean, type: 0 | 1, size: number): number[] {
  const v = (size << 3) | (type << 1) | (last ? 1 : 0);
  return [v & 0xff, (v >>> 8) & 0xff, (v >>> 16) & 0xff];
}

const ZSTD_MAGIC = [0x28, 0xb5, 0x2f, 0xfd];

/** A zstd frame holding `data` uncompressed in one raw block (data must be < 128 KB). */
export function zstdRaw(data: Uint8Array): Uint8Array {
  // 0xA0: single segment, 4-byte frame content size
  return Uint8Array.from([...ZSTD_MAGIC, 0xa0, ...u32(data.length), ...blockHeader(true, 0, data.length), ...data]);
}

/** A tiny zstd frame that expands to `blocks * 100_000` zero bytes via RLE blocks. */
export function zstdBomb(blocks: number): Uint8Array {
  const out = [...ZSTD_MAGIC, 0xa0, ...u32(blocks * 100_000)];
  for (let i = 0; i < blocks; i++) out.push(...blockHeader(i === blocks - 1, 1, 100_000), 0);
  return Uint8Array.from(out);
}

export function makePreset(opts: {
  header?: unknown;
  headerText?: string;
  frame: Uint8Array;
  declaredSize: number;
  flag?: number;
  magic?: string;
}): Uint8Array {
  const header = enc.encode(
    opts.headerText ?? JSON.stringify(opts.header ?? { fileType: "SerumPreset", product: "Serum2", version: 9.0 }),
  );
  const magic = enc.encode(opts.magic ?? "XferJson\0");
  return Uint8Array.from([
    ...magic,
    ...u32(header.length),
    ...u32(0),
    ...header,
    ...u32(opts.declaredSize),
    ...u32(opts.flag ?? 2),
    ...opts.frame,
  ]);
}
