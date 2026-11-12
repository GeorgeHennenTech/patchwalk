import { readdirSync, readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";
import { parseCard } from "../src/lesson/cards";
import { LessonRequestSchema } from "../src/lesson/contract";
import { runSelfTest, selfTestRequest } from "../src/lesson/selftest";

const DIR = join(__dirname, "..", "knowledge-cards");
const cards = readdirSync(DIR).filter((f) => f.endsWith(".md") && !f.startsWith("_")).map((f) => parseCard(readFileSync(join(DIR, f), "utf8"))!);
const reply = (status: number, body: unknown) => (async () => new Response(JSON.stringify(body), { status })) as unknown as typeof fetch;
const lesson = (why = "A low-pass filter removes upper harmonics, so the tone gets rounder.") => ({
  step_id: "selftest:filter", do: "Switch Filter 1 on, pick MG Low 24 and set resonance to 30%.", why, listen_for: "The top of the sound softens.", param_refs: ["VoiceFilter0:kParamReso"],
});

describe("explanation service self-test", () => {
  it("builds a valid request that contains no preset data", () => {
    const req = selfTestRequest(cards)!;
    expect(LessonRequestSchema.safeParse(req).success).toBe(true);
    expect(req.steps[0]!.cards[0]!.id).toBe("lowpass-cutoff-resonance");
  });
  it("passes when a valid explanation comes back", async () => {
    const r = await runSelfTest(cards, reply(200, { results: { "selftest:filter": { ok: true, attempts: 1, lesson: lesson() } } }));
    expect(r).toMatchObject({ ok: true, headline: "Working: an explanation came back and passed validation first time." });
    expect(r.sample!.why).toMatch(/low-pass/);
  });
  it.each([
    [503, { error: "not-configured", message: "no key" }, /no working ANTHROPIC_API_KEY/],
    [503, { error: "locked" }, /no APP_PASSWORD/],
    [401, { error: "unauthorized" }, /did not accept the site password/],
    [429, { error: "rate-limited" }, /rate-limiting/],
    [500, {}, /returned an error \(500\)/],
  ])("explains a %s response", async (status, body, headline) => {
    const r = await runSelfTest(cards, reply(status as number, body));
    expect(r.ok).toBe(false);
    expect(r.headline).toMatch(headline as RegExp);
  });
  it("separates a failing API call from validator rejections", async () => {
    const api = await runSelfTest(cards, reply(200, { results: { "selftest:filter": { ok: false, attempts: 3, problems: ["401 invalid x-api-key"] } } }));
    expect(api.headline).toMatch(/could not get a usable reply from the Claude API/);
    expect(api.details).toContain("Reason: 401 invalid x-api-key");
    const val = await runSelfTest(cards, reply(200, { results: { "selftest:filter": { ok: false, attempts: 3, problems: ['"why" mentions the number 800, which is not a value in this step.'] } } }));
    expect(val.headline).toMatch(/rejected by the validator/);
  });
  it("does not trust a server that lets invalid text through", async () => {
    const r = await runSelfTest(cards, reply(200, { results: { "selftest:filter": { ok: true, attempts: 1, lesson: lesson("Roll off above 800 Hz.") } } }));
    expect(r.ok).toBe(false);
    expect(r.headline).toMatch(/validators? disagree|validator rejects/);
  });
  it("reports a network failure and a missing result", async () => {
    expect((await runSelfTest(cards, (async () => { throw new Error("offline"); }) as unknown as typeof fetch)).headline).toBe("The request never reached the server.");
    expect((await runSelfTest(cards, reply(200, { results: {} }))).headline).toMatch(/without a result/);
  });
});
