import { describe, expect, it } from "vitest";
import { CompDsp, CrushDsp, GLUE_KNEE, GateDsp, LIMIT_LOOK_MS, LimiterDsp, compCurveDb, crushValue, makeDsp, stepFor, type Dsp, type P } from "../src/daw/dsp";

const SR = 48000;
const sine = (f: number, amp: number, seconds: number, from = 0) => Float32Array.from({ length: Math.round(seconds * SR) }, (_, i) => amp * Math.sin((2 * Math.PI * f * (i + from)) / SR));
/** Run a whole sound through an effect in blocks of 128, as the browser does. */
function run(d: Dsp, p: P, l: Float32Array, r: Float32Array = l): [Float32Array, Float32Array] {
  d.set(p);
  const outL = new Float32Array(l.length), outR = new Float32Array(l.length);
  for (let i = 0; i + 128 <= l.length; i += 128) d.run(l.subarray(i, i + 128), r.subarray(i, i + 128), outL.subarray(i, i + 128), outR.subarray(i, i + 128));
  return [outL, outR];
}
const peak = (x: Float32Array, from: number, to: number) => { let m = 0; for (let i = Math.round(from * SR); i < Math.round(to * SR); i++) m = Math.max(m, Math.abs(x[i]!)); return m; };
const dB = (v: number) => 20 * Math.log10(v + 1e-12);

describe("the compressor's rule", () => {
  it("leaves quiet sounds alone and divides what is over the threshold by the ratio", () => {
    expect(compCurveDb(-30, -20, 4)).toBe(-30);
    expect(compCurveDb(-8, -20, 4)).toBe(-17);
    expect(compCurveDb(-8, -20, 1)).toBe(-8);
  });
  it("a knee rounds the corner: it meets the straight lines at its two ends and sits between them inside", () => {
    expect(compCurveDb(-26, -20, 4, 12)).toBeCloseTo(-26, 10);
    expect(compCurveDb(-14, -20, 4, 12)).toBeCloseTo(-18.5, 10);
    const mid = compCurveDb(-20, -20, 4, 12);
    expect(mid).toBeLessThan(-20); expect(mid).toBeGreaterThan(-21.5);
    for (let x = -40; x < 0; x += 0.5) expect(compCurveDb(x + 0.5, -20, 4, 12)).toBeGreaterThan(compCurveDb(x, -20, 4, 12));   // louder in is never quieter out
  });
});

describe("compressor", () => {
  const tone = sine(1000, 0.5, 2);                                  // peaks at -6.02 dB
  it("a steady tone settles at the level the rule gives, to a tenth of a dB, and make-up adds on top", () => {
    for (const [p, want] of [[{ threshold: -26, ratio: 4, knee: 0 }, -21.0], [{ threshold: -40, ratio: 20, knee: 0 }, -38.3], [{ threshold: -26, ratio: 4, knee: 12 }, -21.0], [{ threshold: -10, ratio: 4, knee: 12 }, compCurveDb(-6.02, -10, 4, 12)], [{ threshold: -26, ratio: 4, knee: 0, makeup: 6 }, -15.0], [{ threshold: 0, ratio: 8 }, -6.02]] as [P, number][]) {
      const [out] = run(new CompDsp(SR), p, tone);
      expect(dB(peak(out, 1.5, 1.9))).toBeCloseTo(want, 1);
    }
  });
  it("reports how far it is turning down, takes the attack time to get there and the release time to let go", () => {
    const d = new CompDsp(SR), loudThenQuiet = Float32Array.from([...sine(1000, 0.5, 1), ...sine(1000, 0.02, 1, SR)]);
    const [out] = run(d, { threshold: -26, ratio: 4, knee: 0, attack: 50, release: 200 }, loudThenQuiet);
    expect(dB(peak(out, 0.001, 0.004))).toBeGreaterThan(-8);         // not yet turned down
    expect(dB(peak(out, 0.4, 0.5))).toBeCloseTo(-21, 0);
    const [steady] = run(new CompDsp(SR), { threshold: -26, ratio: 4, knee: 0 }, tone);
    void steady; const m = new CompDsp(SR); run(m, { threshold: -26, ratio: 4, knee: 0 }, tone); expect(m.reduction()).toBeCloseTo(15, 0);
    expect(dB(peak(out, 1.002, 1.02))).toBeLessThan(-45);            // just after the loud part: the quiet tone is still held down
    expect(dB(peak(out, 1.9, 1.99))).toBeCloseTo(dB(0.02), 0);       // later: let go
  });
  it("both sides are turned down together, and dry/wet at 0 is the untouched sound", () => {
    const quiet = sine(700, 0.01, 1), [l, r] = run(new CompDsp(SR), { threshold: -26, ratio: 4, knee: 0 }, sine(1000, 0.5, 1), quiet);
    expect(peak(r, 0.6, 0.9) / 0.01).toBeCloseTo(peak(l, 0.6, 0.9) / 0.5, 2);
    const [dry] = run(new CompDsp(SR), { threshold: -40, ratio: 20, mix: 0 }, tone);
    expect(peak(dry, 1, 1.5)).toBeCloseTo(0.5, 4);
  });
  it("the glue compressor reads the average level (3 dB under a tone's peak) through a fixed knee", () => {
    const [out] = run(makeDsp("glue", SR)!, { threshold: -30, ratio: 1, attack: 3, release: 2 }, tone);     // ratio choice 1 is 4 : 1
    expect(dB(peak(out, 1.5, 1.9))).toBeCloseTo(-6.02 + (compCurveDb(-9.03, -30, 4, GLUE_KNEE) + 9.03), 0);
    const [clipped] = run(makeDsp("glue", SR)!, { threshold: 0, makeup: 20, clip: 1 }, tone);
    expect(peak(clipped, 1, 1.5)).toBeLessThanOrEqual(1);
  });
});

describe("limiter", () => {
  it("nothing passes the ceiling, however hard it is pushed, even on a sudden hit", () => {
    const hit = new Float32Array(SR); for (let i = 4800; i < SR; i++) hit[i] = Math.sin((2 * Math.PI * 180 * i) / SR) * (i < 4810 ? 3 : 0.9);
    for (const p of [{ ceiling: -6, gain: 0 }, { ceiling: -0.3, gain: 18 }, { ceiling: -12, gain: 24, release: 1 }] as P[]) {
      const [out] = run(new LimiterDsp(SR), p, hit); let top = 0; for (const v of out) top = Math.max(top, Math.abs(v));
      expect(top).toBeLessThanOrEqual(10 ** (p.ceiling! / 20) * 1.0001);
      expect(top).toBeGreaterThan(10 ** (p.ceiling! / 20) * 0.9);
    }
  });
  it("a sound under the ceiling comes out the same, only late by its look-ahead", () => {
    const d = new LimiterDsp(SR), x = sine(440, 0.3, 0.5), [out] = run(d, { ceiling: -0.3 }, x);
    expect(d.lag).toBe(Math.round((LIMIT_LOOK_MS / 1000) * SR) - 1);
    for (let i = 2000; i < 2400; i++) expect(out[i]).toBeCloseTo(x[i - d.lag]!, 6);
  });
  it("the gain never jumps: no click when a peak arrives", () => {
    const x = new Float32Array(SR).fill(0.2); for (let i = 20000; i < 20200; i++) x[i] = 2;
    const [out] = run(new LimiterDsp(SR), { ceiling: 0 }, x); let step = 0; for (let i = 19000; i < 19990; i++) step = Math.max(step, Math.abs(out[i + 1]! - out[i]!));
    expect(step).toBeLessThan(0.01);
  });
});

describe("gate", () => {
  const loudThenQuiet = Float32Array.from([...sine(500, 0.5, 0.5), ...sine(500, 0.003, 1, SR / 2)]);
  it("lets a loud sound through and shuts on a quiet one, after the hold", () => {
    const [out] = run(new GateDsp(SR), { threshold: -30, hold: 100, release: 10, attack: 0.1 }, loudThenQuiet);
    expect(peak(out, 0.2, 0.45)).toBeCloseTo(0.5, 2);
    expect(peak(out, 0.52, 0.58)).toBeCloseTo(0.003, 4);             // still open: inside the hold
    expect(peak(out, 0.9, 1.4)).toBeLessThan(1e-5);
  });
  it("the floor is how far down it turns, and it does not chatter between its two thresholds", () => {
    const [out] = run(new GateDsp(SR), { threshold: -30, floor: -20, hold: 0, release: 5 }, loudThenQuiet);
    expect(peak(out, 1, 1.4)).toBeCloseTo(0.0003, 5);
    const between = Float32Array.from([...sine(500, 0.5, 0.3), ...sine(500, 10 ** (-32 / 20), 0.7, SR * 0.3)]);   // 2 dB under the threshold, inside the 3 dB "closes this far under"
    const [held] = run(new GateDsp(SR), { threshold: -30, back: 3, hold: 0, release: 5 }, between);
    expect(dB(peak(held, 0.6, 0.9))).toBeCloseTo(-32, 0);
    const [shut] = run(new GateDsp(SR), { threshold: -30, back: 1, hold: 0, release: 5 }, between);
    expect(peak(shut, 0.6, 0.9)).toBeLessThan(1e-4);
  });
});

describe("crusher", () => {
  it("rounds to the levels its bits can hold, and holds each kept sample", () => {
    expect(crushValue(0.3, 1)).toBe(0); expect(crushValue(0.6, 1)).toBe(1); expect(crushValue(0.3, 3)).toBe(0.25); expect(crushValue(0.123456, 16)).toBeCloseTo(0.123456, 4);
    const x = sine(100, 0.8, 0.1), [out] = run(new CrushDsp(SR), { bits: 16, hold: 8 }, x);
    for (let i = 0; i < 512; i++) expect(out[i]).toBeCloseTo(x[i - (i % 8)]!, 4);
    const [four] = run(new CrushDsp(SR), { bits: 2, hold: 1 }, x); expect(new Set(four).size).toBeLessThanOrEqual(5);
    const [dry] = run(new CrushDsp(SR), { bits: 1, hold: 64, mix: 0 }, x); expect(dry[300]).toBe(x[300]);
  });
  it("smoothing steps make sense", () => { expect(stepFor(0, SR)).toBe(1); expect(stepFor(10, SR)).toBeCloseTo(1 / 480, 4); expect(makeDsp("tape", SR)).toBeUndefined(); });
});

import { ResonatorDsp, resonatorHz, resonatorKeep } from "../src/daw/dsp";
describe("resonators", () => {
  const click = () => { const x = new Float32Array(SR * 2); x[5] = 1; return x; };
  const partial = (x: Float32Array, f: number, from: number, to: number) => { let re = 0, im = 0; for (let i = Math.round(from * SR); i < to * SR; i++) { re += x[i]! * Math.cos((2 * Math.PI * f * i) / SR); im += x[i]! * Math.sin((2 * Math.PI * f * i) / SR); } return Math.hypot(re, im); };
  const only = (n: number, more: P = {}): P => ({ note: 57, decay: 1, colour: 100, mix: 100, r1on: 0, r2on: 0, r3on: 0, r4on: 0, r5on: 0, [`r${n}on`]: 1, ...more });
  it("each sits where its semitones put it", () => {
    const hz = resonatorHz({ note: 57, r2pitch: 12, r3pitch: -12, r4pitch: 7, r5pitch: 0 });
    expect(hz[0]).toBeCloseTo(220, 6); expect(hz[1]).toBeCloseTo(440, 6); expect(hz[2]).toBeCloseTo(110, 6); expect(hz[3]).toBeCloseTo(329.63, 1);
    expect(resonatorKeep(100, 1) ** 100).toBeCloseTo(0.001, 6);       // a hundred trips in a second: 60 dB down
  });
  it("a click makes it ring at its note, in tune, and not at a note in between", () => {
    const [out] = run(new ResonatorDsp(SR), only(1), click());
    let best = 0, at = 0; for (let f = 200; f <= 240; f += 0.25) { const v = partial(out, f, 0.05, 1); if (v > best) { best = v; at = f; } }
    expect(Math.abs(1200 * Math.log2(at / 220))).toBeLessThan(8);
    expect(partial(out, 311, 0.05, 1)).toBeLessThan(best / 20);
    const [fifth] = run(new ResonatorDsp(SR), only(2, { r2pitch: 7 }), click());
    expect(partial(fifth, 329.63, 0.05, 1)).toBeGreaterThan(20 * partial(fifth, 277, 0.05, 1));
  });
  it("rings for about the time asked, shorter when asked, and less bright with the colour down", () => {
    const level = (x: Float32Array, t: number) => dB(partial(x, 220, t, t + 0.05));   // the note itself: its upper partials die sooner
    const [long] = run(new ResonatorDsp(SR), only(1, { decay: 1 }), click()), [short] = run(new ResonatorDsp(SR), only(1, { decay: 0.2 }), click());
    expect(level(long, 0.1) - level(long, 0.6)).toBeCloseTo(30, -1);
    expect(level(short, 0.1) - level(short, 0.2)).toBeCloseTo(30, -1);
    const [dull] = run(new ResonatorDsp(SR), only(1, { colour: 20 }), click());
    expect(partial(dull, 2200, 0.05, 0.5) / partial(dull, 220, 0.05, 0.5)).toBeLessThan(0.3 * (partial(long, 2200, 0.05, 0.5) / partial(long, 220, 0.05, 0.5)));
  });
  it("with every resonator off and the mix down it is the untouched sound", () => {
    const x = sine(300, 0.4, 0.2), [out] = run(new ResonatorDsp(SR), only(1, { mix: 0 }), x); expect(out[1000]).toBe(x[1000]);
  });
});
