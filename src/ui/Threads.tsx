// Side threads on a walkthrough, drawn as branches. Highlight any words in a step or in an answer and a
// small "Ask about this" button appears; asking starts a thread that hangs off those words. A thread sits
// indented under what it came from, joined to it by a stitched line in its own colour, and the words it
// stems from are marked in the same colour. Every thread folds to one line; only the branch being read is open.
import { useEffect, useLayoutEffect, useRef, useState } from "react";
import { askGuide, type Turn } from "../guide/ask";
import { canBranch, contextFor, depthOf, dropThread, historyFor, pathTo, quoteOf, startThread, COLOURS, type Stem, type Thread } from "../guide/threads";
import { Answer } from "./Answer";

/** The mark on an element whose text can be highlighted and asked about: "step", or "t:<thread>:<turn>". */
const anchorOf = (stem: Stem) => ("step" in stem ? "step" : `t:${stem.thread}:${stem.turn}`);
function stemOf(anchor: string, step: number): Stem | undefined {
  if (anchor === "step") return { step };
  const m = /^t:([a-z0-9]+):(\d+)$/.exec(anchor);
  return m ? { thread: m[1]!, turn: Number(m[2]) } : undefined;
}

/**
 * Colours the words each thread stems from, where they sit in the page, without changing the page: the
 * browser's own highlight layer is used (Chrome, Edge, Safari), so the words stay selectable and a quote
 * that runs across several pieces of text is still marked whole. Where a browser lacks it, nothing is marked.
 */
function paintQuotes(root: HTMLElement, threads: Thread[], step: number): void {
  const reg = (globalThis as unknown as { CSS?: { highlights?: Map<string, unknown> }; Highlight?: new (...r: Range[]) => unknown });
  if (!reg.CSS?.highlights || !reg.Highlight) return;
  const byColour = new Map<number, Range[]>();
  for (const t of threads.filter((x) => x.step === step)) {
    const box = root.querySelector<HTMLElement>(`[data-anchor="${t.parent ? `t:${t.parent.id}:${t.parent.turn}` : "step"}"]`);
    if (!box) continue;
    // compare with every space taken out, because a selection's text and the page's text differ only in their spacing
    const flat: string[] = [], where: [Node, number][] = [];
    const walker = document.createTreeWalker(box, NodeFilter.SHOW_TEXT);
    for (let n = walker.nextNode(); n; n = walker.nextNode()) { const text = n.nodeValue ?? ""; for (let i = 0; i < text.length; i++) if (!/\s/.test(text[i]!)) { flat.push(text[i]!); where.push([n, i]); } }
    const want = t.quote.replace(/…$/, "").replace(/\s+/g, "");
    const at = want ? flat.join("").indexOf(want) : -1;
    if (at < 0) continue;
    const range = document.createRange(), end = where[at + want.length - 1]!;
    range.setStart(where[at]![0], where[at]![1]); range.setEnd(end[0], end[1] + 1);
    byColour.set(t.colour, [...(byColour.get(t.colour) ?? []), range]);
  }
  for (let c = 0; c < COLOURS; c++) { const ranges = byColour.get(c); if (ranges?.length) reg.CSS.highlights.set(`branch-${c}`, new reg.Highlight(...ranges)); else reg.CSS.highlights.delete(`branch-${c}`); }
}

interface Props {
  /** The element that holds the step and its threads: highlighting is watched inside it. */
  within: React.RefObject<HTMLElement | null>;
  walkTitle: string; stepTitle: string; step: number;
  /** The step as plain words, sent along so the guide knows what the learner was reading. */
  stepWords: string;
  threads: Thread[];
  /** Applies a change to the newest list of threads, so an answer that arrives late cannot undo something done meanwhile. */
  change: (fn: (threads: Thread[]) => Thread[]) => void;
}

export function Threads({ within, walkTitle, stepTitle, step, stepWords, threads, change }: Props) {
  const [active, setActive] = useState<string>();
  const [pick, setPick] = useState<{ stem: Stem; quote: string; x: number; y: number; no?: string }>();
  const [busy, setBusy] = useState<string>();
  const latest = useRef(threads);
  latest.current = threads;
  const here = threads.filter((t) => t.step === step);
  const open = new Set(pathTo(threads, active).map((t) => t.id));

  // Watch for highlighted words inside the step or an answer, and offer to ask about them.
  useEffect(() => {
    const look = () => {
      const sel = document.getSelection(), root = within.current;
      if (!sel || sel.isCollapsed || !root || sel.rangeCount === 0) { setPick(undefined); return; }
      const box = (n: Node | null) => (n instanceof Element ? n : n?.parentElement)?.closest<HTMLElement>("[data-anchor]");
      const a = box(sel.anchorNode), b = box(sel.focusNode), quote = quoteOf(sel.toString());
      if (!a || a !== b || !root.contains(a) || !quote) { setPick(undefined); return; }
      const stem = stemOf(a.dataset.anchor!, step);
      if (!stem) { setPick(undefined); return; }
      const rect = sel.getRangeAt(0).getBoundingClientRect(), may = canBranch(latest.current, stem);
      setPick({ stem, quote, x: Math.min(window.innerWidth - 190, Math.max(8, rect.left + rect.width / 2 - 85)), y: Math.max(8, rect.top - 44), ...(may.ok ? {} : { no: may.why }) });
    };
    const later = () => window.setTimeout(look, 0);
    document.addEventListener("mouseup", later); document.addEventListener("keyup", later);
    const gone = () => setPick(undefined);
    window.addEventListener("scroll", gone, true);
    return () => { document.removeEventListener("mouseup", later); document.removeEventListener("keyup", later); window.removeEventListener("scroll", gone, true); };
  }, [within, step]);

  useLayoutEffect(() => { if (within.current) paintQuotes(within.current, threads, step); });
  useEffect(() => () => { const hl = (globalThis as unknown as { CSS?: { highlights?: Map<string, unknown> } }).CSS?.highlights; for (let c = 0; c < COLOURS; c++) hl?.delete(`branch-${c}`); }, []);

  function begin(stem: Stem, quote: string) {
    const t = startThread(latest.current, stem, quote);
    change((ts) => [...ts, t]);
    setActive(t.id); setPick(undefined);
    document.getSelection()?.removeAllRanges();
  }
  async function ask(id: string, text: string) {
    const q = text.trim(), thread = latest.current.find((t) => t.id === id);
    if (q.length < 3 || busy || !thread) return;
    const history = historyFor(latest.current, id);
    const put = (turn: Turn, replaceLast: boolean) => change((ts) => ts.map((t) => (t.id === id ? { ...t, turns: replaceLast ? [...t.turns.slice(0, -1), turn] : [...t.turns, turn] } : t)));
    put({ question: q }, false);
    setBusy(id);
    const outcome = await askGuide(q, contextFor(walkTitle, stepTitle, stepWords, thread), fetch, history);
    setBusy(undefined);
    put({ question: q, outcome }, true);
  }
  const fold = (t: Thread) => setActive(open.has(t.id) && active === t.id ? t.parent?.id : t.id);
  const trail = pathTo(threads, active);

  const draw = (t: Thread): React.ReactNode => {
    const isOpen = open.has(t.id), children = here.filter((c) => c.parent?.id === t.id), last = t.turns.at(-1);
    return (
      <section key={t.id} className={`thread c${t.colour}${isOpen ? " open" : ""}${active === t.id ? " active" : ""}`} aria-label={`Side thread about: ${t.quote}`}>
        <button className="thread-head" aria-expanded={isOpen} onClick={() => fold(t)}>
          <span className="thread-knot" aria-hidden="true" />
          <span className="thread-from">“{t.quote}”</span>
          <span className="thread-sum">{t.turns.length ? `${t.turns[0]!.question}${t.turns.length > 1 ? ` · ${t.turns.length} questions` : ""}` : "not asked yet"}{children.length ? ` · ${children.length} branch${children.length === 1 ? "" : "es"}` : ""}</span>
        </button>
        {isOpen && (
          <div className="thread-body">
            {t.turns.map((turn, i) => (
              <div key={i} className="thread-turn">
                <p className="thread-q">{turn.question}</p>
                {turn.outcome ? <div data-anchor={anchorOf({ thread: t.id, turn: i })}><Answer outcome={turn.outcome} question={turn.question} /></div> : <p className="muted">Looking through the library…</p>}
                {children.filter((c) => c.parent!.turn === i).map(draw)}
              </div>
            ))}
            {depthOf(threads, t.id) < 3 && t.turns.some((x) => x.outcome) && <p className="thread-hint muted">Highlight any words in an answer to branch off from them.</p>}
            <AskLine key={t.turns.length} busy={busy === t.id} disabled={!!busy || (!!last && !last.outcome)} first={t.turns.length === 0} onAsk={(q) => void ask(t.id, q)} />
            <p className="thread-tools"><button className="link danger" onClick={() => { if (!t.turns.length || window.confirm("Delete this thread and any branches that grew from it?")) { change((ts) => dropThread(ts, t.id)); setActive(t.parent?.id); } }}>Delete this thread</button></p>
          </div>
        )}
      </section>
    );
  };

  return (
    <>
      {pick && (
        <div className="thread-pick" style={{ left: pick.x, top: pick.y }} role="dialog" aria-label="Ask about the highlighted words">
          {pick.no ? <span>{pick.no}</span> : <button onMouseDown={(e) => e.preventDefault()} onClick={() => begin(pick.stem, pick.quote)}>Ask about this</button>}
        </div>
      )}
      {here.length > 0 && (
        <div className="threads">
          {trail.length > 0 && (
            <nav className="thread-trail" aria-label="Where you are">
              <button className="link" onClick={() => { setActive(undefined); within.current?.scrollIntoView({ behavior: "smooth", block: "start" }); }}>← Back to the walkthrough</button>
              <span className="muted"> Step {step + 1}{trail.map((t) => <span key={t.id}> › <button className="link" onClick={() => setActive(t.id)}>{t.turns[0]?.question ?? `“${t.quote.slice(0, 40)}${t.quote.length > 40 ? "…" : ""}”`}</button></span>)}</span>
            </nav>
          )}
          <h5 className="threads-title">Side threads on this step <span className="muted">· yours only, kept in this browser</span></h5>
          {here.filter((t) => !t.parent).map(draw)}
        </div>
      )}
      {here.length === 0 && <p className="thread-hint muted">Want to ask about something here? Highlight the words and choose “Ask about this”. It opens a side thread and leaves the walkthrough where it is.</p>}
    </>
  );
}

function AskLine({ busy, disabled, first, onAsk }: { busy: boolean; disabled: boolean; first: boolean; onAsk: (q: string) => void }) {
  const [q, setQ] = useState("");
  const box = useRef<HTMLInputElement>(null);
  useEffect(() => { if (first) box.current?.focus(); }, [first]);
  return (
    <form className="thread-ask" onSubmit={(e) => { e.preventDefault(); if (q.trim().length >= 3) { onAsk(q); setQ(""); } }}>
      <input ref={box} value={q} onChange={(e) => setQ(e.target.value)} maxLength={600} placeholder={first ? "What do you want to know about these words?" : "Ask a follow-up in this thread"} aria-label="Your question" />
      <button className="primary" disabled={disabled || q.trim().length < 3}>{busy ? "Thinking…" : "Ask"}</button>
    </form>
  );
}
