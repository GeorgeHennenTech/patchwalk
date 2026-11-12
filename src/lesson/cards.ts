// Knowledge cards: short markdown files the owner writes. They are the narrator's only source for "why".
import type { RenderedStep } from "./render";

export interface Card {
  id: string;
  title: string;
  /** Stage ids this card applies to as a whole. */
  stages: string[];
  /** Fact tags (module types or param keys) this card explains. */
  appliesTo: string[];
  body: string;
  /** "draft" until the owner has reviewed the card. */
  status: string;
  /** Suggested further reading. Links are only as good as whoever added them; see `status`. */
  reading: { title: string; url: string }[];
}

function list(value: string): string[] {
  return value.replace(/^\[|\]$/g, "").split(",").map((s) => s.trim()).filter(Boolean);
}

/** Parses "---\nkey: value\n---\nbody". Returns undefined for files without front matter or an id. */
export function parseCard(markdown: string): Card | undefined {
  const m = /^---\r?\n([\s\S]*?)\r?\n---\r?\n?([\s\S]*)$/.exec(markdown);
  if (!m) return undefined;
  const meta: Record<string, string> = {};
  for (const row of m[1]!.split(/\r?\n/)) {
    const i = row.indexOf(":");
    if (i > 0) meta[row.slice(0, i).trim()] = row.slice(i + 1).trim();
  }
  if (!meta.id || !meta.title) return undefined;
  const reading = (meta.reading ?? "").split(";").map((item) => {
    const [title, url] = item.split("|").map((x) => x.trim());
    return title && url && /^https:\/\//.test(url) ? { title, url } : undefined;
  }).filter((r): r is { title: string; url: string } => !!r);
  // HTML comments (the template's instructions) are not part of the card.
  const body = m[2]!.replace(/<!--[\s\S]*?-->/g, "").trim();
  return { id: meta.id, title: meta.title, stages: list(meta.stages ?? ""), appliesTo: list(meta.applies_to ?? ""), body, status: meta.status || "draft", reading };
}

export const MAX_CARDS_PER_STEP = 2;

/** Cards whose tags match the step's facts come first; stage-wide cards fill in after. */
export function cardsFor(step: RenderedStep, cards: Card[]): Card[] {
  const tags = new Set(step.facts.flatMap((f) => f.tags));
  const byTag = cards.filter((c) => c.appliesTo.some((t) => tags.has(t)));
  const byStage = cards.filter((c) => !byTag.includes(c) && c.stages.includes(step.stage));
  return [...byTag, ...byStage].slice(0, MAX_CARDS_PER_STEP);
}
