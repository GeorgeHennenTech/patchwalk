import { describe, expect, it } from "vitest";
import { noteToHz } from "../src/synth/params";
import { besselJ, BESSEL_ZEROS, besselZeros, DRUM_INITIAL, modeDecay, modes, renderDrum, SECOND_HEAD, stickShare, stretch, type DrumState } from "../src/modal/membrane";

const SR = 48000;
// the plain model for exact checks: a soft hit (no pitch dip), the hardest stick, one head
const D = (over: Partial<DrumState> = {}): DrumState => ({ ...DRUM_INITIAL, force: 0, stick: 100, second: 0, damp: 50, ...over });
function strength(y: Float32Array, hz: number, from: number, to: number): number {
  let a = 0, b = 0; const i0 = Math.round(from * SR), i1 = Math.round(to * SR);
  for (let i = i0; i < i1; i++) { const w = (2 * Math.PI * hz * i) / SR, win = 0.5 - 0.5 * Math.cos((2 * Math.PI * (i - i0)) / (i1 - i0)); a += y[i]! * win * Math.sin(w); b += y[i]! * win * Math.cos(w); }
  return Math.hypot(a, b) / (i1 - i0);
}

describe("the drum head", () => {
  it("the Bessel function is right at known points, and every listed zero really is one", () => {
    expect(besselJ(0, 0)).toBeCloseTo(1, 6); expect(besselJ(1, 0)).toBeCloseTo(0, 6); expect(besselJ(0, 1)).toBeCloseTo(0.7651977, 5); expect(besselJ(1, 1)).toBeCloseTo(0.4400506, 5);
    BESSEL_ZEROS.forEach((row, m) => row.forEach((zero) => expect(Math.abs(besselJ(m, zero)), `J${m}(${zero})`).toBeLessThan(2e-4)));
  });
  it("a round head's modes are not a harmonic series: 1, 1.59, 2.14, 2.30, 2.65 ...", () => {
    const r = modes(D()).map((m) => m.ratio);
    expect(r.slice(0, 5).map((x) => Math.round(x * 100) / 100)).toEqual([1, 1.59, 2.14, 2.3, 2.65]);
    expect(r.every((x, i) => i === 0 || x >= r[i - 1]!)).toBe(true);
  });
  it("a square head's modes go as the root of m squared plus n squared", () => {
    const m = modes(D({ head: "square" }));
    expect(m[0]!.ratio).toBeCloseTo(1, 9); expect(m[1]!.ratio).toBeCloseTo(Math.sqrt(5 / 2), 9); expect(m.find((x) => x.label === "2 by 2")!.ratio).toBeCloseTo(2, 9);
  });
  it("a hit in the dead centre only sets going the patterns that move there", () => {
    const round = modes(D({ strike: 0 }));
    for (const m of round) { if (m.label.startsWith("0 across")) expect(Math.abs(m.amount)).toBeGreaterThan(0.1); else expect(Math.abs(m.amount)).toBeLessThan(1e-3); }
    const square = modes(D({ head: "square", strike: 0 }));
    expect(Math.abs(square.find((x) => x.label === "1 by 2")!.amount)).toBeLessThan(1e-9); expect(Math.abs(square.find((x) => x.label === "1 by 1")!.amount)).toBeCloseTo(1, 9);
    expect(modes(D({ strike: 60 })).filter((m) => Math.abs(m.amount) > 0.05).length).toBeGreaterThan(round.filter((m) => Math.abs(m.amount) > 0.05).length); // off centre: more modes
  });
  it("the sound has each mode at its frequency, and the high ones die sooner the more damping there is", () => {
    const f0 = noteToHz(45), y = renderDrum(D({ strike: 50, damp: 60, decay: 2 }), SR, 1.5);
    expect(strength(y, f0, 0, 0.4)).toBeGreaterThan(strength(y, f0 * 1.3, 0, 0.4) * 8);      // a mode against a gap between modes
    expect(strength(y, f0 * 1.5933, 0, 0.4)).toBeGreaterThan(strength(y, f0 * 1.3, 0, 0.4) * 5);
    const fall = (damp: number) => { const z = renderDrum(D({ strike: 50, damp, decay: 2 }), SR, 1.2), hz = f0 * 2.2954; return strength(z, hz, 0.6, 1.0) / strength(z, hz, 0, 0.3); };
    expect(fall(90)).toBeLessThan(fall(0) * 0.2);
    expect(modeDecay(D({ decay: 2, damp: 0 }), 3)).toBe(2); expect(modeDecay(D({ decay: 2, damp: 50 }), 3)).toBeCloseTo(2 / 3, 9);
    let peak = 0; for (const v of y) peak = Math.max(peak, Math.abs(v)); expect(peak).toBeCloseTo(0.35, 2); expect(Math.abs(y[y.length - 1]!)).toBeLessThan(1e-3);
  });
  it("uses many modes, found by the same function the listed zeros were checked against", () => {
    const z = besselZeros();
    expect(z.length).toBe(12); for (const row of z) { expect(row.length).toBe(7); for (let i = 1; i < row.length; i++) expect(row[i]!).toBeGreaterThan(row[i - 1]!); }
    BESSEL_ZEROS.forEach((row, m) => row.forEach((zero, k) => expect(z[m]![k]!).toBeCloseTo(zero, 3)));
    expect(modes(D()).length).toBe(84); expect(modes(D({ head: "square" })).length).toBe(64);
    expect(Math.max(...modes(D({ strike: 40 })).map((m) => Math.abs(m.amount)))).toBeCloseTo(1, 9);
  });
  it("a hard hit starts sharp and settles to the same pitch; a soft one does not move", () => {
    expect(stretch(0)).toBe(0); expect(stretch(100)).toBeCloseTo(0.07, 9); expect(stretch(50)).toBeLessThan(stretch(100) / 2);
    const f0 = noteToHz(45), y = renderDrum(D({ force: 100, strike: 0, decay: 3, damp: 100 }), SR, 1.6);
    const best = (from: number, to: number) => { let top = -1, at = 0; for (let c = -40; c <= 160; c += 4) { const v = strength(y, f0 * 2 ** (c / 1200), from, to); if (v > top) { top = v; at = c; } } return at; };
    expect(best(0, 0.06)).toBeGreaterThan(40);                 // well sharp in the first instants
    expect(Math.abs(best(0.9, 1.5))).toBeLessThanOrEqual(8);  // and home on the note later
  });
  it("a soft mallet sets going far less of the high modes than a hard stick", () => {
    expect(stickShare(100, 100)).toBeGreaterThan(0.98); expect(stickShare(0, 2000)).toBeLessThan(0.01); expect(stickShare(100, 2000)).toBeGreaterThan(0.3);
    const top = (stick: number) => { const y = renderDrum(D({ stick, strike: 60 }), SR, 0.4), f0 = noteToHz(45); return strength(y, f0 * 6.7, 0, 0.1) / strength(y, f0, 0, 0.1); };
    expect(top(0)).toBeLessThan(top(100) * 0.2);
  });
  it("a second head makes each mode a pair that beats", () => {
    const f0 = noteToHz(45), y = renderDrum(D({ second: 100, strike: 0, decay: 4, damp: 100 }), SR, 1.2);
    expect(strength(y, f0 * SECOND_HEAD, 0, 1)).toBeGreaterThan(strength(y, f0, 0, 1) * 0.3);
    const one = renderDrum(D({ second: 0, strike: 0, decay: 4, damp: 100 }), SR, 1.2);
    expect(strength(one, f0 * SECOND_HEAD * 1.03, 0, 1)).toBeLessThan(strength(one, f0, 0, 1) * 0.1);
  });
});
