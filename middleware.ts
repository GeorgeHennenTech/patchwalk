// Vercel Routing Middleware: runs in front of every request (pages, assets and /api) and asks for a
// password, so nobody without it can load or use the app. Set APP_PASSWORD in the Vercel project's
// environment variables. If it is missing, the site refuses everyone rather than opening up.
// Not used by `npm run dev`.
import { next } from "@vercel/functions";
import { gate } from "./src/lesson/auth.js";

export default function middleware(request: Request): Response {
  const result = gate(request.headers.get("authorization"), { APP_PASSWORD: process.env.APP_PASSWORD, VERCEL: "1" });
  if (result === "allowed") return next();
  if (result === "locked") {
    return new Response("This site is locked: APP_PASSWORD is not set on the server.", { status: 503, headers: { "cache-control": "no-store" } });
  }
  return new Response("Password required.", {
    status: 401,
    headers: { "WWW-Authenticate": 'Basic realm="Patchwalk", charset="UTF-8"', "cache-control": "no-store" },
  });
}
