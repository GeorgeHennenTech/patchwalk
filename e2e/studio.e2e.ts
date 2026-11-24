import { expect, test } from "@playwright/test";
import { watchErrors } from "./helpers";

test("the Studio plays in time: the position moves at the song's tempo", async ({ page }) => {
  const errors = watchErrors(page);
  await page.goto("/");
  await page.getByRole("tab", { name: "Studio" }).click();
  await page.keyboard.press("Escape");
  await page.keyboard.press("Space");
  type T = { playing: boolean; position(): number; ctx: AudioContext };
  await expect.poll(() => page.evaluate(() => (window as unknown as { __patchwalkTransport?: T }).__patchwalkTransport?.playing ?? false)).toBe(true);
  const read = () => page.evaluate(() => { const t = (window as unknown as { __patchwalkTransport: T }).__patchwalkTransport; return { at: t.position(), time: t.ctx.currentTime }; });
  await expect.poll(async () => (await read()).at).toBeGreaterThan(0);
  const a = await read();
  await page.waitForTimeout(1500);
  const b = await read();
  const bpm = Number(await page.evaluate(() => JSON.parse(localStorage.getItem("patchwalk.song.v1") ?? "{}").bpm ?? 0));
  expect(bpm).toBeGreaterThan(0);
  // sixteenth steps per second at this tempo, against the audio clock
  expect((b.at - a.at) / (b.time - a.time)).toBeCloseTo((bpm / 60) * 4, 0);
  await page.keyboard.press("Space");
  expect(errors).toEqual([]);
});
