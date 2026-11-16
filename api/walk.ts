// "Walk me through it": plans a step-by-step walkthrough for a how-to question and writes its steps one at a
// time, each from the library passages found for that step. The browser asks for the outline first, then for
// each step as the learner reaches it, so a step that is never opened is never paid for. Same password and
// who-pays rules as the rest of the guide.
import Anthropic from "@anthropic-ai/sdk";
import { zodOutputFormat } from "@anthropic-ai/sdk/helpers/zod";
import { accountOf, isOwner, payer, tokenOf } from "../src/store/accounts.js";
import { listWalks, openWalk, removeWalk, saveDraw, savePlan, saveStep } from "../src/store/walks.js";
import { gate } from "../src/lesson/auth.js";
import { kvFromEnv } from "../src/store/kv.js";
import { ownKey, recallShared, rememberShared, walkKey } from "../src/store/shared.js";
import { search, type Index } from "../src/library/search.js";
import { makePlan, PLAN_SYSTEM, PlanModelSchema, STEP_SYSTEM, stepPrompt, stepSearch, WalkRequestSchema, writeStep, type Plan, type PlanCall, type StepBody, type StepCall } from "../src/library/walk.js";
import { cleanDrawing, DRAW_SYSTEM, DrawModelSchema, type Drawing } from "../src/library/draw.js";
import { libraryVersion, loadLibrary } from "./_library.js";

const MODEL = "claude-opus-5-5";
/** Passages read to plan the outline, and passages given to each step. */
const PLAN_PASSAGES = 10, STEP_PASSAGES = 5;

const json = (status: number, body: unknown) =>
  new Response(JSON.stringify(body), { status, headers: { "content-type": "application/json", "cache-control": "no-store" } });
const titleOf = (p: { source: string; page?: number; section: string }) => (p.page ? `${p.source}, page ${p.page} (${p.section})` : `${p.source}: ${p.section}`);

export async function POST(request: Request): Promise<Response> {
  const access = gate(request.headers.get("authorization"), { APP_PASSWORD: process.env.APP_PASSWORD, VERCEL: process.env.VERCEL });
  if (access === "locked") return json(503, { error: "locked", message: "This site is locked: APP_PASSWORD is not set on the server." });
  if (access === "denied") return json(401, { error: "unauthorized", message: "Password required." });
  const raw = await request.text();
  if (raw.length > 24_000) return json(413, { error: "too-large", message: "Request is too long." });
  let body: unknown;
  try { body = JSON.parse(raw); } catch { return json(400, { error: "bad-json", message: "Request body is not JSON." }); }
  const parsed = WalkRequestSchema.safeParse(body);
  if (!parsed.success) return json(400, { error: "bad-request", message: "Ask a how-to question between 3 and 600 characters." });
  const req = parsed.data;
  const kv = kvFromEnv();

  // The shared library: reading it costs nothing, so it needs only a signed-in person, not a key.
  if (req.kind === "list" || req.kind === "open" || req.kind === "remove") {
    if (!kv) return json(200, req.kind === "list" ? { walks: [], database: false } : { error: "no-database", message: "This site has no database, so there is no shared library." });
    try {
      const me = await accountOf(kv, tokenOf(request.headers));
      if (!me) return json(401, { error: "signed-out", message: "Sign in first (reload the page)." });
      const owner = isOwner(me, process.env.OWNER_EMAIL);
      if (req.kind === "list") return json(200, { walks: await listWalks(kv), database: true, owner });
      if (req.kind === "open") { const walk = await openWalk(kv, req.id); return walk ? json(200, walk) : json(404, { error: "gone", message: "That walkthrough is no longer in the library." }); }
      if (!owner) return json(403, { error: "owner-only", message: "Only the owner can remove a walkthrough from the library." });
      await removeWalk(kv, req.id);
      return json(200, { walks: await listWalks(kv), database: true, owner });
    } catch (e) { console.error(e); return json(502, { error: "database", message: "The site's database could not be reached. Try again." }); }
  }

  const own = ownKey(request.headers);
  // Only the owner's account may spend the site's key; anyone else must send a key of their own.
  const pays = await payer(kv, request.headers, own, process.env);
  if (!pays.ok) return json(pays.status, pays.body);
  if (req.kind === "step" && req.index >= req.steps.length) return json(400, { error: "bad-request", message: "That step is not in the walkthrough." });
  // Whatever is made is also put in the shared library, under the name of whoever asked. A database that fails here never stops the answer.
  const share = async <T,>(work: (store: NonNullable<typeof kv>) => Promise<T>): Promise<T | undefined> => { if (!kv) return undefined; try { return await work(kv); } catch (e) { console.error(e); return undefined; } };
  const asker = async () => (kv ? (await accountOf(kv, tokenOf(request.headers)))?.name ?? "someone" : "someone");

  let index: Index;
  try { index = loadLibrary(); } catch (e) { console.error(e); return json(500, { error: "no-library", message: "The library could not be loaded on the server." }); }
  const client = pays.key ? new Anthropic({ apiKey: pays.key }) : new Anthropic();

  try {
    if (req.kind === "plan") {
      // an outline already made for this question, by anyone using the site, is given again with no new call
      const key = walkKey(libraryVersion, req.question, "plan");
      if (!req.fresh) { const known = await recallShared<Plan>(kv, key); if (known?.covered) return json(200, { ...known, remembered: true, id: await share(async (store) => savePlan(store, req.question, known, await asker())) }); }
      const call: PlanCall = async ({ question, passages }) => {
        const response = await client.messages.parse({
          model: MODEL,
          max_tokens: 4000,
          system: PLAN_SYSTEM,
          output_config: { effort: "medium", format: zodOutputFormat(PlanModelSchema) },
          messages: [{ role: "user", content: `Passages found in the library:\n\n${passages.map((p, i) => `[${i + 1}] ${titleOf(p)}\n${p.text}`).join("\n\n")}\n\nThe learner's question: ${question}` }],
        });
        if (response.stop_reason === "refusal") throw new Error("The model declined to plan this.");
        return response.parsed_output ?? undefined;
      };
      const plan = await makePlan(req.question, search(index, req.question, PLAN_PASSAGES, { perPage: 1 }), call);
      if (plan.covered) await rememberShared(kv, key, plan);
      return json(200, plan.covered ? { ...plan, id: await share(async (store) => savePlan(store, req.question, plan, await asker())) } : plan);
    }

    if (req.kind === "draw") {
      // one call that only chooses a drawing and its settings; the app draws it. A drawing already chosen for this step is given again.
      const key = walkKey(libraryVersion, req.question, `draw: ${req.step} | ${req.text}`);
      if (!req.fresh) { const known = await recallShared<Drawing>(kv, key); if (known && typeof known.kind === "string") { if (req.id) await share((store) => saveDraw(store, req.id!, req.step, known)); return json(200, { ...known, remembered: true }); } }
      const response = await client.messages.parse({
        model: MODEL,
        max_tokens: 3000,
        system: DRAW_SYSTEM,
        output_config: { effort: "medium", format: zodOutputFormat(DrawModelSchema) },
        messages: [{ role: "user", content: `The learner asked: ${req.question}\n\nThe step: ${req.step}\n\nThe step as written:\n${req.text}` }],
      });
      if (response.stop_reason === "refusal") return json(502, { error: "upstream", message: "The guide declined to choose a drawing." });
      if (!response.parsed_output) return json(502, { error: "upstream", message: "The guide's reply could not be read. Try again." });
      const drawing = cleanDrawing(response.parsed_output);
      await rememberShared(kv, key, drawing);
      if (req.id) await share((store) => saveDraw(store, req.id!, req.step, drawing));
      return json(200, drawing);
    }

    const step = req.steps[req.index]!;
    const key = walkKey(libraryVersion, req.question, `step ${req.index} of ${req.steps.length}: ${step.title} | ${step.find} | ${step.kind} | ${req.tool}`);
    if (!req.fresh) { const known = await recallShared<StepBody>(kv, key); if (known && Array.isArray(known.blocks) && known.blocks.length) { if (req.id) await share((store) => saveStep(store, req.id!, req.index, step, known)); return json(200, { ...known, remembered: true }); } }
    const call: StepCall = async ({ prompt, passages }) => {
      const response = await client.messages.create({
        model: MODEL,
        max_tokens: 8000,
        system: [{ type: "text", text: STEP_SYSTEM, cache_control: { type: "ephemeral" } }],
        output_config: { effort: "medium" },
        messages: [{
          role: "user",
          content: [
            ...passages.map((p) => ({ type: "document" as const, source: { type: "text" as const, media_type: "text/plain" as const, data: p.text }, title: titleOf(p), citations: { enabled: true } })),
            { type: "text" as const, text: prompt },
          ],
        }],
      });
      if (response.stop_reason === "refusal") throw new Error("The model declined to write this step.");
      return response.content.flatMap((block) =>
        block.type === "text"
          ? [{ text: block.text, citations: (block.citations ?? []).flatMap((c) => ("document_index" in c ? [{ passageIndex: c.document_index, quote: c.cited_text }] : [])) }]
          : [],
      );
    };
    const { query, only } = stepSearch(req.question, req, req.index);
    const written = await writeStep(stepPrompt(req.question, req, req.index), search(index, query, STEP_PASSAGES, { only, perPage: 2 }), call);
    if (written.blocks.length) await rememberShared(kv, key, written);
    if (written.blocks.length && req.id) await share((store) => saveStep(store, req.id!, req.index, step, written));
    return json(200, written);
  } catch (e) {
    if (e instanceof Anthropic.AuthenticationError) return json(503, { error: "not-configured", message: "The server's API key was rejected." });
    if (e instanceof Anthropic.RateLimitError) return json(429, { error: "rate-limited", message: "The guide is busy. Try again shortly." });
    if (e instanceof Anthropic.APIError) return json(502, { error: "upstream", message: `The Claude API returned an error (${e.status ?? "no status"}).` });
    console.error(e);
    return json(502, { error: "upstream", message: e instanceof Error ? e.message : "The guide failed." });
  }
}
