import { expect, test } from "@playwright/test";
import { watchErrors } from "./helpers";

type T = { playing: boolean; trackLevel(id: string): number };
test("an audio track plays a sound file from the timeline, and Transpose changes its speed", async ({ page }) => {
  const errors = watchErrors(page);
  page.on("dialog", (d) => d.accept());
  await page.goto("/");
  await page.getByRole("tab", { name: "Studio" }).click();
  const daw = page.locator(".daw2");
  // a one-second 440 Hz tone as a WAV
  const rate = 22050, n = rate, wav = Buffer.alloc(44 + n * 2);
  wav.write("RIFF", 0); wav.writeUInt32LE(36 + n * 2, 4); wav.write("WAVEfmt ", 8); wav.writeUInt32LE(16, 16); wav.writeUInt16LE(1, 20); wav.writeUInt16LE(1, 22);
  wav.writeUInt32LE(rate, 24); wav.writeUInt32LE(rate * 2, 28); wav.writeUInt16LE(2, 32); wav.writeUInt16LE(16, 34); wav.write("data", 36); wav.writeUInt32LE(n * 2, 40);
  for (let i = 0; i < n; i++) wav.writeInt16LE(Math.round(12000 * Math.sin((2 * Math.PI * 440 * i) / rate)), 44 + i * 2);
  await daw.getByRole("tab", { name: "Samples", exact: true }).click();
  await daw.locator('.br input[type=file]').setInputFiles({ name: "tone.wav", mimeType: "audio/wav", buffer: wav });
  const row = daw.locator(".br-items li button").filter({ hasText: /^tone/ }).first();
  await expect(row).toBeVisible();
  await daw.getByRole("button", { name: "+ Audio track" }).click();
  await row.dblclick();
  const song = () => page.evaluate(() => JSON.parse(localStorage.getItem("patchwalk.song.v1")!));
  await expect.poll(async () => (await song()).tracks.at(-1).clips.length).toBe(1);
  const s = await song(), track = s.tracks.at(-1), clip = track.clips[0];
  expect(track.kind).toBe("audio"); expect(clip.seconds).toBeCloseTo(1, 1); expect(clip.start).toBe(0);
  await expect(daw.locator(".arr-row.k-audio .arr-clip svg rect").first()).toBeVisible();   // its shape is drawn
  await expect(daw.locator(".aclip")).toBeVisible();
  // heard alone: loud while the file lasts, silent once it has ended
  await daw.locator(".arr-row.k-audio .trk-solo").click();
  const level = (after: number) => page.evaluate(async ([id, ms]) => { const t = (window as unknown as { __patchwalkTransport: T }).__patchwalkTransport; await new Promise((r) => setTimeout(r, ms as number)); return t.trackLevel(id as string); }, [track.id, after]);
  const play = async () => { await page.keyboard.press("Escape"); await page.keyboard.press("Home"); await page.keyboard.press("Space"); };
  await play();
  expect(await level(600)).toBeGreaterThan(-30);
  expect(await level(900)).toBeLessThan(-60);       // 1.5 s in: the one-second file is over
  await page.keyboard.press("Space");
  // an octave up: twice the speed, so it is over in half a second
  await daw.getByLabel("Clip transpose").fill("12");
  await expect.poll(async () => (await song()).tracks.at(-1).clips[0].tune).toBe(12);
  await page.evaluate(() => (document.activeElement as HTMLElement | null)?.blur());   // or Home would move the slider
  await play();
  expect(await level(250)).toBeGreaterThan(-30);
  expect(await level(550)).toBeLessThan(-60);       // 0.8 s in
  await page.keyboard.press("Space");
  expect(errors).toEqual([]);
});
