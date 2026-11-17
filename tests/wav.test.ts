import { describe, expect, it } from "vitest";
import { encodeWav, peakDb } from "../src/daw/wav";
import { MASTER_START, masterGain, newSong, setTrack, tidySong } from "../src/daw/song";

describe("a sound file", () => {
  it("is a 16-bit stereo WAV with the right header, sizes and samples, clipped at full level", () => {
    const wav = encodeWav(Float32Array.from([0, 0.5, 2]), Float32Array.from([-0.5, -1, -2]), 44100), v = new DataView(wav.buffer), tag = (at: number) => String.fromCharCode(...wav.slice(at, at + 4));
    expect([tag(0), tag(8), tag(12), tag(36)]).toEqual(["RIFF", "WAVE", "fmt ", "data"]);
    expect(wav.length).toBe(44 + 12); expect(v.getUint32(4, true)).toBe(36 + 12); expect(v.getUint32(40, true)).toBe(12);
    expect([v.getUint16(20, true), v.getUint16(22, true), v.getUint32(24, true), v.getUint32(28, true), v.getUint16(32, true), v.getUint16(34, true)]).toEqual([1, 2, 44100, 176400, 4, 16]);
    expect([0, 1, 2].map((i) => [v.getInt16(44 + i * 4, true), v.getInt16(46 + i * 4, true)])).toEqual([[0, -16383], [16384, -32767], [32767, -32767]]);
    expect(peakDb(Float32Array.from([0.1, -0.5]), Float32Array.from([0.25]))).toBeCloseTo(-6.02, 1);
  });
});
describe("the mixer's settings", () => {
  it("a track has a pan, the song a master volume, and both are kept and made safe", () => {
    const s = setTrack(newSong(), "t1", { pan: -40 });
    expect(s.tracks[0]!.pan).toBe(-40); expect(s.volume).toBe(MASTER_START);
    expect(tidySong(JSON.parse(JSON.stringify({ ...s, volume: 50 })))).toEqual({ ...s, volume: 50 });
    const old = JSON.parse(JSON.stringify(s)); delete old.volume; delete old.tracks[0].pan; old.tracks[1].pan = 999;
    const back = tidySong(old)!; expect(back.volume).toBe(MASTER_START); expect(back.tracks[0]!.pan).toBe(0); expect(back.tracks[1]!.pan).toBe(100);
    expect(masterGain(MASTER_START)).toBeCloseTo(0.9, 10); expect(masterGain(0)).toBe(0);
  });
});
