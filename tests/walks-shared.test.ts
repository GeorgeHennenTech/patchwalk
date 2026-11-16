import { afterEach, describe, expect, it, vi } from "vitest";
import { handle } from "../src/store/accounts";
import { kvFromEnv } from "../src/store/kv";
import { memoryKv } from "../src/store/kv";
import { listWalks, MAX_SHARED_WALKS, openWalk, removeWalk, saveDraw, savePlan, saveStep, walkId, WALK_ID } from "../src/store/walks";
import { joinShared, walkStepOnce, type Walk } from "../src/guide/walk";
import type { Plan, StepBody } from "../src/library/walk";
import { WalkRequestSchema } from "../src/library/walk";
import { POST } from "../api/walk";

const plan = (over: Partial<Plan> = {}): Plan => ({ covered: true, title: "A pluck", tool: "serum", steps: [{ title: "What a pluck is", find: "pluck", kind: "idea" }, { title: "Build it", find: "envelope", kind: "recipe" }], ...over });
const body = (text: string): StepBody => ({ covered: true, sources: [], blocks: [{ kind: "do", parts: [{ text, sources: [] }], sources: [] }] });

describe("the shared library of walkthroughs", () => {
  it("one walkthrough per question, whoever asks and however it is typed; the first asker's name stays", async () => {
    const kv = memoryKv();
    const a = await savePlan(kv, "How do I make a pluck?", plan(), "Ada", new Date(1000));
    const b = await savePlan(kv, "  how do i make a PLUCK ", plan(), "Bo", new Date(2000));
    expect(a).toBe(b); expect(a).toMatch(WALK_ID); expect(walkId("something else")).not.toBe(a);
    const list = await listWalks(kv);
    expect(list).toHaveLength(1);
    expect(list[0]).toMatchObject({ id: a, title: "A pluck", by: "Ada", steps: 2, written: 0, drawn: 0 });
  });
  it("keeps each step and drawing as it is written, and counts them in the list", async () => {
    const kv = memoryKv(), id = await savePlan(kv, "How do I make a pluck?", plan(), "Ada");
    expect(await saveStep(kv, id, 0, plan().steps[0]!, { ...body("Understand it."), remembered: true })).toBe(true);
    expect(await saveStep(kv, id, 1, { title: "A different step", find: "x", kind: "idea" }, body("nope"))).toBe(false); // not the same step
    expect(await saveStep(kv, id, 1, plan().steps[1]!, { covered: false, blocks: [], sources: [] })).toBe(false);        // nothing was written
    expect(await saveDraw(kv, id, "What a pluck is", { kind: "harmonics", title: "Saw", caption: "", variables: [], choice: "saw", remembered: true })).toBe(true);
    expect(await saveDraw(kv, id, "Build it", { kind: "chain", title: "", caption: "", variables: [], stages: ["a", "b"] })).toBe(false); // a step with nothing written has nothing to draw
    const doc = (await openWalk(kv, id))!;
    expect(doc.steps[0]!.body!.blocks[0]!.parts[0]!.text).toBe("Understand it.");
    expect(doc.steps[0]!.body).not.toHaveProperty("remembered"); expect(doc.steps[0]!.draw).not.toHaveProperty("remembered");
    expect((await listWalks(kv))[0]).toMatchObject({ written: 1, drawn: 1 });
    // the same outline again keeps what was written; a different outline starts it afresh, under the same first asker
    await savePlan(kv, "How do I make a pluck?", plan(), "Bo");
    expect((await openWalk(kv, id))!.steps[0]!.body).toBeDefined();
    await savePlan(kv, "How do I make a pluck?", plan({ steps: [{ title: "New first step", find: "x", kind: "idea" }, plan().steps[1]!] }), "Bo");
    expect((await openWalk(kv, id))!.steps.every((s) => !s.body)).toBe(true);
    expect((await listWalks(kv))[0]).toMatchObject({ by: "Ada", written: 0 });
  });
  it("newest first, removable, and the oldest make room when it is full", async () => {
    const kv = memoryKv();
    for (let i = 0; i < MAX_SHARED_WALKS + 3; i++) await savePlan(kv, `question number ${i}?`, plan({ title: `T${i}` }), "Ada", new Date(1000 + i));
    const list = await listWalks(kv);
    expect(list).toHaveLength(MAX_SHARED_WALKS); expect(list[0]!.title).toBe(`T${MAX_SHARED_WALKS + 2}`);
    expect(await openWalk(kv, walkId("question number 0?"))).toBeUndefined();
    await removeWalk(kv, list[0]!.id);
    expect((await listWalks(kv)).some((w) => w.id === list[0]!.id)).toBe(false); expect(await openWalk(kv, list[0]!.id)).toBeUndefined();
  });
  it("opening a shared walkthrough brings what is written and keeps this browser's place and ticks", () => {
    const doc = { id: "a".repeat(24), question: "q?", title: "A pluck", tool: "serum" as const, by: "Ada", at: "x", updated: "2026-11-16T00:00:00.000Z",
      steps: [{ ...plan().steps[0]!, body: body("shared words") }, { ...plan().steps[1]! }] };
    const local: Walk = { id: doc.id, question: "q?", title: "A pluck", tool: "serum", at: 1, savedAt: "old", steps: [{ ...plan().steps[0]!, done: true, body: body("my old copy") }, { ...plan().steps[1]!, body: body("only I have this") }] };
    const joined = joinShared(doc, local);
    expect(joined.at).toBe(1); expect(joined.steps[0]).toMatchObject({ done: true }); expect(joined.steps[0]!.body!.blocks[0]!.parts[0]!.text).toBe("shared words");
    expect(joined.steps[1]!.body!.blocks[0]!.parts[0]!.text).toBe("only I have this");
    const fresh = joinShared(doc);
    expect(fresh.at).toBe(0); expect(fresh.steps.some((s) => s.done)).toBe(false);
    // a different outline under the same id: the old place and ticks do not carry over
    expect(joinShared(doc, { ...local, steps: [{ title: "Other", find: "x", kind: "idea", done: true }, local.steps[1]!] }).steps[0]!.done).toBeUndefined();
  });
  it("a step asked for twice at the same moment is sent once", async () => {
    let sent = 0, release!: () => void;
    const wait = new Promise<void>((r) => { release = r; });
    const fake = (async () => { sent++; await wait; return new Response(JSON.stringify({ covered: true, blocks: [], sources: [] }), { status: 200 }); }) as unknown as typeof fetch;
    const w = { id: "a".repeat(24), question: "q?", title: "T", tool: "serum" as const, steps: plan().steps };
    const one = walkStepOnce(w, 0, fake), two = walkStepOnce(w, 0, fake), other = walkStepOnce(w, 1, fake);
    release();
    expect((await one).kind).toBe("ok"); expect(await two).toBe(await one); await other;
    expect(sent).toBe(2);                       // step 0 once, step 1 once
    await walkStepOnce(w, 0, fake); expect(sent).toBe(3); // and it can be asked for again afterwards
  });
  it("the library can only be read with the password, and has nothing to show without a database", async () => {
    expect(WalkRequestSchema.safeParse({ kind: "open", id: "../etc" }).success).toBe(false);
    expect(WalkRequestSchema.safeParse({ kind: "remove", id: "a".repeat(24) }).success).toBe(true);
    process.env.VERCEL = "1"; process.env.APP_PASSWORD = "pw";
    const post = (b: unknown, auth?: string) => POST(new Request("https://example.test/api/walk", { method: "POST", body: JSON.stringify(b), headers: auth ? { authorization: auth } : {} }));
    expect((await post({ kind: "list" })).status).toBe(401);
    const res = await post({ kind: "list" }, `Basic ${Buffer.from("me:pw").toString("base64")}`);
    expect(res.status).toBe(200); expect(await res.json()).toEqual({ walks: [], database: false });
    delete process.env.APP_PASSWORD; delete process.env.VERCEL;
  });
});

describe("who may use the shared library, against the real endpoint with a stand-in database", () => {
  afterEach(() => { vi.unstubAllGlobals(); for (const k of ["VERCEL", "APP_PASSWORD", "OWNER_EMAIL", "KV_REST_API_URL", "KV_REST_API_TOKEN"]) delete process.env[k]; });
  it("anyone signed in can list and open; only the owner can remove; nobody signed out can do either", async () => {
    const data = new Map<string, string>();
    const fake = (async (_url: string, init: { body: string }) => {
      const [op, key, value] = JSON.parse(init.body) as string[];
      const result = op === "GET" ? data.get(key!) ?? null : op === "SET" ? (data.set(key!, value!), "OK") : (data.delete(key!), 1);
      return new Response(JSON.stringify({ result }), { status: 200 });
    }) as unknown as typeof fetch;
    const env = { KV_REST_API_URL: "https://db.example", KV_REST_API_TOKEN: "t" };
    const kv = kvFromEnv(env, fake)!;
    let n = 0;
    const ctx = { newId: () => `acct${String(n++).padStart(4, "0")}`, newToken: () => String(n++).padStart(64, "a"), ownerEmail: "owner@example.com" };
    const owner = (await handle(kv, { op: "signup", name: "Olive", email: "owner@example.com", password: "password1" }, ctx)).session!;
    const friend = (await handle(kv, { op: "signup", name: "Finn", email: "friend@example.com", password: "password2" }, ctx)).session!;
    const id = await savePlan(kv, "How do I make a pluck?", plan(), "Finn");
    await saveStep(kv, id, 0, plan().steps[0]!, body("Understand it."));

    Object.assign(process.env, env, { VERCEL: "1", APP_PASSWORD: "pw", OWNER_EMAIL: "owner@example.com" });
    vi.stubGlobal("fetch", fake);
    const post = (b: unknown, session?: string) => POST(new Request("https://example.test/api/walk", { method: "POST", body: JSON.stringify(b), headers: { authorization: `Basic ${Buffer.from("me:pw").toString("base64")}`, ...(session ? { cookie: `pw_session=${session}` } : {}) } }));
    expect((await post({ kind: "list" })).status).toBe(401);
    expect((await post({ kind: "open", id })).status).toBe(401);
    const seen = await (await post({ kind: "list" }, friend)).json() as { walks: { id: string; by: string; written: number }[]; owner: boolean };
    expect(seen.owner).toBe(false); expect(seen.walks).toEqual([expect.objectContaining({ id, by: "Finn", written: 1 })]);
    const doc = await (await post({ kind: "open", id }, friend)).json() as { steps: { body?: unknown }[] };
    expect(doc.steps[0]!.body).toBeDefined(); expect(doc.steps[1]!.body).toBeUndefined();
    expect((await post({ kind: "open", id: "f".repeat(24) }, friend)).status).toBe(404);
    expect((await post({ kind: "remove", id }, friend)).status).toBe(403);
    // a friend with no key of their own still cannot have a new step written on the owner's credit
    expect((await post({ kind: "step", question: "How do I make a pluck?", title: "A pluck", tool: "serum", steps: plan().steps, index: 1, id }, friend)).status).toBe(402);
    const after = await (await post({ kind: "remove", id }, owner)).json() as { walks: unknown[]; owner: boolean };
    expect(after).toMatchObject({ walks: [], owner: true });
  });
});
