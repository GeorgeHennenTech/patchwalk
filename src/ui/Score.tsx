// Sheet music you play along with. The staff is drawn by code from a Score. The note to play next is
// ringed; notes already played turn green; "Listen" plays the page with a marker moving along it.
import { useEffect, useRef, useState } from "react";
import { follow, ledgerLines, staffPlace, timing, type Score } from "../course/score";
import type { Synth } from "../synth/useSynth";

const GAP = 10, TOP = 44, BOTTOM = TOP + 4 * GAP, LEFT = 64, SPACE = 46;
const yOf = (step: number) => BOTTOM - step * (GAP / 2);
const NAMES_KEY = "patchwalk.score.names.v1";

export function ScoreView({ score, sequence, synth }: { score: Score; sequence: readonly number[]; synth: Synth }) {
  const [names, setNames] = useState(() => { try { return localStorage.getItem(NAMES_KEY) !== "off"; } catch { return true; } });
  const [playing, setPlaying] = useState<number>();
  const timers = useRef<ReturnType<typeof setTimeout>[]>([]);
  useEffect(() => () => timers.current.forEach(clearTimeout), []);
  const f = follow(score, sequence), finished = f.completed >= 1 && f.at === 0 && f.part.length === 0;
  const { starts } = timing(score);
  const width = LEFT + score.items.length * SPACE + 24, height = names ? 150 : 118;
  const listen = () => {
    const e = synth.engine.current;
    if (!e) return;
    timers.current.forEach(clearTimeout); timers.current = [];
    const beat = 60 / Math.max(40, synth.state.bpm), t0 = e.ctx.currentTime + 0.08;
    score.items.forEach((it, i) => {
      for (const n of it.notes) e.playAt(n, t0 + starts[i]! * beat, it.beats * beat * 0.9);
      timers.current.push(setTimeout(() => setPlaying(i), (0.08 + starts[i]! * beat) * 1000));
    });
    timers.current.push(setTimeout(() => setPlaying(undefined), (0.08 + (starts[starts.length - 1]! + score.items[score.items.length - 1]!.beats) * beat) * 1000));
  };
  const toggle = () => { const next = !names; setNames(next); try { localStorage.setItem(NAMES_KEY, next ? "on" : "off"); } catch { /* not remembered */ } };
  const bars: number[] = [];
  starts.forEach((s, i) => { if (i > 0 && s % 4 === 0) bars.push(i); });
  return (
    <div className="score">
      <div className="score-bar">
        {score.title && <strong>{score.title}</strong>}
        <button className="primary" onClick={() => (synth.running ? listen() : void synth.start())}>{synth.running ? "Listen" : "Start audio"}</button>
        <button className="link" onClick={toggle} aria-pressed={names}>Note names: {names ? "on" : "off"}</button>
        <span className="score-status" role="status">{finished ? "Played through. Go again if you like." : f.wrong ? "Not that one. Look at the ringed note." : `Note ${f.at + 1} of ${score.items.length}`}</span>
      </div>
      <div className="score-scroll">
        <svg className="score-staff" viewBox={`0 0 ${width} ${height}`} style={{ width: Math.min(width, 980), minWidth: Math.min(width, 520) }} role="img" aria-label={`Sheet music: ${score.items.map((it) => it.notes.map((n) => staffPlace(n).name).join(" and ")).join(", ")}`}>
          {[0, 1, 2, 3, 4].map((l) => <line key={l} x1="8" x2={width - 8} y1={TOP + l * GAP} y2={TOP + l * GAP} className="score-line" />)}
          <text x="10" y={BOTTOM + 9} className="score-clef">{"\u{1D11E}"}</text>
          {bars.map((i) => <line key={i} x1={LEFT + i * SPACE - SPACE / 2 + 6} x2={LEFT + i * SPACE - SPACE / 2 + 6} y1={TOP} y2={BOTTOM} className="score-line" />)}
          <line x1={width - 8} x2={width - 8} y1={TOP} y2={BOTTOM} className="score-end" />
          {score.items.map((it, i) => {
            const x = LEFT + i * SPACE + 10, state = playing === i ? "sounding" : finished || i < f.at ? "done" : i === f.at ? (f.wrong ? "now wrong" : "now") : "";
            const places = it.notes.map(staffPlace), top = Math.max(...places.map((p) => p.step)), low = Math.min(...places.map((p) => p.step)), up = (top + low) / 2 < 4;
            return (
              <g key={i} className={`score-note ${state}`}>
                {state.startsWith("now") && <rect x={x - 17} y={TOP - 26} width="34" height={BOTTOM - TOP + 50} rx="8" className="score-here" />}
                {places.flatMap((p) => ledgerLines(p.step)).filter((s, k, a) => a.indexOf(s) === k).map((s) => <line key={s} x1={x - 11} x2={x + 11} y1={yOf(s)} y2={yOf(s)} className="score-line" />)}
                {it.beats < 4 && (up ? <line x1={x + 6.2} x2={x + 6.2} y1={yOf(low)} y2={yOf(top) - 31} className="score-stem" /> : <line x1={x - 6.2} x2={x - 6.2} y1={yOf(top)} y2={yOf(low) + 31} className="score-stem" />)}
                {places.map((p, k) => (
                  <g key={k}>
                    {p.sharp && <text x={x - 20} y={yOf(p.step) + 4.5} className="score-sharp">♯</text>}
                    <ellipse cx={x} cy={yOf(p.step)} rx="6.6" ry="4.7" transform={`rotate(-20 ${x} ${yOf(p.step)})`} className={it.beats >= 2 ? "score-head open" : "score-head"} />
                  </g>
                ))}
                {names && <text x={x} y={height - 22} textAnchor="middle" className="score-name">{places.map((p) => p.name).join(" ")}</text>}
                {names && <text x={x} y={height - 7} textAnchor="middle" className="score-key">{places.map((p) => p.key).join(" ")}</text>}
              </g>
            );
          })}
        </svg>
      </div>
      <p className="muted score-help">Play the ringed note; the page waits for you and moves on when you get it. Any octave counts. {names ? "Under each note: its name, then the letter key that plays it." : ""}</p>
    </div>
  );
}
