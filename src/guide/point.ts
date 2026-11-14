// Browser side of "Show me where": asks the guide to explain one library picture and point at the places in
// it that matter. A picture already marked for the same question on this device is shown again without a new call.
import type { Mark, PointResponse } from "../library/point";
import { MARKS, recall, remember, sameQuestionKey } from "./cache";

export type PointOutcome = { kind: "ok"; about: string; marks: Mark[]; remembered?: boolean } | { kind: "unavailable"; message: string };

export async function pointAt(book: string, file: string, question: string, answer?: string, fresh = false, fetchImpl: typeof fetch = fetch): Promise<PointOutcome> {
  const key = `${book}/${file}|${sameQuestionKey(question)}`;
  const known = fresh ? undefined : recall<PointResponse>(MARKS, key);
  if (known) return { kind: "ok", about: known.about, marks: known.marks, remembered: true };
  let res: Response;
  try {
    res = await fetchImpl("/api/point", { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify({ book, file, question, ...(answer ? { answer: answer.slice(0, 3000) } : {}) }) });
  } catch {
    return { kind: "unavailable", message: "Could not reach the guide." };
  }
  const body = (await res.json().catch(() => undefined)) as (PointResponse & { message?: string }) | undefined;
  if (!res.ok || !body || !Array.isArray(body.marks)) return { kind: "unavailable", message: body?.message ?? `The guide returned an error (${res.status}).` };
  const out = { about: typeof body.about === "string" ? body.about : "", marks: body.marks };
  remember(MARKS, key, out);
  return { kind: "ok", ...out };
}
