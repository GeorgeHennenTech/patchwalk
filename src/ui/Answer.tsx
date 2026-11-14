import { createContext, useContext, useState } from "react";
import { LESSONS, placeOf } from "../course/lessons";
import { relatedLessons } from "../course/related";
import { askGuide, type AskOutcome } from "../guide/ask";
import { pointAt, type PointOutcome } from "../guide/point";
import { answerText, toParagraphs } from "../library/answer";
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
      {/* one block per paragraph; a side note is boxed and labelled so it is not read as one of the steps */}
      {toParagraphs(a.segments).map((p, k) => (
        <div key={k} className="answer-block">
        {p.heading && <h5 className="answer-heading">{p.heading}</h5>}
        {p.parts.length > 0 && <p className={`answer${p.aside ? " aside" : ""}`}>
          {p.aside && <strong className="aside-label">Side note</strong>}
          {p.parts.map((s, j) => (
            <span key={j} className={s.sources.length ? "" : "uncited"} title={s.sources.length ? undefined : "This part was not drawn from a library passage."}>
              {plain(s.text)}{s.sources.map((n) => <sup key={n}>[{n}]</sup>)}
            </span>
          ))}
        </p>}
        </div>
      ))}
      {a.segments.some((s) => !s.sources.length && s.text.trim().length > 40) && <p className="note">Greyed text is the guide’s own wording without a source passage. Treat it with more care than the cited parts.</p>}
      <ol className="sources">
        {a.sources.map((s) => (
          <li key={s.n}><strong>{s.source}</strong>{s.page ? `, page ${s.page}` : ""} · {s.section}
            {s.quotes.slice(0, 2).map((q) => <blockquote key={q}>{q.length > 260 ? q.slice(0, 260) + "…" : q}</blockquote>)}
            {/* Every cited page that has pictures shows them: code decides this, not the model. */}
            {s.images?.map((im) => <SourceImage key={im.file} im={im} from={`${s.source}${s.page ? `, page ${s.page}` : ""}`} question={question} answer={answerText(a)} />)}
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

/**
 * One picture from a cited page. "Show me where" asks the guide what the picture shows and to mark the
 * places in it that matter for the question (one paid call, remembered on this device afterwards). Marks
 * are lettered, because manuals often print numbers of their own on a picture. They are the guide's
 * pointing, not the manual's, and are labelled as such.
 */
function SourceImage({ im, from, question, answer }: { im: { book: string; file: string; width: number; height: number }; from: string; question?: string; answer?: string }) {
  const [state, setState] = useState<PointOutcome | "busy">();
  const src = `/api/image?book=${im.book}&file=${im.file}`;
  const done = state && state !== "busy" && state.kind === "ok" ? state : undefined;
  const failed = state && state !== "busy" && state.kind === "unavailable" ? state : undefined;
  const go = async (fresh = false) => { if (!question) return; setState("busy"); setState(await pointAt(im.book, im.file, question, answer, fresh)); };
  return (
    <figure className="source-image">
      <div className="marked">
        <a href={src} target="_blank" rel="noreferrer"><img src={src} width={im.width} height={im.height} loading="lazy" alt={`Picture from ${from}`} /></a>
        {done?.marks.map((m) => <span key={m.n} className="mark" style={{ left: `${m.x * 100}%`, top: `${m.y * 100}%`, width: `${m.w * 100}%`, height: `${m.h * 100}%` }} aria-hidden="true"><b>{m.letter}</b></span>)}
      </div>
      <figcaption>From {from}. Click the picture to enlarge it.</figcaption>
      {question && !done && <p className="point-row"><button className="point-button" disabled={state === "busy"} onClick={() => void go()}>{state === "busy" ? "Looking at the picture…" : "Show me where"}</button> <span className="muted">The guide explains this picture and marks what to look at. One paid call.</span></p>}
      {failed && <p className="note">{failed.message}</p>}
      {done && (
        <div className="pointed">
          {done.about && <p className="about">{done.about}</p>}
          {done.marks.length > 0
            ? <ol className="mark-list" type="A">{done.marks.map((m) => <li key={m.n}>{m.label}</li>)}</ol>
            : <p className="note">The guide marked nothing in this picture for your question.</p>}
          <p className="note">This is the guide’s own reading of the picture, not part of the manual, and its boxes can be slightly off. {done.remembered && "Shown from this device’s memory, with no new call. "}<button className="link" onClick={() => void go(true)}>Look again</button></p>
        </div>
      )}
    </figure>
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
