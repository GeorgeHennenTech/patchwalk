import { useEffect, useRef } from "react";
import { PARAMS, type SynthState } from "../../synth/params";
import { KEY_MAP, type Synth } from "../../synth/useSynth";

const fmt = (id: string, v: number) => {
  const unit = PARAMS[id]!.unit ?? "";
  if (id === "freeHz") return `${Math.round(v)} Hz`;
  if (id === "cutoff") return v >= 1000 ? `${(v / 1000).toFixed(v >= 10000 ? 1 : 2)} kHz` : `${Math.round(v)} Hz`;
  const signed = ["octave", "semitone", "fine", "bOctave", "bSemitone", "bFine"].includes(id) && v > 0 ? "+" : "";
  return `${signed}${v}${unit === "%" || unit === "°" ? unit : unit ? ` ${unit}` : ""}`;
};

/** One control for any setting: a slider, a set of choices, or an on/off switch, from its spec. */
export function Control({ id, synth, spot, only }: { id: keyof SynthState; synth: Synth; spot: boolean; only?: readonly string[] }) {
  const spec = PARAMS[id]!;
  const cls = `ctl${spot ? " spot" : ""}`;
  if (spec.kind === "toggle") {
    return (
      <label className={`${cls} toggle`}>
        <input type="checkbox" checked={!!synth.state[id]} onChange={(e) => synth.setState({ [id]: e.target.checked } as Partial<SynthState>)} />
        <span className="ctl-name">{spec.label}</span>
      </label>
    );
  }
  if (spec.kind === "choice") {
    const two = id === "shape" && only?.length === 2;
    const names: Record<string, string> = two ? { sine: "Pure tone", saw: "Bright tone" } : (spec.names ?? {});
    return (
      <div className={cls}>
        <span className="ctl-name">{two ? "Tone" : spec.label}</span>
        <div className="seg" role="radiogroup" aria-label={spec.label}>
          {(id === "shape" && only ? only : spec.choices!).map((c) => (
            <button key={c} role="radio" aria-checked={synth.state[id] === c} className={synth.state[id] === c ? "on" : ""} onClick={() => synth.setState({ [id]: c } as Partial<SynthState>)}>{names[c] ?? c}</button>
          ))}
        </div>
      </div>
    );
  }
  const value = (synth.state[id] ?? spec.min!) as number;
  // Log sliders work in octaves so equal drags sound like equal steps.
  const toPos = (v: number) => (spec.log ? (Math.log2(v / spec.min!) / Math.log2(spec.max! / spec.min!)) * 1000 : v);
  const fromPos = (pos: number) => (spec.log ? Math.round(spec.min! * 2 ** ((pos / 1000) * Math.log2(spec.max! / spec.min!))) : pos);
  return (
    <label className={cls}>
      <span className="ctl-name">{spec.label}</span>
      <input type="range" min={spec.log ? 0 : spec.min} max={spec.log ? 1000 : spec.max} step={spec.log ? 1 : spec.step} value={toPos(value)}
        onChange={(e) => synth.setState({ [id]: fromPos(Number(e.target.value)) } as Partial<SynthState>)} aria-valuetext={fmt(id, value)} />
      <output>{fmt(id, value)}</output>
    </label>
  );
}

const WHITE = [0, 2, 4, 5, 7, 9, 11];
const LABEL = Object.fromEntries(Object.entries(KEY_MAP).map(([k, n]) => [n, k.toUpperCase()]));

export function Keyboard({ synth, from = 48, octaves = 3 }: { synth: Synth; from?: number; octaves?: number }) {
  const pressed = useRef<number | null>(null);
  const notes = Array.from({ length: octaves * 12 + 1 }, (_, i) => from + i);
  const whites = notes.filter((n) => WHITE.includes(n % 12));
  const release = () => { if (pressed.current !== null) { synth.noteOff(pressed.current); pressed.current = null; } };
  useEffect(() => { window.addEventListener("pointerup", release); return () => window.removeEventListener("pointerup", release); });
  const press = (n: number) => { release(); pressed.current = n; synth.noteOn(n, "mouse"); };
  return (
    <div className={`keys${synth.running ? "" : " off"}`} role="group" aria-label="Keyboard">
      {whites.map((n, i) => {
        const black = notes.includes(n + 1) && !WHITE.includes((n + 1) % 12) ? n + 1 : null;
        return (
          <div key={n} className="key-slot" style={{ width: `${100 / whites.length}%` }}>
            <button className={`key white${synth.held.includes(n) ? " down" : ""}`} onPointerDown={() => press(n)} aria-label={`Note ${n}`}>{LABEL[n] && <span>{LABEL[n]}</span>}{n % 12 === 0 && <em>C{n / 12 - 1}</em>}</button>
            {black !== null && i < whites.length - 1 && (
              <button className={`key black${synth.held.includes(black) ? " down" : ""}`} onPointerDown={() => press(black)} aria-label={`Note ${black}`}>{LABEL[black] && <span>{LABEL[black]}</span>}</button>
            )}
          </div>
        );
      })}
    </div>
  );
}
