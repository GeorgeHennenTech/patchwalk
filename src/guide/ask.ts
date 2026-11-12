// Browser side of "Ask the guide". Sends the question (and optionally what the learner is looking at).
import type { AskResponse } from "../library/answer";

export type AskOutcome = { kind: "ok"; answer: AskResponse } | { kind: "unavailable"; message: string };

export async function askGuide(question: string, context?: string, fetchImpl: typeof fetch = fetch): Promise<AskOutcome> {
  let res: Response;
  try {
    res = await fetchImpl("/api/ask", { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify({ question, context }) });
  } catch {
    return { kind: "unavailable", message: "Could not reach the guide." };
  }
  const body = (await res.json().catch(() => undefined)) as (AskResponse & { message?: string }) | undefined;
  if (!res.ok || !body) return { kind: "unavailable", message: body?.message ?? `The guide returned an error (${res.status}).` };
  return { kind: "ok", answer: body };
}
