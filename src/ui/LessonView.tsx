import { useEffect, useMemo, useState } from "react";
import { STAGES, type Step } from "../flow/facts";
import { cardsFor, type Card } from "../lesson/cards";
import { buildRequest, fetchLessons, type LessonOutcome } from "../lesson/client";
import { DIFFICULTIES, type Difficulty } from "../lesson/contract";
import { render, type RenderedStep } from "../lesson/render";
import { diagramsFor, type Diagram } from "../flow/diagrams";
import type { ModuleNode } from "../patch/model";
import { Badge } from "./Badge";
import { DiagramView } from "./Diagrams";

const BLURB: Record<Difficulty, string> = {
  beginner: "Exact values, one idea per step.",
  intermediate: "Ranges to aim for; trust your ears.",
  advanced: "Goals only. Reveal values when you want them.",
};

type Fetch = { state: "idle" } | { state: "loading" } | { state: "done"; outcome: LessonOutcome };

function StepCard({ step, n, cards, fetchState, diagrams }: { step: RenderedStep; n: number; cards: Card[]; fetchState: Fetch; diagrams: Diagram[] }) {
  const [reveal, setReveal] = useState(false);
  const hasHidden = step.lines.some((l) => l.hidden);
  const hasCard = cardsFor(step, cards).length > 0;
  const outcome = fetchState.state === "done" && fetchState.outcome.kind === "ok" ? fetchState.outcome : undefined;
  const lesson = outcome?.lessons[step.id];
  const rejected = outcome?.rejected[step.id];

  return (
    <article className="step">
      <h4><span className="step-n">{n}</span>{step.title}</h4>
      {lesson && <p className="lead">{lesson.do}</p>}
      {step.lines.length > 0 && (!hasHidden || reveal) && (
        <ul className="lines">
          {step.lines.map((l) => (
            <li key={l.factId}>
              <span>{l.text}</span>
              {l.uninterpreted ? <Badge kind="unknown" title="The app has no interpretation for this setting. It is shown exactly as stored.">not interpreted</Badge>
                : l.unverified && <Badge kind="warn" title={l.basis ?? "This reading has not been confirmed against Serum's screen."}>unverified</Badge>}
              {l.note && <div className="line-note">{l.note}</div>}
            </li>
          ))}
        </ul>
      )}
      {hasHidden && <button className="link" onClick={() => setReveal(!reveal)}>{reveal ? "Hide values" : `Show values (${step.lines.length})`}</button>}
      {diagrams.map((d) => <DiagramView key={d.title} d={d} />)}
      {step.notes.map((note) => <p key={note} className="note">{note}</p>)}
      {step.lines.length > 0 && (
        <div className="why">
          {lesson ? (
            <>
              <p><strong>Why it works.</strong> {lesson.why}</p>
              <p><strong>Listen for.</strong> {lesson.listen_for}</p>
            </>
          ) : !hasCard ? (
            <p className="muted" title="The narrator may only explain steps that have a knowledge card. Add one in knowledge-cards/.">No explanation yet: no knowledge card covers this step.</p>
          ) : rejected ? (
            <p className="muted" title={rejected.join("\n")}>Explanation withheld: the generated text mentioned something that is not in this patch.</p>
          ) : fetchState.state === "loading" ? (
            <p className="muted">Writing the explanation…</p>
          ) : (
            <p className="muted">Explanation available. Use “Explain why” above.</p>
          )}
        </div>
      )}
    </article>
  );
}

export function LessonView({ steps, cards, presetKey, modules }: { steps: Step[]; cards: Card[]; presetKey: string; modules: ModuleNode[] }) {
  const [difficulty, setDifficulty] = useState<Difficulty>("beginner");
  const [fetches, setFetches] = useState<Partial<Record<Difficulty, Fetch>>>({});
  useEffect(() => setFetches({}), [presetKey]);

  const rendered = useMemo(() => render(steps, difficulty), [steps, difficulty]);
  const request = useMemo(() => buildRequest(rendered, cards, difficulty), [rendered, cards, difficulty]);
  const fetchState: Fetch = fetches[difficulty] ?? { state: "idle" };

  async function explain() {
    if (!request) return;
    setFetches((f) => ({ ...f, [difficulty]: { state: "loading" } }));
    const outcome = await fetchLessons(request);
    setFetches((f) => ({ ...f, [difficulty]: { state: "done", outcome } }));
  }

  // A diagram belongs to a step in the fact graph; show it once, on the first card rendered from that step.
  const diagrams = useMemo(() => {
    const byId = new Map(modules.map((m) => [m.id, m]));
    const out = new Map<string, Diagram[]>();
    const seen = new Set<string>();
    for (const r of rendered) {
      if (seen.has(r.sourceId)) continue;
      seen.add(r.sourceId);
      const src = steps.find((s) => s.id === r.sourceId);
      if (src) out.set(r.id, diagramsFor(src, byId));
    }
    return out;
  }, [rendered, steps, modules]);

  let n = 0;
  return (
    <div>
      <div className="toolbar">
        <div className="seg" role="radiogroup" aria-label="Difficulty">
          {DIFFICULTIES.map((d) => (
            <button key={d} role="radio" aria-checked={d === difficulty} className={d === difficulty ? "on" : ""} onClick={() => setDifficulty(d)}>{d}</button>
          ))}
        </div>
        <span className="muted">{BLURB[difficulty]}</span>
        <span className="spacer" />
        <button className="primary" disabled={!request || fetchState.state === "loading"} onClick={explain}
          title={request ? `Sends ${request.steps.length} steps' instructions and knowledge cards to the explanation service. The preset file is not sent.` : "No step has a knowledge card yet."}>
          {fetchState.state === "loading" ? "Explaining…" : "Explain why"}
        </button>
      </div>
      {fetchState.state === "done" && fetchState.outcome.kind === "unavailable" && (
        <p className="banner">{fetchState.outcome.message} The step list below does not need it.</p>
      )}
      {STAGES.map((stage) => {
        const mine = rendered.filter((s) => s.stage === stage.id);
        if (!mine.length) return null;
        return (
          <section key={stage.id} className="stage">
            <h3>{stage.title} <small>{stage.blurb}</small></h3>
            {mine.map((s) => <StepCard key={s.id + difficulty} step={s} n={++n} cards={cards} fetchState={fetchState} diagrams={diagrams.get(s.id) ?? []} />)}
          </section>
        );
      })}
    </div>
  );
}
