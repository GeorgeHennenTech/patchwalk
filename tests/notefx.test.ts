import { describe, expect, it } from "vitest";
import { ARP_RATES, NOTE_FX, SCALES, applyNoteFx, arpeggiate, dice, toScale, type FxNote } from "../src/daw/notefx";
import { DEVICES, addDevice, newDevice, setDeviceParam, tidyDevices, toggleDevice, type Device } from "../src/daw/devices";
import { addClip, addTrack, newSong, playedNotes, setNoteFx, setNotes, songEvents, tidySong, type SynthClip, type SynthTrack } from "../src/daw/song";

const fx = (kind: string, p: Record<string, number> = {}): Device => { const d = newDevice(kind)!; return { ...d, p: { ...d.p, ...p } }; };
const n = (note: number, start: number, length = 1, velocity = 100): FxNote => ({ note, start, length, velocity });
const chord = [n(60, 0, 8), n(64, 0, 8), n(67, 0, 8)];

describe("note effects", () => {
  it("are a separate family from the sound effects, each with its Ableton counterpart", () => {
    expect(NOTE_FX.map((d) => d.name)).toEqual(["Arpeggiator", "Chord", "Note length", "Pitch", "Random", "Scale", "Note echo", "Velocity"]);
    for (const d of NOTE_FX) { expect(d.midi).toBe(true); expect(d.kind.startsWith("n-")).toBe(true); expect(DEVICES.some((x) => x.kind === d.kind)).toBe(false); expect(newDevice(d.kind)).toBeTruthy(); }
    const mixed = [{ kind: "n-pitch" }, { kind: "utility" }, { kind: "n-arp" }];
    expect(tidyDevices(mixed).map((d) => d.kind)).toEqual(["utility"]);                     // a sound chain never holds a note effect
    expect(tidyDevices(mixed, "note").map((d) => d.kind)).toEqual(["n-pitch", "n-arp"]);    // nor the other way round
  });
  it("pitch moves notes; notes pushed off the keyboard are dropped", () => {
    expect(applyNoteFx([fx("n-pitch", { semis: 7 })], [n(60, 0)], 16)).toEqual([n(67, 0)]);
    expect(applyNoteFx([fx("n-pitch", { semis: 48 })], [n(100, 0), n(60, 1)], 16)).toEqual([n(108, 1)]);
  });
  it("scale keeps notes in key: a note outside moves to the nearest inside, down on a tie", () => {
    const major = SCALES[0]!.steps;
    expect([60, 61, 62, 63, 66, 70].map((x) => toScale(x, 0, major))).toEqual([60, 60, 62, 62, 65, 69]);
    expect(toScale(61, 2, major)).toBe(61);                                                 // C# belongs to D major
    for (const s of SCALES) for (let x = 40; x < 80; x++) expect(s.steps).toContain((((toScale(x, 3, s.steps) - 3) % 12) + 12) % 12);
    expect(applyNoteFx([fx("n-scale", { root: 0, scale: 6 })], [n(61, 0), n(64, 1)], 16).map((x) => x.note)).toEqual([60, 63]);   // C minor pentatonic
  });
  it("chord adds notes at its shifts and leaves a shift of 0 out", () => {
    expect(applyNoteFx([fx("n-chord", { shift1: 3, shift2: 7, shift3: 0, shift4: -12 })], [n(60, 2, 4, 90)], 16)).toEqual([n(48, 2, 4, 90), n(60, 2, 4, 90), n(63, 2, 4, 90), n(67, 2, 4, 90)]);
  });
  it("note length sets a fixed length or a percentage, never past the end of the clip", () => {
    expect(applyNoteFx([fx("n-length", { mode: 0, steps: 0.5 })], [n(60, 0, 4), n(62, 15.75, 4)], 16).map((x) => x.length)).toEqual([0.5, 0.25]);
    expect(applyNoteFx([fx("n-length", { mode: 1, percent: 50 })], [n(60, 0, 4)], 16)[0]!.length).toBe(2);
  });
  it("velocity squeezes the range; random moves only some notes and is the same every time", () => {
    expect(applyNoteFx([fx("n-velocity", { low: 60, high: 100 })], [n(60, 0, 1, 1), n(60, 1, 1, 127), n(60, 2, 1, 64)], 16).map((x) => x.velocity)).toEqual([60, 100, 80]);
    const many = Array.from({ length: 200 }, (_, i) => n(60, i % 16)), once = applyNoteFx([fx("n-random", { chance: 50, range: 5, way: 0 })], many, 16), again = applyNoteFx([fx("n-random", { chance: 50, range: 5, way: 0 })], many, 16);
    expect(once).toEqual(again);
    const moved = once.filter((x) => x.note !== 60); expect(moved.length).toBeGreaterThan(70); expect(moved.length).toBeLessThan(130);
    for (const x of moved) { expect(x.note).toBeGreaterThan(60); expect(x.note).toBeLessThanOrEqual(65); }
    expect(applyNoteFx([fx("n-random", { chance: 0 })], many, 16).every((x) => x.note === 60)).toBe(true);
    for (let i = 0; i < 50; i++) { expect(dice(i, 3)).toBeGreaterThanOrEqual(0); expect(dice(i, 3)).toBeLessThan(1); }
  });
  it("the arpeggiator plays held notes one at a time: up, down, up and down, over octaves, at its speed and note length", () => {
    const up = arpeggiate(chord, { style: 0, rate: 2, gate: 50, octaves: 1 }, 16);
    expect(up.map((x) => x.note)).toEqual([60, 64, 67, 60, 64, 67, 60, 64]);              // eight sixteenths while the chord is held, then nothing
    expect(up.map((x) => x.start)).toEqual([0, 1, 2, 3, 4, 5, 6, 7]); expect(up[0]!.length).toBe(0.5);
    expect(arpeggiate(chord, { style: 1, rate: 2 }, 16).slice(0, 3).map((x) => x.note)).toEqual([67, 64, 60]);
    expect(arpeggiate(chord, { style: 2, rate: 2 }, 16).slice(0, 5).map((x) => x.note)).toEqual([60, 64, 67, 64, 60]);
    expect(arpeggiate(chord, { style: 0, rate: 2, octaves: 2 }, 16).slice(0, 6).map((x) => x.note)).toEqual([60, 64, 67, 72, 76, 79]);
    expect(arpeggiate(chord, { style: 0, rate: 4 }, 16).map((x) => x.start)).toEqual([0, 2, 4, 6]);               // eighths
    const trip = arpeggiate(chord, { style: 0, rate: 1 }, 16); expect(trip).toHaveLength(12); expect(trip[1]!.start).toBeCloseTo(2 / 3, 9);
    for (const x of arpeggiate(chord, { style: 4, rate: 2 }, 16)) expect([60, 64, 67]).toContain(x.note);
    expect(ARP_RATES.map((r) => r.steps)).toEqual([...ARP_RATES.map((r) => r.steps)].sort((a, b) => a - b));
  });
  it("the arpeggiator starts again when the held notes change, and is silent where nothing is held", () => {
    const two = [n(60, 0, 4), n(64, 0, 4), n(72, 8, 2), n(76, 8, 2)], got = arpeggiate(two, { style: 0, rate: 2 }, 16);
    expect(got.map((x) => [x.start, x.note])).toEqual([[0, 60], [1, 64], [2, 60], [3, 64], [8, 72], [9, 76]]);
  });
  it("a chain runs in order, and a device switched off is passed by", () => {
    const chain = [fx("n-chord", { shift1: 4, shift2: 7, shift3: 0, shift4: 0 }), fx("n-arp", { style: 0, rate: 2 })];
    expect(applyNoteFx(chain, [n(60, 0, 3)], 16).map((x) => x.note)).toEqual([60, 64, 67]);                       // one note becomes a chord, the chord becomes a run
    expect(applyNoteFx(toggleDevice(chain, chain[1]!.id === chain[0]!.id ? "" : "d1"), [n(60, 0, 3)], 16).length).toBeGreaterThan(0);
    const off = [{ ...chain[0]!, on: false }, { ...chain[1]!, id: "d2" }];
    expect(applyNoteFx(off, [n(60, 0, 3)], 16).map((x) => x.note)).toEqual([60, 60, 60]);
  });
});

describe("note effects in a song", () => {
  const make = () => { let s = addTrack({ ...newSong(), tracks: [] }, "synth"); const t = s.tracks[0]!.id; const made = addClip(s, t, 0)!; s = made.song; const c = made.clip; s = setNotes(s, t, c, [{ note: 60, start: 0, length: 4, velocity: 100 }, { note: 64, start: 0, length: 4, velocity: 100 }]); return { s, t }; };
  it("what plays is the clip's notes after the track's note effects, at the right moments, and the clip itself is untouched", () => {
    const { s, t } = make(), plain = songEvents(s, 0, 16);
    expect(plain.map((e) => e.kind === "note" && e.note)).toEqual([60, 64]);
    const arp = setNoteFx(s, t, setDeviceParam(addDevice([], "n-arp"), "d1", "rate", 0)), ev = songEvents(arp, 0, 16), step = 60 / arp.bpm / 4;   // thirty-seconds
    expect(ev.map((e) => e.kind === "note" && e.note)).toEqual([60, 64, 60, 64, 60, 64, 60, 64]);
    ev.forEach((e, i) => expect(e.at).toBeCloseTo(i * 0.5 * step, 9));
    expect((arp.tracks[0] as SynthTrack).clips[0]!.notes).toHaveLength(2);
    const track = arp.tracks[0] as SynthTrack, clip = track.clips[0] as SynthClip;
    expect(playedNotes(track, clip)).toBe(playedNotes(track, clip));                                              // worked out once
  });
  it("is kept with the song, and a song from before note effects gets an empty chain", () => {
    const { s, t } = make(), withFx = setNoteFx(s, t, addDevice(addDevice([], "n-scale"), "n-chord"));
    expect(tidySong(JSON.parse(JSON.stringify(withFx)))).toEqual(withFx);
    const old = JSON.parse(JSON.stringify(s)); delete old.tracks[0].noteFx;
    expect((tidySong(old)!.tracks[0] as SynthTrack).noteFx).toEqual([]);
  });
});

describe("note echo", () => {
  it("repeats each note later, softer and shifted, and stops at the end of the clip", () => {
    const d = { id: "e", kind: "n-echo", on: true, p: { gap: 3, repeats: 3, fade: 50, step: 12 } };
    const out = applyNoteFx([d], [{ note: 60, start: 0, length: 2, velocity: 100 }], 16).sort((a, b) => a.start - b.start);
    expect(out.map((n) => [n.note, n.start, n.velocity])).toEqual([[60, 0, 100], [72, 4, 50], [84, 8, 25], [96, 12, 13]]);
    const short = applyNoteFx([d], [{ note: 60, start: 10, length: 2, velocity: 100 }], 16);
    expect(short.map((n) => n.start).sort((a, b) => a - b)).toEqual([10, 14]);
  });
});
