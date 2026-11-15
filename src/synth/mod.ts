// Envelopes and LFOs as modulation sources: what they are called, their colours, where they can be sent, and
// how far a given amount moves a destination. Pure data and maths; the engine and the knob rings share it.
import { fromTravelSmooth, isSlowDest, PARAMS, toTravel, type Dest, type SynthState } from "./params";

export type ModSource = "env2" | "lfo1" | "lfo2" | "lfo3" | "vel" | "key" | "wheel";
/** "note" sources are fixed while a note sounds: how hard it was struck, and which key it was. */
export interface SourceInfo { id: ModSource; name: string; kind: "env" | "lfo" | "note"; color: string }
/** Each source has its own neon colour; a knob it moves wears a ring of that colour. */
export const SOURCES: SourceInfo[] = [
  { id: "env2", name: "Env 2", kind: "env", color: "#ffe14a" },
  { id: "lfo1", name: "LFO 1", kind: "lfo", color: "#3df5ff" },
  { id: "lfo2", name: "LFO 2", kind: "lfo", color: "#7dff5c" },
  { id: "lfo3", name: "LFO 3", kind: "lfo", color: "#ff9a3d" },
  { id: "vel", name: "Velocity", kind: "note", color: "#ff5a5a" },
  { id: "key", name: "Key position", kind: "note", color: "#b9a1ff" },
  // the mod wheel is moved by hand while a note sounds; like velocity it runs 0 to 1 and pushes one way
  { id: "wheel", name: "Mod wheel", kind: "note", color: "#5c9dff" },
];

/** Velocity runs from 1 (softest) to 127 (hardest), as on any keyboard. As a source it is 0 to 1. */
export const velocityValue = (velocity: number) => Math.min(1, Math.max(0, velocity / 127));
/** Key position is 0 at middle C, 1 two octaves above it and -1 two octaves below. */
export const keyValue = (note: number) => Math.min(1, Math.max(-1, (note - 60) / 24));
/** Envelope 1 always shapes the level of every note; it has a colour for its panel but is not routed. */
export const ENV1_COLOR = "#ff5cb4";

export type ModDest = Dest;

export interface Route {
  /** Which connection this is: the source's id for the one set on its own panel, "m0", "m1"... for matrix rows. */
  key: string;
  source: SourceInfo; dest: string; amount: number;
  /** True when the source only pushes one way from the knob: every envelope, and an LFO set to "one way". */
  oneWay: boolean;
  /** A second source that scales this connection, from nothing (at its lowest) to the full amount (at its highest). Matrix rows only. */
  aux?: SourceInfo;
}

/** The connections that are in use: a source with a destination chosen. */
export function routes(s: SynthState): Route[] {
  const fixedWay = (source: SourceInfo) => source.kind === "env" || source.id === "vel" || source.id === "wheel";
  const own = SOURCES.flatMap((source) => {
    const dest = s[`${source.id}Dest`], amount = s[`${source.id}Amount`];
    const oneWay = fixedWay(source) || (source.kind === "lfo" && s[`${source.id as "lfo1"}Way`] === "up");
    return dest === "none" ? [] : [{ key: source.id as string, source, dest, amount, oneWay }];
  });
  // rows added in the matrix: the same source again, sent somewhere else
  const extra = (s.matrix ?? []).flatMap((row, i) => {
    const source = SOURCES.find((x) => x.id === row.source);
    return !source || row.dest === "none" ? [] : [{ key: `m${i}`, source, dest: row.dest, amount: row.amount, oneWay: fixedWay(source) || (source.kind === "lfo" && row.way === "up"), aux: SOURCES.find((x) => x.id === row.aux) }];
  });
  return [...own, ...extra];
}
/** Which sources are connected to which destinations, as one string: when it changes, sounding notes are rebuilt. */
export const routeLayout = (s: SynthState) => routes(s).map((r) => `${r.key}:${r.source.id}>${r.dest}${r.aux ? `*${r.aux.id}` : ""}`).join("|");
/** The sources moving one setting, for drawing its rings. Sources with an amount of zero do nothing. */
export const routesTo = (s: SynthState, id: keyof SynthState) => routes(s).filter((r) => r.dest === id && r.amount !== 0);

/** At an amount of 100%, cutoff moves this many octaves and pitch this many semitones (each way, for an LFO). */
export const CUTOFF_OCTAVES = 5;
export const PITCH_SEMITONES = 12;
/** "Osc A pitch, wide" moves four octaves at 100%: the range a kick drum or a sub drop falls through. */
export const WIDE_SEMITONES = 48;
/** ...and an LFO's rate this many octaves (so it can run from a quarter to four times its set speed). */
export const RATE_OCTAVES = 2;
export const isLevel = (dest: ModDest) => dest.endsWith("LevelDb");

/**
 * How far a route moves its destination at the source's peak: in cents for cutoff and pitch, and as a
 * fraction of the destination's own level for levels (1 means "from silence to twice as much").
 */
export function modDepth(dest: ModDest, amount: number): number {
  const a = amount / 100;
  if (dest === "cutoff") return a * CUTOFF_OCTAVES * 1200;
  if (dest === "fine" || dest === "bFine") return a * PITCH_SEMITONES * 100;
  if (dest === "aPitchWide") return a * WIDE_SEMITONES * 100;
  if (dest === "lfo1Rate") return a * RATE_OCTAVES * 1200;
  // half the FM knob's travel, like every ring: the engine turns it into a swing of oscillator A's frequency
  if (dest === "fmAmount") return a * 0.5;
  return dest === "none" ? 0 : a;
}

/**
 * The whole note's level before its "Note level" routes are added. A one-way source with a positive amount
 * (velocity, usually) should turn soft notes down and leave the hardest at full level, so the starting
 * level drops by that amount and the source brings it back up.
 */
export function noteLevelBase(s: SynthState): number {
  return Math.max(0, 1 - routes(s).filter((r) => r.dest === "noteLevel" && r.oneWay && r.amount > 0).reduce((sum, r) => sum + r.amount / 100, 0));
}

export type Bend = SynthState["envBend"];
export interface Adsr { attack: number; decay: number; sustain: number; release: number; hold?: number; bend?: Bend }
/** Envelope times are stored in milliseconds and sustain in percent; this gives seconds and a 0..1 level. */
export const adsr = (s: SynthState, which: 1 | 2): Adsr => (which === 1
  ? { attack: s.envA / 1000, decay: s.envD / 1000, sustain: s.envS / 100, release: s.envR / 1000, hold: s.envH / 1000, bend: s.envBend }
  : { attack: s.env2A / 1000, decay: s.env2D / 1000, sustain: s.env2S / 100, release: s.env2R / 1000, hold: s.env2H / 1000, bend: s.env2Bend });

/**
 * For the two curved falls, the "time constant" of the fall as a fraction of the knob's time: eased is all but
 * finished when the knob's time has passed; sharp drops much faster at first and then lingers.
 */
export const fallConstant = (bend: Bend | undefined, time: number) => Math.max(0.001, time / (bend === "sharp" ? 9 : 4));
/** How far a fall has got, from 1 (not started) to 0 (finished), `x` seconds into a stage lasting `time`. */
export function fallShape(bend: Bend | undefined, x: number, time: number): number {
  if (x <= 0) return 1;
  if (bend === "straight") return Math.max(0, 1 - x / Math.max(1e-4, time));
  return Math.exp(-x / fallConstant(bend, time));
}

/**
 * The level of an envelope `t` seconds after a note starts, for a note held `held` seconds. Attack is a
 * straight line, then the level holds at the top for the hold time, then decay and release fall in the
 * envelope's chosen shape, exactly as the audio does.
 */
export function envLevel(e: Adsr, t: number, held: number): number {
  const hold = e.hold ?? 0;
  const during = (x: number) => (x < e.attack ? x / e.attack : x < e.attack + hold ? 1 : e.sustain + (1 - e.sustain) * fallShape(e.bend, x - e.attack - hold, e.decay));
  if (t <= held) return during(Math.max(0, t));
  return during(held) * fallShape(e.bend, t - held, e.release);
}

/** How many beats one cycle of a tempo-synced LFO lasts. */
export const beatsOf = (div: SynthState["lfo1Div"]) => (div.includes("/") ? 1 / Number(div.split("/")[1]) : Number(div));
type LfoId = "lfo1" | "lfo2" | "lfo3";
/** An LFO's speed in cycles a second: its Rate knob, or, when set in beats, worked out from the tempo. */
export function lfoHz(s: SynthState, id: LfoId): number {
  return s[`${id}Sync`] === "beat" ? s.bpm / 60 / beatsOf(s[`${id}Div`]) : s[`${id}Rate`];
}
/**
 * Where in its cycle (0..1) an LFO starts for a note beginning at clock time `t`. "Restart" always begins at
 * the start of the shape. "Free" behaves as if the LFO had been running since the clock began, so notes land
 * wherever it happens to be, and a tempo-synced LFO stays lined up with the beat whenever you play.
 */
export function lfoStartPhase(s: SynthState, id: LfoId, t: number): number {
  if (s[`${id}Trig`] === "retrig") return 0;
  const cycles = t * lfoHz(s, id);
  return cycles - Math.floor(cycles);
}

/** One cycle of an LFO shape at position `t` (0..1), from -1 to 1. `steps` are the drawn shape's values. */
export function lfoValue(shape: SynthState["lfo1Shape"], t: number, steps?: number[]): number {
  const x = t - Math.floor(t);
  switch (shape) {
    case "sine": return Math.sin(2 * Math.PI * x);
    case "triangle": return x < 0.25 ? 4 * x : x < 0.75 ? 2 - 4 * x : 4 * x - 4;
    case "saw": return x < 0.5 ? 2 * x : 2 * x - 2;
    case "square": return x < 0.5 ? 1 : -1;
    case "drawn": return steps?.length ? steps[Math.min(steps.length - 1, Math.floor(x * steps.length))]! : 0;
    case "curve": {
      // each drawn value sits at the middle of its step; straight lines join them, round the end of the cycle too
      if (!steps?.length) return 0;
      const K = steps.length, at = x * K - 0.5, i = Math.floor(at), f = at - i;
      return steps[(i + K) % K]! * (1 - f) + steps[(i + 1) % K]! * f;
    }
  }
}

/**
 * An LFO shape as a sum of sine and cosine waves, which is how the browser's oscillator takes a custom shape.
 * `sin[n]` and `cos[n]` are the sizes of harmonic n; `mean` is the shape's average, which an oscillator
 * cannot carry and has to be added separately. Exact formulas for each shape; the drawn shape is a staircase.
 */
export function lfoCoefficients(shape: SynthState["lfo1Shape"], steps: number[] = [], harmonics = 512): { sin: Float32Array<ArrayBuffer>; cos: Float32Array<ArrayBuffer>; mean: number } {
  const sin = new Float32Array(harmonics), cos = new Float32Array(harmonics);
  let mean = 0;
  if (shape === "drawn" && steps.length) {
    const K = steps.length;
    mean = steps.reduce((a, b) => a + b, 0) / K;
    for (let n = 1; n < harmonics; n++) {
      let a = 0, b = 0;
      for (let k = 0; k < K; k++) {
        const from = (2 * Math.PI * n * k) / K, to = (2 * Math.PI * n * (k + 1)) / K;
        a += steps[k]! * (Math.sin(to) - Math.sin(from));
        b += steps[k]! * (Math.cos(from) - Math.cos(to));
      }
      cos[n] = a / (Math.PI * n); sin[n] = b / (Math.PI * n);
    }
    return { sin, cos, mean };
  }
  if (shape === "curve" && steps.length) {
    // measured from the joined-up shape itself; straight lines need far fewer harmonics than steps do
    const M = 1024, top = Math.min(harmonics, 96), wave = Float32Array.from({ length: M }, (_, i) => lfoValue("curve", i / M, steps));
    mean = steps.reduce((a, b) => a + b, 0) / steps.length;
    for (let n = 1; n < top; n++) {
      let a = 0, b = 0;
      for (let i = 0; i < M; i++) { const w = (2 * Math.PI * n * i) / M; a += wave[i]! * Math.cos(w); b += wave[i]! * Math.sin(w); }
      cos[n] = (2 * a) / M; sin[n] = (2 * b) / M;
    }
    return { sin, cos, mean };
  }
  for (let n = 1; n < harmonics; n++) {
    sin[n] = shape === "sine" ? (n === 1 ? 1 : 0)
      : shape === "square" ? (n % 2 ? 4 / (Math.PI * n) : 0)
      : shape === "saw" ? ((n % 2 ? 1 : -1) * 2) / (Math.PI * n)
      : n % 2 ? ((((n - 1) / 2) % 2 ? -1 : 1) * 8) / (Math.PI * Math.PI * n * n) : 0;
  }
  return { sin, cos, mean };
}

/** The settings change that sets one connection's amount: on the source's panel, or in its matrix row. */
export function withRouteAmount(s: SynthState, key: string, amount: number): Partial<SynthState> {
  const v = Math.max(-100, Math.min(100, Math.round(amount)));
  if (/^m\d+$/.test(key)) { const i = Number(key.slice(1)); return { matrix: s.matrix.map((r, k) => (k === i ? { ...r, amount: v } : r)) }; }
  return { [`${key}Amount`]: v } as Partial<SynthState>;
}

/** What the control-rate modulation needs to know about the note it follows. Times are in seconds. */
export interface NoteNow { note: number; velocity: number; /** since the note started */ age: number; /** how long it was held, or Infinity while it still is */ held: number; /** audio-clock time it started, for "free" LFOs */ startedAt: number }

/**
 * A source's value for a note at this moment: -1..1 for a source that pushes both ways, 0..1 for one that
 * pushes one way. Mirrors what the audio does for the fast destinations (shape, start phase, rise, one way).
 */
export function sourceValue(s: SynthState, r: Route, n: NoteNow): number {
  if (n.age < 0) return 0;
  if (r.source.kind === "env") return envLevel(adsr(s, 2), n.age, n.held);
  if (r.source.id === "vel") return velocityValue(n.velocity);
  if (r.source.id === "key") return keyValue(n.note);
  if (r.source.id === "wheel") return s.wheel / 100;
  const id = r.source.id as LfoId, rise = s[`${id}Rise`] / 1000;
  const v = lfoValue(s[`${id}Shape`], lfoStartPhase(s, id, n.startedAt) + n.age * lfoHz(s, id), s[`${id}Steps`]);
  return (r.oneWay ? (v + 1) / 2 : v) * (rise > 0 ? Math.min(1, n.age / rise) : 1);
}

/**
 * How much of a connection its scaling source lets through right now, 0 to 1 (1 when it has none). Every
 * source is read as running from 0 to 1 here: an LFO from its lowest point to its highest, key position from
 * the bottom of the keyboard's range to the top.
 */
export function auxValue(s: SynthState, r: Route, n: NoteNow): number {
  if (!r.aux) return 1;
  if (r.aux.id === "key") return (keyValue(n.note) + 1) / 2;
  return Math.min(1, Math.max(0, sourceValue(s, { key: "", source: r.aux, dest: r.dest, amount: 100, oneWay: true }, n)));
}

/**
 * The settings with every "slow" connection applied for this moment. A source at full swing moves a knob by
 * amount/200 of its travel, the same stretch its ring shows. With no note sounding, nothing is moved.
 */
export const slowModulate = (s: SynthState, n: NoteNow | undefined): SynthState => modulated(s, n, false);
/**
 * As slowModulate, and with `all` set, for every connection that lands on a knob, fast ones included. The
 * audio never uses that: it is what the screen shows, so a knob and the filter's curve can be seen moving
 * the way their sources are moving them right now.
 */
export function modulated(s: SynthState, n: NoteNow | undefined, all: boolean): SynthState {
  const list = routes(s).filter((r) => r.amount !== 0 && (all ? PARAMS[r.dest]?.kind === "range" : isSlowDest(r.dest)));
  if (!list.length || !n) return s;
  const out = { ...s } as SynthState & Record<string, unknown>;
  // every source reads the settings as left, so two sources on one knob add and the order does not matter
  const push: Record<string, number> = {};
  for (const r of list) push[r.dest] = (push[r.dest] ?? 0) + sourceValue(s, r, n) * auxValue(s, r, n) * (r.amount / 200);
  for (const [dest, by] of Object.entries(push)) { const spec = PARAMS[dest]!; out[dest] = fromTravelSmooth(spec, toTravel(spec, s[dest as keyof SynthState] as number) + by); }
  return out;
}
