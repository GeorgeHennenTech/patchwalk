// Standard MIDI Files: the one format every DAW reads and writes, Ableton Live included. A clip or a whole
// song goes out as a .mid file and a .mid file comes back in as notes. Drum pads are written from C1 (note
// 36) upward in pad order, which is where a drum rack in a DAW keeps its pads.
// What a MIDI file cannot carry: sounds (the synth's settings, sound files), swing, mutes and levels.
import { STEPS_PER_BAR, type Hit } from "./drums";
import type { NoteEv, Song } from "./song";

export const PPQ = 480, TICKS_PER_STEP = PPQ / 4, DRUM_BASE = 36;
/** How hard each strength of hit is written, and how a loudness read back becomes a strength. */
export const HIT_VELOCITY: Record<Hit, number> = { 0: 0, 1: 50, 2: 96, 3: 127 };
export const hitOf = (velocity: number): Hit => (velocity <= 0 ? 0 : velocity < 70 ? 1 : velocity < 112 ? 2 : 3);

export interface MidiNote { note: number; /** ticks from the start */ start: number; /** ticks */ length: number; velocity: number }
export interface MidiTrack { name?: string; notes: MidiNote[]; /** MIDI channel 0 to 15; drums go on 9 by convention */ channel?: number }
export interface MidiFile { ppq: number; bpm?: number; tracks: MidiTrack[] }

const varLen = (n: number): number[] => { const out = [n & 0x7f]; for (n >>= 7; n > 0; n >>= 7) out.unshift((n & 0x7f) | 0x80); return out; };
const u32 = (n: number) => [(n >>> 24) & 255, (n >>> 16) & 255, (n >>> 8) & 255, n & 255];
const text = (s: string) => [...new TextEncoder().encode(s)];
function chunk(id: string, body: number[]): number[] { return [...text(id), ...u32(body.length), ...body]; }

/** Write a MIDI file (format 1: a tempo track, then one track per part). */
export function writeMidi(file: MidiFile): Uint8Array {
  const tracks: number[][] = [];
  const tempo: number[] = [];
  if (file.bpm) { const us = Math.round(60_000_000 / file.bpm); tempo.push(0, 0xff, 0x51, 3, (us >> 16) & 255, (us >> 8) & 255, us & 255); }
  tempo.push(0, 0xff, 0x58, 4, 4, 2, 24, 8, 0, 0xff, 0x2f, 0);
  tracks.push(tempo);
  for (const t of file.tracks) {
    const ch = (t.channel ?? 0) & 15, body: number[] = [];
    if (t.name) { const n = text(t.name.slice(0, 60)); body.push(0, 0xff, 0x03, ...varLen(n.length), ...n); }
    // offs before ons at the same tick, so a note that ends where the next begins is not cut
    const events = t.notes.flatMap((n) => [{ at: n.start, on: 1, n }, { at: n.start + Math.max(1, n.length), on: 0, n }]).sort((a, b) => a.at - b.at || a.on - b.on || a.n.note - b.n.note);
    let last = 0;
    for (const e of events) { body.push(...varLen(Math.max(0, Math.round(e.at) - last)), (e.on ? 0x90 : 0x80) | ch, e.n.note & 127, e.on ? Math.min(127, Math.max(1, Math.round(e.n.velocity))) : 0); last = Math.max(last, Math.round(e.at)); }
    body.push(0, 0xff, 0x2f, 0);
    tracks.push(body);
  }
  return Uint8Array.from([...chunk("MThd", [0, 1, (tracks.length >> 8) & 255, tracks.length & 255, (file.ppq >> 8) & 255, file.ppq & 255]), ...tracks.flatMap((t) => chunk("MTrk", t))]);
}

/** Read a MIDI file. Gives nothing when the bytes are not one (or use a timing this app does not read). */
export function readMidi(bytes: Uint8Array): MidiFile | undefined {
  const str = (at: number) => String.fromCharCode(...bytes.subarray(at, at + 4)), num = (at: number, n: number) => { let v = 0; for (let i = 0; i < n; i++) v = v * 256 + (bytes[at + i] ?? 0); return v; };
  if (bytes.length < 14 || str(0) !== "MThd") return undefined;
  const division = num(12, 2);
  if (division & 0x8000 || division === 0) return undefined; // timed in film frames, not beats
  const file: MidiFile = { ppq: division, tracks: [] };
  let at = 8 + num(4, 4);
  while (at + 8 <= bytes.length) {
    const id = str(at), size = num(at + 4, 4), end = Math.min(bytes.length, at + 8 + size);
    let p = at + 8;
    at = end;
    if (id !== "MTrk") continue;
    const track: MidiTrack = { notes: [] }, open = new Map<number, { start: number; velocity: number }[]>();
    let tick = 0, status = 0;
    const read = () => { let v = 0; for (let i = 0; i < 4 && p < end; i++) { const b = bytes[p++]!; v = (v << 7) | (b & 0x7f); if (!(b & 0x80)) break; } return v; };
    while (p < end) {
      tick += read();
      let b = bytes[p]!;
      if (b & 0x80) { status = b; p++; } else if (!status) break;
      if (status === 0xff) { const type = bytes[p++]!, len = read(); if (type === 0x51 && len === 3 && !file.bpm) file.bpm = Math.round(60_000_000 / num(p, 3)); if (type === 0x03 && !track.name) track.name = new TextDecoder().decode(bytes.subarray(p, p + len)); p += len; status = 0; continue; }
      if (status === 0xf0 || status === 0xf7) { p += read(); status = 0; continue; }
      const kind = status & 0xf0, a = bytes[p++]!;
      b = kind === 0xc0 || kind === 0xd0 ? 0 : bytes[p++]!;
      if (kind === 0x90 && b > 0) { track.channel ??= status & 15; open.set(a, [...(open.get(a) ?? []), { start: tick, velocity: b }]); }
      else if (kind === 0x80 || kind === 0x90) { const o = open.get(a)?.shift(); if (o) track.notes.push({ note: a, start: o.start, length: Math.max(1, tick - o.start), velocity: o.velocity }); }
    }
    for (const [note, left] of open) for (const o of left) track.notes.push({ note, start: o.start, length: Math.max(1, tick - o.start), velocity: o.velocity });
    track.notes.sort((x, y) => x.start - y.start || x.note - y.note);
    if (track.notes.length) file.tracks.push(track);
  }
  return file;
}

/** A drum clip's rows (in pad order) as MIDI notes: pad 1 is C1, pad 2 the key above, and so on. */
export const hitsToMidi = (rows: Hit[][], offsetSteps = 0, /** steps in a bar the rows are written in */ grid = 16): MidiNote[] => rows.flatMap((row, pad) => row.flatMap((h, i) => (h ? [{ note: DRUM_BASE + pad, start: Math.round((offsetSteps + (i * 16) / grid) * TICKS_PER_STEP), length: TICKS_PER_STEP / 2, velocity: HIT_VELOCITY[h] }] : [])));
export const notesToMidi = (notes: NoteEv[], offsetSteps = 0): MidiNote[] => notes.map((n) => ({ note: n.note, start: (offsetSteps + n.start) * TICKS_PER_STEP, length: n.length * TICKS_PER_STEP, velocity: n.velocity }));
const stepOf = (ticks: number, ppq: number) => Math.round((ticks / ppq) * 4);
/** MIDI notes as rows for `pads` pads over `steps` steps. Notes below C1, above the last pad or past the end are left out; the count of those is given back. */
export function midiToHits(notes: MidiNote[], ppq: number, pads: number, steps: number, /** steps in a bar to read the notes onto */ grid = 16): { rows: Hit[][]; left: number } {
  const rows = Array.from({ length: pads }, () => Array.from({ length: steps }, () => 0 as Hit));
  let left = 0;
  for (const n of notes) { const pad = n.note - DRUM_BASE, step = grid === 16 ? stepOf(n.start, ppq) : Math.round((n.start / ppq) * (grid / 4)); if (pad < 0 || pad >= pads || step < 0 || step >= steps) { left++; continue; } rows[pad]![step] = hitOf(n.velocity); }
  return { rows, left };
}
/** MIDI notes as a synth clip's notes, snapped to sixteenth steps, within `steps` steps. */
export function midiToNotes(notes: MidiNote[], ppq: number, steps: number): { notes: NoteEv[]; left: number } {
  const out: NoteEv[] = [];
  let left = 0;
  // notes keep triplets and thirty-seconds: places are kept to twenty-fourths of a step, not pulled onto sixteenths
  const fine = (ticks: number) => Math.round((ticks / ppq) * 4 * 24) / 24;
  for (const n of notes) { const start = fine(n.start); if (start < 0 || start >= steps) { left++; continue; } out.push({ note: n.note, start, length: Math.max(0.25, Math.min(steps - start, fine(n.length))), velocity: n.velocity }); }
  return { notes: out, left };
}
/** How many bars a file's notes run to (at least one). */
export const midiBars = (notes: MidiNote[], ppq: number): number => Math.max(1, Math.ceil(Math.max(0, ...notes.map((n) => stepOf(n.start, ppq) + 1)) / STEPS_PER_BAR));

/** A whole song as a MIDI file: a track per track, clips at their bars. */
export function songToMidi(s: Song): Uint8Array {
  return writeMidi({ ppq: PPQ, bpm: s.bpm, tracks: s.tracks.flatMap((t) => (t.kind === "audio" ? [] : [t])).map((t) => ({ name: t.name, channel: t.kind === "drums" ? 9 : 0,
    notes: t.kind === "drums" ? t.clips.flatMap((c) => hitsToMidi(t.pads.map((p) => c.hits[p.id] ?? []), c.start * STEPS_PER_BAR, c.grid ?? 16)) : t.clips.flatMap((c) => notesToMidi(c.notes, c.start * STEPS_PER_BAR)) })) });
}
