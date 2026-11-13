import { useEffect, useMemo, useRef, useState } from "react";
import { CHAPTERS, chapterOf, LESSONS, placeOf } from "../course/lessons";
import { allMatch, compareToTarget, type MatchVerdict } from "../course/match";
import { guideContext, loadDone, saveDone, suggestNext } from "../course/progress";
import type { MatchRound, Panel, PlayableLesson } from "../course/types";
import type { Card } from "../lesson/cards";
import { routes } from "../synth/mod";
import { beatHz, DEST_NAMES, INITIAL, noteToHz, PARAMS, SHAPES, type Shape, type SynthState } from "../synth/params";
import { useSynth, type Synth } from "../synth/useSynth";
import { AskBox } from "./Answer";
import { Badge } from "./Badge";
import { Markdown } from "./Markdown";
import { Control, Keyboard } from "./synth/Controls";
import { Rack } from "./synth/Rack";
import { EnvCurve, FilterCurve, Meter, Scope, Spectrogram, Spectrum } from "./synth/Views";

const describe = (s: SynthState) => [
  `volume ${s.volumeDb} dB`,
  s.table === "none" ? `oscillator A wave shape ${s.shape}` : `oscillator A wavetable ${PARAMS.table!.names![s.table]} at position ${s.position}%`,
  ...(s.aLevelDb < 0 ? [s.aLevelDb <= -48 ? "oscillator A silent" : `oscillator A level ${s.aLevelDb} dB`] : []),
  s.freeHz !== null ? `frequency fixed at ${s.freeHz} Hz` : `octave ${s.octave}, semitone ${s.semitone}, fine ${s.fine} cents`,
  s.voices > 1 ? `unison ${s.voices} voices, detune ${s.detune} cents, spread ${s.spread}%` : "unison off",
  s.bOn ? `oscillator B on (${s.bShape}, octave ${s.bOctave}, semitone ${s.bSemitone}, fine ${s.bFine} cents, level ${s.bLevelDb} dB)` : "oscillator B off",
  s.subOn ? `sub on (${s.subOctave} octave, ${s.subLevelDb} dB)` : "sub off",
  s.noiseOn ? `${s.noiseType} noise on (${s.noiseLevelDb} dB)` : "noise off",
  s.filterOn ? `filter on (${PARAMS.filterType!.names![s.filterType]}, cutoff ${s.cutoff} Hz, resonance ${s.resonance}%, slope ${s.slope} dB per octave, drive ${s.drive}%, key tracking ${s.keyTrack}%)` : "filter off",
  `envelope 1 (level): attack ${s.envA} ms, decay ${s.envD} ms, sustain ${s.envS}%, release ${s.envR} ms`,
  ...routes(s).map((r) => `${r.source.name} sent to ${DEST_NAMES[r.dest].toLowerCase()} at ${r.amount}%${r.source.kind === "lfo" ? ` (${s[`${r.source.id as "lfo1"}Shape`]}, ${s[`${r.source.id as "lfo1"}Rate`]} Hz)` : ""}`),
].join("; ");

/** Views of the sound the learner can switch on at any time, whatever the current step shows. */
const VIEWS: { id: Panel; label: string }[] = [
  { id: "scope", label: "Scope" }, { id: "spectrum", label: "Spectrum" }, { id: "spectrogram", label: "Spectrogram" }, { id: "meter", label: "Level" }, { id: "curve", label: "Filter curve" },
];
const VIEWS_KEY = "patchwalk.play.views";
const SKIN_KEY = "patchwalk.play.skin";
function loadViews(): Panel[] {
  try { const v = JSON.parse(localStorage.getItem(VIEWS_KEY) ?? "[]"); return Array.isArray(v) ? VIEWS.map((x) => x.id).filter((id) => v.includes(id)) : []; } catch { return []; }
}

function SynthPanel({ synth, show, lesson, all, lastNote, extra = [], onExtra, plain, onSkin }: { synth: Synth; show: Panel[]; lesson: PlayableLesson; all: boolean; lastNote?: number | null; extra?: Panel[]; onExtra?: (p: Panel) => void; plain?: boolean; onSkin?: () => void }) {
  const on = (p: Panel) => all || show.includes(p) || extra.includes(p);
  const note = synth.held.at(-1) ?? lastNote ?? null;
  const beat = beatHz(synth.state, note ?? 57);
  return (
    <div className={`synth${plain ? " plain" : ""}`}>
      <div className="synth-top">
        {!synth.running && onExtra && <button className="primary big" onClick={() => void synth.start()}>Start audio</button>}
        {onExtra && (
          <div className="view-toggles" role="group" aria-label="Views of the sound">
            <span>Show:</span>
            {VIEWS.map((v) => {
              const fixed = all || show.includes(v.id);
              return <button key={v.id} aria-pressed={on(v.id)} disabled={fixed} title={fixed ? "This step is using it" : undefined} onClick={() => onExtra(v.id)}>{v.label}</button>;
            })}
            {onSkin && <button className="skin-toggle" aria-pressed={!plain} onClick={onSkin} title="Switch the synth's velvet-and-neon look on or off">Skin: {plain ? "off" : "on"}</button>}
          </div>
        )}
        {(on("volumeDb") || on("meter")) && (
          <div className="synth-main">
            {on("meter") && <Meter synth={synth} />}
            {on("volumeDb") && <Control id="volumeDb" synth={synth} spot={show.includes("volumeDb")} />}
          </div>
        )}
      </div>
      <Rack synth={synth} show={show} all={all} lesson={lesson} note={note} />
      {/* In the whole synth the filter's curve lives in the filter panel; as an extra view it goes with the others. */}
      <div className="synth-views">
        {on("scope") && <Scope synth={synth} />}
        {on("spectrum") && <Spectrum synth={synth} />}
        {show.includes("envelope") && <EnvCurve synth={synth} which={1} spot />}
        {show.includes("envelope2") && <EnvCurve synth={synth} which={2} spot />}
        {on("spectrogram") && <Spectrogram synth={synth} />}
        {!all && !show.includes("curve") && extra.includes("curve") && <FilterCurve synth={synth} note={note} />}
      </div>
      <div className="synth-ctls">
        {on("beat") && (
          <div className={`ctl${show.includes("beat") ? " spot" : ""}`}><span className="ctl-name">Beat rate</span><output className="wide">{synth.state.bOn ? `${beat.toFixed(1)} per second on this key` : "Osc B is off"}</output></div>
        )}
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

/** Reads text with the browser's built-in voice. Free and instant; quality depends on the device. */
function ReadAloud({ text }: { text: string }) {
  const [on, setOn] = useState(false);
  const can = typeof window !== "undefined" && "speechSynthesis" in window;
  useEffect(() => () => { if (can) window.speechSynthesis.cancel(); }, [can]);
  if (!can) return null;
  const toggle = () => {
    window.speechSynthesis.cancel();
    if (on) { setOn(false); return; }
    const u = new SpeechSynthesisUtterance(text);
    u.rate = 0.95;
    u.onend = () => setOn(false);
    u.onerror = () => setOn(false);
    window.speechSynthesis.speak(u);
    setOn(true);
  };
  return <button className="link" onClick={toggle}>{on ? "Stop reading" : "Read aloud"}</button>;
}

/** Match-by-ear: a hidden target, your sound on the same key, and feedback that never shows the numbers. */
function MatchRounds({ rounds, synth, lesson, onPass, plain }: { rounds: MatchRound[]; synth: Synth; lesson: PlayableLesson; onPass: () => void; plain?: boolean }) {
  const [index, setIndex] = useState(0);
  const [verdicts, setVerdicts] = useState<Record<string, MatchVerdict>>();
  const [checks, setChecks] = useState(0);
  const [log, setLog] = useState<string[]>([]);
  const round = rounds[Math.min(index, rounds.length - 1)]!;
  const finished = index >= rounds.length;
  const NOTE = 57;
  useEffect(() => {
    if (!finished) { synth.setState(round.from); setVerdicts(undefined); setChecks(0); }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [index]);
  // a sound that moves needs longer to show its movement
  const hear = (state: SynthState) => synth.engine.current?.auditionPatch(state, NOTE, routes(state).some((r) => r.source.kind === "lfo") ? 2.8 : 1.3);
  const target = { ...INITIAL, ...round.from, ...round.target };
  const check = () => { setVerdicts(compareToTarget(synth.state, round.target, round.match)); setChecks(checks + 1); };
  const matched = !!verdicts && allMatch(verdicts);
  const next = () => {
    setLog((l) => [...l, `Round ${index + 1}: matched in ${checks} ${checks === 1 ? "check" : "checks"}.`]);
    if (index + 1 >= rounds.length) onPass();
    setIndex(index + 1);
  };
  return (
    <section className="exercise">
      <h3>Match by ear <Badge kind={finished ? "ok" : "muted"}>{finished ? "all matched" : `round ${index + 1} of ${rounds.length}`}</Badge></h3>
      {!finished && (
        <>
          <p>Listen to the target, then to yours. Change {(round.controls ?? round.match).map((k) => PARAMS[k]!.label.toLowerCase()).join(", ").replace(/, ([^,]*)$/, " and $1")} until they sound the same, then check.</p>
          {!synth.running ? <button className="primary" onClick={() => void synth.start()}>Start audio</button> : (
            <div className="toolbar">
              <button className="primary" onClick={() => hear(target)}>Hear target</button>
              <button className="choice" onClick={() => hear(synth.state)}>Hear mine</button>
              <span className="spacer" />
              <button className="primary" onClick={check}>Check</button>
            </div>
          )}
          <SynthPanel synth={synth} show={round.controls ?? round.match} lesson={lesson} all={false} plain={plain} />
          {verdicts && (
            <ul className="checks" role="status">
              {round.match.map((k) => <li key={k} className={verdicts[k] === "match" ? "ok" : "no"}><span aria-hidden>{verdicts[k] === "match" ? "✓" : "✗"}</span> {PARAMS[k]!.label}: {verdicts[k] === "match" ? "matches" : verdicts[k] === "different" ? "not the same as the target" : `yours is ${verdicts[k]}`}</li>)}
            </ul>
          )}
          {matched && <button className="primary" onClick={next}>{index + 1 >= rounds.length ? "Finish" : "Next round"}</button>}
        </>
      )}
      {log.map((l) => <p key={l} className="remark"><strong>Guide:</strong> {l}</p>)}
    </section>
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

export function PlayView({ cards, wanted }: { cards: Card[]; wanted?: { id: string; n: number } }) {
  const synth = useSynth();
  const [done, setDone] = useState<string[]>(() => loadDone());
  const [lessonId, setLessonId] = useState(() => (suggestNext(LESSONS, loadDone()) ?? LESSONS[0]!).id);
  const [stepIndex, setStepIndex] = useState(0);
  const [remarks, setRemarks] = useState<Record<number, string>>({});
  const [earPassed, setEarPassed] = useState(false);
  const [roundsPassed, setRoundsPassed] = useState(false);
  const [all, setAll] = useState(false);
  const [views, setViews] = useState<Panel[]>(loadViews);
  const toggleView = (p: Panel) => setViews((v) => {
    const next = v.includes(p) ? v.filter((x) => x !== p) : [...v, p];
    try { localStorage.setItem(VIEWS_KEY, JSON.stringify(next)); } catch { /* not remembered */ }
    return next;
  });
  const [, tick] = useState(0);
  const lesson = LESSONS.find((l) => l.id === lessonId)!;
  const finishedSteps = stepIndex >= lesson.steps.length;
  const step = lesson.steps[Math.min(stepIndex, lesson.steps.length - 1)] ?? { do: "", show: [], hear: "", target: "", check: () => false };
  const begun = useRef("");

  useEffect(() => saveDone(done), [done]);
  // The guide pointed here from an answer.
  useEffect(() => { if (wanted && LESSONS.some((l) => l.id === wanted.id)) setLessonId(wanted.id); }, [wanted]);
  const [plain, setPlain] = useState(() => { try { return localStorage.getItem(SKIN_KEY) === "off"; } catch { return false; } });
  const toggleSkin = () => setPlain((p) => { try { localStorage.setItem(SKIN_KEY, p ? "on" : "off"); } catch { /* not remembered */ } return !p; });
  // Re-check the current step a few times a second (hold time passes without any event).
  useEffect(() => { const id = setInterval(() => tick((n) => n + 1), 250); return () => clearInterval(id); }, []);

  // Entering a lesson: load its starting settings.
  useEffect(() => {
    synth.reset({ ...INITIAL, ...lesson.initial });
    setStepIndex(0); setRemarks({}); setEarPassed(false); setRoundsPassed(false); setAll(false);
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
  const complete = finishedSteps && (!lesson.earCheck || earPassed) && (!lesson.rounds || roundsPassed);
  const inRounds = finishedSteps && !!lesson.rounds && !roundsPassed;
  const playDemo = async () => {
    await synth.start();
    for (const t of lesson.demo?.tones ?? []) {
      if (t.patch) synth.engine.current?.auditionPatch({ ...INITIAL, ...t.patch }, t.note ?? 57, t.seconds, t.at);
      else if (t.shape && t.hz) synth.engine.current?.audition(t.shape, t.hz, t.seconds, t.at, t.gainDb);
    }
  };
  useEffect(() => { if (complete && !done.includes(lesson.id)) setDone((d) => [...d, lesson.id]); }, [complete, done, lesson.id]);

  const lessonCards = lesson.cardIds.map((id) => cards.find((c) => c.id === id)).filter((c): c is Card => !!c);
  const suggestion = suggestNext(LESSONS, done);
  const place = placeOf(lesson);
  const unmet = LESSONS.filter((l) => lesson.buildsOn.includes(l.id) && !done.includes(l.id));
  const context = useMemo(() => guideContext(lesson, stepIndex, describe(synth.state), LESSONS, done), [lesson, stepIndex, synth.state, done]);

  return (
    <div className="learn">
      <nav className="learn-nav" aria-label="Lessons">
        <div className="learn-progress">{done.length} of {LESSONS.length} done. Take them in any order.</div>
        {Object.keys(CHAPTERS).map((c) => (
          <div key={c} className="learn-chapter" role="group" aria-label={CHAPTERS[c]}>
            <div className="learn-chapter-name">{CHAPTERS[c]}</div>
            {LESSONS.filter((l) => chapterOf(l) === c).map((l, i) => (
              <button key={l.id} className={l.id === lessonId ? "on" : ""} onClick={() => setLessonId(l.id)} aria-current={l.id === lessonId}>
                <span className={`dot${done.includes(l.id) ? " done" : ""}`}>{done.includes(l.id) ? "✓" : i + 1}</span>
                <span><strong>{l.title}</strong><small>{l.minutes} min{suggestion?.id === l.id && !done.includes(l.id) ? " · suggested next" : ""}</small></span>
              </button>
            ))}
          </div>
        ))}
        {done.length > 0 && <button className="link reset" onClick={() => setDone([])}>Reset progress</button>}
      </nav>

      <article className="learn-body">
        <p className="learn-place">{place.chapter} · lesson {place.number} of {place.of}</p>
        <h2>{lesson.title}</h2>
        {unmet.length > 0 && <p className="muted">Builds on {unmet.map((l, i) => <span key={l.id}>{i > 0 && (i === unmet.length - 1 ? " and " : ", ")}<button className="link" onClick={() => setLessonId(l.id)}>{l.title}</button></span>)}, which you have not finished yet. You can still take this one now.</p>}
        <p><strong>You will be able to:</strong> {lesson.outcome}</p>
        {lesson.demo && (
          <p className="hear-first"><button className="primary" onClick={() => void playDemo()}>Hear it first</button> <span className="muted">{lesson.demo.caption}</span></p>
        )}
        {lesson.idea.map((p) => <p key={p}>{p}</p>)}
        <ReadAloud key={`read-${lesson.id}`} text={[lesson.outcome, ...lesson.idea].join(" ")} />
        {lessonCards.map((c) => (
          <details key={c.id} className="card"><summary>{c.title} {c.status !== "reviewed" && <Badge kind="warn" title="A first draft, not yet reviewed by the owner.">draft</Badge>}</summary><Markdown text={c.body} /></details>
        ))}

        {!inRounds && (
          <div className="stage-box">
            <SynthPanel synth={synth} show={finishedSteps || !lesson.steps.length ? [] : step.show} lesson={lesson} all={all || finishedSteps} lastNote={snap.lastNote} extra={views} onExtra={toggleView} plain={plain} onSkin={toggleSkin} />
            <button className="link" onClick={() => setAll(!all)}>{all ? "Show only this step’s controls" : "Show the whole synth"}</button>
          </div>
        )}

        {lesson.steps.length > 0 && <ol className="steps">
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
        </ol>}

        {finishedSteps && lesson.rounds && <MatchRounds key={`match-${lesson.id}`} rounds={lesson.rounds} synth={synth} lesson={lesson} onPass={() => setRoundsPassed(true)} plain={plain} />}
        {finishedSteps && lesson.earCheck && <EarCheck kind={lesson.earCheck} synth={synth} onPass={() => setEarPassed(true)} />}
        {finishedSteps && !inRounds && (
          <section className="card">
            <h3>Recap {complete && <Badge kind="ok">lesson done</Badge>}</h3>
            <ul>{lesson.recap.map((r) => <li key={r}>{r}</li>)}</ul>
            {lesson.inSerum && <p><strong>Now in Serum (optional).</strong> {lesson.inSerum}</p>}
            {complete && suggestion && <p><strong>Guide:</strong> Next I’d take <button className="link" onClick={() => setLessonId(suggestion.id)}>{suggestion.title}</button>{suggestion.buildsOn.includes(lesson.id) ? ", which builds directly on this one." : "."}</p>}
            {complete && !suggestion && <p><strong>Guide:</strong> That is every lesson built so far.</p>}
          </section>
        )}

        <AskBox context={context} placeholder="Stuck, or curious? Ask about this step" />
      </article>
    </div>
  );
}
