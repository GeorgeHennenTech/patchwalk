import { useEffect, useMemo, useRef, useState } from "react";
import { LESSONS } from "../course/lessons";
import { guideContext, loadDone, saveDone, suggestNext } from "../course/progress";
import type { Panel, PlayableLesson } from "../course/types";
import type { Card } from "../lesson/cards";
import { INITIAL, noteToHz, PARAMS, SHAPES, type Shape, type SynthState } from "../synth/params";
import { useSynth, type Synth } from "../synth/useSynth";
import { AskBox } from "./Answer";
import { Badge } from "./Badge";
import { Markdown } from "./Markdown";
import { Keyboard, ShapePicker, Slider } from "./synth/Controls";
import { Meter, Scope, Spectrum } from "./synth/Views";

const SLIDERS = ["volumeDb", "freeHz", "octave", "semitone", "fine"] as const;
const describe = (s: SynthState) =>
  [`wave shape ${s.shape}`, `volume ${s.volumeDb} dB`, s.freeHz !== null ? `frequency fixed at ${s.freeHz} Hz` : `octave ${s.octave}, semitone ${s.semitone}, fine ${s.fine} cents`].join(", ");

function SynthPanel({ synth, show, lesson, all }: { synth: Synth; show: Panel[]; lesson: PlayableLesson; all: boolean }) {
  const on = (p: Panel) => all || show.includes(p);
  return (
    <div className="synth">
      {!synth.running && <button className="primary big" onClick={() => void synth.start()}>Start audio</button>}
      <div className="synth-views">
        {on("scope") && <Scope synth={synth} />}
        {on("spectrum") && <Spectrum synth={synth} />}
      </div>
      <div className="synth-ctls">
        {on("shape") && <ShapePicker synth={synth} spot={show.includes("shape")} only={all ? undefined : lesson.shapes} />}
        {SLIDERS.filter((id) => on(id) && (id !== "freeHz" || synth.state.freeHz !== null)).map((id) => <Slider key={id} id={id} synth={synth} spot={show.includes(id)} />)}
        {on("meter") && <Meter synth={synth} />}
        {on("hold") && (
          <label className={`ctl toggle${show.includes("hold") ? " spot" : ""}`}>
            <input type="checkbox" checked={synth.holdOn} onChange={(e) => synth.setHold(e.target.checked)} /> <span className="ctl-name">Hold</span>
          </label>
        )}
        {show.includes("ack") && <button className="primary" onClick={() => synth.flag("ack")}>My listening level is comfortable</button>}
      </div>
      {(on("keyboard") || all) && <Keyboard synth={synth} />}
    </div>
  );
}

/** Blind listening quiz. The app generates the sounds, so it knows the answers. */
function EarCheck({ kind, synth, onPass }: { kind: "shape" | "higher"; synth: Synth; onPass: () => void }) {
  const ROUNDS = 5;
  const make = () => (kind === "shape"
    ? { answer: SHAPES[Math.floor(Math.random() * 4)]! as string, hz: noteToHz(48 + Math.floor(Math.random() * 25)) }
    : (() => { const a = noteToHz(52 + Math.floor(Math.random() * 20)); const up = Math.random() < 0.5; const ratio = 2 ** ((1 + Math.floor(Math.random() * 6)) / 12); return { answer: up ? "second" : "first", hz: a, hz2: up ? a * ratio : a / ratio }; })());
  const [q, setQ] = useState(make);
  const [score, setScore] = useState({ right: 0, asked: 0 });
  const [last, setLast] = useState<string>();
  const play = () => {
    const e = synth.engine.current;
    if (!e) return;
    if (kind === "shape") e.audition(q.answer as Shape, q.hz);
    else { e.audition("sine", q.hz, 0.7); e.audition("sine", (q as { hz2: number }).hz2, 0.7, 0.85); }
  };
  const answer = (a: string) => {
    const right = a === q.answer;
    const next = { right: score.right + (right ? 1 : 0), asked: score.asked + 1 };
    setScore(next);
    setLast(right ? "Correct." : `Not quite: that was ${kind === "shape" ? q.answer : `the ${q.answer} tone`}.`);
    if (next.asked >= ROUNDS) { if (next.right >= ROUNDS - 1) onPass(); }
    else setQ(make());
  };
  const finished = score.asked >= ROUNDS;
  const options = kind === "shape" ? [...SHAPES] : ["first", "second"];
  return (
    <section className="exercise">
      <h3>Ear check <Badge kind={finished && score.right >= ROUNDS - 1 ? "ok" : "muted"}>{score.right} of {score.asked} right</Badge></h3>
      <p>{kind === "shape" ? "A wave shape is played with the controls hidden. Which one is it?" : "Two tones are played one after the other. Which is higher?"}</p>
      {!synth.running ? <button className="primary" onClick={() => void synth.start()}>Start audio</button> : !finished ? (
        <div className="toolbar">
          <button className="primary" onClick={play}>Play</button>
          {options.map((o) => <button key={o} className="choice" onClick={() => answer(o)}>{kind === "shape" ? o : `The ${o}`}</button>)}
        </div>
      ) : (
        <div className="toolbar">
          <span>{score.right >= ROUNDS - 1 ? "Passed." : "Four out of five passes. Have another go."}</span>
          <button className="link" onClick={() => { setScore({ right: 0, asked: 0 }); setLast(undefined); setQ(make()); }}>Try again</button>
        </div>
      )}
      {last && <p className="muted" role="status">{last}</p>}
    </section>
  );
}

export function PlayView({ cards }: { cards: Card[] }) {
  const synth = useSynth();
  const [done, setDone] = useState<string[]>(() => loadDone());
  const [lessonId, setLessonId] = useState(() => (suggestNext(LESSONS, loadDone()) ?? LESSONS[0]!).id);
  const [stepIndex, setStepIndex] = useState(0);
  const [remarks, setRemarks] = useState<Record<number, string>>({});
  const [earPassed, setEarPassed] = useState(false);
  const [all, setAll] = useState(false);
  const [, tick] = useState(0);
  const lesson = LESSONS.find((l) => l.id === lessonId)!;
  const finishedSteps = stepIndex >= lesson.steps.length;
  const step = lesson.steps[Math.min(stepIndex, lesson.steps.length - 1)]!;
  const begun = useRef("");

  useEffect(() => saveDone(done), [done]);
  // Re-check the current step a few times a second (hold time passes without any event).
  useEffect(() => { const id = setInterval(() => tick((n) => n + 1), 250); return () => clearInterval(id); }, []);

  // Entering a lesson: load its starting settings.
  useEffect(() => {
    synth.reset({ ...INITIAL, ...lesson.initial });
    setStepIndex(0); setRemarks({}); setEarPassed(false); setAll(false);
    begun.current = "";
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [lessonId]);
  // Entering a step: forget what was done before.
  useEffect(() => {
    const key = `${lessonId}:${stepIndex}`;
    if (begun.current === key || finishedSteps) return;
    begun.current = key;
    synth.beginStep(step.preset);
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [lessonId, stepIndex]);

  const snap = synth.snap();
  const passed = !finishedSteps && step.check(snap);
  const next = () => {
    const remark = step.remark?.(snap);
    if (remark) setRemarks((r) => ({ ...r, [stepIndex]: remark }));
    setStepIndex(stepIndex + 1);
  };
  const complete = finishedSteps && (!lesson.earCheck || earPassed);
  useEffect(() => { if (complete && !done.includes(lesson.id)) setDone((d) => [...d, lesson.id]); }, [complete, done, lesson.id]);

  const lessonCards = lesson.cardIds.map((id) => cards.find((c) => c.id === id)).filter((c): c is Card => !!c);
  const suggestion = suggestNext(LESSONS, done);
  const context = useMemo(() => guideContext(lesson, stepIndex, describe(synth.state), LESSONS, done), [lesson, stepIndex, synth.state, done]);

  return (
    <div className="learn">
      <nav className="learn-nav" aria-label="Lessons">
        <div className="learn-progress">{done.length} of {LESSONS.length} done. Take them in any order.</div>
        {LESSONS.map((l) => (
          <button key={l.id} className={l.id === lessonId ? "on" : ""} onClick={() => setLessonId(l.id)} aria-current={l.id === lessonId}>
            <span className={`dot${done.includes(l.id) ? " done" : ""}`}>{done.includes(l.id) ? "✓" : l.id.replace("C", "")}</span>
            <span><strong>{l.title}</strong><small>{l.minutes} min{l.buildsOn.length ? ` · builds on ${l.buildsOn.join(", ")}` : ""}{suggestion?.id === l.id && !done.includes(l.id) ? " · suggested next" : ""}</small></span>
          </button>
        ))}
        {done.length > 0 && <button className="link reset" onClick={() => setDone([])}>Reset progress</button>}
      </nav>

      <article className="learn-body">
        <h2>{lesson.id} {lesson.title}</h2>
        <p><strong>You will be able to:</strong> {lesson.outcome}</p>
        {lesson.idea.map((p) => <p key={p}>{p}</p>)}
        {lessonCards.map((c) => (
          <details key={c.id} className="card"><summary>{c.title} {c.status !== "reviewed" && <Badge kind="warn" title="A first draft, not yet reviewed by the owner.">draft</Badge>}</summary><Markdown text={c.body} /></details>
        ))}

        <div className="stage-box">
          <SynthPanel synth={synth} show={finishedSteps ? [] : step.show} lesson={lesson} all={all || finishedSteps} />
          <button className="link" onClick={() => setAll(!all)}>{all ? "Show only this step’s controls" : "Show the whole synth"}</button>
        </div>

        <ol className="steps">
          {lesson.steps.map((s, i) => (
            <li key={i} className={i < stepIndex ? "done" : i === stepIndex ? "now" : "later"}>
              <div className="step-do"><span className="tick" aria-hidden>{i < stepIndex ? "✓" : i + 1}</span> {s.do}</div>
              {i === stepIndex && (
                <div className="step-detail">
                  <p><strong>You should hear:</strong> {s.hear}</p>
                  <p><Badge kind={passed ? "ok" : "muted"}>{passed ? "done" : "target"}</Badge> {s.target}</p>
                  <button className="primary" disabled={!passed} onClick={next}>{i === lesson.steps.length - 1 ? "Finish the steps" : "Next step"}</button>
                </div>
              )}
              {remarks[i] && <p className="remark"><strong>Guide:</strong> {remarks[i]}</p>}
            </li>
          ))}
        </ol>

        {finishedSteps && lesson.earCheck && <EarCheck kind={lesson.earCheck} synth={synth} onPass={() => setEarPassed(true)} />}
        {finishedSteps && (
          <section className="card">
            <h3>Recap {complete && <Badge kind="ok">lesson done</Badge>}</h3>
            <ul>{lesson.recap.map((r) => <li key={r}>{r}</li>)}</ul>
            {lesson.inSerum && <p><strong>Now in Serum (optional).</strong> {lesson.inSerum}</p>}
            {complete && suggestion && <p><strong>Guide:</strong> Next I’d take <button className="link" onClick={() => setLessonId(suggestion.id)}>{suggestion.id} {suggestion.title}</button>{suggestion.buildsOn.includes(lesson.id) ? ", which builds directly on this one." : "."}</p>}
            {complete && !suggestion && <p><strong>Guide:</strong> That is every lesson built so far.</p>}
          </section>
        )}

        <AskBox context={context} placeholder="Stuck, or curious? Ask about this step" />
      </article>
    </div>
  );
}
