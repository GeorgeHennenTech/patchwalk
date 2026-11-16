// "Walk me through it": a how-to question answered as steps, one at a time. Each paragraph of a step wears a
// label saying whose words it is: the texts' (with the books named), or the guide's own joining-up. Code
// decides the label from the citations, not the guide. Formulas are kept as a reference and explained, and
// the last step is a recipe in the learner's own tool.
import { useEffect, useRef, useState } from "react";
import { deleteWalk, doneCount, loadWalks, newWalk, planWalk, saveWalk, walkStep, type Walk } from "../guide/walk";
import { stepText, TOOL_NAMES, type BlockKind, type StepBlock, type StepBody } from "../library/walk";
import { plain, SourceImage } from "./Answer";
import { Badge } from "./Badge";

const EXAMPLES = ["How do I make a plucked sound with a filter envelope?", "How do I set up sidechain compression on a bass?", "How do I make a vibrato that fades in?", "How do I use FM to make a bell-like tone?"];

const LABEL: Record<BlockKind, string> = { do: "This step", text: "The text says", synthesis: "My synthesis", disagree: "The texts differ", maths: "The maths", recipe: "Recipe", missing: "Not in the library" };

/** The books a paragraph was drawn from, by name and page. */
function from(block: StepBlock, body: StepBody): string {
  const named = block.sources.map((n) => body.sources.find((s) => s.n === n)).filter((s) => !!s).map((s) => `${s!.source}${s!.page ? `, page ${s!.page}` : ""}`);
  return [...new Set(named)].join("; ");
}

function Block({ block, body, tool }: { block: StepBlock; body: StepBody; tool: string }) {
  const where = from(block, body);
  const label = block.kind === "recipe" && tool ? `In ${tool}` : LABEL[block.kind];
  return (
    <div className={`walk-block walk-${block.kind}`}>
      {block.kind !== "do" && (
        <p className="walk-label">
          <span className="walk-tag">{label}</span>
          {block.kind === "text" && where && <span className="walk-from"> {where}</span>}
          {block.kind === "synthesis" && <span className="walk-from"> {block.demoted ? "the guide offered this as something a text says, but no passage backs it, so treat it as the guide’s own" : where ? `the guide’s own reasoning, built on ${where}` : "the guide’s own reasoning, not a statement from a text"}</span>}
          {(block.kind === "maths" || block.kind === "recipe" || block.kind === "disagree") && <span className="walk-from"> {block.unsourced ? "no passage backs this: check it before relying on it" : `from ${where}`}</span>}
        </p>
      )}
      <p className="walk-words">
        {block.parts.map((s, j) => (
          <span key={j} className={block.kind !== "synthesis" && block.kind !== "do" && block.kind !== "missing" && !s.sources.length ? "uncited" : ""} title={block.kind !== "synthesis" && block.kind !== "do" && block.kind !== "missing" && !s.sources.length ? "This part was not drawn from a library passage." : undefined}>
            {plain(s.text)}{s.sources.map((n) => <sup key={n}>{n}</sup>)}
          </span>
        ))}
      </p>
    </div>
  );
}

export function WalkView({ question, setQuestion }: { question: string; setQuestion: (q: string) => void }) {
  const [walks, setWalks] = useState<Walk[]>(() => loadWalks());
  const [walk, setWalk] = useState<Walk>();
  const [busy, setBusy] = useState<"plan" | "step">();
  const [note, setNote] = useState<string>();
  const asked = useRef(new Set<string>());

  const keep = (w: Walk) => { setWalk(w); setWalks(saveWalk(w)); };
  async function start(q: string, fresh = false) {
    const text = q.trim();
    if (text.length < 3 || busy) return;
    setNote(undefined); setBusy("plan"); setWalk(undefined); setQuestion("");
    const out = await planWalk(text, fresh);
    setBusy(undefined);
    if (out.kind === "unavailable") { setNote(out.message); return; }
    if (!out.value.covered) { setNote("not-covered"); return; }
    keep(newWalk(text, out.value));
  }
  // The step the learner is on is written when they reach it (one paid call), and kept with the walkthrough.
  const current = walk?.steps[walk.at];
  useEffect(() => {
    if (!walk || !current || current.body) return;
    const key = `${walk.id}:${walk.at}`;
    if (asked.current.has(key)) return;
    asked.current.add(key);
    let gone = false;
    setBusy("step"); setNote(undefined);
    void walkStep(walk, walk.at).then((out) => {
      if (gone) return;
      setBusy(undefined);
      if (out.kind === "unavailable") { setNote(out.message); asked.current.delete(key); return; }
      // the walkthrough may have moved on while this was being written, so put it in the newest copy
      setWalk((w) => { if (!w || w.id !== walk.id) return w; const next = { ...w, steps: w.steps.map((s, i) => (i === walk.at ? { ...s, body: out.value } : s)) }; setWalks(saveWalk(next)); return next; });
    });
    return () => { gone = true; asked.current.delete(key); setBusy(undefined); };
  }, [walk?.id, walk?.at, current?.body]); // eslint-disable-line react-hooks/exhaustive-deps

  const go = (at: number) => walk && keep({ ...walk, at: Math.max(0, Math.min(walk.steps.length - 1, at)) });
  const tick = () => { if (!walk) return; const steps = walk.steps.map((s, i) => (i === walk.at ? { ...s, done: true } : s)); keep({ ...walk, steps, at: Math.min(walk.steps.length - 1, walk.at + 1) }); };
  const body = current?.body, tool = walk ? TOOL_NAMES[walk.tool] : "";
  const finished = !!walk && doneCount(walk) === walk.steps.length;

  return (
    <>
      <p className="muted">
        Ask how to do something and the guide lays it out as steps, one at a time, written from every book in the library that covers it. Each part is labelled as what a text says or as the guide’s own joining-up, and it ends with a recipe in Serum 2 or Ableton Live.
        One paid Claude call for the outline, and one for each step you open. Walkthroughs are kept in this browser.
      </p>
      {walks.length > 0 && (
        <details className="saved-chats">
          <summary>Your walkthroughs ({walks.length})</summary>
          <ul>
            {walks.map((w) => (
              <li key={w.id}>
                <button className="link" onClick={() => { setNote(undefined); setWalk(w); }}>{w.title}</button>
                <span className="muted"> · {doneCount(w)} of {w.steps.length} steps done · {new Date(w.savedAt).toLocaleDateString()}</span>
                <button className="link danger" aria-label={`Delete walkthrough: ${w.title}`} onClick={() => { setWalks(deleteWalk(w.id)); if (walk?.id === w.id) setWalk(undefined); }}>Delete</button>
              </li>
            ))}
          </ul>
        </details>
      )}
      {!walk && !busy && <div className="examples">{EXAMPLES.map((e) => <button key={e} className="link" onClick={() => void start(e)}>{e}</button>)}</div>}
      {busy === "plan" && <p className="muted">Reading the library and planning the steps…</p>}
      {note === "not-covered" && <p><Badge kind="unknown">not in the library</Badge> The library does not cover this well enough to plan a walkthrough, so the guide will not guess. Adding a text on the subject would let it.</p>}
      {note && note !== "not-covered" && <p className="banner">{note}</p>}

      {walk && current && (
        <article className="walk">
          <header className="walk-head">
            <p className="muted walk-q">{walk.question}</p>
            <h3>{walk.title}</h3>
            <ol className="walk-track" aria-label="Steps">
              {walk.steps.map((s, i) => (
                <li key={i}><button className={`${i === walk.at ? "now" : ""}${s.done ? " had" : ""}`} aria-current={i === walk.at ? "step" : undefined} onClick={() => go(i)} title={s.title}>{s.done ? "✓" : i + 1}</button></li>
              ))}
            </ol>
          </header>
          <section className="walk-step" aria-live="polite">
            <p className="walk-count">Step {walk.at + 1} of {walk.steps.length}{current.kind === "recipe" && tool ? ` · in ${tool}` : current.kind === "maths" ? " · the maths" : ""}</p>
            <h4>{current.title}</h4>
            {!body && busy === "step" && <p className="muted">Looking through the library for this step…</p>}
            {body && body.blocks.length === 0 && <p><Badge kind="unknown">not in the library</Badge> The library has nothing for this step{current.kind === "recipe" && tool ? `: no page of the ${tool} manual matched` : ""}, so the guide will not guess.</p>}
            {body && body.blocks.map((b, k) => <Block key={k} block={b} body={body} tool={current.kind === "recipe" ? tool : ""} />)}
            {body && body.sources.some((s) => s.images?.length) && (
              <div className="answer-pictures">
                {body.sources.flatMap((s) => (s.images ?? []).map((im) => <SourceImage key={`${s.n}-${im.file}`} im={im} from={`${s.source}${s.page ? `, page ${s.page}` : ""}`} question={`${walk.question} (step: ${current.title})`} answer={stepText(body)} />))}
              </div>
            )}
            {body && body.sources.length > 0 && (
              <details className="sources-fold">
                <summary>Where this step comes from ({body.sources.length} {body.sources.length === 1 ? "source" : "sources"})</summary>
                <ol className="sources">
                  {body.sources.map((s) => (
                    <li key={s.n}><strong>{s.source}</strong>{s.page ? `, page ${s.page}` : ""} · {s.section}
                      {s.quotes.slice(0, 2).map((q) => <blockquote key={q}>{q.length > 260 ? q.slice(0, 260) + "…" : q}</blockquote>)}
                    </li>
                  ))}
                </ol>
              </details>
            )}
            {body?.remembered && <p className="note">This step was written before, so it is shown again with no new call.</p>}
            <p className="walk-nav">
              <button disabled={walk.at === 0} onClick={() => go(walk.at - 1)}>Back</button>
              <button className="primary" disabled={!body} onClick={tick}>{walk.at === walk.steps.length - 1 ? (current.done ? "Done" : "Done: finish") : current.done ? "Next step" : "Done, next step"}</button>
            </p>
            {finished && <p className="note">That is every step. This walkthrough stays under “Your walkthroughs”, so you can come back to it without paying again.</p>}
          </section>
          <details className="walk-outline">
            <summary>All steps</summary>
            <ol>{walk.steps.map((s, i) => <li key={i}><button className="link" onClick={() => go(i)}>{s.title}</button>{s.done ? " ✓" : ""}{!s.body ? <span className="muted"> · not opened yet</span> : ""}</li>)}</ol>
          </details>
        </article>
      )}
      <form onSubmit={(e) => { e.preventDefault(); void start(question); }}>
        <input value={question} onChange={(e) => setQuestion(e.target.value)} maxLength={600} placeholder="How do I…" aria-label="What do you want to be walked through?" />
        <button className="primary" disabled={!!busy || question.trim().length < 3}>{busy === "plan" ? "Planning…" : "Walk me through it"}</button>
      </form>
    </>
  );
}
