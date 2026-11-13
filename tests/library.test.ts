import { existsSync, readdirSync, readFileSync, statSync } from "node:fs";
import { join } from "node:path";
import { afterEach, describe, expect, it } from "vitest";
import { loadLibrary, POST } from "../api/ask";
import { askGuide } from "../src/guide/ask";
import { answerQuestion, AskRequestSchema, NOT_COVERED, type GuideModel } from "../src/library/answer";
import { buildIndex, search, tokenize, type Passage } from "../src/library/search";

const ROOT = join(__dirname, "..");
const hasManual = existsSync(join(ROOT, "library", "serum-2-user-guide.json"));
const saved = { ...process.env };
afterEach(() => { process.env = { ...saved }; });

const small: Passage[] = [
  { id: "a#1", source: "Book A", page: 1, section: "Filters", text: "The cutoff knob sets where the low-pass filter starts removing harmonics. Resonance boosts the cutoff." },
  { id: "a#2", source: "Book A", page: 2, section: "Envelopes", text: "Attack is the time to reach full level. Release is the fade after the key is let go." },
  { id: "card:x", source: "Knowledge card (draft)", section: "Unison and detune", text: "Unison stacks copies of an oscillator. Detune spreads them in pitch." },
];
const index = buildIndex(small);

describe("retrieval", () => {
  it("tokenises control names and strips plurals and filler words", () => {
    expect(tokenize("What does the Bend +/- warp do to filters?")).toEqual(["bend", "warp", "filter"]);
    expect(tokenize("MG Low 24, LFO-rate")).toEqual(["mg", "low", "24", "lfo-rate", "lfo", "rate"]);
  });
  it("ranks the passage that is about the question first", () => {
    expect(search(index, "what does resonance do to the cutoff?")[0]!.passage.id).toBe("a#1");
    expect(search(index, "how long is the release")[0]!.passage.id).toBe("a#2");
    expect(search(index, "detune voices")[0]!.passage.id).toBe("card:x");
    expect(search(index, "quantum chromodynamics")).toEqual([]);
  });
  it.skipIf(!hasManual)("finds the right pages of the Serum 2 User Guide", () => {
    const lib = loadLibrary(ROOT);
    const pages = (q: string) => search(lib, q, 6).map((h) => h.passage.page);
    expect(pages("what does the FAT knob do on the MG Low filter")).toContain(135);
    expect(pages("acid ladder filter")).toContain(139);
    expect(pages("LFO mode FREE RETRIG ENVELOPE")).toContain(191);
    expect(pages("portamento always scaled curve")).toContain(218);
    expect(search(lib, "unison detune", 6).some((h) => h.passage.id === "card:unison-detune")).toBe(true);
    expect(lib.passages.length).toBeGreaterThan(370);
  });
});

describe("cited answers", () => {
  const hits = search(index, "what does resonance do to the cutoff", 3);
  const req = { question: "What does resonance do?" };
  it("numbers sources in order of first use and keeps the quoted words", async () => {
    const model: GuideModel = async ({ passages }) => {
      expect(passages[0]!.id).toBe("a#1");
      return [
        { text: "Resonance boosts the sound right at the cutoff.", citations: [{ passageIndex: 0, quote: "Resonance boosts  the cutoff." }] },
        { text: " It makes sweeps more obvious.", citations: [] },
      ];
    };
    const a = await answerQuestion(req, hits, model);
    expect(a.covered).toBe(true);
    expect(a.segments).toEqual([{ text: "Resonance boosts the sound right at the cutoff.", sources: [1] }, { text: " It makes sweeps more obvious.", sources: [] }]);
    expect(a.sources).toEqual([{ n: 1, id: "a#1", source: "Book A", section: "Filters", page: 1, quotes: ["Resonance boosts the cutoff."] }]);
  });
  it("does not call the model when nothing relevant was found", async () => {
    let called = false;
    const a = await answerQuestion({ question: "quantum chromodynamics?" }, search(index, "quantum chromodynamics"), async () => { called = true; return []; });
    expect(a).toEqual({ covered: false, segments: [], sources: [] });
    expect(called).toBe(false);
  });
  it("reports 'not covered' when the guide says the library has no answer", async () => {
    expect((await answerQuestion(req, hits, async () => [{ text: NOT_COVERED, citations: [] }])).covered).toBe(false);
    expect((await answerQuestion(req, hits, async () => [])).covered).toBe(false);
  });
  it("drops citations that point outside the supplied passages", async () => {
    const a = await answerQuestion(req, hits, async () => [{ text: "Made-up source.", citations: [{ passageIndex: 99, quote: "x" }] }]);
    expect(a.segments[0]!.sources).toEqual([]);
    expect(a.sources).toEqual([]);
  });
  it("validates the request", () => {
    expect(AskRequestSchema.safeParse({ question: "  hi  " }).success).toBe(false);
    expect(AskRequestSchema.safeParse({ question: "x".repeat(601) }).success).toBe(false);
    expect(AskRequestSchema.parse({ question: "  why?  " }).question).toBe("why?");
  });
});

describe("ask endpoint and client", () => {
  const post = (body: unknown, auth?: string) => POST(new Request("https://example.test/api/ask", { method: "POST", body: JSON.stringify(body), headers: auth ? { authorization: auth } : {} }));
  const basic = "Basic " + Buffer.from("x:pw").toString("base64");
  it("is behind the same password as the rest of the site", async () => {
    process.env.VERCEL = "1"; process.env.APP_PASSWORD = "pw"; process.env.ANTHROPIC_API_KEY = "test";
    expect((await post({ question: "what is unison" })).status).toBe(401);
    delete process.env.APP_PASSWORD;
    expect((await post({ question: "what is unison" }, basic)).status).toBe(503);
  });
  it("says so when no API key is set, and rejects bad questions", async () => {
    delete process.env.VERCEL; delete process.env.APP_PASSWORD; delete process.env.ANTHROPIC_API_KEY;
    expect(await (await post({ question: "what is unison" })).json()).toMatchObject({ error: "not-configured" });
    process.env.ANTHROPIC_API_KEY = "test";
    expect((await post({ question: "a" })).status).toBe(400);
  });
  it("the client turns failures into a readable message", async () => {
    const fail = (async () => new Response(JSON.stringify({ message: "The guide is switched off." }), { status: 503 })) as unknown as typeof fetch;
    expect(await askGuide("what is unison", undefined, fail)).toEqual({ kind: "unavailable", message: "The guide is switched off." });
    const ok = (async () => new Response(JSON.stringify({ covered: false, segments: [], sources: [] }))) as unknown as typeof fetch;
    expect(await askGuide("what is unison", undefined, ok)).toEqual({ kind: "ok", answer: { covered: false, segments: [], sources: [] } });
  });
});

describe("the library stays on the server", () => {
  const walk = (dir: string): string[] => readdirSync(dir).flatMap((n) => { const p = join(dir, n); return statSync(p).isDirectory() ? walk(p) : [p]; });
  it("no browser code imports the library's text or reads files", () => {
    for (const file of walk(join(ROOT, "src")).filter((f) => /\.(ts|tsx)$/.test(f))) {
      const text = readFileSync(file, "utf8");
      expect(text, file).not.toMatch(/library\/[\w-]+\.json|from "node:fs"|serum-2-user-guide\.json/);
    }
  });
});

describe("library images", () => {
  const dir = join(ROOT, "library", "images", "serum-2-user-guide");
  it.skipIf(!existsSync(dir))("every indexed image exists, has a page in the guide, and nothing is unindexed", () => {
    const index = JSON.parse(readFileSync(join(dir, "index.json"), "utf8")) as { images: { file: string; page: number; width: number; height: number }[] };
    const files = readdirSync(dir).filter((f) => f.endsWith(".webp")).sort();
    expect(index.images.map((i) => i.file).sort()).toEqual(files);
    expect(files.length).toBeGreaterThan(300);
    for (const i of index.images) {
      expect(i.file).toMatch(/^p\d{3}-\d+\.webp$/);
      expect(Number(i.file.slice(1, 4))).toBe(i.page);
      expect(i.page).toBeGreaterThan(0);
      expect(i.page).toBeLessThanOrEqual(354);
      expect(i.width).toBeGreaterThanOrEqual(90);
    }
  });
  it("images are not shipped with the server functions or the browser build", () => {
    const vercel = readFileSync(join(ROOT, "vercel.json"), "utf8");
    expect(vercel).toContain("library/*.json");
    expect(vercel).not.toMatch(/library\/\*\*|\{library,/);
  });
});

import { GET as getImage } from "../api/image";
import { MAX_IMAGES_PER_SOURCE } from "../src/library/answer";

describe("pictures in the guide's answers", () => {
  const withPictures: Passage[] = [
    { id: "a#1", source: "Book A", page: 1, section: "Filters", text: "The cutoff knob sets where the low-pass filter starts removing harmonics.",
      images: [1, 2, 3, 4].map((n) => ({ book: "book-a", file: `p001-${n}.webp`, width: 300 * n, height: 200 })) },
    { id: "a#2", source: "Book A", page: 2, section: "Envelopes", text: "Attack is the time to reach full level." },
  ];
  const citing = (passageIndex: number): GuideModel => async () => [{ text: "An answer.", citations: [{ passageIndex, quote: "words" }] }];
  const hitsFor = (q: string) => search(buildIndex(withPictures), q, 6).map((h) => ({ ...h, score: 5 }));

  it("a cited page always brings its pictures, largest first and capped; an uncited page brings none", async () => {
    const a = await answerQuestion({ question: "what does cutoff do" }, hitsFor("cutoff filter attack level"), citing(0));
    const cited = a.sources.find((s) => s.id === "a#1")!;
    expect(cited.images!.map((i) => i.file)).toEqual(["p001-4.webp", "p001-3.webp", "p001-2.webp"]);
    expect(cited.images!.length).toBe(MAX_IMAGES_PER_SOURCE);
    expect(a.sources.some((s) => s.id === "a#2")).toBe(false);
  });
  it("a cited page without pictures has no image list", async () => {
    const hits = hitsFor("cutoff filter attack level");
    const i = hits.findIndex((h) => h.passage.id === "a#2");
    const a = await answerQuestion({ question: "what is attack" }, hits, citing(i));
    expect(a.sources[0]!.images).toBeUndefined();
  });
  it.skipIf(!hasManual)("the real library attaches the manual's screenshots to their pages, and leaves out icons", () => {
    const lib = loadLibrary(ROOT);
    const page = lib.passages.find((p) => p.id === "serum-2-user-guide#13")!;
    expect(page.images!.some((i) => i.file === "p013-1.webp")).toBe(true);
    for (const p of lib.passages) for (const im of p.images ?? []) { expect(im.book).toBe("serum-2-user-guide"); expect(im.width).toBeGreaterThanOrEqual(300); }
  });
  it("pictures are served only with the password, only by exact name, and never from outside the library", async () => {
    process.env.VERCEL = "1"; process.env.APP_PASSWORD = "pw";
    const ask = (query: string, auth?: string) => getImage(new Request(`http://x/api/image?${query}`, { headers: auth ? { authorization: auth } : {} }));
    const ok = `Basic ${Buffer.from("me:pw").toString("base64")}`;
    expect((await ask("book=serum-2-user-guide&file=p013-1.webp")).status).toBe(401);
    expect((await ask("book=serum-2-user-guide&file=p013-1.webp", `Basic ${Buffer.from("me:no").toString("base64")}`)).status).toBe(401);
    for (const bad of ["book=..&file=p013-1.webp", "book=serum-2-user-guide&file=../../package.json", "book=serum-2-user-guide&file=index.json", "book=a/b&file=p001-1.webp", "file=p001-1.webp"]) expect((await ask(bad, ok)).status, bad).toBe(400);
    expect((await ask("book=no-such-book&file=p001-1.webp", ok)).status).toBe(404);
    delete process.env.APP_PASSWORD;
    expect((await ask("book=serum-2-user-guide&file=p013-1.webp", ok)).status).toBe(503);
    if (hasManual) {
      process.env.APP_PASSWORD = "pw";
      const res = await ask("book=serum-2-user-guide&file=p013-1.webp", ok);
      expect(res.status).toBe(200);
      expect(res.headers.get("content-type")).toBe("image/webp");
      expect(res.headers.get("cache-control")).toContain("private");
      expect((await res.arrayBuffer()).byteLength).toBeGreaterThan(1000);
    }
  });
});
