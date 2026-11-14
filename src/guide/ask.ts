// Browser side of "Ask the guide". Sends the question (and optionally what the learner is looking at).
import { answerText, MAX_HISTORY_ANSWER, MAX_HISTORY_TURNS, type AskResponse } from "../library/answer";

export type AskOutcome = { kind: "ok"; answer: AskResponse } | { kind: "unavailable"; message: string };

export interface Turn { question: string; outcome?: AskOutcome }
/** The last few finished turns, as the plain text sent back with a follow-up question. */
export const historyOf = (turns: Turn[]) => turns.filter((t) => t.outcome?.kind === "ok").slice(-MAX_HISTORY_TURNS)
  .map((t) => ({ question: t.question, answer: answerText((t.outcome as { answer: AskResponse }).answer).slice(0, MAX_HISTORY_ANSWER) }));

export async function askGuide(question: string, context?: string, fetchImpl: typeof fetch = fetch, history?: { question: string; answer: string }[]): Promise<AskOutcome> {
  let res: Response;
  try {
    res = await fetchImpl("/api/ask", { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify({ question, context, ...(history?.length ? { history } : {}) }) });
  } catch {
    return { kind: "unavailable", message: "Could not reach the guide." };
  }
  const body = (await res.json().catch(() => undefined)) as (AskResponse & { message?: string }) | undefined;
  if (!res.ok || !body) return { kind: "unavailable", message: body?.message ?? `The guide returned an error (${res.status}).` };
  return { kind: "ok", answer: body };
}
