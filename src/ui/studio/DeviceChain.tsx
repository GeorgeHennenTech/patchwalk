// A track's effects, in a row after its instrument, the way a DAW's device chain reads left to right.
import { useEffect, useRef, useState } from "react";
import { detectPitch, nearestNote } from "../../daw/dsp";
import { CURVES, noteName, DEVICES, MAX_DEVICES, addDevice, moveDevice, removeDevice, setDeviceParam, specOf, toggleDevice, type Device, type ParamSpec } from "../../daw/devices";

const round = (v: number) => (Math.abs(v) >= 100 ? Math.round(v) : Number(v.toFixed(2)));
const shown = (s: ParamSpec, v: number) => (s.id === "note" ? noteName(v) : s.unit === "Hz" && v >= 1000 ? `${round(v / 1000)} kHz` : s.choices ? s.choices[v] ?? String(v) : s.id.endsWith("pan") ? (v === 0 ? "centre" : v < 0 ? `${-v} left` : `${v} right`) : `${v > 0 && s.min < 0 && s.unit === "dB" ? "+" : ""}${v}${s.unit ? ` ${s.unit}` : ""}`);

// A slider that moves in ratios (frequencies, times) keeps its place as a number from 0 to 1000.
const toSlider = (s: ParamSpec, v: number) => Math.round((1000 * Math.log(v / s.min)) / Math.log(s.max / s.min));
const fromSlider = (s: ParamSpec, x: number) => s.min * (s.max / s.min) ** (x / 1000);

function Params({ spec, d, set }: { spec: { name: string; params: ParamSpec[] }; d: Device; set: (id: string, v: number) => void }) {
  const groups = [...new Set(spec.params.map((s) => s.group).filter((g): g is string => !!g))];
  const [group, setGroup] = useState(groups[0]);
  const one = (s: ParamSpec) => { const v = d.p[s.id] ?? s.def, name = `${spec.name} ${s.group ? `${s.group} ` : ""}${s.label}`;
    if (s.choices && s.choices.length === 2) return <button key={s.id} className={`dev-sw${v ? " on" : ""}`} aria-pressed={!!v} aria-label={name} onClick={() => set(s.id, v ? 0 : 1)}>{s.label}</button>;
    if (s.choices) return <label key={s.id} className="dev-knob"><span>{s.label}</span><select value={v} aria-label={name} onChange={(e) => set(s.id, Number(e.target.value))}>{s.choices.map((c, i) => <option key={c} value={i}>{c}</option>)}</select></label>;
    return <label key={s.id} className="dev-knob"><span>{s.label} <b>{shown(s, v)}</b></span>{s.log
      ? <input type="range" min={0} max={1000} step={1} value={toSlider(s, v)} aria-label={name} onChange={(e) => set(s.id, fromSlider(s, Number(e.target.value)))} onDoubleClick={() => set(s.id, s.def)} />
      : <input type="range" min={s.min} max={s.max} step={s.step} value={v} aria-label={name} onChange={(e) => set(s.id, Number(e.target.value))} onDoubleClick={() => set(s.id, s.def)} />}</label>; };
  const visible = (s: ParamSpec) => (!s.group || s.group === group) && (!s.when || s.when(d.p));
  return (<>
    {groups.length > 0 && <div className="dev-groups" role="tablist">{groups.map((g) => <button key={g} role="tab" aria-selected={g === group} className={g === group ? "on" : ""} onClick={() => setGroup(g)}>{g.replace(/^Band /, "")}</button>)}</div>}
    <div className="dev-params">{spec.params.filter(visible).map(one)}</div>
  </>);
}

const W = 300, H = 110, LOW = 20, HIGH = 20000, TOP = 18;
const xOf = (f: number) => (W * Math.log(f / LOW)) / Math.log(HIGH / LOW), yOf = (dB: number) => H / 2 - (dB / TOP) * (H / 2);
/** The device's level against frequency, drawn from the same maths the sound is made with. */
function Curve({ kind, p }: { kind: string; p: Record<string, number> }) {
  const at = CURVES[kind]!, pts: string[] = [];
  for (let i = 0; i <= 150; i++) { const f = LOW * (HIGH / LOW) ** (i / 150); pts.push(`${xOf(f).toFixed(1)},${Math.min(H + 4, Math.max(-4, yOf(at(p, f)))).toFixed(1)}`); }
  return (
    <svg className="dev-curve" viewBox={`0 0 ${W} ${H}`} role="img" aria-label="Level against frequency, 20 Hz to 20 kHz, 18 dB up and down">
      {[100, 1000, 10000].map((f) => <g key={f}><line x1={xOf(f)} x2={xOf(f)} y1={0} y2={H} className="grid" /><text x={xOf(f) + 3} y={H - 3}>{f >= 1000 ? `${f / 1000}k` : f}</text></g>)}
      {[-12, 0, 12].map((g) => <line key={g} x1={0} x2={W} y1={yOf(g)} y2={yOf(g)} className={g ? "grid" : "zero"} />)}
      <polyline points={pts.join(" ")} />
      {kind === "eq8" && Array.from({ length: 8 }, (_, i) => { const n = i + 1; if (!(p[`b${n}on`] ?? 1)) return null; const f = p[`b${n}freq`] ?? 1000; return <g key={n}><circle cx={xOf(f)} cy={Math.min(H - 6, Math.max(6, yOf(at(p, f))))} r={6} /><text className="num" x={xOf(f)} y={Math.min(H - 6, Math.max(6, yOf(at(p, f)))) + 3}>{n}</text></g>; })}
    </svg>
  );
}

/** How far the device is turning the sound down, read from the audio about thirty times a second. */
function Meter({ read }: { read: () => number | undefined }) {
  const bar = useRef<HTMLSpanElement>(null), text = useRef<HTMLElement>(null);
  useEffect(() => { let raf = 0, shown = 0; const tick = () => { const v = Math.max(0, read() ?? 0); shown = v > shown ? v : shown + (v - shown) * 0.15; if (bar.current) bar.current.style.width = `${Math.min(100, (shown / 24) * 100)}%`; if (text.current) text.current.textContent = `${shown.toFixed(1)} dB`; raf = requestAnimationFrame(tick); }; raf = requestAnimationFrame(tick); return () => cancelAnimationFrame(raf); }, [read]);
  return <div className="dev-meter" aria-label="Turning down by"><span>Turning down by <b ref={text}>0.0 dB</b></span><i><span ref={bar} /></i></div>;
}

/** The sound's spectrum, 20 Hz to 20 kHz, drawn about thirty times a second. */
function SpectrumView({ read }: { read: () => AnalyserNode | undefined }) {
  const ref = useRef<HTMLCanvasElement>(null);
  useEffect(() => { let raf = 0, data: Float32Array<ArrayBuffer> | undefined;
    const tick = () => { raf = requestAnimationFrame(tick); const c = ref.current, a = read(), g = c?.getContext("2d"); if (!c || !g) return;
      g.fillStyle = "#1b1b1d"; g.fillRect(0, 0, c.width, c.height); g.strokeStyle = "#333336"; g.fillStyle = "#8a8a90"; g.font = "9px sans-serif";
      for (const f of [100, 1000, 10000]) { const x = (c.width * Math.log(f / 20)) / Math.log(1000); g.beginPath(); g.moveTo(x, 0); g.lineTo(x, c.height); g.stroke(); g.fillText(f >= 1000 ? `${f / 1000}k` : String(f), x + 3, c.height - 3); }
      if (!a) return;
      if (!data || data.length !== a.frequencyBinCount) data = new Float32Array(a.frequencyBinCount);
      a.getFloatFrequencyData(data); const perBin = a.context.sampleRate / a.fftSize;
      g.strokeStyle = "#f5a623"; g.lineWidth = 1.4; g.beginPath();
      for (let x = 0; x < c.width; x++) { const f = 20 * 1000 ** (x / c.width), lo = Math.max(1, Math.floor(f / perBin)), hi = Math.max(lo + 1, Math.ceil((20 * 1000 ** ((x + 1) / c.width)) / perBin)); let top = -200; for (let b = lo; b < hi && b < data.length; b++) if (data[b]! > top) top = data[b]!;
        const y = c.height * Math.min(1, Math.max(0, -top / 96)); if (x) g.lineTo(x, y); else g.moveTo(x, y); }
      g.stroke(); };
    raf = requestAnimationFrame(tick); return () => cancelAnimationFrame(raf); }, [read]);
  return <canvas ref={ref} className="dev-spectrum" width={600} height={260} aria-label="Spectrum: 20 Hz to 20 kHz across, loud at the top down to 96 dB quieter at the bottom" />;
}
/** The note being played and how far off it is, read a few times a second. */
function TunerView({ read }: { read: () => AnalyserNode | undefined }) {
  const [got, setGot] = useState<{ name: string; cents: number; hz: number } | null>(null);
  useEffect(() => { const id = window.setInterval(() => { const a = read(); if (!a) { setGot(null); return; } const x = new Float32Array(a.fftSize); a.getFloatTimeDomainData(x); const hz = detectPitch(x, a.context.sampleRate); setGot(hz ? { ...nearestNote(hz), hz } : null); }, 120); return () => window.clearInterval(id); }, [read]);
  const off = got ? Math.max(-50, Math.min(50, got.cents)) : 0;
  return (
    <div className="dev-tuner" aria-live="off">
      <b>{got ? got.name : "–"}</b>
      <div className="dev-tuner-bar"><i /><span style={{ left: `${50 + off}%`, opacity: got ? 1 : 0.2 }} className={got && Math.abs(got.cents) <= 5 ? "in" : ""} /></div>
      <small>{got ? `${got.hz.toFixed(1)} Hz · ${got.cents === 0 ? "in tune" : got.cents > 0 ? `${got.cents} cents sharp` : `${-got.cents} cents flat`}` : "Play one note at a time"}</small>
    </div>
  );
}

export function DeviceChain({ devices, onChange, reduction, analyser }: { devices: Device[]; onChange: (next: Device[]) => void; reduction?: (deviceId: string) => number | undefined; analyser?: (deviceId: string) => AnalyserNode | undefined }) {
  return (
    <div className="chain" aria-label="Effects on this track">
      <div className="chain-row">
        {devices.map((d, i) => { const spec = specOf(d.kind); if (!spec) return null; return (
          <section key={d.id} className={`dev${d.on ? "" : " off"}${spec.wide ? " wide" : ""}`} aria-label={spec.name}>
            <header>
              <button className={`dev-on${d.on ? " on" : ""}`} aria-pressed={d.on} aria-label={`${spec.name} on`} title="Switch this device on or off" onClick={() => onChange(toggleDevice(devices, d.id))} />
              <b title={`${spec.about} In Ableton Live: ${spec.like}.`}>{spec.name}</b>
              <button aria-label={`Move ${spec.name} earlier`} title="Earlier in the chain" disabled={i === 0} onClick={() => onChange(moveDevice(devices, d.id, -1))}>◀</button>
              <button aria-label={`Move ${spec.name} later`} title="Later in the chain" disabled={i === devices.length - 1} onClick={() => onChange(moveDevice(devices, d.id, 1))}>▶</button>
              <button aria-label={`Remove ${spec.name}`} title="Remove" onClick={() => onChange(removeDevice(devices, d.id))}>×</button>
            </header>
            {CURVES[d.kind] && <Curve kind={d.kind} p={d.p} />}
            {spec.view === "spectrum" && analyser && <SpectrumView read={() => analyser(d.id)} />}
            {spec.view === "tuner" && analyser && <TunerView read={() => analyser(d.id)} />}
            {spec.meter && reduction && <Meter read={() => (d.on ? reduction(d.id) : 0)} />}
            <Params spec={spec} d={d} set={(id, v) => onChange(setDeviceParam(devices, d.id, id, v))} />
            {spec.note && <p className="dev-note">{spec.note}</p>}
          </section>
        ); })}
        {devices.length < MAX_DEVICES && <label className="dev-add">Add an effect <select value="" aria-label="Add an effect" onChange={(e) => { if (e.target.value) onChange(addDevice(devices, e.target.value)); }}><option value="">Choose…</option>{DEVICES.map((s) => <option key={s.kind} value={s.kind}>{s.name}</option>)}</select></label>}
      </div>
      {devices.length === 0 && <p className="daw-hint">No effects on this track yet. They go after the instrument, left to right, and the sound passes through each in turn.</p>}
    </div>
  );
}
