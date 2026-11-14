import { describe, expect, it } from "vitest";
import { LESSONS } from "../src/course/lessons";
import type { Snapshot } from "../src/course/types";
import { harmonic, INITIAL, noteToHz, PARAMS, playedHz, dbToGain, type SynthState } from "../src/synth/params";
import { newTrack, snapshot, trackAllReleased, trackFlag, trackNoteOn, trackState } from "../src/synth/tracker";

const base = (over: Partial<Snapshot> = {}, state: Partial<SynthState> = {}, start: Partial<SynthState> = {}): Snapshot => ({
  state: { ...INITIAL, ...state }, start: { ...INITIAL, ...start }, audioRunning: true, held: [], played: { mouse: 0, keys: 0, midi: 0 },
  distinctNotes: 0, holdOn: false, heldSeconds: 0, longestHeld: 0, velocity: null, range: {}, changes: {}, flags: {}, lastNote: null, ...over,
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
    const panels = new Set(["start", "keyboard", "hold", "scope", "spectrum", "spectrogram", "meter", "beat", "curve", "envelope", "envelope2", "matrix", "ack", "macro1Name", "macro2Name", "macro3Name", "macro4Name", ...Object.keys(PARAMS)]);
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
    expect(s.longestHeld).toBe(3.5);
    expect(snapshot(trackAllReleased(t, 14), INITIAL, { audioRunning: true, held: [], holdOn: false, now: 20 }).longestHeld).toBe(4);
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
    expect(LESSONS.map((l) => l.id).slice(14, 22)).toEqual(["C2.1", "C2.2", "C2.3", "C2.4", "C2.5", "C2.6", "C2.7", "C2.C"]);
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
import { FX_MODULES, MACRO_MODULES, MOD_MODULES, MODULES, wavePath } from "../src/ui/synth/Rack";

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
    const groups = [...MODULES, ...MOD_MODULES, ...FX_MODULES, ...MACRO_MODULES].flatMap((m) => m.groups);
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
    const sine = wavePath([0, 1], 0, undefined, 200, 64, 8);
    expect(y(sine, 2)).toBeLessThan(10); // a quarter of the way through, a sine is at its top (small y)
    expect(y(sine, 6)).toBeGreaterThan(54);
    const shifted = wavePath([0, 1], 0.5, undefined, 200, 64, 8);
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

import { relatedLessons } from "../src/course/related";
import { shiftOctave, KEY_OCTAVES } from "../src/synth/useSynth";

describe("the guide points to lessons, and the keyboard shifts octaves", () => {
  it("a question about a topic finds the lesson that teaches it", () => {
    const ids = (q: string) => relatedLessons(q, LESSONS).map((l) => l.id);
    expect(ids("What does resonance do on the filter?")[0]).toBe("C2.2");
    expect(ids("how does unison work")[0]).toBe("C1.6");
    expect(ids("why do detuned oscillators sound like they are moving?")).toContain("C1.5");
    expect(ids("what is key tracking")[0]).toBe("C2.6");
    expect(ids("How do I automate the tempo of my track?")).toEqual([]);
    expect(ids("the of and")).toEqual([]);
    expect(relatedLessons("filter cutoff resonance slope drive", LESSONS).length).toBeLessThanOrEqual(2);
  });
  it("Z and X move the computer keyboard an octave at a time, within limits", () => {
    expect(shiftOctave(0, 1)).toBe(1);
    expect(shiftOctave(0, -1)).toBe(-1);
    expect(shiftOctave(KEY_OCTAVES, 1)).toBe(KEY_OCTAVES);
    expect(shiftOctave(-KEY_OCTAVES, -1)).toBe(-KEY_OCTAVES);
  });
});

import { CHAPTER_3 } from "../src/course/lessons/chapter3";
import { envPoints } from "../src/ui/synth/Views";

describe("chapter 3 lessons", () => {
  const st = (id: string, n: number) => LESSONS.find((l) => l.id === id)!.steps[n]!;
  const hit = { played: { mouse: 2, keys: 0, midi: 0 } };
  it("the envelope chapter follows the filters and starts from real settings", () => {
    expect(LESSONS.map((l) => l.id).slice(22, 29)).toEqual(["C3.1", "C3.2", "C3.3", "C3.4", "C3.5", "C3.6", "C3.C"]);
    for (const l of CHAPTER_3) for (const k of Object.keys(l.initial ?? {})) expect(k in INITIAL, `${l.id}: ${k}`).toBe(true);
    expect(placeOf(LESSONS.find((l) => l.id === "C3.4")!)).toEqual({ chapter: "Envelopes", number: 4, of: 7 });
  });
  it("C3.1 and C3.2: each stage is checked by its own setting, and shapes by all four", () => {
    expect(st("C3.1", 1).check(base(hit, { envA: 500 }))).toBe(true);
    expect(st("C3.1", 1).check(base(hit, { envA: 50 }))).toBe(false);
    expect(st("C3.1", 2).check(base(hit, { envA: 5, envS: 0, envD: 300 }))).toBe(true);
    expect(st("C3.1", 3).check(base({ longestHeld: 2.2 }, { envS: 50 }))).toBe(true); // still counts after the key is let go
    expect(st("C3.1", 4).remark!(base(hit, { envA: 5, envD: 300, envS: 50, envR: 1000 }))).toBe("Your envelope now: attack 5 ms, decay 300 ms, sustain 50%, release 1.00 s. Three times and one level.");
    expect(st("C3.1", 5).check(base({ ...hit, flags: { envelope: true } }))).toBe(true);
    expect(st("C3.2", 1).check(base(hit, { envS: 0, envD: 300, envR: 200 }))).toBe(true);
    expect(st("C3.2", 1).check(base(hit, { envS: 60, envD: 300, envR: 200 }))).toBe(false);
    expect(st("C3.2", 2).check(base(hit, { envA: 600, envS: 80, envR: 1200 }))).toBe(true);
  });
  it("C3.4 to C3.6: the envelope has to be sent to the right place, and the remark does the arithmetic", () => {
    expect(st("C3.4", 1).check(base(hit, { env2Dest: "cutoff" }))).toBe(true);
    expect(st("C3.4", 1).check(base(hit, { env2Dest: "fine" }))).toBe(false);
    expect(st("C3.4", 5).check(base(hit, { cutoff: 2000, env2Amount: -40 }))).toBe(true);
    expect(st("C3.5", 1).remark!(base(hit, { env2Amount: 100, env2D: 60 }))).toBe("At 100% each note starts 12 semitones high and falls in 60 ms.");
    expect(st("C3.5", 3).check(base(hit, { bOn: true, env2Dest: "bFine", env2Amount: 60 }))).toBe(true);
    expect(st("C3.6", 1).check(base(hit, { filterType: "high" }))).toBe(true);
    expect(st("C3.6", 3).check(base(hit, { filterType: "band", cutoff: 1000, env2Amount: -30 }))).toBe(true);
  });
  it("times are matched by ear as ratios: within double or half", () => {
    expect(compareSetting("envA", { ...INITIAL, envA: 900 }, { envA: 500 })).toBe("match");
    expect(compareSetting("envA", { ...INITIAL, envA: 1200 }, { envA: 500 })).toBe("too high");
    expect(compareSetting("envR", { ...INITIAL, envR: 100 }, { envR: 1500 })).toBe("too low");
    expect(compareSetting("env2Amount", { ...INITIAL, env2Amount: 70 }, { env2Amount: 85 })).toBe("match");
    expect(compareSetting("env2Amount", { ...INITIAL, env2Amount: 60 }, { env2Amount: -60 })).toBe("too high");
  });
  it("the draggable envelope's points follow the settings in order: attack, decay and sustain, release", () => {
    const quick = envPoints({ ...INITIAL, envA: 1, envD: 1, envS: 100, envR: 1 }, 1);
    const slow = envPoints({ ...INITIAL, envA: 5000, envD: 5000, envS: 0, envR: 5000 }, 1);
    expect(slow.a.x).toBeGreaterThan(quick.a.x);
    expect(slow.d.y).toBe(slow.bottom); // no sustain: the middle point sits on the floor
    expect(quick.d.y).toBe(quick.top);
    for (const p of [quick, slow]) { expect(p.a.x).toBeLessThanOrEqual(p.d.x); expect(p.d.x).toBeLessThan(p.held.x); expect(p.held.x).toBeLessThanOrEqual(p.r.x); expect(p.r.x).toBeLessThanOrEqual(320); }
  });
});

import { CHAPTER_4 } from "../src/course/lessons/chapter4";

describe("chapter 4 lessons", () => {
  const st = (id: string, n: number) => LESSONS.find((l) => l.id === id)!.steps[n]!;
  it("the LFO chapter follows the envelopes and starts from real settings", () => {
    expect(LESSONS.map((l) => l.id).slice(29, 36)).toEqual(["C4.1", "C4.2", "C4.3", "C4.4", "C4.5", "C4.6", "C4.C"]);
    for (const l of CHAPTER_4) for (const k of Object.keys(l.initial ?? {})) expect(k in INITIAL, `${l.id}: ${k}`).toBe(true);
    expect(placeOf(LESSONS.find((l) => l.id === "C4.2")!).chapter).toBe("LFOs");
  });
  it("steps check where the LFO is sent as well as its settings, and remarks do the arithmetic", () => {
    expect(st("C4.1", 2).check(base({}, { lfo1Dest: "aLevelDb", lfo1Rate: 0.5 }))).toBe(true);
    expect(st("C4.1", 2).check(base({}, { lfo1Dest: "none", lfo1Rate: 0.5 }))).toBe(false);
    expect(st("C4.1", 4).check(base({ changes: { lfo1Shape: 3 } }, { lfo1Shape: "saw", lfo1Rate: 2 }))).toBe(true);
    expect(st("C4.1", 4).check(base({ changes: { lfo1Shape: 1 } }, { lfo1Shape: "saw", lfo1Rate: 2 }))).toBe(false);
    expect(st("C4.2", 2).remark!(base({}, { lfo1Dest: "cutoff", lfo1Amount: 60 }))).toBe("At 60% the cutoff swings about 3.0 octaves either side of where the knob is set.");
    expect(st("C4.3", 2).check(base({}, { lfo1Dest: "fine", lfo1Amount: 3 }))).toBe(true);
    expect(st("C4.3", 2).check(base({}, { lfo1Dest: "fine", lfo1Amount: 30 }))).toBe(false);
    expect(st("C4.3", 2).remark!(base({}, { lfo1Dest: "fine", lfo1Amount: 3 }))).toMatch(/^3% is about 36 cents each way/);
    expect(st("C4.3", 4).check(base({}, { lfo1Dest: "fine", lfo1Amount: 2, lfo2Dest: "aLevelDb" }))).toBe(true);
  });
  it("rates are matched as ratios and destinations exactly", () => {
    expect(compareSetting("lfo1Rate", { ...INITIAL, lfo1Rate: 4 }, { lfo1Rate: 6 })).toBe("match");
    expect(compareSetting("lfo1Rate", { ...INITIAL, lfo1Rate: 1 }, { lfo1Rate: 6 })).toBe("too low");
    expect(compareSetting("lfo1Dest", { ...INITIAL, lfo1Dest: "aLevelDb" }, { lfo1Dest: "fine" })).toBe("different");
  });
});

import { CHAPTER_5 } from "../src/course/lessons/chapter5";

describe("chapter 5: routes, direction, and modulating a modulator", () => {
  const st = (id: string, n: number) => LESSONS.find((l) => l.id === id)!.steps[n]!;
  it("the modulation chapter follows the LFOs and starts from real settings", () => {
    expect(LESSONS.map((l) => l.id).slice(36, 45)).toEqual(["C5.1", "C5.2", "C5.3", "C5.4", "C5.5", "C5.6", "C5.7", "C5.8", "C5.C"]);
    for (const l of CHAPTER_5) for (const k of Object.keys(l.initial ?? {})) expect(k in INITIAL, `${l.id}: ${k}`).toBe(true);
  });
  it("an LFO set to one way pushes one side only, like an envelope; both ways is the default", () => {
    const s: SynthState = { ...INITIAL, lfo1Dest: "fine", lfo1Amount: 20, lfo2Dest: "cutoff", lfo2Way: "up", env2Dest: "cutoff" };
    expect(routes(s).map((r) => [r.source.id, r.oneWay])).toEqual([["env2", true], ["lfo1", false], ["lfo2", true]]);
    expect(modDepth("lfo1Rate", 50)).toBe(1200); // one octave of speed, in cents
  });
  it("steps check the wiring, and remarks list or compute it", () => {
    expect(st("C5.1", 1).check(base({}, { lfo1Dest: "cutoff", lfo1Amount: 0 }))).toBe(true);
    const three = base({ played: { mouse: 1, keys: 0, midi: 0 } }, { lfo1Dest: "cutoff", lfo1Amount: 40, lfo3Dest: "cutoff", env2Dest: "cutoff" });
    expect(st("C5.1", 5).check(three)).toBe(true);
    expect(st("C5.1", 5).remark!(three)).toBe("Your routes: Env 2 to filter cutoff at 50%; LFO 1 to filter cutoff at 40%; LFO 3 to filter cutoff at 30%. Listed like that, it is what Serum calls the mod matrix.");
    expect(st("C5.2", 2).check(base({}, { lfo1Dest: "fine", lfo1Way: "up", lfo1Shape: "square", lfo1Rate: 2, lfo1Amount: 17 }))).toBe(true);
    expect(st("C5.2", 2).check(base({}, { lfo1Dest: "fine", lfo1Way: "both", lfo1Shape: "square", lfo1Rate: 2, lfo1Amount: 17 }))).toBe(false);
    expect(st("C5.2", 2).remark!(base({}, { lfo1Amount: 17 }))).toMatch(/^17% of 12 semitones is about 2\.0 semitones\./);
    const modmod = base({}, { lfo1Rate: 3, lfo2Dest: "lfo1Rate", lfo2Rate: 0.3, lfo2Amount: 50 });
    expect(st("C5.6", 1).check(base({}, { lfo2Dest: "lfo1Rate", lfo2Rate: 0.3, lfo2Amount: 60 }))).toBe(true);
    expect(st("C5.6", 1).remark!(modmod)).toContain("about 1.0 octaves either side of its setting: from roughly 1.5 to 6 wobbles a second");
  });
});

import { MACRO_CHAPTER } from "../src/course/lessons/macros";
import { applyMacros, macroSlots, slotsTo } from "../src/synth/macros";
import { keyValue, noteLevelBase, velocityValue } from "../src/synth/mod";
import { MACRO_DESTS } from "../src/synth/params";
import { clickVelocity, shiftVelocity } from "../src/synth/useSynth";
import { CHAPTER_ORDER } from "../src/course/lessons";

describe("macros", () => {
  const bite: SynthState = { ...INITIAL, filterOn: true, cutoff: 400, resonance: 10, macro1Dest1: "cutoff", macro1Amt1: 20, macro1Dest2: "resonance", macro1Amt2: 50 };
  it("a macro at zero changes nothing; turned up, it pushes each knob along its travel by its slot's amount", () => {
    expect(applyMacros(bite)).toBe(bite);
    const full = applyMacros({ ...bite, macro1: 100 });
    expect(full.cutoff / 400).toBeCloseTo(4, 1); // 20% of a ten-octave knob is two octaves
    expect(full.resonance).toBe(60);
    const half = applyMacros({ ...bite, macro1: 50 });
    expect(half.cutoff / 400).toBeCloseTo(2, 1);
    expect(half.resonance).toBe(35);
    expect(applyMacros({ ...bite, macro1: 100, macro1Amt1: -100 }).cutoff).toBe(20); // never past the end of the knob
    expect(half.macro1).toBe(50); // the macro itself and everything else are untouched
    expect(half.volumeDb).toBe(INITIAL.volumeDb);
  });
  it("two macros on one knob add, and a slot with no destination or no amount is ignored", () => {
    const two = applyMacros({ ...bite, macro1: 100, macro2: 100, macro2Dest1: "resonance", macro2Amt1: 20, macro3Dest1: "nonsense", macro3: 100 });
    expect(two.resonance).toBe(80);
    expect(macroSlots({ ...bite, macro3Dest1: "nonsense" }).map((m) => m.dest)).toEqual(["cutoff", "resonance"]);
    expect(slotsTo({ ...bite, macro1Amt1: 0 }, "cutoff")).toEqual([]);
    expect(slotsTo(bite, "cutoff")[0]!.name).toBe("Macro 1");
  });
  it("a macro can reach any continuous knob, but not whole-step boxes or other macros", () => {
    for (const id of ["cutoff", "position", "lfo1Rate", "lfo1Amount", "envA", "noiseLevelDb", "velAmount"]) expect(MACRO_DESTS, id).toContain(id);
    for (const id of ["octave", "voices", "macro1", "macro2Amt1", "shape", "filterOn", "freeHz"]) expect(MACRO_DESTS, id).not.toContain(id);
    expect(MACRO_DESTS[0]).toBe("none");
  });
  it("the macro chapter is listed after Modulation, and every recipe wires what it teaches", () => {
    expect(CHAPTER_ORDER.map((c) => CHAPTERS[c])).toEqual(["Sound itself", "Oscillators", "Filters", "Envelopes", "LFOs", "Modulation", "Macros", "Reshaping the wave", "Effects", "Impacts"]);
    expect(new Set(LESSONS.map((l) => chapterOf(l))).size).toBe(CHAPTER_ORDER.length);
    expect(MACRO_CHAPTER.map((l) => l.id)).toEqual(["C5M.1", "C5M.2", "C5M.3", "C5M.4", "C5M.5", "C5M.6", "C5M.7", "C5M.8", "C5M.9", "C5M.10", "C5M.11", "C5M.12", "C5M.13", "C5M.14", "C5M.15", "C5M.16", "C5M.C"]);
    for (const l of MACRO_CHAPTER.slice(0, 7)) {
      // the finished macro, as the demo plays it, really changes the sound between zero and full
      const [zero, , top] = l.demo!.tones.map((t) => applyMacros({ ...INITIAL, ...t.patch }));
      expect(JSON.stringify(zero) === JSON.stringify({ ...top, macro1: 0 }), l.id).toBe(false);
      expect(l.steps.at(-3)!.do, l.id).toMatch(/^Give the macro a name/);
    }
  });
  it("a recipe's steps check the slot, the name, the sweep and the parked position, and the remark lists what moved", () => {
    const l = MACRO_CHAPTER[0]!, wired = { filterOn: true, cutoff: 400, resonance: 10, macro1Dest1: "cutoff", macro1Amt1: 35, macro1Dest2: "resonance", macro1Amt2: 45, macro1Name: "Bite" } as Partial<SynthState>;
    expect(l.steps[1]!.check(base({}, { macro1Dest1: "cutoff", macro1Amt1: 40 }))).toBe(true);
    expect(l.steps[1]!.check(base({}, { macro1Dest1: "resonance", macro1Amt1: 40 }))).toBe(false);
    expect(l.steps[3]!.check(base({}, { macro1Name: "Bite" }))).toBe(true);
    expect(l.steps[3]!.check(base({}, { macro1Name: "  " }))).toBe(false);
    expect(l.steps[4]!.check(base({ range: { macro1: { min: 0, max: 100 } } }, wired))).toBe(true);
    expect(l.steps[4]!.check(base({ range: { macro1: { min: 0, max: 60 } } }, wired))).toBe(false);
    const parked = base({ changes: { macro1: 4 } }, { ...wired, macro1: 50 });
    expect(l.steps[5]!.check(parked)).toBe(true);
    expect(l.steps[5]!.remark!(parked)).toMatch(/^“Bite” at 50% has moved Cutoff from 400 Hz to 1\.3\d kHz, Resonance from 10% to 33%\. One knob, 2 changes\.$/);
  });
});

describe("velocity and key position", () => {
  it("velocity runs 0 to 1, key position -1 to 1 around middle C", () => {
    expect(velocityValue(127)).toBe(1);
    expect(velocityValue(64)).toBeCloseTo(0.5, 2);
    expect(keyValue(60)).toBe(0);
    expect(keyValue(84)).toBe(1);
    expect(keyValue(36)).toBe(-1);
    expect(keyValue(120)).toBe(1);
  });
  it("velocity is a one-way source, and sent to Note level it turns soft notes down, not hard notes up", () => {
    const s: SynthState = { ...INITIAL, velDest: "noteLevel", velAmount: 60, keyDest: "cutoff" };
    expect(routes(s).map((r) => [r.source.id, r.oneWay])).toEqual([["vel", true], ["key", false]]);
    expect(noteLevelBase(s)).toBeCloseTo(0.4, 9); // softest possible note; a full-velocity note adds the 0.6 back
    expect(noteLevelBase(INITIAL)).toBe(1);
    expect(noteLevelBase({ ...s, velAmount: -60 })).toBe(1);
  });
  it("clicking lower on a key strikes harder, and C and V step the letter keys' velocity within limits", () => {
    expect(clickVelocity(0)).toBe(20);
    expect(clickVelocity(1)).toBe(127);
    expect(clickVelocity(0.5)).toBeGreaterThan(60);
    expect(shiftVelocity(100, 1)).toBe(120);
    expect(shiftVelocity(120, 1)).toBe(127);
    expect(shiftVelocity(127, -1)).toBe(120);
    expect(shiftVelocity(20, -1)).toBe(20);
  });
  it("C5.3 needs a soft and a hard note, with velocity sent where the step says", () => {
    const st = (n: number) => LESSONS.find((l) => l.id === "C5.3")!.steps[n]!;
    expect(st(0).check(base({ velocity: { min: 30, max: 120 } }))).toBe(true);
    expect(st(0).check(base({ velocity: { min: 90, max: 120 } }))).toBe(false);
    expect(st(1).check(base({ velocity: { min: 30, max: 120 } }, { velDest: "noteLevel" }))).toBe(true);
    expect(st(2).check(base({ velocity: { min: 30, max: 120 } }, { velDest: "noteLevel" }))).toBe(false);
    expect(st(4).check(base({ distinctNotes: 2 }, { keyDest: "noteLevel", keyAmount: -40 }))).toBe(true);
  });
});

import { fallShape } from "../src/synth/mod";

describe("envelope hold and fall", () => {
  it("hold keeps the level at the top before the decay starts", () => {
    const e = { attack: 0.1, hold: 0.2, decay: 0.4, sustain: 0, release: 0.2 };
    expect(envLevel(e, 0.1, 5)).toBeCloseTo(1, 9);
    expect(envLevel(e, 0.25, 5)).toBe(1);
    expect(envLevel(e, 0.3, 5)).toBeCloseTo(1, 9);
    expect(envLevel(e, 0.5, 5)).toBeLessThan(0.2);
  });
  it("the three falls take the same time but spend it differently, as the lesson's remark says", () => {
    expect(fallShape("straight", 0.25, 0.5)).toBeCloseTo(0.5, 9);
    expect(fallShape("eased", 0.25, 0.5)).toBeCloseTo(0.135, 2); // about an eighth
    expect(fallShape("sharp", 0.25, 0.5)).toBeCloseTo(0.011, 2); // about a hundredth
    expect(fallShape("straight", 0.6, 0.5)).toBe(0);
    for (const bend of ["straight", "eased", "sharp"] as const) expect(fallShape(bend, 0, 0.5)).toBe(1);
    expect(envLevel({ attack: 0.01, decay: 0.5, sustain: 0, release: 0.3, bend: "straight" }, 0.26, 5)).toBeCloseTo(0.5, 2);
  });
  it("the starting patch has no hold and the eased fall it always had", () => {
    expect(adsr(INITIAL, 1)).toMatchObject({ hold: 0, bend: "eased" });
    const st = (n: number) => LESSONS.find((l) => l.id === "C3.3")!.steps[n]!;
    expect(st(1).check(base({ played: { mouse: 2, keys: 0, midi: 0 } }, { envBend: "straight" }))).toBe(true);
    expect(st(3).check(base({ played: { mouse: 2, keys: 0, midi: 0 } }, { envBend: "sharp", envH: 200 }))).toBe(true);
    expect(st(4).remark!(base({}, { envBend: "sharp", envH: 200 }))).toBe("You chose a sharp fall with 200 ms of hold.");
  });
});

import { beatsOf, lfoCoefficients, lfoHz, lfoStartPhase } from "../src/synth/mod";

describe("LFO tempo sync, start mode and drawn shapes", () => {
  it("a synced LFO's speed comes from the tempo and the division, and ignores the Rate knob", () => {
    const s: SynthState = { ...INITIAL, bpm: 120, lfo1Rate: 7, lfo1Sync: "beat", lfo1Div: "1" };
    expect(lfoHz(s, "lfo1")).toBe(2);
    expect(lfoHz({ ...s, lfo1Div: "1/2" }, "lfo1")).toBe(4);
    expect(lfoHz({ ...s, lfo1Div: "4" }, "lfo1")).toBe(0.5);
    expect(lfoHz({ ...s, bpm: 90, lfo1Div: "1/3" }, "lfo1")).toBeCloseTo(4.5, 9);
    expect(lfoHz({ ...s, lfo1Sync: "hz" }, "lfo1")).toBe(7);
    expect(beatsOf("1/4")).toBe(0.25);
  });
  it("Restart always begins the shape; Free begins wherever the clock has got to", () => {
    const s: SynthState = { ...INITIAL, bpm: 60, lfo1Sync: "beat", lfo1Div: "1" };
    expect(lfoStartPhase(s, "lfo1", 12.75)).toBe(0);
    expect(lfoStartPhase({ ...s, lfo1Trig: "free" }, "lfo1", 12.75)).toBeCloseTo(0.75, 9);
    expect(lfoStartPhase({ ...s, lfo1Trig: "free" }, "lfo1", 13)).toBeCloseTo(0, 9); // on the beat
  });
  it("a drawn shape plays its steps in order, and its harmonics rebuild exactly that staircase", () => {
    const steps = [1, 1, -1, -1, 0.5, -1, 1, -1, 1, 1, -1, 0, 0.5, -0.5, 1, -1];
    expect(lfoValue("drawn", 0, steps)).toBe(1);
    expect(lfoValue("drawn", 2.5 / 16, steps)).toBe(-1);
    expect(lfoValue("drawn", 1 + 4.5 / 16, steps)).toBe(0.5);
    const c = lfoCoefficients("drawn", steps);
    const rebuilt = (x: number) => { let y = c.mean; for (let n = 1; n < c.sin.length; n++) y += c.sin[n]! * Math.sin(2 * Math.PI * n * x) + c.cos[n]! * Math.cos(2 * Math.PI * n * x); return y; };
    for (const k of [0, 2, 4, 11, 13]) expect(rebuilt((k + 0.5) / 16)).toBeCloseTo(steps[k]!, 1);
    expect(c.mean).toBeCloseTo(steps.reduce((a, b) => a + b, 0) / 16, 9);
    // the basic shapes rebuild too, at full height
    const sq = lfoCoefficients("square");
    let top = 0; for (let n = 1; n < sq.sin.length; n++) top += sq.sin[n]! * Math.sin(2 * Math.PI * n * 0.25);
    expect(top).toBeCloseTo(1, 2);
  });
  it("the new LFO lessons check sync, start mode, rise and the drawing", () => {
    const st = (id: string, n: number) => LESSONS.find((l) => l.id === id)!.steps[n]!;
    expect(st("C4.4", 1).check(base({}, { lfo1Sync: "beat", lfo1Div: "1" }))).toBe(true);
    expect(st("C4.4", 4).check(base({ range: { bpm: { min: 80, max: 160 } } }, { lfo1Div: "1" }))).toBe(true);
    expect(st("C4.4", 4).remark!(base({}, { bpm: 120 }))).toMatch(/^At 120 beats a minute, one beat lasts 0\.50 seconds, so the wobble is running at 2\.00 cycles a second\./);
    expect(st("C4.5", 1).check(base({ played: { mouse: 4, keys: 0, midi: 0 } }, { lfo1Trig: "free" }))).toBe(true);
    expect(st("C4.5", 3).check(base({ longestHeld: 2.5 }, { lfo1Rise: 1000 }))).toBe(true);
    const drawn = [1, 1, -1, -1, 1, -1, 1, -1, 0, 0, -1, 0, 0.5, -0.5, 0, -1];
    expect(st("C4.6", 3).check(base({}, { lfo1Shape: "drawn", lfo1Steps: drawn }))).toBe(true);
    expect(st("C4.6", 3).check(base({}, { lfo1Shape: "drawn", lfo1Steps: drawn.map(() => 0) }))).toBe(false);
    expect(st("C4.6", 3).remark!(base({}, { lfo1Shape: "drawn", lfo1Steps: drawn }))).toContain("x x . . x . x . . . . . . . . .");
  });
});

import { CHAPTER_6 } from "../src/course/lessons/chapter6";
import { fmIndex, MOD_DESTS, spectrumA, warpPhase, WARPS } from "../src/synth/params";
describe("warp, FM and ring modulation", () => {
  const power = (s: Partial<SynthState>) => { const sp = spectrumA({ ...INITIAL, ...s }); return Array.from(sp.sin, (x, n) => x * x + sp.cos[n]! ** 2); };
  it("every warp mode leaves the wave alone at an amount of zero and stays inside the cycle", () => {
    for (const mode of WARPS) for (const p of [0, 0.1, 0.37, 0.5, 0.9]) {
      expect(warpPhase(mode, 0, p)).toBeCloseTo(p, 9);
      for (const amount of [25, 60, 100]) { const x = warpPhase(mode, amount, p); expect(x).toBeGreaterThanOrEqual(0); expect(x).toBeLessThanOrEqual(1); }
    }
    expect(spectrumA({ ...INITIAL, warp: "sync", warpAmount: 0 }).cos.every((c) => c === 0)).toBe(true);
  });
  it("sync at full plays a sine four times in a cycle, and at a third exactly twice", () => {
    const full = power({ shape: "sine", warp: "sync", warpAmount: 100 });
    expect(full[4]! / full.reduce((a, b) => a + b, 0)).toBeGreaterThan(0.999);
    expect(warpPhase("sync", 100 / 3, 0.75)).toBeCloseTo(0.5, 6);
  });
  it("a fully mirrored saw is a triangle (odd harmonics only), and a squeezed square gains even ones", () => {
    const tri = power({ shape: "saw", warp: "mirror", warpAmount: 100 });
    expect(tri[2]! / tri[1]!).toBeLessThan(1e-6);
    expect(tri[3]! / tri[1]!).toBeGreaterThan(0.009); expect(tri[3]! / tri[1]!).toBeLessThan(0.014); // a triangle's third harmonic is a ninth of its first
    expect(power({ shape: "square" })[2]).toBe(0);
    const pulse = power({ shape: "square", warp: "pd", warpAmount: 50 });
    expect(pulse[2]! / pulse[1]!).toBeGreaterThan(0.05);
  });
  it("bending a sine adds harmonics without changing which is the lowest", () => {
    const bent = power({ shape: "sine", warp: "bend", warpAmount: 70 });
    expect(bent[1]).toBeGreaterThan(bent[2]!);
    expect(bent[2]).toBeGreaterThan(0.01);
  });
  it("FM amount is an index, reachable by sources and macros; ring amount by macros", () => {
    expect(fmIndex(0)).toBe(0); expect(fmIndex(30)).toBeCloseTo(2.4, 9);
    expect(MOD_DESTS).toContain("fmAmount");
    expect(modDepth("fmAmount", 100)).toBe(0.5);
    for (const id of ["warpAmount", "fmAmount", "ringAmount"]) expect(MACRO_DESTS).toContain(id);
  });
  it("the chapter follows the macros, and its steps check the setting they teach", () => {
    expect(CHAPTER_6.map((l) => l.id)).toEqual(["C6.1", "C6.2", "C6.3", "C6.4", "C6.5", "C6.C"]);
    expect(LESSONS.findIndex((l) => l.id === "C6.1")).toBeGreaterThan(LESSONS.findIndex((l) => l.id === "C5M.C"));
    const snap = (state: Partial<SynthState>, extra: Partial<Snapshot> = {}) => ({ ...snapshot(newTrack(INITIAL), { ...INITIAL, ...state }, { audioRunning: true, held: [57], holdOn: true, now: 0 }), ...extra }) as Snapshot;
    const fm = CHAPTER_6[3]!, ring = CHAPTER_6[4]!;
    expect(fm.steps[5]!.check(snap({ env2Dest: "fmAmount", env2Amount: 70 }, { played: { mouse: 1, keys: 0, midi: 0 } }))).toBe(true);
    expect(fm.steps[5]!.check(snap({ env2Dest: "cutoff", env2Amount: 70 }, { played: { mouse: 1, keys: 0, midi: 0 } }))).toBe(false);
    expect(ring.steps[1]!.remark!(snap({ ringAmount: 100, bSemitone: 7 }, { lastNote: 69 }))).toContain("1099 Hz");
    expect(CHAPTER_6[0]!.steps[3]!.remark!(snap({ shape: "saw", warp: "mirror", warpAmount: 100 }))).toContain("39%");
  });
});

import { IMPACT_CHAPTER } from "../src/course/lessons/impacts";
import { WIDE_SEMITONES } from "../src/synth/mod";
describe("impact lessons", () => {
  const snap = (state: Partial<SynthState>, extra: Partial<Snapshot> = {}) => ({ ...snapshot(newTrack(INITIAL), { ...INITIAL, ...state }, { audioRunning: true, held: [], holdOn: false, now: 0 }), ...extra }) as Snapshot;
  const played = { played: { mouse: 3, keys: 0, midi: 0 } };
  it("the wide pitch destination moves four octaves at 100%", () => {
    expect(WIDE_SEMITONES).toBe(48);
    expect(modDepth("aPitchWide", 100)).toBe(4800);
    expect(modDepth("aPitchWide", 25)).toBe(1200);
    expect(MOD_DESTS).toContain("aPitchWide");
  });
  it("the chapter comes last, is named Impacts, and makes no claim about a named artist", () => {
    expect(IMPACT_CHAPTER.map((l) => l.id)).toEqual(["CT.1", "CT.2", "CT.3", "CT.4", "CT.5", "CT.6", "CT.C"]);
    expect(placeOf(IMPACT_CHAPTER[1]!)).toEqual({ chapter: "Impacts", number: 2, of: 7 });
    for (const l of IMPACT_CHAPTER) expect([l.outcome, ...l.idea, ...l.recap, ...l.steps.flatMap((s) => [s.do, s.hear])].join(" ")).not.toMatch(/Tipper|brain/i);
  });
  it("a kick needs the envelope on the wide pitch destination, and the remark gives where the pitch starts and lands", () => {
    const kick = IMPACT_CHAPTER[1]!;
    expect(kick.steps[1]!.check(snap({ env2Dest: "aPitchWide", env2Amount: 50 }, played))).toBe(true);
    expect(kick.steps[1]!.check(snap({ env2Dest: "fine", env2Amount: 50 }, played))).toBe(false);
    expect(kick.steps[1]!.remark!(snap({ ...kick.initial, env2Dest: "aPitchWide", env2Amount: 50 }, { ...played, lastNote: 57 }))).toContain("about 220 Hz, falling to 55 Hz");
    expect(kick.steps[2]!.check(snap({ env2Dest: "aPitchWide", env2S: 0, env2D: 60, env2Bend: "sharp" }, played))).toBe(true);
    expect(kick.steps[2]!.check(snap({ env2Dest: "aPitchWide", env2S: 0, env2D: 400, env2Bend: "sharp" }, played))).toBe(false);
  });
});

import { CHAPTER_7 } from "../src/course/lessons/chapter7";
import { compAutoMakeupCancelDb, compReductionDb, crushLevels, delaySeconds, distCurve, distGain, distort, distTrim, echoesToSilence, FX_ORDER, reverbImpulse } from "../src/synth/fx";
describe("effects", () => {
  it("everything is off to begin with, and each effect has a switch", () => {
    for (const id of FX_ORDER) { expect(INITIAL[`${id}On`]).toBe(false); expect(PARAMS[`${id}On`]!.kind).toBe("toggle"); }
    expect(FX_MODULES.map((m) => m.name)).toEqual(["Distortion", "EQ", "Compressor", "Chorus", "Delay", "Reverb"]);
  });
  it("soft clip bends, hard clip cuts flat, fold turns back, crush rounds to steps; all stay within full level", () => {
    expect(distGain(0)).toBe(1); expect(distGain(100)).toBe(32);
    expect(distort("hard", 0, 0.5)).toBe(0.5);
    expect(distort("hard", 100, 0.5)).toBe(1);
    expect(distort("soft", 100, 0.5)).toBeGreaterThan(0.99);
    expect(distort("soft", 0, 0.1)).toBeCloseTo(Math.tanh(0.1), 9);
    // folded: 0.5 turned up 3 times is 1.5, which is turned back to 0.5
    expect(distort("fold", (2 / 31) * 100, 0.5)).toBeCloseTo(0.5, 6);
    expect(crushLevels(0)).toBe(64); expect(crushLevels(100)).toBe(1);
    expect(distort("crush", 100, 0.4)).toBe(0); expect(distort("crush", 100, 0.6)).toBe(1);
    for (const type of ["soft", "hard", "fold", "crush"] as const) {
      const c = distCurve(type, 70);
      expect(Math.max(...c)).toBeLessThanOrEqual(1); expect(Math.min(...c)).toBeGreaterThanOrEqual(-1);
      expect(c[(c.length - 1) / 2]).toBeCloseTo(0, 9);
      expect(c[10]).toBeCloseTo(-c[c.length - 11]!, 6); // the same both sides of zero
    }
    expect(distTrim("soft", 0)).toBe(1); expect(distTrim("soft", 100)).toBeLessThan(0.2); expect(distTrim("crush", 100)).toBe(1);
  });
  it("delay time is the knob, or a division of the beat; feedback sets how many echoes", () => {
    expect(delaySeconds({ delaySync: "ms", delayDiv: "1/2", delayTime: 300, bpm: 120 })).toBeCloseTo(0.3, 9);
    expect(delaySeconds({ delaySync: "beat", delayDiv: "1/2", delayTime: 300, bpm: 120 })).toBeCloseTo(0.25, 9);
    expect(delaySeconds({ delaySync: "beat", delayDiv: "1", delayTime: 300, bpm: 90 })).toBeCloseTo(2 / 3, 9);
    expect(echoesToSilence(0)).toBe(1); expect(echoesToSilence(50)).toBe(10); expect(echoesToSilence(75)).toBe(25);
  });
  it("the reverb's impulse dies away to a thousandth after its size, and is the same every time", () => {
    const [l, r] = reverbImpulse(1, 8000);
    const rms = (x: Float32Array, from: number) => Math.sqrt(x.slice(from, from + 400).reduce((s, v) => s + v * v, 0) / 400);
    expect(20 * Math.log10(rms(l, 7600) / rms(l, 0))).toBeGreaterThan(-63);
    expect(20 * Math.log10(rms(l, 7600) / rms(l, 0))).toBeLessThan(-50);
    expect(l[100]).not.toBe(r[100]);
    expect(reverbImpulse(1, 8000)[0][100]).toBe(l[100]);
  });
  it("the compressor's hidden boost is cancelled, so it only turns down until make-up is added", () => {
    expect(compAutoMakeupCancelDb(0, 4)).toBeCloseTo(0, 9);
    expect(compAutoMakeupCancelDb(-40, 20)).toBeCloseTo(-22.8, 6);
    expect(compAutoMakeupCancelDb(-40, 1)).toBeCloseTo(0, 9);
    expect(compReductionDb(16, 8)).toBe(14); expect(compReductionDb(-3, 8)).toBe(0);
  });
  it("the chapter sits between Reshaping the wave and Impacts, and its steps check the effect they teach", () => {
    expect(CHAPTER_7.map((l) => l.id)).toEqual(["C7.1", "C7.2", "C7.3", "C7.4", "C7.5", "C7.6", "C7.C"]);
    expect(CHAPTER_ORDER.indexOf("7")).toBe(CHAPTER_ORDER.indexOf("6") + 1);
    const snap = (state: Partial<SynthState>, extra: Partial<Snapshot> = {}) => ({ ...snapshot(newTrack(INITIAL), { ...INITIAL, ...state }, { audioRunning: true, held: [57], holdOn: true, now: 0 }), ...extra }) as Snapshot;
    expect(CHAPTER_7[0]!.steps[1]!.check(snap({ distOn: true }))).toBe(true);
    expect(CHAPTER_7[0]!.steps[1]!.check(snap({ distOn: false }))).toBe(false);
    expect(CHAPTER_7[4]!.steps[2]!.remark!(snap({ delayOn: true, delayFeedback: 75, delayTime: 300 }))).toContain("25 echoes, 7.5 seconds");
    expect(CHAPTER_7[2]!.steps[1]!.check(snap({ compOn: true, compThreshold: -40, compRatio: 8 }, { velocity: { min: 30, max: 120 } }))).toBe(true);
    expect(CHAPTER_7[2]!.steps[1]!.check(snap({ compOn: true, compThreshold: -40, compRatio: 8 }, { velocity: { min: 100, max: 120 } }))).toBe(false);
  });
});

import { routeLayout } from "../src/synth/mod";
import { MATRIX_MAX } from "../src/synth/params";
describe("the matrix", () => {
  const row = (source: "env2" | "lfo1" | "lfo2" | "vel" | "key", dest: SynthState["lfo1Dest"], amount = 30, way: "both" | "up" = "both") => ({ source, dest, amount, way });
  it("starts empty, and a row adds a second connection for the same source", () => {
    expect(INITIAL.matrix).toEqual([]);
    expect(MATRIX_MAX).toBe(8);
    const s = { ...INITIAL, lfo1Dest: "cutoff" as const, matrix: [row("lfo1", "fine", 5), row("lfo1", "none")] };
    expect(routes(s).map((r) => [r.key, r.source.id, r.dest, r.amount])).toEqual([["lfo1", "lfo1", "cutoff", 30], ["m0", "lfo1", "fine", 5]]);
    expect(routesTo(s, "fine").map((r) => r.key)).toEqual(["m0"]);
  });
  it("a row's direction follows its own switch for an LFO, and the source's nature otherwise", () => {
    const s = { ...INITIAL, matrix: [row("lfo1", "fine", 30, "up"), row("lfo1", "cutoff"), row("env2", "cutoff", 30, "both"), row("vel", "cutoff"), row("key", "cutoff")] };
    expect(routes(s).map((r) => r.oneWay)).toEqual([true, false, true, true, false]);
  });
  it("notes are rebuilt when a connection appears, moves or goes, but not when only an amount changes", () => {
    const a = { ...INITIAL, matrix: [row("lfo1", "fine", 5)] };
    expect(routeLayout({ ...a, matrix: [row("lfo1", "fine", 60)] })).toBe(routeLayout(a));
    expect(routeLayout({ ...a, matrix: [row("lfo1", "cutoff", 5)] })).not.toBe(routeLayout(a));
    expect(routeLayout({ ...a, matrix: [row("lfo2", "fine", 5)] })).not.toBe(routeLayout(a));
    expect(routeLayout({ ...a, matrix: [] })).not.toBe(routeLayout(a));
  });
  it("the matrix lesson checks the rows it asks for", () => {
    const lesson = LESSONS.find((l) => l.id === "C5.4")!;
    const snap = (state: Partial<SynthState>, extra: Partial<Snapshot> = {}) => ({ ...snapshot(newTrack(INITIAL), { ...INITIAL, ...lesson.initial, ...state }, { audioRunning: true, held: [45], holdOn: true, now: 0 }), ...extra }) as Snapshot;
    expect(lesson.steps[1]!.check(snap({ lfo1Amount: 50 }))).toBe(false); // must be changed in the matrix
    expect(lesson.steps[1]!.check(snap({ lfo1Amount: 50 }, { flags: { matrix: true } }))).toBe(true);
    expect(lesson.steps[2]!.check(snap({ matrix: [row("lfo1", "fine", 5)] }))).toBe(true);
    expect(lesson.steps[2]!.check(snap({ matrix: [row("lfo2", "fine", 5)] }))).toBe(false);
    expect(lesson.steps[2]!.remark!(snap({ matrix: [row("lfo1", "fine", 5)] }))).toContain("2 jobs");
    expect(lesson.steps[4]!.check(snap({ matrix: [row("lfo1", "aLevelDb", -50)] }))).toBe(true);
  });
});

import { slowModulate, sourceValue, withRouteAmount } from "../src/synth/mod";
import { FAST_DESTS, isSlowDest, SLOW_DESTS } from "../src/synth/params";
describe("any knob as a destination", () => {
  const note = (age: number, extra = {}) => ({ note: 60, velocity: 127, age, held: Infinity, startedAt: 0, ...extra });
  it("every continuous knob is a destination, except the few that cannot be", () => {
    for (const id of ["resonance", "warpAmount", "ringAmount", "position", "detune", "envA", "lfo2Rate", "lfo2Amount", "distDrive", "reverbMix", "delayTime", "eqMid"]) { expect(SLOW_DESTS, id).toContain(id); expect(MOD_DESTS).toContain(id); }
    for (const id of ["volumeDb", "bpm", "freeHz", "randomPhase", "reverbSize", "octave", "voices", "cutoff", "macro1"]) expect(SLOW_DESTS, id).not.toContain(id);
    for (const id of FAST_DESTS) expect(isSlowDest(id)).toBe(false);
    expect(new Set(MOD_DESTS).size).toBe(MOD_DESTS.length);
    expect(PARAMS.lfo1Dest!.choices).toBe(MOD_DESTS);
  });
  it("a source at full swing moves a slow knob by amount/200 of its travel, both ways or one way", () => {
    const s = { ...INITIAL, ringAmount: 50, lfo1Dest: "ringAmount", lfo1Amount: 100, lfo1Shape: "square" as const, lfo1Rate: 1 };
    expect(slowModulate(s, note(0.25)).ringAmount).toBeCloseTo(100, 6);
    expect(slowModulate(s, note(0.75)).ringAmount).toBeCloseTo(0, 6);
    const up = { ...s, ringAmount: 0, lfo1Way: "up" as const };
    expect(slowModulate(up, note(0.25)).ringAmount).toBeCloseTo(50, 6);
    expect(slowModulate(up, note(0.75)).ringAmount).toBeCloseTo(0, 6);
  });
  it("nothing moves without a note, without a slow connection, or at an amount of zero; the settings object is handed back untouched", () => {
    const s = { ...INITIAL, lfo1Dest: "ringAmount", lfo1Amount: 100 };
    expect(slowModulate(s, undefined)).toBe(s);
    expect(slowModulate(INITIAL, note(1))).toBe(INITIAL);
    expect(slowModulate({ ...INITIAL, lfo1Dest: "cutoff" }, note(1)).cutoff).toBe(INITIAL.cutoff); // a fast destination is left to the audio
    const zero = { ...s, lfo1Amount: 0 }; expect(slowModulate(zero, note(1))).toBe(zero);
  });
  it("envelope, velocity and key position work as slow sources, and two sources on one knob add", () => {
    const env = { ...INITIAL, eqMid: 0, env2Dest: "eqMid", env2Amount: 100, env2A: 100, env2D: 100, env2S: 0, env2H: 1000 };
    expect(slowModulate(env, note(0.5)).eqMid).toBeCloseTo(18, 6); // held at the top: half the travel of a -18..18 knob
    expect(slowModulate(env, note(0.05)).eqMid).toBeCloseTo(9, 6); // halfway up the attack
    expect(sourceValue(env, routes({ ...INITIAL, velDest: "resonance" })[0]!, note(0, { velocity: 64 }))).toBeCloseTo(64 / 127, 6);
    const two = { ...INITIAL, resonance: 0, velDest: "resonance", velAmount: 100, matrix: [{ source: "vel" as const, dest: "resonance", amount: 50, way: "both" as const }] };
    expect(slowModulate(two, note(0)).resonance).toBeCloseTo(75, 6);
    expect(slowModulate({ ...INITIAL, resonance: 50, keyDest: "resonance", keyAmount: 100 }, note(0, { note: 36 })).resonance).toBeCloseTo(0, 6);
  });
  it("an LFO's rise fades its slow movement in, and a wide-ranging knob moves in octaves", () => {
    const s = { ...INITIAL, ringAmount: 50, lfo1Dest: "ringAmount", lfo1Amount: 100, lfo1Shape: "square" as const, lfo1Rate: 1, lfo1Rise: 1000 };
    expect(slowModulate(s, note(0.25)).ringAmount).toBeCloseTo(62.5, 6);
    const rate = { ...INITIAL, lfo2Rate: 1, lfo3Dest: "lfo2Rate", lfo3Amount: 100, lfo3Shape: "square" as const, lfo3Rate: 1 };
    const moved = slowModulate(rate, note(0.25)).lfo2Rate;
    expect(moved).toBeGreaterThan(20); expect(moved).toBeLessThanOrEqual(30);
  });
  it("a connection's amount is set the same way from the knob's handle, wherever the connection lives", () => {
    const s = { ...INITIAL, lfo1Dest: "cutoff", matrix: [{ source: "lfo1" as const, dest: "fine", amount: 5, way: "both" as const }] };
    expect(withRouteAmount(s, "lfo1", 61.4)).toEqual({ lfo1Amount: 61 });
    expect(withRouteAmount(s, "lfo1", 400)).toEqual({ lfo1Amount: 100 });
    expect(withRouteAmount(s, "m0", -30)).toEqual({ matrix: [{ source: "lfo1", dest: "fine", amount: -30, way: "both" }] });
  });
  it("the two lessons check the handle and the new destinations", () => {
    const snap = (id: string, state: Partial<SynthState>, extra: Partial<Snapshot> = {}) => { const l = LESSONS.find((x) => x.id === id)!; return ({ ...snapshot(newTrack(INITIAL), { ...INITIAL, ...l.initial, ...state }, { audioRunning: true, held: [45], holdOn: true, now: 0 }), ...extra }) as Snapshot; };
    const depth = LESSONS.find((l) => l.id === "C5.5")!, any = LESSONS.find((l) => l.id === "C5.7")!;
    expect(depth.steps[1]!.check(snap("C5.5", { lfo1Amount: 60 }))).toBe(false); // must come from the handle
    expect(depth.steps[1]!.check(snap("C5.5", { lfo1Amount: 60 }, { flags: { depth: true } }))).toBe(true);
    expect(any.steps[1]!.check(snap("C5.7", { lfo1Dest: "resonance", lfo1Amount: 100 }))).toBe(true);
    expect(any.steps[3]!.check(snap("C5.7", { lfo3Dest: "lfo2Rate", lfo3Amount: 60 }))).toBe(true);
    expect(any.steps[3]!.check(snap("C5.7", { lfo3Dest: "lfo1Rate", lfo3Amount: 60 }))).toBe(false);
  });
});

import { connect, DRAGGABLE, DROP_AMOUNT } from "../src/synth/connect";
describe("dropping a source on a knob", () => {
  it("the first drop is the source's own connection, later drops add matrix rows, and the same knob twice is refused", () => {
    const first = connect(INITIAL, "lfo1", "cutoff");
    expect(first).toMatchObject({ ok: true, change: { lfo1Dest: "cutoff", lfo1Amount: 30 } });
    const s1 = { ...INITIAL, ...(first as { change: Partial<SynthState> }).change };
    expect(connect(s1, "lfo1", "cutoff")).toMatchObject({ ok: false });
    const second = connect(s1, "lfo1", "resonance");
    expect(second).toMatchObject({ ok: true, change: { matrix: [{ source: "lfo1", dest: "resonance", amount: DROP_AMOUNT, way: "both" }] } });
    const s2 = { ...s1, ...(second as { change: Partial<SynthState> }).change };
    expect(connect(s2, "lfo1", "resonance")).toMatchObject({ ok: false });
    expect(routes(s2).map((r) => [r.source.id, r.dest])).toEqual([["lfo1", "cutoff"], ["lfo1", "resonance"]]);
  });
  it("a source with an amount of zero is given one, a one-way LFO keeps its direction in a new row, and a full matrix refuses", () => {
    expect(connect({ ...INITIAL, env2Amount: 0 }, "env2", "distDrive")).toMatchObject({ ok: true, change: { env2Dest: "distDrive", env2Amount: DROP_AMOUNT } });
    const up = connect({ ...INITIAL, lfo2Dest: "cutoff", lfo2Way: "up" }, "lfo2", "fine") as { ok: true; change: Partial<SynthState> };
    expect(up.change.matrix![0]!.way).toBe("up");
    const full = { ...INITIAL, lfo1Dest: "cutoff", matrix: Array.from({ length: 8 }, () => ({ source: "lfo2" as const, dest: "fine", amount: 1, way: "both" as const })) };
    expect(connect(full, "lfo1", "resonance")).toMatchObject({ ok: false });
  });
  it("knobs that are not destinations refuse, for sources and for macros", () => {
    for (const knob of ["volumeDb", "bpm", "octave", "voices", "randomPhase", "reverbSize", "nonsense"]) expect(connect(INITIAL, "lfo1", knob).ok, knob).toBe(false);
    expect(connect(INITIAL, "macro1", "octave").ok).toBe(false);
    expect(connect(INITIAL, "ghost", "cutoff").ok).toBe(false);
  });
  it("a macro takes its next free slot, refuses a knob it already moves, and refuses when its slots are used up", () => {
    const a = connect(INITIAL, "macro2", "cutoff") as { ok: true; change: Record<string, unknown> };
    expect(a.change).toEqual({ macro2Dest1: "cutoff", macro2Amt1: 50 });
    const s1 = { ...INITIAL, ...a.change } as SynthState;
    expect(connect(s1, "macro2", "cutoff").ok).toBe(false);
    expect((connect(s1, "macro2", "reverbMix") as { change: Record<string, unknown> }).change).toMatchObject({ macro2Dest2: "reverbMix" });
    const used = { ...INITIAL, macro1Dest1: "cutoff", macro1Dest2: "drive", macro1Dest3: "resonance" } as SynthState;
    expect(connect(used, "macro1", "detune").ok).toBe(false);
    expect(DRAGGABLE).toEqual(["env2", "lfo1", "lfo2", "lfo3", "vel", "key", "macro1", "macro2", "macro3", "macro4"]);
  });
});

describe("oscillator A's switch", () => {
  it("is on to begin with, is a switch on the Osc A panel, and no lesson starts with it off", () => {
    expect(INITIAL.aOn).toBe(true);
    expect(PARAMS.aOn).toMatchObject({ kind: "toggle", group: "Oscillator A" });
    expect(MODULES.find((m) => m.id === "a")!.toggle).toBe("aOn");
    for (const l of LESSONS) expect((l.initial as Partial<SynthState> | undefined)?.aOn, l.id).not.toBe(false);
  });
});
