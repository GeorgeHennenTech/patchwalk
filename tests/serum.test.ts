import { afterEach, describe, expect, it, vi } from "vitest";
import { handle } from "../src/store/accounts";
import { kvFromEnv } from "../src/store/kv";
import { serumKey } from "../src/store/shared";
import { SERUM_SYSTEM, SerumRequestSchema, serumPrompt, serumQueries } from "../src/library/serum";
import { lessonForSerum } from "../src/guide/serum";
import { LESSONS, placeOf } from "../src/course/lessons";
import { POST } from "../api/serum";

describe("a lesson rewritten for Serum 2", () => {
  it("every lesson can be sent: only what the learner is asked to do goes, in a shape the server accepts", () => {
    // a lesson that is only by-ear rounds has no steps to rewrite, and gets no button
    for (const l of LESSONS.filter((x) => x.steps.length > 0)) {
      const sent = lessonForSerum(l, placeOf(l).chapter);
      expect(SerumRequestSchema.safeParse(sent).success, l.id).toBe(true);
      expect(sent.steps[0]).toBe(l.steps[0]!.do.slice(0, 700)); expect(JSON.stringify(sent)).not.toContain("check");
    }
  });
  it("the guide is told to keep the manual's words apart from its own mapping, and to say when Serum has no such control", () => {
    for (const w of ["DO:", "RECIPE:", "TEXT:", "SYNTHESIS:", "MISSING:", "finish by ear", "Do not fill the gap from memory", "only the pages of the Serum 2 User Guide"]) expect(SERUM_SYSTEM).toContain(w);
    const req = { title: "Low-pass cutoff", chapter: "Filters", outcome: "Hear a filter close.", steps: ["Turn the filter on.", "Lower the cutoff."] };
    expect(serumPrompt(req)).toContain("1. Turn the filter on.\n2. Lower the cutoff."); expect(serumQueries(req)).toHaveLength(3);
    // the stored copy is named by the lesson and its wording: a reworded lesson is a different entry
    expect(serumKey("C2.1", serumPrompt(req))).not.toBe(serumKey("C2.1", serumPrompt({ ...req, steps: ["Turn the filter on.", "Raise the cutoff."] })));
    expect(serumKey("C2.1", serumPrompt(req))).toBe(serumKey("C2.1", serumPrompt({ ...req })));
  });
});

describe("who may look and who may build, against the real endpoint with a stand-in database", () => {
  afterEach(() => { vi.unstubAllGlobals(); for (const k of ["VERCEL", "APP_PASSWORD", "OWNER_EMAIL", "KV_REST_API_URL", "KV_REST_API_TOKEN", "ANTHROPIC_API_KEY"]) delete process.env[k]; });
  it("looking is free for anyone signed in; one that is built is given to everyone; building needs the owner or a key", async () => {
    const data = new Map<string, string>();
    const fake = (async (_url: string, init: { body: string }) => { const [op, key, value] = JSON.parse(init.body) as string[]; const result = op === "GET" ? data.get(key!) ?? null : op === "SET" ? (data.set(key!, value!), "OK") : (data.delete(key!), 1); return new Response(JSON.stringify({ result }), { status: 200 }); }) as unknown as typeof fetch;
    const env = { KV_REST_API_URL: "https://db.example", KV_REST_API_TOKEN: "t" }, kv = kvFromEnv(env, fake)!;
    let n = 0;
    const ctx = { newId: () => `acct${String(n++).padStart(4, "0")}`, newToken: () => String(n++).padStart(64, "a"), ownerEmail: "owner@example.com" };
    await handle(kv, { op: "signup", name: "Olive", email: "owner@example.com", password: "password1" }, ctx);
    const friend = (await handle(kv, { op: "signup", name: "Finn", email: "friend@example.com", password: "password2" }, ctx)).session!;
    Object.assign(process.env, env, { VERCEL: "1", APP_PASSWORD: "pw", OWNER_EMAIL: "owner@example.com" });
    vi.stubGlobal("fetch", fake);
    const lesson = lessonForSerum(LESSONS.find((l) => l.id === "C2.1")!, "Filters");
    const post = (b: unknown, session?: string) => POST(new Request("https://example.test/api/serum", { method: "POST", body: JSON.stringify(b), headers: { authorization: `Basic ${Buffer.from("me:pw").toString("base64")}`, ...(session ? { cookie: `pw_session=${session}` } : {}) } }));
    expect((await post({ ...lesson, peek: true })).status).toBe(401);                                  // signed out
    expect(await (await post({ ...lesson, peek: true }, friend)).json()).toEqual({ built: false });   // nothing built yet, and no charge for looking
    expect((await post(lesson, friend)).status).toBe(402);                                             // a friend with no key cannot have it built on the owner's credit
    // once it is in the database, the friend gets it, with no key and no call
    const stored = { built: true, covered: true, by: "Olive", at: "2026-11-16T00:00:00.000Z", sources: [], blocks: [{ kind: "do", parts: [{ text: "Step 1: turn the filter on.", sources: [] }], sources: [] }] };
    await kv.set(serumKey(lesson.lesson, serumPrompt(lesson)), stored);
    const got = await (await post(lesson, friend)).json() as { built: boolean; by: string; remembered: boolean };
    expect(got).toMatchObject({ built: true, by: "Olive", remembered: true });
    expect(await (await post({ ...lesson, peek: true }, friend)).json()).toMatchObject({ built: true });
    // a different wording of the lesson is not the stored one
    expect(await (await post({ ...lesson, steps: ["Something else entirely."], peek: true }, friend)).json()).toEqual({ built: false });
    expect((await post({ lesson: "../x", title: "t", steps: ["a step"] }, friend)).status).toBe(400);
  });
});
