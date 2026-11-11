/** A value as it should be shown, plus the pieces needed to derive ranges and validate lesson text. */
export interface Display {
  text: string;
  /** Numeric part of `text`, when there is one. */
  num?: number;
  unit?: string;
  decimals?: number;
}

/** Fixed decimals with trailing zeros removed; never prints "-0". */
export function trim(n: number, decimals: number): string {
  const s = n.toFixed(decimals).replace(/(\.\d*?)0+$/, "$1").replace(/\.$/, "");
  return s === "-0" ? "0" : s;
}

export function withUnit(n: number, decimals: number, unit: string, tight = false): Display {
  return { text: `${trim(n, decimals)}${unit ? (tight ? "" : " ") + unit : ""}`, num: Number(trim(n, decimals)), unit, decimals };
}

export const pct = (n: number, decimals = 1) => withUnit(n, decimals, "%", true);
export const plain = (n: number, decimals = 3) => withUnit(n, decimals, "");
export const signed = (n: number, decimals: number, unit: string): Display => {
  const d = withUnit(n, decimals, unit);
  return n > 0 ? { ...d, text: `+${d.text}` } : d;
};

/** Seconds shown as ms below one second. */
export function time(seconds: number): Display {
  if (Math.abs(seconds) < 1) {
    const ms = seconds * 1000;
    return withUnit(ms, ms < 10 ? 2 : ms < 100 ? 1 : 0, "ms");
  }
  return withUnit(seconds, 2, "s");
}

export const onOff = (v: unknown): Display => ({ text: v === 0 || v === false ? "Off" : "On" });

/** "kParamUnisonBlend" -> "Unison Blend". This only re-spaces the stored name; it interprets nothing. */
export function humanize(key: string): string {
  return key
    .replace(/^kParam/, "")
    .replace(/^k(?=[A-Z])/, "")
    .replace(/_/g, " ")
    .replace(/([a-z])([A-Z0-9])/g, "$1 $2")
    .replace(/([A-Z])([A-Z][a-z])/g, "$1 $2")
    .trim();
}

export function generic(raw: unknown): Display {
  if (typeof raw === "number") return plain(raw, Math.abs(raw) >= 100 ? 1 : 3);
  if (typeof raw === "boolean") return { text: raw ? "On" : "Off" };
  if (typeof raw === "string") return { text: raw };
  return { text: String(raw) };
}
