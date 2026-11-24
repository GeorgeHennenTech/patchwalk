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

import { psydub, PSYDUB_SHAPE } from "../scripts/demo/psydub";
describe("the psydub demo: a song at the Studio's limits", () => {
  const song = psydub(), FILE2 = "src/daw/demos/psydub.json";
  it("keeps all eight tracks, every clip, effect and automation lane it was given", () => {
    expect(song.tracks).toHaveLength(PSYDUB_SHAPE.tracks);
    expect(song.tracks.map((t) => t.clips.length)).toEqual(PSYDUB_SHAPE.clips);
    expect(song.tracks.map((t) => t.devices.length)).toEqual(PSYDUB_SHAPE.devices);
    expect(song.tracks.map((t) => t.auto.length)).toEqual(PSYDUB_SHAPE.lanes);
    expect(song.returns.map((r) => [r.devices.length, r.auto?.length])).toEqual([[2, 1], [4, 1]]);
    expect(song.masterFx).toHaveLength(PSYDUB_SHAPE.masterFx);
    expect(song.masterAuto).toHaveLength(1);
    expect(song.bars).toBe(32);
    const pad = song.tracks[4]!; expect(pad.clips.map((c) => c.bars)).toEqual([16, 16]);
    expect((song.tracks[3] as { patch: { matrix: unknown[] } }).patch.matrix).toHaveLength(3);
  });
  it("has something playing in every one of its 32 bars", () => {
    const events = songEvents(song, 0, 32 * 16, undefined, () => 0);
    for (let bar = 0; bar < 32; bar++) expect(events.some((e) => Math.floor(e.step / 16) === bar), `bar ${bar + 1}`).toBe(true);
    expect(events.length).toBeGreaterThan(1500);
  });
  it("is the file the Studio offers (rewritten when UPDATE_DEMO is set)", () => {
    const text = JSON.stringify(song);
    if (process.env.UPDATE_DEMO || !existsSync(FILE2)) writeFileSync(FILE2, text);
    expect(JSON.parse(readFileSync(FILE2, "utf8"))).toEqual(JSON.parse(text));
  });
});
