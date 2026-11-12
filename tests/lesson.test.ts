import { readdirSync, readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";
import { analyze } from "../src/flow/build";
import { cardsFor, parseCard, type Card } from "../src/lesson/cards";
import { buildRequest, fetchLessons, toLessonStep } from "../src/lesson/client";
import { LessonRequestSchema, type Lesson, type LessonStep } from "../src/lesson/contract";
import { rangeText, render } from "../src/lesson/render";
import { generateLessons, MAX_ATTEMPTS, type ModelCall } from "../src/lesson/server";
import { numbersIn, validateLesson } from "../src/lesson/validator";
import { REGISTRY } from "../src/display/registry";
import { INIT_BASELINE } from "../src/patch/baseline";
import { analyzeFile, has, PACK, probe } from "./fixtures";

const CARD_DIR = join(__dirname, "..", "knowledge-cards");
const cards: Card[] = readdirSync(CARD_DIR).filter((f) => f.endsWith(".md") && !f.startsWith("_")).map((f) => parseCard(readFileSync(join(CARD_DIR, f), "utf8"))!);

// A synthetic patch: Osc A down an octave with three unison voices, filter on with cutoff, drive and an LFO on cutoff.
const patch = analyze(probe((r) => {
  r.Oscillator0.plainParams = { kParamOctave: -1, kParamUnison: 3, kParamDetune: 0.2 };
  r.VoiceFilter0.plainParams = { kParamEnable: 1, kParamType: "MgL24", kParamFreq: 0.4, kParamReso: 30, kParamDrive: 42.1 };
  r.Env0.plainParams = { ...r.Env0.plainParams, kParamAttack: 0.25 };
  r.LFO0.plainParams = { kParamRate: 4 };
  r.ModSlot0 = { plainParams: { kParamAmount: 60 }, source: [6, 0], destModuleID: 0, destModuleParamID: 3, destModuleParamName: "kParamFreq", destModuleTypeString: "VoiceFilter" };
}), INIT_BASELINE);

const rendered = render(patch.steps, "intermediate");
const req = buildRequest(rendered, cards, "intermediate")!;
const vocab = { text: req.patchText, tags: new Set(req.patchTags) };
const filterStep = req.steps.find((s) => s.id === "filter:VoiceFilter0")!;
const good = (step: LessonStep, over: Partial<Lesson> = {}): Lesson => ({
  step_id: step.id,
  do: "Switch the filter on and choose the MG Low 24 type, then set resonance and drive.",
  why: "A low-pass filter removes upper harmonics, which the ear hears as brightness, so the tone gets rounder.",
  listen_for: "The buzz on top should soften while the body stays.",
  param_refs: [step.facts[0]!.id],
  ...over,
});

describe("validator (rule 5)", () => {
  it("accepts text that only uses the step's values and the patch's settings", () => {
    expect(validateLesson(filterStep, good(filterStep), vocab)).toEqual([]);
  });
  it("rejects an invented value", () => {
    expect(validateLesson(filterStep, good(filterStep, { why: "Setting the cutoff near 800 Hz removes the fizz." }), vocab).join(" ")).toMatch(/number 800/);
  });
  it("rejects a value that exists elsewhere in the patch but not in this step", () => {
    // 60% is the LFO amount, a fact of the motion step, not of the filter step
    expect(validateLesson(filterStep, good(filterStep, { do: "Set the filter and aim for 60% movement." }), vocab).join(" ")).toMatch(/number 60/);
  });
  it("rejects numbers written as words", () => {
    expect(validateLesson(filterStep, good(filterStep, { why: "Stacking seven voices makes it wide." }), vocab).join(" ")).toMatch(/"seven"/);
  });
  it("rejects a module the patch does not use", () => {
    const p = validateLesson(filterStep, good(filterStep, { listen_for: "The reverb tail should get darker." }), vocab);
    expect(p.join(" ")).toMatch(/reverb, which this patch does not use/);
  });
  it("rejects a setting the patch does not use", () => {
    expect(validateLesson(filterStep, good(filterStep, { why: "Hard sync and FM add bite before the filter." }), vocab).length).toBeGreaterThanOrEqual(2);
  });
  it("allows a setting used elsewhere in the patch", () => {
    expect(validateLesson(filterStep, good(filterStep, { why: "The LFO will sweep this filter later, and unison thickens what it receives." }), vocab)).toEqual([]);
  });
  it("accepts a negative value written as a magnitude", () => {
    const core = req.steps.find((s) => s.id === "thickness:Oscillator0")!;
    const step = toLessonStep(rendered.find((s) => s.id === "core:Oscillator0")!, cards);
    expect(validateLesson(step, { step_id: step.id, do: "Drop Osc A by 1 octave.", why: "Lower pitch gives weight.", listen_for: "A deeper tone.", param_refs: [step.facts[0]!.id] }, vocab)).toEqual([]);
    expect(core).toBeDefined();
  });
  it("rejects unknown fact references, a wrong step id, empty and oversized fields", () => {
    expect(validateLesson(filterStep, good(filterStep, { param_refs: ["VoiceFilter0:kParamMadeUp"] }), vocab).join(" ")).toMatch(/not a fact of this step/);
    expect(validateLesson(filterStep, good(filterStep, { param_refs: [] }), vocab).join(" ")).toMatch(/param_refs is empty/);
    expect(validateLesson(filterStep, good(filterStep, { step_id: "other" }), vocab).join(" ")).toMatch(/does not match/);
    expect(validateLesson(filterStep, good(filterStep, { why: " " }), vocab).join(" ")).toMatch(/empty/);
    expect(validateLesson(filterStep, good(filterStep, { why: "x".repeat(900) }), vocab).join(" ")).toMatch(/longer than/);
  });
  it("number extraction ignores digits inside words and handles ranges", () => {
    expect(numbersIn("MG Low 24 at 38 to 46%, Osc2x, −2 oct, 0.4")).toEqual([24, 38, 46, 2, 0.4]);
  });
});

describe("regeneration loop", () => {
  it("retries a rejected step with the reasons, then accepts the fixed text", async () => {
    const calls: Parameters<ModelCall>[0][] = [];
    const model: ModelCall = async (args) => {
      calls.push(args);
      const bad = calls.length === 1;
      return { lessons: args.steps.map((s) => good(s, s.id === filterStep.id && bad ? { why: "Roll off above 800 Hz." } : {})) };
    };
    const one = { ...req, steps: [filterStep] };
    const res = await generateLessons(one, model);
    expect(res.results[filterStep.id]).toMatchObject({ ok: true, attempts: 2 });
    expect(calls[1]!.feedback![filterStep.id]!.join(" ")).toMatch(/800/);
  });
  it("gives up after the attempt limit and reports why", async () => {
    let n = 0;
    const res = await generateLessons({ ...req, steps: [filterStep] }, async (a) => (n++, { lessons: a.steps.map((s) => good(s, { why: "Use 999." })) }));
    expect(n).toBe(MAX_ATTEMPTS);
    expect(res.results[filterStep.id]).toMatchObject({ ok: false, attempts: MAX_ATTEMPTS });
  });
  it("treats malformed output and thrown errors as rejections", async () => {
    const res = await generateLessons({ ...req, steps: [filterStep] }, async () => ({ nope: true }));
    expect(res.results[filterStep.id]!.ok).toBe(false);
    const res2 = await generateLessons({ ...req, steps: [filterStep] }, async () => { throw new Error("boom"); });
    expect(res2.results[filterStep.id]).toMatchObject({ ok: false, problems: ["boom"] });
  });
  it("only retries the steps that failed", async () => {
    const sizes: number[] = [];
    const neutral = (s: LessonStep, why = "It shapes the tone.") => ({ step_id: s.id, do: "Follow the instructions above.", why, listen_for: "A clear change in tone.", param_refs: [s.facts[0]!.id] });
    await generateLessons(req, async (a) => (sizes.push(a.steps.length), { lessons: a.steps.map((s, i) => neutral(s, sizes.length === 1 && i === 0 ? "12345" : undefined)) }));
    expect(sizes).toEqual([req.steps.length, 1]);
  });
});

describe("browser client", () => {
  it("builds a request that satisfies the contract and contains no preset data", () => {
    expect(LessonRequestSchema.safeParse(req).success).toBe(true);
    expect(JSON.stringify(req)).not.toMatch(/plainParams|XferJson|kUIParam/);
  });
  it("sends only steps that have a knowledge card", () => {
    expect(req.steps.every((s) => s.cards.length > 0 && s.facts.length > 0)).toBe(true);
    expect(req.steps.map((s) => s.id)).toContain("filter:VoiceFilter0");
    expect(req.steps.map((s) => s.id)).not.toContain("init");
    // a patch whose only change has no card produces no request at all
    const noCard = analyze(probe((r) => (r.VoicePanel0.plainParams = { kParamWhatever: 3 })), INIT_BASELINE);
    expect(buildRequest(render(noCard.steps, "beginner").filter((s) => s.stage === "other"), cards, "beginner")).toBeUndefined();
  });
  it("re-validates what the server returns and drops anything invalid", async () => {
    const fake = (async () => new Response(JSON.stringify({ results: Object.fromEntries(req.steps.map((s) => [s.id, { ok: true, attempts: 1, lesson: s.id === filterStep.id ? good(s, { why: "Sneaky 4321." }) : { step_id: s.id, do: "Follow the instructions above.", why: "It shapes the tone.", listen_for: "A clear change in tone.", param_refs: [s.facts[0]!.id] } }])) }))) as typeof fetch;
    const out = await fetchLessons(req, fake);
    expect(out.kind).toBe("ok");
    if (out.kind === "ok") {
      expect(Object.keys(out.lessons)).not.toContain(filterStep.id);
      expect(out.rejected[filterStep.id]!.join(" ")).toMatch(/4321/);
    }
  });
  it("reports a missing API key as unavailable, not as an error page", async () => {
    const fake = (async () => new Response(JSON.stringify({ message: "Explanations are switched off." }), { status: 503 })) as typeof fetch;
    expect(await fetchLessons(req, fake)).toEqual({ kind: "unavailable", message: "Explanations are switched off." });
  });
});

describe("difficulty rendering", () => {
  const ids = (d: "beginner" | "intermediate" | "advanced") => render(patch.steps, d).flatMap((s) => s.lines.map((l) => l.factId));
  it("all three renderings contain exactly the same facts in the same order", () => {
    expect(ids("intermediate")).toEqual(ids("beginner"));
    expect(ids("advanced")).toEqual(ids("beginner"));
    expect(ids("beginner")).toEqual(patch.steps.flatMap((s) => s.facts.map((f) => f.id)));
  });
  it("beginner: exact values, Init value shown, one concept per step", () => {
    const b = render(patch.steps, "beginner");
    const lines = b.flatMap((s) => s.lines.map((l) => l.text));
    expect(lines).toContain("Set Filter 1 Drive to 42%.");
    expect(lines).toContain("Set Env 1 Attack (ATK) to 250 ms.");
    const curve = render(analyze(probe((r) => (r.Env0.plainParams = { ...r.Env0.plainParams, kParamCurve2: 40 })), INIT_BASELINE).steps, "beginner").flatMap((s) => s.lines.map((l) => l.text));
    expect(curve).toContain("Set Env 1 Decay curve to 40. (Init: 66.6)");
    expect(b.length).toBeGreaterThan(patch.steps.length);
    for (const s of b) expect(new Set(s.facts.map((f) => `${f.moduleId}|${f.concept}`)).size).toBeLessThanOrEqual(1);
  });
  it("intermediate: knob values become ranges, musical whole numbers stay exact", () => {
    const lines = render(patch.steps, "intermediate").flatMap((s) => s.lines.map((l) => l.text));
    expect(lines).toContain("Set Filter 1 Drive somewhere around 38 to 46%.");
    expect(lines).toContain("Set Osc A Octave (OCT) to -1 oct.");
    expect(lines).toContain("Set Osc A Unison voices to 3.");
  });
  it("advanced: goal-only titles, every value line hidden until asked for", () => {
    const a = render(patch.steps, "advanced");
    expect(a.find((s) => s.id === "filter:VoiceFilter0")!.title).toBe("Shape the tone with Filter 1");
    expect(a.flatMap((s) => s.lines).every((l) => l.hidden)).toBe(true);
    expect(a.every((s) => numbersIn(s.goal.replace(/(Filter|Env|LFO|Macro) \d+/g, "")).length === 0)).toBe(true);
  });
  it("ranges are computed by code and clamp sensibly", () => {
    const f = (num: number, unit: string, decimals: number) => rangeText({ display: { text: "", num, unit, decimals }, status: "unverified" } as any);
    expect(f(95, "%", 0)).toBe("86 to 100%");
    expect(f(-34, "%", 0)).toBe("-37 to -31%");
    expect(f(65.4, "ms", 1)).toBe("58.9 to 71.9 ms");
    expect(f(0, "%", 0)).toBeUndefined();
    expect(f(-2, "oct", 0)).toBeUndefined();
  });
  it("flags uninterpreted settings in every rendering (rule 6)", () => {
    const a = analyze(probe((r) => (r.Oscillator0.plainParams = { kParamMystery: 0.4 })), INIT_BASELINE);
    for (const d of ["beginner", "intermediate", "advanced"] as const) {
      const l = render(a.steps, d).flatMap((s) => s.lines).find((x) => x.factId === "Oscillator0:kParamMystery")!;
      expect(l.uninterpreted).toBe(true);
      expect(l.text).toBe('Osc A stores "Mystery" = 0.4. The app cannot interpret this setting yet.');
    }
  });
});

describe("knowledge cards", () => {
  it("every card parses, has all four sections and references only known tags", () => {
    expect(cards.length).toBeGreaterThanOrEqual(3);
    const stages = new Set(["core", "thickness", "character", "filter", "contour", "motion", "space", "performance"]);
    const params = new Set(Object.values(REGISTRY).flatMap((m) => Object.keys(m)));
    for (const c of cards) {
      for (const h of ["## What it is", "## Why it works", "## Listen for", "## Goes with"]) expect(c.body, `${c.id} ${h}`).toContain(h);
      for (const s of c.stages) expect(stages.has(s), `${c.id} stage ${s}`).toBe(true);
      for (const t of c.appliesTo) expect(t in REGISTRY || params.has(t.split(".").pop()!) || t.startsWith("FX") || t.startsWith("kParam") || t.startsWith("combo:") || ["wavetable", "NoiseOsc", "SubOsc", "route", "position", "shape"].includes(t), `${c.id} tag ${t}`).toBe(true);
    }
    expect(new Set(cards.map((c) => c.id)).size).toBe(cards.length);
  });
  it("the template parses too, and files without front matter are ignored", () => {
    expect(parseCard(readFileSync(join(CARD_DIR, "_template.md"), "utf8"))!.id).toBe("short-kebab-case-id");
    expect(parseCard("# just a heading")).toBeUndefined();
  });
  it("cards are chosen by code from the step's facts and stage", () => {
    const pick = (id: string) => cardsFor(rendered.find((s) => s.id === id)!, cards).map((c) => c.id);
    expect(pick("thickness:Oscillator0")).toEqual(["unison-detune"]);
    expect(pick("filter:VoiceFilter0")).toEqual(["lowpass-cutoff-resonance"]);
    expect(pick("contour:Env0")).toEqual(["amp-envelope"]);
    expect(pick("core:Oscillator0")).toEqual(["oscillator-pitch", "wavetable"]);
    expect(pick("init")).toEqual([]);
  });
  it.skipIf(!has(PACK.gfunk))("works on a real preset", () => {
    const r = buildRequest(render(analyzeFile(PACK.gfunk).steps, "beginner"), cards, "beginner")!;
    // the client sends steps in batches; each batch must satisfy the server's contract
    expect(LessonRequestSchema.safeParse({ ...r, steps: r.steps.slice(0, 12) }).success).toBe(true);
    expect(r.steps.length).toBeGreaterThan(12);
  });
});
