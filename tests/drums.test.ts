import { describe, expect, it } from "vitest";
import { DEFAULT_VOICES, GENRE_STARTERS, STARTERS, STRENGTH, audible, clearAll, emptyPattern, fromRows, nextStrength, setHit, setLane, setLength, setSwing, setTempo, stepSeconds, stepTime, strikes, tidyPattern } from "../src/daw/drums";
import { withSaved, withoutSaved } from "../src/daw/store";

describe("drum pattern", () => {
  it("sixteen steps at 120 bpm take two seconds, a step an eighth of a second", () => {
    expect(stepSeconds(120)).toBeCloseTo(0.125, 10);
    expect(stepTime(16, 120, 0)).toBeCloseTo(2, 10);
  });
  it("swing delays every second step and leaves the others alone", () => {
    expect(stepTime(4, 120, 50)).toBeCloseTo(0.5, 10);
    expect(stepTime(1, 120, 50)).toBeCloseTo(0.125 + 0.0625, 10);
    expect(stepTime(1, 120, 500)).toBeLessThan(stepTime(2, 120, 0)); // never past the next step
  });
  it("lists the hits of a stretch, in time, and wraps round the pattern", () => {
    const p = fromRows("t", 120, { kick: "X...x...x...x...", hat: "..o............." });
    const one = strikes(p, 0, 16);
    expect(one.map((s) => `${s.pad.voice}@${s.step}`)).toEqual(["kick@0", "hat@2", "kick@4", "kick@8", "kick@12"]);
    expect(one[0]!.strength).toBeCloseTo(STRENGTH[3] * 0.8, 10);
    expect(one[1]!.strength).toBeCloseTo(STRENGTH[1] * 0.8, 10);
    const second = strikes(p, 16, 17);
    expect(second).toHaveLength(1);
    expect(second[0]!.at).toBeCloseTo(2, 10);
    expect(second[0]!.step).toBe(0);
  });
  it("mute silences a lane, solo leaves only the soloed ones, level 0 is silence", () => {
    let p = fromRows("t", 120, { kick: "x...", snare: "x...", hat: "x..." });
    expect(strikes(setLane(p, 0, { mute: true }), 0, 1).map((s) => s.pad.voice)).toEqual(["snare", "hat"]);
    p = setLane(setLane(p, 0, { mute: true }), 1, { solo: true });
    expect(strikes(p, 0, 1).map((s) => s.pad.voice)).toEqual(["snare"]);
    expect(audible(p).filter(Boolean)).toHaveLength(1);
    expect(strikes(setLane(p, 1, { level: 0 }), 0, 1)).toEqual([]);
  });
  it("edits return a new pattern and leave the old one alone", () => {
    const a = emptyPattern(), b = setHit(a, 0, 3, 2);
    expect(a.lanes[0]!.steps[3]).toBe(0);
    expect(b.lanes[0]!.steps[3]).toBe(2);
    expect(strikes(clearAll(b), 0, 16)).toEqual([]);
  });
  it("strength goes normal, accent, soft, and silence stays silence", () => {
    expect([nextStrength(2), nextStrength(3), nextStrength(1), nextStrength(0)]).toEqual([3, 1, 2, 0]);
  });
  it("two bars repeat the first, and going back keeps it", () => {
    const p = fromRows("t", 120, { kick: "x..x" }), two = setLength(p, 32);
    expect(two.lanes[0]!.steps).toHaveLength(32);
    expect(two.lanes[0]!.steps[19]).toBe(2);
    expect(setLength(two, 16).lanes[0]!.steps).toEqual(p.lanes[0]!.steps);
  });
  it("keeps tempo and swing in range", () => {
    expect(setTempo(emptyPattern(), 999).bpm).toBe(200);
    expect(setTempo(emptyPattern(), 1).bpm).toBe(60);
    expect(setSwing(emptyPattern(), 200).swing).toBe(75);
  });
  it("every starter has all the drums, the right length and something to play", () => {
    for (const s of [...STARTERS, ...GENRE_STARTERS]) {
      expect(s.lanes.map((l) => l.voice)).toEqual([...DEFAULT_VOICES]);
      expect(s.lanes.map((l) => l.id)).toEqual([...DEFAULT_VOICES]);
      for (const l of s.lanes) expect(l.steps).toHaveLength(s.length);
      expect(strikes(s, 0, s.length).length).toBeGreaterThan(6);
      expect(s.lanes[0]!.steps[0]).toBeGreaterThan(0); // a kick on the first beat
    }
  });
  it("makes a stored pattern safe", () => {
    expect(tidyPattern(null)).toBeUndefined();
    expect(tidyPattern("x")).toBeUndefined();
    const t = tidyPattern({ name: "n", bpm: 5000, swing: -4, length: 7, lanes: [{ voice: "kick", steps: [2, 9, "x", 3], level: 400, mute: "yes" }, { voice: "bogus", steps: [3] }] })!;
    expect(t.bpm).toBe(200); expect(t.swing).toBe(0); expect(t.length).toBe(16);
    expect(t.lanes).toHaveLength(1); // only what is a drum is kept
    expect(tidyPattern({ lanes: [] })!.lanes).toHaveLength(DEFAULT_VOICES.length); // nothing usable: a fresh rack
    expect(t.lanes[0]!.steps.slice(0, 4)).toEqual([2, 0, 0, 3]);
    expect(t.lanes[0]!.level).toBe(100); expect(t.lanes[0]!.mute).toBe(false);
    for (const s of STARTERS) expect(tidyPattern(JSON.parse(JSON.stringify(s)))).toEqual(s);
  });
  it("saving under the same name replaces, newest first", () => {
    const a = { ...emptyPattern("A") }, b = emptyPattern("B"), a2 = setTempo(emptyPattern("A"), 90);
    const list = withSaved(withSaved(withSaved([], a), b), a2);
    expect(list.map((p) => p.name)).toEqual(["A", "B"]);
    expect(list[0]!.bpm).toBe(90);
    expect(withoutSaved(list, "A").map((p) => p.name)).toEqual(["B"]);
  });
});

import { dropSample, setSample, tuneRate } from "../src/daw/drums";
import { checkFile, sampleName, SAMPLE_MAX_BYTES } from "../src/daw/samples";
describe("the learner's own drum sounds", () => {
  it("a drum's sound and tuning travel with each hit", () => {
    let p = setSample(fromRows("t", 120, { kick: "x...", snare: "x..." }), 0, "abc");
    p = setLane(p, 0, { tune: 7 });
    const [kick, snare] = strikes(p, 0, 1);
    expect(kick!.pad).toMatchObject({ voice: "kick", sample: "abc", tune: 7 });
    expect(snare!.pad.sample).toBeUndefined();
    expect("sample" in setSample(p, 0).lanes[0]!).toBe(false);
    expect(dropSample(p, "abc").lanes[0]!.sample).toBeUndefined();
    expect(dropSample(p, "other").lanes[0]!.sample).toBe("abc");
  });
  it("tuning is kept in range, and twelve semitones is double speed", () => {
    expect(setLane(emptyPattern(), 0, { tune: 99 }).lanes[0]!.tune).toBe(12);
    expect(tuneRate(12)).toBeCloseTo(2, 10); expect(tuneRate(-12)).toBeCloseTo(0.5, 10); expect(tuneRate(0)).toBe(1);
  });
  it("a stored pattern keeps its sounds and tuning, and loses nonsense", () => {
    const p = setLane(setSample(emptyPattern("s"), 2, "id1"), 2, { tune: -5 });
    expect(tidyPattern(JSON.parse(JSON.stringify(p)))).toEqual(p);
    const t = tidyPattern({ lanes: [{ voice: "kick", sample: 42, tune: "high" }, { voice: "snare", sample: "x".repeat(200), tune: 400 }] })!;
    expect(t.lanes[0]!.sample).toBeUndefined(); expect(t.lanes[0]!.tune).toBe(0);
    expect(t.lanes[1]!.sample).toBeUndefined(); expect(t.lanes[1]!.tune).toBe(12);
  });
  it("says in words why a file is refused", () => {
    expect(checkFile("kick.wav", "audio/wav", 5000)).toBeUndefined();
    expect(checkFile("kick.WAV", "", 5000)).toBeUndefined();
    expect(checkFile("notes.txt", "text/plain", 5000)).toMatch(/sound file/);
    expect(checkFile("a.wav", "audio/wav", 0)).toMatch(/empty/);
    expect(checkFile("a.wav", "audio/wav", SAMPLE_MAX_BYTES + 1)).toMatch(/12 MB/);
    expect(checkFile("a.wav", "audio/wav", 10, 64)).toMatch(/Delete one/);
    expect(sampleName("My Kick 01.wav")).toBe("My Kick 01");
  });
});

describe("genre starting points", () => {
  it("have different names and sensible tempos", () => {
    const names = [...STARTERS, ...GENRE_STARTERS].map((s) => s.name);
    expect(new Set(names).size).toBe(names.length);
    for (const s of GENRE_STARTERS) { expect(s.bpm).toBeGreaterThanOrEqual(60); expect(s.bpm).toBeLessThanOrEqual(200); expect(tidyPattern(JSON.parse(JSON.stringify(s)))).toEqual(s); }
  });
});

import { addPad, defaultPads, padWindow, removePad, tidyPads, MAX_PADS } from "../src/daw/drums";
describe("the drum rack's pads", () => {
  it("starts with nine pads, a ride among them, the two hats in one choke group", () => {
    const pads = defaultPads();
    expect(pads).toHaveLength(9);
    expect(pads.at(-1)!.voice).toBe("ride");
    expect(tidyPads([{ voice: "ridebell" }])[0]!.name).toBe("Ride bell");
    expect(pads.filter((p) => p.choke === 1).map((p) => p.voice)).toEqual(["hat", "openhat"]);
  });
  it("adds pads up to sixteen, each with its own id and an empty row, and removes all but the last", () => {
    let p = emptyPattern();
    for (let i = 0; i < 20; i++) p = addPad(p);
    expect(p.lanes).toHaveLength(MAX_PADS);
    expect(new Set(p.lanes.map((l) => l.id)).size).toBe(MAX_PADS);
    expect(p.lanes.at(-1)!.steps).toHaveLength(16);
    for (let i = 0; i < 20; i++) p = removePad(p, 0);
    expect(p.lanes).toHaveLength(1);
  });
  it("keeps every pad setting in range", () => {
    const l = setLane(emptyPattern(), 0, { pan: 500, start: 99, length: 0, fade: 99999, choke: 9, level: -3, name: "   " }).lanes[0]!;
    expect([l.pan, l.start, l.length, l.fade, l.choke, l.level, l.name]).toEqual([100, 95, 5, 2000, 4, 0, "Kick"]);
  });
  it("works out which part of a sound file plays", () => {
    expect(padWindow({ start: 0, length: 100, fade: 0 }, 2)).toEqual({ offset: 0, span: 2, fade: 0 });
    const w = padWindow({ start: 50, length: 50, fade: 100 }, 2);
    expect(w.offset).toBeCloseTo(1, 10); expect(w.span).toBeCloseTo(0.5, 10); expect(w.fade).toBeCloseTo(0.1, 10);
    expect(padWindow({ start: 0, length: 5, fade: 2000 }, 1).fade).toBeCloseTo(0.05, 10); // a fade is never longer than what plays
  });
  it("makes stored pads safe and their ids different", () => {
    const pads = tidyPads([{ voice: "kick", id: "a" }, { voice: "kick", id: "a", pan: 900 }, { voice: "nope" }, null, { voice: "snare", id: "bad id!" }]);
    expect(pads.map((p) => p.voice)).toEqual(["kick", "kick", "snare"]);
    expect(new Set(pads.map((p) => p.id)).size).toBe(3);
    expect(pads[1]!.pan).toBe(100);
  });
});
