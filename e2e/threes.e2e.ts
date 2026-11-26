import { expect, test } from "@playwright/test";
import { watchErrors } from "./helpers";

type T = { playing: boolean; trackLevel(id: string): number };
test("a drum clip can be written in threes: twelve steps a bar, and it plays", async ({ page }) => {
  const errors = watchErrors(page);
  page.on("dialog", (d) => d.accept());
  await page.goto("/");
  await page.getByRole("tab", { name: "Studio" }).click();
  const daw = page.locator(".daw2");
  await daw.locator(".arr-row.k-drums .arr-clip").first().click();
  await daw.getByRole("tab", { name: "Clips", exact: true }).click();
  await daw.getByText("Threes: shuffle", { exact: true }).dblclick();
  const song = () => page.evaluate(() => JSON.parse(localStorage.getItem("patchwalk.song.v1")!));
  await expect.poll(async () => (await song()).tracks[0].clips[0].grid).toBe(12);
  await expect(daw.locator(".drum-grid.threes")).toBeVisible();
  await expect(daw.locator(".drum-grid .drum-lane").first().locator(".cell")).toHaveCount(12);
  await expect(daw.getByLabel("Drum grid")).toHaveValue("12");
  // back to sixteenths: sixteen cells again, and the grid is forgotten
  await daw.getByLabel("Drum grid").selectOption("16");
  await expect(daw.locator(".drum-grid .drum-lane").first().locator(".cell")).toHaveCount(16);
  await daw.getByLabel("Drum grid").selectOption("24");
  await expect(daw.locator(".drum-grid .drum-lane").first().locator(".cell")).toHaveCount(24);
  // it sounds
  const id = (await song()).tracks[0].id;
  await page.evaluate(() => (document.activeElement as HTMLElement | null)?.blur());
  await page.keyboard.press("Escape"); await page.keyboard.press("Space");
  const level = await page.evaluate(async (track) => { const t = (window as unknown as { __patchwalkTransport: T }).__patchwalkTransport; let top = -200; for (let i = 0; i < 12; i++) { await new Promise((r) => setTimeout(r, 100)); top = Math.max(top, t.trackLevel(track)); } return top; }, id);
  expect(level).toBeGreaterThan(-40);
  await page.keyboard.press("Space");
  expect(errors).toEqual([]);
});
