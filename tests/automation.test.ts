import { describe, expect, it } from "vitest";
import { MAX_LANES, addLane, automate, automateTrack, dropPoint, fromUnit, hasAutomation, movePoint, putPoint, removeLane, retargetLane, targetsOf, tidyAuto, toUnit, valueAt } from "../src/daw/automation";
import { addDevice, setDeviceParam } from "../src/daw/devices";
import { newSong, setAuto, setDevices, tidySong } from "../src/daw/song";

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
