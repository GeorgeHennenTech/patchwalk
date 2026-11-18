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
// A knob's place along its travel, 0 to 1 (frequencies and times travel in ratios), and back onto its steps.
const travel = (s: ParamSpec, v: number) => Math.min(1, Math.max(0, s.log ? Math.log(v / s.min) / Math.log(s.max / s.min) : (v - s.min) / (s.max - s.min)));
const fromTravel = (s: ParamSpec, t: number) => { const x = Math.min(1, Math.max(0, t)), raw = s.log ? s.min * (s.max / s.min) ** x : s.min + x * (s.max - s.min); return s.log ? raw : Math.min(s.max, Math.max(s.min, Math.round(raw / s.step) * s.step)); };
const polar = (deg: number, r: number): [number, number] => [18 + r * Math.cos((deg * Math.PI) / 180), 18 + r * Math.sin((deg * Math.PI) / 180)];
const arc = (from: number, to: number, r = 15) => { const [a, b] = from <= to ? [from, to] : [to, from], [x1, y1] = polar(a, r), [x2, y2] = polar(b, r); return `M${x1.toFixed(2)},${y1.toFixed(2)}A${r},${r} 0 ${b - a > 180 ? 1 : 0} 1 ${x2.toFixed(2)},${y2.toFixed(2)}`; };
/**
 * A round knob: name above, value below. Drag up and down to turn it (Shift for fine), use the mouse wheel or
 * the arrow keys, double-click to put it back. A knob that goes both ways from a middle fills from the top.
 */
export function Knob({ s, v, name, set, auto }: { /** it has automation: "on" while the line moves it, "off" while the line is switched off because it was moved by hand */ auto?: "on" | "off"; s: ParamSpec; v: number; name: string; set: (v: number) => void }) {
  const t = travel(s, v), START = 135, SWEEP = 270, angle = START + t * SWEEP, both = !s.log && s.min < 0 && s.max > 0, zero = both ? START + travel(s, 0) * SWEEP : START;
  const held = useRef<{ y: number; t: number } | null>(null), [px, py] = polar(angle, 14.5), [qx, qy] = polar(angle, 5);
  const key = (e: React.KeyboardEvent) => { const by = (e.shiftKey ? 0.1 : 0.01) * (e.key === "ArrowUp" || e.key === "ArrowRight" ? 1 : e.key === "ArrowDown" || e.key === "ArrowLeft" ? -1 : 0);
    if (by) { e.preventDefault(); e.stopPropagation(); const next = fromTravel(s, t + by); set(next === v && !s.log ? Math.min(s.max, Math.max(s.min, v + Math.sign(by) * s.step)) : next); }
    else if (e.key === "Home") { e.preventDefault(); set(s.min); } else if (e.key === "End") { e.preventDefault(); set(s.max); } else if (e.key === "Delete" || e.key === "Backspace") { e.preventDefault(); e.stopPropagation(); set(s.def); } };
  return (
    <div className="dev-knob">
      <span className="dev-label">{s.label}{auto && <i className={`knob-auto ${auto}`} title={auto === "on" ? "This knob has automation" : "Its automation is switched off because you moved it. “Back to automation” in the top bar switches it on again."} />}</span>
      <svg viewBox="0 0 36 36" className="knob" role="slider" tabIndex={0} aria-label={name} aria-valuemin={s.min} aria-valuemax={s.max} aria-valuenow={v} aria-valuetext={shown(s, v)}
        onPointerDown={(e) => { e.preventDefault(); e.currentTarget.setPointerCapture(e.pointerId); e.currentTarget.focus(); held.current = { y: e.clientY, t }; }}
        onPointerMove={(e) => { const h = held.current; if (h) set(fromTravel(s, h.t + (h.y - e.clientY) / (e.shiftKey ? 900 : 150))); }}
        onPointerUp={() => { held.current = null; }} onPointerCancel={() => { held.current = null; }}
        onDoubleClick={() => set(s.def)} onKeyDown={key} onWheel={(e) => set(fromTravel(s, t + (e.deltaY < 0 ? 0.02 : -0.02)))}>
        <path d={arc(START, START + SWEEP)} className="knob-track" />
        {Math.abs(angle - zero) > 0.5 && <path d={arc(zero, angle)} className="knob-value" />}
        {both && <path d="M15.5,0.5 L20.5,0.5 L18,4 Z" className="knob-mid" />}
        <line x1={qx} y1={qy} x2={px} y2={py} className="knob-hand" />
      </svg>
      <span className="dev-value">{shown(s, v)}</span>
    </div>
  );
}
/** A device's settings as cells: knobs, menus, and switches (two switches share a cell, one above the other). */
function Cells({ spec, d, set, list, marks }: { marks?: (param: string) => "on" | "off" | undefined; spec: { name: string }; d: Device; set: (id: string, v: number) => void; list: ParamSpec[] }) {
  const cells: ParamSpec[][] = [];
  for (const s of list) { const sw = s.choices?.length === 2, last = cells[cells.length - 1]; if (sw && last && last.length < 2 && last[0]!.choices?.length === 2) last.push(s); else cells.push([s]); }
  const nameOf = (s: ParamSpec) => `${spec.name} ${s.group ? `${s.group} ` : ""}${s.label}`;
  return (
    <div className="dev-params">
      {cells.map((cell) => { const s = cell[0]!, v = d.p[s.id] ?? s.def;
        if (s.choices?.length === 2) return <div key={s.id} className="dev-switches">{cell.map((x) => { const on = !!(d.p[x.id] ?? x.def); return <button key={x.id} className={`dev-sw${on ? " on" : ""}`} aria-pressed={on} aria-label={nameOf(x)} onClick={() => set(x.id, on ? 0 : 1)}>{x.label}</button>; })}</div>;
        if (s.choices) return <label key={s.id} className="dev-menu"><span className="dev-label">{s.label}</span><select value={v} aria-label={nameOf(s)} onChange={(e) => set(s.id, Number(e.target.value))}>{s.choices.map((c, i) => <option key={c} value={i}>{c}</option>)}</select></label>;
        return <Knob key={s.id} s={s} v={v} name={nameOf(s)} auto={marks?.(s.id)} set={(x) => set(s.id, x)} />; })}
    </div>
  );
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
    <svg ref={svg} className="dev-curve" preserveAspectRatio="none" viewBox={`0 0 ${W} ${H}`} role="group" aria-label={`${spec.name}: level against frequency, 20 Hz to 20 kHz, 18 dB up and down. Drag the dots.`}>
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

/**
 * A device's pictures and settings, laid out left to right at one height: the open band's knobs, then the
 * display with the band buttons under it, then the rest. The curve's dots and the band buttons share which band is open.
 */
function Body({ spec, d, set, reduction, analyser, marks }: { marks?: (param: string) => "on" | "off" | undefined; spec: DeviceSpec; d: Device; set: (changes: Record<string, number>) => void; reduction?: (deviceId: string) => number | undefined; analyser?: (deviceId: string) => AnalyserNode | undefined }) {
  const groups = groupsOf(spec), [group, setGroup] = useState(groups[0]);
  const visible = (s: ParamSpec) => !s.when || s.when(d.p), banded = spec.params.filter((s) => s.group && s.group === group && visible(s)), rest = spec.params.filter((s) => !s.group && visible(s));
  const one = (id: string, v: number) => set({ [id]: v }), display = !!CURVES[d.kind] || !!spec.view;
  return (
    <div className="dev-body">
      {banded.length > 0 && <Cells marks={marks} spec={spec} d={d} set={one} list={banded} />}
      {(display || groups.length > 0) && <div className="dev-display">
        {CURVES[d.kind] && <Curve spec={spec} d={d} set={set} group={group} onGroup={setGroup} analyser={analyser ? () => (d.on ? analyser(d.id) : undefined) : undefined} />}
        {spec.view === "spectrum" && analyser && <SpectrumView read={() => analyser(d.id)} />}
        {spec.view === "tuner" && analyser && <TunerView read={() => analyser(d.id)} />}
        {groups.length > 0 && <div className="dev-groups" role="tablist">{groups.map((g) => <button key={g} role="tab" aria-selected={g === group} className={g === group ? "on" : ""} onClick={() => setGroup(g)}>{g.replace(/^Band /, "")}</button>)}</div>}
      </div>}
      {spec.meter && reduction && <Meter read={() => (d.on ? reduction(d.id) : 0)} />}
      {rest.length > 0 && <Cells marks={marks} spec={spec} d={d} set={one} list={rest} />}
    </div>
  );
}
/** How far the device is turning the sound down, read from the audio about thirty times a second. */
function Meter({ read }: { read: () => number | undefined }) {
  const bar = useRef<HTMLSpanElement>(null), text = useRef<HTMLElement>(null);
  useEffect(() => { let raf = 0, shown = 0; const tick = () => { const v = Math.max(0, read() ?? 0); shown = v > shown ? v : shown + (v - shown) * 0.15; if (bar.current) bar.current.style.height = `${Math.min(100, (shown / 24) * 100)}%`; if (text.current) text.current.textContent = `-${shown.toFixed(1)}`; raf = requestAnimationFrame(tick); }; raf = requestAnimationFrame(tick); return () => cancelAnimationFrame(raf); }, [read]);
  return <div className="dev-meter" aria-label="Turning down by" title="How far this device is turning the sound down right now"><span className="dev-label">GR</span><i><span ref={bar} /></i><b ref={text} className="dev-value">0.0 dB</b></div>;
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

/** What is carried while an effect is dragged: one already in a chain, or a kind from the browser's list. */
export const DRAG_DEVICE = "application/x-patchwalk-device";
export function DeviceChain({ devices, onChange, reduction, analyser, kind = "audio", lead, marks }: { /** which knobs have automation, and whether it is on */ marks?: (deviceId: string, param: string) => "on" | "off" | undefined; /** the track's instrument, drawn as the first device in the row */ lead?: React.ReactNode; /** "note": the note effects in front of a synth; "audio": the effects after the instrument */ kind?: "audio" | "note"; devices: Device[]; onChange: (next: Device[]) => void; reduction?: (deviceId: string) => number | undefined; analyser?: (deviceId: string) => AnalyserNode | undefined }) {
  const [picked, setPicked] = useState<string>(), [over, setOver] = useState<number>(), list = kind === "note" ? NOTE_FX : DEVICES;
  // Dropping: a device of this chain moves to the place it is dropped on; a kind from the browser is added there.
  const drop = (e: React.DragEvent, at: number) => { const raw = e.dataTransfer.getData(DRAG_DEVICE); setOver(undefined); if (!raw) return; e.preventDefault(); e.stopPropagation();
    const [what, value] = raw.split(":");
    if (what === "move") { const from = devices.findIndex((d) => d.id === value); if (from < 0) return; const next = devices.slice(), [d] = next.splice(from, 1); next.splice(at > from ? at - 1 : at, 0, d!); onChange(next); }
    else if (what === "add" && list.some((x) => x.kind === value)) { const added = addDevice(devices, value!); if (added === devices) return; const next = added.slice(), d = next.pop()!; next.splice(at, 0, d); onChange(next); } };
  const allow = (at: number) => (e: React.DragEvent) => { if (e.dataTransfer.types.includes(DRAG_DEVICE)) { e.preventDefault(); setOver(at); } };
  return (
    <div className={`chain ${kind}`} aria-label={kind === "note" ? "Note effects on this track" : "Effects on this track"} onDragLeave={(e) => { if (!e.currentTarget.contains(e.relatedTarget as Node)) setOver(undefined); }}>
      <div className="chain-row">
        {lead}
        {devices.map((d, i) => { const spec = specOf(d.kind); if (!spec) return null; return (
          <section key={d.id} className={`dev${d.on ? "" : " off"}${picked === d.id ? " picked" : ""}${over === i ? " before" : ""}`} aria-label={spec.name} onDragOver={allow(i)} onDrop={(e) => drop(e, i)}>
            <header draggable tabIndex={0} title={`${spec.about} In Ableton Live: ${spec.like}. Drag to move it; Delete removes it.`} onDragStart={(e) => { e.dataTransfer.setData(DRAG_DEVICE, `move:${d.id}`); e.dataTransfer.effectAllowed = "move"; }} onMouseDown={() => setPicked(d.id)} onFocus={() => setPicked(d.id)}
              onKeyDown={(e) => { if (e.target !== e.currentTarget) return; if (e.key === "Delete" || e.key === "Backspace") { e.preventDefault(); e.stopPropagation(); onChange(removeDevice(devices, d.id)); } else if (e.key === "0") { e.preventDefault(); e.stopPropagation(); onChange(toggleDevice(devices, d.id)); } }}>
              <button className={`dev-on${d.on ? " on" : ""}`} aria-pressed={d.on} aria-label={`${spec.name} on`} title="Switch this device on or off" onClick={() => onChange(toggleDevice(devices, d.id))} />
              <b>{spec.name}</b>
              {spec.note && <span className="dev-info" title={spec.note} aria-label={spec.note}>i</span>}
              <button className="dev-round" aria-label={`Move ${spec.name} earlier`} title="Earlier in the chain" disabled={i === 0} onClick={() => onChange(moveDevice(devices, d.id, -1))}>◀</button>
              <button className="dev-round" aria-label={`Move ${spec.name} later`} title="Later in the chain" disabled={i === devices.length - 1} onClick={() => onChange(moveDevice(devices, d.id, 1))}>▶</button>
              <button className="dev-round" aria-label={`Remove ${spec.name}`} title="Remove" onClick={() => onChange(removeDevice(devices, d.id))}>×</button>
            </header>
            <Body marks={marks && ((p) => marks(d.id, p))} spec={spec} d={d} reduction={reduction} analyser={analyser} set={(changes) => onChange(Object.entries(changes).reduce((c, [id, v]) => setDeviceParam(c, d.id, id, v), devices))} />
          </section>
        ); })}
        <div className={`dev-drop${over === devices.length ? " over" : ""}`} onDragOver={allow(devices.length)} onDrop={(e) => drop(e, devices.length)}>
          <span>{kind === "note" ? "Drop MIDI Effects Here" : "Drop Audio Effects Here"}</span>
          {devices.length < MAX_DEVICES ? <select value="" aria-label={kind === "note" ? "Add a note effect" : "Add an effect"} onChange={(e) => { if (e.target.value) onChange(addDevice(devices, e.target.value)); }}><option value="">or choose…</option>{list.map((x) => <option key={x.kind} value={x.kind}>{x.name}</option>)}</select> : <small>Eight at most</small>}
          {devices.length === 0 && <small>{kind === "note" ? "They change this track's clip notes before the synth plays them." : "The sound passes through each in turn, left to right."}</small>}
        </div>
      </div>
    </div>
  );
}
