// Side threads on a walkthrough. The learner highlights some words, in a step or in an answer, and asks about
// them; that starts a thread that hangs off exactly those words. Highlighting inside a thread's answer starts
// a branch off that answer, so a rabbit hole becomes its own branch and never derails the thread it left.
// This file is the plain data and rules; nothing here draws or calls the guide.
import { answerText, MAX_HISTORY_ANSWER, MAX_HISTORY_TURNS, type AskResponse } from "../library/answer";
import type { Turn } from "./ask";

export interface Thread {
  id: string;
  /** The step of the walkthrough this thread, or the thread it branched from, hangs off. */
  step: number;
  /** For a branch: the thread it came from and which of that thread's answers was highlighted. */
  parent?: { id: string; turn: number };
  /** The highlighted words it stems from. */
  quote: string;
  turns: Turn[];
  /** Which of the branch colours it wears. */
  colour: number;
}
export const MAX_DEPTH = 3, MAX_QUOTE = 300, MIN_QUOTE = 3, COLOURS = 6, MAX_THREADS = 40;

/** Highlighted text tidied into a quote, or undefined when it is too short to mean anything. */
export function quoteOf(selected: string): string | undefined {
  const text = selected.replace(/\s+/g, " ").trim();
  if (text.length < MIN_QUOTE) return undefined;
  return text.length > MAX_QUOTE ? `${text.slice(0, MAX_QUOTE - 1).trimEnd()}…` : text;
}
/** How many levels down a thread is: 1 for one that hangs off a step. */
export function depthOf(threads: Thread[], id: string): number {
  let depth = 0, at = threads.find((t) => t.id === id);
  while (at && depth < 20) { depth++; at = at.parent ? threads.find((t) => t.id === at!.parent!.id) : undefined; }
  return depth;
}
/** The threads from the one on the step down to this one, in order. */
export function pathTo(threads: Thread[], id: string | undefined): Thread[] {
  const path: Thread[] = [];
  let at = threads.find((t) => t.id === id);
  while (at && path.length < 20) { path.unshift(at); at = at.parent ? threads.find((t) => t.id === at!.parent!.id) : undefined; }
  return path;
}
/** Where a new thread may hang: on a step, or on one answer of an existing thread. */
export type Stem = { step: number } | { thread: string; turn: number };
/** May a thread start here? Not below the deepest level, and not past the most a walkthrough holds. */
export function canBranch(threads: Thread[], stem: Stem): { ok: true } | { ok: false; why: string } {
  if (threads.length >= MAX_THREADS) return { ok: false, why: `This walkthrough already has ${MAX_THREADS} side threads. Delete one you no longer need first.` };
  if ("thread" in stem && depthOf(threads, stem.thread) >= MAX_DEPTH) return { ok: false, why: "This is three branches deep already. Ask it as a new walkthrough so it gets room of its own." };
  return { ok: true };
}
/** A new, empty thread on that stem. */
export function startThread(threads: Thread[], stem: Stem, quote: string, id = `t${Date.now().toString(36)}${Math.random().toString(36).slice(2, 6)}`): Thread {
  const parent = "thread" in stem ? threads.find((t) => t.id === stem.thread) : undefined;
  const used = new Set(threads.map((t) => t.colour));
  // a colour nobody is wearing yet, if there is one, so neighbours can be told apart
  const colour = Array.from({ length: COLOURS }, (_, i) => i).find((c) => !used.has(c)) ?? threads.length % COLOURS;
  return { id, step: parent ? parent.step : (stem as { step: number }).step, ...(parent ? { parent: { id: parent.id, turn: (stem as { turn: number }).turn } } : {}), quote, turns: [], colour };
}
/** Remove a thread and every branch that grew from it. */
export function dropThread(threads: Thread[], id: string): Thread[] {
  const gone = new Set([id]);
  for (let grew = true; grew; ) { grew = false; for (const t of threads) if (t.parent && gone.has(t.parent.id) && !gone.has(t.id)) { gone.add(t.id); grew = true; } }
  return threads.filter((t) => !gone.has(t.id));
}
/**
 * What the guide is told came before a new question in a thread: only this branch's own path. That is the
 * turns of each thread above it, up to and including the answer it branched from, then its own finished
 * turns. Neighbouring branches are never included, so side topics cannot muddle each other.
 */
export function historyFor(threads: Thread[], id: string): { question: string; answer: string }[] {
  const path = pathTo(threads, id), turns: Turn[] = [];
  path.forEach((t, i) => { const next = path[i + 1]; turns.push(...(next ? t.turns.slice(0, next.parent!.turn + 1) : t.turns)); });
  return turns.filter((t) => t.outcome?.kind === "ok").slice(-MAX_HISTORY_TURNS)
    .map((t) => ({ question: t.question, answer: answerText((t.outcome as { answer: AskResponse }).answer).slice(0, MAX_HISTORY_ANSWER) }));
}
/**
 * What the guide is told the learner is looking at. The first line steers the search, so it carries the
 * step's title and the highlighted words; the rest is the step itself, for the guide's eyes only.
 */
export function contextFor(walkTitle: string, stepTitle: string, stepWords: string, thread: Thread): string {
  const lead = `${stepTitle}: ${thread.quote}`.replace(/\s+/g, " ").slice(0, 300);
  const rest = `The learner is on the walkthrough "${walkTitle}", step "${stepTitle}", and highlighted these words to ask about: "${thread.quote}"\nThe step says:\n${stepWords}`;
  return `${lead}\n${rest}`.slice(0, 2000);
}
/** The steps that have threads on them, for the dots on the step buttons. */
export const stepsWithThreads = (threads: Thread[]) => new Set(threads.map((t) => t.step));
