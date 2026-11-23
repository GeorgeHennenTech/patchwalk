// The practice synth's settings. One flat, typed state object is the single source of truth: the audio
// engine renders it, the controls edit it, and lessons check it. Units are exact (Hz, dB, cents, degrees)
// because this is our own instrument.
import { fft, harmonicsOf, type Morph } from "./wtedit";

export const SHAPES = ["sine", "triangle", "square", "saw"] as const;
export type Shape = (typeof SHAPES)[number];
export const TABLES = ["none", "basic", "bright", "vowel", "pdsaw", "moogsaw", "pdpulse", "formant", "pdsquare", "tanhsquare", "tanhsaw",
  "tilt", "oddeven", "ladder", "scatter", "pwm", "tricorner", "syncsaw", "bits", "rect", "power", "blit", "fm1", "fm2", "fm3", "sinefold", "vowels", "band", "gap", "stack", "organ", "comb", "glass", "grain"] as const;
const TABLE_NAMES = { none: "Off", basic: "Basic morph", bright: "Bright sweep", vowel: "Vowel", pdsaw: "Phase saw", moogsaw: "Analogue saw", pdpulse: "Phase pulse", formant: "Formant", pdsquare: "Phase square", tanhsquare: "Driven square", tanhsaw: "Driven saw",
  tilt: "Dark to bright", oddeven: "Hollow to full", ladder: "One harmonic at a time", scatter: "Same sound, new shape", pwm: "Pulse width", tricorner: "Triangle to saw", syncsaw: "Sync sweep", bits: "Staircase",
  rect: "Sine, half sine, humps", power: "Spike to block", blit: "Impulse train", fm1: "FM 1 to 1", fm2: "FM 1 to 2", fm3: "FM 1 to 3", sinefold: "Folded sine", vowels: "Vowels A E I O U", band: "Moving band",
  gap: "Moving gap", stack: "Octave and fifth stack", organ: "Organ stops", comb: "Every nth harmonic", glass: "Glass", grain: "Shifting grain" };
/** The wavetable menu in groups, in the order shown. Every table is in exactly one group (a test checks). */
export const TABLE_GROUPS: [string, readonly (typeof TABLES)[number][]][] = [
  ["Basics", ["basic", "bright", "tilt", "oddeven", "ladder", "scatter"]],
  ["Classic shapes", ["pwm", "tricorner", "syncsaw", "bits", "rect", "power", "blit"]],
  ["From research papers", ["pdsaw", "moogsaw", "pdpulse", "pdsquare", "tanhsquare", "tanhsaw", "formant"]],
  ["FM and folding", ["fm1", "fm2", "fm3", "sinefold"]],
  ["Voices and bands", ["vowel", "vowels", "band", "gap"]],
  ["Stacks and textures", ["stack", "organ", "comb", "glass", "grain"]],
];
export const tableName = (t: Table): string => (isUserTable(t) ? USER.get(t)?.name ?? "Missing table" : TABLE_NAMES[t]);
/** Where a table's shapes come from, for the tables built from a published formula. Shown under the wave picture. */
export const TABLE_NOTES: Partial<Record<(typeof TABLES)[number], string>> = {
  pdsaw: "A sine bent toward a saw by phase distortion, the method of the Casio CZ synths. Formula from Lazzarini and others, 2009.",
  moogsaw: "The phase-distortion saw fitted to recordings of a Minimoog Voyager: rounder for high notes, sharper for low ones. Fit from Pekonen and others, 2011.",
  pdpulse: "One cycle of a sine squeezed into part of the period, then held: a pulse whose width follows the position. Formula from Kleimola and others, 2011.",
  pdsquare: "Phase distortion with two bends in each cycle, which leaves only odd harmonics: a sine bent toward a square. After Lazzarini and others, 2009.",
  tanhsquare: "A sine pushed harder and harder through a soft limit until it is nearly a square. Formula from Lazzarini and Timoney, 2010.",
  tanhsaw: "That driven square multiplied by a raised cosine, which puts the even harmonics back and gives a saw-like wave. Formula from Lazzarini and Timoney, 2010.",
  formant: "A sine run several times per cycle to make one strong band that climbs with the position. Formula from Kleimola and others, 2011.",
  tilt: "A saw whose harmonics fall away steeply at first and then less and less: dull to bright without a filter.",
  oddeven: "Odd harmonics only at the start, which sounds hollow. The even ones fade in until it is a full saw.",
  ladder: "Sixteen frames, each a single harmonic. Sweep the position and you climb the harmonic series one step at a time.",
  scatter: "Every frame has a saw's harmonics at a saw's strengths. Only their timing differs, so the picture changes far more than the sound.",
  pwm: "A square whose high part gets narrower, from half the cycle down to a sliver. Even harmonics appear as soon as it leaves the middle.",
  tricorner: "A triangle whose corner slides from the middle to the edge until it is a saw. The spectrum of this shape is worked out in Puckette's book, pages 305 to 307.",
  syncsaw: "A saw restarted before it finishes, run through the cycle from once to eight times. The sound of hard sync, stored as a table.",
  bits: "A saw cut into flat steps, from two levels up to thirty-two. Few steps are harsh; many are nearly smooth.",
  rect: "A sine, then a sine with its lower half removed, then with its lower half flipped up, which sounds an octave higher.",
  power: "A sine sharpened into thin spikes at one end and flattened toward a block at the other.",
  blit: "Harmonics of equal strength, starting with one and adding more: a click repeated at the pitch of the note. The band-limited impulse train of Stilson and Smith, 1996.",
  fm1: "A sine whose pitch is shaken by another sine at the same pitch, harder and harder. All harmonics appear. Frequency modulation as in Chowning, 1973.",
  fm2: "The same with the shaking sine an octave above: only odd harmonics appear, as Chowning's paper says for this ratio.",
  fm3: "The same with the shaking sine three times the pitch: every third harmonic is missing.",
  sinefold: "A sine turned up until it folds back on itself, again and again. Each fold adds higher harmonics.",
  vowels: "A saw with three lifted bands placed for five vowels. The band places are approximate figures for a low voice, chosen by us with no source in the library, and they are right only near a low A: higher notes shift the vowel.",
  band: "A narrow group of harmonics that climbs from the bottom to the top, with everything else turned down.",
  gap: "A saw with a hole in it. The hole climbs through the harmonics as the position rises.",
  stack: "A saw, then the same saw with copies added an octave up, an octave and a fifth up, and two octaves up.",
  organ: "Pure tones added one at a time at the harmonics an organ's stops use: the first, second, third, fourth, sixth and eighth.",
  comb: "The first frame keeps every harmonic, the next every second one, then every third, up to every eighth.",
  glass: "A few widely spaced harmonics, with more joining as the position rises. Not a real bell: a bell's tones are not harmonics.",
  grain: "Eight frames of harmonics at strengths picked by a fixed random list. Moving the position gives a slowly changing, unsettled tone.",
};
export type BuiltInTable = (typeof TABLES)[number];
/** A wavetable the learner made in the editor: "u:" and its id. */
export type UserTableId = `u:${string}`;
export type Table = BuiltInTable | UserTableId;
export const isUserTable = (t: string): t is UserTableId => t.startsWith("u:");
export const NOISES = ["white", "pink"] as const;
// Kept here (not in filter.ts) so this file stays free of imports from the modules that depend on it.
const FILTER_TYPES = ["low", "high", "band", "notch", "peak", "shelf"] as const;
const FILTER_ROUTES = ["series", "parallel"] as const;
const FILTER_NAMES = { low: "Low-pass", high: "High-pass", band: "Band-pass", notch: "Notch", peak: "Peak", shelf: "Shelf" };
const SLOPES = ["12", "24"] as const;
/** Settings an envelope or LFO can move. "none" means it is not connected. */
/**
 * Two kinds of destination. The ones listed here are moved inside the audio itself, smoothly and separately
 * for every note. Every other knob can be a destination too (see SLOW_DESTS further down): those are moved
 * by code about fifty times a second, following the most recent note.
 */
export const FAST_DESTS = ["none", "cutoff", "fine", "bFine", "aLevelDb", "bLevelDb", "subLevelDb", "noiseLevelDb", "lfo1Rate", "noteLevel", "fmAmount", "aPitchWide"] as const;
/** Every destination, fast ones first. Filled in below, once the knobs themselves are defined. */
export const MOD_DESTS: string[] = [...FAST_DESTS];
/** Ways of reshaping oscillator A's wave by reading it at an uneven speed. "none" leaves it alone. */
export const WARPS = ["none", "bend", "mirror", "sync", "pd", "flip", "steps", "fold", "diode"] as const;
const WARP_NAMES = { none: "Off", bend: "Bend", mirror: "Mirror", sync: "Sync", pd: "Squeeze", flip: "Flip", steps: "Steps", fold: "Fold", diode: "Circuit fold" };
export type Warp = (typeof WARPS)[number];
const WAYS = ["both", "up"] as const;
/** How an envelope falls during its decay and release: at an even rate, easing off, or dropping fast then lingering. */
/** LFO shapes: the four basic waves, or sixteen steps the learner draws. */
export const LFO_SHAPES = ["sine", "triangle", "square", "saw", "drawn", "curve"] as const;
/** The two shapes made from the sixteen drawn values: "drawn" holds each value as a flat step, "curve" joins them with straight lines. */
export const isDrawn = (shape: string) => shape === "drawn" || shape === "curve";
export type LfoShape = (typeof LFO_SHAPES)[number];
export const LFO_STEPS = 16;
/** An LFO synced to the tempo repeats once every this many beats. */
export const DIVISIONS = ["4", "2", "1", "1/2", "1/3", "1/4"] as const;
const SYNCS = ["hz", "beat"] as const;
export const DIST_TYPES = ["soft", "hard", "fold", "crush"] as const;
const DELAY_SYNCS = ["ms", "beat"] as const;
const TRIGS = ["retrig", "free"] as const;
export const BENDS = ["straight", "eased", "sharp"] as const;
export type Dest = string;
export const DEST_NAMES: Record<string, string> = { none: "Nothing", cutoff: "Filter cutoff", fine: "Osc A pitch", bFine: "Osc B pitch", aLevelDb: "Osc A level", bLevelDb: "Osc B level", subLevelDb: "Sub level", noiseLevelDb: "Noise level", lfo1Rate: "LFO 1 rate", noteLevel: "Note level", fmAmount: "FM from B", aPitchWide: "Osc A pitch, wide" };

/** One extra connection made in the matrix: a source, what it moves, how far, and (for an LFO) which way. */
export interface MatrixRow { source: "env2" | "lfo1" | "lfo2" | "lfo3" | "vel" | "key" | "wheel"; dest: Dest; amount: number; way: "both" | "up"; /** A second source that scales this row: at its lowest the row does nothing, at its highest the row has its full amount. */ aux?: "env2" | "lfo1" | "lfo2" | "lfo3" | "vel" | "key" | "wheel" }
/** The most rows the matrix holds, on top of each source's own first connection. */
export const MATRIX_MAX = 8;

export interface SynthState {
  /** Master level in dB. 0 is the loudest the lesson synth goes. */
  volumeDb: number;
  // ---- oscillator A
  /** Whether oscillator A is heard. Switched off, it is silent but can still be shaken by B (FM) or anything else. */
  aOn: boolean;
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
  /** Warp: how oscillator A's wave is reshaped (see `warpPhase`), and how far, 0..100. */
  warp: Warp; warpAmount: number;
  /** FM from B: how far oscillator B (heard or not) shakes A's pitch, 0..100. 100 is an index of FM_MAX_INDEX. */
  fmAmount: number;
  /** Ring modulation from B: 0 is A alone, 100 is A multiplied by B. */
  ringAmount: number;
  /** Oscillator B's own warp, unison voices (1 to 7) and their total detune in cents. */
  bWarp: Warp; bWarpAmount: number; bVoices: number; bDetune: number;
  // ---- unison on oscillator A
  voices: number;
  /** Total spread of the unison voices in cents (outermost voices are +/- half of this). */
  detune: number;
  /** Stereo spread of the unison voices, 0..100. */
  spread: number;
  // ---- oscillator B
  bOn: boolean;
  bShape: Shape;
  /** Oscillator B's own wavetable and where in it to read, as on A. */
  bTable: Table; bPosition: number;
  /** Where each oscillator sits between the speakers: -100 hard left, 0 centre, 100 hard right. */
  aPan: number; bPan: number;
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
  /** The second filter: one gentle stage with its own type, cutoff and resonance. */
  filter2On: boolean;
  filter2Type: (typeof FILTER_TYPES)[number];
  cutoff2: number;
  resonance2: number;
  /** One after the other (series), or side by side with their outputs added (parallel). */
  filterRoute: (typeof FILTER_ROUTES)[number];
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
  // ---- envelope 1: the level of every note (see mod.ts). Times in milliseconds, sustain in percent.
  envA: number; envD: number; envS: number; envR: number;
  /** Hold: how long the envelope stays at full level after the attack, in ms. */
  envH: number; env2H: number;
  envBend: (typeof BENDS)[number]; env2Bend: (typeof BENDS)[number];
  // ---- envelope 2: free to send to one destination
  env2A: number; env2D: number; env2S: number; env2R: number;
  env2Dest: Dest;
  /** How far the source moves its destination, -100..100. */
  env2Amount: number;
  // ---- three LFOs, each restarting with every note. Rate in Hz.
  lfo1Rate: number; lfo1Shape: LfoShape; lfo1Dest: Dest; lfo1Amount: number;
  lfo2Rate: number; lfo2Shape: LfoShape; lfo2Dest: Dest; lfo2Amount: number;
  lfo3Rate: number; lfo3Shape: LfoShape; lfo3Dest: Dest; lfo3Amount: number;
  /** Tempo in beats per minute, and whether the click that marks the beat is sounding. */
  bpm: number; clickOn: boolean;
  /** Per LFO: speed set in Hz or in beats; which division of the beat; restart with each note or run free
   *  against the tempo clock; a fade-in time in ms; and the sixteen drawn steps (-1..1) for the "drawn" shape. */
  lfo1Sync: (typeof SYNCS)[number]; lfo1Div: (typeof DIVISIONS)[number]; lfo1Trig: (typeof TRIGS)[number]; lfo1Rise: number; lfo1Steps: number[];
  lfo2Sync: (typeof SYNCS)[number]; lfo2Div: (typeof DIVISIONS)[number]; lfo2Trig: (typeof TRIGS)[number]; lfo2Rise: number; lfo2Steps: number[];
  lfo3Sync: (typeof SYNCS)[number]; lfo3Div: (typeof DIVISIONS)[number]; lfo3Trig: (typeof TRIGS)[number]; lfo3Rise: number; lfo3Steps: number[];
  /** Whether each LFO pushes its destination both ways from the knob ("both") or one way only ("up"). */
  lfo1Way: (typeof WAYS)[number]; lfo2Way: (typeof WAYS)[number]; lfo3Way: (typeof WAYS)[number];
  // ---- two sources that are fixed for the length of a note: how hard it was struck, and which key it was
  velDest: Dest; velAmount: number;
  keyDest: Dest; keyAmount: number;
  // ---- the mod wheel: a source you move by hand while playing (0 to 100), and how far the bend wheel reaches
  wheel: number; wheelDest: Dest; wheelAmount: number;
  /** How many semitones the pitch-bend wheel moves the pitch at either end. */
  bendRange: number;
  // ---- voicing: how many notes at once, and whether the pitch slides between notes
  /** "poly" plays every key held; "mono" plays one note at a time (the last key pressed). */
  voiceMode: "poly" | "mono";
  /** Mono only: when a new key is pressed while another is held, carry on the same note without starting its envelopes again. */
  legato: "off" | "on";
  /** How long the pitch takes to slide from the previous note, in ms. 0 is no slide. */
  glide: number;
  /** Slide on every note ("always"), or only when the new key is pressed while another is still held ("legato"). */
  glideMode: "always" | "legato";
  /** The arpeggiator: held keys are played one at a time, in step with the tempo (see arp.ts). */
  arpOn: "off" | "on"; arpMode: "up" | "down" | "updown" | "played"; arpDiv: "1" | "2" | "3" | "4"; arpOctaves: number; arpGate: number;
  /** Extra connections added in the matrix, so one source can move several things. Replaced on every edit. */
  matrix: MatrixRow[];
  /** The order the effects are joined in, first to last (names from fx.ts). */
  fxOrder: string[];
  // ---- effects, in the order the sound passes through them (see fx.ts)
  distOn: boolean; distType: (typeof DIST_TYPES)[number];
  /** Distortion drive 0..100 (how hard the signal is pushed into the shaping) and how much of the result is mixed in. */
  distDrive: number; distMix: number;
  /** EQ: three bands, each a boost or cut in dB. The middle band's frequency can be moved. */
  eqOn: boolean; eqLow: number; eqMid: number; eqMidHz: number; eqHigh: number;
  /** Compressor: threshold in dB, ratio (to one), attack and release in ms, and make-up gain in dB. */
  compOn: boolean; compThreshold: number; compRatio: number; compAttack: number; compRelease: number; compMakeup: number;
  chorusOn: boolean; chorusRate: number; chorusDepth: number; chorusMix: number;
  /** Flanger: a very short swept delay added to the sound. Phaser: swept all-pass stages added to the sound. */
  flangerOn: boolean; flangerRate: number; flangerDepth: number; flangerFeedback: number; flangerMix: number;
  phaserOn: boolean; phaserRate: number; phaserDepth: number; phaserCentre: number; phaserMix: number;
  /** Delay: echo spacing in ms or in beats, how much of each echo is fed back (0..95%), and the echo level. */
  delayOn: boolean; delaySync: (typeof DELAY_SYNCS)[number]; delayDiv: (typeof DIVISIONS)[number]; delayTime: number; delayFeedback: number; delayMix: number;
  /** Reverb: how long the tail takes to die away, in seconds, and its level. */
  reverbOn: boolean; reverbSize: number; reverbMix: number;
  // ---- four macros: one knob each (0..100), a name, and three slots that each move another control.
  // A slot's destination is the id of any knob, or "none"; its amount is how much of that knob's travel
  // the macro covers when turned right up (-100..100). See macros.ts.
  macro1: number; macro1Name: string; macro1Dest1: string; macro1Amt1: number; macro1Dest2: string; macro1Amt2: number; macro1Dest3: string; macro1Amt3: number;
  macro2: number; macro2Name: string; macro2Dest1: string; macro2Amt1: number; macro2Dest2: string; macro2Amt2: number; macro2Dest3: string; macro2Amt3: number;
  macro3: number; macro3Name: string; macro3Dest1: string; macro3Amt1: number; macro3Dest2: string; macro3Amt2: number; macro3Dest3: string; macro3Amt3: number;
  macro4: number; macro4Name: string; macro4Dest1: string; macro4Amt1: number; macro4Dest2: string; macro4Amt2: number; macro4Dest3: string; macro4Amt3: number;
}

/** The drawn shape starts as a staircase down, so it sounds different from the basic shapes straight away. */
const DEFAULT_STEPS: number[] = Array.from({ length: LFO_STEPS }, (_, i) => Number((1 - (2 * Math.floor(i / 2)) / 7).toFixed(3)));

export const INITIAL: SynthState = {
  volumeDb: -12, aOn: true, shape: "saw", table: "none", position: 0, octave: 0, semitone: 0, fine: 0, phase: 0, randomPhase: 0, freeHz: null, aLevelDb: 0,
  warp: "none", warpAmount: 0, fmAmount: 0, ringAmount: 0,
  voices: 1, detune: 0, spread: 0,
  bWarp: "none", bWarpAmount: 0, bVoices: 1, bDetune: 0,
  bOn: false, bShape: "saw", bTable: "none", bPosition: 0, aPan: 0, bPan: 0, bOctave: 0, bSemitone: 0, bFine: 0, bPhase: 0, bLevelDb: 0,
  subOn: false, subOctave: -1, subLevelDb: -6, noiseOn: false, noiseType: "white", noiseLevelDb: -18,
  filterOn: false, filterType: "low", cutoff: 20000, resonance: 0, slope: "12", drive: 0, keyTrack: 0,
  filter2On: false, filter2Type: "high", cutoff2: 200, resonance2: 0, filterRoute: "series",
  envA: 5, envD: 300, envS: 100, envR: 30, envH: 0, env2H: 0, envBend: "eased", env2Bend: "eased",
  env2A: 5, env2D: 400, env2S: 0, env2R: 100, env2Dest: "none", env2Amount: 50,
  lfo1Rate: 2, lfo1Shape: "sine", lfo1Dest: "none", lfo1Amount: 30,
  lfo2Rate: 5, lfo2Shape: "triangle", lfo2Dest: "none", lfo2Amount: 30,
  lfo3Rate: 0.5, lfo3Shape: "saw", lfo3Dest: "none", lfo3Amount: 30,
  lfo1Way: "both", lfo2Way: "both", lfo3Way: "both",
  bpm: 120, clickOn: false,
  lfo1Sync: "hz", lfo1Div: "1", lfo1Trig: "retrig", lfo1Rise: 0, lfo1Steps: DEFAULT_STEPS,
  lfo2Sync: "hz", lfo2Div: "1", lfo2Trig: "retrig", lfo2Rise: 0, lfo2Steps: DEFAULT_STEPS,
  lfo3Sync: "hz", lfo3Div: "1", lfo3Trig: "retrig", lfo3Rise: 0, lfo3Steps: DEFAULT_STEPS,
  velDest: "none", velAmount: 60, keyDest: "none", keyAmount: 50, wheel: 0, wheelDest: "none", wheelAmount: 50, bendRange: 2,
  matrix: [],
  fxOrder: ["dist", "eq", "comp", "chorus", "flanger", "phaser", "delay", "reverb"],
  voiceMode: "poly", legato: "off", glide: 0, glideMode: "always",
  arpOn: "off", arpMode: "up", arpDiv: "2", arpOctaves: 1, arpGate: 60,
  distOn: false, distType: "soft", distDrive: 30, distMix: 100,
  eqOn: false, eqLow: 0, eqMid: 0, eqMidHz: 1000, eqHigh: 0,
  compOn: false, compThreshold: -24, compRatio: 4, compAttack: 10, compRelease: 150, compMakeup: 0,
  chorusOn: false, chorusRate: 0.8, chorusDepth: 50, chorusMix: 50,
  flangerOn: false, flangerRate: 0.3, flangerDepth: 70, flangerFeedback: 40, flangerMix: 70,
  phaserOn: false, phaserRate: 0.4, phaserDepth: 60, phaserCentre: 800, phaserMix: 80,
  delayOn: false, delaySync: "ms", delayDiv: "1/2", delayTime: 300, delayFeedback: 40, delayMix: 35,
  reverbOn: false, reverbSize: 2, reverbMix: 30,
  macro1: 0, macro1Name: "Macro 1", macro1Dest1: "none", macro1Amt1: 50, macro1Dest2: "none", macro1Amt2: 50, macro1Dest3: "none", macro1Amt3: 50,
  macro2: 0, macro2Name: "Macro 2", macro2Dest1: "none", macro2Amt1: 50, macro2Dest2: "none", macro2Amt2: 50, macro2Dest3: "none", macro2Amt3: 50,
  macro3: 0, macro3Name: "Macro 3", macro3Dest1: "none", macro3Amt1: 50, macro3Dest2: "none", macro3Amt2: 50, macro3Dest3: "none", macro3Amt3: 50,
  macro4: 0, macro4Name: "Macro 4", macro4Dest1: "none", macro4Amt1: 50, macro4Dest2: "none", macro4Amt2: 50, macro4Dest3: "none", macro4Amt3: 50,
};

export type Group = "Master" | "Oscillator A" | "Unison" | "Oscillator B" | "Sub" | "Noise" | "Filter" | "Filter 2" | "Envelope 1" | "Envelope 2" | "LFO 1" | "LFO 2" | "LFO 3" | "Velocity" | "Mod wheel" | "Key position" | "Voicing" | "Distortion" | "EQ" | "Compressor" | "Chorus" | "Flanger" | "Phaser" | "Delay" | "Reverb" | "Macro 1" | "Macro 2" | "Macro 3" | "Macro 4";

export interface ParamSpec {
  id: keyof SynthState;
  label: string;
  group: Group;
  kind: "range" | "choice" | "toggle" | "menu";
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

const DIVISION_NAMES = { "4": "4 beats (a bar)", "2": "2 beats", "1": "1 beat", "1/2": "Half a beat", "1/3": "A third of a beat", "1/4": "A quarter of a beat" };
const SHAPE_NAMES = { sine: "Sine", triangle: "Triangle", square: "Square", saw: "Saw" };

const BASE_PARAMS: Record<string, ParamSpec> = {
  volumeDb: { id: "volumeDb", label: "Volume", group: "Master", kind: "range", min: -48, max: 0, step: 1, unit: "dB" },
  bpm: { id: "bpm", label: "Tempo", group: "Master", kind: "range", min: 60, max: 200, step: 1, unit: "bpm" },
  clickOn: { id: "clickOn", label: "Click", group: "Master", kind: "toggle" },
  aOn: { id: "aOn", label: "Osc A", group: "Oscillator A", kind: "toggle" },
  shape: { id: "shape", label: "Wave shape", group: "Oscillator A", kind: "choice", choices: SHAPES, names: SHAPE_NAMES },
  table: { id: "table", label: "Wavetable", group: "Oscillator A", kind: "menu", choices: TABLES, names: TABLE_NAMES },
  aPan: { id: "aPan", label: "A pan", group: "Oscillator A", kind: "range", min: -100, max: 100, step: 1, unit: "" },
  position: { id: "position", label: "Position", group: "Oscillator A", kind: "range", min: 0, max: 100, step: 1, unit: "%" },
  octave: { id: "octave", label: "Octave", group: "Oscillator A", kind: "range", min: -3, max: 3, step: 1, unit: "oct" },
  semitone: { id: "semitone", label: "Semitone", group: "Oscillator A", kind: "range", min: -12, max: 12, step: 1, unit: "st" },
  fine: { id: "fine", label: "Fine", group: "Oscillator A", kind: "range", min: -100, max: 100, step: 1, unit: "cents" },
  phase: { id: "phase", label: "Phase", group: "Oscillator A", kind: "range", min: 0, max: 360, step: 5, unit: "°" },
  randomPhase: { id: "randomPhase", label: "Random phase", group: "Oscillator A", kind: "range", min: 0, max: 100, step: 5, unit: "%" },
  freeHz: { id: "freeHz", label: "Frequency", group: "Oscillator A", kind: "range", min: 55, max: 1760, step: 1, log: true, unit: "Hz" },
  aLevelDb: { id: "aLevelDb", label: "A level", group: "Oscillator A", kind: "range", min: -48, max: 0, step: 1, unit: "dB" },
  warp: { id: "warp", label: "Warp", group: "Oscillator A", kind: "menu", choices: WARPS, names: WARP_NAMES },
  warpAmount: { id: "warpAmount", label: "Warp amount", group: "Oscillator A", kind: "range", min: 0, max: 100, step: 1, unit: "%" },
  fmAmount: { id: "fmAmount", label: "FM from B", group: "Oscillator A", kind: "range", min: 0, max: 100, step: 1, unit: "%" },
  ringAmount: { id: "ringAmount", label: "Ring from B", group: "Oscillator A", kind: "range", min: 0, max: 100, step: 1, unit: "%" },
  voices: { id: "voices", label: "Voices", group: "Unison", kind: "range", min: 1, max: 7, step: 1, unit: "" },
  detune: { id: "detune", label: "Detune", group: "Unison", kind: "range", min: 0, max: 100, step: 1, unit: "cents" },
  spread: { id: "spread", label: "Spread", group: "Unison", kind: "range", min: 0, max: 100, step: 5, unit: "%" },
  bOn: { id: "bOn", label: "Osc B", group: "Oscillator B", kind: "toggle" },
  bShape: { id: "bShape", label: "B shape", group: "Oscillator B", kind: "choice", choices: SHAPES, names: SHAPE_NAMES },
  bOctave: { id: "bOctave", label: "B octave", group: "Oscillator B", kind: "range", min: -3, max: 3, step: 1, unit: "oct" },
  bSemitone: { id: "bSemitone", label: "B semitone", group: "Oscillator B", kind: "range", min: -12, max: 12, step: 1, unit: "st" },
  bTable: { id: "bTable", label: "B wavetable", group: "Oscillator B", kind: "menu", choices: TABLES, names: TABLE_NAMES },
  bPosition: { id: "bPosition", label: "B position", group: "Oscillator B", kind: "range", min: 0, max: 100, step: 1, unit: "%" },
  bWarp: { id: "bWarp", label: "B warp", group: "Oscillator B", kind: "menu", choices: WARPS, names: WARP_NAMES },
  bWarpAmount: { id: "bWarpAmount", label: "B warp amount", group: "Oscillator B", kind: "range", min: 0, max: 100, step: 1, unit: "%" },
  bVoices: { id: "bVoices", label: "B voices", group: "Oscillator B", kind: "range", min: 1, max: 7, step: 1, unit: "" },
  bDetune: { id: "bDetune", label: "B detune", group: "Oscillator B", kind: "range", min: 0, max: 100, step: 1, unit: "cents" },
  bPan: { id: "bPan", label: "B pan", group: "Oscillator B", kind: "range", min: -100, max: 100, step: 1, unit: "" },
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
  filterType: { id: "filterType", label: "Filter type", group: "Filter", kind: "choice", choices: FILTER_TYPES, names: FILTER_NAMES },
  cutoff: { id: "cutoff", label: "Cutoff", group: "Filter", kind: "range", min: 20, max: 20000, step: 1, log: true, unit: "Hz" },
  resonance: { id: "resonance", label: "Resonance", group: "Filter", kind: "range", min: 0, max: 100, step: 1, unit: "%" },
  slope: { id: "slope", label: "Slope", group: "Filter", kind: "choice", choices: SLOPES, names: { "12": "Gentle (12)", "24": "Steep (24)" } },
  drive: { id: "drive", label: "Drive", group: "Filter", kind: "range", min: 0, max: 100, step: 1, unit: "%" },
  keyTrack: { id: "keyTrack", label: "Key track", group: "Filter", kind: "range", min: 0, max: 100, step: 5, unit: "%" },
  filter2On: { id: "filter2On", label: "Filter 2", group: "Filter 2", kind: "toggle" },
  filter2Type: { id: "filter2Type", label: "Filter 2 type", group: "Filter 2", kind: "choice", choices: FILTER_TYPES, names: FILTER_NAMES },
  cutoff2: { id: "cutoff2", label: "Filter 2 cutoff", group: "Filter 2", kind: "range", min: 20, max: 20000, step: 1, log: true, unit: "Hz" },
  resonance2: { id: "resonance2", label: "Filter 2 resonance", group: "Filter 2", kind: "range", min: 0, max: 100, step: 1, unit: "%" },
  filterRoute: { id: "filterRoute", label: "Filter 2 sits", group: "Filter 2", kind: "choice", choices: FILTER_ROUTES, names: { series: "After filter 1", parallel: "Beside filter 1" } },
  ...envelope("env", "Envelope 1", "Env 1"),
  ...envelope("env2", "Envelope 2", "Env 2"),
  ...source("env2", "Envelope 2", "Env 2"),
  ...lfo(1), ...lfo(2), ...lfo(3),
  ...source("vel", "Velocity", "Velocity"),
  ...source("key", "Key position", "Key position"),
  wheel: { id: "wheel", label: "Mod wheel", group: "Mod wheel", kind: "range", min: 0, max: 100, step: 1, unit: "%" },
  ...source("wheel", "Mod wheel", "Mod wheel"),
  bendRange: { id: "bendRange", label: "Bend range", group: "Voicing", kind: "range", min: 1, max: 24, step: 1, unit: "st" },
  voiceMode: { id: "voiceMode", label: "Voices play", group: "Voicing", kind: "choice", choices: ["poly", "mono"], names: { poly: "Poly", mono: "Mono" } },
  legato: { id: "legato", label: "Legato", group: "Voicing", kind: "choice", choices: ["off", "on"], names: { off: "Off", on: "On" } },
  glideMode: { id: "glideMode", label: "Glide on", group: "Voicing", kind: "choice", choices: ["always", "legato"], names: { always: "Every note", legato: "Overlapped notes" } },
  glide: { id: "glide", label: "Glide", group: "Voicing", kind: "range", min: 0, max: 2000, step: 5, unit: "ms" },
  arpOn: { id: "arpOn", label: "Arpeggiator", group: "Voicing", kind: "choice", choices: ["off", "on"], names: { off: "Off", on: "On" } },
  arpMode: { id: "arpMode", label: "Arp order", group: "Voicing", kind: "choice", choices: ["up", "down", "updown", "played"], names: { up: "Up", down: "Down", updown: "Up and down", played: "As played" } },
  arpDiv: { id: "arpDiv", label: "Arp steps per beat", group: "Voicing", kind: "choice", choices: ["1", "2", "3", "4"], names: { "1": "1", "2": "2", "3": "3", "4": "4" } },
  arpOctaves: { id: "arpOctaves", label: "Arp octaves", group: "Voicing", kind: "range", min: 1, max: 3, step: 1, unit: "" },
  arpGate: { id: "arpGate", label: "Arp note length", group: "Voicing", kind: "range", min: 10, max: 100, step: 5, unit: "%" },
  distOn: { id: "distOn", label: "Distortion", group: "Distortion", kind: "toggle" },
  distType: { id: "distType", label: "Distortion type", group: "Distortion", kind: "choice", choices: DIST_TYPES, names: { soft: "Soft clip", hard: "Hard clip", fold: "Fold", crush: "Crush" } },
  distDrive: { id: "distDrive", label: "Distortion drive", group: "Distortion", kind: "range", min: 0, max: 100, step: 1, unit: "%" },
  distMix: { id: "distMix", label: "Distortion mix", group: "Distortion", kind: "range", min: 0, max: 100, step: 1, unit: "%" },
  eqOn: { id: "eqOn", label: "EQ", group: "EQ", kind: "toggle" },
  eqLow: { id: "eqLow", label: "EQ low", group: "EQ", kind: "range", min: -18, max: 18, step: 0.5, unit: "dB" },
  eqMid: { id: "eqMid", label: "EQ mid", group: "EQ", kind: "range", min: -18, max: 18, step: 0.5, unit: "dB" },
  eqMidHz: { id: "eqMidHz", label: "EQ mid frequency", group: "EQ", kind: "range", min: 200, max: 5000, step: 1, log: true, unit: "Hz" },
  eqHigh: { id: "eqHigh", label: "EQ high", group: "EQ", kind: "range", min: -18, max: 18, step: 0.5, unit: "dB" },
  compOn: { id: "compOn", label: "Compressor", group: "Compressor", kind: "toggle" },
  compThreshold: { id: "compThreshold", label: "Compressor threshold", group: "Compressor", kind: "range", min: -60, max: 0, step: 1, unit: "dB" },
  compRatio: { id: "compRatio", label: "Compressor ratio", group: "Compressor", kind: "range", min: 1, max: 20, step: 0.5, unit: ":1" },
  compAttack: { id: "compAttack", label: "Compressor attack", group: "Compressor", kind: "range", min: 1, max: 200, step: 1, log: true, unit: "ms" },
  compRelease: { id: "compRelease", label: "Compressor release", group: "Compressor", kind: "range", min: 20, max: 1000, step: 1, log: true, unit: "ms" },
  compMakeup: { id: "compMakeup", label: "Compressor make-up", group: "Compressor", kind: "range", min: 0, max: 24, step: 0.5, unit: "dB" },
  chorusOn: { id: "chorusOn", label: "Chorus", group: "Chorus", kind: "toggle" },
  chorusRate: { id: "chorusRate", label: "Chorus rate", group: "Chorus", kind: "range", min: 0.1, max: 5, step: 0.01, log: true, unit: "Hz" },
  chorusDepth: { id: "chorusDepth", label: "Chorus depth", group: "Chorus", kind: "range", min: 0, max: 100, step: 1, unit: "%" },
  chorusMix: { id: "chorusMix", label: "Chorus mix", group: "Chorus", kind: "range", min: 0, max: 100, step: 1, unit: "%" },
  flangerOn: { id: "flangerOn", label: "Flanger", group: "Flanger", kind: "toggle" },
  flangerRate: { id: "flangerRate", label: "Flanger rate", group: "Flanger", kind: "range", min: 0.05, max: 5, step: 0.01, log: true, unit: "Hz" },
  flangerDepth: { id: "flangerDepth", label: "Flanger depth", group: "Flanger", kind: "range", min: 0, max: 100, step: 1, unit: "%" },
  flangerFeedback: { id: "flangerFeedback", label: "Flanger feedback", group: "Flanger", kind: "range", min: 0, max: 90, step: 1, unit: "%" },
  flangerMix: { id: "flangerMix", label: "Flanger mix", group: "Flanger", kind: "range", min: 0, max: 100, step: 1, unit: "%" },
  phaserOn: { id: "phaserOn", label: "Phaser", group: "Phaser", kind: "toggle" },
  phaserRate: { id: "phaserRate", label: "Phaser rate", group: "Phaser", kind: "range", min: 0.05, max: 5, step: 0.01, log: true, unit: "Hz" },
  phaserDepth: { id: "phaserDepth", label: "Phaser depth", group: "Phaser", kind: "range", min: 0, max: 100, step: 1, unit: "%" },
  phaserCentre: { id: "phaserCentre", label: "Phaser centre", group: "Phaser", kind: "range", min: 200, max: 4000, step: 1, log: true, unit: "Hz" },
  phaserMix: { id: "phaserMix", label: "Phaser mix", group: "Phaser", kind: "range", min: 0, max: 100, step: 1, unit: "%" },
  delayOn: { id: "delayOn", label: "Delay", group: "Delay", kind: "toggle" },
  delaySync: { id: "delaySync", label: "Delay time in", group: "Delay", kind: "choice", choices: DELAY_SYNCS, names: { ms: "ms", beat: "Beats" } },
  delayDiv: { id: "delayDiv", label: "Delay repeats every", group: "Delay", kind: "menu", choices: DIVISIONS, names: DIVISION_NAMES },
  delayTime: { id: "delayTime", label: "Delay time", group: "Delay", kind: "range", min: 20, max: 1000, step: 1, log: true, unit: "ms" },
  delayFeedback: { id: "delayFeedback", label: "Delay feedback", group: "Delay", kind: "range", min: 0, max: 95, step: 1, unit: "%" },
  delayMix: { id: "delayMix", label: "Delay mix", group: "Delay", kind: "range", min: 0, max: 100, step: 1, unit: "%" },
  reverbOn: { id: "reverbOn", label: "Reverb", group: "Reverb", kind: "toggle" },
  reverbSize: { id: "reverbSize", label: "Reverb size", group: "Reverb", kind: "range", min: 0.2, max: 8, step: 0.1, log: true, unit: "s" },
  reverbMix: { id: "reverbMix", label: "Reverb mix", group: "Reverb", kind: "range", min: 0, max: 100, step: 1, unit: "%" },
};

/**
 * Knobs that cannot be destinations: the main volume and tempo; random phase and reverb size, because
 * changing them rebuilds something too heavy to do fifty times a second.
 */
const NOT_DESTS = ["volumeDb", "bpm", "freeHz", "randomPhase", "reverbSize", "glide", "wheel", "bendRange", "arpOctaves", "arpGate"];
/** Whole-step settings shown as number boxes. A macro cannot move these. */
export const BOX_IDS = ["octave", "semitone", "bOctave", "bSemitone", "voices", "bVoices", "subOctave", "bendRange", "arpOctaves"] as const;
/** Every knob a macro can be sent to: all the continuous settings. "none" means the slot is empty. */
export const MACRO_DESTS: string[] = ["none", ...Object.values(BASE_PARAMS).filter((p) => p.kind === "range" && !(BOX_IDS as readonly string[]).includes(p.id) && p.id !== "freeHz").map((p) => p.id as string)];
/** Destinations moved at control rate: every continuous knob that is not already a fast destination. */
export const SLOW_DESTS: string[] = Object.values(BASE_PARAMS).filter((p) => p.kind === "range" && !(BOX_IDS as readonly string[]).includes(p.id) && !NOT_DESTS.includes(p.id) && !(FAST_DESTS as readonly string[]).includes(p.id)).map((p) => p.id as string);
for (const id of SLOW_DESTS) { MOD_DESTS.push(id); DEST_NAMES[id] = BASE_PARAMS[id]!.label; }
/** A destination's name as the learner sees it. */
export const destName = (dest: string) => DEST_NAMES[dest] ?? dest;
export const isSlowDest = (dest: string) => SLOW_DESTS.includes(dest);
export const MACROS = [1, 2, 3, 4] as const;
export const MACRO_SLOTS = [1, 2, 3] as const;
function macro(n: number): Record<string, ParamSpec> {
  const group = `Macro ${n}` as Group, out: Record<string, ParamSpec> = {};
  out[`macro${n}`] = { id: `macro${n}` as keyof SynthState, label: `Macro ${n}`, group, kind: "range", min: 0, max: 100, step: 1, unit: "%" };
  for (const k of MACRO_SLOTS) {
    out[`macro${n}Dest${k}`] = { id: `macro${n}Dest${k}` as keyof SynthState, label: `Macro ${n} slot ${k} sends to`, group, kind: "menu", choices: MACRO_DESTS, names: Object.fromEntries(MACRO_DESTS.map((d) => [d, d === "none" ? "Nothing" : BASE_PARAMS[d]!.label])) };
    out[`macro${n}Amt${k}`] = { id: `macro${n}Amt${k}` as keyof SynthState, label: `Macro ${n} slot ${k} amount`, group, kind: "range", min: -100, max: 100, step: 1, unit: "%" };
  }
  return out;
}
export const PARAMS: Record<string, ParamSpec> = { ...BASE_PARAMS, ...macro(1), ...macro(2), ...macro(3), ...macro(4) };

const clamp01 = (x: number) => Math.min(1, Math.max(0, x));
/** Steps smaller than one (an LFO's rate) must not pick up stray digits from floating-point sums. */
const tidy = (v: number) => Number(v.toFixed(4));
/** A setting's value as a position from 0 to 1 along its knob's travel, and back. Wide-ranging ones travel in octaves. */
export function toTravel(spec: ParamSpec, v: number): number {
  return clamp01(spec.log ? Math.log(v / spec.min!) / Math.log(spec.max! / spec.min!) : (v - spec.min!) / (spec.max! - spec.min!));
}
/** As fromTravel, but without snapping to the knob's steps: for values a source is moving smoothly. */
export function fromTravelSmooth(spec: ParamSpec, t: number): number {
  return spec.log ? spec.min! * (spec.max! / spec.min!) ** clamp01(t) : spec.min! + clamp01(t) * (spec.max! - spec.min!);
}
export function fromTravel(spec: ParamSpec, t: number): number {
  const raw = spec.log ? spec.min! * (spec.max! / spec.min!) ** clamp01(t) : spec.min! + clamp01(t) * (spec.max! - spec.min!);
  const step = spec.step ?? 1;
  return tidy(Math.min(spec.max!, Math.max(spec.min!, Math.round(raw / step) * step)));
}

function envelope(prefix: "env" | "env2", group: Group, name: string): Record<string, ParamSpec> {
  const time = (key: string, label: string): ParamSpec => ({ id: `${prefix}${key}` as keyof SynthState, label: `${name} ${label}`, group, kind: "range", min: 1, max: 5000, step: 1, log: true, unit: "ms" });
  return {
    [`${prefix}A`]: time("A", "attack"), [`${prefix}D`]: time("D", "decay"),
    [`${prefix}S`]: { id: `${prefix}S` as keyof SynthState, label: `${name} sustain`, group, kind: "range", min: 0, max: 100, step: 1, unit: "%" },
    [`${prefix}R`]: time("R", "release"),
    [`${prefix}H`]: { id: `${prefix}H` as keyof SynthState, label: `${name} hold`, group, kind: "range", min: 0, max: 2000, step: 5, unit: "ms" },
    [`${prefix}Bend`]: { id: `${prefix}Bend` as keyof SynthState, label: `${name} fall`, group, kind: "choice", choices: BENDS, names: { straight: "Straight", eased: "Eased", sharp: "Sharp" } },
  };
}
function source(prefix: "env2" | "lfo1" | "lfo2" | "lfo3" | "vel" | "key" | "wheel", group: Group, name: string): Record<string, ParamSpec> {
  return {
    [`${prefix}Dest`]: { id: `${prefix}Dest`, label: `${name} sends to`, group, kind: "menu", choices: MOD_DESTS, names: DEST_NAMES },
    [`${prefix}Amount`]: { id: `${prefix}Amount`, label: `${name} amount`, group, kind: "range", min: -100, max: 100, step: 1, unit: "%" },
  };
}
function lfo(n: 1 | 2 | 3): Record<string, ParamSpec> {
  const prefix = `lfo${n}` as const, group = `LFO ${n}` as Group, name = `LFO ${n}`;
  return {
    [`${prefix}Shape`]: { id: `${prefix}Shape`, label: `${name} shape`, group, kind: "choice", choices: LFO_SHAPES, names: { ...SHAPE_NAMES, drawn: "Drawn", curve: "Drawn, smooth" } },
    [`${prefix}Sync`]: { id: `${prefix}Sync`, label: `${name} speed in`, group, kind: "choice", choices: SYNCS, names: { hz: "Hz", beat: "Beats" } },
    [`${prefix}Div`]: { id: `${prefix}Div`, label: `${name} repeats every`, group, kind: "menu", choices: DIVISIONS, names: DIVISION_NAMES },
    [`${prefix}Trig`]: { id: `${prefix}Trig`, label: `${name} start`, group, kind: "choice", choices: TRIGS, names: { retrig: "Restart", free: "Free" } },
    [`${prefix}Rise`]: { id: `${prefix}Rise`, label: `${name} rise`, group, kind: "range", min: 0, max: 3000, step: 10, unit: "ms" },
    [`${prefix}Rate`]: { id: `${prefix}Rate`, label: `${name} rate`, group, kind: "range", min: 0.05, max: 30, step: 0.01, log: true, unit: "Hz" },
    ...source(prefix, group, name),
    [`${prefix}Way`]: { id: `${prefix}Way`, label: `${name} direction`, group, kind: "choice", choices: WAYS, names: { both: "Both ways", up: "One way" } },
  };
}

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

/**
 * How many harmonics of a wave the synth keeps. 512 is the editor's own count: a low note's saw is then as
 * bright as a real one. The browser leaves out the harmonics that would pass half the sample rate for the
 * note being played, so high notes do not fold back.
 */
export const HARMONICS = 512;
/** One cycle drawn out for measuring or warping: 16 points to a cycle of the highest harmonic. */
const CYCLE = 8192;
/** Measure one drawn-out cycle (a power of two long) as harmonics, at the scale where a full saw's first harmonic is 1. */
function measureCycle(y: ArrayLike<number>): { sin: Float32Array; cos: Float32Array } {
  const M = y.length, re = Float64Array.from(y), im = new Float64Array(M), sin = new Float32Array(HARMONICS + 1), cos = new Float32Array(HARMONICS + 1);
  fft(re, im);
  for (let n = 1; n <= HARMONICS && n < M / 2; n++) { sin[n] = (-im[n]! * Math.PI) / M; cos[n] = (re[n]! * Math.PI) / M; }
  return { sin, cos };
}
/** The other way: harmonics (at any one scale) drawn out as `size` points of one cycle, at that same scale. */
function drawCycle(sin: ArrayLike<number>, cos: ArrayLike<number> | undefined, size: number): Float64Array {
  const re = new Float64Array(size), im = new Float64Array(size);
  for (let n = 1; n < sin.length && n < size / 2; n++) {
    const s = sin[n] ?? 0, c = cos?.[n] ?? 0;
    if (!s && !c) continue;
    re[n] = c / 2; im[n] = -s / 2; re[size - n] = c / 2; im[size - n] = s / 2;
  }
  fft(re, im, true);
  return re;
}

/** One frame of a wavetable: the size of each harmonic's sine part and, for shapes that need it, its cosine part. */
interface Frame { sin: (n: number) => number; cos?: (n: number) => number }
const plain = (sin: (n: number) => number): Frame => ({ sin });
/** A frame from a drawn-out cycle: `wave(x)` for x from 0 to 1 is measured as harmonics (worked out once, on first use). */
function fromWave(wave: (x: number) => number): Frame {
  let done: { sin: Float32Array; cos: Float32Array } | undefined;
  const measure = () => {
    if (done) return done;
    // a wave that swings from -1 to 1 sits at about the level of the basic saw (whose first harmonic is 1)
    const { sin, cos } = measureCycle(Float64Array.from({ length: CYCLE }, (_, i) => wave(i / CYCLE)));
    return (done = { sin, cos });
  };
  return { sin: (n) => measure().sin[n]!, cos: (n) => measure().cos[n]! };
}
/**
 * Phase distortion, the method of the Casio CZ synths: a sine is read at an uneven speed. The first `d` of
 * the cycle is spent reaching the height `v` of the way through the sine, and the rest covers what is left.
 * With v = 0.5 this is the classic form (Lazzarini, Timoney, Pekonen, Välimäki, DAFx-09, equation 5);
 * with v free it is vector phaseshaping (Kleimola, Lazzarini, Timoney, Välimäki, DAFx-11, equation 6).
 */
export const phaseShape = (x: number, d: number, v = 0.5) => (x < d ? (v * x) / d : ((1 - v) * (x - d)) / (1 - d) + v);
export const pdWave = (x: number, d: number, v = 0.5) => -Math.cos(2 * Math.PI * phaseShape(x, d, v));
/**
 * The fit of that saw to recordings of a Minimoog Voyager (Pekonen, Lazzarini, Timoney, Kleimola, Välimäki,
 * EURASIP J. Adv. Signal Process. 2011, equation 6): the share of the cycle spent rising, for a note of `hz`.
 */
export const moogRise = (hz: number) => 0.9924 - 0.00002151 * hz;
/** The notes the "Analogue saw" frames stand for, high to low, so that turning the position up sharpens the saw. */
export const MOOG_FRAME_HZ = [8000, 4000, 2000, 1000, 500, 250, 125];
/** Vector phaseshaping's formant: d = 0.5 and v from 1.5 up; two neighbours are crossfaded so the band moves smoothly (equations 9 and 10). */
export function formantWave(x: number, v: number): number {
  const k = 2 * v - 1, whole = Math.floor(k + 1e-9), a = k - whole, v1 = (whole + 1) / 2;
  return (1 - a) * pdWave(x, 0.5, v1) + a * pdWave(x, 0.5, v1 + 0.5);
}
/**
 * Phase distortion with two bends per cycle: the one-bend shape used on each half of the cycle. The paper
 * (Lazzarini and others, DAFx-09) says two inflections give a spectrum without even harmonics, like a square.
 */
export const pdSquareWave = (x: number, d: number) => { const t = (2 * x) % 1; return -Math.cos(2 * Math.PI * (0.5 * phaseShape(t, d) + 0.5 * Math.floor(2 * x))); };
/**
 * A sine of size pi/2 through a hyperbolic tangent: as the drive `k` grows it nears a square (Lazzarini and
 * Timoney, Computer Music Journal 2010, equations 16 and 17). Multiplied by (cos + 1) and halved, the even
 * harmonics come back and the result is saw-like (the same paper's "sawtooth from square").
 */
export const tanhSquare = (x: number, k: number) => Math.tanh(k * (Math.PI / 2) * Math.sin(2 * Math.PI * x)) / Math.tanh(k * (Math.PI / 2));
export const tanhSaw = (x: number, k: number) => 0.5 * tanhSquare(x, k) * (Math.cos(2 * Math.PI * x) + 1);
/** Scale a harmonic recipe so its total energy matches a saw's, so tables sit at about the same loudness. */
function level(recipe: (n: number) => number): Frame {
  let saw = 0, own = 0;
  for (let n = 1; n <= HARMONICS; n++) { saw += 1 / (n * n); own += recipe(n) ** 2; }
  const k = own > 0 ? Math.sqrt(saw / own) : 0;
  return plain((n) => recipe(n) * k);
}
/** A repeatable list of numbers from 0 to 1 (a fixed "random" list, the same on every computer). */
export function fixedRandom(count: number, seed: number): number[] {
  let s = seed >>> 0;
  return Array.from({ length: count }, () => { s = (Math.imul(s, 1664525) + 1013904223) >>> 0; return s / 4294967296; });
}
/** A saw with lifted bands centred on the harmonic numbers given. */
const bands = (peaks: number[], lift = 5) => (n: number) => (1 / n) * (1 + peaks.reduce((sum, p) => sum + lift * Math.exp(-((n - p) ** 2) / (2 * (0.8 + p / 10) ** 2)), 0));
/** Vowel band places as harmonic numbers of a 110 Hz note (approximate figures for a low voice; our choice, unsourced). */
export const VOWEL_BANDS: Record<string, number[]> = { A: [6.6, 9.9, 22], E: [4.8, 16.7, 22.5], I: [2.5, 20.8, 27.4], O: [5.2, 7.6, 21.9], U: [2.7, 7.9, 20.4] };
/** Frequency modulation of a sine by a sine `ratio` times its pitch, with index `index` (Chowning 1973). */
export const fmWave = (x: number, ratio: number, index: number) => Math.sin(2 * Math.PI * x + index * Math.sin(2 * Math.PI * ratio * x));
/** A triangle whose upper corner sits `c` of the way through the cycle (0.5 is the even triangle; near 0 it is a falling saw). */
export const cornerWave = (x: number, c: number) => (x < c ? -1 + (2 * x) / c : 1 - (2 * (x - c)) / (1 - c));
/** The harmonics an organ's stops add, in the order the "Organ stops" table brings them in. */
export const ORGAN_STOPS = [1, 2, 3, 4, 6, 8];
/** The widely spaced harmonics of the "Glass" table, in the order they join. */
export const GLASS_HARMONICS = [1, 4, 7, 11, 16, 22, 29, 37, 46];
const GRAIN = Array.from({ length: 8 }, (_, f) => fixedRandom(HARMONICS + 1, 7919 * (f + 1)));
const spread = (count: number, from: number, to: number, geometric = false) => Array.from({ length: count }, (_, i) => (geometric ? from * (to / from) ** (i / (count - 1)) : from + ((to - from) * i) / (count - 1)));

/** Wavetables generated by maths for this app (no third-party tables). Each frame is a harmonic recipe. */
const FRAMES: Record<Exclude<BuiltInTable, "none">, Frame[]> = {
  // sine -> triangle -> square -> saw
  basic: SHAPES.map((s) => plain((n: number) => harmonic(s, n))),
  // a saw with more and more of its harmonics let through: dull to bright
  bright: [1, 2, 4, 8, 16, 32, HARMONICS].map((top) => plain((n: number) => (n <= top ? 1 / n : 0))),
  // a saw with a resonant bump that climbs: a rough "oo" to "ee"
  vowel: [3, 5, 8, 12, 18].map((peak) => plain((n: number) => (1 / n) * (1 + 4 * Math.exp(-((n - peak) ** 2) / (2 * (peak / 4 + 0.6) ** 2))))),
  // phase distortion: a sine (d = 0.5) bent further and further toward a saw (d near 0)
  pdsaw: spread(13, 0.5, 0.02, true).map((d) => fromWave((x) => pdWave(x, d))),
  // the same saw, rising, with the share of the cycle spent rising that was measured on a Minimoog Voyager
  moogsaw: MOOG_FRAME_HZ.map((hz) => fromWave((x) => pdWave(x, moogRise(hz)))),
  // a whole sine squeezed into the first part of the cycle, then held: narrower and narrower
  pdpulse: spread(11, 0.5, 0.05, true).map((d) => fromWave((x) => pdWave(x, d, 1))),
  // a sine bent toward a square by two bends per cycle
  pdsquare: spread(13, 0.5, 0.03, true).map((d) => fromWave((x) => pdSquareWave(x, d))),
  // a sine driven through a soft limit: gentle drive is nearly a sine, heavy drive nearly a square
  tanhsquare: spread(13, 0.25, 24, true).map((k) => fromWave((x) => tanhSquare(x, k))),
  // the same, made saw-like by the raised cosine
  tanhsaw: spread(13, 0.25, 24, true).map((k) => fromWave((x) => tanhSaw(x, k))),
  // one strong band, climbing from the 2nd harmonic to the 12th
  formant: spread(21, 1.5, 6.5).map((v) => fromWave((x) => formantWave(x, v))),
  // harmonics falling as 1/n^p: p from 3 (dull) to 0.3 (very bright)
  tilt: spread(9, 3, 0.3).map((p) => level((n) => 1 / n ** p)),
  // odd harmonics, with the even ones faded in
  oddeven: spread(6, 0, 1).map((even) => level((n) => (n % 2 === 1 ? 1 : even) / n)),
  // one harmonic per frame
  ladder: Array.from({ length: 16 }, (_, k) => level((n) => (n === k + 1 ? 1 : 0))),
  // a saw's harmonics, each turned through an angle that grows with the frame and with the square of its number
  scatter: spread(33, 0, 1).map((t) => ({ sin: (n: number) => Math.cos(0.5 * t * n * n) / n, cos: (n: number) => Math.sin(0.5 * t * n * n) / n })),
  // a rectangle: high for `duty` of the cycle
  pwm: spread(13, 0.5, 0.03, true).map((duty) => fromWave((x) => (x < duty ? 1 : -1))),
  // the corner of a triangle sliding to the edge
  tricorner: spread(11, 0.5, 0.01, true).map((c) => fromWave((x) => cornerWave(x, c))),
  // a saw run k times through the cycle and cut off at its end
  syncsaw: spread(15, 1, 8).map((k) => fromWave((x) => 2 * ((x * k) % 1) - 1)),
  // a saw held on flat steps
  bits: [2, 3, 4, 6, 8, 12, 16, 32].map((steps) => fromWave((x) => (2 * Math.floor(x * steps)) / (steps - 1) - 1)),
  // sine, half-wave rectified sine, full-wave rectified sine (each with its average taken away by the measuring)
  rect: [(v: number) => v, (v: number) => Math.max(0, v) * 2 - 0.64, (v: number) => Math.abs(v) * 2 - 1.27].map((f) => fromWave((x) => f(Math.sin(2 * Math.PI * x)))),
  // sign(sin) * |sin|^p: spikes for a large p, a block for a small one
  power: spread(11, 6, 0.15, true).map((p) => fromWave((x) => { const v = Math.sin(2 * Math.PI * x); return Math.sign(v) * Math.abs(v) ** p; })),
  // the first K harmonics at equal strength, all in step (cosines): a band-limited impulse train
  blit: [1, 2, 3, 4, 6, 8, 12, 16, 24, 32, 48, 64].map((top) => { const k = Math.sqrt(1.6 / top); return { sin: () => 0, cos: (n: number) => (n <= top ? k : 0) }; }),
  fm1: spread(13, 0, 8).map((i) => fromWave((x) => fmWave(x, 1, i))),
  fm2: spread(13, 0, 6).map((i) => fromWave((x) => fmWave(x, 2, i))),
  fm3: spread(13, 0, 6).map((i) => fromWave((x) => fmWave(x, 3, i))),
  // sin(g * pi/2 * sin): one fold for every step of g past 1
  sinefold: spread(15, 1, 8).map((g) => fromWave((x) => Math.sin(g * (Math.PI / 2) * Math.sin(2 * Math.PI * x)))),
  vowels: ["A", "E", "I", "O", "U"].map((v) => level(bands(VOWEL_BANDS[v]!))),
  // a group of harmonics about three wide, climbing
  band: spread(13, 1, 40, true).map((c) => level((n) => Math.exp(-((n - c) ** 2) / (2 * (1 + c / 8) ** 2)))),
  // a saw with a hole about a third of an octave wide either side of harmonic c
  gap: spread(13, 2, 40, true).map((c) => level((n) => (1 / n) * (1 - Math.exp(-((Math.log2(n / c)) ** 2) / (2 * 0.3 ** 2))))),
  // a saw, plus saws at 2, 3 and 4 times its pitch
  stack: [[1], [1, 2], [1, 2, 3], [1, 2, 3, 4]].map((at) => level((n) => at.reduce((sum, m) => sum + (n % m === 0 ? m / n / m : 0), 0))),
  organ: ORGAN_STOPS.map((_, i) => level((n) => (ORGAN_STOPS.slice(0, i + 1).includes(n) ? 1 : 0))),
  comb: [1, 2, 3, 4, 5, 6, 7, 8].map((k) => level((n) => ((n - 1) % k === 0 ? 1 / n : 0))),
  glass: GLASS_HARMONICS.slice(2).map((_, i) => level((n) => { const at = GLASS_HARMONICS.slice(0, i + 3).indexOf(n); return at < 0 ? 0 : 1 / (1 + at * 0.5); })),
  grain: GRAIN.map((list) => level((n) => (list[n]! ** 2) / Math.sqrt(n))),
};

// ---- tables made in the wavetable editor. They are kept here by id so that every part of the synth that
// works from settings (the engine, the pictures, the lessons) can read them like the built-in ones.
interface UserTable { name: string; frames: Frame[]; morph: Morph }
const USER = new Map<string, UserTable>();
let tablesRev = 0;
const tableListeners = new Set<() => void>();
const tablesChanged = () => { tablesRev++; warpCache.clear(); tableListeners.forEach((f) => f()); };
/** A frame from samples of one cycle, measured as harmonics the first time it is needed. */
function fromSamples(wave: Float32Array): Frame {
  let done: { sin: Float32Array; cos: Float32Array } | undefined;
  const measure = () => (done ??= harmonicsOf(wave, HARMONICS));
  return { sin: (n) => measure().sin[n]!, cos: (n) => measure().cos[n]! };
}
/** Put a table made in the editor where the synth can play it (or replace it after an edit). */
export function setUserTable(id: UserTableId, name: string, waves: Float32Array[], morph: Morph): void { USER.set(id, { name, morph, frames: waves.map(fromSamples) }); tablesChanged(); }
export function dropUserTable(id: UserTableId): void { if (USER.delete(id)) tablesChanged(); }
export const userTables = (): { id: UserTableId; name: string; frames: number }[] => [...USER].map(([id, t]) => ({ id: id as UserTableId, name: t.name, frames: t.frames.length }));
/** A number that goes up whenever a learner's table changes, and a way to be told. */
export const tablesRevision = () => tablesRev;
export const onTables = (f: () => void): (() => void) => { tableListeners.add(f); return () => { tableListeners.delete(f); }; };
const framesOf = (table: Table): { frames: Frame[]; morph: Morph } | undefined => (table === "none" ? undefined : isUserTable(table) ? USER.get(table) : { frames: FRAMES[table], morph: "crossfade" });
export const frameCount = (table: Table) => framesOf(table)?.frames.length ?? 0;
export const tableMorph = (table: Table): Morph => framesOf(table)?.morph ?? "crossfade";
/** Every frame of a table (or one cycle of a basic shape) drawn out as samples, so the editor can start from it. */
export function tableSamples(table: Table, shape: Shape = "saw", size = 2048): Float32Array[] {
  const frames = framesOf(table)?.frames ?? [plain((n) => harmonic(shape, n))];
  const list = (f: Frame, part: "sin" | "cos") => Float32Array.from({ length: HARMONICS + 1 }, (_, n) => (n ? (part === "sin" ? f.sin(n) : f.cos?.(n) ?? 0) : 0));
  return frames.map((f) => Float32Array.from(drawCycle(list(f, "sin"), f.cos ? list(f, "cos") : undefined, size), (y) => y / (Math.PI / 2)));
}

/** Oscillator B's harmonics: its basic shape, or its own wavetable read at its own position. */
export const harmonicsB = (s: Pick<SynthState, "bShape" | "bTable" | "bPosition">): Float32Array => harmonicsA({ shape: s.bShape, table: s.bTable, position: s.bPosition });
/** Oscillator B's harmonics after its own warp: the same working as oscillator A's. */
export const spectrumB = (s: Pick<SynthState, "bShape" | "bTable" | "bPosition" | "bWarp" | "bWarpAmount">): Spectrum => spectrumA({ shape: s.bShape, table: s.bTable, position: s.bPosition, warp: s.bWarp, warpAmount: s.bWarpAmount });

const blend = (state: Pick<SynthState, "shape" | "table" | "position">, part: "sin" | "cos"): Float32Array => {
  const out = new Float32Array(HARMONICS + 1);
  const found = framesOf(state.table);
  // no table, or a learner's table that this browser does not hold: the basic shape plays
  if (!found || !found.frames.length) {
    if (part === "sin") for (let n = 1; n <= HARMONICS; n++) out[n] = harmonic(state.shape, n);
    return out;
  }
  const frames = found.frames;
  if (frames.length === 1 || found.morph === "none") {
    const f = frames[Math.min(frames.length - 1, Math.round((Math.min(100, Math.max(0, state.position)) / 100) * (frames.length - 1)))]!;
    for (let n = 1; n <= HARMONICS; n++) out[n] = part === "sin" ? f.sin(n) : f.cos ? f.cos(n) : 0;
    return out;
  }
  if (found.morph === "spectral") {
    // each harmonic's strength and timing move from one frame to the next (timing by the shorter way round)
    const at = (Math.min(100, Math.max(0, state.position)) / 100) * (frames.length - 1), i = Math.min(frames.length - 2, Math.floor(at)), mix = at - i, a = frames[i]!, b = frames[i + 1]!;
    for (let n = 1; n <= HARMONICS; n++) {
      const as = a.sin(n), ac = a.cos?.(n) ?? 0, bs = b.sin(n), bc = b.cos?.(n) ?? 0, am = Math.hypot(as, ac), bm = Math.hypot(bs, bc);
      const from = am > 1e-9 ? Math.atan2(ac, as) : Math.atan2(bc, bs), to = bm > 1e-9 ? Math.atan2(bc, bs) : from;
      let d = to - from; d -= 2 * Math.PI * Math.round(d / (2 * Math.PI));
      const m = am * (1 - mix) + bm * mix, ph = from + d * mix;
      out[n] = part === "sin" ? m * Math.cos(ph) : m * Math.sin(ph);
    }
    return out;
  }
  const at = (Math.min(100, Math.max(0, state.position)) / 100) * (frames.length - 1);
  const i = Math.min(frames.length - 2, Math.floor(at)), mix = at - i, of = (f: Frame, n: number) => (part === "sin" ? f.sin(n) : f.cos ? f.cos(n) : 0);
  for (let n = 1; n <= HARMONICS; n++) out[n] = of(frames[i]!, n) * (1 - mix) + of(frames[i + 1]!, n) * mix;
  return out;
};
/** Harmonic amplitudes (index 1..HARMONICS) for oscillator A, blending neighbouring frames by position: the sine parts. */
export const harmonicsA = (state: Pick<SynthState, "shape" | "table" | "position">): Float32Array => blend(state, "sin");
/** The cosine parts that go with `harmonicsA`: zero for the basic shapes and the first three tables. */
export const cosinesA = (state: Pick<SynthState, "shape" | "table" | "position">): Float32Array => blend(state, "cos");
/** The size of each harmonic, whatever its sine and cosine parts: what the ear and the spectrum go by. */
export function magnitudesA(state: Pick<SynthState, "shape" | "table" | "position">): Float32Array {
  const s = harmonicsA(state), c = cosinesA(state);
  return s.map((v, n) => Math.hypot(v, c[n]!));
}

/** A simple brightness figure: the share of energy above the fifth harmonic. Used to check "find the brightest frame". */
export function brightness(h: Float32Array): number {
  let all = 0, high = 0;
  for (let n = 1; n < h.length; n++) { const e = h[n]! * h[n]!; all += e; if (n > 5) high += e; }
  return all ? high / all : 0;
}

/** FM: at 100% oscillator B swings A's frequency by this many times B's own frequency (the "index"). */
export const FM_MAX_INDEX = 8;
export const fmIndex = (amount: number) => (amount / 100) * FM_MAX_INDEX;
/** Sync warp: at 100% the wave is run through this many times in one cycle. */
export const SYNC_MAX = 4;

/**
 * Warp reads the wave at an uneven speed. `p` is how far through the cycle we are (0..1); the result is the
 * place in the original wave to read. Every mode leaves the wave untouched at an amount of 0.
 * - bend: slow at first, then faster and faster, squashing the wave toward the end of the cycle.
 * - mirror: read forwards, then backwards; at 100% the turn is exactly halfway and the wave is symmetrical.
 * - sync: read faster and start again when the cycle ends, however far the reading has got.
 * - pd ("Squeeze"): the first half of the wave is hurried through and the second half takes the time left.
 */
export function warpPhase(mode: Warp, amount: number, p: number): number {
  const a = Math.min(100, Math.max(0, amount)) / 100;
  switch (mode) {
    case "none": return p;
    case "bend": return p ** (2 ** (2 * a));
    case "mirror": { const turn = 1 - a / 2; return p <= turn ? p / turn : (1 - p) / (1 - turn); }
    case "sync": { const x = p * (1 + (SYNC_MAX - 1) * a); return x - Math.floor(x); }
    case "pd": { const knee = 0.5 - 0.45 * a; return p < knee ? (0.5 * p) / knee : 0.5 + (0.5 * (p - knee)) / (1 - knee); }
    case "steps": { const n = stepCount(amount); return a <= 0 ? p : Math.floor(p * n) / n; }
    case "flip": case "fold": case "diode": return p; // these two change the wave's height, not where it is read: see warpValue
  }
}
/** The Lambert W function for x >= 0: the w for which w times e to the w is x. */
export function lambertW(x: number): number {
  if (x <= 0) return 0;
  let w = x < 1 ? x : Math.log(x) - Math.log(Math.log(x) + 1e-12);
  for (let i = 0; i < 40; i++) { const e = Math.exp(w), f = w * e - x, step = f / (e * (w + 1) - ((w + 2) * f) / (2 * w + 2)); w -= step; if (Math.abs(step) < 1e-13 * (1 + Math.abs(w))) break; }
  return w;
}
/**
 * One stage of the Lockhart wavefolder, a transistor circuit used in "west coast" synthesizers, from input
 * volts to output volts: equation 28 of Esqueda, Pöntynen, Parker and Bilbao, "Virtual Analog Models of the
 * Lockhart and Serge Wavefolders" (Applied Sciences, 2017), with the part values of its table 2 and a load
 * of 7.5 kilohms. Below about 0.6 V it passes the signal; above that it turns it back, with a rounded corner.
 */
export function lockhartFold(volts: number): number {
  const R = 15000, RL = 7500, Is = 1e-17, VT = 0.025864, sign = volts < 0 ? -1 : 1;
  const alpha = (2 * RL) / R, beta = (2 * RL + R) / (VT * R), delta = (RL * Is) / VT;
  return alpha * volts - sign * VT * lambertW(delta * Math.exp(sign * beta * volts));
}
const lockhartPeaks = new Map<number, number>();
/** The largest output the fold gives for inputs up to `volts`, so the result can be kept at a steady size. */
export function lockhartPeak(volts: number): number {
  const key = Math.round(volts * 1000), known = lockhartPeaks.get(key);
  if (known) return known;
  let peak = 1e-9;
  for (let i = 1; i <= 96; i++) peak = Math.max(peak, Math.abs(lockhartFold((volts * i) / 96)));
  lockhartPeaks.set(key, peak);
  return peak;
}
/** Steps: how many flat steps one cycle is cut into, from 64 (close to smooth) down to 2. */
export const stepCount = (amount: number) => Math.max(2, Math.round(64 / 2 ** ((Math.min(100, Math.max(0, amount)) / 100) * 5)));
/** Fold: how many times the wave is turned up before the part past the top is folded back (1 to 5 times). */
export const foldGain = (amount: number) => 1 + (Math.min(100, Math.max(0, amount)) / 100) * 4;
/**
 * The second half of warp: what happens to the wave's height `y` (from -1 to 1 of its own peak) at point `p`
 * of the cycle. Only two modes use it.
 * - flip: the end of the cycle is turned upside down; the amount is how much of the cycle, counted from the end.
 * - fold: the wave is turned up, and whatever passes the top is folded back down (and the same at the bottom).
 */
export function warpValue(mode: Warp, amount: number, p: number, y: number): number {
  const a = Math.min(100, Math.max(0, amount)) / 100;
  if (mode === "flip") return p >= 1 - a ? -y : y;
  if (mode === "diode") { const volts = 0.15 + 1.35 * a; return lockhartFold(y * volts) / lockhartPeak(volts); }
  if (mode === "fold") { const x = (y * foldGain(amount) + 1) / 4, t = x - Math.floor(x); return 1 - 4 * Math.abs(t - 0.5); }
  return y;
}

/** A wave as harmonics with both parts: `sin` alone describes the unwarped shapes; warping adds `cos`. */
export interface Spectrum { sin: Float32Array; cos: Float32Array }
const warpCache = new Map<string, Spectrum>();
/**
 * Oscillator A's harmonics after warp. The unwarped wave is drawn out as one cycle, read through
 * `warpPhase`, and measured again as harmonics (the first HARMONICS of them, so nothing folds back).
 */
export function spectrumA(state: Pick<SynthState, "shape" | "table" | "position" | "warp" | "warpAmount">): Spectrum {
  const h = harmonicsA(state), hc = cosinesA(state);
  if (state.warp === "none" || state.warpAmount <= 0) return { sin: h, cos: hc };
  // rounded, so a source sweeping the amount lands on values that have been worked out before
  const amount = Math.round(state.warpAmount * 2) / 2, position = Math.round(state.position);
  const key = `${state.shape}|${state.table}|${position}|${state.warp}|${amount}`;
  const known = warpCache.get(key);
  if (known) return known;
  const drawn = drawCycle(h, hc, CYCLE), base = new Float64Array(CYCLE + 1);
  base.set(drawn); base[CYCLE] = drawn[0]!;
  const warped = new Float32Array(CYCLE);
  const heights = state.warp === "flip" || state.warp === "fold" || state.warp === "diode";
  let peak = 1e-9;
  if (heights) for (let i = 0; i < CYCLE; i++) peak = Math.max(peak, Math.abs(base[i]!));
  for (let i = 0; i < CYCLE; i++) {
    const at = Math.min(1, Math.max(0, warpPhase(state.warp, amount, i / CYCLE))) * CYCLE, k = Math.min(CYCLE - 1, Math.floor(at));
    const y = base[k]! + (base[k + 1]! - base[k]!) * (at - k);
    warped[i] = heights ? warpValue(state.warp, amount, i / CYCLE, y / peak) * peak : y;
  }
  // measured at the scale the harmonics came in at (measureCycle works at pi/2 times that)
  const m = measureCycle(warped), sin = m.sin.map((v) => v / (Math.PI / 2)), cos = m.cos.map((v) => v / (Math.PI / 2));
  if (warpCache.size > 600) warpCache.clear();
  warpCache.set(key, { sin, cos });
  return { sin, cos };
}
