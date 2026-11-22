import { describe, expect, it } from "vitest";
import { alignFundamental, averagePeriod, binCommand, BINS, blank, blurFrames, crossfadeEdges, draw, fadeEdges, flipHorizontal, flipVertical, FRAME, fromBins, fromFunction, fromImage, harmonicsOf, insertAfter, joinPairs, keepRange, lowPass, MAX_FRAMES, morphAt, moveFrame, normalize, normalizeSame, pasteFrames, peakOf, periodOf, pwmFrom, randomList, readWav, reduceTo, removeDc, removeFundamental, removeLowSpectra, removeRange, renderMorph, rotate, sampleRedux, sawFrame, setBin, setPhasesFrom, setSpectraFrom, shiftToZero, sortFrames, sortKey, splitByHarmonics, splitFixed, splitFollowing, splitHalves, splitSizeOf, splitSpectral, subtractSpectra, table8bit, tableWav, toBins, zeroPhases, type Wave } from "../src/synth/wtedit";
import { applyFormula, FORMULA_EXAMPLES, FORMULA_FRAMES, readFormula } from "../src/synth/wtformula";

const sine = (k = 1, amp = 1, phase = 0) => fromFunction((t) => amp * Math.sin(2 * Math.PI * (k * t + phase)));
const near = (a: Wave, b: Wave, tol = 1e-3) => { let worst = 0; for (let i = 0; i < FRAME; i++) worst = Math.max(worst, Math.abs(a[i]! - b[i]!)); expect(worst).toBeLessThan(tol); };
const tone = (hz: number, seconds: number, rate = 44100, harmonics = [1, 0.5, 0.3]) => Float32Array.from({ length: Math.round(seconds * rate) }, (_, i) => harmonics.reduce((s, a, h) => s + a * Math.sin((2 * Math.PI * (h + 1) * hz * i) / rate), 0) * 0.4);

describe("wavetable editor: a frame as harmonics", () => {
  it("measures a sine as one harmonic with the right strength and phase, and builds the wave back", () => {
    const b = toBins(sine(3, 0.5, 0.25));
    expect(b.mag[3]!).toBeCloseTo(0.5, 5); expect(b.phase[3]!).toBeCloseTo(0.25, 5); expect(b.mag[2]!).toBeLessThan(1e-6); expect(b.dc).toBeCloseTo(0, 6);
    const w = fromFunction((t) => 0.3 + 0.4 * Math.sin(2 * Math.PI * t) + 0.2 * Math.cos(2 * Math.PI * 5 * t) - 0.1 * Math.sin(2 * Math.PI * 40 * t));
    near(fromBins(toBins(w)), w, 1e-5);
    near(fromBins(toBins(sawFrame())), sawFrame(), 1e-4);                                    // even with a jump in it
  });
  it("hands the synth harmonics on its own scale: a full saw's first harmonic is 1", () => {
    const h = harmonicsOf(fromFunction((t) => 2 * t - 1), 8);
    expect(Math.hypot(h.sin[1]!, h.cos[1]!)).toBeCloseTo(1, 2); expect(Math.hypot(h.sin[4]!, h.cos[4]!)).toBeCloseTo(0.25, 2);
  });
});

describe("wavetable editor: one frame", () => {
  it("normalises, removes an offset, flips and turns the cycle", () => {
    expect(peakOf(normalize(sine(1, 0.25)))).toBeCloseTo(1, 4);
    expect(removeDc(fromFunction(() => 0.7)).every((v) => Math.abs(v) < 1e-6)).toBe(true);
    near(flipVertical(sine()), sine(1, -1)); near(flipHorizontal(flipHorizontal(sawFrame())), sawFrame());
    const turned = shiftToZero(sine(1, 1, 0.3)); expect(turned[0]!).toBeGreaterThan(0); expect(turned[FRAME - 1]!).toBeLessThanOrEqual(0);
    near(rotate(sine(), FRAME / 4), sine(1, 1, 0.25)); near(alignFundamental(sine(1, 1, 0.4)), sine(), 0.01);
  });
  it("fades and crossfades the edges so the cycle joins itself", () => {
    const f = fadeEdges(fromFunction(() => 1), 8); expect(f[0]).toBe(0); expect(f[FRAME - 1]).toBe(0); expect(f[FRAME / 2]).toBe(1);
    const x = crossfadeEdges(fromFunction((t) => t), 64); expect(Math.abs(x[0]! - x[FRAME - 1]!)).toBeLessThan(1e-6); expect(x[FRAME / 2]!).toBeCloseTo(0.5, 5);
  });
  it("filters, crushes and removes the low end by harmonics", () => {
    const b = toBins(lowPass(sawFrame(), 8)); expect(b.mag[8]!).toBeGreaterThan(0.01); expect(b.mag[9]!).toBeLessThan(1e-6);
    const held = sampleRedux(sawFrame(), 64); expect(held[1]).toBe(held[0]); expect(held[63]).toBe(held[0]); expect(held[64]).not.toBe(held[0]);
    expect(toBins(removeFundamental(sawFrame())).mag[1]!).toBeLessThan(1e-6); expect(toBins(removeFundamental(sawFrame())).mag[2]!).toBeGreaterThan(0.1);
    const low = toBins(removeLowSpectra(sawFrame(), 4)); expect(low.mag[4]!).toBeLessThan(1e-6); expect(low.mag[5]!).toBeGreaterThan(0.01);
    const z = toBins(zeroPhases(sine(2, 1, 0.3))); expect(z.phase[2]!).toBeCloseTo(0, 5); expect(z.mag[2]!).toBeCloseTo(1, 4);
  });
});

describe("wavetable editor: drawing tools", () => {
  it("each tool draws its shape in one grid step and leaves the rest alone", () => {
    const flat = draw(blank(), "flat", 1, 4, 0.5); expect(flat[FRAME / 4]).toBe(0.5); expect(flat[FRAME / 2 - 1]).toBe(0.5); expect(flat[FRAME / 2]).toBe(0); expect(flat[0]).toBe(0);
    const up = draw(blank(), "up", 0, 4, 1); expect(up[0]).toBeCloseTo(-1, 5); expect(up[FRAME / 4 - 1]).toBeCloseTo(1, 5);
    const peak = draw(blank(), "peak", 0, 2, 0.8); expect(peak[FRAME / 4]!).toBeCloseTo(0.8, 2); expect(peak[0]).toBeCloseTo(0, 5);
    const valley = draw(blank(), "valley", 0, 2, 0.8); expect(valley[FRAME / 4]!).toBeCloseTo(-0.8, 2);
    // the sine tool at a grid of 4, drawn in every step, is the fourth harmonic and nothing else
    let four = blank(); for (let s = 0; s < 4; s++) four = draw(four, "sine", s, 4, 1);
    const b = toBins(four); expect(b.mag[4]!).toBeCloseTo(1, 2); expect(b.mag[1]!).toBeLessThan(0.01); expect(b.mag[8]!).toBeLessThan(0.01);
  });
  it("join tools connect the ends, nudge clips, noise is repeatable, mirror draws the other side", () => {
    const stepped = fromFunction((t) => (t < 0.5 ? -1 : 1)), joined = draw(stepped, "line", 1, 4, 0);
    expect(joined[FRAME / 4]).toBe(-1); expect(joined[FRAME / 4 + FRAME / 8]!).toBeCloseTo(0, 2);
    expect(draw(fromFunction(() => 0.8), "nudge", 0, 4, 0.5)[10]).toBe(1);
    expect(draw(blank(), "noise", 0, 4, 0.5, false, 7)).toEqual(draw(blank(), "noise", 0, 4, 0.5, false, 7));
    expect(draw(blank(), "noise", 0, 4, 0.5, false, 7)).not.toEqual(draw(blank(), "noise", 0, 4, 0.5, false, 8));
    const m = draw(blank(), "up", 0, 4, 1, true); expect(m[0]).toBeCloseTo(-1, 5); expect(m[FRAME - 1]).toBeCloseTo(-1, 5); expect(m[FRAME - FRAME / 4]).toBeCloseTo(1, 5);
  });
});

describe("wavetable editor: the harmonic area", () => {
  it("clears above and below, makes a saw, shifts octaves and repeats a group", () => {
    const saw = binCommand(blank(), "saw"), sb = toBins(saw); for (const k of [1, 2, 7, BINS]) expect(sb.mag[k]!).toBeCloseTo(2 / (Math.PI * k), 5); expect(sb.mag[BINS + 1]!).toBeLessThan(1e-6); expect(saw[FRAME / 4]!).toBeCloseTo(0.5, 1);
    expect(toBins(binCommand(saw, "clearHigh", 6)).mag[7]!).toBeLessThan(1e-6); expect(toBins(binCommand(saw, "clearLow", 6)).mag[5]!).toBeLessThan(1e-6);
    expect(peakOf(binCommand(saw, "clearAll"))).toBeLessThan(1e-6);
    const up = toBins(binCommand(sine(3), "octaveUp")); expect(up.mag[6]!).toBeCloseTo(1, 4); expect(up.mag[3]!).toBeLessThan(1e-6);
    expect(toBins(binCommand(sine(6), "octaveDown")).mag[3]!).toBeCloseTo(1, 4);
    const rep = toBins(binCommand(fromBins({ ...toBins(blank()), mag: Float32Array.from({ length: FRAME / 2 + 1 }, (_, k) => (k === 1 ? 1 : k === 2 ? 0.5 : 0)) }), "repeat", 3));
    expect(rep.mag[4]!).toBeCloseTo(1, 4); expect(rep.mag[5]!).toBeCloseTo(0.5, 4); expect(rep.mag[6]!).toBeLessThan(1e-6); expect(rep.mag[7]!).toBeCloseTo(1, 4);
  });
  it("random commands are repeatable and only touch what they say; one bar can be set by hand", () => {
    expect(binCommand(sawFrame(), "randomAll", 1, 5)).toEqual(binCommand(sawFrame(), "randomAll", 1, 5));
    const low = toBins(binCommand(binCommand(blank(), "saw"), "randomLow", 1, 3, 8)), saw = toBins(binCommand(blank(), "saw"));
    expect(low.mag[20]!).toBeCloseTo(saw.mag[20]!, 5);
    const gaps = toBins(binCommand(binCommand(blank(), "saw"), "gaps", 1, 9)); let gone = 0; for (let k = 2; k <= 64; k++) if (gaps.mag[k]! < 1e-6) gone++; expect(gone).toBeGreaterThan(15); expect(gone).toBeLessThan(50);
    expect(toBins(binCommand(binCommand(blank(), "saw"), "fade")).mag[16]!).toBeCloseTo(saw.mag[16]! / 4, 5);
    const set = toBins(setBin(setBin(blank(), 5, "mag", 0.7), 5, "phase", 0.25)); expect(set.mag[5]!).toBeCloseTo(0.7, 4); expect(set.phase[5]!).toBeCloseTo(0.25, 4);
  });
});

describe("wavetable editor: the list of frames", () => {
  const set = [sine(1), sine(2), sine(3), sine(4), sine(5)];
  const which = (frames: Wave[]) => frames.map((f) => sortKey(f, "peakBin"));
  it("inserts, removes, keeps, thins, moves and pastes", () => {
    expect(which(insertAfter(set, 1, sine(9)))).toEqual([1, 2, 9, 3, 4, 5]);
    expect(which(removeRange(set, 1, 3))).toEqual([1, 5]); expect(removeRange([sine()], 0, 0)).toHaveLength(1);
    expect(which(keepRange(set, 1, 2))).toEqual([2, 3]); expect(which(reduceTo(set, 2))).toEqual([1, 3, 5]);
    expect(which(moveFrame(set, 0, 3))).toEqual([2, 3, 4, 1, 5]); expect(which(pasteFrames(set, 3, [sine(7), sine(8), sine(9)]))).toEqual([1, 2, 3, 7, 8, 9]);
    expect(insertAfter(Array.from({ length: MAX_FRAMES }, () => blank()), 0)).toHaveLength(MAX_FRAMES);
  });
  it("sorts by what each sort names", () => {
    const mixed = [sine(5), sine(1), sine(3)];
    expect(which(sortFrames(mixed, "peakBin"))).toEqual([1, 3, 5]); expect(which(sortFrames(mixed, "reverse"))).toEqual([3, 1, 5]);
    expect(which(sortFrames([sine(2, 0.9), sine(2, 0.1), sine(2, 0.5)], "peakAmount")).length).toBe(3);
    expect(sortFrames([sine(1, 0.9), sine(1, 0.1), sine(1, 0.5)], "fundamental").map((f) => +peakOf(f).toFixed(1))).toEqual([0.1, 0.5, 0.9]);
    expect(sortKey(sawFrame(), "count")).toBeGreaterThan(sortKey(sine(), "count")); expect(sortKey(sine(7), "highest")).toBe(7);
    expect(sortKey(sawFrame(), "average")).toBeGreaterThan(sortKey(sine(), "average"));
    expect(sortFrames(set, "random", 3)).toEqual(sortFrames(set, "random", 3)); expect(new Set(which(sortFrames(set, "random", 3)))).toEqual(new Set([1, 2, 3, 4, 5]));
  });
  it("whole-table commands: same gain for all, halves and pairs, pulse width, spectra and phases from another frame", () => {
    const same = normalizeSame([sine(1, 0.5), sine(1, 0.25)]); expect(peakOf(same[0]!)).toBeCloseTo(1, 4); expect(peakOf(same[1]!)).toBeCloseTo(0.5, 4);
    const halves = splitHalves([sine(2)]); expect(halves).toHaveLength(2); expect(sortKey(halves[0]!, "peakBin")).toBe(1);
    const pair = joinPairs([sine(1), sine(1)]); expect(pair).toHaveLength(1); expect(sortKey(pair[0]!, "peakBin")).toBe(2);
    const pwm = pwmFrom(fromFunction((t) => (t < 0.5 ? 1 : -1)), 8); expect(pwm).toHaveLength(8); near(pwm[0]!, fromFunction((t) => (t < 0.5 ? 1 : -1)));
    expect(pwm[7]![Math.floor(FRAME * 0.04)]).toBe(-1);                                      // the wave is over within a twentieth of the cycle
    const borrowed = toBins(setSpectraFrom(sine(2, 1, 0.3), sine(5, 0.4))); expect(borrowed.mag[5]!).toBeCloseTo(0.4, 4); expect(borrowed.mag[2]!).toBeLessThan(1e-6);
    expect(toBins(setPhasesFrom(sine(2), sine(2, 1, 0.2))).phase[2]!).toBeCloseTo(0.2, 4);
    expect(toBins(subtractSpectra(sine(2, 0.8), sine(2, 0.5))).mag[2]!).toBeCloseTo(0.3, 4);
    const blurred = blurFrames([sine(1, 1), sine(1, 0), sine(1, 1)], 1, "mag"); expect(toBins(blurred[1]!).mag[1]!).toBeCloseTo(2 / 3, 3);
  });
});

describe("wavetable editor: morphing", () => {
  it("none steps, crossfade mixes the waves, spectral moves each harmonic", () => {
    const a = sine(1), b = sine(1, 1, 0.5);                                                   // the same tone, upside down
    near(morphAt([a, b], 0.4, "none"), a); near(morphAt([a, b], 0.6, "none"), b);
    expect(peakOf(morphAt([a, b], 0.5, "crossfade"))).toBeLessThan(1e-4);                    // mixing opposite waves cancels
    expect(peakOf(morphAt([a, b], 0.5, "spectral"))).toBeCloseTo(1, 2);                      // moving the phase keeps the tone whole
    near(morphAt([sine(1), sine(3)], 0.5, "spectral"), fromFunction((t) => 0.5 * Math.sin(2 * Math.PI * t) + 0.5 * Math.sin(6 * Math.PI * t)), 1e-3);
    const made = renderMorph([sine(1), sine(3)], "crossfade", 5); expect(made).toHaveLength(5); near(made[0]!, sine(1)); near(made[4]!, sine(3));
  });
});

describe("wavetable editor: bringing sound in", () => {
  it("finds the length of a cycle and cuts whole cycles out", () => {
    const s = tone(441, 0.5);                                                                // exactly 100 samples a cycle
    expect(periodOf(s)).toBeCloseTo(100, 0); expect(averagePeriod(s)).toBeCloseTo(100, 0);
    expect(periodOf(Float32Array.from(randomList(8192, 5), (v) => v * 2 - 1))).toBe(0);
    const frames = splitFixed(s, 100); expect(frames.length).toBe(220); expect(sortKey(frames[3]!, "peakBin")).toBe(1);
    expect(toBins(frames[3]!).mag[2]! / toBins(frames[3]!).mag[1]!).toBeCloseTo(0.5, 1);
    expect(splitFixed(s, 100, 16)).toHaveLength(16);
  });
  it("follows a bending pitch, with and without snapping cuts to zero crossings", () => {
    let phase = 0; const bend = Float32Array.from({ length: 22050 }, (_, i) => { phase += (2 * Math.PI * (200 + 100 * (i / 22050))) / 44100; return 0.5 * Math.sin(phase) + 0.2 * Math.sin(2 * phase); });
    for (const snap of [false, true]) {
      const frames = splitFollowing(bend, snap, 64); expect(frames.length).toBeGreaterThan(20);
      for (const f of [frames[2]!, frames[Math.floor(frames.length / 2)]!, frames[frames.length - 3]!]) expect(sortKey(f, "peakBin")).toBe(1);
    }
  });
  it("rebuilds frames from measured harmonics when the cycle is not a whole number of samples", () => {
    const frames = splitByHarmonics(tone(331.7, 0.6), 8); expect(frames).toHaveLength(8);
    const b = toBins(frames[4]!); expect(b.mag[2]! / b.mag[1]!).toBeCloseTo(0.5, 1); expect(b.mag[3]! / b.mag[1]!).toBeCloseTo(0.3, 1); expect(b.mag[4]! / b.mag[1]!).toBeLessThan(0.03);
  });
  it("turns blocks of sound into harmonics, pictures into frames, and typed sizes into cycle lengths", () => {
    const blocks = splitSpectral(tone(44100 / 64, 0.5), 1024, 8); expect(blocks).toHaveLength(8); expect(sortKey(blocks[2]!, "peakBin")).toBe(16); // 1024 / 64
    const picture = Uint8Array.from({ length: 4 * 8 }, (_, i) => (i % 4 === 0 ? (Math.floor(i / 4) < 4 ? 255 : 0) : 128));
    const img = fromImage(picture, 4, 8); expect(img).toHaveLength(4); expect(img[0]![0]!).toBeGreaterThan(0.4); expect(img[0]![FRAME - 1]!).toBeLessThan(-0.4); expect(peakOf(img[1]!)).toBeLessThan(1e-6);
    expect(splitSizeOf("2048")).toBe(2048); expect(splitSizeOf("A4")).toBe(100); expect(splitSizeOf("C#2")).toBe(636); expect(splitSizeOf("12")).toBeUndefined(); expect(splitSizeOf("sin(x)")).toBeUndefined();
  });
});

describe("wavetable editor: files out and in", () => {
  it("writes WAV files a reader gets the same frames back from, and the 8-bit form", () => {
    const frames = [sine(1, 0.5), sawFrame()];
    for (const bits of [16, 32] as const) {
      const file = tableWav(frames, bits), back = readWav(file)!;
      expect(back.rate).toBe(44100); expect(back.samples.length).toBe(2 * FRAME);
      near(back.samples.slice(0, FRAME), frames[0]!, bits === 16 ? 1e-4 : 1e-7); near(back.samples.slice(FRAME), frames[1]!, bits === 16 ? 1e-4 : 1e-7);
    }
    const eight = table8bit(frames); expect(eight.length).toBe(512); expect(eight[64]).toBeGreaterThan(180); expect(eight[192]).toBeLessThan(75);
    expect(readWav(new Uint8Array(100))).toBeUndefined();
  });
});

describe("wavetable editor: the formula box", () => {
  const run = (text: string, frames: Wave[] = [sawFrame()], sel = 0) => { const r = readFormula(text); if (!r.ok) throw new Error(r.reason); return applyFormula(frames, sel, r.formula); };
  it("reads arithmetic, comparisons, a choice and the listed functions, and refuses anything else", () => {
    const value = (text: string) => { const r = readFormula(text); if (!r.ok) throw new Error(r.reason); return r.formula.fn({ w: 0.25, x: -0.5, y: 0.5, z: 0, q: 3, in: 0.2, sel: 0.1, rand: 0 }); };
    expect(value("1+2*3^2")).toBe(19); expect(value("2^3^2")).toBe(512); expect(value("-x*2")).toBe(1); expect(value("(q%2)==1 ? in : 0")).toBe(0.2);
    expect(value("q<3 || w>=0.25 && y!=0.5")).toBe(0); expect(value("max(1, 5, 3)+min(2,1)+avg(1,2,3)+sum(1,1)")).toBe(10); expect(value("rint(2.6)+sign(-3)+abs(-1)")).toBe(3);
    expect(value("sin(pi/2)+ln(e)+log(100)+log2(8)")).toBeCloseTo(7, 9);
    for (const bad of ["", "alert(1)", "constructor", "x.y", "sin(", "1 +", "x ? 1", "window", "sin(1,2)", "a=1", "x;y"]) expect(readFormula(bad).ok, bad).toBe(false);
    expect(readFormula("(".repeat(60) + "1" + ")".repeat(60)).ok).toBe(false); expect(readFormula("1+".repeat(200) + "1").ok).toBe(false);
  });
  it("a plain formula writes the selected frame; y or z writes every frame; q writes harmonics", () => {
    const one = run("sin(2*pi*w)", [sawFrame(), sawFrame()], 1); near(one[0]!, sawFrame()); near(one[1]!, sine());
    const grown = run("sin(2*pi*w)*y"); expect(grown).toHaveLength(FORMULA_FRAMES); expect(peakOf(grown[0]!)).toBeLessThan(1e-6); expect(peakOf(grown[FORMULA_FRAMES - 1]!)).toBeCloseTo(1, 3);
    const first16 = toBins(run("q<17")[0]!); expect(first16.mag[16]!).toBeGreaterThan(0.5); expect(first16.mag[17]!).toBeLessThan(1e-6);
    const saw = toBins(run("1/q")[0]!); expect(saw.mag[4]! / saw.mag[1]!).toBeCloseTo(0.25, 4);
    const odd = toBins(run("((q%2)==1)?in:0")[0]!); expect(odd.mag[2]!).toBeLessThan(1e-6); expect(odd.mag[3]! / odd.mag[1]!).toBeCloseTo(1 / 3, 2);
    near(run("tanh(3*in)", [sine(1, 0.5)])[0]!, fromFunction((t) => Math.tanh(1.5 * Math.sin(2 * Math.PI * t))));
    expect(run("1/0")[0]!.every((v) => Number.isFinite(v))).toBe(true);
  });
  it("every starting formula reads and makes a sound", () => {
    for (const ex of FORMULA_EXAMPLES) { const out = run(ex.text); expect(out.length > 1, ex.name).toBe(ex.all); expect(out.some((f) => peakOf(f) > 0.05), ex.name).toBe(true); expect(out.every((f) => f.every((v) => Number.isFinite(v))), ex.name).toBe(true); }
  });
});
