import { expect, test } from "@playwright/test";
import { watchErrors } from "./helpers";

test("the demo song opens from the Studio's Songs list and plays with sound on the master", async ({ page }) => {
  const errors = watchErrors(page);
  page.on("dialog", (d) => d.accept());
  await page.goto("/");
  await page.getByRole("tab", { name: "Studio" }).click();
  await page.locator(".daw2").getByText("Songs", { exact: true }).first().click();
  await page.getByText("Stitch Glitch (demo)").click();
  await expect.poll(() => page.evaluate(() => JSON.parse(localStorage.getItem("patchwalk.song.v1") ?? "{}").name)).toBe("Stitch Glitch");
  const song = await page.evaluate(() => JSON.parse(localStorage.getItem("patchwalk.song.v1")!));
  expect(song.tracks.map((t: { name: string }) => t.name)).toEqual(["Drums", "Vowel pad", "Wobble bass", "Glitch pluck", "Bits", "Riser"]);
  await page.keyboard.press("Escape"); await page.keyboard.press("Home");
  type T = { levels(): { left: number; right: number }; trackLevel(id: string): number; position(): number };
  const loudest: Record<string, number> = {}; let master = -200;
  for (let i = 0; i < 26; i++) {
    await page.waitForTimeout(500);
    const r = await page.evaluate((ids: string[]) => { const t = (window as unknown as { __patchwalkTransport: T }).__patchwalkTransport; return { m: Math.max(t.levels().left, t.levels().right), tracks: ids.map((id) => t.trackLevel(id)) }; }, song.tracks.map((t: { id: string }) => t.id));
    master = Math.max(master, r.m);
    song.tracks.forEach((t: { name: string }, k: number) => { loudest[t.name] = Math.max(loudest[t.name] ?? -200, r.tracks[k]!); });
  }
  await page.keyboard.press("Space");
  console.log("loudest readings over 13 s:", JSON.stringify(Object.fromEntries(Object.entries(loudest).map(([k, v]) => [k, Math.round(v)]))), "master", Math.round(master));
  expect(master).toBeGreaterThan(-30); expect(master).toBeLessThan(0.5);
  // the first five tracks have all played by bar 6 (the arpeggio track comes in at bar 9)
  for (const name of ["Drums", "Vowel pad", "Wobble bass", "Glitch pluck", "Riser"]) expect(loudest[name], name).toBeGreaterThan(-60);
  expect(errors).toEqual([]);
});
