import { existsSync, readFileSync, readdirSync, statSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";
import { DEFAULT_VOICES, GENRE_STARTERS } from "../src/daw/drums";

const ROOT = join(__dirname, "../src/assets/kits");
const dirs = existsSync(ROOT) ? readdirSync(ROOT).filter((d) => existsSync(join(ROOT, d, "kit.json"))) : [];

describe("built-in drum kits", () => {
  it("every kit names real pads and every file it names is a WAV that is there", () => {
    for (const d of dirs) {
      const kit = JSON.parse(readFileSync(join(ROOT, d, "kit.json"), "utf8")) as { id: string; name: string; slots: Record<string, { file: string }> };
      expect(kit.id).toBe(d); expect(kit.name.length).toBeGreaterThan(2);
      const slots = Object.entries(kit.slots);
      expect(slots.length).toBeGreaterThanOrEqual(3);
      for (const [voice, slot] of slots) {
        expect(DEFAULT_VOICES as readonly string[], `${d}: ${voice}`).toContain(voice);
        const file = join(ROOT, d, slot.file);
        expect(existsSync(file), file).toBe(true);
        expect(readFileSync(file).subarray(0, 4).toString("latin1"), file).toBe("RIFF");
        expect(statSync(file).size, file).toBeLessThan(1_600_000);
      }
    }
  });
  it("there are starting patterns for the kits' styles", () => {
    expect(GENRE_STARTERS.length).toBeGreaterThan(60);
  });
});
