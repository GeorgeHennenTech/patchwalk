// Counting: an animated cycle with one or two layers of clicks, and taps that are heard at once and judged against a layer.
// The rules are in src/rhythm/count.ts. Everything here follows the audio clock, so what is seen and what is heard agree.
import { useCallback, useEffect, useRef, useState } from "react";
import { EXERCISES, ON, clicksBetween, cycleSeconds, hasIt, inWords, judge, phaseAt, summary, verdict, type Exercise } from "../rhythm/count";

const DONE = "patchwalk.rhythm.v1", LAG = "patchwalk.rhythm.lag.v1";
const COLOURS = ["#ff9a3c", "#35c2de"], RADII = [128, 92], TONES = [520, 880];
const loadDone = (): string[] => { try { const v = JSON.parse(localStorage.getItem(DONE) ?? "[]") as unknown; return Array.isArray(v) ? v.filter((x): x is string => typeof x === "string") : []; } catch { return []; } };

/** A short click: `to` is where it goes. The first click of a cycle is higher and louder. */
function click(ctx: AudioContext, at: number, hz: number, level: number, to: AudioNode): void {
  const o = ctx.createOscillator(), g = ctx.createGain();
  o.type = "triangle"; o.frequency.value = hz;
  g.gain.setValueAtTime(0, at); g.gain.linearRampToValueAtTime(level, at + 0.002); g.gain.exponentialRampToValueAtTime(0.0001, at + 0.07);
  o.connect(g).connect(to); o.start(at); o.stop(at + 0.09);
}

export default function RhythmView() {
  const [ex, setEx] = useState<Exercise>(EXERCISES[0]!);
  const [bpm, setBpm] = useState(ex.bpm);
  const [running, setRunning] = useState(false);
  const [tapLayer, setTapLayer] = useState(ex.tap);
  const [muted, setMuted] = useState<boolean[]>([false, false]);
  const [offs, setOffs] = useState<number[]>([]);
  const [last, setLast] = useState<{ off: number; layer: number } | null>(null);
  const [done, setDone] = useState<string[]>(loadDone);
  // how late this computer's sound and keys are, in thousandths of a second: taken off every tap before it is judged
  const [lag, setLag] = useState(() => { try { const v = Number(localStorage.getItem(LAG)); return Number.isFinite(v) ? Math.min(200, Math.max(-100, v)) : 0; } catch { return 0; } });
  const ctxRef = useRef<AudioContext | null>(null), out = useRef<GainNode | null>(null);
  const start = useRef(0), nextFrom = useRef(0), timer = useRef<number | undefined>(undefined);
  const live = useRef({ ex, bpm, muted, tapLayer, lag, running }); live.current = { ex, bpm, muted, tapLayer, lag, running };
  const hand = useRef<SVGLineElement>(null), dots = useRef(new Map<string, SVGCircleElement>()), counts = useRef(new Map<string, HTMLElement>());

  const stop = useCallback(() => { if (timer.current !== undefined) window.clearInterval(timer.current); timer.current = undefined; setRunning(false); }, []);
  const choose = (e: Exercise) => { stop(); setEx(e); setBpm(e.bpm); setTapLayer(e.tap); setMuted([false, false]); setOffs([]); setLast(null); };
  const begin = useCallback(() => {
    const ctx = ctxRef.current ?? new AudioContext(); ctxRef.current = ctx;
    if (!out.current) { out.current = ctx.createGain(); out.current.gain.value = 0.5; out.current.connect(ctx.destination); }
    void ctx.resume();
    start.current = ctx.currentTime + 0.15; nextFrom.current = start.current;
    const pump = () => { const { ex: e, bpm: b, muted: m } = live.current, until = ctx.currentTime + 0.12;
      for (const c of clicksBetween(e.layers, start.current, cycleSeconds(b), nextFrom.current, until)) if (!m[c.layer]) click(ctx, c.at, TONES[c.layer]! * (c.hit === 0 ? 1.5 : 1), c.hit === 0 ? 0.55 : 0.32, out.current!);
      nextFrom.current = until; };
    pump(); timer.current = window.setInterval(pump, 25);
    setOffs([]); setLast(null); setRunning(true);
  }, []);
  useEffect(() => () => { if (timer.current !== undefined) window.clearInterval(timer.current); void ctxRef.current?.close(); }, []);
  // a change of speed keeps the cycle's place: the start is moved so that "now" is the same share of the way round
  const speed = (next: number) => { const ctx = ctxRef.current; if (ctx && running) { const was = cycleSeconds(bpm), p = phaseAt(ctx.currentTime, start.current, was); start.current = ctx.currentTime - p * cycleSeconds(next); nextFrom.current = ctx.currentTime + 0.12; } setBpm(next); };

  // a tap: heard at once, and judged against the layer it was for
  const tap = useCallback((layer: number) => {
    const { ex: e, bpm: b, lag: l, running: on } = live.current, ctx = ctxRef.current;
    if (!on || !ctx || !e.layers[layer]) return;
    click(ctx, ctx.currentTime, 240, 0.5, out.current!);
    const heard = ctx.currentTime - (ctx.outputLatency || ctx.baseLatency || 0) - l / 1000;
    if (heard < start.current - 0.2) return;
    const cycle = cycleSeconds(b), r = judge(e.layers[layer]!, phaseAt(heard, start.current, cycle), cycle);
    setLast({ off: r.off, layer }); setOffs((o) => [...o.slice(-63), r.off]);
    const dot = dots.current.get(`${layer}:${r.hit}`); if (dot) { dot.classList.remove("tapped", "early", "late", "on"); void dot.getBoundingClientRect(); dot.classList.add("tapped", verdict(r.off)); }
  }, []);
  useEffect(() => {
    const key = (e: KeyboardEvent) => { const t = e.target as HTMLElement | null; if (e.repeat || e.ctrlKey || e.metaKey || e.altKey || (t && /^(INPUT|SELECT|TEXTAREA)$/.test(t.tagName) && (t as HTMLInputElement).type !== "range")) return;
      const k = e.key.toLowerCase();
      if (e.code === "Space") { e.preventDefault(); tap(live.current.tapLayer); } else if (k === "f") tap(0); else if (k === "j") tap(live.current.ex.layers.length > 1 ? 1 : 0); };
    window.addEventListener("keydown", key); return () => window.removeEventListener("keydown", key);
  }, [tap]);
  useEffect(() => { if (hasIt(offs) && !done.includes(ex.id)) { const next = [...done, ex.id]; setDone(next); try { localStorage.setItem(DONE, JSON.stringify(next)); } catch { /* not kept */ } } }, [offs, ex.id, done]);

  // the moving hand, the dots that light as they sound, and the count: drawn straight from the audio clock every frame
  useEffect(() => {
    if (!running) { if (hand.current) hand.current.setAttribute("transform", "rotate(0)"); return; }
    let raf = 0;
    const frame = () => { raf = requestAnimationFrame(frame); const ctx = ctxRef.current; if (!ctx) return;
      const { ex: e, bpm: b } = live.current, seen = ctx.currentTime - (ctx.outputLatency || ctx.baseLatency || 0), p = seen < start.current ? 0 : phaseAt(seen, start.current, cycleSeconds(b));
      hand.current?.setAttribute("transform", `rotate(${p * 360})`);
      e.layers.forEach((l, li) => { let now = -1; l.hits.forEach((h, hi) => { if (p >= h) now = hi; });
        l.hits.forEach((h, hi) => { const lit = hi === now && p - h < 0.5 / Math.max(4, l.hits.length); dots.current.get(`${li}:${hi}`)?.classList.toggle("lit", lit); counts.current.get(`${li}:${hi}`)?.classList.toggle("lit", hi === now); }); });
    };
    raf = requestAnimationFrame(frame); return () => cancelAnimationFrame(raf);
  }, [running, ex]);

  const sum = summary(offs.slice(-16)), got = done.includes(ex.id);
  return (
    <section className="rhythm" aria-label="Counting">
      <div className="rhythm-list panel" role="tablist" aria-label="Exercises">{EXERCISES.map((e, i) => <button key={e.id} role="tab" aria-selected={e.id === ex.id} className={e.id === ex.id ? "on" : ""} onClick={() => choose(e)}>{done.includes(e.id) ? "✓ " : ""}{i + 1}. {e.title}</button>)}</div>
      <div className="rhythm-main panel">
        <h2>{ex.title}{got ? <small> · you have this one</small> : null}</h2>
        <p className="rhythm-idea">{ex.idea}</p>
        <div className="rhythm-stage">
          <svg viewBox="-160 -160 320 320" className="rhythm-wheel" role="img" aria-label={`A cycle with ${ex.layers.map((l) => `${l.hits.length} clicks of ${l.name}`).join(" and ")}`}>
            {ex.layers.map((l, li) => <g key={`${ex.id}:${li}`} style={{ color: COLOURS[li] }} className={muted[li] ? "off" : ""}>
              <circle r={RADII[li]} className="ring" />
              {l.hits.map((h, hi) => { const a = h * 2 * Math.PI, x = Math.sin(a) * RADII[li]!, y = -Math.cos(a) * RADII[li]!; return <g key={hi}><circle cx={x} cy={y} r={hi === 0 ? 11 : 8} className="rdot" ref={(el) => { if (el) dots.current.set(`${li}:${hi}`, el); else dots.current.delete(`${li}:${hi}`); }} /><text x={Math.sin(a) * (RADII[li]! - 22)} y={-Math.cos(a) * (RADII[li]! - 22) + 4} className="num">{l.count[hi]}</text></g>; })}
            </g>)}
            <line ref={hand} x1={0} y1={0} x2={0} y2={-146} className="hand" /><circle r={5} className="hub" />
          </svg>
          <div className="rhythm-side">
            {ex.layers.map((l, li) => <div key={`${ex.id}:${li}`} className="rhythm-layer" style={{ color: COLOURS[li] }}>
              <b>{l.name}</b>
              <span className="rhythm-count" aria-hidden="true">{l.count.map((c, hi) => <i key={hi} ref={(el) => { if (el) counts.current.set(`${li}:${hi}`, el); else counts.current.delete(`${li}:${hi}`); }}>{c}</i>)}</span>
              <label><input type="checkbox" checked={!muted[li]} onChange={(e) => setMuted((m) => m.map((x, i) => (i === li ? !e.target.checked : x)))} /> hear it</label>
              {ex.layers.length > 1 && <label><input type="radio" name="tapto" checked={tapLayer === li} onChange={() => { setTapLayer(li); setOffs([]); setLast(null); }} /> Space taps this ({li === 0 ? "F" : "J"} always does)</label>}
            </div>)}
            <div className="rhythm-controls">
              <button className="primary" onClick={() => (running ? stop() : begin())}>{running ? "Stop" : "Start"}</button>
              <button className="rhythm-tap" disabled={!running} onMouseDown={(e) => { e.preventDefault(); tap(tapLayer); }}>Tap (Space)</button>
              <label>Speed <input type="range" min={30} max={160} step={1} value={bpm} aria-label="Speed" onChange={(e) => speed(Number(e.target.value))} /> <b>{bpm}</b> beats a minute</label>
            </div>
            <p className={`rhythm-last ${last ? verdict(last.off) : ""}`} role="status">{!running ? "Press Start, listen for a cycle or two, count aloud, then tap." : last ? inWords(last.off) : "Tap on the clicks."}</p>
            <div className="rhythm-strip" aria-hidden="true"><span className="mid" />{offs.slice(-16).map((o, i) => <i key={i} className={verdict(o)} style={{ left: `${50 + Math.max(-48, Math.min(48, (o / 0.15) * 48))}%`, opacity: 0.35 + (0.65 * (i + 1)) / 16 }} />)}<small className="l">early</small><small className="r">late</small></div>
            {offs.length > 0 && <p className="rhythm-sum">{sum.on} of your last {sum.of} taps were on the click (within {ON * 1000} ms).{Math.abs(sum.lean) > 0.02 ? ` You lean ${Math.round(Math.abs(sum.lean) * 1000)} ms ${sum.lean < 0 ? "early" : "late"}.` : ""}{got ? "" : " Thirteen of sixteen and you have it."}</p>}
            <details className="rhythm-lag"><summary>My taps always read early or late</summary>
              <p>Every computer adds a small delay between a key and what is heard. If your taps read late by about the same amount whatever you do, move this until a steady tap on "A steady four" reads on the click. It is remembered.</p>
              <label>Take off <input type="range" min={-100} max={200} step={5} value={lag} aria-label="Delay to take off" onChange={(e) => { const v = Number(e.target.value); setLag(v); try { localStorage.setItem(LAG, String(v)); } catch { /* not kept */ } }} /> <b>{lag}</b> ms</label>
            </details>
          </div>
        </div>
        <p className="rhythm-note">Try each one three ways: with both sounds on; with the layer you tap switched off, so you carry it alone; and with the other layer off, to check you can still feel where it would be. Nothing here counts against you.</p>
      </div>
    </section>
  );
}
