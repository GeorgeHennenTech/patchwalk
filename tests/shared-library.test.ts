import { afterEach, describe, expect, it, vi } from "vitest";
import { memoryKv, kvFromEnv } from "../src/store/kv";
import { getLib, listLib, putLib, removeLib, soundId, SOUND_MAX_BYTES } from "../src/store/library";
import { handle } from "../src/store/accounts";
import { POST } from "../api/library";

const olive = { id: "a1", name: "Olive" }, finn = { id: "a2", name: "Finn" };
const b64 = (bytes: number[]) => Buffer.from(bytes).toString("base64");

describe("the shared library", () => {
  it("keeps a sound once, whoever adds it, under an id made from its bytes", async () => {
    const kv = memoryKv(), data = b64([1, 2, 3, 4]);
    const first = await putLib(kv, "sound", "Kick", data, olive);
    expect(first.ok && first.entry).toMatchObject({ id: soundId(Uint8Array.from([1, 2, 3, 4])), name: "Kick", by: "Olive", bytes: 4 });
    const again = await putLib(kv, "sound", "Same kick, other name", data, finn);
    expect(again.ok && again.already).toBe(true);
    expect(await listLib(kv, "sound")).toHaveLength(1);
    expect(await getLib(kv, "sound", first.ok ? first.entry.id : "")).toBe(data);
  });
  it("refuses what is not a sound, an empty one, and one over 2 MB", async () => {
    const kv = memoryKv();
    expect(await putLib(kv, "sound", "x", { not: "bytes" }, olive)).toMatchObject({ ok: false, status: 400 });
    expect(await putLib(kv, "sound", "x", "", olive)).toMatchObject({ ok: false, status: 400 });
    expect(await putLib(kv, "sound", "x", Buffer.alloc(SOUND_MAX_BYTES + 1).toString("base64"), olive)).toMatchObject({ ok: false, status: 413 });
    expect(await listLib(kv, "sound")).toEqual([]);
  });
  it("a person's own break of the same name is replaced; another person's is kept beside it", async () => {
    const kv = memoryKv();
    await putLib(kv, "break", "Roller", { rows: [[1]] }, olive);
    await putLib(kv, "break", "roller ", { rows: [[2]] }, olive);
    await putLib(kv, "break", "Roller", { rows: [[3]] }, finn);
    const items = await listLib(kv, "break");
    expect(items.map((e) => e.by)).toEqual(["Finn", "Olive"]);
    expect(await getLib(kv, "break", items[1]!.id)).toEqual({ rows: [[2]] });
    expect(await putLib(kv, "rack", "big", { pads: "x".repeat(400_000) }, olive)).toMatchObject({ ok: false, status: 413 });
  });
  it("only the person who added something, or the owner, can remove it", async () => {
    const kv = memoryKv(), put = await putLib(kv, "rack", "Mine", { pads: [] }, olive), id = put.ok ? put.entry.id : "";
    expect(await removeLib(kv, "rack", id, { id: finn.id, owner: false })).toBe("not-yours");
    expect(await removeLib(kv, "rack", id, { id: finn.id, owner: true })).toBe("removed");
    expect(await getLib(kv, "rack", id)).toBeUndefined();
    expect(await removeLib(kv, "rack", id, { id: olive.id, owner: false })).toBe("gone");
  });
});

describe("the library endpoint, with a stand-in database", () => {
  afterEach(() => { vi.unstubAllGlobals(); for (const k of ["VERCEL", "APP_PASSWORD", "OWNER_EMAIL", "KV_REST_API_URL", "KV_REST_API_TOKEN"]) delete process.env[k]; });
  it("needs the password and a signed-in person, and no key; friends can add, only owner or adder can remove", async () => {
    const data = new Map<string, string>();
    const fake = (async (_url: string, init: { body: string }) => { const [op, key, value] = JSON.parse(init.body) as string[]; const result = op === "GET" ? data.get(key!) ?? null : op === "SET" ? (data.set(key!, value!), "OK") : (data.delete(key!), 1); return new Response(JSON.stringify({ result }), { status: 200 }); }) as unknown as typeof fetch;
    const env = { KV_REST_API_URL: "https://db.example", KV_REST_API_TOKEN: "t" }, kv = kvFromEnv(env, fake)!;
    let n = 0;
    const ctx = { newId: () => `acct${String(n++).padStart(4, "0")}`, newToken: () => String(n++).padStart(64, "a"), ownerEmail: "owner@example.com" };
    const owner = (await handle(kv, { op: "signup", name: "Olive", email: "owner@example.com", password: "password1" }, ctx)).session!;
    const friend = (await handle(kv, { op: "signup", name: "Finn", email: "friend@example.com", password: "password2" }, ctx)).session!;
    Object.assign(process.env, env, { VERCEL: "1", APP_PASSWORD: "pw", OWNER_EMAIL: "owner@example.com" });
    vi.stubGlobal("fetch", fake);
    const post = (b: unknown, session?: string, password = "pw") => POST(new Request("https://example.test/api/library", { method: "POST", body: JSON.stringify(b), headers: { authorization: `Basic ${Buffer.from(`me:${password}`).toString("base64")}`, ...(session ? { cookie: `pw_session=${session}` } : {}) } }));
    expect((await post({ op: "list", kind: "sound" }, friend, "wrong")).status).toBe(401);
    expect((await post({ op: "list", kind: "sound" })).status).toBe(401);
    expect((await post({ op: "list", kind: "tape" }, friend)).status).toBe(400);
    const put = await (await post({ op: "put", kind: "sound", name: "Snare", data: b64([9, 9, 9]) }, friend)).json() as { entry: { id: string; by: string } };
    expect(put.entry.by).toBe("Finn");
    const list = await (await post({ op: "list", kind: "sound" }, owner)).json() as { items: unknown[]; owner: boolean; database: boolean };
    expect(list).toMatchObject({ database: true, owner: true });
    expect(list.items).toHaveLength(1);
    expect(await (await post({ op: "get", kind: "sound", id: put.entry.id }, owner)).json()).toEqual({ data: b64([9, 9, 9]) });
    const mine = await (await post({ op: "put", kind: "break", name: "B", data: { rows: [[2]] } }, owner)).json() as { entry: { id: string } };
    expect((await post({ op: "remove", kind: "break", id: mine.entry.id }, friend)).status).toBe(403);
    expect((await (await post({ op: "remove", kind: "sound", id: put.entry.id }, owner)).json() as { items: unknown[] }).items).toEqual([]);
    expect((await post({ op: "get", kind: "sound", id: put.entry.id }, owner)).status).toBe(404);
  });
  it("says so when the site has no database", async () => {
    Object.assign(process.env, { APP_PASSWORD: "pw" });
    const res = await POST(new Request("https://example.test/api/library", { method: "POST", body: JSON.stringify({ op: "list", kind: "song" }), headers: { authorization: `Basic ${Buffer.from("me:pw").toString("base64")}` } }));
    expect(await res.json()).toEqual({ items: [], database: false });
  });
});

import { LIB_SOUND_MAX, fromBase64, soundHash, toBase64 } from "../src/guide/library";
describe("the browser's side of the library", () => {
  it("names a sound the way the server does, and agrees with it on the size limit", async () => {
    const bytes = Uint8Array.from([5, 6, 7, 8, 250]);
    expect(await soundHash(bytes.buffer)).toBe(soundId(bytes));
    expect(LIB_SOUND_MAX).toBe(SOUND_MAX_BYTES);
    expect([...new Uint8Array(fromBase64(toBase64(bytes.buffer)))]).toEqual([...bytes]);
  });
});
