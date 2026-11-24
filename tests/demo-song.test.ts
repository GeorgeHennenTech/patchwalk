import { describe, expect, it } from "vitest";
import { existsSync, mkdirSync, readFileSync, writeFileSync } from "node:fs";
import { glitchHop } from "../scripts/demo/glitchhop";
import { songEvents } from "../src/daw/song";

const FILE = "src/daw/demos/glitchhop.json";
describe("the demo song", () => {
  const song = glitchHop();
  it("is a song the Studio accepts whole: nothing it was given is dropped", () => {
    expect(song.tracks.map((t) => t.name)).toEqual(["Drums", "Vowel pad", "Wobble bass", "Glitch pluck", "Bits", "Riser"]);
    expect(song.tracks.map((t) => t.clips.length)).toEqual([16, 4, 3, 6, 2, 4]);
    expect(song.tracks.map((t) => t.devices.length)).toEqual([3, 4, 3, 6, 5, 2]);
    expect(song.tracks.map((t) => t.auto.length)).toEqual([1, 1, 2, 1, 1, 1]);
    expect(song.returns.map((r) => r.devices[0]?.kind)).toEqual(["reverb", "delay"]);
    expect(song.masterFx?.map((d) => d.kind)).toEqual(["eq8", "glue", "limiter"]);
    expect(song.bars).toBe(16); expect(song.bpm).toBe(104); expect(song.swing).toBe(22);
  });
  it("plays hits and notes in every bar, and the arpeggio makes many notes of a few", () => {
    const events = songEvents(song, 0, 16 * 16, undefined, () => 0);
    for (let bar = 0; bar < 16; bar++) expect(events.some((e) => Math.floor(e.step / 16) === bar), `bar ${bar + 1}`).toBe(true);
    const bits = events.filter((e) => e.kind === "note" && e.track === song.tracks[4]!.id);
    expect(bits.length).toBeGreaterThan(100);
  });
  it("is the file the Studio offers (rewritten when UPDATE_DEMO is set)", () => {
    const text = JSON.stringify(song);
    if (process.env.UPDATE_DEMO || !existsSync(FILE)) { mkdirSync("src/daw/demos", { recursive: true }); writeFileSync(FILE, text); }
    expect(JSON.parse(readFileSync(FILE, "utf8"))).toEqual(JSON.parse(text));
  });
});
