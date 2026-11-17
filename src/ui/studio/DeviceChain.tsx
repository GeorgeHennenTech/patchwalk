// A track's effects, in a row after its instrument, the way a DAW's device chain reads left to right.
import { DEVICES, MAX_DEVICES, addDevice, moveDevice, removeDevice, setDeviceParam, specOf, toggleDevice, type Device, type ParamSpec } from "../../daw/devices";

const shown = (s: ParamSpec, v: number) => (s.choices ? s.choices[v] ?? String(v) : s.id === "pan" ? (v === 0 ? "centre" : v < 0 ? `${-v} left` : `${v} right`) : `${v > 0 && s.min < 0 && s.unit === "dB" ? "+" : ""}${v}${s.unit ? ` ${s.unit}` : ""}`);

export function DeviceChain({ devices, onChange }: { devices: Device[]; onChange: (next: Device[]) => void }) {
  return (
    <div className="chain" aria-label="Effects on this track">
      <div className="chain-row">
        {devices.map((d, i) => { const spec = specOf(d.kind); if (!spec) return null; return (
          <section key={d.id} className={`dev${d.on ? "" : " off"}`} aria-label={spec.name}>
            <header>
              <button className={`dev-on${d.on ? " on" : ""}`} aria-pressed={d.on} aria-label={`${spec.name} on`} title="Switch this device on or off" onClick={() => onChange(toggleDevice(devices, d.id))} />
              <b title={`${spec.about} In Ableton Live: ${spec.like}.`}>{spec.name}</b>
              <button aria-label={`Move ${spec.name} earlier`} title="Earlier in the chain" disabled={i === 0} onClick={() => onChange(moveDevice(devices, d.id, -1))}>◀</button>
              <button aria-label={`Move ${spec.name} later`} title="Later in the chain" disabled={i === devices.length - 1} onClick={() => onChange(moveDevice(devices, d.id, 1))}>▶</button>
              <button aria-label={`Remove ${spec.name}`} title="Remove" onClick={() => onChange(removeDevice(devices, d.id))}>×</button>
            </header>
            <div className="dev-params">
              {spec.params.map((s) => { const v = d.p[s.id] ?? s.def; return s.choices && s.choices.length === 2
                ? <button key={s.id} className={`dev-sw${v ? " on" : ""}`} aria-pressed={!!v} onClick={() => onChange(setDeviceParam(devices, d.id, s.id, v ? 0 : 1))}>{s.label}</button>
                : <label key={s.id} className="dev-knob"><span>{s.label} <b>{shown(s, v)}</b></span><input type="range" min={s.min} max={s.max} step={s.step} value={v} aria-label={`${spec.name} ${s.label}`} onChange={(e) => onChange(setDeviceParam(devices, d.id, s.id, Number(e.target.value)))} onDoubleClick={() => onChange(setDeviceParam(devices, d.id, s.id, s.def))} /></label>; })}
            </div>
          </section>
        ); })}
        {devices.length < MAX_DEVICES && <label className="dev-add">Add an effect <select value="" aria-label="Add an effect" onChange={(e) => { if (e.target.value) onChange(addDevice(devices, e.target.value)); }}><option value="">Choose…</option>{DEVICES.map((s) => <option key={s.kind} value={s.kind}>{s.name}</option>)}</select></label>}
      </div>
      {devices.length === 0 && <p className="daw-hint">No effects on this track yet. They go after the instrument, left to right, and the sound passes through each in turn.</p>}
    </div>
  );
}
