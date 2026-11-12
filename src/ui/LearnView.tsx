import { useEffect, useState } from "react";
import type { Analysis } from "../flow/build";
import { COURSE, type CheckItem } from "../learn/course";
import type { Card } from "../lesson/cards";
import { Badge } from "./Badge";
import { DropZone } from "./DropZone";
import { Markdown } from "./Markdown";

const KEY = "patchwalk.course.done";

// Progress is a per-browser convenience; the course works without it.
function loadDone(): string[] {
  try {
    const v = JSON.parse(localStorage.getItem(KEY) ?? "[]");
    return Array.isArray(v) ? v.filter((x) => typeof x === "string") : [];
  } catch {
    return [];
  }
}
function saveDone(ids: string[]) {
  try {
    localStorage.setItem(KEY, JSON.stringify(ids));
  } catch {
    /* private window or blocked storage: progress just is not remembered */
  }
}

type Result = { fileName: string; items: CheckItem[] } | { fileName: string; error: string };

export function LearnView({ cards, loadFile }: { cards: Card[]; loadFile: (f: File) => Promise<Analysis> }) {
  const [done, setDone] = useState<string[]>(loadDone);
  const [current, setCurrent] = useState(() => COURSE.find((l) => !loadDone().includes(l.id))?.id ?? COURSE[0]!.id);
  const [results, setResults] = useState<Record<string, Result>>({});
  useEffect(() => saveDone(done), [done]);

  const index = COURSE.findIndex((l) => l.id === current);
  const lesson = COURSE[index]!;
  const lessonCards = lesson.cardIds.map((id) => cards.find((c) => c.id === id)).filter((c): c is Card => !!c);
  const result = results[lesson.id];
  const passed = !!result && "items" in result && result.items.every((i) => i.ok);

  async function onFile(file: File) {
    try {
      const items = lesson.exercise.check(await loadFile(file));
      setResults((r) => ({ ...r, [lesson.id]: { fileName: file.name, items } }));
      if (items.every((i) => i.ok)) setDone((d) => (d.includes(lesson.id) ? d : [...d, lesson.id]));
    } catch (e) {
      setResults((r) => ({ ...r, [lesson.id]: { fileName: file.name, error: e instanceof Error ? e.message : "Could not read that file." } }));
    }
  }

  return (
    <div className="learn">
      <nav className="learn-nav" aria-label="Lessons">
        <div className="learn-progress">{done.length} of {COURSE.length} done</div>
        {COURSE.map((l, i) => (
          <button key={l.id} className={l.id === current ? "on" : ""} onClick={() => setCurrent(l.id)} aria-current={l.id === current}>
            <span className={`dot${done.includes(l.id) ? " done" : ""}`}>{done.includes(l.id) ? "✓" : i + 1}</span>
            <span><strong>{l.title}</strong><small>{l.summary}</small></span>
          </button>
        ))}
        {done.length > 0 && <button className="link reset" onClick={() => { setDone([]); setResults({}); }}>Reset progress</button>}
      </nav>

      <article className="learn-body">
        <h2>{index + 1}. {lesson.title}</h2>
        {lesson.intro.map((p) => <p key={p}>{p}</p>)}

        {lessonCards.map((c) => (
          <section key={c.id} className="card">
            <h3>{c.title} {c.status !== "reviewed" && <Badge kind="warn" title="Written as a first draft and not yet reviewed by the owner.">draft</Badge>}</h3>
            <Markdown text={c.body} />
            {c.reading.length > 0 && (
              <div className="reading">
                <strong>Further reading</strong>
                <ul>{c.reading.map((r) => <li key={r.url}><a href={r.url} target="_blank" rel="noopener noreferrer">{r.title}</a></li>)}</ul>
                <small>Each link loaded and matched its title when the card was written (November 2026).</small>
              </div>
            )}
          </section>
        ))}

        <section className="exercise">
          <h3>Try it <Badge kind={passed ? "ok" : "muted"}>{passed ? "done" : "exercise"}</Badge></h3>
          <p><strong>{lesson.exercise.goal}</strong></p>
          <ol>{lesson.exercise.steps.map((s) => <li key={s}>{s}</li>)}</ol>
          <DropZone onFile={onFile} compact label="Drop your saved preset to check it" />
          {result && "error" in result && <p className="banner bad">Could not read {result.fileName}. {result.error}</p>}
          {result && "items" in result && (
            <ul className="checks">
              {result.items.map((i) => <li key={i.text} className={i.ok ? "ok" : "no"}><span aria-hidden>{i.ok ? "✓" : "✗"}</span> {i.text}</li>)}
            </ul>
          )}
          {passed && index < COURSE.length - 1 && <button className="primary" onClick={() => setCurrent(COURSE[index + 1]!.id)}>Next: {COURSE[index + 1]!.title}</button>}
          {passed && index === COURSE.length - 1 && <p className="note">That is the whole course. Drop any preset into “Rebuild a patch” to see these ideas at work in a finished sound.</p>}
        </section>
      </article>
    </div>
  );
}
