// The tube lab: a blown tube with a reed, the simplest clarinet-like model. Unlike the string and the drum
// it does not ring down by itself: it sounds for as long as it is blown, and only when the breath is in the
// range where the reed and the tube feed each other. Each note is worked out whole by src/modal/tube.ts.
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { TUBE_LESSONS } from "../models/lessons";
import { noteToHz } from "../synth/params";
import { measuredHarmonics, renderTube, speakingRange, TUBE_INITIAL, TUBE_RANGES, type TubeState } from "../modal/tube";
import { useModelLesson } from "./ModelLesson";

const KEYS = "awsedftgyhujk";
const LOW = 36, HIGH = 72, BLACK = [1, 3, 6, 8, 10];
const NAMES = ["C", "C#", "D", "D#", "E", "F", "F#", "G", "G#", "A", "A#", "B"];
const nameOf = (note: number) => `${NAMES[note % 12]}${Math.floor(note / 12) - 1}`;
const BLOWN = 1.4; // seconds each note is blown for

export default function TubeLab() {
  const [s, setS] = useState<TubeState>(TUBE_INITIAL);
  const [last, setLast] = useState(57);
  const [lit, setLit] = useState<number>();
  const [silent, setSilent] = useState(false);
  const ctx = useRef<AudioContext | undefined>(undefined);
  const state = useRef(s); state.current = s;
  const course = useModelLesson(TUBE_LESSONS, (settings) => setS({ ...TUBE_INITIAL, ...settings }));
  const coursePlay = useRef(course.onPlay); coursePlay.current = course.onPlay;

  const play = useCallback((note: number) => {
    const now = state.current;
    if (!ctx.current) ctx.current = new AudioContext();
    const c = ctx.current; void c.resume();
    const samples = renderTube(now, note, c.sampleRate, BLOWN);
    let peak = 0; for (let i = Math.round(samples.length * 0.4); i < Math.round(samples.length * 0.7); i++) peak = Math.max(peak, Math.abs(samples[i]!));
    const buffer = c.createBuffer(1, samples.length, c.sampleRate); buffer.getChannelData(0).set(samples);
    const gain = c.createGain(); gain.gain.value = 0.55; gain.connect(c.destination);
    const source = c.createBufferSource(); source.buffer = buffer; source.connect(gain); source.start();
    setSilent(peak < 0.05); setLast(note); setLit(note); window.setTimeout(() => setLit((n) => (n === note ? undefined : n)), 180);
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
  const range = useMemo(() => speakingRange(s), [s.reed, s.bright]); // eslint-disable-line react-hooks/exhaustive-deps
  const bars = useMemo(() => measuredHarmonics(renderTube({ ...s, noise: 0 }, last, 24000, 0.8, 0), hz, 24000, 12), [s, last, hz]);
  const sounding = range[Math.round(s.breath / 5)] ?? false;
  const first = range.indexOf(true) * 5, lastOn = range.lastIndexOf(true) * 5;
  const whites = Array.from({ length: HIGH - LOW + 1 }, (_, i) => LOW + i).filter((n) => !BLACK.includes(n % 12));
  return (
    <section className="strings">
      <h2>Tube lab: a blown tube with a reed</h2>
      {course.chooser}
      {course.intro}
      {!course.lesson && <p className="strings-lead">A string and a drum are hit and left to ring. A blown instrument is fed all the time: breath pushes past a reed into a tube, a wave runs to the open end and comes back upside down, and what comes back opens and closes the reed in time with itself. With the right amount of breath the loop keeps itself going.</p>}
      <div className="strings-grid">
        <div className="strings-panel">
          <svg className="strings-string" viewBox="0 0 400 96" role="img" aria-label="The tube: a mouthpiece with a reed at the left, a straight bore, and an open end at the right">
            <path d="M40 34 H330 L372 18 V78 L330 62 H40 Z" className="tube-bore" />
            <path d="M40 34 L14 42 V54 L40 62 Z" className="tube-mouth" />
            <line x1="16" y1={56 - (s.reed / 100) * 4} x2="58" y2="60" className="tube-reed" />
            <text x="26" y="80" textAnchor="middle" className="strings-label">reed</text><text x="190" y="52" textAnchor="middle" className="strings-label">the wave runs to the open end and back, upside down</text><text x="356" y="92" textAnchor="middle" className="strings-label">open end</text>
          </svg>
          <div className="strings-controls">
            {(Object.keys(TUBE_RANGES) as (keyof TubeState)[]).map((id) => { const r = TUBE_RANGES[id]; return (
              <label key={id} className="strings-range">{r.label}
                <input type="range" min={r.min} max={r.max} step={r.step} value={s[id]} onChange={(e) => setS((o) => ({ ...o, [id]: Number(e.target.value) }))} aria-label={r.label} />
                <span className="strings-value">{s[id]} {r.unit}</span>
              </label>
            ); })}
          </div>
        </div>
        <div className="strings-panel">
          <h3>Where it speaks</h3>
          <svg className="tube-range" viewBox="0 0 210 34" role="img" aria-label={`With this reed the tube sounds for breath from about ${first}% to ${lastOn}%`}>
            {range.map((on, i) => <rect key={i} x={i * 10} y="6" width="9" height="16" className={on ? "on" : ""} />)}
            <path d={`M${(s.breath / 100) * 200 + 4.5} 26 l-5 8 h10 z`} className="strings-pick" />
          </svg>
          <p className="strings-caption">Left to right is breath, from none to full. Lit blocks are breaths that make this reed sound (about {first}% to {lastOn}%); the marker is your breath{sounding ? "" : ": outside the range, so a note will not hold"}. Too little and the loop cannot feed itself. Too much and the reed is blown shut.</p>
          <h3>The harmonics it makes</h3>
          <svg className="strings-bars" viewBox="0 0 240 90" role="img" aria-label="The size of each harmonic in the held note">
            {bars.map((v, i) => <rect key={i} x={i * 20 + 2} width="14" y={84 - v * 78} height={Math.max(1, v * 78)} className={v < 0.03 ? "gone" : ""} />)}
            <line x1="0" x2="240" y1="84.5" y2="84.5" className="strings-rest" />
          </svg>
          <p className="strings-caption">Harmonics 1 to 12 of {nameOf(last)} ({hz.toFixed(0)} Hz), measured from the note this model makes. {silent && <strong>That breath made no steady note.</strong>}</p>
        </div>
      </div>
      <div className="strings-keys" role="group" aria-label="Keys: click to blow a note">
        {whites.map((n) => <button key={n} className={`sk white${lit === n ? " lit" : ""}`} onPointerDown={() => play(n)} aria-label={nameOf(n)}>{n % 12 === 0 ? nameOf(n) : ""}{n >= 48 && n <= 60 && <kbd>{KEYS[n - 48]}</kbd>}</button>)}
        {Array.from({ length: HIGH - LOW }, (_, i) => LOW + i).filter((n) => BLACK.includes(n % 12)).map((n) => {
          const before = whites.filter((w) => w < n).length;
          return <button key={n} className={`sk black${lit === n ? " lit" : ""}`} style={{ left: `calc(${(before / whites.length) * 100}% - 1.1%)` }} onPointerDown={() => play(n)} aria-label={nameOf(n)}>{n >= 48 && n <= 60 && <kbd>{KEYS[n - 48]}</kbd>}</button>;
        })}
      </div>
      <p className="muted">Click a key, or use the letter keys A to K. Each note is blown for {BLOWN} seconds.</p>
      {course.steps}
      <aside className="strings-source">
        <h3>Where this comes from</h3>
        <p>The layout (a straight tube as a delay line, an open end that sends the low part of the wave back, and a reed worked as one look-up from the pressure difference to how much is reflected) follows the section on single-reed instruments in Julius O. Smith’s “Physical Modeling Using Digital Waveguides” (1992), which is in the library. That paper notes that a clarinet’s tube is only a quarter of a wavelength of its lowest note.</p>
        <p><strong>What is missing here.</strong> The reed’s curve and every number in it are this app’s own choices, so where exactly the tube starts and stops speaking is a property of this model, not a measurement of a clarinet. How much of the highs the open end sends back, and the small wander in the breath, are this app’s numbers too. There are no finger holes, no flared bell and no player’s mouth, and you cannot change the breath during a note. The assistant that built this cannot hear: it was checked by measurement only.</p>
      </aside>
    </section>
  );
}
