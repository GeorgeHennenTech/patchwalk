import { describe, expect, it } from "vitest";
import { newSampler, samplerRate, samplerSounds, samplerWindow, tidySampler } from "../src/daw/sampler";
import { newSong, renameSamples, samplesUsed, setSampler, tidySong, type SynthTrack } from "../src/daw/song";

describe("the sampler", () => {
  const set = newSampler("habc");
  it("plays the file at its own speed on the root key, double an octave up, half an octave down", () => {
    expect(samplerRate(60, set)).toBe(1); expect(samplerRate(72, set)).toBe(2); expect(samplerRate(48, set)).toBe(0.5);
    expect(samplerRate(60, { root: 60, tune: 12 })).toBe(2); expect(samplerRate(67, set)).toBeCloseTo(1.4983, 3);
  });
  it("uses only the chosen stretch of the file", () => {
    expect(samplerWindow({ start: 25, length: 50 }, 2)).toEqual({ offset: 0.5, span: 1 });
    expect(samplerWindow({ start: 80, length: 100 }, 2).span).toBeCloseTo(0.4);       // never past the end
  });
  it("a held note stops when the file runs out, unless it loops; a one-shot plays the whole stretch", () => {
    expect(samplerSounds(set, 60, 5, 2)).toBe(2); expect(samplerSounds(set, 72, 5, 2)).toBe(1); expect(samplerSounds(set, 60, 0.5, 2)).toBe(0.5);
    expect(samplerSounds({ ...set, loop: true }, 60, 5, 2)).toBe(5);
    expect(samplerSounds({ ...set, mode: "oneshot" }, 60, 0.1, 2)).toBe(2);
  });
  it("is kept with the track, made safe, and counted among the sounds a song needs", () => {
    const s = setSampler(newSong(), "t2", { ...set, root: 48, start: 150, mode: "oneshot" });
    expect(samplesUsed(s)).toEqual(["habc"]);
    const back = (tidySong(JSON.parse(JSON.stringify(s)))!.tracks[1] as SynthTrack).sampler!;
    expect(back).toMatchObject({ sample: "habc", root: 48, start: 99, mode: "oneshot" });
    expect((renameSamples(s, { habc: "hxyz" }).tracks[1] as SynthTrack).sampler!.sample).toBe("hxyz");
    expect((setSampler(s, "t2", undefined).tracks[1] as SynthTrack).sampler).toBeUndefined();
    expect(setSampler(newSong(), "t1", set).tracks[0]).not.toHaveProperty("sampler");   // not on a drum track
    expect(tidySampler({ sample: "../bad" })).toBeUndefined(); expect(tidySampler(null)).toBeUndefined();
  });
});
