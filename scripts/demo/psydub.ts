// "Deep Stitch": a 32-bar psydub piece written to find the Studio's limits. Eight tracks (the most there
// can be), eight effects on the drums (the most on one track), four automation lanes on three tracks (the
// most), sixteen-bar clips, both return tracks with automated echo "throws", effects and a fade on the
// master. The sounds lean on the deeper parts of the synth: FM from oscillator B, a pitch envelope four
// octaves wide, the matrix with one source scaling another, two filters side by side, unison, wavetables.
// Levels (`MIX`) were set by measuring rendered stems. The result is src/daw/demos/psydub.json.
import { addReturn, addTrack, newSong, setReturn, soundPatch, tidySong, type NoteEv, type Song, type SynthTrack, type DrumTrack } from "../../src/daw/song";
import { newDevice, type Device } from "../../src/daw/devices";
import { NOTE_FX } from "../../src/daw/notefx";
import { newPad, type Hit, type Pad } from "../../src/daw/drums";
import type { AutoLane } from "../../src/daw/automation";
import type { MatrixRow, SynthState } from "../../src/synth/params";

const dev = (kind: string, p: Record<string, number>, taken: Device[]): Device => {
  const d = newDevice(kind, taken.map((x) => x.id)); if (!d) throw new Error(`no device ${kind}`);
  for (const k of Object.keys(p)) if (!(k in d.p)) throw new Error(`${kind} has no setting ${k}`);
  return { ...d, p: { ...d.p, ...p } };
};
const chain = (...list: [string, Record<string, number>][]): Device[] => list.reduce<Device[]>((out, [k, p]) => [...out, dev(k, p, out)], []);
const noteFx = (...list: [string, Record<string, number>][]): Device[] => list.map(([kind, p], i) => { const spec = NOTE_FX.find((s) => s.kind === kind); if (!spec) throw new Error(kind); for (const k of Object.keys(p)) if (!spec.params.some((q) => q.id === k)) throw new Error(`${kind} has no ${k}`); return { id: `n${i + 1}`, kind, on: true, p: { ...Object.fromEntries(spec.params.map((s) => [s.id, s.def])), ...p } }; });
const n = (note: number, start: number, length: number, velocity = 100, chance?: number): NoteEv => ({ note, start, length, velocity, ...(chance ? { chance } : {}) });
const at = (notes: NoteEv[], bar: number): NoteEv[] => notes.map((x) => ({ ...x, start: x.start + bar * 16 }));
const lane = (target: string, pts: [number, number, number?][]): AutoLane => ({ target, points: pts.map(([a, v, c]) => ({ at: a, v, ...(c ? { c } : {}) })) });
const lin = (v: number, min: number, max: number) => (v - min) / (max - min), lg = (v: number, min: number, max: number) => Math.log(v / min) / Math.log(max / min);
const hzv = (f: number) => lg(f, 20, 20000);
const B = 16;
type Bar = Record<string, Record<number, Hit>>;
/** Drum clips four bars long, built from one-bar patterns. */
const drumClips = (bars: Bar[], pads: Pad[]) => Array.from({ length: bars.length / 4 }, (_, c) => ({ id: `c${c + 1}`, start: c * 4, bars: 4, hits: Object.fromEntries(pads.map((p) => [p.id, bars.slice(c * 4, c * 4 + 4).flatMap((bar) => Array.from({ length: B }, (_, i): Hit => bar[p.id]?.[i] ?? 0))]).filter(([, row]) => (row as Hit[]).some((h) => h > 0))) })).filter((c) => Object.keys(c.hits).length > 0);
const patch = (sound: string, p: Partial<SynthState>): SynthState => ({ ...soundPatch(sound), bpm: 86, ...p });

export interface Mix { drums: number; perc: number; bass: number; acid: number; pad: number; bell: number; zap: number; atmos: number; gain: { perc: number; bass: number; acid: number; pad: number; bell: number; zap: number; atmos: number }; limiter: number }
// Set from measured stems of the peak section. The drums' fader is near its top and three quiet tracks carry
// a Utility for the rest, because a fader only reaches +2 dB.
export const MIX: Mix = { drums: 92, perc: 100, bass: 66, acid: 76, pad: 78, bell: 74, zap: 70, atmos: 66, gain: { perc: 8, bass: 0, acid: 5, pad: 4, bell: 10, zap: 24, atmos: 14 }, limiter: 4 };

export function psydub(mix: Mix = MIX): Song {
  let s = newSong("Deep Stitch");
  s = { ...s, bpm: 86, swing: 10, bars: 32, volume: 85, scale: { root: 2, name: "Minor" } };
  s = addTrack(s, "drums");
  for (let i = 0; i < 5; i++) s = addTrack(s, "synth", "Plain saw");
  if (s.tracks.length !== 8) throw new Error(`expected 8 tracks, got ${s.tracks.length}`);
  if (addTrack(s, "synth", "Plain saw").tracks.length !== 8) throw new Error("a ninth track was allowed");
  s = addReturn(addReturn(s));
  const kinds = s.tracks.map((t) => t.kind).join(",");
  const drumsT = s.tracks.filter((t) => t.kind === "drums") as DrumTrack[], synthT = s.tracks.filter((t) => t.kind === "synth") as SynthTrack[];
  if (drumsT.length !== 2 || synthT.length !== 6) throw new Error(`tracks are ${kinds}`);
  const [bassT, acidT, padT, bellT, zapT, atmosT] = synthT as [SynthTrack, SynthTrack, SynthTrack, SynthTrack, SynthTrack, SynthTrack];
  const drumNo = s.tracks.indexOf(drumsT[0]!) + 1;   // "Listens to" menus count tracks from 1

  // ================================================================ 1. drums: slow, heavy, half-time
  const pads: Pad[] = [
    { ...newPad("kick", "mkick", "Kick"), level: 94, tune: -1, decay: 70, tone: 5 },
    { ...newPad("snare", "msnare", "Snare"), level: 78, tune: -2, decay: 120, tone: -10 },
    { ...newPad("rim", "rim", "Rim"), level: 52, pan: 22, tune: -2 },
    { ...newPad("hat", "mhat", "Hat"), level: 46, pan: -20, tone: 30, decay: 80 },
    { ...newPad("ohat", "mohat", "Open hat"), level: 38, pan: 24, decay: 60 },
    { ...newPad("tom", "tomlow", "Floor tom"), level: 60, pan: -30, tune: -3, decay: 130 },
    { ...newPad("tomhi", "tomhigh", "Rack tom"), level: 54, pan: 30, tune: -2 },
    { ...newPad("sub", "sub", "Sub drop"), level: 44, tune: -5, decay: 130 },
    { ...newPad("crash", "crash", "Crash"), level: 34, pan: 10, decay: 140, tone: -20 },
    { ...newPad("ride", "ride", "Ride"), level: 30, pan: 35, tone: 10 },
  ];
  const HATS = { 2: 2, 6: 2, 10: 2, 14: 2, 3: 1, 11: 1 } as Record<number, Hit>, HATS2 = { 2: 2, 5: 1, 6: 2, 10: 2, 13: 1, 14: 2, 15: 1 } as Record<number, Hit>;
  const D: Record<string, Bar> = {
    none: {},
    tick: { rim: { 4: 1, 12: 2 }, hat: { 2: 1, 10: 1 } },
    tick2: { rim: { 4: 1, 12: 2, 15: 1 }, hat: { 2: 1, 6: 1, 10: 1, 14: 2 }, kick: { 0: 2 } },
    in1: { kick: { 0: 3, 10: 2 }, rim: { 8: 2 }, hat: HATS },
    in2: { kick: { 0: 3, 7: 1, 10: 2 }, rim: { 8: 2, 13: 1 }, hat: HATS2, ohat: { 14: 1 } },
    a1: { kick: { 0: 3, 10: 2 }, snare: { 8: 3 }, hat: HATS, rim: { 13: 1 } },
    a2: { kick: { 0: 3, 7: 1, 10: 2 }, snare: { 8: 3, 15: 1 }, hat: HATS2, ohat: { 14: 2 } },
    a3: { kick: { 0: 3, 3: 1, 10: 2 }, snare: { 8: 3 }, hat: HATS, rim: { 5: 1, 13: 2 }, ride: { 4: 1, 12: 1 } },
    a4: { kick: { 0: 3, 10: 2, 11: 1 }, snare: { 8: 3, 14: 2 }, hat: HATS2, tom: { 12: 2, 13: 1 }, tomhi: { 11: 1 } },
    b1: { kick: { 0: 3, 6: 2, 10: 2 }, snare: { 8: 3 }, hat: { ...HATS, 0: 1, 4: 1, 8: 1, 12: 1 }, ride: { 2: 2, 6: 1, 10: 2, 14: 1 }, sub: { 0: 2 }, crash: { 0: 2 } },
    b2: { kick: { 0: 3, 7: 2, 10: 2 }, snare: { 8: 3, 15: 1 }, hat: { ...HATS2, 0: 1, 8: 1 }, ride: { 2: 2, 10: 2 }, ohat: { 14: 2 } },
    b3: { kick: { 0: 3, 6: 2, 10: 2, 13: 1 }, snare: { 8: 3 }, hat: { ...HATS, 4: 1, 12: 1 }, ride: { 2: 2, 6: 1, 10: 2, 14: 1 }, rim: { 5: 1 } },
    fill: { kick: { 0: 3, 6: 2 }, snare: { 8: 3, 11: 1, 12: 2, 14: 2, 15: 3 }, tom: { 9: 2, 13: 2 }, tomhi: { 10: 2 }, hat: { 2: 2, 4: 1, 6: 2 }, ohat: { 6: 1 } },
    brk1: { rim: { 4: 1, 12: 2 }, ride: { 2: 1, 6: 1, 10: 1, 14: 1 }, sub: { 0: 2 }, crash: { 0: 3 } },
    brk2: { rim: { 4: 1, 10: 1, 12: 2 }, ride: { 2: 1, 6: 1, 10: 1, 14: 1 }, tom: { 14: 1 } },
    lift: { snare: { 0: 1, 4: 1, 8: 2, 10: 2, 12: 2, 13: 2, 14: 3, 15: 3 }, tom: { 6: 2, 11: 2 }, tomhi: { 7: 2 }, ride: { 2: 1, 6: 1 } },
    end: { kick: { 0: 3 }, sub: { 0: 3 }, crash: { 0: 3 }, rim: { 8: 1 } },
  };
  const drumBars = ["none", "none", "tick", "tick2", "in1", "in2", "in1", "fill", "a1", "a2", "a3", "a4", "a1", "a2", "a3", "fill", "b1", "b2", "b3", "a4", "b1", "b2", "b3", "fill", "brk1", "brk2", "brk2", "lift", "b1", "b2", "a3", "end"].map((k) => D[k]!);
  // eight effects: as many as one track holds
  const drumFx = chain(["drumbus", { drive: 18, crunch: 8, transients: 30, boom: 5, boomFreq: 48 }], ["eq8", { b1type: 0, b1freq: 30, b3freq: 350, b3gain: -2.5, b3q: 1, b7gain: 1.5 }], ["glue", { threshold: -18, ratio: 1, attack: 5, release: 2, makeup: 2 }],
    ["sat", { curve: 0, drive: 4, out: -1, soft: 1 }], ["beatrepeat", { interval: 2, offset: 8, grid: 1, gate: 8, chance: 0, mode: 1, decay: 30 }], ["echo", { sync: 1, div: 3, feedback: 58, lowcut: 400, highcut: 3000, drive: 20, wobble: 20, duck: 0, mix: 0 }],
    ["utility", { bassMono: 1, bassFreq: 140 }], ["limiter", { gain: 0, ceiling: -1, release: 80 }]);
  const throws = [7, 15, 23, 27];   // the bars (from 0) that end a phrase
  const drumTrack: DrumTrack = { ...drumsT[0]!, name: "Drums", level: mix.drums, pads, clips: drumClips(drumBars, pads), devices: drumFx, sends: { ra: 16, rb: 6 },
    auto: [   // four lanes: as many as one track holds
      lane(`d:${drumFx[4]!.id}:chance`, throws.flatMap((b): [number, number][] => [[b * B + 7, 0], [b * B + 8, 1], [b * B + 15, 1], [(b + 1) * B, 0]])),
      lane(`d:${drumFx[5]!.id}:mix`, throws.flatMap((b): [number, number][] => [[b * B + 11, 0], [b * B + 12, 0.45], [(b + 1) * B + 1, 0.45], [(b + 1) * B + 6, 0]])),
      lane(`d:${drumFx[0]!.id}:crunch`, [[8 * B, 0.08], [16 * B, 0.12], [23 * B + 15, 0.3], [24 * B, 0.05], [28 * B, 0.2]]),
      lane("pan", [[0, 0.5], [24 * B, 0.5], [25 * B, 0.42], [26 * B, 0.58], [27 * B, 0.5]]),
    ] };

  // ================================================================ 2. hand percussion, rung through tuned resonators
  const percPads: Pad[] = [
    { ...newPad("clave", "clave", "Clave"), level: 50, pan: 28, tune: -3 },
    { ...newPad("chi", "congahigh", "Conga high"), level: 66, pan: -24 },
    { ...newPad("clo", "congalow", "Conga low"), level: 70, pan: -10, tune: -2 },
    { ...newPad("shaker", "shaker", "Shaker"), level: 40, pan: 36 },
    { ...newPad("tamb", "tambourine", "Tambourine"), level: 36, pan: -36 },
    { ...newPad("bell", "cowbell", "Bell"), level: 30, pan: 14, tune: 7 },
    { ...newPad("snap", "snap", "Snap"), level: 44, pan: -14, tune: 4 },
  ];
  const SH = { 0: 1, 2: 2, 4: 1, 6: 2, 8: 1, 10: 2, 12: 1, 14: 2 } as Record<number, Hit>;
  const P: Record<string, Bar> = {
    none: {}, sh: { shaker: { 2: 1, 6: 1, 10: 1, 14: 1 } },
    c1: { clave: { 0: 2, 3: 1, 6: 2, 10: 1, 12: 2 }, shaker: { 2: 1, 6: 1, 10: 1, 14: 1 } },
    g1: { clave: { 0: 2, 3: 1, 6: 2, 10: 1, 12: 2 }, chi: { 2: 2, 5: 1, 11: 2 }, clo: { 7: 2, 14: 1 }, shaker: SH },
    g2: { clave: { 3: 1, 6: 2, 12: 2 }, chi: { 2: 2, 9: 1, 11: 2, 15: 1 }, clo: { 4: 1, 7: 2, 13: 2, 14: 1 }, shaker: SH, tamb: { 4: 1, 12: 2 } },
    g3: { clave: { 0: 2, 3: 1, 6: 2, 10: 1, 12: 2 }, chi: { 1: 1, 2: 2, 5: 1, 11: 2 }, clo: { 7: 2, 8: 1, 14: 2 }, shaker: SH, tamb: { 4: 1, 12: 2 }, bell: { 6: 1, 14: 1 }, snap: { 8: 2 } },
    g4: { clave: { 0: 2, 6: 2, 9: 1, 12: 2, 15: 1 }, chi: { 2: 2, 3: 1, 10: 2, 11: 2 }, clo: { 5: 1, 7: 2, 13: 2, 14: 2, 15: 1 }, shaker: SH, tamb: { 4: 2, 12: 2 }, bell: { 2: 1, 10: 1 }, snap: { 8: 2 } },
    br: { clave: { 0: 1, 6: 1, 12: 1 }, chi: { 11: 1 }, clo: { 14: 1 }, bell: { 4: 1 } },
  };
  const percBars = ["none", "sh", "c1", "c1", "c1", "g1", "g1", "g2", "g1", "g2", "g1", "g2", "g3", "g2", "g3", "g4", "g3", "g4", "g3", "g4", "g3", "g4", "g3", "g4", "br", "br", "br", "g2", "g3", "g4", "g1", "none"].map((k) => P[k]!);
  const percFx = chain(["resonators", { note: 50, decay: 0.5, colour: 60, mix: 26, r2pitch: 7, r3pitch: 12, r4on: 1, r4pitch: 15 }], ["filterdelay", { sync: 1, mix: 22, lfb: 35, mfb: 20, rfb: 35 }], ["autopan", { amount: 30, sync: 1, div: 6, shape: 0 }], ["eq8", { b1type: 0, b1freq: 180, b7gain: 2 }], ["comp", { threshold: -22, ratio: 3, attack: 8, release: 90, makeup: 2 }], ["utility", { gain: mix.gain.perc, width: 130 }]);
  const percTrack: DrumTrack = { ...drumsT[1]!, name: "Hand drums", level: mix.perc, pads: percPads, clips: drumClips(percBars, percPads), devices: percFx, sends: { ra: 26, rb: 20 },
    auto: [lane(`d:${percFx[0]!.id}:mix`, [[0, 0.2], [16 * B, 0.26], [24 * B, 0.6], [27 * B + 15, 0.6], [28 * B, 0.26]]), lane(`d:${percFx[1]!.id}:mix`, [[0, 0.3], [16 * B, 0.22], [24 * B, 0.5], [28 * B, 0.22]])] };

  // ================================================================ 3. dub bass: a round low note that slides and ducks under the kick
  const bassPatch = patch("Bass", { shape: "triangle", table: "none", octave: -1, subOn: false, bOn: true, bShape: "square", bOctave: 0, bLevelDb: -16, filterOn: true, filterType: "low", slope: "24", cutoff: 190, resonance: 18, drive: 30, keyTrack: 30,
    env2Dest: "cutoff", env2Amount: 22, env2A: 2, env2D: 260, env2S: 0, envA: 4, envD: 500, envS: 80, envR: 110, voiceMode: "mono", legato: "on", glide: 90, glideMode: "legato",
    matrix: [{ source: "vel", dest: "cutoff", amount: 14, way: "up" }] as MatrixRow[], distOn: true, distType: "soft", distDrive: 30, distMix: 60, volumeDb: -5 });
  const roots = [38, 38, 34, 36];
  const bassA = (r: number): NoteEv[] => [n(r, 0, 5), n(r, 6, 1.2, 80), n(r + 12, 7, 1, 70), n(r, 10, 3.2, 95), n(r + 7, 13, 1.2, 80), n(r + 10, 14, 2, 90)];
  const bassB = (r: number): NoteEv[] => [n(r, 0, 3), n(r, 3, 1, 70), n(r + 3, 4, 2.2, 85), n(r, 6, 2), n(r, 10, 2.2, 95), n(r + 12, 12, 1, 75), n(r + 7, 13, 1.2, 80), n(r + 5, 14, 2, 90)];
  const bassLong = (r: number): NoteEv[] => [n(r, 0, 10), n(r + 12, 10, 2.2, 70), n(r + 7, 12, 4, 85)];
  const bassPhrase = (v: number): NoteEv[] => roots.flatMap((r, b) => at(v === 0 ? bassLong(r) : (b + v) % 2 ? bassA(r) : bassB(r), b));
  const bassFx = chain(["sat", { curve: 0, drive: 8, out: -3, colour: 1, colourFreq: 700, colourDb: 5, soft: 1 }], ["eq8", { b1type: 0, b1freq: 30, b3freq: 220, b3gain: -3, b3q: 1.2 }], ["comp", { threshold: -30, ratio: 5, attack: 2, release: 140, makeup: 2, side: drumNo }], ["utility", { bassMono: 1, bassFreq: 160, width: 60, gain: mix.gain.bass }]);
  const bassTrack: SynthTrack = { ...bassT, name: "Dub bass", level: mix.bass, patch: bassPatch, devices: bassFx, noteFx: [],
    clips: [{ id: "c1", start: 4, bars: 4, notes: bassPhrase(0) }, { id: "c2", start: 8, bars: 8, notes: [...bassPhrase(1), ...at(bassPhrase(2), 4)] }, { id: "c3", start: 16, bars: 8, notes: [...bassPhrase(2), ...at(bassPhrase(1), 4)] }, { id: "c4", start: 24, bars: 4, notes: bassPhrase(0) }, { id: "c5", start: 28, bars: 4, notes: [...bassPhrase(1).filter((x) => x.start < 48), n(38, 48, 15)] }],
    auto: [lane("s:cutoff", [[4 * B, hzv(150)], [8 * B, hzv(190)], [16 * B, hzv(240)], [23 * B + 15, hzv(330), 0.4], [24 * B, hzv(160)], [28 * B, hzv(240)], [31 * B + 15, hzv(120)]]), lane("s:distDrive", [[8 * B, 0.3], [16 * B, 0.38], [23 * B + 15, 0.55], [24 * B, 0.25], [28 * B, 0.42]])] };

  // ================================================================ 4. acid line: one resonant voice, slides and accents
  const acidPatch = patch("Lead", { shape: "saw", table: "none", warp: "fold", warpAmount: 8, filterOn: true, filterType: "low", slope: "24", cutoff: 240, resonance: 80, drive: 48, keyTrack: 45,
    env2Dest: "cutoff", env2Amount: 46, env2A: 1, env2D: 150, env2S: 0, env2Bend: "sharp", envA: 2, envD: 240, envS: 55, envR: 60, voiceMode: "mono", legato: "on", glide: 55, glideMode: "legato",
    // the accent: a hard note opens the filter further, and a fast LFO shivers the cutoff only on hard notes (velocity scales that row)
    lfo2Dest: "none", lfo2Rate: 22, lfo2Shape: "sine",
    matrix: [{ source: "vel", dest: "cutoff", amount: 26, way: "up" }, { source: "lfo2", dest: "cutoff", amount: 9, way: "both", aux: "vel" }, { source: "key", dest: "noteLevel", amount: -20, way: "both" }] as MatrixRow[], volumeDb: -2 });
  const acidA: NoteEv[] = [n(50, 0, 1, 100), n(50, 1, 1.3, 70), n(62, 2, 0.5, 120), n(50, 3, 1, 80), n(57, 4, 1.3, 90), n(55, 5, 0.6, 70), n(50, 6, 1.3, 75), n(53, 7, 0.5, 118), n(51, 8, 1, 85), n(50, 9, 1.3, 70), n(62, 10, 0.5, 122), n(60, 11, 1.3, 80), n(57, 12, 1, 90), n(50, 14, 1.3, 70), n(55, 15, 0.5, 112)];
  const acidB: NoteEv[] = [n(50, 0, 1.3, 100), n(53, 1, 0.5, 110), n(50, 2, 1, 70), n(50, 3, 1.3, 80), n(62, 4, 0.5, 124), n(57, 6, 1.3, 85), n(58, 7, 1, 75), n(57, 8, 0.5, 115), n(50, 10, 1, 70), n(51, 11, 1.3, 90), n(50, 12, 0.5, 116), n(65, 13, 0.5, 120), n(62, 14, 1.3, 85), n(60, 15, 1, 75)];
  const acidC: NoteEv[] = [n(46, 0, 1.3, 100), n(46, 1, 1, 70), n(58, 2, 0.5, 120), n(53, 3, 1.3, 85), n(50, 4, 1, 75), n(46, 6, 1.3, 80), n(58, 7, 0.5, 116), n(48, 8, 1.3, 100), n(48, 9, 1, 70), n(60, 10, 0.5, 122), n(55, 11, 1.3, 85), n(52, 12, 1, 80), n(48, 14, 1.3, 75), n(57, 15, 0.5, 118)];
  const acid4 = [...acidA, ...at(acidB, 1), ...at(acidC, 2), ...at(acidA.map((x) => ({ ...x, note: x.note === 50 ? 45 : x.note })), 3)];
  const acidFx = chain(["overdrive", { freq: 900, width: 3.5, drive: 55, tone: 55, mix: 55 }], ["phaser", { mode: 0, rate: 0.08, amount: 45, centre: 900, feedback: 35, mix: 35 }], ["echo", { sync: 1, div: 3, feedback: 46, lowcut: 350, highcut: 3600, drive: 15, wobble: 15, duck: 55, mix: 24 }], ["eq8", { b1type: 0, b1freq: 140, b5freq: 2600, b5gain: -2, b5q: 1.4 }], ["autopan", { amount: 25, sync: 1, div: 7, shape: 0 }], ["utility", { gain: mix.gain.acid }], ["limiter", { gain: 0, ceiling: -8, release: 60 }]);
  const acidTrack: SynthTrack = { ...acidT, name: "Acid line", level: mix.acid, pan: 8, patch: acidPatch, devices: acidFx, noteFx: [], sends: { ra: 14, rb: 22 },
    clips: [{ id: "c1", start: 8, bars: 8, notes: [...acid4, ...at(acid4, 4)] }, { id: "c2", start: 16, bars: 8, notes: [...acid4, ...at(acid4, 4)] }, { id: "c3", start: 28, bars: 4, notes: acid4.filter((x) => x.start < 56) }],
    auto: [   // four lanes
      lane("s:cutoff", [[8 * B, hzv(150)], [15 * B + 15, hzv(420), 0.5], [16 * B, hzv(300)], [20 * B, hzv(700)], [23 * B + 15, hzv(2400), 0.6], [28 * B, hzv(500)], [31 * B + 8, hzv(140)]]),
      lane("s:resonance", [[8 * B, 0.7], [16 * B, 0.8], [22 * B, 0.9], [23 * B + 15, 0.72], [28 * B, 0.82]]),
      lane("s:env2Amount", [[8 * B, lin(30, -100, 100)], [16 * B, lin(46, -100, 100)], [23 * B + 15, lin(64, -100, 100)], [28 * B, lin(46, -100, 100)]]),
      lane(`d:${acidFx[0]!.id}:drive`, [[8 * B, 0.35], [16 * B, 0.55], [23 * B + 15, 0.82], [28 * B, 0.5]]),
    ] };

  // ================================================================ 5. pad: two wavetables through two filters side by side
  const padPatch = patch("Soft pad", { table: "scatter", position: 10, voices: 7, detune: 28, spread: 100, bOn: true, bTable: "vowels", bPosition: 30, bOctave: 1, bLevelDb: -10, bVoices: 3, bDetune: 18, bPan: 0,
    filterOn: true, filterType: "low", slope: "12", cutoff: 1300, resonance: 16, filter2On: true, filter2Type: "band", cutoff2: 2600, resonance2: 45, filterRoute: "parallel",
    lfo1Dest: "cutoff", lfo1Rate: 0.09, lfo1Amount: 14, lfo1Shape: "triangle", lfo1Trig: "free", envA: 1600, envD: 1200, envS: 85, envR: 2600, reverbOn: false, chorusOn: true, chorusMix: 40, volumeDb: -4 });
  const chords = [[50, 57, 60, 64, 65], [50, 57, 60, 64, 69], [46, 53, 57, 62, 64], [48, 55, 58, 62, 67], [50, 57, 60, 65, 69], [53, 57, 60, 64, 67], [46, 53, 57, 60, 65], [45, 52, 55, 61, 64]];
  const padNotes = chords.flatMap((c, i) => c.map((note, k) => n(note, i * 32, 31, 80 - k * 4)));   // sixteen bars: the longest clip there is
  const padFx = chain(["chorus", { rate: 0.25, amount: 55, delay: 14, width: 100, mix: 40 }], ["autofilter", { type: 2, freq: 900, res: 1.6, lfo: 1.6, sync: 1, div: 9, shape: 0 }], ["comp", { threshold: -34, ratio: 6, attack: 6, release: 220, makeup: 3, side: drumNo }], ["eq8", { b1type: 0, b1freq: 190, b7gain: 2.5 }], ["utility", { width: 170, gain: mix.gain.pad }]);
  const padTrack: SynthTrack = { ...padT, name: "Breathing pad", level: mix.pad, patch: padPatch, devices: padFx, noteFx: [], sends: { ra: 55, rb: 10 },
    clips: [{ id: "c1", start: 0, bars: 16, notes: padNotes }, { id: "c2", start: 16, bars: 16, notes: padNotes }],
    auto: [lane("s:position", [[0, 0.05], [8 * B, 0.3], [16 * B, 0.15], [24 * B, 0.7], [28 * B, 0.35], [31 * B + 15, 0.05]]), lane("s:bPosition", [[0, 0.1], [12 * B, 0.9], [20 * B, 0.2], [26 * B, 1], [31 * B + 15, 0.3]]), lane("s:cutoff2", [[0, hzv(900)], [16 * B, hzv(3200)], [24 * B, hzv(1200)], [27 * B + 15, hzv(5200), 0.5], [28 * B, hzv(2400)]]), lane("level", [[0, 0.2], [2 * B, mix.pad / 100], [29 * B, mix.pad / 100], [31 * B + 15, 0.25]])] };

  // ================================================================ 6. glass bell: FM from oscillator B that dies away with the note
  const bellPatch = patch("Plain saw", { shape: "sine", table: "none", bOn: true, bShape: "sine", bOctave: 1, bSemitone: 7, bLevelDb: -36, fmAmount: 6, env2Dest: "fmAmount", env2Amount: 52, env2A: 1, env2D: 700, env2S: 0, env2Bend: "sharp",
    envA: 2, envD: 1400, envS: 0, envR: 1400, envBend: "eased", voices: 2, detune: 6, spread: 60, matrix: [{ source: "vel", dest: "fmAmount", amount: 30, way: "up" }, { source: "key", dest: "fmAmount", amount: -18, way: "both" }] as MatrixRow[], volumeDb: -3 });
  const bell1: NoteEv[] = [n(69, 0, 3, 100), n(74, 3, 2, 85), n(77, 6, 3, 105), n(76, 10, 2, 80), n(72, 12, 3, 90), n(69, 22, 2, 80), n(70, 24, 4, 100), n(69, 28, 3, 75)];
  const bell2: NoteEv[] = [n(81, 0, 2, 105), n(77, 3, 2, 85), n(76, 6, 2, 90), n(74, 8, 4, 100), n(72, 14, 2, 80), n(74, 16, 3, 95), n(65, 22, 2, 75, 70), n(69, 24, 6, 100)];
  const bellFx = chain(["chorus", { rate: 0.4, amount: 35, mix: 30 }], ["delay", { sync: 1, divL: 3, divR: 4, feedback: 48, pingpong: 1, filter: 1, filterFreq: 2400, filterWidth: 5, mix: 30 }], ["eq8", { b1type: 0, b1freq: 320, b7gain: 2 }], ["utility", { gain: mix.gain.bell, width: 140 }], ["limiter", { gain: 0, ceiling: -9, release: 90 }]);
  const bellTrack: SynthTrack = { ...bellT, name: "Glass bell", level: mix.bell, pan: -10, patch: bellPatch, devices: bellFx, noteFx: noteFx(["n-echo", { gap: 4, repeats: 2, fade: 50, step: 12 }], ["n-velocity", { low: 45, high: 120, random: 14 }]), sends: { ra: 44, rb: 26 },
    clips: [{ id: "c1", start: 12, bars: 4, notes: [...bell1, ...at(bell1.slice(0, 4), 2)] }, { id: "c2", start: 16, bars: 8, notes: [...bell1, ...at(bell2, 2), ...at(bell1, 4), ...at(bell2, 6)] }, { id: "c3", start: 24, bars: 4, notes: [...bell2, ...at(bell1, 2)] }, { id: "c4", start: 28, bars: 4, notes: [...bell1, n(74, 32, 16, 90), n(81, 40, 12, 70)] }],
    auto: [lane("s:fmAmount", [[12 * B, 0.03], [20 * B, 0.1], [24 * B, 0.18], [27 * B + 15, 0.3], [28 * B, 0.08]])] };

  // ================================================================ 7. zaps: a pitch that falls four octaves in a blink
  const zapPatch = patch("Plain saw", { shape: "sine", table: "none", env2Dest: "aPitchWide", env2Amount: 62, env2A: 1, env2D: 130, env2S: 0, env2Bend: "sharp", filterOn: true, filterType: "band", cutoff: 1800, resonance: 40, keyTrack: 60,
    lfo1Dest: "none", lfo1Rate: 14, lfo1Shape: "square", matrix: [{ source: "lfo1", dest: "cutoff", amount: 30, way: "both", aux: "env2" }, { source: "vel", dest: "aPitchWide", amount: 20, way: "up" }] as MatrixRow[],
    envA: 1, envD: 260, envS: 0, envR: 200, envBend: "eased", volumeDb: -2 });
  const zaps = (seed: number): NoteEv[] => [n(62 + (seed % 3) * 5, 3, 2, 110), n(74, 7, 1, 90, 60), n(57, 11, 2, 100, 75), n(69 - (seed % 2) * 7, 14, 1.5, 120), n(81, 22, 1, 80, 50), n(62, 27, 2, 105), n(50, 30, 2, 95, 65)];
  const zapFx = chain(["crush", { bits: 9, hold: 2, mix: 25 }], ["shifter", { mode: 1, hz: 60, mix: 45 }], ["delay", { sync: 1, divL: 1, divR: 3, feedback: 62, pingpong: 1, filter: 1, filterFreq: 2200, filterWidth: 5, mix: 42 }], ["autopan", { amount: 80, sync: 1, div: 2, shape: 1 }], ["eq8", { b1type: 0, b1freq: 380 }], ["utility", { gain: mix.gain.zap, width: 160 }], ["limiter", { gain: 0, ceiling: -9, release: 70 }]);
  const zapTrack: SynthTrack = { ...zapT, name: "Zaps", level: mix.zap, patch: zapPatch, devices: zapFx, noteFx: noteFx(["n-random", { chance: 30, range: 12, way: 2 }], ["n-scale", { root: 2, scale: 1 }]), sends: { ra: 36, rb: 30 },
    clips: [{ id: "c1", start: 2, bars: 2, notes: [n(86, 4, 2, 110), n(74, 20, 2, 90), n(62, 28, 3, 115)] }, { id: "c2", start: 6, bars: 2, notes: zaps(1) }, { id: "c3", start: 10, bars: 2, notes: zaps(2) }, { id: "c4", start: 14, bars: 2, notes: zaps(3) }, { id: "c5", start: 16, bars: 8, notes: [0, 1, 2, 3].flatMap((k) => at(zaps(k), k * 2)) }, { id: "c6", start: 26, bars: 2, notes: zaps(2) }, { id: "c7", start: 28, bars: 4, notes: [...zaps(1), ...at(zaps(3), 2)] }],
    auto: [lane(`d:${zapFx[1]!.id}:hz`, [[0, lin(40, -2000, 2000)], [16 * B, lin(120, -2000, 2000)], [23 * B + 15, lin(700, -2000, 2000), 0.5], [24 * B, lin(-200, -2000, 2000)], [28 * B, lin(80, -2000, 2000)]]), lane("s:env2D", [[0, lg(130, 1, 5000)], [16 * B, lg(90, 1, 5000)], [24 * B, lg(420, 1, 5000)], [28 * B, lg(130, 1, 5000)]])] };

  // ================================================================ 8. atmosphere: noise sung into a chord, with crackle; it also makes the risers
  const atmosPatch = patch("Plain saw", { aOn: false, noiseOn: true, noiseType: "pink", noiseLevelDb: 0, filterOn: true, filterType: "band", slope: "12", cutoff: 700, resonance: 22, envA: 2500, envD: 500, envS: 100, envR: 3000, lfo1Dest: "cutoff", lfo1Rate: 0.06, lfo1Amount: 18, lfo1Trig: "free", volumeDb: 0 });
  const atmosFx = chain(["resonators", { note: 38, decay: 4, colour: 55, mix: 70, r2pitch: 7, r3pitch: 12, r4on: 1, r4pitch: 15, r5on: 1, r5pitch: 22 }], ["phaser", { mode: 0, rate: 0.05, amount: 60, centre: 700, feedback: 40, mix: 45 }], ["erosion", { mode: 1, freq: 5200, width: 2, amount: 16 }], ["vinyl", { tracing: 12, crackle: 14, crackleLevel: -30 }], ["eq8", { b1type: 0, b1freq: 160, b7gain: 1.5 }], ["utility", { gain: mix.gain.atmos, width: 190 }], ["limiter", { gain: 0, ceiling: -12, release: 200 }]);
  const atmosTrack: SynthTrack = { ...atmosT, name: "Atmosphere", level: mix.atmos, patch: atmosPatch, devices: atmosFx, noteFx: [], sends: { ra: 60, rb: 12 },
    clips: [{ id: "c1", start: 0, bars: 16, notes: [n(50, 0, 255)] }, { id: "c2", start: 16, bars: 16, notes: [n(50, 0, 250)] }],
    auto: [   // four lanes; the band-pass climbs before each new section: the risers
      lane("s:cutoff", [[0, hzv(400)], [6 * B, hzv(500)], [7 * B + 15, hzv(4000), 0.5], [8 * B, hzv(600)], [14 * B, hzv(600)], [15 * B + 15, hzv(6000), 0.5], [16 * B, hzv(800)], [22 * B, hzv(800)], [23 * B + 15, hzv(7000), 0.5], [24 * B, hzv(500)], [26 * B, hzv(500)], [27 * B + 15, hzv(9000), 0.6], [28 * B, hzv(700)], [31 * B + 15, hzv(300)]]),
      lane("level", [[0, 0.3], [2 * B, mix.atmos / 100], [8 * B, 0.45], [14 * B, 0.45], [15 * B + 15, 0.8], [16 * B, 0.4], [22 * B, 0.4], [23 * B + 15, 0.85], [24 * B, mix.atmos / 100], [27 * B + 15, 0.9], [28 * B, 0.4], [31 * B + 15, 0.5]]),
      lane(`d:${atmosFx[0]!.id}:mix`, [[0, 0.8], [8 * B, 0.6], [24 * B, 0.9], [28 * B, 0.6]]),
      lane("s:resonance", [[0, 0.2], [14 * B, 0.2], [15 * B + 15, 0.5], [16 * B, 0.2], [26 * B, 0.2], [27 * B + 15, 0.6], [28 * B, 0.2]]),
    ] };

  // ================================================================ returns: a long plate, and the dub echo that gets "thrown"
  const plateFx = chain(["reverb", { decay: 4.6, predelay: 32, lowcut: 300, highcut: 6000, mix: 100 }], ["eq8", { b1type: 0, b1freq: 250, b6freq: 3500, b6gain: -2 }]);
  const echoFx = chain(["echo", { sync: 1, div: 3, feedback: 60, lowcut: 300, highcut: 3200, drive: 30, wobble: 28, wobbleRate: 0.3, duck: 0, mix: 100 }], ["sat", { curve: 0, drive: 5, out: -2, soft: 1 }], ["autofilter", { type: 2, freq: 1100, res: 1.2, lfo: 1.2, sync: 1, div: 8, shape: 0 }], ["reverb", { decay: 1.6, predelay: 0, lowcut: 400, highcut: 4500, mix: 22 }]);
  const fb = (v: number) => lin(v, 0, 95);
  s = setReturn(s, "ra", { name: "A Long plate", level: 76, devices: plateFx, auto: [lane("level", [[0, 0.76], [24 * B, 0.76], [26 * B, 0.95], [28 * B, 0.76]])] });
  s = setReturn(s, "rb", { name: "B Dub echo", level: 70, devices: echoFx, auto: [lane(`d:${echoFx[0]!.id}:feedback`, [[0, fb(60)], ...throws.flatMap((b): [number, number][] => [[b * B + 8, fb(60)], [b * B + 14, fb(90)], [(b + 1) * B + 4, fb(90)], [(b + 1) * B + 10, fb(60)]])])] });
  const masterFx = chain(["eq8", { b1type: 0, b1freq: 27, b2type: 1, b2freq: 70, b2gain: -2.5, b8gain: 2 }], ["multiband", { freqLow: 130, freqHigh: 3000, labove: -20, lratio: 3, mabove: -22, mratio: 2, habove: -24, hratio: 2, amount: 70, out: 2 }], ["glue", { threshold: -16, ratio: 1, attack: 5, release: 2, makeup: 2 }], ["sat", { curve: 0, drive: 2, out: 0, soft: 1 }], ["limiter", { gain: mix.limiter, ceiling: -1, release: 150 }]);
  const built = { ...s, tracks: [drumTrack, percTrack, bassTrack, acidTrack, padTrack, bellTrack, zapTrack, atmosTrack], masterFx,
    masterAuto: [lane("level", [[0, 0.55], [2 * B, 0.85], [30 * B, 0.85], [31 * B + 15, 0.4]])],
    markers: [{ bar: 0, name: "Fog" }, { bar: 4, name: "Bass" }, { bar: 8, name: "Groove" }, { bar: 16, name: "Peak" }, { bar: 24, name: "Float" }, { bar: 28, name: "Home" }] };
  const tidy = tidySong(JSON.parse(JSON.stringify(built)));
  if (!tidy) throw new Error("the Studio refused the song");
  return tidy;
}
/** What was handed to the Studio, counted, so a test can see that nothing was dropped. */
export const PSYDUB_SHAPE = { tracks: 8, clips: [8, 8, 5, 3, 2, 4, 7, 2], devices: [8, 6, 4, 7, 5, 5, 7, 7], lanes: [4, 2, 2, 4, 4, 1, 2, 4], returns: 2, masterFx: 5 };
