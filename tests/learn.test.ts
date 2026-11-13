import { readdirSync, readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";
import { analyze } from "../src/flow/build";
import { COURSE } from "../src/learn/course";
import { parseCard } from "../src/lesson/cards";
import { INIT_BASELINE } from "../src/patch/baseline";
import { analyzeFile, has, INIT, PACK, probe } from "./fixtures";

const DIR = join(__dirname, "..", "knowledge-cards");
const cards = readdirSync(DIR).filter((f) => f.endsWith(".md") && !f.startsWith("_")).map((f) => parseCard(readFileSync(join(DIR, f), "utf8"))!);
const slot = (source: number, type: string, param: string) => ({ plainParams: { kParamAmount: 60 }, source: [source, 0], destModuleID: 0, destModuleParamID: 0, destModuleParamName: param, destModuleTypeString: type });

// For every lesson: an edit of Init that completes the exercise.
const SOLUTIONS: Record<string, (r: Record<string, any>) => void> = {
  start: () => {},
  pitch: (r) => (r.Oscillator0.plainParams = { kParamOctave: -1 }),
  wavetable: (r) => { r.Oscillator0.WTOsc0.relativePathToWT = "Analog/Other.wav"; r.Oscillator0.WTOsc0.plainParams = { kParamTablePos: 40 }; },
  "two-oscillators": (r) => { r.Oscillator0.plainParams = { kParamFine: -10 }; r.Oscillator1.plainParams = { kParamEnable: 1, kParamFine: 10 }; },
  unison: (r) => (r.Oscillator0.plainParams = { kParamUnison: 5 }),
  filter: (r) => (r.VoiceFilter0.plainParams = { kParamEnable: 1, kParamFreq: 0.3 }),
  envelope: (r) => (r.Env0.plainParams = { ...r.Env0.plainParams, kParamSustain: 0, kParamDecay: 0.3 }),
  lfo: (r) => { r.VoiceFilter0.plainParams = { kParamEnable: 1, kParamFreq: 0.5 }; r.ModSlot0 = slot(6, "VoiceFilter", "kParamFreq"); },
  effects: (r) => (r.FXRack0.FX = [{ FXReverb: { plainParams: { kParamWet: 30 } }, type: 6 }]),
  performance: (r) => { r.VoiceFilter0.plainParams = { kParamEnable: 1 }; r.Global0.plainParams = { kParamMonoToggle: 1, kParamLegato: 1, kParamPortamentoTime: 0.1 }; r.ModSlot0 = slot(25, "VoiceFilter", "kParamFreq"); },
};
const run = (id: string, edit: (r: Record<string, any>) => void) => COURSE.find((l) => l.id === id)!.exercise.check(analyze(probe(edit), INIT_BASELINE));

describe("course", () => {
  it("every lesson has a solution test, existing cards and a non-trivial exercise", () => {
    expect(Object.keys(SOLUTIONS).sort()).toEqual(COURSE.map((l) => l.id).sort());
    expect(new Set(COURSE.map((l) => l.id)).size).toBe(COURSE.length);
    for (const l of COURSE) {
      expect(l.cardIds.length, l.id).toBeGreaterThan(0);
      for (const id of l.cardIds) expect(cards.some((c) => c.id === id), `${l.id} -> card ${id}`).toBe(true);
      expect(l.exercise.steps.length, l.id).toBeGreaterThanOrEqual(3);
    }
  });
  it.each(COURSE.map((l) => [l.id]))("%s: the intended solution passes", (id) => {
    const items = run(id, SOLUTIONS[id]!);
    expect(items.filter((i) => !i.ok).map((i) => i.text)).toEqual([]);
  });
  it.each(COURSE.filter((l) => l.id !== "start").map((l) => [l.id]))("%s: untouched Init does not pass", (id) => {
    expect(run(id, () => {}).some((i) => !i.ok)).toBe(true);
  });
  it("the first lesson rejects a preset that has been changed", () => {
    const items = run("start", (r) => (r.Oscillator0.plainParams = { kParamOctave: 1 }));
    expect(items[0]).toMatchObject({ ok: false });
    expect(items[0]!.text).toMatch(/differs from Init in 1 place/);
  });
  it("gives specific feedback for a near miss", () => {
    expect(run("pitch", (r) => (r.Oscillator0.plainParams = { kParamOctave: -2 }))[0]!.text).toBe("Osc A's octave is stored as -2; the task asks for one octave down.");
    expect(run("two-oscillators", (r) => (r.Oscillator1.plainParams = { kParamEnable: 1 })).map((i) => i.ok)).toEqual([true, false]);
    expect(run("unison", (r) => (r.Oscillator0.plainParams = { kParamUnison: 2 }))[0]!.text).toMatch(/has 2 unison voices; the task asks for three or more/);
  });
  it("the LFO lesson reports an unrecognised source number instead of failing silently", () => {
    const items = run("lfo", (r) => { r.VoiceFilter0.plainParams = { kParamEnable: 1 }; r.ModSlot0 = slot(20, "VoiceFilter", "kParamFreq"); });
    expect(items[1]).toMatchObject({ ok: false });
    expect(items[1]!.text).toMatch(/stored source number 20/);
  });
  it.skipIf(!has(PACK.hype))("a real preset fails the 'untouched Init' check and passes the filter one", () => {
    const a = analyzeFile(PACK.hype);
    expect(COURSE[0]!.exercise.check(a)[0]!.ok).toBe(false);
    expect(COURSE.find((l) => l.id === "filter")!.exercise.check(a).every((i) => i.ok)).toBe(true);
    expect(COURSE[0]!.exercise.check(analyzeFile(INIT))[0]!.ok).toBe(true);
  });
});

describe("card set", () => {
  it("has drafts for the whole course, marked as drafts, with well-formed reading links", () => {
    expect(cards.length).toBeGreaterThanOrEqual(30);
    for (const c of cards) {
      expect(["draft", "reviewed"], c.id).toContain(c.status);
      for (const r of c.reading) expect(r.url, c.id).toMatch(/^https:\/\/[a-z0-9.-]+\//);
      expect(c.body, c.id).not.toMatch(/<!--/);
      expect(c.body.split(/\s+/).length, `${c.id} length`).toBeLessThan(330);
    }
  });
  it("the template's instructions are stripped from its body", () => {
    expect(parseCard(readFileSync(join(DIR, "_template.md"), "utf8"))!.body.startsWith("## What it is")).toBe(true);
  });
});

import { parseBlocks } from "../src/ui/Markdown";

describe("card text layout", () => {
  it("keeps a heading separate from the paragraph on the next line", () => {
    expect(parseBlocks("## What it is\nA wavetable is a row\nof shapes.\n\n## Why it works\nShape fixes harmonics.")).toEqual([
      { kind: "heading", text: "What it is" }, { kind: "para", text: "A wavetable is a row of shapes." },
      { kind: "heading", text: "Why it works" }, { kind: "para", text: "Shape fixes harmonics." },
    ]);
  });
  it("every card renders as four short headings, each followed by body text", () => {
    for (const c of cards) {
      const blocks = parseBlocks(c.body);
      const heads = blocks.filter((b) => b.kind === "heading");
      expect(heads.map((h) => h.text), c.id).toEqual(["What it is", "Why it works", "Listen for", "Goes with"]);
      blocks.forEach((b, i) => { if (b.kind === "heading") expect(blocks[i + 1]?.kind, `${c.id}: ${b.text}`).toBe("para"); });
    }
  });
});
