// The Arrangement: bars along the top, one lane per track, clips on the lanes, and each track's name and
// mixer controls at the right-hand end of its lane (where Ableton's Arrangement View keeps them).
import { useEffect, useRef, useState } from "react";
import { STEPS_PER_BAR } from "../../daw/drums";
import { CLIP_BARS, clipAt, placeClip, setTrack, removeTrack, type Clip, type Song, type Track } from "../../daw/song";

/** A colour for each track, by its place in the list. */
export const TRACK_COLORS = ["#ffb347", "#5fe0ff", "#b6f36a", "#ff8fc2", "#c9a2ff", "#ffe66b", "#7dffb0", "#ff9a7a"];

function ClipPicture({ track, clip }: { track: Track; clip: Clip }) {
  const steps = clip.bars * STEPS_PER_BAR;
  if (track.kind === "drums" && "hits" in clip) {
    const rows = track.pads.length;
    return <svg viewBox={`0 0 ${steps} ${rows}`} preserveAspectRatio="none" aria-hidden="true">{track.pads.flatMap((p, r) => (clip.hits[p.id] ?? []).map((h, i) => (h ? <rect key={`${r}:${i}`} x={i + 0.1} y={r + 0.1} width={0.8} height={0.8} opacity={h === 1 ? 0.5 : 1} /> : null)))}</svg>;
  }
  if (!("notes" in clip) || !clip.notes.length) return <svg aria-hidden="true" />;
  const lo = Math.min(...clip.notes.map((n) => n.note)) - 1, hi = Math.max(...clip.notes.map((n) => n.note)) + 1, span = Math.max(6, hi - lo + 1);
  return <svg viewBox={`0 0 ${steps} ${span}`} preserveAspectRatio="none" aria-hidden="true">{clip.notes.map((n) => <rect key={`${n.note}:${n.start}`} x={n.start + 0.05} y={span - (n.note - lo) - 1} width={n.length - 0.1} height={0.9} />)}</svg>;
}

export function Arrangement({ song, onChange, picked, also = [], onPick, onAdd, onPlace, onBars, step, loop, renaming }: { /** a clip was dropped on a bar of a track (copy: Alt was held) */ onPlace: (fromTrack: string, clip: string, toTrack: string, bar: number, copy: boolean) => void; /** a clip's right edge was dragged to a new length */ onBars: (track: string, clip: string, bars: number) => void; song: Song; onChange: (next: Song | ((s: Song) => Song)) => void; picked: { track?: string; clip?: string }; /** more clips of the selected track, selected with Shift or Ctrl/Cmd */ also?: readonly string[]; onPick: (track: string, clip?: string, add?: boolean) => void; onAdd: (track: string, bar: number) => void; step: number; /** the looped stretch, in bars */ loop?: { start: number; bars: number }; /** the track whose name box should take the keyboard */ renaming?: string }) {
  const bars = Array.from({ length: song.bars }, (_, i) => i), cols = { gridTemplateColumns: `repeat(${song.bars}, minmax(52px, 1fr))` };
  // Dragging a clip: sideways to another bar, up or down to another track of the same kind; Alt copies. Dragging
  // its right edge changes its length. Nothing moves until the pointer has gone a few pixels, so a click is a click.
  const rows = useRef(new Map<string, HTMLDivElement>()), drag = useRef<{ from: string; clip: Clip; x: number; y: number; grab: number; moved: boolean; size: boolean; marked?: boolean } | null>(null), now = useRef(song); now.current = song;
  const [ghost, setGhost] = useState<{ track: string; bar: number; bars: number; ok: boolean; clip: string } | null>(null), ghostNow = useRef(ghost); ghostNow.current = ghost;
  const barAt = (el: HTMLElement, x: number) => { const r = el.getBoundingClientRect(); return Math.floor((x - r.left) / (r.width / now.current.bars)); };
  useEffect(() => {
    const move = (e: MouseEvent) => { const d = drag.current; if (!d) return;
      if (!d.moved && Math.hypot(e.clientX - d.x, e.clientY - d.y) < 5) return; d.moved = true;
      const s = now.current, home = rows.current.get(d.from); if (!home) return;
      if (d.size) { if (!d.marked) { d.marked = true; onPlace(d.from, d.clip.id, d.from, d.clip.start, false); } const want = barAt(home, e.clientX) - d.clip.start + 1, kind = s.tracks.find((t) => t.id === d.from)?.kind ?? "synth", fit = [...CLIP_BARS[kind]].reverse().find((b) => b <= Math.max(1, want)) ?? 1; onBars(d.from, d.clip.id, fit); return; }
      let target = d.from; for (const [id, el] of rows.current) { const r = el.getBoundingClientRect(); if (e.clientY >= r.top && e.clientY <= r.bottom) target = id; }
      const bar = Math.min(s.bars - d.clip.bars, Math.max(0, barAt(rows.current.get(target)!, e.clientX) - d.grab)), still = target === d.from && bar === d.clip.start;
      setGhost({ track: target, bar, bars: d.clip.bars, clip: d.clip.id, ok: still || !!placeClip(s, d.from, d.clip.id, target, bar, e.altKey) }); };
    const up = (e: MouseEvent) => { const d = drag.current, g = ghostNow.current; drag.current = null; setGhost(null);
      if (d && d.moved && !d.size && g && g.ok && !(g.track === d.from && g.bar === d.clip.start && !e.altKey)) onPlace(d.from, d.clip.id, g.track, g.bar, e.altKey); };
    window.addEventListener("mousemove", move); window.addEventListener("mouseup", up);
    return () => { window.removeEventListener("mousemove", move); window.removeEventListener("mouseup", up); };
  });
  const head = step >= 0 ? `${(step / (song.bars * STEPS_PER_BAR)) * 100}%` : undefined;
  return (
    <div className="arr" role="group" aria-label="Arrangement">
      <div className="arr-row arr-top">
        <div className="arr-bars" style={cols}>
          {bars.map((b) => <span key={b} className={`arr-bar-n${step >= 0 && Math.floor(step / STEPS_PER_BAR) === b ? " now" : ""}`}>{b + 1}</span>)}
          {loop && <div className="arr-loop" style={{ left: `${(loop.start / song.bars) * 100}%`, width: `${(loop.bars / song.bars) * 100}%` }} title="The looped stretch" />}
        </div>
        <div className="arr-side arr-side-top">Tracks</div>
      </div>
      {song.tracks.map((t, ti) => (
        <div key={t.id} className={`arr-row k-${t.kind}${picked.track === t.id ? " picked" : ""}${t.mute ? " muted" : ""}`} style={{ ["--tc" as string]: TRACK_COLORS[ti % TRACK_COLORS.length] }}>
          <div className="arr-bars" style={cols} ref={(el) => { if (el) rows.current.set(t.id, el); else rows.current.delete(t.id); }} onMouseDown={() => { if (picked.track !== t.id) onPick(t.id); }}>
            {bars.map((b) => (clipAt(t, b) ? null : <button key={b} className={`arr-slot${b % 4 === 0 ? " four" : ""}`} style={{ gridColumn: b + 1, gridRow: 1 }} onDoubleClick={() => onAdd(t.id, b)} onKeyDown={(e) => { if (e.key === "Enter") onAdd(t.id, b); }} aria-label={`Add a clip to ${t.name} at bar ${b + 1}`} title="Double-click to add a clip here" />))}
            {t.clips.map((c) => (
              <button key={c.id} className={`arr-clip${picked.track === t.id && (picked.clip === c.id || also.includes(c.id)) ? " picked" : ""}${c.off ? " off" : ""}${ghost?.clip === c.id ? " moving" : ""}`} style={{ gridColumn: `${c.start + 1} / span ${c.bars}`, gridRow: 1 }} title="Drag to move it (hold Alt to copy). Drag its right edge to change its length."
                onMouseDown={(e) => { e.stopPropagation(); onPick(t.id, c.id, e.shiftKey || e.ctrlKey || e.metaKey); if (e.button === 0 && !e.shiftKey && !e.ctrlKey && !e.metaKey) { const r = e.currentTarget.getBoundingClientRect(); drag.current = { from: t.id, clip: c, x: e.clientX, y: e.clientY, grab: Math.min(c.bars - 1, Math.floor((e.clientX - r.left) / (r.width / c.bars))), moved: false, size: e.clientX > r.right - 8 }; } }} aria-pressed={picked.track === t.id && (picked.clip === c.id || also.includes(c.id))} aria-label={`${t.name} clip at bar ${c.start + 1}, ${c.bars} bar${c.bars === 1 ? "" : "s"}${c.off ? ", switched off" : ""}`}>
                <span className="arr-clip-name">{t.name}</span>
                <ClipPicture track={t} clip={c} />
                <span className="arr-grip" aria-hidden="true" />
              </button>
            ))}
            {ghost && ghost.track === t.id && <div className={`arr-ghost${ghost.ok ? "" : " no"}`} style={{ gridColumn: `${ghost.bar + 1} / span ${ghost.bars}` }} />}
            {head && <div className="arr-now" style={{ left: head }} />}
          </div>
          <div className="arr-side" onMouseDown={() => { if (picked.track !== t.id) onPick(t.id); }}>
            <input type="text" className="arr-name" value={t.name} maxLength={24} aria-label="Track name" ref={(el) => { if (el && renaming === t.id && document.activeElement !== el) { el.focus(); el.select(); } }} onChange={(e) => onChange((s) => setTrack(s, t.id, { name: e.target.value }))} onKeyDown={(e) => { if (e.key === "Enter" || e.key === "Escape") (e.target as HTMLInputElement).blur(); }} />
            <button className={`trk-on${t.mute ? "" : " on"}`} aria-pressed={!t.mute} aria-label={`${t.name} on`} title="Track on or off (0)" onClick={() => onChange((s) => setTrack(s, t.id, { mute: !t.mute }))}>{ti + 1}</button>
            <button className={`trk-solo${t.solo ? " on" : ""}`} aria-pressed={t.solo} aria-label={`Solo ${t.name}`} title="Solo: hear only this track (S)" onClick={() => onChange((s) => setTrack(s, t.id, { solo: !t.solo }))}>S</button>
            <input type="range" className="arr-level" min={0} max={100} value={t.level} aria-label={`${t.name} level`} title={`Level ${t.level}`} onChange={(e) => onChange((s) => setTrack(s, t.id, { level: Number(e.target.value) }))} />
            {song.tracks.length > 1 && <button className="arr-x" aria-label={`Delete track ${t.name}`} title="Delete this track" onClick={() => { if (window.confirm(`Delete the track “${t.name}” and its clips?`)) onChange((s) => removeTrack(s, t.id)); }}>×</button>}
          </div>
        </div>
      ))}
    </div>
  );
}
