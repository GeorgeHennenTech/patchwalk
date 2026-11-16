// A small, safe calculator for formulas the guide hands over to be drawn. It reads plain arithmetic
// (+ - * / ^, brackets, a fixed list of functions, pi and e) into a function of named variables. Nothing is
// ever passed to the JavaScript engine to run: an expression is either understood here or refused.

const FUNCTIONS: Record<string, { args: number; fn: (...a: number[]) => number }> = {
  sin: { args: 1, fn: Math.sin }, cos: { args: 1, fn: Math.cos }, tan: { args: 1, fn: Math.tan },
  asin: { args: 1, fn: Math.asin }, acos: { args: 1, fn: Math.acos }, atan: { args: 1, fn: Math.atan },
  sinh: { args: 1, fn: Math.sinh }, cosh: { args: 1, fn: Math.cosh }, tanh: { args: 1, fn: Math.tanh },
  exp: { args: 1, fn: Math.exp }, ln: { args: 1, fn: Math.log }, log: { args: 1, fn: Math.log10 }, log10: { args: 1, fn: Math.log10 }, log2: { args: 1, fn: Math.log2 },
  sqrt: { args: 1, fn: Math.sqrt }, abs: { args: 1, fn: Math.abs }, floor: { args: 1, fn: Math.floor }, round: { args: 1, fn: Math.round }, sign: { args: 1, fn: Math.sign },
  min: { args: 2, fn: Math.min }, max: { args: 2, fn: Math.max }, pow: { args: 2, fn: Math.pow },
};
const CONSTANTS: Record<string, number> = { pi: Math.PI, e: Math.E };
/** Names a variable may not take, because they already mean something. */
export const RESERVED = new Set([...Object.keys(FUNCTIONS), ...Object.keys(CONSTANTS)]);
export const MAX_EXPRESSION = 300;

export type Formula = (values: Record<string, number>) => number;
type Node = (v: Record<string, number>) => number;

/**
 * Reads `expression` using only the variables named. Returns the function, or a short reason it was
 * refused (an unknown name, a missing bracket, a character that is not arithmetic).
 */
export function compile(expression: string, variables: string[]): { ok: true; fn: Formula } | { ok: false; reason: string } {
  if (expression.length > MAX_EXPRESSION) return { ok: false, reason: "the formula is too long" };
  const tokens = expression.match(/\s+|\d+\.?\d*(?:[eE][+-]?\d+)?|\.\d+|[A-Za-z_][A-Za-z0-9_]*|[-+*/^(),]|./g) ?? [];
  const list = tokens.filter((t) => !/^\s+$/.test(t));
  if (!list.length) return { ok: false, reason: "there is no formula" };
  const known = new Set(variables);
  let at = 0, depth = 0;
  const fail = (reason: string): never => { throw new Error(reason); };
  const peek = () => list[at];
  const take = (want?: string) => { const t = list[at]; if (want !== undefined && t !== want) fail(`expected "${want}"`); at++; return t!; };

  function sum(): Node {
    let left = product();
    while (peek() === "+" || peek() === "-") { const op = take(), a = left, b = product(); left = op === "+" ? (v) => a(v) + b(v) : (v) => a(v) - b(v); }
    return left;
  }
  function product(): Node {
    let left = unary();
    while (peek() === "*" || peek() === "/") { const op = take(), a = left, b = unary(); left = op === "*" ? (v) => a(v) * b(v) : (v) => a(v) / b(v); }
    return left;
  }
  function unary(): Node {
    if (peek() === "-") { take(); const a = unary(); return (v) => -a(v); }
    if (peek() === "+") { take(); return unary(); }
    return power();
  }
  function power(): Node {
    const base = atom();
    if (peek() !== "^") return base;
    take();
    const exponent = unary(); // to the right first: 2^3^2 is 2^(3^2)
    return (v) => Math.pow(base(v), exponent(v));
  }
  function atom(): Node {
    const t = peek();
    if (t === undefined) return fail("the formula stops early");
    if (t === "(") {
      if (++depth > 40) fail("too many brackets");
      take(); const inner = sum(); take(")"); depth--;
      return inner;
    }
    if (/^(\d|\.\d)/.test(t)) { take(); const n = Number(t); return () => n; }
    if (/^[A-Za-z_]/.test(t)) {
      take();
      const f = Object.hasOwn(FUNCTIONS, t) ? FUNCTIONS[t] : undefined; // own names only: "constructor" is not a function here
      if (f && peek() === "(") {
        take();
        const args: Node[] = [sum()];
        while (peek() === ",") { take(); args.push(sum()); }
        take(")");
        if (args.length !== f.args) fail(`${t} takes ${f.args} value${f.args === 1 ? "" : "s"}`);
        return (v) => f.fn(...args.map((a) => a(v)));
      }
      if (known.has(t)) return (v) => v[t] ?? NaN;
      if (Object.hasOwn(CONSTANTS, t)) { const c = CONSTANTS[t]!; return () => c; }
      return fail(`"${t}" is not one of the formula's symbols`);
    }
    return fail(`"${t}" is not arithmetic`);
  }
  try {
    const root = sum();
    if (at < list.length) fail(`"${list[at]}" was not expected`);
    return { ok: true, fn: (values) => root(values) };
  } catch (e) {
    return { ok: false, reason: e instanceof Error ? e.message : "the formula could not be read" };
  }
}
