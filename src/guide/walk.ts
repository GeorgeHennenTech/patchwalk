// Browser side of "Walk me through it": asks for a walkthrough's outline, then for each step as the learner
// reaches it, and keeps walkthroughs in this browser so one that was paid for is there next time, with the
// steps already read and the ticks already made.
import { guideHeaders } from "./me";
import type { Plan, PlanStep, StepBody, Tool } from "../library/walk";

export type WalkOutcome<T> = { kind: "ok"; value: T } | { kind: "unavailable"; message: string };

async function post<T>(body: unknown, fetchImpl: typeof fetch): Promise<WalkOutcome<T>> {
  let res: Response;
  try { res = await fetchImpl("/api/walk", { method: "POST", headers: guideHeaders(), body: JSON.stringify(body) }); } catch { return { kind: "unavailable", message: "Could not reach the guide." }; }
  const data = (await res.json().catch(() => undefined)) as (T & { message?: string }) | undefined;
  if (!res.ok || !data) return { kind: "unavailable", message: data?.message ?? `The guide returned an error (${res.status}).` };
  return { kind: "ok", value: data };
}
export const planWalk = (question: string, fresh = false, fetchImpl: typeof fetch = fetch) => post<Plan>({ kind: "plan", question, ...(fresh ? { fresh: true } : {}) }, fetchImpl);
export const walkStep = (walk: Pick<Walk, "question" | "title" | "tool" | "steps">, index: number, fresh = false, fetchImpl: typeof fetch = fetch) =>
  post<StepBody>({ kind: "step", question: walk.question, title: walk.title, tool: walk.tool, steps: walk.steps.map(({ title, find, kind }) => ({ title, find, kind })), index, ...(fresh ? { fresh: true } : {}) }, fetchImpl);

/** One step of a saved walkthrough: the plan's step, what the guide wrote for it once opened, and the learner's tick. */
export interface WalkStep extends PlanStep { body?: StepBody; done?: boolean }
export interface Walk { id: string; question: string; title: string; tool: Tool; steps: WalkStep[]; at: number; savedAt: string }

const KEY = "patchwalk.walks.v1";
export const MAX_WALKS = 30;
type Store = Pick<Storage, "getItem" | "setItem">;
const valid = (w: unknown): w is Walk => !!w && typeof w === "object" && typeof (w as Walk).id === "string" && typeof (w as Walk).question === "string" && Array.isArray((w as Walk).steps);

export function loadWalks(storage: Pick<Storage, "getItem"> | undefined = globalThis.localStorage): Walk[] {
  try { const raw = JSON.parse(storage?.getItem(KEY) ?? "[]") as unknown; return Array.isArray(raw) ? raw.filter(valid) : []; } catch { return []; }
}
export function newWalk(question: string, plan: Plan, now = new Date()): Walk {
  return { id: `w${now.getTime().toString(36)}${Math.random().toString(36).slice(2, 6)}`, question, title: plan.title, tool: plan.tool, steps: plan.steps.map((s) => ({ ...s })), at: 0, savedAt: now.toISOString() };
}
/** Keep a walkthrough, newest first; one with the same id is replaced. Returns the new list (unchanged if the browser will not store it). */
export function saveWalk(walk: Walk, now = new Date(), storage: Store | undefined = globalThis.localStorage): Walk[] {
  const walks = [{ ...walk, savedAt: now.toISOString() }, ...loadWalks(storage).filter((w) => w.id !== walk.id)].slice(0, MAX_WALKS);
  try { storage?.setItem(KEY, JSON.stringify(walks)); } catch { /* not kept */ }
  return walks;
}
export function deleteWalk(id: string, storage: Store | undefined = globalThis.localStorage): Walk[] {
  const walks = loadWalks(storage).filter((w) => w.id !== id);
  try { storage?.setItem(KEY, JSON.stringify(walks)); } catch { /* not kept */ }
  return walks;
}
/** How many of a walkthrough's steps have been ticked. */
export const doneCount = (w: Walk) => w.steps.filter((s) => s.done).length;
