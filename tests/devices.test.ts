import { describe, expect, it } from "vitest";
import { DEVICES, MAX_DEVICES, addDevice, chainShape, moveDevice, newDevice, removeDevice, setDeviceParam, tidyDevices, toggleDevice, utilityMatrix } from "../src/daw/devices";
import { addTrack, newSong, setDevices, tidySong } from "../src/daw/song";

describe("a track's chain of effects", () => {
  it("every device has a name, a line about it, and settings whose starting value is in range", () => {
    expect(new Set(DEVICES.map((d) => d.kind)).size).toBe(DEVICES.length);
    for (const d of DEVICES) {
      expect(d.name.length).toBeGreaterThan(2); expect(d.like.length).toBeGreaterThan(2); expect(d.about.length).toBeGreaterThan(20);
      for (const p of d.params) { expect(p.def).toBeGreaterThanOrEqual(p.min); expect(p.def).toBeLessThanOrEqual(p.max); expect(p.max).toBeGreaterThan(p.min); if (p.choices) expect(p.choices).toHaveLength(p.max - p.min + 1); }
      expect(Object.keys(newDevice(d.kind)!.p)).toEqual(d.params.map((p) => p.id));
    }
  });
  it("adds up to eight, each with its own id; moves, switches and removes them; and knows when the wiring changed", () => {
    let chain = addDevice(addDevice([], "utility"), "utility");
    expect(chain.map((d) => d.id)).toEqual(["d1", "d2"]);
    expect(addDevice(chain, "nonsense")).toBe(chain);
    const shape = chainShape(chain);
    chain = setDeviceParam(chain, "d1", "gain", 999);
    expect(chain[0]!.p.gain).toBe(24);
    expect(chainShape(toggleDevice(chain, "d1"))).toBe(shape);            // a setting or a switch never rewires
    expect(chainShape(moveDevice(chain, "d1", 1))).not.toBe(shape);       // a move does
    expect(moveDevice(chain, "d1", -1)).toBe(chain);
    expect(removeDevice(chain, "d1").map((d) => d.id)).toEqual(["d2"]);
    for (let i = 0; i < 12; i++) chain = addDevice(chain, "utility");
    expect(chain).toHaveLength(MAX_DEVICES);
    expect(new Set(chain.map((d) => d.id)).size).toBe(MAX_DEVICES);
  });
  it("makes a stored chain safe, and a song keeps its chains", () => {
    const got = tidyDevices([{ kind: "utility", id: "x", p: { gain: "loud", pan: 500 }, on: false }, { kind: "utility", id: "x" }, { kind: "tape" }, null]);
    expect(got).toHaveLength(2);
    expect(got[0]).toMatchObject({ id: "x", on: false }); expect(got[0]!.p.gain).toBe(0); expect(got[0]!.p.pan).toBe(100);
    expect(got[1]!.id).not.toBe("x");
    const song = setDevices(newSong(), "t1", addDevice([], "utility"));
    expect(tidySong(JSON.parse(JSON.stringify(song)))).toEqual(song);
    expect(tidySong({ tracks: [{ kind: "drums" }] })!.tracks[0]!.devices).toEqual([]);   // a song from before effects
    expect(addTrack(newSong(), "synth").tracks.at(-1)!.devices).toEqual([]);
  });
});

describe("Utility", () => {
  const out = (p: Record<string, number>, l: number, r: number) => { const m = utilityMatrix({ gain: 0, pan: 0, width: 100, mono: 0, flipL: 0, flipR: 0, mute: 0, ...p }); return [(l * m.ll + r * m.rl) * m.gain, (l * m.lr + r * m.rr) * m.gain]; };
  it("at its starting settings changes nothing", () => { expect(out({}, 0.3, -0.7)).toEqual([0.3, -0.7]); });
  it("width 0 and Mono make the two sides the same; 200% doubles what differs", () => {
    expect(out({ width: 0 }, 1, 0)).toEqual([0.5, 0.5]);
    expect(out({ mono: 1, width: 180 }, 1, 0)).toEqual([0.5, 0.5]);
    const [l, r] = out({ width: 200 }, 1, 0);
    expect(l).toBeCloseTo(1.5, 10); expect(r).toBeCloseTo(-0.5, 10);           // the middle (0.5) kept, the difference (0.5) doubled
  });
  it("a flipped side turned to mono cancels a sound that was the same on both sides", () => {
    const [l, r] = out({ flipL: 1, mono: 1 }, 0.8, 0.8);
    expect(l).toBeCloseTo(0, 10); expect(r).toBeCloseTo(0, 10);
    expect(out({ flipR: 1 }, 0.4, 0.4)).toEqual([0.4, -0.4]);
  });
  it("gain is in decibels and Mute is silence", () => {
    expect(out({ gain: 6 }, 1, 1)[0]).toBeCloseTo(1.9953, 3);
    expect(out({ gain: -6 }, 1, 1)[0]).toBeCloseTo(0.5012, 3);
    expect(out({ mute: 1 }, 1, 1)).toEqual([0, 0]);
    expect(out({ pan: -100 }, 0.5, 0.5)).toEqual([0.5, 0]);                    // pan is a balance: the other side goes, this side is not turned up
    expect(out({ pan: 50 }, 0.5, 0.5)).toEqual([0.25, 0.5]);
  });
});

import { CURVES, DELAY_DIVS, autoPanGain, biquadAt, channelEqDb, chorusDelays, compOutDb, delayEchoes, delayRouting, delayTimes, eq3Db, eq8Db, lfoRateHz, mixGains, octavesToQ, overdriveGain, overdriveToneHz, panHarmonics, panShape, satTable, saturate, specOf, tidyParam } from "../src/daw/devices";
const start = (kind: string, p: Record<string, number> = {}) => ({ ...newDevice(kind)!.p, ...p });
const FREQS = [30, 100, 250, 700, 1000, 2500, 6000, 15000];

describe("the EQs", () => {
  it("every EQ changes nothing at its starting settings", () => {
    for (const kind of Object.keys(CURVES)) for (const f of FREQS) expect(Math.abs(CURVES[kind]!(start(kind), f))).toBeLessThan(0.01);
  });
  it("three bands: each gain reaches its own band, a kill silences it, and the splits are 6 dB down where two bands meet", () => {
    expect(eq3Db(start("eq3", { low: 6 }), 40)).toBeCloseTo(6, 1);
    expect(eq3Db(start("eq3", { low: 6 }), 9000)).toBeCloseTo(0, 1);
    expect(eq3Db(start("eq3", { mid: -12 }), 800)).toBeCloseTo(-12, 0);
    expect(eq3Db(start("eq3", { high: 3 }), 15000)).toBeCloseTo(3, 1);
    expect(eq3Db(start("eq3", { killLow: 1 }), 30)).toBeLessThan(-60);
    expect(eq3Db(start("eq3", { killLow: 1 }), 250)).toBeCloseTo(-6, 0);
    expect(eq3Db(start("eq3", { killMid: 1, killHigh: 1 }), 5000)).toBeLessThan(-80);
  });
  it("eight bands: a bell lifts its own frequency by its gain, a band that is off does nothing, cuts and notches remove", () => {
    expect(eq8Db(start("eq8", { b4gain: 9 }), 1000)).toBeCloseTo(9, 2);
    expect(eq8Db(start("eq8", { b4gain: 9, b4on: 0 }), 1000)).toBeCloseTo(0, 5);
    expect(eq8Db(start("eq8", { b4type: 3, b4q: 4 }), 1000)).toBeLessThan(-60);
    expect(eq8Db(start("eq8", { b1type: 0, b1freq: 200 }), 50)).toBeLessThan(-20);
    expect(eq8Db(start("eq8", { b8type: 5, b8freq: 2000 }), 16000)).toBeLessThan(-30);
    expect(eq8Db(start("eq8", { b1gain: 6 }), 20)).toBeCloseTo(6, 0);                 // band 1 starts as a low shelf
    expect(eq8Db(start("eq8", { b8gain: -6 }), 20000)).toBeCloseTo(-6, 0);            // band 8 as a high shelf
    expect(eq8Db(start("eq8", { b3gain: 6, b4gain: 6, b3freq: 1000 }), 1000)).toBeCloseTo(12, 2);   // bands add up
  });
  it("channel EQ: shelves, a middle band that moves, a rumble cut and an output level", () => {
    expect(channelEqDb(start("channeleq", { low: 9 }), 20)).toBeCloseTo(9, 0);
    expect(channelEqDb(start("channeleq", { mid: -8, midFreq: 2500 }), 2500)).toBeCloseTo(-8, 2);
    expect(channelEqDb(start("channeleq", { lowcut: 1 }), 80)).toBeCloseTo(-3, 0);
    expect(channelEqDb(start("channeleq", { out: -5 }), 1000)).toBeCloseTo(-5, 5);
  });
  it("a filter's size at its own frequency is what its kind promises", () => {
    const size = (c: [number, number]) => Math.hypot(c[0], c[1]);
    expect(size(biquadAt("lowpass", 1000, Math.SQRT1_2, 0, 1000))).toBeCloseTo(Math.SQRT1_2, 3);
    expect(size(biquadAt("bandpass", 1000, 2, 0, 1000))).toBeCloseTo(1, 6);
    expect(size(biquadAt("allpass", 1000, 2, 0, 333))).toBeCloseTo(1, 6);
    expect(octavesToQ(1)).toBeCloseTo(1.414, 3);
  });
});

describe("the other devices' maths", () => {
  it("settings stay in range and on their step, with no stray decimals", () => {
    expect(tidyParam(specOf("comp")!.params[1]!, 3.14159)).toBe(3.1);
    expect(tidyParam(specOf("eq8")!.params[2]!, 99999)).toBe(20000);
  });
  it("compressor: below the threshold nothing, above it the extra is divided by the ratio", () => {
    expect(compOutDb({ threshold: -20, ratio: 4 }, -30)).toBe(-30);
    expect(compOutDb({ threshold: -20, ratio: 4 }, -8)).toBe(-17);
    expect(compOutDb({ threshold: -20, ratio: 1 }, -8)).toBe(-8);
  });
  it("saturator: every curve leaves a quiet sound alone-ish, never passes 1.34, and the table carries the drive", () => {
    for (const c of [0, 1, 2, 3]) { expect(saturate(c, 0)).toBeCloseTo(0, 10); for (let x = -8; x <= 8; x += 0.25) expect(Math.abs(saturate(c, x))).toBeLessThanOrEqual(1.34); }
    expect(saturate(0, 0.01)).toBeCloseTo(0.01, 4); expect(saturate(1, 3)).toBe(1); expect(saturate(2, 2)).toBeCloseTo(0, 10);
    expect(saturate(3, 1)).not.toBeCloseTo(-saturate(3, -1), 2);                                  // the two halves differ
    const t = satTable(1, 6); expect(t[0]).toBe(-1); expect(t[2048]).toBe(0); expect(t[2048 + 512]).toBeCloseTo(0.25 * 1.9953, 3);
  });
  it("overdrive: no drive is no gain; tone runs from 500 Hz to 20 kHz", () => {
    expect(overdriveGain(0)).toBe(1); expect(overdriveGain(100)).toBe(60);
    expect(overdriveToneHz(0)).toBe(500); expect(overdriveToneHz(100)).toBeCloseTo(20000, 6);
  });
  it("mix is a straight crossfade", () => { expect(mixGains(0)).toEqual([1, 0]); expect(mixGains(25)).toEqual([0.75, 0.25]); expect(mixGains(100)).toEqual([0, 1]); });
  it("auto pan: the sides swing opposite ways at 180 degrees and together at 0; the shapes' harmonics rebuild them", () => {
    const p = start("autopan");
    expect(autoPanGain(p, 0.25, "left")).toBeCloseTo(1, 10); expect(autoPanGain(p, 0.25, "right")).toBeCloseTo(0, 10);
    expect(autoPanGain({ ...p, phase: 0 }, 0.6, "left")).toBeCloseTo(autoPanGain({ ...p, phase: 0 }, 0.6, "right"), 10);
    expect(autoPanGain({ ...p, amount: 40 }, 0.75, "left")).toBeCloseTo(0.6, 10);
    for (const shape of [0, 1]) for (const x of [0.1, 0.3, 0.62, 0.9]) expect(panHarmonics(shape, 200).reduce((s, b, i) => s + b * Math.sin(2 * Math.PI * (i + 1) * x), 0)).toBeCloseTo(panShape(shape, x), 2);
    expect(lfoRateHz({ sync: 1, div: 4 }, 120)).toBe(2); expect(lfoRateHz({ sync: 1, div: 7 }, 120)).toBe(0.5); expect(lfoRateHz({ sync: 0, rate: 3 }, 120)).toBe(3);
  });
  it("chorus: the two copies move opposite ways around the set delay and never reach zero", () => {
    const [a, b] = chorusDelays({ delay: 12, amount: 100 }, 0.25);
    expect(a).toBeCloseTo(0.016, 6); expect(b).toBeCloseTo(0.008, 6);
    expect(Math.min(...chorusDelays({ delay: 3, amount: 100 }, 0.75))).toBeGreaterThan(0);
  });
  it("delay: times in beats follow the tempo; ping-pong sends each echo to the other side", () => {
    expect(delayTimes(start("delay"), 120)).toEqual([0.375, 0.375]);                              // a dotted eighth
    expect(delayTimes(start("delay", { divL: 4, divR: 2 }), 100)).toEqual([0.6, 0.3]);
    expect(delayTimes(start("delay", { sync: 0, msL: 250, msR: 500 }), 100)).toEqual([0.25, 0.5]);
    expect(DELAY_DIVS.map((d) => d.beats)).toEqual([...DELAY_DIVS.map((d) => d.beats)].sort((x, y) => x - y));
    expect(delayRouting({ feedback: 50, pingpong: 0 })).toEqual({ leftIn: [1, 0], rightIn: [0, 1], self: 0.5, cross: 0 });
    expect(delayRouting({ feedback: 50, pingpong: 1 })).toEqual({ leftIn: [0.5, 0.5], rightIn: [0, 0], self: 0, cross: 0.5 });
    expect(delayEchoes(start("delay", { feedback: 50, pingpong: 1, divR: 4 }), 120, 3)).toEqual([{ at: 0.375, side: "left", level: 1 }, { at: 0.875, side: "right", level: 0.5 }, { at: 1.25, side: "left", level: 0.25 }]);
  });
});
