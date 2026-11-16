import { describe, expect, it } from "vitest";
import { noteToHz } from "../src/synth/params";
import { excitation, judgeString, stringTarget, loopFor, pairBeatHz, highsLast, lossGain, lossPole, throughBody, pluckHarmonics, pluckShape, renderString, STRING_INITIAL, tripGain, type StringState } from "../src/strings/string";

const SR = 48000;
// the bare string (no body) for exact checks
const S = (over: Partial<StringState> = {}): StringState => ({ ...STRING_INITIAL, body: 0, bright: 60, hard: 60, ...over });
/** How strongly a list of samples contains a sine at `hz` (between `from` and `to` seconds). */
function strength(y: Float32Array, hz: number, from = 0, to = y.length / SR): number {
  let a = 0, b = 0; const i0 = Math.round(from * SR), i1 = Math.round(to * SR);
  for (let i = i0; i < i1; i++) { const w = (2 * Math.PI * hz * i) / SR, win = 0.5 - 0.5 * Math.cos((2 * Math.PI * (i - i0)) / (i1 - i0)); a += y[i]! * win * Math.sin(w); b += y[i]! * win * Math.cos(w); }
  return Math.hypot(a, b) / (i1 - i0);
}
/** The pitch actually played, in cents away from the pitch asked for. */
function centsOff(y: Float32Array, hz: number): number {
  let best = 0, top = -1;
  for (let c = -40; c <= 40; c += 1) { const v = strength(y, hz * 2 ** (c / 1200), 0.05, 1.05); if (v > top) { top = v; best = c; } }
  return best;
}

describe("the plucked string", () => {
  it("plays in tune from low notes to very high ones, bright or dull", () => {
    for (const note of [28, 40, 57, 69, 84, 96]) for (const bright of [0, 60, 100]) {
      const y = renderString(S({ bright, decay: 6 }), note, SR, 1.2);
      expect(Math.abs(centsOff(y, noteToHz(note))), `note ${note} bright ${bright}`).toBeLessThanOrEqual(3);
    }
  });
  it("fades at the rate asked for: the fundamental falls 60 dB in the decay time", () => {
    for (const decay of [1, 3]) {
      const y = renderString(S({ decay, bright: 70 }), 57, SR, decay * 0.75), hz = noteToHz(57);
      const early = strength(y, hz, 0.1, 0.2), late = strength(y, hz, 0.1 + decay / 2, 0.2 + decay / 2);
      expect(20 * Math.log10(late / early), `decay ${decay}`).toBeCloseTo(-30, 0); // half the time, half the 60 dB
    }
  });
  it("the highs die sooner than the lows, and sooner still on a dull string", () => {
    const fall = (bright: number, n: number) => { const y = renderString(S({ bright, decay: 4, pick: 13 }), 45, SR, 0.6), hz = noteToHz(45) * n; return 20 * Math.log10(strength(y, hz, 0.25, 0.45) / strength(y, hz, 0.02, 0.22)); };
    expect(fall(30, 10)).toBeLessThan(fall(30, 1) - 6);
    expect(fall(30, 10)).toBeLessThan(fall(90, 10) - 6);
    expect(highsLast(0)).toBeCloseTo(0.02, 9); expect(highsLast(100)).toBeCloseTo(0.52, 9);
    expect(lossGain(0.5, 0, SR)).toBeCloseTo(1, 9); expect(lossGain(0.5, 12000, SR)).toBeLessThan(lossGain(0.5, 200, SR));
    expect(lossPole(S({ bright: 0 }), 110, SR)).toBeGreaterThan(lossPole(S({ bright: 100 }), 110, SR));
    expect(tripGain(110, 3)).toBeCloseTo(10 ** (-3 / 330), 12);
  });
  it("plucking at a half leaves out every second harmonic, and at a third every third", () => {
    const hz = noteToHz(45);
    const half = renderString(S({ pick: 50, hard: 100, bright: 100, decay: 6 }), 45, SR, 0.6);
    expect(strength(half, hz * 2, 0.05, 0.5)).toBeLessThan(strength(half, hz, 0.05, 0.5) * 0.02);
    expect(strength(half, hz * 3, 0.05, 0.5)).toBeGreaterThan(strength(half, hz, 0.05, 0.5) * 0.15);
    const h = pluckHarmonics(S({ pick: 100 / 3, hard: 100 }), hz, SR);
    expect(Math.abs(h[3]!)).toBeLessThan(1e-6); expect(Math.abs(h[6]!)).toBeLessThan(1e-6); expect(Math.abs(h[2]!)).toBeGreaterThan(0.2);
    const heard = pluckHarmonics(S({ pick: 13, pickup: 25, hard: 100 }), hz, SR); // listening a quarter of the way along
    expect(Math.abs(heard[4]!)).toBeLessThan(1e-6); expect(Math.abs(heard[1]!)).toBeGreaterThan(0.1);
  });
  it("a soft pick takes away the top; a burst of noise still becomes the same note", () => {
    const hz = noteToHz(45), soft = pluckHarmonics(S({ hard: 0 }), hz, SR), hard = pluckHarmonics(S({ hard: 100 }), hz, SR);
    expect(Math.abs(soft[15]! / soft[1]!)).toBeLessThan(Math.abs(hard[15]! / hard[1]!) * 0.3);
    const y = renderString(S({ exciter: "noise", decay: 6 }), 57, SR, 1.2);
    expect(Math.abs(centsOff(y, noteToHz(57)))).toBeLessThanOrEqual(3);
    expect(Array.from(renderString(S({ exciter: "noise" }), 57, SR, 0.1))).toEqual(Array.from(renderString(S({ exciter: "noise" }), 57, SR, 0.1))); // repeatable
  });
  it("never blows up, starts at a sensible level, and the picture's string peaks where it is plucked", () => {
    for (const s of [S({ bright: 100, decay: 8 }), S({ bright: 0, decay: 0.2 }), S({ exciter: "noise", hard: 100, bright: 100, decay: 8 })]) for (const note of [24, 60, 100]) {
      const y = renderString(s, note, SR, 2); let peak = 0; for (const v of y) peak = Math.max(peak, Math.abs(v));
      expect(peak, `note ${note}`).toBeLessThan(1.5); expect(peak).toBeGreaterThan(0.2); expect(Math.abs(y[y.length - 1]!)).toBeLessThan(0.01);
      expect(loopFor(s, noteToHz(note), SR).gain).toBeLessThan(1);
    }
    expect(Math.max(...Array.from(excitation(S(), 110, SR)).map(Math.abs))).toBeCloseTo(0.6, 6);
    expect(pluckShape(S({ pick: 20 }), 0.2)).toBeCloseTo(1, 9); expect(pluckShape(S({ pick: 20 }), 0)).toBe(0); expect(pluckShape(S({ pick: 20 }), 1)).toBe(0);
  });
  it("a second string a few cents away makes the note swell and fade at the difference between them", () => {
    const hz = noteToHz(57), beat = pairBeatHz(hz, 10);
    expect(beat).toBeCloseTo(hz * (2 ** (10 / 1200) - 1), 9); expect(beat).toBeGreaterThan(1.2); expect(beat).toBeLessThan(1.35);
    const y = renderString(S({ pair: 10, decay: 8, bright: 100 }), 57, SR, 1.2);
    const level = (t: number) => { let p = 0; for (let i = Math.round(t * SR); i < Math.round((t + 0.03) * SR); i++) p = Math.max(p, Math.abs(y[i]!)); return p; };
    const half = 0.5 / beat; // half a beat after the start the two are out of step and nearly cancel
    expect(level(half)).toBeLessThan(level(0.02) * 0.45); expect(level(2 * half)).toBeGreaterThan(level(half) * 1.3);
    expect(Array.from(renderString(S({ pair: 0 }), 57, SR, 0.05))).toEqual(Array.from(renderString(S(), 57, SR, 0.05)));
  });
  it("match by ear: the verdict says which way each control is off, and never passes a wrong string", () => {
    const t = S({ bright: 65, decay: 4, pick: 30 });
    expect(judgeString(S({ bright: 60, decay: 3.2, pick: 34 }), t)).toEqual({ bright: "matches", decay: "matches", pick: "matches", all: true });
    expect(judgeString(S({ bright: 20, decay: 9, pick: 30 }), t)).toEqual({ bright: "low", decay: "high", pick: "matches", all: false });
    expect(judgeString(S({ bright: 95, decay: 1, pick: 50 }), t)).toEqual({ bright: "high", decay: "low", pick: "high", all: false });
    expect(judgeString(S({ bright: 65, decay: 4, pick: 30, exciter: "noise" }), t).all).toBe(false);
    const seen = new Set<string>();
    for (let i = 0; i < 80; i++) { const x = stringTarget(); seen.add(`${x.bright}|${x.decay}|${x.pick}`); expect(x.hard).toBe(STRING_INITIAL.hard); expect(x.pair).toBe(0); expect(judgeString(x, x).all).toBe(true); }
    expect(seen.size).toBeGreaterThan(20); // plenty of different targets
  });
  it("the highs last the share of the note that the brightness says: far shorter than the fundamental", () => {
    for (const bright of [20, 60, 100]) {
      const decay = 4, hz = noteToHz(45), y = renderString(S({ bright, decay, pick: 7, hard: 100 }), 45, SR, 1.3), n = 18; // harmonic 18 is 1980 Hz, where the highs are judged
      const fell = 20 * Math.log10(strength(y, hz * n, 0.35, 0.55) / strength(y, hz * n, 0.05, 0.25)); // over 0.3 s
      const want = (-60 * 0.3) / (decay * highsLast(bright));
      expect(fell, `bright ${bright}`).toBeGreaterThan(want * 1.35); expect(fell, `bright ${bright}`).toBeLessThan(want * 0.65);
    }
  });
  it("the body adds its own resonances whatever the note, softens the top, and leaves the bare string alone at 0", () => {
    const bare = renderString(S({ body: 0 }), 64, SR, 0.5), boxed = renderString(S({ body: 100 }), 64, SR, 0.5);
    expect(Array.from(throughBody(bare, 0, SR).slice(0, 50))).toEqual(Array.from(bare.slice(0, 50)));
    const rel = (y: Float32Array, hz: number) => strength(y, hz, 0, 0.12) / strength(y, noteToHz(64), 0, 0.12);
    expect(rel(boxed, 205)).toBeGreaterThan(rel(bare, 205) * 3);            // a body resonance well below the note is now ringing
    expect(rel(boxed, noteToHz(64) * 20)).toBeLessThan(rel(bare, noteToHz(64) * 20)); // and the far top is softer
    let peak = 0; for (const v of boxed) peak = Math.max(peak, Math.abs(v)); expect(peak).toBeLessThan(1.6);
  });
});
