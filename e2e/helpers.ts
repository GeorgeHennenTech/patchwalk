import { expect, type Page } from "@playwright/test";

/** Fail a test on any error the page throws. */
export function watchErrors(page: Page): string[] {
  const errors: string[] = [];
  page.on("pageerror", (e) => errors.push(e.message));
  return errors;
}
/** Open a practice lesson by its title and switch the sound on. */
export async function openLesson(page: Page, title: string): Promise<void> {
  await page.goto("/");
  await page.getByRole("tab", { name: "Lessons" }).click();
  await page.getByText(title, { exact: true }).first().click();
  await page.getByRole("button", { name: "Start audio" }).first().click();
  await expect.poll(() => page.evaluate(() => Boolean((window as unknown as { __patchwalkEngine?: unknown }).__patchwalkEngine))).toBe(true);
}
/** Play a note on the lesson synth and read harmonic levels in dB from its own analyser, relative to the first. */
export async function harmonicsHeard(page: Page, note: number, harmonics: number[]): Promise<number[]> {
  return page.evaluate(async ({ note, harmonics }) => {
    type E = { ctx: AudioContext; analyser: AnalyserNode; noteOn(n: number, v: number): void; noteOff(n: number): void };
    const e = (window as unknown as { __patchwalkEngine: E }).__patchwalkEngine, sr = e.ctx.sampleRate, hz = 440 * 2 ** ((note - 69) / 12);
    const an = e.ctx.createAnalyser(); an.fftSize = 32768; an.smoothingTimeConstant = 0; e.analyser.connect(an);
    e.noteOn(note, 100);
    await new Promise((r) => setTimeout(r, 1500));
    const d = new Float32Array(an.frequencyBinCount); an.getFloatFrequencyData(d);
    e.noteOff(note);
    const at = (f: number) => { const k = Math.round((f * an.fftSize) / sr); return Math.max(d[k - 1]!, d[k]!, d[k + 1]!); };
    return harmonics.map((n) => at(hz * n) - at(hz));
  }, { note, harmonics });
}
