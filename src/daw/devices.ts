// The devices (effects) that can sit on a track, after its instrument, in a row: the Studio's own versions of
// a DAW's stock plugins. This file is the plain data and rules: what devices exist, their settings and ranges,
// and the edits to a track's chain. No sound here; `fxnodes.ts` makes the audio from the same settings.
import { NOTE_FX } from "./notefx";
import { GLUE_ATTACKS, GLUE_RATIOS, GLUE_RELEASES, RES_NAMES, compCurveDb } from "./dsp";
// The devices are our own, built from what each kind of effect does. They are named for what they do, the
// way every DAW names them; they are not copies of any maker's code, sound or look.

export interface ParamSpec { id: string; label: string; min: number; max: number; step: number; def: number; unit?: string; /** for a switch or a menu: the names of the values 0, 1, 2... */ choices?: string[]; /** the slider moves in ratios (for frequencies and times) */ log?: boolean; /** settings with the same group are shown together, one group at a time */ group?: string; /** shown only while this is true */ when?: (p: Record<string, number>) => boolean }
export interface DeviceSpec { /** a note effect: it sits in front of the instrument and changes notes, not sound */ midi?: boolean; /** a device that shows the sound instead of changing it */ view?: "spectrum" | "tuner"; /** shows how many dB it is turning the sound down */ meter?: boolean; kind: string; name: string; about: string; /** the stock device in Ableton Live that does the same job, so a chain built here can be rebuilt there */ like: string; params: ParamSpec[]; /** a wider card, for a device with a picture */ wide?: boolean; /** what the page must admit about this device */ note?: string }
export interface Device { id: string; kind: string; on: boolean; /** each setting's value, by its id */ p: Record<string, number> }

const sw = (id: string, label: string, def = 0, extra: Partial<ParamSpec> = {}): ParamSpec => ({ id, label, min: 0, max: 1, step: 1, def, choices: ["Off", "On"], ...extra });

const hz = (id: string, label: string, min: number, max: number, def: number, extra: Partial<ParamSpec> = {}): ParamSpec => ({ id, label, min, max, step: 1, def, unit: "Hz", log: true, ...extra });
const db = (id: string, label: string, min: number, max: number, def = 0, extra: Partial<ParamSpec> = {}): ParamSpec => ({ id, label, min, max, step: 0.5, def, unit: "dB", ...extra });
const pct = (id: string, label: string, def: number, extra: Partial<ParamSpec> = {}): ParamSpec => ({ id, label, min: 0, max: 100, step: 1, def, unit: "%", ...extra });
const menu = (id: string, label: string, choices: string[], def = 0, extra: Partial<ParamSpec> = {}): ParamSpec => ({ id, label, min: 0, max: choices.length - 1, step: 1, def, choices, ...extra });

/** Lengths in beats that a delay can be set to. */
export const DELAY_DIVS = [{ name: "1/16", beats: 0.25 }, { name: "1/8 triplet", beats: 1 / 3 }, { name: "1/8", beats: 0.5 }, { name: "1/8 dotted", beats: 0.75 }, { name: "1/4", beats: 1 }, { name: "1/4 dotted", beats: 1.5 }, { name: "1/2", beats: 2 }, { name: "1 bar", beats: 4 }];
/** Lengths in beats that one turn of an LFO can be set to. */
export const LFO_DIVS = [...DELAY_DIVS, { name: "2 bars", beats: 8 }, { name: "4 bars", beats: 16 }];
export const EQ8_TYPES = ["Low cut", "Low shelf", "Bell", "Notch", "High shelf", "High cut"];
const EQ8_START: [number, number][] = [[1, 80], [2, 200], [2, 500], [2, 1000], [2, 2000], [2, 4000], [2, 8000], [4, 12000]];
export const UTILITY_CHANNELS = ["Both sides", "Left only", "Right only", "Swapped"];
/** Under this, Utility's "Remove offset" lets nothing through: a steady push to one side cannot be heard and only eats headroom. */
export const DC_CUT_HZ = 10;
export const SAT_CURVES = ["Soft", "Hard", "Fold", "Uneven"];
export const PAN_SHAPES = ["Sine", "Triangle", "Square"];
export const AMP_TYPES = ["Clean", "Crunch", "Heavy"], PEDAL_TYPES = ["Overdrive", "Distortion", "Fuzz"];
/** The cabinets: where the bass stops, the low-mid bump, and where the top stops. Our own numbers. */
export const CABINETS = [{ name: "1 x 12", low: 90, bump: 120, lift: 3, top: 5500 }, { name: "2 x 12", low: 80, bump: 110, lift: 4, top: 5000 }, { name: "4 x 10", low: 100, bump: 140, lift: 3, top: 6000 }, { name: "4 x 12", low: 70, bump: 100, lift: 5, top: 4500 }];
export const AUTO_FILTER_TYPES = ["Low-pass", "High-pass", "Band-pass", "Notch"];
const NOTE_NAMES = ["C", "C#", "D", "D#", "E", "F", "F#", "G", "G#", "A", "A#", "B"];
export const noteName = (n: number) => `${NOTE_NAMES[((n % 12) + 12) % 12]}${Math.floor(n / 12) - 1}`;
const lfoParams = (extra: Partial<ParamSpec> = {}): ParamSpec[] => [menu("shape", "LFO shape", PAN_SHAPES, 0, extra), sw("sync", "LFO in beats", 0, extra),
  { id: "rate", label: "LFO speed", min: 0.05, max: 20, step: 0.01, def: 1, unit: "Hz", log: true, ...extra, when: (p) => !p.sync }, menu("div", "One turn every", LFO_DIVS.map((d) => d.name), 4, { ...extra, when: (p) => !!p.sync })];
const FD_LINES: [string, string, number, number, number][] = [["l", "Left", 2, 800, -100], ["m", "Both", 4, 2000, 0], ["r", "Right", 3, 5000, 100]];

export const DEVICES: DeviceSpec[] = [
  { kind: "utility", name: "Utility", like: "Utility", note: "Bass mono splits the sound in two at its frequency, which turns the phase a little around the split. Remove offset is a high-pass at 10 Hz.", about: "Level, left and right, width, and flipping a side upside down. The plain tool for fixing a track.", params: [
    { id: "gain", label: "Gain", min: -36, max: 24, step: 0.5, def: 0, unit: "dB" },
    { id: "pan", label: "Pan", min: -100, max: 100, step: 1, def: 0 },
    { id: "width", label: "Width", min: 0, max: 200, step: 1, def: 100, unit: "%" },
    sw("mono", "Mono"), sw("flipL", "Flip left"), sw("flipR", "Flip right"), sw("mute", "Mute"),
    menu("channel", "Takes", UTILITY_CHANNELS), sw("bassMono", "Bass mono"), hz("bassFreq", "Mono below", 50, 500, 120, { when: (p) => !!p.bassMono }), sw("dc", "Remove offset"),
  ] },
  { kind: "eq3", name: "Three-band EQ", like: "EQ Three", wide: true, about: "Splits the sound into lows, mids and highs at two frequencies you choose, with a level and a kill switch for each.", params: [
    db("low", "Low", -36, 12), db("mid", "Mid", -36, 12), db("high", "High", -36, 12),
    sw("killLow", "Kill low"), sw("killMid", "Kill mid"), sw("killHigh", "Kill high"),
    hz("freqLow", "Low / mid at", 50, 800, 250), hz("freqHigh", "Mid / high at", 1000, 12000, 2500),
  ] },
  { kind: "eq8", name: "Eight-band EQ", like: "EQ Eight", wide: true, about: "Eight bands, each a bell, a shelf, a notch or a cut, with the whole curve drawn. Every band starts flat.", params: EQ8_START.flatMap(([type, f], i): ParamSpec[] => { const n = i + 1, group = `Band ${n}`; return [
    sw(`b${n}on`, "On", 1, { group }), menu(`b${n}type`, "Shape", EQ8_TYPES, type, { group }), hz(`b${n}freq`, "Frequency", 20, 20000, f, { group }),
    db(`b${n}gain`, "Gain", -18, 18, 0, { group, when: (p) => [1, 2, 4].includes(p[`b${n}type`] ?? 2) }),
    { id: `b${n}q`, label: "Sharpness", min: 0.1, max: 18, step: 0.01, def: 0.71, log: true, group, when: (p) => ![1, 4].includes(p[`b${n}type`] ?? 2) },
  ]; }) },
  { kind: "channeleq", name: "Channel EQ", like: "Channel EQ", wide: true, about: "A quick EQ: a low shelf, a middle band you can move, a high shelf, and a switch that removes rumble.", params: [
    sw("lowcut", "Cut rumble (80 Hz)"), db("low", "Low", -15, 15), db("mid", "Mid", -12, 12), hz("midFreq", "Mid at", 120, 7500, 1000), db("high", "High", -15, 15), db("out", "Output", -12, 12),
  ] },
  { kind: "comp", name: "Compressor", like: "Compressor", meter: true, note: "Listening to another track (a sidechain) hears that track before its own effects and level, even when it is muted. The level is read from peaks.", about: "Turns the sound down whenever it is louder than the threshold, so loud and quiet parts end up closer together.", params: [
    db("threshold", "Threshold", -60, 0, -18), { id: "ratio", label: "Ratio", min: 1, max: 20, step: 0.1, def: 4, log: true },
    { id: "attack", label: "Attack", min: 0.1, max: 200, step: 0.1, def: 10, unit: "ms", log: true }, { id: "release", label: "Release", min: 10, max: 1000, step: 1, def: 120, unit: "ms", log: true },
    db("knee", "Knee", 0, 24, 6), db("makeup", "Make-up", 0, 24), pct("mix", "Dry / wet", 100),
    menu("side", "Listens to", ["Itself", ...Array.from({ length: 8 }, (_, i) => `Track ${i + 1}`)]),
  ] },
  { kind: "glue", name: "Glue compressor", like: "Glue Compressor", meter: true, note: "A general bus compressor with fixed choices, not a model of any hardware. It reads the average level, so its threshold sits about 3 dB lower than a peak reading.", about: "A gentler compressor for a whole drum track or mix: it reads the average level and has a few fixed choices for each setting.", params: [
    db("threshold", "Threshold", -40, 0, -15), menu("ratio", "Ratio", GLUE_RATIOS.map((r) => `${r} : 1`), 1), menu("attack", "Attack", GLUE_ATTACKS.map((a) => `${a} ms`), 3), menu("release", "Release", GLUE_RELEASES.map((r) => `${r / 1000} s`), 2),
    db("makeup", "Make-up", 0, 20), sw("clip", "Soft clip"), pct("mix", "Dry / wet", 100), menu("side", "Listens to", ["Itself", ...Array.from({ length: 8 }, (_, i) => `Track ${i + 1}`)]),
  ] },
  { kind: "limiter", name: "Limiter", like: "Limiter", meter: true, note: "It looks 1.5 ms ahead, so this track comes out 1.5 ms late.", about: "A ceiling the sound cannot pass. Turn the gain up to push more of the sound against it.", params: [
    db("gain", "Gain", 0, 24), { id: "ceiling", label: "Ceiling", min: -24, max: 0, step: 0.1, def: -0.3, unit: "dB" }, { id: "release", label: "Release", min: 1, max: 1000, step: 1, def: 100, unit: "ms", log: true },
  ] },
  { kind: "gate", name: "Gate", like: "Gate", meter: true, note: "Listening to another track opens the gate when that track is loud: put it on a held pad and let the drums chop it. It hears that track before its effects and level.", about: "Silences the sound while it is quieter than the threshold: for cutting the tail off a drum or the noise between notes.", params: [
    db("threshold", "Threshold", -80, 0, -40), db("back", "Closes this far under", 0, 24, 3), { id: "attack", label: "Attack", min: 0.1, max: 100, step: 0.1, def: 1, unit: "ms", log: true },
    { id: "hold", label: "Hold", min: 0, max: 500, step: 1, def: 20, unit: "ms" }, { id: "release", label: "Release", min: 1, max: 2000, step: 1, def: 80, unit: "ms", log: true }, db("floor", "Floor", -80, 0, -80), menu("side", "Listens to", ["Itself", ...Array.from({ length: 8 }, (_, i) => `Track ${i + 1}`)]),
  ] },
  { kind: "crush", name: "Crusher", like: "Redux", note: "Plain rounding and holding, with none of the smoothing a converter has: it is meant to sound rough.", about: "Fewer levels and fewer samples a second: the grit of old samplers and games.", params: [
    { id: "bits", label: "Bits", min: 1, max: 16, step: 1, def: 8 }, { id: "hold", label: "Keep one sample in", min: 1, max: 64, step: 1, def: 4, log: true }, pct("mix", "Dry / wet", 100),
  ] },
  { kind: "sat", name: "Saturator", like: "Saturator", note: "The four curves are our own. Colour lifts or lowers one band before the curve, so that band is driven harder or less hard; Soft clip rounds the output so it never passes full level. Not smoothed against the harsh edge very high notes can get when driven hard.", about: "Pushes the sound into a curve that rounds, clips or folds its peaks, adding harmonics.", params: [
    menu("curve", "Curve", SAT_CURVES), db("drive", "Drive", 0, 36, 12), db("out", "Output", -36, 6), pct("mix", "Dry / wet", 100),
    sw("colour", "Colour"), hz("colourFreq", "Colour at", 60, 10000, 1000, { when: (p) => !!p.colour }), db("colourDb", "Colour by", -12, 12, 6, { when: (p) => !!p.colour }), sw("soft", "Soft clip"),
  ] },
  { kind: "overdrive", name: "Overdrive", like: "Overdrive", note: "A general overdrive, not a model of any pedal.", about: "Keeps one band of the sound, drives it hard, then takes some top off. The band you choose is what growls.", params: [
    hz("freq", "Band at", 100, 6000, 800), { id: "width", label: "Band width", min: 0.5, max: 6, step: 0.1, def: 3, unit: "oct" }, pct("drive", "Drive", 50), pct("tone", "Tone", 60), pct("mix", "Dry / wet", 60),
  ] },
  { kind: "autopan", name: "Auto pan", like: "Auto Pan", note: "A speed set in beats is the right length but does not start on the bar line.", about: "Turns the left and right sides up and down in turn. With the sides moving together it is a tremolo.", params: [
    pct("amount", "Amount", 100), menu("shape", "Shape", PAN_SHAPES), sw("sync", "In beats"),
    { id: "rate", label: "Speed", min: 0.05, max: 20, step: 0.01, def: 1, unit: "Hz", log: true, when: (p) => !p.sync }, menu("div", "One turn every", LFO_DIVS.map((d) => d.name), 4, { when: (p) => !!p.sync }),
    { id: "phase", label: "Right side behind by", min: 0, max: 360, step: 5, def: 180, unit: "°" },
  ] },
  { kind: "chorus", name: "Chorus", like: "Chorus-Ensemble", about: "Adds two copies whose delay drifts slowly, one to each side, so one voice sounds like several.", params: [
    { id: "rate", label: "Speed", min: 0.05, max: 10, step: 0.01, def: 0.8, unit: "Hz", log: true }, pct("amount", "Amount", 50), { id: "delay", label: "Delay", min: 3, max: 30, step: 0.5, def: 12, unit: "ms" },
    { id: "feedback", label: "Feedback", min: 0, max: 80, step: 1, def: 0, unit: "%" }, pct("width", "Width", 100), pct("mix", "Dry / wet", 50),
  ] },
  { kind: "delay", name: "Delay", like: "Delay", note: "Changing a time while sound is in the delay bends its pitch for a moment.", about: "Echoes, with a time for each side in beats or milliseconds, feedback, a filter on the echoes, and ping-pong.", params: [
    sw("sync", "In beats", 1),
    menu("divL", "Left time", DELAY_DIVS.map((d) => d.name), 3, { when: (p) => !!p.sync }), menu("divR", "Right time", DELAY_DIVS.map((d) => d.name), 3, { when: (p) => !!p.sync }),
    { id: "msL", label: "Left time", min: 1, max: 2000, step: 1, def: 300, unit: "ms", log: true, when: (p) => !p.sync }, { id: "msR", label: "Right time", min: 1, max: 2000, step: 1, def: 300, unit: "ms", log: true, when: (p) => !p.sync },
    { id: "feedback", label: "Feedback", min: 0, max: 95, step: 1, def: 40, unit: "%" }, sw("pingpong", "Ping-pong"),
    sw("filter", "Filter the echoes", 1), hz("filterFreq", "Filter at", 50, 12000, 1000, { when: (p) => !!p.filter }), { id: "filterWidth", label: "Filter width", min: 0.5, max: 9, step: 0.1, def: 6, unit: "oct", when: (p) => !!p.filter },
    pct("mix", "Dry / wet", 30),
  ] },
  { kind: "autofilter", name: "Auto filter", like: "Auto Filter", wide: true, note: "One slope only (12 dB an octave). The picture shows the filter at rest, not while it moves. Following another track's loudness (a sidechain) hears that track before its own effects and level.", about: "A filter that moves by itself: an LFO sweeps it, and the sound's own loudness, or another track's, can open or close it.", params: [
    menu("type", "Kind", AUTO_FILTER_TYPES), hz("freq", "Frequency", 30, 18000, 1200), { id: "res", label: "Resonance", min: 0.5, max: 20, step: 0.01, def: 1.5, log: true },
    { id: "lfo", label: "LFO moves it by", min: 0, max: 4, step: 0.05, def: 1, unit: "oct" }, ...lfoParams(),
    { id: "env", label: "Loudness moves it by", min: -4, max: 4, step: 0.1, def: 0, unit: "oct" }, { id: "envSpeed", label: "Loudness follows in", min: 5, max: 500, step: 1, def: 40, unit: "ms", log: true }, menu("side", "Loudness of", ["Itself", ...Array.from({ length: 8 }, (_, i) => `Track ${i + 1}`)]),
  ] },
  { kind: "phaser", name: "Phaser and flanger", like: "Phaser-Flanger", note: "The phaser has no feedback (a browser loop needs a delay in it).", about: "Two sweeping effects in one: a phaser cuts moving notches with all-pass filters, a flanger with a very short delay.", params: [
    menu("mode", "Mode", ["Phaser", "Flanger"]), { id: "rate", label: "Speed", min: 0.02, max: 10, step: 0.01, def: 0.3, unit: "Hz", log: true }, pct("amount", "Amount", 60),
    hz("centre", "Centre", 100, 6000, 800, { when: (p) => !p.mode }), { id: "feedback", label: "Feedback", min: 0, max: 90, step: 1, def: 40, unit: "%", when: (p) => !!p.mode }, pct("mix", "Dry / wet", 100),
  ] },
  { kind: "echo", name: "Echo", like: "Echo", note: "A general character delay; the drive and wobble are our own.", about: "A delay with character: its repeats can be filtered, driven, made to wobble in pitch, and ducked while you play.", params: [
    sw("sync", "In beats", 1), menu("div", "Time", DELAY_DIVS.map((d) => d.name), 4, { when: (p) => !!p.sync }), { id: "ms", label: "Time", min: 1, max: 2000, step: 1, def: 350, unit: "ms", log: true, when: (p) => !p.sync },
    { id: "feedback", label: "Feedback", min: 0, max: 95, step: 1, def: 50, unit: "%" }, hz("lowcut", "Low cut", 20, 2000, 150), hz("highcut", "High cut", 500, 20000, 5000),
    pct("drive", "Drive", 0), pct("wobble", "Wobble", 0), { id: "wobbleRate", label: "Wobble speed", min: 0.05, max: 8, step: 0.01, def: 0.5, unit: "Hz", log: true, when: (p) => (p.wobble ?? 0) > 0 },
    pct("duck", "Duck while playing", 0), pct("mix", "Dry / wet", 35),
  ] },
  { kind: "filterdelay", name: "Filter delay", like: "Filter Delay", about: "Three delays, one fed by the left side, one by both and one by the right, each with its own filter, time, feedback, place and level.", params: [
    sw("sync", "In beats", 1), pct("mix", "Dry / wet", 40),
    ...FD_LINES.flatMap(([k, group, div, f, pan]): ParamSpec[] => [sw(`${k}on`, "On", 1, { group }), hz(`${k}freq`, "Filter at", 50, 12000, f, { group }), { id: `${k}width`, label: "Filter width", min: 0.5, max: 9, step: 0.1, def: 3, unit: "oct", group },
      menu(`${k}div`, "Time", DELAY_DIVS.map((d) => d.name), div, { group, when: (p) => !!p.sync }), { id: `${k}ms`, label: "Time", min: 1, max: 2000, step: 1, def: 250, unit: "ms", log: true, group, when: (p) => !p.sync },
      { id: `${k}fb`, label: "Feedback", min: 0, max: 95, step: 1, def: 30, unit: "%", group }, { id: `${k}pan`, label: "Pan", min: -100, max: 100, step: 1, def: pan, group }, db(`${k}level`, "Level", -36, 6, 0, { group })]),
  ] },
  { kind: "resonators", name: "Resonators", like: "Resonators", about: "Five tuned loops that ring at notes you choose whenever the sound excites them: drums become chords.", note: "No input filter yet.", params: [
    { id: "note", label: "Note", min: 24, max: 84, step: 1, def: 48 }, { id: "decay", label: "Rings for", min: 0.05, max: 10, step: 0.05, def: 1.5, unit: "s", log: true }, pct("colour", "Brightness", 70), pct("mix", "Dry / wet", 50),
    ...RES_NAMES.flatMap((group, i): ParamSpec[] => { const n = i + 1; return [sw(`r${n}on`, "On", i < 3 ? 1 : 0, { group }), ...(i ? [{ id: `r${n}pitch`, label: "Semitones from I", min: -24, max: 24, step: 1, def: [0, 7, 12, 16, 19][i]!, group } as ParamSpec] : []), db(`r${n}gain`, "Level", -36, 6, 0, { group })]; }),
  ] },
  { kind: "multiband", name: "Multiband dynamics", like: "Multiband Dynamics", meter: true, note: "The level in each band is read from peaks. The meter shows the most any band is being turned down. Listening to another track (a sidechain) reads each band's level from that track's lows, mids and highs, before its effects and level.", about: "The sound split into lows, mids and highs, each with its own compressor that can turn loud parts down and lift quiet parts up.", params: [
    hz("freqLow", "Low / mid at", 50, 500, 120), hz("freqHigh", "Mid / high at", 1000, 10000, 2500),
    { id: "attack", label: "Attack", min: 0.1, max: 200, step: 0.1, def: 10, unit: "ms", log: true }, { id: "release", label: "Release", min: 10, max: 1000, step: 1, def: 150, unit: "ms", log: true }, pct("amount", "Amount", 100), db("out", "Output", -24, 12), menu("side", "Listens to", ["Itself", ...Array.from({ length: 8 }, (_, i) => `Track ${i + 1}`)]),
    ...([["l", "Low"], ["m", "Mid"], ["h", "High"]] as const).flatMap(([k, group]): ParamSpec[] => [db(`${k}above`, "Turn down above", -60, 0, -24, { group }), { id: `${k}ratio`, label: "by a ratio of", min: 1, max: 20, step: 0.1, def: 3, log: true, group },
      db(`${k}below`, "Lift up below", -70, -10, -50, { group }), { id: `${k}lift`, label: "by a ratio of", min: 1, max: 5, step: 0.1, def: 1, group }, db(`${k}gain`, "Band level", -12, 12, 0, { group })]),
  ] },
  { kind: "drumbus", name: "Drum bus", like: "Drum Buss", note: "A general drum strip; every number in it is our own.", about: "One device for a whole drum track: drive, crunch on the top, sharper or softer hits, a ringing low boom, and a damper.", params: [
    pct("drive", "Drive", 0), pct("crunch", "Crunch", 0), { id: "transients", label: "Transients", min: -100, max: 100, step: 1, def: 0, unit: "%" },
    pct("boom", "Boom", 0), hz("boomFreq", "Boom at", 30, 120, 55), pct("boomDecay", "Boom rings", 50), hz("damp", "Damp above", 1000, 20000, 20000), db("out", "Output", -24, 12), pct("mix", "Dry / wet", 100),
  ] },
  { kind: "pitchshift", name: "Pitch shift", like: "Shifter", note: "The shifting is done by Signalsmith Stretch, a ready-made method (the one piece of sound code here that is not ours). The shifted sound comes out about an eighth of a second late; nobody has judged it by ear here.", about: "Moves the sound up or down by a musical interval and keeps its speed. Cleaner and more exact than the Shifter's pitch mode.", params: [
    { id: "semis", label: "Semitones", min: -24, max: 24, step: 1, def: 7 }, { id: "cents", label: "Cents", min: -50, max: 50, step: 1, def: 0 }, sw("formant", "Keep character"), pct("mix", "Dry / wet", 100),
  ] },
  { kind: "shifter", name: "Shifter", like: "Shifter", note: "Pitch mode warbles a little and can sit a few Hz off the exact interval, more so with a short window; a longer window is smoother but blurs fast hits.", about: "Moves the sound up or down: by a musical interval (pitch), or by a fixed number of Hz, which turns it metallic.", params: [
    menu("mode", "Mode", ["Pitch", "Frequency"]), { id: "semis", label: "Semitones", min: -24, max: 24, step: 1, def: 7, when: (p) => !p.mode }, { id: "cents", label: "Cents", min: -50, max: 50, step: 1, def: 0, when: (p) => !p.mode },
    { id: "window", label: "Window", min: 20, max: 200, step: 1, def: 60, unit: "ms", when: (p) => !p.mode }, { id: "hz", label: "Move by", min: -2000, max: 2000, step: 1, def: 100, unit: "Hz", when: (p) => !!p.mode }, pct("mix", "Dry / wet", 100),
  ] },
  { kind: "erosion", name: "Erosion", like: "Erosion", note: "How strong the noise settings sound depends on the width; the amount is not an exact measure.", about: "Shakes a very short delay with noise or a sine, which roughens the sound with a hiss-like or buzzing edge.", params: [
    menu("mode", "Shaken by", ["Noise", "Wide noise", "Sine"]), hz("freq", "Frequency", 200, 16000, 3000), { id: "width", label: "Noise width", min: 0.2, max: 6, step: 0.1, def: 1, unit: "oct", when: (p) => (p.mode ?? 0) < 2 }, pct("amount", "Amount", 40),
  ] },
  { kind: "beatrepeat", name: "Beat repeat", like: "Beat Repeat", note: "Counted from the start of the song in straight sixteenths: swing is not followed. No pitch drop or filter on the repeats yet.", about: "Every so often it catches a short slice of the sound and plays it over and over: the stutter of glitch music.", params: [
    menu("interval", "Catch once every", ["1/4 note", "1/2 note", "1 bar", "2 bars", "4 bars"], 2), { id: "offset", label: "Starting this many sixteenths in", min: 0, max: 15, step: 1, def: 12 },
    menu("grid", "Slice length", ["1/32", "1/16", "1/8", "1/4", "1/2"], 1), { id: "gate", label: "Repeat for (sixteenths)", min: 1, max: 16, step: 1, def: 4 },
    pct("chance", "Chance", 100), pct("decay", "Each repeat quieter", 0), menu("mode", "Mode", ["Mix", "Insert", "Gate"], 1),
  ] },
  { kind: "amp", name: "Amp", like: "Amp", note: "A general guitar-amp shape: three levels of drive and a tone stack. Not a model of any amplifier.", about: "Drive followed by bass, middle, treble and presence, the way a guitar amp is laid out.", params: [
    menu("type", "Kind", AMP_TYPES), pct("gain", "Gain", 50), db("bass", "Bass", -12, 12), db("middle", "Middle", -12, 12), db("treble", "Treble", -12, 12), db("presence", "Presence", -12, 12), db("volume", "Volume", -24, 12),
  ] },
  { kind: "cabinet", name: "Cabinet", like: "Cabinet", wide: true, note: "A filter in the rough shape of a guitar speaker: our own numbers, not a measured cabinet or microphone.", about: "What a guitar speaker does to a sound: no deep bass, a bump in the low mids, and nothing much above a few kHz. Usually put after an amp or a pedal.", params: [
    menu("size", "Speakers", CABINETS.map((c) => c.name), 3), menu("mic", "Microphone", ["Close", "Far"]),
  ] },
  { kind: "pedal", name: "Pedal", like: "Pedal", note: "Three general kinds of drive, not models of any pedal.", about: "A stomp-box drive: overdrive rounds, distortion clips, fuzz squares the sound off almost completely.", params: [
    menu("type", "Kind", PEDAL_TYPES), pct("gain", "Gain", 50), db("bass", "Bass", -12, 12), db("mid", "Mid", -12, 12), db("treble", "Treble", -12, 12), db("out", "Output", -24, 12), pct("mix", "Dry / wet", 100),
  ] },
  { kind: "vinyl", name: "Vinyl distortion", like: "Vinyl Distortion", note: "A sketch of a record's wear with our own numbers, not a measurement of any record or player.", about: "The wear of a record: one band bent so it grows an octave above, a widening distortion that vanishes in mono, and crackle.", params: [
    pct("tracing", "Tracing", 30), hz("freq", "Band at", 200, 8000, 1500), pct("pinch", "Pinch", 0), { id: "crackle", label: "Crackles a second", min: 0, max: 50, step: 1, def: 8 }, db("crackleLevel", "Crackle level", -48, -6, -24),
  ] },
  { kind: "spectrum", name: "Spectrum", like: "Spectrum", view: "spectrum", wide: true, about: "Shows how much of each frequency is in the sound at this point in the chain. It changes nothing.", params: [] },
  { kind: "tuner", name: "Tuner", like: "Tuner", view: "tuner", about: "Shows the note a single-note sound is playing and how many cents sharp or flat it is. It changes nothing.", params: [] },
  { kind: "reverb", name: "Reverb", like: "Reverb", note: "A plate reverb after Dattorro's 1997 paper, struck once and replayed: its slow wobble is frozen, and nobody has tuned it by ear.", about: "A room: the sound carries on after it stops, for as long as the decay time.", params: [
    { id: "decay", label: "Decay", min: 0.2, max: 10, step: 0.1, def: 1.8, unit: "s", log: true }, { id: "predelay", label: "Pre-delay", min: 0, max: 250, step: 1, def: 10, unit: "ms" },
    hz("lowcut", "Low cut", 20, 1000, 120), hz("highcut", "High cut", 1000, 20000, 8000), pct("mix", "Dry / wet", 25),
  ] },
];
export const MAX_DEVICES = 8;
export const specOf = (kind: string): DeviceSpec | undefined => DEVICES.find((d) => d.kind === kind) ?? NOTE_FX.find((d) => d.kind === kind);
const clamp = (v: number, lo: number, hi: number) => Math.min(hi, Math.max(lo, v));
/** A setting's value kept inside its range and on its step. */
export const tidyParam = (s: ParamSpec, v: unknown): number => { const n = Number(v); return Number.isFinite(n) ? Number(clamp(Math.round(n / s.step) * s.step, s.min, s.max).toFixed(4)) : s.def; };
const freeId = (taken: readonly string[]) => { let n = 1; while (taken.includes(`d${n}`)) n++; return `d${n}`; };

export function newDevice(kind: string, taken: readonly string[] = []): Device | undefined {
  const spec = specOf(kind);
  return spec ? { id: freeId(taken), kind, on: true, p: Object.fromEntries(spec.params.map((s) => [s.id, s.def])) } : undefined;
}
/** Add a device to the end of a chain. Nothing happens when the kind is unknown or the chain is full. */
export function addDevice(chain: Device[], kind: string): Device[] {
  const d = chain.length < MAX_DEVICES ? newDevice(kind, chain.map((x) => x.id)) : undefined;
  return d ? [...chain, d] : chain;
}
export const removeDevice = (chain: Device[], id: string): Device[] => chain.filter((d) => d.id !== id);
export const toggleDevice = (chain: Device[], id: string): Device[] => chain.map((d) => (d.id === id ? { ...d, on: !d.on } : d));
export function setDeviceParam(chain: Device[], id: string, param: string, value: number): Device[] {
  return chain.map((d) => { const s = d.id === id ? specOf(d.kind)?.params.find((x) => x.id === param) : undefined; return s ? { ...d, p: { ...d.p, [param]: tidyParam(s, value) } } : d; });
}
/** Move a device one place earlier (-1) or later (1) in the chain. */
export function moveDevice(chain: Device[], id: string, by: -1 | 1): Device[] {
  const i = chain.findIndex((d) => d.id === id), j = i + by;
  if (i < 0 || j < 0 || j >= chain.length) return chain;
  const next = [...chain]; [next[i], next[j]] = [next[j]!, next[i]!];
  return next;
}
/** A chain read back from storage, made safe: unknown devices dropped, every setting in range, ids different. */
export function tidyDevices(raw: unknown, kind: "audio" | "note" = "audio"): Device[] {
  const out: Device[] = [];
  for (const g of Array.isArray(raw) ? raw : []) {
    const spec = g && typeof g === "object" ? specOf((g as Device).kind) : undefined;
    if (!spec || !!spec.midi !== (kind === "note") || out.length >= MAX_DEVICES) continue;
    const taken = out.map((d) => d.id), id = typeof g.id === "string" && /^[\w-]{1,16}$/.test(g.id) && !taken.includes(g.id) ? g.id : freeId(taken);
    out.push({ id, kind: spec.kind, on: g.on !== false, p: Object.fromEntries(spec.params.map((s) => [s.id, tidyParam(s, (g.p ?? {})[s.id] ?? s.def)])) });
  }
  return out;
}
/** What tells one arrangement of devices from another: when this changes the audio has to be wired again; a setting alone never changes it. */
export const chainShape = (chain: Device[]): string => chain.map((d) => `${d.id}:${d.kind}`).join(">");

// ---- the maths each device's audio is built from, here so that tests and the audio share one definition ----
export const dbToGain = (db: number) => 10 ** (db / 20);
/**
 * Utility's four gains: how much of the left and right inputs goes to each output. Width 100% leaves the two
 * sides alone, 0% (or Mono) makes them the same, 200% doubles what differs between them; a flipped side is
 * turned upside down before any of that.
 */
export function utilityMatrix(p: Record<string, number>): { ll: number; rl: number; lr: number; rr: number; gain: number } {
  const w = p.mono ? 0 : clamp((p.width ?? 100) / 100, 0, 2), sl = p.flipL ? -1 : 1, sr = p.flipR ? -1 : 1, pan = clamp((p.pan ?? 0) / 100, -1, 1);
  // Pan is a balance: it turns the other side down and never turns a side up.
  const left = pan > 0 ? 1 - pan : 1, right = pan < 0 ? 1 + pan : 1;
  const ll = (left * sl * (1 + w)) / 2, rl = (left * sr * (1 - w)) / 2, lr = (right * sl * (1 - w)) / 2, rr = (right * sr * (1 + w)) / 2, gain = p.mute ? 0 : dbToGain(p.gain ?? 0);
  // "Takes" chooses what comes in before anything else: one side copied to both, or the two sides swapped.
  const ch = Math.round(p.channel ?? 0);
  if (ch === 1) return { ll: ll + rl, rl: 0, lr: lr + rr, rr: 0, gain };
  if (ch === 2) return { ll: 0, rl: ll + rl, lr: 0, rr: lr + rr, gain };
  if (ch === 3) return { ll: rl, rl: ll, lr: rr, rr: lr, gain };
  return { ll, rl, lr, rr, gain };
}

// ---- shared pieces ----
/** A dry / wet setting (0 to 100) as the two gains: a straight crossfade. */
export const mixGains = (mix: number): [number, number] => { const m = clamp((mix ?? 100) / 100, 0, 1); return [1 - m, m]; };
/** A band's width in octaves as the sharpness (Q) of a band-pass that wide. */
export const octavesToQ = (oct: number) => { const r = 2 ** Math.max(0.05, oct); return Math.sqrt(r) / (r - 1); };

type C = [number, number];
const cmul = (a: C, b: C): C => [a[0] * b[0] - a[1] * b[1], a[0] * b[1] + a[1] * b[0]];
const cadd = (a: C, b: C): C => [a[0] + b[0], a[1] + b[1]];
const cdiv = (a: C, b: C): C => { const d = b[0] * b[0] + b[1] * b[1]; return [(a[0] * b[0] + a[1] * b[1]) / d, (a[1] * b[0] - a[0] * b[1]) / d]; };
const cscale = (a: C, k: number): C => [a[0] * k, a[1] * k];
const toDb = (c: C) => 10 * Math.log10(c[0] * c[0] + c[1] * c[1] + 1e-24);
export type BiquadKind = "lowpass" | "highpass" | "bandpass" | "notch" | "allpass" | "peaking" | "lowshelf" | "highshelf";
/**
 * What one two-pole filter of the browser's does to a frequency, as a complex number (size and turn). `q` is
 * the plain sharpness for every kind (the audio converts it to dB where the browser wants that); shelves ignore it.
 */
export function biquadAt(kind: BiquadKind, f0: number, q: number, gainDb: number, f: number, sampleRate = 48000): C {
  const w0 = (2 * Math.PI * clamp(f0, 1, sampleRate / 2 - 1)) / sampleRate, cos = Math.cos(w0), sin = Math.sin(w0), A = 10 ** (gainDb / 40), al = sin / (2 * Math.max(1e-4, q));
  let b: [number, number, number], a: [number, number, number];
  if (kind === "lowpass") { b = [(1 - cos) / 2, 1 - cos, (1 - cos) / 2]; a = [1 + al, -2 * cos, 1 - al]; }
  else if (kind === "highpass") { b = [(1 + cos) / 2, -(1 + cos), (1 + cos) / 2]; a = [1 + al, -2 * cos, 1 - al]; }
  else if (kind === "bandpass") { b = [al, 0, -al]; a = [1 + al, -2 * cos, 1 - al]; }
  else if (kind === "notch") { b = [1, -2 * cos, 1]; a = [1 + al, -2 * cos, 1 - al]; }
  else if (kind === "allpass") { b = [1 - al, -2 * cos, 1 + al]; a = [1 + al, -2 * cos, 1 - al]; }
  else if (kind === "peaking") { b = [1 + al * A, -2 * cos, 1 - al * A]; a = [1 + al / A, -2 * cos, 1 - al / A]; }
  else { const k = sin * Math.SQRT1_2 * 2 * Math.sqrt(A), up = kind === "highshelf" ? 1 : -1; // a shelf, slope 1
    b = [A * (A + 1 + up * (A - 1) * cos + k), -up * 2 * A * (A - 1 + up * (A + 1) * cos), A * (A + 1 + up * (A - 1) * cos - k)];
    a = [A + 1 - up * (A - 1) * cos + k, up * 2 * (A - 1 - up * (A + 1) * cos), A + 1 - up * (A - 1) * cos - k]; }
  const w = (2 * Math.PI * f) / sampleRate, z1: C = [Math.cos(w), -Math.sin(w)], z2: C = [Math.cos(2 * w), -Math.sin(2 * w)];
  const poly = (c: [number, number, number]): C => cadd(cadd([c[0], 0], cscale(z1, c[1])), cscale(z2, c[2]));
  return cdiv(poly(b), poly(a));
}
const BUTTER = Math.SQRT1_2;

// ---- Three-band EQ ----
/** The three bands' gains (kill is silence). */
export const eq3Gains = (p: Record<string, number>): [number, number, number] => [p.killLow ? 0 : dbToGain(p.low ?? 0), p.killMid ? 0 : dbToGain(p.mid ?? 0), p.killHigh ? 0 : dbToGain(p.high ?? 0)];
/**
 * The three-band EQ at one frequency, in dB. The split is the kind whose bands add back to the untouched level
 * (two Butterworth filters in a row each way, 24 dB an octave); the lows also pass through the upper split's
 * turn of phase so that all three bands line up.
 */
export function eq3Db(p: Record<string, number>, f: number, sampleRate = 48000): number {
  const f1 = p.freqLow ?? 250, f2 = p.freqHigh ?? 2500, [gl, gm, gh] = eq3Gains(p);
  const sq = (c: C) => cmul(c, c), lp1 = sq(biquadAt("lowpass", f1, BUTTER, 0, f, sampleRate)), hp1 = sq(biquadAt("highpass", f1, BUTTER, 0, f, sampleRate));
  const lp2 = sq(biquadAt("lowpass", f2, BUTTER, 0, f, sampleRate)), hp2 = sq(biquadAt("highpass", f2, BUTTER, 0, f, sampleRate));
  return toDb(cadd(cadd(cscale(cmul(lp1, cadd(lp2, hp2)), gl), cscale(cmul(hp1, lp2), gm)), cscale(cmul(hp1, hp2), gh)));
}

// ---- Eight-band EQ ----
const EQ8_KINDS: BiquadKind[] = ["highpass", "lowshelf", "peaking", "notch", "highshelf", "lowpass"];
/** One band of the eight-band EQ as a filter. A band that is off is a bell with no gain, which changes nothing. */
export function eq8Band(p: Record<string, number>, n: number): { kind: BiquadKind; f: number; q: number; gain: number } {
  const on = p[`b${n}on`] ?? 1, kind = EQ8_KINDS[p[`b${n}type`] ?? 2] ?? "peaking", f = p[`b${n}freq`] ?? 1000, q = p[`b${n}q`] ?? 0.71;
  if (!on) return { kind: "peaking", f, q: 1, gain: 0 };
  return { kind, f, q, gain: kind === "peaking" || kind === "lowshelf" || kind === "highshelf" ? p[`b${n}gain`] ?? 0 : 0 };
}
export function eq8Db(p: Record<string, number>, f: number, sampleRate = 48000): number {
  let sum = 0;
  for (let n = 1; n <= 8; n++) { const b = eq8Band(p, n); sum += toDb(biquadAt(b.kind, b.f, b.q, b.gain, f, sampleRate)); }
  return sum;
}

// ---- Channel EQ ----
export const CHANNEL_LOW_HZ = 100, CHANNEL_HIGH_HZ = 8000, CHANNEL_CUT_HZ = 80, CHANNEL_MID_Q = 0.7;
export function channelEqDb(p: Record<string, number>, f: number, sampleRate = 48000): number {
  return (p.lowcut ? toDb(biquadAt("highpass", CHANNEL_CUT_HZ, BUTTER, 0, f, sampleRate)) : 0) + toDb(biquadAt("lowshelf", CHANNEL_LOW_HZ, 1, p.low ?? 0, f, sampleRate))
    + toDb(biquadAt("peaking", p.midFreq ?? 1000, CHANNEL_MID_Q, p.mid ?? 0, f, sampleRate)) + toDb(biquadAt("highshelf", CHANNEL_HIGH_HZ, 1, p.high ?? 0, f, sampleRate)) + (p.out ?? 0);
}
/** The curve a device draws, when it has one: its level in dB at a frequency. */
export const CURVES: Record<string, (p: Record<string, number>, f: number, sampleRate?: number) => number> = { eq3: eq3Db, eq8: eq8Db, channeleq: channelEqDb, autofilter: (p, f, sr) => autoFilterDb(p, f, sr), cabinet: cabinetDb };

// ---- Compressor ----
/** A steady sound at `inDb` comes out of the compressor at this level, make-up left out. */
export const compOutDb = (p: Record<string, number>, inDb: number) => compCurveDb(inDb, p.threshold ?? -18, p.ratio ?? 4, p.knee ?? 0);

// ---- Saturator ----
/** One sample through a saturation curve. Our own four: rounded, clipped flat, folded back, and one that treats the two halves differently. */
export function saturate(curve: number, x: number): number {
  if (curve === 1) return clamp(x, -1, 1);
  if (curve === 2) return Math.sin((Math.PI / 2) * x);
  if (curve === 3) return x >= 0 ? Math.tanh(x) : Math.tanh(0.5 * x) / 0.75;
  return Math.tanh(x);
}
/** The table the audio reads: inputs from -1 to 1, with the drive already applied. */
export function satTable(curve: number, driveDb: number, points = 4097): Float32Array<ArrayBuffer> {
  const out = new Float32Array(points), g = dbToGain(driveDb);
  for (let i = 0; i < points; i++) out[i] = saturate(curve, ((2 * i) / (points - 1) - 1) * g);
  return out;
}

/** How wide the Saturator's Colour band is. */
export const COLOUR_Q = 0.7;
/** The Saturator's soft clip, on its output: untouched up to half of full level, then bent over so that nothing passes full level. */
export function softClip(x: number): number { const a = Math.abs(x); return a <= 0.5 ? x : Math.sign(x) * (0.5 + 0.5 * Math.tanh((a - 0.5) / 0.5)); }
/** How far over full level the soft clip's table reaches (the sound is turned down by this on the way in to fit the table). */
export const SOFT_CLIP_REACH = 4;
export function softClipTable(points = 4097): Float32Array<ArrayBuffer> {
  const out = new Float32Array(points);
  for (let i = 0; i < points; i++) out[i] = softClip(((2 * i) / (points - 1) - 1) * SOFT_CLIP_REACH);
  return out;
}

// ---- Overdrive ----
export const OVERDRIVE_MAX_GAIN = 60;
export const overdriveGain = (drive: number) => 1 + (clamp(drive ?? 50, 0, 100) / 100) ** 2 * (OVERDRIVE_MAX_GAIN - 1);
/** Tone from 0 to 100 as the frequency above which the driven sound is turned down. */
export const overdriveToneHz = (tone: number) => 500 * 40 ** (clamp(tone ?? 60, 0, 100) / 100);

// ---- Auto pan ----
/** How many times a second an LFO turns: its own speed, or a length in beats at the song's tempo. */
export const lfoRateHz = (p: Record<string, number>, bpm: number) => (p.sync ? bpm / (60 * (LFO_DIVS[p.div ?? 4] ?? LFO_DIVS[4]!).beats) : p.rate ?? 1);
/** The sine parts of a shape's harmonics (harmonic 1 first), each shape swinging between -1 and 1. */
export function panHarmonics(shape: number, count = 32): number[] {
  return Array.from({ length: count }, (_, i) => { const n = i + 1; if (shape === 0) return n === 1 ? 1 : 0; if (n % 2 === 0) return 0; return shape === 1 ? (8 / (Math.PI * Math.PI)) * (((n - 1) / 2) % 2 ? -1 : 1) / (n * n) : 4 / (Math.PI * n); });
}
/** The shape's value at a place in its turn (0 to 1). */
export function panShape(shape: number, turn: number): number {
  const x = turn - Math.floor(turn);
  return shape === 0 ? Math.sin(2 * Math.PI * x) : shape === 1 ? (x < 0.25 ? 4 * x : x < 0.75 ? 2 - 4 * x : 4 * x - 4) : x < 0.5 ? 1 : -1;
}
/** The gain of one side at a place in the LFO's turn: it swings between full and (1 - amount). The right side runs behind by `phase` degrees. */
export function autoPanGain(p: Record<string, number>, turn: number, side: "left" | "right"): number {
  const a = clamp((p.amount ?? 100) / 100, 0, 1), at = turn - (side === "right" ? (p.phase ?? 180) / 360 : 0);
  return 1 - a / 2 + (a / 2) * panShape(p.shape ?? 0, at);
}

// ---- Auto filter ----
const AUTO_KINDS: BiquadKind[] = ["lowpass", "highpass", "bandpass", "notch"];
export const autoFilterKind = (p: Record<string, number>): BiquadKind => AUTO_KINDS[p.type ?? 0] ?? "lowpass";
/** Where the auto filter sits for an LFO value (-1 to 1) and a loudness (0 to 1, where 1 is a full-level tone). */
export const autoFilterHz = (p: Record<string, number>, lfo = 0, level = 0) => (p.freq ?? 1200) * 2 ** ((p.lfo ?? 1) * lfo + (p.env ?? 0) * level);
export const autoFilterDb = (p: Record<string, number>, f: number, sampleRate = 48000, lfo = 0, level = 0) => toDb(biquadAt(autoFilterKind(p), autoFilterHz(p, lfo, level), p.res ?? 1.5, 0, f, sampleRate));

// ---- Echo ----
export const ECHO_WOBBLE = 0.004, ECHO_MAX_DRIVE = 8;
export const echoSeconds = (p: Record<string, number>, bpm: number) => clamp(p.sync ? ((DELAY_DIVS[p.div ?? 4] ?? DELAY_DIVS[4]!).beats * 60) / bpm : (p.ms ?? 350) / 1000, 0.001, DELAY_MAX_SECONDS);
export const echoDriveGain = (drive: number) => 1 + (clamp(drive ?? 0, 0, 100) / 100) * (ECHO_MAX_DRIVE - 1);
/**
 * The gain of the echo's feedback path. The drive curve sits inside the loop and turns quiet sound up by
 * g / tanh(g); left alone, that made the loop louder each time round at quite ordinary settings (drive 30
 * with feedback 60 ran away). The path is turned down by the same amount, so a quiet repeat comes back at
 * exactly `feedback` of the one before and a loud one is squashed: the loop can never grow.
 */
export const echoFeedbackGain = (feedback: number, drive: number) => { const g = echoDriveGain(drive), f = Math.min(0.95, clamp(feedback ?? 0, 0, 100) / 100); return g === 1 ? f : (f * Math.tanh(g)) / g; };

// ---- Filter delay ----
export const FILTER_DELAY_LINES = ["l", "m", "r"] as const;
/** One line of the filter delay: its time, feedback, what it hears of the left and right, and where it is sent. */
export function filterDelayLine(p: Record<string, number>, k: "l" | "m" | "r", bpm: number) {
  const seconds = clamp(p.sync ? ((DELAY_DIVS[p[`${k}div`] ?? 4] ?? DELAY_DIVS[4]!).beats * 60) / bpm : (p[`${k}ms`] ?? 250) / 1000, 0.001, DELAY_MAX_SECONDS);
  return { seconds, feedback: clamp((p[`${k}fb`] ?? 30) / 100, 0, 0.95), hears: (k === "l" ? [1, 0] : k === "r" ? [0, 1] : [0.5, 0.5]) as [number, number], pan: clamp((p[`${k}pan`] ?? 0) / 100, -1, 1),
    level: (p[`${k}on`] ?? 1) ? dbToGain(p[`${k}level`] ?? 0) : 0, freq: p[`${k}freq`] ?? 1000, q: octavesToQ(p[`${k}width`] ?? 3) };
}

// ---- Amp, pedal, cabinet ----
const AMP_GAINS: [number, number][] = [[1, 6], [3, 40], [10, 200]], PEDAL_GAINS: [number, number][] = [[1, 30], [2, 100], [5, 300]];
const between = ([lo, hi]: [number, number], pct: number) => lo * (hi / lo) ** (clamp(pct ?? 50, 0, 100) / 100);
/** One sample through the amp's drive. The two halves of the wave are treated a little differently, as valves do, which adds even harmonics. */
export function ampDrive(type: number, gain: number, x: number): number {
  const g = between(AMP_GAINS[type] ?? AMP_GAINS[0]!, gain);
  return (x >= 0 ? Math.tanh(g * x) : Math.tanh(0.7 * g * x) / 0.9) / Math.tanh(g);
}
/** One sample through the pedal: overdrive rounds, distortion clips flat, fuzz is almost a square. */
export function pedalDrive(type: number, gain: number, x: number): number {
  const g = between(PEDAL_GAINS[type] ?? PEDAL_GAINS[0]!, gain);
  if (type === 1) return clamp(g * x, -1, 1);
  if (type === 2) return Math.sign(x) * (1 - Math.exp(-g * Math.abs(x)));
  return Math.tanh(g * x) / Math.tanh(g);
}
export const driveTable = (f: (x: number) => number, points = 4097): Float32Array<ArrayBuffer> => { const out = new Float32Array(points); for (let i = 0; i < points; i++) out[i] = f((2 * i) / (points - 1) - 1); return out; };
export const TONE_LOW_HZ = 120, TONE_MID_HZ = 800, TONE_HIGH_HZ = 3500, PRESENCE_HZ = 4500, CAB_BUMP_Q = 1.2, CAB_FAR = 0.7;
export const cabinetOf = (p: Record<string, number>) => { const c = CABINETS[p.size ?? 3] ?? CABINETS[3]!; return { ...c, top: c.top * (p.mic ? CAB_FAR : 1), lift: c.lift * (p.mic ? 0.5 : 1) }; };
/** The cabinet at one frequency, in dB. */
export function cabinetDb(p: Record<string, number>, f: number, sampleRate = 48000): number {
  const c = cabinetOf(p);
  return toDb(biquadAt("highpass", c.low, BUTTER, 0, f, sampleRate)) + toDb(biquadAt("peaking", c.bump, CAB_BUMP_Q, c.lift, f, sampleRate)) + 2 * toDb(biquadAt("lowpass", c.top, BUTTER, 0, f, sampleRate));
}

// ---- Erosion ----
export const EROSION_SWING = 0.0005;
/** How far (seconds) erosion's delay is shaken either side of its resting time. */
export const erosionSwing = (p: Record<string, number>) => EROSION_SWING * clamp((p.amount ?? 40) / 100, 0, 1);

// ---- Chorus ----
export const CHORUS_SWING = 0.004;
/** The two delays of the chorus (seconds) at a place in the LFO's turn: they move opposite ways. */
export function chorusDelays(p: Record<string, number>, turn: number): [number, number] {
  const base = (p.delay ?? 12) / 1000, swing = Math.min(CHORUS_SWING, base - 0.0005) * clamp((p.amount ?? 50) / 100, 0, 1) * Math.sin(2 * Math.PI * turn);
  return [base + swing, base - swing];
}

// ---- Delay ----
export const DELAY_MAX_SECONDS = 4;
/** The left and right delay times in seconds. */
export function delayTimes(p: Record<string, number>, bpm: number): [number, number] {
  const beats = (i: number) => ((DELAY_DIVS[i] ?? DELAY_DIVS[3]!).beats * 60) / bpm;
  const t = p.sync ? [beats(p.divL ?? 3), beats(p.divR ?? 3)] : [(p.msL ?? 300) / 1000, (p.msR ?? 300) / 1000];
  return [clamp(t[0]!, 0.001, DELAY_MAX_SECONDS), clamp(t[1]!, 0.001, DELAY_MAX_SECONDS)];
}
/** How the delay is wired, as gains: what goes into each side's delay, and what each sends back to itself and across. */
export function delayRouting(p: Record<string, number>): { leftIn: [number, number]; rightIn: [number, number]; self: number; cross: number } {
  const fb = clamp((p.feedback ?? 40) / 100, 0, 0.95);
  return p.pingpong ? { leftIn: [0.5, 0.5], rightIn: [0, 0], self: 0, cross: fb } : { leftIn: [1, 0], rightIn: [0, 1], self: fb, cross: 0 };
}
/** When each echo of a single click arrives, on which side and how loud, with the filter left out. */
export function delayEchoes(p: Record<string, number>, bpm: number, most = 8): { at: number; side: "left" | "right"; level: number }[] {
  const [tl, tr] = delayTimes(p, bpm), fb = clamp((p.feedback ?? 40) / 100, 0, 0.95), out: { at: number; side: "left" | "right"; level: number }[] = [];
  if (p.pingpong) { let at = 0; for (let k = 0; k < most; k++) { const left = k % 2 === 0; at += left ? tl : tr; out.push({ at, side: left ? "left" : "right", level: fb ** k }); } }
  else for (let k = 1; k <= most; k++) out.push({ at: k * tl, side: "left", level: fb ** (k - 1) });
  return out;
}

// ---- the dots on a device's curve: what dragging each one changes ----
/** A dot on a curve. Dragging it sideways changes `fParam`; up and down changes `dbParam` (in dB), or `qParam` (sharpness) when there is no gain to change. */
export interface Handle { label: string; /** shown on the dot */ tag: string; f: number; db: number; fParam?: string; dbParam?: string; qParam?: string; /** the group of settings this dot belongs to */ group?: string }
export const HANDLES: Record<string, (p: Record<string, number>) => Handle[]> = {
  eq8: (p) => Array.from({ length: 8 }, (_, i) => i + 1).filter((n) => p[`b${n}on`] ?? 1).map((n) => { const gainy = [1, 2, 4].includes(p[`b${n}type`] ?? 2), shelf = [1, 4].includes(p[`b${n}type`] ?? 2);
    return { label: `Band ${n}`, tag: String(n), group: `Band ${n}`, f: p[`b${n}freq`] ?? 1000, db: gainy ? p[`b${n}gain`] ?? 0 : 0, fParam: `b${n}freq`, dbParam: gainy ? `b${n}gain` : undefined, qParam: shelf ? undefined : `b${n}q` }; }),
  eq3: (p) => { const f1 = p.freqLow ?? 250, f2 = p.freqHigh ?? 2500; return [
    { label: "Low", tag: "L", f: Math.sqrt(20 * f1), db: p.low ?? 0, dbParam: "low" }, { label: "Mid", tag: "M", f: Math.sqrt(f1 * f2), db: p.mid ?? 0, dbParam: "mid" }, { label: "High", tag: "H", f: Math.sqrt(f2 * 20000), db: p.high ?? 0, dbParam: "high" },
    { label: "Low / mid split", tag: "|", f: f1, db: -15, fParam: "freqLow" }, { label: "Mid / high split", tag: "|", f: f2, db: -15, fParam: "freqHigh" }]; },
  channeleq: (p) => [{ label: "Low", tag: "L", f: CHANNEL_LOW_HZ, db: p.low ?? 0, dbParam: "low" }, { label: "Mid", tag: "M", f: p.midFreq ?? 1000, db: p.mid ?? 0, fParam: "midFreq", dbParam: "mid" }, { label: "High", tag: "H", f: CHANNEL_HIGH_HZ, db: p.high ?? 0, dbParam: "high" }],
  autofilter: (p) => [{ label: "Filter", tag: "F", f: p.freq ?? 1200, db: 0, fParam: "freq", qParam: "res" }],
};
