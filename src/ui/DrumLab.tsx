// The drum lab: a drum head as a set of ringing modes. Click the head to hit it there; the bars show which
// modes that hit sets going. Every hit is worked out whole by src/modal/membrane.ts and then played.
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { noteToHz } from "../synth/params";
import { DRUM_INITIAL, DRUM_RANGES, HEADS, modeDecay, modes, renderDrum, type DrumState } from "../modal/membrane";

const NAMES = ["C", "C#", "D", "D#", "E", "F", "F#", "G", "G#", "A", "A#", "B"];
const nameOf = (note: number) => `${NAMES[note % 12]}${Math.floor(note / 12) - 1}`;
const HEAD_NAMES = { round: "Round", square: "Square" } as const;
interface Try { id: string; say: string; hear: string; done: (s: DrumState) => boolean }
const TRIES: Try[] = [
  { id: "centre", say: "Hit the head in the dead centre.", hear: "A plain, round thump. Only a few bars stand: the patterns that move at the centre.", done: (s) => s.strike <= 3 },
  { id: "edge", say: "Hit it more than 70% of the way out.", hear: "Thinner and more clangy. Many more bars stand, and none of them line up as a tidy series.", done: (s) => s.strike >= 70 },
  { id: "dry", say: "Turn Damping of the high modes above 85% and hit it off centre.", hear: "The clang is gone almost at once and a single low note is left: a tom.", done: (s) => s.damp >= 85 && s.strike >= 20 },
  { id: "ring", say: "Turn Damping below 15% and Ring time above 3 s.", hear: "Every mode rings on together: more like a gong or a metal plate than a drum.", done: (s) => s.damp <= 15 && s.decay >= 3 },
  { id: "square", say: "Change the head to Square and hit it off centre.", hear: "A different set of notes inside the hit: the same idea, another shape, other frequencies.", done: (s) => s.head === "square" && s.strike >= 20 },
];

export default function DrumLab() {
  const [s, setS] = useState<DrumState>(DRUM_INITIAL);
  const [done, setDone] = useState<string[]>([]);
  const [flash, setFlash] = useState(0);
  const ctx = useRef<AudioContext | undefined>(undefined);
  const state = useRef(s); state.current = s;
  const hit = useCallback((over?: Partial<DrumState>) => {
    const now = { ...state.current, ...over };
    if (over) setS(now);
    if (!ctx.current) ctx.current = new AudioContext();
    const c = ctx.current; void c.resume();
    const samples = renderDrum(now, c.sampleRate, Math.min(6, Math.max(0.5, now.decay * 1.3)));
    const buffer = c.createBuffer(1, samples.length, c.sampleRate); buffer.getChannelData(0).set(samples);
    const source = c.createBufferSource(); source.buffer = buffer; source.connect(c.destination); source.start();
    setFlash((f) => f + 1);
    setDone((d) => { const more = TRIES.filter((t) => !d.includes(t.id) && t.done(now)).map((t) => t.id); return more.length ? [...d, ...more] : d; });
  }, []);
  useEffect(() => {
    const down = (e: KeyboardEvent) => { if (e.code === "Space" && !e.repeat && (e.target as HTMLElement | null)?.tagName !== "BUTTON") { e.preventDefault(); hit(); } };
    window.addEventListener("keydown", down);
    return () => { window.removeEventListener("keydown", down); void ctx.current?.close(); ctx.current = undefined; };
  }, [hit]);
  const list = useMemo(() => modes(s), [s]);
  const top = list[list.length - 1]!.ratio, f0 = noteToHz(s.note);
  const strikeAt = (e: React.PointerEvent<SVGSVGElement>) => {
    const box = e.currentTarget.getBoundingClientRect(), x = ((e.clientX - box.left) / box.width) * 2 - 1, y = ((e.clientY - box.top) / box.height) * 2 - 1;
    const r = s.head === "round" ? Math.hypot(x, y) : Math.max(Math.abs(x), Math.abs(y));
    hit({ strike: Math.round(Math.min(0.95, r / 0.9) * 100) });
  };
  const dot = s.head === "round" ? { x: 100 + (s.strike / 100) * 81, y: 100 } : { x: 100 + (s.strike / 100) * 81, y: 100 - (s.strike / 100) * 81 };
  return (
    <section className="strings">
      <h2>Drum lab: a head made of modes</h2>
      <p className="strings-lead">A stretched skin can only vibrate in certain patterns, called modes, and each has its own frequency. A hit sets several going at once. Unlike a string’s harmonics, a drum’s modes are not whole multiples of the lowest one, which is why a drum has a pitch you can only half name.</p>
      <div className="strings-grid">
        <div className="strings-panel">
          <svg className="drum-head" viewBox="0 0 200 200" role="img" aria-label={`The drum head seen from above, hit ${s.strike}% of the way out from the centre. Click to hit it somewhere else.`} onPointerDown={strikeAt}>
            {s.head === "round" ? <><circle cx="100" cy="100" r="92" className="drum-rim" /><circle cx="100" cy="100" r="86" className="drum-skin" /></> : <><rect x="8" y="8" width="184" height="184" rx="6" className="drum-rim" /><rect x="14" y="14" width="172" height="172" className="drum-skin" /></>}
            <circle key={flash} cx={dot.x} cy={dot.y} r="6" className="drum-hit" /><circle cx={dot.x} cy={dot.y} r="3.5" className="drum-dot" />
          </svg>
          <div className="strings-controls">
            <label className="strings-choice">Head
              <span className="seg">{HEADS.map((h) => <button key={h} className={s.head === h ? "on" : ""} aria-pressed={s.head === h} onClick={() => setS((o) => ({ ...o, head: h }))}>{HEAD_NAMES[h]}</button>)}</span>
              <button className="primary" onClick={() => hit()}>Hit it</button>
            </label>
            {(Object.keys(DRUM_RANGES) as (keyof typeof DRUM_RANGES)[]).map((id) => { const r = DRUM_RANGES[id]; return (
              <label key={id} className="strings-range">{r.label}
                <input type="range" min={r.min} max={r.max} step={r.step} value={s[id]} onChange={(e) => setS((o) => ({ ...o, [id]: Number(e.target.value) }))} aria-label={r.label} />
                <span className="strings-value">{id === "note" ? nameOf(s.note) : id === "strike" ? (s.strike === 0 ? "dead centre" : `${s.strike}% out`) : `${s[id]} ${r.unit}`}</span>
              </label>
            ); })}
          </div>
        </div>
        <div className="strings-panel">
          <h3>The modes this hit sets going</h3>
          <svg className="strings-bars drum-modes" viewBox="0 0 240 96" role="img" aria-label="Each mode's frequency (left to right) and how strongly this hit excites it (height)">
            {Array.from({ length: Math.floor(top) }, (_, i) => <line key={i} x1={((i + 1) / top) * 236 + 2} x2={((i + 1) / top) * 236 + 2} y1="0" y2="84" className="drum-grid" />)}
            {list.map((m) => { const v = Math.abs(m.amount); return <rect key={m.label} x={(m.ratio / top) * 236} width="3" y={84 - v * 80} height={Math.max(1, v * 80)} className={v < 0.03 ? "gone" : ""}><title>{`${m.label}: ${m.ratio.toFixed(2)} times the lowest, ${(f0 * m.ratio).toFixed(0)} Hz, rings ${modeDecay(s, m.ratio).toFixed(2)} s`}</title></rect>; })}
            <line x1="0" x2="240" y1="84.5" y2="84.5" className="strings-rest" />
          </svg>
          <p className="strings-caption">Left to right is frequency; the faint lines mark whole multiples of the lowest mode ({nameOf(s.note)}, {f0.toFixed(0)} Hz), where a string’s harmonics would sit. The bars fall between them. A grey stub is a mode whose pattern stands still where you hit. Point at a bar for its numbers.</p>
          <p className="strings-caption">The first five modes of a round head sit at {modes({ head: "round", strike: 50 }).slice(0, 5).map((m) => m.ratio.toFixed(2)).join(", ")} times the lowest.</p>
        </div>
      </div>
      <p className="muted">Click anywhere on the head to hit it there, or press the space bar to hit it again in the same place.</p>
      <section className="exercise strings-tries">
        <h3>Things to try <span className="badge">{done.length} of {TRIES.length}</span></h3>
        <ol>{TRIES.map((t) => <li key={t.id} className={done.includes(t.id) ? "done" : ""}><strong>{done.includes(t.id) ? "✓ " : ""}{t.say}</strong> <span>{t.hear}</span></li>)}</ol>
      </section>
      <aside className="strings-source">
        <h3>Where this comes from</h3>
        <p>For a round head the patterns and frequencies come from Bessel functions and their zeros, as set out in Avanzini and Marogna’s paper on membrane percussion (2010). For a square head the frequencies go as the square root of m squared plus n squared, as given in Van Duyne and Smith’s paper on the waveguide mesh (1993). Both are in the library.</p>
        <p><strong>What is missing here.</strong> This is an ideal skin by itself. There is no air inside the drum, no shell, no second head and no stick with a size of its own, and the skin’s pitch does not dip after a hard hit as a real one’s does. How quickly each mode dies away is this app’s own simple rule, not a measurement. How it sounds has not yet been judged by a person.</p>
      </aside>
    </section>
  );
}
