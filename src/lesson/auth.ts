// Shared password check for the edge middleware and the lesson endpoint. No dependencies, so it
// loads in both the edge and Node runtimes.

/** Compares without bailing out at the first differing character. */
function safeEqual(a: string, b: string): boolean {
  const x = new TextEncoder().encode(a), y = new TextEncoder().encode(b);
  let diff = x.length ^ y.length;
  for (let i = 0; i < Math.max(x.length, y.length); i++) diff |= (x[i] ?? 0) ^ (y[i] ?? 0);
  return diff === 0;
}

/** True when an `Authorization: Basic ...` header carries the expected password. The user name is ignored. */
export function passwordMatches(header: string | null | undefined, expected: string | undefined): boolean {
  if (!expected || !header) return false;
  const m = /^Basic\s+([A-Za-z0-9+/=]+)\s*$/i.exec(header);
  if (!m) return false;
  let decoded: string;
  try {
    decoded = new TextDecoder().decode(Uint8Array.from(atob(m[1]!), (c) => c.charCodeAt(0)));
  } catch {
    return false;
  }
  const colon = decoded.indexOf(":");
  if (colon < 0) return false;
  return safeEqual(decoded.slice(colon + 1), expected);
}

export type Gate = "open" | "allowed" | "denied" | "locked";

/**
 * Decides whether a request may proceed.
 * - On Vercel the app is closed unless APP_PASSWORD is set AND the request carries it ("locked" when unset).
 * - Off Vercel (local dev) it is open unless APP_PASSWORD is set, in which case the password is required.
 */
export function gate(header: string | null | undefined, env: { APP_PASSWORD?: string; VERCEL?: string }): Gate {
  const password = env.APP_PASSWORD;
  if (!password) return env.VERCEL ? "locked" : "open";
  return passwordMatches(header, password) ? "allowed" : "denied";
}
