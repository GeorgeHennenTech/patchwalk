import { useEffect, useMemo, useRef, useState } from "react";
import { CHAPTER_ORDER, CHAPTERS, chapterOf, LESSONS, placeOf } from "../course/lessons";
import { allMatch, compareToTarget, type MatchVerdict } from "../course/match";
import { ago, focusOn, loadPlace, minutesLeft, savePlace, setFocus, stopNote, unitsIn, type Place } from "../course/focus";
import { RecallCard, ReturnCard } from "./Recall";
import { PatchBar } from "./synth/Patches";
import { dueLessons, loadRecall } from "../course/recall";
import { WHY } from "../course/why";
import { guideContext, loadDone, saveDone, suggestNext } from "../course/progress";
import type { MatchRound, Panel, PlayableLesson } from "../course/types";
import type { Card } from "../lesson/cards";
import { macroSlots } from "../synth/macros";
import { routes } from "../synth/mod";
import { EAR, type EarKind } from "../course/ear";
import { ScoreView } from "./Score";
import { beatHz, destName, INITIAL, noteToHz, PARAMS, SHAPES, type Shape, type SynthState } from "../synth/params";
import { useSynth, type Synth } from "../synth/useSynth";
import { AskBox } from "./Answer";
import { Badge } from "./Badge";
import { Markdown } from "./Markdown";
import { Control, Keyboard } from "./synth/Controls";
import { Rack } from "./synth/Rack";
import { EnvCurve, FilterCurve, Matrix, Meter, Scope, Spectrogram, Spectrum, StitchThread } from "./synth/Views";

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
  ...macroSlots(s).map((m) => `macro "${m.name}" (at ${m.value}%) moves ${PARAMS[m.dest]!.label.toLowerCase()} by up to ${m.amount}% of its travel`),
  ...routes(s).map((r) => `${r.source.name} sent to ${destName(r.dest).toLowerCase()} at ${r.amount}%${r.source.kind === "lfo" ? ` (${s[`${r.source.id as "lfo1"}Shape`]}, ${s[`${r.source.id as "lfo1"}Rate`]} Hz)` : ""}`),
].join("; ");

/** Views of the sound the learner can switch on at any time, whatever the current step shows. */
const VIEWS: { id: Panel; label: string }[] = [
  { id: "scope", label: "Scope" }, { id: "spectrum", label: "Spectrum" }, { id: "spectrogram", label: "Spectrogram" }, { id: "meter", label: "Level" }, { id: "curve", label: "Filter curve" }, { id: "matrix", label: "Matrix" },
];
const VIEWS_KEY = "patchwalk.play.views";
const SKIN_KEY = "patchwalk.play.skin";
const MOTION_KEY = "patchwalk.play.motion";
// Spoken introductions, one audio file per lesson, named by the lesson's id. A lesson without one has no player.
const INTRO_CLIPS = Object.fromEntries(Object.entries(import.meta.glob("../assets/intros/*.mp3", { eager: true, query: "?url", import: "default" }) as Record<string, string>).map(([path, url]) => [path.split("/").pop()!.replace(/\.mp3$/, ""), url]));

function loadViews(): Panel[] {
  try { const v = JSON.parse(localStorage.getItem(VIEWS_KEY) ?? "[]"); return Array.isArray(v) ? VIEWS.map((x) => x.id).filter((id) => v.includes(id)) : []; } catch { return []; }
}

function SynthPanel({ synth, show, lesson, all, lastNote, extra = [], onExtra, plain, onSkin }: { synth: Synth; show: Panel[]; lesson: PlayableLesson; all: boolean; lastNote?: number | null; extra?: Panel[]; onExtra?: (p: Panel) => void; plain?: boolean; onSkin?: () => void }) {
  const on = (p: Panel) => all || show.includes(p) || extra.includes(p);
  // Views are opened by the step or from the Show row; the whole synth does not open them all by itself.
  const view = (p: Panel) => show.includes(p) || extra.includes(p);
  // The skin moves: its glow breathes with how loud the sound is, and its fabric drifts. "Motion" switches that off.
  const [still, setStill] = useState(() => { try { return localStorage.getItem(MOTION_KEY) === "off"; } catch { return false; } });
  const root = useRef<HTMLDivElement>(null);
  useEffect(() => {
    if (plain || still) { root.current?.style.removeProperty("--level"); return; }
    const buf = new Float32Array(2048);
    let frame = 0, n = 0, level = 0;
    const loop = () => {
      // every third frame is plenty, and keeps this cheap
      if (n++ % 3 === 0) {
        const db = synth.engine.current?.running ? synth.engine.current.peakDb(buf) : -Infinity;
        const now = Number.isFinite(db) ? Math.min(1, Math.max(0, (db + 48) / 40)) : 0;
        level = now > level ? now : level * 0.88 + now * 0.12; // up at once, down gently
        root.current?.style.setProperty("--level", level.toFixed(3));
      }
      frame = requestAnimationFrame(loop);
    };
    frame = requestAnimationFrame(loop);
    return () => cancelAnimationFrame(frame);
  }, [plain, still, synth.engine]);
  const note = synth.held.at(-1) ?? lastNote ?? null;
  const beat = beatHz(synth.state, note ?? 57);
  return (
    <div ref={root} className={`synth${plain ? " plain" : ""}${all ? " whole" : ""}${still ? " still" : ""}`}>
      {/* shading shared by every knob: a domed cap and a metal rim */}
      <svg width="0" height="0" style={{ position: "absolute" }} aria-hidden="true" focusable="false">
        <defs>
          <radialGradient id="knob-cap-fill" cx="38%" cy="30%" r="80%"><stop offset="0%" stopColor="#4a2b5c" /><stop offset="55%" stopColor="#1d0e27" /><stop offset="100%" stopColor="#090410" /></radialGradient>
          <linearGradient id="knob-rim-fill" x1="0" y1="0" x2="1" y2="1"><stop offset="0%" stopColor="#fff3e2" /><stop offset="45%" stopColor="#8d6fa3" /><stop offset="100%" stopColor="#2a1533" /></linearGradient>
        </defs>
      </svg>
      {/* the sound sewn as a line of stitches: part of the moving skin, and never shown while matching by ear */}
      {onExtra && !plain && !still && <StitchThread synth={synth} />}
      <div className="synth-top">
        {!synth.running && onExtra && <button className="primary big" onClick={() => void synth.start()}>Start audio</button>}
        {onExtra && (
          <div className="view-toggles" role="group" aria-label="Views of the sound">
            <span>Show:</span>
            {VIEWS.map((v) => {
              const fixed = show.includes(v.id);
              return <button key={v.id} aria-pressed={view(v.id)} disabled={fixed} title={fixed ? "This step is using it" : undefined} onClick={() => onExtra(v.id)}>{v.label}</button>;
            })}
            {onSkin && <button className="skin-toggle" aria-pressed={!plain} onClick={onSkin} title="Switch the synth's velvet-and-neon look on or off">Skin: {plain ? "off" : "on"}</button>}
            {onSkin && !plain && <button className="skin-toggle" aria-pressed={!still} onClick={() => setStill((v) => { try { localStorage.setItem(MOTION_KEY, v ? "on" : "off"); } catch { /* not remembered */ } return !v; })} title="Switch the skin's movement on or off: the glow that follows the sound, and the drifting fabric">Motion: {still ? "off" : "on"}</button>}
          </div>
        )}
        {(on("volumeDb") || on("meter") || on("bpm") || on("clickOn")) && (
          <div className="synth-main">
            {on("clickOn") && <Control id="clickOn" synth={synth} spot={show.includes("clickOn")} />}
            {on("bpm") && <Control id="bpm" synth={synth} spot={show.includes("bpm")} />}
            {(all || view("meter")) && <Meter synth={synth} />}
            {on("volumeDb") && <Control id="volumeDb" synth={synth} spot={show.includes("volumeDb")} />}
          </div>
        )}
      </div>
      <Rack synth={synth} show={show} all={all} lesson={lesson} note={note} />
      {/* In the whole synth the filter's curve lives in the filter panel; as an extra view it goes with the others. */}
      <div className="synth-views">
        {view("scope") && <Scope synth={synth} />}
        {view("spectrum") && <Spectrum synth={synth} />}
        {show.includes("envelope") && <EnvCurve synth={synth} which={1} spot />}
        {show.includes("envelope2") && <EnvCurve synth={synth} which={2} spot />}
        {view("spectrogram") && <Spectrogram synth={synth} />}
        {view("matrix") && <Matrix synth={synth} />}
        {!all && !show.includes("curve") && extra.includes("curve") && <FilterCurve synth={synth} note={note} />}
      </div>
      <div className="synth-ctls">
        {view("beat") && (
          <div className={`ctl${show.includes("beat") ? " spot" : ""}`}><span className="ctl-name">Beat rate</span><output className="wide">{synth.state.bOn ? `${beat.toFixed(1)} per second on this key` : "Osc B is off"}</output></div>
        )}
        {on("hold") && (
          <label className={`ctl toggle${show.includes("hold") ? " spot" : ""}`}>
            <input type="checkbox" checked={synth.holdOn} onChange={(e) => synth.setHold(e.target.checked)} /> <span className="ctl-name">Hold</span>
          </label>
        )}
        {show.includes("ack") && <button className="primary" onClick={() => synth.flag("ack")}>My listening level is comfortable</button>}
      </div>
      {(on("keyboard") || all) && <Keyboard synth={synth} wheels={all || show.includes("wheels")} />}
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
function EarCheck({ kind, synth, onPass }: { kind: EarKind; synth: Synth; onPass: () => void }) {
  const ROUNDS = 5, spec = EAR[kind];
  const [q, setQ] = useState(() => spec.make());
  const [score, setScore] = useState({ right: 0, asked: 0 });
  const [last, setLast] = useState<string>();
  const play = () => {
    const e = synth.engine.current;
    if (!e) return;
    for (const t of q.tones) { if (t.patch) e.auditionPatch(t.patch, t.note ?? 57, t.seconds, t.at); else e.audition(t.shape ?? "sine", t.hz ?? 440, t.seconds, t.at); }
  };
  const answer = (a: string) => {
    const right = a === q.answer;
    const next = { right: score.right + (right ? 1 : 0), asked: score.asked + 1 };
    setScore(next);
    setLast(right ? "Correct." : `Not quite: that was ${spec.label(q.answer).toLowerCase()}.`);
    if (next.asked >= ROUNDS) { if (next.right >= ROUNDS - 1) onPass(); }
    else setQ(spec.make());
  };
  const finished = score.asked >= ROUNDS;
  return (
    <section className="exercise">
      <h3>Ear check <Badge kind={finished && score.right >= ROUNDS - 1 ? "ok" : "muted"}>{score.right} of {score.asked} right</Badge></h3>
      <p>{spec.ask}</p>
      {!synth.running ? <button className="primary" onClick={() => void synth.start()}>Start audio</button> : !finished ? (
        <div className="toolbar">
          <button className="primary" onClick={play}>Play</button>
          {spec.options.map((o) => <button key={o} className="choice" onClick={() => answer(o)}>{spec.label(o)}</button>)}
        </div>
      ) : (
        <div className="toolbar">
          <span>{score.right >= ROUNDS - 1 ? "Passed." : "Four out of five passes. Have another go."}</span>
          <button className="link" onClick={() => { setScore({ right: 0, asked: 0 }); setLast(undefined); setQ(spec.make()); }}>Try again</button>
        </div>
      )}
      {last && <p className="muted" role="status">{last}</p>}
    </section>
  );
}

export function PlayView({ cards, wanted }: { cards: Card[]; wanted?: { id: string; n: number } }) {
  const synth = useSynth();
  const [done, setDone] = useState<string[]>(() => loadDone());
  // Focus mode: with it on, the page opens where the learner left off, settings and all
  const [focus, setFocusState] = useState(() => focusOn());
  const [was, setWas] = useState<Place | undefined>(() => (focusOn() ? loadPlace(LESSONS, loadDone()) : undefined));
  const resume = useRef<Place | undefined>(was);
  const sitting = useRef(0); // lessons finished since the page was opened
  const [navOpen, setNavOpen] = useState(false);
  // lessons finished days or weeks ago whose return has come round
  const [due, setDue] = useState<string[]>(() => dueLessons(loadRecall(), loadDone(), Date.now()));
  const [returning, setReturning] = useState(false);
  const [lessonId, setLessonId] = useState(() => was?.lessonId ?? (suggestNext(LESSONS, loadDone()) ?? LESSONS[0]!).id);
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

  useEffect(() => saveDone(done, undefined, true), [done]);
  // The guide pointed here from an answer.
  useEffect(() => { if (wanted && LESSONS.some((l) => l.id === wanted.id)) setLessonId(wanted.id); }, [wanted]);
  const [plain, setPlain] = useState(() => { try { return localStorage.getItem(SKIN_KEY) === "off"; } catch { return false; } });
  const toggleSkin = () => setPlain((p) => { try { localStorage.setItem(SKIN_KEY, p ? "on" : "off"); } catch { /* not remembered */ } return !p; });
  // Re-check the current step a few times a second (hold time passes without any event).
  useEffect(() => { const id = setInterval(() => tick((n) => n + 1), 250); return () => clearInterval(id); }, []);

  // Entering a lesson: load its starting settings.
  useEffect(() => {
    // (kept until another lesson is opened, so running this twice gives the same result)
    const back = resume.current?.lessonId === lessonId ? resume.current : undefined;
    if (!back) { resume.current = undefined; setWas(undefined); }
    synth.reset({ ...INITIAL, ...lesson.initial, ...(back?.state ?? {}) } as typeof INITIAL);
    setStepIndex(back?.stepIndex ?? 0); setRemarks({}); setEarPassed(false); setRoundsPassed(false); setAll(false);
    // a step picked up where it was left must not have its settings put back to the step's starting ones
    begun.current = back ? `${lessonId}:${back.stepIndex}` : "";
    if (back) synth.beginStep(undefined);
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

  // Remember the place: on every step, and when the page is hidden or closed (with the knobs as they were then)
  const here = useRef<Place | undefined>(undefined);
  here.current = finishedSteps ? undefined : { lessonId, stepIndex, state: synth.state as unknown as Record<string, unknown>, at: Date.now() };
  useEffect(() => { savePlace(here.current); }, [lessonId, stepIndex, finishedSteps]);
  useEffect(() => { const keep = () => savePlace(here.current); window.addEventListener("pagehide", keep); document.addEventListener("visibilitychange", keep); return () => { window.removeEventListener("pagehide", keep); document.removeEventListener("visibilitychange", keep); }; }, []);

  const snap = synth.snap();
  const passed = !finishedSteps && step.check(snap);
  const next = () => {
    const remark = step.remark?.(snap);
    if (remark) setRemarks((r) => ({ ...r, [stepIndex]: remark }));
    setStepIndex(stepIndex + 1); setWas(undefined);
  };
  const complete = finishedSteps && (!lesson.earCheck || earPassed) && (!lesson.rounds || roundsPassed);
  const inRounds = finishedSteps && !!lesson.rounds && !roundsPassed;
  const playDemo = async () => {
    await synth.start();
    for (const t of lesson.demo?.tones ?? []) {
      if (t.patch) synth.engine.current?.auditionPatch({ ...INITIAL, ...t.patch }, t.note ?? 57, t.seconds, t.at, t.velocity, t.from);
      else if (t.shape && t.hz) synth.engine.current?.audition(t.shape, t.hz, t.seconds, t.at, t.gainDb);
    }
  };
  useEffect(() => { if (complete && !done.includes(lesson.id)) { sitting.current += 1; setDone((d) => [...d, lesson.id]); } }, [complete, done, lesson.id]);
  const unitsDone = Math.min(stepIndex, lesson.steps.length) + (roundsPassed ? lesson.rounds?.length ?? 0 : 0) + (earPassed ? 2 : 0);
  const left = complete ? 0 : minutesLeft(lesson, unitsDone), allUnits = unitsIn(lesson);
  const toggleFocus = () => { setFocus(!focus); setFocusState(!focus); };

  const lessonCards = lesson.cardIds.map((id) => cards.find((c) => c.id === id)).filter((c): c is Card => !!c);
  const suggestion = suggestNext(LESSONS, done);
  const place = placeOf(lesson);
  const needs = LESSONS.filter((l) => lesson.buildsOn.includes(l.id));
  const unmet = needs.filter((l) => !done.includes(l.id));
  const context = useMemo(() => guideContext(lesson, stepIndex, describe(synth.state), LESSONS, done), [lesson, stepIndex, synth.state, done]);

  return (
    <div className={`learn${focus ? " focus" : ""}${focus && !navOpen ? " nav-shut" : ""}`}>
      {focus && <button className="link nav-toggle" aria-expanded={navOpen} onClick={() => setNavOpen(!navOpen)}>{navOpen ? "Hide the lesson list" : `All lessons (${done.length} of ${LESSONS.length} done)`}</button>}
      <nav className="learn-nav" aria-label="Lessons" hidden={focus && !navOpen}>
        <div className="learn-progress">{done.length} of {LESSONS.length} done. Take them in any order.</div>
        {CHAPTER_ORDER.map((c) => (
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
        {due.length > 0 && !returning && (
          <aside className="builds-on coming-back" aria-label="Lessons coming back">
            <span className="builds-on-tag">Coming back</span>
            <p>{due.length === 1 ? "One lesson you finished a while ago is" : `${due.length} lessons you finished a while ago are`} ready for a quick return: a few questions each, from memory. It is what makes them stay.</p>
            <p><button className="primary" onClick={() => setReturning(true)}>Start ({due.length === 1 ? "about 2 minutes" : `about ${due.length * 2} minutes`})</button> <button className="link" onClick={() => setDue([])}>Later</button></p>
          </aside>
        )}
        {returning && due[0] && (() => { const l = LESSONS.find((x) => x.id === due[0]); return l ? <ReturnCard key={l.id} lessonId={l.id} title={l.title} recap={l.recap} left={due.length - 1} onDone={() => { const rest = due.slice(1); setDue(rest); if (!rest.length) setReturning(false); }} /> : null; })()}
        <p className="learn-place">{place.chapter} · lesson {place.number} of {place.of} <button className="focus-switch" aria-pressed={focus} onClick={toggleFocus} title="Keeps the time and steps left in view, hides the lesson list, and brings you back to where you were">Focus mode: {focus ? "on" : "off"}</button></p>
        <h2>{lesson.title}</h2>
        {focus && (
          <div className="focus-bar" role="status" aria-label="Where you are in this lesson">
            <div className="focus-bar-text">
              <strong>{complete ? "Lesson done" : inRounds ? "Match by ear" : finishedSteps ? (lesson.earCheck && !earPassed ? "Ear check" : "Recap") : `Step ${stepIndex + 1} of ${lesson.steps.length}`}</strong>
              <span>{complete ? "nothing left" : `about ${left} min left`}</span>
            </div>
            <div className="focus-bar-track" aria-hidden="true">{Array.from({ length: allUnits }, (_, i) => <i key={i} className={i < unitsDone ? "had" : i === unitsDone && !complete ? "now" : ""} />)}</div>
            {!finishedSteps && <p className="focus-bar-do"><span>Now:</span> {step.do}</p>}
          </div>
        )}
        {focus && was && was.lessonId === lesson.id && (
          <aside className="builds-on you-were-here" aria-label="Where you were">
            <span className="builds-on-tag">You were here</span>
            <p>You left this lesson {ago(was.at, Date.now())}, on step {was.stepIndex + 1} of {lesson.steps.length}. The synth is set the way you left it.{was.stepIndex > 0 && <> The last thing you did: <em>{lesson.steps[was.stepIndex - 1]!.do}</em></>}</p>
            <p><button className="link" onClick={() => setWas(undefined)}>Got it</button> · <button className="link" onClick={() => { setWas(undefined); resume.current = undefined; synth.reset({ ...INITIAL, ...lesson.initial }); begun.current = ""; setStepIndex(0); }}>Start this lesson again instead</button></p>
          </aside>
        )}
        {needs.length > 0 && (
          <aside className="builds-on" aria-label="Lessons this one builds on">
            <span className="builds-on-tag">Builds on</span>
            <div className="builds-on-list">
              {needs.map((l) => <button key={l.id} className={done.includes(l.id) ? "had" : ""} onClick={() => setLessonId(l.id)} title={done.includes(l.id) ? "You have finished this one" : "Not finished yet. Click to open it."}>{done.includes(l.id) && <span aria-hidden="true">✓ </span>}{l.title}</button>)}
            </div>
            <p>{unmet.length === 0 ? "You have done all of these." : unmet.length === needs.length ? "You have not finished these yet. You can still take this lesson now." : "The ticked ones are done. You can still take this lesson now."}</p>
          </aside>
        )}
        {INTRO_CLIPS[lesson.id] && (
          <p className="intro-clip"><span className="muted">Hear what this lesson covers:</span> <audio key={lesson.id} controls preload="none" src={INTRO_CLIPS[lesson.id]} aria-label="Spoken introduction to this lesson" /></p>
        )}
        {WHY[lesson.id] && <p className="why-matters"><strong>Why this matters:</strong> {WHY[lesson.id]}</p>}
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
            {(all || finishedSteps) && <PatchBar synth={synth} />}
          </div>
        )}

        {lesson.steps.length > 0 && <ol className="steps">
          {lesson.steps.map((s, i) => (
            <li key={i} className={i < stepIndex ? "done" : i === stepIndex ? "now" : "later"}>
              <div className="step-do"><span className="tick" aria-hidden>{i < stepIndex ? "✓" : i + 1}</span> {s.do}</div>
              {i === stepIndex && (
                <div className="step-detail">
                  {s.score && <ScoreView score={s.score} sequence={snap.sequence} synth={synth} />}
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
          <RecallCard key={`recall-${lesson.id}`} lessonId={lesson.id} outcome={lesson.outcome} recap={lesson.recap}>
            {complete && <p><Badge kind="ok">lesson done</Badge></p>}
            {lesson.inSerum && <p><strong>Now in Serum (optional).</strong> {lesson.inSerum}</p>}
            {complete && suggestion && <p><strong>Guide:</strong> Next I’d take <button className="link" onClick={() => setLessonId(suggestion.id)}>{suggestion.title}</button>{suggestion.buildsOn.includes(lesson.id) ? ", which builds directly on this one." : "."}</p>}
            {complete && !suggestion && <p><strong>Guide:</strong> That is every lesson built so far.</p>}
          </RecallCard>
        )}

        {focus && complete && (() => { const n = stopNote(sitting.current); return (
          <aside className="builds-on stop-here" aria-label={n.title}>
            <span className="builds-on-tag">{n.title}</span>
            <p>{n.text}</p>
          </aside>
        ); })()}

        <AskBox context={context} placeholder="Stuck, or curious? Ask about this step" />
      </article>
    </div>
  );
}
