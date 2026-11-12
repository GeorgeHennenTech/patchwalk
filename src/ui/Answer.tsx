import { useState } from "react";
import { askGuide, type AskOutcome } from "../guide/ask";
import { Badge } from "./Badge";

export function Answer({ outcome }: { outcome: AskOutcome }) {
  if (outcome.kind === "unavailable") return <p className="banner">{outcome.message}</p>;
  const a = outcome.answer;
  if (!a.covered) return <p><Badge kind="unknown">not in the library</Badge> The library does not cover this yet, so the guide will not guess. Adding a text on the subject would let it answer.</p>;
  return (
    <>
      <p className="answer">
        {a.segments.map((s, j) => (
          <span key={j} className={s.sources.length ? "" : "uncited"} title={s.sources.length ? undefined : "This part was not drawn from a library passage."}>
            {s.text}{s.sources.map((n) => <sup key={n}>[{n}]</sup>)}
          </span>
        ))}
      </p>
      {a.segments.some((s) => !s.sources.length && s.text.trim().length > 40) && <p className="note">Greyed text is the guide’s own wording without a source passage. Treat it with more care than the cited parts.</p>}
      <ol className="sources">
        {a.sources.map((s) => (
          <li key={s.n}><strong>{s.source}</strong>{s.page ? `, page ${s.page}` : ""} · {s.section}
            {s.quotes.slice(0, 2).map((q) => <blockquote key={q}>{q.length > 260 ? q.slice(0, 260) + "…" : q}</blockquote>)}
          </li>
        ))}
      </ol>
    </>
  );
}

/** A small "ask about this" box. `context` tells the guide what the learner is looking at; its first line is the topic. */
export function AskBox({ context, placeholder }: { context: string; placeholder: string }) {
  const [q, setQ] = useState("");
  const [asked, setAsked] = useState<string>();
  const [outcome, setOutcome] = useState<AskOutcome>();
  const busy = !!asked && !outcome;
  async function go() {
    const text = q.trim();
    if (text.length < 3 || busy) return;
    setAsked(text); setOutcome(undefined); setQ("");
    setOutcome(await askGuide(text, context));
  }
  return (
    <div className="askbox">
      <form onSubmit={(e) => { e.preventDefault(); void go(); }}>
        <input value={q} onChange={(e) => setQ(e.target.value)} maxLength={600} placeholder={placeholder} aria-label="Ask the guide" />
        <button className="primary" disabled={busy || q.trim().length < 3}>{busy ? "Thinking…" : "Ask the guide"}</button>
      </form>
      {asked && <div className="askbox-turn"><p className="muted"><strong>You asked:</strong> {asked}</p>{outcome ? <Answer outcome={outcome} /> : <p className="muted">Looking through the library…</p>}</div>}
    </div>
  );
}
