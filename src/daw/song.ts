// A song in the Studio, as plain data and maths: tracks down the side, bars along the top, clips on the grid.
// A drum track owns a rack of pads and its clips hold the hits; a synth track owns a sound (the practice
// synth's whole settings) and its clips hold notes. No sound and no screen here.
import { INITIAL, type SynthState } from "../synth/params";
import { clean } from "../synth/patches";
import { tidyDevices, type Device } from "./devices";
import { applyNoteFx, type FxNote } from "./notefx";
import { tidyAuto, type AutoLane } from "./automation";
import { BPM_MAX, BPM_MIN, STEPS_PER_BAR, STRENGTH, SWING_MAX, audibleOf, defaultPads, freeId, stepSeconds, stepTime, tidyPads, tidySteps, type Hit, type Lane, type Pad, type Pattern } from "./drums";

const clamp = (v: number, lo: number, hi: number) => Math.min(hi, Math.max(lo, v));

export interface NoteEv { /** MIDI note number */ note: number; /** steps from the clip's start */ start: number; /** steps */ length: number; /** 1 to 127 */ velocity: number }
interface ClipBase { id: string; /** the bar it starts on, counting from 0 */ start: number; bars: number; /** switched off: it stays on the grid and makes no sound */ off?: boolean }
export interface DrumClip extends ClipBase { /** for each pad's id, its row of steps */ hits: Record<string, Hit[]> }
export interface SynthClip extends ClipBase { notes: NoteEv[] }
interface TrackBase { id: string; name: string; /** 0 to 100 */ level: number; /** -100 (left) to 100 (right) */ pan: number; mute: boolean; solo: boolean; /** the effects after the instrument, in order */ devices: Device[]; /** automation: lines along the song that move this track's settings as it plays */ auto: AutoLane[] }
export interface DrumTrack extends TrackBase { kind: "drums"; pads: Pad[]; clips: DrumClip[] }
export interface SynthTrack extends TrackBase { kind: "synth"; patch: SynthState; clips: SynthClip[]; /** note effects, in front of the synth: they change the clip's notes before they are played */ noteFx: Device[] }
export type Track = DrumTrack | SynthTrack;
export type Clip = DrumClip | SynthClip;
export interface Song { name: string; bpm: number; swing: number; /** length in bars */ bars: number; tracks: Track[]; /** the master volume, 0 to 100 */ volume: number }
export const MASTER_START = 85;
/** The master volume as a gain: its starting place is a little under full, to leave room when tracks add up. */
export const masterGain = (volume: number) => 0.9 * (clamp(volume, 0, 100) / MASTER_START);

export const SONG_BARS = [4, 8, 16, 32] as const, MAX_TRACKS = 8, NOTE_LOW = 24, NOTE_HIGH = 96;
/** Clip lengths each kind of track allows, in bars. */
export const CLIP_BARS: Record<Track["kind"], readonly number[]> = { drums: [1, 2], synth: [1, 2, 4] };

/** Sounds a new synth track can start from: the practice synth's own settings, chosen by us. */
export const SOUNDS: { name: string; patch: Partial<SynthState> }[] = [
  { name: "Soft pad", patch: { shape: "saw", voices: 5, detune: 22, spread: 80, filterOn: true, cutoff: 1800, resonance: 10, envA: 600, envD: 800, envS: 80, envR: 1200, chorusOn: true, reverbOn: true, reverbSize: 3, reverbMix: 35, volumeDb: -16 } },
  { name: "Bass", patch: { shape: "saw", octave: -2, subOn: true, filterOn: true, cutoff: 600, resonance: 20, envA: 2, envD: 250, envS: 60, envR: 80, voiceMode: "mono", volumeDb: -12 } },
  { name: "Pluck", patch: { shape: "saw", filterOn: true, cutoff: 700, resonance: 15, env2Dest: "cutoff", env2Amount: 55, env2D: 220, envA: 2, envD: 260, envS: 0, envR: 180, delayOn: true, delayMix: 25, volumeDb: -12 } },
  { name: "Lead", patch: { shape: "square", filterOn: true, cutoff: 4200, resonance: 12, envA: 4, envD: 300, envS: 75, envR: 120, voiceMode: "mono", glide: 60, volumeDb: -14 } },
  { name: "Big saw chords", patch: { shape: "saw", voices: 7, detune: 30, spread: 100, filterOn: true, cutoff: 5200, resonance: 8, envA: 4, envD: 500, envS: 85, envR: 220, reverbOn: true, reverbSize: 2, reverbMix: 20, volumeDb: -17 } },
  { name: "Plain saw", patch: {} },
];
export const soundPatch = (name: string): SynthState => ({ ...INITIAL, ...(SOUNDS.find((s) => s.name === name)?.patch ?? {}) });

const track = (id: string, kind: Track["kind"], name: string): Track => (kind === "drums"
  ? { id, kind, name, level: 80, pan: 0, mute: false, solo: false, auto: [], devices: [], pads: defaultPads(), clips: [] }
  : { id, kind, name, level: 80, pan: 0, mute: false, solo: false, auto: [], devices: [], noteFx: [], patch: soundPatch("Soft pad"), clips: [] });
export const newSong = (name = "New song"): Song => ({ name, bpm: 120, swing: 0, bars: 8, volume: MASTER_START, tracks: [track("t1", "drums", "Drums"), track("t2", "synth", "Soft pad")] });

const withTrack = (s: Song, id: string, change: (t: Track) => Track): Song => ({ ...s, tracks: s.tracks.map((t) => (t.id === id ? change(t) : t)) });
const withClip = (s: Song, trackId: string, clipId: string, change: (c: Clip) => Clip): Song => withTrack(s, trackId, (t) => ({ ...t, clips: t.clips.map((c) => (c.id === clipId ? change(c) : c)) } as Track));
export const trackOf = (s: Song, id: string | undefined): Track | undefined => s.tracks.find((t) => t.id === id);
export const clipOf = (t: Track | undefined, id: string | undefined): Clip | undefined => t?.clips.find((c) => c.id === id);
/** The clip of a track that covers a bar. */
export const clipAt = (t: Track, bar: number): Clip | undefined => t.clips.find((c) => bar >= c.start && bar < c.start + c.bars);
/** Whether `bars` bars starting at `bar` are inside the song and free on this track (not counting one clip). */
export const isFree = (s: Song, t: Track, bar: number, bars: number, except?: string): boolean =>
  bar >= 0 && bar + bars <= s.bars && !t.clips.some((c) => c.id !== except && bar < c.start + c.bars && c.start < bar + bars);

export function addTrack(s: Song, kind: Track["kind"], sound = "Soft pad"): Song {
  if (s.tracks.length >= MAX_TRACKS) return s;
  const id = freeId(s.tracks.map((t) => t.id), "t"), t = track(id, kind, kind === "drums" ? "Drums" : sound);
  return { ...s, tracks: [...s.tracks, t.kind === "synth" ? { ...t, patch: { ...soundPatch(sound), bpm: s.bpm } } : t] };
}
export const removeTrack = (s: Song, id: string): Song => ({ ...s, tracks: s.tracks.filter((t) => t.id !== id) });
export const setTrack = (s: Song, id: string, change: Partial<Pick<TrackBase, "name" | "level" | "pan" | "mute" | "solo">>): Song =>
  withTrack(s, id, (t) => ({ ...t, ...change, ...(change.name !== undefined ? { name: change.name.slice(0, 24) } : {}), ...(change.level !== undefined ? { level: clamp(change.level, 0, 100) } : {}) }));
/** Replace a track's chain of effects. */
export const setDevices = (s: Song, id: string, devices: Device[]): Song => withTrack(s, id, (t) => ({ ...t, devices }));
export const setPatch = (s: Song, id: string, patch: SynthState): Song => withTrack(s, id, (t) => (t.kind === "synth" ? { ...t, patch } : t));
export const setSongTempo = (s: Song, bpm: number): Song => { const b = clamp(Math.round(bpm), BPM_MIN, BPM_MAX); return { ...s, bpm: b, tracks: s.tracks.map((t) => (t.kind === "synth" ? { ...t, patch: { ...t.patch, bpm: b } } : t)) }; };
export const setSongSwing = (s: Song, swing: number): Song => ({ ...s, swing: clamp(Math.round(swing), 0, SWING_MAX) });
/** Change the song's length. Clips that would no longer fit are removed. */
export const setSongBars = (s: Song, bars: number): Song => ({ ...s, bars, tracks: s.tracks.map((t) => ({ ...t, clips: t.clips.filter((c) => c.start + c.bars <= bars) } as Track)) });

/** Put a new one-bar clip on a track at a bar. Gives back the song and the clip's id, or nothing when the bar is taken. */
export function addClip(s: Song, trackId: string, bar: number): { song: Song; clip: string } | undefined {
  const t = trackOf(s, trackId);
  if (!t || !isFree(s, t, bar, 1)) return undefined;
  const id = freeId(t.clips.map((c) => c.id), "c");
  const clip: Clip = t.kind === "drums" ? { id, start: bar, bars: 1, hits: {} } : { id, start: bar, bars: 1, notes: [] };
  return { song: withTrack(s, trackId, (x) => ({ ...x, clips: [...x.clips, clip] } as Track)), clip: id };
}
export const removeClip = (s: Song, trackId: string, clipId: string): Song => withTrack(s, trackId, (t) => ({ ...t, clips: t.clips.filter((c) => c.id !== clipId) } as Track));
/** Copy a clip into the first free place after it. Nothing when there is no room. */
export function duplicateClip(s: Song, trackId: string, clipId: string): { song: Song; clip: string } | undefined {
  const t = trackOf(s, trackId), c = clipOf(t, clipId);
  if (!t || !c) return undefined;
  for (let bar = c.start + c.bars; bar + c.bars <= s.bars; bar++) {
    if (!isFree(s, t, bar, c.bars)) continue;
    const id = freeId(t.clips.map((x) => x.id), "c"), copy = JSON.parse(JSON.stringify({ ...c, id, start: bar })) as Clip;
    return { song: withTrack(s, trackId, (x) => ({ ...x, clips: [...x.clips, copy] } as Track)), clip: id };
  }
  return undefined;
}
/** Put a copy of a clip (from anywhere) on a track, in the first free place at or after a bar. Nothing when the kinds differ or there is no room. */
export function pasteClip(s: Song, trackId: string, clip: Clip, atBar: number): { song: Song; clip: string } | undefined {
  const t = trackOf(s, trackId);
  if (!t || ("hits" in clip) !== (t.kind === "drums")) return undefined;
  for (let bar = Math.max(0, atBar); bar + clip.bars <= s.bars; bar++) {
    if (!isFree(s, t, bar, clip.bars)) continue;
    const id = freeId(t.clips.map((x) => x.id), "c"), copy = JSON.parse(JSON.stringify({ ...clip, id, start: bar })) as Clip;
    return { song: withTrack(s, trackId, (x) => ({ ...x, clips: [...x.clips, copy] } as Track)), clip: id };
  }
  return undefined;
}
/** Switch a clip off (it stays where it is and is silent) or back on. */
export const toggleClipOff = (s: Song, trackId: string, clipId: string): Song => withClip(s, trackId, clipId, (c) => { const { off, ...rest } = c; return (off ? rest : { ...rest, off: true }) as Clip; });
/** Move a clip by whole bars, if the place is free. */
export function moveClip(s: Song, trackId: string, clipId: string, by: number): Song {
  const t = trackOf(s, trackId), c = clipOf(t, clipId);
  return t && c && isFree(s, t, c.start + by, c.bars, c.id) ? withClip(s, trackId, clipId, (x) => ({ ...x, start: x.start + by })) : s;
}
/** Change a clip's length, if the kind of track allows it and there is room. A drum clip made longer repeats itself. */
export function setClipBars(s: Song, trackId: string, clipId: string, bars: number): Song {
  const t = trackOf(s, trackId), c = clipOf(t, clipId);
  if (!t || !c || bars === c.bars || !CLIP_BARS[t.kind].includes(bars) || !isFree(s, t, c.start, bars, c.id)) return s;
  const steps = bars * STEPS_PER_BAR;
  return withClip(s, trackId, clipId, (x) => ("hits" in x
    ? { ...x, bars, hits: Object.fromEntries(Object.entries(x.hits).map(([k, row]) => [k, Array.from({ length: steps }, (_, i) => row[i % (x.bars * STEPS_PER_BAR)] ?? 0)])) }
    : { ...x, bars, notes: x.notes.filter((n) => n.start < steps).map((n) => ({ ...n, length: Math.min(n.length, steps - n.start) })) }));
}

/** A drum clip seen as a pattern (the pads with this clip's rows), so the step grid can edit it. */
export function clipPattern(s: Song, t: DrumTrack, c: DrumClip): Pattern {
  const length = c.bars * STEPS_PER_BAR;
  return { name: t.name, bpm: s.bpm, swing: s.swing, length: (length === 32 ? 32 : 16), lanes: t.pads.map((pad) => ({ ...pad, steps: tidySteps(c.hits[pad.id], length) })) };
}
/** Put an edited pattern back: the pads go to the track (all its clips share them), the rows to the clip. */
export function withPattern(s: Song, trackId: string, clipId: string, p: Pattern): Song {
  const pads: Pad[] = p.lanes.map(({ steps: _steps, ...pad }: Lane) => pad), bars = p.length / STEPS_PER_BAR;
  let next = withTrack(s, trackId, (t) => (t.kind === "drums" ? { ...t, pads } : t));
  const t = trackOf(next, trackId), c = clipOf(t, clipId);
  if (t && c && bars !== c.bars && isFree(next, t, c.start, bars, c.id)) next = withClip(next, trackId, clipId, (x) => ({ ...x, bars }));
  const now = clipOf(trackOf(next, trackId), clipId), steps = (now?.bars ?? 1) * STEPS_PER_BAR;
  return withClip(next, trackId, clipId, (x) => ("hits" in x ? { ...x, hits: Object.fromEntries(p.lanes.map((l) => [l.id, tidySteps(l.steps, steps)])) } : x));
}
/** Change one pad on a drum track without touching any clip. */
export const withPads = (s: Song, trackId: string, pads: Pad[]): Song => withTrack(s, trackId, (t) => (t.kind === "drums" ? { ...t, pads } : t));

// Notes in a synth clip
const sameNote = (a: NoteEv, b: NoteEv) => a.note === b.note && a.start === b.start;
export const tidyNote = (n: NoteEv, steps: number): NoteEv => { const start = clamp(Math.round(n.start), 0, steps - 1); return { note: clamp(Math.round(n.note), NOTE_LOW, NOTE_HIGH), start, length: clamp(Math.round(n.length), 1, steps - start), velocity: clamp(Math.round(n.velocity), 1, 127) }; };
/** Add a note, or replace the one that starts at the same place on the same key. */
export const putNote = (s: Song, trackId: string, clipId: string, n: NoteEv): Song => withClip(s, trackId, clipId, (c) => ("notes" in c ? { ...c, notes: [...c.notes.filter((x) => !sameNote(x, n)), tidyNote(n, c.bars * STEPS_PER_BAR)].sort((a, b) => a.start - b.start || a.note - b.note) } : c));
export const dropNote = (s: Song, trackId: string, clipId: string, n: Pick<NoteEv, "note" | "start">): Song => withClip(s, trackId, clipId, (c) => ("notes" in c ? { ...c, notes: c.notes.filter((x) => !(x.note === n.note && x.start === n.start)) } : c));
/** Replace a clip's notes (each kept inside the clip; two notes cannot start at the same place on the same key). */
export const setNotes = (s: Song, trackId: string, clipId: string, notes: NoteEv[]): Song => withClip(s, trackId, clipId, (c) => { if (!("notes" in c)) return c; const steps = c.bars * STEPS_PER_BAR, seen = new Set<string>(), out: NoteEv[] = []; for (const n of notes.map((x) => tidyNote(x, steps))) { const k = `${n.note}:${n.start}`; if (!seen.has(k)) { seen.add(k); out.push(n); } } return { ...c, notes: out.sort((x, y) => x.start - y.start || x.note - y.note) }; });
// Working on a chosen set of notes (the piano roll's selection). A note is known by its key and where it starts.
export const noteKey = (n: Pick<NoteEv, "note" | "start">) => `${n.note}:${n.start}`;
const span = (picked: NoteEv[]) => ({ from: Math.min(...picked.map((n) => n.start)), to: Math.max(...picked.map((n) => n.start + n.length)), low: Math.min(...picked.map((n) => n.note)), high: Math.max(...picked.map((n) => n.note)) });
/** Move the chosen notes by steps and semitones, as far as the clip and the keyboard allow. Gives back the notes and the chosen notes' new keys. */
export function shiftNotes(notes: NoteEv[], keys: ReadonlySet<string>, bySteps: number, bySemis: number, steps: number): { notes: NoteEv[]; keys: Set<string> } {
  const picked = notes.filter((n) => keys.has(noteKey(n)));
  if (!picked.length) return { notes, keys: new Set(keys) };
  const s = span(picked), dx = clamp(Math.round(bySteps), -s.from, steps - s.to), dy = clamp(Math.round(bySemis), NOTE_LOW - s.low, NOTE_HIGH - s.high);
  if (!dx && !dy) return { notes, keys: new Set(keys) };
  const moved = picked.map((n) => ({ ...n, start: n.start + dx, note: n.note + dy })), taken = new Set(moved.map(noteKey));
  return { notes: [...notes.filter((n) => !keys.has(noteKey(n)) && !taken.has(noteKey(n))), ...moved], keys: taken };
}
/** Make the chosen notes longer or shorter by steps; none goes under one step or past the end of the clip. */
export const stretchNotes = (notes: NoteEv[], keys: ReadonlySet<string>, bySteps: number, steps: number): NoteEv[] => notes.map((n) => (keys.has(noteKey(n)) ? { ...n, length: clamp(n.length + Math.round(bySteps), 1, steps - n.start) } : n));
/** Copy the chosen notes to straight after themselves (what "duplicate" does). Copies that would start past the end are left out. */
export function duplicateNotes(notes: NoteEv[], keys: ReadonlySet<string>, steps: number): { notes: NoteEv[]; keys: Set<string> } {
  const picked = notes.filter((n) => keys.has(noteKey(n)));
  if (!picked.length) return { notes, keys: new Set(keys) };
  const s = span(picked), by = Math.max(1, s.to - s.from);
  const copies = picked.map((n) => ({ ...n, start: n.start + by })).filter((n) => n.start < steps).map((n) => ({ ...n, length: Math.min(n.length, steps - n.start) })), taken = new Set(copies.map(noteKey));
  return copies.length ? { notes: [...notes.filter((n) => !taken.has(noteKey(n))), ...copies], keys: taken } : { notes, keys: new Set(keys) };
}
/** The note of a clip that covers a key at a step. */
export const noteAt = (c: SynthClip, note: number, step: number): NoteEv | undefined => c.notes.find((n) => n.note === note && step >= n.start && step < n.start + n.length);

export type SongEvent = { track: string; /** seconds from the start of playing */ at: number; /** step within the song */ step: number } & ({ kind: "hit"; pad: Pad; strength: number } | { kind: "note"; note: number; seconds: number; velocity: number });
/**
 * Everything that sounds from step `from` up to but not including `until`. Steps count on for ever from the
 * moment Play was pressed; the song (or the looped stretch of it, `loop`, in bars) goes round and round.
 * This is the one place that decides what is heard and when.
 */
const played = new WeakMap<NoteEv[], { chain: Device[]; bars: number; out: FxNote[] }>();
/** A clip's notes as they are actually played: after the track's note effects. Worked out once per change. */
export function playedNotes(t: SynthTrack, c: SynthClip): FxNote[] {
  if (!t.noteFx.some((d) => d.on)) return c.notes;
  const have = played.get(c.notes);
  if (have && have.chain === t.noteFx && have.bars === c.bars) return have.out;
  const out = applyNoteFx(t.noteFx, c.notes, c.bars * STEPS_PER_BAR);
  played.set(c.notes, { chain: t.noteFx, bars: c.bars, out });
  return out;
}
/** Put a new chain of note effects on a synth track. */
export const setNoteFx = (s: Song, trackId: string, noteFx: Device[]): Song => ({ ...s, tracks: s.tracks.map((t) => (t.id === trackId && t.kind === "synth" ? { ...t, noteFx } : t)) });
export function songEvents(s: Song, from: number, until: number, loop?: { start: number; bars: number }): SongEvent[] {
  const first = (loop?.start ?? 0) * STEPS_PER_BAR, span = Math.max(1, (loop?.bars ?? s.bars)) * STEPS_PER_BAR, on = audibleOf(s.tracks), out: SongEvent[] = [];
  for (let n = from; n < until; n++) {
    const step = first + (((n % span) + span) % span), bar = Math.floor(step / STEPS_PER_BAR), at = stepTime(n, s.bpm, s.swing);
    s.tracks.forEach((t, i) => {
      if (!on[i] || t.level <= 0) return;
      const c = clipAt(t, bar);
      if (!c || c.off) return;
      const local = step - c.start * STEPS_PER_BAR;
      if (t.kind === "drums") {
        const sounding = audibleOf(t.pads);
        t.pads.forEach((pad, j) => { const hit = (c as DrumClip).hits[pad.id]?.[local] ?? 0; if (hit && sounding[j] && pad.level > 0) out.push({ track: t.id, at, step, kind: "hit", pad, strength: STRENGTH[hit] * (pad.level / 100) }); });
      } else {
        // a note that starts part-way through a step (an arpeggiator's triplet, say) is played that much later
        for (const note of playedNotes(t, c as SynthClip)) if (Math.floor(note.start + 1e-9) === local) out.push({ track: t.id, at: at + (note.start - local) * stepSeconds(s.bpm), step, kind: "note", note: note.note, seconds: Math.max(0.03, Math.min(note.length, c.bars * STEPS_PER_BAR - note.start) * stepSeconds(s.bpm) - 0.01), velocity: note.velocity });
      }
    });
  }
  return out;
}
/** Whether anything is written in the song apart from some clips of one track (the ones about to be replaced). */
export const hasOtherMusic = (s: Song, trackId: string, clipIds: readonly string[]): boolean => s.tracks.some((t) => t.clips.some((c) => !(t.id === trackId && clipIds.includes(c.id)) && ("hits" in c ? Object.values(c.hits).some((row) => row.some(Boolean)) : c.notes.length > 0)));
/** Every sound-file id the song's pads use. */
export const samplesUsed = (s: Song): string[] => [...new Set(s.tracks.flatMap((t) => (t.kind === "drums" ? t.pads.map((p) => p.sample).filter((x): x is string => !!x) : [])))];
/** Change the ids of sound files on every pad (a sound's id became one made from its bytes). */
export const renameSamples = (s: Song, ids: Record<string, string>): Song => (samplesUsed(s).some((id) => ids[id]) ? { ...s, tracks: s.tracks.map((t) => (t.kind === "drums" ? { ...t, pads: t.pads.map((p) => (p.sample && ids[p.sample] ? { ...p, sample: ids[p.sample]! } : p)) } : t)) } : s);
/** Take a sound off every pad of every track. */
export const dropSongSample = (s: Song, id: string): Song => ({ ...s, tracks: s.tracks.map((t) => (t.kind === "drums" ? { ...t, pads: t.pads.map((p) => { if (p.sample !== id) return p; const { sample: _old, ...rest } = p; return rest; }) } : t)) });

/** A song read back from storage, made safe. */
export function tidySong(raw: unknown): Song | undefined {
  if (!raw || typeof raw !== "object") return undefined;
  const r = raw as Partial<Song>, bars = (SONG_BARS as readonly number[]).includes(r.bars as number) ? (r.bars as number) : 8;
  const song: Song = { name: typeof r.name === "string" ? r.name.slice(0, 40) : "Song", bpm: clamp(Math.round(Number(r.bpm) || 120), BPM_MIN, BPM_MAX), swing: clamp(Math.round(Number(r.swing) || 0), 0, SWING_MAX), bars, tracks: [], volume: r.volume === undefined ? MASTER_START : clamp(Math.round(Number(r.volume) || 0), 0, 100) };
  for (const g of Array.isArray(r.tracks) ? r.tracks.slice(0, MAX_TRACKS) : []) {
    if (!g || typeof g !== "object" || (g.kind !== "drums" && g.kind !== "synth")) continue;
    const id = typeof g.id === "string" && /^[\w-]{1,24}$/.test(g.id) && !song.tracks.some((t) => t.id === g.id) ? g.id : freeId(song.tracks.map((t) => t.id), "t");
    const base = { id, name: typeof g.name === "string" ? g.name.slice(0, 24) : "Track", level: clamp(Number(g.level ?? 80) || 0, 0, 100), pan: clamp(Math.round(Number((g as { pan?: unknown }).pan) || 0), -100, 100), mute: g.mute === true, solo: g.solo === true, devices: tidyDevices(g.devices), auto: tidyAuto((g as { auto?: unknown }).auto, bars * STEPS_PER_BAR) };
    const t: Track = g.kind === "drums" ? { ...base, kind: "drums", pads: tidyPads(g.pads).length ? tidyPads(g.pads) : defaultPads(), clips: [] } : { ...base, kind: "synth", noteFx: tidyDevices((g as { noteFx?: unknown }).noteFx, "note"), patch: { ...clean(g.patch), bpm: song.bpm }, clips: [] };
    for (const c of Array.isArray(g.clips) ? g.clips : []) {
      if (!c || typeof c !== "object") continue;
      const cb = CLIP_BARS[t.kind].includes(c.bars) ? c.bars : 1, start = Math.round(Number(c.start));
      if (!Number.isFinite(start) || !isFree(song, t, start, cb)) continue;
      const cid = typeof c.id === "string" && /^[\w-]{1,24}$/.test(c.id) && !t.clips.some((x) => x.id === c.id) ? c.id : freeId(t.clips.map((x) => x.id), "c"), steps = cb * STEPS_PER_BAR;
      const off = c.off === true ? { off: true } : {};
      if (t.kind === "drums") { const hits = (c as DrumClip).hits; t.clips.push({ id: cid, start, bars: cb, ...off, hits: Object.fromEntries(t.pads.map((p) => [p.id, tidySteps(hits && typeof hits === "object" ? hits[p.id] : undefined, steps)])) }); }
      else { const notes = (c as SynthClip).notes; t.clips.push({ id: cid, start, bars: cb, ...off, notes: (Array.isArray(notes) ? notes : []).filter((n) => n && [n.note, n.start, n.length].every(Number.isFinite) && n.start >= 0 && n.start < steps).slice(0, 512).map((n) => tidyNote({ ...n, velocity: Number(n.velocity) || 100 }, steps)) }); }
    }
    song.tracks.push(t);
  }
  return song.tracks.length ? song : undefined;
}

// ---- moving, copying, splitting and joining clips, as a DAW's arrangement does ----
/** A clip's contents fitted to another track: drum rows go to the pads in the same places; notes go as they are. */
function fitted(c: Clip, from: Track, to: Track): Clip | undefined {
  if (("hits" in c) !== (to.kind === "drums") || !CLIP_BARS[to.kind].includes(c.bars)) return undefined;
  if (!("hits" in c) || from.id === to.id || from.kind !== "drums" || to.kind !== "drums") return c;
  const steps = c.bars * STEPS_PER_BAR;
  return { ...c, hits: Object.fromEntries(to.pads.map((p, i) => [p.id, (c.hits[from.pads[i]?.id ?? ""] ?? Array.from({ length: steps }, () => 0 as Hit)).slice()])) };
}
/**
 * Put a clip at a bar of the same track or another track of the same kind: moved, or copied when `copy` is set.
 * Nothing happens (undefined) when the place is taken, off the end of the song, or the track is the wrong kind.
 */
export function placeClip(s: Song, fromTrack: string, clipId: string, toTrack: string, bar: number, copy = false): { song: Song; track: string; clip: string } | undefined {
  const from = trackOf(s, fromTrack), to = trackOf(s, toTrack), c = clipOf(from, clipId);
  if (!from || !to || !c || bar < 0 || bar + c.bars > s.bars) return undefined;
  const same = from.id === to.id, body = fitted(c, from, to);
  if (!body || (same && !copy && bar === c.start) || !isFree(s, to, bar, c.bars, same && !copy ? c.id : undefined)) return undefined;
  const id = same && !copy ? c.id : freeId(to.clips.map((x) => x.id), "c"), placed = JSON.parse(JSON.stringify({ ...body, id, start: bar })) as Clip;
  let song = copy ? s : withTrack(s, from.id, (t) => ({ ...t, clips: t.clips.filter((x) => x.id !== c.id) } as Track));
  song = withTrack(song, to.id, (t) => ({ ...t, clips: [...t.clips, placed] } as Track));
  return { song, track: to.id, clip: id };
}
/** Cut a clip of several bars into one-bar clips. A note that crosses a bar line is cut off at it. */
export function splitClip(s: Song, trackId: string, clipId: string): { song: Song; clips: string[] } | undefined {
  const t = trackOf(s, trackId), c = clipOf(t, clipId);
  if (!t || !c || c.bars < 2) return undefined;
  const taken = t.clips.map((x) => x.id), ids: string[] = [], parts: Clip[] = [];
  for (let b = 0; b < c.bars; b++) {
    const id = b === 0 ? c.id : freeId([...taken, ...ids], "c"), lo = b * STEPS_PER_BAR, hi = lo + STEPS_PER_BAR; ids.push(id);
    const base = { id, start: c.start + b, bars: 1, ...(c.off ? { off: true } : {}) };
    parts.push("hits" in c ? { ...base, hits: Object.fromEntries(Object.entries(c.hits).map(([k, row]) => [k, row.slice(lo, hi)])) }
      : { ...base, notes: c.notes.filter((n) => n.start >= lo && n.start < hi).map((n) => ({ ...n, start: n.start - lo, length: Math.min(n.length, hi - n.start) })) });
  }
  return { song: withTrack(s, trackId, (x) => ({ ...x, clips: [...x.clips.filter((y) => y.id !== c.id), ...parts] } as Track)), clips: ids };
}
/** Join clips that sit next to each other on one track into a single clip, if a clip may be that long. */
export function joinClips(s: Song, trackId: string, clipIds: readonly string[]): { song: Song; clip: string } | undefined {
  const t = trackOf(s, trackId), cs = (t?.clips ?? []).filter((c) => clipIds.includes(c.id)).sort((a, b) => a.start - b.start);
  if (!t || cs.length < 2) return undefined;
  const bars = cs.reduce((n, c) => n + c.bars, 0), first = cs[0]!;
  if (!CLIP_BARS[t.kind].includes(bars) || cs.some((c, i) => i > 0 && c.start !== cs[i - 1]!.start + cs[i - 1]!.bars)) return undefined;
  let at = 0; const steps = bars * STEPS_PER_BAR;
  const joined: Clip = "hits" in first
    ? { id: first.id, start: first.start, bars, hits: Object.fromEntries((t as DrumTrack).pads.map((p) => [p.id, cs.flatMap((c) => { const row = (c as DrumClip).hits[p.id] ?? []; return Array.from({ length: c.bars * STEPS_PER_BAR }, (_, i) => (c.off ? 0 : row[i] ?? 0) as Hit); })])) }
    : { id: first.id, start: first.start, bars, notes: cs.flatMap((c) => { const off = at; at += c.bars * STEPS_PER_BAR; return c.off ? [] : (c as SynthClip).notes.map((n) => ({ ...n, start: n.start + off })); }).filter((n) => n.start < steps) };
  const gone = new Set(cs.map((c) => c.id));
  return { song: withTrack(s, trackId, (x) => ({ ...x, clips: [...x.clips.filter((y) => !gone.has(y.id)), joined] } as Track)), clip: first.id };
}
/** Set how hard the chosen notes are played (1 to 127). */
export const setVelocity = (notes: NoteEv[], keys: ReadonlySet<string>, velocity: number): NoteEv[] => { const v = clamp(Math.round(velocity), 1, 127); return notes.map((n) => (keys.has(noteKey(n)) && n.velocity !== v ? { ...n, velocity: v } : n)); };

/** Put new automation lanes on a track. */
export const setAuto = (s: Song, trackId: string, auto: AutoLane[]): Song => withTrack(s, trackId, (t) => ({ ...t, auto } as Track));
