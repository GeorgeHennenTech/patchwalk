// The sampler as the first device of a synth track's rack: one sound file played across the keys.
import { Knob } from "./DeviceChain";
import { Wave } from "./DrumRack";
import type { ParamSpec } from "../../daw/devices";
import type { SamplerSet } from "../../daw/sampler";

const K: Record<string, ParamSpec> = {
  root: { id: "note", label: "Root key", min: 24, max: 96, step: 1, def: 60 },
  tune: { id: "tune", label: "Tune", min: -24, max: 24, step: 1, def: 0, unit: "st" },
  start: { id: "start", label: "Start", min: 0, max: 99, step: 1, def: 0, unit: "%" },
  length: { id: "length", label: "Length", min: 1, max: 100, step: 1, def: 100, unit: "%" },
  attack: { id: "attack", label: "Fade in", min: 1, max: 2000, step: 1, def: 2, unit: "ms", log: true },
  release: { id: "release", label: "Fade out", min: 1, max: 5000, step: 1, def: 80, unit: "ms", log: true },
  level: { id: "level", label: "Level", min: 0, max: 100, step: 1, def: 80 },
};
export function SamplerPanel({ set, onChange, onSynth, samples, peaks, seconds }: { set: SamplerSet; onChange: (next: SamplerSet) => void; /** go back to the synth */ onSynth: () => void; samples: { id: string; name: string }[]; peaks: number[]; seconds: number }) {
  const knob = (key: keyof typeof K, field: keyof SamplerSet) => <Knob s={K[key]!} v={set[field] as number} name={`Sampler ${K[key]!.label}`} set={(v) => onChange({ ...set, [field]: K[key]!.log ? Math.round(v) : v })} />;
  const here = samples.some((s) => s.id === set.sample);
  return (
    <section className="dev inst sampler" aria-label="Sampler">
      <header><span className="dev-on on" aria-hidden="true" /><b>Sampler</b><button className="dev-round" aria-label="Use the synth instead" title="Go back to the synth on this track" onClick={onSynth}>×</button></header>
      <div className="dev-body">
        <div className="dev-display sampler-display">
          {peaks.length ? <Wave peaks={peaks} start={set.start} length={set.length} fade={0} seconds={seconds} /> : <p className="sampler-none">{here ? "Reading the sound…" : "This sound file is not in this browser."}</p>}
          <select value={here ? set.sample : ""} aria-label="Sampler sound file" onChange={(e) => { if (e.target.value) onChange({ ...set, sample: e.target.value }); }}>{!here && <option value="">(choose a sound)</option>}{samples.map((s) => <option key={s.id} value={s.id}>{s.name}</option>)}</select>
        </div>
        <div className="dev-params">
          {knob("root", "root")}{knob("tune", "tune")}
          <div className="dev-switches">
            <button className={`dev-sw${set.mode === "oneshot" ? " on" : ""}`} aria-pressed={set.mode === "oneshot"} onClick={() => onChange({ ...set, mode: set.mode === "oneshot" ? "classic" : "oneshot" })} title="One-shot: the whole stretch plays however short the key press. Off: the note lasts as long as the key is held.">One-shot</button>
            <button className={`dev-sw${set.loop ? " on" : ""}`} aria-pressed={set.loop} disabled={set.mode === "oneshot"} onClick={() => onChange({ ...set, loop: !set.loop })} title="Go round the used stretch again and again while the key is held">Loop</button>
          </div>
          {knob("start", "start")}{knob("length", "length")}{knob("level", "level")}
          {knob("attack", "attack")}{knob("release", "release")}
        </div>
      </div>
    </section>
  );
}
