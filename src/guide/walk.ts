// Browser side of "Walk me through it": asks for a walkthrough's outline, then for each step as the learner
// reaches it, and keeps walkthroughs in this browser so one that was paid for is there next time, with the
// steps already read and the ticks already made.
import { guideHeaders } from "./me";
import type { Drawing } from "../library/draw";
import { SHARED_ID, stepForDrawing, type Plan, type PlanStep, type StepBody, type Tool } from "../library/walk";

export type WalkOutcome<T> = { kind: "ok"; value: T } | { kind: "unavailable"; message: string };

async function post<T>(body: unknown, fetchImpl: typeof fetch): Promise<WalkOutcome<T>> {
  let res: Response;
  try { res = await fetchImpl("/api/walk", { method: "POST", headers: guideHeaders(), body: JSON.stringify(body) }); } catch { return { kind: "unavailable", message: "Could not reach the guide." }; }
  const data = (await res.json().catch(() => undefined)) as (T & { message?: string }) | undefined;
  if (!res.ok || !data) return { kind: "unavailable", message: data?.message ?? `The guide returned an error (${res.status}).` };
  return { kind: "ok", value: data };
}
export const planWalk = (question: string, fresh = false, fetchImpl: typeof fetch = fetch) => post<Plan>({ kind: "plan", question, ...(fresh ? { fresh: true } : {}) }, fetchImpl);
export const walkStep = (walk: Pick<Walk, "question" | "title" | "tool" | "steps"> & { id?: string }, index: number, fresh = false, fetchImpl: typeof fetch = fetch) =>
  post<StepBody>({ kind: "step", question: walk.question, title: walk.title, tool: walk.tool, steps: walk.steps.map(({ title, find, kind }) => ({ title, find, kind })), index, ...shared(walk.id), ...(fresh ? { fresh: true } : {}) }, fetchImpl);
/**
 * The same step asked for twice at once (the page drew itself again, or the learner left and came straight
 * back) is one request, not two: a step is a paid call, so it must never be sent twice for nothing.
 */
const writing = new Map<string, Promise<WalkOutcome<StepBody>>>();
export function walkStepOnce(walk: Parameters<typeof walkStep>[0] & { id: string }, index: number, fetchImpl: typeof fetch = fetch): Promise<WalkOutcome<StepBody>> {
  const key = `${walk.id}:${index}:${walk.steps[index]?.title ?? ""}`, going = writing.get(key);
  if (going) return going;
  const made = walkStep(walk, index, false, fetchImpl).finally(() => writing.delete(key));
  writing.set(key, made);
  return made;
}
/** A walkthrough that is in the shared library says so, so what is written for it is kept there for everyone. */
const shared = (id: string | undefined) => (id && SHARED_ID.test(id) ? { id } : {});

/** Ask the guide to choose a drawing for a step that has been written. One paid call; the app does the drawing. */
export const drawStep = (question: string, step: string, body: StepBody, fresh = false, fetchImpl: typeof fetch = fetch, id?: string) =>
  post<Drawing>({ kind: "draw", question, step, text: stepForDrawing(body), ...shared(id), ...(fresh ? { fresh: true } : {}) }, fetchImpl);

/** One step of a saved walkthrough: the plan's step, what the guide wrote for it once opened, and the learner's tick. */
export interface WalkStep extends PlanStep { body?: StepBody; done?: boolean; /** The drawing chosen for this step, once asked for. */ draw?: Drawing }
export interface Walk { id: string; question: string; title: string; tool: Tool; steps: WalkStep[]; at: number; savedAt: string }

const KEY = "patchwalk.walks.v1";
export const MAX_WALKS = 30;
type Store = Pick<Storage, "getItem" | "setItem">;
const valid = (w: unknown): w is Walk => !!w && typeof w === "object" && typeof (w as Walk).id === "string" && typeof (w as Walk).question === "string" && Array.isArray((w as Walk).steps);

export function loadWalks(storage: Pick<Storage, "getItem"> | undefined = globalThis.localStorage): Walk[] {
  try { const raw = JSON.parse(storage?.getItem(KEY) ?? "[]") as unknown; return Array.isArray(raw) ? raw.filter(valid) : []; } catch { return []; }
}
export function newWalk(question: string, plan: Plan, now = new Date()): Walk {
  // a walkthrough in the shared library keeps the library's id, so this browser's copy and the shared one are the same walkthrough
  return { id: plan.id ?? `w${now.getTime().toString(36)}${Math.random().toString(36).slice(2, 6)}`, question, title: plan.title, tool: plan.tool, steps: plan.steps.map((s) => ({ ...s })), at: 0, savedAt: now.toISOString() };
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

/** One line of the shared library's list. */
export interface SharedSummary { id: string; question: string; title: string; tool: Tool; steps: number; written: number; drawn: number; by: string; at: string; updated: string }
export interface SharedList { walks: SharedSummary[]; /** false when the site has no database, so nothing can be shared */ database: boolean; owner?: boolean }
interface SharedDoc { id: string; question: string; title: string; tool: Tool; steps: WalkStep[]; by: string; at: string; updated: string }
export const listShared = (fetchImpl: typeof fetch = fetch) => post<SharedList>({ kind: "list" }, fetchImpl);
export const removeShared = (id: string, fetchImpl: typeof fetch = fetch) => post<SharedList>({ kind: "remove", id }, fetchImpl);
/**
 * Open a walkthrough from the shared library. Everything written for it comes along; if this browser already
 * has the same walkthrough, the place and the ticks are this browser's, and anything it holds that the
 * library does not is kept too.
 */
export async function openShared(id: string, mine: Walk[] = loadWalks(), fetchImpl: typeof fetch = fetch): Promise<WalkOutcome<Walk>> {
  const out = await post<SharedDoc>({ kind: "open", id }, fetchImpl);
  if (out.kind === "unavailable") return out;
  return { kind: "ok", value: joinShared(out.value, mine.find((w) => w.id === id)) };
}
export function joinShared(doc: SharedDoc, local?: Walk): Walk {
  const sameSteps = !!local && local.steps.length === doc.steps.length && local.steps.every((s, i) => s.title === doc.steps[i]!.title);
  return {
    id: doc.id, question: doc.question, title: doc.title, tool: doc.tool, savedAt: doc.updated,
    at: sameSteps ? Math.min(local!.at, doc.steps.length - 1) : 0,
    steps: doc.steps.map((s, i) => { const l = sameSteps ? local!.steps[i]! : undefined; return { title: s.title, find: s.find, kind: s.kind, ...(s.body ?? l?.body ? { body: s.body ?? l!.body } : {}), ...(s.draw ?? l?.draw ? { draw: s.draw ?? l!.draw } : {}), ...(l?.done ? { done: true } : {}) }; }),
  };
}
