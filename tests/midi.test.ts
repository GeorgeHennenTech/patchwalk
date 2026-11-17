import { describe, expect, it } from "vitest";
import { DRUM_BASE, PPQ, hitOf, hitsToMidi, midiBars, midiToHits, midiToNotes, notesToMidi, readMidi, songToMidi, writeMidi } from "../src/daw/midi";
import { STARTERS, type Hit } from "../src/daw/drums";
import { addClip, moveClip, newSong, putNote, withPattern } from "../src/daw/song";
import { rackOnto, tidyBreak, tidyRack, withNamed } from "../src/daw/store";
import { defaultPads } from "../src/daw/drums";

describe("MIDI files", () => {
  it("starts with the standard header and says the tempo", () => {
    const bytes = writeMidi({ ppq: PPQ, bpm: 120, tracks: [{ name: "Drums", notes: [{ note: 36, start: 0, length: 60, velocity: 127 }] }] });
    expect(String.fromCharCode(...bytes.subarray(0, 4))).toBe("MThd");
    expect([...bytes.subarray(8, 14)]).toEqual([0, 1, 0, 2, 1, 224]); // format 1, two tracks, 480 ticks a beat
    expect(readMidi(bytes)).toMatchObject({ ppq: 480, bpm: 120, tracks: [{ name: "Drums", notes: [{ note: 36, start: 0, length: 60, velocity: 127 }] }] });
  });
  it("a break goes out and comes back the same, pads from C1 upward", () => {
    const rows = STARTERS[0]!.lanes.map((l) => l.steps);
    const notes = hitsToMidi(rows);
    expect(notes.filter((n) => n.note === DRUM_BASE).map((n) => n.start)).toEqual([0, 480, 960, 1440]); // kick on every beat
    const back = readMidi(writeMidi({ ppq: PPQ, bpm: 124, tracks: [{ notes, channel: 9 }] }))!;
    expect(back.tracks[0]!.channel).toBe(9);
    expect(midiToHits(back.tracks[0]!.notes, back.ppq, 8, 16)).toEqual({ rows, left: 0 });
  });
  it("notes go out and come back the same, long gaps and chords included", () => {
    const notes = [{ note: 57, start: 0, length: 32, velocity: 90 }, { note: 60, start: 0, length: 32, velocity: 90 }, { note: 72, start: 61, length: 3, velocity: 40 }];
    const back = readMidi(writeMidi({ ppq: PPQ, tracks: [{ notes: notesToMidi(notes) }] }))!;
    expect(midiToNotes(back.tracks[0]!.notes, back.ppq, 64)).toEqual({ notes, left: 0 });
    expect(midiBars(back.tracks[0]!.notes, back.ppq)).toBe(4);
  });
  it("reads a file made elsewhere: another tick rate, running status, note-on at zero loudness as note-off", () => {
    const body = [0, 0x90, 36, 100, 48, 36, 0, 48, 38, 30, 24, 38, 0, 0, 0xff, 0x2f, 0];
    const bytes = Uint8Array.from([0x4d, 0x54, 0x68, 0x64, 0, 0, 0, 6, 0, 0, 0, 1, 0, 96, 0x4d, 0x54, 0x72, 0x6b, 0, 0, 0, body.length, ...body]);
    const file = readMidi(bytes)!;
    expect(file.ppq).toBe(96);
    expect(file.tracks[0]!.notes).toEqual([{ note: 36, start: 0, length: 48, velocity: 100 }, { note: 38, start: 96, length: 24, velocity: 30 }]);
    const { rows, left } = midiToHits(file.tracks[0]!.notes, file.ppq, 3, 16);
    expect(rows[0]![0]).toBe(2); expect(rows[2]![4]).toBe(1); expect(left).toBe(0);
  });
  it("leaves out what does not fit and says how much", () => {
    expect(midiToHits([{ note: 30, start: 0, length: 1, velocity: 100 }, { note: 60, start: 0, length: 1, velocity: 100 }, { note: 36, start: 480 * 9, length: 1, velocity: 100 }], 480, 8, 16).left).toBe(3);
    expect(readMidi(Uint8Array.from([1, 2, 3]))).toBeUndefined();
    expect([hitOf(0), hitOf(50), hitOf(96), hitOf(127)]).toEqual([0, 1, 2, 3] as Hit[]);
  });
  it("a whole song is a track per track with clips at their bars", () => {
    let song = newSong();
    const d = song.tracks[0]!.id, s = song.tracks[1]!.id;
    const a = addClip(song, d, 0)!; song = moveClip(withPattern(a.song, d, a.clip, STARTERS[0]!), d, a.clip, 2);
    const b = addClip(song, s, 1)!; song = putNote(b.song, s, b.clip, { note: 60, start: 4, length: 4, velocity: 100 });
    const file = readMidi(songToMidi(song))!;
    expect(file.tracks.map((t) => t.name)).toEqual(["Drums", "Soft pad"]);
    expect(file.tracks[0]!.notes[0]!.start).toBe(2 * 16 * 120);
    expect(file.tracks[1]!.notes).toEqual([{ note: 60, start: (16 + 4) * 120, length: 480, velocity: 100 }]);
  });
});

describe("saved breaks and racks", () => {
  it("are made safe, and the same name replaces", () => {
    expect(tidyBreak({ rows: [] })).toBeUndefined();
    const b = tidyBreak({ name: " Amen-ish ", bars: 2, bpm: 999, rows: [[3, 0, 9]], pads: ["Kick"] })!;
    expect(b).toMatchObject({ name: "Amen-ish", bars: 2, bpm: 200, pads: ["Kick"] });
    expect(b.rows[0]).toHaveLength(32);
    expect(tidyRack({ pads: [{ voice: "nope" }] })).toBeUndefined();
    expect(withNamed(withNamed([{ name: "a", n: 1 }], { name: "b", n: 2 }), { name: "a", n: 3 })).toEqual([{ name: "a", n: 3 }, { name: "b", n: 2 }]);
  });
  it("a rack put on a track keeps the track's pad ids in order, so its clips keep their rows", () => {
    const now = defaultPads().slice(0, 2), rack = tidyRack({ name: "r", pads: [{ voice: "clap", id: "x" }, { voice: "rim", id: "y" }, { voice: "kick", id: "z" }] })!;
    const pads = rackOnto(now, rack);
    expect(pads.map((p) => p.voice)).toEqual(["clap", "rim", "kick"]);
    expect(pads.slice(0, 2).map((p) => p.id)).toEqual(["kick", "snare"]);
    expect(new Set(pads.map((p) => p.id)).size).toBe(3);
  });
});
