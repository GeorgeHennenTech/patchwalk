// The Studio tab: a small DAW. Tracks and clips on a grid, a drum rack with a step grid for drum tracks,
// and the practice synth with a piano roll for synth tracks, all playing on one clock.
import { useEffect, useMemo, useRef, useState } from "react";
import { DrumGrid } from "./DrumGrid";
import { Arrangement } from "./studio/Arrangement";
import { DrumRack } from "./studio/DrumRack";
import { PianoRoll } from "./studio/PianoRoll";
import { TrackSynth } from "./studio/TrackSynth";
import { firstSong, useStudio } from "./studio/useStudio";
import { BPM_MAX, BPM_MIN, GENRE_STARTERS, STARTERS, STEPS_PER_BAR, SWING_MAX, clearAll, setHit, tidySteps, type Pattern } from "../daw/drums";
import { PPQ, hitsToMidi, midiBars, midiToHits, midiToNotes, notesToMidi, readMidi, songToMidi, writeMidi } from "../daw/midi";
import { CLIP_BARS, MAX_TRACKS, SONG_BARS, SOUNDS, addClip, addTrack, clipOf, clipPattern, duplicateClip, moveClip, newSong, removeClip, setClipBars, setNotes, setPatch, setSongBars, setSongSwing, setSongTempo, trackOf, withPads, withPattern, type Song } from "../daw/song";
import { loadBreaks, loadRacks, loadSaved, loadSongs, rackOnto, saveSong, storeBreaks, storeRacks, storeSongs, withNamed, withSavedSong, withoutSavedSong, type Break, type Rack } from "../daw/store";

const fileName = (name: string) => (name.trim().replace(/[^\w-]+/g, "_") || "patchwalk");
function download(bytes: Uint8Array, name: string): void {
  const a = document.createElement("a");
  a.href = URL.createObjectURL(new Blob([bytes as BlobPart], { type: "audio/midi" })); a.download = `${fileName(name)}.mid`; a.click();
  window.setTimeout(() => URL.revokeObjectURL(a.href), 1000);
}

export default function DawView() {
  const studio = useStudio();
  const { song, change, playing, toggle, step, transport, undo, redo } = studio;
  const [rec, setRec] = useState(false);
  const [note, setNote] = useState("");
  const [breaks, setBreaks] = useState(loadBreaks);
  const [racks, setRacks] = useState(loadRacks);
  const [saveAs, setSaveAs] = useState("");
  const midiIn = useRef<HTMLInputElement>(null);
  const heldKeys = useRef(new Map<number, { start: number; velocity: number }>());
  const [picked, setPicked] = useState<{ track?: string; clip?: string }>(() => ({ track: song.tracks[0]?.id, clip: song.tracks[0]?.clips[0]?.id }));
  const [pad, setPad] = useState(0);
  const [loopClip, setLoopClip] = useState(false);
  const [help, setHelp] = useState(false);
  const [songs, setSongs] = useState(loadSongs);
  const [sound, setSound] = useState(SOUNDS[0]!.name);
  const oldPatterns = useMemo(loadSaved, []);
  const track = trackOf(song, picked.track), clip = clipOf(track, picked.clip);
  useEffect(() => { saveSong(song); }, [song]);
  useEffect(() => { studio.setLoop(loopClip && clip ? { start: clip.start, bars: clip.bars } : undefined); }, [loopClip, clip?.start, clip?.bars, studio]);
  useEffect(() => {
    const key = (e: KeyboardEvent) => {
      const t = e.target as HTMLElement | null;
      if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === "z" && !(t && (t.tagName === "INPUT" || t.tagName === "TEXTAREA"))) { e.preventDefault(); if (e.shiftKey) redo(); else undo(); return; }
      if (e.code !== "Space" || (t && (t.tagName === "INPUT" && (t as HTMLInputElement).type === "text" || t.tagName === "TEXTAREA" || t.tagName === "SELECT"))) return;
      e.preventDefault(); toggle();
    };
    window.addEventListener("keydown", key);
    return () => window.removeEventListener("keydown", key);
  }, [toggle, undo, redo]);
  const open = (s: Song) => { if (playing) toggle(); change(s); setPicked({ track: s.tracks[0]?.id, clip: s.tracks[0]?.clips[0]?.id }); setPad(0); };
  const add = (trackId: string, bar: number) => { const made = addClip(song, trackId, bar); if (made) { change(made.song); setPicked({ track: trackId, clip: made.clip }); } };
  const local = clip && step >= clip.start * STEPS_PER_BAR && step < (clip.start + clip.bars) * STEPS_PER_BAR ? step - clip.start * STEPS_PER_BAR : -1;
  // a drum track's pads as a pattern: with the picked clip's rows, or with empty rows when no clip is picked
  const pattern: Pattern | undefined = track?.kind === "drums" ? (clip && "hits" in clip ? clipPattern(song, track, clip) : { name: track.name, bpm: song.bpm, swing: song.swing, length: 16, lanes: track.pads.map((p) => ({ ...p, steps: tidySteps(undefined, 16) })) }) : undefined;
  const setPattern = (p: Pattern) => { if (!track) return; change((s) => (clip ? withPattern(s, track.id, clip.id, p) : withPads(s, track.id, p.lanes.map(({ steps: _s, ...rest }) => rest)))); };
  // a starting point fills this clip: each pad takes the row of the starter's drum of the same kind
  const fill = (from: Pattern) => { if (!track || track.kind !== "drums" || !clip || !pattern) return; const used = new Set<string>();
    const lanes = pattern.lanes.map((l) => { const src = l.sample || used.has(l.voice) ? undefined : from.lanes.find((x) => x.voice === l.voice); if (src) used.add(l.voice); return { ...l, steps: tidySteps(src?.steps, from.length) }; });
    change((s) => withPattern(setSongSwing(setSongTempo(s, from.bpm), from.swing), track.id, clip.id, { ...pattern, length: from.length, lanes })); };
  const engine = track?.kind === "synth" ? transport.engine(track.id) : undefined;
  // Recording: what is played while the song runs is written into the open clip, on the nearest step.
  const spot = () => { if (!rec || !clip) return undefined; const pos = transport.position(); return pos < 0 ? undefined : { at: pos - clip.start * STEPS_PER_BAR, steps: clip.bars * STEPS_PER_BAR }; };
  const onNote = (key: number, on: boolean, velocity: number) => {
    const p = spot();
    if (!p || !track || !clip || !("notes" in clip)) { if (!on) heldKeys.current.delete(key); return; }
    if (on) { if (p.at > -0.5 && p.at < p.steps - 0.5) heldKeys.current.set(key, { start: Math.max(0, Math.round(p.at)), velocity }); return; }
    const h = heldKeys.current.get(key);
    if (!h) return;
    heldKeys.current.delete(key);
    const end = p.at < h.start - 0.5 ? p.steps : Math.max(h.start + 1, Math.min(p.steps, Math.round(p.at)));
    change((s) => { const c = clipOf(trackOf(s, track.id), clip.id); return c && "notes" in c ? setNotes(s, track.id, clip.id, [...c.notes.filter((n) => !(n.note === key && n.start === h.start)), { note: key, start: h.start, length: end - h.start, velocity: h.velocity }]) : s; });
  };
  const onStrike = (lane: number) => { const p = spot(); if (!p || !pattern || !clip || !("hits" in clip) || p.at <= -0.5) return; setPattern(setHit(pattern, lane, Math.round(p.at) % p.steps, 2)); };
  // MIDI files out and in
  const clipOut = () => { if (!track || !clip) return; download(writeMidi({ ppq: PPQ, bpm: song.bpm, tracks: [{ name: track.name, channel: track.kind === "drums" ? 9 : 0, notes: "hits" in clip && pattern ? hitsToMidi(pattern.lanes.map((l) => l.steps)) : "notes" in clip ? notesToMidi(clip.notes) : [] }] }), `${track.name}_bar${clip.start + 1}`); };
  const clipIn = async (f: File) => {
    if (!track || !clip) return;
    const file = readMidi(new Uint8Array(await f.arrayBuffer())), notes = file?.tracks.flatMap((t) => t.notes) ?? [];
    if (!file || !notes.length) { setNote("That file has no notes this app can read. It needs to be a MIDI file (.mid)."); return; }
    const want = midiBars(notes, file.ppq), bars = track.kind === "drums" ? Math.min(2, want) : want > 2 ? 4 : want;
    const sized = setClipBars(song, track.id, clip.id, bars), now = clipOf(trackOf(sized, track.id), clip.id)!, steps = now.bars * STEPS_PER_BAR;
    if (track.kind === "drums") { const got = midiToHits(notes, file.ppq, track.pads.length, steps), p = clipPattern(sized, track, now as never); change(withPattern(sized, track.id, clip.id, { ...p, lanes: p.lanes.map((l, i) => ({ ...l, steps: got.rows[i]! })) })); setNote(`Brought in ${notes.length - got.left} hits${got.left ? `; ${got.left} did not fit (outside the pads, or past the end of the clip)` : ""}. Pad 1 is the note C1, pad 2 the next key up, and so on.`); }
    else { const got = midiToNotes(notes, file.ppq, steps); change(setNotes(sized, track.id, clip.id, got.notes)); setNote(`Brought in ${got.notes.length} notes${got.left ? `; ${got.left} were past the end of the clip` : ""}.`); }
  };
  const keepBreak = () => { if (!pattern || !clip) return; const b: Break = { name: saveAs.trim() || `${track!.name} bar ${clip.start + 1}`, bars: clip.bars === 2 ? 2 : 1, bpm: song.bpm, swing: song.swing, rows: pattern.lanes.map((l) => l.steps), pads: pattern.lanes.map((l) => l.name) }; const next = withNamed(breaks, b); setBreaks(next); storeBreaks(next); setNote(`Saved the break “${b.name}”.`); };
  const useBreak = (b: Break) => { if (!track || !clip || !pattern) return; const sized = setClipBars(song, track.id, clip.id, b.bars), now = clipOf(trackOf(sized, track.id), clip.id)!, p = clipPattern(sized, track as never, now as never); change(withPattern(sized, track.id, clip.id, { ...p, lanes: p.lanes.map((l, i) => ({ ...l, steps: tidySteps(b.rows[i], p.length) })) })); setNote(b.rows.length > p.lanes.length ? `“${b.name}” was written for ${b.rows.length} pads; this rack has ${p.lanes.length}, so the rest were left out.` : ""); };
  const keepRack = () => { if (!track || track.kind !== "drums") return; const r: Rack = { name: saveAs.trim() || track.name, pads: track.pads }; const next = withNamed(racks, r); setRacks(next); storeRacks(next); setNote(`Saved the rack “${r.name}”.`); };
  return (
    <section className="panel daw">
      <h2>Studio</h2>
      <p className="daw-lede">Tracks run down the side and bars along the top. Click an empty bar to add a clip, click a clip to open it below, then press Play.</p>
      <div className="daw-bar">
        <button className="primary daw-play" onClick={toggle} aria-pressed={playing}>{playing ? "■ Stop" : "▶ Play"}</button>
        <label className="daw-knob"><span>Tempo <b>{song.bpm}</b> bpm</span>
          <input type="range" min={BPM_MIN} max={BPM_MAX} value={song.bpm} onChange={(e) => change((s) => setSongTempo(s, Number(e.target.value)))} /></label>
        <label className="daw-knob" title="Plays every second step late. 0 is straight; around 55 to 65 is a shuffle."><span>Swing <b>{song.swing}</b>%</span>
          <input type="range" min={0} max={SWING_MAX} value={song.swing} onChange={(e) => change((s) => setSongSwing(s, Number(e.target.value)))} /></label>
        <label className="daw-knob"><span>Song length</span>
          <select value={song.bars} onChange={(e) => { const bars = Number(e.target.value); if (bars > song.bars || !song.tracks.some((t) => t.clips.some((c) => c.start + c.bars > bars)) || window.confirm("Clips past the new end will be removed. Go on?")) change((s) => setSongBars(s, bars)); }}>{SONG_BARS.map((b) => <option key={b} value={b}>{b} bars</option>)}</select></label>
        <button className={`daw-rec${rec ? " on" : ""}`} aria-pressed={rec} title="While this is on and the song is playing, what you play on the keys or the pads is written into the open clip" onClick={() => { if (!rec && !playing) toggle(); setRec(!rec); }}>● {rec ? "Recording" : "Record"}</button>
        <button onClick={undo} disabled={!studio.canUndo} title="Undo (Ctrl+Z)">↶ Undo</button>
        <button onClick={redo} disabled={!studio.canRedo} title="Redo (Ctrl+Shift+Z)">↷ Redo</button>
        <label className="daw-check" title="Play only the open clip, round and round, while you work on it"><input type="checkbox" checked={loopClip} onChange={(e) => setLoopClip(e.target.checked)} /> Loop the open clip</label>
        <button className="linkish" onClick={() => setHelp(!help)} aria-expanded={help}>{help ? "Hide the controls" : "How to use it"}</button>
      </div>
      {help && <ul className="daw-help">
        <li><b>Tracks:</b> a drum track holds a rack of pads; a synth track holds one sound of the synth. Add either with the buttons under the grid. M mutes a track, S plays it alone, the slider is its level.</li>
        <li><b>Clips:</b> click <b>+</b> on an empty bar to add one; click a clip to open it. Duplicate copies it into the next free place.</li>
        <li><b>Drums:</b> click a pad to hear and pick it. In the step grid, click boxes to place hits, drag to paint, Shift-click or right-click a hit for normal, accent, soft.</li>
        <li><b>Notes:</b> in the piano roll, click to add a note and drag right to make it longer. Drag a note to move it, drag its right end to resize it, double-click or right-click to remove it.</li>
        <li><b>Record:</b> switch it on, and what you play on the letter keys, a MIDI keyboard or the pads while the song runs is written into the open clip on the nearest step. "Loop the open clip" helps.</li>
        <li><b>Undo:</b> Ctrl+Z, and Ctrl+Shift+Z to redo.</li>
        <li><b>MIDI files:</b> "Download .mid" saves a clip (or the whole song) as a file any DAW opens; "Bring in .mid" reads one into the open clip.</li>
        <li><b>Space</b> starts and stops. You can change anything while it plays.</li>
      </ul>}
      <Arrangement song={song} onChange={change} picked={picked} onPick={(t, c) => { setPicked({ track: t, clip: c }); setPad(0); }} onAdd={add} step={step} />
      <div className="daw-add">
        <button onClick={() => { const next = addTrack(song, "drums"); change(next); setPicked({ track: next.tracks.at(-1)?.id }); }} disabled={song.tracks.length >= MAX_TRACKS}>+ Drum track</button>
        <button onClick={() => { const next = addTrack(song, "synth", sound); change(next); setPicked({ track: next.tracks.at(-1)?.id }); }} disabled={song.tracks.length >= MAX_TRACKS}>+ Synth track</button>
        <label>with the sound <select value={sound} onChange={(e) => setSound(e.target.value)}>{SOUNDS.map((s) => <option key={s.name}>{s.name}</option>)}</select></label>
      </div>

      {track && <div className={`daw-edit k-${track.kind}`}>
        <div className="daw-edit-head">
          <h3>{track.name}{clip ? <small> · bar {clip.start + 1}{clip.bars > 1 ? ` to ${clip.start + clip.bars}` : ""}</small> : null}</h3>
          {clip && <>
            <div className="seg" role="group" aria-label="Clip length">{CLIP_BARS[track.kind].map((b) => <button key={b} className={clip.bars === b ? "on" : ""} onClick={() => change((s) => setClipBars(s, track.id, clip.id, b))}>{b} bar{b === 1 ? "" : "s"}</button>)}</div>
            <button onClick={() => change((s) => moveClip(s, track.id, clip.id, -1))} title="Move the clip one bar earlier" aria-label="Move clip earlier">◀</button>
            <button onClick={() => change((s) => moveClip(s, track.id, clip.id, 1))} title="Move the clip one bar later" aria-label="Move clip later">▶</button>
            <button onClick={() => { const made = duplicateClip(song, track.id, clip.id); if (made) { change(made.song); setPicked({ track: track.id, clip: made.clip }); } }}>Duplicate</button>
            {"hits" in clip && pattern && <button onClick={() => setPattern(clearAll(pattern))}>Clear</button>}
            {"notes" in clip && <button onClick={() => change((s) => setNotes(s, track.id, clip.id, []))}>Clear</button>}
            <button onClick={clipOut} title="Save this clip as a MIDI file that Ableton and other DAWs open">Download .mid</button>
            <input ref={midiIn} type="file" accept=".mid,.midi,audio/midi" hidden onChange={(e) => { const f = e.target.files?.[0]; e.target.value = ""; if (f) void clipIn(f); }} />
            <button onClick={() => midiIn.current?.click()} title="Read a MIDI file into this clip, replacing what is in it">Bring in .mid</button>
            <button className="linkish" onClick={() => { change((s) => removeClip(s, track.id, clip.id)); setPicked({ track: track.id }); }}>Delete clip</button>
          </>}
        </div>
        {note && <p className="daw-note" role="status">{note}</p>}
        {!clip && <p className="daw-hint">No clip is open. Click <b>+</b> on an empty bar of this track to add one{track.clips.length ? ", or click one of its clips" : ""}.</p>}
        {track.kind === "drums" && pattern && <>
          <DrumRack pattern={pattern} onChange={setPattern} studio={studio} trackId={track.id} picked={Math.min(pad, pattern.lanes.length - 1)} onPick={setPad} step={local} onStrike={onStrike} />
          <div className="daw-keep">
            <input type="text" value={saveAs} maxLength={40} placeholder="Name to save under" aria-label="Name to save a break or rack under" onChange={(e) => setSaveAs(e.target.value)} />
            {clip && <button onClick={keepBreak} title="Keep this clip's hits to use again in any song">Save this break</button>}
            <button onClick={keepRack} title="Keep these pads and their settings to use on any drum track">Save this rack</button>
          </div>
          {(breaks.length > 0 || racks.length > 0) && <div className="daw-kept">
            {clip && breaks.length > 0 && <div><p className="daw-sound-label">Your breaks: click one to put it in this clip</p><div className="daw-chips">{breaks.map((b) => <span key={b.name} className="daw-chip"><button onClick={() => useBreak(b)} title={`${b.bars} bar${b.bars === 1 ? "" : "s"}, written at ${b.bpm} bpm`}>{b.name}</button><button aria-label={`Delete break ${b.name}`} title="Delete" onClick={() => { const next = breaks.filter((x) => x.name !== b.name); setBreaks(next); storeBreaks(next); }}>×</button></span>)}</div></div>}
            {racks.length > 0 && <div><p className="daw-sound-label">Your racks: click one to put its pads on this track</p><div className="daw-chips">{racks.map((r) => <span key={r.name} className="daw-chip"><button onClick={() => change((s) => withPads(s, track.id, rackOnto(track.pads, r)))} title={`${r.pads.length} pads`}>{r.name}</button><button aria-label={`Delete rack ${r.name}`} title="Delete" onClick={() => { const next = racks.filter((x) => x.name !== r.name); setRacks(next); storeRacks(next); }}>×</button></span>)}</div></div>}
          </div>}
          {clip && <>
            <DrumGrid pattern={pattern} onChange={setPattern} step={local} onAudition={(i) => { const l = pattern.lanes[i]; if (l) transport.hitPad(track.id, l); }} open={pad} onSound={setPad} />
            <p className="daw-key"><span className="cell h1" /> soft <span className="cell h2" /> normal <span className="cell h3" /> accent</p>
            <div className="daw-starters">
              <p className="daw-sound-label">Fill this clip from a starting point (it also sets the song's tempo and swing)</p>
              <div className="daw-chips">{[...STARTERS, ...GENRE_STARTERS, ...oldPatterns].map((s, i) => <button key={`${s.name}${i}`} onClick={() => fill(s)} title={`${s.bpm} bpm${s.swing ? `, swing ${s.swing}%` : ""}${s.length === 32 ? ", 2 bars" : ""}`}>{s.name}</button>)}</div>
              <p className="muted daw-sound-small">Common shapes for each style, written for this page. They are not anyone's recorded beat.</p>
            </div>
          </>}
        </>}
        {track.kind === "synth" && engine && <>
          <TrackSynth key={track.id} engine={engine} patch={track.patch} bpm={song.bpm} onPatch={(p) => change((s) => setPatch(s, track.id, { ...p, bpm: s.bpm }))} onNote={onNote} />
          {clip && "notes" in clip && <PianoRoll clip={clip} step={local} onNotes={(notes) => change((s) => setNotes(s, track.id, clip.id, notes))} onHear={(n) => transport.note(track.id, n)} />}
        </>}
      </div>}

      <div className="daw-shelf">
        <div>
          <h3>Your songs</h3>
          <div className="daw-save">
            <input type="text" value={song.name} maxLength={40} aria-label="Song name" onChange={(e) => change((s) => ({ ...s, name: e.target.value }))} />
            <button onClick={() => { const next = withSavedSong(songs, song); setSongs(next); storeSongs(next); }}>{songs.some((s) => s.name === song.name.trim()) ? "Save over it" : "Save"}</button>
            <button onClick={() => download(songToMidi(song), song.name)} title="The whole song as one MIDI file: a track per track. It carries the notes and the tempo, not the sounds.">Download .mid</button>
          </div>
          {songs.length === 0 ? <p className="muted">Nothing saved yet. Saved songs stay in this browser. The song you are working on is kept as you go.</p> :
            <div className="daw-chips">{songs.map((s) => <span key={s.name} className="daw-chip"><button onClick={() => open(s)}>{s.name}</button><button aria-label={`Delete ${s.name}`} title="Delete" onClick={() => { const next = withoutSavedSong(songs, s.name); setSongs(next); storeSongs(next); }}>×</button></span>)}</div>}
        </div>
        <div>
          <h3>Start again</h3>
          <div className="daw-chips">
            <button onClick={() => { if (window.confirm("Start an empty song? Save this one first if you want to keep it.")) open(newSong()); }}>Empty song</button>
            <button onClick={() => { if (window.confirm("Open the example song? Save this one first if you want to keep it.")) open(firstSong()); }}>Example song</button>
          </div>
        </div>
      </div>
      <details className="daw-missing"><summary>What is missing here</summary>
        <p>The built-in drums are made by the browser from tones and noise as they play: our own recipes, not recordings and not a model of any drum machine, and nobody has tuned them by ear yet. The synth tracks are the practice synth from the lessons. A MIDI file carries notes and tempo only: not the sounds, the swing or the levels, and Ableton's own rack and set files cannot be written from here. Not built yet: note loudness in the piano roll, copying notes, automation, an effects rack per track, a master meter, and saving a song as a sound file. Songs and your sound files are kept in this browser only.</p>
      </details>
    </section>
  );
}
