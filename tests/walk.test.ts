import { describe, expect, it } from "vitest";
import { buildIndex, pageOf, search, splitText, PART_SIZE, SPLIT_OVER, type Passage } from "../src/library/search";
import { cite } from "../src/library/answer";
import { cleanPlan, labelBlocks, makePlan, stepPrompt, stepSearch, writeStep, MAX_STEPS, STEP_SYSTEM, PLAN_SYSTEM, type PlanModel } from "../src/library/walk";
import { deleteWalk, doneCount, loadWalks, newWalk, saveWalk } from "../src/guide/walk";
import { POST } from "../api/walk";

describe("long pages are searched in parts", () => {
  const long = Array.from({ length: 60 }, (_, i) => `Sentence number ${i} is about ${i % 2 ? "filters and cutoff" : "envelopes and attack"} in some detail.`).join(" ");
  it("a short text stays whole; a long one becomes overlapping parts that lose nothing", () => {
    expect(splitText("short")).toEqual(["short"]);
    expect(splitText("x".repeat(SPLIT_OVER))).toHaveLength(1);
    const parts = splitText(long);
    expect(parts.length).toBeGreaterThan(1);
    for (const p of parts) expect(p.length).toBeLessThanOrEqual(PART_SIZE * 1.4);
    for (let i = 0; i < 60; i++) expect(parts.some((p) => p.includes(`Sentence number ${i} is`)), `sentence ${i}`).toBe(true);
    // each part starts where the one before had not yet finished
    for (let i = 1; i < parts.length; i++) expect(parts[i - 1]!.includes(parts[i]!.slice(0, 40))).toBe(true);
  });
  const passages: Passage[] = [
    ...splitText(long).map((text, k) => ({ id: `book#1~${k + 1}`, of: "book#1", source: "Book", page: 1, section: "Filters", text })),
    { id: "serum-2-user-guide#9", source: "Serum 2 User Guide", page: 9, section: "Filter", text: "The CUTOFF knob sets the filter cutoff frequency." },
    { id: "ableton-live-11-manual#4", source: "Ableton Live 11", page: 4, section: "Auto Filter", text: "Auto Filter has a cutoff frequency control." },
  ];
  const index = buildIndex(passages);
  it("no page takes more than its share of the results, and a search can be kept to chosen books", () => {
    const hits = search(index, "filter cutoff", 6, { perPage: 1 });
    expect(hits.filter((h) => pageOf(h.passage) === "book#1")).toHaveLength(1);
    expect(search(index, "filter cutoff", 6, { perPage: 2 }).filter((h) => pageOf(h.passage) === "book#1")).toHaveLength(2);
    const only = search(index, "filter cutoff", 6, { only: (p) => p.id.startsWith("serum-2-user-guide#") });
    expect(only.map((h) => h.passage.id)).toEqual(["serum-2-user-guide#9"]);
  });
  it("two parts of one page are one source", () => {
    const two = passages.slice(0, 2);
    const out = cite([{ text: "A.", citations: [{ passageIndex: 0, quote: "one" }] }, { text: " B.", citations: [{ passageIndex: 1, quote: "two" }] }], two);
    expect(out.sources).toHaveLength(1);
    expect(out.sources[0]).toMatchObject({ n: 1, id: "book#1", page: 1, quotes: ["one", "two"] });
    expect(out.segments.map((s) => s.sources)).toEqual([[1], [1]]);
  });
});

describe("a walkthrough's plan", () => {
  const raw = (over: Partial<PlanModel> = {}): PlanModel => ({ covered: true, title: "  A  plucked   sound ", tool: "serum", steps: [
    { title: "What a pluck is", find: "pluck decay envelope", kind: "idea" }, { title: "The filter envelope", find: "envelope filter cutoff", kind: "idea" },
  ], ...over });
  it("always ends in the learner's tool: a missing recipe is added, a misplaced one is moved to the end", () => {
    const added = cleanPlan("How do I make a pluck?", raw());
    expect(added.title).toBe("A plucked sound");
    expect(added.steps.at(-1)).toMatchObject({ kind: "recipe", title: "Do it in Serum 2" });
    const moved = cleanPlan("q?", raw({ steps: [{ title: "Set it up in Serum", find: "serum filter env", kind: "recipe" }, ...raw().steps] }));
    expect(moved.steps.map((s) => s.kind)).toEqual(["idea", "idea", "recipe"]);
    expect(moved.steps.at(-1)!.title).toBe("Set it up in Serum");
  });
  it("has no recipe when the subject is not done in a tool, is capped, and is empty when not covered", () => {
    const none = cleanPlan("How do I place a subwoofer?", raw({ tool: "none" }));
    expect(none.steps.every((s) => s.kind !== "recipe")).toBe(true);
    const many = cleanPlan("q?", raw({ steps: Array.from({ length: 12 }, (_, i) => ({ title: `Step ${i}`, find: "words here", kind: "idea" as const })) }));
    expect(many.steps).toHaveLength(MAX_STEPS);
    expect(many.steps.at(-1)!.kind).toBe("recipe");
    expect(cleanPlan("q?", raw({ covered: false }))).toMatchObject({ covered: false, steps: [] });
    expect(cleanPlan("q?", raw({ tool: "none", steps: [raw().steps[0]!] })).covered).toBe(false);
  });
  it("makes no call when the library has nothing, and a recipe step searches only that tool's manual", async () => {
    let calls = 0;
    const plan = await makePlan("q?", [], async () => { calls++; return raw(); });
    expect(plan.covered).toBe(false); expect(calls).toBe(0);
    const p = cleanPlan("How do I make a pluck?", raw({ tool: "ableton" }));
    const { only, query } = stepSearch("How do I make a pluck?", p, p.steps.length - 1);
    expect(query).toContain("pluck");
    expect(only!({ id: "ableton-live-11-manual#4", source: "", section: "", text: "" })).toBe(true);
    expect(only!({ id: "serum-2-user-guide#9", source: "", section: "", text: "" })).toBe(false);
    expect(only!({ id: "smith-digital-waveguides#3", source: "", section: "", text: "" })).toBe(false);
    // a step that is not the recipe may use any book except the loudspeaker ones, whose "bass" and "sub" pages are about cabinets
    const any = stepSearch("q?", p, 0).only!;
    expect(any({ id: "smith-digital-waveguides#3", source: "", section: "", text: "" })).toBe(true); expect(any({ id: "funktion-one-documents#512", source: "", section: "", text: "" })).toBe(false); expect(any({ id: "kolbrek-horn-theory#2", source: "", section: "", text: "" })).toBe(false);
    expect(stepSearch("q?", { ...p, tool: "none" }, 0).only).toBeUndefined(); // a walkthrough about sound systems themselves searches everything
    expect(stepPrompt("How do I make a pluck?", p, p.steps.length - 1)).toContain("The tool is Ableton Live.");
  });
});

describe("a step's paragraphs are labelled by code from the citations", () => {
  const seg = (text: string, sources: number[] = []) => ({ text, sources });
  it("keeps the texts' words and the guide's own apart", () => {
    const blocks = labelBlocks([
      seg("DO: Shorten the decay so the note dies quickly.\n\nTEXT: "), seg("The Serum guide says decay is the time to fall to sustain.", [1]),
      seg("\n\nTEXT: Everyone knows plucks are short.\n\nSYNTHESIS: So a short decay with zero sustain gives a pluck. "), seg("That builds on the guide.", [1]),
      seg("\n\nAn unlabelled thought.\n\nDISAGREE: "), seg("Book A gives slope in dB per octave", [1]), seg(" and book B gives the filter's order.", [2]),
      seg("\n\nMATHS: f = 1/T, with no source.\n\nRECIPE: "), seg("1. Turn DEC down.", [3]), seg("\n\n2. Set SUS to zero.\n\nMISSING: The library says nothing about velocity here."),
    ]);
    expect(blocks.map((b) => b.kind)).toEqual(["do", "text", "synthesis", "synthesis", "synthesis", "disagree", "maths", "recipe", "recipe", "missing"]);
    expect(blocks[1]).toMatchObject({ kind: "text", sources: [1] });
    expect(blocks[1]!.parts.map((p) => p.text).join("")).toBe("The Serum guide says decay is the time to fall to sustain.");
    expect(blocks[2]).toMatchObject({ kind: "synthesis", demoted: true, sources: [] }); // called the text's, backed by nothing
    expect(blocks[3]).toMatchObject({ kind: "synthesis", sources: [1] });               // the guide's own, and stays so even with a source
    expect(blocks[3]!.demoted).toBeUndefined();
    expect(blocks[4]).toMatchObject({ kind: "synthesis", sources: [] });                // no label: never passed off as a text
    expect(blocks[5]).toMatchObject({ kind: "disagree", sources: [1, 2] });
    expect(blocks[6]).toMatchObject({ kind: "maths", unsourced: true });
    expect(blocks[7]).toMatchObject({ kind: "recipe", sources: [3] });
    expect(blocks[8]).toMatchObject({ kind: "recipe", unsourced: true });               // a recipe line that continues, with no page behind it
  });
  it("a step with nothing found is not written at all; one that only says what is missing is not counted as covered", async () => {
    let calls = 0;
    expect(await writeStep("p", [], async () => { calls++; return []; })).toEqual({ covered: false, blocks: [], sources: [] });
    expect(calls).toBe(0);
    const hit = [{ passage: { id: "a#1", source: "A", page: 1, section: "S", text: "t" }, score: 5 }];
    const missing = await writeStep("p", hit, async () => [{ text: "MISSING: nothing here.", citations: [] }]);
    expect(missing.covered).toBe(false); expect(missing.blocks).toHaveLength(1);
    const ok = await writeStep("p", hit, async () => [{ text: "TEXT: ", citations: [] }, { text: "It says t.", citations: [{ passageIndex: 0, quote: "t" }] }]);
    expect(ok.covered).toBe(true); expect(ok.sources[0]).toMatchObject({ id: "a#1", quotes: ["t"] }); expect(ok.blocks[0]!.kind).toBe("text");
  });
  it("the instructions carry the owner's two rules", () => {
    for (const word of ["SYNTHESIS", "DISAGREE", "units", "MATHS", "every symbol", "RECIPE", "do not blend"]) expect(STEP_SYSTEM).toContain(word);
    expect(PLAN_SYSTEM).toContain("recipe");
  });
});

describe("saved walkthroughs and the endpoint", () => {
  const mem = () => { const m = new Map<string, string>(); return { getItem: (k: string) => m.get(k) ?? null, setItem: (k: string, v: string) => void m.set(k, v) }; };
  it("are kept newest first, replaced by id, and can be deleted", () => {
    const s = mem();
    const a = newWalk("q one?", { covered: true, title: "One", tool: "serum", steps: [{ title: "A step", find: "words", kind: "idea" }] }, new Date(1000));
    const b = newWalk("q two?", { covered: true, title: "Two", tool: "none", steps: [{ title: "A step", find: "words", kind: "idea" }] }, new Date(2000));
    saveWalk(a, new Date(1000), s); saveWalk(b, new Date(2000), s);
    saveWalk({ ...a, steps: a.steps.map((x) => ({ ...x, done: true })) }, new Date(3000), s);
    const all = loadWalks(s);
    expect(all.map((w) => w.title)).toEqual(["One", "Two"]);
    expect(doneCount(all[0]!)).toBe(1);
    expect(deleteWalk(a.id, s).map((w) => w.title)).toEqual(["Two"]);
  });
  it("needs the password, and refuses anyone who may not spend the key", async () => {
    process.env.VERCEL = "1"; process.env.APP_PASSWORD = "pw";
    const post = (auth?: string) => POST(new Request("https://example.test/api/walk", { method: "POST", body: JSON.stringify({ kind: "plan", question: "How do I make a pluck?" }), headers: auth ? { authorization: auth } : {} }));
    expect((await post()).status).toBe(401);
    // the right password but no account: on Vercel with no database every paid call is refused
    const res = await post(`Basic ${Buffer.from("me:pw").toString("base64")}`);
    expect([401, 402, 503]).toContain(res.status);
    delete process.env.APP_PASSWORD; expect((await post()).status).toBe(503);
    delete process.env.VERCEL;
  });
});
