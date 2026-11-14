// The site's small database: a key-value store reached over HTTPS (Upstash Redis, added to the Vercel project
// by the owner). Server only. Everything that uses it works without it: when no store is configured, or it
// cannot be reached, the app simply falls back to what each browser remembers by itself.

export interface Kv {
  /** The stored value, or undefined when there is none. Values are JSON. */
  get<T>(key: string): Promise<T | undefined>;
  /** Store a value, optionally for a limited number of seconds. */
  set(key: string, value: unknown, ttlSeconds?: number): Promise<void>;
  del(key: string): Promise<void>;
}

/** Vercel names the connection settings differently depending on how the store was added; accept either. */
export function kvSettings(env: Record<string, string | undefined>): { url: string; token: string } | undefined {
  for (const [u, t] of [["KV_REST_API_URL", "KV_REST_API_TOKEN"], ["UPSTASH_REDIS_REST_URL", "UPSTASH_REDIS_REST_TOKEN"]] as const) {
    if (env[u] && env[t]) return { url: env[u]!.replace(/\/+$/, ""), token: env[t]! };
  }
  // a custom prefix chosen when connecting the store ("PATCHWALK_KV_REST_API_URL")
  const key = Object.keys(env).find((k) => /(KV_REST_API_URL|REDIS_REST_URL)$/.test(k) && env[k]);
  if (!key) return undefined;
  const token = env[key.replace(/URL$/, "TOKEN")];
  return token ? { url: env[key]!.replace(/\/+$/, ""), token } : undefined;
}

/** The store, or undefined when the project has none. Each call is one small HTTPS request. */
export function kvFromEnv(env: Record<string, string | undefined> = process.env, fetchImpl: typeof fetch = fetch): Kv | undefined {
  const s = kvSettings(env);
  if (!s) return undefined;
  const run = async (command: (string | number)[]): Promise<unknown> => {
    const res = await fetchImpl(s.url, { method: "POST", headers: { authorization: `Bearer ${s.token}`, "content-type": "application/json" }, body: JSON.stringify(command) });
    const body = (await res.json().catch(() => undefined)) as { result?: unknown; error?: string } | undefined;
    if (!res.ok || !body || body.error) throw new Error(`The database refused a request (${res.status}${body?.error ? `: ${body.error}` : ""}).`);
    return body.result;
  };
  return {
    async get<T>(key: string) {
      const raw = await run(["GET", key]);
      if (typeof raw !== "string") return undefined;
      try { return JSON.parse(raw) as T; } catch { return undefined; }
    },
    async set(key, value, ttlSeconds) { await run(ttlSeconds ? ["SET", key, JSON.stringify(value), "EX", Math.round(ttlSeconds)] : ["SET", key, JSON.stringify(value)]); },
    async del(key) { await run(["DEL", key]); },
  };
}

/** A store kept in memory, for tests and for nothing else. */
export function memoryKv(): Kv & { data: Map<string, string> } {
  const data = new Map<string, string>();
  return {
    data,
    async get<T>(key: string) { const raw = data.get(key); return raw === undefined ? undefined : (JSON.parse(raw) as T); },
    async set(key, value) { data.set(key, JSON.stringify(value)); },
    async del(key) { data.delete(key); },
  };
}
