import { useState } from "react";
import { askGuide, type AskOutcome } from "../guide/ask";
import { Answer } from "./Answer";

const EXAMPLES = ["What does the FAT knob do on the filter?", "How do I assign an LFO to a knob?", "What is the difference between FREE and RETRIG?", "Why do detuned oscillators sound like they are moving?"];

type Turn = { question: string; outcome?: AskOutcome };

export function AskView() {
  const [question, setQuestion] = useState("");
  const [turns, setTurns] = useState<Turn[]>([]);
  const busy = turns.some((t) => !t.outcome);

  async function ask(q: string) {
    const text = q.trim();
    if (text.length < 3 || busy) return;
    setQuestion("");
    setTurns((t) => [{ question: text }, ...t]);
    const outcome = await askGuide(text);
    setTurns((t) => t.map((turn) => (turn.question === text && !turn.outcome ? { ...turn, outcome } : turn)));
  }

  return (
    <section className="panel ask">
      <h2>Ask the guide</h2>
      <p className="muted">
        Answers come from the library: the Serum 2 User Guide and this app’s knowledge cards. Every claim shows the page it came from.
        If the library does not cover something, the guide says so instead of guessing. Each question is one paid Claude call.
      </p>
      <form onSubmit={(e) => { e.preventDefault(); void ask(question); }}>
        <input value={question} onChange={(e) => setQuestion(e.target.value)} maxLength={600} placeholder="Ask about synthesis or how something works in Serum 2" aria-label="Your question" />
        <button className="primary" disabled={busy || question.trim().length < 3}>{busy ? "Thinking…" : "Ask"}</button>
      </form>
      {turns.length === 0 && (
        <div className="examples">
          {EXAMPLES.map((e) => <button key={e} className="link" onClick={() => void ask(e)}>{e}</button>)}
        </div>
      )}
      {turns.map((t, i) => (
        <article key={turns.length - i} className="step turn">
          <h4>{t.question}</h4>
          {!t.outcome && <p className="muted">Looking through the library…</p>}
          {t.outcome && <Answer outcome={t.outcome} />}
        </article>
      ))}
    </section>
  );
}
