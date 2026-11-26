import { expect, test } from "@playwright/test";
import { watchErrors } from "./helpers";

test("counting: taps on the click read as on it, taps between clicks read early or late, and a good run is remembered", async ({ page }) => {
  const errors = watchErrors(page);
  await page.goto("/");
  await page.getByRole("tab", { name: "Rhythm" }).click();
  const r = page.locator(".rhythm");
  await expect(r.locator(".rhythm-wheel .rdot")).toHaveCount(4);
  await r.getByRole("tab", { name: /Three against two/ }).click();
  await expect(r.locator(".rhythm-wheel .rdot")).toHaveCount(5);
  await r.getByRole("tab", { name: /A steady four/ }).click();
  await r.getByLabel("Speed").fill("120");                       // a click every half second
  await page.evaluate(() => (document.activeElement as HTMLElement | null)?.blur());
  await r.getByRole("button", { name: "Start" }).click();
  // the hand turns with the sound
  const angle = () => r.locator(".rhythm-wheel .hand").getAttribute("transform");
  const a0 = await angle(); await page.waitForTimeout(300); expect(await angle()).not.toBe(a0);
  // tap by the page's own audio clock: on each click, then half way between
  const tapAt = (shift: number, n: number) => page.evaluate(async ([s, count]) => {
    const press = () => window.dispatchEvent(new KeyboardEvent("keydown", { code: "Space", key: " " }));
    for (let i = 0; i < (count as number); i++) {
      const now = performance.now(), next = Math.ceil((now + 30 - (window as unknown as { __rhythmZero: number }).__rhythmZero - (s as number)) / 500) * 500 + (window as unknown as { __rhythmZero: number }).__rhythmZero + (s as number);
      await new Promise((res) => setTimeout(res, next - performance.now())); press();
    }
  }, [shift, n]);
  // find where the clicks fall in page time from one tap's own reading
  await page.evaluate(() => { (window as unknown as { __rhythmZero: number }).__rhythmZero = performance.now(); window.dispatchEvent(new KeyboardEvent("keydown", { code: "Space", key: " " })); });
  const first = await r.locator(".rhythm-last").innerText();
  const m = /(\d+) ms(?: (early|late))?/.exec(first)!; const off = Number(m[1]) * (m[2] === "early" ? -1 : 1);
  await page.evaluate((o) => { (window as unknown as { __rhythmZero: number }).__rhythmZero -= o as number; }, off);
  await tapAt(0, 17);
  await expect(r.locator(".rhythm-sum")).toContainText(/1[3-6] of your last 16 taps were on the click/);
  await expect(r.getByRole("tab", { name: /✓ 1\. A steady four/ })).toBeVisible();
  await tapAt(250, 3);
  await expect(r.locator(".rhythm-last")).toContainText(/ms (early|late)/);
  await r.getByRole("button", { name: "Stop" }).click();
  expect(errors).toEqual([]);
});
