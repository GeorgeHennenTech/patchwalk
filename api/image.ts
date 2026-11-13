// Serves one picture from the private library (for example a screenshot from a manual page the guide has
// just cited). Pictures are never part of the browser bundle: they are read from disk here, behind the same
// password check as the rest of the site, and only by exact file name.
import { readFileSync } from "node:fs";
import { join } from "node:path";
import { gate } from "../src/lesson/auth.js";

const text = (status: number, message: string) => new Response(message, { status, headers: { "content-type": "text/plain", "cache-control": "no-store" } });

export async function GET(request: Request): Promise<Response> {
  const access = gate(request.headers.get("authorization"), { APP_PASSWORD: process.env.APP_PASSWORD, VERCEL: process.env.VERCEL });
  if (access === "locked") return text(503, "This site is locked.");
  if (access === "denied") return text(401, "Password required.");
  const url = new URL(request.url);
  const book = url.searchParams.get("book") ?? "", file = url.searchParams.get("file") ?? "";
  // Names are checked against a strict pattern so a request can never reach outside library/images/.
  if (!/^[a-z0-9][a-z0-9-]{0,80}$/.test(book) || !/^p\d{1,5}-\d{1,3}\.webp$/.test(file)) return text(400, "Bad picture name.");
  try {
    const data = readFileSync(join(process.cwd(), "library", "images", book, file));
    return new Response(new Uint8Array(data), { status: 200, headers: { "content-type": "image/webp", "cache-control": "private, max-age=86400", "x-robots-tag": "noindex" } });
  } catch {
    return text(404, "No such picture.");
  }
}
