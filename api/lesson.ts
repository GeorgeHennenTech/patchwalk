// Vercel serverless function. The API key lives only here (ANTHROPIC_API_KEY in the project's
// environment variables) and never reaches the browser. The request carries code-selected facts
// and knowledge cards — never the preset file.
import Anthropic from "@anthropic-ai/sdk";
import { zodOutputFormat } from "@anthropic-ai/sdk/helpers/zod";
import { ownKey } from "../src/store/shared.js";
import { kvFromEnv } from "../src/store/kv.js";
import { payer } from "../src/store/accounts.js";
import { gate } from "../src/lesson/auth.js";
import { LessonRequestSchema, ModelOutputSchema } from "../src/lesson/contract.js";
import { SYSTEM_PROMPT, userPrompt } from "../src/lesson/prompt.js";
import { generateLessons, type ModelCall } from "../src/lesson/server.js";

const MODEL = "claude-opus-5-5";
const MAX_BODY_BYTES = 400_000;

const json = (status: number, body: unknown) =>
  new Response(JSON.stringify(body), { status, headers: { "content-type": "application/json", "cache-control": "no-store" } });

export async function POST(request: Request): Promise<Response> {
  // Checked here as well as in middleware.ts, so the paid call stays closed even if the middleware is misconfigured.
  const access = gate(request.headers.get("authorization"), { APP_PASSWORD: process.env.APP_PASSWORD, VERCEL: process.env.VERCEL });
  if (access === "locked") return json(503, { error: "locked", message: "This site is locked: APP_PASSWORD is not set on the server." });
  if (access === "denied") return json(401, { error: "unauthorized", message: "Password required." });
  // A learner may send their own Claude key with the request; it is used for this call only and never kept.
  const own = ownKey(request.headers);
  // Only the owner's account may spend the site's key; anyone else must send a key of their own.
  const pays = await payer(kvFromEnv(), request.headers, own, process.env);
  if (!pays.ok) return json(pays.status, pays.body);
  const raw = await request.text();
  if (raw.length > MAX_BODY_BYTES) return json(413, { error: "too-large", message: "Request is too large." });
  let body: unknown;
  try {
    body = JSON.parse(raw);
  } catch {
    return json(400, { error: "bad-json", message: "Request body is not JSON." });
  }
  const parsed = LessonRequestSchema.safeParse(body);
  if (!parsed.success) return json(400, { error: "bad-request", message: "Request does not match the lesson contract." });

  const client = pays.key ? new Anthropic({ apiKey: pays.key }) : new Anthropic();
  const callModel: ModelCall = async ({ difficulty, steps, patchText, feedback }) => {
    const response = await client.messages.parse({
      model: MODEL,
      max_tokens: 16000,
      system: [{ type: "text", text: SYSTEM_PROMPT, cache_control: { type: "ephemeral" } }],
      output_config: { effort: "medium", format: zodOutputFormat(ModelOutputSchema) },
      messages: [{ role: "user", content: userPrompt(difficulty, steps, patchText, feedback) }],
    });
    // A refusal or a truncated reply yields no usable lessons; the caller falls back to code-only text.
    if (response.stop_reason === "refusal") throw new Error("The model declined to write this lesson.");
    if (response.stop_reason === "max_tokens") throw new Error("The model's reply was cut off.");
    return response.parsed_output;
  };

  try {
    return json(200, await generateLessons(parsed.data, callModel));
  } catch (e) {
    if (e instanceof Anthropic.AuthenticationError) return json(503, { error: "not-configured", message: "The server's API key was rejected." });
    if (e instanceof Anthropic.RateLimitError) return json(429, { error: "rate-limited", message: "The explanation service is busy. Try again shortly." });
    console.error(e);
    return json(502, { error: "upstream", message: "The explanation service failed." });
  }
}
