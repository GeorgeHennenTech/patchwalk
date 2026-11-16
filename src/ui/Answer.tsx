import { createContext, useContext, useState } from "react";
import { LESSONS, placeOf } from "../course/lessons";
import { relatedLessons } from "../course/related";
import { askGuide, type AskOutcome } from "../guide/ask";
import { pointAt, type PointOutcome } from "../guide/point";
import { layoutMarks } from "../library/point";
import { answerText, layout } from "../library/answer";
import { Badge } from "./Badge";

/** The answer is shown as plain text, so any Markdown marks the model slips in are removed. */
export const plain = (text: string) => text.replace(/\*\*|__|^#{1,6} /gm, "");

/** Lets an answer send the learner to a practice lesson. Provided by the app; absent in tests. */
export const OpenLesson = createContext<(id: string) => void>(() => {});

/** One question to check understanding: the answer stays hidden until asked for. */
function CheckYourself({ question, answer }: { question: string; answer: string }) {
  const [shown, setShown] = useState(false);
  return (
    <div className="answer-check">
      <p><strong>Check yourself:</strong> {plain(question)}</p>
      {shown ? <p className="answer-check-a">{plain(answer)}</p> : <button className="link" onClick={() => setShown(true)}>Show the answer</button>}
    </div>
  );
}

export function Answer({ outcome, question, onAsk }: { outcome: AskOutcome; question?: string; /** asks a follow-up; without it the suggestions are not offered */ onAsk?: (q: string) => void }) {
  const open = useContext(OpenLesson);
  const lessons = question ? relatedLessons(question, LESSONS) : [];
  if (outcome.kind === "unavailable") return <p className="banner">{outcome.message}</p>;
  const a = outcome.answer;
  if (!a.covered) return <p><Badge kind="unknown">not in the library</Badge> The library does not cover this yet, so the guide will not guess. Adding a text on the subject would let it answer.</p>;
  return (
    <>
      {/* The steps go in the main column. A side note is not one of the steps, so it sits apart: a patch
          stitched on in the free space to the right (underneath on a narrow screen). */}
      {(() => {
        const laid = layout(a.segments), paragraphs = laid.paragraphs;
        const text = (p: (typeof paragraphs)[number]) => p.parts.map((s, j) => (
          <span key={j} className={s.sources.length ? "" : "uncited"} title={s.sources.length ? undefined : "This part was not drawn from a library passage."}>
            {plain(s.text)}{s.sources.map((n) => <sup key={n}>{n}</sup>)}
          </span>
        ));
        const notes = paragraphs.filter((p) => p.aside && p.parts.length > 0);
        return (
          <div className={`answer-body${notes.length ? " with-notes" : ""}`}>
            <div className="answer-main">
              {laid.lead && <p className="answer answer-lead">{text(laid.lead)}</p>}
              {paragraphs.filter((p) => !p.aside).map((p, k) => (
                <div key={k} className="answer-block">
                  {p.heading && <h5 className="answer-heading">{p.heading}</h5>}
                  {p.parts.length > 0 && <p className="answer">{text(p)}</p>}
                </div>
              ))}
              {laid.check && <CheckYourself key={laid.check.question} question={laid.check.question} answer={laid.check.answer} />}
              {onAsk && laid.deeper.length > 0 && (
                <div className="answer-deeper"><strong>Go deeper:</strong> {laid.deeper.map((q) => <button key={q} onClick={() => onAsk(q)}>{plain(q)}</button>)}</div>
              )}
            </div>
            {notes.length > 0 && (
              <div className="answer-notes">
                {notes.map((p, k) => (
                  <aside key={k} className="side-note" aria-label="Side note">
                    <div className="side-note-inner"><span className="side-note-tag">Side note</span><p>{text(p)}</p></div>
                  </aside>
                ))}
              </div>
            )}
          </div>
        );
      })()}
      {(() => { const l = layout(a.segments); return [...(l.lead ? [l.lead] : []), ...l.paragraphs].some((p) => p.parts.some((s) => !s.sources.length && s.text.trim().length > 40)); })() && <p className="note">Greyed text is the guide’s own wording without a source passage. Treat it with more care than the cited parts.</p>}
      {/* Every cited page that has pictures shows them, always in view: code decides this, not the model. */}
      {a.sources.some((s) => s.images?.length) && (
        <div className="answer-pictures">
          {a.sources.flatMap((s) => (s.images ?? []).map((im) => <SourceImage key={`${s.n}-${im.file}`} im={im} from={`${s.source}${s.page ? `, page ${s.page}` : ""}`} question={question} answer={answerText(a)} />))}
        </div>
      )}
      <details className="sources-fold">
        <summary>Where this comes from ({a.sources.length} {a.sources.length === 1 ? "source" : "sources"})</summary>
        <ol className="sources">
          {a.sources.map((s) => (
            <li key={s.n}><strong>{s.source}</strong>{s.page ? `, page ${s.page}` : ""} · {s.section}
              {s.quotes.slice(0, 2).map((q) => <blockquote key={q}>{q.length > 260 ? q.slice(0, 260) + "…" : q}</blockquote>)}
            </li>
          ))}
        </ol>
      </details>
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
export function SourceImage({ im, from, question, answer }: { im: { book: string; file: string; width: number; height: number }; from: string; question?: string; answer?: string }) {
  const [state, setState] = useState<PointOutcome | "busy">();
  // a picture that is no longer in the library (an answer remembered from before it was removed) is not shown
  const [gone, setGone] = useState(false);
  const src = `/api/image?book=${im.book}&file=${im.file}`;
  const done = state && state !== "busy" && state.kind === "ok" ? state : undefined;
  const failed = state && state !== "busy" && state.kind === "unavailable" ? state : undefined;
  const go = async (fresh = false) => { if (!question) return; setState("busy"); setState(await pointAt(im.book, im.file, question, answer, fresh)); };
  if (gone) return null;
  return (
    <figure className="source-image">
      <div className="marked">
        <a href={src} target="_blank" rel="noreferrer"><img src={src} width={im.width} height={im.height} loading="lazy" alt={`Picture from ${from}`} onError={() => setGone(true)} /></a>
        {done?.marks.map((m) => <span key={m.n} className="mark" style={{ left: `${m.x * 100}%`, top: `${m.y * 100}%`, width: `${m.w * 100}%`, height: `${m.h * 100}%` }} aria-hidden="true" />)}
        {/* the letters are placed by code so that none covers another; one that had to move away from its box gets an arrow back to it */}
        {done && (() => {
          const placed = layoutMarks(done.marks, im.width, im.height);
          return (
            <>
              <svg className="mark-arrows" viewBox={`0 0 ${im.width} ${im.height}`} preserveAspectRatio="none" aria-hidden="true">
                <defs><marker id={`tip-${im.file}`} viewBox="0 0 10 10" refX="8" refY="5" markerWidth="7" markerHeight="7" orient="auto-start-reverse"><path d="M0 0 L10 5 L0 10 z" fill="#19e0ff" stroke="#06222b" strokeWidth="1" /></marker></defs>
                {placed.filter((p) => p.arrow).map((p) => <g key={p.n}><line className="under" x1={p.bx * im.width} y1={p.by * im.height} x2={p.arrow!.x * im.width} y2={p.arrow!.y * im.height} /><line x1={p.bx * im.width} y1={p.by * im.height} x2={p.arrow!.x * im.width} y2={p.arrow!.y * im.height} markerEnd={`url(#tip-${im.file})`} /></g>)}
              </svg>
              {placed.map((p) => <b key={p.n} className="mark-letter" style={{ left: `${p.bx * 100}%`, top: `${p.by * 100}%` }} aria-hidden="true">{p.letter}</b>)}
            </>
          );
        })()}
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
          <p className="note">The blue boxes and letters are the guide’s; anything in red is the manual’s own. The guide’s reading is not part of the manual, and its boxes can be slightly off. {done.remembered && "Shown from this device’s memory, with no new call. "}<button className="link" onClick={() => void go(true)}>Look again</button></p>
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
