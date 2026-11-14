// Turns a question plus retrieved passages into a cited answer. The model call is injected so this can be
// tested offline. The model is told to answer only from the passages; every sentence it writes carries the
// passages it was drawn from, and text with no source is flagged for the reader.
import { z } from "zod";
import type { Hit, Passage, PassageImage } from "./search.js";

/** How much of a conversation is sent back with a follow-up question. */
export const MAX_HISTORY_TURNS = 4, MAX_HISTORY_ANSWER = 1500;

export const AskRequestSchema = z.object({
  question: z.string().trim().min(3).max(600),
  /** Optional: what the learner is looking at (a lesson title or step text). Never a preset file. */
  context: z.string().max(2000).optional(),
  /** Earlier turns of this conversation, oldest first, so a follow-up can be understood. Never a source. */
  history: z.array(z.object({ question: z.string().max(600), answer: z.string().max(MAX_HISTORY_ANSWER) })).max(MAX_HISTORY_TURNS).optional(),
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
export type GuideModel = (args: { question: string; context?: string; passages: Passage[]; history?: AskRequest["history"] }) => Promise<ModelBlock[]>;

export const NOT_COVERED = "NOT_IN_LIBRARY";
export const MIN_SCORE = 2;

export const GUIDE_SYSTEM = `You are the guide in a private app that teaches sound synthesis, Serum 2, music production in Ableton Live and effects such as the distortion plugin Rift to one learner, who is a beginner. You speak in one consistent voice: warm, direct, plain words, no hype.

Answer the learner's question using only the documents supplied with it. They are pages from the manuals and books in the app's library (each document's title says which) and the app's own knowledge cards. Quote-level citations are attached to what you write automatically, so stay close to what the documents actually say.

- Lead with the answer in a sentence or two, then add only what helps a beginner act on it. Define a term the first time you use it. Keep it under about 150 words unless the question needs steps.
- Use the control names exactly as the documents print them.
- Do not add numbers, settings, menu items or behaviour that the documents do not state. If the documents only partly answer the question, answer that part and say what is missing.
- If the documents do not answer the question at all, reply with exactly ${NOT_COVERED} and nothing else. Do not answer from memory.
- Plain sentences. No headings, no bullet lists unless you are giving steps in order. No Markdown at all: no asterisks for bold, no pound signs.
- The question may come with a note on what the learner is looking at: a lesson step, the current settings of the practice synth, or instructions for a patch. Those are facts supplied by the app. You may refer to them to make the answer fit, but do not add to them or guess at settings they do not mention.
- If something is worth knowing but is not part of doing what was asked (a related limit, a note, a tip), put it last, in a paragraph of its own that begins with the words "Side note:". Keep it out of the steps. Most answers need none.
- The question may be a follow-up in a conversation; earlier questions and answers are then included. Use them only to understand what the learner means. They are not a source: everything you say must still come from the documents supplied with this question.
- When the documents come from different books, bring them together into one answer, and say which book each part comes from when that matters.
- Knowledge cards are drafts written for this app; a product's own manual is the authority on how that product behaves. Do not carry a statement from one product's manual over to another product: say which one you are describing when it could be unclear.`;

export async function answerQuestion(req: AskRequest, hits: Hit[], model: GuideModel): Promise<AskResponse> {
  const relevant = hits.filter((h) => h.score >= MIN_SCORE);
  if (relevant.length === 0) return { covered: false, segments: [], sources: [] };
  const passages = relevant.map((h) => h.passage);
  const blocks = await model({ question: req.question, context: req.context, passages, history: req.history });

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

/** One paragraph of an answer, ready to show: its pieces in order, and whether it is a side note. */
export interface AnswerParagraph { aside: boolean; parts: AnswerSegment[] }
const ASIDE = /^\s*side note:\s*/i;
/**
 * The answer as paragraphs. The model's text arrives in pieces (each with its own sources) and a blank line
 * can fall anywhere inside a piece, so pieces are cut at blank lines and regrouped. A paragraph that begins
 * "Side note:" is marked as an aside, and those words are taken off: the page labels it instead.
 */
export function toParagraphs(segments: AnswerSegment[]): AnswerParagraph[] {
  const out: AnswerParagraph[] = [{ aside: false, parts: [] }];
  for (const seg of segments) {
    const chunks = seg.text.split(/\n\s*\n/);
    chunks.forEach((chunk, i) => {
      if (i > 0) out.push({ aside: false, parts: [] });
      // the sources belong to the last chunk of a piece: that is where the citation mark would sit
      if (chunk.trim()) out[out.length - 1]!.parts.push({ text: chunk, sources: i === chunks.length - 1 ? seg.sources : [] });
    });
  }
  return out.filter((p) => p.parts.length).map((p) => {
    const first = p.parts[0]!;
    if (!ASIDE.test(first.text)) return { ...p, parts: p.parts.map((x, i) => (i === 0 ? { ...x, text: x.text.replace(/^\s+/, "") } : x)) };
    const rest = first.text.replace(ASIDE, "");
    // if the words "Side note:" were a piece of their own, the capital goes on the piece that follows
    const parts = [{ ...first, text: rest }, ...p.parts.slice(1)].filter((x) => x.text.trim());
    return { aside: true, parts: parts.map((x, i) => (i === 0 ? { ...x, text: x.text.charAt(0).toUpperCase() + x.text.slice(1) } : x)) };
  });
}
/** An answer as plain text, for sending back as conversation history. */
export const answerText = (a: AskResponse) => (a.covered ? a.segments.map((s) => s.text).join("").trim() : "The library did not cover this.");
