// The shared library: things people on this site have made and kept for everyone signed in to use: sound
// files dropped onto drum pads, breaks, drum racks and whole songs. Server only. Reading and writing cost
// nothing (no call to Claude), so they need a signed-in account and no key. What comes back from here is
// other people's data: the browser makes every item safe again before it uses it.
import { createHash } from "node:crypto";
import { z } from "zod";
import type { Kv } from "./kv.js";

export const LIB_KINDS = ["sound", "break", "rack", "song"] as const;
export type LibKind = (typeof LIB_KINDS)[number];
/** One sound file: 2 MB at most. Everything else is small. */
export const SOUND_MAX_BYTES = 2 * 1024 * 1024, JSON_MAX_BYTES = 300_000, SOUNDS_TOTAL_BYTES = 150 * 1024 * 1024;
export const LIB_MOST: Record<LibKind, number> = { sound: 300, break: 300, rack: 150, song: 100 };
export interface LibEntry { id: string; name: string; /** who kept it */ by: string; byId: string; at: string; bytes: number; /** a line about what is in it */ about?: string }
export const LIB_ID = /^[a-z0-9]{8,40}$/;

const kind = z.enum(LIB_KINDS);
export const LibRequestSchema = z.discriminatedUnion("op", [
  z.object({ op: z.literal("list"), kind }),
  z.object({ op: z.literal("get"), kind, id: z.string().regex(LIB_ID) }),
  z.object({ op: z.literal("put"), kind, name: z.string().min(1).max(60), about: z.string().max(120).optional(), /** a sound: its bytes as base64; anything else: the thing itself */ data: z.unknown() }),
  z.object({ op: z.literal("remove"), kind, id: z.string().regex(LIB_ID) }),
]);
export type LibRequest = z.infer<typeof LibRequestSchema>;

const indexKey = (k: LibKind) => `pw:lib:${k}:index`, docKey = (k: LibKind, id: string) => `pw:lib:${k}:doc:${id}`;
/** A sound's id is made from its bytes, so the same file is one entry whoever adds it and wherever it is used. */
export const soundId = (bytes: Uint8Array) => `h${createHash("sha256").update(bytes).digest("hex").slice(0, 24)}`;
const namedId = (k: LibKind, byId: string, name: string) => `n${createHash("sha256").update(`${k}|${byId}|${name.trim().toLowerCase()}`).digest("hex").slice(0, 24)}`;
const tidyName = (s: string) => s.replace(/[\u0000-\u001f]/g, " ").trim().slice(0, 60) || "Untitled";

export const listLib = async (kv: Kv, k: LibKind) => (await kv.get<LibEntry[]>(indexKey(k))) ?? [];
export const getLib = (kv: Kv, k: LibKind, id: string) => kv.get<unknown>(docKey(k, id));

export type PutResult = { ok: true; entry: LibEntry; already?: boolean } | { ok: false; status: number; message: string };
/** Keep something in the library. A sound that is already there is not stored twice. A person's own item of the same name is replaced. */
export async function putLib(kv: Kv, k: LibKind, name: string, data: unknown, who: { id: string; name: string }, about?: string, now = new Date()): Promise<PutResult> {
  const index = await listLib(kv, k);
  let id: string, bytes: number, stored: unknown;
  if (k === "sound") {
    if (typeof data !== "string" || !/^[A-Za-z0-9+/]+={0,2}$/.test(data)) return { ok: false, status: 400, message: "A sound must be sent as its bytes." };
    const raw = Buffer.from(data, "base64");
    if (!raw.length) return { ok: false, status: 400, message: "That sound file is empty." };
    if (raw.length > SOUND_MAX_BYTES) return { ok: false, status: 413, message: "That sound is over 2 MB, so it stays in your browser only." };
    id = soundId(raw); bytes = raw.length; stored = data;
    const have = index.find((e) => e.id === id);
    if (have) return { ok: true, entry: have, already: true };
    if (index.reduce((sum, e) => sum + e.bytes, 0) + bytes > SOUNDS_TOTAL_BYTES) return { ok: false, status: 507, message: "The library's room for sounds is full. Ask the owner to remove some." };
  } else {
    if (!data || typeof data !== "object") return { ok: false, status: 400, message: "Nothing to keep." };
    const text = JSON.stringify(data);
    if (text.length > JSON_MAX_BYTES) return { ok: false, status: 413, message: "That is too big for the library." };
    id = namedId(k, who.id, name); bytes = text.length; stored = data;
  }
  const rest = index.filter((e) => e.id !== id);
  if (rest.length >= LIB_MOST[k]) return { ok: false, status: 507, message: "The library is full for this kind of thing. Ask the owner to remove some." };
  const entry: LibEntry = { id, name: tidyName(name), by: who.name, byId: who.id, at: now.toISOString(), bytes, ...(about ? { about: tidyName(about).slice(0, 120) } : {}) };
  await kv.set(docKey(k, id), stored);
  await kv.set(indexKey(k), [entry, ...rest]);
  return { ok: true, entry };
}
/** Take something out. Only the person who kept it, or the owner, may. */
export async function removeLib(kv: Kv, k: LibKind, id: string, who: { id: string; owner: boolean }): Promise<"removed" | "not-yours" | "gone"> {
  const index = await listLib(kv, k), entry = index.find((e) => e.id === id);
  if (!entry) return "gone";
  if (!who.owner && entry.byId !== who.id) return "not-yours";
  await kv.set(indexKey(k), index.filter((e) => e.id !== id));
  await kv.del(docKey(k, id));
  return "removed";
}
