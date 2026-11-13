import { useEffect, useRef } from "react";
import { INITIAL, PARAMS, type ParamSpec, type SynthState } from "../../synth/params";
import { KEY_MAP, type Synth } from "../../synth/useSynth";

const fmt = (id: string, v: number) => {
  const unit = PARAMS[id]!.unit ?? "";
  if (id === "freeHz") return `${Math.round(v)} Hz`;
  if (id === "cutoff") return v >= 1000 ? `${(v / 1000).toFixed(v >= 10000 ? 1 : 2)} kHz` : `${Math.round(v)} Hz`;
  const signed = ["octave", "semitone", "fine", "bOctave", "bSemitone", "bFine"].includes(id) && v > 0 ? "+" : "";
  return `${signed}${v}${unit === "%" || unit === "°" ? unit : unit ? ` ${unit}` : ""}`;
};

/** The name printed under a control. Its module panel already says which oscillator or section it belongs to. */
export const shortLabel = (label: string) => label.replace(/^(A|B|Sub|Noise|Filter|Wave) /, "");

/** Settings shown as a small number box (a few whole steps) and not as a knob. */
const BOXES = new Set<keyof SynthState>(["octave", "semitone", "bOctave", "bSemitone", "voices", "subOctave"]);
export const isBox = (id: keyof SynthState) => BOXES.has(id);

const clamp01 = (x: number) => Math.min(1, Math.max(0, x));
/** A setting's value as a position from 0 to 1 along its travel, and back. Wide-ranging ones travel in octaves. */
export function toTravel(spec: ParamSpec, v: number): number {
  return clamp01(spec.log ? Math.log(v / spec.min!) / Math.log(spec.max! / spec.min!) : (v - spec.min!) / (spec.max! - spec.min!));
}
export function fromTravel(spec: ParamSpec, t: number): number {
  const raw = spec.log ? spec.min! * (spec.max! / spec.min!) ** clamp01(t) : spec.min! + clamp01(t) * (spec.max! - spec.min!);
  const step = spec.step ?? 1;
  return Math.min(spec.max!, Math.max(spec.min!, Math.round(raw / step) * step));
}
/** One press of an arrow key: the smallest step, or about 1% for wide-ranging settings. `big` is ten times that. */
export function nudge(spec: ParamSpec, v: number, dir: 1 | -1, big: boolean): number {
  const step = spec.step ?? 1;
  const size = spec.log ? Math.max(step, Math.round((v * (big ? 0.1 : 0.01)) / step) * step) : step * (big ? 10 : 1);
  return Math.min(spec.max!, Math.max(spec.min!, v + dir * size));
}

const SWEEP = 270; // degrees a knob turns from minimum to maximum
const point = (deg: number, r: number) => { const a = ((deg - 90) * Math.PI) / 180; return `${(24 + r * Math.cos(a)).toFixed(2)} ${(24 + r * Math.sin(a)).toFixed(2)}`; };
const arc = (from: number, to: number, r: number) => {
  const [a, b] = from <= to ? [from, to] : [to, from];
  return `M ${point(a, r)} A ${r} ${r} 0 ${b - a > 180 ? 1 : 0} 1 ${point(b, r)}`;
};

/**
 * A knob (or, for a few whole-step settings, a number box). Drag up and down to turn it freely; hold Shift
 * while dragging for fine movement. Click it and use the arrow keys for exact steps (Shift or Page Up/Down
 * for bigger ones, Home/End for the ends). Double-click returns it to its starting value.
 */
function Knob({ id, synth, spot }: { id: keyof SynthState; synth: Synth; spot: boolean }) {
  const spec = PARAMS[id]!;
  const value = (synth.state[id] ?? spec.min!) as number;
  const box = isBox(id);
  const drag = useRef<{ y: number; travel: number } | null>(null);
  const set = (v: number) => { if (v !== synth.state[id]) synth.setState({ [id]: v } as Partial<SynthState>); };
  const steps = (spec.max! - spec.min!) / (spec.step ?? 1);
  const pixels = box ? Math.max(60, steps * 14) : 170; // drag distance for the whole travel
  const onKey = (e: React.KeyboardEvent) => {
    const big = e.shiftKey;
    const next = e.key === "ArrowUp" || e.key === "ArrowRight" ? nudge(spec, value, 1, big)
      : e.key === "ArrowDown" || e.key === "ArrowLeft" ? nudge(spec, value, -1, big)
      : e.key === "PageUp" ? nudge(spec, value, 1, true) : e.key === "PageDown" ? nudge(spec, value, -1, true)
      : e.key === "Home" ? spec.min! : e.key === "End" ? spec.max! : null;
    if (next === null) return;
    e.preventDefault();
    set(next);
  };
  const reset = () => { const v = INITIAL[id]; if (typeof v === "number") set(v); };
  const t = toTravel(spec, value);
  const angle = -SWEEP / 2 + t * SWEEP;
  const zero = spec.min! < 0 && spec.max! > 0 ? -SWEEP / 2 + toTravel(spec, 0) * SWEEP : -SWEEP / 2;
  return (
    <div className={`${box ? "nbox" : "knob"}${spot ? " spot" : ""}`} role="slider" tabIndex={0} aria-label={spec.label} aria-orientation="vertical"
      aria-valuemin={spec.min} aria-valuemax={spec.max} aria-valuenow={value} aria-valuetext={fmt(id, value)}
      title={`${spec.label}: drag up or down, or click and use the arrow keys. Double-click to reset.`}
      onKeyDown={onKey} onDoubleClick={reset}
      onPointerDown={(e) => { e.currentTarget.setPointerCapture(e.pointerId); e.currentTarget.focus(); drag.current = { y: e.clientY, travel: t }; }}
      onPointerMove={(e) => {
        if (!drag.current) return;
        const moved = (drag.current.y - e.clientY) / pixels;
        set(fromTravel(spec, drag.current.travel + (e.shiftKey ? moved / 8 : moved)));
      }}
      onPointerUp={() => { drag.current = null; }} onPointerCancel={() => { drag.current = null; }}>
      {!box && (
        <svg viewBox="0 0 48 48" aria-hidden>
          <path className="knob-track" d={arc(-SWEEP / 2, SWEEP / 2, 20)} />
          {angle !== zero && <path className="knob-value" d={arc(zero, angle, 20)} />}
          <circle className="knob-cap" cx="24" cy="24" r="14" />
          <path className="knob-mark" d={`M ${point(angle, 5)} L ${point(angle, 13)}`} />
        </svg>
      )}
      <span className="knob-name">{shortLabel(spec.label)}</span>
      <output>{fmt(id, value)}</output>
    </div>
  );
}

/** One control for any setting: a knob or number box, a set of choices, or an on/off switch, from its spec. */
export function Control({ id, synth, spot, only }: { id: keyof SynthState; synth: Synth; spot: boolean; only?: readonly string[] }) {
  const spec = PARAMS[id]!;
  if (spec.kind === "toggle") {
    return (
      <label className={`ctl toggle${spot ? " spot" : ""}`}>
        <input type="checkbox" checked={!!synth.state[id]} onChange={(e) => synth.setState({ [id]: e.target.checked } as Partial<SynthState>)} />
        <span className="ctl-name">{spec.label}</span>
      </label>
    );
  }
  if (spec.kind === "choice") {
    const two = id === "shape" && only?.length === 2;
    const names: Record<string, string> = two ? { sine: "Pure tone", saw: "Bright tone" } : (spec.names ?? {});
    return (
      <div className={`pick${spot ? " spot" : ""}`}>
        <span className="knob-name">{two ? "Tone" : shortLabel(spec.label)}</span>
        <div className="seg" role="radiogroup" aria-label={spec.label}>
          {(id === "shape" && only ? only : spec.choices!).map((c) => (
            <button key={c} role="radio" aria-checked={synth.state[id] === c} className={synth.state[id] === c ? "on" : ""} onClick={() => synth.setState({ [id]: c } as Partial<SynthState>)}>{names[c] ?? c}</button>
          ))}
        </div>
      </div>
    );
  }
  return <Knob id={id} synth={synth} spot={spot} />;
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
