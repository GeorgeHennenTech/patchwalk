import { describe, expect, it } from "vitest";
import { HAT_RATIOS, MODEL_RATE, MODEL_SETTINGS, SNARE_MODES, modelHit, modelKick, modelSnare } from "../src/daw/drummodels";
import { fft } from "../src/synth/wtedit";

const spectrum = (x: Float32Array, from: number, n: number) => { const re = new Float64Array(n), im = new Float64Array(n); for (let i = 0; i < n; i++) re[i] = (x[from + i] ?? 0) * (0.5 - 0.5 * Math.cos((2 * Math.PI * i) / n)); fft(re, im); return Float64Array.from({ length: n / 2 }, (_, k) => Math.hypot(re[k]!, im[k]!)); };
const peakHz = (x: Float32Array, from: number, n: number, lo = 20, hi = 20000) => { const s = spectrum(x, from, n); let m = 0, at = 0; for (let k = Math.ceil((lo * n) / MODEL_RATE); k < Math.min(s.length, (hi * n) / MODEL_RATE); k++) if (s[k]! > m) { m = s[k]!; at = k; } return (at * MODEL_RATE) / n; };
const rms = (x: Float32Array, a: number, b: number) => Math.sqrt(x.slice(a, b).reduce((s, v) => s + v * v, 0) / (b - a));
const centroid = (x: Float32Array) => { const s = spectrum(x, 0, 8192); let a = 0, b = 0; s.forEach((v, k) => { a += v * v * k; b += v * v; }); return ((a / b) * MODEL_RATE) / 8192; };

describe("the modelled drums", () => {
  it("the numbers that are the original's are as published", () => {
    expect(SNARE_MODES).toEqual([1.0, 2.0, 3.18, 4.16, 5.62]);
    expect(HAT_RATIOS).toEqual([1.0, 1.304, 1.466, 1.787, 1.932, 2.536]);
    expect(MODEL_RATE).toBe(48000);
  });
  it("every drum makes a sound that stays in range, starts at once and dies away", () => {
    for (const v of ["mkick", "msnare", "mhat", "mohat"] as const) {
      const x = modelHit(v, 1), n = x.length;
      expect(x.every(Number.isFinite), v).toBe(true);
      const peak = x.reduce((p, s) => Math.max(p, Math.abs(s)), 0);
      expect(peak, v).toBeCloseTo(0.9, 2);
      expect(rms(x, 0, 2400), `${v} starts`).toBeGreaterThan(0.02);
      expect(rms(x, n - 2400, n), `${v} ends`).toBeLessThan(rms(x, 0, 2400) / 20);
    }
  });
  it("the kick rings near its set pitch after starting higher, and a longer decay rings longer", () => {
    const set = { ...MODEL_SETTINGS.mkick }, x = modelKick(set, 1, 1);
    const late = peakHz(x, 9600, 16384, 25, 400);
    expect(late).toBeGreaterThan(set.hz * 0.85); expect(late).toBeLessThan(set.hz * 1.45);
    // counted from its zero crossings: the first cycles are quicker than the later ones
    const crossings: number[] = []; for (let i = 60; i < x.length - 1; i++) if (x[i]! <= 0 && x[i + 1]! > 0) crossings.push(i);
    expect(crossings[2]! - crossings[1]!).toBeLessThan(crossings[8]! - crossings[7]!);
    const short = modelKick({ ...set, decay: 0.2 }, 1, 1), long = modelKick({ ...set, decay: 0.8 }, 1, 1);
    expect(rms(long, 19200, 24000) / rms(long, 2400, 4800)).toBeGreaterThan(3 * (rms(short, 19200, 24000) / rms(short, 2400, 4800)));
  });
  it("the snare's shell rings at its set pitch, and more 'snappy' means more of the noise", () => {
    const set = { ...MODEL_SETTINGS.msnare }, shell = modelSnare({ ...set, snappy: 0 }, 1, 0.5);
    expect(Math.abs(peakHz(shell, 480, 8192, 60, 2000) - set.hz)).toBeLessThan(12);
    expect(centroid(modelSnare({ ...set, snappy: 0.9 }, 1, 0.5))).toBeGreaterThan(2 * centroid(shell));
    expect(modelSnare(set, 1, 0.3)).toEqual(modelSnare(set, 1, 0.3));   // the noise is the same every time
  });
  it("the hats sit high, the open one rings longer than the closed one, and Tone moves them", () => {
    const shut = modelHit("mhat", 1), open = modelHit("mohat", 1);
    expect(centroid(shut)).toBeGreaterThan(4000);
    expect(rms(open, 9600, 14400)).toBeGreaterThan(5 * rms(shut, 9600, 14400));
    expect(centroid(modelHit("mhat", 1, 1, 1))).toBeGreaterThan(centroid(modelHit("mhat", 1, 1, -1)) * 1.3);
  });
  it("a soft hit is quieter than a hard one", () => {
    for (const v of ["mkick", "msnare", "mhat"] as const) expect(rms(modelHit(v, 0.3), 0, 4800), v).toBeLessThan(0.8 * rms(modelHit(v, 1), 0, 4800));
  });
});
