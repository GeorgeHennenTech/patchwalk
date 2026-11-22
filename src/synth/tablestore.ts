// The learner's own wavetables, kept in this browser (IndexedDB), and loaded into the synth when the page
// starts. A table is its frames as plain samples, FRAME to a frame, so nothing is lost by saving it.
import { dropUserTable, setUserTable, type UserTableId } from "./params";
import { FRAME, MAX_FRAMES, type Morph, type Wave } from "./wtedit";

export interface StoredTable { id: UserTableId; name: string; morph: Morph; count: number; data: ArrayBuffer; saved: number }
export const TABLES_MOST = 60;
const MORPHS: Morph[] = ["none", "crossfade", "spectral"];

export const packTable = (id: UserTableId, name: string, morph: Morph, frames: Wave[], saved = Date.now()): StoredTable => {
  const data = new Float32Array(frames.length * FRAME); frames.forEach((f, i) => data.set(f, i * FRAME));
  return { id, name: name.trim().slice(0, 40) || "My table", morph, count: frames.length, data: data.buffer, saved };
};
/** A stored table as frames again, or nothing if the record is not one (wrong sizes, wrong kinds). */
export function unpackTable(t: unknown): { id: UserTableId; name: string; morph: Morph; frames: Wave[]; saved: number } | undefined {
  const r = t as Partial<StoredTable> | null;
  if (!r || typeof r.id !== "string" || !/^u:[a-z0-9]{4,24}$/.test(r.id) || !(r.data instanceof ArrayBuffer)) return undefined;
  const all = new Float32Array(r.data), count = Math.floor(all.length / FRAME);
  if (count < 1 || count > MAX_FRAMES) return undefined;
  const frames = Array.from({ length: count }, (_, i) => all.slice(i * FRAME, (i + 1) * FRAME).map((v) => (Number.isFinite(v) ? Math.min(1, Math.max(-1, v)) : 0)));
  return { id: r.id as UserTableId, name: typeof r.name === "string" ? r.name.slice(0, 40) : "My table", morph: MORPHS.includes(r.morph as Morph) ? (r.morph as Morph) : "crossfade", frames, saved: typeof r.saved === "number" ? r.saved : 0 };
}
export const newTableId = (): UserTableId => `u:${Array.from(crypto.getRandomValues(new Uint8Array(8)), (b) => (b % 36).toString(36)).join("")}`;

const open = (): Promise<IDBDatabase> => new Promise((done, fail) => {
  const req = indexedDB.open("patchwalk-tables", 1);
  req.onupgradeneeded = () => { req.result.createObjectStore("tables", { keyPath: "id" }); };
  req.onsuccess = () => done(req.result); req.onerror = () => fail(req.error);
});
const run = async <T>(mode: IDBTransactionMode, work: (s: IDBObjectStore) => IDBRequest<T>): Promise<T> => {
  const db = await open();
  try { return await new Promise<T>((done, fail) => { const req = work(db.transaction("tables", mode).objectStore("tables")); req.onsuccess = () => done(req.result); req.onerror = () => fail(req.error); }); }
  finally { db.close(); }
};
export const listTables = async (): Promise<StoredTable[]> => (await run<StoredTable[]>("readonly", (s) => s.getAll())).sort((a, b) => a.saved - b.saved);
export const getTable = (id: UserTableId): Promise<StoredTable | undefined> => run<StoredTable | undefined>("readonly", (s) => s.get(id));
export const saveTable = (t: StoredTable): Promise<unknown> => run("readwrite", (s) => s.put(t));
export const deleteTable = async (id: UserTableId): Promise<void> => { await run("readwrite", (s) => s.delete(id)); dropUserTable(id); };

/** The tables as samples, for the editor to open (the synth itself only keeps their harmonics). */
const HELD = new Map<UserTableId, { name: string; morph: Morph; frames: Wave[] }>();
export const heldTable = (id: UserTableId) => HELD.get(id);
let timer: ReturnType<typeof setTimeout> | undefined; const waiting = new Set<UserTableId>();
/** The editor changed a table: play it at once, and write it to the browser's storage a moment later. */
export function holdTable(id: UserTableId, name: string, morph: Morph, frames: Wave[]): void {
  HELD.set(id, { name, morph, frames }); setUserTable(id, name, frames, morph); waiting.add(id);
  if (timer) clearTimeout(timer);
  timer = setTimeout(() => { for (const w of waiting) { const t = HELD.get(w); if (t) void saveTable(packTable(w, t.name, t.morph, t.frames)).catch(() => {}); } waiting.clear(); }, 700);
}
export const forgetTable = async (id: UserTableId): Promise<void> => { HELD.delete(id); waiting.delete(id); try { await deleteTable(id); } catch { dropUserTable(id); } };

let loaded: Promise<void> | undefined;
/** Read every kept table into the synth. Safe to call many times; it happens once. A browser with no storage simply has none. */
export const loadTables = (): Promise<void> => (loaded ??= (async () => {
  try { for (const raw of await listTables()) { const t = unpackTable(raw); if (t) { HELD.set(t.id, { name: t.name, morph: t.morph, frames: t.frames }); setUserTable(t.id, t.name, t.frames, t.morph); } } } catch { /* private window, or storage switched off */ }
})());
