// The piano roll: keys down the side, steps along the top, a bar for every note. Click an empty place to
// add a note and drag right to make it longer; drag a note to move it, drag its right end to change its
// length; double-click or right-click a note to remove it.
import { useEffect, useLayoutEffect, useRef } from "react";
import { STEPS_PER_BAR } from "../../daw/drums";
import type { NoteEv, SynthClip } from "../../daw/song";

const TOP = 84, BOTTOM = 36, ROW = 15, COL = 26;
const NAMES = ["C", "C♯", "D", "D♯", "E", "F", "F♯", "G", "G♯", "A", "A♯", "B"];
export const noteName = (n: number) => `${NAMES[n % 12]}${Math.floor(n / 12) - 1}`;
const isBlack = (n: number) => [1, 3, 6, 8, 10].includes(n % 12);

export function PianoRoll({ clip, onNotes, onHear, step }: { clip: SynthClip; onNotes: (notes: NoteEv[]) => void; onHear: (note: number) => void; step: number }) {
  const steps = clip.bars * STEPS_PER_BAR, rows = TOP - BOTTOM + 1;
  const box = useRef<HTMLDivElement>(null), area = useRef<HTMLDivElement>(null);
  const notes = useRef(clip.notes); notes.current = clip.notes;
  const lastLength = useRef(4);
  const drag = useRef<{ mode: "size" | "move"; now: NoteEv; col: number; row: number } | null>(null);
  // open on the notes that are there, or around middle C
  useLayoutEffect(() => {
    const mid = clip.notes.length ? (Math.max(...clip.notes.map((n) => n.note)) + Math.min(...clip.notes.map((n) => n.note))) / 2 : 62;
    if (box.current) box.current.scrollTop = Math.max(0, (TOP - mid) * ROW - box.current.clientHeight / 2);
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [clip.id]);
  const at = (e: { clientX: number; clientY: number }) => {
    const r = area.current!.getBoundingClientRect();
    return { col: Math.min(steps - 1, Math.max(0, Math.floor((e.clientX - r.left) / COL))), row: Math.min(rows - 1, Math.max(0, Math.floor((e.clientY - r.top) / ROW))), x: e.clientX - r.left };
  };
  const swap = (old: NoteEv | undefined, next: NoteEv | undefined) => onNotes([...notes.current.filter((n) => !(old && n.note === old.note && n.start === old.start)), ...(next ? [next] : [])]);
  useEffect(() => {
    const move = (e: MouseEvent) => {
      const d = drag.current;
      if (!d) return;
      const p = at(e);
      let next = d.now;
      if (d.mode === "size") next = { ...d.now, length: Math.max(1, p.col - d.now.start + 1) };
      else next = { ...d.now, start: Math.min(steps - d.now.length, Math.max(0, d.now.start + p.col - d.col)), note: Math.min(TOP, Math.max(BOTTOM, d.now.note - (p.row - d.row))) };
      if (next.start === d.now.start && next.note === d.now.note && next.length === d.now.length) return;
      if (next.note !== d.now.note) onHear(next.note);
      swap(d.now, next);
      drag.current = { ...d, now: next, col: p.col, row: p.row };
      if (d.mode === "size") lastLength.current = next.length;
    };
    const up = () => { drag.current = null; };
    window.addEventListener("mousemove", move); window.addEventListener("mouseup", up);
    return () => { window.removeEventListener("mousemove", move); window.removeEventListener("mouseup", up); };
  });
  const down = (e: React.MouseEvent) => {
    e.preventDefault();
    const p = at(e), note = TOP - p.row, hit = notes.current.find((n) => n.note === note && p.col >= n.start && p.col < n.start + n.length);
    if (hit) {
      if (e.button === 2 || e.detail >= 2) { swap(hit, undefined); return; }
      onHear(hit.note);
      drag.current = { mode: p.x > (hit.start + hit.length) * COL - 7 ? "size" : "move", now: hit, col: p.col, row: p.row };
      return;
    }
    if (e.button === 2) return;
    const made: NoteEv = { note, start: p.col, length: Math.min(lastLength.current, steps - p.col), velocity: 100 };
    swap(undefined, made); onHear(note);
    drag.current = { mode: "size", now: made, col: p.col, row: p.row };
  };
  return (
    <div className="roll" ref={box}>
      <div className="roll-inner" style={{ width: 52 + steps * COL, height: rows * ROW }}>
        <div className="roll-keys">
          {Array.from({ length: rows }, (_, i) => { const n = TOP - i; return <button key={n} className={`roll-key${isBlack(n) ? " black" : ""}`} style={{ height: ROW }} onMouseDown={() => onHear(n)} aria-label={`Hear ${noteName(n)}`} tabIndex={-1}>{n % 12 === 0 ? noteName(n) : ""}</button>; })}
        </div>
        <div className="roll-area" ref={area} onMouseDown={down} onContextMenu={(e) => e.preventDefault()} style={{ width: steps * COL, backgroundSize: `${COL}px ${ROW}px, ${COL * 4}px ${ROW}px, ${COL * 16}px ${ROW}px` }} role="application" aria-label="Piano roll">
          {Array.from({ length: rows }, (_, i) => { const n = TOP - i; return isBlack(n) || n % 12 === 0 ? <div key={n} className={isBlack(n) ? "roll-row black" : "roll-row c"} style={{ top: i * ROW, height: ROW }} /> : null; })}
          {clip.notes.map((n) => <div key={`${n.note}:${n.start}`} className="roll-note" style={{ left: n.start * COL + 1, top: (TOP - n.note) * ROW + 1, width: n.length * COL - 2, height: ROW - 2 }} title={`${noteName(n.note)}, ${n.length} step${n.length === 1 ? "" : "s"}`}>{n.length > 1 ? noteName(n.note) : ""}</div>)}
          {step >= 0 && <div className="roll-now" style={{ left: step * COL }} />}
        </div>
      </div>
    </div>
  );
}
