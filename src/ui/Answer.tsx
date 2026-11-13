import { createContext, useContext, useState } from "react";
import { LESSONS, placeOf } from "../course/lessons";
import { relatedLessons } from "../course/related";
import { askGuide, type AskOutcome } from "../guide/ask";
import { Badge } from "./Badge";

/** The answer is shown as plain text, so any Markdown marks the model slips in are removed. */
export const plain = (text: string) => text.replace(/\*\*|__|^#{1,6} /gm, "");

/** Lets an answer send the learner to a practice lesson. Provided by the app; absent in tests. */
export const OpenLesson = createContext<(id: string) => void>(() => {});

export function Answer({ outcome, question }: { outcome: AskOutcome; question?: string }) {
  const open = useContext(OpenLesson);
  const lessons = question ? relatedLessons(question, LESSONS) : [];
  if (outcome.kind === "unavailable") return <p className="banner">{outcome.message}</p>;
  const a = outcome.answer;
  if (!a.covered) return <p><Badge kind="unknown">not in the library</Badge> The library does not cover this yet, so the guide will not guess. Adding a text on the subject would let it answer.</p>;
  return (
    <>
      <p className="answer">
        {a.segments.map((s, j) => (
          <span key={j} className={s.sources.length ? "" : "uncited"} title={s.sources.length ? undefined : "This part was not drawn from a library passage."}>
            {plain(s.text)}{s.sources.map((n) => <sup key={n}>[{n}]</sup>)}
          </span>
        ))}
      </p>
      {a.segments.some((s) => !s.sources.length && s.text.trim().length > 40) && <p className="note">Greyed text is the guide’s own wording without a source passage. Treat it with more care than the cited parts.</p>}
      <ol className="sources">
        {a.sources.map((s) => (
          <li key={s.n}><strong>{s.source}</strong>{s.page ? `, page ${s.page}` : ""} · {s.section}
            {s.quotes.slice(0, 2).map((q) => <blockquote key={q}>{q.length > 260 ? q.slice(0, 260) + "…" : q}</blockquote>)}
            {/* Every cited page that has pictures shows them: code decides this, not the model. */}
            {s.images?.map((im) => (
              <figure key={im.file} className="source-image">
                <a href={`/api/image?book=${im.book}&file=${im.file}`} target="_blank" rel="noreferrer">
                  <img src={`/api/image?book=${im.book}&file=${im.file}`} width={im.width} height={im.height} loading="lazy" alt={`Picture from ${s.source}${s.page ? `, page ${s.page}` : ""}`} />
                </a>
                <figcaption>From {s.source}{s.page ? `, page ${s.page}` : ""}. Click to enlarge.</figcaption>
              </figure>
            ))}
          </li>
        ))}
      </ol>
      {lessons.length > 0 && (
        <p className="related"><strong>Practise this:</strong>{" "}
          {lessons.map((l, i) => <span key={l.id}>{i > 0 && " or "}<button className="link" onClick={() => open(l.id)}>{l.title}</button> <span className="muted">({placeOf(l).chapter}, lesson {placeOf(l).number})</span></span>)}
        </p>
      )}
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
      {asked && <div className="askbox-turn"><p className="muted"><strong>You asked:</strong> {asked}</p>{outcome ? <Answer outcome={outcome} question={asked} /> : <p className="muted">Looking through the library…</p>}</div>}
    </div>
  );
}
