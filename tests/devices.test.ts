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
    for (const kind of ["eq3", "eq8", "channeleq"]) for (const f of FREQS) expect(Math.abs(CURVES[kind]!(start(kind), f))).toBeLessThan(0.01);
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

import { autoFilterDb, autoFilterHz, echoDriveGain, echoSeconds, filterDelayLine, noteName } from "../src/daw/devices";
describe("auto filter, echo, filter delay", () => {
  it("auto filter: the LFO and the loudness move it by octaves; at rest it is a plain filter", () => {
    const p = start("autofilter", { freq: 1000, lfo: 2, env: -1 });
    expect(autoFilterHz(p)).toBe(1000); expect(autoFilterHz(p, 1)).toBe(4000); expect(autoFilterHz(p, -1)).toBe(250); expect(autoFilterHz(p, 0, 1)).toBe(500);
    expect(autoFilterDb(start("autofilter", { freq: 1000, res: Math.SQRT1_2 }), 1000)).toBeCloseTo(-3.01, 1);
    expect(autoFilterDb(start("autofilter", { type: 3, freq: 1000 }), 1000)).toBeLessThan(-60);
    expect(CURVES.autofilter!(start("autofilter", { type: 1, freq: 2000 }), 100)).toBeLessThan(-40);
  });
  it("echo: time in beats follows the tempo; no drive is no gain", () => {
    expect(echoSeconds(start("echo"), 120)).toBe(0.5); expect(echoSeconds(start("echo", { sync: 0, ms: 80 }), 120)).toBe(0.08);
    expect(echoDriveGain(0)).toBe(1); expect(echoDriveGain(100)).toBe(8);
  });
  it("filter delay: the left line hears the left, the middle both, the right the right; a line that is off is silent", () => {
    const p = start("filterdelay", { mon: 0 });
    expect(filterDelayLine(p, "l", 120)).toMatchObject({ hears: [1, 0], seconds: 0.25, pan: -1, level: 1 });
    expect(filterDelayLine(p, "m", 120)).toMatchObject({ hears: [0.5, 0.5], level: 0 });
    expect(filterDelayLine(p, "r", 120)).toMatchObject({ hears: [0, 1], seconds: 0.375, pan: 1 });
    expect(noteName(60)).toBe("C3"); expect(noteName(57)).toBe("A2");
  });
});

import { CABINETS, ampDrive, cabinetDb, driveTable, pedalDrive } from "../src/daw/devices";
describe("amp, pedal, cabinet", () => {
  it("drive never passes full level, grows with gain, and the amp treats the two halves differently", () => {
    for (const type of [0, 1, 2]) for (const gain of [0, 50, 100]) for (let x = -1; x <= 1; x += 0.05) { expect(Math.abs(ampDrive(type, gain, x))).toBeLessThanOrEqual(1.12); expect(Math.abs(pedalDrive(type, gain, x))).toBeLessThanOrEqual(1.0001); }
    expect(ampDrive(2, 50, 0.05)).toBeGreaterThan(ampDrive(0, 50, 0.05)); expect(pedalDrive(0, 100, 0.05)).toBeGreaterThan(pedalDrive(0, 0, 0.05));
    expect(ampDrive(1, 50, 0.3)).not.toBeCloseTo(-ampDrive(1, 50, -0.3), 3);
    expect(pedalDrive(1, 100, 0.5)).toBe(1); expect(pedalDrive(2, 100, 0.2)).toBeGreaterThan(0.99);
    const t = driveTable((x) => pedalDrive(0, 0, x)); expect(t[0]).toBeCloseTo(-1, 6); expect(t[2048]).toBe(0); expect(t[4096]).toBeCloseTo(1, 6);
  });
  it("a cabinet has no deep bass, a bump in the low mids, and little above a few kHz; a far microphone is duller", () => {
    for (let size = 0; size < CABINETS.length; size++) { const p = { size, mic: 0 }, c = CABINETS[size]!;
      expect(cabinetDb(p, 25)).toBeLessThan(-15); expect(cabinetDb(p, c.bump * 1.3)).toBeGreaterThan(0.5); expect(cabinetDb(p, 800)).toBeCloseTo(0, 0); expect(cabinetDb(p, 12000)).toBeLessThan(-20); }
    expect(cabinetDb({ size: 3, mic: 1 }, 4000)).toBeLessThan(cabinetDb({ size: 3, mic: 0 }, 4000) - 3);
  });
});

import { softClip, softClipTable, SOFT_CLIP_REACH, utilityMatrix as um } from "../src/daw/devices";
describe("Utility's choice of side, and the Saturator's soft clip", () => {
  const out = (p: Record<string, number>, l: number, r: number) => { const m = um({ gain: 0, pan: 0, width: 100, ...p }); return [(l * m.ll + r * m.rl) * m.gain, (l * m.lr + r * m.rr) * m.gain]; };
  it("left only and right only copy one side to both; swapped trades them", () => {
    expect(out({ channel: 1 }, 0.3, -0.7)).toEqual([0.3, 0.3]);
    expect(out({ channel: 2 }, 0.3, -0.7)).toEqual([-0.7, -0.7]);
    expect(out({ channel: 3 }, 0.3, -0.7)).toEqual([-0.7, 0.3]);
    expect(out({ channel: 0 }, 0.3, -0.7)).toEqual([0.3, -0.7]);
  });
  it("the choice of side comes first: pan and a flip still act on what was chosen", () => {
    expect(out({ channel: 1, pan: 100 }, 0.4, 0.9)).toEqual([0, 0.4]);
    expect(out({ channel: 3, flipL: 1 }, 0.4, 0.9)[0]).toBeCloseTo(-0.9, 10);
  });
  it("soft clip leaves quiet sound alone, never passes full level, and never turns a louder sound into a quieter one", () => {
    expect(softClip(0.3)).toBe(0.3); expect(softClip(-0.5)).toBe(-0.5);
    expect(softClip(1)).toBeCloseTo(0.5 + 0.5 * Math.tanh(1), 12); expect(softClip(-1)).toBe(-softClip(1));
    expect(softClip(50)).toBeLessThanOrEqual(1);
    for (let x = 0; x < 6; x += 0.01) expect(softClip(x + 0.01)).toBeGreaterThanOrEqual(softClip(x));
    const t = softClipTable(); expect(t[(t.length - 1) / 2]).toBe(0); expect(t[t.length - 1]).toBeCloseTo(softClip(SOFT_CLIP_REACH), 6); expect(t[0]).toBeCloseTo(-softClip(SOFT_CLIP_REACH), 6);
  });
});

describe("the echo's feedback path", () => {
  it("never lets a quiet sound come back louder than it went in, whatever the drive", async () => {
    const { echoDriveGain, echoFeedbackGain } = await import("../src/daw/devices");
    for (const drive of [0, 10, 30, 60, 100]) for (const feedback of [20, 60, 95, 100]) {
      const g = echoDriveGain(drive), small = g === 1 ? 1 : g / Math.tanh(g);   // what the drive curve does to a quiet sound
      const loop = echoFeedbackGain(feedback, drive) * small;
      expect(loop).toBeCloseTo(Math.min(0.95, feedback / 100), 9);
      expect(loop).toBeLessThan(1);
    }
    expect(echoFeedbackGain(50, 0)).toBe(0.5);
  });
});
