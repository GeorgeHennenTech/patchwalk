import { existsSync, readdirSync, readFileSync } from "node:fs";
import { join } from "node:path";
import { afterEach, describe, expect, it } from "vitest";
import { HITS_MAX, SNIPPET_MAX, SOURCES, TOPICS, KIND_NAMES, snippet, summarise } from "../src/library/catalog";
import { POST } from "../api/sources";

const ROOT = join(__dirname, ".."), LIB = join(ROOT, "library"), has = existsSync(LIB);
const ask = async (body: unknown, headers: Record<string, string> = {}) => { const r = await POST(new Request("http://x/api/sources", { method: "POST", headers, body: JSON.stringify(body) })); return { status: r.status, body: (await r.json()) as any }; };

describe("the catalogue of sources", () => {
  it.skipIf(!has)("has a card for every text in the library and for nothing else", () => {
    const ids = readdirSync(LIB).filter((f) => f.endsWith(".json")).map((f) => (JSON.parse(readFileSync(join(LIB, f), "utf8")) as { id: string }).id).sort();
    expect(Object.keys(SOURCES).sort()).toEqual(ids);
  });
  it("every card is filled in, in plain words", () => {
    for (const [id, m] of Object.entries(SOURCES)) {
      expect(m.by.length, id).toBeGreaterThan(2); expect(m.year, id).toBeGreaterThan(1900); expect(m.year, id).toBeLessThanOrEqual(2026);
      expect(Object.keys(KIND_NAMES), id).toContain(m.kind); expect(TOPICS as readonly string[], id).toContain(m.topic);
      expect(m.about.length, id).toBeGreaterThan(40); expect(m.about.length, id).toBeLessThan(260); expect(m.added, id).toMatch(/^2026-11-\d\d$/);
      expect(m.about, id).not.toMatch(/—|amazing|revolutionary|brain/i);
    }
  });
  it("a card says how long a book is and what chapters it has, and carries none of its words", () => {
    const card = summarise({ id: "b", title: "A Paper (Someone, Journal 1999)", pages: [{ page: 3, chapter: "One", text: "alpha beta gamma" }, { page: 4, chapter: "One", text: "delta" }, { page: 5, chapter: "Two", text: "epsilon zeta" }, { page: 9, chapter: "One", text: "eta" }] }, 7);
    expect(card).toEqual({ id: "b", title: "A Paper", pages: 4, first: 3, last: 9, words: 7, pictures: 7, chapters: [{ name: "One", from: 3, to: 9, pages: 3 }, { name: "Two", from: 5, to: 5, pages: 1 }] });
    expect(JSON.stringify(card)).not.toMatch(/alpha|epsilon/);
  });
  it("an excerpt is a few lines around the asked-for word, never the whole page", () => {
    const page = `${"filler words go here. ".repeat(60)}The sidebands appear either side of the carrier. ${"more filler follows it. ".repeat(60)}`;
    const s = snippet(page, "sidebands");
    expect(s).toContain("sidebands"); expect(s.length).toBeLessThanOrEqual(SNIPPET_MAX + 4); expect(s.startsWith("… ")).toBe(true); expect(s.endsWith(" …")).toBe(true);
    expect(snippet("short page", "nothing")).toBe("short page");
    expect(snippet(page, "zzz").length).toBeLessThanOrEqual(SNIPPET_MAX + 4);
  });
});

describe.skipIf(!has)("the sources route", () => {
  const env = { ...process.env };
  afterEach(() => { process.env = { ...env }; });
  const local = () => { delete process.env.APP_PASSWORD; delete process.env.VERCEL; for (const k of Object.keys(process.env)) if (/KV_|UPSTASH/.test(k)) delete process.env[k]; };
  it("lists every source with its chapters", async () => {
    local();
    const r = await ask({ op: "list" });
    expect(r.status).toBe(200); expect(r.body.sources.length).toBe(Object.keys(SOURCES).length);
    const puckette = r.body.sources.find((s: any) => s.id === "puckette-electronic-music");
    expect(puckette.chapters.length).toBeGreaterThanOrEqual(10); expect(puckette.pictures).toBeGreaterThan(100); expect(JSON.stringify(r.body).length).toBeLessThan(60_000);
  });
  it("a search answers with page numbers and short excerpts from the right text, and can be kept to one source", async () => {
    local();
    const all = await ask({ op: "search", query: "how many saws in the super saw and how are they detuned" });
    expect(all.status).toBe(200); expect(all.body.hits.length).toBeGreaterThan(0); expect(all.body.hits.length).toBeLessThanOrEqual(HITS_MAX);
    expect(all.body.hits[0].book).toBe("szabo-super-saw");
    for (const h of all.body.hits) { expect(h.excerpt.length).toBeLessThanOrEqual(SNIPPET_MAX + 4); expect(h.page).toBeGreaterThan(0); expect(h.book).not.toMatch(/^card/); }
    const one = await ask({ op: "search", query: "delay", book: "dattorro-effect-design-1" });
    expect(one.body.hits.length).toBeGreaterThan(0); expect(one.body.hits.every((h: any) => h.book === "dattorro-effect-design-1")).toBe(true);
    expect(new Set(one.body.hits.map((h: any) => h.page)).size).toBe(one.body.hits.length);     // one excerpt a page
  });
  it("refuses what it should: no password, a bad request, and the deployed site with nobody signed in", async () => {
    local(); process.env.APP_PASSWORD = "secret";
    expect((await ask({ op: "list" })).status).toBe(401);
    const ok = { authorization: `Basic ${Buffer.from("me:secret").toString("base64")}` };
    expect((await ask({ op: "list" }, ok)).status).toBe(200);
    expect((await ask({ op: "search", query: "x" }, ok)).status).toBe(400);
    expect((await ask({ op: "page", book: "serum-2-user-guide", page: 3 }, ok)).status).toBe(400);   // there is no way to ask for a whole page
    process.env.VERCEL = "1";
    expect((await ask({ op: "list" }, ok)).status).toBe(503);
    delete process.env.APP_PASSWORD;
    expect((await ask({ op: "list" })).status).toBe(503);
  });
});
