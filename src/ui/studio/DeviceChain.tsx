// A track's effects, in a row after its instrument, the way a DAW's device chain reads left to right.
import { useState } from "react";
import { CURVES, DEVICES, MAX_DEVICES, addDevice, moveDevice, removeDevice, setDeviceParam, specOf, toggleDevice, type Device, type ParamSpec } from "../../daw/devices";

const round = (v: number) => (Math.abs(v) >= 100 ? Math.round(v) : Number(v.toFixed(2)));
const shown = (s: ParamSpec, v: number) => (s.unit === "Hz" && v >= 1000 ? `${round(v / 1000)} kHz` : s.choices ? s.choices[v] ?? String(v) : s.id === "pan" ? (v === 0 ? "centre" : v < 0 ? `${-v} left` : `${v} right`) : `${v > 0 && s.min < 0 && s.unit === "dB" ? "+" : ""}${v}${s.unit ? ` ${s.unit}` : ""}`);

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

export function DeviceChain({ devices, onChange }: { devices: Device[]; onChange: (next: Device[]) => void }) {
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
