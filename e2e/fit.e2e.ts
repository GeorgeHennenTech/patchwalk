import { expect, test } from "@playwright/test";
import { watchErrors } from "./helpers";

test("Fit to tempo: an uploaded loop on a pad is stretched to a whole number of beats and kept as a new sound", async ({ page }) => {
  const errors = watchErrors(page);
  await page.goto("/");
  await page.getByRole("tab", { name: "Studio" }).click();
  const bpm = Number(await page.evaluate(() => JSON.parse(localStorage.getItem("patchwalk.song.v1") ?? "{}").bpm ?? 0));
  // a 1.7 second tone as a WAV: at any ordinary tempo its nearest whole length is 2 or 4 beats
  const rate = 22050, n = Math.round(rate * 1.7), wav = Buffer.alloc(44 + n * 2);
  wav.write("RIFF", 0); wav.writeUInt32LE(36 + n * 2, 4); wav.write("WAVEfmt ", 8); wav.writeUInt32LE(16, 16); wav.writeUInt16LE(1, 20); wav.writeUInt16LE(1, 22);
  wav.writeUInt32LE(rate, 24); wav.writeUInt32LE(rate * 2, 28); wav.writeUInt16LE(2, 32); wav.writeUInt16LE(16, 34); wav.write("data", 36); wav.writeUInt32LE(n * 2, 40);
  for (let i = 0; i < n; i++) wav.writeInt16LE(Math.round(9000 * Math.sin((2 * Math.PI * 330 * i) / rate)), 44 + i * 2);
  // open the drum track's rack (the Device view) and give the first pad the file
  await page.locator(".daw2").getByText("Device", { exact: true }).first().click();
  const rack = page.locator(".drack"); await rack.waitFor();
  await rack.locator('input[type=file]').setInputFiles({ name: "loop.wav", mimeType: "audio/wav", buffer: wav });
  await expect(rack.getByText(/Plays your sound/)).toBeVisible();
  await rack.getByLabel("Fit to tempo").selectOption("auto");
  await expect(rack.getByRole("status")).toContainText(/beats? long at/, { timeout: 20_000 });
  const said = await rack.getByRole("status").innerText(), beats = Number(/Now (\d+) beat/.exec(said)![1]);
  type T = { seconds(id: string): number };
  const seconds = await page.evaluate(() => {
    const song = JSON.parse(localStorage.getItem("patchwalk.song.v1")!), pad = song.tracks.find((t: { pads?: unknown[] }) => t.pads).pads.find((p: { sample?: string }) => p.sample);
    return (window as unknown as { __patchwalkTransport: T }).__patchwalkTransport.seconds(pad.sample);
  });
  expect(seconds).toBeCloseTo((beats * 60) / bpm, 2);
  expect(errors).toEqual([]);
});
