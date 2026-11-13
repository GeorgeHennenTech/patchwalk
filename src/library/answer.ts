// Turns a question plus retrieved passages into a cited answer. The model call is injected so this can be
// tested offline. The model is told to answer only from the passages; every sentence it writes carries the
// passages it was drawn from, and text with no source is flagged for the reader.
import { z } from "zod";
import type { Hit, Passage, PassageImage } from "./search.js";

export const AskRequestSchema = z.object({
  question: z.string().trim().min(3).max(600),
  /** Optional: what the learner is looking at (a lesson title or step text). Never a preset file. */
  context: z.string().max(2000).optional(),
});
export type AskRequest = z.infer<typeof AskRequestSchema>;

export interface AnswerSegment {
  text: string;
  /** Numbers of the sources this text was drawn from. Empty = not drawn from the library. */
  sources: number[];
}
export interface AnswerSource {
  n: number;
  id: string;
  source: string;
  section: string;
  page?: number;
  /** The exact words the answer relied on. */
  quotes: string[];
  /** Pictures from the cited page. Chosen by code: every cited page that has pictures brings them along. */
  images?: PassageImage[];
}
/** At most this many pictures per cited page, largest first, so one busy page cannot flood an answer. */
export const MAX_IMAGES_PER_SOURCE = 3;
export interface AskResponse {
  /** False when the library had nothing relevant, or the guide said it could not answer from it. */
  covered: boolean;
  segments: AnswerSegment[];
  sources: AnswerSource[];
}

/** What the model returns, reduced to the parts used here. */
export interface ModelBlock {
  text: string;
  /** Indexes into the passages that were supplied, with the quoted words. */
  citations: { passageIndex: number; quote: string }[];
}
export type GuideModel = (args: { question: string; context?: string; passages: Passage[] }) => Promise<ModelBlock[]>;

export const NOT_COVERED = "NOT_IN_LIBRARY";
export const MIN_SCORE = 2;

export const GUIDE_SYSTEM = `You are the guide in a private app that teaches sound synthesis, Serum 2 and music production in Ableton Live to one learner, who is a beginner. You speak in one consistent voice: warm, direct, plain words, no hype.

Answer the learner's question using only the documents supplied with it. They are pages from the manuals and books in the app's library (each document's title says which) and the app's own knowledge cards. Quote-level citations are attached to what you write automatically, so stay close to what the documents actually say.

- Lead with the answer in a sentence or two, then add only what helps a beginner act on it. Define a term the first time you use it. Keep it under about 150 words unless the question needs steps.
- Use the control names exactly as the documents print them.
- Do not add numbers, settings, menu items or behaviour that the documents do not state. If the documents only partly answer the question, answer that part and say what is missing.
- If the documents do not answer the question at all, reply with exactly ${NOT_COVERED} and nothing else. Do not answer from memory.
- Plain sentences. No headings, no bullet lists unless you are giving steps in order.
- The question may come with a note on what the learner is looking at: a lesson step, the current settings of the practice synth, or instructions for a patch. Those are facts supplied by the app. You may refer to them to make the answer fit, but do not add to them or guess at settings they do not mention.
- Knowledge cards are drafts written for this app; a product's own manual is the authority on how that product behaves. Do not carry a statement from one product's manual over to another product: say which one you are describing when it could be unclear.`;

export async function answerQuestion(req: AskRequest, hits: Hit[], model: GuideModel): Promise<AskResponse> {
  const relevant = hits.filter((h) => h.score >= MIN_SCORE);
  if (relevant.length === 0) return { covered: false, segments: [], sources: [] };
  const passages = relevant.map((h) => h.passage);
  const blocks = await model({ question: req.question, context: req.context, passages });

  const whole = blocks.map((b) => b.text).join("").trim();
  if (!whole || whole.includes(NOT_COVERED)) return { covered: false, segments: [], sources: [] };

  const numbers = new Map<number, AnswerSource>();
  const segments: AnswerSegment[] = [];
  for (const block of blocks) {
    if (!block.text) continue;
    const used: number[] = [];
    for (const c of block.citations) {
      const p = passages[c.passageIndex];
      if (!p) continue; // a citation that points outside what was supplied is dropped, not trusted
      let src = numbers.get(c.passageIndex);
      if (!src) {
        src = { n: numbers.size + 1, id: p.id, source: p.source, section: p.section, page: p.page, quotes: [], ...(p.images?.length ? { images: [...p.images].sort((a, b) => b.width * b.height - a.width * a.height).slice(0, MAX_IMAGES_PER_SOURCE) } : {}) };
        numbers.set(c.passageIndex, src);
      }
      const quote = c.quote.replace(/\s+/g, " ").trim();
      if (quote && !src.quotes.includes(quote)) src.quotes.push(quote);
      if (!used.includes(src.n)) used.push(src.n);
    }
    segments.push({ text: block.text, sources: used });
  }
  return { covered: true, segments, sources: [...numbers.values()].sort((a, b) => a.n - b.n) };
}
