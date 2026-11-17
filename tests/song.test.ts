import { describe, expect, it } from "vitest";
import { STARTERS, STRENGTH } from "../src/daw/drums";
import { addClip, addTrack, clipOf, clipPattern, duplicateClip, isFree, moveClip, newSong, putNote, removeClip, setClipBars, setNotes, setSongBars, setSongTempo, setTrack, songEvents, tidySong, trackOf, withPattern, MAX_TRACKS, type DrumTrack, type DrumClip, type SynthClip, type Song } from "../src/daw/song";

/** A song with one bar of four-on-the-floor on bar 1 and a chord on bars 1 to 2. */
function demo(): { song: Song; drums: string; synth: string; beat: string; chord: string } {
  let song = newSong();
  const drums = song.tracks[0]!.id, synth = song.tracks[1]!.id;
  const a = addClip(song, drums, 0)!; song = withPattern(a.song, drums, a.clip, STARTERS[0]!);
  const b = addClip(song, synth, 0)!; song = setClipBars(b.song, synth, b.clip, 2);
  for (const note of [57, 60, 64]) song = putNote(song, synth, b.clip, { note, start: 0, length: 32, velocity: 90 });
  return { song, drums, synth, beat: a.clip, chord: b.clip };
}

describe("a song", () => {
  it("starts with a drum track and a synth track, eight bars long", () => {
    const s = newSong();
    expect(s.tracks.map((t) => t.kind)).toEqual(["drums", "synth"]);
    expect(s.bars).toBe(8);
  });
  it("puts clips on free bars only", () => {
    const { song, drums } = demo(), t = trackOf(song, drums)!;
    expect(addClip(song, drums, 0)).toBeUndefined(); // taken
    expect(addClip(song, drums, 8)).toBeUndefined(); // past the end
    expect(isFree(song, t, 1, 1)).toBe(true);
    expect(addClip(song, drums, 1)!.song.tracks[0]!.clips).toHaveLength(2);
  });
  it("a drum clip is edited as a pattern and put back: pads to the track, rows to the clip", () => {
    const { song, drums, beat } = demo(), t = trackOf(song, drums) as DrumTrack, c = clipOf(t, beat) as DrumClip;
    expect(c.hits.kick!.filter(Boolean)).toHaveLength(4);
    const p = clipPattern(song, t, c);
    expect(p.lanes[0]!.steps).toEqual(STARTERS[0]!.lanes[0]!.steps);
    const louder = withPattern(song, drums, beat, { ...p, lanes: p.lanes.map((l, i) => (i === 0 ? { ...l, level: 100 } : l)) });
    expect((trackOf(louder, drums) as DrumTrack).pads[0]!.level).toBe(100);
  });
  it("duplicates into the next free place, moves by bars, and refuses when there is no room", () => {
    let { song } = demo();
    const { drums, beat } = demo();
    const copy = duplicateClip(song, drums, beat)!;
    expect(clipOf(trackOf(copy.song, drums), copy.clip)!.start).toBe(1);
    expect((clipOf(trackOf(copy.song, drums), copy.clip) as DrumClip).hits.kick).toEqual((clipOf(trackOf(song, drums), beat) as DrumClip).hits.kick);
    expect(moveClip(copy.song, drums, beat, 1)).toBe(copy.song); // the copy is in the way
    song = moveClip(song, drums, beat, 3);
    expect(clipOf(trackOf(song, drums), beat)!.start).toBe(3);
    expect(moveClip(song, drums, beat, -9)).toBe(song);
    for (let i = 0; i < 10; i++) song = duplicateClip(song, drums, beat)?.song ?? song;
    expect(trackOf(song, drums)!.clips).toHaveLength(5); // bars 4 to 8
    expect(duplicateClip(song, drums, beat)).toBeUndefined();
  });
  it("a drum clip made longer repeats itself; a synth clip made shorter loses notes past its end", () => {
    const { song, drums, synth, beat, chord } = demo();
    const two = setClipBars(song, drums, beat, 2);
    expect((clipOf(trackOf(two, drums), beat) as DrumClip).hits.kick!.filter(Boolean)).toHaveLength(8);
    expect(setClipBars(song, drums, beat, 4)).toBe(song); // drum clips are one or two bars
    const late = putNote(song, synth, chord, { note: 72, start: 20, length: 4, velocity: 100 });
    const one = clipOf(trackOf(setClipBars(late, synth, chord, 1), synth), chord) as SynthClip;
    expect(one.notes.map((n) => n.note)).toEqual([57, 60, 64]);
    expect(one.notes[0]!.length).toBe(16);
  });
  it("notes stay inside the clip and cannot double up", () => {
    const { song, synth, chord } = demo();
    const s = setNotes(song, synth, chord, [{ note: 60, start: 30, length: 9, velocity: 300 }, { note: 60, start: 30, length: 1, velocity: 80 }, { note: 200, start: -4, length: 0, velocity: 0 }]);
    const notes = (clipOf(trackOf(s, synth), chord) as SynthClip).notes;
    expect(notes).toEqual([{ note: 96, start: 0, length: 1, velocity: 1 }, { note: 60, start: 30, length: 2, velocity: 127 }]);
  });
});

describe("what a song plays", () => {
  it("drums and notes land on the same clock", () => {
    const { song } = demo(), ev = songEvents(song, 0, 16);
    const kicks = ev.filter((e) => e.kind === "hit" && e.pad.voice === "kick");
    expect(kicks.map((e) => e.step)).toEqual([0, 4, 8, 12]);
    expect(kicks[1]!.at).toBeCloseTo(0.5, 10);
    expect(kicks[0]!.kind === "hit" && kicks[0]!.strength).toBeCloseTo(STRENGTH[3] * 0.8, 10);
    const notes = ev.filter((e) => e.kind === "note");
    expect(notes.map((e) => e.kind === "note" && e.note)).toEqual([57, 60, 64]);
    expect(notes[0]!.at).toBe(0);
    expect(notes[0]!.kind === "note" && notes[0]!.seconds).toBeCloseTo(4 - 0.01, 6); // two bars at 120 bpm
  });
  it("bars with no clip are silent, and the song goes round", () => {
    const { song } = demo();
    expect(songEvents(song, 16, 32).filter((e) => e.kind === "hit")).toEqual([]);
    const again = songEvents(song, 128, 129); // step 0 of the second time round an eight-bar song
    expect(again.some((e) => e.kind === "hit" && e.pad.voice === "kick")).toBe(true);
    expect(again[0]!.at).toBeCloseTo(16, 10);
  });
  it("a loop plays only its stretch", () => {
    const { song, drums, beat } = demo(), moved = moveClip(song, drums, beat, 3);
    const ev = songEvents(moved, 0, 32, { start: 3, bars: 1 });
    expect(ev.filter((e) => e.kind === "hit" && e.pad.voice === "kick").map((e) => e.step)).toEqual([48, 52, 56, 60, 48, 52, 56, 60]);
    expect(ev.some((e) => e.kind === "note")).toBe(false);
  });
  it("mute and solo work on tracks as they do on pads", () => {
    const { song, drums, synth } = demo();
    expect(songEvents(setTrack(song, drums, { mute: true }), 0, 16).every((e) => e.kind === "note")).toBe(true);
    expect(songEvents(setTrack(song, drums, { solo: true }), 0, 16).every((e) => e.kind === "hit")).toBe(true);
    expect(songEvents(setTrack(song, synth, { level: 0 }), 0, 16).every((e) => e.kind === "hit")).toBe(true);
  });
  it("tempo reaches every synth track, so tempo-locked settings follow the song", () => {
    const s = setSongTempo(addTrack(newSong(), "synth", "Bass"), 90);
    expect(s.tracks.filter((t) => t.kind === "synth").map((t) => t.kind === "synth" && t.patch.bpm)).toEqual([90, 90]);
  });
});

describe("keeping a song", () => {
  it("comes back from storage the same", () => {
    const { song } = demo();
    expect(tidySong(JSON.parse(JSON.stringify(song)))).toEqual(song);
  });
  it("is made safe", () => {
    expect(tidySong(null)).toBeUndefined();
    expect(tidySong({ tracks: [] })).toBeUndefined();
    const s = tidySong({ bpm: 9999, bars: 7, tracks: [{ kind: "drums", id: "x", clips: [{ start: 0, bars: 1, hits: { kick: [3, 9] } }, { start: 0, bars: 1 }, { start: 99, bars: 1 }] }, { kind: "synth", id: "x", patch: { cutoff: "loud" }, clips: [{ start: 0, bars: 4, notes: [{ note: 60, start: 2, length: 2 }, { note: "c", start: 0, length: 1 }] }] }, { kind: "tape" }] })!;
    expect(s.bpm).toBe(200); expect(s.bars).toBe(8);
    expect(s.tracks).toHaveLength(2);
    expect(new Set(s.tracks.map((t) => t.id)).size).toBe(2);
    expect(s.tracks[0]!.clips).toHaveLength(1);
    expect((s.tracks[0]!.clips[0] as DrumClip).hits.kick!.slice(0, 2)).toEqual([3, 0]);
    const synth = s.tracks[1]!;
    expect(synth.kind === "synth" && synth.patch.cutoff).toBe(20000);
    expect((synth.clips[0] as SynthClip).notes).toEqual([{ note: 60, start: 2, length: 2, velocity: 100 }]);
  });
  it("a shorter song drops the clips that no longer fit, and tracks stop at eight", () => {
    const { song, drums, beat } = demo();
    expect(trackOf(setSongBars(moveClip(song, drums, beat, 6), 4), drums)!.clips).toHaveLength(0);
    let s = newSong();
    for (let i = 0; i < 12; i++) s = addTrack(s, "synth");
    expect(s.tracks).toHaveLength(MAX_TRACKS);
    expect(removeClip(song, drums, beat).tracks[0]!.clips).toHaveLength(0);
  });
});

import { duplicateNotes, noteKey, pasteClip, shiftNotes, stretchNotes, toggleClipOff } from "../src/daw/song";
describe("editing with the keys: selected notes and clips", () => {
  const notes = [{ note: 60, start: 0, length: 2, velocity: 100 }, { note: 64, start: 2, length: 2, velocity: 100 }, { note: 67, start: 8, length: 4, velocity: 100 }];
  const two = new Set([noteKey(notes[0]!), noteKey(notes[1]!)]);
  it("duplicate puts a copy of the selection straight after it and selects the copy", () => {
    const r = duplicateNotes(notes, two, 16);
    expect(r.notes).toHaveLength(5);
    expect([...r.keys].sort()).toEqual(["60:4", "64:6"]);
    expect(duplicateNotes(notes, new Set(["67:8"]), 16).notes.find((n) => n.start === 12)).toMatchObject({ note: 67, length: 4 });
    expect(duplicateNotes(notes, new Set(["67:8"]), 12).notes).toBe(notes); // no room: nothing changes
    expect(duplicateNotes(notes, new Set(), 16).notes).toBe(notes);
  });
  it("moves the selection by steps and semitones, and stops at the clip's edges and the keyboard's", () => {
    const r = shiftNotes(notes, two, 1, 12, 16);
    expect(r.notes.filter((n) => r.keys.has(noteKey(n))).map((n) => [n.note, n.start])).toEqual([[72, 1], [76, 3]]);
    expect(shiftNotes(notes, two, -5, 0, 16).notes).toBe(notes); // already at the start
    const far = shiftNotes(notes, two, 99, 99, 16);
    expect(Math.max(...far.notes.map((n) => n.start + n.length))).toBeLessThanOrEqual(16);
    expect(Math.max(...far.notes.map((n) => n.note))).toBeLessThanOrEqual(96);
    expect(far.notes).toHaveLength(3);
  });
  it("makes the selection longer or shorter, never under a step or past the end", () => {
    expect(stretchNotes(notes, two, -9, 16).filter((n) => two.has(noteKey(n))).map((n) => n.length)).toEqual([1, 1]);
    expect(stretchNotes(notes, new Set(["67:8"]), 99, 16)[2]!.length).toBe(8);
  });
  it("a clip that is switched off stays on the grid and is silent", () => {
    const { song, drums, beat } = demo(), off = toggleClipOff(song, drums, beat);
    expect(clipOf(trackOf(off, drums), beat)!.off).toBe(true);
    expect(songEvents(off, 0, 16).some((e) => e.kind === "hit")).toBe(false);
    expect(tidySong(JSON.parse(JSON.stringify(off)))).toEqual(off);
    expect("off" in clipOf(trackOf(toggleClipOff(off, drums, beat), drums), beat)!).toBe(false);
  });
  it("a copied clip is pasted into the first free place, on a track of its own kind only", () => {
    const { song, drums, synth, beat } = demo(), c = clipOf(trackOf(song, drums), beat)!;
    const made = pasteClip(song, drums, c, 0)!;
    expect(clipOf(trackOf(made.song, drums), made.clip)!.start).toBe(1);
    expect((clipOf(trackOf(made.song, drums), made.clip) as DrumClip).hits.kick).toEqual((c as DrumClip).hits.kick);
    expect(pasteClip(song, synth, c, 0)).toBeUndefined();
    expect(pasteClip(song, drums, c, 8)).toBeUndefined();
  });
});
