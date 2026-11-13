import { useEffect, useRef, useState } from "react";
import { effectiveCutoff, filterResponseDb } from "../../synth/filter";
import type { Synth } from "../../synth/useSynth";

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
export function FilterCurve({ synth, note, spot }: { synth: Synth; note: number | null; spot?: boolean }) {
  const ref = useRef<HTMLCanvasElement>(null);
  const buf = useRef(new Float32Array(2048));
  const drag = useRef<{ y: number; resonance: number } | null>(null);
  const s = synth.state;
  useFrame(() => {
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
      const y = curveY(filterResponseDb(s, curveHz(x / w), note, rate)) * h;
      x === 0 ? g.moveTo(x, y) : g.lineTo(x, y);
    }
    g.stroke();
    if (s.filterOn) {
      const hz = effectiveCutoff(s, note, rate);
      g.fillStyle = line; g.beginPath(); g.arc(curveX(hz) * w, curveY(filterResponseDb(s, hz, note, rate)) * h, 7, 0, 2 * Math.PI); g.fill();
      g.strokeStyle = "#fff"; g.lineWidth = 2; g.stroke();
    }
  }, true);
  const move = (e: React.PointerEvent<HTMLCanvasElement>) => {
    if (!drag.current || !s.filterOn) return;
    const box = e.currentTarget.getBoundingClientRect();
    // Undo key tracking so the dot, which is drawn at the tracked cutoff, stays under the pointer.
    const follow = effectiveCutoff({ cutoff: 1000, keyTrack: s.keyTrack }, note) / 1000;
    const cutoff = Math.round(Math.min(20000, Math.max(20, curveHz((e.clientX - box.left) / box.width) / follow)));
    const resonance = Math.round(Math.min(100, Math.max(0, drag.current.resonance + ((drag.current.y - e.clientY) / box.height) * 150)));
    synth.setState({ cutoff, resonance });
  };
  return (
    <figure className={`view curve${spot ? " spot" : ""}`}>
      <canvas ref={ref} role="img" aria-label="Filter curve. Drag the dot sideways to move the cutoff and up or down to change the resonance."
        onPointerDown={(e) => { if (!s.filterOn) return; e.currentTarget.setPointerCapture(e.pointerId); drag.current = { y: e.clientY, resonance: s.resonance }; synth.flag("curve"); move(e); }}
        onPointerMove={move} onPointerUp={() => { drag.current = null; }} onPointerCancel={() => { drag.current = null; }} />
      <figcaption>{s.filterOn ? "Filter curve: how much gets through at each frequency. Drag the dot: sideways moves the cutoff, up and down sets the resonance. The faint shape is the live sound." : "Filter curve: flat, because the filter is off and everything gets through."}</figcaption>
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
