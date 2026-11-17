// The piano roll: keys down the side, steps along the top, a bar for every note.
// Draw mode off (the default, as in Ableton): drag on an empty place to select notes with a box, click a note
// to select it (Shift adds), drag selected notes to move them, drag a right end to change length, double-click
// an empty place to add a note, double-click a note to remove it. Draw mode on (B): click or drag to write
// notes, click a note to remove it. Right-click always removes.
import { useEffect, useLayoutEffect, useRef, useState } from "react";
import { STEPS_PER_BAR } from "../../daw/drums";
import { MIN_NOTE, snapStep, inKey, noteKey, setChance, setVelocity, shiftNotes, stretchNotes, type NoteEv, type SynthClip } from "../../daw/song";

const TOP = 84, BOTTOM = 36, ROW = 15, COL = 26, LANE = 58;
const NAMES = ["C", "C♯", "D", "D♯", "E", "F", "F♯", "G", "G♯", "A", "A♯", "B"];
export const noteName = (n: number) => `${NAMES[n % 12]}${Math.floor(n / 12) - 1}`;
const isBlack = (n: number) => [1, 3, 6, 8, 10].includes(n % 12);
type Drag = { mode: "draw"; now: NoteEv } | { mode: "move" | "size"; keys: Set<string>; col: number; row: number } | { mode: "box"; c0: number; r0: number; base: Set<string> };

export function PianoRoll({ clip, onNotes, onHear, step, sel, onSel, draw, scale, grid = 1 }: { /** the grid notes snap to, in sixteenth steps (1 is a sixteenth, 0.5 a thirty-second, 2/3 a sixteenth triplet) */ grid?: number; /** the song's key: rows that belong to it are lit, its key note more strongly */ scale?: { root: number; steps: readonly number[] }; clip: SynthClip; onNotes: (notes: NoteEv[]) => void; onHear: (note: number) => void; step: number; sel: ReadonlySet<string>; onSel: (keys: Set<string>) => void; draw: boolean }) {
  const steps = clip.bars * STEPS_PER_BAR;
  // Fold: show only the rows of the song's key (and any row that already has a note), so a wrong note cannot be written.
  const [fold, setFold] = useState(false);
  const used = new Set(clip.notes.map((n) => n.note));
  const shown: number[] = []; for (let n = TOP; n >= BOTTOM; n--) if (!fold || !scale || inKey(n, scale.root, scale.steps) || used.has(n)) shown.push(n);
  const rows = shown.length, rowOf = (note: number) => { const i = shown.indexOf(note); return i >= 0 ? i : shown.findIndex((x) => x < note); };
  const shownRef = useRef(shown); shownRef.current = shown;
  const box = useRef<HTMLDivElement>(null), area = useRef<HTMLDivElement>(null);
  const notes = useRef(clip.notes); notes.current = clip.notes;
  const lastLength = useRef(4);
  const drag = useRef<Drag | null>(null);
  const [rect, setRect] = useState<{ c0: number; c1: number; r0: number; r1: number } | null>(null);
  useLayoutEffect(() => {
    const mid = clip.notes.length ? (Math.max(...clip.notes.map((n) => n.note)) + Math.min(...clip.notes.map((n) => n.note))) / 2 : 62;
    if (box.current) box.current.scrollTop = Math.max(0, Math.max(0, rowOf(Math.round(mid))) * ROW - box.current.clientHeight / 2);
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [clip.id, fold]);
  const at = (e: { clientX: number; clientY: number }) => {
    const r = area.current!.getBoundingClientRect();
    const pos = Math.min(steps - 0.001, Math.max(0, (e.clientX - r.left) / COL));
    return { pos, col: snapStep(Math.min(Math.floor((steps - MIN_NOTE) / grid + 1e-9), Math.floor(pos / grid + 1e-9)) * grid), row: Math.min(rows - 1, Math.max(0, Math.floor((e.clientY - r.top) / ROW))), x: e.clientX - r.left };
  };
  const without = (n: NoteEv) => notes.current.filter((x) => noteKey(x) !== noteKey(n));
  useEffect(() => {
    const move = (e: MouseEvent) => {
      const d = drag.current;
      if (!d) return;
      const p = at(e);
      if (d.mode === "draw") {
        const next = { ...d.now, length: snapStep(Math.min(steps - d.now.start, Math.max(grid, p.col - d.now.start + grid))) };
        if (next.length === d.now.length) return;
        onNotes([...without(d.now), next]); drag.current = { mode: "draw", now: next }; lastLength.current = next.length;
      } else if (d.mode === "box") {
        const c0 = Math.min(d.c0, p.col), c1 = Math.max(d.c0, p.col), r0 = Math.min(d.r0, p.row), r1 = Math.max(d.r0, p.row);
        setRect({ c0, c1, r0, r1 });
        onSel(new Set([...d.base, ...notes.current.filter((n) => { const r = rowOf(n.note); return r >= r0 && r <= r1 && n.start < c1 + grid && n.start + n.length > c0; }).map(noteKey)]));
      } else if (d.mode === "move") {
        const by = p.col - d.col, up = (shownRef.current[p.row] ?? 0) - (shownRef.current[d.row] ?? 0);
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
  // The loudness lane: each note has a stem as tall as how hard it is played. Drag in the lane to set it; if the
  // note under the pointer is selected, every selected note is set together.
  const lane = useRef<HTMLDivElement>(null), laning = useRef(false);
  const lastVel = useRef(100);
  // the lane under the notes shows loudness or chance: chance is how often a note plays, 100% being always
  const [laneOf, setLaneOf] = useState<"vel" | "chance">("vel");
  const setLane = (e: { clientX: number; clientY: number }) => {
    const r = lane.current!.getBoundingClientRect(), pos = (e.clientX - r.left) / COL, part = Math.min(1, Math.max(0, 1 - (e.clientY - r.top - 4) / (LANE - 8))), v = Math.round(127 * Math.max(0.008, part));
    const here = notes.current.filter((n) => pos >= n.start - 0.15 && pos < n.start + Math.min(1, Math.max(0.35, n.length)));
    if (!here.length) return;
    const keys = here.some((n) => sel.has(noteKey(n))) ? new Set(sel) : new Set(here.map(noteKey)), next = laneOf === "chance" ? setChance(notes.current, keys, Math.round(part * 20) * 5) : setVelocity(notes.current, keys, v);
    if (laneOf === "vel") lastVel.current = v;
    if (next.some((n, i) => n !== notes.current[i])) onNotes(next);
  };
  useEffect(() => {
    const move = (e: MouseEvent) => { if (laning.current) setLane(e); }, up = () => { laning.current = false; };
    window.addEventListener("mousemove", move); window.addEventListener("mouseup", up);
    return () => { window.removeEventListener("mousemove", move); window.removeEventListener("mouseup", up); };
  });
  const add = (note: number, col: number): NoteEv => { const made: NoteEv = { note, start: col, length: snapStep(Math.min(Math.max(grid, MIN_NOTE), steps - col)), velocity: lastVel.current }; onNotes([...without(made), made]); onHear(note); return made; };
  const down = (e: React.MouseEvent) => {
    e.preventDefault();
    const p = at(e), note = shown[p.row]!, hit = notes.current.find((n) => n.note === note && p.pos >= n.start && p.pos < n.start + n.length);
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
    <div className={`roll${draw ? " drawing" : ""}${fold && scale ? " folded" : ""}`} ref={box}>
      {scale && <button className={`roll-fold${fold ? " on" : ""}`} aria-pressed={fold} onClick={() => setFold(!fold)} title="Fold: show only the notes of the song's key (and any note already written)">Fold</button>}
      <div className="roll-inner" style={{ width: 52 + steps * COL, height: rows * ROW }}>
        <div className="roll-keys">
          {shown.map((n) => { return <button key={n} className={`roll-key${isBlack(n) ? " black" : ""}`} style={{ height: ROW }} onMouseDown={() => onHear(n)} aria-label={`Hear ${noteName(n)}`} tabIndex={-1}>{(fold && scale) || n % 12 === 0 ? noteName(n) : ""}</button>; })}
        </div>
        <div className="roll-area" ref={area} onMouseDown={down} onContextMenu={(e) => e.preventDefault()} style={{ width: steps * COL, backgroundSize: `${COL * grid}px ${ROW}px, ${COL * 4}px ${ROW}px, ${COL * 16}px ${ROW}px` }} role="application" aria-label="Piano roll">
          {shown.map((n, i) => { return isBlack(n) || n % 12 === 0 ? <div key={n} className={isBlack(n) ? "roll-row black" : "roll-row c"} style={{ top: i * ROW, height: ROW }} /> : null; })}
          {scale && shown.map((n, i) => { return inKey(n, scale.root, scale.steps) ? <div key={`k${n}`} className={`roll-row key${((n - scale.root) % 12 + 12) % 12 === 0 ? " root" : ""}`} style={{ top: i * ROW, height: ROW }} /> : null; })}
          {clip.notes.map((n) => <div key={noteKey(n)} className={`roll-note${sel.has(noteKey(n)) ? " picked" : ""}${n.chance !== undefined ? " maybe" : ""}`} style={{ left: n.start * COL + 1, top: rowOf(n.note) * ROW + 1, width: Math.max(3, n.length * COL - 2), height: ROW - 2, opacity: 0.45 + 0.55 * (n.velocity / 127) }} title={`${noteName(n.note)}, ${n.length} step${n.length === 1 ? "" : "s"}, played at ${n.velocity} of 127`}>{n.length > 1 ? noteName(n.note) : ""}</div>)}
          {rect && <div className="roll-box" style={{ left: rect.c0 * COL, top: rect.r0 * ROW, width: (rect.c1 - rect.c0 + grid) * COL, height: (rect.r1 - rect.r0 + 1) * ROW }} />}
          {step >= 0 && <div className="roll-now" style={{ left: step * COL }} />}
        </div>
      </div>
      <div className={`roll-vel ${laneOf}`} style={{ width: 52 + steps * COL, height: LANE }}>
        <button className="roll-vel-name" onClick={() => setLaneOf(laneOf === "vel" ? "chance" : "vel")} title={laneOf === "vel" ? "How hard each note is played. Drag a stem up or down. Click here to set each note's chance of playing instead." : "How often each note plays: a full stem is every time, half a stem is about every other time round. Click here to go back to loudness."}>{laneOf === "vel" ? "Loud" : "Chance"}</button>
        <div className="roll-vel-area" ref={lane} style={{ width: steps * COL, backgroundSize: `${COL * 4}px 100%` }} onMouseDown={(e) => { e.preventDefault(); laning.current = true; setLane(e); }} role="group" aria-label="How hard each note is played">
          {clip.notes.map((n) => <i key={noteKey(n)} className={sel.has(noteKey(n)) ? "picked" : ""} style={{ left: n.start * COL + 4, height: 4 + (LANE - 8) * (laneOf === "chance" ? (n.chance ?? 100) / 100 : n.velocity / 127) }} title={laneOf === "chance" ? `${noteName(n.note)}: plays ${n.chance ?? 100}% of the time` : `${noteName(n.note)}: ${n.velocity} of 127`} />)}
        </div>
      </div>
    </div>
  );
}
