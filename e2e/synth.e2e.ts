import { expect, test } from "@playwright/test";
import { harmonicsHeard, openLesson, watchErrors } from "./helpers";

test("a low saw carries its upper harmonics at 1/n through the real engine", async ({ page }) => {
  const errors = watchErrors(page);
  await openLesson(page, "Wavetables");
  const heard = await harmonicsHeard(page, 33, [30, 100, 200, 300]);
  [30, 100, 200, 300].forEach((n, i) => expect(Math.abs(heard[i]! + 20 * Math.log10(n)), `harmonic ${n}`).toBeLessThan(2));
  expect(errors).toEqual([]);
});

test("the wavetable editor: a formula sets what the synth plays, and the table is kept", async ({ page }) => {
  const errors = watchErrors(page);
  page.on("dialog", (d) => d.accept());
  await openLesson(page, "Wavetables");
  await page.getByRole("button", { name: /Show the whole synth/i }).first().click();
  await page.getByRole("button", { name: "Wavetable editor" }).first().click();
  const ed = page.getByRole("dialog", { name: "Wavetable editor" });
  const f = ed.getByRole("textbox", { name: "Formula" });
  await f.fill("q<=3"); await f.press("Enter");
  const played = () => page.evaluate(async () => {
    const { magnitudesA } = await import(/* @vite-ignore */ "/src/synth/params.ts" as string) as { magnitudesA(s: unknown): Float32Array };
    const m = magnitudesA((window as unknown as { __patchwalkEngine: { state: unknown } }).__patchwalkEngine.state);
    return Array.from(m.slice(1, 6), (v) => +v.toFixed(2));
  });
  await expect.poll(played).toEqual([1, 1, 1, 0, 0]);
  await ed.getByRole("button", { name: "Undo" }).click();
  await expect.poll(played).not.toEqual([1, 1, 1, 0, 0]);
  await ed.getByRole("button", { name: "Redo" }).click();
  await ed.getByLabel("Table name").fill("Kept table");
  await page.waitForTimeout(1200);
  await ed.getByRole("button", { name: "Close" }).click();
  await expect(page.locator('select[aria-label="Wavetable"] optgroup[label="Your tables"] option').first()).toHaveText(/Kept table/);
  expect(errors).toEqual([]);
});
