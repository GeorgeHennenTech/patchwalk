// A track's effects, in a row after its instrument, the way a DAW's device chain reads left to right.
import { useEffect, useRef, useState } from "react";
import { detectPitch, nearestNote } from "../../daw/dsp";
import { NOTE_FX } from "../../daw/notefx";
import { CURVES, HANDLES, noteName, DEVICES, MAX_DEVICES, addDevice, moveDevice, removeDevice, setDeviceParam, specOf, toggleDevice, type Device, type DeviceSpec, type Handle, type ParamSpec } from "../../daw/devices";

const round = (v: number) => (Math.abs(v) >= 100 ? Math.round(v) : Number(v.toFixed(2)));
const shown = (s: ParamSpec, v: number) => (s.id === "note" ? noteName(v) : s.unit === "Hz" && v >= 1000 ? `${round(v / 1000)} kHz` : s.choices ? s.choices[v] ?? String(v) : s.id.endsWith("pan") ? (v === 0 ? "centre" : v < 0 ? `${-v} left` : `${v} right`) : `${v > 0 && s.min < 0 && s.unit === "dB" ? "+" : ""}${v}${s.unit ? ` ${s.unit}` : ""}`);

// A slider that moves in ratios (frequencies, times) keeps its place as a number from 0 to 1000.
const toSlider = (s: ParamSpec, v: number) => Math.round((1000 * Math.log(v / s.min)) / Math.log(s.max / s.min));
const fromSlider = (s: ParamSpec, x: number) => s.min * (s.max / s.min) ** (x / 1000);

const groupsOf = (spec: { params: ParamSpec[] }) => [...new Set(spec.params.map((s) => s.group).filter((g): g is string => !!g))];
function Params({ spec, d, set, group, setGroup }: { spec: { name: string; params: ParamSpec[] }; d: Device; set: (id: string, v: number) => void; group?: string; setGroup: (g: string) => void }) {
  const groups = groupsOf(spec);
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

const W = 300, H = 140, LOW = 20, HIGH = 20000, TOP = 18;
const xOf = (f: number) => (W * Math.log(f / LOW)) / Math.log(HIGH / LOW), yOf = (dB: number) => H / 2 - (dB / TOP) * (H / 2);
const fAt = (x: number) => LOW * (HIGH / LOW) ** (Math.min(W, Math.max(0, x)) / W), dbAt = (y: number) => ((H / 2 - Math.min(H, Math.max(0, y))) / (H / 2)) * TOP;
/**
 * The device's level against frequency, drawn from the same maths the sound is made with. Its dots can be
 * dragged: sideways for frequency, up and down for gain (or sharpness where there is no gain); the mouse
 * wheel over a dot changes its sharpness; a double-click puts its gain back to zero. Arrow keys work too.
 */
function Curve({ spec, d, set, group, onGroup, analyser }: { /** the sound coming out of the device, drawn faintly behind the curve */ analyser?: () => AnalyserNode | undefined; spec: { name: string; params: ParamSpec[] }; d: Device; set: (changes: Record<string, number>) => void; group?: string; onGroup: (g: string) => void }) {
  const kind = d.kind, p = d.p, at = CURVES[kind]!, pts: string[] = [], handles = HANDLES[kind]?.(p) ?? [], svg = useRef<SVGSVGElement>(null), held = useRef<{ h: Handle; q0: number; y0: number } | null>(null);
  for (let i = 0; i <= 150; i++) { const f = LOW * (HIGH / LOW) ** (i / 150); pts.push(`${xOf(f).toFixed(1)},${Math.min(H + 4, Math.max(-4, yOf(at(p, f)))).toFixed(1)}`); }
  const live = useRef<SVGPathElement>(null), read = useRef(analyser); read.current = analyser;
  useEffect(() => { let raf = 0, data: Float32Array<ArrayBuffer> | undefined, n = 0;
    const tick = () => { raf = requestAnimationFrame(tick); if (n++ % 2) return; const a = read.current?.(), el = live.current; if (!el) return; if (!a) { el.setAttribute("d", ""); return; }
      if (!data || data.length !== a.frequencyBinCount) data = new Float32Array(a.frequencyBinCount);
      a.getFloatFrequencyData(data); const perBin = a.context.sampleRate / a.fftSize; let path = `M0,${H}`, any = false;
      for (let x = 0; x <= W; x += 3) { const lo = Math.max(1, Math.floor(fAt(x) / perBin)), hi = Math.max(lo + 1, Math.ceil(fAt(x + 3) / perBin)); let top = -200; for (let b = lo; b < hi && b < data.length; b++) if (data[b]! > top) top = data[b]!;
        const y = H * Math.min(1, Math.max(0, (-12 - top) / 84)); if (y < H - 0.5) any = true; path += `L${x},${y.toFixed(1)}`; }
      el.setAttribute("d", any ? `${path}L${W},${H}Z` : ""); };
    raf = requestAnimationFrame(tick); return () => cancelAnimationFrame(raf); }, []);
  const range = (id: string) => spec.params.find((s) => s.id === id);
  const where = (e: { clientX: number; clientY: number }) => { const r = svg.current!.getBoundingClientRect(); return { x: ((e.clientX - r.left) / r.width) * W, y: ((e.clientY - r.top) / r.height) * H }; };
  const sharper = (h: Handle, q: number, by: number) => { const s = h.qParam ? range(h.qParam) : undefined; return s ? Math.min(s.max, Math.max(s.min, q * by)) : q; };
  const drag = (e: React.PointerEvent) => { const g = held.current; if (!g) return; const { x, y } = where(e), h = g.h, next: Record<string, number> = {};
    if (h.fParam) next[h.fParam] = fAt(x);
    if (h.dbParam) next[h.dbParam] = dbAt(y); else if (h.qParam) next[h.qParam] = sharper(h, g.q0, 2 ** ((g.y0 - y) / 18));     // up is sharper
    set(next); };
  const keys = (h: Handle) => (e: React.KeyboardEvent) => { const big = e.shiftKey ? 4 : 1, next: Record<string, number> = {};
    if (e.key === "ArrowLeft" && h.fParam) next[h.fParam] = h.f / 1.03 ** big; else if (e.key === "ArrowRight" && h.fParam) next[h.fParam] = h.f * 1.03 ** big;
    else if ((e.key === "ArrowUp" || e.key === "ArrowDown") && h.dbParam) next[h.dbParam] = h.db + (e.key === "ArrowUp" ? 0.5 : -0.5) * big;
    else if ((e.key === "ArrowUp" || e.key === "ArrowDown") && h.qParam) next[h.qParam] = sharper(h, p[h.qParam] ?? 1, e.key === "ArrowUp" ? 1.1 : 1 / 1.1);
    else return;
    e.preventDefault(); e.stopPropagation(); set(next); };
  return (
    <svg ref={svg} className="dev-curve" viewBox={`0 0 ${W} ${H}`} role="group" aria-label={`${spec.name}: level against frequency, 20 Hz to 20 kHz, 18 dB up and down. Drag the dots.`}>
      {[100, 1000, 10000].map((f) => <g key={f}><line x1={xOf(f)} x2={xOf(f)} y1={0} y2={H} className="grid" /><text x={xOf(f) + 3} y={H - 3}>{f >= 1000 ? `${f / 1000}k` : f}</text></g>)}
      {[-12, 0, 12].map((g) => <line key={g} x1={0} x2={W} y1={yOf(g)} y2={yOf(g)} className={g ? "grid" : "zero"} />)}
      <path ref={live} className="live" />
      <polyline points={pts.join(" ")} />
      {handles.map((h, i) => { const cx = xOf(h.f), cy = Math.min(H - 8, Math.max(8, yOf(h.db))), on = !!h.group && h.group === group;
        return <g key={`${h.label}:${i}`} className={`dev-dot${on ? " on" : ""}`} tabIndex={0} role="slider" aria-label={`${spec.name} ${h.label} dot`} aria-valuenow={Math.round(h.fParam ? h.f : h.db)} aria-valuetext={`${h.fParam ? `${round(h.f)} Hz` : ""}${h.dbParam ? ` ${h.db} dB` : ""}`}
          onPointerDown={(e) => { e.preventDefault(); (e.currentTarget as SVGGElement).setPointerCapture(e.pointerId); (e.currentTarget as SVGGElement).focus(); held.current = { h, q0: h.qParam ? p[h.qParam] ?? 1 : 1, y0: where(e).y }; if (h.group) onGroup(h.group); }}
          onPointerMove={drag} onPointerUp={() => { held.current = null; }} onPointerCancel={() => { held.current = null; }}
          onDoubleClick={() => { if (h.dbParam) set({ [h.dbParam]: 0 }); }} onKeyDown={keys(h)} onFocus={() => { if (h.group) onGroup(h.group); }}
          onWheel={(e) => { if (h.qParam) set({ [h.qParam]: sharper(h, p[h.qParam] ?? 1, e.deltaY < 0 ? 1.12 : 1 / 1.12) }); }}>
          <circle cx={cx} cy={cy} r={12} className="hit" /><circle cx={cx} cy={cy} r={7} /><text className="num" x={cx} y={cy + 3}>{h.tag}</text>
        </g>; })}
    </svg>
  );
}

/** A device's pictures and settings. The curve's dots and the settings below share which band is open. */
function Body({ spec, d, set, reduction, analyser }: { spec: DeviceSpec; d: Device; set: (changes: Record<string, number>) => void; reduction?: (deviceId: string) => number | undefined; analyser?: (deviceId: string) => AnalyserNode | undefined }) {
  const [group, setGroup] = useState(groupsOf(spec)[0]);
  return (<>
    {CURVES[d.kind] && <Curve spec={spec} d={d} set={set} group={group} onGroup={setGroup} analyser={analyser ? () => (d.on ? analyser(d.id) : undefined) : undefined} />}
    {spec.view === "spectrum" && analyser && <SpectrumView read={() => analyser(d.id)} />}
    {spec.view === "tuner" && analyser && <TunerView read={() => analyser(d.id)} />}
    {spec.meter && reduction && <Meter read={() => (d.on ? reduction(d.id) : 0)} />}
    <Params spec={spec} d={d} set={(id, v) => set({ [id]: v })} group={group} setGroup={setGroup} />
  </>);
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

export function DeviceChain({ devices, onChange, reduction, analyser, kind = "audio" }: { /** "note": the note effects in front of a synth; "audio": the effects after the instrument */ kind?: "audio" | "note"; devices: Device[]; onChange: (next: Device[]) => void; reduction?: (deviceId: string) => number | undefined; analyser?: (deviceId: string) => AnalyserNode | undefined }) {
  return (
    <div className="chain" aria-label={kind === "note" ? "Note effects on this track" : "Effects on this track"}>
      <h4 className="chain-title">{kind === "note" ? "Note effects · before the synth" : "Effects · after the instrument"}</h4>
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
            <Body spec={spec} d={d} reduction={reduction} analyser={analyser} set={(changes) => onChange(Object.entries(changes).reduce((c, [id, v]) => setDeviceParam(c, d.id, id, v), devices))} />
            {spec.note && <p className="dev-note">{spec.note}</p>}
          </section>
        ); })}
        {devices.length < MAX_DEVICES && <label className="dev-add">{kind === "note" ? "Add a note effect" : "Add an effect"} <select value="" aria-label={kind === "note" ? "Add a note effect" : "Add an effect"} onChange={(e) => { if (e.target.value) onChange(addDevice(devices, e.target.value)); }}><option value="">Choose…</option>{(kind === "note" ? NOTE_FX : DEVICES).map((s) => <option key={s.kind} value={s.kind}>{s.name}</option>)}</select></label>}
      </div>
      {devices.length === 0 && <p className="daw-hint">{kind === "note" ? "No note effects yet. They change the notes written in this track's clips before the synth plays them: an arpeggiator, chords, a scale. Keys played live are not changed." : "No effects on this track yet. They go after the instrument, left to right, and the sound passes through each in turn."}</p>}
    </div>
  );
}
