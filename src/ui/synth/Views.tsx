import { useEffect, useRef, useState } from "react";
import { effectiveCutoff, filterResponseDb } from "../../synth/filter";
import { macroSlots, slotPush } from "../../synth/macros";
import { adsr, ENV1_COLOR, fallShape, SOURCES } from "../../synth/mod";
import { MATRIX_MAX, PARAMS, type MatrixRow, type SynthState } from "../../synth/params";
import type { Synth } from "../../synth/useSynth";
import { DestOptions, fromTravel, toTravel } from "./Controls";

function useFrame(draw: () => void, active: boolean) {
  useEffect(() => {
    if (!active) return;
    let id = 0;
    const loop = () => { draw(); id = requestAnimationFrame(loop); };
    id = requestAnimationFrame(loop);
    return () => cancelAnimationFrame(id);
  });
}

function setup(canvas: HTMLCanvasElement) {
  const dpr = window.devicePixelRatio || 1;
  const w = canvas.clientWidth, h = canvas.clientHeight;
  if (canvas.width !== w * dpr) { canvas.width = w * dpr; canvas.height = h * dpr; }
  const g = canvas.getContext("2d")!;
  g.setTransform(dpr, 0, 0, dpr, 0, 0);
  g.clearRect(0, 0, w, h);
  const css = getComputedStyle(canvas);
  return { g, w, h, line: css.getPropertyValue("--accent").trim() || "#c2186b", grid: css.getPropertyValue("--line").trim() || "#ccc" };
}

/** The wave over time. Drawing starts at an upward zero crossing so a steady tone stands still. */
export function Scope({ synth }: { synth: Synth }) {
  const ref = useRef<HTMLCanvasElement>(null);
  const buf = useRef(new Float32Array(4096));
  useFrame(() => {
    const canvas = ref.current, an = synth.engine.current?.analyser;
    if (!canvas) return;
    const { g, w, h, line, grid } = setup(canvas);
    g.strokeStyle = grid; g.lineWidth = 1; g.beginPath(); g.moveTo(0, h / 2); g.lineTo(w, h / 2); g.stroke();
    if (!an) return;
    an.getFloatTimeDomainData(buf.current);
    const d = buf.current;
    let start = 0;
    for (let i = 1; i < 2048; i++) if (d[i - 1]! <= 0 && d[i]! > 0) { start = i; break; }
    const span = 1400;
    g.strokeStyle = line; g.lineWidth = 2; g.beginPath();
    for (let x = 0; x < w; x++) {
      const v = d[start + Math.floor((x / w) * span)] ?? 0;
      const y = h / 2 - v * (h / 2) * 1.6;
      x === 0 ? g.moveTo(x, y) : g.lineTo(x, y);
    }
    g.stroke();
  }, true);
  return <figure className="view"><canvas ref={ref} aria-label="Oscilloscope" /><figcaption>Scope: the wave over time. Narrower waves mean a higher pitch.</figcaption></figure>;
}

/** The harmonics, low on the left to high on the right (logarithmic), from the live signal. */
export function Spectrum({ synth }: { synth: Synth }) {
  const ref = useRef<HTMLCanvasElement>(null);
  const buf = useRef(new Float32Array(2048));
  useFrame(() => {
    const canvas = ref.current, an = synth.engine.current?.analyser;
    if (!canvas) return;
    const { g, w, h, line, grid } = setup(canvas);
    const lo = 40, hi = 16000;
    g.fillStyle = grid; g.font = "10px system-ui"; 
    for (const f of [100, 1000, 10000]) { const x = (Math.log(f / lo) / Math.log(hi / lo)) * w; g.fillRect(x, 0, 1, h); g.fillText(f >= 1000 ? `${f / 1000} kHz` : `${f} Hz`, x + 3, 10); }
    if (!an) return;
    an.getFloatFrequencyData(buf.current);
    const nyquist = an.context.sampleRate / 2;
    g.strokeStyle = line; g.lineWidth = 1.5; g.beginPath();
    for (let x = 0; x < w; x++) {
      const f = lo * (hi / lo) ** (x / w);
      const db = buf.current[Math.min(buf.current.length - 1, Math.round((f / nyquist) * buf.current.length))] ?? -120;
      const y = h - Math.max(0, Math.min(1, (db + 100) / 80)) * h;
      x === 0 ? g.moveTo(x, y) : g.lineTo(x, y);
    }
    g.stroke();
  }, true);
  return <figure className="view"><canvas ref={ref} aria-label="Spectrum" /><figcaption>Spectrum: each peak is one harmonic. Left is low, right is high.</figcaption></figure>;
}

export function Meter({ synth }: { synth: Synth }) {
  const [db, setDb] = useState(-Infinity);
  const buf = useRef(new Float32Array(2048));
  useEffect(() => {
    const id = setInterval(() => setDb(synth.engine.current ? synth.engine.current.peakDb(buf.current) : -Infinity), 120);
    return () => clearInterval(id);
  }, [synth.engine]);
  const pct = Number.isFinite(db) ? Math.max(0, Math.min(100, ((db + 60) / 60) * 100)) : 0;
  return (
    <div className="ctl meter">
      <span className="ctl-name">Level</span>
      <div className="meter-bar" role="meter" aria-valuemin={-60} aria-valuemax={0} aria-valuenow={Number.isFinite(db) ? Math.round(db) : -60}><div style={{ width: `${pct}%` }} /></div>
      <output>{Number.isFinite(db) ? `${db.toFixed(1)} dB` : "silent"}</output>
    </div>
  );
}

/** How many dB the compressor is turning the sound down at this moment. */
export function Reduction({ synth }: { synth: Synth }) {
  const [db, setDb] = useState(0);
  useEffect(() => {
    const id = setInterval(() => setDb(synth.engine.current ? synth.engine.current.fx.reduction : 0), 100);
    return () => clearInterval(id);
  }, [synth.engine]);
  const pct = Math.max(0, Math.min(100, (-db / 30) * 100));
  return (
    <div className="ctl meter reduction">
      <span className="ctl-name">Turning down by</span>
      <div className="meter-bar" role="meter" aria-label="Compressor gain reduction" aria-valuemin={0} aria-valuemax={30} aria-valuenow={Math.round(-db)}><div style={{ width: `${pct}%` }} /></div>
      <output>{`${(-db).toFixed(1)} dB`}</output>
    </div>
  );
}

const CURVE = { lo: 20, hi: 20000, top: 24, bottom: -48 };
/** Where a frequency sits across the filter drawing (0..1), and back. Octaves are evenly spaced. */
export const curveX = (hz: number) => Math.log(hz / CURVE.lo) / Math.log(CURVE.hi / CURVE.lo);
export const curveHz = (x: number) => CURVE.lo * (CURVE.hi / CURVE.lo) ** Math.min(1, Math.max(0, x));
const curveY = (db: number) => 1 - (Math.min(CURVE.top, Math.max(CURVE.bottom, db)) - CURVE.bottom) / (CURVE.top - CURVE.bottom);

/**
 * The filter's curve: how much it lets through at each frequency, computed from the settings (never from the
 * sound), with the live spectrum faintly behind it. The dot can be dragged: sideways for cutoff, up and down
 * for resonance.
 */
export function FilterCurve({ synth, note, spot, compact }: { synth: Synth; note: number | null; spot?: boolean; compact?: boolean }) {
  const ref = useRef<HTMLCanvasElement>(null);
  const buf = useRef(new Float32Array(2048));
  const drag = useRef<{ y: number; resonance: number } | null>(null);
  const s = synth.state;
  useFrame(() => {
    // what is drawn: the settings after the macros, moved the way the sources are moving them at this instant
    const playing = synth.live();
    const canvas = ref.current, an = synth.engine.current?.analyser;
    if (!canvas) return;
    const { g, w, h, line, grid } = setup(canvas);
    const rate = an?.context.sampleRate ?? 48000;
    g.fillStyle = grid; g.font = "10px system-ui";
    for (const f of [100, 1000, 10000]) { const x = curveX(f) * w; g.fillRect(x, 0, 1, h); g.fillText(f >= 1000 ? `${f / 1000} kHz` : `${f} Hz`, x + 3, 10); }
    g.fillRect(0, curveY(0) * h, w, 1);
    if (an) {
      // the sound itself, faint, so the curve can be seen carving it
      an.getFloatFrequencyData(buf.current);
      g.globalAlpha = 0.22; g.fillStyle = line; g.beginPath(); g.moveTo(0, h);
      for (let x = 0; x < w; x++) {
        const db = buf.current[Math.min(buf.current.length - 1, Math.round((curveHz(x / w) / (rate / 2)) * buf.current.length))] ?? -120;
        g.lineTo(x, h - Math.max(0, Math.min(1, (db + 100) / 80)) * h);
      }
      g.lineTo(w, h); g.fill(); g.globalAlpha = 1;
    }
    g.strokeStyle = line; g.lineWidth = 2.5; g.beginPath();
    for (let x = 0; x <= w; x++) {
      const y = curveY(filterResponseDb(playing, curveHz(x / w), note, rate)) * h;
      x === 0 ? g.moveTo(x, y) : g.lineTo(x, y);
    }
    g.stroke();
    if (s.filterOn) {
      const hz = effectiveCutoff(playing, note, rate);
      g.fillStyle = line; g.beginPath(); g.arc(curveX(hz) * w, curveY(filterResponseDb(playing, hz, note, rate)) * h, 7, 0, 2 * Math.PI); g.fill();
      g.strokeStyle = "#fff"; g.lineWidth = 2; g.stroke();
    }
  }, true);
  const move = (e: React.PointerEvent<HTMLCanvasElement>) => {
    if (!drag.current || !s.filterOn) return;
    const box = e.currentTarget.getBoundingClientRect();
    // Undo key tracking so the dot, which is drawn at the tracked cutoff, stays under the pointer.
    const follow = effectiveCutoff({ cutoff: 1000, keyTrack: s.keyTrack }, note) / 1000;
    // (the dot is drawn at the moving cutoff, but dragging sets the knob itself)
    const cutoff = Math.round(Math.min(20000, Math.max(20, curveHz((e.clientX - box.left) / box.width) / follow)));
    const resonance = Math.round(Math.min(100, Math.max(0, drag.current.resonance + ((drag.current.y - e.clientY) / box.height) * 150)));
    synth.setState({ cutoff, resonance });
  };
  return (
    <figure className={`view curve${spot ? " spot" : ""}${compact ? " compact" : ""}`}>
      <canvas ref={ref} role="img" aria-label="Filter curve. Drag the dot sideways to move the cutoff and up or down to change the resonance."
        onPointerDown={(e) => { if (!s.filterOn) return; e.currentTarget.setPointerCapture(e.pointerId); drag.current = { y: e.clientY, resonance: s.resonance }; synth.flag("curve"); move(e); }}
        onPointerMove={move} onPointerUp={() => { drag.current = null; }} onPointerCancel={() => { drag.current = null; }} />
      {!compact && <figcaption>{s.filterOn ? "Filter curve: how much gets through at each frequency. Drag the dot: sideways moves the cutoff, up and down sets the resonance. The faint shape is the live sound." : "Filter curve: flat, because the filter is off and everything gets through."}</figcaption>}
    </figure>
  );
}

/**
 * The spectrum over time, scrolling left: newest on the right, low at the bottom, brighter meaning louder.
 * Shows things a still spectrum cannot, such as a filter sweep or a beat, as shapes.
 */
export function Spectrogram({ synth }: { synth: Synth }) {
  const ref = useRef<HTMLCanvasElement>(null);
  const buf = useRef(new Float32Array(2048));
  useFrame(() => {
    const canvas = ref.current, an = synth.engine.current?.analyser;
    if (!canvas) return;
    const dpr = window.devicePixelRatio || 1, w = Math.round(canvas.clientWidth * dpr), h = Math.round(canvas.clientHeight * dpr);
    if (canvas.width !== w || canvas.height !== h) { canvas.width = w; canvas.height = h; }
    if (!an || an.context.state !== "running" || w < 2) return;
    const g = canvas.getContext("2d")!, step = Math.max(1, Math.round(dpr));
    g.globalAlpha = 1;
    // "copy" replaces the picture with its shifted self; the default would pile each frame on top of the last
    g.globalCompositeOperation = "copy";
    g.drawImage(canvas, -step, 0);
    g.globalCompositeOperation = "source-over";
    g.clearRect(w - step, 0, step, h);
    an.getFloatFrequencyData(buf.current);
    const nyquist = an.context.sampleRate / 2, lo = 40, hi = 16000;
    g.fillStyle = getComputedStyle(canvas).getPropertyValue("--accent").trim() || "#c2186b";
    for (let y = 0; y < h; y += step) {
      const f = lo * (hi / lo) ** (1 - y / h);
      const db = buf.current[Math.min(buf.current.length - 1, Math.round((f / nyquist) * buf.current.length))] ?? -120;
      const level = Math.max(0, Math.min(1, (db + 100) / 60));
      if (level <= 0.02) continue;
      g.globalAlpha = level ** 1.5;
      g.fillRect(w - step, y, step, step);
    }
    g.globalAlpha = 1;
  }, true);
  return <figure className="view"><canvas ref={ref} aria-label="Spectrogram" /><figcaption>Spectrogram: the spectrum over time. Newest on the right, higher pitch higher up, stronger colour means louder.</figcaption></figure>;
}

const ENV = { w: 320, h: 110, pad: 10, stage: 0.26, hold: 0.16 };
/**
 * Where an envelope's three draggable points sit. Each timed stage takes up to a quarter of the width,
 * following its knob's position, so short and long times both stay easy to grab. The drawing shows the shape
 * and the order of the stages; it is not a ruler for seconds.
 */
export function envPoints(s: SynthState, which: 1 | 2) {
  const k = which === 1 ? "env" : "env2";
  const span = (ENV.w - 2 * ENV.pad) * ENV.stage, top = ENV.pad, bottom = ENV.h - ENV.pad;
  const t = (key: "A" | "D" | "R") => toTravel(PARAMS[`${k}${key}`]!, s[`${k}${key}`]);
  const level = bottom - (s[`${k}S`] / 100) * (bottom - top);
  // the hold stage is a flat stretch at the top; it gets up to a third of a stage's width
  const a = ENV.pad + t("A") * span, h = a + (s[`${k}H`] / 2000) * span * 0.35, d = h + t("D") * span, held = d + (ENV.w - 2 * ENV.pad) * ENV.hold * 0.7, r = held + t("R") * span;
  return { a: { x: a, y: top }, h: { x: h, y: top }, d: { x: d, y: level }, held: { x: held, y: level }, r: { x: r, y: bottom }, span, top, bottom };
}

/** An envelope you can drag: the top point sets attack, the middle one decay and sustain, the last one release. */
export function EnvCurve({ synth, which, spot }: { synth: Synth; which: 1 | 2; spot?: boolean }) {
  const s = synth.state, k = which === 1 ? "env" : "env2";
  const p = envPoints(s, which), e = adsr(s, which);
  const color = which === 1 ? ENV1_COLOR : SOURCES[0]!.color;
  const drag = useRef<{ point: "a" | "d" | "r"; x: number; y: number; start: SynthState } | null>(null);
  // decay and release fall in the envelope's own shape (straight, eased or sharp), as the sound does
  const ease = (from: { x: number; y: number }, to: { x: number; y: number }) => Array.from({ length: 17 }, (_, i) => { const u = i / 16; return `L${(from.x + (to.x - from.x) * u).toFixed(1)} ${(to.y + (from.y - to.y) * fallShape(e.bend, u, 1)).toFixed(1)}`; }).join(" ");
  const path = `M${ENV.pad} ${p.bottom} L${p.a.x.toFixed(1)} ${p.a.y} L${p.h.x.toFixed(1)} ${p.h.y} ${ease(p.h, p.d)} L${p.held.x.toFixed(1)} ${p.d.y.toFixed(1)} ${ease(p.held, p.r)}`;
  const move = (ev: React.PointerEvent<SVGSVGElement>) => {
    const g = drag.current;
    if (!g) return;
    const box = ev.currentTarget.getBoundingClientRect(), scale = ENV.w / box.width;
    const dx = ((ev.clientX - g.x) * scale) / p.span, dy = ((g.y - ev.clientY) * scale) / (p.bottom - p.top);
    const timed = (key: "A" | "D" | "R") => ({ [`${k}${key}`]: fromTravel(PARAMS[`${k}${key}`]!, toTravel(PARAMS[`${k}${key}`]!, g.start[`${k}${key}`]) + dx) });
    const patch = g.point === "a" ? timed("A") : g.point === "r" ? timed("R") : { ...timed("D"), [`${k}S`]: Math.round(Math.min(100, Math.max(0, g.start[`${k}S`] + dy * 100))) };
    synth.setState(patch as Partial<SynthState>);
  };
  const grab = (point: "a" | "d" | "r") => (ev: React.PointerEvent) => { ((ev.currentTarget as SVGCircleElement).ownerSVGElement ?? ev.currentTarget).setPointerCapture(ev.pointerId); drag.current = { point, x: ev.clientX, y: ev.clientY, start: s }; synth.flag(which === 1 ? "envelope" : "envelope2"); };
  const handle = (point: "a" | "d" | "r", at: { x: number; y: number }, label: string) => <circle className="env-handle" cx={at.x} cy={at.y} r="7" onPointerDown={grab(point)}><title>{label}</title></circle>;
  return (
    <figure className={`view env${spot ? " spot" : ""}`} style={{ "--glow": color } as React.CSSProperties}>
      <svg viewBox={`0 0 ${ENV.w} ${ENV.h}`} role="img" aria-label={`Envelope ${which}: attack ${Math.round(e.attack * 1000)} ms, decay ${Math.round(e.decay * 1000)} ms, sustain ${Math.round(e.sustain * 100)}%, release ${Math.round(e.release * 1000)} ms. Drag the points to change it.`}
        onPointerMove={move} onPointerUp={() => { drag.current = null; }} onPointerCancel={() => { drag.current = null; }}>
        <line className="env-key" x1={p.held.x} x2={p.held.x} y1={p.top - 4} y2={p.bottom} />
        <text className="env-note" x={p.held.x + 4} y={p.top + 4}>key let go</text>
        <path className="env-line" d={path} />
        {handle("a", p.a, "Attack: drag sideways")}{handle("d", p.d, "Decay and sustain: drag sideways and up or down")}{handle("r", p.r, "Release: drag sideways")}
      </svg>
      <figcaption>Envelope {which}{which === 1 ? " (loudness)" : ""}: drag the first point for attack, the second for decay and sustain, the last for release. It shows the shape, not exact seconds.</figcaption>
    </figure>
  );
}

/**
 * Every connection in the patch as one list: what moves, what it moves, and by how much. The same facts the
 * rings show, read as a table. Written by code from the settings.
 */
export function Matrix({ synth }: { synth: Synth }) {
  const s = synth.state;
  const set = (patch: Partial<SynthState>) => { synth.flag("matrix"); synth.setState(patch); };
  const setRow = (i: number, change: Partial<MatrixRow>) => set({ matrix: s.matrix.map((r, k) => (k === i ? { ...r, ...change } : r)) });
  const kind = (id: string) => SOURCES.find((x) => x.id === id)!.kind;
  // every source's own connection (also set on its panel), then the extra rows added here
  const rows = [
    ...SOURCES.map((x) => ({ key: x.id as string, source: x.id, dest: s[`${x.id}Dest`], amount: s[`${x.id}Amount`], way: x.kind === "lfo" ? s[`${x.id as "lfo1"}Way`] : undefined, own: true, index: -1 })),
    ...s.matrix.map((r, i) => ({ key: `m${i}`, source: r.source, dest: r.dest, amount: r.amount, way: kind(r.source) === "lfo" ? r.way : undefined, own: false, index: i })),
  ];
  const slots = macroSlots(s);
  return (
    <figure className="view matrix">
      <table>
        <thead><tr><th>Source</th><th>Moves</th><th>Amount</th><th>Direction</th><th /></tr></thead>
        <tbody>
          <tr className="fixed"><td><i style={{ background: ENV1_COLOR }} />Env 1</td><td>Note level</td><td>always</td><td>one way</td><td /></tr>
          {rows.map((r) => {
            const info = SOURCES.find((x) => x.id === r.source)!, name = `${info.name}${r.own ? "" : ` (row ${r.index + 1})`}`;
            return (
              <tr key={r.key} className={r.dest === "none" || r.amount === 0 ? "off" : ""}>
                <td><i style={{ background: info.color }} />
                  {r.own ? info.name : <select value={r.source} aria-label={`Matrix: row ${r.index + 1} source`} onChange={(e) => setRow(r.index, { source: e.target.value as MatrixRow["source"] })}>{SOURCES.map((x) => <option key={x.id} value={x.id}>{x.name}</option>)}</select>}
                </td>
                <td><select value={r.dest} aria-label={`Matrix: ${name} moves`} onChange={(e) => (r.own ? set({ [`${r.source}Dest`]: e.target.value } as Partial<SynthState>) : setRow(r.index, { dest: e.target.value as MatrixRow["dest"] }))}><DestOptions /></select></td>
                <td><input type="number" min={-100} max={100} step={1} value={r.amount} aria-label={`Matrix: ${name} amount`} onChange={(e) => { const v = Math.max(-100, Math.min(100, Math.round(Number(e.target.value) || 0))); if (r.own) set({ [`${r.source}Amount`]: v } as Partial<SynthState>); else setRow(r.index, { amount: v }); }} /> %</td>
                <td>{r.way === undefined ? (info.kind === "note" && info.id === "key" ? "both ways" : "one way")
                  : <select value={r.way} aria-label={`Matrix: ${name} direction`} onChange={(e) => (r.own ? set({ [`${r.source}Way`]: e.target.value } as Partial<SynthState>) : setRow(r.index, { way: e.target.value as MatrixRow["way"] }))}><option value="both">Both ways</option><option value="up">One way</option></select>}</td>
                <td>{!r.own && <button className="link" aria-label={`Remove row ${r.index + 1}`} onClick={() => set({ matrix: s.matrix.filter((_, k) => k !== r.index) })}>Remove</button>}</td>
              </tr>
            );
          })}
          {slots.map((m) => <tr key={`s${m.macro}-${m.slot}`} className="fixed"><td><i style={{ background: m.color }} />{m.name || `Macro ${m.macro}`}</td><td>{PARAMS[m.dest]!.label}</td><td>{m.amount > 0 ? "+" : ""}{m.amount}%</td><td colSpan={2}>macro at {m.value}%: pushing {Math.round(slotPush(m) * 100)}% of the knob’s travel</td></tr>)}
        </tbody>
      </table>
      <p className="matrix-add"><button className="link" disabled={s.matrix.length >= MATRIX_MAX} onClick={() => set({ matrix: [...s.matrix, { source: "lfo1", dest: "none", amount: 30, way: "both" }] })}>Add a row</button>
        {s.matrix.length >= MATRIX_MAX ? ` The matrix is full (${MATRIX_MAX} extra rows).` : " A row sends a source somewhere else as well, so one source can move several things."}</p>
      <figcaption>Matrix: every connection in this sound, and the place to change them. Each row with a destination and an amount is one ring on a knob. Macro slots are set on the macro panels.</figcaption>
    </figure>
  );
}
