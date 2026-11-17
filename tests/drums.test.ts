import { describe, expect, it } from "vitest";
import { STARTERS, STRENGTH, VOICES, audible, clearAll, emptyPattern, fromRows, nextStrength, setHit, setLane, setLength, setSwing, setTempo, stepSeconds, stepTime, strikes, tidyPattern } from "../src/daw/drums";
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
    expect(one.map((s) => `${s.voice}@${s.step}`)).toEqual(["kick@0", "hat@2", "kick@4", "kick@8", "kick@12"]);
    expect(one[0]!.strength).toBeCloseTo(STRENGTH[3] * 0.8, 10);
    expect(one[1]!.strength).toBeCloseTo(STRENGTH[1] * 0.8, 10);
    const second = strikes(p, 16, 17);
    expect(second).toHaveLength(1);
    expect(second[0]!.at).toBeCloseTo(2, 10);
    expect(second[0]!.step).toBe(0);
  });
  it("mute silences a lane, solo leaves only the soloed ones, level 0 is silence", () => {
    let p = fromRows("t", 120, { kick: "x...", snare: "x...", hat: "x..." });
    expect(strikes(setLane(p, 0, { mute: true }), 0, 1).map((s) => s.voice)).toEqual(["snare", "hat"]);
    p = setLane(setLane(p, 0, { mute: true }), 1, { solo: true });
    expect(strikes(p, 0, 1).map((s) => s.voice)).toEqual(["snare"]);
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
    for (const s of STARTERS) {
      expect(s.lanes.map((l) => l.voice)).toEqual([...VOICES]);
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
    expect(t.lanes).toHaveLength(VOICES.length);
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
