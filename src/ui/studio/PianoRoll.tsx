// The piano roll: keys down the side, steps along the top, a bar for every note.
// Draw mode off (the default, as in Ableton): drag on an empty place to select notes with a box, click a note
// to select it (Shift adds), drag selected notes to move them, drag a right end to change length, double-click
// an empty place to add a note, double-click a note to remove it. Draw mode on (B): click or drag to write
// notes, click a note to remove it. Right-click always removes.
import { useEffect, useLayoutEffect, useRef, useState } from "react";
import { STEPS_PER_BAR } from "../../daw/drums";
import { noteKey, shiftNotes, stretchNotes, type NoteEv, type SynthClip } from "../../daw/song";

const TOP = 84, BOTTOM = 36, ROW = 15, COL = 26;
const NAMES = ["C", "C♯", "D", "D♯", "E", "F", "F♯", "G", "G♯", "A", "A♯", "B"];
export const noteName = (n: number) => `${NAMES[n % 12]}${Math.floor(n / 12) - 1}`;
const isBlack = (n: number) => [1, 3, 6, 8, 10].includes(n % 12);
type Drag = { mode: "draw"; now: NoteEv } | { mode: "move" | "size"; keys: Set<string>; col: number; row: number } | { mode: "box"; c0: number; r0: number; base: Set<string> };

export function PianoRoll({ clip, onNotes, onHear, step, sel, onSel, draw }: { clip: SynthClip; onNotes: (notes: NoteEv[]) => void; onHear: (note: number) => void; step: number; sel: ReadonlySet<string>; onSel: (keys: Set<string>) => void; draw: boolean }) {
  const steps = clip.bars * STEPS_PER_BAR, rows = TOP - BOTTOM + 1;
  const box = useRef<HTMLDivElement>(null), area = useRef<HTMLDivElement>(null);
  const notes = useRef(clip.notes); notes.current = clip.notes;
  const lastLength = useRef(4);
  const drag = useRef<Drag | null>(null);
  const [rect, setRect] = useState<{ c0: number; c1: number; r0: number; r1: number } | null>(null);
  useLayoutEffect(() => {
    const mid = clip.notes.length ? (Math.max(...clip.notes.map((n) => n.note)) + Math.min(...clip.notes.map((n) => n.note))) / 2 : 62;
    if (box.current) box.current.scrollTop = Math.max(0, (TOP - mid) * ROW - box.current.clientHeight / 2);
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [clip.id]);
  const at = (e: { clientX: number; clientY: number }) => {
    const r = area.current!.getBoundingClientRect();
    return { col: Math.min(steps - 1, Math.max(0, Math.floor((e.clientX - r.left) / COL))), row: Math.min(rows - 1, Math.max(0, Math.floor((e.clientY - r.top) / ROW))), x: e.clientX - r.left };
  };
  const without = (n: NoteEv) => notes.current.filter((x) => noteKey(x) !== noteKey(n));
  useEffect(() => {
    const move = (e: MouseEvent) => {
      const d = drag.current;
      if (!d) return;
      const p = at(e);
      if (d.mode === "draw") {
        const next = { ...d.now, length: Math.max(1, p.col - d.now.start + 1) };
        if (next.length === d.now.length) return;
        onNotes([...without(d.now), next]); drag.current = { mode: "draw", now: next }; lastLength.current = next.length;
      } else if (d.mode === "box") {
        const c0 = Math.min(d.c0, p.col), c1 = Math.max(d.c0, p.col), r0 = Math.min(d.r0, p.row), r1 = Math.max(d.r0, p.row);
        setRect({ c0, c1, r0, r1 });
        onSel(new Set([...d.base, ...notes.current.filter((n) => { const r = TOP - n.note; return r >= r0 && r <= r1 && n.start <= c1 && n.start + n.length - 1 >= c0; }).map(noteKey)]));
      } else if (d.mode === "move") {
        const by = p.col - d.col, up = d.row - p.row;
        if (!by && !up) return;
        const r = shiftNotes(notes.current, d.keys, by, up, steps);
        if (r.notes !== notes.current) { if (up) { const first = r.notes.find((n) => r.keys.has(noteKey(n))); if (first) onHear(first.note); } onNotes(r.notes); onSel(r.keys); }
        drag.current = { ...d, keys: r.keys, col: p.col, row: p.row };
      } else {
        const by = p.col - d.col;
        if (!by) return;
        onNotes(stretchNotes(notes.current, d.keys, by, steps)); drag.current = { ...d, col: p.col };
      }
    };
    const up = () => { drag.current = null; setRect(null); };
    window.addEventListener("mousemove", move); window.addEventListener("mouseup", up);
    return () => { window.removeEventListener("mousemove", move); window.removeEventListener("mouseup", up); };
  });
  const add = (note: number, col: number): NoteEv => { const made: NoteEv = { note, start: col, length: Math.min(lastLength.current, steps - col), velocity: 100 }; onNotes([...without(made), made]); onHear(note); return made; };
  const down = (e: React.MouseEvent) => {
    e.preventDefault();
    const p = at(e), note = TOP - p.row, hit = notes.current.find((n) => n.note === note && p.col >= n.start && p.col < n.start + n.length);
    if (e.button === 2) { if (hit) { onNotes(without(hit)); onSel(new Set([...sel].filter((k) => k !== noteKey(hit)))); } return; }
    if (draw) { if (hit) onNotes(without(hit)); else { const made = add(note, p.col); onSel(new Set([noteKey(made)])); drag.current = { mode: "draw", now: made }; } return; }
    if (hit) {
      const k = noteKey(hit);
      if (e.detail >= 2) { onNotes(without(hit)); onSel(new Set([...sel].filter((x) => x !== k))); return; }
      if (e.shiftKey && sel.has(k)) { onSel(new Set([...sel].filter((x) => x !== k))); return; }
      const keys = sel.has(k) ? new Set(sel) : e.shiftKey ? new Set([...sel, k]) : new Set([k]);
      onSel(keys); onHear(hit.note);
      drag.current = { mode: p.x > (hit.start + hit.length) * COL - 7 ? "size" : "move", keys, col: p.col, row: p.row };
      return;
    }
    if (e.detail >= 2) { const made = add(note, p.col); onSel(new Set([noteKey(made)])); return; }
    drag.current = { mode: "box", c0: p.col, r0: p.row, base: e.shiftKey ? new Set(sel) : new Set() };
    if (!e.shiftKey) onSel(new Set());
  };
  return (
    <div className={`roll${draw ? " drawing" : ""}`} ref={box}>
      <div className="roll-inner" style={{ width: 52 + steps * COL, height: rows * ROW }}>
        <div className="roll-keys">
          {Array.from({ length: rows }, (_, i) => { const n = TOP - i; return <button key={n} className={`roll-key${isBlack(n) ? " black" : ""}`} style={{ height: ROW }} onMouseDown={() => onHear(n)} aria-label={`Hear ${noteName(n)}`} tabIndex={-1}>{n % 12 === 0 ? noteName(n) : ""}</button>; })}
        </div>
        <div className="roll-area" ref={area} onMouseDown={down} onContextMenu={(e) => e.preventDefault()} style={{ width: steps * COL, backgroundSize: `${COL}px ${ROW}px, ${COL * 4}px ${ROW}px, ${COL * 16}px ${ROW}px` }} role="application" aria-label="Piano roll">
          {Array.from({ length: rows }, (_, i) => { const n = TOP - i; return isBlack(n) || n % 12 === 0 ? <div key={n} className={isBlack(n) ? "roll-row black" : "roll-row c"} style={{ top: i * ROW, height: ROW }} /> : null; })}
          {clip.notes.map((n) => <div key={noteKey(n)} className={`roll-note${sel.has(noteKey(n)) ? " picked" : ""}`} style={{ left: n.start * COL + 1, top: (TOP - n.note) * ROW + 1, width: n.length * COL - 2, height: ROW - 2 }} title={`${noteName(n.note)}, ${n.length} step${n.length === 1 ? "" : "s"}`}>{n.length > 1 ? noteName(n.note) : ""}</div>)}
          {rect && <div className="roll-box" style={{ left: rect.c0 * COL, top: rect.r0 * ROW, width: (rect.c1 - rect.c0 + 1) * COL, height: (rect.r1 - rect.r0 + 1) * ROW }} />}
          {step >= 0 && <div className="roll-now" style={{ left: step * COL }} />}
        </div>
      </div>
    </div>
  );
}
