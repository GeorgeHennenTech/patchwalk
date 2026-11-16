// "Walk me through it": a how-to question answered as steps, one at a time. Each paragraph of a step wears a
// label saying whose words it is: the texts' (with the books named), or the guide's own joining-up. Code
// decides the label from the citations, not the guide. Formulas are kept as a reference and explained, and
// the last step is a recipe in the learner's own tool.
import { useEffect, useRef, useState } from "react";
import { deleteWalk, doneCount, drawStep, listShared, loadWalks, newWalk, openShared, planWalk, removeShared, saveWalk, walkStep, type SharedList, type Walk } from "../guide/walk";
import { stepText, TOOL_NAMES, type BlockKind, type StepBlock, type StepBody } from "../library/walk";
import { plain, SourceImage } from "./Answer";
import { Badge } from "./Badge";
import { DrawingView } from "./Drawing";

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

/**
 * One walkthrough, a step at a time. A step is written when the learner reaches it (one paid call) and a
 * drawing when they ask for one; both are handed back through `keep` so whoever owns the walkthrough can
 * store it. Used on the Ask tab and in the shared library.
 */
export function WalkPlayer({ walk, keep }: { walk: Walk; keep: (w: Walk) => void }) {
  const [busy, setBusy] = useState(false);
  const [note, setNote] = useState<string>();
  const [drawing, setDrawing] = useState(false);
  const asked = useRef(new Set<string>());
  // the newest copy, for work that finishes after the learner has moved on
  const latest = useRef(walk);
  latest.current = walk;
  const put = (id: string, at: number, change: (s: Walk["steps"][number]) => Walk["steps"][number]) => { const w = latest.current; if (w.id === id) keep({ ...w, steps: w.steps.map((s, i) => (i === at ? change(s) : s)) }); };
  const current = walk.steps[walk.at]!;

  useEffect(() => {
    if (current.body) return;
    const key = `${walk.id}:${walk.at}`, id = walk.id, at = walk.at;
    if (asked.current.has(key)) return;
    asked.current.add(key);
    let gone = false;
    setBusy(true); setNote(undefined);
    void walkStep(walk, at).then((out) => {
      if (gone) return;
      setBusy(false);
      if (out.kind === "unavailable") { setNote(out.message); asked.current.delete(key); return; }
      put(id, at, (s) => ({ ...s, body: out.value }));
    });
    return () => { gone = true; asked.current.delete(key); setBusy(false); };
  }, [walk.id, walk.at, current.body]); // eslint-disable-line react-hooks/exhaustive-deps

  // "Draw this": one paid call in which the guide only chooses a drawing; it is kept with the step.
  async function draw(fresh = false) {
    if (!current.body || drawing) return;
    const id = walk.id, at = walk.at;
    setDrawing(true); setNote(undefined);
    const out = await drawStep(walk.question, current.title, current.body, fresh, fetch, id);
    setDrawing(false);
    if (out.kind === "unavailable") { setNote(out.message); return; }
    put(id, at, (s) => ({ ...s, draw: out.value }));
  }
  const go = (at: number) => keep({ ...walk, at: Math.max(0, Math.min(walk.steps.length - 1, at)) });
  const tick = () => keep({ ...walk, steps: walk.steps.map((s, i) => (i === walk.at ? { ...s, done: true } : s)), at: Math.min(walk.steps.length - 1, walk.at + 1) });
  const body = current.body, tool = TOOL_NAMES[walk.tool];
  const finished = doneCount(walk) === walk.steps.length;

  return (
    <article className="walk">
      {note && <p className="banner">{note}</p>}
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
        {!body && busy && <p className="muted">Looking through the library for this step…</p>}
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
        {body && body.blocks.length > 0 && !current.draw && (
          <p className="point-row"><button className="point-button" disabled={drawing} onClick={() => void draw()}>{drawing ? "Choosing a drawing…" : "Draw this"}</button> <span className="muted">A graph or diagram of this step that you can move, drawn by the app. One paid call.</span></p>
        )}
        {current.draw && <><DrawingView key={`${walk.id}:${walk.at}:${current.draw.title}`} drawing={current.draw} /><p className="point-row"><button className="link" disabled={drawing} onClick={() => void draw(true)}>{drawing ? "Choosing…" : "Choose a different drawing"}</button></p></>}
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
  );
}

export function WalkView({ question, setQuestion }: { question: string; setQuestion: (q: string) => void }) {
  const [walks, setWalks] = useState<Walk[]>(() => loadWalks());
  const [walk, setWalk] = useState<Walk>();
  const [busy, setBusy] = useState(false);
  const [note, setNote] = useState<string>();

  const keep = (w: Walk) => { setWalk(w); setWalks(saveWalk(w)); };
  async function start(q: string, fresh = false) {
    const text = q.trim();
    if (text.length < 3 || busy) return;
    setNote(undefined); setBusy(true); setWalk(undefined); setQuestion("");
    const out = await planWalk(text, fresh);
    setBusy(false);
    if (out.kind === "unavailable") { setNote(out.message); return; }
    if (!out.value.covered) { setNote("not-covered"); return; }
    // the same question asked before, here or by someone else: pick up what is already written and this browser's ticks
    const fresh_ = newWalk(text, out.value), had = loadWalks().find((w) => w.id === fresh_.id);
    if (out.value.id) { const full = await openShared(out.value.id); if (full.kind === "ok") { keep(full.value); return; } }
    keep(had && had.steps.length === fresh_.steps.length && had.steps.every((s, i) => s.title === fresh_.steps[i]!.title) ? had : fresh_);
  }

  return (
    <>
      <p className="muted">
        Ask how to do something and the guide lays it out as steps, one at a time, written from every book in the library that covers it. Each part is labelled as what a text says or as the guide’s own joining-up, and it ends with a recipe in Serum 2 or Ableton Live.
        One paid Claude call for the outline, and one for each step you open. Every walkthrough is also kept in the shared library (the Walkthroughs tab), where anyone signed in can open it without paying again.
      </p>
      {walks.length > 0 && (
        <details className="saved-chats">
          <summary>Walkthroughs opened in this browser ({walks.length})</summary>
          <ul>
            {walks.map((w) => (
              <li key={w.id}>
                <button className="link" onClick={() => { setNote(undefined); setWalk(w); }}>{w.title}</button>
                <span className="muted"> · {doneCount(w)} of {w.steps.length} steps done · {new Date(w.savedAt).toLocaleDateString()}</span>
                <button className="link danger" aria-label={`Forget in this browser: ${w.title}`} onClick={() => { setWalks(deleteWalk(w.id)); if (walk?.id === w.id) setWalk(undefined); }}>Forget here</button>
              </li>
            ))}
          </ul>
        </details>
      )}
      {!walk && !busy && <div className="examples">{EXAMPLES.map((e) => <button key={e} className="link" onClick={() => void start(e)}>{e}</button>)}</div>}
      {busy && <p className="muted">Reading the library and planning the steps…</p>}
      {note === "not-covered" && <p><Badge kind="unknown">not in the library</Badge> The library does not cover this well enough to plan a walkthrough, so the guide will not guess. Adding a text on the subject would let it.</p>}
      {note && note !== "not-covered" && <p className="banner">{note}</p>}
      {walk && <WalkPlayer key={walk.id} walk={walk} keep={keep} />}
      <form onSubmit={(e) => { e.preventDefault(); void start(question); }}>
        <input value={question} onChange={(e) => setQuestion(e.target.value)} maxLength={600} placeholder="How do I…" aria-label="What do you want to be walked through?" />
        <button className="primary" disabled={busy || question.trim().length < 3}>{busy ? "Planning…" : "Walk me through it"}</button>
      </form>
    </>
  );
}

/**
 * The shared library: every walkthrough made on the site, by anyone, for everyone signed in to open.
 * Opening one costs nothing for the steps already written; a step nobody has opened yet is written then.
 */
export function WalkLibrary() {
  const [list, setList] = useState<SharedList>();
  const [walk, setWalk] = useState<Walk>();
  const [note, setNote] = useState<string>();
  const [find, setFind] = useState("");
  const [opening, setOpening] = useState<string>();
  const load = () => void listShared().then((out) => (out.kind === "ok" ? setList(out.value) : setNote(out.message)));
  useEffect(load, []);
  const keep = (w: Walk) => { setWalk(w); saveWalk(w); };
  async function open(id: string) {
    setOpening(id); setNote(undefined);
    const out = await openShared(id);
    setOpening(undefined);
    if (out.kind === "unavailable") { setNote(out.message); return; }
    keep(out.value);
  }
  const mine = new Map(loadWalks().map((w) => [w.id, w]));
  const words = find.toLowerCase().split(/\s+/).filter(Boolean);
  const shown = (list?.walks ?? []).filter((w) => words.every((x) => `${w.title} ${w.question} ${w.by} ${TOOL_NAMES[w.tool]}`.toLowerCase().includes(x)));
  return (
    <section className="panel ask">
      <h2>Walkthroughs</h2>
      <p className="muted">Every walkthrough the guide has made on this site, for you or anyone else signed in. Opening one costs nothing for the steps already written. A step nobody has opened yet is written when you reach it, which is one paid call. Your place and your ticks are your own, kept in this browser.</p>
      {note && <p className="banner">{note}</p>}
      {walk ? (
        <>
          <p><button className="link" onClick={() => { setWalk(undefined); load(); }}>← All walkthroughs</button></p>
          <WalkPlayer key={walk.id} walk={walk} keep={keep} />
        </>
      ) : !list ? (!note && <p className="muted">Opening the library…</p>) : !list.database ? (
        <p className="note">This site has no database connected, so walkthroughs cannot be shared. They are still kept in the browser that made them, on the Ask tab.</p>
      ) : list.walks.length === 0 ? (
        <p className="note">Nothing here yet. Ask the guide to walk you through something (Ask the guide, then “Walk me through it”) and it will appear here for everyone.</p>
      ) : (
        <>
          <input className="walk-find" value={find} onChange={(e) => setFind(e.target.value)} placeholder="Search by title, question, tool or person" aria-label="Search the walkthroughs" />
          <ul className="walk-list">
            {shown.map((w) => { const own = mine.get(w.id), done = own ? doneCount(own) : 0; return (
              <li key={w.id}>
                <button className="walk-open" disabled={!!opening} onClick={() => void open(w.id)}>
                  <strong>{w.title}</strong>
                  <span className="walk-list-q">{w.question}</span>
                  <span className="walk-list-meta">{TOOL_NAMES[w.tool] && <b>{TOOL_NAMES[w.tool]}</b>} {w.written} of {w.steps} steps written{w.drawn ? ` · ${w.drawn} drawing${w.drawn === 1 ? "" : "s"}` : ""} · asked by {w.by} · {new Date(w.updated).toLocaleDateString()}{done ? ` · you have done ${done}` : ""}{opening === w.id ? " · opening…" : ""}</span>
                </button>
                {list.owner && <button className="link danger" aria-label={`Remove from the library: ${w.title}`} onClick={() => { if (window.confirm(`Remove “${w.title}” from the library for everyone?`)) void removeShared(w.id).then((out) => (out.kind === "ok" ? setList(out.value) : setNote(out.message))); }}>Remove</button>}
              </li>
            ); })}
          </ul>
          {shown.length === 0 && <p className="muted">No walkthrough matches that search.</p>}
        </>
      )}
    </section>
  );
}
