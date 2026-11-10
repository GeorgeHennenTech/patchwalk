import { readdirSync, readFileSync, statSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";
import { decodePreset, PresetError, LIMITS } from "../src/format";
import { VersionSchema } from "../src/format/schema";
import { makePreset, zstdBomb, zstdRaw } from "./helpers";

const FIXTURES = join(__dirname, "..", "fixtures");

function walk(dir: string): string[] {
  return readdirSync(dir).flatMap((name) => {
    const p = join(dir, name);
    return statSync(p).isDirectory() ? walk(p) : [p];
  });
}
const all = walk(FIXTURES);
const presets = all.filter((p) => p.endsWith(".SerumPreset"));
const fxps = all.filter((p) => p.endsWith(".fxp"));
const load = (p: string) => new Uint8Array(readFileSync(p));
const rel = (p: string) => p.slice(FIXTURES.length + 1);

function codeOf(fn: () => unknown): string {
  try {
    fn();
  } catch (e) {
    if (e instanceof PresetError) return e.code;
    throw e;
  }
  return "no-error";
}

describe("every fixture", () => {
  it("has at least the Init fixture", () => {
    expect(presets.some((p) => p.endsWith("Initial_Preset.SerumPreset"))).toBe(true);
  });

  it.each(presets.map((p) => [rel(p), p]))("decodes %s", (_name, path) => {
    const bytes = load(path);
    const preset = decodePreset(bytes);
    expect(preset.header.fileType).toBe("SerumPreset");
    expect(preset.header.product).toBe("Serum2");
    expect(typeof preset.header.version).toBe("number");
    expect(preset.stats.flag).toBe(2);
    expect(preset.stats.fileBytes).toBe(bytes.length);
    expect(preset.stats.decompressedBytes).toBeGreaterThan(preset.stats.compressedBytes);
    // Every fixture so far has the same 175 root keys as Init.
    expect(preset.stats.rootKeys).toBe(175);
    expect(preset.root.Oscillator0).toBeTypeOf("object");
    expect(preset.root.product).toBe("Serum2");
    // CBOR root repeats the header's version.
    expect(preset.root.version).toBe(preset.header.version);
  });

  it.each(fxps.map((p) => [rel(p), p]))("rejects Serum 1 file %s with a specific message", (_name, path) => {
    expect(codeOf(() => decodePreset(load(path)))).toBe("serum1-fxp");
  });
});

describe("Init fixture facts", () => {
  const init = decodePreset(load(join(FIXTURES, "init", "Initial_Preset.SerumPreset")));

  it("matches the recorded sizes", () => {
    expect(init.stats.decompressedBytes).toBe(7834);
    expect(init.header.presetName).toBe("Initial Preset");
    expect(init.header.version).toBe(9);
  });

  it("is not all-default: envelopes carry curve params", () => {
    const env0 = init.root.Env0 as { plainParams: Record<string, number> };
    expect(env0.plainParams).toEqual({ kParamCurve1: 50, kParamCurve2: 66.60000000000001, kParamCurve3: 66.60000000000001 });
    expect(init.stats.nonDefaultParamBlocks).toBe(4);
  });

  it("stores the factory wavetable by path inside a nested oscillator", () => {
    const osc = init.root.Oscillator0 as { WTOsc0: { relativePathToWT: string; plainParams: unknown } };
    expect(osc.WTOsc0.relativePathToWT).toBe("S2 Tables/Default Shapes.wav");
    expect(osc.WTOsc0.plainParams).toBe("default");
  });
});

describe("generic decoding", () => {
  it("accepts version as a number or as { value }", () => {
    expect(VersionSchema.parse(9.0)).toBe(9);
    expect(VersionSchema.parse({ value: 4 })).toBe(4);
    const cbor = Uint8Array.from([0xa0]); // {}
    const p = decodePreset(
      makePreset({ header: { fileType: "SerumPreset", product: "Serum2", version: { value: 4 } }, frame: zstdRaw(cbor), declaredSize: 1 }),
    );
    expect(p.header.version).toBe(4);
  });

  it("preserves negative zero", () => {
    // { "M0": { "plainParams": { "kParamPan": -0.0 } } }, -0.0 as a half float (f9 80 00)
    const cbor = Uint8Array.from([
      0xa1, 0x62, 0x4d, 0x30, 0xa1, 0x6b, ...new TextEncoder().encode("plainParams"),
      0xa1, 0x69, ...new TextEncoder().encode("kParamPan"), 0xf9, 0x80, 0x00,
    ]);
    const p = decodePreset(makePreset({ frame: zstdRaw(cbor), declaredSize: cbor.length }));
    const value = (p.root.M0 as { plainParams: { kParamPan: number } }).plainParams.kParamPan;
    expect(Object.is(value, -0)).toBe(true);
  });

  it("rejects a plainParams that is neither 'default' nor a map", () => {
    // { "M0": { "plainParams": [1] } }
    const cbor = Uint8Array.from([0xa1, 0x62, 0x4d, 0x30, 0xa1, 0x6b, ...new TextEncoder().encode("plainParams"), 0x81, 0x01]);
    expect(codeOf(() => decodePreset(makePreset({ frame: zstdRaw(cbor), declaredSize: cbor.length })))).toBe("schema");
  });
});

describe("bad input gets a specific error", () => {
  const cbor = Uint8Array.from([0xa0]);
  const good = makePreset({ frame: zstdRaw(cbor), declaredSize: 1 });

  it("decodes the synthetic baseline", () => {
    expect(decodePreset(good).stats.rootKeys).toBe(0);
  });
  it("bad magic", () => {
    expect(codeOf(() => decodePreset(new TextEncoder().encode("hello world, not a preset")))).toBe("bad-magic");
    expect(codeOf(() => decodePreset(new Uint8Array(0)))).toBe("bad-magic");
  });
  it("truncated at every early cut point", () => {
    for (const n of [9, 12, 17, 40, good.length - 14]) {
      expect(codeOf(() => decodePreset(good.subarray(0, n)))).toBe("truncated");
    }
  });
  it("truncated inside the compressed data", () => {
    expect(["bad-zstd", "size-mismatch"]).toContain(codeOf(() => decodePreset(good.subarray(0, good.length - 1))));
  });
  it("header that is not JSON", () => {
    expect(codeOf(() => decodePreset(makePreset({ headerText: "{nope", frame: zstdRaw(cbor), declaredSize: 1 })))).toBe("bad-header");
  });
  it("header for a different file type", () => {
    const header = { fileType: "SerumWavetable", product: "Serum2", version: 9 };
    expect(codeOf(() => decodePreset(makePreset({ header, frame: zstdRaw(cbor), declaredSize: 1 })))).toBe("schema");
  });
  it("unknown flag", () => {
    expect(codeOf(() => decodePreset(makePreset({ frame: zstdRaw(cbor), declaredSize: 1, flag: 3 })))).toBe("unsupported-flag");
  });
  it("declared size over the cap", () => {
    const limits = { ...LIMITS, decompressedBytes: 1000 };
    expect(codeOf(() => decodePreset(makePreset({ frame: zstdRaw(cbor), declaredSize: 1001 }), limits))).toBe("too-large");
  });
  it("stops a decompression bomb at the declared size", () => {
    const bomb = makePreset({ frame: zstdBomb(50), declaredSize: 10 }); // 5 MB from ~250 bytes
    expect(bomb.length).toBeLessThan(400);
    expect(codeOf(() => decodePreset(bomb))).toBe("size-mismatch");
  });
  it("declared size larger than the data", () => {
    expect(codeOf(() => decodePreset(makePreset({ frame: zstdRaw(cbor), declaredSize: 5 })))).toBe("size-mismatch");
  });
  it("garbage where CBOR should be", () => {
    const junk = Uint8Array.from([0xff, 0xff, 0xff]);
    expect(codeOf(() => decodePreset(makePreset({ frame: zstdRaw(junk), declaredSize: 3 })))).toBe("bad-cbor");
  });
});
