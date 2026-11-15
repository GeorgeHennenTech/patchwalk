// The bow lab: a bowed string. It sounds for as long as the bow moves, by sticking to the bow and slipping
// back once per cycle. The map shows what each mix of bow speed and pressure gives. Worked out whole by
// src/strings/bowed.ts and then played.
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { measuredHarmonics } from "../modal/tube";
import { BOW_LESSONS } from "../models/lessons";
import { BOW_GRID, BOW_INITIAL, BOW_RANGES, bowMap, bowResult, renderBowed, type BowState } from "../strings/bowed";
import { noteToHz } from "../synth/params";
import { useModelLesson } from "./ModelLesson";

const KEYS = "awsedftgyhujk";
const LOW = 36, HIGH = 72, BLACK = [1, 3, 6, 8, 10];
const NAMES = ["C", "C#", "D", "D#", "E", "F", "F#", "G", "G#", "A", "A#", "B"];
const nameOf = (note: number) => `${NAMES[note % 12]}${Math.floor(note / 12) - 1}`;
const BOWED = 1.6;
const SAY = { silent: "no sound", note: "a steady note", jumped: "the note has jumped up" } as const;

export default function BowLab() {
  const [s, setS] = useState<BowState>(BOW_INITIAL);
  const [last, setLast] = useState(45);
  const [lit, setLit] = useState<number>();
  const ctx = useRef<AudioContext | undefined>(undefined);
  const state = useRef(s); state.current = s;
  const course = useModelLesson(BOW_LESSONS, (settings) => setS({ ...BOW_INITIAL, ...settings }));
  const coursePlay = useRef(course.onPlay); coursePlay.current = course.onPlay;
  const play = useCallback((note: number) => {
    const now = state.current;
    if (!ctx.current) ctx.current = new AudioContext();
    const c = ctx.current; void c.resume();
    const samples = renderBowed(now, note, c.sampleRate, BOWED, 1.2);
    const buffer = c.createBuffer(1, samples.length, c.sampleRate); buffer.getChannelData(0).set(samples);
    const gain = c.createGain(); gain.gain.value = 0.3;
    const guard = c.createDynamicsCompressor(); guard.threshold.value = -6; guard.ratio.value = 12; // a hard, fast bow is several times louder than a gentle one
    gain.connect(guard).connect(c.destination);
    const source = c.createBufferSource(); source.buffer = buffer; source.connect(gain); source.start();
    setLast(note); setLit(note); window.setTimeout(() => setLit((n) => (n === note ? undefined : n)), 180);
    coursePlay.current(now, note);
  }, []);
  useEffect(() => {
    const down = (e: KeyboardEvent) => {
      if (e.repeat || e.metaKey || e.ctrlKey || e.altKey) return;
      const el = e.target as HTMLElement | null;
      if (el && (el.tagName === "TEXTAREA" || el.tagName === "SELECT" || (el.tagName === "INPUT" && (el as HTMLInputElement).type !== "range"))) return;
      const i = KEYS.indexOf(e.key.toLowerCase());
      if (i >= 0) play(48 + i);
    };
    window.addEventListener("keydown", down);
    return () => { window.removeEventListener("keydown", down); void ctx.current?.close(); ctx.current = undefined; };
  }, [play]);
  const hz = noteToHz(last);
  const map = useMemo(() => bowMap(s, last), [s.position, s.bright, last]); // eslint-disable-line react-hooks/exhaustive-deps
  const result = useMemo(() => bowResult(s, last), [s, last]);
  const bars = useMemo(() => measuredHarmonics(renderBowed(s, last, 24000, 0.9, 0), hz, 24000, 12), [s, last, hz]);
  const whites = Array.from({ length: HIGH - LOW + 1 }, (_, i) => LOW + i).filter((n) => !BLACK.includes(n % 12));
  return (
    <section className="strings">
      <h2>Bow lab: a bowed string</h2>
      {course.chooser}
      {course.intro}
      {!course.lesson && <p className="strings-lead">A bow does not pluck. Its hair grips the string and carries it along, until the string’s pull is too much and it snaps back, is caught again, and is carried again. That happens once in every cycle of the note, for as long as the bow keeps moving, so a bowed note can last and can swell.</p>}
      <div className="strings-grid">
        <div className="strings-panel">
          <svg className="strings-string" viewBox="0 0 400 96" role="img" aria-label={`The string with the bow ${s.position}% of the way along from the bridge`}>
            <line x1="20" x2="380" y1="52" y2="52" className="bow-string" />
            <rect x="12" y="34" width="8" height="36" className="strings-end" /><rect x="380" y="34" width="8" height="36" className="strings-end" />
            <text x="16" y="84" textAnchor="middle" className="strings-label">bridge</text><text x="384" y="84" textAnchor="middle" className="strings-label">nut</text>
            <g transform={`translate(${20 + (s.position / 100) * 360}, 0)`}><rect x="-3" y="8" width="6" height="80" rx="2" className="bow-hair" /><text y="6" textAnchor="middle" className="strings-label">bow</text></g>
          </svg>
          <div className="strings-controls">
            {(Object.keys(BOW_RANGES) as (keyof BowState)[]).map((id) => { const r = BOW_RANGES[id]; return (
              <label key={id} className="strings-range">{r.label}
                <input type="range" min={r.min} max={r.max} step={r.step} value={s[id]} onChange={(e) => setS((o) => ({ ...o, [id]: Number(e.target.value) }))} aria-label={r.label} />
                <span className="strings-value">{s[id]} {r.unit}</span>
              </label>
            ); })}
          </div>
        </div>
        <div className="strings-panel">
          <h3>What the bow gets: {SAY[result]}</h3>
          <svg className="bow-map" viewBox="0 0 150 150" role="img" aria-label="A map of bow speed (left to right) against bow pressure (bottom to top): where the string gives a steady note and where the note jumps up">
            {map.map((row, y) => row.map((r, x) => <rect key={`${x}-${y}`} x={x * 20 + 8} y={y * 20 + 2} width="19" height="19" className={r} />))}
            <circle cx={8 + (s.speed / 100) * 140} cy={2 + (1 - s.pressure / 100) * 140} r="4.5" className="bow-here" />
          </svg>
          <p className="strings-caption">Across: bow speed, slow to fast. Up: bow pressure, light to hard. <span className="bow-key note">Blue</span> is a steady note; <span className="bow-key jumped">yellow</span> is where the bow is too fast for its pressure and the note jumps up; the dot is where you are. The map is for the note you last played ({nameOf(last)}) and is found by trying this model at {BOW_GRID.speeds.length * BOW_GRID.pressures.length} settings.</p>
          <h3>The harmonics it makes</h3>
          <svg className="strings-bars" viewBox="0 0 240 90" role="img" aria-label="The size of each harmonic in the bowed note">
            {bars.map((v, i) => <rect key={i} x={i * 20 + 2} width="14" y={84 - v * 78} height={Math.max(1, v * 78)} className={v < 0.03 ? "gone" : ""} />)}
            <line x1="0" x2="240" y1="84.5" y2="84.5" className="strings-rest" />
          </svg>
          <p className="strings-caption">Harmonics 1 to 12 of {nameOf(last)} ({hz.toFixed(0)} Hz), measured from the note this model makes.</p>
        </div>
      </div>
      <div className="strings-keys" role="group" aria-label="Keys: click to bow a note">
        {whites.map((n) => <button key={n} className={`sk white${lit === n ? " lit" : ""}`} onPointerDown={() => play(n)} aria-label={nameOf(n)}>{n % 12 === 0 ? nameOf(n) : ""}{n >= 48 && n <= 60 && <kbd>{KEYS[n - 48]}</kbd>}</button>)}
        {Array.from({ length: HIGH - LOW }, (_, i) => LOW + i).filter((n) => BLACK.includes(n % 12)).map((n) => {
          const before = whites.filter((w) => w < n).length;
          return <button key={n} className={`sk black${lit === n ? " lit" : ""}`} style={{ left: `calc(${(before / whites.length) * 100}% - 1.1%)` }} onPointerDown={() => play(n)} aria-label={nameOf(n)}>{n >= 48 && n <= 60 && <kbd>{KEYS[n - 48]}</kbd>}</button>;
        })}
      </div>
      <p className="muted">Click a key, or use the letter keys A to K. Each note is bowed for {BOWED} seconds and then left to ring.</p>
      {course.steps}
      <aside className="strings-source">
        <h3>Where this comes from</h3>
        <p>The layout (the string as two delay lines either side of the bow, carrying velocity, with the bow as one look-up from the difference between bow speed and string speed) follows the section on bowed strings in Julius O. Smith’s “Physical Modeling Using Digital Waveguides” (1992). The sticking and slipping itself is set out in McIntyre, Schumacher and Woodhouse, “On the Oscillations of Musical Instruments” (1983). Both are in the library.</p>
        <p><strong>What is missing here.</strong> The curve that says how firmly the bow grips, and every number in it, are this app’s own choices, so the exact edges on the map belong to this model and are not measurements of a violin. There is no body, no twisting of the string, no change of bow speed or pressure during a note, and no vibrato. How it sounds has not yet been judged by a person.</p>
      </aside>
    </section>
  );
}
