// "Walk me through it": the guide plans a short sequence of steps for a how-to question, then writes each
// step from the passages found for that step alone. Two rules shape everything here, both the owner's:
//
// 1. Sources and inference are kept apart. Every paragraph of a step is labelled "the text says" or "my
//    synthesis", and the label is decided by CODE from the citations the API attached, not by what the model
//    claims: a paragraph the model called the text's that carries no citation is shown as the guide's own.
//    Where two texts disagree, or use different conventions or units, that is said in a paragraph of its own.
// 2. It ends in the learner's tools. Book maths is kept as a reference and explained symbol by symbol, and
//    the last step is a recipe in Serum 2 or Ableton Live, written from that product's manual only.
//
// The model calls are injected so all of this can be tested offline. Server files use ".js" import suffixes.
import { z } from "zod";
import { cite, toParagraphs, type AnswerSegment, type AnswerSource, type ModelBlock } from "./answer.js";
import type { Hit, Passage } from "./search.js";

export const MIN_STEPS = 2, MAX_STEPS = 7;
/** How much of a written step is sent when asking for a drawing of it. */
export const MAX_DRAW_TEXT = 6000;
export const TOOLS = ["serum", "ableton", "both", "none"] as const;
export type Tool = (typeof TOOLS)[number];
export const TOOL_NAMES: Record<Tool, string> = { serum: "Serum 2", ableton: "Ableton Live", both: "Serum 2 and Ableton Live", none: "" };
/** The books a recipe may be written from, by tool: a product's own manual is the only authority on its controls. */
export const TOOL_BOOKS: Record<Tool, string[]> = { serum: ["serum-2-user-guide"], ableton: ["ableton-live-11-manual"], both: ["serum-2-user-guide", "ableton-live-11-manual"], none: [] };

export const STEP_KINDS = ["idea", "maths", "recipe"] as const;
const StepSchema = z.object({ title: z.string().trim().min(3).max(90), find: z.string().trim().min(2).max(160), kind: z.enum(STEP_KINDS) });
export type PlanStep = z.infer<typeof StepSchema>;

/** What the planning call must return. */
export const PlanModelSchema = z.object({
  covered: z.boolean().describe("false if the documents do not cover the question at all"),
  title: z.string().describe("a short name for the walkthrough, under ten words"),
  tool: z.enum(TOOLS).describe("where the learner will do this: serum, ableton, both, or none if it is not something done in either"),
  steps: z.array(z.object({
    title: z.string().describe("the step, as a short instruction or question, under twelve words"),
    find: z.string().describe("a few search words that would find the passages this step needs"),
    kind: z.enum(STEP_KINDS).describe("idea: understanding; maths: a formula from a book, explained; recipe: doing it in the tool"),
  })),
});
export type PlanModel = z.infer<typeof PlanModelSchema>;

export interface Plan { covered: boolean; title: string; tool: Tool; steps: PlanStep[]; remembered?: boolean }

export const WalkRequestSchema = z.discriminatedUnion("kind", [
  z.object({ kind: z.literal("plan"), question: z.string().trim().min(3).max(600), fresh: z.boolean().optional() }),
  z.object({
    kind: z.literal("step"), question: z.string().trim().min(3).max(600), title: z.string().max(160), tool: z.enum(TOOLS),
    steps: z.array(StepSchema).min(1).max(MAX_STEPS + 1), index: z.number().int().min(0).max(MAX_STEPS), fresh: z.boolean().optional(),
  }),
  // "Draw this": the step as it was written (with its labels), so a drawing can be chosen for it
  z.object({ kind: z.literal("draw"), question: z.string().trim().min(3).max(600), step: z.string().trim().min(3).max(160), text: z.string().trim().min(10).max(MAX_DRAW_TEXT), fresh: z.boolean().optional() }),
]);
export type WalkRequest = z.infer<typeof WalkRequestSchema>;

export const PLAN_SYSTEM = `You plan step-by-step walkthroughs for one learner, a beginner, in a private app that teaches sound synthesis, Serum 2 and Ableton Live. You are given a how-to question and passages found in the app's library (manuals, books and research papers). Plan a walkthrough that could be written from texts like these.

- Between ${MIN_STEPS} and ${MAX_STEPS - 1} steps, in the order a beginner should take them: understand first, then do. Each step is one thing.
- If a passage holds a formula the learner needs, give it a step of its own with kind "maths", placed before the step that uses it.
- End with one step of kind "recipe": doing it in Serum 2 or Ableton Live, whichever the question is about (if it names neither, choose the one where it is done most directly; "both" only if it truly needs both). Set tool to "none", with no recipe step, only when the subject is not something done in either, such as placing loudspeakers.
- "find" is search words for that step alone, using the words the texts themselves would use.
- Plan only what the passages give reason to think the library covers. If they do not cover the question at all, set covered to false.`;

/** The words that open each paragraph of a step. The model writes them; code reads them and then checks them. */
export const TAGS = ["DO", "TEXT", "SYNTHESIS", "DISAGREE", "MATHS", "RECIPE", "MISSING"] as const;
export type Tag = (typeof TAGS)[number];

export const STEP_SYSTEM = `You are the guide in a private app that teaches sound synthesis, Serum 2 and Ableton Live to one learner, who is a beginner. You speak in one consistent voice: warm, direct, plain words, no hype. You are writing ONE step of a step-by-step walkthrough, using only the documents supplied with it: pages from the manuals, books and papers in the app's library. Quote-level citations are attached automatically to what you draw from them.

Write the step as short paragraphs separated by blank lines. Begin every paragraph with one of these labels, in capitals, followed by a colon:

DO: one or two sentences saying what the learner does or comes to understand in this step. Always first.
TEXT: what a document says, close to its own words. Name the book. Use one TEXT paragraph per book, so it is always clear which book said what.
SYNTHESIS: your own joining-up: how the texts fit together, what follows from them, how a book's idea carries over to the learner's tool, or a value you chose. Anything that is your inference and not a statement in a document goes here, never under TEXT.
DISAGREE: use this whenever two documents differ: in what they claim, in the names they use for the same thing, in the units or conventions they use (decibels against plain ratios, hertz against radians per second, a filter's order against its slope, time against samples). Say what each says and do not blend them into one statement. Leave it out when the documents agree.
MATHS: a formula a document gives, written exactly as the document writes it. Then, in plain words: what every symbol stands for and its unit, and what the formula tells you in one sentence. Give a worked example only with numbers the document itself supplies; otherwise say that the document gives none. Use this only when a document actually gives a formula.
RECIPE: numbered steps (1., 2., 3., each on its own line) to do this in the tool, using control names exactly as that product's manual prints them. Describe only controls the supplied manual pages describe.
MISSING: what this step needs that the documents do not cover. Say it plainly and do not fill the gap from memory.

Rules:
- Do not state numbers, settings, menu items or behaviour that no document states, except inside SYNTHESIS, where you must say that it is your own choice.
- Do not carry a statement from one product's manual over to another product. Knowledge cards are drafts written for this app; a product's manual is the authority on that product.
- Define a term the first time you use it. Keep the whole step under about 220 words unless a recipe needs more.
- Use no Markdown: no asterisks, no bullet symbols, no headings, no tables.
- If the documents give nothing at all for this step, write only a MISSING paragraph.`;

const KIND_NOTE: Record<PlanStep["kind"], string> = {
  idea: "This step is about understanding. Use DO, TEXT and SYNTHESIS, and DISAGREE if the documents differ.",
  maths: "This step is about a formula. Give it under MATHS and explain it; say under SYNTHESIS what it means for the learner in practice.",
  recipe: "This is the last step: doing it in the tool. Give the RECIPE from the manual pages supplied. Under SYNTHESIS, say which earlier idea or formula each setting comes from, and mark any value you chose yourself as your own choice.",
};
/** The text sent with the documents for one step. */
export function stepPrompt(question: string, plan: { title: string; tool: Tool; steps: PlanStep[] }, index: number): string {
  const step = plan.steps[index]!;
  return `The learner asked: ${question}\n\nThe walkthrough, "${plan.title}", has these steps:\n${plan.steps.map((s, i) => `${i + 1}. ${s.title}`).join("\n")}\n\nWrite step ${index + 1} only: ${step.title}\n${KIND_NOTE[step.kind]}${step.kind === "recipe" && plan.tool !== "none" ? ` The tool is ${TOOL_NAMES[plan.tool]}.` : ""}`;
}

const tidy = (text: string) => text.replace(/\s+/g, " ").trim();
/**
 * A plan made safe to use: titles tidied, steps capped, and the rule that a walkthrough ends in the
 * learner's tools enforced by code. If the model named a tool but left the recipe out, or put it anywhere
 * but last, the recipe is moved or added here.
 */
export function cleanPlan(question: string, raw: PlanModel): Plan {
  const tool: Tool = TOOLS.includes(raw.tool) ? raw.tool : "none";
  let steps = raw.steps.map((s) => ({ title: tidy(s.title).slice(0, 90), find: tidy(s.find).slice(0, 160), kind: s.kind })).filter((s) => s.title.length >= 3 && s.find.length >= 2);
  const recipes = steps.filter((s) => s.kind === "recipe");
  steps = steps.filter((s) => s.kind !== "recipe").slice(0, MAX_STEPS - 1);
  if (tool !== "none") steps.push(recipes.at(-1) ?? { title: `Do it in ${TOOL_NAMES[tool]}`, find: tidy(question).slice(0, 160), kind: "recipe" });
  const covered = raw.covered && steps.length >= MIN_STEPS;
  return { covered, title: tidy(raw.title).slice(0, 120) || tidy(question).slice(0, 120), tool, steps: covered ? steps : [] };
}

/** The search for one step: its own words, and for a recipe only the tool's own manual. */
export function stepSearch(question: string, plan: { tool: Tool; steps: PlanStep[] }, index: number): { query: string; only?: (p: Passage) => boolean } {
  const step = plan.steps[index]!;
  if (step.kind !== "recipe" || plan.tool === "none") return { query: `${step.find} ${step.title}` };
  const books = TOOL_BOOKS[plan.tool];
  return { query: `${step.find} ${step.title} ${question}`, only: (p) => books.some((b) => p.id.startsWith(`${b}#`)) };
}

/** How a paragraph of a step is shown. `synthesis` covers everything that is the guide's own. */
export type BlockKind = "do" | "text" | "synthesis" | "disagree" | "maths" | "recipe" | "missing";
export interface StepBlock {
  kind: BlockKind;
  parts: AnswerSegment[];
  /** Numbers of the sources this paragraph was drawn from. */
  sources: number[];
  /** The model presented this as something a text says, but no passage backs it, so it is shown as the guide's own. */
  demoted?: boolean;
  /** A formula or recipe with no passage behind it: shown, but flagged. */
  unsourced?: boolean;
}
export interface StepBody { covered: boolean; blocks: StepBlock[]; sources: AnswerSource[]; remembered?: boolean }

const TAG = new RegExp(`^\\s*(${TAGS.join("|")})\\s*:\\s*`);
const KIND: Record<Tag, BlockKind> = { DO: "do", TEXT: "text", SYNTHESIS: "synthesis", DISAGREE: "disagree", MATHS: "maths", RECIPE: "recipe", MISSING: "missing" };
/**
 * The step's paragraphs with their labels. The label the model wrote is a claim; the citations are the
 * evidence. So: "the text says" needs a citation or it becomes the guide's own (and is marked as having been
 * moved); a paragraph with no label is the guide's own unless it continues a recipe or formula; a formula or
 * recipe without a citation is kept but flagged.
 */
export function labelBlocks(segments: AnswerSegment[]): StepBlock[] {
  const out: StepBlock[] = [];
  let last: BlockKind | undefined;
  for (const p of toParagraphs(segments)) {
    // toParagraphs lifts "Side note:" and headings; a step uses neither, so put the words back as plain text
    const parts = p.heading ? [{ text: `${p.heading}. `, sources: [] }, ...p.parts] : p.parts;
    if (!parts.length) continue;
    const m = TAG.exec(parts[0]!.text);
    const said: BlockKind | undefined = m ? KIND[m[1] as Tag] : undefined;
    const rest = (m ? [{ ...parts[0]!, text: parts[0]!.text.slice(m[0].length) }, ...parts.slice(1)] : parts).filter((x) => x.text.trim());
    if (!rest.length) { if (said) last = said; continue; }
    const sources = [...new Set(rest.flatMap((x) => x.sources))].sort((a, b) => a - b), cited = sources.length > 0;
    let kind: BlockKind = said ?? (last === "recipe" || last === "maths" ? last : "synthesis");
    const block: StepBlock = { kind, parts: rest, sources };
    if (kind === "text" && !cited) { kind = "synthesis"; block.kind = kind; block.demoted = true; }
    if ((kind === "maths" || kind === "recipe" || kind === "disagree") && !cited) block.unsourced = true;
    out.push(block);
    last = said ?? last;
  }
  return out;
}

export type PlanCall = (args: { question: string; passages: Passage[] }) => Promise<PlanModel | undefined>;
export type StepCall = (args: { prompt: string; passages: Passage[] }) => Promise<ModelBlock[]>;
export const WALK_MIN_SCORE = 2;

export async function makePlan(question: string, hits: Hit[], call: PlanCall): Promise<Plan> {
  const none: Plan = { covered: false, title: "", tool: "none", steps: [] };
  const relevant = hits.filter((h) => h.score >= WALK_MIN_SCORE);
  if (!relevant.length) return none;
  const raw = await call({ question, passages: relevant.map((h) => h.passage) });
  return raw ? cleanPlan(question, raw) : none;
}

export async function writeStep(prompt: string, hits: Hit[], call: StepCall): Promise<StepBody> {
  const relevant = hits.filter((h) => h.score >= WALK_MIN_SCORE);
  // nothing in the library for this step: say so, with no call and no guess
  if (!relevant.length) return { covered: false, blocks: [], sources: [] };
  const passages = relevant.map((h) => h.passage);
  const blocks = await call({ prompt, passages });
  if (!blocks.map((b) => b.text).join("").trim()) return { covered: false, blocks: [], sources: [] };
  const { segments, sources } = cite(blocks, passages);
  const labelled = labelBlocks(segments);
  return { covered: labelled.some((b) => b.kind !== "missing"), blocks: labelled, sources };
}

/** A step as plain text (for "Show me where", which wants to know what the learner was told). */
export const stepText = (body: StepBody) => body.blocks.map((b) => b.parts.map((p) => p.text).join("")).join("\n\n").trim();

const SAID: Record<BlockKind, string> = { do: "This step", text: "A text says", synthesis: "The guide's own synthesis", disagree: "The texts differ", maths: "The maths, from a text", recipe: "Recipe", missing: "Not in the library" };
/** A step as labelled plain text, for choosing a drawing: every paragraph says whose words it is. */
export const stepForDrawing = (body: StepBody) =>
  body.blocks.map((b) => `[${b.kind === "maths" && b.unsourced ? "The maths, with no text behind it" : SAID[b.kind]}] ${b.parts.map((p) => p.text).join("").trim()}`).join("\n\n").slice(0, MAX_DRAW_TEXT);
