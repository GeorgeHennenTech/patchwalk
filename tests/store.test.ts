import { describe, expect, it } from "vitest";
import { GET as accountGet, POST as accountPost } from "../api/account";
import { POST as askPost } from "../api/ask";
import { POST as lessonPost } from "../api/lesson";
import { POST as pointPost } from "../api/point";
import { GET as storeGet } from "../api/store";
import { saveDone, loadDone } from "../src/course/progress";
import { loadChats, replaceChats, type SavedChat } from "../src/guide/chats";
import { currentPlayer, guideHeaders, looksLikeKey, ownKey as browserKey, setCurrentPlayer, setOwnKey } from "../src/guide/me";
import { merge, pushNow, session, signIn, signOut, signUp } from "../src/guide/sync";
import { kvFromEnv, kvSettings, memoryKv } from "../src/store/kv";
import { AccountRequestSchema, accountOf, handle, listAccounts, loadData, MAX_ACCOUNTS, MAX_FAILS, payer, status } from "../src/store/accounts";
import { mailerFromEnv } from "../src/store/mail";
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

/** The same store with the "asked a moment ago" marks cleared, so a second request is not skipped. */
const memoryKvWith = (kv: ReturnType<typeof memoryKv>) => { for (const k of [...kv.data.keys()]) if (k.startsWith("pw:asked:")) kv.data.delete(k); return kv; };

describe("accounts", () => {
  let n = 0;
  const ctx = (token?: string, ownerEmail = "seth@example.com") => ({ token, ownerEmail, newId: () => `acct${String(n++).padStart(4, "0")}`, newToken: () => String(n++).padStart(64, "a") });
  const join = async (kv: ReturnType<typeof memoryKv>, name: string, email: string) => (await handle(kv, { op: "signup", name, email, password: "correct horse" }, ctx())).session as string;

  it("an account needs an email and a real password, once each; the password itself is never stored", async () => {
    const kv = memoryKv();
    expect(AccountRequestSchema.safeParse({ op: "signup", name: "Seth", email: "not an email", password: "correct horse" }).success).toBe(false);
    expect(AccountRequestSchema.safeParse({ op: "signup", name: "Seth", email: "seth@example.com", password: "short" }).success).toBe(false);
    expect(AccountRequestSchema.parse({ op: "signup", name: "Seth", email: " Seth@Example.com ", password: "correct horse" })).toMatchObject({ email: "seth@example.com" });
    const token = await join(kv, "Seth", "seth@example.com");
    expect(token).toHaveLength(64);
    expect((await handle(kv, { op: "signup", name: "Other", email: "seth@example.com", password: "correct horse" }, ctx())).body.error).toBe("email-taken");
    expect((await handle(kv, { op: "signup", name: "seth", email: "b@example.com", password: "correct horse" }, ctx())).body.error).toBe("name-taken");
    const stored = [...kv.data.entries()].map(([k, v]) => k + v).join(" ");
    expect(stored).not.toContain("correct horse");
    expect(stored).not.toContain(token); // only a hash of the session token is kept
  });
  it("signing in needs the right password, and too many wrong ones lock the email for a while", async () => {
    const kv = memoryKv();
    await join(kv, "Seth", "seth@example.com");
    expect((await handle(kv, { op: "signin", email: "seth@example.com", password: "wrong" }, ctx())).status).toBe(401);
    expect((await handle(kv, { op: "signin", email: "nobody@example.com", password: "correct horse" }, ctx())).status).toBe(401);
    const good = await handle(kv, { op: "signin", email: "seth@example.com", password: "correct horse" }, ctx());
    expect(good.status).toBe(200);
    expect((await accountOf(kv, good.session as string))!.name).toBe("Seth");
    await handle(kv, { op: "signout" }, ctx(good.session as string));
    expect(await accountOf(kv, good.session as string)).toBeUndefined();
    for (let i = 0; i < MAX_FAILS; i++) await handle(kv, { op: "signin", email: "seth@example.com", password: "wrong" }, ctx());
    expect((await handle(kv, { op: "signin", email: "seth@example.com", password: "correct horse" }, ctx())).status).toBe(429);
  });
  it("each person's saved things are their own, and only reachable signed in", async () => {
    const kv = memoryKv();
    const seth = await join(kv, "Seth", "seth@example.com"), sam = await join(kv, "Sam", "sam@example.com");
    expect((await handle(kv, { op: "save", lessons: ["C0.1"], chats: [] }, ctx())).status).toBe(401);
    await handle(kv, { op: "save", lessons: ["C0.1", "C0.1", "C0.2"], chats: [chat("c1", "2026-11-14T00:00:00Z")] }, ctx(sam));
    expect((await status(kv, sam, "seth@example.com", { data: true })).data).toEqual({ lessons: ["C0.1", "C0.2"], chats: [chat("c1", "2026-11-14T00:00:00Z")], patches: [], recall: {} });
    expect((await status(kv, seth, "seth@example.com", { data: true })).data).toEqual({ lessons: [], chats: [], patches: [], recall: {} });
    expect(await status(kv, undefined, "seth@example.com", { data: true, people: true })).toEqual({ configured: true });
  });
  it("only the owner sees everyone, sets someone's password or removes them; anyone can change their own password or leave", async () => {
    const kv = memoryKv();
    const seth = await join(kv, "Seth", "seth@example.com"), sam = await join(kv, "Sam", "sam@example.com");
    const [a, b] = await listAccounts(kv);
    expect(((await status(kv, seth, "seth@example.com", { people: true })).people as unknown[]).length).toBe(2);
    expect((await status(kv, sam, "seth@example.com", { people: true })).people).toBeUndefined();
    expect((await status(kv, sam, "seth@example.com")).account).toMatchObject({ name: "Sam", owner: false });
    expect((await status(kv, seth, "seth@example.com")).account).toMatchObject({ owner: true });
    expect((await status(kv, seth, undefined)).account).toMatchObject({ owner: false }); // no owner set: nobody is the owner
    expect((await handle(kv, { op: "reset", account: a!.id, next: "hijacked now" }, ctx(sam))).status).toBe(403);
    expect((await handle(kv, { op: "remove", account: a!.id }, ctx(sam))).status).toBe(403);
    expect((await handle(kv, { op: "password", old: "wrong", next: "another one!" }, ctx(sam))).status).toBe(401);
    expect((await handle(kv, { op: "password", old: "correct horse", next: "another one!" }, ctx(sam))).status).toBe(200);
    expect((await handle(kv, { op: "signin", email: "sam@example.com", password: "another one!" }, ctx())).status).toBe(200);
    expect((await handle(kv, { op: "reset", account: b!.id, next: "from the owner" }, ctx(seth))).status).toBe(200);
    expect((await handle(kv, { op: "signin", email: "sam@example.com", password: "from the owner" }, ctx())).status).toBe(200);
    expect((await handle(kv, { op: "remove", account: b!.id }, ctx(seth))).status).toBe(200);
    expect((await listAccounts(kv)).map((x) => x.name)).toEqual(["Seth"]);
    expect(await accountOf(kv, sam)).toBeUndefined(); // a removed person's session is worth nothing
    for (let i = 0; i < MAX_ACCOUNTS - 1; i++) await join(kv, `friend ${i}`, `f${i}@example.com`);
    expect((await handle(kv, { op: "signup", name: "one too many", email: "x@example.com", password: "correct horse" }, ctx())).status).toBe(409);
  });
  it("a forgotten password is replaced through a link sent to the account's email: once, for a while, and only there", async () => {
    const kv = memoryKv(), sent: { to: string; text: string }[] = [];
    await join(kv, "Sam", "sam@example.com");
    const mail = async (to: string, _s: string, text: string) => { sent.push({ to, text }); return true; };
    const c = () => ({ ...ctx(), mail, origin: "https://site.example" });
    expect((await handle(kv, { op: "forgot", email: "sam@example.com" }, ctx())).body.error).toBe("no-mail"); // no mail service: said plainly
    expect((await handle(kv, { op: "forgot", email: "nobody@example.com" }, c())).body).toEqual({ sent: true }); // no telling who has an account
    expect(sent).toEqual([]);
    expect((await handle(kv, { op: "forgot", email: "sam@example.com" }, c())).body).toEqual({ sent: true });
    expect(sent).toHaveLength(1);
    expect(sent[0]!.to).toBe("sam@example.com");
    const token = /https:\/\/site\.example\/\?reset=([a-f0-9]{64})/.exec(sent[0]!.text)![1]!;
    expect([...kv.data.entries()].map(([k, v]) => k + v).join(" ")).not.toContain(token); // only its hash is kept
    await handle(kv, { op: "forgot", email: "sam@example.com" }, c());
    expect(sent).toHaveLength(1); // asking again straight away sends nothing more
    expect((await handle(kv, { op: "recover", token: "0".repeat(64), next: "brand new pw" }, c())).status).toBe(410);
    const done = await handle(kv, { op: "recover", token, next: "brand new pw" }, c());
    expect(done.status).toBe(200);
    expect((await accountOf(kv, done.session as string))!.name).toBe("Sam"); // and signed in
    expect((await handle(kv, { op: "recover", token, next: "another go!!" }, c())).status).toBe(410); // the link works once
    expect((await handle(kv, { op: "signin", email: "sam@example.com", password: "correct horse" }, ctx())).status).toBe(401);
    expect((await handle(kv, { op: "signin", email: "sam@example.com", password: "brand new pw" }, ctx())).status).toBe(200);
    const failing = await handle(memoryKvWith(kv), { op: "forgot", email: "sam@example.com" }, { ...ctx(), mail: async () => false, origin: "https://site.example" });
    expect(failing.status).toBe(502);
  });
  it("the mail service is whichever the owner has set a key for, and none without a sender address", async () => {
    const calls: { url: string; init: RequestInit }[] = [];
    const f = (async (url: string, init: RequestInit) => { calls.push({ url, init }); return new Response("{}"); }) as unknown as typeof fetch;
    expect(mailerFromEnv({}, f)).toBeUndefined();
    expect(mailerFromEnv({ RESEND_API_KEY: "k" }, f)).toBeUndefined();
    expect(await mailerFromEnv({ RESEND_API_KEY: "k", MAIL_FROM: "a@b.co" }, f)!("to@x.co", "s", "t")).toBe(true);
    expect(await mailerFromEnv({ BREVO_API_KEY: "k", MAIL_FROM: "a@b.co" }, f)!("to@x.co", "s", "t")).toBe(true);
    expect(calls.map((c) => new URL(c.url).host)).toEqual(["api.resend.com", "api.brevo.com"]);
    expect(await mailerFromEnv({ BREVO_API_KEY: "k", MAIL_FROM: "a@b.co" }, (async () => { throw new Error("down"); }) as unknown as typeof fetch)!("to@x.co", "s", "t")).toBe(false);
  });
  it("the site's Claude key is spent for the owner's account and for nobody else", async () => {
    const kv = memoryKv();
    const seth = await join(kv, "Seth", "seth@example.com"), sam = await join(kv, "Sam", "sam@example.com");
    const env = { VERCEL: "1", OWNER_EMAIL: "Seth@Example.com", ANTHROPIC_API_KEY: "site-key" };
    const as = (token?: string) => new Headers(token ? { cookie: `other=1; pw_session=${token}` } : {});
    expect(await payer(kv, as(seth), undefined, env)).toEqual({ ok: true }); // the owner: the site's key
    expect(await payer(kv, as(sam), undefined, env)).toMatchObject({ ok: false, status: 402, body: { error: "needs-key" } });
    expect(await payer(kv, as(sam), "sk-ant-own", env)).toEqual({ ok: true, key: "sk-ant-own" }); // a friend with their own key
    expect(await payer(kv, as(), undefined, env)).toMatchObject({ ok: false, status: 401 });
    expect(await payer(kv, as(), "sk-ant-own", env)).toMatchObject({ ok: false, status: 401 }); // even a key needs an account
    expect(await payer(kv, as("f".repeat(64)), undefined, env)).toMatchObject({ ok: false, status: 401 }); // a made-up session
    expect(await payer(kv, as(seth), undefined, { ...env, OWNER_EMAIL: undefined })).toMatchObject({ ok: false, status: 402 }); // no owner set: nobody
    expect(await payer(kv, as(seth), undefined, { ...env, OWNER_EMAIL: " " })).toMatchObject({ ok: false, status: 402 });
    // an account made with the owner's name but another email is not the owner
    const fake = await join(kv, "Seth 2", "seth@example.org");
    expect(await payer(kv, as(fake), undefined, env)).toMatchObject({ ok: false, status: 402 });
    expect(await payer(undefined, as(seth), undefined, env)).toMatchObject({ ok: false, status: 503 }); // live site, no database: closed
    expect(await payer(undefined, as(), undefined, { ANTHROPIC_API_KEY: "local" })).toEqual({ ok: true }); // a developer's machine
    const broken = { ...kv, get: async () => { throw new Error("down"); } } as unknown as typeof kv;
    expect(await payer(broken, as(seth), undefined, env)).toMatchObject({ ok: false, status: 502 }); // cannot recognise anyone: closed
  });
  it("the endpoints are behind the site password, and the paid ones refuse a visitor who is not signed in", async () => {
    const env = { ...process.env };
    try {
      for (const k of Object.keys(process.env)) if (/KV_REST|REDIS_REST/.test(k)) delete process.env[k];
      process.env.VERCEL = "1"; process.env.APP_PASSWORD = "pw"; process.env.ANTHROPIC_API_KEY = "site-key";
      expect((await accountGet(new Request("http://x/api/account"))).status).toBe(401);
      const auth = { authorization: `Basic ${Buffer.from("me:pw").toString("base64")}` };
      expect(await (await accountGet(new Request("http://x/api/account", { headers: auth }))).json()).toEqual({ configured: false, deployed: true });
      expect((await accountPost(new Request("http://x/api/account", { method: "POST", headers: auth, body: JSON.stringify({ op: "signin", email: "a@b.co", password: "x" }) }))).status).toBe(503);
      expect(await (await storeGet(new Request("http://x/api/store", { headers: auth }))).json()).toEqual({ configured: false });
      for (const paid of [askPost, pointPost, lessonPost]) expect((await paid(new Request("http://x/api/x", { method: "POST", headers: auth, body: "{}" }))).status).toBe(503);
      delete process.env.APP_PASSWORD;
      expect((await accountGet(new Request("http://x/api/account", { headers: auth }))).status).toBe(503);
    } finally { process.env = env; }
  });
  it("two copies of a person's things are joined: every lesson, and the newest version of each chat", () => {
    const joined = merge({ lessons: ["C0.1", "C0.2"], chats: [chat("a", "2026-11-14T10:00:00Z", 1), chat("b", "2026-11-13T10:00:00Z")] }, { lessons: ["C0.2", "C1.1"], chats: [chat("a", "2026-11-14T12:00:00Z", 2), chat("c", "2026-11-12T10:00:00Z")] });
    expect(joined.lessons).toEqual(["C0.1", "C0.2", "C1.1"]);
    expect(joined.chats.map((c) => [c.id, c.turns.length])).toEqual([["a", 2], ["b", 1], ["c", 1]]);
  });
});

describe("keeping a browser and the database in step", () => {
  /** A stand-in for the browser's storage, its cookie, and /api/account, backed by a store in memory. */
  function world() {
    const kv = memoryKv(); let n = 0, cookie: string | undefined;
    const local = new Map<string, string>();
    (globalThis as { localStorage?: unknown }).localStorage = { getItem: (k: string) => local.get(k) ?? null, setItem: (k: string, v: string) => { local.set(k, v); }, removeItem: (k: string) => { local.delete(k); } };
    const api = (async (url: string, init?: RequestInit) => {
      const q = new URL(url, "http://x").searchParams;
      if (!init?.method) return new Response(JSON.stringify({ ...(await status(kv, cookie, "seth@example.com", { data: !!q.get("data"), people: !!q.get("people") })), ownerSet: true }));
      const out = await handle(kv, AccountRequestSchema.parse(JSON.parse(init.body as string)), { token: cookie, ownerEmail: "seth@example.com", newId: () => `acct${String(n++).padStart(4, "0")}`, newToken: () => String(n++).padStart(64, "b") });
      if (out.session !== undefined) cookie = out.session ?? undefined;
      return new Response(JSON.stringify(out.body), { status: out.status });
    }) as unknown as typeof fetch;
    return { kv, api, newBrowser: () => { local.clear(); cookie = undefined; }, expire: () => { cookie = undefined; }, end: () => { delete (globalThis as { localStorage?: unknown }).localStorage; } };
  }
  const saved = async (kv: ReturnType<typeof memoryKv>, name: string) => loadData(kv, (await listAccounts(kv)).find((a) => a.name === name)!.id);

  it("work done before accounts existed is kept under the account made on that browser, and follows the person to a new one", async () => {
    const w = world();
    try {
      setCurrentPlayer({ id: "oldplayer1", name: "Seth Bot" }); // a name from the old picker
      saveDone(["C0.1", "C0.2"]); replaceChats([chat("old", "2026-11-13T00:00:00Z")]);
      expect(await session(w.api)).toEqual({ state: "signedOut", ownerSet: true, mail: false });
      expect(await pushNow(w.api)).toBe(false); // nothing leaves a browser that is not signed in
      expect((await signUp("Seth", "seth@example.com", "correct horse", w.api)).ok).toBe(true);
      expect(currentPlayer()).toMatchObject({ name: "Seth", account: true });
      expect(await saved(w.kv, "Seth")).toMatchObject({ lessons: ["C0.1", "C0.2"] });
      expect(await session(w.api)).toMatchObject({ state: "signedIn", account: { name: "Seth", owner: true }, people: [{ name: "Seth" }] });
      w.newBrowser(); // another device
      expect(loadDone()).toEqual([]);
      expect((await signIn("seth@example.com", "nope nope", w.api)).ok).toBe(false);
      expect(loadDone()).toEqual([]);
      expect((await signIn("seth@example.com", "correct horse", w.api)).ok).toBe(true);
      expect(loadDone()).toEqual(["C0.1", "C0.2"]);
      expect(loadChats().map((c) => c.id)).toEqual(["old"]);
    } finally { w.end(); }
  });
  it("an older copy in one browser never overwrites newer work from another, and a deletion is not undone", async () => {
    const w = world();
    try {
      await signUp("Seth", "seth@example.com", "correct horse", w.api);
      await w.api("/api/account", { method: "POST", body: JSON.stringify({ op: "save", lessons: ["C0.1", "C0.2", "C0.3"], chats: [chat("a", "2026-11-14T00:00:00Z")] }) });
      saveDone(["C0.1", "C1.1"]); // this browser is behind, with one new lesson
      expect(await pushNow(w.api)).toBe(true);
      expect((await saved(w.kv, "Seth")).lessons.sort()).toEqual(["C0.1", "C0.2", "C0.3", "C1.1"]);
      expect(loadDone().sort()).toEqual(["C0.1", "C0.2", "C0.3", "C1.1"]); // and the newer work arrived here too
      replaceChats([]); // the chat was deleted here
      await pushNow(w.api, true);
      expect((await saved(w.kv, "Seth")).chats).toEqual([]);
    } finally { w.end(); }
  });
  it("one person's things never end up under another's account on a shared browser", async () => {
    const w = world();
    try {
      await signUp("Seth", "seth@example.com", "correct horse", w.api); saveDone(["C0.1"]);
      await signOut(w.api);
      expect(loadDone()).toEqual([]); // signing out clears the browser, after copying up
      expect((await saved(w.kv, "Seth")).lessons).toEqual(["C0.1"]);
      await signUp("Sam", "sam@example.com", "correct horse", w.api); saveDone(["C2.1"]); await pushNow(w.api);
      w.expire(); // Sam's session ends without signing out: the browser still holds Sam's things
      expect(await pushNow(w.api)).toBe(false);
      await signIn("seth@example.com", "correct horse", w.api);
      expect(loadDone()).toEqual(["C0.1"]); // Sam's lesson was not adopted
      expect((await saved(w.kv, "Seth")).lessons).toEqual(["C0.1"]);
      expect((await saved(w.kv, "Sam")).lessons).toEqual(["C2.1"]);
    } finally { w.end(); }
  });
  it("with the site unreachable nothing is claimed, and a site with no database says so", async () => {
    expect(await session((async () => { throw new Error("offline"); }) as unknown as typeof fetch)).toMatchObject({ state: "down" });
    expect(await session((async () => new Response(JSON.stringify({ configured: false, deployed: true }))) as unknown as typeof fetch)).toMatchObject({ state: "down" });
    expect(await session((async () => new Response(JSON.stringify({ configured: false, deployed: false }))) as unknown as typeof fetch)).toEqual({ state: "open" });
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
  it("saved sounds and lesson recall are joined too: the newest sound of each name, the latest record of each lesson", () => {
    const sound = (name: string, savedAt: number) => ({ name, savedAt, state: { cutoff: savedAt } as never });
    const joined = merge(
      { lessons: [], chats: [], patches: [sound("Bass", 5), sound("Pad", 1)], recall: { "C2.1": { at: 10, had: [true, false] } } },
      { lessons: [], chats: [], patches: [sound("bass", 9), sound("Lead", 3)], recall: { "C2.1": { at: 20, had: [true, true], stage: 1 }, "C1.1": { at: 4, had: [false] } } },
    );
    expect(joined.patches!.map((p) => [p.name, p.savedAt])).toEqual([["bass", 9], ["Lead", 3], ["Pad", 1]]);
    expect(joined.recall).toEqual({ "C2.1": { at: 20, had: [true, true], stage: 1 }, "C1.1": { at: 4, had: [false] } });
    // an older copy from before these were stored (no patches, no recall) loses nothing
    expect(merge({ lessons: [], chats: [] }, joined).patches).toHaveLength(3);
  });
});
