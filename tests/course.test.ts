import { describe, expect, it } from "vitest";
import { LESSONS } from "../src/course/lessons";
import type { Snapshot } from "../src/course/types";
import { harmonic, INITIAL, noteToHz, PARAMS, playedHz, dbToGain, type SynthState } from "../src/synth/params";
import { newTrack, snapshot, trackAllReleased, trackFlag, trackNoteOn, trackState } from "../src/synth/tracker";

const base = (over: Partial<Snapshot> = {}, state: Partial<SynthState> = {}, start: Partial<SynthState> = {}): Snapshot => ({
  state: { ...INITIAL, ...state }, start: { ...INITIAL, ...start }, audioRunning: true, held: [], played: { mouse: 0, keys: 0, midi: 0 },
  distinctNotes: 0, holdOn: false, heldSeconds: 0, range: {}, changes: {}, flags: {}, ...over,
});
const step = (id: string, n: number) => LESSONS.find((l) => l.id === id)!.steps[n]!;

describe("practice synth maths", () => {
  it("maps notes to frequency: A4 is 440 Hz and each octave doubles", () => {
    expect(noteToHz(69)).toBe(440);
    expect(noteToHz(57)).toBeCloseTo(220, 6);
    expect(playedHz({ ...INITIAL, octave: 1 }, 69)).toBeCloseTo(880, 6);
    expect(playedHz({ ...INITIAL, semitone: 12 }, 69)).toBeCloseTo(880, 6);
    expect(playedHz({ ...INITIAL, fine: 100 }, 69)).toBeCloseTo(noteToHz(70), 6);
    expect(playedHz({ ...INITIAL, freeHz: 300 }, 40)).toBe(300);
  });
  it("uses the textbook harmonic series for each shape", () => {
    expect([1, 2, 3].map((n) => harmonic("sine", n))).toEqual([1, 0, 0]);
    expect([1, 2, 3, 4].map((n) => harmonic("saw", n))).toEqual([1, 1 / 2, 1 / 3, 1 / 4]);
    expect([1, 2, 3, 4, 5].map((n) => harmonic("square", n))).toEqual([1, 0, 1 / 3, 0, 1 / 5]);
    expect([1, 2, 3, 5].map((n) => harmonic("triangle", n))).toEqual([1, 0, -1 / 9, 1 / 25]);
  });
  it("converts decibels to gain and treats the bottom of the range as silence", () => {
    expect(dbToGain(0)).toBe(1);
    expect(dbToGain(-6)).toBeCloseTo(0.501, 3);
    expect(dbToGain(-48)).toBe(0);
  });
  it("every lesson only reveals controls that exist, within their ranges", () => {
    const panels = new Set(["start", "keyboard", "hold", "scope", "spectrum", "meter", "ack", ...Object.keys(PARAMS)]);
    for (const l of LESSONS) for (const s of l.steps) for (const p of s.show) expect(panels.has(p), `${l.id}: ${p}`).toBe(true);
  });
});

describe("tracking what the learner does", () => {
  it("counts changes, ranges, notes by input, and hold time", () => {
    let t = newTrack(INITIAL);
    t = trackState(t, INITIAL, { ...INITIAL, octave: -2 });
    t = trackState(t, { ...INITIAL, octave: -2 }, { ...INITIAL, octave: 1, shape: "sine" });
    t = trackNoteOn(t, "keys", 60, 10);
    t = trackNoteOn(t, "mouse", 60, 11);
    t = trackNoteOn(t, "mouse", 64, 12);
    t = trackFlag(t, "ack");
    const s = snapshot(t, { ...INITIAL, octave: 1, shape: "sine" }, { audioRunning: true, held: [60, 64], holdOn: true, now: 13.5 });
    expect(s.changes).toEqual({ octave: 2, shape: 1 });
    expect(s.range.octave).toEqual({ min: -2, max: 1 });
    expect(s.played).toEqual({ mouse: 2, keys: 1, midi: 0 });
    expect(s.distinctNotes).toBe(2);
    expect(s.heldSeconds).toBe(3.5);
    expect(s.flags.ack).toBe(true);
    expect(snapshot(trackAllReleased(t), INITIAL, { audioRunning: true, held: [], holdOn: false, now: 20 }).heldSeconds).toBe(0);
  });
});

describe("playable lessons", () => {
  it("have unique ids, existing prerequisites, and no step that is already passed at the start", () => {
    const ids = LESSONS.map((l) => l.id);
    expect(new Set(ids).size).toBe(ids.length);
    for (const l of LESSONS) {
      for (const b of l.buildsOn) expect(ids, `${l.id} builds on ${b}`).toContain(b);
      expect(l.steps.length + (l.rounds?.length ?? 0), l.id).toBeGreaterThanOrEqual(4);
      expect(l.recap.length).toBe(3);
      l.steps.forEach((s, i) => {
        const start = { ...INITIAL, ...l.initial };
        // a fresh step with audio off and nothing touched must not count as done
        expect(s.check(base({ audioRunning: false }, start, start)), `${l.id} step ${i + 1}`).toBe(false);
      });
    }
  });
  it("C0.1: each input is checked separately, and the remark reports what was done", () => {
    expect(step("C0.1", 0).check(base())).toBe(true);
    expect(step("C0.1", 1).check(base({ played: { mouse: 0, keys: 3, midi: 0 } }))).toBe(false);
    expect(step("C0.1", 2).check(base({ played: { mouse: 0, keys: 1, midi: 0 } }))).toBe(true);
    expect(step("C0.1", 3).check(base({ holdOn: true, held: [60] }))).toBe(true);
    const done = base({}, { volumeDb: -20 }, { volumeDb: -12 });
    expect(step("C0.1", 4).check(done)).toBe(true);
    expect(step("C0.1", 4).check({ ...done, holdOn: true })).toBe(false);
    expect(step("C0.1", 4).remark!(done)).toBe("You settled on -20 dB, 8 dB below where it started.");
  });
  it("C0.2: frequency targets have tolerances and the octave step needs a real doubling", () => {
    expect(step("C0.2", 1).check(base({}, { freeHz: 590 }, { freeHz: 300 }))).toBe(false);
    expect(step("C0.2", 1).check(base({}, { freeHz: 600 }, { freeHz: 300 }))).toBe(true);
    expect(step("C0.2", 2).check(base({}, { freeHz: 222 }))).toBe(true);
    expect(step("C0.2", 3).check(base({}, { freeHz: 446 }))).toBe(false);
    expect(step("C0.2", 4).remark!(base({}, { freeHz: 884 }))).toMatch(/^You landed on 884 Hz\./);
  });
  it("C0.3: decibel steps are measured from where each step began", () => {
    expect(step("C0.3", 1).check(base({}, { volumeDb: -12 }, { volumeDb: -6 }))).toBe(true);
    expect(step("C0.3", 1).check(base({}, { volumeDb: -9 }, { volumeDb: -6 }))).toBe(false);
    expect(step("C0.3", 3).check(base({}, { volumeDb: -6 }, { volumeDb: -18 }))).toBe(true);
    expect(step("C0.3", 4).check(base({ flags: { ack: true } }))).toBe(true);
  });
  it("C0.4 and C1.1: shape steps need the right shape, and switching is counted", () => {
    expect(step("C0.4", 0).check(base({ heldSeconds: 2.1, held: [60] }, { shape: "sine" }))).toBe(true);
    expect(step("C0.4", 3).check(base({ changes: { shape: 3 } }))).toBe(false);
    expect(step("C0.4", 3).check(base({ changes: { shape: 4 } }))).toBe(true);
    expect(step("C1.1", 2).check(base({}, { shape: "triangle" }))).toBe(false);
    expect(step("C1.1", 2).check(base({}, { shape: "square" }))).toBe(true);
    expect(step("C1.1", 4).check(base({ distinctNotes: 2, changes: { shape: 1 } }, { shape: "sine" }))).toBe(true);
  });
  it("C1.2: pitch steps check exact values, fine has a tolerance", () => {
    expect(step("C1.2", 0).check(base({}, { octave: -1 }))).toBe(true);
    expect(step("C1.2", 2).check(base({}, { octave: 0, semitone: 7 }))).toBe(true);
    expect(step("C1.2", 2).check(base({}, { octave: -2, semitone: 7 }))).toBe(false);
    expect(step("C1.2", 3).check(base({}, { fine: 20 }))).toBe(true);
    expect(step("C1.2", 3).check(base({}, { fine: 40 }))).toBe(false);
    expect(step("C1.2", 3).remark!(base({}, { fine: 18 }))).toMatch(/^You set 18 cents\./);
  });
});

import { guideContext, loadDone, saveDone, suggestNext } from "../src/course/progress";

describe("progress and the guide's context", () => {
  it("suggests the first unfinished lesson whose prerequisites are done", () => {
    expect(suggestNext(LESSONS, [])!.id).toBe("C0.1");
    expect(suggestNext(LESSONS, ["C0.1"])!.id).toBe("C0.2");
    expect(suggestNext(LESSONS, ["C0.1", "C0.2", "C0.3"])!.id).toBe("C0.4");
    // lessons can be taken out of order; the suggestion still respects what each builds on
    expect(suggestNext(LESSONS, ["C1.2"])!.id).toBe("C0.1");
    expect(suggestNext(LESSONS, LESSONS.map((l) => l.id))).toBeUndefined();
  });
  it("remembers progress, and survives missing or broken storage", () => {
    const mem: Record<string, string> = {};
    const store = { getItem: (k: string) => mem[k] ?? null, setItem: (k: string, v: string) => { mem[k] = v; } };
    saveDone(["C0.1", "C1.1"], store);
    expect(loadDone(store)).toEqual(["C0.1", "C1.1"]);
    expect(loadDone({ getItem: () => "{not json" })).toEqual([]);
    expect(loadDone({ getItem: () => { throw new Error("blocked"); } })).toEqual([]);
    expect(() => saveDone(["x"], { setItem: () => { throw new Error("full"); } })).not.toThrow();
  });
  it("tells the guide the lesson, step, settings and finished lessons, with the topic on the first line", () => {
    const l = LESSONS.find((x) => x.id === "C1.2")!;
    const text = guideContext(l, 1, "wave shape saw, volume -12 dB, octave -1, semitone 0, fine 0 cents", LESSONS, ["C0.1"]);
    expect(text.split("\n")[0]).toBe("Octave, semitone and fine");
    expect(text).toContain("step 2 of 5: Set Octave to -2.");
    expect(text).toContain("octave -1");
    expect(text).toContain("Lessons already finished: Playing the synth.");
    expect(text).toContain("not Serum");
    expect(text.length).toBeLessThan(2000);
  });
});

import { allMatch, compareSetting, compareToTarget } from "../src/course/match";

describe("hear it first, and match by ear", () => {
  it("every demo is a short, audible, in-order set of tones", () => {
    const withDemo = LESSONS.filter((l) => l.demo);
    expect(withDemo.length).toBeGreaterThanOrEqual(5);
    for (const l of withDemo) {
      const tones = l.demo!.tones;
      expect(tones.length, l.id).toBeGreaterThanOrEqual(2);
      for (const t of tones) { expect(t.hz).toBeGreaterThan(40); expect(t.hz).toBeLessThan(4000); expect(t.gainDb ?? -8).toBeLessThanOrEqual(0); }
      expect(tones.at(-1)!.at + tones.at(-1)!.seconds, l.id).toBeLessThan(6);
      expect(tones.map((t) => t.at)).toEqual([...tones.map((t) => t.at)].sort((a, b) => a - b));
    }
    // the loudness demo really steps down by 6 dB each time
    expect(LESSONS.find((l) => l.id === "C0.3")!.demo!.tones.map((t) => t.gainDb)).toEqual([-6, -12, -18]);
  });
  it("says which way a setting is off without revealing the target", () => {
    expect(compareSetting("octave", { ...INITIAL, octave: 0 }, { octave: -1 })).toBe("too high");
    expect(compareSetting("octave", { ...INITIAL, octave: -2 }, { octave: -1 })).toBe("too low");
    expect(compareSetting("shape", { ...INITIAL, shape: "saw" }, { shape: "square" })).toBe("different");
    expect(compareSetting("fine", { ...INITIAL, fine: 8 }, { fine: 0 })).toBe("match"); // within a few cents
    expect(compareSetting("fine", { ...INITIAL, fine: 25 }, { fine: 0 })).toBe("too high");
    const v = compareToTarget({ ...INITIAL, shape: "square", octave: -1, semitone: 5 }, { shape: "square", octave: -1, semitone: 7 }, ["shape", "octave", "semitone"]);
    expect(v).toEqual({ shape: "match", octave: "match", semitone: "too low" });
    expect(allMatch(v)).toBe(false);
  });
  it("every round starts unsolved, is solvable, and only compares what it shows", () => {
    for (const l of LESSONS) for (const [i, r] of (l.rounds ?? []).entries()) {
      const start = { ...INITIAL, ...r.from };
      expect(allMatch(compareToTarget(start, r.target, r.match)), `${l.id} round ${i + 1} starts solved`).toBe(false);
      expect(allMatch(compareToTarget({ ...start, ...r.target }, r.target, r.match)), `${l.id} round ${i + 1}`).toBe(true);
      for (const k of r.match) expect(k in r.target, `${l.id} round ${i + 1} target has ${k}`).toBe(true);
    }
  });
});
