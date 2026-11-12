// The practice synth's settings. One flat, typed state object is the single source of truth: the audio
// engine renders it, the controls edit it, and lessons check it. Units are exact (Hz, dB, cents) because
// this is our own instrument.

export const SHAPES = ["sine", "triangle", "square", "saw"] as const;
export type Shape = (typeof SHAPES)[number];

export interface SynthState {
  /** Master level in dB. 0 is the loudest the lesson synth goes. */
  volumeDb: number;
  shape: Shape;
  octave: number;
  semitone: number;
  /** Fine tune in cents. */
  fine: number;
  /**
   * When set, the oscillator ignores the keyboard and plays this frequency. Used by lessons about
   * frequency itself. `null` means "follow the keys".
   */
  freeHz: number | null;
}

export const INITIAL: SynthState = { volumeDb: -12, shape: "saw", octave: 0, semitone: 0, fine: 0, freeHz: null };

export interface ParamSpec {
  id: keyof SynthState;
  label: string;
  kind: "range" | "choice";
  min?: number;
  max?: number;
  step?: number;
  /** Logarithmic feel for sliders that span octaves. */
  log?: boolean;
  unit?: string;
  choices?: readonly string[];
}

export const PARAMS: Record<string, ParamSpec> = {
  volumeDb: { id: "volumeDb", label: "Volume", kind: "range", min: -48, max: 0, step: 1, unit: "dB" },
  shape: { id: "shape", label: "Wave shape", kind: "choice", choices: SHAPES },
  octave: { id: "octave", label: "Octave", kind: "range", min: -3, max: 3, step: 1, unit: "oct" },
  semitone: { id: "semitone", label: "Semitone", kind: "range", min: -12, max: 12, step: 1, unit: "st" },
  fine: { id: "fine", label: "Fine", kind: "range", min: -100, max: 100, step: 1, unit: "cents" },
  freeHz: { id: "freeHz", label: "Frequency", kind: "range", min: 55, max: 1760, step: 1, log: true, unit: "Hz" },
};

export const A4 = 440;
/** MIDI note number to Hz. 69 is the A above middle C. */
export const noteToHz = (note: number) => A4 * 2 ** ((note - 69) / 12);

/** The frequency the oscillator actually plays for a given key. */
export function playedHz(state: SynthState, note: number): number {
  if (state.freeHz !== null) return state.freeHz;
  return noteToHz(note + state.octave * 12 + state.semitone) * 2 ** (state.fine / 1200);
}

export const dbToGain = (db: number) => (db <= -48 ? 0 : 10 ** (db / 20));

/**
 * Harmonic recipe for each shape: amplitude of harmonic n (1-based), as sine partials.
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
