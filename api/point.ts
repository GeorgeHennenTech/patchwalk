// "Show me where": given one library picture and the learner's question, asks Claude to point at the places
// in the picture that matter, and returns boxes for the app to draw. One paid call per click. The picture is
// read from disk here, behind the same password check as everything else, and only by exact file name.
import { existsSync, readFileSync } from "node:fs";
import { join } from "node:path";
import Anthropic from "@anthropic-ai/sdk";
import { zodOutputFormat } from "@anthropic-ai/sdk/helpers/zod";
import { gate } from "../src/lesson/auth.js";
import { cleanAbout, cleanMarks, PointModelSchema, PointRequestSchema, POINT_SYSTEM } from "../src/library/point.js";

const MODEL = "claude-opus-5-5";

const json = (status: number, body: unknown) =>
  new Response(JSON.stringify(body), { status, headers: { "content-type": "application/json", "cache-control": "no-store" } });

export async function POST(request: Request): Promise<Response> {
  const access = gate(request.headers.get("authorization"), { APP_PASSWORD: process.env.APP_PASSWORD, VERCEL: process.env.VERCEL });
  if (access === "locked") return json(503, { error: "locked", message: "This site is locked: APP_PASSWORD is not set on the server." });
  if (access === "denied") return json(401, { error: "unauthorized", message: "Password required." });
  if (!process.env.ANTHROPIC_API_KEY) return json(503, { error: "not-configured", message: "The guide is switched off: no ANTHROPIC_API_KEY is set on the server." });
  const raw = await request.text();
  if (raw.length > 12_000) return json(413, { error: "too-large", message: "Request is too long." });
  let body: unknown;
  try { body = JSON.parse(raw); } catch { return json(400, { error: "bad-json", message: "Request body is not JSON." }); }
  const parsed = PointRequestSchema.safeParse(body);
  if (!parsed.success) return json(400, { error: "bad-request", message: "Name a library picture and ask a question." });
  const { book, file, question, answer } = parsed.data;

  // The picture, its size (from the book's picture index), and the text of the page it came from.
  const dir = join(process.cwd(), "library");
  let data: Buffer, size: { width: number; height: number; page: number } | undefined, pageText = "", title = book;
  try {
    data = readFileSync(join(dir, "images", book, file));
    const index = JSON.parse(readFileSync(join(dir, "images", book, "index.json"), "utf8")) as { images: { file: string; page: number; width: number; height: number }[] };
    size = index.images.find((im) => im.file === file);
    if (!size) return json(404, { error: "no-picture", message: "That picture is not in the library." });
    if (existsSync(join(dir, `${book}.json`))) {
      const doc = JSON.parse(readFileSync(join(dir, `${book}.json`), "utf8")) as { title: string; pages: { page: number; text: string }[] };
      title = doc.title;
      pageText = doc.pages.find((p) => p.page === size!.page)?.text ?? "";
    }
  } catch {
    return json(404, { error: "no-picture", message: "That picture is not in the library." });
  }

  const client = new Anthropic();
  try {
    const response = await client.messages.parse({
      model: MODEL,
      max_tokens: 4000,
      system: POINT_SYSTEM,
      output_config: { effort: "medium", format: zodOutputFormat(PointModelSchema) },
      messages: [{
        role: "user",
        content: [
          { type: "image", source: { type: "base64", media_type: "image/webp", data: data.toString("base64") } },
          { type: "text", text: `The picture is ${size.width} pixels wide and ${size.height} pixels high. It comes from ${title}, page ${size.page}.\n\nText of that page:\n${pageText || "(no text on this page)"}\n\nThe learner's question: ${question}${answer ? `\n\nThe answer the learner was given:\n${answer}` : ""}` },
        ],
      }],
    });
    if (response.stop_reason === "refusal") return json(502, { error: "upstream", message: "The guide declined to mark this picture." });
    if (!response.parsed_output) return json(502, { error: "upstream", message: "The guide's reply could not be read. Try again." });
    return json(200, { about: cleanAbout(response.parsed_output.about), marks: cleanMarks(response.parsed_output, size.width, size.height) });
  } catch (e) {
    if (e instanceof Anthropic.AuthenticationError) return json(503, { error: "not-configured", message: "The server's API key was rejected." });
    if (e instanceof Anthropic.RateLimitError) return json(429, { error: "rate-limited", message: "The guide is busy. Try again shortly." });
    if (e instanceof Anthropic.APIError) return json(502, { error: "upstream", message: `The Claude API returned an error (${e.status ?? "no status"}).` });
    console.error(e);
    return json(502, { error: "upstream", message: e instanceof Error ? e.message : "The guide failed." });
  }
}
