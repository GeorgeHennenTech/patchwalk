import { createRequire } from "module"; const require = createRequire("/home/user/patchwalk/");
const { chromium } = require("playwright"); const fs = require("fs");
const song = fs.readFileSync("/home/user/patchwalk/src/daw/demos/glitchhop.json", "utf8");
const b = await chromium.launch({ args: ["--autoplay-policy=no-user-gesture-required"] }), page = await (await b.newContext({ viewport: { width: 1900, height: 1400 } })).newPage();
const errs = []; page.on("pageerror", (e) => errs.push(e.message)); page.on("console", (m) => { if (m.type() === "error") errs.push(m.text().slice(0, 200)); });
await page.addInitScript((s) => { if (!sessionStorage.getItem("seeded")) { localStorage.setItem("patchwalk.song.v1", s); sessionStorage.setItem("seeded", "1"); } }, song);
await page.goto("http://localhost:5173/"); await page.getByRole("tab", { name: "Studio" }).click(); await page.waitForTimeout(1200);
const lists = await page.evaluate(async () => { const D = await import("/src/daw/devices.ts"), N = await import("/src/daw/notefx.ts"); return { fx: D.DEVICES.map((d) => ({ name: d.name, kind: d.kind })), note: N.NOTE_FX.map((d) => ({ name: d.name, kind: d.kind })) }; });
const daw = page.locator(".daw2");
// select the pluck track by one of its clips (bar 5), loop that bar region and play
await page.evaluate(() => { const t = window.__patchwalkTransport; void t; });
const trackName = "Riser";
await daw.getByText(trackName, { exact: true }).first().click(); await page.waitForTimeout(200);
await page.keyboard.press("Escape"); await page.keyboard.press("Space"); await page.waitForTimeout(600);
const esc = (s) => s.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
const status = () => page.locator(".daw-status").innerText();
const level = () => page.evaluate(() => { const l = window.__patchwalkTransport.levels(); return Math.round(Math.max(l.left, l.right)); });
const rows = [];
for (const [family, list] of [["fx", lists.fx], ["note", lists.note]]) { await daw.getByRole("tab", { name: family === "note" ? "MIDI Effects" : "Audio Effects", exact: true }).click(); await page.waitForTimeout(200); for (const d of list) {
  const row = { name: d.name, family }, before = errs.length;
  try {
    const playing = await page.evaluate(() => window.__patchwalkTransport.playing); if (!playing) { await page.keyboard.press("Escape"); await page.keyboard.press("Space"); await page.waitForTimeout(300); }
    await daw.locator("li button").filter({ hasText: new RegExp(`^${esc(d.name)}$`) }).first().dblclick({ timeout: 4000 });
    const panel = page.locator(`.chain${family === "note" ? ".note" : ":not(.note)"} section.dev[aria-label="${d.name}"]`).last();
    await panel.waitFor({ timeout: 4000 }); row.added = true; row.status = (await status()).slice(0, 40);
    row.knobs = await panel.locator('[role=slider]').count(); row.switches = await panel.locator(".dev-sw").count(); row.menus = await panel.locator("select").count();
    if (row.knobs) { const k = panel.locator("svg.knob[role=slider]").first(); if (await k.count()) { const a = await k.getAttribute("aria-valuenow"); await k.focus(); await page.keyboard.press("ArrowUp"); await page.keyboard.press("ArrowUp"); let c = await k.getAttribute("aria-valuenow"); if (c === a) { await page.keyboard.press("ArrowDown"); await page.keyboard.press("ArrowDown"); await page.keyboard.press("ArrowDown"); c = await k.getAttribute("aria-valuenow"); } row.knobMoves = c !== a; } }
    if (row.menus) { const sel = panel.locator("select").first(); const n = await sel.locator("option").count(); await sel.selectOption({ index: n - 1 }); row.menuSet = true; }
    if (row.switches) { await panel.locator(".dev-sw").first().click(); row.switchSet = true; }
    await page.waitForTimeout(350); row.levelOn = await level();
    const onBtn = panel.locator(".dev-on"); await onBtn.click(); row.offPressed = (await onBtn.getAttribute("aria-pressed")) === "false"; await page.waitForTimeout(150); await onBtn.click();
    await panel.getByRole("button", { name: `Remove ${d.name}` }).click(); await page.waitForTimeout(120);
    row.removed = (await page.locator(`.chain${family === "note" ? ".note" : ":not(.note)"} section.dev[aria-label="${d.name}"]`).count()) === 0;
  } catch (e) { row.fail = e.message.split("\n")[0].slice(0, 140); }
  row.errors = errs.slice(before).map((x) => x.slice(0, 120));
  rows.push(row);
} }
await page.keyboard.press("Space");
const after = await page.evaluate(() => { const s = JSON.parse(localStorage.getItem("patchwalk.song.v1")); const t = s.tracks.find((x) => x.name === "Riser"); return { devices: t.devices.map((d) => d.kind), noteFx: t.noteFx.map((d) => d.kind) }; });
fs.writeFileSync("ui.json", JSON.stringify({ rows, after, errs }));
for (const r of rows) console.log(`${r.family.padEnd(4)} ${r.name.padEnd(20)} ${r.fail ? "FAIL " + r.fail : `ok knobs ${r.knobs} sw ${r.switches} menus ${r.menus} knobMoves ${r.knobMoves ?? "-"} level ${r.levelOn} off ${r.offPressed} removed ${r.removed}`}${r.errors.length ? " ERR " + JSON.stringify(r.errors) : ""}`);
console.log("track afterwards:", JSON.stringify(after));
await b.close();
