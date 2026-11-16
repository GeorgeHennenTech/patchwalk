// The shared library of walkthroughs: every walkthrough anyone on the site has had made is kept here, with
// the steps and drawings written so far, so that everyone can open it without paying for it again. Server
// only. One walkthrough per question (the same question, however it is capitalised or spaced, is the same
// walkthrough). Unlike the 90-day answer memory, these are kept until the owner removes them.
import { createHash } from "node:crypto";
import { sameQuestionKey } from "../library/keys.js";
import type { Drawing } from "../library/draw.js";
import type { Plan, PlanStep, StepBody, Tool } from "../library/walk.js";
import type { Kv } from "./kv.js";

export interface SharedStep extends PlanStep { body?: StepBody; draw?: Drawing }
export interface SharedWalk { id: string; question: string; title: string; tool: Tool; steps: SharedStep[]; /** who first asked */ by: string; at: string; updated: string }
/** One line of the list everyone browses. */
export interface WalkSummary { id: string; question: string; title: string; tool: Tool; steps: number; written: number; drawn: number; by: string; at: string; updated: string }

export const MAX_SHARED_WALKS = 300;
const INDEX = "pw:walks:index", docKey = (id: string) => `pw:walks:doc:${id}`;
export const WALK_ID = /^[a-f0-9]{24}$/;
export const walkId = (question: string) => createHash("sha256").update(sameQuestionKey(question)).digest("hex").slice(0, 24);

const summary = (w: SharedWalk): WalkSummary => ({ id: w.id, question: w.question, title: w.title, tool: w.tool, steps: w.steps.length, written: w.steps.filter((s) => s.body?.blocks.length).length, drawn: w.steps.filter((s) => s.draw && s.draw.kind !== "none").length, by: w.by, at: w.at, updated: w.updated });
const same = (a: PlanStep, b: PlanStep) => a.title === b.title && a.find === b.find && a.kind === b.kind;

export const listWalks = async (kv: Kv) => (await kv.get<WalkSummary[]>(INDEX)) ?? [];
export const openWalk = (kv: Kv, id: string) => kv.get<SharedWalk>(docKey(id));

async function store(kv: Kv, walk: SharedWalk): Promise<void> {
  await kv.set(docKey(walk.id), walk);
  const index = (await listWalks(kv)).filter((w) => w.id !== walk.id);
  const next = [summary(walk), ...index];
  // the library is full: the walkthroughs longest untouched make room
  for (const gone of next.slice(MAX_SHARED_WALKS)) await kv.del(docKey(gone.id));
  await kv.set(INDEX, next.slice(0, MAX_SHARED_WALKS));
}

/**
 * Keep a walkthrough's outline. If the same question already has one with the same steps, what has been
 * written for it stays; a different outline (asked afresh, or planned from a changed library) replaces it.
 * Returns the walkthrough's id.
 */
export async function savePlan(kv: Kv, question: string, plan: Plan, by: string, now = new Date()): Promise<string> {
  const id = walkId(question), had = await openWalk(kv, id);
  if (had && had.steps.length === plan.steps.length && had.steps.every((s, i) => same(s, plan.steps[i]!))) return id;
  const stamp = now.toISOString();
  await store(kv, { id, question: question.trim().slice(0, 600), title: plan.title, tool: plan.tool, steps: plan.steps.map(({ title, find, kind }) => ({ title, find, kind })), by: had?.by ?? by, at: had?.at ?? stamp, updated: stamp });
  return id;
}
/** Keep what was written for one step. Ignored if the walkthrough is gone or that step is no longer the same step. */
export async function saveStep(kv: Kv, id: string, index: number, step: PlanStep, body: StepBody, now = new Date()): Promise<boolean> {
  const walk = await openWalk(kv, id), at = walk?.steps[index];
  if (!walk || !at || !same(at, step) || !body.blocks.length) return false;
  const { remembered: _r, ...clean } = body;
  // a new version of a step's words makes a drawing chosen for the old words out of date
  walk.steps[index] = { title: at.title, find: at.find, kind: at.kind, body: clean };
  walk.updated = now.toISOString();
  await store(kv, walk);
  return true;
}
/** Keep the drawing chosen for a step, found by the step's title. */
export async function saveDraw(kv: Kv, id: string, stepTitle: string, drawing: Drawing, now = new Date()): Promise<boolean> {
  const walk = await openWalk(kv, id), index = walk?.steps.findIndex((s) => s.title === stepTitle) ?? -1;
  if (!walk || index < 0 || !walk.steps[index]!.body) return false;
  const { remembered: _r, ...clean } = drawing;
  walk.steps[index] = { ...walk.steps[index]!, draw: clean };
  walk.updated = now.toISOString();
  await store(kv, walk);
  return true;
}
export async function removeWalk(kv: Kv, id: string): Promise<void> {
  await kv.del(docKey(id));
  await kv.set(INDEX, (await listWalks(kv)).filter((w) => w.id !== id));
}
