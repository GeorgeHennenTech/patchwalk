// "Who's playing?": the people who use this copy of the site, and what each has saved (finished lessons and
// saved chats). No passwords: everyone is already behind the site's one password, and the picker only keeps
// each person's things apart. Server only; the request handling is here so it can be tested with a store
// kept in memory.
import { z } from "zod";
import type { Kv } from "./kv.js";

export interface Player { id: string; name: string; createdAt: string }
export interface PlayerData { lessons: string[]; chats: unknown[] }
export const MAX_PLAYERS = 12, MAX_DATA_BYTES = 600_000;
const PLAYERS = "pw:players";
const dataKey = (id: string) => `pw:p:${id}`;
const Id = z.string().regex(/^[a-z0-9]{6,16}$/);

export const StoreRequestSchema = z.discriminatedUnion("op", [
  z.object({ op: z.literal("add"), name: z.string().trim().min(1).max(24) }),
  z.object({ op: z.literal("remove"), player: Id }),
  z.object({ op: z.literal("save"), player: Id, lessons: z.array(z.string().max(20)).max(2000), chats: z.array(z.unknown()).max(60) }),
]);
export type StoreRequest = z.infer<typeof StoreRequestSchema>;

export const listPlayers = async (kv: Kv) => (await kv.get<Player[]>(PLAYERS)) ?? [];
export async function loadPlayer(kv: Kv, id: string): Promise<PlayerData | undefined> {
  if (!Id.safeParse(id).success || !(await listPlayers(kv)).some((p) => p.id === id)) return undefined;
  const d = await kv.get<Partial<PlayerData>>(dataKey(id));
  return { lessons: Array.isArray(d?.lessons) ? d!.lessons! : [], chats: Array.isArray(d?.chats) ? d!.chats! : [] };
}

export type StoreResult = { status: number; body: Record<string, unknown> };
/** Carry out one change. `newId` and `now` are passed in so tests are repeatable. */
export async function change(kv: Kv, req: StoreRequest, newId: () => string, now = new Date()): Promise<StoreResult> {
  const players = await listPlayers(kv);
  if (req.op === "add") {
    if (players.length >= MAX_PLAYERS) return { status: 409, body: { error: "full", message: `This site holds ${MAX_PLAYERS} people at most. Remove one first.` } };
    if (players.some((p) => p.name.toLowerCase() === req.name.toLowerCase())) return { status: 409, body: { error: "taken", message: "Someone already uses that name here. Pick it from the list, or choose another." } };
    const player: Player = { id: newId(), name: req.name, createdAt: now.toISOString() };
    await kv.set(PLAYERS, [...players, player]);
    return { status: 200, body: { players: [...players, player], player } };
  }
  if (!players.some((p) => p.id === req.player)) return { status: 404, body: { error: "no-player", message: "That person is not on this site's list." } };
  if (req.op === "remove") {
    const left = players.filter((p) => p.id !== req.player);
    await kv.set(PLAYERS, left);
    await kv.del(dataKey(req.player));
    return { status: 200, body: { players: left } };
  }
  const data: PlayerData = { lessons: [...new Set(req.lessons)], chats: req.chats };
  if (JSON.stringify(data).length > MAX_DATA_BYTES) return { status: 413, body: { error: "too-large", message: "Too much to save. Delete some saved chats and try again." } };
  await kv.set(dataKey(req.player), data);
  return { status: 200, body: { saved: true } };
}
