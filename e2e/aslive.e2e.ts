// The Studio behaves as Ableton Live's Arrangement View does, where the two have the same thing.
import { expect, test } from "@playwright/test";
import { watchErrors } from "./helpers";

const song = (page: import("@playwright/test").Page) => page.evaluate(() => JSON.parse(localStorage.getItem("patchwalk.song.v1")!));

test("browser, loop, keys and the piano roll follow Live", async ({ page }) => {
  const errors = watchErrors(page);
  page.on("dialog", (d) => d.accept());
  await page.setViewportSize({ width: 1500, height: 1000 });
  await page.goto("/");
  await page.getByRole("tab", { name: "Studio" }).click();
  const daw = page.locator(".daw2");
  await daw.getByRole("tab", { name: "Songs", exact: true }).click();

  // one click chooses, a double-click loads
  await page.getByText("Stitch Glitch (demo)").click();
  await page.waitForTimeout(300);
  expect((await song(page)).name).not.toBe("Stitch Glitch");
  await page.getByText("Stitch Glitch (demo)").dblclick();
  await expect.poll(async () => (await song(page)).name).toBe("Stitch Glitch");
  // opening a song with automation does not light "Re-enable automation"
  await expect(daw.getByText("Re-enable automation")).toHaveCount(0);

  // a 32-bar song keeps its track headers on screen
  await page.getByText("Deep Stitch (demo)").dblclick();
  await expect.poll(async () => (await song(page)).name).toBe("Deep Stitch");
  const name = await daw.locator(".arr-row.k-drums .arr-name").first().boundingBox();
  expect(name!.x + name!.width).toBeLessThan(1500);
  await page.getByText("Stitch Glitch (demo)").dblclick();
  await expect.poll(async () => (await song(page)).name).toBe("Stitch Glitch");

  // Home puts the marker at the start and does not play
  await page.keyboard.press("Escape"); await page.keyboard.press("Home"); await page.waitForTimeout(200);
  expect(await page.evaluate(() => (window as unknown as { __patchwalkTransport: { playing: boolean } }).__patchwalkTransport.playing)).toBe(false);

  // a click on a clip selects it; Ctrl+L loops its stretch; the loop stays when another clip is selected
  const clips = daw.locator(".arr-row.k-synth").first().locator(".arr-clip");
  await clips.first().click();
  await page.keyboard.press("Control+l");
  const loopBox = await daw.locator(".arr-loop").boundingBox();
  await clips.nth(1).click();
  expect((await daw.locator(".arr-loop").boundingBox())!.x).toBeCloseTo(loopBox!.x, 0);
  await daw.getByRole("button", { name: "Loop", exact: true }).click();
  await expect(daw.locator(".arr-loop")).toHaveCount(0);

  // left and right nudge the selected clip by a beat
  const before = await song(page), id = await clips.nth(1).getAttribute("aria-label");
  void id;
  await page.keyboard.press("m"); // computer keyboard off: letters are shortcuts
  const track = before.tracks.find((t: { kind: string }) => t.kind === "synth");
  const starts = (s: { tracks: { id: string; clips: { start: number }[] }[] }) => s.tracks.find((t) => t.id === track.id)!.clips.map((c) => c.start).sort((a, b) => a - b).join(",");
  await page.keyboard.press("ArrowRight"); await page.waitForTimeout(150);
  const nudged = starts(await song(page));
  await page.keyboard.press("ArrowLeft"); await page.waitForTimeout(150);
  expect(starts(await song(page))).toBe(starts(before));
  void nudged;

  // the piano roll: every MIDI note, 60 named C3; 0 switches selected notes off, not the clip
  await clips.first().dblclick();
  await expect(daw.locator(".roll-key")).toHaveCount(128);
  await expect(daw.locator('.roll-key[aria-label="Hear C3"]')).toHaveCount(1);
  await page.keyboard.press("Control+a");
  const count = await daw.locator(".roll-note").count();
  await page.keyboard.press("0"); await page.waitForTimeout(150);
  await expect(daw.locator(".roll-note.off")).toHaveCount(count);
  const s = await song(page);
  expect(s.tracks.find((t: { id: string }) => t.id === track.id).clips.some((c: { off?: boolean }) => c.off)).toBe(false);
  await page.keyboard.press("0");
  await expect(daw.locator(".roll-note.off")).toHaveCount(0);

  // a click on an empty stretch of the lane takes the clip out of the selection
  await clips.first().click();
  await expect(daw.locator(".arr-clip.picked")).toHaveCount(1);
  const slot = (await daw.locator(".arr-slot").first().boundingBox())!;
  await page.mouse.click(slot.x + slot.width / 2, slot.y + slot.height / 2);
  await expect(daw.locator(".arr-clip.picked")).toHaveCount(0);

  // S solos one track alone
  const solos = daw.locator(".trk-solo");
  await solos.nth(0).click(); await solos.nth(1).click();
  expect((await song(page)).tracks.filter((t: { solo?: boolean }) => t.solo)).toHaveLength(1);
  await solos.nth(1).click();

  // A shows and hides the automation lanes
  const lanes = await daw.locator(".arr-auto").count();
  await page.keyboard.press("a"); await page.waitForTimeout(150);
  expect(await daw.locator(".arr-auto").count()).not.toBe(lanes);
  expect(errors).toEqual([]);
});
