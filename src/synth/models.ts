// The maths behind the guide's playable models (compressor, echoes, beating, FM, wavefolding). Pure
// functions, so the pictures, the sound and the tests all use the same numbers.
import { besselJ } from "../modal/membrane";

/** A compressor's output level for an input level, both in dB: unchanged up to the threshold, then rising 1 dB for every `ratio` dB in, plus make-up. A sharp corner, no knee. */
export function compOutDb(inDb: number, thresholdDb: number, ratio: number, makeupDb = 0): number {
  const r = Math.max(1, ratio);
  return (inDb <= thresholdDb ? inDb : thresholdDb + (inDb - thresholdDb) / r) + makeupDb;
}

/** The echoes a delay makes from one sound: when each arrives (seconds) and how loud it is beside the sound itself (which is 1, at 0). Each echo is the one before times the feedback. */
export function echoes(timeMs: number, feedbackPct: number, mixPct: number, until = 3): { t: number; level: number }[] {
  const out = [{ t: 0, level: 1 }], time = Math.max(0.02, timeMs / 1000), fb = Math.min(0.95, Math.max(0, feedbackPct / 100)), mix = Math.min(1, Math.max(0, mixPct / 100));
  for (let n = 1; n * time < until && n <= 60; n++) { const level = mix * fb ** (n - 1); if (level < 0.01) break; out.push({ t: n * time, level }); }
  return out;
}

/** How many times a second two notes `cents` apart swell and fade against each other: the difference between their frequencies. */
export const beatsPerSecond = (hz: number, cents: number) => hz * (2 ** (cents / 1200) - 1);

/**
 * What FM puts into a note: partials spaced the modulator's frequency apart on either side of the played
 * note, the k-th pair as strong as the Bessel function J_k of the amount (the "index"). A partial that
 * would fall below zero is heard at the same distance above it. Strengths landing on one frequency are added
 * without regard to which way up they are, which is right for a picture and approximate for the ear.
 */
export function fmPartials(noteHz: number, ratio: number, index: number, pairs = 8): { hz: number; level: number }[] {
  const at = new Map<number, number>(), mod = noteHz * ratio;
  for (let k = -pairs; k <= pairs; k++) { const hz = Math.round(Math.abs(noteHz + k * mod) * 100) / 100, level = Math.abs(besselJ(Math.abs(k), index)); if (hz > 0 && level > 0.004) at.set(hz, (at.get(hz) ?? 0) + level); }
  return [...at].map(([hz, level]) => ({ hz, level })).sort((a, b) => a.hz - b.hz);
}

/** A wave pushed past the top is folded back down, and past the bottom back up: the value of `x` after folding into -1..1. */
export function foldBack(x: number): number {
  const y = (((x + 1) % 4) + 4) % 4;
  return y < 2 ? y - 1 : 3 - y;
}
/** How far a sine is turned up before folding: 1 (not at all) to 6 times, for 0 to 100%. */
export const foldDrive = (amountPct: number) => 1 + 5 * (Math.min(100, Math.max(0, amountPct)) / 100);
/** One cycle of a folded sine at phase 0..1. */
export const foldedSine = (phase: number, amountPct: number) => foldBack(foldDrive(amountPct) * Math.sin(2 * Math.PI * phase));
/** The strength of the first `count` harmonics of a folded sine (the strongest is 1). */
export function foldedHarmonics(amountPct: number, count = 16): number[] {
  const N = 512, out: number[] = [];
  for (let n = 1; n <= count; n++) { let s = 0, c = 0; for (let i = 0; i < N; i++) { const v = foldedSine(i / N, amountPct), w = (2 * Math.PI * n * i) / N; s += v * Math.sin(w); c += v * Math.cos(w); } out.push((2 * Math.hypot(s, c)) / N); }
  const top = Math.max(1e-9, ...out);
  return out.map((v) => (v / top < 1e-6 ? 0 : v / top));
}
