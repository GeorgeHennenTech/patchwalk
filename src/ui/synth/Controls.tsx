import { useEffect, useRef } from "react";
import { PARAMS, SHAPES, type SynthState } from "../../synth/params";
import { KEY_MAP, type Synth } from "../../synth/useSynth";

const fmt = (id: string, v: number) => (id === "freeHz" ? `${Math.round(v)} Hz` : `${v > 0 && id !== "volumeDb" && id !== "freeHz" ? "+" : ""}${v} ${PARAMS[id]!.unit}`);

export function Slider({ id, synth, spot }: { id: keyof SynthState; synth: Synth; spot: boolean }) {
  const spec = PARAMS[id]!;
  const value = (synth.state[id] ?? spec.min!) as number;
  // Log sliders work in octaves so equal drags sound like equal steps.
  const toPos = (v: number) => (spec.log ? Math.log2(v / spec.min!) / Math.log2(spec.max! / spec.min!) * 1000 : v);
  const fromPos = (p: number) => (spec.log ? Math.round(spec.min! * 2 ** ((p / 1000) * Math.log2(spec.max! / spec.min!))) : p);
  return (
    <label className={`ctl${spot ? " spot" : ""}`}>
      <span className="ctl-name">{spec.label}</span>
      <input type="range" min={spec.log ? 0 : spec.min} max={spec.log ? 1000 : spec.max} step={spec.log ? 1 : spec.step} value={toPos(value)}
        onChange={(e) => synth.setState({ [id]: fromPos(Number(e.target.value)) } as Partial<SynthState>)} aria-valuetext={fmt(id, value)} />
      <output>{fmt(id, value)}</output>
    </label>
  );
}

export function ShapePicker({ synth, spot, only }: { synth: Synth; spot: boolean; only?: readonly string[] }) {
  const names: Record<string, string> = only?.length === 2 ? { sine: "Pure tone", saw: "Bright tone" } : { sine: "Sine", triangle: "Triangle", square: "Square", saw: "Saw" };
  return (
    <div className={`ctl${spot ? " spot" : ""}`}>
      <span className="ctl-name">{only?.length === 2 ? "Tone" : "Wave shape"}</span>
      <div className="seg" role="radiogroup" aria-label="Wave shape">
        {(only ?? SHAPES).map((s) => (
          <button key={s} role="radio" aria-checked={synth.state.shape === s} className={synth.state.shape === s ? "on" : ""} onClick={() => synth.setState({ shape: s as SynthState["shape"] })}>{names[s]}</button>
        ))}
      </div>
    </div>
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
