// The practice synth's settings. One flat, typed state object is the single source of truth: the audio
// engine renders it, the controls edit it, and lessons check it. Units are exact (Hz, dB, cents, degrees)
// because this is our own instrument.

export const SHAPES = ["sine", "triangle", "square", "saw"] as const;
export type Shape = (typeof SHAPES)[number];
export const TABLES = ["none", "basic", "bright", "vowel"] as const;
export type Table = (typeof TABLES)[number];
export const NOISES = ["white", "pink"] as const;
// Kept here (not in filter.ts) so this file stays free of imports from the modules that depend on it.
const FILTER_TYPES = ["low", "high", "band", "notch"] as const;
const SLOPES = ["12", "24"] as const;

export interface SynthState {
  /** Master level in dB. 0 is the loudest the lesson synth goes. */
  volumeDb: number;
  // ---- oscillator A
  shape: Shape;
  /** Wavetable for oscillator A. "none" means use `shape`. */
  table: Table;
  /** Position within the wavetable, 0..100. */
  position: number;
  octave: number;
  semitone: number;
  /** Fine tune in cents. */
  fine: number;
  /** Where in its cycle oscillator A starts, in degrees. */
  phase: number;
  /** How much the start phase varies from note to note, 0..100 (% of a full cycle). */
  randomPhase: number;
  /**
   * When set, oscillator A ignores the keyboard and plays this frequency. Used by lessons about
   * frequency itself. `null` means "follow the keys".
   */
  freeHz: number | null;
  /** Level of oscillator A in dB. The bottom of the range is silence. */
  aLevelDb: number;
  // ---- unison on oscillator A
  voices: number;
  /** Total spread of the unison voices in cents (outermost voices are +/- half of this). */
  detune: number;
  /** Stereo spread of the unison voices, 0..100. */
  spread: number;
  // ---- oscillator B
  bOn: boolean;
  bShape: Shape;
  bOctave: number;
  bSemitone: number;
  bFine: number;
  bPhase: number;
  /** Level of oscillator B relative to A, in dB. */
  bLevelDb: number;
  // ---- sub and noise
  subOn: boolean;
  /** Octaves below the played note: -1 or -2. */
  subOctave: number;
  subLevelDb: number;
  noiseOn: boolean;
  noiseType: (typeof NOISES)[number];
  noiseLevelDb: number;
  // ---- filter (see filter.ts for the maths)
  filterOn: boolean;
  filterType: (typeof FILTER_TYPES)[number];
  /** Cutoff frequency in Hz, for middle C when key tracking is in use. */
  cutoff: number;
  /** Resonance, 0..100 (% of the way from flat to the tallest peak). */
  resonance: number;
  /** Steepness in dB per octave. */
  slope: (typeof SLOPES)[number];
  /** Drive into the filter, 0..100. 0 is clean. */
  drive: number;
  /** How far the cutoff follows the key played, 0..100. At 100 it moves an octave per octave. */
  keyTrack: number;
}

export const INITIAL: SynthState = {
  volumeDb: -12, shape: "saw", table: "none", position: 0, octave: 0, semitone: 0, fine: 0, phase: 0, randomPhase: 0, freeHz: null, aLevelDb: 0,
  voices: 1, detune: 0, spread: 0,
  bOn: false, bShape: "saw", bOctave: 0, bSemitone: 0, bFine: 0, bPhase: 0, bLevelDb: 0,
  subOn: false, subOctave: -1, subLevelDb: -6, noiseOn: false, noiseType: "white", noiseLevelDb: -18,
  filterOn: false, filterType: "low", cutoff: 20000, resonance: 0, slope: "12", drive: 0, keyTrack: 0,
};

export type Group = "Master" | "Oscillator A" | "Unison" | "Oscillator B" | "Sub" | "Noise" | "Filter";

export interface ParamSpec {
  id: keyof SynthState;
  label: string;
  group: Group;
  kind: "range" | "choice" | "toggle";
  min?: number;
  max?: number;
  step?: number;
  /** Logarithmic feel for sliders that span octaves. */
  log?: boolean;
  unit?: string;
  choices?: readonly string[];
  /** Display names for choices. */
  names?: Record<string, string>;
}

const SHAPE_NAMES = { sine: "Sine", triangle: "Triangle", square: "Square", saw: "Saw" };

export const PARAMS: Record<string, ParamSpec> = {
  volumeDb: { id: "volumeDb", label: "Volume", group: "Master", kind: "range", min: -48, max: 0, step: 1, unit: "dB" },
  shape: { id: "shape", label: "Wave shape", group: "Oscillator A", kind: "choice", choices: SHAPES, names: SHAPE_NAMES },
  table: { id: "table", label: "Wavetable", group: "Oscillator A", kind: "choice", choices: TABLES, names: { none: "Off", basic: "Basic morph", bright: "Bright sweep", vowel: "Vowel" } },
  position: { id: "position", label: "Position", group: "Oscillator A", kind: "range", min: 0, max: 100, step: 1, unit: "%" },
  octave: { id: "octave", label: "Octave", group: "Oscillator A", kind: "range", min: -3, max: 3, step: 1, unit: "oct" },
  semitone: { id: "semitone", label: "Semitone", group: "Oscillator A", kind: "range", min: -12, max: 12, step: 1, unit: "st" },
  fine: { id: "fine", label: "Fine", group: "Oscillator A", kind: "range", min: -100, max: 100, step: 1, unit: "cents" },
  phase: { id: "phase", label: "Phase", group: "Oscillator A", kind: "range", min: 0, max: 360, step: 5, unit: "°" },
  randomPhase: { id: "randomPhase", label: "Random phase", group: "Oscillator A", kind: "range", min: 0, max: 100, step: 5, unit: "%" },
  freeHz: { id: "freeHz", label: "Frequency", group: "Oscillator A", kind: "range", min: 55, max: 1760, step: 1, log: true, unit: "Hz" },
  aLevelDb: { id: "aLevelDb", label: "A level", group: "Oscillator A", kind: "range", min: -48, max: 0, step: 1, unit: "dB" },
  voices: { id: "voices", label: "Voices", group: "Unison", kind: "range", min: 1, max: 7, step: 1, unit: "" },
  detune: { id: "detune", label: "Detune", group: "Unison", kind: "range", min: 0, max: 100, step: 1, unit: "cents" },
  spread: { id: "spread", label: "Spread", group: "Unison", kind: "range", min: 0, max: 100, step: 5, unit: "%" },
  bOn: { id: "bOn", label: "Osc B", group: "Oscillator B", kind: "toggle" },
  bShape: { id: "bShape", label: "B shape", group: "Oscillator B", kind: "choice", choices: SHAPES, names: SHAPE_NAMES },
  bOctave: { id: "bOctave", label: "B octave", group: "Oscillator B", kind: "range", min: -3, max: 3, step: 1, unit: "oct" },
  bSemitone: { id: "bSemitone", label: "B semitone", group: "Oscillator B", kind: "range", min: -12, max: 12, step: 1, unit: "st" },
  bFine: { id: "bFine", label: "B fine", group: "Oscillator B", kind: "range", min: -100, max: 100, step: 1, unit: "cents" },
  bPhase: { id: "bPhase", label: "B phase", group: "Oscillator B", kind: "range", min: 0, max: 360, step: 5, unit: "°" },
  bLevelDb: { id: "bLevelDb", label: "B level", group: "Oscillator B", kind: "range", min: -36, max: 0, step: 1, unit: "dB" },
  subOn: { id: "subOn", label: "Sub", group: "Sub", kind: "toggle" },
  subOctave: { id: "subOctave", label: "Sub octave", group: "Sub", kind: "range", min: -2, max: -1, step: 1, unit: "oct" },
  subLevelDb: { id: "subLevelDb", label: "Sub level", group: "Sub", kind: "range", min: -36, max: 0, step: 1, unit: "dB" },
  noiseOn: { id: "noiseOn", label: "Noise", group: "Noise", kind: "toggle" },
  noiseType: { id: "noiseType", label: "Noise type", group: "Noise", kind: "choice", choices: NOISES, names: { white: "White", pink: "Pink" } },
  noiseLevelDb: { id: "noiseLevelDb", label: "Noise level", group: "Noise", kind: "range", min: -48, max: 0, step: 1, unit: "dB" },
  filterOn: { id: "filterOn", label: "Filter", group: "Filter", kind: "toggle" },
  filterType: { id: "filterType", label: "Filter type", group: "Filter", kind: "choice", choices: FILTER_TYPES, names: { low: "Low-pass", high: "High-pass", band: "Band-pass", notch: "Notch" } },
  cutoff: { id: "cutoff", label: "Cutoff", group: "Filter", kind: "range", min: 20, max: 20000, step: 1, log: true, unit: "Hz" },
  resonance: { id: "resonance", label: "Resonance", group: "Filter", kind: "range", min: 0, max: 100, step: 1, unit: "%" },
  slope: { id: "slope", label: "Slope", group: "Filter", kind: "choice", choices: SLOPES, names: { "12": "Gentle (12)", "24": "Steep (24)" } },
  drive: { id: "drive", label: "Drive", group: "Filter", kind: "range", min: 0, max: 100, step: 1, unit: "%" },
  keyTrack: { id: "keyTrack", label: "Key track", group: "Filter", kind: "range", min: 0, max: 100, step: 5, unit: "%" },
};

export const A4 = 440;
/** MIDI note number to Hz. 69 is the A above middle C. */
export const noteToHz = (note: number) => A4 * 2 ** ((note - 69) / 12);

/** The frequency oscillator A plays for a given key (before unison detune). */
export function playedHz(state: SynthState, note: number): number {
  if (state.freeHz !== null) return state.freeHz;
  return noteToHz(note + state.octave * 12 + state.semitone) * 2 ** (state.fine / 1200);
}
/** The frequency oscillator B plays for a given key. */
export const playedHzB = (state: SynthState, note: number) => noteToHz(note + state.bOctave * 12 + state.bSemitone) * 2 ** (state.bFine / 1200);
export const subHz = (state: SynthState, note: number) => noteToHz(note + state.subOctave * 12);

/** How many times a second oscillators A and B swell against each other on this key. 0 when B is off. */
export function beatHz(state: SynthState, note: number): number {
  return state.bOn ? Math.abs(playedHz(state, note) - playedHzB(state, note)) : 0;
}

/** Detune offset in cents for each unison voice, spread evenly across `detune`. One voice sits dead centre. */
export function unisonOffsets(voices: number, detune: number): number[] {
  if (voices <= 1) return [0];
  return Array.from({ length: voices }, (_, i) => (i / (voices - 1) - 0.5) * detune);
}
/** Stereo position (-1..1) for each unison voice. */
export function unisonPans(voices: number, spread: number): number[] {
  if (voices <= 1) return [0];
  return Array.from({ length: voices }, (_, i) => (i / (voices - 1) - 0.5) * 2 * (spread / 100));
}

export const dbToGain = (db: number) => (db <= -48 ? 0 : 10 ** (db / 20));

/**
 * Harmonic recipe for each basic shape: amplitude of harmonic n (1-based), as sine partials.
 * These are the textbook series; the spectrum view and the audio both come from this one table.
 */
export function harmonic(shape: Shape, n: number): number {
  switch (shape) {
    case "sine": return n === 1 ? 1 : 0;
    case "saw": return 1 / n;
    case "square": return n % 2 === 1 ? 1 / n : 0;
    case "triangle": return n % 2 === 1 ? ((n - 1) / 2) % 2 === 0 ? 1 / (n * n) : -1 / (n * n) : 0;
  }
}

export const HARMONICS = 64;

/** Wavetables generated by maths for this app (no third-party tables). Each frame is a harmonic recipe. */
const FRAMES: Record<Exclude<Table, "none">, ((n: number) => number)[]> = {
  // sine -> triangle -> square -> saw
  basic: SHAPES.map((s) => (n: number) => harmonic(s, n)),
  // a saw with more and more of its harmonics let through: dull to bright
  bright: [1, 2, 4, 8, 16, 32, 64].map((top) => (n: number) => (n <= top ? 1 / n : 0)),
  // a saw with a resonant bump that climbs: a rough "oo" to "ee"
  vowel: [3, 5, 8, 12, 18].map((peak) => (n: number) => (1 / n) * (1 + 4 * Math.exp(-((n - peak) ** 2) / (2 * (peak / 4 + 0.6) ** 2)))),
};

export const frameCount = (table: Table) => (table === "none" ? 0 : FRAMES[table].length);

/** Harmonic amplitudes (index 1..HARMONICS) for oscillator A, blending neighbouring frames by position. */
export function harmonicsA(state: Pick<SynthState, "shape" | "table" | "position">): Float32Array {
  const out = new Float32Array(HARMONICS + 1);
  if (state.table === "none") {
    for (let n = 1; n <= HARMONICS; n++) out[n] = harmonic(state.shape, n);
    return out;
  }
  const frames = FRAMES[state.table];
  const at = (Math.min(100, Math.max(0, state.position)) / 100) * (frames.length - 1);
  const i = Math.min(frames.length - 2, Math.floor(at)), mix = at - i;
  for (let n = 1; n <= HARMONICS; n++) out[n] = frames[i]!(n) * (1 - mix) + frames[i + 1]!(n) * mix;
  return out;
}

/** A simple brightness figure: the share of energy above the fifth harmonic. Used to check "find the brightest frame". */
export function brightness(h: Float32Array): number {
  let all = 0, high = 0;
  for (let n = 1; n < h.length; n++) { const e = h[n]! * h[n]!; all += e; if (n > 5) high += e; }
  return all ? high / all : 0;
}
