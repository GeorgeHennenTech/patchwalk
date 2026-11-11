import { describe, expect, it, afterEach } from "vitest";
import { gate, passwordMatches } from "../src/lesson/auth";
import middleware from "../middleware";
import { POST } from "../api/lesson";

const basic = (user: string, pass: string) => "Basic " + Buffer.from(`${user}:${pass}`, "utf8").toString("base64");
const saved = { ...process.env };
afterEach(() => { process.env = { ...saved }; });

describe("password check", () => {
  it("accepts the right password with any user name", () => {
    expect(passwordMatches(basic("me", "s3cret:with:colons"), "s3cret:with:colons")).toBe(true);
    expect(passwordMatches(basic("", "pässwörd"), "pässwörd")).toBe(true);
  });
  it("rejects wrong, missing and malformed credentials", () => {
    for (const h of [basic("me", "wrong"), basic("me", "s3cre"), basic("me", "s3cretX"), "Bearer s3cret", "Basic !!!", "Basic " + Buffer.from("nocolon").toString("base64"), "", null, undefined]) {
      expect(passwordMatches(h, "s3cret"), String(h)).toBe(false);
    }
    expect(passwordMatches(basic("me", ""), "")).toBe(false);
    expect(passwordMatches(basic("me", "x"), undefined)).toBe(false);
  });
  it("fails closed on Vercel and stays open only for local dev without a password", () => {
    expect(gate(null, { VERCEL: "1" })).toBe("locked");
    expect(gate(basic("a", "anything"), { VERCEL: "1" })).toBe("locked");
    expect(gate(null, {})).toBe("open");
    expect(gate(null, { APP_PASSWORD: "pw" })).toBe("denied");
    expect(gate(basic("a", "pw"), { APP_PASSWORD: "pw", VERCEL: "1" })).toBe("allowed");
  });
});

describe("middleware", () => {
  const call = (auth?: string) => middleware(new Request("https://example.test/", { headers: auth ? { authorization: auth } : {} }));
  it("asks for a password", () => {
    process.env.APP_PASSWORD = "pw";
    const res = call();
    expect(res.status).toBe(401);
    expect(res.headers.get("www-authenticate")).toMatch(/^Basic realm=/);
    expect(call(basic("x", "nope")).status).toBe(401);
  });
  it("lets the right password through to the app", () => {
    process.env.APP_PASSWORD = "pw";
    const res = call(basic("x", "pw"));
    expect(res.status).toBe(200);
    expect(res.headers.get("x-middleware-next")).toBe("1");
  });
  it("refuses everyone when no password is configured", () => {
    delete process.env.APP_PASSWORD;
    expect(call().status).toBe(503);
    expect(call(basic("x", "")).status).toBe(503);
  });
});

describe("lesson endpoint", () => {
  const post = (auth?: string) => POST(new Request("https://example.test/api/lesson", { method: "POST", body: "{}", headers: auth ? { authorization: auth } : {} }));
  it("is closed on Vercel without a configured password, before the API key is even looked at", async () => {
    process.env.VERCEL = "1"; delete process.env.APP_PASSWORD; process.env.ANTHROPIC_API_KEY = "test";
    expect((await post()).status).toBe(503);
  });
  it("rejects a missing or wrong password", async () => {
    process.env.VERCEL = "1"; process.env.APP_PASSWORD = "pw"; process.env.ANTHROPIC_API_KEY = "test";
    expect((await post()).status).toBe(401);
    expect((await post(basic("x", "wrong"))).status).toBe(401);
  });
  it("passes the gate with the right password (then fails on the empty body, not on auth)", async () => {
    process.env.VERCEL = "1"; process.env.APP_PASSWORD = "pw"; process.env.ANTHROPIC_API_KEY = "test";
    expect((await post(basic("x", "pw"))).status).toBe(400);
  });
});
