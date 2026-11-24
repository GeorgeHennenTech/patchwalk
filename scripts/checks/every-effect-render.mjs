import { createRequire } from "module"; const require = createRequire("/home/user/patchwalk/");
const { chromium } = require("playwright"); const fs = require("fs");
const full = JSON.parse(fs.readFileSync("/home/user/patchwalk/src/daw/demos/glitchhop.json", "utf8"));
// two bars of the drop (bars 5 and 6), no automation, no master effects: the bed every device is tried on
const FROM = 4, BARS = 2;
const cut = { ...full, bars: 4, masterFx: [], markers: [], masterAuto: [], tracks: full.tracks.map((t) => ({ ...t, auto: [], clips: t.clips.filter((c) => c.start >= FROM && c.start < FROM + BARS).map((c) => ({ ...c, start: c.start - FROM, bars: Math.min(c.bars, BARS - (c.start - FROM)), ...(c.notes ? { notes: c.notes.filter((n) => n.start < (BARS - (c.start - FROM)) * 16) } : {}) })) })) };
const PUSH = { utility: { gain: -6, width: 160 }, eq3: { low: 6, high: -12 }, eq8: { b3gain: 9, b7gain: -9 }, channeleq: { low: 8, high: -8, lowcut: 1 }, comp: { threshold: -30, ratio: 8 }, glue: { threshold: -28, ratio: 2, makeup: 4 }, limiter: { gain: 12, ceiling: -6 }, gate: { threshold: -20 }, crush: { bits: 4, hold: 12 }, sat: { drive: 24 }, overdrive: { drive: 80, mix: 100 }, autopan: { amount: 100, rate: 4 }, chorus: { amount: 80, mix: 60 }, delay: { mix: 50, feedback: 60 }, autofilter: { freq: 500, lfo: 3, rate: 2 }, phaser: { mix: 100, amount: 90 }, echo: { mix: 50 }, filterdelay: { mix: 70 }, resonators: { mix: 80 }, multiband: { labove: -36, mabove: -36, habove: -36 }, drumbus: { drive: 60, crunch: 50, boom: 60 }, pitchshift: { semis: 7 }, shifter: { semis: -5 }, erosion: { amount: 90 }, beatrepeat: { chance: 100 }, amp: { type: 2, gain: 80 }, cabinet: { size: 0, mic: 1 }, pedal: { type: 2, gain: 80 }, vinyl: { tracing: 80, crackle: 40 }, reverb: { mix: 60, decay: 4 }, spectrum: {}, tuner: {} };
const worker = +(process.argv[2] ?? 0), workers = +(process.argv[3] ?? 1);
const b = await chromium.launch(), page = await (await b.newContext()).newPage();
const errs = []; page.on("pageerror", (e) => errs.push(e.message)); page.on("console", (m) => { if (m.type() === "error") errs.push(m.text().slice(0, 200)); });
await page.goto("http://localhost:5173/");
const kinds = await page.evaluate(async () => (await import("/src/daw/devices.ts")).DEVICES.map((d) => d.kind));
const run = (song, label) => page.evaluate(async ({ song, label }) => {
  const { renderSong } = await import("/src/daw/render.ts");
  // the same dice for every render, so that two renders of one song can be compared sample by sample
  let seed = 20261124; Math.random = () => ((seed = (Math.imul(seed, 1664525) + 1013904223) >>> 0) / 4294967296);
  const t0 = performance.now(); let r;
  try { r = await renderSong(song, () => undefined); } catch (e) { return { label, error: String(e) }; }
  const v = new DataView(r.wav.buffer, r.wav.byteOffset + 44), n = (r.wav.length - 44) / 4, L = new Float32Array(n), R = new Float32Array(n);
  for (let i = 0; i < n; i++) { L[i] = v.getInt16(i * 4, true) / 32768; R[i] = v.getInt16(i * 4 + 2, true) / 32768; }
  const stat = (a, b) => { let s = 0, p = 0, bad = 0; for (let i = 0; i < n; i++) { const x = a[i], y = b[i]; if (!Number.isFinite(x) || !Number.isFinite(y)) bad++; s += x * x + y * y; p = Math.max(p, Math.abs(x), Math.abs(y)); } return { rms: 10 * Math.log10(s / (2 * n) + 1e-12), peak: 20 * Math.log10(p + 1e-9), bad }; };
  const out = { label, ms: Math.round(performance.now() - t0), ...stat(L, R) };
  if (label === "base") window.__base = { L, R };
  else if (window.__base) { const B = window.__base; let d = 0, s = 0; for (let i = 0; i < n; i++) { d += (L[i] - B.L[i]) ** 2 + (R[i] - B.R[i]) ** 2; s += B.L[i] ** 2 + B.R[i] ** 2; } out.diff = 10 * Math.log10(d / s + 1e-12); }
  return out;
}, { song, label });
const mk = (kind, p, on = true) => page.evaluate(async ({ kind, p, on }) => { const D = await import("/src/daw/devices.ts"); const d = D.newDevice(kind); return { ...d, on, p: { ...d.p, ...p } }; }, { kind, p, on });
const out = [];
const base = await run(cut, "base"); out.push(base);
for (const [i, kind] of kinds.entries()) {
  if (i % workers !== worker) continue;
  for (const [name, p, on] of [["default", {}, true], ["pushed", PUSH[kind] ?? {}, true], ["off", PUSH[kind] ?? {}, false]]) out.push({ kind, ...(await run({ ...cut, masterFx: [await mk(kind, p, on)] }, name)) });
}
fs.writeFileSync(`det-${worker}.json`, JSON.stringify({ out, errs, missingPush: kinds.filter((k) => !(k in PUSH)) }));
await b.close();
