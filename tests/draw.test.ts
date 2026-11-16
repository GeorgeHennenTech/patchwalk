import { describe, expect, it } from "vitest";
import { compile } from "../src/library/formula";
import { cleanDrawing, DRAW_SYSTEM, place, sweep, waveHarmonics, type DrawModel } from "../src/library/draw";
import { stepForDrawing, WalkRequestSchema } from "../src/library/walk";

describe("the formula reader", () => {
  const run = (e: string, v: Record<string, number> = {}) => { const r = compile(e, Object.keys(v)); if (!r.ok) throw new Error(r.reason); return r.fn(v); };
  it("does arithmetic in the usual order, powers to the right first, and the listed functions", () => {
    expect(run("1 + 2 * 3")).toBe(7); expect(run("(1 + 2) * 3")).toBe(9); expect(run("2 ^ 3 ^ 2")).toBe(512); expect(run("-2 ^ 2")).toBe(-4);
    expect(run("10^(-3/(f*T))", { f: 110, T: 3 })).toBeCloseTo(10 ** (-3 / 330), 12);
    expect(run("20*log(a)", { a: 0.5 })).toBeCloseTo(-6.0206, 4); expect(run("ln(e)")).toBeCloseTo(1, 12); expect(run("sin(pi/2) + max(1, 2) + pow(2, 3)")).toBeCloseTo(11, 12);
    expect(run("1.5e3 + .5")).toBe(1500.5); expect(run("sqrt(x)", { x: -1 })).toBeNaN();
  });
  it("refuses anything that is not arithmetic, and never runs code", () => {
    for (const bad of ["", "alert(1)", "x; y", "a.b", "f(", "2 +", "constructor", "window", "x => x", "1 2", "min(1)", "`x`", "x[0]", "((((((((((((((((((((((((((((((((((((((((((1))))))))))))))))))))))))))))))))))))))))))", "9".repeat(400)]) expect(compile(bad, ["x"]).ok, bad).toBe(false);
    expect(compile("y + 1", ["x"])).toMatchObject({ ok: false });
  });
});

describe("a drawing the guide chose is cleaned before anything is drawn", () => {
  const raw = (over: Partial<DrawModel> = {}): DrawModel => ({ kind: "formula", title: " Decay  per trip ", caption: "The **longer** the decay, the more is kept.", expression: "10^(-3/(f*T))", outputLabel: "Kept each trip", outputUnit: "", xVariable: "T",
    variables: [{ name: "f", label: "The note", unit: "Hz", min: 20, max: 5000, value: 110, stated: false }, { name: "T", label: "Decay time", unit: "s", min: 0.1, max: 10, value: 3, stated: true }], choice: "", stages: [], ...over });
  it("a formula keeps its symbols, ranges and which values the text stated", () => {
    const d = cleanDrawing(raw());
    expect(d).toMatchObject({ kind: "formula", title: "Decay per trip", caption: "The longer the decay, the more is kept.", x: "T", expression: "10^(-3/(f*T))", output: { label: "Kept each trip" } });
    expect(d.variables.map((v) => [v.name, v.stated, v.log ?? false])).toEqual([["f", false, true], ["T", true, true]]);
  });
  it("a formula that cannot be read, has a bad symbol or range, or gives no real numbers becomes nothing, with the reason", () => {
    for (const bad of [raw({ expression: "fetch(x)" }), raw({ expression: "f * q" }), raw({ variables: [{ name: "sin", label: "", unit: "", min: 0, max: 1, value: 0, stated: false }] }),
      raw({ variables: [{ name: "f", label: "", unit: "", min: 5, max: 1, value: 2, stated: false }] }), raw({ variables: [] }), raw({ expression: "sqrt(0 - f) + T" }),
      raw({ variables: Array.from({ length: 9 }, (_, i) => ({ name: `v${i}`, label: "", unit: "", min: 0, max: 1, value: 0, stated: false })) })]) {
      const d = cleanDrawing(bad); expect(d.kind).toBe("none"); expect(d.caption.length).toBeGreaterThan(10);
    }
    // a value outside its range is pulled in, and is then no longer "the text's value"
    const pulled = cleanDrawing(raw({ variables: [{ name: "f", label: "n", unit: "", min: 20, max: 5000, value: 9000, stated: true }, raw().variables[1]!] }));
    expect(pulled.variables[0]).toMatchObject({ value: 5000, stated: false });
    expect(cleanDrawing(raw({ xVariable: "nope" })).x).toBe("f");
  });
  it("ready-made drawings take only their own settings and choices", () => {
    const env = cleanDrawing(raw({ kind: "envelope", expression: "", variables: [{ name: "Decay", label: "x", unit: "y", min: -5, max: 1e9, value: 250, stated: true }, { name: "sustain", label: "", unit: "", min: 0, max: 1, value: 400, stated: true }, { name: "junk", label: "", unit: "", min: 0, max: 1, value: 1, stated: true }] }));
    expect(env.variables.map((v) => [v.name, v.value, v.stated, v.min, v.max])).toEqual([["attack", 10, false, 0, 4000], ["decay", 250, true, 0, 4000], ["sustain", 100, false, 0, 100], ["release", 400, false, 0, 4000]]);
    expect(cleanDrawing(raw({ kind: "filter", choice: " Low ", variables: [] }))).toMatchObject({ kind: "filter", choice: "low" });
    expect(cleanDrawing(raw({ kind: "filter", choice: "comb" })).kind).toBe("none");
    expect(cleanDrawing(raw({ kind: "harmonics", choice: "square" }))).toMatchObject({ kind: "harmonics", choice: "square", variables: [] });
    expect(cleanDrawing(raw({ kind: "chain", stages: ["Oscillator", " Filter ", "", "Reverb"] })).stages).toEqual(["Oscillator", "Filter", "Reverb"]);
    expect(cleanDrawing(raw({ kind: "chain", stages: ["one"] })).kind).toBe("none");
    expect(cleanDrawing(raw({ kind: "none", caption: "A loudspeaker has a shape." }))).toMatchObject({ kind: "none", caption: "A loudspeaker has a shape." });
  });
  it("ranges are swept evenly or by ratio, and the basic waves have the right harmonics", () => {
    expect(sweep({ min: 0, max: 10 }, 0.5)).toBe(5); expect(sweep({ min: 20, max: 20000, log: true }, 0.5)).toBeCloseTo(632.46, 1);
    expect(place({ min: 20, max: 20000, log: true }, 632.4555)).toBeCloseTo(0.5, 5); expect(place({ min: 0, max: 10 }, 2.5)).toBe(0.25);
    expect(waveHarmonics("square", 4)).toEqual([1, 0, 1 / 3, 0]); expect(waveHarmonics("saw", 3)).toEqual([1, 1 / 2, 1 / 3]); expect(waveHarmonics("sine", 3)).toEqual([1, 0, 0]);
  });
  it("the guide is told to choose, not to draw, and what goes for the model is the labelled step", () => {
    for (const w of ["You do not draw anything yourself", "stated", "none", "physical shape"]) expect(DRAW_SYSTEM).toContain(w);
    const text = stepForDrawing({ covered: true, sources: [], blocks: [{ kind: "text", parts: [{ text: "Decay is a time.", sources: [1] }], sources: [1] }, { kind: "synthesis", parts: [{ text: "So shorten it.", sources: [] }], sources: [] }, { kind: "maths", unsourced: true, parts: [{ text: "g = 1/T", sources: [] }], sources: [] }] });
    expect(text).toBe("[A text says] Decay is a time.\n\n[The guide's own synthesis] So shorten it.\n\n[The maths, with no text behind it] g = 1/T");
    expect(WalkRequestSchema.safeParse({ kind: "draw", question: "How?", step: "A step", text }).success).toBe(true);
    expect(WalkRequestSchema.safeParse({ kind: "draw", question: "How?", step: "A step", text: "x".repeat(7000) }).success).toBe(false);
  });
});
