import { expect, test } from "@playwright/test";
import { watchErrors } from "./helpers";

test("the modelled drums play through the kit: a kick is low, a hat is high, an open hat is cut by a closed one", async ({ page }) => {
  const errors = watchErrors(page);
  await page.goto("/");
  const r = await page.evaluate(async () => {
    const at = (p: string) => import(/* @vite-ignore */ p);
    const { Kit } = await at("/src/daw/kit.ts"), { newPad } = await at("/src/daw/drums.ts"), W = await at("/src/synth/wtedit.ts");
    const sr = 48000;
    const play = async (hits: [string, number][]) => {
      const ctx = new OfflineAudioContext(1, sr, sr), kit = new Kit(ctx); kit.out.connect(ctx.destination);
      for (const [voice, when] of hits) kit.hit(newPad(voice, voice), when, 1);
      return (await ctx.startRendering()).getChannelData(0);
    };
    const centre = (d: Float32Array) => { const n = 16384, re = new Float64Array(n), im = new Float64Array(n); for (let i = 0; i < n; i++) re[i] = d[i]!; W.fft(re, im); let a = 0, b = 0; for (let k = 1; k < n / 2; k++) { const e = re[k]! ** 2 + im[k]! ** 2; a += e * k; b += e; } return ((a / b) * sr) / n; };
    const rms = (d: Float32Array, from: number, to: number) => { let s = 0; for (let i = Math.round(from * sr); i < Math.round(to * sr); i++) s += d[i]! ** 2; return Math.sqrt(s / ((to - from) * sr)); };
    const kick = await play([["mkick", 0.01]]), hat = await play([["mhat", 0.01]]), open = await play([["mohat", 0.01]]), cut = await play([["mohat", 0.01], ["mhat", 0.15]]), snare = await play([["msnare", 0.01]]);
    return { kick: centre(kick), hat: centre(hat), snare: rms(snare, 0.01, 0.1), kickLevel: rms(kick, 0.01, 0.2), openRing: rms(open, 0.3, 0.4), cutRing: rms(cut, 0.3, 0.4) };
  });
  expect(r.kick).toBeLessThan(400);
  expect(r.hat).toBeGreaterThan(4000);
  expect(r.kickLevel).toBeGreaterThan(0.05);
  expect(r.snare).toBeGreaterThan(0.02);
  expect(r.openRing).toBeGreaterThan(5 * r.cutRing);
  expect(errors).toEqual([]);
});
