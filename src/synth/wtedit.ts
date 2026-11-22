// The wavetable editor's maths, with no browser parts so tests run exactly what the page runs.
// A wavetable is a list of frames; a frame is one cycle of a wave, FRAME samples long. Everything the editor
// does is a function from frames to new frames (nothing is changed in place), so undo is just keeping the old
// list. The set of features follows the wavetable editor described in the Serum 2 User Guide (pages 274 to
// 311 of the copy in the library): the drawing tools, the harmonic ("FFT") area and its menu, the frame,
// Single, All, Sort and Morph menus, the formula box, audio and picture import, and export. The code, the
// names and every number in it are this app's own; where the guide does not say exactly what a command does,
// the choice made here is written beside it.

export const FRAME = 2048;
/** How many harmonics the editor shows and edits (the guide's formula variable q also runs 1 to 512). */
export const BINS = 512;
export const MAX_FRAMES = 256;
export type Wave = Float32Array;
export type Morph = "none" | "crossfade" | "spectral";

const clamp = (v: number, lo = -1, hi = 1) => Math.min(hi, Math.max(lo, v));
export const blank = (): Wave => new Float32Array(FRAME);
export const fromFunction = (f: (t: number, i: number) => number): Wave => Float32Array.from({ length: FRAME }, (_, i) => f(i / FRAME, i));
/** The frame a new table starts with: a falling saw, as the guide's "Init All" gives. */
export const sawFrame = (): Wave => fromFunction((t) => 1 - 2 * t);

// ---------------------------------------------------------------------------------------------- spectra
/** In-place radix-2 FFT. `inverse` leaves the 1/N to the caller. */
export function fft(re: Float64Array, im: Float64Array, inverse = false): void {
  const n = re.length;
  for (let i = 1, j = 0; i < n; i++) {
    let bit = n >> 1;
    for (; j & bit; bit >>= 1) j ^= bit;
    j ^= bit;
    if (i < j) { const a = re[i]!; re[i] = re[j]!; re[j] = a; const b = im[i]!; im[i] = im[j]!; im[j] = b; }
  }
  for (let len = 2; len <= n; len <<= 1) {
    const ang = ((inverse ? 2 : -2) * Math.PI) / len, wr = Math.cos(ang), wi = Math.sin(ang);
    for (let i = 0; i < n; i += len) {
      let cr = 1, ci = 0;
      for (let k = 0; k < len / 2; k++) {
        const a = i + k, b = a + len / 2, xr = re[b]! * cr - im[b]! * ci, xi = re[b]! * ci + im[b]! * cr;
        re[b] = re[a]! - xr; im[b] = im[a]! - xi; re[a] = re[a]! + xr; im[a] = im[a]! + xi;
        const t = cr * wr - ci * wi; ci = cr * wi + ci * wr; cr = t;
      }
    }
  }
}
/**
 * A frame as harmonics: wave(t) = dc + sum over k of mag[k] * sin(2 pi k t + phase[k]), k from 1 to FRAME/2.
 * `phase` is in turns of a circle from -0.5 to 0.5 (0 is a plain sine).
 */
export interface Bins { dc: number; mag: Float32Array; phase: Float32Array }
export function toBins(w: Wave): Bins {
  const re = Float64Array.from(w), im = new Float64Array(FRAME), half = FRAME / 2;
  fft(re, im);
  const mag = new Float32Array(half + 1), phase = new Float32Array(half + 1);
  for (let k = 1; k <= half; k++) {
    const scale = k === half ? 1 / FRAME : 2 / FRAME, sin = -im[k]! * scale, cos = re[k]! * scale, m = Math.hypot(sin, cos);
    mag[k] = m; phase[k] = m > 1e-9 ? Math.atan2(cos, sin) / (2 * Math.PI) : 0;
  }
  return { dc: re[0]! / FRAME, mag, phase };
}
export function fromBins(b: Bins): Wave {
  const re = new Float64Array(FRAME), im = new Float64Array(FRAME), half = FRAME / 2;
  re[0] = b.dc * FRAME;
  for (let k = 1; k <= half; k++) {
    const m = b.mag[k] ?? 0; if (!m) continue;
    const a = 2 * Math.PI * (b.phase[k] ?? 0), sin = m * Math.cos(a), cos = m * Math.sin(a);
    if (k === half) { re[k] = cos * FRAME; continue; }
    re[k] = (cos * FRAME) / 2; im[k] = (-sin * FRAME) / 2; re[FRAME - k] = re[k]!; im[FRAME - k] = -im[k]!;
  }
  fft(re, im, true);
  return Float32Array.from(re, (v) => v / FRAME);
}
const withBins = (w: Wave, edit: (b: Bins) => void): Wave => { const b = toBins(w); edit(b); return fromBins(b); };
/** The sine and cosine parts of the first `count` harmonics, scaled as the synth's tables are (a full saw's first is 1). */
export function harmonicsOf(w: Wave, count: number): { sin: Float32Array; cos: Float32Array } {
  const b = toBins(w), sin = new Float32Array(count + 1), cos = new Float32Array(count + 1);
  for (let k = 1; k <= count && k <= FRAME / 2; k++) { const a = 2 * Math.PI * b.phase[k]!, m = b.mag[k]! * (Math.PI / 2); sin[k] = m * Math.cos(a); cos[k] = m * Math.sin(a); }
  return { sin, cos };
}

// ---------------------------------------------------------------------------------------- one frame ("Single")
export const peakOf = (w: Wave) => w.reduce((p, v) => Math.max(p, Math.abs(v)), 0);
export const normalize = (w: Wave, peak = peakOf(w)): Wave => (peak > 1e-9 ? w.map((v) => v / peak) : w.slice());
export const removeDc = (w: Wave): Wave => { const mean = w.reduce((a, v) => a + v, 0) / w.length; return w.map((v) => v - mean); };
export const flipVertical = (w: Wave): Wave => w.map((v) => -v);
export const flipHorizontal = (w: Wave): Wave => w.slice().reverse();
/** Turn the cycle round so that it starts where the wave crosses zero going up (the crossing nearest the start). */
export function shiftToZero(w: Wave): Wave {
  let at = -1;
  for (let i = 0; i < FRAME && at < 0; i++) if (w[(i + FRAME - 1) % FRAME]! <= 0 && w[i]! > 0) at = i;
  return at <= 0 ? w.slice() : rotate(w, at);
}
export const rotate = (w: Wave, by: number): Wave => fromFunction((_, i) => w[(((i + by) % FRAME) + FRAME) % FRAME]!);
const cell = (grid: number) => Math.max(1, Math.round(FRAME / Math.max(1, grid)));
/** Fade in over the first grid step and out over the last. */
export const fadeEdges = (w: Wave, grid: number): Wave => { const n = cell(grid); return w.map((v, i) => v * Math.min(1, i / n, (FRAME - 1 - i) / n)); };
/** Blend each edge toward the other over `n` samples so the cycle joins itself without a step. */
export function crossfadeEdges(w: Wave, n: number): Wave {
  const out = w.slice(), span = Math.min(FRAME / 2, Math.max(1, Math.round(n)));
  for (let i = 0; i < span; i++) { const a = 0.5 + (0.5 * i) / span, l = w[i]!, r = w[FRAME - 1 - i]!; out[i] = a * l + (1 - a) * r; out[FRAME - 1 - i] = a * r + (1 - a) * l; }
  return out;
}
/** Keep the first `keep` harmonics and remove the rest (our reading of "Filter (Grid Size)": the grid number is the count kept). */
export const lowPass = (w: Wave, keep: number): Wave => withBins(w, (b) => { b.dc = 0; for (let k = Math.max(1, Math.round(keep)) + 1; k < b.mag.length; k++) b.mag[k] = 0; });
/** Hold every sample for `hold` samples: a lower sample rate. */
export const sampleRedux = (w: Wave, hold: number): Wave => { const n = Math.max(1, Math.round(hold)); return fromFunction((_, i) => w[i - (i % n)]!); };
export const removeFundamental = (w: Wave): Wave => withBins(w, (b) => { b.mag[1] = 0; });
export const removeLowSpectra = (w: Wave, upTo: number): Wave => withBins(w, (b) => { for (let k = 1; k <= upTo && k < b.mag.length; k++) b.mag[k] = 0; });
export const removeLowPhases = (w: Wave, upTo: number): Wave => withBins(w, (b) => { for (let k = 1; k <= upTo && k < b.phase.length; k++) b.phase[k] = 0; });
/** Turn the cycle so its first harmonic is a plain sine (our reading of "Nudge all phases for fundamental"). */
export function alignFundamental(w: Wave): Wave { const b = toBins(w); return b.mag[1]! < 1e-9 ? w.slice() : rotate(w, Math.round(-b.phase[1]! * FRAME)); }
export const zeroPhases = (w: Wave): Wave => withBins(w, (b) => { b.phase.fill(0); });
const boxBlur = (a: Float32Array, reach: number, from = 1): Float32Array => a.map((_, k) => { if (k < from) return a[k]!; let sum = 0, n = 0; for (let j = Math.max(from, k - reach); j <= Math.min(a.length - 1, k + reach); j++) { sum += a[j]!; n++; } return sum / n; });
export const blurSpectraBins = (w: Wave, reach: number): Wave => withBins(w, (b) => { b.mag = boxBlur(b.mag, Math.max(1, reach)); });
export const blurPhasesBins = (w: Wave, reach: number): Wave => withBins(w, (b) => { b.phase = boxBlur(b.phase, Math.max(1, reach)); });

// ------------------------------------------------------------------------------------------ drawing tools
export const TOOLS = ["flat", "sine", "up", "down", "curveUp", "curveDown", "peak", "valley", "line", "smooth", "nudge", "noise"] as const;
export type Tool = (typeof TOOLS)[number];
export const TOOL_NAMES: Record<Tool, string> = { flat: "Flat line", sine: "Sine", up: "Slope up", down: "Slope down", curveUp: "Curve up", curveDown: "Curve down", peak: "Half sine, peak", valley: "Half sine, valley", line: "Join, straight", smooth: "Join, curved", nudge: "Nudge", noise: "Noise" };
/**
 * Draw with a tool in one grid step. `step` counts grid steps from the left; `y` is the pointer's height
 * (-1 to 1) for the shape tools, or how far it was dragged for Nudge and Noise. `seed` keeps noise repeatable.
 */
export function draw(w: Wave, tool: Tool, step: number, grid: number, y: number, mirror = false, seed = 1): Wave {
  const out = w.slice(), g = Math.max(1, Math.round(grid)), paint = (s: number, back: boolean) => {
    const a = Math.round((s * FRAME) / g), b = Math.round(((s + 1) * FRAME) / g), n = b - a; if (n <= 0 || s < 0 || s >= g) return;
    const left = w[a]!, right = w[b % FRAME]!; let r = (seed * 2654435761 + s * 97) >>> 0;
    for (let i = 0; i < n; i++) {
      const t0 = n > 1 ? i / (n - 1) : 0, t = back ? 1 - t0 : t0, old = w[a + i]!; let v = old;
      if (tool === "flat") v = y;
      else if (tool === "sine") v = y * Math.sin(2 * Math.PI * (back ? 1 - i / n : i / n));
      else if (tool === "up") v = y * (2 * t - 1);
      else if (tool === "down") v = y * (1 - 2 * t);
      else if (tool === "curveUp") v = y * Math.sin((Math.PI / 2) * t);
      else if (tool === "curveDown") v = y * Math.cos((Math.PI / 2) * t);
      else if (tool === "peak") v = y * Math.sin(Math.PI * t);
      else if (tool === "valley") v = -y * Math.sin(Math.PI * t);
      else if (tool === "line") v = left + (right - left) * (i / n);
      else if (tool === "smooth") v = left + (right - left) * (0.5 - 0.5 * Math.cos((Math.PI * i) / n));
      else if (tool === "nudge") v = old + y;
      else if (tool === "noise") {
        r = (Math.imul(r, 1664525) + 1013904223) >>> 0;
        if (y >= 0) v = old + y * (r / 2147483648 - 1);
        else { let sum = 0, cnt = 0; for (let j = Math.max(a, a + i - 8); j <= Math.min(b - 1, a + i + 8); j++) { sum += w[j]!; cnt++; } v = old + (sum / cnt - old) * Math.min(1, -y); }
      }
      out[a + i] = clamp(v);
    }
  };
  paint(step, false);
  if (mirror && g - 1 - step !== step) paint(g - 1 - step, true);
  return out;
}

// ---------------------------------------------------------------------------------- the harmonic area's menu
/** A repeatable list of numbers from 0 to 1. */
export function randomList(count: number, seed: number): number[] { let s = (seed >>> 0) || 1; return Array.from({ length: count }, () => { s = (Math.imul(s, 1664525) + 1013904223) >>> 0; return s / 4294967296; }); }
export const BIN_COMMANDS = ["clearAll", "clearHigh", "clearLow", "saw", "randomLow", "randomLowHalf", "randomAll", "gaps", "fade", "octaveUp", "octaveDown", "repeat"] as const;
export type BinCommand = (typeof BIN_COMMANDS)[number];
export const BIN_COMMAND_NAMES: Record<BinCommand, string> = { clearAll: "Clear all", clearHigh: "Clear above here", clearLow: "Clear below here", saw: "Make a saw", randomLow: "Random, lowest ones", randomLowHalf: "Random, lowest ones (with halves)", randomAll: "Random, all", gaps: "Random gaps", fade: "Fade the top gradually", octaveUp: "Shift an octave up", octaveDown: "Shift an octave down", repeat: "Repeat the group up to here" };
/** `at` is the harmonic the menu was opened on; `count` is how many low harmonics the random commands touch. */
export function binCommand(w: Wave, command: BinCommand, at = 1, seed = 1, count = 16): Wave {
  return withBins(w, (b) => {
    const top = b.mag.length - 1, r = randomList(top + 1, seed), m = b.mag.slice(), p = b.phase.slice();
    if (command === "clearAll") { b.mag.fill(0); b.dc = 0; }
    else if (command === "clearHigh") for (let k = at + 1; k <= top; k++) b.mag[k] = 0;
    else if (command === "clearLow") for (let k = 1; k < at; k++) b.mag[k] = 0;
    else if (command === "saw") { b.dc = 0; for (let k = 1; k <= top; k++) { b.mag[k] = k <= BINS ? 2 / (Math.PI * k) : 0; b.phase[k] = 0; } }
    else if (command === "randomLow") for (let k = 1; k <= count; k++) b.mag[k] = r[k]! < 0.5 ? 0 : 2 / (Math.PI * k) * k ** 0.5;
    else if (command === "randomLowHalf") for (let k = 1; k <= count; k++) b.mag[k] = (Math.floor(r[k]! * 3) / 2) * (2 / (Math.PI * k)) * k ** 0.5;
    else if (command === "randomAll") for (let k = 1; k <= BINS; k++) { b.mag[k] = (r[k]! * 2) / (Math.PI * Math.sqrt(k)); b.phase[k] = r[(k * 7) % top]! - 0.5; }
    else if (command === "gaps") for (let k = 2; k <= top; k++) { if (r[k]! < 0.5) b.mag[k] = 0; }
    else if (command === "fade") for (let k = 1; k <= top; k++) b.mag[k] = b.mag[k]! / Math.sqrt(k);
    else if (command === "octaveUp") { b.mag.fill(0); for (let k = 1; 2 * k <= top; k++) { b.mag[2 * k] = m[k]!; b.phase[2 * k] = p[k]!; } }
    else if (command === "octaveDown") { b.mag.fill(0); for (let k = 1; 2 * k <= top; k++) { b.mag[k] = m[2 * k]!; b.phase[k] = p[2 * k]!; } }
    else if (command === "repeat") { const n = Math.max(1, at); for (let k = n + 1; k <= BINS; k++) { b.mag[k] = m[((k - 1) % n) + 1]!; b.phase[k] = p[((k - 1) % n) + 1]!; } }
  });
}
/** Set one harmonic's strength (0 to 1 of full height) or its phase (turns), as dragging a bar does. */
export const setBin = (w: Wave, k: number, what: "mag" | "phase", value: number): Wave => withBins(w, (b) => { if (k >= 1 && k < b.mag.length) { if (what === "mag") b.mag[k] = Math.max(0, value); else b.phase[k] = ((((value + 0.5) % 1) + 1) % 1) - 0.5; } });

// ----------------------------------------------------------------------------------------- the list of frames
export const insertAfter = (frames: Wave[], at: number, frame: Wave = blank()): Wave[] => (frames.length >= MAX_FRAMES ? frames : [...frames.slice(0, at + 1), frame, ...frames.slice(at + 1)]);
/** Remove frames `from` to `to` (inclusive); a table always keeps at least one frame. */
export function removeRange(frames: Wave[], from: number, to: number): Wave[] { const left = frames.filter((_, i) => i < from || i > to); return left.length ? left : [sawFrame()]; }
export const keepRange = (frames: Wave[], from: number, to: number): Wave[] => frames.slice(from, to + 1);
/** Keep every nth frame, starting with the first. */
export const reduceTo = (frames: Wave[], every: number): Wave[] => frames.filter((_, i) => i % Math.max(1, Math.round(every)) === 0);
export function moveFrame(frames: Wave[], from: number, to: number): Wave[] { const out = frames.slice(), [f] = out.splice(from, 1); if (!f) return frames; out.splice(Math.max(0, Math.min(out.length, to)), 0, f); return out; }
export const pasteFrames = (frames: Wave[], at: number, clip: Wave[]): Wave[] => { const out = frames.slice(); clip.forEach((f, i) => { if (at + i < MAX_FRAMES) out[at + i] = f.slice(); }); for (let i = 0; i < out.length; i++) out[i] ??= blank(); return out; };
export const SORTS = ["peakBin", "average", "peakAmount", "count", "highest", "fundamental", "random", "reverse"] as const;
export type Sort = (typeof SORTS)[number];
export const SORT_NAMES: Record<Sort, string> = { peakBin: "By strongest harmonic", average: "By brightness (average)", peakAmount: "By size of the strongest harmonic", count: "By how many harmonics", highest: "By highest harmonic present", fundamental: "By size of the first harmonic", random: "Shuffle", reverse: "Reverse the order" };
/** The number each sort goes by, for one frame. */
export function sortKey(w: Wave, by: Sort): number {
  const b = toBins(w); let peak = 1, total = 0, weighted = 0, count = 0, highest = 0;
  const floor = 0.01 * b.mag.reduce((p, v) => Math.max(p, v), 0);
  for (let k = 1; k <= BINS; k++) { const m = b.mag[k]!; if (m > b.mag[peak]!) peak = k; total += m; weighted += m * k; if (m > floor && m > 1e-6) { count++; highest = k; } }
  return by === "peakBin" ? peak : by === "average" ? (total ? weighted / total : 0) : by === "peakAmount" ? b.mag[peak]! : by === "count" ? count : by === "highest" ? highest : b.mag[1]!;
}
export function sortFrames(frames: Wave[], by: Sort, seed = 1): Wave[] {
  if (by === "reverse") return frames.slice().reverse();
  const keys = by === "random" ? randomList(frames.length, seed) : frames.map((f) => sortKey(f, by));
  return frames.map((f, i) => ({ f, k: keys[i]!, i })).sort((a, b) => a.k - b.k || a.i - b.i).map((x) => x.f);
}

// ------------------------------------------------------------------------------------------- all frames ("All")
const stretch = (w: ArrayLike<number>, from: number, length: number): Wave => fromFunction((t) => { const at = from + t * length, i = Math.floor(at), a = w[Math.min(w.length - 1, i)] ?? 0, b = w[Math.min(w.length - 1, i + 1)] ?? a; return a + (b - a) * (at - i); });
/** A whole sound squeezed or stretched into one frame. */
export const stretchTo = (samples: ArrayLike<number>): Wave => stretch(samples, 0, Math.max(1, samples.length - 1));
export const normalizeSame = (frames: Wave[]): Wave[] => { const peak = frames.reduce((p, f) => Math.max(p, peakOf(f)), 0); return frames.map((f) => normalize(f, peak)); };
/** Each frame becomes two: its first half and its second half, each stretched to a whole cycle. */
export const splitHalves = (frames: Wave[]): Wave[] => frames.flatMap((f) => [stretch(f, 0, FRAME / 2), stretch(f, FRAME / 2, FRAME / 2)]).slice(0, MAX_FRAMES);
/** Each pair of neighbouring frames becomes one frame holding both. */
export const joinPairs = (frames: Wave[]): Wave[] => Array.from({ length: Math.ceil(frames.length / 2) }, (_, i) => { const a = frames[2 * i]!, b = frames[2 * i + 1] ?? a, both = new Float32Array(FRAME * 2); both.set(a); both.set(b, FRAME); return stretch(both, 0, FRAME * 2); });
/** A set of frames in which the wave is squeezed into less and less of the cycle (the rest is held at its last value). */
export const pwmFrom = (w: Wave, count = 64): Wave[] => Array.from({ length: count }, (_, f) => { const width = 1 - (0.95 * f) / Math.max(1, count - 1); return fromFunction((t) => (t < width ? w[Math.min(FRAME - 1, Math.floor((t / width) * FRAME))]! : w[FRAME - 1]!)); });
export const setSpectraFrom = (w: Wave, source: Wave): Wave => { const s = toBins(source); return withBins(w, (b) => { b.mag = s.mag.slice(); b.dc = s.dc; }); };
export const setPhasesFrom = (w: Wave, source: Wave): Wave => { const s = toBins(source); return withBins(w, (b) => { b.phase = s.phase.slice(); }); };
export const subtractSpectra = (w: Wave, other: Wave): Wave => { const o = toBins(other); return withBins(w, (b) => { b.mag = b.mag.map((m, k) => Math.max(0, m - o.mag[k]!)); }); };
/** The frame of another table that sits at the same place along it as frame `i` of `count` does here. */
export const sameplace = (other: Wave[], i: number, count: number): Wave => other[Math.round((count > 1 ? i / (count - 1) : 0) * (other.length - 1))] ?? blank();
/** Average each harmonic's strength (or phase) with the same harmonic in the frames up to `reach` either side. */
export function blurFrames(frames: Wave[], reach: number, what: "mag" | "phase"): Wave[] {
  const all = frames.map(toBins), r = Math.max(1, Math.round(reach));
  return all.map((b, i) => { const out: Bins = { dc: b.dc, mag: b.mag.slice(), phase: b.phase.slice() }; for (let k = 1; k < b.mag.length; k++) { let sum = 0, n = 0; for (let j = Math.max(0, i - r); j <= Math.min(all.length - 1, i + r); j++) { sum += all[j]![what][k]!; n++; } out[what][k] = sum / n; } return fromBins(out); });
}

// ------------------------------------------------------------------------------------------------- morphing
/**
 * The wave at a place between frames. `position` runs 0 to 1 along the table. "none" jumps from frame to
 * frame; "crossfade" mixes the two neighbours' waves; "spectral" moves each harmonic's strength and phase
 * from one neighbour to the other (phases take the shorter way round).
 */
export function morphAt(frames: Wave[], position: number, morph: Morph): Wave {
  if (frames.length === 1) return frames[0]!.slice();
  const at = clamp(position, 0, 1) * (frames.length - 1), i = Math.min(frames.length - 2, Math.floor(at)), mix = at - i;
  if (morph === "none") return frames[Math.min(frames.length - 1, Math.round(at))]!.slice();
  const a = frames[i]!, b = frames[i + 1]!;
  if (morph === "crossfade" || mix === 0) return a.map((v, n) => v * (1 - mix) + b[n]! * mix);
  const x = toBins(a), y = toBins(b), out: Bins = { dc: x.dc * (1 - mix) + y.dc * mix, mag: new Float32Array(x.mag.length), phase: new Float32Array(x.mag.length) };
  for (let k = 1; k < x.mag.length; k++) {
    out.mag[k] = x.mag[k]! * (1 - mix) + y.mag[k]! * mix;
    const from = x.mag[k]! > 1e-9 ? x.phase[k]! : y.phase[k]!, to = y.mag[k]! > 1e-9 ? y.phase[k]! : from; let d = to - from; d -= Math.round(d);
    out.phase[k] = from + d * mix;
  }
  return fromBins(out);
}
/** Write the in-between waves out as real frames: `total` frames from the table as it morphs. */
export const renderMorph = (frames: Wave[], morph: Morph, total: number): Wave[] => { const n = Math.min(MAX_FRAMES, Math.max(1, Math.round(total))); return Array.from({ length: n }, (_, i) => morphAt(frames, n > 1 ? i / (n - 1) : 0, morph)); };

// ------------------------------------------------------------------------------------------------- import
/** Cut a sound into pieces of `size` samples (it need not be whole) and stretch each to one frame. */
export function splitFixed(samples: ArrayLike<number>, size: number, most = MAX_FRAMES): Wave[] {
  const out: Wave[] = [];
  for (let f = 0; f < most && (f + 1) * size <= samples.length + 0.5; f++) out.push(stretch(samples, f * size, size));
  return out.length ? out : [stretch(samples, 0, Math.max(1, samples.length - 1))];
}
/**
 * The length of one cycle, in samples, in a stretch of sound: the lag (between `lo` and `hi`) at which the
 * sound best matches a delayed copy of itself. Zero when it has no clear pitch.
 */
export function periodOf(samples: ArrayLike<number>, from = 0, length = samples.length - from, lo = 32, hi = 2048): number {
  const n = Math.min(length, 8192), top = Math.min(Math.floor(hi), Math.floor(n / 2)), low = Math.max(2, Math.floor(lo)); if (top <= low + 1) return 0;
  // how well the sound matches itself at every delay, worked out in one go from its spectrum
  let size = 1; while (size < 2 * n) size <<= 1;
  const re = new Float64Array(size), im = new Float64Array(size);
  for (let i = 0; i < n; i++) re[i] = samples[from + i] ?? 0;
  fft(re, im);
  for (let i = 0; i < size; i++) { re[i] = re[i]! * re[i]! + im[i]! * im[i]!; im[i] = 0; }
  fft(re, im, true);
  if (re[0]! < 1e-9) return 0;
  const score = (lag: number) => (re[lag]! / re[0]!) * (n / (n - lag));
  let best = 0; for (let lag = low; lag <= top; lag++) best = Math.max(best, score(lag));
  if (best < 0.5) return 0;
  // the shortest delay that is nearly as good as the best one, so an octave below is not chosen by mistake
  for (let lag = low + 1; lag < top; lag++) if (score(lag) >= best * 0.93 && score(lag) >= score(lag - 1) && score(lag) >= score(lag + 1)) {
    const a = score(lag - 1), b = score(lag), c = score(lag + 1), bend = a - 2 * b + c;
    return lag + (bend ? (0.5 * (a - c)) / bend : 0);
  }
  return 0;
}
/** One cycle length for the whole sound: the middle value of the lengths found along it. */
export function averagePeriod(samples: ArrayLike<number>): number {
  const found: number[] = [], hop = Math.max(2048, Math.floor(samples.length / 12));
  for (let at = 0; at + 4096 <= samples.length; at += hop) { const p = periodOf(samples, at, 8192); if (p) found.push(p); }
  if (!found.length) { const p = periodOf(samples); return p; }
  return found.sort((a, b) => a - b)[Math.floor(found.length / 2)]!;
}
/**
 * Follow the pitch along the sound: each frame is the next cycle, whatever length the pitch gives it there.
 * With `snap`, each cut is moved to the nearest place the wave crosses zero going up.
 */
export function splitFollowing(samples: ArrayLike<number>, snap: boolean, most = MAX_FRAMES): Wave[] {
  const out: Wave[] = [], fallback = averagePeriod(samples) || FRAME; let at = 0, last = fallback;
  const cycles = Math.max(1, Math.floor(samples.length / fallback)), skip = Math.max(1, Math.ceil(cycles / most));
  for (let c = 0; at + last <= samples.length && out.length < most; c++) {
    const p = c % 8 === 0 ? periodOf(samples, Math.floor(at), 4096, Math.max(32, last * 0.7), Math.min(2048, last * 1.4)) || last : last; last = p;
    let start = at, end = at + p;
    if (snap) {
      const near = (x: number) => { for (let d = 0; d < p / 4; d++) for (const s of [Math.round(x) + d, Math.round(x) - d]) if (s > 0 && s < samples.length && samples[s - 1]! <= 0 && samples[s]! > 0) return s; return x; };
      start = near(start); end = Math.max(start + 8, near(end));
    }
    if (c % skip === 0 && end <= samples.length) out.push(stretch(samples, start, end - start));
    at = snap ? end : at + p;
  }
  return out.length ? out : splitFixed(samples, fallback, most);
}
/** Slice the sound into blocks of `size` samples and use each block's spectrum as a frame's harmonics, all starting in step. */
export function splitSpectral(samples: ArrayLike<number>, size: number, most = MAX_FRAMES): Wave[] {
  const out: Wave[] = [], blocks = Math.max(1, Math.floor(samples.length / size)), count = Math.min(most, blocks);
  for (let n = 0; n < count; n++) {
    const f = Math.floor((n * blocks) / count);
    const re = new Float64Array(size), im = new Float64Array(size);
    for (let i = 0; i < size; i++) re[i] = (samples[f * size + i] ?? 0) * (0.5 - 0.5 * Math.cos((2 * Math.PI * i) / size));
    fft(re, im);
    const b: Bins = { dc: 0, mag: new Float32Array(FRAME / 2 + 1), phase: new Float32Array(FRAME / 2 + 1) };
    for (let k = 1; k < size / 2 && k <= FRAME / 2; k++) b.mag[k] = (4 * Math.hypot(re[k]!, im[k]!)) / size;
    out.push(fromBins(b));
  }
  return out;
}
/**
 * Measure the sound's harmonics at its own pitch and rebuild each frame from them, so the cycle length need
 * not be a whole number of samples (our version of the guide's "frequency estimation").
 */
export function splitByHarmonics(samples: ArrayLike<number>, most = 64): Wave[] {
  const period = averagePeriod(samples); if (!period) return splitFixed(samples, FRAME, most);
  const span = Math.round(period * 4), count = Math.max(1, Math.min(most, Math.floor((samples.length - span) / (period * 2)) + 1)), top = Math.min(BINS, Math.floor(period / 2) - 1);
  const hop = count > 1 ? (samples.length - span) / (count - 1) : 0, out: Wave[] = [];
  for (let f = 0; f < count; f++) {
    const from = Math.floor(f * hop), b: Bins = { dc: 0, mag: new Float32Array(FRAME / 2 + 1), phase: new Float32Array(FRAME / 2 + 1) };
    for (let k = 1; k <= top; k++) {
      let s = 0, c = 0, wsum = 0;
      for (let i = 0; i < span; i++) { const win = 0.5 - 0.5 * Math.cos((2 * Math.PI * i) / span), x = (samples[from + i] ?? 0) * win, a = (2 * Math.PI * k * i) / period; s += x * Math.sin(a); c += x * Math.cos(a); wsum += win; }
      const sin = (2 * s) / wsum, cos = (2 * c) / wsum; b.mag[k] = Math.hypot(sin, cos); b.phase[k] = Math.atan2(cos, sin) / (2 * Math.PI);
    }
    out.push(fromBins(b));
  }
  return out;
}
/** A picture as a table: each column of pixels is a frame, read top to bottom; black is 0 and white is full height. */
export function fromImage(luminance: ArrayLike<number>, width: number, height: number): Wave[] {
  const cols = Math.min(MAX_FRAMES, width), out: Wave[] = [];
  for (let f = 0; f < cols; f++) { const x = Math.min(width - 1, Math.floor((f * width) / cols)); out.push(removeDc(fromFunction((t) => (luminance[Math.min(height - 1, Math.floor(t * height)) * width + x] ?? 0) / 255))); }
  return out;
}
const NOTE = /^([A-Ga-g])([#b]?)(-?\d)$/;
/** What typing a number or a note name into the formula box means for import: a cycle length in samples at 44.1 kHz. */
export function splitSizeOf(text: string, rate = 44100): number | undefined {
  const t = text.trim();
  if (/^\d{1,4}$/.test(t)) { const n = Number(t); return n >= 32 && n <= 9999 ? n : undefined; }
  const m = NOTE.exec(t); if (!m) return undefined;
  const semis = { c: 0, d: 2, e: 4, f: 5, g: 7, a: 9, b: 11 }[m[1]!.toLowerCase() as "c"]! + (m[2] === "#" ? 1 : m[2] === "b" ? -1 : 0), midi = 12 * (Number(m[3]) + 1) + semis;
  const size = Math.round(rate / (440 * 2 ** ((midi - 69) / 12)));
  return size >= 32 && size <= 9999 ? size : undefined;
}

// ------------------------------------------------------------------------------------------------- export
/** A mono WAV file of all the frames end to end: 16-bit whole numbers, or 32-bit floats. */
export function tableWav(frames: Wave[], bits: 16 | 32, rate = 44100): Uint8Array {
  const n = frames.length * FRAME, bytes = bits / 8, out = new DataView(new ArrayBuffer(44 + n * bytes)), text = (at: number, s: string) => { for (let i = 0; i < s.length; i++) out.setUint8(at + i, s.charCodeAt(i)); };
  text(0, "RIFF"); out.setUint32(4, 36 + n * bytes, true); text(8, "WAVEfmt "); out.setUint32(16, 16, true); out.setUint16(20, bits === 32 ? 3 : 1, true); out.setUint16(22, 1, true);
  out.setUint32(24, rate, true); out.setUint32(28, rate * bytes, true); out.setUint16(32, bytes, true); out.setUint16(34, bits, true); text(36, "data"); out.setUint32(40, n * bytes, true);
  frames.forEach((f, i) => f.forEach((v, j) => { const at = 44 + (i * FRAME + j) * bytes; if (bits === 32) out.setFloat32(at, v, true); else out.setInt16(at, Math.round(clamp(v) * 32767), true); }));
  return new Uint8Array(out.buffer);
}
/** The 8-bit form some hardware takes: 256 samples a frame, one byte each, no header. */
export const table8bit = (frames: Wave[]): Uint8Array => Uint8Array.from(frames.flatMap((f) => Array.from({ length: 256 }, (_, i) => Math.round((clamp(f[i * 8]!) * 0.5 + 0.5) * 255))));
/** Read a WAV file's first channel as numbers from -1 to 1 (8, 16, 24 and 32-bit whole numbers, and 32-bit floats). */
export function readWav(bytes: Uint8Array): { samples: Float32Array; rate: number } | undefined {
  const v = new DataView(bytes.buffer, bytes.byteOffset, bytes.byteLength), tag = (at: number) => String.fromCharCode(v.getUint8(at), v.getUint8(at + 1), v.getUint8(at + 2), v.getUint8(at + 3));
  if (bytes.length < 44 || tag(0) !== "RIFF" || tag(8) !== "WAVE") return undefined;
  let at = 12, format = 1, channels = 1, rate = 44100, bits = 16;
  while (at + 8 <= bytes.length) {
    const id = tag(at), size = v.getUint32(at + 4, true), body = at + 8;
    if (id === "fmt ") { format = v.getUint16(body, true); channels = Math.max(1, v.getUint16(body + 2, true)); rate = v.getUint32(body + 4, true); bits = v.getUint16(body + 14, true); if (format === 0xfffe && size >= 26) format = v.getUint16(body + 24, true); }
    else if (id === "data") {
      const step = (bits / 8) * channels, n = Math.floor(Math.min(size, bytes.length - body) / step), samples = new Float32Array(n);
      for (let i = 0; i < n; i++) { const p = body + i * step; samples[i] = format === 3 ? v.getFloat32(p, true) : bits === 8 ? (v.getUint8(p) - 128) / 128 : bits === 16 ? v.getInt16(p, true) / 32768 : bits === 24 ? ((v.getUint8(p) | (v.getUint8(p + 1) << 8) | (v.getInt8(p + 2) << 16))) / 8388608 : v.getInt32(p, true) / 2147483648; }
      return { samples, rate };
    }
    at = body + size + (size % 2);
  }
  return undefined;
}
