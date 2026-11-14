// The end of a lesson, in three parts: type what you remember; a short quiz on the lesson, checked only
// once every question is answered; then the recap, with the points the quiz showed as shaky marked.
import { useMemo, useState } from "react";
import { pointsHad, QUIZ, shuffled } from "../course/quiz";
import { loadRecall, recallNote, saveRecall } from "../course/recall";

export function RecallCard({ lessonId, outcome, recap, children }: { lessonId: string; outcome: string; recap: readonly string[]; children?: React.ReactNode }) {
  const items = QUIZ[lessonId] ?? [];
  const [stage, setStage] = useState<"write" | "quiz" | "checked" | "recap">("write");
  const [notes, setNotes] = useState("");
  const [chosen, setChosen] = useState<(number | undefined)[]>(() => items.map(() => undefined));
  const [seed] = useState(() => Math.floor(Math.random() * 1e6));
  const orders = useMemo(() => items.map((it, i) => shuffled(it.options.length, seed + i * 7919)), [items, seed]);
  const before = loadRecall()[lessonId];
  const right = items.filter((it, i) => chosen[i] === it.answer).length, answered = chosen.filter((c) => c !== undefined).length;
  const had = pointsHad(items, chosen, recap.length);
  const check = () => { saveRecall(lessonId, { at: Date.now(), had }); setStage("checked"); };
  const mine = notes.trim() && <blockquote className="recall-mine"><strong>You wrote:</strong> {notes}</blockquote>;

  if (stage === "write") return (
    <section className="card recall">
      <p className="recall-step">Part 1 of 3</p>
      <h3>What do you remember?</h3>
      <p>Without scrolling up, type what this lesson taught you, in your own words. A few lines is plenty. Getting it wrong costs nothing: trying first is what makes it stick.</p>
      <p className="muted">A nudge: by now you should be able to {outcome.charAt(0).toLowerCase() + outcome.slice(1)}</p>
      <textarea value={notes} onChange={(e) => setNotes(e.target.value)} rows={4} placeholder="Type what you remember. It stays on this page and is not saved." aria-label="What you remember from this lesson" />
      <p><button className="primary" onClick={() => setStage(items.length ? "quiz" : "recap")}>{items.length ? "On to the quiz" : "Show me the recap"}</button>{before && <span className="muted"> You have done this lesson’s recall before.</span>}</p>
    </section>
  );
  if (stage === "quiz" || stage === "checked") {
    const done = stage === "checked";
    return (
      <section className="card recall">
        <p className="recall-step">Part 2 of 3</p>
        <h3>{done ? `Quiz: ${right} of ${items.length} right` : "Quiz"}</h3>
        {!done && <p className="muted">{items.length} questions on this lesson. Answer them all, then they are checked together.</p>}
        {done && mine}
        <ol className="quiz">
          {items.map((it, i) => (
            <li key={it.q} className={done ? (chosen[i] === it.answer ? "right" : "missed") : ""}>
              <p className="quiz-q">{it.q}</p>
              <div className="quiz-options" role="radiogroup" aria-label={it.q}>
                {orders[i]!.map((o) => (
                  <button key={o} role="radio" aria-checked={chosen[i] === o} disabled={done}
                    className={`${chosen[i] === o ? "on" : ""}${done && o === it.answer ? " correct" : ""}${done && chosen[i] === o && o !== it.answer ? " not" : ""}`}
                    onClick={() => setChosen(chosen.map((c, k) => (k === i ? o : c)))}>
                    {done && o === it.answer && <span aria-hidden="true">✓ </span>}{it.options[o]}{done && chosen[i] === o && o !== it.answer && <span className="quiz-yours"> (your answer)</span>}
                  </button>
                ))}
              </div>
              {done && <p className="quiz-why">{it.why}</p>}
            </li>
          ))}
        </ol>
        {!done && <p><button className="primary" disabled={answered < items.length} onClick={check}>Check my answers</button> <span className="muted">{answered < items.length ? `${answered} of ${items.length} answered` : "All answered."}</span> <button className="link" onClick={() => setStage("recap")}>Skip to the recap</button></p>}
        {done && <p><button className="primary" onClick={() => setStage("recap")}>Show me the recap</button></p>}
      </section>
    );
  }
  const quizzed = had.some((h) => h !== undefined) && answered === items.length;
  return (
    <section className="card recall">
      <p className="recall-step">Part 3 of 3</p>
      <h3>Recap</h3>
      {mine}
      <ul className="recall-points">
        {recap.map((r, i) => (
          <li key={r} className={quizzed ? (had[i] === true ? "had" : had[i] === false ? "missed" : "") : ""}>
            <span>{r}</span>
            {quizzed && had[i] !== undefined && <span className="recall-tag">{had[i] ? "you had this" : "read this one again"}</span>}
          </li>
        ))}
      </ul>
      {quizzed && <p className="muted" role="status">{recallNote(had)}</p>}
      {children}
    </section>
  );
}
