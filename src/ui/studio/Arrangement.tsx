// The Arrangement: bars along the top, one lane per track, clips on the lanes, and each track's name and
// mixer controls at the right-hand end of its lane (where Ableton's Arrangement View keeps them).
import { Fragment, useEffect, useRef, useState } from "react";
import { STEPS_PER_BAR } from "../../daw/drums";
import { audioRate, faderText, BEAT, CLIP_BARS, MASTER_START, placeName, clipAt, placeClip, removeReturn, setAuto, setReturn, setSend, setTrack, soloOnly, removeTrack, type Clip, type Song, type Track } from "../../daw/song";
import { SHAPES, drawShape, type Shape, MAX_LANES, addLane, bendPoint, lanePath, overKey, dropPoint, fromUnit, movePoint, putPoint, removeLane, retargetLane, targetsOf, type AutoLane, type AutoTarget } from "../../daw/automation";

/** A colour for each track, by its place in the list. */
export const TRACK_COLORS = ["#ffb347", "#5fe0ff", "#b6f36a", "#ff8fc2", "#c9a2ff", "#ffe66b", "#7dffb0", "#ff9a7a"];

function ClipPicture({ track, clip, peaksOf, bpm }: { track: Track; clip: Clip; peaksOf?: (sample: string) => number[]; bpm: number }) {
  const steps = clip.bars * STEPS_PER_BAR;
  if ("sample" in clip) {
    // the stretch of the file this clip plays, drawn as its shape
    const peaks = peaksOf?.(clip.sample) ?? [], n = peaks.length; if (!n) return <svg aria-hidden="true" />;
    const rate = audioRate(clip, bpm), a = (clip.offset / clip.seconds) * n, span = ((clip.bars * (240 / bpm) * rate) / clip.seconds) * n, cols = Math.max(8, Math.min(240, Math.round(clip.bars * 24)));
    return <svg viewBox={`0 0 ${cols} 40`} preserveAspectRatio="none" aria-hidden="true">{Array.from({ length: cols }, (_, i) => { const at = a + (i / cols) * span; if (at >= n) return null; const p = peaks[Math.floor(at)] ?? 0; return <rect key={i} x={i} y={20 - p * 19} width={0.85} height={Math.max(0.5, p * 38)} />; })}</svg>;
  }
  if (track.kind === "drums" && "hits" in clip) {
    const rows = track.pads.length;
    return <svg viewBox={`0 0 ${steps} ${rows}`} preserveAspectRatio="none" aria-hidden="true">{track.pads.flatMap((p, r) => (clip.hits[p.id] ?? []).map((h, i) => (h ? <rect key={`${r}:${i}`} x={i + 0.1} y={r + 0.1} width={0.8} height={0.8} opacity={h === 1 ? 0.5 : 1} /> : null)))}</svg>;
  }
  if (!("notes" in clip) || !clip.notes.length) return <svg aria-hidden="true" />;
  const lo = Math.min(...clip.notes.map((n) => n.note)) - 1, hi = Math.max(...clip.notes.map((n) => n.note)) + 1, span = Math.max(6, hi - lo + 1);
  return <svg viewBox={`0 0 ${steps} ${span}`} preserveAspectRatio="none" aria-hidden="true">{clip.notes.map((n) => <rect key={`${n.note}:${n.start}`} x={n.start + 0.05} y={span - (n.note - lo) - 1} width={n.length - 0.1} height={0.9} />)}</svg>;
}

const shownValue = (t: AutoTarget, v: number) => { const x = fromUnit(t, v); return t.id === "pan" ? (x === 0 ? "centre" : `${Math.abs(x)} ${x < 0 ? "left" : "right"}`) : t.unit === "Hz" && x >= 1000 ? `${Number((x / 1000).toFixed(2))} kHz` : `${x}${t.unit ? ` ${t.unit}` : ""}`; };
/** Widths of a bar, in pixels; 0 fits the song to the window. The side column's width, for following the play line. */
const ZOOMS = [0, 70, 120, 200, 320], ZOOM_KEY = "patchwalk.zoom.v1", SIDE = 330;
/**
 * One automation lane: a line along the song. Click an empty place to add a point, drag a point to move it
 * (sideways only as far as its neighbours), double-click a point to remove it.
 */
type Strip = { name: string; auto?: AutoLane[]; devices: Track["devices"]; patch?: object; sampler?: object; master?: boolean; kind?: string };
function AutoLaneRow({ track, lane, index, steps, cols, onLanes, onMark, span, off }: { /** switched off for now: its control was moved by hand */ off?: boolean; /** where a ready-made shape is drawn: the selected clip's bars, or the whole song */ span: { from: number; length: number; name: string }; track: Strip; lane: AutoLane; index: number; steps: number; cols: React.CSSProperties; onLanes: (next: AutoLane[]) => void; onMark: () => void }) {
  const area = useRef<HTMLDivElement>(null), held = useRef<number | null>(null), bend = useRef<{ i: number; y: number; c: number; up: boolean } | null>(null), lanes = useRef(track.auto ?? []); lanes.current = track.auto ?? [];
  const [tip, setTip] = useState("");
  const targets = targetsOf(track), target = targets.find((t) => t.id === lane.target);
  const at = (e: { clientX: number; clientY: number }) => { const r = area.current!.getBoundingClientRect(); return { at: ((e.clientX - r.left) / r.width) * steps, v: 1 - (e.clientY - r.top - 4) / (r.height - 8) }; };
  useEffect(() => {
    const move = (e: MouseEvent) => { const b = bend.current; if (b) { const next = bendPoint(lanes.current, index, b.i, b.c + ((e.clientY - b.y) / 50) * (b.up ? 1 : -1), steps); if (next !== lanes.current) onLanes(next); return; } if (held.current === null) return; const p = at(e), next = movePoint(lanes.current, index, held.current, p, steps); if (next !== lanes.current) onLanes(next); if (target) setTip(shownValue(target, Math.min(1, Math.max(0, p.v)))); };
    const up = () => { held.current = null; bend.current = null; setTip(""); };
    window.addEventListener("mousemove", move); window.addEventListener("mouseup", up);
    return () => { window.removeEventListener("mousemove", move); window.removeEventListener("mouseup", up); };
  });
  const pts = lane.points, line = lanePath(pts, steps).map(([x, v]) => `${Number(((x / steps) * 100).toFixed(3))},${Number(((1 - v) * 100).toFixed(2))}`).join(" ");
  return (
    <div className={`arr-row arr-auto${off ? " off" : ""}`}>
      <div className="arr-bars" style={cols}>
        <div className="auto-area" ref={area} role="group" aria-label={`Automation of ${target?.label ?? "a setting that is gone"} on ${track.name}`} title={off ? "Switched off because you moved this control by hand. “Re-enable automation” in the top bar switches it on again." : "Click to add a point, drag a point to move it, double-click a point to remove it. Hold Alt and drag a line up or down to bend it (Alt and double-click: straight again)."}
          onMouseDown={(e) => { if (e.button !== 0 || !target) return; e.preventDefault(); onMark();
            if (e.altKey) { const x = at(e).at, ps = lanes.current[index]?.points ?? []; let i = -1; ps.forEach((p, k) => { if (p.at <= x) i = k; }); if (i < 0 || i >= ps.length - 1) return; if (e.detail >= 2) { onLanes(bendPoint(lanes.current, index, i, 0, steps)); return; } bend.current = { i, y: e.clientY, c: ps[i]!.c ?? 0, up: ps[i + 1]!.v >= ps[i]!.v }; return; } const r = putPoint(lanes.current, index, at(e), steps); if (r.index >= 0) { onLanes(r.lanes); held.current = r.index; } }}>
          <svg viewBox="0 0 100 100" preserveAspectRatio="none" aria-hidden="true">{line && <polyline points={line} vectorEffect="non-scaling-stroke" />}</svg>
          {pts.map((p, i) => <button key={`${p.at}`} className="auto-pt" style={{ left: `${(p.at / steps) * 100}%`, top: `calc(4px + (100% - 8px) * ${1 - p.v})` }} aria-label={`Point at bar ${Math.floor(p.at / STEPS_PER_BAR) + 1}, step ${(p.at % STEPS_PER_BAR) + 1}: ${target ? shownValue(target, p.v) : ""}`} title={target ? shownValue(target, p.v) : ""}
            onMouseDown={(e) => { e.stopPropagation(); e.preventDefault(); if (e.detail >= 2) { onLanes(dropPoint(lanes.current, index, i)); return; } onMark(); held.current = i; }}
            onKeyDown={(e) => { const by = e.shiftKey ? 0.1 : 0.02; if (e.altKey && (e.key === "ArrowUp" || e.key === "ArrowDown")) { e.preventDefault(); e.stopPropagation(); onLanes(bendPoint(lanes.current, index, i, (p.c ?? 0) + (e.key === "ArrowUp" ? -0.1 : 0.1), steps)); } else if (e.key === "Delete" || e.key === "Backspace") { e.stopPropagation(); onLanes(dropPoint(lanes.current, index, i)); } else if (e.key === "ArrowUp" || e.key === "ArrowDown") { e.preventDefault(); e.stopPropagation(); onLanes(movePoint(lanes.current, index, i, { at: p.at, v: p.v + (e.key === "ArrowUp" ? by : -by) }, steps)); } else if (e.key === "ArrowLeft" || e.key === "ArrowRight") { e.preventDefault(); e.stopPropagation(); onLanes(movePoint(lanes.current, index, i, { at: p.at + (e.key === "ArrowRight" ? 1 : -1), v: p.v }, steps)); } }} />)}
          {!pts.length && <span className="auto-empty">Click anywhere on this line to add a point</span>}
        </div>
      </div>
      <div className="arr-side">
        <select className="auto-target" value={lane.target} aria-label={`What this lane on ${track.name} moves`} onChange={(e) => onLanes(retargetLane(lanes.current, index, e.target.value))}>
          {!target && <option value={lane.target}>(setting no longer there)</option>}
          {[...new Set(targets.map((t) => t.group))].map((g) => <optgroup key={g} label={g}>{targets.filter((t) => t.group === g).map((t) => <option key={t.id} value={t.id} disabled={t.id !== lane.target && (track.auto ?? []).some((l) => l.target === t.id)}>{t.label}</option>)}</optgroup>)}
        </select>
        <span className="auto-tip">{tip || (target && pts.length ? `${pts.length} point${pts.length === 1 ? "" : "s"}` : "")}</span>
        <select className="auto-shape" value="" aria-label={`Draw a shape on this lane of ${track.name}`} title={`Draw a ready-made shape over ${span.name}, replacing what is drawn there`} onChange={(e) => { if (!e.target.value) return; onMark(); onLanes(drawShape(lanes.current, index, e.target.value as Shape, span.from, span.length, steps)); }}><option value="">Shape…</option>{SHAPES.map((x) => <option key={x}>{x}</option>)}</select>
        <button aria-label="Remove this lane" title="Remove this lane and its points" onClick={() => { onMark(); onLanes(removeLane(lanes.current, index)); }}>×</button>
      </div>
    </div>
  );
}

/** A level meter: a bar that follows a reading in dB about thirty times a second, up at once and down gently. */
export function LevelBar({ read, wide }: { read: () => number; wide?: boolean }) {
  const bar = useRef<HTMLSpanElement>(null);
  useEffect(() => { let raf = 0, shown = -60; const tick = () => { raf = requestAnimationFrame(tick); const v = Math.max(-60, Math.min(6, read())); shown = v > shown ? v : shown - 1.2; const el = bar.current; if (el) { el.style.width = `${Math.max(0, ((shown + 60) / 66) * 100)}%`; el.className = shown > 0 ? "over" : shown > -6 ? "hot" : ""; } }; raf = requestAnimationFrame(tick); return () => cancelAnimationFrame(raf); }, [read]);
  return <i className={`lvl${wide ? " wide" : ""}`} aria-hidden="true"><span ref={bar} /></i>;
}

/** The master's readout in words: average level (not the peak) and how wide the mix is. Updated a few times a second. */
function StereoRead({ read }: { read: () => { average: number; width: number; alike: number } }) {
  const el = useRef<HTMLSpanElement>(null);
  useEffect(() => { let avg = -120, wide = -120; const id = window.setInterval(() => { const r = read(), span = el.current; if (!span) return;
    // eased, so the numbers can be read
    avg = r.average < -90 ? -120 : avg < -90 ? r.average : avg + (r.average - avg) * 0.3; wide = r.width < -90 ? -120 : wide < -90 ? r.width : wide + (r.width - wide) * 0.3;
    span.textContent = avg < -90 ? "avg — · width —" : `avg ${avg.toFixed(1)} dB · width ${wide < -60 ? "mono" : `${wide.toFixed(0)} dB`}`;
    span.className = `arr-stereo${r.alike < -0.2 ? " bad" : ""}`;
    span.title = `Average level of the whole mix (not its peak), and how wide it is: the level of what differs between left and right against what they share. 0 dB is very wide, -20 dB nearly mono.${r.alike < -0.2 ? " The two sides are working against each other: on one speaker much of this would vanish." : ""}`;
  }, 250); return () => window.clearInterval(id); }, [read]);
  return <span ref={el} className="arr-stereo" aria-label="Average level and stereo width of the mix">avg — · width —</span>;
}

export function Arrangement({ song, peaksOf, lettersFree, onOpen, onJump, mark, onMarkAt, overridden, live, back, onBack, onSeek, onMarker, onChange, levelOf, masterLevel, masterStereo, picked, also = [], onPick, onAdd, onPlace, onBars, onMark = () => undefined, step, loop, renaming }: { /** a sound file's shape, for drawing audio clips */ peaksOf?: (sample: string) => number[]; /** true when letter keys are shortcuts (the computer keyboard is not playing notes) */ lettersFree?: () => boolean; /** a double-click on a clip or a track's name: show the Clip or the Device view */ onOpen?: (view: "clip" | "device") => void; /** to the marker before (-1) or after (1) */ onJump?: (dir: 1 | -1) => void; /** the time marker: a place in the song (in bars) where a clip can be cut, set by clicking on a track's lane */ mark?: number; onMarkAt?: (bars: number) => void; /** automation lanes switched off for now (as `overKey` names them) */ overridden?: ReadonlySet<string>; /** name, rename or remove the marker on a bar (a right-click or double-click on its number) */ onMarker?: (bar: number) => void; /** play from a bar (a click on its number) */ onSeek?: (bar: number) => void; /** the selected return track, and how to select one */ back?: string; onBack?: (id: string) => void; /** the song with automated settings where they stand right now: only the faders are drawn from it */ live?: Song; /** called before an edit that should be its own step to undo */ onMark?: () => void; /** a track's level right now, in dB */ levelOf?: (track: string) => number; /** the whole song's level right now, in dB */ masterLevel?: () => number; /** the whole mix: average level, width and how alike the two sides are */ masterStereo?: () => { average: number; width: number; alike: number }; /** a clip was dropped on a bar of a track (copy: Alt was held) */ onPlace: (fromTrack: string, clip: string, toTrack: string, bar: number, copy: boolean) => void; /** a clip's right edge was dragged to a new length */ onBars: (track: string, clip: string, bars: number) => void; song: Song; onChange: (next: Song | ((s: Song) => Song)) => void; picked: { track?: string; clip?: string }; /** more clips of the selected track, selected with Shift or Ctrl/Cmd */ also?: readonly string[]; onPick: (track: string, clip?: string, add?: boolean) => void; onAdd: (track: string, bar: number) => void; step: number; /** the looped stretch, in bars */ loop?: { start: number; bars: number }; /** the track whose name box should take the keyboard */ renaming?: string }) {
  const bars = Array.from({ length: song.bars }, (_, i) => i), cols = { gridTemplateColumns: `repeat(${song.bars / BEAT}, minmax(12px, 1fr))` }, Q = 1 / BEAT, beats = [0, 1, 2, 3];
  // Dragging a clip: sideways to another bar, up or down to another track of the same kind; Alt copies. Dragging
  // its right edge changes its length. Nothing moves until the pointer has gone a few pixels, so a click is a click.
  const rows = useRef(new Map<string, HTMLDivElement>()), drag = useRef<{ from: string; clip: Clip; x: number; y: number; grab: number; moved: boolean; size: boolean; marked?: boolean } | null>(null), now = useRef(song); now.current = song;
  const [ghost, setGhost] = useState<{ track: string; bar: number; bars: number; ok: boolean; clip: string } | null>(null), ghostNow = useRef(ghost); ghostNow.current = ghost;
  const barAt = (el: HTMLElement, x: number, round = false) => { const r = el.getBoundingClientRect(), q = (x - r.left) / (r.width / (now.current.bars * Q)); return Math.min(now.current.bars, Math.max(0, (round ? Math.round(q) : Math.floor(q)) / Q)); };
  const lanesOff = (id: string, target: string, lanes?: AutoLane[]) => ((lanes ?? []).some((l) => l.target === target && l.points.length) ? (overridden?.has(overKey(id, target)) ? " automated off" : " automated") : "");
  useEffect(() => {
    const move = (e: MouseEvent) => { const d = drag.current; if (!d) return;
      if (!d.moved && Math.hypot(e.clientX - d.x, e.clientY - d.y) < 5) return; d.moved = true;
      const s = now.current, home = rows.current.get(d.from); if (!home) return;
      if (d.size) { if (!d.marked) { d.marked = true; onPlace(d.from, d.clip.id, d.from, d.clip.start, false); } const want = barAt(home, e.clientX) - d.clip.start + BEAT, kind = s.tracks.find((t) => t.id === d.from)?.kind ?? "synth", fit = Math.min(CLIP_BARS[kind].at(-1)!, Math.max(BEAT, want)); onBars(d.from, d.clip.id, fit); return; }
      let target = d.from; for (const [id, el] of rows.current) { const r = el.getBoundingClientRect(); if (e.clientY >= r.top && e.clientY <= r.bottom) target = id; }
      const bar = Math.min(s.bars - d.clip.bars, Math.max(0, barAt(rows.current.get(target)!, e.clientX) - d.grab)), still = target === d.from && bar === d.clip.start;
      setGhost({ track: target, bar, bars: d.clip.bars, clip: d.clip.id, ok: still || !!placeClip(s, d.from, d.clip.id, target, bar, e.altKey) }); };
    const up = (e: MouseEvent) => { const d = drag.current, g = ghostNow.current; drag.current = null; setGhost(null);
      if (d && d.moved && !d.size && g && g.ok && !(g.track === d.from && g.bar === d.clip.start && !e.altKey)) onPlace(d.from, d.clip.id, g.track, g.bar, e.altKey); };
    window.addEventListener("mousemove", move); window.addEventListener("mouseup", up);
    return () => { window.removeEventListener("mousemove", move); window.removeEventListener("mouseup", up); };
  });
  const [open, setOpen] = useState<Set<string>>(() => new Set(song.tracks.filter((t) => t.auto.some((l) => l.points.length)).map((t) => t.id)));
  const head = step >= 0 ? `${(step / (song.bars * STEPS_PER_BAR)) * 100}%` : undefined;
  // Zoom: how wide a bar is drawn. 0 fits the whole song in the window; the others scroll sideways.
  const [zoom, setZoomState] = useState(() => { try { const z = Number(localStorage.getItem(ZOOM_KEY)); return ZOOMS.includes(z) ? z : 0; } catch { return 0; } });
  const setZoom = (dir: number) => setZoomState((z) => { const next = ZOOMS[Math.min(ZOOMS.length - 1, Math.max(0, ZOOMS.indexOf(z) + dir))]!; try { localStorage.setItem(ZOOM_KEY, String(next)); } catch { /* not remembered */ } return next; });
  const box = useRef<HTMLDivElement>(null);
  const fit = () => { setZoomState(0); try { localStorage.setItem(ZOOM_KEY, "0"); } catch { /* not remembered */ } };
  const free = useRef(lettersFree); free.current = lettersFree;
  // Automation mode (A): show the lanes of every track that has automation (or of the selected track when none has), or hide them all
  const autoAll = useRef(() => undefined as void);
  autoAll.current = () => setOpen((o) => { if (o.size) return new Set(); const ids = [...song.tracks.filter((t) => t.auto.some((l) => l.points.length)).map((t) => t.id), ...song.returns.filter((r) => (r.auto ?? []).some((l) => l.points.length)).map((r) => r.id), ...((song.masterAuto ?? []).some((l) => l.points.length) ? ["master"] : [])]; if (ids.length) return new Set(ids); const t = song.tracks.find((x) => x.id === picked.track); if (t) { if (!t.auto.length) onChange((s) => setAuto(s, t.id, addLane([], t))); return new Set([t.id]); } return o; });
  useEffect(() => {
    const key = (e: KeyboardEvent) => { const el = e.target as HTMLElement | null; if (e.ctrlKey || e.metaKey || e.altKey || (el && /^(INPUT|SELECT|TEXTAREA)$/.test(el.tagName) && (el as HTMLInputElement).type !== "range")) return;
      if (e.key === "+" || e.key === "=") { e.preventDefault(); setZoom(1); } else if (e.key === "-" || e.key === "_") { e.preventDefault(); setZoom(-1); }
      else if (free.current?.() && e.key.toLowerCase() === "w") fit(); else if (free.current?.() && e.key.toLowerCase() === "a") autoAll.current(); };
    window.addEventListener("keydown", key); return () => window.removeEventListener("keydown", key);
  }, []);
  // zoomed in, the window follows the play line
  const bar = step >= 0 ? Math.floor(step / STEPS_PER_BAR) : -1;
  useEffect(() => { const el = box.current; if (!el || !zoom || bar < 0) return; const x = bar * zoom, seen = el.clientWidth - SIDE - (song.returns.length ? 80 : 0); if (x < el.scrollLeft || x + zoom > el.scrollLeft + seen) el.scrollLeft = Math.max(0, x - zoom); }, [bar, zoom]);
  const pickedClip = song.tracks.find((t) => t.id === picked.track)?.clips.find((c) => c.id === picked.clip);
  const span = pickedClip ? { from: pickedClip.start * STEPS_PER_BAR, length: pickedClip.bars * STEPS_PER_BAR, name: `the selected clip (from ${placeName(pickedClip.start)})` } : { from: 0, length: song.bars * STEPS_PER_BAR, name: "the whole song" };
  // automation for a return track or the master: the A button and the lanes under the row
  const autoButton = (id: string, strip: Strip, set: (next: AutoLane[]) => void) => <button className={`trk-auto${open.has(id) ? " on" : ""}`} aria-pressed={open.has(id)} aria-label={`Automation for ${strip.name}`} title="Show its automation: lines along the song that move its settings as it plays" onMouseDown={(e) => e.stopPropagation()} onClick={() => { setOpen((o) => { const n = new Set(o); if (n.has(id)) n.delete(id); else n.add(id); return n; }); if (!open.has(id) && !(strip.auto ?? []).length) set(addLane([], strip)); }}>A{(strip.auto ?? []).some((l) => l.points.length) ? "•" : ""}</button>;
  const lanesFor = (id: string, strip: Strip, set: (next: AutoLane[]) => void) => open.has(id) && <>
    {(strip.auto ?? []).map((lane, li) => <AutoLaneRow off={overridden?.has(overKey(id, lane.target))} span={span} key={lane.target} track={strip} lane={lane} index={li} steps={song.bars * STEPS_PER_BAR} cols={cols} onMark={onMark} onLanes={set} />)}
    {(strip.auto ?? []).length < MAX_LANES && <div className="arr-row arr-auto more"><div className="arr-bars" style={cols} /><div className="arr-side"><button onClick={() => set(addLane(strip.auto ?? [], strip))} title="Another line, for another setting">+ Automation lane</button></div></div>}
  </>;
  const master: Strip = { name: "Master", auto: song.masterAuto, devices: song.masterFx ?? [], master: true }, setMaster = (next: AutoLane[]) => onChange((s) => ({ ...s, masterAuto: next }));
  return (
    <div className={`arr${zoom ? " zoomed" : ""}${song.returns.length ? " sends" : ""}`} role="group" aria-label="Arrangement" ref={box} style={{ "--barsw": zoom ? `${song.bars * zoom}px` : "0px" } as React.CSSProperties}>
      <div className="arr-row arr-top">
        <div className="arr-bars" style={cols} onDoubleClick={(e) => { if (e.target === e.currentTarget) fit(); }}>
          {bars.map((b) => <button key={b} style={{ gridColumn: `span ${Q}` }} className={`arr-bar-n${step >= 0 && Math.floor(step / STEPS_PER_BAR) === b ? " now" : ""}`} onClick={() => onSeek?.(b)} onDoubleClick={() => onMarker?.(b)} onContextMenu={(e) => { e.preventDefault(); onMarker?.(b); }} title={`Click: play from bar ${b + 1}. Right-click or double-click: name this place.`} aria-label={`Play from bar ${b + 1}`}>{b + 1}{song.markers?.some((m) => m.bar === b) && <span className="arr-mark">{song.markers.find((m) => m.bar === b)!.name}</span>}</button>)}
          {loop && <div className="arr-loop" style={{ left: `${(loop.start / song.bars) * 100}%`, width: `${(loop.bars / song.bars) * 100}%` }} title="The looped stretch" />}
        </div>
        <div className="arr-side arr-side-top">
          <button className={`trk-auto${open.size ? " on" : ""}`} aria-pressed={open.size > 0} onClick={() => autoAll.current()} title="Automation mode (A, when the computer keyboard is off): show or hide the automation lanes">A</button>
          <button className={`arr-lock${song.lockAuto ? " on" : ""}`} aria-pressed={!!song.lockAuto} onClick={() => onChange((s) => (s.lockAuto ? (({ lockAuto: _off, ...rest }) => rest)(s) as Song : { ...s, lockAuto: true }))} title="Lock envelopes: when on, a clip that is moved leaves its automation where it was. When off, the automation under a clip moves with it.">Lock</button>
          <button onClick={() => onJump?.(-1)} disabled={!song.markers?.length} aria-label="To the marker before" title="Jump to the marker before this place">|◀</button>
          <button onClick={() => { if (mark !== undefined) onMarker?.(Math.floor(mark)); else onMarker?.(Math.max(0, bar)); }} aria-label="Set a marker" title="Set: name the bar where the time marker (or the song) is">Set</button>
          <button onClick={() => onJump?.(1)} disabled={!song.markers?.length} aria-label="To the marker after" title="Jump to the marker after this place">▶|</button>
          <span className="arr-zoom"><button onClick={() => setZoom(-1)} disabled={zoom === ZOOMS[0]} aria-label="Zoom out" title="Zoom out (-)">−</button><button onClick={() => setZoom(1)} disabled={zoom === ZOOMS[ZOOMS.length - 1]} aria-label="Zoom in" title="Zoom in (+)">+</button></span>
        </div>
      </div>
      {song.tracks.map((t, ti) => { const lt = live?.tracks[ti]?.id === t.id ? live.tracks[ti]! : t; return (
        <Fragment key={t.id}>
        <div className={`arr-row k-${t.kind}${picked.track === t.id ? " picked" : ""}${t.mute ? " muted" : ""}`} style={{ ["--tc" as string]: TRACK_COLORS[ti % TRACK_COLORS.length] }}>
          <div className="arr-bars" style={cols} ref={(el) => { if (el) rows.current.set(t.id, el); else rows.current.delete(t.id); }} onMouseDown={(e) => { if (picked.track !== t.id || picked.clip) onPick(t.id); onMarkAt?.(barAt(e.currentTarget, e.clientX, true)); }}>
            {bars.flatMap((b) => { const whole = !t.clips.some((c) => c.start < b + 1 && c.start + c.bars > b);
              const slot = (at: number, wide: number) => <button key={at} className={`arr-slot${b % 4 === 0 ? " four" : ""}${wide < Q ? " part" : ""}`} style={{ gridColumn: `${at * Q + 1} / span ${wide}`, gridRow: 1 }} onDoubleClick={() => onAdd(t.id, at)} onKeyDown={(e) => { if (e.key === "Enter") onAdd(t.id, at); }} aria-label={`Add a clip to ${t.name} at ${placeName(at)}`} title={t.kind === "audio" ? "An audio track: double-click a sound under Samples in the browser to put it here" : "Double-click to add a clip here"} />;
              return whole ? [slot(b, Q)] : beats.filter((q) => !clipAt(t, b + q * BEAT)).map((q) => slot(b + q * BEAT, 1)); })}
            {t.clips.map((c) => (
              <button key={c.id} className={`arr-clip${picked.track === t.id && (picked.clip === c.id || also.includes(c.id)) ? " picked" : ""}${c.off ? " off" : ""}${ghost?.clip === c.id ? " moving" : ""}`} style={{ gridColumn: `${c.start * Q + 1} / span ${c.bars * Q}`, gridRow: 1 }} onDoubleClick={() => onOpen?.("clip")} title="Drag to move it (hold Alt to copy). Drag its right edge to change its length. It moves a beat at a time. A click on its name strip puts the time marker at its start; a click lower down, where you clicked. Double-click to see what is in it."
                onMouseDown={(e) => { e.stopPropagation(); onPick(t.id, c.id, e.shiftKey || e.ctrlKey || e.metaKey); const lane = rows.current.get(t.id); if ((e.target as HTMLElement).closest(".arr-clip-name")) onMarkAt?.(c.start); else if (lane) onMarkAt?.(barAt(lane, e.clientX, true)); if (e.button === 0 && !e.shiftKey && !e.ctrlKey && !e.metaKey) { const r = e.currentTarget.getBoundingClientRect(); drag.current = { from: t.id, clip: c, x: e.clientX, y: e.clientY, grab: Math.min(c.bars - BEAT, Math.floor((e.clientX - r.left) / (r.width / (c.bars * Q))) / Q), moved: false, size: e.clientX > r.right - 8 }; } }} aria-pressed={picked.track === t.id && (picked.clip === c.id || also.includes(c.id))} aria-label={`${t.name} clip at ${placeName(c.start)}, ${c.bars} bar${c.bars === 1 ? "" : "s"}${c.off ? ", switched off" : ""}`}>
                <span className="arr-clip-name">{"sample" in c ? c.label : t.name}</span>
                <ClipPicture track={t} clip={c} peaksOf={peaksOf} bpm={song.bpm} />
                <span className="arr-grip" aria-hidden="true" />
              </button>
            ))}
            {ghost && ghost.track === t.id && <div className={`arr-ghost${ghost.ok ? "" : " no"}`} style={{ gridColumn: `${ghost.bar * Q + 1} / span ${ghost.bars * Q}` }} />}
            {mark !== undefined && <div className="arr-cut" style={{ left: `${(mark / song.bars) * 100}%` }} />}
            {head && <div className="arr-now" style={{ left: head }} />}
          </div>
          <div className="arr-side" onMouseDown={() => { if (picked.track !== t.id) onPick(t.id); }}>
            <input type="text" className="arr-name" value={t.name} maxLength={24} aria-label="Track name" onDoubleClick={() => onOpen?.("device")} ref={(el) => { if (el && renaming === t.id && document.activeElement !== el) { el.focus(); el.select(); } }} onChange={(e) => onChange((s) => setTrack(s, t.id, { name: e.target.value }))} onKeyDown={(e) => { if (e.key === "Enter" || e.key === "Escape") (e.target as HTMLInputElement).blur(); }} />
            <button className={`trk-on${t.mute ? "" : " on"}`} aria-pressed={!t.mute} aria-label={`${t.name} on`} title="Track on or off (0)" onClick={() => onChange((s) => setTrack(s, t.id, { mute: !t.mute }))}>{ti + 1}</button>
            <button className={`trk-solo${t.solo ? " on" : ""}`} aria-pressed={t.solo} aria-label={`Solo ${t.name}`} title="Solo: hear only this track (S). Hold Ctrl or Cmd to solo several." onClick={(e) => onChange((s) => (e.ctrlKey || e.metaKey ? setTrack(s, t.id, { solo: !t.solo }) : soloOnly(s, t.id)))}>S</button>
            <span className="arr-mix">
              <input type="range" className={`arr-level${lanesOff(t.id, "level", t.auto)}`} min={0} max={100} value={lt.level} aria-label={`${t.name} level`} title={`Level: ${faderText(lt.level)} (double-click for 0 dB)`} onChange={(e) => onChange((s) => setTrack(s, t.id, { level: Number(e.target.value) }))} onDoubleClick={() => onChange((s) => setTrack(s, t.id, { level: 80 }))} />
              {levelOf && <LevelBar read={() => levelOf(t.id)} />}
            </span>
            <input type="range" className={`arr-pan${lanesOff(t.id, "pan", t.auto)}`} min={-100} max={100} step={5} value={lt.pan} aria-label={`${t.name} pan`} title={t.pan === 0 ? "Pan: centre (double-click to centre)" : `Pan: ${Math.abs(t.pan)} ${t.pan < 0 ? "left" : "right"} (double-click to centre)`} onChange={(e) => onChange((s) => setTrack(s, t.id, { pan: Number(e.target.value) }))} onDoubleClick={() => onChange((s) => setTrack(s, t.id, { pan: 0 }))} />
            {song.returns.map((r) => <input key={r.id} type="range" className="arr-send" min={0} max={100} step={5} value={t.sends?.[r.id] ?? 0} aria-label={`${t.name} send to ${r.name}`} title={`Send to ${r.name}: ${t.sends?.[r.id] ?? 0}. How much of this track also goes through that return track's effects (double-click for none).`} onChange={(e) => onChange((x) => setSend(x, t.id, r.id, Number(e.target.value)))} onDoubleClick={() => onChange((x) => setSend(x, t.id, r.id, 0))} />)}
            <button className={`trk-auto${open.has(t.id) ? " on" : ""}`} aria-pressed={open.has(t.id)} aria-label={`Automation for ${t.name}`} title="Show this track's automation: lines along the song that move its level, pan or an effect's setting as it plays" onClick={() => { setOpen((o) => { const n = new Set(o); if (n.has(t.id)) n.delete(t.id); else n.add(t.id); return n; }); if (!open.has(t.id) && !t.auto.length) onChange((s) => setAuto(s, t.id, addLane([], t))); }}>A{t.auto.some((l) => l.points.length) ? "•" : ""}</button>
            {song.tracks.length > 1 && <button className="arr-x" aria-label={`Delete track ${t.name}`} title="Delete this track" onClick={() => { if (window.confirm(`Delete the track “${t.name}” and its clips?`)) onChange((s) => removeTrack(s, t.id)); }}>×</button>}
          </div>
        </div>
        {open.has(t.id) && <>
          {t.auto.map((lane, li) => <AutoLaneRow off={overridden?.has(overKey(t.id, lane.target))} span={span} key={lane.target} track={t} lane={lane} index={li} steps={song.bars * STEPS_PER_BAR} cols={cols} onMark={onMark} onLanes={(next) => onChange((s) => setAuto(s, t.id, next))} />)}
          {t.auto.length < MAX_LANES && <div className="arr-row arr-auto more"><div className="arr-bars" style={cols} /><div className="arr-side"><button onClick={() => onChange((s) => setAuto(s, t.id, addLane(t.auto, t)))} title="Another line, for another setting of this track">+ Automation lane</button></div></div>}
        </>}
        </Fragment>
      ); })}
      {song.returns.map((r) => { const setR = (next: AutoLane[]) => onChange((s) => setReturn(s, r.id, { auto: next })); return (
        <Fragment key={r.id}>
        <div className={`arr-row arr-return${back === r.id ? " picked" : ""}${r.mute ? " muted" : ""}`}>
          <div className="arr-bars" style={cols} onMouseDown={() => onBack?.(r.id)}><span className="arr-return-note">Return track: tracks send sound here with their {r.id === "ra" ? "first" : "second"} send slider; it comes back through these effects.</span></div>
          <div className="arr-side" onMouseDown={() => onBack?.(r.id)}>
            <input type="text" className="arr-name" value={r.name} maxLength={24} aria-label="Return track name" onChange={(e) => onChange((s) => setReturn(s, r.id, { name: e.target.value }))} onKeyDown={(e) => { if (e.key === "Enter" || e.key === "Escape") (e.target as HTMLInputElement).blur(); }} />
            <button className={`trk-on${r.mute ? "" : " on"}`} aria-pressed={!r.mute} aria-label={`${r.name} on`} title="Return track on or off" onClick={() => onChange((s) => setReturn(s, r.id, { mute: !r.mute }))}>{r.id === "ra" ? "A" : "B"}</button>
            <span className="arr-mix">
              <input type="range" className={`arr-level${lanesOff(r.id, "level", r.auto)}`} min={0} max={100} value={r.level} aria-label={`${r.name} level`} title={`Level: ${faderText(r.level)} (double-click for 0 dB)`} onChange={(e) => onChange((s) => setReturn(s, r.id, { level: Number(e.target.value) }))} onDoubleClick={() => onChange((s) => setReturn(s, r.id, { level: 80 }))} />
              {levelOf && <LevelBar read={() => levelOf(r.id)} />}
            </span>
            <input type="range" className="arr-pan" min={-100} max={100} step={5} value={r.pan} aria-label={`${r.name} pan`} title="Pan (double-click to centre)" onChange={(e) => onChange((s) => setReturn(s, r.id, { pan: Number(e.target.value) }))} onDoubleClick={() => onChange((s) => setReturn(s, r.id, { pan: 0 }))} />
            {autoButton(r.id, r, setR)}
            <button className="arr-x" aria-label={`Delete return track ${r.name}`} title="Delete this return track" onClick={() => { if (window.confirm(`Delete the return track “${r.name}”?`)) { onMark(); onChange((s) => removeReturn(s, r.id)); } }}>×</button>
          </div>
        </div>
        {lanesFor(r.id, r, setR)}
        </Fragment>
      ); })}
      <div className={`arr-row arr-master${back === "master" ? " picked" : ""}`}>
        <div className="arr-bars" style={cols} onMouseDown={() => onBack?.("master")}><span className="arr-return-note">{song.masterFx?.length ? `Master: ${song.masterFx.length} effect${song.masterFx.length === 1 ? "" : "s"} on everything. Click to see them.` : "Master: click here to put effects on everything (a limiter, an EQ)."}</span></div>
        <div className="arr-side" onMouseDown={() => onBack?.("master")}>
          <span className="arr-name master">Master</span>
          <span className="arr-mix">
            <input type="range" className={`arr-level${lanesOff("master", "level", song.masterAuto)}`} min={0} max={100} value={live?.volume ?? song.volume} aria-label="Master volume" title={`Master volume ${live?.volume ?? song.volume}`} onChange={(e) => onChange((s) => ({ ...s, volume: Number(e.target.value) }))} onDoubleClick={() => onChange((s) => ({ ...s, volume: MASTER_START }))} />
            {masterLevel && <LevelBar read={masterLevel} wide />}
            {masterStereo && <StereoRead read={masterStereo} />}
          </span>
          {autoButton("master", master, setMaster)}
        </div>
      </div>
      {lanesFor("master", master, setMaster)}
    </div>
  );
}
