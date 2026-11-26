// The learner's own sound files. They are kept in this browser's own storage (IndexedDB) and nowhere else:
// nothing here sends a file anywhere.
export interface StoredSample { id: string; name: string; bytes: ArrayBuffer; added: number }
export const SAMPLE_MAX_BYTES = 12 * 1024 * 1024, SAMPLES_MOST = 300;
const KINDS = /\.(wav|wave|mp3|ogg|oga|flac|aif|aiff|m4a|aac|webm)$/i;

/** Why a file cannot be taken as a sound, in words for the learner; nothing when it can. */
export function checkFile(name: string, type: string, size: number, have = 0): string | undefined {
  if (!type.startsWith("audio/") && !KINDS.test(name)) return "That does not look like a sound file. Try a WAV, MP3, FLAC, OGG, AIFF or M4A.";
  if (size <= 0) return "That file is empty.";
  if (size > SAMPLE_MAX_BYTES) return "That file is over 12 MB. Drum sounds are short: trim it first.";
  if (have >= SAMPLES_MOST) return `You already keep ${SAMPLES_MOST} sounds here. Delete one first.`;
  return undefined;
}
/** A name to show: the file's name without its ending, kept short. */
export const sampleName = (file: string): string => (file.replace(/\.[a-z0-9]{2,5}$/i, "").trim() || "Sound").slice(0, 40);

const open = (): Promise<IDBDatabase> => new Promise((done, fail) => {
  const req = indexedDB.open("patchwalk-samples", 1);
  req.onupgradeneeded = () => { req.result.createObjectStore("files", { keyPath: "id" }); };
  req.onsuccess = () => done(req.result); req.onerror = () => fail(req.error);
});
const run = async <T>(mode: IDBTransactionMode, work: (s: IDBObjectStore) => IDBRequest<T>): Promise<T> => {
  const db = await open();
  try { return await new Promise<T>((done, fail) => { const req = work(db.transaction("files", mode).objectStore("files")); req.onsuccess = () => done(req.result); req.onerror = () => fail(req.error); }); }
  finally { db.close(); }
};
export const listSamples = async (): Promise<StoredSample[]> => (await run<StoredSample[]>("readonly", (s) => s.getAll())).sort((a, b) => a.added - b.added);
export const putSample = (sample: StoredSample): Promise<unknown> => run("readwrite", (s) => s.put(sample));
export const deleteSample = (id: string): Promise<unknown> => run("readwrite", (s) => s.delete(id));
