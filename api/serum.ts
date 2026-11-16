// "Build this lesson in Serum 2": rewrites one practice lesson as steps for Serum 2, from the Serum 2 User
// Guide, once. What is built is kept in the site's database with no end date, so the next person to open that
// lesson (anyone signed in) gets it for nothing. Looking costs nothing; building is one paid call under the
// usual rule about who pays.
import Anthropic from "@anthropic-ai/sdk";
import { accountOf, payer, tokenOf } from "../src/store/accounts.js";
import { gate } from "../src/lesson/auth.js";
import { kvFromEnv } from "../src/store/kv.js";
import { ownKey, serumKey } from "../src/store/shared.js";
import { search, type Hit, type Index } from "../src/library/search.js";
import { MAX_SERUM_PASSAGES, PER_QUERY, SERUM_BOOK, SERUM_SYSTEM, SerumRequestSchema, serumPrompt, serumQueries } from "../src/library/serum.js";
import { writeStep, type StepBody, type StepCall } from "../src/library/walk.js";
import { loadLibrary } from "./_library.js";

const MODEL = "claude-opus-5-5";
const json = (status: number, body: unknown) =>
  new Response(JSON.stringify(body), { status, headers: { "content-type": "application/json", "cache-control": "no-store" } });
/** What is stored and sent back: the lesson in Serum 2, who had it built and when. */
export interface SerumLesson extends StepBody { by: string; at: string; built: true }

export async function POST(request: Request): Promise<Response> {
  const access = gate(request.headers.get("authorization"), { APP_PASSWORD: process.env.APP_PASSWORD, VERCEL: process.env.VERCEL });
  if (access === "locked") return json(503, { error: "locked", message: "This site is locked: APP_PASSWORD is not set on the server." });
  if (access === "denied") return json(401, { error: "unauthorized", message: "Password required." });
  const raw = await request.text();
  if (raw.length > 24_000) return json(413, { error: "too-large", message: "Request is too long." });
  let body: unknown;
  try { body = JSON.parse(raw); } catch { return json(400, { error: "bad-json", message: "Request body is not JSON." }); }
  const parsed = SerumRequestSchema.safeParse(body);
  if (!parsed.success) return json(400, { error: "bad-request", message: "That lesson could not be read." });
  const req = parsed.data;
  const kv = kvFromEnv();
  // The stored copy is named by the lesson and by its exact wording, so a lesson that is later rewritten is built afresh.
  const key = serumKey(req.lesson, serumPrompt(req));
  let asker = "someone";
  if (kv) {
    try {
      const me = await accountOf(kv, tokenOf(request.headers));
      if (!me) return json(401, { error: "signed-out", message: "Sign in first (reload the page)." });
      asker = me.name;
      if (!req.fresh) { const known = await kv.get<SerumLesson>(key); if (known?.built && Array.isArray(known.blocks)) return json(200, { ...known, remembered: true }); }
    } catch (e) { console.error(e); if (req.peek) return json(200, { built: false }); }
  }
  if (req.peek) return json(200, { built: false });

  const own = ownKey(request.headers);
  // Only the owner's account may spend the site's key; anyone else must send a key of their own.
  const pays = await payer(kv, request.headers, own, process.env);
  if (!pays.ok) return json(pays.status, pays.body);
  let index: Index;
  try { index = loadLibrary(); } catch (e) { console.error(e); return json(500, { error: "no-library", message: "The library could not be loaded on the server." }); }
  // one search per step, in the Serum 2 User Guide only: a product's own manual is the only authority on its controls
  const only = (p: { id: string }) => p.id.startsWith(`${SERUM_BOOK}#`), found = new Map<string, Hit>();
  for (const q of serumQueries(req)) for (const h of search(index, q, PER_QUERY, { only, perPage: 1 })) if (!found.has(h.passage.id) && found.size < MAX_SERUM_PASSAGES) found.set(h.passage.id, h);

  const client = pays.key ? new Anthropic({ apiKey: pays.key }) : new Anthropic();
  const call: StepCall = async ({ prompt, passages }) => {
    const response = await client.messages.create({
      model: MODEL,
      max_tokens: 12000,
      system: [{ type: "text", text: SERUM_SYSTEM, cache_control: { type: "ephemeral" } }],
      output_config: { effort: "medium" },
      messages: [{
        role: "user",
        content: [
          ...passages.map((p) => ({ type: "document" as const, source: { type: "text" as const, media_type: "text/plain" as const, data: p.text }, title: `${p.source}, page ${p.page} (${p.section})`, citations: { enabled: true } })),
          { type: "text" as const, text: prompt },
        ],
      }],
    });
    if (response.stop_reason === "refusal") throw new Error("The model declined to write this.");
    return response.content.flatMap((block) =>
      block.type === "text"
        ? [{ text: block.text, citations: (block.citations ?? []).flatMap((c) => ("document_index" in c ? [{ passageIndex: c.document_index, quote: c.cited_text }] : [])) }]
        : [],
    );
  };
  try {
    const written = await writeStep(serumPrompt(req), [...found.values()], call);
    if (!written.blocks.length) return json(200, { built: false, covered: false, message: "The Serum 2 User Guide pages in the library did not cover this lesson, so nothing was written." });
    const lesson: SerumLesson = { ...written, by: asker, at: new Date().toISOString(), built: true };
    if (kv) { try { await kv.set(key, lesson); } catch (e) { console.error(e); } }
    return json(200, lesson);
  } catch (e) {
    if (e instanceof Anthropic.AuthenticationError) return json(503, { error: "not-configured", message: "The server's API key was rejected." });
    if (e instanceof Anthropic.RateLimitError) return json(429, { error: "rate-limited", message: "The guide is busy. Try again shortly." });
    if (e instanceof Anthropic.APIError) return json(502, { error: "upstream", message: `The Claude API returned an error (${e.status ?? "no status"}).` });
    console.error(e);
    return json(502, { error: "upstream", message: e instanceof Error ? e.message : "The guide failed." });
  }
}
