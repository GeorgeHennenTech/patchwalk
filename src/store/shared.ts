// The memory everyone using the site shares: an answer the guide has already given to the same opening
// question, and a picture it has already marked for the same question. Server only. Entries are tied to the
// version of the library they were made from, so adding or changing a book starts them afresh.
import { createHash } from "node:crypto";
import { sameQuestionKey } from "../library/keys.js";
import type { Kv } from "./kv.js";

export const SHARED_DAYS = 90;
const short = (text: string) => createHash("sha256").update(text).digest("hex").slice(0, 24);

/** A fingerprint of some content: changes when the content does. */
export const fingerprint = (parts: (string | number)[]) => short(parts.join("|"));
export const answerKey = (libraryVersion: string, question: string) => `pw:ans:${libraryVersion}:${short(sameQuestionKey(question))}`;
/** A walkthrough's outline, or one of its steps (named by its place and its title, so a changed outline is not mixed up with an old one). */
export const walkKey = (libraryVersion: string, question: string, part: string) => `pw:walk:${libraryVersion}:${short(sameQuestionKey(question))}:${short(part)}`;
/** A lesson rewritten for Serum 2: one per lesson and per wording of that lesson, kept with no end date. */
export const serumKey = (lesson: string, lessonText: string) => `pw:serum:${lesson}:${short(lessonText)}`;
export const marksKey = (pictureVersion: string, book: string, file: string, question: string) => `pw:pt:${pictureVersion}:${book}/${file}:${short(sameQuestionKey(question))}`;

/** Look something up in the shared memory. A database that is missing or failing just means "not remembered". */
export async function recallShared<T>(kv: Kv | undefined, key: string): Promise<T | undefined> {
  if (!kv) return undefined;
  try { return await kv.get<T>(key); } catch (e) { console.error(e); return undefined; }
}
export async function rememberShared(kv: Kv | undefined, key: string, value: unknown): Promise<void> {
  if (!kv) return;
  try { await kv.set(key, value, SHARED_DAYS * 86_400); } catch (e) { console.error(e); }
}

/**
 * A learner's own Claude key, sent from their browser with a request. It is used for that one request and
 * never stored or logged on the server. Returns undefined when none was sent or it does not look like a key.
 */
export function ownKey(headers: Headers): string | undefined {
  const k = headers.get("x-anthropic-key")?.trim();
  return k && /^sk-ant-[A-Za-z0-9_-]{20,300}$/.test(k) ? k : undefined;
}
