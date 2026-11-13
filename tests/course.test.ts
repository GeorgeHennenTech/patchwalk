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
    const panels = new Set(["start", "keyboard", "hold", "scope", "spectrum", "spectrogram", "meter", "beat", "curve", "ack", ...Object.keys(PARAMS)]);
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
  it("chapters 0 and 1 come first, in chapter order, and every initial setting is a real setting", () => {
    expect(LESSONS.map((l) => l.id).slice(0, 14)).toEqual(["C0.1", "C0.2", "C0.3", "C0.4", "C1.1", "C1.2", "C1.M", "C1.3", "C1.4", "C1.5", "C1.6", "C1.7", "C1.8", "C1.C"]);
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

import { CHAPTER_2 } from "../src/course/lessons/chapter2";
import { driveCurve, effectiveCutoff, filterResponseDb, filterStages, peakAboveBodyDb, resonanceQ, resonanceTrim } from "../src/synth/filter";

describe("filter maths", () => {
  const on = (over: Partial<SynthState> = {}): SynthState => ({ ...INITIAL, filterOn: true, cutoff: 1000, ...over });
  const at = (s: SynthState, f: number, note: number | null = null) => filterResponseDb(s, f, note);
  it("a switched-off filter lets everything through unchanged", () => {
    for (const f of [50, 1000, 15000]) expect(at({ ...INITIAL, cutoff: 300, resonance: 80 }, f)).toBeCloseTo(0, 9);
    expect(filterStages(INITIAL, 60).map((x) => x.type)).toEqual(["allpass", "allpass"]);
    expect(resonanceTrim({ ...INITIAL, resonance: 100 })).toBe(1);
  });
  it("low-pass: flat below, 3 dB down at the cutoff, then 12 or 24 dB per octave", () => {
    expect(at(on(), 60)).toBeCloseTo(0, 1);
    expect(at(on(), 1000)).toBeCloseTo(-3, 1);
    expect(at(on(), 2000) - at(on(), 4000)).toBeGreaterThan(11.5);
    expect(at(on(), 2000) - at(on(), 4000)).toBeLessThan(13.5);
    const steep = on({ slope: "24" });
    expect(at(steep, 2000) - at(steep, 4000)).toBeGreaterThan(23);
    expect(at(steep, 2000) - at(steep, 4000)).toBeLessThan(27);
    expect(at(steep, 60)).toBeCloseTo(0, 1);
  });
  it("high-pass mirrors it, band-pass keeps a slice, notch removes one", () => {
    const high = on({ filterType: "high" });
    expect(at(high, 12000)).toBeCloseTo(0, 0);
    expect(at(high, 250) - at(high, 125)).toBeGreaterThan(11.5);
    const band = on({ filterType: "band" });
    expect(at(band, 1000)).toBeCloseTo(0, 6);
    expect(at(band, 100)).toBeLessThan(-12);
    expect(at(band, 10000)).toBeLessThan(-12);
    // more resonance, narrower slice
    expect(at(on({ filterType: "band", resonance: 70 }), 500)).toBeLessThan(at(band, 500) - 12);
    const notch = on({ filterType: "notch" });
    expect(at(notch, 1000)).toBeLessThan(-60);
    expect(at(notch, 100)).toBeGreaterThan(-1);
    expect(at(notch, 10000)).toBeGreaterThan(-1);
  });
  it("resonance raises a peak at the cutoff and turns the body down", () => {
    expect(resonanceQ(0)).toBeCloseTo(Math.SQRT1_2, 9);
    expect(resonanceQ(100)).toBeCloseTo(40, 9);
    const peaks = [0, 25, 50, 75, 100].map((resonance) => peakAboveBodyDb(on({ resonance })));
    expect(peaks).toEqual([...peaks].sort((a, b) => a - b));
    expect(peaks[0]!).toBeLessThan(0.5);
    expect(peaks[4]!).toBeGreaterThan(28);
    expect(at(on({ resonance: 100 }), 60)).toBeLessThan(at(on(), 60) - 12);
    expect(at(on({ resonance: 100 }), 1000)).toBeGreaterThan(10);
  });
  it("key tracking pivots on middle C and at 100% moves an octave per octave", () => {
    const s = on({ cutoff: 500, keyTrack: 100 });
    expect(effectiveCutoff(s, 60)).toBeCloseTo(500, 6);
    expect(effectiveCutoff(s, 72)).toBeCloseTo(1000, 6);
    expect(effectiveCutoff(s, 48)).toBeCloseTo(250, 6);
    expect(effectiveCutoff({ ...s, keyTrack: 50 }, 84)).toBeCloseTo(1000, 6);
    expect(effectiveCutoff({ ...s, keyTrack: 0 }, 84)).toBe(500);
    expect(effectiveCutoff(s, null)).toBe(500);
    expect(effectiveCutoff({ cutoff: 20000, keyTrack: 100 }, 96)).toBe(20000);
    // the curve moves with the key: the 3 dB point follows
    expect(filterResponseDb(s, 1000, 72)).toBeCloseTo(-3, 1);
  });
  it("drive at zero is a straight line; above zero it flattens peaks, symmetrically and within bounds", () => {
    const clean = driveCurve(0, 9);
    expect(Array.from(clean)).toEqual([-4, -3, -2, -1, 0, 1, 2, 3, 4]);
    const hot = driveCurve(80, 2049);
    expect(hot[1024]).toBe(0);
    for (let i = 0; i < 1024; i++) { expect(hot[i]!).toBeCloseTo(-hot[2048 - i]!, 6); expect(hot[i + 1]!).toBeGreaterThanOrEqual(hot[i]!); }
    // flattened: the top of the curve barely rises while the middle is steep
    expect(hot[2048]! - hot[1536]!).toBeLessThan(0.01);
    expect(hot[1040]! - hot[1024]!).toBeGreaterThan(0.1);
    expect(Math.max(...hot)).toBeLessThan(1);
  });
});

describe("chapter 2 lessons", () => {
  const st = (id: string, n: number) => LESSONS.find((l) => l.id === id)!.steps[n]!;
  it("the filter chapter follows chapter 1 and uses only real settings and cards that exist", async () => {
    expect(LESSONS.map((l) => l.id).slice(14)).toEqual(["C2.1", "C2.2", "C2.3", "C2.4", "C2.5", "C2.6", "C2.7", "C2.C"]);
    const { readdirSync } = await import("node:fs");
    const cards = readdirSync("knowledge-cards").map((f) => f.replace(".md", ""));
    for (const l of CHAPTER_2) {
      for (const k of Object.keys(l.initial ?? {})) expect(k in INITIAL, `${l.id}: ${k}`).toBe(true);
      for (const c of l.cardIds) expect(cards, `${l.id}: card ${c}`).toContain(c);
    }
  });
  it("C2.1: the cutoff has to come down, the curve has to be dragged, and the remark counts harmonics", () => {
    expect(st("C2.1", 2).check(base({}, { filterOn: true, cutoff: 1000 }))).toBe(true);
    expect(st("C2.1", 2).check(base({}, { filterOn: false, cutoff: 1000 }))).toBe(false);
    expect(st("C2.1", 3).remark!(base({ lastNote: 57 }, { filterOn: true, cutoff: 230 }))).toMatch(/^At 230 Hz only the lowest harmonic of your note/);
    expect(st("C2.1", 3).remark!(base({ lastNote: 45 }, { filterOn: true, cutoff: 240 }))).toMatch(/only the lowest 2 harmonics/);
    const swept = { range: { cutoff: { min: 300, max: 1300 } } };
    expect(st("C2.1", 4).check(base(swept, { filterOn: true }))).toBe(false); // sliders alone do not count
    expect(st("C2.1", 4).check(base({ ...swept, flags: { curve: true } }, { filterOn: true }))).toBe(true);
    expect(st("C2.1", 4).check(base({ range: { cutoff: { min: 300, max: 1100 } }, flags: { curve: true } }, { filterOn: true }))).toBe(false);
  });
  it("C2.2: the remark reports the real height of the peak", () => {
    const s = base({}, { filterOn: true, cutoff: 1200, resonance: 90 });
    expect(st("C2.2", 3).check(s)).toBe(true);
    expect(st("C2.2", 3).remark!(s)).toContain(`about ${Math.round(peakAboveBodyDb(s.state))} dB above`);
    expect(st("C2.2", 4).check(base({ changes: { resonance: 5 } }, { filterOn: true, resonance: 30 }))).toBe(true);
    expect(st("C2.2", 4).check(base({ changes: { resonance: 5 } }, { filterOn: true, resonance: 70 }))).toBe(false);
  });
  it("C2.3 to C2.6: type, slope, drive and key-track steps check the setting they teach", () => {
    expect(st("C2.3", 2).check(base({}, { filterOn: true, filterType: "high", cutoff: 3500 }))).toBe(true);
    expect(st("C2.3", 2).check(base({}, { filterOn: true, filterType: "low", cutoff: 3500 }))).toBe(false);
    expect(st("C2.3", 5).check(base({ range: { cutoff: { min: 400, max: 1700 } } }, { filterOn: true, filterType: "notch" }))).toBe(true);
    expect(st("C2.4", 2).check(base({ changes: { slope: 4 } }))).toBe(true);
    expect(st("C2.4", 3).remark!(base({}, { slope: "24", cutoff: 1100 }, { cutoff: 600 }))).toMatch(/^You went from 600 Hz to 1\.10 kHz\./);
    expect(st("C2.5", 4).check(base({}, { bOn: true, bSemitone: 7, drive: 60 }))).toBe(true);
    expect(st("C2.5", 4).check(base({}, { bOn: true, bSemitone: 7, drive: 20 }))).toBe(false);
    const tracked = base({ distinctNotes: 2, lastNote: 72 }, { filterOn: true, cutoff: 700, keyTrack: 100 });
    expect(st("C2.6", 2).check(tracked)).toBe(true);
    expect(st("C2.6", 2).remark!(tracked)).toBe("On the last key you played the cutoff sat at 1.40 kHz, though the control still says 700 Hz.");
  });
  it("C2.7 starts as noise alone through the filter, and ends with the oscillator back", () => {
    const l = LESSONS.find((x) => x.id === "C2.7")!;
    expect(dbToGain(l.initial!.aLevelDb!)).toBe(0);
    expect(l.initial!.noiseOn).toBe(true);
    expect(st("C2.7", 4).check(base({}, { keyTrack: 100, cutoff: 262 }))).toBe(true);
    expect(st("C2.7", 5).check(base({ played: { mouse: 1, keys: 0, midi: 0 } }, { aLevelDb: -12 }))).toBe(true);
  });
  it("cutoff is matched by ear in octaves, not hertz", () => {
    expect(compareSetting("cutoff", { ...INITIAL, cutoff: 850 }, { cutoff: 700 })).toBe("match");
    expect(compareSetting("cutoff", { ...INITIAL, cutoff: 1000 }, { cutoff: 700 })).toBe("too high");
    expect(compareSetting("cutoff", { ...INITIAL, cutoff: 500 }, { cutoff: 700 })).toBe("too low");
    expect(compareSetting("slope", { ...INITIAL, slope: "12" }, { slope: "24" })).toBe("different");
  });
});

import { CHAPTERS, chapterOf, placeOf } from "../src/course/lessons";

describe("how lessons are labelled for the learner", () => {
  it("every lesson belongs to a named chapter and has a place in it", () => {
    for (const l of LESSONS) expect(CHAPTERS[chapterOf(l)], l.id).toBeTruthy();
    expect(placeOf(LESSONS.find((l) => l.id === "C0.1")!)).toEqual({ chapter: "Sound itself", number: 1, of: 4 });
    expect(placeOf(LESSONS.find((l) => l.id === "C2.5")!)).toEqual({ chapter: "Filters", number: 5, of: 8 });
    expect(placeOf(LESSONS.find((l) => l.id === "C1.C")!)).toEqual({ chapter: "Oscillators", number: 10, of: 10 });
  });
  it("no lesson text shown to the learner refers to another lesson by its code", () => {
    for (const l of LESSONS) {
      const shown = [l.title, l.outcome, ...l.idea, ...l.recap, l.inSerum ?? "", l.demo?.caption ?? "", ...l.steps.flatMap((s) => [s.do, s.hear, s.target])].join(" ");
      expect(shown, l.id).not.toMatch(/\bC\d\.[\dMC]\b/);
    }
  });
});

import { fromTravel, isBox, nudge, shortLabel, toTravel } from "../src/ui/synth/Controls";
import { MOD_MODULES, MODULES, wavePath } from "../src/ui/synth/Rack";

describe("knobs and the module rack", () => {
  it("a knob's travel covers its whole range, in octaves for wide-ranging settings, and snaps to steps", () => {
    const cutoff = PARAMS.cutoff!, res = PARAMS.resonance!, track = PARAMS.keyTrack!;
    expect(toTravel(cutoff, 20)).toBe(0);
    expect(toTravel(cutoff, 20000)).toBeCloseTo(1, 9);
    expect(toTravel(cutoff, 2000) - toTravel(cutoff, 1000)).toBeCloseTo(toTravel(cutoff, 400) - toTravel(cutoff, 200), 9);
    expect(fromTravel(res, 0.5)).toBe(50);
    expect(fromTravel(track, 0.52)).toBe(50); // steps of 5
    expect(fromTravel(res, 2)).toBe(100);
    expect(fromTravel(res, -1)).toBe(0);
    for (const v of [20, 262, 1000, 20000]) expect(fromTravel(cutoff, toTravel(cutoff, v))).toBe(v);
  });
  it("arrow keys move one exact step, ten with Shift, and never leave the range", () => {
    const res = PARAMS.resonance!, cutoff = PARAMS.cutoff!, oct = PARAMS.octave!;
    expect(nudge(res, 40, 1, false)).toBe(41);
    expect(nudge(res, 40, -1, true)).toBe(30);
    expect(nudge(res, 99, 1, true)).toBe(100);
    expect(nudge(oct, 3, 1, false)).toBe(3);
    expect(nudge(cutoff, 50, 1, false)).toBe(51); // never less than 1 Hz
    expect(nudge(cutoff, 5000, 1, false)).toBe(5050); // about 1% higher up
    expect(nudge(cutoff, 5000, -1, true)).toBe(4500);
  });
  it("every setting has a home: one module panel, or the main volume", () => {
    const groups = [...MODULES, ...MOD_MODULES].flatMap((m) => m.groups);
    expect(new Set(groups).size).toBe(groups.length);
    for (const spec of Object.values(PARAMS)) expect(spec.group === "Master" || groups.includes(spec.group), spec.label).toBe(true);
    for (const m of MODULES) if (m.toggle) expect(PARAMS[m.toggle]!.kind).toBe("toggle");
    expect(isBox("octave")).toBe(true);
    expect(isBox("cutoff")).toBe(false);
    expect(shortLabel("B level")).toBe("level");
    expect(shortLabel("Bright")).toBe("Bright");
  });
  it("the wave drawn on an oscillator panel comes from its harmonics and start phase", () => {
    const y = (path: string, i: number) => Number(path.split(" L")[i]!.split(" ")[1]);
    const sine = wavePath([0, 1], 0, 200, 64, 8);
    expect(y(sine, 2)).toBeLessThan(10); // a quarter of the way through, a sine is at its top (small y)
    expect(y(sine, 6)).toBeGreaterThan(54);
    const shifted = wavePath([0, 1], 0.5, 200, 64, 8);
    expect(y(shifted, 2)).toBeGreaterThan(54); // half a cycle later it is upside down
  });
});

import { adsr, envLevel, lfoValue, modDepth, routes, routesTo, SOURCES } from "../src/synth/mod";
import { ringSpan } from "../src/ui/synth/Controls";
import { envPath, lfoPath } from "../src/ui/synth/Rack";

describe("envelopes and LFOs", () => {
  it("the starting patch is unchanged by them: full sustain, nothing connected", () => {
    expect(adsr(INITIAL, 1).sustain).toBe(1);
    expect(routes(INITIAL)).toEqual([]);
    for (const l of LESSONS) for (const r of l.rounds ?? []) expect(routes({ ...INITIAL, ...r.from, ...r.target })).toEqual([]);
  });
  it("an envelope rises over the attack, eases to the sustain level, and fades after the note is let go", () => {
    const e = { attack: 0.1, decay: 0.4, sustain: 0.25, release: 0.2 };
    expect(envLevel(e, 0, 2)).toBe(0);
    expect(envLevel(e, 0.05, 2)).toBeCloseTo(0.5, 9);
    expect(envLevel(e, 0.1, 2)).toBeCloseTo(1, 9);
    expect(envLevel(e, 0.5, 2)).toBeGreaterThan(0.25);
    expect(envLevel(e, 0.5, 2)).toBeLessThan(0.27); // effectively at sustain once the decay time has passed
    expect(envLevel(e, 1.5, 2)).toBeCloseTo(0.25, 3);
    expect(envLevel(e, 2.2, 2)).toBeLessThan(0.01);
    expect(envLevel({ ...e, sustain: 1 }, 1, 2)).toBe(1);
  });
  it("LFO shapes swing between -1 and 1 and repeat every cycle", () => {
    expect(lfoValue("sine", 0.25)).toBeCloseTo(1, 9);
    expect(lfoValue("triangle", 0.25)).toBeCloseTo(1, 9);
    expect(lfoValue("triangle", 0.75)).toBeCloseTo(-1, 9);
    expect(lfoValue("square", 0.2)).toBe(1);
    expect(lfoValue("square", 0.7)).toBe(-1);
    expect(lfoValue("saw", 0.25)).toBeCloseTo(0.5, 9);
    for (const shape of ["sine", "triangle", "saw", "square"] as const) expect(lfoValue(shape, 1.3)).toBeCloseTo(lfoValue(shape, 0.3), 9);
  });
  it("a connection is a source with a destination; the amount sets how far it moves it", () => {
    const s: SynthState = { ...INITIAL, lfo1Dest: "cutoff", lfo1Amount: 50, lfo3Dest: "cutoff", lfo3Amount: 0, env2Dest: "fine", env2Amount: -100 };
    expect(routes(s).map((r) => `${r.source.id}>${r.dest}`)).toEqual(["env2>fine", "lfo1>cutoff", "lfo3>cutoff"]);
    expect(routesTo(s, "cutoff").map((r) => r.source.id)).toEqual(["lfo1"]); // a zero amount draws no ring
    expect(modDepth("cutoff", 50)).toBe(3000); // 2.5 octaves, in cents
    expect(modDepth("fine", -100)).toBe(-1200);
    expect(modDepth("aLevelDb", 80)).toBeCloseTo(0.8, 9);
    expect(new Set(SOURCES.map((x) => x.color)).size).toBe(SOURCES.length);
  });
  it("a knob's ring shows the stretch its source sweeps: both ways for an LFO, one way for an envelope", () => {
    expect(ringSpan(0.5, 40, "lfo")).toEqual([0.3, 0.7]);
    expect(ringSpan(0.5, -40, "lfo")).toEqual([0.3, 0.7]);
    expect(ringSpan(0.5, 40, "env")).toEqual([0.5, 0.7]);
    expect(ringSpan(0.5, -40, "env")).toEqual([0.3, 0.5]);
    expect(ringSpan(0.9, 100, "lfo")).toEqual([0.4, 1]);
  });
  it("the envelope and LFO pictures are drawn from the settings", () => {
    const ys = (path: string) => path.split(/[ML]/).filter(Boolean).map((p) => Number(p.trim().split(" ")[1]));
    const env = ys(envPath({ attack: 0.2, decay: 0.2, sustain: 0.5, release: 0.3 }));
    expect(env[0]).toBe(59); // starts at the bottom
    expect(Math.min(...env)).toBeLessThan(8); // reaches the top
    expect(env.at(-1)!).toBeGreaterThan(55); // and returns
    const sq = ys(lfoPath("square"));
    expect(new Set(sq).size).toBe(2);
  });
});
