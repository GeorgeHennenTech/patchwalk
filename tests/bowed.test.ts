import { describe, expect, it } from "vitest";
import { measuredHarmonics } from "../src/modal/tube";
import { noteToHz } from "../src/synth/params";
import { BOW_INITIAL, bowGrip, bowMap, bowResult, renderBowed, type BowState } from "../src/strings/bowed";

const SR = 48000;
const B = (over: Partial<BowState> = {}): BowState => ({ ...BOW_INITIAL, ...over });
function strength(y: Float32Array, hz: number, from: number, to: number): number {
  let a = 0, b = 0; const i0 = Math.round(from * SR), i1 = Math.round(to * SR);
  for (let i = i0; i < i1; i++) { const w = (2 * Math.PI * hz * i) / SR, win = 0.5 - 0.5 * Math.cos((2 * Math.PI * (i - i0)) / (i1 - i0)); a += y[i]! * win * Math.sin(w); b += y[i]! * win * Math.cos(w); }
  return Math.hypot(a, b) / (i1 - i0);
}
const peakOf = (y: Float32Array, from: number, to: number) => { let p = 0; for (let i = Math.round(from * SR); i < Math.round(to * SR); i++) p = Math.max(p, Math.abs(y[i]!)); return p; };

describe("the bowed string", () => {
  it("holds a note in tune for as long as it is bowed, then rings on and dies away", () => {
    for (const note of [36, 48, 57, 69, 81]) {
      const y = renderBowed(B(), note, SR, 1.2, 1.5), hz = noteToHz(note);
      let best = 0, top = -1; for (let c = -40; c <= 40; c += 2) { const v = strength(y, hz * 2 ** (c / 1200), 0.5, 1.1); if (v > top) { top = v; best = c; } }
      expect(Math.abs(best), `note ${note}`).toBeLessThanOrEqual(6);
      expect(peakOf(y, 0.8, 1.1), `note ${note}`).toBeGreaterThan(0.2);
      expect(peakOf(y, 1.25, 1.3)).toBeGreaterThan(0.02);                           // still ringing just after the bow lifts
      expect(peakOf(y, 2.5, 2.7), `note ${note}`).toBeLessThan(peakOf(y, 1.25, 1.3) * 0.5); // and fading
    }
  });
  it("has every harmonic, odd and even, falling away gradually: a saw-like tone", () => {
    const h = measuredHarmonics(renderBowed(B(), 57, SR, 1.2, 0), noteToHz(57), SR, 8);
    expect(h[0]).toBe(1); for (const n of [1, 2, 3]) expect(h[n]!, `harmonic ${n + 1}`).toBeGreaterThan(0.1);
  });
  it("a still bow makes no sound, and a faster bow is louder", () => {
    expect(peakOf(renderBowed(B({ speed: 0 }), 57, SR, 1, 0), 0.2, 0.9)).toBe(0);
    const slow = peakOf(renderBowed(B({ speed: 15 }), 57, SR, 1.2, 0), 0.8, 1.1), fast = peakOf(renderBowed(B({ speed: 70, pressure: 80 }), 57, SR, 1.2, 0), 0.8, 1.1);
    expect(fast).toBeGreaterThan(slow * 1.5);
  });
  it("too fast and too light, the note jumps up; the map of results has all three regions in sensible places", () => {
    expect(bowResult(B())).toBe("note"); expect(bowResult(B({ speed: 0 }))).toBe("silent"); expect(bowResult(B({ speed: 95, pressure: 5 }))).toBe("jumped");
    const map = bowMap(B());
    expect(map[0]!.every((r) => r === "note")).toBe(true);                  // hardest pressure: a note at every speed
    expect(map[map.length - 1]!.includes("jumped")).toBe(true);             // lightest pressure: jumps somewhere
    expect(map[map.length - 1]![0]).toBe("note");                           // but not at the slowest speed
    for (const row of map) { const first = row.indexOf("jumped"); if (first >= 0) expect(row.slice(0, first).every((r) => r === "note")).toBe(true); }
  });
  it("the bow's grip is full when the string moves with it and falls off as it slips, sooner under light pressure", () => {
    expect(bowGrip(0, 50)).toBe(1); expect(bowGrip(1, 50)).toBeLessThan(0.05); expect(bowGrip(0.2, 100)).toBeGreaterThan(bowGrip(0.2, 0));
    let peak = 0; for (const v of renderBowed(B({ speed: 100, pressure: 100, bright: 100 }), 30, SR, 1.5)) peak = Math.max(peak, Math.abs(v)); expect(peak).toBeLessThan(4);
  });
  it("the quick trial behind the map agrees with the note as it is really played", () => {
    let same = 0, all = 0;
    for (const speed of [5, 35, 65, 95]) for (const pressure of [5, 35, 65, 95]) { all++; if (bowResult(B({ speed, pressure })) === bowResult(B({ speed, pressure }), 45, SR)) same++; }
    expect(same / all).toBeGreaterThanOrEqual(0.85);
  });
});
