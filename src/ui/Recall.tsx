// The end of a lesson: try to recall it first, then see the recap as the answer and mark what came back.
import { useState } from "react";
import { loadRecall, recallNote, saveRecall } from "../course/recall";

export function RecallCard({ lessonId, outcome, recap, children }: { lessonId: string; outcome: string; recap: readonly string[]; children?: React.ReactNode }) {
  const [shown, setShown] = useState(false);
  const [notes, setNotes] = useState("");
  const [had, setHad] = useState<(boolean | undefined)[]>(() => recap.map(() => undefined));
  const before = loadRecall()[lessonId];
  const mark = (i: number, v: boolean) => {
    const next = had.map((h, k) => (k === i ? (h === v ? undefined : v) : h));
    setHad(next); saveRecall(lessonId, { at: Date.now(), had: next });
  };
  if (!shown) return (
    <section className="card recall">
      <h3>Before the recap: what do you remember?</h3>
      <p>Without scrolling up, bring back the {recap.length === 1 ? "main point" : `${recap.length} main points`} of this lesson. Say them out loud, or type a few words. Getting it wrong costs nothing: trying first is what makes the answer stick.</p>
      <p className="muted">A nudge: by now you should be able to {outcome.charAt(0).toLowerCase() + outcome.slice(1)}</p>
      <textarea value={notes} onChange={(e) => setNotes(e.target.value)} rows={3} placeholder="Optional. What you type stays here and is not saved." aria-label="What you remember from this lesson" />
      <p><button className="primary" onClick={() => setShown(true)}>Show me the recap</button>{before && <span className="muted"> You have recalled this lesson before.</span>}</p>
    </section>
  );
  return (
    <section className="card recall">
      <h3>Recap</h3>
      {notes.trim() && <blockquote className="recall-mine"><strong>You wrote:</strong> {notes}</blockquote>}
      <ul className="recall-points">
        {recap.map((r, i) => (
          <li key={r} className={had[i] === true ? "had" : had[i] === false ? "missed" : ""}>
            <span>{r}</span>
            <span className="recall-marks" role="group" aria-label="Did this come back to you?">
              <button aria-pressed={had[i] === true} onClick={() => mark(i, true)}>Had it</button>
              <button aria-pressed={had[i] === false} onClick={() => mark(i, false)}>Missed it</button>
            </span>
          </li>
        ))}
      </ul>
      <p className="muted" role="status">{recallNote(had)}</p>
      {children}
    </section>
  );
}
