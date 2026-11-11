import { loadEnv, type Plugin } from "vite";
import { defineConfig } from "vitest/config";
import react from "@vitejs/plugin-react";
import type { IncomingMessage } from "node:http";

/** Serves api/lesson.ts during `npm run dev`, the way Vercel does in production. */
function devApi(): Plugin {
  return {
    name: "dev-api",
    configureServer(server) {
      const env = loadEnv("development", process.cwd(), "");
      for (const k of ["ANTHROPIC_API_KEY", "APP_PASSWORD"]) if (env[k] && !process.env[k]) process.env[k] = env[k];
      server.middlewares.use("/api/lesson", async (req: IncomingMessage, res) => {
        try {
          const chunks: Buffer[] = [];
          for await (const c of req) chunks.push(c as Buffer);
          const mod = await server.ssrLoadModule("/api/lesson.ts");
          const handler = (mod as Record<string, (r: Request) => Promise<Response>>)[req.method ?? "GET"];
          if (!handler) { res.statusCode = 405; res.end(); return; }
          const out = await handler(new Request("http://localhost/api/lesson", { method: req.method, body: Buffer.concat(chunks), headers: { "content-type": "application/json", ...(req.headers.authorization ? { authorization: req.headers.authorization } : {}) } }));
          res.statusCode = out.status;
          res.setHeader("content-type", "application/json");
          res.end(await out.text());
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

export default defineConfig({
  plugins: [react(), devApi()],
  test: { include: ["tests/**/*.test.ts"] },
});
