/** Renders the small subset of markdown used by knowledge cards: "## " headings and paragraphs. */
export function Markdown({ text }: { text: string }) {
  const blocks = text.split(/\n\s*\n/).map((b) => b.trim()).filter(Boolean);
  return (
    <>
      {blocks.map((b, i) => (b.startsWith("## ") ? <h5 key={i}>{b.slice(3)}</h5> : <p key={i}>{b.replace(/\n/g, " ")}</p>))}
    </>
  );
}
