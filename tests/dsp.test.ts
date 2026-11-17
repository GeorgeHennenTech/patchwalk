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

import { DrumBusDsp, MultibandDsp, ShifterDsp, multibandChangeDb, shiftRatio } from "../src/daw/dsp";
const part = (x: Float32Array, f: number, from: number, to: number) => { let re = 0, im = 0, n = 0; for (let i = Math.round(from * SR); i < to * SR; i++) { re += x[i]! * Math.cos((2 * Math.PI * f * i) / SR); im += x[i]! * Math.sin((2 * Math.PI * f * i) / SR); n++; } return (2 * Math.hypot(re, im)) / n; };

describe("multiband dynamics", () => {
  const flat: P = { lratio: 1, mratio: 1, hratio: 1 };
  it("the rule: down above the upper threshold, up below the lower one, nothing between, nothing near silence", () => {
    expect(multibandChangeDb(-10, -20, 4, -50, 2)).toBe(-7.5);
    expect(multibandChangeDb(-30, -20, 4, -50, 2)).toBe(0);
    expect(multibandChangeDb(-60, -20, 4, -50, 2)).toBe(5);
    expect(multibandChangeDb(-60, -20, 4, -50, 1)).toBe(0);
    expect(multibandChangeDb(-90, -20, 4, -50, 5)).toBe(0);
  });
  it("with every ratio at 1 the three bands add back to the untouched level at any frequency", () => {
    for (const f of [40, 120, 600, 2500, 9000]) { const [out] = run(new MultibandDsp(SR), flat, sine(f, 0.3, 1)); expect(dB(part(out, f, 0.5, 0.9) / 0.3)).toBeCloseTo(0, 1); }
  });
  it("each band is worked on by itself: a loud low tone is turned down by its rule and a quiet high tone alongside is left alone", () => {
    const both = Float32Array.from(sine(30, 0.5, 2), (v, i) => v + 0.01 * Math.sin((2 * Math.PI * 6000 * i) / SR));
    const d = new MultibandDsp(SR), [out] = run(d, { ...flat, labove: -26, lratio: 4, release: 600 }, both);
    expect(dB(part(out, 30, 1.5, 1.9))).toBeCloseTo(-21, 0);                       // a tone well inside the band: near a split, part of it is in the next band too
    expect(dB(part(out, 6000, 1.5, 1.9) / 0.01)).toBeCloseTo(0, 0);
    expect(d.reduction()).toBeCloseTo(15, 0);
  });
  it("lifts a quiet band towards its lower threshold, and Amount scales how much", () => {
    const quiet = sine(6000, 0.001, 2);                              // -60 dB
    const [up] = run(new MultibandDsp(SR), { ...flat, hbelow: -40, hlift: 2 }, quiet), [half] = run(new MultibandDsp(SR), { ...flat, hbelow: -40, hlift: 2, amount: 50 }, quiet);
    expect(dB(part(up, 6000, 1.5, 1.9))).toBeCloseTo(-50, 0);
    expect(dB(part(half, 6000, 1.5, 1.9))).toBeCloseTo(-55, 0);
  });
});

describe("drum bus", () => {
  const hit = () => { const x = new Float32Array(SR); for (let i = 4800; i < SR; i++) x[i] = Math.sin((2 * Math.PI * 200 * (i - 4800)) / SR) * Math.exp(-(i - 4800) / 6000); return x; };
  it("at its starting settings it changes nothing", () => { const x = hit(), [out] = run(new DrumBusDsp(SR), {}, x); for (const i of [5000, 9000, 20000]) expect(out[i]).toBe(x[i]); });
  it("transients up makes the start of a hit louder than its body, down makes it softer", () => {
    const x = hit(), [plain] = run(new DrumBusDsp(SR), {}, x), [up] = run(new DrumBusDsp(SR), { transients: 100 }, x), [down] = run(new DrumBusDsp(SR), { transients: -100 }, x);
    expect(peak(up, 0.1, 0.11)).toBeGreaterThan(peak(plain, 0.1, 0.11) * 1.5); expect(peak(down, 0.1, 0.11)).toBeLessThan(peak(plain, 0.1, 0.11) * 0.8);
    expect(peak(up, 0.5, 0.6)).toBeCloseTo(peak(plain, 0.5, 0.6), 3);                                                    // the body is left alone
  });
  it("drive adds harmonics without passing full level; boom rings at its frequency; damp takes the top off", () => {
    const tone = sine(200, 0.8, 1), [driven] = run(new DrumBusDsp(SR), { drive: 100 }, tone);
    expect(part(driven, 600, 0.3, 0.9)).toBeGreaterThan(0.05); expect(peak(driven, 0, 0.99)).toBeLessThanOrEqual(1.0001);
    const click = new Float32Array(SR); click[100] = 1;
    const [boom] = run(new DrumBusDsp(SR), { boom: 100, boomFreq: 60, boomDecay: 100 }, click), [none] = run(new DrumBusDsp(SR), {}, click);
    expect(part(boom, 60, 0.05, 0.3)).toBeGreaterThan(20 * part(none, 60, 0.05, 0.3) + 1e-4); expect(part(boom, 60, 0.05, 0.3)).toBeGreaterThan(5 * part(boom, 95, 0.05, 0.3));
    const [damped] = run(new DrumBusDsp(SR), { damp: 1000 }, sine(8000, 0.5, 0.5)); expect(dB(peak(damped, 0.2, 0.4) / 0.5)).toBeLessThan(-30);
    const [crunch] = run(new DrumBusDsp(SR), { crunch: 100 }, sine(3000, 0.5, 0.5)); expect(part(crunch, 9000, 0.2, 0.4)).toBeGreaterThan(0.02);
    const [low] = run(new DrumBusDsp(SR), { crunch: 100 }, sine(100, 0.5, 0.5)); expect(part(low, 300, 0.2, 0.4)).toBeLessThan(0.002);   // crunch leaves the lows clean
  });
});

describe("shifter", () => {
  const loudest = (x: Float32Array, lo: number, hi: number, step = 1) => { let best = 0, at = 0; for (let f = lo; f <= hi; f += step) { const v = part(x, f, 0.5, 1.5); if (v > best) { best = v; at = f; } } return at; };
  it("ratios", () => { expect(shiftRatio(12)).toBe(2); expect(shiftRatio(-12)).toBe(0.5); expect(shiftRatio(0, 0)).toBe(1); });
  it("pitch mode moves a tone by the interval: an octave up, a fifth up, an octave down", () => {
    const tone = sine(440, 0.5, 2);
    for (const [semis, want] of [[12, 880], [7, 659.26], [-12, 220]] as [number, number][]) { const [out] = run(new ShifterDsp(SR), { semis }, tone); expect(Math.abs(loudest(out, 150, 1000) - want)).toBeLessThan(10); /* the crossfades put the energy on lines a few Hz apart: the warble */ expect(part(out, 440, 0.5, 1.5)).toBeLessThan(0.1); }
    const [same] = run(new ShifterDsp(SR), { semis: 0 }, tone); expect(part(same, 440, 0.5, 1.5)).toBeCloseTo(0.5, 2);
  });
  it("frequency mode moves a tone by a number of Hz, with the unwanted side at least 40 dB down", () => {
    const tone = sine(1000, 0.5, 2), [up] = run(new ShifterDsp(SR), { mode: 1, hz: 300 }, tone), [down] = run(new ShifterDsp(SR), { mode: 1, hz: -250 }, tone);
    expect(part(up, 1300, 0.5, 1.5)).toBeCloseTo(0.5, 1); expect(dB(part(up, 700, 0.5, 1.5) / part(up, 1300, 0.5, 1.5))).toBeLessThan(-40);
    expect(part(down, 750, 0.5, 1.5)).toBeCloseTo(0.5, 1); expect(dB(part(down, 1250, 0.5, 1.5) / part(down, 750, 0.5, 1.5))).toBeLessThan(-40);
  });
});

import { BeatRepeatDsp, VinylDsp, detectPitch, nearestNote, repeatChance } from "../src/daw/dsp";
describe("compressor sidechain", () => {
  it("listens to the other sound: a quiet sound is turned down while a loud one plays on the side, and left alone when the side is silent", () => {
    const quiet = sine(300, 0.05, 1), loud = sine(60, 0.5, 1), d = new CompDsp(SR); d.set({ threshold: -26, ratio: 4, knee: 0, side: 1 });
    const out = new Float32Array(quiet.length), o2 = new Float32Array(quiet.length);
    for (let i = 0; i + 128 <= quiet.length; i += 128) d.run(quiet.subarray(i, i + 128), quiet.subarray(i, i + 128), out.subarray(i, i + 128), o2.subarray(i, i + 128), { sideL: loud.subarray(i, i + 128) });
    expect(dB(peak(out, 0.6, 0.9) / 0.05)).toBeCloseTo(-15, 0);
    const alone = new CompDsp(SR); alone.set({ threshold: -26, ratio: 4, knee: 0, side: 1 }); const [untouched] = run(alone, { threshold: -26, ratio: 4, knee: 0, side: 1 }, sine(300, 0.5, 1));
    expect(peak(untouched, 0.6, 0.9)).toBeCloseTo(0.5, 3);            // loud itself, but nothing on the side: nothing happens
  });
});

describe("beat repeat", () => {
  // 120 bpm: a sixteenth is 6000 samples. The input is a ramp so every sample can be told from every other.
  const ramp = Float32Array.from({ length: SR * 4 }, (_, i) => (i % 96000) / 96000 + 0.001);
  const go = (p: P) => { const d = new BeatRepeatDsp(SR); d.clock(120, 0); return run(d, p, ramp)[0]; };
  it("in Insert mode: passes the sound until its place in the bar, catches one slice, then repeats that slice for the gate time", () => {
    const out = go({ interval: 2, offset: 4, grid: 1, gate: 4, chance: 100, decay: 0, mode: 1 });      // every bar, 4 sixteenths in, 1/16 slices, for 4 sixteenths
    expect(out[10000]).toBeCloseTo(ramp[10000]!, 6);                                                    // before: untouched
    expect(out[24000 + 3000]).toBeCloseTo(ramp[24000 + 3000]!, 6);                                      // being caught: still the sound itself
    for (const k of [1, 2, 3]) expect(out[24000 + k * 6000 + 3000]).toBeCloseTo(ramp[24000 + 3000]!, 6);   // three repeats of that same slice
    expect(out[24000 + 4 * 6000 + 3000]).toBeCloseTo(ramp[24000 + 4 * 6000 + 3000]!, 6);               // after the gate: the sound again
    expect(out[96000 + 24000 + 6000 + 3000]).toBeCloseTo(ramp[96000 + 24000 + 3000]!, 6);               // and again in the next bar
  });
  it("Gate lets only the repeats through, Mix adds them, decay makes each quieter, and chance 0 never repeats", () => {
    const gate = go({ interval: 2, offset: 4, grid: 1, gate: 4, chance: 100, mode: 2 });
    expect(gate[10000]).toBe(0); expect(gate[24000 + 6000 + 3000]).toBeCloseTo(ramp[24000 + 3000]!, 6);
    const mix = go({ interval: 2, offset: 4, grid: 1, gate: 4, chance: 100, mode: 0 });
    expect(mix[24000 + 6000 + 3000]).toBeCloseTo(ramp[24000 + 3000]! + ramp[24000 + 6000 + 3000]!, 6);
    const fading = go({ interval: 2, offset: 4, grid: 1, gate: 4, chance: 100, decay: 100, mode: 2 });
    expect(fading[24000 + 2 * 6000 + 3000]).toBeCloseTo(0.5 * fading[24000 + 6000 + 3000]!, 6);
    const never = go({ interval: 2, offset: 4, grid: 1, gate: 4, chance: 0, mode: 1 });
    for (let i = 0; i < never.length - 128; i += 997) expect(never[i]).toBe(ramp[i]);
  });
  it("its dice are repeatable and fair", () => {
    expect(repeatChance(3)).toBe(repeatChance(3)); let under = 0; for (let n = 0; n < 2000; n++) { const v = repeatChance(n); expect(v).toBeGreaterThanOrEqual(0); expect(v).toBeLessThan(1); if (v < 0.5) under++; }
    expect(under).toBeGreaterThan(850); expect(under).toBeLessThan(1150);
  });
});

describe("vinyl distortion", () => {
  it("tracing adds the octave above the band; pinch adds a third harmonic that is opposite on the two sides", () => {
    const tone = sine(1500, 0.5, 1), [plain] = run(new VinylDsp(SR), { tracing: 0, pinch: 0, crackle: 0 }, tone);
    expect(plain[2000]).toBe(tone[2000]);
    const [traced] = run(new VinylDsp(SR), { tracing: 100, freq: 1500, crackle: 0 }, tone);
    expect(part(traced, 3000, 0.3, 0.9)).toBeGreaterThan(0.05); expect(part(traced, 1500, 0.3, 0.9)).toBeCloseTo(0.5, 1);
    let mean = 0; for (let i = 20000; i < 40000; i++) mean += traced[i]!; expect(Math.abs(mean / 20000)).toBeLessThan(0.01);                      // no steady push left
    const [l, r] = run(new VinylDsp(SR), { tracing: 0, pinch: 100, freq: 1500, crackle: 0 }, tone);
    expect(part(l, 4500, 0.3, 0.9)).toBeGreaterThan(0.02);
    const mono = Float32Array.from(l, (v, i) => (v + r[i]!) / 2); expect(part(mono, 4500, 0.3, 0.9)).toBeLessThan(1e-4);
  });
  it("crackle pops about as often as asked, and not at all at zero", () => {
    const silence = new Float32Array(SR * 4), [out] = run(new VinylDsp(SR), { tracing: 0, crackle: 20, crackleLevel: -12 }, silence);
    let pops = 0, quiet = true; for (let i = 0; i < out.length; i++) { const loud = Math.abs(out[i]!) > 1e-5; if (loud && quiet) pops++; quiet = !loud; }
    expect(pops).toBeGreaterThan(40); expect(pops).toBeLessThan(130);
    const [none] = run(new VinylDsp(SR), { tracing: 0, crackle: 0 }, silence); expect(peak(none, 0, 3.9)).toBe(0);
  });
});

describe("tuner", () => {
  it("finds the note of a tone and of a saw, to within a few cents, and gives nothing for silence or noise", () => {
    for (const f of [55, 110, 440, 987.77, 1760]) expect(Math.abs(1200 * Math.log2(detectPitch(sine(f, 0.5, 0.1).subarray(0, 4096), SR) / f))).toBeLessThan(3);
    const saw = Float32Array.from({ length: 4096 }, (_, i) => 2 * ((i * 196) / SR % 1) - 1);
    expect(Math.abs(1200 * Math.log2(detectPitch(saw, SR) / 196))).toBeLessThan(3);
    expect(detectPitch(new Float32Array(4096), SR)).toBe(0);
    let seed = 1; const noise = Float32Array.from({ length: 4096 }, () => { seed = (seed * 1664525 + 1013904223) >>> 0; return seed / 2147483648 - 1; });
    expect(detectPitch(noise, SR)).toBe(0);
  });
  it("names the nearest note and how far off", () => {
    expect(nearestNote(440)).toEqual({ name: "A4", note: 69, cents: 0 });
    expect(nearestNote(261.63).name).toBe("C4"); expect(nearestNote(445).cents).toBe(20); expect(nearestNote(435).cents).toBe(-20);
  });
});
