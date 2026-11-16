import { describe, expect, it } from "vitest";
import { noteToHz } from "../src/synth/params";
import { bellHz, measuredHarmonics, reedReflection, renderTube, speakingRange, speaks, TUBE_INITIAL, type TubeState } from "../src/modal/tube";

const SR = 48000;
const T = (over: Partial<TubeState> = {}): TubeState => ({ ...TUBE_INITIAL, ...over });
function strength(y: Float32Array, hz: number, from: number, to: number): number {
  let a = 0, b = 0; const i0 = Math.round(from * SR), i1 = Math.round(to * SR);
  for (let i = i0; i < i1; i++) { const w = (2 * Math.PI * hz * i) / SR, win = 0.5 - 0.5 * Math.cos((2 * Math.PI * (i - i0)) / (i1 - i0)); a += y[i]! * win * Math.sin(w); b += y[i]! * win * Math.cos(w); }
  return Math.hypot(a, b) / (i1 - i0);
}
const peakOf = (y: Float32Array, from: number, to: number) => { let p = 0; for (let i = Math.round(from * SR); i < Math.round(to * SR); i++) p = Math.max(p, Math.abs(y[i]!)); return p; };

describe("the blown tube", () => {
  it("holds a note for as long as it is blown, in tune, and stops when the breath stops", () => {
    for (const note of [40, 57, 69, 84]) {
      const y = renderTube(T(), note, SR, 1.2), hz = noteToHz(note);
      let best = 0, top = -1; for (let c = -40; c <= 40; c += 2) { const v = strength(y, hz * 2 ** (c / 1200), 0.4, 1.1); if (v > top) { top = v; best = c; } }
      expect(Math.abs(best), `note ${note}`).toBeLessThanOrEqual(6);
      expect(peakOf(y, 0.8, 1.1), `note ${note}`).toBeGreaterThan(0.2);
      expect(peakOf(y, 1.4, 1.45), `note ${note}`).toBeLessThan(0.02);
    }
  });
  it("sounds hollow: the odd harmonics are there and the even ones are all but missing", () => {
    const y = renderTube(T({ noise: 0 }), 57, SR, 1.2), h = measuredHarmonics(y, noteToHz(57), SR);
    expect(h[0]).toBe(1); expect(h[2]!).toBeGreaterThan(0.1); expect(h[4]!).toBeGreaterThan(0.02);
    expect(h[1]!).toBeLessThan(0.02); expect(h[3]!).toBeLessThan(0.02);
  });
  it("is mellow, not a buzz: the harmonics fall away going up, sooner on a dull tube, and never less than four times the note is sent back", () => {
    const h = (bright: number) => measuredHarmonics(renderTube(T({ bright, noise: 0 }), 57, SR, 1.2), noteToHz(57), SR);
    const mid = h(45), dull = h(0), bright = h(100);
    expect(mid[8]!).toBeLessThan(mid[2]! * 0.1);       // the ninth is more than 20 dB under the third (in a square wave it is under 10)
    expect(dull[6]!).toBeLessThan(mid[6]! * 0.5); expect(bright[6]!).toBeGreaterThan(mid[6]! * 2);
    expect(bellHz(0, 110, SR)).toBeCloseTo(900, 6); expect(bellHz(0, 1000, SR)).toBeCloseTo(4000, 6); expect(bellHz(100, 110, SR)).toBeGreaterThan(4000);
  });
  it("needs enough breath to speak, and too much blows the reed shut", () => {
    expect(speaks(T(), 10)).toBe(false); expect(speaks(T(), 65)).toBe(true);
    const loose = speakingRange(T({ reed: 0 })), stiff = speakingRange(T({ reed: 100 }));
    const first = (r: boolean[]) => r.indexOf(true) * 5, last = (r: boolean[]) => r.lastIndexOf(true) * 5;
    expect(first(loose)).toBeLessThan(first(stiff));   // a loose reed speaks with less breath
    expect(last(loose)).toBeLessThan(100);             // and is blown shut before full breath
    expect(last(stiff)).toBeGreaterThan(last(loose));  // a stiff reed takes harder blowing
    for (const r of [loose, stiff, speakingRange(T())]) { const on = r.map((v, i) => (v ? i : -1)).filter((i) => i >= 0); expect(on.length).toBeGreaterThanOrEqual(3); expect(on[on.length - 1]! - on[0]!).toBe(on.length - 1); } // one unbroken stretch
  });
  it("the reed's reflection stays within -1 and 1, and a loose reed rests nearer shut", () => {
    for (const d of [-3, -1, 0, 1, 3]) for (const reed of [0, 50, 100]) expect(Math.abs(reedReflection(d, reed))).toBeLessThanOrEqual(1);
    expect(reedReflection(0, 0)).toBeGreaterThan(reedReflection(0, 100));
    let peak = 0; for (const v of renderTube(T({ breath: 100, reed: 100, bright: 100, noise: 100 }), 30, SR, 1)) peak = Math.max(peak, Math.abs(v)); expect(peak).toBeLessThan(2.5);
  });
});
