import { expect, test } from "@playwright/test";
import { watchErrors } from "./helpers";

// The stretch library runs as WebAssembly on the audio thread, so it can only be tried in a real browser.
test("the Pitch shift device moves a tone by the interval set, and a stretched sound keeps its pitch and its timing", async ({ page }) => {
  const errors = watchErrors(page);
  await page.goto("/");
  const r = await page.evaluate(async () => {
    const at = (p: string) => import(/* @vite-ignore */ p);
    const F = await at("/src/daw/fxnodes.ts"), D = await at("/src/daw/devices.ts"), S = await at("/src/daw/stretch.ts"), W = await at("/src/synth/wtedit.ts");
    const sr = 48000, N = 32768;
    const loudest = (d: Float32Array, from: number) => {
      const re = new Float64Array(N), im = new Float64Array(N);
      for (let i = 0; i < N; i++) re[i] = (d[from + i] ?? 0) * (0.5 - 0.5 * Math.cos((2 * Math.PI * i) / N));
      W.fft(re, im);
      let m = 0, k = 0; for (let i = 5; i < N / 2; i++) { const v = Math.hypot(re[i]!, im[i]!); if (v > m) { m = v; k = i; } }
      // the true place of the peak, between the two bins beside it
      const a = Math.hypot(re[k - 1]!, im[k - 1]!), b = Math.hypot(re[k + 1]!, im[k + 1]!);
      return ((k + (b - a) / (2 * (2 * m - a - b) || 1) * 1) * sr) / N;
    };
    const shifted = async (semis: number, on = true) => {
      const ctx = new OfflineAudioContext(2, sr * 3, sr), dev = { ...D.newDevice("pitchshift"), on, p: { semis, cents: 0, formant: 0, mix: 100 } };
      const live = F.buildDevice(ctx, dev), osc = ctx.createOscillator(); osc.frequency.value = 440; osc.connect(live.input); live.output.connect(ctx.destination); osc.start();
      await F.devicesSettled(ctx);
      return loudest((await ctx.startRendering()).getChannelData(0), sr);
    };
    const src = new Float32Array(sr); for (let i = 0; i < sr; i++) src[i] = 0.3 * Math.sin((2 * Math.PI * 440 * i) / sr) + (i % 12000 < 40 && i > 0 ? 0.9 : 0);
    const slow = (await S.stretchSamples([src], sr, { rate: 0.5 }))[0] as Float32Array;
    const clicks: number[] = []; for (let i = 0; i < slow.length; i++) if (Math.abs(slow[i]!) > 0.5 && (!clicks.length || i / sr - clicks[clicks.length - 1]! > 0.1)) clicks.push(i / sr);
    const up = (await S.stretchSamples([src], sr, { semitones: 12 }))[0] as Float32Array;
    return { fifth: await shifted(7), octave: await shifted(12), down: await shifted(-12), off: await shifted(12, false), slowLength: slow.length / sr, slowHz: loudest(slow, sr * 0.5), clicks, upLength: up.length / sr, upHz: loudest(up, 4000),
      fit: [S.rateToFit(2, 4, 120), S.beatsNear(1.9, 124), S.beatsNear(7.6, 128)] };
  });
  // readings are good to about one step of the measurement (1.5 Hz)
  const near = (hz: number, want: number) => expect(Math.abs(hz - want)).toBeLessThan(1.5);
  near(r.fifth, 440 * 2 ** (7 / 12)); near(r.octave, 880); near(r.down, 220); near(r.off, 440);
  expect(r.slowLength).toBeCloseTo(2, 2);
  near(r.slowHz, 440);
  expect(r.clicks.length).toBe(3);
  r.clicks.forEach((t, i) => expect(Math.abs(t - 0.5 * (i + 1))).toBeLessThan(0.01));
  expect(r.upLength).toBeCloseTo(1, 2);
  near(r.upHz, 880);
  expect(r.fit).toEqual([1, 4, 16]);
  expect(errors).toEqual([]);
});
