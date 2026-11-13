export type Block = { kind: "heading" | "para"; text: string };

/**
 * Splits the small subset of markdown used by knowledge cards into headings and paragraphs.
 * A "## Heading" line is always its own block, whether or not a blank line follows it.
 */
export function parseBlocks(text: string): Block[] {
  const out: Block[] = [];
  let para: string[] = [];
  const flush = () => { if (para.length) { out.push({ kind: "para", text: para.join(" ") }); para = []; } };
  for (const raw of text.split(/\r?\n/)) {
    const line = raw.trim();
    if (line.startsWith("## ")) { flush(); out.push({ kind: "heading", text: line.slice(3).trim() }); }
    else if (!line) flush();
    else para.push(line);
  }
  flush();
  return out;
}

export function Markdown({ text }: { text: string }) {
  return <>{parseBlocks(text).map((b, i) => (b.kind === "heading" ? <h5 key={i}>{b.text}</h5> : <p key={i}>{b.text}</p>))}</>;
}
