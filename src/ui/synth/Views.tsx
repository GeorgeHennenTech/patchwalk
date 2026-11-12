import { useEffect, useRef, useState } from "react";
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
