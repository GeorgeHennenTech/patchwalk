// "Ask the guide": answers a question from the private library (every book under library/ and the knowledge
// cards) with citations. The library is read from disk on the server and is never sent to the browser in
// bulk; only the few passages relevant to a question go to the Claude API.
import Anthropic from "@anthropic-ai/sdk";
import { payer } from "../src/store/accounts.js";
import { gate } from "../src/lesson/auth.js";
import { answerQuestion, AskRequestSchema, GUIDE_SYSTEM, type AskResponse, type GuideModel } from "../src/library/answer.js";
import { kvFromEnv } from "../src/store/kv.js";
import { answerKey, ownKey, recallShared, rememberShared } from "../src/store/shared.js";
import { libraryVersion, loadLibrary } from "./_library.js";
import { search, type Index } from "../src/library/search.js";
import { zodOutputFormat } from "@anthropic-ai/sdk/helpers/zod";
import { rerank, RERANK_POOL, RERANK_SYSTEM, RerankSchema } from "../src/library/rerank.js";

export { loadLibrary };

const MODEL = "claude-opus-5-5";
/** The small model that takes a second look at what the search found (the owner asked for a small model here). */
const RERANK_MODEL = "claude-haiku-5-5";

const json = (status: number, body: unknown) =>
  new Response(JSON.stringify(body), { status, headers: { "content-type": "application/json", "cache-control": "no-store" } });

export async function POST(request: Request): Promise<Response> {
  const access = gate(request.headers.get("authorization"), { APP_PASSWORD: process.env.APP_PASSWORD, VERCEL: process.env.VERCEL });
  if (access === "locked") return json(503, { error: "locked", message: "This site is locked: APP_PASSWORD is not set on the server." });
  if (access === "denied") return json(401, { error: "unauthorized", message: "Password required." });
  const own = ownKey(request.headers);
  // Only the owner's account may spend the site's key; anyone else must send a key of their own.
  const pays = await payer(kvFromEnv(), request.headers, own, process.env);
  if (!pays.ok) return json(pays.status, pays.body);
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
  const found = search(index, `${parsed.data.question} ${(parsed.data.context ?? "").split("\n")[0]} ${before}`, RERANK_POOL);

  const client = pays.key ? new Anthropic({ apiKey: pays.key }) : new Anthropic();
  // A small model reads the opening of each passage found and picks the six that fit the question best.
  // If it fails for any reason the search's own best six are used, so this can only help.
  const { hits } = await rerank(`${before ? `(Earlier question: ${before}) ` : ""}${parsed.data.question}`, found, 6, async (prompt) => {
    const picked = await client.messages.parse({
      model: RERANK_MODEL,
      max_tokens: 2000,
      system: RERANK_SYSTEM,
      output_config: { effort: "low", format: zodOutputFormat(RerankSchema) },
      messages: [{ role: "user", content: prompt }],
    }, { timeout: 20_000, maxRetries: 0 });
    return picked.parsed_output?.picks ?? [];
  });
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
