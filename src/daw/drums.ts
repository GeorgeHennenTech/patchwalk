// The drum machine's pattern and timing, as plain data and maths: no sound and no screen here, so lessons,
// tests and the studio page all work from the same rules. A pattern is a grid: one lane per drum, one cell
// per step, each cell off or struck at one of three strengths.

export const VOICES = ["kick", "snare", "clap", "hat", "openhat", "tomlow", "tomhigh", "rim"] as const;
export type Voice = (typeof VOICES)[number];
export const VOICE_NAMES: Record<Voice, string> = { kick: "Kick", snare: "Snare", clap: "Clap", hat: "Closed hat", openhat: "Open hat", tomlow: "Low tom", tomhigh: "High tom", rim: "Rim" };

const clamp = (v: number, lo: number, hi: number) => Math.min(hi, Math.max(lo, v));

/** A cell: 0 is silent; 1 soft, 2 normal, 3 accented. */
export type Hit = 0 | 1 | 2 | 3;
/** How hard each strength is struck, as a fraction of full. */
export const STRENGTH: Record<Hit, number> = { 0: 0, 1: 0.45, 2: 0.75, 3: 1 };

export interface Lane { voice: Voice; steps: Hit[]; /** 0 to 100 */ level: number; mute: boolean; solo: boolean; /** semitones up or down, -12 to 12 */ tune: number; /** the id of one of the learner's own sounds, kept in this browser; none means the built-in drum */ sample?: string }
export const TUNE_MAX = 12;
/** How much faster or slower a sound is played for a tuning in semitones. */
export const tuneRate = (tune: number) => 2 ** (clamp(tune || 0, -TUNE_MAX, TUNE_MAX) / 12);
export interface Pattern {
  name: string;
  bpm: number;
  /** How late every second step is played, 0 to 75 (% of the way to the step after it). 0 is straight. */
  swing: number;
  /** Steps in the pattern: 16 is one bar of sixteenths, 32 is two. */
  length: 16 | 32;
  lanes: Lane[];
}
export const STEPS_PER_BEAT = 4, BPM_MIN = 60, BPM_MAX = 200, SWING_MAX = 75;

export function emptyPattern(name = "New pattern", length: 16 | 32 = 16): Pattern {
  return { name, bpm: 120, swing: 0, length, lanes: VOICES.map((voice) => ({ voice, steps: Array.from({ length }, () => 0 as Hit), level: 80, mute: false, solo: false, tune: 0 })) };
}
/** Write a pattern from rows of 16 characters: "x" a hit, "X" an accent, "o" a soft hit, anything else silence. */
export function fromRows(name: string, bpm: number, rows: Partial<Record<Voice, string>>, swing = 0): Pattern {
  const p = emptyPattern(name, Object.values(rows).some((r) => r.replace(/\s/g, "").length > 16) ? 32 : 16);
  p.bpm = bpm; p.swing = swing;
  for (const lane of p.lanes) { const row = (rows[lane.voice] ?? "").replace(/\s/g, ""); lane.steps = lane.steps.map((_, i) => (row[i] === "X" ? 3 : row[i] === "x" ? 2 : row[i] === "o" ? 1 : 0)); }
  return p;
}
/** Starting points. These are common drum-machine shapes, not anyone's recorded beat. */
export const STARTERS: Pattern[] = [
  fromRows("Four on the floor", 124, { kick: "X...x...x...x...", clap: "....x.......x...", hat: "..x...x...x...x.", openhat: "..............o." }),
  fromRows("Backbeat", 96, { kick: "X.......x.x.....", snare: "....X.......X...", hat: "x.x.x.x.x.x.x.x." }),
  fromRows("Half-time", 140, { kick: "X.....x...x.....", snare: "........X.......", hat: "x.o.x.o.x.o.x.oo", rim: "...x..........x." }),
  fromRows("Broken beat", 132, { kick: "X.....x..x......", snare: "....X.......X..o", hat: "x.xxx.x.x.xxx.x.", openhat: ".......o........" }, 12),
  fromRows("Shuffle", 100, { kick: "X..x....x..x....", snare: "....X.......X...", hat: "x.xxx.xxx.xxx.xx" }, 55),
];
/** Starting points by genre. Each is a common shape for that style of music, written for this page: not anyone"s recorded beat. */
export const GENRE_STARTERS: Pattern[] = [
  fromRows("Glitch-hop", 105, { kick: "X.....x...x..o..", snare: "....X.......X...", hat: "x.xox.x.x.xox.xx", rim: ".......x........" }, 30),
  fromRows("Breakbeat", 135, { kick: "X.........x.....", snare: "....X..o.o..X...", hat: "x.x.x.x.x.x.x.x.", openhat: "..............o." }, 0),
  fromRows("Psydub", 85, { kick: "X......x..x.....", snare: "........X.......", hat: "..x...x...x...x.", rim: "...o.....o...o..", tomlow: ".............x.." }, 20),
  fromRows("Trip-hop", 84, { kick: "X..o......x.....", snare: "....X.......X.o.", hat: "x.x.x.x.x.x.x.x." }, 25),
  fromRows("Dubstep half-time", 140, { kick: "X.........x.....", snare: "........X.......", hat: "x...x.x.x...x.xo", rim: "......x........." }, 0),
  fromRows("Drum and bass", 172, { kick: "X.........x.....", snare: "....X.......X...", hat: "x.x.x.x.x.x.x.x.", openhat: "......o........." }, 0),
  fromRows("Two-step garage", 132, { kick: "X......x..x.....", clap: "....X.......X...", hat: "..x...x...x...x.", rim: ".x.......x......" }, 35),
  fromRows("Glitch stutter", 110, { kick: "X.....x...x.....X..x..x...x.....", snare: "....X.......X.......X.......X.xx", hat: "x.xox.x.xxxox.x.x.xox.xxx.x.oooo", tomhigh: "...............x.............o.." }, 15),
];

const withLane = (p: Pattern, index: number, change: (l: Lane) => Lane): Pattern => ({ ...p, lanes: p.lanes.map((l, i) => (i === index ? change(l) : l)) });
/** Set one cell. */
export const setHit = (p: Pattern, lane: number, step: number, hit: Hit): Pattern => withLane(p, lane, (l) => ({ ...l, steps: l.steps.map((h, i) => (i === step ? hit : h)) }));
/** A struck cell's next strength: normal, accent, soft, and round again. A silent cell stays silent. */
export const nextStrength = (hit: Hit): Hit => (hit === 0 ? 0 : hit === 2 ? 3 : hit === 3 ? 1 : 2);
export const setLane = (p: Pattern, lane: number, change: Partial<Pick<Lane, "level" | "mute" | "solo" | "tune">>): Pattern => withLane(p, lane, (l) => ({ ...l, ...change, ...(change.level !== undefined ? { level: clamp(change.level, 0, 100) } : {}), ...(change.tune !== undefined ? { tune: clamp(Math.round(change.tune), -TUNE_MAX, TUNE_MAX) } : {}) }));
/** Give a drum one of the learner's own sounds, or (with no id) go back to the built-in drum. */
export const setSample = (p: Pattern, lane: number, id?: string): Pattern => withLane(p, lane, (l) => { const { sample: _old, ...rest } = l; return id ? { ...rest, sample: id } : rest; });
/** Take a sound off every drum that uses it. */
export const dropSample = (p: Pattern, id: string): Pattern => ({ ...p, lanes: p.lanes.map((l) => { if (l.sample !== id) return l; const { sample: _old, ...rest } = l; return rest; }) });
export const clearLane = (p: Pattern, lane: number): Pattern => withLane(p, lane, (l) => ({ ...l, steps: l.steps.map(() => 0 as Hit) }));
export const clearAll = (p: Pattern): Pattern => ({ ...p, lanes: p.lanes.map((l) => ({ ...l, steps: l.steps.map(() => 0 as Hit) })) });
/** Change the pattern's length: going to two bars repeats the first bar; going back keeps the first. */
export function setLength(p: Pattern, length: 16 | 32): Pattern {
  if (length === p.length) return p;
  return { ...p, length, lanes: p.lanes.map((l) => ({ ...l, steps: length === 32 ? [...l.steps, ...l.steps] : l.steps.slice(0, 16) })) };
}
export const setTempo = (p: Pattern, bpm: number): Pattern => ({ ...p, bpm: clamp(Math.round(bpm), BPM_MIN, BPM_MAX) });
export const setSwing = (p: Pattern, swing: number): Pattern => ({ ...p, swing: clamp(Math.round(swing), 0, SWING_MAX) });

/** Seconds from one step to the next, straight. */
export const stepSeconds = (bpm: number) => 60 / clamp(bpm, BPM_MIN, BPM_MAX) / STEPS_PER_BEAT;
/** When step `n` (counting on for ever, not wrapping) is played, in seconds from the start: every second step is pushed late by the swing. */
export function stepTime(n: number, bpm: number, swing: number): number {
  const s = stepSeconds(bpm);
  return n * s + (n % 2 === 1 ? (clamp(swing, 0, SWING_MAX) / 100) * s : 0);
}
/** Which lanes sound: if any lane is soloed, only those; otherwise every lane that is not muted. */
export function audible(p: Pattern): boolean[] {
  const solo = p.lanes.some((l) => l.solo);
  return p.lanes.map((l) => (solo ? l.solo : !l.mute));
}
export interface Strike { voice: Voice; sample?: string; tune: number; /** seconds from the start */ at: number; /** 0..1 */ strength: number; step: number }
/**
 * Every drum hit from step `from` up to but not including step `until` (steps count on for ever; the
 * pattern repeats). This is the one place that decides what is heard and when, so the machine's sound and
 * the tests cannot drift apart.
 */
export function strikes(p: Pattern, from: number, until: number): Strike[] {
  const on = audible(p), out: Strike[] = [];
  for (let n = from; n < until; n++) {
    const step = ((n % p.length) + p.length) % p.length;
    p.lanes.forEach((l, i) => { const hit = l.steps[step] ?? 0; if (hit && on[i] && l.level > 0) out.push({ voice: l.voice, ...(l.sample ? { sample: l.sample } : {}), tune: l.tune, at: stepTime(n, p.bpm, p.swing), strength: STRENGTH[hit] * (l.level / 100), step }); });
  }
  return out;
}
/** A pattern read back from storage, made safe: anything missing or out of range is put right, anything unknown dropped. */
export function tidyPattern(raw: unknown): Pattern | undefined {
  if (!raw || typeof raw !== "object") return undefined;
  const r = raw as Partial<Pattern>, length = r.length === 32 ? 32 : 16, base = emptyPattern(typeof r.name === "string" ? r.name.slice(0, 40) : "Pattern", length);
  base.bpm = clamp(Math.round(Number(r.bpm) || 120), BPM_MIN, BPM_MAX); base.swing = clamp(Math.round(Number(r.swing) || 0), 0, SWING_MAX);
  base.lanes = base.lanes.map((l) => { const got = Array.isArray(r.lanes) ? r.lanes.find((x) => x && x.voice === l.voice) : undefined; if (!got) return l;
    return { voice: l.voice, steps: l.steps.map((_, i) => { const h = Number(got.steps?.[i]); return (h === 1 || h === 2 || h === 3 ? h : 0) as Hit; }), level: clamp(Number(got.level ?? 80) || 0, 0, 100), mute: got.mute === true, solo: got.solo === true, tune: clamp(Math.round(Number(got.tune) || 0), -TUNE_MAX, TUNE_MAX), ...(typeof got.sample === "string" && got.sample && got.sample.length <= 64 ? { sample: got.sample } : {}) }; });
  return base;
}
