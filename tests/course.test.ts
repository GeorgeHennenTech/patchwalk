import { describe, expect, it } from "vitest";
import { LESSONS } from "../src/course/lessons";
import type { Snapshot } from "../src/course/types";
import { harmonic, INITIAL, noteToHz, PARAMS, playedHz, dbToGain, type SynthState } from "../src/synth/params";
import { newTrack, snapshot, trackAllReleased, trackFlag, trackNoteOn, trackState } from "../src/synth/tracker";

const base = (over: Partial<Snapshot> = {}, state: Partial<SynthState> = {}, start: Partial<SynthState> = {}): Snapshot => ({
  state: { ...INITIAL, ...state }, start: { ...INITIAL, ...start }, audioRunning: true, held: [], played: { mouse: 0, keys: 0, midi: 0 },
  distinctNotes: 0, holdOn: false, heldSeconds: 0, range: {}, changes: {}, flags: {}, lastNote: null, ...over,
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
    const panels = new Set(["start", "keyboard", "hold", "scope", "spectrum", "meter", "beat", "ack", ...Object.keys(PARAMS)]);
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
      for (const t of tones) {
        expect(!!t.patch || (!!t.shape && !!t.hz), `${l.id}: a tone needs a patch or a shape and frequency`).toBe(true);
        if (t.hz) { expect(t.hz).toBeGreaterThan(40); expect(t.hz).toBeLessThan(4000); }
        expect(t.gainDb ?? -8).toBeLessThanOrEqual(0);
      }
      expect(tones.at(-1)!.at + tones.at(-1)!.seconds, l.id).toBeLessThan(8);
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

import { beatHz, brightness, frameCount, harmonicsA, playedHzB, subHz, unisonOffsets, unisonPans } from "../src/synth/params";

describe("extended synth maths", () => {
  it("beat rate is the frequency difference between the two oscillators, and doubles an octave up", () => {
    const s = { ...INITIAL, bOn: true, fine: -5, bFine: 5 };
    const low = beatHz(s, 45), high = beatHz(s, 57);
    expect(low).toBeCloseTo(Math.abs(playedHz(s, 45) - playedHzB(s, 45)), 9);
    expect(high / low).toBeCloseTo(2, 6);
    expect(beatHz({ ...s, bOn: false }, 45)).toBe(0);
    expect(beatHz({ ...INITIAL, bOn: true }, 45)).toBe(0);
  });
  it("unison voices are spread evenly around the played pitch and across the stereo field", () => {
    expect(unisonOffsets(1, 40)).toEqual([0]);
    expect(unisonOffsets(3, 40)).toEqual([-20, 0, 20]);
    expect(unisonOffsets(5, 40).reduce((a, b) => a + b, 0)).toBeCloseTo(0, 9);
    expect(unisonPans(3, 100)).toEqual([-1, 0, 1]);
    expect(unisonPans(3, 50)).toEqual([-0.5, 0, 0.5]);
    expect(unisonPans(7, 0).every((p) => p === 0)).toBe(true);
  });
  it("the sub sits whole octaves below the key", () => {
    expect(subHz({ ...INITIAL, subOctave: -1 }, 69)).toBeCloseTo(220, 6);
    expect(subHz({ ...INITIAL, subOctave: -2 }, 69)).toBeCloseTo(110, 6);
  });
  it("wavetable position blends neighbouring frames, and the ends are the pure frames", () => {
    const at = (position: number) => harmonicsA({ shape: "saw", table: "basic", position });
    expect(frameCount("basic")).toBe(4);
    expect(Array.from(at(0)).slice(1, 4)).toEqual([1, 0, 0]); // sine
    expect(at(100)[2]).toBeCloseTo(0.5, 6); // saw: harmonic 2 at 1/2
    const mid = at(50); // halfway between triangle and square
    expect(mid[3]!).toBeCloseTo((-1 / 9 + 1 / 3) / 2, 6);
    expect(harmonicsA({ shape: "square", table: "none", position: 80 })[2]).toBe(0);
  });
  it("the bright table really gets brighter along its length", () => {
    const b = [0, 25, 50, 75, 100].map((position) => brightness(harmonicsA({ shape: "saw", table: "bright", position })));
    expect(b).toEqual([...b].sort((x, y) => x - y));
    expect(b[0]).toBe(0);
    expect(b[4]!).toBeGreaterThan(b[1]!);
  });
});

describe("chapter 1 lessons", () => {
  const st = (id: string, n: number) => LESSONS.find((l) => l.id === id)!.steps[n]!;
  it("there are fourteen lessons, in chapter order, and every initial setting is a real setting", () => {
    expect(LESSONS.map((l) => l.id)).toEqual(["C0.1", "C0.2", "C0.3", "C0.4", "C1.1", "C1.2", "C1.M", "C1.3", "C1.4", "C1.5", "C1.6", "C1.7", "C1.8", "C1.C"]);
    for (const l of LESSONS) for (const k of Object.keys(l.initial ?? {})) expect(k in INITIAL, `${l.id}: ${k}`).toBe(true);
  });
  it("C1.3: sweeping means visiting both ends, and 'brightest' is judged from the harmonics", () => {
    expect(st("C1.3", 1).check(base({ range: { position: { min: 0, max: 60 } } }, { table: "basic" }))).toBe(false);
    expect(st("C1.3", 1).check(base({ range: { position: { min: 2, max: 100 } } }, { table: "basic" }))).toBe(true);
    expect(st("C1.3", 4).check(base({ changes: { position: 3 } }, { table: "bright", position: 100 }))).toBe(true);
    expect(st("C1.3", 4).check(base({ changes: { position: 3 } }, { table: "bright", position: 20 }))).toBe(false);
    expect(st("C1.3", 2).remark!(base({}, { table: "basic", position: 50 }))).toBe("You stopped at 50%. In this table that sits between triangle and square.");
  });
  it("C1.4: B must match A before it is moved, and the level remark reports the gap", () => {
    expect(st("C1.4", 1).check(base({}, { bOn: true, bShape: "square" }))).toBe(false);
    expect(st("C1.4", 1).check(base({}, { bOn: true }))).toBe(true);
    expect(st("C1.4", 3).check(base({}, { bOn: true, bLevelDb: -5 }))).toBe(false);
    expect(st("C1.4", 3).remark!(base({}, { bOn: true, bLevelDb: -9 }))).toMatch(/^You put B 9 dB under A\./);
    expect(st("C1.4", 4).check(base({}, { bOn: true, bSemitone: 7 }))).toBe(true);
  });
  it("C1.5: the beat-rate target depends on the key being held", () => {
    const tuned = { bOn: true, octave: -1, bOctave: -1, fine: -14, bFine: 14 };
    const rate = beatHz({ ...INITIAL, ...tuned }, 45);
    expect(rate).toBeGreaterThan(0.8);
    const s = base({ lastNote: 45 }, tuned);
    expect(st("C1.5", 2).check(s)).toBe(rate >= 3.5 && rate <= 4.5);
    expect(st("C1.5", 2).check(base({ lastNote: null }, tuned))).toBe(false);
    // a 10-cent gap is right for step 2, but only with A below B as instructed
    expect(st("C1.5", 1).check(base({}, { bOn: true, fine: -5, bFine: 5 }))).toBe(true);
    expect(st("C1.5", 1).check(base({}, { bOn: true, fine: 5, bFine: 15 }))).toBe(false);
    // step 4 must be done by changing key, not by changing the gap
    const wide = { bOn: true, octave: -1, bOctave: -1, fine: -30, bFine: 30 };
    expect(st("C1.5", 3).check(base({ lastNote: 69, played: { mouse: 1, keys: 0, midi: 0 } }, wide))).toBe(beatHz({ ...INITIAL, ...wide }, 69) >= 6.5);
    expect(st("C1.5", 3).check(base({ lastNote: 69, played: { mouse: 1, keys: 0, midi: 0 }, changes: { fine: 1 } }, wide))).toBe(false);
    expect(st("C1.5", 4).remark!(base({}, { bOn: true, fine: -30, bFine: 30 }))).toMatch(/past a quarter-tone/);
  });
  it("C1.6: 'push it too far, then back off' needs both halves", () => {
    expect(st("C1.6", 4).check(base({ range: { detune: { min: 10, max: 80 } } }, { voices: 7, detune: 80 }))).toBe(false);
    expect(st("C1.6", 4).check(base({ range: { detune: { min: 10, max: 80 } } }, { voices: 7, detune: 30 }))).toBe(true);
    expect(st("C1.6", 4).check(base({ range: { detune: { min: 10, max: 40 } } }, { voices: 7, detune: 20 }))).toBe(false);
  });
  it("C1.7 and C1.8: sub level, noise type and phase checks", () => {
    expect(st("C1.7", 2).check(base({ range: { subLevelDb: { min: -6, max: 0 } } }, { subOn: true, subLevelDb: -9 }))).toBe(true);
    expect(st("C1.7", 2).check(base({ range: { subLevelDb: { min: -6, max: -4 } } }, { subOn: true, subLevelDb: -9 }))).toBe(false);
    expect(st("C1.7", 3).check(base({}, { noiseOn: true, noiseType: "white", noiseLevelDb: -6 }))).toBe(false);
    const sq = { shape: "square" as const, bShape: "square" as const, bOn: true };
    expect(st("C1.8", 2).check(base({}, { ...sq, bPhase: 180 }))).toBe(true);
    expect(st("C1.8", 2).check(base({}, { ...sq, phase: 90, bPhase: 270 }))).toBe(true);
    expect(st("C1.8", 2).check(base({}, { ...sq, bPhase: 90 }))).toBe(false);
    expect(st("C1.8", 2).check(base({}, { ...sq, bPhase: 180, bFine: 5 }))).toBe(false); // must be the same pitch to cancel
    expect(st("C1.8", 2).check(base({}, { ...sq, bShape: "saw", bPhase: 180 }))).toBe(false);
  });
});
