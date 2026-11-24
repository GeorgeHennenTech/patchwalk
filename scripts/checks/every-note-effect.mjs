import { createRequire } from "module"; const require = createRequire("/home/user/patchwalk/");
const { chromium } = require("playwright"); const fs = require("fs");
const song = JSON.parse(fs.readFileSync("/home/user/patchwalk/src/daw/demos/glitchhop.json", "utf8"));
const b = await chromium.launch(), page = await (await b.newContext()).newPage();
const errs = []; page.on("pageerror", (e) => errs.push(e.message));
await page.goto("http://localhost:5173/");
const r = await page.evaluate(async (song) => {
  const S = await import("/src/daw/song.ts"), N = await import("/src/daw/notefx.ts");
  const pluck = song.tracks[3], PUSH = { "n-arp": { style: 0, rate: 2 }, "n-chord": {}, "n-length": { mode: 0, steps: 0.25 }, "n-pitch": { semis: 12 }, "n-random": { chance: 100, range: 12, way: 0 }, "n-scale": { root: 0, scale: 5 }, "n-echo": { repeats: 3 }, "n-velocity": { low: 20, high: 60 } };
  const events = (fx) => { let k = 0; const dice = () => ((k = (k * 9301 + 49297) % 233280) / 233280); const s = { ...song, tracks: song.tracks.map((t) => (t.id === pluck.id ? { ...t, noteFx: fx } : t)) }; return S.songEvents(s, 4 * 16, 6 * 16, undefined, dice).filter((e) => e.kind === "note" && e.track === pluck.id); };
  const sum = (ev) => ({ n: ev.length, pitch: +(ev.reduce((a, e) => a + e.note, 0) / (ev.length || 1)).toFixed(1), secs: +(ev.reduce((a, e) => a + e.seconds, 0) / (ev.length || 1)).toFixed(3), vel: +(ev.reduce((a, e) => a + e.velocity, 0) / (ev.length || 1)).toFixed(0), classes: [...new Set(ev.map((e) => e.note % 12))].sort((a, b) => a - b).join(",") });
  const out = { none: sum(events([])) };
  for (const spec of N.NOTE_FX) {
    const d = { id: "n1", kind: spec.kind, on: true, p: { ...Object.fromEntries(spec.params.map((p) => [p.id, p.def])), ...(PUSH[spec.kind] ?? {}) } };
    try { out[spec.kind] = sum(events([d])); out[spec.kind + " off"] = sum(events([{ ...d, on: false }])); } catch (e) { out[spec.kind] = "ERROR " + e; }
  }
  // and one render with all eight in a row on the pluck, to make sure the played result reaches sound
  const { renderSong } = await import("/src/daw/render.ts");
  const all = N.NOTE_FX.map((spec, i) => ({ id: `n${i + 1}`, kind: spec.kind, on: true, p: Object.fromEntries(spec.params.map((p) => [p.id, p.def])) }));
  const solo = { ...song, bars: 8, masterFx: [], tracks: song.tracks.map((t) => ({ ...t, auto: [], solo: t.id === pluck.id, clips: t.clips.filter((c) => c.start + c.bars <= 8), ...(t.id === pluck.id ? { noteFx: all } : {}) })) };
  const w = await renderSong(solo, () => undefined);
  out.renderAllEight = { seconds: w.seconds, peak: +w.peak.toFixed(1) };
  return out;
}, song);
for (const [k, v] of Object.entries(r)) console.log(k.padEnd(16), JSON.stringify(v));
console.log("errors", JSON.stringify(errs));
await b.close();
