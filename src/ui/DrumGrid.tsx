// The drum step grid: one row per pad, one cell per step. It only draws and edits a pattern, so the Studio
// uses it for a drum clip and a lesson can show the same grid with its own pattern.
import { useEffect, useRef, useState } from "react";
import { nextStrength, setHit, setLane, clearLane, type Hit, type Pattern, type Voice } from "../daw/drums";

const WORDS: Record<Hit, string> = { 0: "off", 1: "soft", 2: "normal", 3: "accent" };

/** Click to put a hit in or take it out, drag to paint, Shift-click (or right-click) a hit to change how hard it is struck. */
export function DrumGrid({ pattern, onChange, step, onAudition, lanes, onSound, open, onFile }: {
  pattern: Pattern; onChange: (p: Pattern) => void; step: number; /** hear the pad of this row */ onAudition: (lane: number) => void;
  /** show only these drums (for lessons) */ lanes?: Voice[]; /** select this row's pad */ onSound?: (lane: number) => void; open?: number; /** a sound file was dropped on this row */ onFile?: (lane: number, file: File) => void;
}) {
  const [over, setOver] = useState(-1);
  const paint = useRef<Hit | null>(null);
  useEffect(() => { const up = () => { paint.current = null; }; window.addEventListener("mouseup", up); return () => window.removeEventListener("mouseup", up); }, []);
  const press = (lane: number, i: number, hit: Hit, harder: boolean) => {
    if (harder && hit) { onChange(setHit(pattern, lane, i, nextStrength(hit))); return; }
    const to: Hit = hit ? 0 : 2;
    paint.current = to;
    onChange(setHit(pattern, lane, i, to));
    if (to) onAudition(lane);
  };
  return (
    <div className={`drum-grid len${pattern.length}`} onContextMenu={(e) => e.preventDefault()}>
      {pattern.lanes.map((lane, li) => (lanes && !lanes.includes(lane.voice) ? null : (
        <div className={`drum-lane${lane.mute ? " muted" : ""}${over === li ? " over" : ""}${open === li ? " picked" : ""}`} key={lane.id}
          onDragOver={onFile ? (e) => { if (e.dataTransfer.types.includes("Files")) { e.preventDefault(); setOver(li); } } : undefined}
          onDragLeave={onFile ? () => setOver(-1) : undefined}
          onDrop={onFile ? (e) => { e.preventDefault(); setOver(-1); const f = e.dataTransfer.files[0]; if (f) onFile(li, f); } : undefined}>
          <button className="drum-name" onClick={() => { onAudition(li); onSound?.(li); }} title="Hear this pad">{lane.name}</button>
          <button className={`drum-flag${lane.mute ? " on" : ""}`} aria-pressed={lane.mute} onClick={() => onChange(setLane(pattern, li, { mute: !lane.mute }))} title="Mute: silence this pad" aria-label={`Mute ${lane.name}`}>M</button>
          <button className={`drum-flag solo${lane.solo ? " on" : ""}`} aria-pressed={lane.solo} onClick={() => onChange(setLane(pattern, li, { solo: !lane.solo }))} title="Solo: hear only this pad" aria-label={`Solo ${lane.name}`}>S</button>
          <div className="drum-cells" role="group" aria-label={`${lane.name} steps`}>
            {lane.steps.map((hit, i) => (
              <button key={i} className={`cell h${hit}${i % 4 === 0 ? " beat" : ""}${Math.floor(i / 4) % 2 ? " odd" : ""}${i === step ? " now" : ""}`}
                aria-label={`${lane.name}, step ${i + 1}, ${WORDS[hit]}`} aria-pressed={hit > 0}
                onMouseDown={(e) => { e.preventDefault(); (e.currentTarget as HTMLButtonElement).focus(); press(li, i, hit, e.shiftKey || e.button === 2); }}
                onMouseEnter={() => { if (paint.current !== null && hit !== paint.current) onChange(setHit(pattern, li, i, paint.current)); }}
                onKeyDown={(e) => {
                  if (e.key === "Enter") { e.preventDefault(); press(li, i, hit, e.shiftKey); paint.current = null; }
                  else if (e.key === "1" || e.key === "2" || e.key === "3") onChange(setHit(pattern, li, i, Number(e.key) as Hit));
                  else if (e.key === "Backspace" || e.key === "Delete" || e.key === "0") onChange(setHit(pattern, li, i, 0));
                  else if (e.key === "ArrowRight" || e.key === "ArrowLeft") { const sib = (e.key === "ArrowRight" ? e.currentTarget.nextElementSibling : e.currentTarget.previousElementSibling) as HTMLElement | null; sib?.focus(); }
                }} />
            ))}
          </div>
          <button className="drum-clear" onClick={() => onChange(clearLane(pattern, li))} title="Clear this row" aria-label={`Clear ${lane.name}`}>×</button>
        </div>
      )))}
      <div className="drum-lane drum-count" aria-hidden="true">
        <span className="drum-name" /><span className="drum-flag" /><span className="drum-flag" />
        <div className="drum-cells">{Array.from({ length: pattern.length }, (_, i) => <span key={i} className={`count${i % 4 === 0 ? " beat" : ""}${i === step ? " now" : ""}`}>{i % 4 === 0 ? (i / 4) % 4 + 1 : "·"}</span>)}</div>
        <span className="drum-clear" />
      </div>
    </div>
  );
}
