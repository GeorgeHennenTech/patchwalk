// "Ask the guide": answers a question from the private library (every book under library/ and the knowledge
// cards) with citations. The library is read from disk on the server and is never sent to the browser in
// bulk; only the few passages relevant to a question go to the Claude API.
import { existsSync, readdirSync, readFileSync } from "node:fs";
import { join } from "node:path";
import Anthropic from "@anthropic-ai/sdk";
import { gate } from "../src/lesson/auth.js";
import { answerQuestion, AskRequestSchema, GUIDE_SYSTEM, type AskResponse, type GuideModel } from "../src/library/answer.js";
import { kvFromEnv } from "../src/store/kv.js";
import { answerKey, fingerprint, ownKey, recallShared, rememberShared } from "../src/store/shared.js";
import { buildIndex, search, type Index, type Passage, type PassageImage } from "../src/library/search.js";

const MODEL = "claude-opus-5-5";

const json = (status: number, body: unknown) =>
  new Response(JSON.stringify(body), { status, headers: { "content-type": "application/json", "cache-control": "no-store" } });

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
    for (const p of doc.pages) passages.push({ id: `${doc.id}#${p.page}`, source: doc.title, page: p.page, section: p.chapter, text: p.text, ...(byPage.has(p.page) ? { images: byPage.get(p.page) } : {}) });
  }
  const cards = join(root, "knowledge-cards");
  for (const file of readdirSync(cards).filter((f) => f.endsWith(".md") && !f.startsWith("_"))) {
    const m = /^---\r?\n([\s\S]*?)\r?\n---\r?\n?([\s\S]*)$/.exec(readFileSync(join(cards, file), "utf8"));
    if (!m) continue;
    const title = /^title:\s*(.+)$/m.exec(m[1]!)?.[1]?.trim() ?? file;
    passages.push({ id: `card:${file.replace(/\.md$/, "")}`, source: "Knowledge card (draft)", section: title, text: m[2]!.trim() });
  }
  libraryVersion = fingerprint(passages.map((p) => `${p.id}:${p.text.length}`));
  cached = buildIndex(passages);
  return cached;
}

export async function POST(request: Request): Promise<Response> {
  const access = gate(request.headers.get("authorization"), { APP_PASSWORD: process.env.APP_PASSWORD, VERCEL: process.env.VERCEL });
  if (access === "locked") return json(503, { error: "locked", message: "This site is locked: APP_PASSWORD is not set on the server." });
  if (access === "denied") return json(401, { error: "unauthorized", message: "Password required." });
  const own = ownKey(request.headers);
  if (!own && !process.env.ANTHROPIC_API_KEY) {
    return json(503, { error: "not-configured", message: "The guide is switched off: no ANTHROPIC_API_KEY is set on the server." });
  }
  const raw = await request.text();
  if (raw.length > 24_000) return json(413, { error: "too-large", message: "Question is too long." });
  let body: unknown;
  try {
    body = JSON.parse(raw);
  } catch {
    return json(400, { error: "bad-json", message: "Request body is not JSON." });
  }
  const parsed = AskRequestSchema.safeParse(body);
  if (!parsed.success) return json(400, { error: "bad-request", message: "Ask a question between 3 and 600 characters." });

  let index: Index;
  try {
    index = loadLibrary();
  } catch (e) {
    console.error(e);
    return json(500, { error: "no-library", message: "The library could not be loaded on the server." });
  }
  // The first line of the context is the topic (a lesson or step title); the rest is detail for the model only.
  // An opening question that has been answered before, by anyone using the site, is given the same answer
  // again with no new call. A follow-up, or a question asked from inside a lesson, depends on its context
  // and is always asked. `fresh` asks anew on purpose.
  const kv = kvFromEnv();
  const sharedKey = !parsed.data.history?.length && !parsed.data.context ? answerKey(libraryVersion, parsed.data.question) : undefined;
  if (sharedKey && !parsed.data.fresh) {
    const known = await recallShared<AskResponse>(kv, sharedKey);
    if (known?.covered) return json(200, { ...known, remembered: true });
  }
  // A follow-up ("and what about its rate?") is searched together with the question before it.
  const before = parsed.data.history?.at(-1)?.question ?? "";
  const hits = search(index, `${parsed.data.question} ${(parsed.data.context ?? "").split("\n")[0]} ${before}`, 6);

  const client = own ? new Anthropic({ apiKey: own }) : new Anthropic();
  const model: GuideModel = async ({ question, context, passages, history }) => {
    const response = await client.messages.create({
      model: MODEL,
      max_tokens: 8000,
      system: [{ type: "text", text: GUIDE_SYSTEM, cache_control: { type: "ephemeral" } }],
      output_config: { effort: "medium" },
      messages: [{
        role: "user",
        content: [
          ...passages.map((p) => ({
            type: "document" as const,
            source: { type: "text" as const, media_type: "text/plain" as const, data: p.text },
            title: p.page ? `${p.source}, page ${p.page} (${p.section})` : `${p.source}: ${p.section}`,
            citations: { enabled: true },
          })),
          { type: "text" as const, text: `${history?.length ? `Earlier in this conversation (context only, not a source):\n${history.map((h) => `Learner: ${h.question}\nGuide: ${h.answer}`).join("\n\n")}\n\n` : ""}${context ? `The learner is currently looking at: ${context}\n\n` : ""}Question: ${question}` },
        ],
      }],
    });
    if (response.stop_reason === "refusal") throw new Error("The model declined to answer.");
    return response.content.flatMap((block) =>
      block.type === "text"
        ? [{ text: block.text, citations: (block.citations ?? []).flatMap((c) => ("document_index" in c ? [{ passageIndex: c.document_index, quote: c.cited_text }] : [])) }]
        : [],
    );
  };

  try {
    const answer = await answerQuestion(parsed.data, hits, model);
    if (sharedKey && answer.covered) await rememberShared(kv, sharedKey, answer);
    return json(200, answer);
  } catch (e) {
    if (e instanceof Anthropic.AuthenticationError) return json(503, { error: "not-configured", message: "The server's API key was rejected." });
    if (e instanceof Anthropic.RateLimitError) return json(429, { error: "rate-limited", message: "The guide is busy. Try again shortly." });
    if (e instanceof Anthropic.APIError) return json(502, { error: "upstream", message: `The Claude API returned an error (${e.status ?? "no status"}).` });
    console.error(e);
    return json(502, { error: "upstream", message: e instanceof Error ? e.message : "The guide failed." });
  }
}
