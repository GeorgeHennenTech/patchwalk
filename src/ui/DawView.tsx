// The Studio tab: a small DAW, organised the way Ableton Live's Arrangement View is. A control bar across the
// top, a browser down the left, the arrangement in the middle with each track's mixer controls at its right
// end, and a detail view along the bottom that shows either the clip (notes or drum steps) or the device (the
// synth or the drum rack). The keyboard shortcuts are Live's wherever this Studio has the thing they act on.
import { useEffect, useMemo, useRef, useState } from "react";
import { DrumGrid } from "./DrumGrid";
import { Arrangement } from "./studio/Arrangement";
import { DrumRack } from "./studio/DrumRack";
import { automate, recordMoves } from "../daw/automation";
import { DRAG_DEVICE, DeviceChain } from "./studio/DeviceChain";
import { SamplerPanel } from "./studio/SamplerPanel";
import { newSampler } from "../daw/sampler";
import { MASTER } from "../daw/transport";
import type { Device } from "../daw/devices";
import { SCALES } from "../daw/notefx";
import { NOTE_FX } from "../daw/notefx";
import { renderSong } from "../daw/render";
import { listSamples } from "../daw/samples";
import { DEVICES, addDevice } from "../daw/devices";
import { PianoRoll } from "./studio/PianoRoll";
import { TrackSynth } from "./studio/TrackSynth";
import { firstSong, useStudio } from "./studio/useStudio";
import { libPut } from "../guide/library";
import { newPad, SLICE_COUNTS, BPM_MAX, BPM_MIN, GENRE_STARTERS, STARTERS, STEPS_PER_BAR, SWING_MAX, VOICES, VOICE_NAMES, addPad, clearAll, setHit, setSample, tidySteps, type Pattern, type Voice } from "../daw/drums";
import { PPQ, hitsToMidi, midiBars, midiToHits, midiToNotes, notesToMidi, readMidi, songToMidi, writeMidi } from "../daw/midi";
import { CLIP_BARS, MAX_RETURNS, MAX_TRACKS, addReturn, setReturn, SONG_BARS, SOUNDS, addClip, addTrack, clipOf, clipPattern, duplicateClip, duplicateNotes, doubleClip, setMarker, setSampler, sliceToTrack, quantizeNotes, GRIDS, invertNotes, legatoNotes, reverseNotes, scaleTime, hasOtherMusic, moveClip, newSong, noteKey, pasteClip, removeClip, setClipBars, joinClips, placeClip, splitClip, setDevices, setNoteFx, setNotes, setPatch, setSongBars, setSongSwing, setSongTempo, setTrack, shiftNotes, soundPatch, stretchNotes, toggleClipOff, trackOf, withPads, withPattern, type Clip, type DrumClip, type DrumTrack, type NoteEv, type Song } from "../daw/song";
import { loadBreaks, loadRacks, loadSaved, loadSongs, rackOnto, saveSong, storeBreaks, storeRacks, storeSongs, withNamed, withSavedSong, withoutSavedSong, type Break, type Rack } from "../daw/store";
import { loadPatches } from "../synth/patches";
import type { SynthState } from "../synth/params";

const fileName = (name: string) => (name.trim().replace(/[^\w-]+/g, "_") || "patchwalk");
function download(bytes: Uint8Array, name: string, kind: "mid" | "wav" = "mid"): void {
  const a = document.createElement("a");
  a.href = URL.createObjectURL(new Blob([bytes as BlobPart], { type: kind === "wav" ? "audio/wav" : "audio/midi" })); a.download = `${fileName(name)}.${kind}`; a.click();
  window.setTimeout(() => URL.revokeObjectURL(a.href), 1000);
}
const mac = typeof navigator !== "undefined" && /mac/i.test(navigator.platform);
const MOD = mac ? "Cmd" : "Ctrl";
/** The shortcuts, as shown in the list. Each is the one Ableton Live uses for the same thing. */
const KEYS: [string, string][] = [
  ["Space", "Play and stop"], [`${MOD}+U`, "Quantize the selected notes (or all of them) onto the grid"], ["Shift+Space", "Play on from the bar where the song was stopped"], ["F1 to F8", "Switch tracks 1 to 8 on and off"], ["Home", "Play again from the start"], ["F9", "Record on and off"],
  [`${MOD}+Z`, "Undo"], [mac ? "Cmd+Shift+Z" : "Ctrl+Y", "Redo"],
  [`${MOD}+D`, "Duplicate the selected notes, or the selected clip"], [`${MOD}+C / X / V`, "Copy, cut and paste notes or a clip"], ["Delete", "Delete the selected notes, or the selected clip"],
  [`${MOD}+A`, "Select every note in the open clip"], [`${MOD}+L`, "Loop the selected clip, on and off"], [`${MOD}+Shift+M`, "Add an empty clip to the selected track"],
  ["Drag a clip", "Move it to another bar or another track of the same kind; hold Alt to copy it; drag its right edge to change its length"],
  [`${MOD}+E`, "Split the selected clip into one-bar clips"], [`${MOD}+J`, "Consolidate: join the selected clips into one"],
  ["A on a track", "Show its automation lanes: click a lane to add a point, drag a point, double-click to remove it"],
  ["Drag in the loudness lane", "Under the piano roll: set how hard a note is played (selected notes move together)"], ["Drag an EQ dot", "Sideways for frequency, up and down for gain; wheel for sharpness; double-click for zero"],
  [`${MOD}+R`, "Rename the selected track"], [`${MOD}+S`, "Save the song"], ["Shift+click a clip", "Select several clips on one track (a break, Delete and 0 then act on all of them)"], ["0", "Switch the selected clip (or track) off and on"], ["S", "Solo the selected track (when the computer keyboard is off)"],
  ["Arrow keys", "Move selected notes a step or a semitone; with nothing selected, move between tracks and clips"], ["Shift+Up / Down", "Move selected notes an octave"], ["Shift+Left / Right", "Make selected notes shorter or longer"],
  ["+ / -", "Zoom the arrangement in and out"], ["B", "Draw mode on and off"], ["M", "Computer keyboard plays notes, on and off"], ["Z / X, C / V", "Computer keyboard: octave down and up, softer and harder"],
  ["Shift+Tab", "Switch the detail view between Clip and Device"], [`${MOD}+Alt+B`, "Show and hide the browser"], ["Esc", "Deselect"],
];
const CATS = ["Sounds", "Drums", "Samples", "Effects", "Breaks", "Racks", "Songs"] as const;
type Cat = (typeof CATS)[number];
type Board = { kind: "notes"; notes: NoteEv[] } | { kind: "clip"; clip: Clip };
const remembered = <T extends string>(key: string, among: readonly T[], otherwise: T): T => { try { const v = localStorage.getItem(key); return among.includes(v as T) ? (v as T) : otherwise; } catch { return otherwise; } };
const remember = (key: string, value: string) => { try { localStorage.setItem(key, value); } catch { /* not remembered */ } };

export default function DawView() {
  const studio = useStudio();
  const { song, playing, toggle, playFrom, step, transport, undo, redo, samples } = studio;
  // While Record is on and the song plays, a fader or knob that is moved writes automation where the song has got to.
  const recRef = useRef(false);
  const change: typeof studio.change = (next) => studio.change((s) => { const made = typeof next === "function" ? next(s) : next; const at = recRef.current ? transport.position() : -1; return at >= 0 && made !== s ? recordMoves(s, made, Math.round(at), made.bars * STEPS_PER_BAR) : made; });
  const [picked, setPicked] = useState<{ track?: string; clip?: string }>(() => ({ track: song.tracks[0]?.id, clip: song.tracks[0]?.clips[0]?.id }));
  const [pad, setPad] = useState(0);
  /** more clips of the selected track, picked with Shift or Ctrl/Cmd: a break, Delete and 0 act on all of them */
  const [also, setAlso] = useState<string[]>([]);
  const [loopClip, setLoopClip] = useState(false);
  const [rec, setRec] = useState(false);
  recRef.current = rec;
  const [click, setClick] = useState(false);
  const [draw, setDraw] = useState(false);
  const [keysOn, setKeysOn] = useState(true);
  const [view, setView] = useState<"clip" | "device">("clip");
  const [browser, setBrowser] = useState(() => remembered("patchwalk.studio.browser", ["open", "shut"], "open") === "open");
  const [cat, setCat] = useState<Cat>(() => remembered("patchwalk.studio.cat", CATS, "Sounds"));
  const [keysList, setKeysList] = useState(false);
  const [note, setNote] = useState("");
  const [sel, setSel] = useState<Set<string>>(new Set());
  const [renaming, setRenaming] = useState<string>();
  const [nonce, setNonce] = useState(0);
  const [songs, setSongs] = useState(loadSongs);
  const [breaks, setBreaks] = useState(loadBreaks);
  const [racks, setRacks] = useState(loadRacks);
  const [saveAs, setSaveAs] = useState("");
  const oldPatterns = useMemo(loadSaved, []);
  const patches = useMemo(loadPatches, [nonce]);
  const midiIn = useRef<HTMLInputElement>(null);
  const sampleIn = useRef<HTMLInputElement>(null);
  const heldKeys = useRef(new Map<number, { start: number; velocity: number }>());
  const board = useRef<Board | null>(null);
  const keysOff = useRef(false); keysOff.current = !keysOn;

  const track = trackOf(song, picked.track), clip = clipOf(track, picked.clip);
  const loop = loopClip && clip ? { start: clip.start, bars: clip.bars } : undefined;
  useEffect(() => { saveSong(song); }, [song]);
  useEffect(() => { studio.setLoop(loopClip && clip ? { start: clip.start, bars: clip.bars } : undefined); }, [loopClip, clip?.start, clip?.bars, studio]);
  useEffect(() => { transport.click = click; }, [click, transport]);
  useEffect(() => { setSel(new Set()); }, [picked.track, picked.clip]);
  useEffect(() => { if (renaming) { const t = window.setTimeout(() => setRenaming(undefined), 50); return () => window.clearTimeout(t); } }, [renaming]);
  // the whole synth is shown under the rack only when asked for: in the rack it is a small device at the front
  const [synthOpen, setSynthOpen] = useState(false);
  // a selected return track: the detail view then shows its effects
  const [ret, setRet] = useState<string>();
  const back = ret === MASTER ? { id: MASTER, name: "Master", devices: song.masterFx ?? [] } : song.returns.find((r) => r.id === ret);
  const setBackDevices = (next: Device[]) => change((s) => (ret === MASTER ? { ...s, masterFx: next } : setReturn(s, ret!, { devices: next })));
  // tap tempo: the gaps between the last few clicks of the Tap button, turned into beats a minute
  const taps = useRef<number[]>([]);
  const tap = () => { const now = performance.now(), t = taps.current.filter((x) => now - x < 2500); t.push(now); taps.current = t.slice(-6);
    if (t.length >= 3) { const gaps = taps.current.slice(1).map((x, i) => x - taps.current[i]!), bpm = 60000 / (gaps.reduce((a, b) => a + b, 0) / gaps.length); change((s) => setSongTempo(s, bpm)); } };
  const [find, setFind] = useState("");
  // the piano roll's grid, in sixteenth steps: what notes snap to, how far an arrow key moves them, what Quantize pulls them onto
  const [grid, setGridState] = useState(() => { try { const g = Number(localStorage.getItem("patchwalk.grid.v1")); return GRIDS.some((x) => x.steps === g) ? g : 1; } catch { return 1; } });
  const setGrid = (g: number) => { setGridState(g); try { localStorage.setItem("patchwalk.grid.v1", String(g)); } catch { /* not remembered */ } };
  const pick = (t?: string, c?: string, add = false) => {
    setRet(undefined);
    if (add && c && t === picked.track && picked.clip && c !== picked.clip) { setAlso((a) => (a.includes(c) ? a.filter((x) => x !== c) : [...a, c])); return; }
    setPicked({ track: t, clip: c }); setPad(0); setAlso([]);
  };
  const open = (s: Song) => { if (playing) toggle(); change(s); pick(s.tracks[0]?.id, s.tracks[0]?.clips[0]?.id); };
  const add = (trackId: string, bar: number) => { const made = addClip(song, trackId, bar); if (made) { change(made.song); pick(trackId, made.clip); setView("clip"); } };
  // while the song plays, sliders and faders are drawn where their automation has put them
  const live = useMemo(() => (playing && step >= 0 ? automate(song, step) : song), [song, playing, step]);
  const liveTrack = live.tracks.find((t) => t.id === track?.id) ?? track;
  const local = clip && step >= clip.start * STEPS_PER_BAR && step < (clip.start + clip.bars) * STEPS_PER_BAR ? step - clip.start * STEPS_PER_BAR : -1;
  const steps = clip ? clip.bars * STEPS_PER_BAR : 16;

  // a drum track's pads as a pattern: with the picked clip's rows, or with empty rows when no clip is picked
  const pattern: Pattern | undefined = track?.kind === "drums" ? (clip && "hits" in clip ? clipPattern(song, track, clip) : { name: track.name, bpm: song.bpm, swing: song.swing, length: 16, lanes: track.pads.map((p) => ({ ...p, steps: tidySteps(undefined, 16) })) }) : undefined;
  const setPattern = (p: Pattern) => { if (!track) return; change((s) => (clip ? withPattern(s, track.id, clip.id, p) : withPads(s, track.id, p.lanes.map(({ steps: _s, ...rest }) => rest)))); };
  // A break from the browser replaces the selected drum clip, or every selected clip, and nothing else:
  // not the other clips, not the song's tempo or swing.
  const targets = clip ? [clip.id, ...also.filter((id) => id !== clip.id && clipOf(track, id))] : [];
  const fillWith = (name: string, bars: number, rowFor: (lane: Pattern["lanes"][number], index: number, used: Set<string>) => unknown, tail = "", tempo?: { bpm: number; swing: number }) => {
    if (!track || track.kind !== "drums" || !clip) { setNote("Select a drum clip first, then click a break to fill it."); return; }
    studio.mark();
    // the song takes the break's tempo only when nothing else is written in it yet: there is nothing to disturb
    const adopt = !!tempo && (tempo.bpm !== song.bpm || tempo.swing !== song.swing) && !hasOtherMusic(song, track.id, targets);
    if (adopt) tail = ` Nothing else is in the song yet, so its tempo is now ${tempo!.bpm} bpm${tempo!.swing ? ` with ${tempo!.swing}% swing` : ""}.`;
    change((s) => targets.reduce((acc, id) => {
      const sized = setClipBars(acc, track.id, id, bars), t = trackOf(sized, track.id) as DrumTrack, c = clipOf(t, id);
      if (!c || !("hits" in c)) return acc;
      const p = clipPattern(sized, t, c as DrumClip), used = new Set<string>();
      return withPattern(sized, track.id, id, { ...p, lanes: p.lanes.map((l, i) => ({ ...l, steps: tidySteps(rowFor(l, i, used), p.length) })) });
    }, adopt ? setSongSwing(setSongTempo(s, tempo!.bpm), tempo!.swing) : s));
    setNote(`${targets.length > 1 ? `Filled ${targets.length} clips` : "Filled the clip"} with “${name}”.${tail}`);
  };
  const fill = (from: Pattern) => fillWith(from.name, from.length / STEPS_PER_BAR, (l, _i, used) => { const src = l.sample || used.has(l.voice) ? undefined : from.lanes.find((x) => x.voice === l.voice); if (src) used.add(l.voice); return src?.steps; },
    from.bpm !== song.bpm || from.swing !== song.swing ? ` It was written for ${from.bpm} bpm${from.swing ? ` with ${from.swing}% swing` : ""}; the song stays at ${song.bpm}.` : "", { bpm: from.bpm, swing: from.swing });
  const engine = track?.kind === "synth" ? transport.engine(track.id) : undefined;

  // Recording: what is played while the song runs is written into the open clip, on the nearest step.
  const spot = () => { if (!rec || !clip) return undefined; const pos = transport.position(); return pos < 0 ? undefined : { at: pos - clip.start * STEPS_PER_BAR, steps: clip.bars * STEPS_PER_BAR }; };
  const onNote = (key: number, on: boolean, velocity: number) => {
    const p = spot();
    if (!p || !track || !clip || !("notes" in clip)) { if (!on) heldKeys.current.delete(key); return; }
    if (on) { if (p.at > -0.5 && p.at < p.steps - 0.5) heldKeys.current.set(key, { start: Math.max(0, Math.round(p.at / grid) * grid), velocity }); return; }
    const h = heldKeys.current.get(key);
    if (!h) return;
    heldKeys.current.delete(key);
    const end = p.at < h.start - 0.5 ? p.steps : Math.max(h.start + grid, Math.min(p.steps, Math.round(p.at / grid) * grid));
    change((s) => { const c = clipOf(trackOf(s, track.id), clip.id); return c && "notes" in c ? setNotes(s, track.id, clip.id, [...c.notes.filter((n) => !(n.note === key && n.start === h.start)), { note: key, start: h.start, length: end - h.start, velocity: h.velocity }]) : s; });
  };
  const onStrike = (lane: number) => { const p = spot(); if (!p || !pattern || !clip || !("hits" in clip) || p.at <= -0.5) return; setPattern(setHit(pattern, lane, Math.round(p.at) % p.steps, 2)); };

  // MIDI files out and in
  const [exporting, setExporting] = useState(false);
  const wavOut = async () => {
    setExporting(true); setNote("Working the song out as a sound file…");
    try {
      const stored = new Map((await listSamples().catch(() => [])).map((x) => [x.id, x.bytes])), r = await renderSong(song, (id) => stored.get(id));
      download(r.wav, song.name, "wav");
      setNote(`Saved ${Math.round(r.seconds)} seconds of sound. Its loudest moment is ${r.peak > 0 ? `${r.peak.toFixed(1)} dB over full level, so it clips there: turn the master down by that much and download again` : `${(-r.peak).toFixed(1)} dB under full level`}.${r.missing ? ` ${r.missing} sound file${r.missing === 1 ? " was" : "s were"} not in this browser and played as the built-in drum.` : ""}`);
    } catch { setNote("The song could not be worked out as a sound file in this browser."); }
    setExporting(false);
  };
  const clipOut = () => { if (!track || !clip) return; download(writeMidi({ ppq: PPQ, bpm: song.bpm, tracks: [{ name: track.name, channel: track.kind === "drums" ? 9 : 0, notes: "hits" in clip && pattern ? hitsToMidi(pattern.lanes.map((l) => l.steps)) : "notes" in clip ? notesToMidi(clip.notes) : [] }] }), `${track.name}_bar${clip.start + 1}`); };
  const clipIn = async (f: File) => {
    if (!track || !clip) return;
    const file = readMidi(new Uint8Array(await f.arrayBuffer())), notes = file?.tracks.flatMap((t) => t.notes) ?? [];
    if (!file || !notes.length) { setNote("That file has no notes this app can read. It needs to be a MIDI file (.mid)."); return; }
    const want = midiBars(notes, file.ppq), bars = track.kind === "drums" ? Math.min(2, want) : want > 2 ? 4 : want;
    const sized = setClipBars(song, track.id, clip.id, bars), now = clipOf(trackOf(sized, track.id), clip.id)!, n = now.bars * STEPS_PER_BAR;
    if (track.kind === "drums") { const got = midiToHits(notes, file.ppq, track.pads.length, n), p = clipPattern(sized, track, now as never); change(withPattern(sized, track.id, clip.id, { ...p, lanes: p.lanes.map((l, i) => ({ ...l, steps: got.rows[i]! })) })); setNote(`Brought in ${notes.length - got.left} hits${got.left ? `; ${got.left} did not fit (outside the pads, or past the end of the clip)` : ""}. Pad 1 is the note C1, pad 2 the next key up, and so on.`); }
    else { const got = midiToNotes(notes, file.ppq, n); change(setNotes(sized, track.id, clip.id, got.notes)); setNote(`Brought in ${got.notes.length} notes${got.left ? `; ${got.left} were past the end of the clip` : ""}.`); }
  };
  const keepBreak = () => { if (!pattern || !clip) return; const b: Break = { name: saveAs.trim() || `${track!.name} bar ${clip.start + 1}`, bars: clip.bars === 2 ? 2 : 1, bpm: song.bpm, swing: song.swing, rows: pattern.lanes.map((l) => l.steps), pads: pattern.lanes.map((l) => l.name) }; const next = withNamed(breaks, b); setBreaks(next); storeBreaks(next); setNote(`Saved the break “${b.name}”.`); void libPut("break", b.name, b, `${b.bars} bar${b.bars === 1 ? "" : "s"}, ${b.rows.length} pads, ${b.bpm} bpm`).then((r) => { if (r.ok && r.value.entry) setNote(`Saved the break “${b.name}”, here and in the library.`); }); };
  const useBreak = (b: Break) => fillWith(b.name, b.bars, (_l, i) => b.rows[i], track?.kind === "drums" && b.rows.length > track.pads.length ? ` It was written for ${b.rows.length} pads; this rack has ${track.pads.length}, so the rest were left out.` : "", { bpm: b.bpm, swing: b.swing });
  const keepRack = () => { if (!track || track.kind !== "drums") return; const r: Rack = { name: saveAs.trim() || track.name, pads: track.pads }; const next = withNamed(racks, r); setRacks(next); storeRacks(next); setNote(`Saved the rack “${r.name}”.`); void libPut("rack", r.name, r, `${r.pads.length} pads${r.pads.some((p) => p.sample) ? ", with sound files" : ""}`).then((x) => { if (x.ok && x.value.entry) setNote(`Saved the rack “${r.name}”, here and in the library.`); }); };
  const keepSong = () => { const next = withSavedSong(songs, song); setSongs(next); storeSongs(next); setNote(`Saved the song “${song.name.trim() || "Song"}”.`); void libPut("song", song.name, song, `${song.tracks.length} tracks, ${song.bars} bars, ${song.bpm} bpm`); };

  // sound files chosen in the browser's Samples list: kept here and sent to the library, ready to put on a pad
  const upload = async (files: File[]) => {
    let have = samples.length, ok = 0, last = "";
    for (const f of files) { try { const s = await studio.addSample(f, have); have++; ok++; last = await s.shared; } catch (e) { setNote(`${f.name}: ${e instanceof Error ? e.message : "could not be used."}`); if (files.length === 1) return; } }
    if (ok) setNote(ok === 1 ? `Added “${files.length === 1 ? files[0]!.name : "1 sound"}”. ${last}` : `Added ${ok} of ${files.length} sounds. They are kept in this browser, and those of 2 MB or under are in the library too.`);
  };
  // the browser: one click puts a thing where it belongs
  const useSound = (name: string, patch: SynthState) => {
    if (track?.kind === "synth") { change((s) => setPatch(s, track.id, { ...patch, bpm: s.bpm })); setNonce((n) => n + 1); setNote(`“${name}” is now the sound of ${track.name}.`); return; }
    const made = addTrack(song, "synth", name), id = made.tracks.at(-1)!.id;
    if (made === song) { setNote("A song holds eight tracks at most."); return; }
    change(setPatch(made, id, { ...patch, bpm: song.bpm })); pick(id); setNote(`Added a synth track with the sound “${name}”.`);
  };
  const usePad = (voice: Voice, sample?: { id: string; name: string }) => {
    if (!track || track.kind !== "drums" || !pattern) { setNote("Select a drum track first, then click a drum to add it as a pad."); return; }
    let next = addPad(pattern, voice, sample?.name.slice(0, 24) ?? VOICE_NAMES[voice]);
    if (next === pattern) { setNote("A rack holds sixteen pads at most."); return; }
    if (sample) next = setSample(next, next.lanes.length - 1, sample.id);
    setPattern(next); setPad(next.lanes.length - 1); setView("device"); transport.hitPad(track.id, next.lanes.at(-1)!);
  };

  // Editing commands, as the keys and the buttons call them. Notes come first when any are selected.
  const notesNow = clip && "notes" in clip ? clip.notes : undefined;
  const hasSel = !!notesNow && sel.size > 0;
  const tool = (r: { notes: NoteEv[]; keys: Set<string> }) => { studio.mark(); putNotes(r.notes, r.keys); };
  const putNotes = (notes: NoteEv[], keys?: Set<string>) => { if (track && clip) { change((s) => setNotes(s, track.id, clip.id, notes)); if (keys) setSel(keys); } };
  const act = {
    duplicate: () => { if (hasSel) { const r = duplicateNotes(notesNow!, sel, steps); if (r.notes === notesNow) setNote("There is no room after the selected notes in this clip. Make the clip longer first."); else putNotes(r.notes, r.keys); } else if (track && clip) { const made = duplicateClip(song, track.id, clip.id); if (made) { change(made.song); pick(track.id, made.clip); } else setNote("There is no free place after this clip to duplicate it into."); } },
    copy: (): boolean => { if (hasSel) { board.current = { kind: "notes", notes: notesNow!.filter((n) => sel.has(noteKey(n))) }; setNote(`Copied ${sel.size} note${sel.size === 1 ? "" : "s"}.`); return true; } if (clip) { board.current = { kind: "clip", clip }; setNote("Copied the clip."); return true; } return false; },
    del: (): boolean => { if (hasSel) { putNotes(notesNow!.filter((n) => !sel.has(noteKey(n))), new Set()); return true; } if (track && clip) { change((s) => targets.reduce((acc, id) => removeClip(acc, track.id, id), s)); pick(track.id); return true; } return false; },
    paste: () => { const b = board.current; if (!b || !track) return;
      if (b.kind === "notes") { if (!notesNow) { setNote("Open a synth clip to paste notes into."); return; } const fit = b.notes.filter((n) => n.start < steps), keys = new Set(fit.map(noteKey)); putNotes([...notesNow.filter((n) => !keys.has(noteKey(n))), ...fit], keys); return; }
      const made = pasteClip(song, track.id, b.clip, clip ? clip.start + clip.bars : 0); if (made) { change(made.song); pick(track.id, made.clip); } else setNote(("hits" in b.clip) !== (track.kind === "drums") ? "A drum clip goes on a drum track and a note clip on a synth track." : "There is no free place on this track to paste the clip."); },
    all: () => { if (notesNow) setSel(new Set(notesNow.map(noteKey))); },
    quantize: () => { if (notesNow) tool(quantizeNotes(notesNow, sel, grid, steps)); },
    arrow: (dx: number, dy: number, shift: boolean) => {
      if (hasSel) { if (shift && dx) putNotes(stretchNotes(notesNow!, sel, dx * grid, steps)); else { const r = shiftNotes(notesNow!, sel, dx * grid, dy * (shift ? 12 : 1), steps); if (r.notes !== notesNow) { putNotes(r.notes, r.keys); if (dy && track) { const n = r.notes.find((x) => r.keys.has(noteKey(x))); if (n) transport.note(track.id, n.note, 0.2); } } } return; }
      if (dy) { const i = song.tracks.findIndex((t) => t.id === picked.track), t = song.tracks[Math.min(song.tracks.length - 1, Math.max(0, i - dy))]; if (t) pick(t.id, t.clips.slice().sort((a, b) => a.start - b.start)[0]?.id); }
      else if (track) { const order = track.clips.slice().sort((a, b) => a.start - b.start), i = order.findIndex((c) => c.id === picked.clip), c = order[i < 0 ? 0 : Math.min(order.length - 1, Math.max(0, i + dx))]; if (c) pick(track.id, c.id); }
    },
    off: () => { if (track && clip) change((s) => targets.reduce((acc, id) => toggleClipOff(acc, track.id, id), s)); else if (track) change((s) => setTrack(s, track.id, { mute: !track.mute })); },
    solo: () => { if (track) change((s) => setTrack(s, track.id, { solo: !track.solo })); },
    insert: () => { if (!track) return; for (let b = clip ? clip.start + clip.bars : 0; b < song.bars; b++) if (addClip(song, track.id, b)) { add(track.id, b); return; } setNote("This track has no free bar for a new clip."); },
    rename: () => { if (track) setRenaming(track.id); },
    split: () => { if (!track || !clip) return; const made = splitClip(song, track.id, clip.id); if (!made) { setNote("A one-bar clip cannot be split further: the Studio's clips sit on whole bars."); return; } change(made.song); pick(track.id, made.clips[0]); setNote(`Split into ${made.clips.length} one-bar clips.`); },
    join: () => { if (!track || targets.length < 2) { setNote("Select two or more clips on one track first (Shift-click), then consolidate."); return; } const made = joinClips(song, track.id, targets); if (!made) { setNote(`To consolidate, the clips must sit next to each other and add up to ${track.kind === "drums" ? "2 bars" : "2 or 4 bars"}.`); return; } change(made.song); pick(track.id, made.clip); setNote("Joined into one clip."); },
    record: () => { if (!rec && !playing) { playFrom(clip && !transport.loop ? clip.start * STEPS_PER_BAR : 0, 1); setNote("Recording after one bar of clicks."); } setRec(!rec); },
    restart: () => { if (playing) toggle(); window.setTimeout(toggle, 30); },
    browser: () => setBrowser((b) => { remember("patchwalk.studio.browser", b ? "shut" : "open"); return !b; }),
    keepSong,
  };
  // each command is its own step to undo
  for (const name of ["duplicate", "del", "paste", "off", "solo", "insert", "split", "join"] as const) { const run = act[name] as () => unknown; (act as Record<string, unknown>)[name] = () => { studio.mark(); return run(); }; }
  const acts = useRef(act); acts.current = act;
  useEffect(() => {
    const key = (e: KeyboardEvent) => {
      const t = e.target as HTMLElement | null, a = acts.current, k = e.key.toLowerCase(), mod = e.ctrlKey || e.metaKey;
      const field = !!t && ((t.tagName === "INPUT" && !["range", "checkbox", "radio", "button", "file"].includes((t as HTMLInputElement).type)) || t.tagName === "TEXTAREA" || t.isContentEditable);
      if (field) { if (mod && k === "s") { e.preventDefault(); a.keepSong(); } return; }
      const menu = t?.tagName === "SELECT", slider = t?.tagName === "INPUT", grid = !!t?.closest?.(".drum-grid");
      const done = () => e.preventDefault();
      if (mod) {
        if (k === "z") { done(); if (e.shiftKey) redo(); else undo(); }
        else if (k === "y") { done(); redo(); }
        else if (k === "d") { done(); a.duplicate(); }
        else if (k === "c") { if (!window.getSelection()?.toString() && a.copy()) done(); }
        else if (k === "x") { if (!window.getSelection()?.toString() && a.copy()) { done(); a.del(); } }
        else if (k === "v") { done(); a.paste(); }
        else if (k === "a") { done(); a.all(); }
        else if (k === "l") { done(); setLoopClip((v) => !v); }
        else if (k === "s") { done(); a.keepSong(); }
        else if (k === "r") { done(); a.rename(); }
        else if (k === "u") { done(); a.quantize(); }
        else if (k === "e") { done(); a.split(); }
        else if (k === "j") { done(); a.join(); }
        else if (k === "m" && e.shiftKey) { done(); a.insert(); }
        else if (k === "b" && e.altKey) { done(); a.browser(); }
        return;
      }
      if (e.altKey || menu) return;
      if (e.code === "Space") { done(); if (e.shiftKey && !playing) playFrom(Math.floor(transport.stoppedAt / STEPS_PER_BAR) * STEPS_PER_BAR); else toggle(); return; }
      if (/^F[1-8]$/.test(e.key)) { const t = song.tracks[Number(e.key.slice(1)) - 1]; if (t) { done(); change((s) => setTrack(s, t.id, { mute: !t.mute })); } return; }
      if (e.key === "Tab" && e.shiftKey) { done(); setView((v) => (v === "clip" ? "device" : "clip")); return; }
      if (e.key === "F9") { done(); a.record(); return; }
      if (e.key === "Escape") { setSel(new Set()); return; }
      if (grid) return; // the step grid has its own keys for the box that has the keyboard
      if (e.key === "Delete" || e.key === "Backspace") { if (a.del()) done(); return; }
      if (k === "b") { setDraw((v) => !v); return; }
      if (k === "m") { setKeysOn((v) => !v); return; }
      if (k === "0") { a.off(); return; }
      if (k === "s" && keysOff.current) { a.solo(); return; }
      if (slider) return;
      if (e.key === "Home") { done(); a.restart(); return; }
      if (e.key.startsWith("Arrow")) { done(); a.arrow(e.key === "ArrowRight" ? 1 : e.key === "ArrowLeft" ? -1 : 0, e.key === "ArrowUp" ? 1 : e.key === "ArrowDown" ? -1 : 0, e.shiftKey); }
    };
    window.addEventListener("keydown", key);
    return () => window.removeEventListener("keydown", key);
  }, [toggle, undo, redo]);

  const where = step >= 0 ? `${Math.floor(step / 16) + 1}. ${Math.floor((step % 16) / 4) + 1}. ${(step % 4) + 1}` : "1. 1. 1";
  const item = (label: string, onUse: () => void, title?: string, onDrop?: () => void, drag?: string, hear?: () => void, extra?: React.ReactNode) => (find.trim() && !find.toLowerCase().split(/\s+/).filter(Boolean).every((w) => label.toLowerCase().includes(w)) ? null : <li key={label}><button onClick={onUse} title={title} draggable={!!drag} onDragStart={drag ? (e) => { e.dataTransfer.setData(DRAG_DEVICE, `add:${drag}`); e.dataTransfer.effectAllowed = "copy"; } : undefined}>{label}</button>{hear && <button className="br-x br-hear" aria-label={`Hear ${label}`} title="Hear it" onClick={hear}>▶</button>}{extra}{onDrop && <button className="br-x" aria-label={`Delete ${label}`} title="Delete" onClick={onDrop}>×</button>}</li>);
  return (
    <section className={`daw2${browser ? "" : " no-browser"}`} aria-label="Studio">
      <header className="tb">
        <div className="tb-group">
          <label className="tb-num" title="Tempo, in beats a minute"><input type="number" min={BPM_MIN} max={BPM_MAX} value={song.bpm} aria-label="Tempo" onChange={(e) => change((s) => setSongTempo(s, Number(e.target.value) || s.bpm))} /> bpm</label>
          <label className="tb-num" title="Swing: plays every second step late. 0 is straight; around 55 to 65 is a shuffle."><input type="number" min={0} max={SWING_MAX} value={song.swing} aria-label="Swing" onChange={(e) => change((s) => setSongSwing(s, Number(e.target.value) || 0))} /> % swing</label>
          <button className={`tb-tog${song.lockAuto ? " on" : ""}`} aria-pressed={!!song.lockAuto} onClick={() => change((s) => (s.lockAuto ? (({ lockAuto: _off, ...rest }) => rest)(s) as Song : { ...s, lockAuto: true }))} title="Lock automation: when on, a clip that is moved leaves its automation where it was. When off, the automation under a clip moves with it.">Lock auto</button>
          <button className="tb-tog" onClick={tap} title="Tap tempo: click in time with the beat you want, three or more times">Tap</button>
          <button className={`tb-tog${click ? " on" : ""}`} aria-pressed={click} onClick={() => setClick(!click)} title="Metronome: a click on every beat while the song plays">Click</button>
        </div>
        <div className="tb-group tb-mid">
          <output className="tb-pos" title="Where the song has got to: bar, beat, sixteenth" aria-label="Position">{where}</output>
          <button className={`tb-play${playing ? " on" : ""}`} onClick={() => { if (!playing) toggle(); }} aria-label="▶ Play" title="Play (Space)">▶</button>
          <button className="tb-stop" onClick={() => { if (playing) toggle(); }} aria-label="■ Stop" title="Stop (Space)">■</button>
          <button className={`tb-rec${rec ? " on" : ""}`} aria-pressed={rec} onClick={act.record} aria-label={rec ? "Recording" : "Record"} title="Record what you play into the selected clip (F9)">●</button>
          <button className={`tb-tog${loopClip ? " on" : ""}`} aria-pressed={loopClip} onClick={() => setLoopClip(!loopClip)} title={`Loop the selected clip (${MOD}+L)`}>Loop</button>
        </div>
        <div className="tb-group">
          <button className={`tb-tog${draw ? " on" : ""}`} aria-pressed={draw} onClick={() => setDraw(!draw)} title="Draw mode: click and drag in the piano roll to write notes (B)">✎ Draw</button>
          <button className={`tb-tog${keysOn ? " on" : ""}`} aria-pressed={keysOn} onClick={() => setKeysOn(!keysOn)} title="Computer keyboard: the letter keys A to K play the selected synth track (M)">⌨ Keys</button>
          <button onClick={undo} disabled={!studio.canUndo} title={`Undo (${MOD}+Z)`} aria-label="Undo">↶</button>
          <button onClick={redo} disabled={!studio.canRedo} title={`Redo (${mac ? "Cmd+Shift+Z" : "Ctrl+Y"})`} aria-label="Redo">↷</button>
          <button className={`tb-tog${keysList ? " on" : ""}`} aria-expanded={keysList} onClick={() => setKeysList(!keysList)} title="The keyboard shortcuts">Shortcuts</button>
        </div>
      </header>
      {keysList && <div className="daw-keys"><p>These are Ableton Live's shortcuts, for everything this Studio has. The browser keeps a few for itself and they cannot be taken over: new track ({MOD}+T), and anything that closes or opens tabs and windows.</p><dl>{KEYS.map(([k, what]) => <div key={k}><dt>{k}</dt><dd>{what}</dd></div>)}</dl></div>}

      <div className="daw-body">
        {browser && <aside className="br" aria-label="Browser">
          <ul className="br-cats" role="tablist" aria-label="Kinds of thing">{CATS.map((c) => <li key={c}><button role="tab" aria-selected={cat === c} className={cat === c ? "on" : ""} onClick={() => { setCat(c); remember("patchwalk.studio.cat", c); }}>{c}</button></li>)}</ul>
          <div className="br-items">
            <input type="search" className="br-find" value={find} placeholder="Search this list" aria-label="Search this list" onChange={(e) => setFind(e.target.value)} onKeyDown={(e) => { if (e.key === "Escape") setFind(""); e.stopPropagation(); }} />
            {cat === "Sounds" && <><p className="br-hint">Click a sound to put it on the selected synth track, or to add a synth track.</p><ul>{SOUNDS.map((s) => item(s.name, () => useSound(s.name, soundPatch(s.name))))}</ul>{patches.length > 0 && <><h4>Your sounds</h4><ul>{patches.map((p) => item(p.name, () => useSound(p.name, p.state)))}</ul></>}</>}
            {cat === "Drums" && <><p className="br-hint">Click a drum to add it as a pad on the selected drum track.</p><ul>{VOICES.map((v) => item(VOICE_NAMES[v], () => usePad(v), undefined, undefined, undefined, () => transport.hitPad("", newPad("hear", v))))}</ul></>}
            {cat === "Samples" && <><input ref={sampleIn} type="file" multiple accept="audio/*,.wav,.mp3,.flac,.ogg,.aif,.aiff,.m4a" hidden onChange={(e) => { const files = [...(e.target.files ?? [])]; e.target.value = ""; if (files.length) void upload(files); }} /><button className="br-up primary" onClick={() => sampleIn.current?.click()}>Upload sound files…</button><p className="br-hint">Your sound files. Click one to add it as a pad on the selected drum track, or, with a synth track selected, to play it across the keys (a sampler). You can choose several files at once.</p>{samples.length === 0 ? <p className="br-none">None yet.</p> : <ul>{samples.map((s) => item(s.name, () => { if (track?.kind === "synth") { studio.mark(); change((x) => setSampler(x, track.id, { ...(track.sampler ?? newSampler(s.id)), sample: s.id })); setView("device"); setNote(`${track.name} now plays “${s.name}” across the keys.`); } else usePad("kick", s); }, undefined, () => { if (window.confirm(`Delete “${s.name}” from this browser? Pads that use it go back to a built-in drum.`)) studio.removeSample(s.id); }, undefined, () => transport.hitPad("", { ...newPad("hear", "kick"), sample: s.id }),
              <button className="br-x br-hear" aria-label={`Slice ${s.name} onto pads`} title="Slice it onto pads: a new drum track with one pad for each equal slice, and a clip that plays them in order" onClick={() => { const n = Number(window.prompt(`Cut “${s.name}” into how many equal slices? 4, 8 or 16`, "8")); if (!n) return; const made = sliceToTrack(song, s.id, s.name, n); if (!made) { setNote((SLICE_COUNTS as readonly number[]).includes(n) ? "A song holds eight tracks at most." : "Choose 4, 8 or 16 slices."); return; } studio.mark(); change(made.song); pick(made.track, made.clip); setView("clip"); setNote(`Sliced “${s.name}” into ${n} pads on a new track. Its clip plays them in order: move the hits to rearrange the loop.`); }}>✂</button>))}</ul>}</>}
            {cat === "Effects" && <><p className="br-hint">Click an effect to add it to the end of the selected track's chain, or drag it into the chain where you want it.</p><ul>{DEVICES.map((d) => item(d.name, () => { if (back) { const next = addDevice(back.devices, d.kind); if (next === back.devices) { setNote("A track holds eight effects at most."); return; } studio.mark(); setBackDevices(next); setNote(`Added ${d.name} to ${back.name}.`); return; } if (!track) { setNote("Select a track first."); return; } const next = addDevice(track.devices, d.kind); if (next === track.devices) { setNote("A track holds eight effects at most."); return; } studio.mark(); change((s) => setDevices(s, track.id, next)); setView("device"); setNote(`Added ${d.name} to ${track.name}.`); }, d.about, undefined, d.kind))}</ul><p className="br-hint">Note effects go in front of a synth and change its clips' notes.</p><ul>{NOTE_FX.map((d) => item(d.name, () => { if (!track || track.kind !== "synth") { setNote("Select a synth track first: note effects change notes."); return; } const next = addDevice(track.noteFx, d.kind); if (next === track.noteFx) { setNote("A track holds eight note effects at most."); return; } studio.mark(); change((s) => setNoteFx(s, track.id, next)); setView("device"); setNote(`Added ${d.name} in front of ${track.name}.`); }, d.about, undefined, d.kind))}</ul></>}
            {cat === "Breaks" && <><p className="br-hint">Click a break to replace the selected drum clip. Shift-click clips to select several and replace them all. Nothing else changes. The song's tempo is left alone unless nothing else is written in the song yet.</p>{breaks.length > 0 && <><h4>Your breaks</h4><ul>{breaks.map((b) => item(b.name, () => useBreak(b), `${b.bars} bar${b.bars === 1 ? "" : "s"}, written at ${b.bpm} bpm`, () => { const next = breaks.filter((x) => x.name !== b.name); setBreaks(next); storeBreaks(next); }))}</ul></>}<h4>Starting points</h4><ul>{[...STARTERS, ...GENRE_STARTERS, ...oldPatterns].map((s, i) => <li key={`${s.name}${i}`}><button onClick={() => fill(s)} title={`${s.bpm} bpm${s.swing ? `, swing ${s.swing}%` : ""}${s.length === 32 ? ", 2 bars" : ""}`}>{s.name}</button></li>)}</ul><p className="br-hint">Common shapes for each style, written for this page: not anyone's recorded beat.</p></>}
            {cat === "Racks" && <><p className="br-hint">Click a rack to put its pads on the selected drum track.</p>{racks.length === 0 ? <p className="br-none">None saved yet. Save one from a drum track's Device view.</p> : <ul>{racks.map((r) => item(r.name, () => { if (track?.kind === "drums") { change((s) => withPads(s, track.id, rackOnto(track.pads, r))); setNote(`Put the rack “${r.name}” on ${track.name}.`); } else setNote("Select a drum track first."); }, `${r.pads.length} pads`, () => { const next = racks.filter((x) => x.name !== r.name); setRacks(next); storeRacks(next); }))}</ul>}</>}
            {cat === "Songs" && <><p className="br-hint">Click a song to open it. Save the one you are working on first if you want to keep it.</p><ul>{songs.map((s) => item(s.name, () => open(s), `${s.tracks.length} tracks, ${s.bars} bars`, () => { const next = withoutSavedSong(songs, s.name); setSongs(next); storeSongs(next); }))}{item("Example song", () => { if (window.confirm("Open the example song? Save this one first if you want to keep it.")) open(firstSong()); })}{item("Empty song", () => { if (window.confirm("Start an empty song? Save this one first if you want to keep it.")) open(newSong()); })}</ul></>}
          </div>
        </aside>}
        <div className="daw-main">
          <div className="daw-song">
            <button className="tb-tog" onClick={act.browser} aria-pressed={browser} title={`Show or hide the browser (${MOD}+Alt+B)`}>{browser ? "◀ Browser" : "▶ Browser"}</button>
            <input type="text" value={song.name} maxLength={40} aria-label="Song name" onChange={(e) => change((s) => ({ ...s, name: e.target.value }))} />
            <button onClick={keepSong} title={`Save the song here and in the library (${MOD}+S)`}>{songs.some((s) => s.name === song.name.trim()) ? "Save over it" : "Save"}</button>
            <button onClick={() => download(songToMidi(song), song.name)} title="The whole song as one MIDI file: a track per track. It carries the notes and the tempo, not the sounds.">Download .mid</button>
            <button disabled={exporting} onClick={() => { void wavOut(); }} title="The whole song as a sound file (WAV, 16-bit, 44.1 kHz) with every track, effect and the master volume, plus a short tail for echoes. Any DAW or player opens it.">{exporting ? "Working it out…" : "Download .wav"}</button>
            <label>Length <select value={song.bars} onChange={(e) => { const bars = Number(e.target.value); if (bars > song.bars || !song.tracks.some((t) => t.clips.some((c) => c.start + c.bars > bars)) || window.confirm("Clips past the new end will be removed. Go on?")) change((s) => setSongBars(s, bars)); }}>{SONG_BARS.map((b) => <option key={b} value={b}>{b} bars</option>)}</select></label>
            <span className="daw-song-add">
              <button onClick={() => { const next = addTrack(song, "drums"); change(next); pick(next.tracks.at(-1)?.id); }} disabled={song.tracks.length >= MAX_TRACKS}>+ Drum track</button>
              <button onClick={() => { const next = addTrack(song, "synth", SOUNDS[0]!.name); change(next); pick(next.tracks.at(-1)?.id); }} disabled={song.tracks.length >= MAX_TRACKS}>+ Synth track</button>
              <button onClick={() => { studio.mark(); const next = addReturn(song); change(next); setRet(next.returns.find((r) => !song.returns.some((x) => x.id === r.id))?.id); }} disabled={song.returns.length >= MAX_RETURNS} title="A return track has no clips: tracks send some of their sound to it and it comes back through its effects, so one reverb or delay can serve every track">+ Return track</button>
            </span>
          </div>
          <Arrangement song={song} onMarker={(bar) => { const had = song.markers?.find((m) => m.bar === bar)?.name ?? ""; const name = window.prompt(had ? `Rename the marker on bar ${bar + 1}, or empty the box to remove it` : `Name this place (bar ${bar + 1}): intro, drop, break…`, had); if (name !== null) { studio.mark(); change((s) => setMarker(s, bar, name)); } }} live={live} back={back?.id} onBack={setRet} onSeek={(bar) => playFrom(bar * STEPS_PER_BAR)} onChange={change} onMark={() => studio.mark()} levelOf={(id) => transport.trackLevel(id)} masterLevel={() => { const l = transport.levels(); return Math.max(l.left, l.right) + 3; }} picked={picked} also={also} onPick={pick} onAdd={add} onPlace={(from, c, to, bar, copy) => { const made = placeClip(song, from, c, to, bar, copy); if (!made) { studio.mark(); return; }   /* a drop where it already is: the start of a length drag, its own step to undo */ studio.mark(); change(made.song); pick(made.track, made.clip); setNote(copy ? "Copied the clip." : "Moved the clip."); }} onBars={(t, c, bars) => change((s) => setClipBars(s, t, c, bars))} step={step} loop={loop} renaming={renaming} />
        </div>
      </div>

      {back && <div className="detail k-return">
        <div className="detail-head"><h3>{back.name}<small>{back.id === MASTER ? " · effects on everything" : " · return track"}</small></h3><span className="daw-hint">{back.id === MASTER ? "Every track and return passes through these effects, in order, just before the master volume. A limiter last in line is the usual choice." : "Tracks send sound here with their send sliders. Keep each effect giving only the effect (Dry / wet at 100), because the untouched sound is already heard from the track itself."}</span></div>
        <DeviceChain devices={back.devices} reduction={(id) => studio.transport.reduction(back.id, id)} analyser={(id) => studio.transport.analyser(back.id, id)} onChange={setBackDevices} />
        {!back.devices.length && back.id !== MASTER && <p className="daw-hint">No effects on this return track yet. Click one under Effects in the browser.</p>}
      </div>}
      {track && <div className={`detail k-${track.kind}`} style={back ? { display: "none" } : undefined}>
        <div className="detail-head">
          <div className="detail-tabs" role="tablist" aria-label="Detail view"><button role="tab" aria-selected={view === "clip"} className={view === "clip" ? "on" : ""} onClick={() => setView("clip")} title="The clip's notes or drum steps (Shift+Tab)">Clip</button><button role="tab" aria-selected={view === "device"} className={view === "device" ? "on" : ""} onClick={() => setView("device")} title={`${track.kind === "drums" ? "The drum rack" : "The synth"} (Shift+Tab)`}>Device</button></div>
          <h3>{track.name}{clip ? <small> · bar {clip.start + 1}{clip.bars > 1 ? ` to ${clip.start + clip.bars}` : ""}{clip.off ? " · switched off" : ""}</small> : null}</h3>
          {clip && view === "clip" && <>
            <div className="seg" role="group" aria-label="Clip length">{CLIP_BARS[track.kind].map((b) => <button key={b} className={clip.bars === b ? "on" : ""} onClick={() => change((s) => setClipBars(s, track.id, clip.id, b))}>{b} bar{b === 1 ? "" : "s"}</button>)}</div>
            <button onClick={() => change((s) => moveClip(s, track.id, clip.id, -1))} title="Move the clip one bar earlier" aria-label="Move clip earlier">◀</button>
            <button onClick={() => change((s) => moveClip(s, track.id, clip.id, 1))} title="Move the clip one bar later" aria-label="Move clip later">▶</button>
            <button onClick={act.duplicate} title={`Duplicate (${MOD}+D)`}>Duplicate</button>
            <button onClick={() => { studio.mark(); change((s) => doubleClip(s, track.id, clip.id)); }} disabled={!CLIP_BARS[track.kind].includes(clip.bars * 2)} title="Double the clip: twice as long, with its contents written again in the new half">×2 length</button>
            <button onClick={act.off} title="Switch the clip off or on (0)">{clip.off ? "Switch on" : "Switch off"}</button>
            {"hits" in clip && pattern && <button onClick={() => setPattern(clearAll(pattern))}>Clear</button>}
            {"notes" in clip && <button onClick={() => putNotes([], new Set())}>Clear</button>}
            {"notes" in clip && <span className="note-tools" role="group" aria-label="Note tools: they change the selected notes, or all of them when none is selected">
              <label title="The grid: what notes snap to when you write or move them, and how far an arrow key moves them">Grid <select value={grid} aria-label="Grid" onChange={(e) => setGrid(Number(e.target.value))}>{GRIDS.map((g) => <option key={g.name} value={g.steps}>{g.name}</option>)}</select></label>
              <button onClick={() => tool(quantizeNotes(clip.notes, sel, grid, clip.bars * STEPS_PER_BAR))} title={`Quantize: pull the notes' starts onto the grid (${MOD}+U)`}>Quantize</button>
              <button onClick={() => tool(reverseNotes(clip.notes, sel))} title="Play the notes backwards">Reverse</button>
              <button onClick={() => tool(invertNotes(clip.notes, sel))} title="Turn the notes upside down: the highest becomes the lowest">Invert</button>
              <button onClick={() => tool(scaleTime(clip.notes, sel, 0.5, clip.bars * STEPS_PER_BAR))} title="Twice as fast">÷2</button>
              <button onClick={() => tool(scaleTime(clip.notes, sel, 2, clip.bars * STEPS_PER_BAR))} title="Half as fast">×2</button>
              <button onClick={() => tool(legatoNotes(clip.notes, sel, clip.bars * STEPS_PER_BAR))} title="Stretch each note until the next one starts">Legato</button>
              <label title="The key of the song: the piano roll lights the rows that belong to it">Key <select value={song.scale ? song.scale.root : -1} aria-label="Key note" onChange={(e) => { const root = Number(e.target.value); change((s) => (root < 0 ? (({ scale: _none, ...rest }) => rest)(s) as Song : { ...s, scale: { root, name: s.scale?.name ?? "Minor" } })); }}><option value={-1}>none</option>{["C", "C♯", "D", "D♯", "E", "F", "F♯", "G", "G♯", "A", "A♯", "B"].map((n, i) => <option key={n} value={i}>{n}</option>)}</select></label>
              {song.scale && <select value={song.scale.name} aria-label="Scale" onChange={(e) => change((s) => ({ ...s, scale: { root: s.scale!.root, name: e.target.value } }))}>{SCALES.map((x) => <option key={x.name}>{x.name}</option>)}</select>}
            </span>}
            <button onClick={clipOut} title="Save this clip as a MIDI file that Ableton and other DAWs open">Download .mid</button>
            <input ref={midiIn} type="file" accept=".mid,.midi,audio/midi" hidden onChange={(e) => { const f = e.target.files?.[0]; e.target.value = ""; if (f) void clipIn(f); }} />
            <button onClick={() => midiIn.current?.click()} title="Read a MIDI file into this clip, replacing what is in it">Bring in .mid</button>
            <button className="linkish" onClick={() => act.del()}>Delete clip</button>
          </>}
        </div>
        {view === "device" && track.kind === "synth" && <DeviceChain kind="note" devices={track.noteFx} onChange={(next) => change((s) => setNoteFx(s, track.id, next))} />}
        {view === "device" && <DeviceChain lead={track.kind === "synth" && track.sampler ? <SamplerPanel set={track.sampler} samples={samples} peaks={transport.peaks(track.sampler.sample)} seconds={transport.seconds(track.sampler.sample)} onChange={(next) => change((s) => setSampler(s, track.id, next))} onSynth={() => { studio.mark(); change((s) => setSampler(s, track.id, undefined)); }} /> : track.kind === "synth" ? <section className="dev inst" aria-label="Synth">
          <header><span className="dev-on on" aria-hidden="true" /><b>Synth</b></header>
          <div className="dev-body">
            <button className={`dev-open${synthOpen ? " on" : ""}`} aria-pressed={synthOpen} onClick={() => setSynthOpen(!synthOpen)} title="Show or hide the whole synth under the rack">{synthOpen ? "Close" : "Open"}</button>
            <small>This track's instrument. The keys play it whether it is open or not. To play a sound file across the keys instead, click one under Samples in the browser.</small>
          </div>
        </section> : undefined} devices={(liveTrack ?? track).devices} reduction={(id) => studio.transport.reduction(track.id, id)} analyser={(id) => studio.transport.analyser(track.id, id)} onChange={(next) => change((s) => setDevices(s, track.id, next))} />}
        {track.kind === "synth" && engine && <TrackSynth key={`${track.id}:${nonce}`} engine={engine} patch={track.patch} bpm={song.bpm} show={view === "device" && synthOpen && !back && !track.sampler} keysOff={() => keysOff.current} onNote={(k, on, v) => { transport.samplerKey(track.id, k, on, v); onNote(k, on, v); }} onPatch={(p) => change((s) => setPatch(s, track.id, { ...p, bpm: s.bpm }))} />}
        {view === "clip" && !clip && <p className="daw-hint">No clip is selected. Double-click an empty bar of this track to add one ({MOD}+Shift+M){track.clips.length ? ", or click one of its clips" : ""}.</p>}
        {view === "clip" && clip && "notes" in clip && <>
          <PianoRoll clip={clip} grid={grid} scale={song.scale ? { root: song.scale.root, steps: (SCALES.find((x) => x.name === song.scale!.name) ?? SCALES[0]!).steps } : undefined} step={local} sel={sel} onSel={setSel} draw={draw} onNotes={(notes) => change((s) => setNotes(s, track.id, clip.id, notes))} onHear={(n) => transport.note(track.id, n)} />
          <p className="daw-roll-help">{draw ? "Draw mode: click or drag to write notes, click a note to remove it." : "Drag to select notes, drag a note to move it, drag its right end for length. Double-click an empty place to add a note, double-click a note to remove it."} {sel.size > 0 && <b>{sel.size} selected.</b>}</p>
        </>}
        {view === "clip" && clip && "hits" in clip && pattern && <>
          <DrumGrid pattern={pattern} onChange={setPattern} step={local} onAudition={(i) => { const l = pattern.lanes[i]; if (l) transport.hitPad(track.id, l); }} open={pad} onSound={setPad} />
          <div className="daw-keep"><span className="daw-key"><span className="cell h1" /> soft <span className="cell h2" /> normal <span className="cell h3" /> accent</span><input type="text" value={saveAs} maxLength={40} placeholder="Name to save under" aria-label="Name to save a break or rack under" onChange={(e) => setSaveAs(e.target.value)} /><button onClick={keepBreak} title="Keep this clip's hits to use again in any song">Save this break</button></div>
        </>}
        {view === "device" && track.kind === "drums" && pattern && <>
          <DrumRack pattern={pattern} onChange={setPattern} studio={studio} trackId={track.id} picked={Math.min(pad, pattern.lanes.length - 1)} onPick={setPad} step={local} onStrike={onStrike} />
          <div className="daw-keep"><input type="text" value={saveAs} maxLength={40} placeholder="Name to save under" aria-label="Name to save a break or rack under" onChange={(e) => setSaveAs(e.target.value)} /><button onClick={keepRack} title="Keep these pads and their settings to use on any drum track">Save this rack</button></div>
        </>}
      </div>}
      <footer className="daw-status" role="status">{note || (rec ? "Recording: what you play is written into the selected clip." : "Double-click an empty bar to add a clip. Click a clip to select it. Open Shortcuts for the keys.")}
        <details className="daw-missing"><summary>What is missing here</summary>
          <p>The built-in drums are made by the browser from tones and noise as they play: our own recipes, not recordings and not a model of any drum machine, and nobody has tuned them by ear yet. The synth tracks are the practice synth from the lessons. The layout and the keys follow Ableton Live's Arrangement View; there is no Session View, no audio tracks, no automation, no effects per track, no splitting or joining of clips, no dragging of clips with the mouse, and no export to a sound file. A MIDI file carries notes and tempo only. Saved songs, breaks and racks, and sound files of 2 MB or under, are kept in this browser and in the site's library.</p>
        </details>
      </footer>
    </section>
  );
}
