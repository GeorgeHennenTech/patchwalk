// "Build this lesson in Serum 2": a button on a practice lesson that rewrites it as steps for Serum 2, from
// the Serum 2 User Guide. Built once (a paid call), then kept in the site's database, so the page first
// looks, for free, whether somebody has already had it built.
import { useEffect, useState } from "react";
import type { PlayableLesson as Lesson } from "../course/types";
import { serumLesson, type SerumLesson } from "../guide/serum";
import { stepText } from "../library/walk";
import { SourceImage } from "./Answer";
import { Block } from "./Walkthrough";

export function SerumVersion({ lesson, chapter }: { lesson: Lesson; chapter?: string }) {
  const [built, setBuilt] = useState<SerumLesson>();
  const [busy, setBusy] = useState(false);
  const [note, setNote] = useState<string>();
  const [looked, setLooked] = useState(false);
  // on opening the lesson: is it in the database already? Never a paid call.
  useEffect(() => {
    let gone = false;
    setBuilt(undefined); setNote(undefined); setLooked(false);
    void serumLesson(lesson, chapter, { peek: true }).then((out) => { if (gone) return; setLooked(true); if (out.kind === "ok" && out.value.built) setBuilt(out.value); });
    return () => { gone = true; };
  }, [lesson.id]); // eslint-disable-line react-hooks/exhaustive-deps
  async function build(fresh = false) {
    if (busy) return;
    setBusy(true); setNote(undefined);
    const out = await serumLesson(lesson, chapter, fresh ? { fresh: true } : {});
    setBusy(false);
    if (out.kind === "unavailable") { setNote(out.message); return; }
    if (!out.value.built) { setNote(out.value.message ?? "The guide could not write this lesson for Serum 2."); return; }
    setBuilt(out.value);
  }
  if (!built) return (
    <div className="serum-version">
      <p className="point-row">
        <button className="point-button" disabled={busy || !looked} onClick={() => void build()}>{busy ? "Writing it for Serum 2… (about a minute)" : "Build this lesson in Serum 2"}</button>{" "}
        <span className="muted">The same steps, written for Serum 2 from its User Guide so you can follow along there. One paid call, made once: after that it is kept for everyone.</span>
      </p>
      {note && <p className="banner">{note}</p>}
    </div>
  );
  return (
    <details className="serum-version built" open={!built.remembered}>
      <summary><span className="serum-tag">In Serum 2</span> This lesson, step by step in Serum 2 <span className="muted">· built{built.by ? ` for ${built.by}` : ""}{built.at ? ` on ${new Date(built.at).toLocaleDateString()}` : ""}</span></summary>
      <div className="serum-body" data-anchor="serum">
        {built.blocks.map((b, k) => <Block key={k} block={b} body={built} tool="Serum 2" />)}
      </div>
      {built.sources.some((s) => s.images?.length) && (
        <div className="answer-pictures">
          {built.sources.flatMap((s) => (s.images ?? []).map((im) => <SourceImage key={`${s.n}-${im.file}`} im={im} from={`${s.source}${s.page ? `, page ${s.page}` : ""}`} question={`How do I do the lesson "${lesson.title}" in Serum 2?`} answer={stepText(built).slice(0, 2800)} />))}
        </div>
      )}
      {built.sources.length > 0 && (
        <details className="sources-fold">
          <summary>Which pages of the Serum 2 User Guide this comes from ({built.sources.length})</summary>
          <ol className="sources">{built.sources.map((s) => <li key={s.n}><strong>{s.source}</strong>{s.page ? `, page ${s.page}` : ""} · {s.section}{s.quotes.slice(0, 1).map((q) => <blockquote key={q}>{q.length > 220 ? q.slice(0, 220) + "…" : q}</blockquote>)}</li>)}</ol>
        </details>
      )}
      <p className="note">Written by the guide from the manual, not checked in Serum 2 by a person. “My synthesis” marks where it matched this app’s controls to Serum’s by its own judgement; numbers are a place to start, so finish by ear. <button className="link" disabled={busy} onClick={() => void build(true)}>{busy ? "Writing…" : "Build it again"}</button></p>
      {note && <p className="banner">{note}</p>}
    </details>
  );
}
