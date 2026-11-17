// The drum rack: a block of pads, and the settings of the pad that is picked. Each pad plays a built-in drum
// or one of the learner's own sound files; the step grid underneath has a row for every pad.
import { useRef, useState } from "react";
import { CHOKE_GROUPS, FADE_MAX, MAX_PADS, TUNE_MAX, VOICES, VOICE_NAMES, addPad, audible, padWindow, removePad, setLane, setSample, type Pattern, type Voice } from "../../daw/drums";
import type { Studio } from "./useStudio";

export function Wave({ peaks, start, length, fade, seconds }: { peaks: number[]; start: number; length: number; fade: number; seconds: number }) {
  const w = padWindow({ start, length, fade }, seconds || 1), n = peaks.length || 1, x0 = (w.offset / (seconds || 1)) * n, x1 = ((w.offset + w.span) / (seconds || 1)) * n, xf = ((w.offset + w.span - w.fade) / (seconds || 1)) * n;
  return (
    <svg className="pad-wave" viewBox={`0 0 ${n} 40`} preserveAspectRatio="none" role="img" aria-label="The sound's shape, with the part that plays lit">
      {peaks.map((p, i) => <rect key={i} x={i} y={20 - p * 19} width={0.8} height={Math.max(0.6, p * 38)} className={i >= x0 && i < x1 ? "in" : "out"} />)}
      <line x1={x0} x2={x0} y1={0} y2={40} className="edge" /><line x1={x1} x2={x1} y1={0} y2={40} className="edge" />
      {w.fade > 0 && <polyline points={`${xf},1 ${x1},39`} className="fade" />}
    </svg>
  );
}

export function DrumRack({ pattern, onChange, studio, trackId, picked, onPick, step, onStrike }: { /** a pad was struck by hand (for recording) */ onStrike?: (lane: number) => void; pattern: Pattern; onChange: (p: Pattern) => void; studio: Studio; trackId: string; picked: number; onPick: (lane: number) => void; step: number }) {
  const [note, setNote] = useState("");
  const [over, setOver] = useState(-1);
  const picker = useRef<HTMLInputElement>(null);
  const { samples, addSample, removeSample, transport } = studio;
  const lane = pattern.lanes[picked], on = audible(pattern);
  const hear = (i: number, p: Pattern = pattern) => { const l = p.lanes[i]; if (l) transport.hitPad(trackId, l); };
  const take = async (i: number, file: File) => {
    setNote(""); onPick(i);
    try { const s = await addSample(file, samples.length); const next = setLane(setSample(pattern, i, s.id), i, { name: s.name.slice(0, 24), start: 0, length: 100, fade: 0 }); onChange(next); hear(i, next); void s.shared.then(setNote); }
    catch (e) { setNote(e instanceof Error ? e.message : "That file could not be used."); }
  };
  const set = (change: Parameters<typeof setLane>[2]) => onChange(setLane(pattern, picked, change));
  const own = lane?.sample ? samples.find((s) => s.id === lane.sample) : undefined;
  return (
    <div className="drack">
      <div className="rack-pads" role="group" aria-label="Pads">
        {pattern.lanes.map((l, i) => (
          <button key={l.id} className={`pad${i === picked ? " picked" : ""}${step >= 0 && on[i] && (l.steps[step] ?? 0) > 0 ? " lit" : ""}${l.mute ? " muted" : ""}${over === i ? " over" : ""}`} aria-pressed={i === picked} aria-label={`Pad ${l.name}`}
            onMouseDown={() => { onPick(i); hear(i); onStrike?.(i); }}
            onKeyDown={(e) => { if (e.key === "Enter") { onPick(i); hear(i); } }}
            onDragOver={(e) => { if (e.dataTransfer.types.includes("Files")) { e.preventDefault(); setOver(i); } }} onDragLeave={() => setOver(-1)}
            onDrop={(e) => { e.preventDefault(); setOver(-1); const f = e.dataTransfer.files[0]; if (f) void take(i, f); }}>
            <b>{l.name}</b>
            <small>{l.sample ? "♪ your sound" : VOICE_NAMES[l.voice]}{l.choke ? ` · group ${l.choke}` : ""}</small>
          </button>
        ))}
        {pattern.lanes.length < MAX_PADS && <button className="pad add" onClick={() => { const next = addPad(pattern); onChange(next); onPick(next.lanes.length - 1); }}>+ Add a pad</button>}
      </div>
      {lane && <div className="rack-edit">
        <div className="rack-head">
          <input type="text" className="rack-name" value={lane.name} maxLength={24} aria-label="Pad name" onChange={(e) => onChange({ ...pattern, lanes: pattern.lanes.map((l, i) => (i === picked ? { ...l, name: e.target.value } : l)) })} />
          <button onClick={() => hear(picked)}>Hear it</button>
          {pattern.lanes.length > 1 && <button className="linkish" onClick={() => { onChange(removePad(pattern, picked)); onPick(Math.max(0, picked - 1)); }}>Remove this pad</button>}
        </div>
        <div className="rack-source">
          <span className="rack-now">{own ? <>Plays your sound <b>{own.name}</b></> : lane.sample ? "Its sound file is not in this browser, so the built-in drum plays" : "Plays a built-in drum"}</span>
          {!own && <label>Drum <select value={lane.voice} onChange={(e) => { const next = setLane(pattern, picked, { voice: e.target.value as Voice }); onChange(next); hear(picked, next); }}>{VOICES.map((v) => <option key={v} value={v}>{VOICE_NAMES[v]}</option>)}</select></label>}
          <input ref={picker} type="file" accept="audio/*,.wav,.mp3,.flac,.ogg,.aif,.aiff,.m4a" hidden onChange={(e) => { const f = e.target.files?.[0]; e.target.value = ""; if (f) void take(picked, f); }} />
          <button className="primary" onClick={() => picker.current?.click()}>Upload a sound…</button>
          {lane.sample && <button onClick={() => onChange(setSample(pattern, picked))}>Use the built-in drum</button>}
        </div>
        {note && <p className={/library|browser/.test(note) && !/could not|does not/i.test(note) ? "daw-sound-ok" : "daw-sound-note"} role="status">{note}</p>}
        {own && <Wave peaks={transport.peaks(own.id)} start={lane.start} length={lane.length} fade={lane.fade} seconds={transport.seconds(own.id)} />}
        <div className="rack-knobs">
          {own && <>
            <label className="daw-knob"><span>Start <b>{lane.start}</b>%</span><input type="range" min={0} max={95} value={lane.start} onChange={(e) => set({ start: Number(e.target.value) })} /></label>
            <label className="daw-knob"><span>Length <b>{lane.length}</b>%</span><input type="range" min={5} max={100} value={lane.length} onChange={(e) => set({ length: Number(e.target.value) })} /></label>
            <label className="daw-knob"><span>Fade out <b>{lane.fade}</b> ms</span><input type="range" min={0} max={FADE_MAX} step={10} value={lane.fade} onChange={(e) => set({ fade: Number(e.target.value) })} /></label>
          </>}
          {!own && <>
            <label className="daw-knob" title="How long the drum rings, against its usual length (double-click for usual)"><span>Decay <b>{lane.decay ?? 100}</b>%</span><input type="range" min={25} max={400} step={5} value={lane.decay ?? 100} onChange={(e) => set({ decay: Number(e.target.value) })} onDoubleClick={() => set({ decay: 100 })} /></label>
            <label className="daw-knob" title="Darker or brighter: it moves the drum's noise and metal parts (double-click for usual)"><span>Tone <b>{(lane.tone ?? 0) > 0 ? "+" : ""}{lane.tone ?? 0}</b></span><input type="range" min={-100} max={100} step={5} value={lane.tone ?? 0} onChange={(e) => set({ tone: Number(e.target.value) })} onDoubleClick={() => set({ tone: 0 })} /></label>
          </>}
          <label className="daw-knob"><span>Tune <b>{lane.tune > 0 ? "+" : ""}{lane.tune}</b> semitones</span><input type="range" min={-TUNE_MAX} max={TUNE_MAX} value={lane.tune} onChange={(e) => set({ tune: Number(e.target.value) })} onDoubleClick={() => set({ tune: 0 })} /></label>
          <label className="daw-knob"><span>Level <b>{lane.level}</b></span><input type="range" min={0} max={100} value={lane.level} onChange={(e) => set({ level: Number(e.target.value) })} /></label>
          <label className="daw-knob"><span>Pan <b>{lane.pan === 0 ? "centre" : lane.pan < 0 ? `${-lane.pan} left` : `${lane.pan} right`}</b></span><input type="range" min={-100} max={100} step={5} value={lane.pan} onChange={(e) => set({ pan: Number(e.target.value) })} onDoubleClick={() => set({ pan: 0 })} /></label>
          <label className="daw-knob" title="Pads in the same group cut each other off, as a closed hi-hat cuts an open one"><span>Choke group</span>
            <select value={lane.choke} onChange={(e) => set({ choke: Number(e.target.value) })}><option value={0}>None</option>{Array.from({ length: CHOKE_GROUPS }, (_, i) => <option key={i} value={i + 1}>Group {i + 1}</option>)}</select></label>
        </div>
        {samples.length > 0 && <>
          <p className="daw-sound-label">Your sounds: click one to put it on this pad</p>
          <div className="daw-chips">{samples.map((s) => <span key={s.id} className={`daw-chip${lane.sample === s.id ? " on" : ""}`}><button onClick={() => { const next = setSample(pattern, picked, s.id); onChange(next); hear(picked, next); }}>{s.name}</button><button aria-label={`Delete ${s.name}`} title="Delete from this browser" onClick={() => removeSample(s.id)}>×</button></span>)}</div>
        </>}
        <p className="muted daw-sound-small">Drag a sound file from your computer onto any pad. A file is kept in this browser and, if it is 2 MB or under, saved to the site's library for everyone signed in.</p>
      </div>}
    </div>
  );
}
