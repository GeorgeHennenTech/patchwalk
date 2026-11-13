// Browser side of "Show me where": asks the guide to point at the relevant places in one library picture.
import type { Mark, PointResponse } from "../library/point";

export type PointOutcome = { kind: "ok"; marks: Mark[] } | { kind: "unavailable"; message: string };

export async function pointAt(book: string, file: string, question: string, fetchImpl: typeof fetch = fetch): Promise<PointOutcome> {
  let res: Response;
  try {
    res = await fetchImpl("/api/point", { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify({ book, file, question }) });
  } catch {
    return { kind: "unavailable", message: "Could not reach the guide." };
  }
  const body = (await res.json().catch(() => undefined)) as (PointResponse & { message?: string }) | undefined;
  if (!res.ok || !body || !Array.isArray(body.marks)) return { kind: "unavailable", message: body?.message ?? `The guide returned an error (${res.status}).` };
  return { kind: "ok", marks: body.marks };
}
