import { describe, expect, it } from "vitest";
import { drawShape, shapePoints, SHAPES, carryAuto, recordMoves, masterStrip, MAX_LANES, SYNTH_TARGETS, addLane, automate, automateTrack, dropPoint, fromUnit, hasAutomation, movePoint, putPoint, removeLane, retargetLane, targetsOf, tidyAuto, toUnit, valueAt } from "../src/daw/automation";
import { addDevice, setDeviceParam } from "../src/daw/devices";
import { addClip, addReturn, moveClip, placeClip, newSong, setAuto, setDevices, tidySong } from "../src/daw/song";

const pts = [{ at: 16, v: 0 }, { at: 32, v: 1 }, { at: 48, v: 0.5 }];
describe("automation", () => {
  it("a lane moves in straight lines between its points and holds before the first and after the last", () => {
    expect(valueAt([], 5)).toBeUndefined();
    expect([0, 16, 24, 32, 40, 48, 200].map((s) => valueAt(pts, s))).toEqual([0, 0, 0.5, 1, 0.75, 0.5, 0.5]);
    expect(valueAt([{ at: 8, v: 0.3 }], 100)).toBe(0.3);
  });
  it("a track's level, its pan and every slider of its effects can be automated, but not menus or switches", () => {
    const song = setDevices(newSong(), "t1", addDevice(addDevice([], "autofilter"), "utility")), ids = targetsOf(song.tracks[0]!).map((t) => t.id);
    expect(ids.slice(0, 2)).toEqual(["level", "pan"]);
    expect(ids).toContain("d:d1:freq"); expect(ids).toContain("d:d2:gain");
    expect(ids).not.toContain("d:d1:type"); expect(ids).not.toContain("d:d2:mono");
  });
  it("0 to 1 becomes the setting's own value; a frequency moves in ratios", () => {
    const level = { min: 0, max: 100, step: 1 }, freq = { min: 30, max: 18000, step: 1, log: true };
    expect(fromUnit(level, 0.25)).toBe(25); expect(fromUnit(level, 7)).toBe(100);
    expect(fromUnit(freq, 0)).toBe(30); expect(fromUnit(freq, 1)).toBe(18000); expect(fromUnit(freq, 0.5)).toBeCloseTo(Math.sqrt(30 * 18000), -1);
    expect(toUnit(freq, fromUnit(freq, 0.37))).toBeCloseTo(0.37, 2); expect(toUnit(level, 80)).toBe(0.8);
  });
  it("the song at a place along it has its automated settings moved, and nothing else touched", () => {
    let song = setDevices(newSong(), "t1", addDevice([], "autofilter"));
    expect(hasAutomation(song)).toBe(false); expect(automate(song, 20)).toBe(song);
    song = setAuto(song, "t1", [{ target: "level", points: [{ at: 0, v: 0 }, { at: 16, v: 1 }] }, { target: "d:d1:lfo", points: [{ at: 0, v: 1 }] }, { target: "pan", points: [] }]);
    expect(hasAutomation(song)).toBe(true);
    const half = automate(song, 8), t = half.tracks[0]!;
    expect(t.level).toBe(50); expect(t.pan).toBe(song.tracks[0]!.pan); expect(t.devices[0]!.p.lfo).toBe(4); expect(t.devices[0]!.p.freq).toBe(1200);
    expect(half.tracks[1]).toBe(song.tracks[1]);                         // a track with no automation is the very same object
    expect(song.tracks[0]!.level).toBe(80);                               // the knob itself stays where it was left
    expect(automateTrack({ ...song.tracks[0]!, auto: [{ target: "d:gone:x", points: [{ at: 0, v: 1 }] }] }, 3).devices).toBe(song.tracks[0]!.devices);   // a lane whose setting is gone does nothing
  });
  it("points are added in order, moved only as far as their neighbours, and removed", () => {
    const track = { devices: [] }; let lanes = addLane([], track);
    expect(lanes).toEqual([{ target: "level", points: [] }]);
    lanes = putPoint(lanes, 0, { at: 32, v: 0.5 }, 128).lanes; const r = putPoint(lanes, 0, { at: 8.4, v: 2 }, 128); lanes = r.lanes;
    expect(r.index).toBe(0); expect(lanes[0]!.points).toEqual([{ at: 8, v: 1 }, { at: 32, v: 0.5 }]);
    expect(putPoint(lanes, 0, { at: 32, v: 0.1 }, 128).lanes[0]!.points).toHaveLength(2);               // a second point on the same step replaces the first
    lanes = movePoint(lanes, 0, 0, { at: 90, v: 0.2 }, 128); expect(lanes[0]!.points[0]).toEqual({ at: 31, v: 0.2 });
    expect(movePoint(lanes, 0, 0, { at: 31, v: 0.2 }, 128)).toBe(lanes);
    expect(dropPoint(lanes, 0, 1)[0]!.points).toEqual([{ at: 31, v: 0.2 }]);
    lanes = addLane(lanes, track); expect(lanes.map((l) => l.target)).toEqual(["level", "pan"]);
    expect(addLane(lanes, track)).toBe(lanes);                                                          // nothing left to automate on a track with no effects
    expect(retargetLane(lanes, 1, "level")).toBe(lanes);                                                // two lanes cannot move the same setting
    expect(removeLane(lanes, 0).map((l) => l.target)).toEqual(["pan"]);
    let many = [] as typeof lanes; const fx = { devices: setDeviceParam(addDevice([], "eq8"), "d1", "b1gain", 3) }; for (let i = 0; i < 9; i++) many = addLane(many, fx); expect(many).toHaveLength(MAX_LANES);
  });
  it("is kept with the song and made safe", () => {
    const song = setAuto(newSong(), "t1", [{ target: "pan", points: [{ at: 4, v: 0.25 }, { at: 60, v: 1 }] }]);
    expect(tidySong(JSON.parse(JSON.stringify(song)))).toEqual(song);
    expect(tidyAuto([{ target: "level", points: [{ at: 9999, v: 5 }, { at: "x", v: 0 }, { at: 3, v: -1 }, { at: 3, v: 0.5 }] }, { target: "level", points: [] }, { target: "<script>" }, null], 128)).toEqual([{ target: "level", points: [{ at: 3, v: 0 }, { at: 128, v: 1 }] }]);
    const old = JSON.parse(JSON.stringify(newSong())); delete old.tracks[0].auto; expect(tidySong(old)!.tracks[0]!.auto).toEqual([]);
  });
});

describe("automating the synth's own knobs", () => {
  const patch = { cutoff: 2000, resonance: 10, bpm: 120 };
  const track = { level: 80, pan: 0, devices: [], patch, auto: [{ target: "s:cutoff", points: [{ at: 0, v: 0 }, { at: 16, v: 1 }] }] };
  it("offers them on a track that has a synth, and not on one without", () => {
    const ids = targetsOf(track).map((t) => t.id);
    expect(ids).toContain("s:cutoff"); expect(ids).not.toContain("s:bpm"); expect(ids).not.toContain("s:none");
    expect(targetsOf({ devices: [] }).some((t) => t.id.startsWith("s:"))).toBe(false);
    expect(SYNTH_TARGETS.length).toBeGreaterThan(40);
  });
  it("moves the knob along its travel and leaves the rest of the sound alone", () => {
    const lo = automateTrack(track, 0).patch as typeof patch, hi = automateTrack(track, 16).patch as typeof patch, mid = automateTrack(track, 8).patch as typeof patch;
    expect(lo.cutoff).toBeLessThan(mid.cutoff); expect(mid.cutoff).toBeLessThan(hi.cutoff);
    expect(mid.cutoff / lo.cutoff).toBeCloseTo(hi.cutoff / mid.cutoff, 1); // a frequency moves in ratios
    expect(mid.resonance).toBe(10); expect(patch.cutoff).toBe(2000);
  });
  it("hands back the same sound while the value stands still, so the synth is not disturbed", () => {
    expect(automateTrack(track, 40).patch).toBe(automateTrack(track, 50).patch);
    const still = { ...track, auto: [{ target: "s:resonance", points: [{ at: 0, v: 0.1 }] }] };
    expect(automateTrack(still, 3).patch).toBe(patch);
  });
});

describe("automating the sampler's knobs", () => {
  const sampler = { sample: "h1", start: 0, length: 100, tune: 0, level: 80 };
  const track = { level: 80, pan: 0, devices: [], patch: {}, sampler, auto: [{ target: "m:start", points: [{ at: 0, v: 0 }, { at: 16, v: 1 }] }] };
  it("offers them in place of the synth's knobs and moves them", () => {
    const ids = targetsOf(track).map((t) => t.id);
    expect(ids).toContain("m:start"); expect(ids.some((x) => x.startsWith("s:"))).toBe(false);
    expect((automateTrack(track, 8).sampler as typeof sampler).start).toBe(50);
    expect(automateTrack(track, 0).sampler).toBe(sampler);
  });
});

describe("automation that goes with its clip", () => {
  const lane = { target: "level", points: [{ at: 2, v: 0.2 }, { at: 10, v: 0.9 }, { at: 20, v: 0.5 }, { at: 40, v: 0.1 }] };
  it("moves the points under the old stretch and replaces what was where they land", () => {
    expect(carryAuto([lane], 0, 32, 16)[0]!.points).toEqual([{ at: 20, v: 0.5 }, { at: 34, v: 0.2 }, { at: 42, v: 0.9 }]);
    expect(carryAuto([lane], 0, 32, 16, true)[0]!.points.map((p) => p.at)).toEqual([2, 10, 20, 34, 42]);
    const empty = [{ target: "pan", points: [{ at: 50, v: 1 }] }]; expect(carryAuto(empty, 0, 16, 16)).toBe(empty);
  });
  it("a clip dragged along its track takes its automation, unless the song locks it", () => {
    let s = addClip(newSong(), "t1", 0)!.song; const id = s.tracks[0]!.clips[0]!.id;
    s = setAuto(s, "t1", [{ target: "level", points: [{ at: 4, v: 0.3 }] }]);
    expect(placeClip(s, "t1", id, "t1", 3)!.song.tracks[0]!.auto[0]!.points).toEqual([{ at: 52, v: 0.3 }]);
    expect(moveClip(s, "t1", id, 1).tracks[0]!.auto[0]!.points).toEqual([{ at: 20, v: 0.3 }]);
    expect(placeClip({ ...s, lockAuto: true }, "t1", id, "t1", 3)!.song.tracks[0]!.auto[0]!.points).toEqual([{ at: 4, v: 0.3 }]);
  });
});
describe("automation on return tracks and the master", () => {
  it("moves a return's level and the master volume, and counts as automation", () => {
    let s = addReturn(newSong());
    s = { ...s, returns: s.returns.map((r) => ({ ...r, auto: [{ target: "level", points: [{ at: 0, v: 0 }, { at: 16, v: 1 }] }] })), masterAuto: [{ target: "level", points: [{ at: 0, v: 1 }, { at: 16, v: 0 }] }] };
    expect(hasAutomation(s)).toBe(true);
    const at8 = automate(s, 8);
    expect(at8.returns[0]!.level).toBe(50); expect(at8.volume).toBe(50); expect(s.volume).toBe(85);
    expect(targetsOf(masterStrip(s)).map((t) => t.label)).toEqual(["Master volume"]);
    const back = tidySong(JSON.parse(JSON.stringify(s)))!;
    expect(back.masterAuto).toEqual(s.masterAuto); expect(back.returns[0]!.auto).toEqual(s.returns[0]!.auto);
  });
});
describe("recording automation", () => {
  it("writes a point for each setting that was moved, making a lane when there is room", () => {
    const a = newSong(), b = { ...a, volume: 40, tracks: a.tracks.map((t, i) => (i === 0 ? { ...t, level: 20, pan: -50 } : t)) };
    const r = recordMoves(a, b, 12, 128);
    expect(r.tracks[0]!.auto.map((l) => [l.target, l.points])).toEqual([["level", [{ at: 12, v: 0.2 }]], ["pan", [{ at: 12, v: 0.25 }]]]);
    expect(r.masterAuto).toEqual([{ target: "level", points: [{ at: 12, v: 0.4 }] }]);
    expect(r.tracks[1]!.auto).toEqual([]);
    expect(recordMoves(a, a, 12, 128)).toBe(a);
    const later = recordMoves(r, { ...r, tracks: r.tracks.map((t, i) => (i === 0 ? { ...t, level: 60 } : t)) }, 20, 128);
    expect(later.tracks[0]!.auto[0]!.points).toEqual([{ at: 12, v: 0.2 }, { at: 20, v: 0.6 }]);
  });
});

describe("automation shapes", () => {
  it("every shape stays inside its stretch and between low and high", () => {
    for (const s of SHAPES) { const pts = shapePoints(s, 16, 16); expect(pts.every((p) => p.at >= 16 && p.at <= 31 && p.v >= 0 && p.v <= 1)).toBe(true); expect(pts.length).toBeGreaterThan(1); }
    expect(shapePoints("Triangle", 0, 17)).toEqual([{ at: 0, v: 0 }, { at: 8, v: 1 }, { at: 16, v: 0 }]);
    expect(Math.max(...shapePoints("Sine", 0, 32).map((p) => p.v))).toBe(1);
  });
  it("replaces what was drawn in the stretch and leaves the rest", () => {
    const lanes = [{ target: "level", points: [{ at: 2, v: 0.5 }, { at: 20, v: 0.3 }, { at: 40, v: 0.9 }] }];
    expect(drawShape(lanes, 0, "Ramp up", 16, 16, 128)[0]!.points).toEqual([{ at: 2, v: 0.5 }, { at: 16, v: 0 }, { at: 31, v: 1 }, { at: 40, v: 0.9 }]);
  });
});
