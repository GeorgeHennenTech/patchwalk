// A second look at what the keyword search found. The search is fast but only counts words; here a small
// model reads the first lines of the best 24 passages and says which few really answer the question. Code
// decides what happens with its answer: only passages the search itself found can be chosen, the search's
// own order fills any gap, and if the model fails or says nothing useful the search's result is used as it
// was. The model never writes an answer here and never sees a whole page.
import { z } from "zod";
import { pageOf, type Hit } from "./search.js";

/** How many passages the search hands over for the second look, and how much of each is shown. */
export const RERANK_POOL = 24, RERANK_CHARS = 600;
export const RerankSchema = z.object({ picks: z.array(z.number().int()).describe("the numbers of the passages that best answer the question, best first") });
export const RERANK_SYSTEM = `You choose passages for a study guide on sound design and music production. You are given a learner's question and numbered excerpts from books, manuals and papers. Choose the excerpts most likely to contain what is needed to answer the question, best first. Prefer an excerpt that explains or gives the steps over one that only mentions the words. When the question names a product, prefer that product's own manual. Choose only from the numbers given; choose fewer if few are relevant, and none if none are.`;

/** What the model is shown: the question, then each passage's source and its opening lines. */
export function rerankPrompt(question: string, hits: Hit[], want: number): string {
  const list = hits.map((h, i) => `[${i + 1}] ${h.passage.source}${h.passage.page ? `, page ${h.passage.page}` : ""} (${h.passage.section})\n${h.passage.text.slice(0, RERANK_CHARS).replace(/\s+/g, " ").trim()}`).join("\n\n");
  return `Question: ${question.slice(0, 600)}\n\nExcerpts:\n\n${list}\n\nChoose up to ${want}.`;
}
/**
 * The model's choice made safe: numbers outside the list and repeats are dropped, at most `perPage` parts of
 * one page are kept, and places left over are filled from the search's own order.
 */
export function applyPicks(hits: Hit[], picks: readonly number[], limit: number, perPage = 2): Hit[] {
  const out: Hit[] = [], used = new Set<number>(), pages = new Map<string, number>();
  const take = (i: number) => {
    const hit = hits[i];
    if (!hit || used.has(i) || out.length >= limit) return;
    const page = pageOf(hit.passage), n = pages.get(page) ?? 0;
    if (n >= perPage) return;
    used.add(i); pages.set(page, n + 1); out.push(hit);
  };
  for (const p of picks) if (Number.isInteger(p)) take(p - 1);
  for (let i = 0; i < hits.length; i++) take(i);
  return out;
}
/** Search results after the second look. `choose` asks the model; any failure gives the search's own best. */
export async function rerank(question: string, hits: Hit[], limit: number, choose: (prompt: string) => Promise<readonly number[]>): Promise<{ hits: Hit[]; reranked: boolean }> {
  if (hits.length <= limit) return { hits, reranked: false };
  try {
    const picks = await choose(rerankPrompt(question, hits, limit));
    if (!picks.some((p) => Number.isInteger(p) && p >= 1 && p <= hits.length)) return { hits: hits.slice(0, limit), reranked: false };
    return { hits: applyPicks(hits, picks, limit), reranked: true };
  } catch { return { hits: applyPicks(hits, [], limit), reranked: false }; }
}
