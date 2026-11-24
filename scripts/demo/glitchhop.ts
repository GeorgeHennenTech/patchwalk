// A sixteen-bar glitch-hop piece written for the Studio by the assistant, as a test that everything works:
// every sound is designed here from the Studio's own synth, drums and effects. `mix` holds the levels that
// were set by measuring rendered stems. Run through tests/demo-song.test.ts; the result is src/daw/demos/glitchhop.json.
import { addReturn, addTrack, newSong, setReturn, soundPatch, tidySong, type NoteEv, type Song, type SynthTrack, type DrumTrack } from "../../src/daw/song";
import { newDevice, type Device } from "../../src/daw/devices";
import { NOTE_FX } from "../../src/daw/notefx";
import { newPad, type Hit } from "../../src/daw/drums";
import type { AutoLane } from "../../src/daw/automation";

const dev = (kind: string, p: Record<string, number>, taken: Device[]): Device => {
  const d = newDevice(kind, taken.map((x) => x.id)); if (!d) throw new Error(`no device ${kind}`);
  for (const k of Object.keys(p)) if (!(k in d.p)) throw new Error(`${kind} has no setting ${k}`);
  return { ...d, p: { ...d.p, ...p } };
};
const chain = (...list: [string, Record<string, number>][]): Device[] => list.reduce<Device[]>((out, [k, p]) => [...out, dev(k, p, out)], []);
const noteFx = (...list: [string, Record<string, number>][]): Device[] => list.reduce<Device[]>((out, [kind, p], i) => { const spec = NOTE_FX.find((s) => s.kind === kind); if (!spec) throw new Error(kind); return [...out, { id: `n${i + 1}`, kind, on: true, p: { ...Object.fromEntries(spec.params.map((s) => [s.id, s.def])), ...p } }]; }, []);
const row = (steps: number, hits: Record<number, Hit>): Hit[] => Array.from({ length: steps }, (_, i) => hits[i] ?? 0);
const n = (note: number, start: number, length: number, velocity = 100, chance?: number): NoteEv => ({ note, start, length, velocity, ...(chance ? { chance } : {}) });
/** A straight line of automation points: [bar, beat-in-sixteenths, value 0..1, bend?]. */
const lane = (target: string, pts: [number, number, number?][]): AutoLane => ({ target, points: pts.map(([at, v, c]) => ({ at, v, ...(c ? { c } : {}) })) });
const BAR = 16;

export interface Mix { drums: number; bass: number; pad: number; pluck: number; bits: number; riser: number; master: number; limiterGain: number }
// Set from measured stems. A track's fader only reaches +2 dB and the synth is some 20 dB quieter than the
// drums at the same fader place, so the balance is made with the drums' fader well down, the synths' own
// volume up, and a Utility at the end of the quiet tracks.
export const MIX: Mix = { drums: 32, bass: 78, pad: 70, pluck: 72, bits: 60, riser: 62, master: 85, limiterGain: 6.5 };
const GAIN = { pluck: 14, bits: 22, riser: 20 };

export function glitchHop(mix: Mix = MIX): Song {
  let s = newSong("Stitch Glitch");
  s = { ...s, bpm: 104, swing: 22, bars: 16, volume: mix.master, scale: { root: 4, name: "Minor" } };
  for (const sound of ["Bass", "Pluck", "Plain saw", "Plain saw"]) s = addTrack(s, "synth", sound);
  s = addReturn(addReturn(s));
  const [drums, pad, bass, pluck, bits, riser] = s.tracks as [DrumTrack, SynthTrack, SynthTrack, SynthTrack, SynthTrack, SynthTrack];

  // ---------------------------------------------------------------- drums: half-time, swung, with stutters
  const pads = [
    { ...newPad("kick", "mkick", "Kick"), level: 92, decay: 62, tone: 10 },
    { ...newPad("snare", "msnare", "Snare"), level: 84, tone: 15, decay: 90 },
    { ...newPad("clap", "clap", "Clap"), level: 58, pan: 8 },
    { ...newPad("hat", "mhat", "Hat"), level: 52, pan: -18, tone: 20 },
    { ...newPad("ohat", "mohat", "Open hat"), level: 44, pan: 20, decay: 70 },
    { ...newPad("rim", "rim", "Rim"), level: 55, pan: 30, tune: 3 },
    { ...newPad("shaker", "shaker", "Shaker"), level: 40, pan: -35 },
    { ...newPad("sub", "sub", "Sub drop"), level: 48, tune: -4, decay: 120 },
    { ...newPad("snap", "snap", "Snap"), level: 50, pan: -25, tune: 5 },
  ];
  const A = { kick: { 0: 3, 6: 2, 10: 2 }, snare: { 8: 3, 15: 1 }, clap: { 8: 2 }, hat: { 0: 2, 2: 2, 3: 1, 4: 2, 6: 2, 10: 2, 11: 1, 12: 2, 13: 1 }, ohat: { 14: 2 }, shaker: { 1: 1, 5: 1, 9: 1, 13: 1 }, rim: { 5: 1 } } as Record<string, Record<number, Hit>>;
  const B = { kick: { 0: 3, 3: 1, 10: 2, 11: 2 }, snare: { 8: 3, 13: 1 }, clap: { 8: 2 }, hat: { 0: 2, 2: 2, 4: 2, 5: 1, 6: 2, 7: 1, 10: 2, 12: 2, 14: 2 }, ohat: { 6: 1 }, shaker: { 1: 1, 5: 1, 9: 1, 13: 1 }, rim: { 2: 1, 13: 2 }, snap: { 4: 2 } } as Record<string, Record<number, Hit>>;
  const FILL = { kick: { 0: 3, 6: 2, 7: 2 }, snare: { 8: 3, 11: 1, 12: 2, 13: 2, 14: 3, 15: 3 }, clap: { 8: 2 }, hat: { 0: 2, 1: 1, 2: 2, 3: 1, 4: 2 }, rim: { 5: 2, 9: 1, 10: 2 }, snap: { 6: 2 }, ohat: { 4: 2 } } as Record<string, Record<number, Hit>>;
  const INTRO = { hat: { 0: 2, 2: 1, 4: 2, 6: 1, 8: 2, 10: 1, 12: 2, 14: 1 }, rim: { 5: 1, 13: 2 }, shaker: { 3: 1, 11: 1 } } as Record<string, Record<number, Hit>>;
  const INTRO2 = { ...INTRO, kick: { 0: 2, 10: 1 }, snap: { 8: 2 } } as Record<string, Record<number, Hit>>;
  const LIFT = { snare: { 0: 1, 4: 1, 8: 2, 10: 2, 12: 2, 13: 2, 14: 3, 15: 3 }, hat: { 0: 2, 2: 2, 4: 2, 6: 2 }, rim: { 2: 1, 6: 1 } } as Record<string, Record<number, Hit>>;
  const DROP = { ...A, sub: { 0: 3 }, kick: { 0: 3, 6: 2, 10: 2 } } as Record<string, Record<number, Hit>>;
  const END = { kick: { 0: 3 }, sub: { 0: 3 }, clap: { 0: 2 }, ohat: { 0: 2 } } as Record<string, Record<number, Hit>>;
  const order = [INTRO, INTRO, INTRO2, LIFT, DROP, B, A, FILL, DROP, B, A, LIFT, DROP, B, A, FILL];
  const drumClips = order.map((pat, bar) => ({ id: `c${bar + 1}`, start: bar, bars: 1, hits: Object.fromEntries(Object.entries(bar === 15 ? { ...pat } : pat).map(([pad, hits]) => [pad, row(BAR, hits)])) }));
  void END;
  const drumFx = chain(["drumbus", { drive: 22, crunch: 12, transients: 35, boom: 6, boomFreq: 52 }], ["beatrepeat", { interval: 2, offset: 8, grid: 1, gate: 8, chance: 0, mode: 1, decay: 20 }], ["eq3", { low: 1, mid: -1.5, high: 1.5 }]);
  const repeatChance = `d:${drumFx[1]!.id}:chance`;
  const drumTrack: DrumTrack = { ...drums, name: "Drums", level: mix.drums, pads, clips: drumClips, devices: drumFx, sends: { ra: 14, rb: 0 },
    // the stutter: the beat repeat wakes up for the second half of bars 7 and 15 (counted from 0)
    auto: [lane(repeatChance, [[0, 0], [6 * BAR + 15, 0], [7 * BAR, 1], [7 * BAR + 15, 1], [8 * BAR, 0], [14 * BAR + 15, 0], [15 * BAR, 1], [15 * BAR + 15, 1]])] };

  // ---------------------------------------------------------------- bass: a mono saw with a sub, wobbling on the beat
  const bassPatch = { ...soundPatch("Bass"), shape: "saw" as const, table: "tanhsaw" as const, position: 55, octave: -1, subOn: true, subOctave: -1 as const, subLevelDb: -13, filterOn: true, filterType: "low" as const, slope: "24" as const, cutoff: 260, resonance: 38, drive: 45,
    lfo1Dest: "cutoff", lfo1Amount: 46, lfo1Way: "up" as const, lfo1Sync: "beat" as const, lfo1Div: "1/2" as const, lfo1Shape: "sine" as const, lfo1Trig: "free" as const,
    warp: "fold" as const, warpAmount: 14, envA: 3, envD: 300, envS: 85, envR: 70, voiceMode: "mono" as const, legato: "on" as const, glide: 45, glideMode: "legato" as const,
    distOn: true, distType: "soft" as const, distDrive: 38, distMix: 70, bpm: 104, volumeDb: -6 };
  const roots = [40, 40, 36, 38];   // E, E, C, D
  const bassBar = (root: number, v: 0 | 1 | 2): NoteEv[] => v === 0 ? [n(root, 0, 5.5), n(root, 6, 1.5, 90), n(root + 12, 8, 1, 80), n(root, 10, 3), n(root + 7, 13, 1, 85), n(root + 10, 14, 2, 95)]
    : v === 1 ? [n(root, 0, 3), n(root, 3, 1, 80), n(root + 3, 4, 2, 90), n(root, 6, 2), n(root, 10, 1.5), n(root + 12, 11.5, 0.5, 70), n(root + 7, 12, 2), n(root + 5, 14, 2, 90)]
    : [n(root, 0, 8), n(root + 12, 8, 0.5, 80), n(root + 12, 9, 0.5, 70), n(root + 12, 10, 0.5, 60), n(root, 12, 4, 100)];
  const bassClips = [1, 2, 3].map((i) => ({ id: `c${i}`, start: i * 4, bars: 4, notes: [0, 1, 2, 3].flatMap((b) => bassBar(roots[b]!, (i === 3 && b === 3 ? 2 : (b + i) % 2) as 0 | 1 | 2).map((x) => ({ ...x, start: x.start + b * BAR }))) }));
  const bassFx = chain(["sat", { curve: 0, drive: 9, out: -3, colour: 1, colourFreq: 900, colourDb: 4, soft: 1 }], ["utility", { bassMono: 1, bassFreq: 150, width: 80 }], ["eq8", { b1type: 0, b1freq: 32, b2freq: 250, b2gain: -2.5, b2q: 1.2 }]);
  const bassTrack: SynthTrack = { ...bass, name: "Wobble bass", level: mix.bass, patch: bassPatch, clips: bassClips, devices: bassFx, noteFx: [],
    // the filter opens through each four bars and the fold grows into the last section
    auto: [lane("s:cutoff", [[4 * BAR, 0.3], [7 * BAR + 15, 0.5, 0.4], [8 * BAR, 0.34], [11 * BAR + 15, 0.56, 0.4], [12 * BAR, 0.4], [15 * BAR + 15, 0.62]]), lane("s:warpAmount", [[4 * BAR, 0.1], [12 * BAR, 0.14], [15 * BAR + 15, 0.42]])] };

  // ---------------------------------------------------------------- pad: wide chords that duck under the drums
  const padPatch = { ...soundPatch("Soft pad"), table: "vowels" as const, position: 20, voices: 5, detune: 24, spread: 85, cutoff: 1500, resonance: 12, envA: 420, envR: 900, lfo3Dest: "position", lfo3Rate: 0.11, lfo3Amount: 40, lfo3Shape: "triangle" as const, reverbOn: false, chorusOn: true, chorusMix: 45, volumeDb: -6, bpm: 104 };
  const chords = [[52, 55, 59, 62, 66], [52, 55, 59, 62, 67], [48, 52, 55, 59, 64], [50, 54, 57, 59, 64]];
  const padNotes = chords.flatMap((c, b) => c.map((note, i) => n(note, b * BAR, BAR - 0.5, 78 - i * 4)));
  const padFx = chain(["autofilter", { type: 0, freq: 1400, res: 2.2, lfo: 1.4, sync: 1, div: 8, shape: 1 }], ["comp", { threshold: -34, ratio: 8, attack: 4, release: 190, knee: 6, makeup: 3, side: 1 }], ["eq8", { b1type: 0, b1freq: 170, b7gain: 2 }], ["utility", { width: 150 }]);
  const padTrack: SynthTrack = { ...pad, name: "Vowel pad", level: mix.pad, pan: -6, patch: padPatch, clips: [0, 1, 2, 3].map((i) => ({ id: `c${i + 1}`, start: i * 4, bars: 4, notes: padNotes })), devices: padFx, noteFx: [], sends: { ra: 48, rb: 0 },
    auto: [lane(`d:${padFx[0]!.id}:freq`, [[0, 0.42], [3 * BAR + 15, 0.74, 0.5], [4 * BAR, 0.6], [11 * BAR, 0.6], [11 * BAR + 15, 0.82], [12 * BAR, 0.66]])] };

  // ---------------------------------------------------------------- glitch pluck: a formant pluck, crushed and echoed
  const pluckPatch = { ...soundPatch("Pluck"), table: "formant" as const, position: 35, env2Dest: "cutoff", env2Amount: 60, env2D: 180, cutoff: 900, resonance: 28, envD: 200, envR: 140, velDest: "position", velAmount: 55, delayOn: false, volumeDb: 0, bpm: 104 };
  const riff = (shift = 0): NoteEv[] => [n(76, 0, 1), n(71, 1.5, 0.5, 80), n(74, 3, 1, 110), n(71, 4, 0.5, 70, 60), n(67, 6, 1, 95), n(69, 7, 0.5, 60, 50), n(76, 9, 0.5, 105), n(79, 10, 1, 115), n(74, 11.5, 0.5, 75), n(71, 13, 0.5, 90, 70), n(69, 14, 1, 100), n(67, 15, 0.5, 70, 50)].map((x) => ({ ...x, note: x.note + shift }));
  const riff2: NoteEv[] = [n(79, 0, 0.5, 110), n(79, 0.5, 0.5, 80), n(79, 1, 0.5, 60), n(76, 2, 1), n(74, 4, 0.5, 90), n(76, 6, 2, 105), n(83, 8, 0.5, 115), n(81, 9, 0.5, 85), n(79, 10, 0.5, 95), n(76, 11, 0.5, 75), n(74, 12, 1, 100), n(71, 14, 2, 90)];
  const pluckFx = chain(["crush", { bits: 7, hold: 3, mix: 32 }], ["echo", { sync: 1, div: 3, feedback: 42, lowcut: 300, highcut: 4200, wobble: 12, duck: 45, mix: 28 }], ["autopan", { amount: 45, sync: 1, div: 2, shape: 1 }], ["eq8", { b1type: 0, b1freq: 220 }], ["utility", { gain: GAIN.pluck }], ["limiter", { gain: 0, ceiling: -7, release: 60 }]);
  const pluckTrack: SynthTrack = { ...pluck, name: "Glitch pluck", level: mix.pluck, pan: 10, patch: pluckPatch, devices: pluckFx, noteFx: noteFx(["n-random", { chance: 14, range: 12, way: 0 }], ["n-scale", { root: 4, scale: 1 }]), sends: { ra: 22, rb: 18 },
    clips: [{ id: "c1", start: 4, bars: 2, notes: [...riff(), ...riff2.map((x) => ({ ...x, start: x.start + BAR }))] }, { id: "c2", start: 6, bars: 1, notes: riff() }, { id: "c3", start: 8, bars: 2, notes: [...riff(), ...riff2.map((x) => ({ ...x, start: x.start + BAR }))] }, { id: "c4", start: 10, bars: 1, notes: riff(-5) },
      { id: "c5", start: 12, bars: 2, notes: [...riff2, ...riff().map((x) => ({ ...x, start: x.start + BAR }))] }, { id: "c6", start: 14, bars: 2, notes: [...riff(), ...riff2.map((x) => ({ ...x, start: x.start + BAR }))] }],
    auto: [lane(`d:${pluckFx[0]!.id}:mix`, [[4 * BAR, 0.2], [12 * BAR, 0.32], [15 * BAR + 15, 0.75]])] };

  // ---------------------------------------------------------------- bits: held chords turned into a random 16th-note arpeggio
  const bitsPatch = { ...soundPatch("Plain saw"), table: "bits" as const, position: 60, filterOn: true, filterType: "band" as const, cutoff: 2400, resonance: 30, envA: 1, envD: 90, envS: 0, envR: 60, lfo2Dest: "position", lfo2Rate: 0.3, lfo2Amount: 60, volumeDb: 0, bpm: 104 };
  const held = chords.flatMap((c, b) => c.slice(0, 4).map((note) => n(note + 12, b * BAR, BAR, 96)));
  const bitsFx = chain(["autopan", { amount: 85, sync: 1, div: 0, shape: 2 }], ["phaser", { mode: 1, rate: 0.12, amount: 55, feedback: 45, mix: 55 }], ["eq8", { b1type: 0, b1freq: 500 }], ["utility", { gain: GAIN.bits, width: 140 }], ["limiter", { gain: 0, ceiling: -11, release: 60 }]);
  const bitsTrack: SynthTrack = { ...bits, name: "Bits", level: mix.bits, patch: bitsPatch, devices: bitsFx, noteFx: noteFx(["n-arp", { style: 4, rate: 2, gate: 55, octaves: 2 }], ["n-velocity", { low: 50, high: 120, random: 30 }]), sends: { ra: 30, rb: 34 },
    clips: [{ id: "c1", start: 8, bars: 4, notes: held }, { id: "c2", start: 12, bars: 4, notes: held }],
    auto: [lane("level", [[8 * BAR, 0.15], [9 * BAR + 15, mix.bits / 100], [15 * BAR + 15, mix.bits / 100]])] };

  // ---------------------------------------------------------------- riser: filtered noise that sweeps up into each drop
  const riserPatch = { ...soundPatch("Plain saw"), aOn: false, noiseOn: true, noiseType: "white" as const, noiseLevelDb: 0, filterOn: true, filterType: "band" as const, cutoff: 400, resonance: 35, slope: "24" as const, envA: 1800, envD: 200, envS: 100, envR: 120, volumeDb: 0, bpm: 104 };
  const riserFx = chain(["phaser", { mode: 1, rate: 0.5, amount: 70, feedback: 55, mix: 60 }], ["utility", { width: 150, gain: GAIN.riser }]);
  const riserTrack: SynthTrack = { ...riser, name: "Riser", level: mix.riser, patch: riserPatch, devices: riserFx, noteFx: [], sends: { ra: 40, rb: 0 },
    clips: [3, 7, 11, 15].map((bar, i) => ({ id: `c${i + 1}`, start: bar, bars: 1, notes: [n(60, 0, 15.5, 100)] })),
    auto: [lane("s:cutoff", [3, 7, 11, 15].flatMap((bar): [number, number, number?][] => [[bar * BAR, 0.4, 0.5], [bar * BAR + 15, 0.92]]))] };

  // ---------------------------------------------------------------- returns and the master
  s = setReturn(s, "ra", { name: "A Plate", level: 78, devices: chain(["reverb", { decay: 2.4, predelay: 24, lowcut: 260, highcut: 6500, mix: 100 }]) });
  s = setReturn(s, "rb", { name: "B Echo", level: 70, devices: chain(["delay", { sync: 1, divL: 3, divR: 2, feedback: 46, pingpong: 1, filter: 1, filterFreq: 1800, filterWidth: 5, mix: 100 }]) });
  const masterFx = chain(["eq8", { b1type: 0, b1freq: 28, b2type: 1, b2freq: 75, b2gain: -5, b8gain: 2.5 }], ["glue", { threshold: -16, ratio: 1, attack: 5, release: 1, makeup: 2, clip: 0 }], ["limiter", { gain: mix.limiterGain, ceiling: -1, release: 120 }]);
  const song = { ...s, tracks: [drumTrack, padTrack, bassTrack, pluckTrack, bitsTrack, riserTrack], masterFx, markers: [{ bar: 0, name: "Intro" }, { bar: 4, name: "Drop" }, { bar: 8, name: "Bits" }, { bar: 12, name: "Full" }] };
  const tidy = tidySong(JSON.parse(JSON.stringify(song)));
  if (!tidy) throw new Error("the Studio refused the song");
  return tidy;
}
