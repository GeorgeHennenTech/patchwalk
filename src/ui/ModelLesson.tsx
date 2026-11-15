// Runs a lesson on one of the physical models: one step at a time, each passed by playing the model with
// the settings the step asks for, then the same write / quiz / recap ending as the synth lessons.
import { useCallback, useRef, useState } from "react";
import type { ModelLesson, Played } from "../models/lessons";
import { RecallCard } from "./Recall";

const KEY = "patchwalk.models.v1";
const loadDone = (): string[] => { try { const v = JSON.parse(localStorage.getItem(KEY) ?? "[]") as unknown; return Array.isArray(v) ? v.filter((x): x is string => typeof x === "string") : []; } catch { return []; } };
const saveDone = (ids: string[]) => { try { localStorage.setItem(KEY, JSON.stringify(ids)); } catch { /* not remembered */ } };

export function useModelLesson<S>(lessons: ModelLesson<S>[], start: (settings: Partial<S>) => void) {
  const [id, setId] = useState<string>();
  const [step, setStep] = useState(0);
  const [done, setDone] = useState<string[]>(loadDone);
  const played = useRef<Played>({ plays: 0, notes: [] });
  const lesson = lessons.find((l) => l.id === id);
  const live = useRef({ lesson, step }); live.current = { lesson, step };

  const open = (next?: string) => {
    setId(next); setStep(0); played.current = { plays: 0, notes: [] };
    const l = lessons.find((x) => x.id === next);
    if (l) start(l.initial);
  };
  /** The lab calls this each time the model is played, with the settings it was played with. */
  const onPlay = useCallback((now: S, note = 0) => {
    const { lesson: l, step: at } = live.current;
    if (!l || at >= l.steps.length) return;
    played.current = { plays: played.current.plays + 1, notes: [...played.current.notes, note] };
    if (!l.steps[at]!.check(now, played.current)) return;
    played.current = { plays: 0, notes: [] };
    setStep(at + 1);
    if (at + 1 >= l.steps.length) setDone((d) => { if (d.includes(l.id)) return d; const more = [...d, l.id]; saveDone(more); return more; });
  }, []);

  const chooser = (
    <div className="model-lessons" role="group" aria-label="Lessons on this model">
      <button className={!lesson ? "on" : ""} onClick={() => open(undefined)}>Free play</button>
      {lessons.map((l, i) => <button key={l.id} className={l.id === id ? "on" : ""} onClick={() => open(l.id)}>{done.includes(l.id) ? "✓ " : ""}Lesson {i + 1}: {l.title} <span className="muted">{l.minutes} min</span></button>)}
    </div>
  );
  const finished = !!lesson && step >= lesson.steps.length;
  const intro = lesson && (
    <section className="model-lesson-intro">
      <h3>{lesson.title}</h3>
      <p><strong>You will be able to:</strong> {lesson.outcome}</p>
      {lesson.idea.map((p) => <p key={p.slice(0, 24)}>{p}</p>)}
    </section>
  );
  const steps = lesson && (
    <section className="exercise model-steps">
      <h3>{finished ? "Steps done" : `Step ${step + 1} of ${lesson.steps.length}`}</h3>
      <ol>{lesson.steps.map((s, i) => (
        <li key={s.do} className={i < step ? "done" : i === step ? "now" : "later"}>
          <strong>{i < step ? "✓ " : ""}{s.do}</strong>
          {i <= step && <span> <em>You should hear:</em> {s.hear}</span>}
          {i === step && <span className="model-target">To pass: {s.target}</span>}
        </li>
      ))}</ol>
      {finished && <RecallCard key={lesson.id} lessonId={lesson.id} outcome={lesson.outcome} recap={lesson.recap} items={lesson.quiz} />}
    </section>
  );
  return { lesson, chooser, intro, steps, onPlay };
}
