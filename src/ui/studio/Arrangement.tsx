// The track grid: tracks down the side, bars along the top, clips on the grid. Click an empty bar to put a
// clip there; click a clip to open it underneath.
import { STEPS_PER_BAR } from "../../daw/drums";
import { clipAt, setTrack, removeTrack, type Clip, type Song, type Track } from "../../daw/song";

function ClipPicture({ track, clip }: { track: Track; clip: Clip }) {
  const steps = clip.bars * STEPS_PER_BAR;
  if (track.kind === "drums" && "hits" in clip) {
    const rows = track.pads.length;
    return <svg viewBox={`0 0 ${steps} ${rows}`} preserveAspectRatio="none" aria-hidden="true">{track.pads.flatMap((p, r) => (clip.hits[p.id] ?? []).map((h, i) => (h ? <rect key={`${r}:${i}`} x={i + 0.1} y={r + 0.1} width={0.8} height={0.8} opacity={h === 1 ? 0.5 : 1} /> : null)))}</svg>;
  }
  if (!("notes" in clip) || !clip.notes.length) return null;
  const lo = Math.min(...clip.notes.map((n) => n.note)) - 1, hi = Math.max(...clip.notes.map((n) => n.note)) + 1, span = Math.max(6, hi - lo + 1);
  return <svg viewBox={`0 0 ${steps} ${span}`} preserveAspectRatio="none" aria-hidden="true">{clip.notes.map((n) => <rect key={`${n.note}:${n.start}`} x={n.start + 0.05} y={span - (n.note - lo) - 1} width={n.length - 0.1} height={0.9} />)}</svg>;
}

export function Arrangement({ song, onChange, picked, onPick, onAdd, step }: { song: Song; onChange: (next: Song | ((s: Song) => Song)) => void; picked: { track?: string; clip?: string }; onPick: (track: string, clip?: string) => void; onAdd: (track: string, bar: number) => void; step: number }) {
  const bars = Array.from({ length: song.bars }, (_, i) => i), cols = { gridTemplateColumns: `repeat(${song.bars}, minmax(46px, 1fr))` };
  const head = step >= 0 ? `${(step / (song.bars * STEPS_PER_BAR)) * 100}%` : undefined;
  return (
    <div className="arr" role="group" aria-label="Tracks and clips">
      <div className="arr-row arr-top">
        <div className="arr-side" />
        <div className="arr-bars" style={cols}>{bars.map((b) => <span key={b} className={`arr-bar-n${step >= 0 && Math.floor(step / STEPS_PER_BAR) === b ? " now" : ""}`}>{b + 1}</span>)}</div>
      </div>
      {song.tracks.map((t) => (
        <div key={t.id} className={`arr-row k-${t.kind}${picked.track === t.id ? " picked" : ""}${t.mute ? " muted" : ""}`}>
          <div className="arr-side" onMouseDown={() => { if (picked.track !== t.id) onPick(t.id); }}>
            <span className="arr-kind" title={t.kind === "drums" ? "Drum track" : "Synth track"}>{t.kind === "drums" ? "▦" : "∿"}</span>
            <input type="text" className="arr-name" value={t.name} maxLength={24} aria-label="Track name" onChange={(e) => onChange((s) => setTrack(s, t.id, { name: e.target.value }))} />
            <button className={`drum-flag${t.mute ? " on" : ""}`} aria-pressed={t.mute} aria-label={`Mute ${t.name}`} title="Mute this track" onClick={() => onChange((s) => setTrack(s, t.id, { mute: !t.mute }))}>M</button>
            <button className={`drum-flag solo${t.solo ? " on" : ""}`} aria-pressed={t.solo} aria-label={`Solo ${t.name}`} title="Hear only this track" onClick={() => onChange((s) => setTrack(s, t.id, { solo: !t.solo }))}>S</button>
            <input type="range" className="arr-level" min={0} max={100} value={t.level} aria-label={`${t.name} level`} title={`Level ${t.level}`} onChange={(e) => onChange((s) => setTrack(s, t.id, { level: Number(e.target.value) }))} />
            {song.tracks.length > 1 && <button className="drum-clear" aria-label={`Delete track ${t.name}`} title="Delete this track" onClick={() => { if (window.confirm(`Delete the track “${t.name}” and its clips?`)) onChange((s) => removeTrack(s, t.id)); }}>×</button>}
          </div>
          <div className="arr-bars" style={cols}>
            {bars.map((b) => (clipAt(t, b) ? null : <button key={b} className={`arr-slot${b % 4 === 0 ? " four" : ""}`} style={{ gridColumn: b + 1, gridRow: 1 }} onClick={() => onAdd(t.id, b)} aria-label={`Add a clip to ${t.name} at bar ${b + 1}`} title="Add a clip here">+</button>))}
            {t.clips.map((c) => (
              <button key={c.id} className={`arr-clip${picked.track === t.id && picked.clip === c.id ? " picked" : ""}`} style={{ gridColumn: `${c.start + 1} / span ${c.bars}`, gridRow: 1 }} onClick={() => onPick(t.id, c.id)} aria-pressed={picked.track === t.id && picked.clip === c.id} aria-label={`${t.name} clip at bar ${c.start + 1}, ${c.bars} bar${c.bars === 1 ? "" : "s"}`}>
                <ClipPicture track={t} clip={c} />
              </button>
            ))}
            {head && <div className="arr-now" style={{ left: head }} />}
          </div>
        </div>
      ))}
    </div>
  );
}
