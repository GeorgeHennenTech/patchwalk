// The string lab: the first physical-modelling instrument. A plucked string you can play, with a picture of
// where it is plucked and heard, the harmonics that pluck leaves in, and the note it made. Every note is
// worked out whole by src/strings/string.ts and then played, so what is drawn is exactly what is heard.
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { noteToHz } from "../synth/params";
import { STRING_LESSONS } from "../models/lessons";
import { useModelLesson } from "./ModelLesson";
import { EXCITERS, judgeString, loopFor, pairBeatHz, stringTarget, pluckHarmonics, pluckShape, renderString, STRING_INITIAL, STRING_RANGES, type StringState } from "../strings/string";

const KEYS = "awsedftgyhujk"; // one octave of the computer keyboard, from C
const LOW = 36, HIGH = 72, BLACK = [1, 3, 6, 8, 10];
const NAMES = ["C", "C#", "D", "D#", "E", "F", "F#", "G", "G#", "A", "A#", "B"];
const nameOf = (note: number) => `${NAMES[note % 12]}${Math.floor(note / 12) - 1}`;
const EXCITER_NAMES = { pluck: "Pluck", noise: "Burst of noise" } as const;

interface Try { id: string; say: string; hear: string; done: (s: StringState, seen: Seen) => boolean }
interface Seen { notes: Set<number>; bright: [number, number]; decay: [number, number] }
const TRIES: Try[] = [
  { id: "keys", say: "Play three different keys.", hear: "Each rings and fades by itself, like a string let go.", done: (_s, seen) => seen.notes.size >= 3 },
  { id: "noise", say: "Change “Set going by” to Burst of noise and play a key.", hear: "A rougher start, but the same note. The loop decides the pitch, not what is put into it.", done: (s) => s.exciter === "noise" },
  { id: "bright", say: "Play with Brightness near 0, then near 100.", hear: "Dull and short-lived on top, like nylon or an old string; then bright and ringing, like new steel.", done: (_s, seen) => seen.bright[0] <= 10 && seen.bright[1] >= 90 },
  { id: "decay", say: "Play with Decay time under 0.6 s, then over 5 s.", hear: "A muted, damped thud; then a note that hangs in the air.", done: (_s, seen) => seen.decay[0] <= 0.6 && seen.decay[1] >= 5 },
  { id: "middle", say: "Set Pluck position to 50% (the middle) and play.", hear: "Hollow and round. Look at the bars: every second harmonic has gone.", done: (s) => s.pick === 50 && s.exciter === "pluck" },
  { id: "bridge", say: "Set Pluck position under 8% (close to the bridge) and play.", hear: "Thin, nasal and bright: nearly every harmonic is there, at nearly the same size.", done: (s) => s.pick <= 8 && s.exciter === "pluck" },
  { id: "soft", say: "Turn Pick hardness under 15% and play.", hear: "A soft thumb: the top bars shrink and the start of the note is rounder.", done: (s) => s.hard <= 15 },
  { id: "pair", say: "Set Second string to about 8 cents and hold your ear on one long note.", hear: "The note swells and fades slowly as the two strings drift in and out of step, as paired strings do on a twelve-string guitar.", done: (s) => s.pair >= 5 && s.pair <= 12 },
  { id: "pickup", say: "Set Listening position to 25% and play.", hear: "Every fourth harmonic drops out, as it does under a guitar pickup a quarter of the way along.", done: (s) => s.pickup === 25 },
];

export default function StringLab() {
  const [s, setS] = useState<StringState>(STRING_INITIAL);
  const [last, setLast] = useState<number>(45);
  const [lit, setLit] = useState<number>();
  const [done, setDone] = useState<string[]>([]);
  const seen = useRef<Seen>({ notes: new Set(), bright: [100, 0], decay: [99, 0] });
  const ctx = useRef<AudioContext | undefined>(undefined);
  const out = useRef<GainNode | undefined>(undefined);
  const state = useRef(s); state.current = s;

  const course = useModelLesson(STRING_LESSONS, (settings) => setS({ ...STRING_INITIAL, ...settings }));
  const coursePlay = useRef(course.onPlay); coursePlay.current = course.onPlay;
  const [target, setTarget] = useState<StringState>();
  const [verdict, setVerdict] = useState<ReturnType<typeof judgeString>>();
  const [wins, setWins] = useState(0);
  const play = useCallback((note: number, as?: StringState) => {
    const now = as ?? state.current;
    if (!ctx.current) { ctx.current = new AudioContext(); out.current = ctx.current.createGain(); out.current.gain.value = 0.7; out.current.connect(ctx.current.destination); }
    const c = ctx.current; void c.resume();
    const seconds = Math.min(9, Math.max(0.6, now.decay * 1.3)), samples = renderString(now, note, c.sampleRate, seconds);
    const buffer = c.createBuffer(1, samples.length, c.sampleRate); buffer.getChannelData(0).set(samples);
    const source = c.createBufferSource(); source.buffer = buffer; source.connect(out.current!); source.start();
    if (as) return; // the hidden target: play it and leave no trace on screen
    coursePlay.current(now, note);
    setLast(note); setLit(note); window.setTimeout(() => setLit((n) => (n === note ? undefined : n)), 180);
    const k = seen.current; k.notes.add(note);
    k.bright = [Math.min(k.bright[0], now.bright), Math.max(k.bright[1], now.bright)]; k.decay = [Math.min(k.decay[0], now.decay), Math.max(k.decay[1], now.decay)];
    setDone((d) => { const more = TRIES.filter((t) => !d.includes(t.id) && t.done(now, k)).map((t) => t.id); return more.length ? [...d, ...more] : d; });
  }, []);
  useEffect(() => {
    const down = (e: KeyboardEvent) => {
      if (e.repeat || e.metaKey || e.ctrlKey || e.altKey) return;
      const el = e.target as HTMLElement | null;
      if (el && (el.tagName === "INPUT" || el.tagName === "TEXTAREA" || el.tagName === "SELECT") && (el as HTMLInputElement).type !== "range") return;
      const i = KEYS.indexOf(e.key.toLowerCase());
      if (i >= 0) play(48 + i);
    };
    window.addEventListener("keydown", down);
    return () => { window.removeEventListener("keydown", down); void ctx.current?.close(); ctx.current = undefined; };
  }, [play]);

  const hz = noteToHz(last);
  const bars = useMemo(() => { const h = pluckHarmonics(s, hz, 48000), n = Math.min(24, h.length - 1), top = Math.max(1e-9, ...Array.from(h.slice(1, n + 1), Math.abs)); return Array.from({ length: n }, (_, i) => (s.exciter === "noise" ? NaN : Math.abs(h[i + 1]!) / top)); }, [s, hz]);
  const outline = useMemo(() => {
    const seconds = Math.min(9, Math.max(0.6, s.decay * 1.3)), y = renderString(s, last, 12000, seconds), W = 240, per = Math.max(1, Math.floor(y.length / W)), pts: number[] = [];
    for (let x = 0; x < W; x++) { let p = 0; for (let i = x * per; i < Math.min(y.length, (x + 1) * per); i++) p = Math.max(p, Math.abs(y[i]!)); pts.push(p); }
    return { pts, seconds };
  }, [s, last]);
  const loop = loopFor(s, hz, 48000);
  const set = (id: keyof StringState, v: number | string) => setS((old) => ({ ...old, [id]: v }));
  const whites = Array.from({ length: HIGH - LOW + 1 }, (_, i) => LOW + i).filter((n) => !BLACK.includes(n % 12));

  return (
    <section className="strings">
      <h2>String lab: a plucked string</h2>
      {course.chooser}
      {course.intro}
      {!course.lesson && <p className="strings-lead">This instrument has no oscillator and no stored wave. A short burst goes into a loop; one trip round the loop is one trip down the string and back, so the length of the loop is the note. Each trip the wave loses a little, the highs most of all, and that is the whole sound.</p>}
      <div className="strings-grid">
        <div className="strings-panel">
          <svg className="strings-string" viewBox="0 0 400 110" role="img" aria-label={`The string just after the pluck: plucked ${s.pick}% of the way along${s.pickup ? `, listened to at ${s.pickup}%` : ""}`}>
            <line x1="20" x2="380" y1="80" y2="80" className="strings-rest" />
            <polyline className="strings-shape" fill="none" points={Array.from({ length: 73 }, (_, i) => `${20 + i * 5},${80 - pluckShape(s, i / 72) * 52}`).join(" ")} />
            <rect x="12" y="62" width="8" height="36" className="strings-end" /><rect x="380" y="62" width="8" height="36" className="strings-end" />
            <text x="16" y="108" textAnchor="middle" className="strings-label">bridge</text><text x="384" y="108" textAnchor="middle" className="strings-label">nut</text>
            <g transform={`translate(${20 + (s.pick / 100) * 360}, 0)`}><path d="M0 22 l-6 -12 h12 z" className="strings-pick" /><text y="8" textAnchor="middle" className="strings-label">pluck</text></g>
            {s.pickup > 0 && <g transform={`translate(${20 + (s.pickup / 100) * 360}, 0)`}><rect x="-7" y="84" width="14" height="7" className="strings-pickup" /><text y="103" textAnchor="middle" className="strings-label">listen</text></g>}
          </svg>
          <div className="strings-controls">
            <label className="strings-choice">Set going by
              <span className="seg">{EXCITERS.map((e) => <button key={e} className={s.exciter === e ? "on" : ""} aria-pressed={s.exciter === e} onClick={() => set("exciter", e)}>{EXCITER_NAMES[e]}</button>)}</span>
            </label>
            {(Object.keys(STRING_RANGES) as (keyof typeof STRING_RANGES)[]).map((id) => { const r = STRING_RANGES[id]; return (
              <label key={id} className="strings-range">{r.label}
                <input type="range" min={r.min} max={r.max} step={r.step} value={s[id]} onChange={(e) => set(id, Number(e.target.value))} aria-label={r.label} />
                <span className="strings-value">{id === "pickup" && s.pickup === 0 ? "at the bridge" : id === "pair" && s.pair === 0 ? "off" : `${s[id]} ${r.unit}`}</span>
              </label>
            ); })}
          </div>
        </div>
        <div className="strings-panel">
          <h3>What the pluck leaves in</h3>
          {s.exciter === "noise" ? <p className="muted">A burst of noise has a little of everything, so there is no tidy pattern to draw. The loop keeps only what fits the string’s length: the note and its harmonics.</p> : (
            <svg className="strings-bars" viewBox="0 0 240 90" role="img" aria-label="The size of each harmonic at the moment of the pluck">
              {bars.map((v, i) => <rect key={i} x={i * 10 + 1} width="7" y={84 - v * 78} height={Math.max(1, v * 78)} className={v < 0.02 ? "gone" : ""} />)}
              <line x1="0" x2="240" y1="84.5" y2="84.5" className="strings-rest" />
            </svg>
          )}
          <p className="strings-caption">Harmonics 1 to {bars.length} of {nameOf(last)}, at the start of the note. A missing bar is a harmonic that has a still point where the string was plucked or is listened to.</p>
          <h3>The note it made</h3>
          <svg className="strings-fade" viewBox="0 0 240 60" preserveAspectRatio="none" role="img" aria-label="The loudness of the note over time">
            <path d={`M0 60 ${outline.pts.map((p, x) => `L${x} ${60 - Math.min(1, p / 0.7) * 56}`).join(" ")} L240 60 Z`} />
          </svg>
          <p className="strings-caption">Loudness over {outline.seconds.toFixed(1)} s. For {nameOf(last)} ({hz.toFixed(1)} Hz) the loop is {(48000 / hz).toFixed(1)} samples long at 48,000 samples a second, and {(loop.gain * 100).toFixed(2)}% is kept on each trip.{s.pair > 0 && ` The two strings drift in and out of step ${pairBeatHz(hz, s.pair).toFixed(1)} times a second.`}</p>
        </div>
      </div>
      <div className="strings-keys" role="group" aria-label="Keys: click to pluck">
        {whites.map((n) => <button key={n} className={`sk white${lit === n ? " lit" : ""}`} onPointerDown={() => play(n)} aria-label={nameOf(n)}>{n % 12 === 0 ? nameOf(n) : ""}{n >= 48 && n <= 60 && <kbd>{KEYS[n - 48]}</kbd>}</button>)}
        {Array.from({ length: HIGH - LOW }, (_, i) => LOW + i).filter((n) => BLACK.includes(n % 12)).map((n) => {
          const before = whites.filter((w) => w < n).length;
          return <button key={n} className={`sk black${lit === n ? " lit" : ""}`} style={{ left: `calc(${(before / whites.length) * 100}% - 1.1%)` }} onPointerDown={() => play(n)} aria-label={nameOf(n)}>{n >= 48 && n <= 60 && <kbd>{KEYS[n - 48]}</kbd>}</button>;
        })}
      </div>
      <p className="muted">Click a key, or use the letter keys A to K (W, E, T, Y, U are the black keys). Change a setting, then pluck again: a note already ringing keeps the settings it was plucked with.</p>
      {course.steps}
      {!course.lesson && <><section className="exercise strings-match">
        <h3>Match a string by ear <span className="badge">{wins} matched</span></h3>
        {!target ? (
          <><p>A hidden string is set up with its own brightness, decay time and pluck position. Listen to it, then set yours to sound the same. The picture and bars show only your string.</p>
            <button className="primary" onClick={() => { setTarget(stringTarget()); setVerdict(undefined); setS((old) => ({ ...STRING_INITIAL, exciter: old.exciter === "noise" ? "pluck" : old.exciter })); }}>Give me a string to match</button></>
        ) : (
          <><div className="toolbar">
              <button className="primary" onClick={() => play(45, target)}>Hear the target</button>
              <button onClick={() => play(45)}>Hear mine</button>
              <button onClick={() => { const v = judgeString(s, target); setVerdict(v); if (v.all) setWins((w) => w + 1); }}>Check</button>
              <button className="link" onClick={() => { setTarget(undefined); setVerdict(undefined); }}>Stop</button>
            </div>
            {verdict && (verdict.all ? <p role="status"><strong>That matches.</strong> <button className="link" onClick={() => { setTarget(stringTarget()); setVerdict(undefined); }}>Another one</button></p> : (
              <ul role="status" className="strings-verdict">
                <li>Brightness: {verdict.bright === "matches" ? "matches" : verdict.bright === "low" ? "yours is too dull" : "yours is too bright"}</li>
                <li>Decay time: {verdict.decay === "matches" ? "matches" : verdict.decay === "low" ? "yours dies away too soon" : "yours rings too long"}</li>
                <li>Pluck position: {verdict.pick === "matches" ? "matches" : verdict.pick === "low" ? "yours is too near the bridge" : "yours is too near the middle"}</li>
              </ul>
            ))}
            <p className="muted">Both are played on the same low note. Leave Pick hardness, Listening position and Second string where they are: the target does not change them.</p></>
        )}
      </section>
      <section className="exercise strings-tries">
        <h3>Things to try <span className="badge">{done.length} of {TRIES.length}</span></h3>
        <ol>{TRIES.map((t) => <li key={t.id} className={done.includes(t.id) ? "done" : ""}><strong>{done.includes(t.id) ? "✓ " : ""}{t.say}</strong> <span>{t.hear}</span></li>)}</ol>
      </section></>}
      <aside className="strings-source">
        <h3>Where this comes from</h3>
        <p>The loop with a two-sample average in it is the Karplus-Strong plucked-string method, built here as Julius O. Smith describes it in “Physical Modeling Using Digital Waveguides” (Computer Music Journal, 1992), which is in the library. The fine tuning follows Jaffe and Smith’s extension of that method.</p>
        <p><strong>What is missing here.</strong> This is one ideal string and nothing else. There is no body to colour it, no stiffness (which pulls a piano’s harmonics sharp), no sympathetic strings, and no bow. A note cannot be bent or muted once it is ringing, because each note is worked out before it plays. Those come with later parts of this track. How it sounds has not yet been judged by a person.</p>
      </aside>
    </section>
  );
}
