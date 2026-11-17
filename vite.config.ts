import { loadEnv, type Plugin } from "vite";
import { defineConfig } from "vitest/config";
import react from "@vitejs/plugin-react";
import type { IncomingMessage } from "node:http";

/** Serves the functions in api/ during `npm run dev`, the way Vercel does in production. */
function devApi(): Plugin {
  return {
    name: "dev-api",
    configureServer(server) {
      const env = loadEnv("development", process.cwd(), "");
      for (const k of ["ANTHROPIC_API_KEY", "APP_PASSWORD", "KV_REST_API_URL", "KV_REST_API_TOKEN", "UPSTASH_REDIS_REST_URL", "UPSTASH_REDIS_REST_TOKEN", "OWNER_EMAIL", "MAIL_FROM", "RESEND_API_KEY", "BREVO_API_KEY"]) if (env[k] && !process.env[k]) process.env[k] = env[k];
      for (const route of ["lesson", "ask", "walk", "serum", "library", "image", "point", "store", "account"]) server.middlewares.use(`/api/${route}`, async (req: IncomingMessage, res) => {
        try {
          const chunks: Buffer[] = [];
          for await (const c of req) chunks.push(c as Buffer);
          const mod = await server.ssrLoadModule(`/api/${route}.ts`);
          const handler = (mod as Record<string, (r: Request) => Promise<Response>>)[req.method ?? "GET"];
          if (!handler) { res.statusCode = 405; res.end(); return; }
          const isGet = req.method === "GET" || req.method === "HEAD";
          const out = await handler(new Request(`http://localhost${(req as IncomingMessage & { originalUrl?: string }).originalUrl ?? `/api/${route}`}`, { method: req.method, ...(isGet ? {} : { body: Buffer.concat(chunks) }), headers: { "content-type": "application/json", ...(req.headers.authorization ? { authorization: req.headers.authorization } : {}), ...(req.headers.cookie ? { cookie: req.headers.cookie } : {}), ...(typeof req.headers["x-anthropic-key"] === "string" ? { "x-anthropic-key": req.headers["x-anthropic-key"] } : {}) } }));
          res.statusCode = out.status;
          res.setHeader("content-type", out.headers.get("content-type") ?? "application/json");
          const cookie = out.headers.get("set-cookie");
          if (cookie) res.setHeader("set-cookie", cookie);
          res.end(Buffer.from(await out.arrayBuffer()));
        } catch (e) {
          console.error(e);
          res.statusCode = 500;
          res.setHeader("content-type", "application/json");
          res.end(JSON.stringify({ message: "The local explanation endpoint crashed. See the dev server log." }));
        }
      });
    },
  };
}

/** Which build this is, shown at the bottom of the page so it is easy to tell whether a new version has arrived. */
const BUILD = `${(process.env.VERCEL_GIT_COMMIT_SHA ?? "local").slice(0, 7)} · ${new Date().toISOString().slice(0, 16).replace("T", " ")} UTC`;

export default defineConfig({
  define: { __BUILD__: JSON.stringify(BUILD) },
  plugins: [react(), devApi()],
  test: { include: ["tests/**/*.test.ts"] },
});
