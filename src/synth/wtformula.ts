// The wavetable editor's formula box. A formula is read by the small parser below into a function; nothing is
// ever handed to the JavaScript engine to run. The functions, operators and variables are the ones the Serum 2
// User Guide lists for its formula parser (pages 304 to 311 of the copy in the library), so formulas written
// for it can be tried here: w and x (time, 0..1 and -1..1), y and z (which frame, 0..1 and -1..1), q (the
// harmonic number, 1 to 512: a formula with q writes harmonics, not the wave), in (the wave or harmonic as it
// was), sel (the selected frame as it was) and rand (a random number per time step, the same in every frame).
import { BINS, FRAME, fromBins, randomList, toBins, type Wave } from "./wtedit";

type Vars = { w: number; x: number; y: number; z: number; q: number; in: number; sel: number; rand: number };
type Node = (v: Vars) => number;
const ONE: Record<string, (a: number) => number> = {
  sin: Math.sin, cos: Math.cos, tan: Math.tan, asin: Math.asin, acos: Math.acos, atan: Math.atan, sinh: Math.sinh, cosh: Math.cosh, tanh: Math.tanh,
  asinh: Math.asinh, acosh: Math.acosh, atanh: Math.atanh, log2: Math.log2, log10: Math.log10, log: Math.log10, ln: Math.log, exp: Math.exp, sqrt: Math.sqrt,
  sign: Math.sign, rint: Math.round, abs: Math.abs, floor: Math.floor, ceil: Math.ceil,
};
const MANY: Record<string, (a: number[]) => number> = {
  min: (a) => Math.min(...a), max: (a) => Math.max(...a), sum: (a) => a.reduce((s, v) => s + v, 0), avg: (a) => a.reduce((s, v) => s + v, 0) / a.length,
};
const NAMES = ["w", "x", "y", "z", "q", "in", "sel", "rand"] as const;
export const FORMULA_MAX = 240;
export interface Formula { fn: Node; uses: Set<string> }

/** Read a formula. Gives the function and which variables it uses, or a short reason it was refused. */
export function readFormula(text: string): { ok: true; formula: Formula } | { ok: false; reason: string } {
  if (text.length > FORMULA_MAX) return { ok: false, reason: "The formula is too long." };
  const tokens = (text.match(/\d+\.?\d*(?:[eE][+-]?\d+)?|\.\d+|[A-Za-z_][A-Za-z0-9_]*|&&|\|\||<=|>=|==|!=|[-+*/^%(),<>?:]|\S/g) ?? []);
  if (!tokens.length) return { ok: false, reason: "There is no formula." };
  let at = 0, depth = 0; const uses = new Set<string>();
  const fail = (reason: string): never => { throw new Error(reason); }, peek = () => tokens[at], take = () => tokens[at++]!;
  const expect = (t: string) => { if (take() !== t) fail(`Expected "${t}".`); };
  const binary = (next: () => Node, ops: Record<string, (a: number, b: number) => number>) => (): Node => {
    let left = next();
    while (peek() !== undefined && peek()! in ops) { const f = ops[take()]!, a = left, b = next(); left = (v) => f(a(v), b(v)); }
    return left;
  };
  function primary(): Node {
    if (++depth > 40) fail("The formula is nested too deeply.");
    const t = take();
    try {
      if (t === undefined) return fail("The formula stops early.");
      if (t === "(") { const inner = ternary(); expect(")"); return inner; }
      if (t === "-") { const a = power(); return (v) => -a(v); }
      if (t === "+") return power();
      if (/^[\d.]/.test(t)) { const n = Number(t); if (!Number.isFinite(n)) fail(`"${t}" is not a number.`); return () => n; }
      if (/^[A-Za-z_]/.test(t)) {
        const name = t.toLowerCase();
        if (name === "pi") return () => Math.PI;
        if (name === "e") return () => Math.E;
        if ((NAMES as readonly string[]).includes(name)) { uses.add(name); return (v) => v[name as keyof Vars]; }
        if (name in ONE || name in MANY) {
          expect("("); const args: Node[] = [ternary()];
          while (peek() === ",") { take(); args.push(ternary()); }
          expect(")");
          if (name in ONE) { if (args.length !== 1) fail(`${name} takes one number.`); const f = ONE[name]!, a = args[0]!; return (v) => f(a(v)); }
          const f = MANY[name]!; return (v) => f(args.map((a) => a(v)));
        }
        return fail(`"${t}" is not a name the formula box knows.`);
      }
      return fail(`"${t}" is not arithmetic.`);
    } finally { depth--; }
  }
  function power(): Node { const base = primary(); if (peek() === "^") { take(); const exp = power(); return (v) => Math.pow(base(v), exp(v)); } return base; }
  const product = binary(power, { "*": (a, b) => a * b, "/": (a, b) => a / b, "%": (a, b) => a % b });
  const sum = binary(product, { "+": (a, b) => a + b, "-": (a, b) => a - b });
  const compare = binary(sum, { "<": (a, b) => +(a < b), ">": (a, b) => +(a > b), "<=": (a, b) => +(a <= b), ">=": (a, b) => +(a >= b), "==": (a, b) => +(a === b), "!=": (a, b) => +(a !== b) });
  const and = binary(compare, { "&&": (a, b) => +(a !== 0 && b !== 0) });
  const or = binary(and, { "||": (a, b) => +(a !== 0 || b !== 0) });
  function ternary(): Node {
    const test = or();
    if (peek() !== "?") return test;
    take(); const yes = ternary(); expect(":"); const no = ternary();
    return (v) => (test(v) !== 0 ? yes(v) : no(v));
  }
  try {
    const fn = ternary();
    if (at < tokens.length) fail(`Did not expect "${tokens[at]}".`);
    return { ok: true, formula: { fn, uses } };
  } catch (e) { return { ok: false, reason: (e as Error).message }; }
}

const safe = (v: number, limit: number) => (Number.isFinite(v) ? Math.min(limit, Math.max(-limit, v)) : 0);
/** How many frames a formula with y or z makes when the table has only one. */
export const FORMULA_FRAMES = 64;
/**
 * Run a formula on a table. Without y or z only frame `selected` changes; with them every frame is written
 * (and a one-frame table is first grown to FORMULA_FRAMES frames). With q the result sets each harmonic's
 * strength (phases are kept if the formula uses `in`, and set to zero otherwise); without q it sets the wave.
 */
export function applyFormula(frames: Wave[], selected: number, formula: Formula, seed = 1): Wave[] {
  const all = formula.uses.has("y") || formula.uses.has("z"), spectral = formula.uses.has("q");
  const base = all && frames.length < 2 ? Array.from({ length: FORMULA_FRAMES }, () => frames[0]!) : frames;
  const sel = base[Math.min(base.length - 1, selected)]!, selBins = spectral ? toBins(sel) : undefined, rand = randomList(FRAME, seed);
  return base.map((frame, i) => {
    if (!all && i !== selected) return frame;
    const y = base.length > 1 ? i / (base.length - 1) : 0, v: Vars = { w: 0, x: 0, y, z: 2 * y - 1, q: 0, in: 0, sel: 0, rand: 0 };
    if (spectral) {
      const b = toBins(frame), keep = formula.uses.has("in") || formula.uses.has("sel");
      for (let q = 1; q < b.mag.length; q++) {
        if (q > BINS) { b.mag[q] = 0; continue; }
        // a harmonic's "full height" is the first harmonic of a full saw, so (1/q) draws a saw
        v.q = q; v.in = b.mag[q]! / (2 / Math.PI); v.sel = selBins!.mag[q]! / (2 / Math.PI); v.rand = rand[q]! * 2 - 1;
        b.mag[q] = Math.abs(safe(formula.fn(v), 4)) * (2 / Math.PI); if (!keep) b.phase[q] = 0;
      }
      b.dc = 0;
      return fromBins(b);
    }
    return Float32Array.from({ length: FRAME }, (_, n) => { v.w = n / FRAME; v.x = 2 * v.w - 1; v.in = frame[n]!; v.sel = sel[n]!; v.rand = rand[n]! * 2 - 1; return safe(formula.fn(v), 1); });
  });
}
/** Starting formulas, written for this app (not Serum's presets). "Each frame" ones use y or z. */
export const FORMULA_EXAMPLES: { name: string; text: string; all: boolean }[] = [
  { name: "Sine", text: "sin(2*pi*w)", all: false },
  { name: "Saw", text: "-x", all: false },
  { name: "Square", text: "sign(sin(2*pi*w))", all: false },
  { name: "Triangle", text: "1-4*abs(w-0.5)", all: false },
  { name: "Soft clip of what is there", text: "tanh(3*in)", all: false },
  { name: "Fold what is there", text: "sin(pi*1.5*in)", all: false },
  { name: "Rectify what is there", text: "abs(in)*2-1", all: false },
  { name: "First 16 harmonics", text: "q<17", all: false },
  { name: "Saw from harmonics", text: "1/q", all: false },
  { name: "Odd harmonics of what is there", text: "((q%2)==1)?in:0", all: false },
  { name: "Remove the first harmonic", text: "(q>1)?in:0", all: false },
  { name: "Each frame: sine into square", text: "tanh((1+40*y)*sin(2*pi*w))", all: true },
  { name: "Each frame: pulse narrowing", text: "(w<(0.5-0.47*y))?1:-1", all: true },
  { name: "Each frame: one more harmonic", text: "(q<=1+y*63)/q", all: true },
  { name: "Each frame: dull to bright", text: "(1/q)^(1.5-1.2*y)", all: true },
  { name: "Each frame: FM growing", text: "sin(2*pi*w+8*y*sin(2*pi*w))", all: true },
  { name: "Each frame: sync sweep", text: "2*((w*(1+7*y))%1)-1", all: true },
  { name: "Each frame: folding sine", text: "sin((1+7*y)*pi/2*sin(2*pi*w))", all: true },
];
