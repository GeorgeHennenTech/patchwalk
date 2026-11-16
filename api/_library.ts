// Reads the private library from disk, on the server only: every book under library/ and every knowledge
// card, as passages ready to search. It lives beside the server functions (the underscore keeps it from being a route) because nothing under src/ may read files.
import { existsSync, readdirSync, readFileSync } from "node:fs";
import { join } from "node:path";
import { fingerprint } from "../src/store/shared.js";
import { buildIndex, splitText, type Index, type Passage, type PassageImage } from "../src/library/search.js";

let cached: Index | undefined;
/** Changes whenever the library's contents do, so answers remembered from an older library are not reused. */
export let libraryVersion = "";

/** Loads every document under library/ and every knowledge card, once per server instance. */
export function loadLibrary(root = process.cwd()): Index {
  if (cached) return cached;
  const passages: Passage[] = [];
  const dir = join(root, "library");
  for (const file of readdirSync(dir).filter((f) => f.endsWith(".json"))) {
    const doc = JSON.parse(readFileSync(join(dir, file), "utf8")) as { id: string; title: string; pages: { page: number; chapter: string; text: string }[] };
    // Pictures extracted from the same book, grouped by page, so a cited page can bring its screenshots.
    const byPage = new Map<number, PassageImage[]>();
    const imageIndex = join(dir, "images", doc.id, "index.json");
    if (existsSync(imageIndex)) {
      const listed = (JSON.parse(readFileSync(imageIndex, "utf8")) as { images: { file: string; page: number; width: number; height: number }[] }).images;
      // Small pictures are icons and buttons, not something that explains a topic.
      for (const im of listed) if (im.width >= 300 && im.height >= 120) byPage.set(im.page, [...(byPage.get(im.page) ?? []), { book: doc.id, file: im.file, width: im.width, height: im.height }]);
    }
    for (const p of doc.pages) {
      const id = `${doc.id}#${p.page}`, parts = splitText(p.text);
      // a long page is searched in parts; each part still belongs to its page, and brings the page's pictures
      parts.forEach((text, k) => passages.push({ id: parts.length > 1 ? `${id}~${k + 1}` : id, ...(parts.length > 1 ? { of: id } : {}), source: doc.title, page: p.page, section: p.chapter, text, ...(byPage.has(p.page) ? { images: byPage.get(p.page) } : {}) }));
    }
  }
  const cards = join(root, "knowledge-cards");
  for (const file of readdirSync(cards).filter((f) => f.endsWith(".md") && !f.startsWith("_"))) {
    const m = /^---\r?\n([\s\S]*?)\r?\n---\r?\n?([\s\S]*)$/.exec(readFileSync(join(cards, file), "utf8"));
    if (!m) continue;
    const title = /^title:\s*(.+)$/m.exec(m[1]!)?.[1]?.trim() ?? file;
    passages.push({ id: `card:${file.replace(/\.md$/, "")}`, source: "Knowledge card (draft)", section: title, text: m[2]!.trim() });
  }
  // pictures count too: an answer remembered with a picture that has since been removed must not come back
  libraryVersion = fingerprint(passages.map((p) => `${p.id}:${p.text.length}:${(p.images ?? []).map((i) => i.file).join(",")}`));
  cached = buildIndex(passages);
  return cached;
}
