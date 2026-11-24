import { describe, expect, it } from "vitest";
import { STARTERS, STRENGTH } from "../src/daw/drums";
import { samplesUsed, addAudioClip, setAudioClip, audioRate, audioBars, type AudioClip, type SongEvent, toggleNotesOff, soloOnly, sliceToTrack, quantizeNotes, snapStep, GRIDS, setMarker, doubleClip, inKey, invertNotes, legatoNotes, reverseNotes, scaleTime, setChance, noteKey as keyOf, addReturn, removeReturn, sendGain, setReturn, setSend, addClip, addTrack, clipOf, clipPattern, duplicateClip, isFree, moveClip, newSong, putNote, removeClip, setClipBars, setNotes, setSongBars, setSongTempo, setTrack, songEvents, tidySong, trackOf, withPattern, MAX_TRACKS, type DrumTrack, type DrumClip, type SynthClip, type Song } from "../src/daw/song";

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
    expect((clipOf(trackOf(setClipBars(song, drums, beat, 4), drums), beat) as DrumClip).hits.kick!.filter(Boolean)).toHaveLength(16);
    expect(setClipBars(song, drums, beat, 5)).toBe(song); // a drum clip is one to four bars
    expect(clipOf(trackOf(setClipBars(song, synth, chord, 7), synth), chord)!.bars).toBe(7); // a note clip can be any whole number of bars up to sixteen
    expect(setClipBars(song, synth, chord, 17)).toBe(song);
    const late = putNote(song, synth, chord, { note: 72, start: 20, length: 4, velocity: 100 });
    const one = clipOf(trackOf(setClipBars(late, synth, chord, 1), synth), chord) as SynthClip;
    expect(one.notes.map((n) => n.note)).toEqual([57, 60, 64]);
    expect(one.notes[0]!.length).toBe(16);
  });
  it("notes stay inside the clip and cannot double up", () => {
    const { song, synth, chord } = demo();
    const s = setNotes(song, synth, chord, [{ note: 60, start: 30, length: 9, velocity: 300 }, { note: 60, start: 30, length: 1, velocity: 80 }, { note: 200, start: -4, length: 0, velocity: 0 }]);
    const notes = (clipOf(trackOf(s, synth), chord) as SynthClip).notes;
    expect(notes).toEqual([{ note: 127, start: 0, length: 0.25, velocity: 1 }, { note: 60, start: 30, length: 2, velocity: 127 }]);
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
    expect(Math.max(...far.notes.map((n) => n.note))).toBeLessThanOrEqual(127);
    expect(far.notes).toHaveLength(3);
  });
  it("makes the selection longer or shorter, never under the shortest note or past the end", () => {
    expect(stretchNotes(notes, two, -9, 16).filter((n) => two.has(noteKey(n))).map((n) => n.length)).toEqual([0.25, 0.25]);
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

import { hasOtherMusic } from "../src/daw/song";
describe("when a break may set the song's tempo", () => {
  it("only when nothing else is written in the song", () => {
    const { song, drums, synth, beat, chord } = demo();
    expect(hasOtherMusic(song, drums, [beat])).toBe(true);            // the chord is there
    const noChord = removeClip(song, synth, chord);
    expect(hasOtherMusic(noChord, drums, [beat])).toBe(false);        // only the clip being replaced
    const empty = addClip(noChord, synth, 3)!.song;
    expect(hasOtherMusic(empty, drums, [beat])).toBe(false);          // an empty clip is not music
    const second = duplicateClip(noChord, drums, beat)!;
    expect(hasOtherMusic(second.song, drums, [beat])).toBe(true);     // another drum clip with hits
    expect(hasOtherMusic(second.song, drums, [beat, second.clip])).toBe(false);
  });
});

import { joinClips, placeClip, setVelocity, splitClip } from "../src/daw/song";
describe("moving, copying, splitting and joining clips", () => {
  const base = () => { let s = addTrack(addTrack({ ...newSong(), tracks: [], bars: 8 }, "synth"), "synth"); s = addTrack(s, "drums"); const [a, b, d] = s.tracks.map((t) => t.id) as [string, string, string];
    const made = addClip(s, a, 0)!; s = setNotes(made.song, a, made.clip, [{ note: 60, start: 0, length: 4, velocity: 100 }, { note: 64, start: 14, length: 2, velocity: 80 }]); return { s, a, b, d, c: made.clip }; };
  it("a clip moves to a free bar, to another track of the same kind, or is copied; never onto a taken place or the wrong kind", () => {
    const { s, a, b, d, c } = base(), moved = placeClip(s, a, c, a, 3)!;
    expect(moved.song.tracks[0]!.clips.map((x) => [x.id, x.start])).toEqual([[c, 3]]);
    const across = placeClip(s, a, c, b, 2)!; expect(across.song.tracks[0]!.clips).toHaveLength(0); expect(across.song.tracks[1]!.clips[0]).toMatchObject({ start: 2, bars: 1 });
    const copy = placeClip(s, a, c, a, 5, true)!; expect(copy.song.tracks[0]!.clips.map((x) => x.start).sort()).toEqual([0, 5]); expect(copy.clip).not.toBe(c);
    expect(placeClip(copy.song, a, c, a, 5)).toBeUndefined();          // taken
    expect(placeClip(s, a, c, a, 0)).toBeUndefined();                  // where it already is
    expect(placeClip(s, a, c, d, 1)).toBeUndefined();                  // notes do not go on a drum track
    expect(placeClip(s, a, c, a, 8)).toBeUndefined(); expect(placeClip(s, a, c, a, -1)).toBeUndefined();
  });
  it("a long clip splits into bars, cutting notes at the bar line, and the bars join back", () => {
    const { s, a, c } = base(), long = setClipBars(setNotes(s, a, c, [{ note: 60, start: 0, length: 4, velocity: 100 }]), a, c, 2), withNote = setNotes(long, a, c, [{ note: 60, start: 0, length: 4, velocity: 100 }, { note: 62, start: 14, length: 6, velocity: 90 }, { note: 65, start: 20, length: 2, velocity: 70 }]);
    const cut = splitClip(withNote, a, c)!; expect(cut.clips).toHaveLength(2);
    const [one, two] = cut.song.tracks[0]!.clips.slice().sort((x, y) => x.start - y.start) as [SynthClip2, SynthClip2];
    expect(one.notes).toEqual([{ note: 60, start: 0, length: 4, velocity: 100 }, { note: 62, start: 14, length: 2, velocity: 90 }]);
    expect(two.notes).toEqual([{ note: 65, start: 4, length: 2, velocity: 70 }]); expect(two.start).toBe(1);
    expect(splitClip(s, a, c)).toBeUndefined();                        // one bar: nothing to split
    const back = joinClips(cut.song, a, cut.clips)!; expect(back.song.tracks[0]!.clips).toHaveLength(1);
    expect((back.song.tracks[0]!.clips[0] as SynthClip2).notes.map((n) => n.start)).toEqual([0, 14, 20]); expect(back.song.tracks[0]!.clips[0]!.bars).toBe(2);
    const apart = placeClip(cut.song, a, cut.clips[1]!, a, 4)!; expect(joinClips(apart.song, a, cut.clips)).toBeUndefined();   // not next to each other
  });
  it("drum clips split and join too, keeping every hit", () => {
    const { s, d } = base(), made = addClip(s, d, 0)!, pad = (made.song.tracks[2] as DrumTrack2).pads[0]!.id;
    const two = setClipBars(made.song, d, made.clip, 2), hits = (two.tracks[2]!.clips[0] as DrumClip2).hits, row = Array.from({ length: 32 }, (_, i) => (i === 0 || i === 20 ? 2 : 0));
    const filled = { ...two, tracks: two.tracks.map((t) => (t.id === d ? { ...t, clips: [{ ...t.clips[0]!, hits: { ...hits, [pad]: row } }] } : t)) } as typeof two;
    const cut = splitClip(filled, d, made.clip)!, parts = cut.song.tracks[2]!.clips.slice().sort((x, y) => x.start - y.start) as DrumClip2[];
    expect(parts[0]!.hits[pad]![0]).toBe(2); expect(parts[1]!.hits[pad]![4]).toBe(2); expect(parts[0]!.hits[pad]).toHaveLength(16);
    expect((joinClips(cut.song, d, cut.clips)!.song.tracks[2]!.clips[0] as DrumClip2).hits[pad]).toEqual(row);
  });
  it("sets how hard the chosen notes are played", () => {
    const notes = [{ note: 60, start: 0, length: 1, velocity: 100 }, { note: 62, start: 1, length: 1, velocity: 100 }];
    expect(setVelocity(notes, new Set(["60:0"]), 300).map((n) => n.velocity)).toEqual([127, 100]);
    expect(setVelocity(notes, new Set(["62:1"]), 0)[1]!.velocity).toBe(1);
  });
});
type SynthClip2 = import("../src/daw/song").SynthClip; type DrumClip2 = import("../src/daw/song").DrumClip; type DrumTrack2 = import("../src/daw/song").DrumTrack;

describe("return tracks and sends", () => {
  it("adds A with a reverb and B with a delay, each giving only the effect, and no third", () => {
    const a = addReturn(newSong()), b = addReturn(a), c = addReturn(b);
    expect(a.returns.map((r) => r.id)).toEqual(["ra"]); expect(b.returns.map((r) => r.id)).toEqual(["ra", "rb"]); expect(c).toBe(b);
    expect(b.returns[0]!.devices[0]!.kind).toBe("reverb"); expect(b.returns[1]!.devices[0]!.kind).toBe("delay");
    expect(b.returns.every((r) => r.devices[0]!.p.mix === 100)).toBe(true);
  });
  it("sets a send, keeps it within range, and forgets it when its return goes", () => {
    let s = setSend(addReturn(newSong()), "t1", "ra", 140);
    expect(s.tracks[0]!.sends).toEqual({ ra: 100 });
    s = removeReturn(s, "ra");
    expect(s.returns).toEqual([]); expect(s.tracks[0]!.sends).toEqual({});
  });
  it("a send of 100 passes the track whole and 50 a quarter of it", () => { expect(sendGain(100)).toBe(1); expect(sendGain(50)).toBeCloseTo(0.25); expect(sendGain(0)).toBe(0); });
  it("comes back from storage with its returns and sends, and drops sends to returns that are not there", () => {
    const s = setReturn(setSend(addReturn(newSong()), "t2", "ra", 40), "ra", { level: 60 }), back = tidySong(JSON.parse(JSON.stringify(s)))!;
    expect(back.returns[0]).toMatchObject({ id: "ra", level: 60 }); expect(back.tracks[1]!.sends).toEqual({ ra: 40 });
    const odd = tidySong({ ...JSON.parse(JSON.stringify(newSong())), tracks: [{ ...JSON.parse(JSON.stringify(newSong().tracks[0])), sends: { rb: 50, zz: 9 } }] })!;
    expect(odd.returns).toEqual([]); expect(odd.tracks[0]!.sends).toBeUndefined();
  });
});

describe("note tools, chance, doubling and key", () => {
  const n = (note: number, start: number, length = 1) => ({ note, start, length, velocity: 100 });
  const tune = [n(60, 0, 2), n(64, 2), n(67, 4, 4)];
  const sorted = (xs: { note: number; start: number; length: number }[]) => xs.map((x) => [x.note, x.start, x.length]).sort((a, b) => a[1]! - b[1]!);
  it("reverses in time and inverts in pitch, and doing either twice gives the notes back", () => {
    expect(sorted(reverseNotes(tune, new Set()).notes)).toEqual([[67, 0, 4], [64, 5, 1], [60, 6, 2]]);
    expect(sorted(invertNotes(tune, new Set()).notes)).toEqual([[67, 0, 2], [63, 2, 1], [60, 4, 4]]);
    expect(sorted(reverseNotes(reverseNotes(tune, new Set()).notes, new Set()).notes)).toEqual(sorted(tune));
    expect(sorted(invertNotes(invertNotes(tune, new Set()).notes, new Set()).notes)).toEqual(sorted(tune));
  });
  it("only touches the chosen notes when some are chosen", () => {
    const r = invertNotes(tune, new Set([keyOf(tune[1]!), keyOf(tune[2]!)]));
    expect(sorted(r.notes)).toEqual([[60, 0, 2], [67, 2, 1], [64, 4, 4]]); expect(r.keys.size).toBe(2);
  });
  it("plays twice as fast or half as fast, dropping what no longer fits", () => {
    expect(sorted(scaleTime(tune, new Set(), 0.5, 16).notes)).toEqual([[60, 0, 1], [64, 1, 0.5], [67, 2, 2]]);
    expect(sorted(scaleTime(tune, new Set(), 2, 16).notes)).toEqual([[60, 0, 4], [64, 4, 2], [67, 8, 8]]);
    expect(sorted(scaleTime(tune, new Set(), 2, 8).notes)).toEqual([[60, 0, 4], [64, 4, 2]]);
  });
  it("legato fills the gaps", () => { expect(sorted(legatoNotes([n(60, 0), n(62, 4), n(64, 10)], new Set(), 16).notes)).toEqual([[60, 0, 4], [62, 4, 6], [64, 10, 6]]); });
  it("a note with a chance plays only when the dice allow, and one without always plays", () => {
    let s = newSong(); s = addClip(s, "t2", 0)!.song; const c = s.tracks[1]!.clips[0]!;
    s = setNotes(s, "t2", c.id, setChance([n(60, 0), n(62, 0)], new Set(["60:0"]), 30));
    expect((s.tracks[1]!.clips[0] as SynthClip).notes.find((x) => x.note === 60)!.chance).toBe(30);
    const played = (roll: number) => songEvents(s, 0, 1, undefined, () => roll).filter((e) => e.kind === "note").map((e) => (e as { note: number }).note).sort();
    expect(played(0.1)).toEqual([60, 62]); expect(played(0.9)).toEqual([62]);
    expect(setChance([{ ...n(60, 0), chance: 30 }], new Set(["60:0"]), 100)[0]).not.toHaveProperty("chance");
    expect((tidySong(JSON.parse(JSON.stringify(s)))!.tracks[1]!.clips[0] as SynthClip).notes.find((x) => x.note === 60)!.chance).toBe(30);
  });
  it("doubles a clip with its contents, when there is room and the length is allowed", () => {
    let s = newSong(); s = addClip(s, "t2", 0)!.song; const id = s.tracks[1]!.clips[0]!.id; s = setNotes(s, "t2", id, [n(60, 3)]);
    const d = doubleClip(s, "t2", id), c = d.tracks[1]!.clips[0] as SynthClip;
    expect(c.bars).toBe(2); expect(sorted(c.notes)).toEqual([[60, 3, 1], [60, 19, 1]]);
    const blocked = addClip(s, "t2", 1)!.song; expect(doubleClip(blocked, "t2", id)).toBe(blocked);
    let dr = newSong(); dr = addClip(dr, "t1", 0)!.song; const did = dr.tracks[0]!.clips[0]!.id, dd = doubleClip(dr, "t1", did).tracks[0]!.clips[0] as DrumClip;
    expect(dd.bars).toBe(2); expect(Object.values(dd.hits).every((row) => row.length === 32)).toBe(true);
    expect(doubleClip(doubleClip(dr, "t1", did), "t1", did).tracks[0]!.clips[0]!.bars).toBe(4);
    expect(doubleClip(doubleClip(doubleClip(dr, "t1", did), "t1", did), "t1", did).tracks[0]!.clips[0]!.bars).toBe(4);
  });
  it("knows which notes belong to a key, and keeps the song's key and master effects", () => {
    expect([60, 62, 63, 65].map((x) => inKey(x, 0, [0, 2, 4, 5, 7, 9, 11]))).toEqual([true, true, false, true]);
    expect(inKey(57, 9, [0, 3, 7])).toBe(true);
    const s = tidySong(JSON.parse(JSON.stringify({ ...newSong(), scale: { root: 9, name: "Minor" }, masterFx: [{ id: "d1", kind: "limiter", on: true, p: {} }] })))!;
    expect(s.scale).toEqual({ root: 9, name: "Minor" }); expect(s.masterFx?.[0]?.kind).toBe("limiter");
    expect(tidySong(JSON.parse(JSON.stringify({ ...newSong(), scale: { root: 40, name: "x" } })))!.scale).toBeUndefined();
  });
});

describe("markers", () => {
  it("names a bar, renames it, removes it with an empty name, and survives storage", () => {
    let s = setMarker(setMarker(newSong(), 4, "Drop"), 0, " Intro ");
    expect(s.markers).toEqual([{ bar: 0, name: "Intro" }, { bar: 4, name: "Drop" }]);
    s = setMarker(s, 4, "Break"); expect(s.markers![1]).toEqual({ bar: 4, name: "Break" });
    expect(tidySong(JSON.parse(JSON.stringify(s)))!.markers).toEqual(s.markers);
    s = setMarker(setMarker(s, 4, ""), 0, ""); expect(s.markers).toBeUndefined();
    expect(setMarker(newSong(), 99, "x").markers).toBeUndefined();
  });
});

describe("a finer grid", () => {
  const n = (note: number, start: number, length = 1) => ({ note, start, length, velocity: 100 });
  it("keeps thirty-seconds and triplets exactly, through storage too", () => {
    let s = newSong(); s = addClip(s, "t2", 0)!.song; const id = s.tracks[1]!.clips[0]!.id;
    s = setNotes(s, "t2", id, [n(60, 0.5, 0.5), n(62, 2 / 3, 2 / 3), n(64, 4 / 3, 1 / 3), n(65, 3.26, 0.01)]);
    const got = (tidySong(JSON.parse(JSON.stringify(s)))!.tracks[1]!.clips[0] as SynthClip).notes.map((x) => [x.note, x.start, x.length]);
    expect(got).toEqual([[60, 0.5, 0.5], [62, snapStep(2 / 3), snapStep(2 / 3)], [64, snapStep(4 / 3), snapStep(1 / 3)], [65, 3.25, 0.25]]);
    expect(GRIDS.every((g) => snapStep(g.steps) === g.steps || Math.abs(snapStep(g.steps) - g.steps) < 1e-12)).toBe(true);
  });
  it("plays an off-grid note at its own moment", () => {
    let s = newSong(); s = addClip(s, "t2", 0)!.song; s = setNotes(s, "t2", s.tracks[1]!.clips[0]!.id, [n(60, 2.5, 0.5)]);
    const ev = songEvents(s, 0, 16).filter((e) => e.kind === "note");
    expect(ev).toHaveLength(1); expect(ev[0]!.at).toBeCloseTo(2.5 * (60 / s.bpm / 4), 6);
  });
  it("quantizes to a grid, all the way or part of the way, and keeps the rest", () => {
    const loose = [n(60, 0.25), n(62, 3.75), n(64, 9)];
    const full = quantizeNotes(loose, new Set(), 1, 16).notes.map((x) => x.start).sort((a, b) => a - b);
    expect(full).toEqual([0, 4, 9]);
    expect(quantizeNotes(loose, new Set(), 1, 16, 50).notes.map((x) => x.start).sort((a, b) => a - b)).toEqual([0.125, 3.875, 9]);
    expect(quantizeNotes(loose, new Set(["62:3.75"]), 4, 16).notes.map((x) => x.start).sort((a, b) => a - b)).toEqual([0.25, 4, 9]);
    expect(quantizeNotes([n(60, 15.9)], new Set(), 4, 16).notes[0]!.start).toBe(12);   // never onto the clip's end
  });
});

describe("slicing a sound onto pads", () => {
  it("makes a drum track with one pad a slice and a clip that plays them in order", () => {
    const made = sliceToTrack(newSong(), "habc", "Amen", 8)!, t = made.song.tracks[2] as DrumTrack, c = t.clips[0] as DrumClip;
    expect(t.pads).toHaveLength(8); expect(t.pads.every((p) => p.sample === "habc")).toBe(true);
    expect(t.pads.map((p) => p.start)).toEqual([0, 12.5, 25, 37.5, 50, 62.5, 75, 87.5]);
    // a pad's length is a share of what is left after its start: each slice comes out an eighth of the file
    for (const p of t.pads) expect(((100 - p.start) * p.length) / 100).toBeCloseTo(12.5, 1);
    expect(t.pads.map((p) => c.hits[p.id]!.indexOf(2))).toEqual([0, 2, 4, 6, 8, 10, 12, 14]);
    const back = tidySong(JSON.parse(JSON.stringify(made.song)))!.tracks[2] as DrumTrack;
    expect(back.pads.map((p) => [p.start, p.length])).toEqual(t.pads.map((p) => [p.start, p.length]));
  });
  it("refuses an odd count or a full song", () => {
    expect(sliceToTrack(newSong(), "habc", "x", 5)).toBeUndefined();
    let s = newSong(); while (s.tracks.length < MAX_TRACKS) s = addTrack(s, "drums");
    expect(sliceToTrack(s, "habc", "x", 4)).toBeUndefined();
  });
});

import { splitClip as split2, placeClip as place2, setClipBars as bars2, addClip as add2, addTrack as addT2, newSong as new2, songEvents as events2, putNote as put2, okBars, placeName, tidySong as tidy2 } from "../src/daw/song";
describe("clips on beats", () => {
  const base = () => { let s = new2(); s = addT2(s, "synth"); const t = s.tracks.at(-1)!; const made = add2(s, t.id, 2)!; return { s: made.song, t: t.id, c: made.clip }; };
  it("a clip can be a number of beats long and start on any beat", () => {
    expect(okBars("synth", 1.5)).toBe(true); expect(okBars("synth", 0.1)).toBe(false); expect(okBars("drums", 4.25)).toBe(false);
    expect(placeName(2)).toBe("bar 3"); expect(placeName(2.5)).toBe("bar 3, beat 3");
    let { s, t, c } = base();
    s = bars2(s, t, c, 1.5); const moved = place2(s, t, c, t, 2.75)!; s = moved.song;
    const clip = s.tracks.find((x) => x.id === t)!.clips[0]!; expect([clip.start, clip.bars]).toEqual([2.75, 1.5]);
    s = put2(s, t, c, { note: 60, start: 0, length: 2, velocity: 100 });
    const at = events2(s, 0, 16 * 8).filter((e) => e.track === t).map((e) => e.step); expect(at).toEqual([44]);    // bar 3, beat 4
    expect(tidy2(JSON.parse(JSON.stringify(s)))!.tracks.find((x) => x.id === t)!.clips[0]).toMatchObject({ start: 2.75, bars: 1.5 });
  });
  it("a clip is cut in two at a beat, and a note across the cut is cut off", () => {
    let { s, t, c } = base();
    s = bars2(s, t, c, 2); s = put2(s, t, c, { note: 60, start: 4, length: 8, velocity: 100 }); s = put2(s, t, c, { note: 64, start: 20, length: 2, velocity: 100 });
    expect(split2(s, t, c, 2)).toBeUndefined(); expect(split2(s, t, c, 4)).toBeUndefined();          // not inside the clip
    const made = split2(s, t, c, 2.5)!, clips = made.song.tracks.find((x) => x.id === t)!.clips.slice().sort((a, b) => a.start - b.start) as { start: number; bars: number; notes: { note: number; start: number; length: number }[] }[];
    expect(clips.map((x) => [x.start, x.bars])).toEqual([[2, 0.5], [2.5, 1.5]]);
    expect(clips[0]!.notes).toMatchObject([{ note: 60, start: 4, length: 4 }]); expect(clips[1]!.notes).toMatchObject([{ note: 64, start: 12, length: 2 }]);
    expect(split2(s, t, c)!.clips.length).toBe(2);                                                    // with no place given: at the bar lines
  });
  it("a new clip in a gap shorter than a bar fills the gap", () => {
    let { s, t, c } = base(); s = place2(s, t, c, t, 2.5)!.song;
    const made = add2(s, t, 2)!; expect(made.song.tracks.find((x) => x.id === t)!.clips.find((x) => x.id === made.clip)).toMatchObject({ start: 2, bars: 0.5 });
  });
});

import { markerFrom, randomVelocity } from "../src/daw/song";
describe("random loudness, and finding the next marker", () => {
  const notes = [{ note: 60, start: 0, length: 4, velocity: 100 }, { note: 62, start: 4, length: 4, velocity: 100 }, { note: 64, start: 8, length: 4, velocity: 120 }];
  it("moves each chosen note by up to the amount either way, as the dice fall, and stays between 1 and 127", () => {
    expect(randomVelocity(notes, new Set(), 20, () => 1).notes.map((n) => n.velocity)).toEqual([120, 120, 127]);
    expect(randomVelocity(notes, new Set(), 20, () => 0).notes.map((n) => n.velocity)).toEqual([80, 80, 100]);
    expect(randomVelocity(notes, new Set(), 20, () => 0.5).notes).toEqual(notes);                // the middle of the dice leaves a note alone
    expect(randomVelocity(notes, new Set(), 500, () => 0).notes.every((n) => n.velocity === 1)).toBe(true);
  });
  it("with notes selected, only they change, and they stay selected", () => {
    const r = randomVelocity(notes, new Set([keyOf(notes[1]!)]), 20, () => 1);
    expect(r.notes.map((n) => n.velocity)).toEqual([100, 120, 120]); expect(r.notes[0]).toBe(notes[0]); expect([...r.keys]).toEqual([keyOf(notes[1]!)]);
  });
  it("finds the marker after a place and the one before it, and nothing past the last or before the first", () => {
    const s = setMarker(setMarker(setMarker(newSong(), 2, "verse"), 6, "drop"), 0, "intro");
    expect(markerFrom(s, 0, 1)).toBe(2); expect(markerFrom(s, 2.5, 1)).toBe(6); expect(markerFrom(s, 6, 1)).toBeUndefined();
    expect(markerFrom(s, 6, -1)).toBe(2); expect(markerFrom(s, 2.25, -1)).toBe(2); expect(markerFrom(s, 0, -1)).toBeUndefined();
    expect(markerFrom(newSong(), 3, 1)).toBeUndefined();
  });
});

describe("faders, song lengths and the readout of the mix", () => {
  it("a fader is unchanged up to 80 and reaches +6 dB at the top", async () => {
    const { faderDb, faderGain, faderText } = await import("../src/daw/song");
    expect(faderGain(80)).toBeCloseTo(1, 9); expect(faderGain(40)).toBeCloseTo(0.5, 9); expect(faderGain(0)).toBe(0);
    expect(faderDb(100)).toBeCloseTo(6, 9); expect(faderDb(90)).toBeCloseTo(3, 9); expect(faderGain(100)).toBeCloseTo(1.995, 2);
    expect(faderText(80)).toBe("0.0 dB"); expect(faderText(100)).toBe("+6.0 dB"); expect(faderText(40)).toBe("-6.0 dB"); expect(faderText(0)).toBe("silent");
    for (let v = 1; v <= 100; v++) expect(faderGain(v)).toBeGreaterThan(faderGain(v - 1));
  });
  it("a song with a length the Studio does not offer takes the next length up and keeps its clips", async () => {
    const { tidySong, newSong } = await import("../src/daw/song");
    const base = newSong(), synth = base.tracks[1]!;
    const song = { ...base, bars: 12, tracks: [base.tracks[0]!, { ...synth, clips: [{ id: "c1", start: 10, bars: 2, notes: [{ note: 60, start: 0, length: 4, velocity: 100 }] }] }] };
    const tidy = tidySong(JSON.parse(JSON.stringify(song)))!;
    expect(tidy.bars).toBe(16); expect(tidy.tracks[1]!.clips).toHaveLength(1);
    expect(tidySong({ ...base, bars: 64 })!.bars).toBe(32); expect(tidySong({ ...base, bars: 3 })!.bars).toBe(4); expect(tidySong({ ...base, bars: "x" })!.bars).toBe(8);
  });
  it("the mix readout: mono reads no width, opposite sides read as fighting, a sine reads its average", async () => {
    const { stereoOf } = await import("../src/daw/transport");
    const n = 2048, sine = Float32Array.from({ length: n }, (_, i) => Math.sin((2 * Math.PI * 8 * i) / n)), other = Float32Array.from({ length: n }, (_, i) => Math.sin((2 * Math.PI * 13 * i) / n));
    const mono = stereoOf(sine, sine); expect(mono.average).toBeCloseTo(-3.01, 1); expect(mono.width).toBeLessThan(-100); expect(mono.alike).toBeCloseTo(1, 6);
    const flipped = stereoOf(sine, sine.map((v) => -v)); expect(flipped.alike).toBeCloseTo(-1, 6); expect(flipped.width).toBeGreaterThan(60);
    const wide = stereoOf(sine, other); expect(Math.abs(wide.alike)).toBeLessThan(0.01); expect(wide.width).toBeCloseTo(0, 1);
  });
  it("a track's sends can be automated, and the new scales are there", async () => {
    const { targetsOf, automateTrack } = await import("../src/daw/automation");
    const { newSong } = await import("../src/daw/song"); const { SCALES } = await import("../src/daw/notefx");
    const t = newSong().tracks[1]!;
    expect(targetsOf(t).map((x) => x.id)).toEqual(expect.arrayContaining(["send:ra", "send:rb"]));
    expect(targetsOf({ devices: [], master: true }).some((x) => x.id.startsWith("send:"))).toBe(false);
    const moved = automateTrack({ ...t, auto: [{ target: "send:rb", points: [{ at: 0, v: 0 }, { at: 16, v: 1 }] }] }, 8);
    expect(moved.sends?.rb).toBe(50);
    expect(SCALES.slice(0, 8).map((s) => s.name)).toEqual(["Major", "Minor", "Dorian", "Mixolydian", "Harmonic minor", "Major pentatonic", "Minor pentatonic", "Blues"]);
    expect(SCALES.find((s) => s.name === "Phrygian")?.steps).toEqual([0, 1, 3, 5, 7, 8, 10]);
  });
});

describe("as in Ableton: notes switched off, and solo on its own", () => {
  it("a note switched off is kept but not played, and comes back", () => {
    const d = demo(), clip = () => clipOf(trackOf(d.song, d.synth), d.chord) as SynthClip;
    const off = toggleNotesOff(clip().notes, new Set(["60:0"]));
    expect(off.find((n) => n.note === 60)!.off).toBe(true);
    expect(off.filter((n) => n.off)).toHaveLength(1);
    d.song = setNotes(d.song, d.synth, d.chord, off);
    expect(clip().notes).toHaveLength(3);
    const heard = songEvents(d.song, 0, 1).filter((e) => e.kind === "note").map((e) => (e as { note: number }).note).sort();
    expect(heard).toEqual([57, 64]);
    const on = toggleNotesOff(clip().notes, new Set(["60:0"]));
    expect(on.some((n) => n.off)).toBe(false);
    // a mixed selection is all switched off first
    expect(toggleNotesOff(off, new Set(["60:0", "57:0"])).filter((n) => n.off)).toHaveLength(2);
  });
  it("a plain solo takes the other solos away; soloing the soloed track clears it", () => {
    const s = newSong(), [a, b] = s.tracks.map((t) => t.id) as [string, string];
    const one = soloOnly(setTrack(s, a, { solo: true }), b);
    expect(one.tracks.map((t) => !!t.solo)).toEqual([false, true]);
    expect(soloOnly(one, b).tracks.some((t) => t.solo)).toBe(false);
  });
  it("every MIDI note can be written", () => {
    const d = demo();
    const s = putNote(putNote(d.song, d.synth, d.chord, { note: 0, start: 4, length: 1, velocity: 90 }), d.synth, d.chord, { note: 127, start: 5, length: 1, velocity: 90 });
    const notes = (clipOf(trackOf(s, d.synth), d.chord) as SynthClip).notes.map((n) => n.note);
    expect(notes).toContain(0); expect(notes).toContain(127);
  });
});

describe("audio tracks: sound files on the timeline", () => {
  const file = { id: "habc", name: "loop.wav", seconds: 4 };
  const withAudio = () => { const s = addTrack({ ...newSong(), bpm: 120 }, "audio"), id = s.tracks.at(-1)!.id; return { s, id }; };
  it("a file becomes a clip as long as it lasts at the tempo, on the beat, cut short by what is in the way", () => {
    const { s, id } = withAudio();
    const a = addAudioClip(s, id, file, 0)!;                       // 4 s at 120 bpm is 2 bars
    const c = clipOf(trackOf(a.song, id), a.clip) as AudioClip;
    expect([c.start, c.bars, c.offset, c.gain, c.tune]).toEqual([0, 2, 0, 0, 0]);
    const b = addAudioClip(a.song, id, { ...file, seconds: 0.6 }, 0)!;   // bar 1 is taken: the next free place; 0.6 s is 1.2 beats, so 2 beats
    const d = clipOf(trackOf(b.song, id), b.clip) as AudioClip;
    expect([d.start, d.bars]).toEqual([2, 0.5]);
    expect(addAudioClip(s, s.tracks[0]!.id, file, 0)).toBeUndefined();   // not on a drum track
    expect(addClip(s, id, 0)).toBeUndefined();                           // and no empty clip on an audio track
  });
  it("speed: tune moves it, warp sets it from the tempo", () => {
    expect(audioRate({ seconds: 4, tune: 0 }, 120)).toBe(1);
    expect(audioRate({ seconds: 4, tune: 12 }, 120)).toBeCloseTo(2);
    expect(audioRate({ seconds: 4, tune: 0, beats: 8 }, 120)).toBeCloseTo(1);     // 8 beats at 120 is 4 s: as recorded
    expect(audioRate({ seconds: 4, tune: 0, beats: 8 }, 60)).toBeCloseTo(0.5);    // half the tempo: half the speed
    expect(audioBars({ seconds: 4, tune: 0, beats: 8, offset: 0 }, 60)).toBeCloseTo(2);
  });
  it("plays from the clip's start, joins part-way where playing begins, and stops at the clip's end", () => {
    const { s, id } = withAudio(), a = addAudioClip(s, id, file, 1)!;
    const all = songEvents(a.song, 0, 64).filter((e) => e.kind === "audio");
    expect(all).toHaveLength(1);
    const e = all[0] as Extract<SongEvent, { kind: "audio" }>;
    expect([e.step, e.offset, e.rate, e.gain]).toEqual([16, 0, 1, 1]);
    expect(e.seconds).toBeCloseTo(4);
    // starting a bar into the clip: joined 2 s into the file, with 2 s left
    expect(songEvents(a.song, 32, 33).filter((x) => x.kind === "audio")).toHaveLength(0);
    const mid = songEvents(a.song, 32, 33, undefined, undefined, true).find((x) => x.kind === "audio") as Extract<SongEvent, { kind: "audio" }>;
    expect(mid.offset).toBeCloseTo(2); expect(mid.seconds).toBeCloseTo(2);
    // a loop over the clip's second bar joins it every time round, and ends with the loop
    const looped = songEvents(a.song, 0, 32, { start: 2, bars: 1 }).filter((x) => x.kind === "audio") as Extract<SongEvent, { kind: "audio" }>[];
    expect(looped).toHaveLength(2); expect(looped[0]!.offset).toBeCloseTo(2); expect(looped[0]!.seconds).toBeCloseTo(2);
    // a clip shorter than the file is cut at its end; gain and tune are carried
    let short = setClipBars(a.song, id, a.clip, 1); short = setAudioClip(short, id, a.clip, { gain: -6, tune: 12 });
    const cut = songEvents(short, 16, 17)[0] as Extract<SongEvent, { kind: "audio" }>;
    expect(cut.seconds).toBeCloseTo(2); expect(cut.rate).toBeCloseTo(2); expect(cut.gain).toBeCloseTo(0.501, 2);
  });
  it("a split clip's second half starts further into the file; the song survives tidying; MIDI leaves audio out", () => {
    const { s, id } = withAudio(), a = addAudioClip(s, id, file, 0)!;
    const cut = splitClip(a.song, id, a.clip, 1)!;
    const [x, y] = cut.clips.map((c) => clipOf(trackOf(cut.song, id), c) as AudioClip);
    expect([x!.bars, x!.offset, y!.start, y!.bars]).toEqual([1, 0, 1, 1]); expect(y!.offset).toBeCloseTo(2);
    const back = tidySong(JSON.parse(JSON.stringify(cut.song)))!;
    expect(back.tracks.at(-1)!.kind).toBe("audio"); expect(back.tracks.at(-1)!.clips).toHaveLength(2);
    expect(samplesUsed(back)).toContain("habc");
    expect(tidySong({ ...JSON.parse(JSON.stringify(cut.song)), tracks: [{ kind: "audio", name: "x", clips: [{ start: 0, bars: 1, sample: "../bad", seconds: 3 }] }] })!.tracks[0]!.clips).toHaveLength(0);
  });
});
