// The Arrangement: bars along the top, one lane per track, clips on the lanes, and each track's name and
// mixer controls at the right-hand end of its lane (where Ableton's Arrangement View keeps them).
import { STEPS_PER_BAR } from "../../daw/drums";
import { clipAt, setTrack, removeTrack, type Clip, type Song, type Track } from "../../daw/song";

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

export function Arrangement({ song, onChange, picked, onPick, onAdd, step, loop, renaming }: { song: Song; onChange: (next: Song | ((s: Song) => Song)) => void; picked: { track?: string; clip?: string }; onPick: (track: string, clip?: string) => void; onAdd: (track: string, bar: number) => void; step: number; /** the looped stretch, in bars */ loop?: { start: number; bars: number }; /** the track whose name box should take the keyboard */ renaming?: string }) {
  const bars = Array.from({ length: song.bars }, (_, i) => i), cols = { gridTemplateColumns: `repeat(${song.bars}, minmax(52px, 1fr))` };
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
          <div className="arr-bars" style={cols} onMouseDown={() => { if (picked.track !== t.id) onPick(t.id); }}>
            {bars.map((b) => (clipAt(t, b) ? null : <button key={b} className={`arr-slot${b % 4 === 0 ? " four" : ""}`} style={{ gridColumn: b + 1, gridRow: 1 }} onDoubleClick={() => onAdd(t.id, b)} onKeyDown={(e) => { if (e.key === "Enter") onAdd(t.id, b); }} aria-label={`Add a clip to ${t.name} at bar ${b + 1}`} title="Double-click to add a clip here" />))}
            {t.clips.map((c) => (
              <button key={c.id} className={`arr-clip${picked.track === t.id && picked.clip === c.id ? " picked" : ""}${c.off ? " off" : ""}`} style={{ gridColumn: `${c.start + 1} / span ${c.bars}`, gridRow: 1 }} onMouseDown={(e) => { e.stopPropagation(); onPick(t.id, c.id); }} aria-pressed={picked.track === t.id && picked.clip === c.id} aria-label={`${t.name} clip at bar ${c.start + 1}, ${c.bars} bar${c.bars === 1 ? "" : "s"}${c.off ? ", switched off" : ""}`}>
                <span className="arr-clip-name">{t.name}</span>
                <ClipPicture track={t} clip={c} />
              </button>
            ))}
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
