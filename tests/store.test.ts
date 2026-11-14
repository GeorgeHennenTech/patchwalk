import { describe, expect, it } from "vitest";
import { GET as storeGet, POST as storePost } from "../api/store";
import { saveDone, loadDone } from "../src/course/progress";
import { loadChats, replaceChats, type SavedChat } from "../src/guide/chats";
import { currentPlayer, guideHeaders, looksLikeKey, ownKey as browserKey, setCurrentPlayer, setOwnKey } from "../src/guide/me";
import { merge, playAs, pushNow, storeStatus } from "../src/guide/sync";
import { kvFromEnv, kvSettings, memoryKv } from "../src/store/kv";
import { change, listPlayers, loadPlayer, MAX_PLAYERS } from "../src/store/players";
import { answerKey, fingerprint, marksKey, ownKey, recallShared, rememberShared } from "../src/store/shared";

const chat = (id: string, savedAt: string, n = 1): SavedChat => ({ id, title: id, savedAt, turns: Array.from({ length: n }, (_, i) => ({ question: `q${i}` })) });

describe("the site's database", () => {
  it("is found under either of Vercel's names, or a custom prefix, and is absent otherwise", () => {
    expect(kvSettings({})).toBeUndefined();
    expect(kvSettings({ KV_REST_API_URL: "https://a.example/", KV_REST_API_TOKEN: "t" })).toEqual({ url: "https://a.example", token: "t" });
    expect(kvSettings({ UPSTASH_REDIS_REST_URL: "https://b.example", UPSTASH_REDIS_REST_TOKEN: "u" })).toEqual({ url: "https://b.example", token: "u" });
    expect(kvSettings({ PATCHWALK_KV_REST_API_URL: "https://c.example", PATCHWALK_KV_REST_API_TOKEN: "v" })).toEqual({ url: "https://c.example", token: "v" });
    expect(kvSettings({ KV_REST_API_URL: "https://a.example" })).toBeUndefined();
    expect(kvFromEnv({})).toBeUndefined();
  });
  it("speaks to the store with one small request per command and reads JSON back", async () => {
    const sent: unknown[] = [];
    const fake = (async (url: string, init: RequestInit) => {
      sent.push([url, (init.headers as Record<string, string>).authorization, JSON.parse(init.body as string)]);
      const cmd = JSON.parse(init.body as string) as string[];
      return new Response(JSON.stringify({ result: cmd[0] === "GET" ? JSON.stringify({ a: 1 }) : "OK" }), { status: 200 });
    }) as unknown as typeof fetch;
    const kv = kvFromEnv({ KV_REST_API_URL: "https://a.example", KV_REST_API_TOKEN: "t" }, fake)!;
    expect(await kv.get("k")).toEqual({ a: 1 });
    await kv.set("k", { b: 2 }, 60);
    await kv.del("k");
    expect(sent).toEqual([["https://a.example", "Bearer t", ["GET", "k"]], ["https://a.example", "Bearer t", ["SET", "k", JSON.stringify({ b: 2 }), "EX", 60]], ["https://a.example", "Bearer t", ["DEL", "k"]]]);
    const failing = kvFromEnv({ KV_REST_API_URL: "https://a.example", KV_REST_API_TOKEN: "t" }, (async () => new Response(JSON.stringify({ error: "WRONGPASS" }), { status: 401 })) as unknown as typeof fetch)!;
    await expect(failing.get("k")).rejects.toThrow(/refused/);
  });
});

describe("who's playing", () => {
  let n = 0; const id = () => `player${n++}`;
  it("people are added by name, once each, up to a limit, and removed with everything they saved", async () => {
    const kv = memoryKv();
    const a = await change(kv, { op: "add", name: "Seth" }, id, new Date("2026-11-14T00:00:00Z"));
    expect(a.status).toBe(200);
    expect((await change(kv, { op: "add", name: "seth" }, id)).status).toBe(409);
    const b = await change(kv, { op: "add", name: "Sam" }, id);
    const [seth, sam] = await listPlayers(kv);
    expect([seth!.name, sam!.name]).toEqual(["Seth", "Sam"]);
    expect(b.body.player).toEqual(sam);
    await change(kv, { op: "save", player: sam!.id, lessons: ["C0.1", "C0.1", "C0.2"], chats: [chat("c1", "2026-11-14T00:00:00Z")] }, id);
    expect(await loadPlayer(kv, sam!.id)).toEqual({ lessons: ["C0.1", "C0.2"], chats: [chat("c1", "2026-11-14T00:00:00Z")] });
    expect(await loadPlayer(kv, seth!.id)).toEqual({ lessons: [], chats: [] }); // each person's things are their own
    expect(await loadPlayer(kv, "nobody00")).toBeUndefined();
    expect((await change(kv, { op: "save", player: "nobody00", lessons: [], chats: [] }, id)).status).toBe(404);
    await change(kv, { op: "remove", player: sam!.id }, id);
    expect((await listPlayers(kv)).map((p) => p.name)).toEqual(["Seth"]);
    expect(await loadPlayer(kv, sam!.id)).toBeUndefined();
    for (let i = 0; i < MAX_PLAYERS - 1; i++) await change(kv, { op: "add", name: `friend ${i}` }, id);
    expect((await change(kv, { op: "add", name: "one too many" }, id)).status).toBe(409);
  });
  it("the endpoint is behind the password, and says plainly when there is no database", async () => {
    const env = { ...process.env };
    try {
      for (const k of Object.keys(process.env)) if (/KV_REST|REDIS_REST/.test(k)) delete process.env[k];
      process.env.VERCEL = "1"; process.env.APP_PASSWORD = "pw";
      expect((await storeGet(new Request("http://x/api/store"))).status).toBe(401);
      const auth = { authorization: `Basic ${Buffer.from("me:pw").toString("base64")}` };
      expect(await (await storeGet(new Request("http://x/api/store", { headers: auth }))).json()).toEqual({ configured: false, players: [] });
      expect((await storePost(new Request("http://x/api/store", { method: "POST", headers: auth, body: JSON.stringify({ op: "add", name: "Seth" }) }))).status).toBe(503);
      delete process.env.APP_PASSWORD;
      expect((await storeGet(new Request("http://x/api/store", { headers: auth }))).status).toBe(503);
    } finally { process.env = env; }
  });
  it("two copies of a person's things are joined: every lesson, and the newest version of each chat", () => {
    const joined = merge({ lessons: ["C0.1", "C0.2"], chats: [chat("a", "2026-11-14T10:00:00Z", 1), chat("b", "2026-11-13T10:00:00Z")] }, { lessons: ["C0.2", "C1.1"], chats: [chat("a", "2026-11-14T12:00:00Z", 2), chat("c", "2026-11-12T10:00:00Z")] });
    expect(joined.lessons).toEqual(["C0.1", "C0.2", "C1.1"]);
    expect(joined.chats.map((c) => [c.id, c.turns.length])).toEqual([["a", 2], ["b", 1], ["c", 1]]);
  });
});

describe("keeping a browser and the database in step", () => {
  /** A stand-in for the browser's storage and for /api/store, backed by a store in memory. */
  function world() {
    const kv = memoryKv(); let n = 0;
    const local = new Map<string, string>();
    (globalThis as { localStorage?: unknown }).localStorage = { getItem: (k: string) => local.get(k) ?? null, setItem: (k: string, v: string) => { local.set(k, v); }, removeItem: (k: string) => { local.delete(k); } };
    const api = (async (url: string, init?: RequestInit) => {
      const player = new URL(url, "http://x").searchParams.get("player");
      if (!init?.method) {
        const players = await listPlayers(kv);
        if (!player) return new Response(JSON.stringify({ configured: true, players }));
        const data = await loadPlayer(kv, player);
        return data ? new Response(JSON.stringify({ configured: true, players, data })) : new Response(JSON.stringify({ message: "no" }), { status: 404 });
      }
      const out = await change(kv, JSON.parse(init.body as string), () => `p${n++}abcde`);
      return new Response(JSON.stringify(out.body), { status: out.status });
    }) as unknown as typeof fetch;
    return { kv, api, newBrowser: () => local.clear(), end: () => { delete (globalThis as { localStorage?: unknown }).localStorage; } };
  }
  it("work done before the picker existed is kept under the first name chosen, and follows that person to a new browser", async () => {
    const w = world();
    try {
      saveDone(["C0.1", "C0.2"]); replaceChats([chat("old", "2026-11-13T00:00:00Z")]);
      await change(w.kv, { op: "add", name: "Seth" }, () => "seth000000");
      expect((await storeStatus(w.api)).players.map((p) => p.name)).toEqual(["Seth"]);
      expect((await playAs({ id: "seth000000", name: "Seth" }, true, w.api)).ok).toBe(true);
      expect(currentPlayer()).toEqual({ id: "seth000000", name: "Seth" });
      expect(await loadPlayer(w.kv, "seth000000")).toMatchObject({ lessons: ["C0.1", "C0.2"] });
      w.newBrowser(); // another device
      expect(loadDone()).toEqual([]);
      await playAs({ id: "seth000000", name: "Seth" }, false, w.api);
      expect(loadDone()).toEqual(["C0.1", "C0.2"]);
      expect(loadChats().map((c) => c.id)).toEqual(["old"]);
    } finally { w.end(); }
  });
  it("an older copy in one browser never overwrites newer work from another, and a deletion is not undone", async () => {
    const w = world();
    try {
      await change(w.kv, { op: "add", name: "Seth" }, () => "seth000000");
      await change(w.kv, { op: "save", player: "seth000000", lessons: ["C0.1", "C0.2", "C0.3"], chats: [chat("a", "2026-11-14T00:00:00Z")] }, () => "");
      setCurrentPlayer({ id: "seth000000", name: "Seth" }); saveDone(["C0.1", "C1.1"]); // this browser is behind, with one new lesson
      expect(await pushNow(w.api)).toBe(true);
      expect((await loadPlayer(w.kv, "seth000000"))!.lessons.sort()).toEqual(["C0.1", "C0.2", "C0.3", "C1.1"]);
      expect(loadDone().sort()).toEqual(["C0.1", "C0.2", "C0.3", "C1.1"]); // and the newer work arrived here too
      replaceChats([]); // the chat was deleted here
      await pushNow(w.api, currentPlayer(), true);
      expect((await loadPlayer(w.kv, "seth000000"))!.chats).toEqual([]);
    } finally { w.end(); }
  });
  it("switching to someone else replaces what this browser holds with their things", async () => {
    const w = world();
    try {
      await change(w.kv, { op: "add", name: "Seth" }, () => "seth000000"); await change(w.kv, { op: "add", name: "Sam" }, () => "sam0000000");
      await change(w.kv, { op: "save", player: "sam0000000", lessons: ["C2.1"], chats: [] }, () => "");
      setCurrentPlayer({ id: "seth000000", name: "Seth" }); saveDone(["C0.1"]);
      await playAs({ id: "sam0000000", name: "Sam" }, false, w.api);
      expect(loadDone()).toEqual(["C2.1"]);
      expect((await loadPlayer(w.kv, "seth000000"))!.lessons).toEqual(["C0.1"]); // Seth's were copied up before the switch
      expect((await playAs({ id: "nobody0000", name: "X" }, false, w.api)).ok).toBe(false);
    } finally { w.end(); }
  });
  it("with no database reachable, nothing is claimed", async () => {
    expect(await storeStatus((async () => { throw new Error("offline"); }) as unknown as typeof fetch)).toEqual({ configured: false, players: [] });
    expect(await pushNow((async () => new Response("{}")) as unknown as typeof fetch, undefined)).toBe(false);
  });
});

describe("shared memory and own keys", () => {
  it("the same question, in any wording that differs only in capitals and punctuation, has one key per library version", () => {
    expect(answerKey("v1", "How do I assign an LFO?")).toBe(answerKey("v1", "how do i assign an lfo"));
    expect(answerKey("v1", "How do I assign an LFO?")).not.toBe(answerKey("v2", "How do I assign an LFO?"));
    expect(marksKey("v", "book", "p001-1.webp", "where?")).not.toBe(marksKey("v", "book", "p001-2.webp", "where?"));
    expect(fingerprint(["a", 1])).toBe(fingerprint(["a", 1])); expect(fingerprint(["a", 1])).not.toBe(fingerprint(["a", 2]));
    expect(answerKey("v1", "anything")).toMatch(/^pw:ans:v1:[0-9a-f]{24}$/); // the question itself is not stored in the key
  });
  it("remembering and recalling work, and a missing or broken database only means not remembered", async () => {
    const kv = memoryKv();
    await rememberShared(kv, "k", { covered: true });
    expect(await recallShared(kv, "k")).toEqual({ covered: true });
    expect(await recallShared(kv, "other")).toBeUndefined();
    expect(await recallShared(undefined, "k")).toBeUndefined();
    await expect(rememberShared(undefined, "k", 1)).resolves.toBeUndefined();
    const broken = { get: async () => { throw new Error("down"); }, set: async () => { throw new Error("down"); }, del: async () => {} };
    expect(await recallShared(broken, "k")).toBeUndefined();
    await expect(rememberShared(broken, "k", 1)).resolves.toBeUndefined();
  });
  it("a person's own key is accepted only when it looks like one, and travels with their questions", () => {
    const good = `sk-ant-${"a".repeat(40)}`;
    expect(ownKey(new Headers({ "x-anthropic-key": good }))).toBe(good);
    expect(ownKey(new Headers({ "x-anthropic-key": "hello" }))).toBeUndefined();
    expect(ownKey(new Headers())).toBeUndefined();
    expect(looksLikeKey(good)).toBe(true); expect(looksLikeKey("sk-other-123")).toBe(false);
    const m = new Map<string, string>(), store = { getItem: (k: string) => m.get(k) ?? null, setItem: (k: string, v: string) => { m.set(k, v); }, removeItem: (k: string) => { m.delete(k); } };
    expect(guideHeaders(store)).toEqual({ "content-type": "application/json" });
    expect(setOwnKey("nonsense", store)).toBe(false);
    expect(setOwnKey(`  ${good} `, store)).toBe(true);
    expect(browserKey(store)).toBe(good);
    expect(guideHeaders(store)).toEqual({ "content-type": "application/json", "x-anthropic-key": good });
    setOwnKey(undefined, store);
    expect(guideHeaders(store)).toEqual({ "content-type": "application/json" });
  });
});
