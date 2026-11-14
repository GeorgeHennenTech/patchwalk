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
  it("pictures travel only with the password-checked picture route, never with the browser build", () => {
    const vercel = JSON.parse(readFileSync(join(ROOT, "vercel.json"), "utf8")) as { functions: Record<string, { includeFiles?: string }> };
    expect(vercel.functions["api/image.ts"]!.includeFiles).toBe("library/images/**");
    expect(vercel.functions["api/ask.ts"]!.includeFiles).not.toMatch(/webp|images\/\*\*/);
    expect(vercel.functions["api/lesson.ts"]!.includeFiles).toBeUndefined();
  });
  const books = existsSync(join(ROOT, "library")) ? readdirSync(join(ROOT, "library")).filter((f) => f.endsWith(".json")).map((f) => f.replace(".json", "")) : [];
  it.each(books)("%s: text and pictures agree with each other", (book) => {
    const doc = JSON.parse(readFileSync(join(ROOT, "library", `${book}.json`), "utf8")) as { id: string; title: string; pages: { page: number; chapter: string; text: string }[] };
    expect(doc.id).toBe(book);
    expect(doc.pages.map((p) => p.page)).toEqual([...doc.pages.map((p) => p.page)].sort((a, b) => a - b));
    expect(new Set(doc.pages.map((p) => p.page)).size).toBe(doc.pages.length);
    const last = doc.pages.at(-1)!.page;
    const imgDir = join(ROOT, "library", "images", book);
    expect(existsSync(imgDir), "every book is taken in with its pictures").toBe(true);
    const index = JSON.parse(readFileSync(join(imgDir, "index.json"), "utf8")) as { images: { file: string; page: number }[] };
    expect(index.images.map((i) => i.file).sort()).toEqual(readdirSync(imgDir).filter((f) => f.endsWith(".webp")).sort());
    for (const i of index.images) { expect(i.file).toMatch(/^p\d{3,4}-\d+\.webp$/); expect(Number(i.file.slice(1, i.file.indexOf("-")))).toBe(i.page); expect(i.page).toBeLessThanOrEqual(last + 15); }
  });
  const hasAbleton = existsSync(join(ROOT, "library", "ableton-live-11-manual.json"));
  it.skipIf(!hasAbleton)("the Ableton manual is searchable by chapter topic, and its pictures come with its pages", () => {
    const lib = loadLibrary(ROOT);
    const top = (q: string) => search(lib, q, 6).map((h) => h.passage);
    expect(top("how do I warp an audio clip to the tempo").some((p) => p.source.includes("Ableton") && p.section.includes("Warping"))).toBe(true);
    expect(top("draw automation envelope in arrangement view").some((p) => p.section.includes("Automation"))).toBe(true);
    expect(top("session view launch clips scene").some((p) => p.source.includes("Ableton"))).toBe(true);
    expect(lib.passages.filter((p) => p.id.startsWith("ableton-live-11-manual#")).length).toBeGreaterThan(800);
    expect(top("Wavetable instrument oscillator modulation matrix").some((p) => p.section.includes("Instrument Reference"))).toBe(true);
    expect(top("arpeggiator MIDI effect style rate").some((p) => p.section.includes("MIDI Effect"))).toBe(true);
    // the index at the back is a word list, not something to answer from
    expect(lib.passages.some((p) => p.section === "Index")).toBe(false);
    expect(lib.passages.some((p) => p.id.startsWith("ableton-live-11-manual#") && (p.images?.length ?? 0) > 0)).toBe(true);
    // contents pages were left out
    expect(lib.passages.some((p) => p.id === "ableton-live-11-manual#5")).toBe(false);
  });
  const hasRift = existsSync(join(ROOT, "library", "rift-manual.json"));
  it.skipIf(!hasRift)("the Rift manual is searchable, with chapter and section read from its letter-spaced headings", () => {
    const lib = loadLibrary(ROOT);
    const top = (q: string) => search(lib, q, 6).map((h) => h.passage);
    const rift = lib.passages.filter((p) => p.id.startsWith("rift-manual#"));
    expect(rift.length).toBe(64);
    expect(top("Rift positive and negative distortion type wavefold").some((p) => p.source.includes("Rift") && p.section.includes("Distortion"))).toBe(true);
    expect(top("Rift feedback frequency range comb tune").some((p) => p.section === "Advanced View: Feedback")).toBe(true);
    expect(rift.some((p) => (p.images?.length ?? 0) > 0)).toBe(true);
    // no letter-spaced headings, rule lines or the contents page left in the text
    expect(rift.some((p) => /_{10,}|RIFT MANUAL \||D I S TO R T I O N/.test(p.text))).toBe(false);
    expect(lib.passages.some((p) => p.id === "rift-manual#2")).toBe(false);
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
    for (const p of lib.passages) for (const im of p.images ?? []) { expect(p.id.startsWith(`${im.book}#`)).toBe(true); expect(im.width).toBeGreaterThanOrEqual(300); }
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

import { plain } from "../src/ui/Answer";
describe("answer text", () => {
  it("is shown without Markdown marks", () => {
    expect(plain("**Effect order matters.** Effects run in order.")).toBe("Effect order matters. Effects run in order.");
    expect(plain("## What it is\nA filter.")).toBe("What it is\nA filter.");
    expect(plain("2 * 3 = 6")).toBe("2 * 3 = 6");
  });
});

import { cleanMarks, MAX_MARKS, PointRequestSchema } from "../src/library/point";
import { POST as pointPost } from "../api/point";
import { pointAt } from "../src/guide/point";
describe("show me where", () => {
  it("marks are kept inside the picture, as fractions of it, numbered in order", () => {
    const marks = cleanMarks({ marks: [{ label: "  DRIVE   knob ", left: 100, top: 50, width: 200, height: 100 }, { label: "Menu", left: 900, top: 400, width: 300, height: 300 }] }, 1000, 500);
    expect(marks.map((m) => [m.n, m.letter, m.label])).toEqual([[1, "A", "DRIVE knob"], [2, "B", "Menu"]]);
    const near = (m: (typeof marks)[number]) => [m.x, m.y, m.w, m.h].map((v) => Number(v.toFixed(6)));
    expect(near(marks[0]!)).toEqual([0.1, 0.1, 0.2, 0.2]);
    expect(near(marks[1]!)).toEqual([0.9, 0.8, 0.1, 0.2]); // cut off at the picture's edge
  });
  it("drops marks with no label, no size, nonsense numbers, or that cover nearly the whole picture; keeps at most five", () => {
    const box = { left: 10, top: 10, width: 50, height: 50 };
    expect(cleanMarks({ marks: [{ label: "", ...box }, { label: "a", ...box, width: 0 }, { label: "b", ...box, left: NaN }, { label: "everything", left: 0, top: 0, width: 1000, height: 480 }, { label: "outside", left: 2000, top: 10, width: 50, height: 50 }] }, 1000, 500)).toEqual([]);
    expect(cleanMarks({ marks: Array.from({ length: 9 }, (_, i) => ({ label: `m${i}`, ...box })) }, 1000, 500)).toHaveLength(MAX_MARKS);
  });
  it("a tiny target gets a box big enough to see, centred on the same spot", () => {
    const [m] = cleanMarks({ marks: [{ label: "dot", left: 500, top: 250, width: 2, height: 2 }] }, 1000, 500);
    expect(m!.w * 1000).toBeCloseTo(14, 6); expect((m!.x + m!.w / 2) * 1000).toBeCloseTo(501, 6);
  });
  it("only exact library picture names are accepted", () => {
    expect(PointRequestSchema.safeParse({ book: "rift-manual", file: "p047-2.webp", question: "where is randomize?" }).success).toBe(true);
    for (const bad of [{ book: "../x", file: "p047-2.webp" }, { book: "rift-manual", file: "../../.env" }, { book: "rift-manual", file: "p047-2.png" }]) expect(PointRequestSchema.safeParse({ ...bad, question: "where?" }).success).toBe(false);
  });
  it("the endpoint is behind the password and needs an API key", async () => {
    const env = { ...process.env };
    const call = (headers: Record<string, string> = {}) => pointPost(new Request("http://x/api/point", { method: "POST", headers, body: JSON.stringify({ book: "rift-manual", file: "p047-2.webp", question: "where is randomize?" }) }));
    try {
      process.env.VERCEL = "1"; delete process.env.APP_PASSWORD; delete process.env.ANTHROPIC_API_KEY;
      expect((await call()).status).toBe(503);
      process.env.APP_PASSWORD = "pw";
      expect((await call()).status).toBe(401);
      const res = await call({ authorization: `Basic ${Buffer.from("me:pw").toString("base64")}` });
      expect(res.status).toBe(503);
      expect((await res.json()).error).toBe("no-database"); // live, with nobody recognisable: closed
      delete process.env.VERCEL;
      expect((await (await call({ authorization: `Basic ${Buffer.from("me:pw").toString("base64")}` })).json()).error).toBe("not-configured");
    } finally { process.env = env; }
  });
  it("the browser side reports a failure in plain words, passes marks through, and does not pay twice for the same picture and question", async () => {
    const m = new Map<string, string>();
    (globalThis as { localStorage?: unknown }).localStorage = { getItem: (k: string) => m.get(k) ?? null, setItem: (k: string, v: string) => { m.set(k, v); } };
    try {
      let calls = 0;
      const reply = async () => { calls++; return new Response(JSON.stringify({ about: "The LFO area.", marks: [{ n: 1, letter: "A", label: "x", x: 0, y: 0, w: 0.1, h: 0.1 }] }), { status: 200 }); };
      const ok = await pointAt("b", "p001-1.webp", "Where is the rate?", "Turn RATE.", false, reply);
      expect(ok).toEqual({ kind: "ok", about: "The LFO area.", marks: [{ n: 1, letter: "A", label: "x", x: 0, y: 0, w: 0.1, h: 0.1 }] });
      const again = await pointAt("b", "p001-1.webp", "where is the RATE", undefined, false, reply);
      expect(again).toMatchObject({ kind: "ok", remembered: true, about: "The LFO area." });
      expect(calls).toBe(1);
      await pointAt("b", "p001-1.webp", "where is the rate", undefined, true, reply); // "look again" asks afresh
      await pointAt("b", "p002-1.webp", "where is the rate", undefined, false, reply); // another picture is another call
      expect(calls).toBe(3);
      expect(await pointAt("b", "p009-1.webp", "q", undefined, false, async () => new Response(JSON.stringify({ message: "The guide is busy. Try again shortly." }), { status: 429 }))).toEqual({ kind: "unavailable", message: "The guide is busy. Try again shortly." });
      expect((await pointAt("b", "p008-1.webp", "q", undefined, false, async () => { throw new Error("offline"); })).kind).toBe("unavailable");
    } finally { delete (globalThis as { localStorage?: unknown }).localStorage; }
  });
});

import { answerText, MAX_HISTORY_TURNS, toParagraphs } from "../src/library/answer";
import { historyOf, type Turn } from "../src/guide/ask";
import { deleteChat, loadChats, MAX_CHATS, saveChat } from "../src/guide/chats";
describe("conversations with the guide", () => {
  const memory = () => { const m = new Map<string, string>(); return { getItem: (k: string) => m.get(k) ?? null, setItem: (k: string, v: string) => { m.set(k, v); } }; };
  const ok = (text: string): Turn["outcome"] => ({ kind: "ok", answer: { covered: true, segments: [{ text, sources: [1] }], sources: [] } });
  it("an answer is split into paragraphs wherever a blank line falls, keeping each piece's sources", () => {
    const ps = toParagraphs([{ text: "Drag the LFO onto a knob.", sources: [1] }, { text: "\n\nThen check the tab.\n\nSide note: ", sources: [] }, { text: "only six LFOs show at first.", sources: [2] }]);
    expect(ps.map((p) => p.aside)).toEqual([false, false, true]);
    expect(ps[0]!.parts).toEqual([{ text: "Drag the LFO onto a knob.", sources: [1] }]);
    expect(ps[1]!.parts.map((x) => x.text)).toEqual(["Then check the tab."]);
    expect(ps[2]!.parts).toEqual([{ text: "Only six LFOs show at first.", sources: [2] }]); // the label's words are removed
  });
  it("a side note inside one piece is recognised too, and ordinary text is never marked as one", () => {
    expect(toParagraphs([{ text: "Do this.\n\nside note: it also works in Live.", sources: [1] }])[1]).toEqual({ aside: true, parts: [{ text: "It also works in Live.", sources: [1] }] });
    expect(toParagraphs([{ text: "On the side, note the level.", sources: [] }])[0]!.aside).toBe(false);
    expect(toParagraphs([{ text: "  \n\n", sources: [] }])).toEqual([]);
  });
  it("a follow-up carries the last few finished turns as plain text, and the request shape allows it", () => {
    const turns: Turn[] = [...Array.from({ length: 6 }, (_, i) => ({ question: `q${i}`, outcome: ok(`a${i}`) })), { question: "failed", outcome: { kind: "unavailable" as const, message: "x" } }, { question: "pending" }];
    const h = historyOf(turns);
    expect(h).toHaveLength(MAX_HISTORY_TURNS);
    expect(h.at(-1)).toEqual({ question: "q5", answer: "a5" });
    expect(AskRequestSchema.safeParse({ question: "and its rate?", history: h }).success).toBe(true);
    expect(AskRequestSchema.safeParse({ question: "and its rate?", history: [...h, ...h] }).success).toBe(false);
    expect(answerText({ covered: false, segments: [], sources: [] })).toContain("did not cover");
  });
  it("the earlier turns reach the model as context, and the search includes the previous question", async () => {
    let seen: Parameters<GuideModel>[0] | undefined;
    const model: GuideModel = async (args) => { seen = args; return [{ text: "ok", citations: [] }]; };
    const passage: Passage = { id: "x#1", source: "Book", page: 1, section: "LFO", text: "lfo rate knob" };
    await answerQuestion({ question: "and its rate?", history: [{ question: "how do I assign an LFO", answer: "drag it" }] }, [{ passage, score: 5 }], model);
    expect(seen!.history).toEqual([{ question: "how do I assign an LFO", answer: "drag it" }]);
  });
  it("chats are saved newest first, saved again in place, opened and deleted, and only in this browser", () => {
    const store = memory();
    expect(loadChats(store)).toEqual([]);
    expect(saveChat({ turns: [{ question: "pending" }] }, new Date(0), store)).toBeNull(); // nothing finished yet
    const one = saveChat({ turns: [{ question: "how do I assign an LFO", outcome: ok("drag it") }] }, new Date("2026-11-14T10:00:00Z"), store)!;
    const two = saveChat({ turns: [{ question: "x".repeat(100), outcome: ok("y") }] }, new Date("2026-11-14T11:00:00Z"), store)!;
    expect(two.chats.map((c) => c.title)).toEqual([`${"x".repeat(67)}…`, "how do I assign an LFO"]);
    const again = saveChat({ id: one.id, turns: [{ question: "how do I assign an LFO", outcome: ok("drag it") }, { question: "and its rate?", outcome: ok("the RATE knob") }] }, new Date("2026-11-14T12:00:00Z"), store)!;
    expect(again.chats).toHaveLength(2);
    expect(again.chats[0]!.id).toBe(one.id); expect(again.chats[0]!.turns).toHaveLength(2);
    expect(deleteChat(two.id, store).map((c) => c.id)).toEqual([one.id]);
    expect(loadChats({ getItem: () => "not json" })).toEqual([]);
    expect(loadChats({ getItem: () => JSON.stringify([{ nonsense: true }, again.chats[0]]) })).toHaveLength(1);
    expect(saveChat({ turns: [{ question: "q", outcome: ok("a") }] }, new Date(), undefined)).toBeNull(); // no storage at all
    expect(MAX_CHATS).toBeGreaterThanOrEqual(20);
  });
});

import { CACHE_DAYS, CACHE_MAX, recall, remember, sameQuestionKey } from "../src/guide/cache";
import { cleanAbout } from "../src/library/point";
describe("headings, and what the guide remembers on this device", () => {
  const memory = () => { const m = new Map<string, string>(); return { getItem: (k: string) => m.get(k) ?? null, setItem: (k: string, v: string) => { m.set(k, v); } }; };
  it("a heading line, or a bold lead-in, becomes a heading and leaves the rest of the paragraph", () => {
    const ps = toParagraphs([{ text: "## Effect order\nEffects run top to bottom.", sources: [1] }, { text: "\n\n**Keeping the low end clean.** A splitter divides the sound.", sources: [] }, { text: "\n\n## Finding settings\n\nClick RANDOMIZE.", sources: [2] }]);
    expect(ps.map((p) => p.heading)).toEqual(["Effect order", "Keeping the low end clean", "Finding settings", undefined]);
    expect(ps[0]!.parts).toEqual([{ text: "Effects run top to bottom.", sources: [1] }]);
    expect(ps[1]!.parts[0]!.text).toBe("A splitter divides the sound.");
    expect(ps[2]!.parts).toEqual([]); // a heading on its own, followed by its paragraph
    expect(ps[3]!.parts[0]!.text).toBe("Click RANDOMIZE.");
    expect(toParagraphs([{ text: "Set it to 2 * 3 and press # to finish.", sources: [] }])[0]!.heading).toBeUndefined();
  });
  it("two wordings of a question that differ only in capitals and punctuation are the same question", () => {
    expect(sameQuestionKey("How do I assign an LFO, in Serum?")).toBe(sameQuestionKey("  how do i assign an lfo in serum"));
    expect(sameQuestionKey("how do I assign an LFO")).not.toBe(sameQuestionKey("how do I assign an envelope"));
  });
  it("things are remembered for a month, newest kept when full, and a browser that stores nothing remembers nothing", () => {
    const store = memory();
    remember("x", "a", { v: 1 }, 1000, store);
    expect(recall("x", "a", 2000, store)).toEqual({ v: 1 });
    expect(recall("x", "a", 1000 + CACHE_DAYS * 86_400_000 + 1, store)).toBeUndefined();
    expect(recall("x", "missing", 2000, store)).toBeUndefined();
    for (let i = 0; i < CACHE_MAX + 5; i++) remember("y", `k${i}`, i, i, store);
    expect(recall("y", "k0", CACHE_MAX, store)).toBeUndefined();
    expect(recall("y", `k${CACHE_MAX + 4}`, CACHE_MAX + 5, store)).toBe(CACHE_MAX + 4);
    expect(() => remember("z", "a", 1, 0, undefined)).not.toThrow();
    expect(recall("z", "a", 0, { getItem: () => "broken" })).toBeUndefined();
  });
  it("the sentence about a picture is tidied and kept short", () => {
    expect(cleanAbout("**The LFO area.**\n  Number 1 is the tab.")).toBe("The LFO area. Number 1 is the tab.");
    expect(cleanAbout("x".repeat(900))).toHaveLength(600);
  });
});

import { layoutMarks, type Mark } from "../src/library/point";
describe("placing the letters on a marked picture", () => {
  const mark = (n: number, x: number, y: number, w: number, h: number): Mark => ({ n, letter: "ABCDE"[n - 1]!, label: "", x, y, w, h });
  const apart = (placed: ReturnType<typeof layoutMarks>, width: number, height: number) => {
    const shownW = Math.min(width, 900), shownH = (shownW * height) / width;
    let nearest = Infinity;
    for (let i = 0; i < placed.length; i++) for (let j = i + 1; j < placed.length; j++) nearest = Math.min(nearest, Math.hypot((placed[i]!.bx - placed[j]!.bx) * shownW, (placed[i]!.by - placed[j]!.by) * shownH));
    return nearest;
  };
  it("keeps every letter clear of the others, even when boxes share a corner or sit on top of one another", () => {
    // the owner's case: a wide strip, a thin strip starting where a tiny marker is, and a big box below
    const marks = [mark(1, 0, 0.28, 1, 0.33), mark(2, 0.2, 0.25, 0.6, 0.02), mark(3, 0.2, 0.25, 0.02, 0.03), mark(4, 0, 0.0, 1, 0.06)];
    const placed = layoutMarks(marks, 1140, 345);
    expect(apart(placed, 1140, 345)).toBeGreaterThanOrEqual(30);
    const same = layoutMarks([mark(1, 0.4, 0.4, 0.2, 0.2), mark(2, 0.4, 0.4, 0.2, 0.2), mark(3, 0.4, 0.4, 0.2, 0.2)], 800, 600);
    expect(apart(same, 800, 600)).toBeGreaterThanOrEqual(30);
  });
  it("puts a letter on its box when there is room, and beside a small box with an arrow back to it", () => {
    const [big, tiny] = layoutMarks([mark(1, 0.1, 0.1, 0.4, 0.4), mark(2, 0.7, 0.6, 0.02, 0.03)], 800, 600) as [ReturnType<typeof layoutMarks>[0], ReturnType<typeof layoutMarks>[0]];
    expect(big.arrow).toBeUndefined();
    expect([big.bx, big.by]).toEqual([0.1, 0.1]);
    expect(tiny.arrow).toBeDefined();
    expect(tiny.arrow!.x).toBeGreaterThanOrEqual(0.7); expect(tiny.arrow!.x).toBeLessThanOrEqual(0.72);
    for (const p of [big, tiny]) { expect(p.bx).toBeGreaterThanOrEqual(0); expect(p.bx).toBeLessThanOrEqual(1); expect(p.by).toBeGreaterThanOrEqual(0); expect(p.by).toBeLessThanOrEqual(1); }
  });
});
