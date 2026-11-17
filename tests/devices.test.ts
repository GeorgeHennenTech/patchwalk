import { describe, expect, it } from "vitest";
import { DEVICES, MAX_DEVICES, addDevice, chainShape, moveDevice, newDevice, removeDevice, setDeviceParam, tidyDevices, toggleDevice, utilityMatrix } from "../src/daw/devices";
import { addTrack, newSong, setDevices, tidySong } from "../src/daw/song";

describe("a track's chain of effects", () => {
  it("every device has a name, a line about it, and settings whose starting value is in range", () => {
    expect(new Set(DEVICES.map((d) => d.kind)).size).toBe(DEVICES.length);
    for (const d of DEVICES) {
      expect(d.name.length).toBeGreaterThan(2); expect(d.like.length).toBeGreaterThan(2); expect(d.about.length).toBeGreaterThan(20);
      for (const p of d.params) { expect(p.def).toBeGreaterThanOrEqual(p.min); expect(p.def).toBeLessThanOrEqual(p.max); expect(p.max).toBeGreaterThan(p.min); if (p.choices) expect(p.choices).toHaveLength(p.max - p.min + 1); }
      expect(Object.keys(newDevice(d.kind)!.p)).toEqual(d.params.map((p) => p.id));
    }
  });
  it("adds up to eight, each with its own id; moves, switches and removes them; and knows when the wiring changed", () => {
    let chain = addDevice(addDevice([], "utility"), "utility");
    expect(chain.map((d) => d.id)).toEqual(["d1", "d2"]);
    expect(addDevice(chain, "nonsense")).toBe(chain);
    const shape = chainShape(chain);
    chain = setDeviceParam(chain, "d1", "gain", 999);
    expect(chain[0]!.p.gain).toBe(24);
    expect(chainShape(toggleDevice(chain, "d1"))).toBe(shape);            // a setting or a switch never rewires
    expect(chainShape(moveDevice(chain, "d1", 1))).not.toBe(shape);       // a move does
    expect(moveDevice(chain, "d1", -1)).toBe(chain);
    expect(removeDevice(chain, "d1").map((d) => d.id)).toEqual(["d2"]);
    for (let i = 0; i < 12; i++) chain = addDevice(chain, "utility");
    expect(chain).toHaveLength(MAX_DEVICES);
    expect(new Set(chain.map((d) => d.id)).size).toBe(MAX_DEVICES);
  });
  it("makes a stored chain safe, and a song keeps its chains", () => {
    const got = tidyDevices([{ kind: "utility", id: "x", p: { gain: "loud", pan: 500 }, on: false }, { kind: "utility", id: "x" }, { kind: "tape" }, null]);
    expect(got).toHaveLength(2);
    expect(got[0]).toMatchObject({ id: "x", on: false }); expect(got[0]!.p.gain).toBe(0); expect(got[0]!.p.pan).toBe(100);
    expect(got[1]!.id).not.toBe("x");
    const song = setDevices(newSong(), "t1", addDevice([], "utility"));
    expect(tidySong(JSON.parse(JSON.stringify(song)))).toEqual(song);
    expect(tidySong({ tracks: [{ kind: "drums" }] })!.tracks[0]!.devices).toEqual([]);   // a song from before effects
    expect(addTrack(newSong(), "synth").tracks.at(-1)!.devices).toEqual([]);
  });
});

describe("Utility", () => {
  const out = (p: Record<string, number>, l: number, r: number) => { const m = utilityMatrix({ gain: 0, pan: 0, width: 100, mono: 0, flipL: 0, flipR: 0, mute: 0, ...p }); return [(l * m.ll + r * m.rl) * m.gain, (l * m.lr + r * m.rr) * m.gain]; };
  it("at its starting settings changes nothing", () => { expect(out({}, 0.3, -0.7)).toEqual([0.3, -0.7]); });
  it("width 0 and Mono make the two sides the same; 200% doubles what differs", () => {
    expect(out({ width: 0 }, 1, 0)).toEqual([0.5, 0.5]);
    expect(out({ mono: 1, width: 180 }, 1, 0)).toEqual([0.5, 0.5]);
    const [l, r] = out({ width: 200 }, 1, 0);
    expect(l).toBeCloseTo(1.5, 10); expect(r).toBeCloseTo(-0.5, 10);           // the middle (0.5) kept, the difference (0.5) doubled
  });
  it("a flipped side turned to mono cancels a sound that was the same on both sides", () => {
    const [l, r] = out({ flipL: 1, mono: 1 }, 0.8, 0.8);
    expect(l).toBeCloseTo(0, 10); expect(r).toBeCloseTo(0, 10);
    expect(out({ flipR: 1 }, 0.4, 0.4)).toEqual([0.4, -0.4]);
  });
  it("gain is in decibels and Mute is silence", () => {
    expect(out({ gain: 6 }, 1, 1)[0]).toBeCloseTo(1.9953, 3);
    expect(out({ gain: -6 }, 1, 1)[0]).toBeCloseTo(0.5012, 3);
    expect(out({ mute: 1 }, 1, 1)).toEqual([0, 0]);
    expect(out({ pan: -100 }, 0.5, 0.5)).toEqual([0.5, 0]);                    // pan is a balance: the other side goes, this side is not turned up
    expect(out({ pan: 50 }, 0.5, 0.5)).toEqual([0.25, 0.5]);
  });
});
