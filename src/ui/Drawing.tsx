// The pictures behind "Draw this". The guide chose the kind and the settings; everything here is drawn by
// the app from those settings, and the sliders let the learner move them. Nothing on this page is a picture
// from a book, and it says so.
import { useMemo, useState } from "react";
import { place, sweep, waveHarmonics, type DrawVar, type Drawing } from "../library/draw";
import { compile } from "../library/formula";
import { filterResponseDb } from "../synth/filter";
import { lfoValue } from "../synth/mod";
import { INITIAL, type SynthState } from "../synth/params";

const W = 520, H = 240, L = 54, R = 12, T = 12, B = 34, PW = W - L - R, PH = H - T - B;
/** A number short enough to read at a glance. */
export function short(v: number): string {
  if (!Number.isFinite(v)) return "–";
  const a = Math.abs(v);
  if (a === 0) return "0";
  if (a >= 100000 || a < 0.001) return v.toExponential(2);
  return String(Number(v.toPrecision(a >= 100 ? 4 : 3)));
}
const withUnit = (v: number, unit: string) => `${short(v)}${unit ? ` ${unit}` : ""}`;

function Sliders({ vars, values, set }: { vars: DrawVar[]; values: Record<string, number>; set: (name: string, v: number) => void }) {
  return (
    <div className="draw-sliders">
      {vars.map((v) => (
        <label key={v.name}>
          <span className="draw-var"><b>{v.label}</b>{v.name !== v.label.toLowerCase() && <i> {v.name}</i>} <span className={`draw-origin${v.stated ? " stated" : ""}`}>{v.stated ? "starts at the text’s value" : "starts at the guide’s choice"}</span></span>
          <input type="range" min={0} max={1000} value={Math.round(place(v, values[v.name]!) * 1000)} onChange={(e) => set(v.name, sweep(v, Number(e.target.value) / 1000))} aria-label={`${v.label}${v.unit ? `, in ${v.unit}` : ""}`} />
          <output>{withUnit(values[v.name]!, v.unit)}</output>
        </label>
      ))}
    </div>
  );
}

/** A curve inside the plot area, from points given as fractions (x 0..1 across, y 0..1 up); gaps where y is not a number. */
function path(points: [number, number][]): string {
  let d = "", pen = false;
  for (const [x, y] of points) {
    if (!Number.isFinite(y)) { pen = false; continue; }
    d += `${pen ? "L" : "M"}${(L + x * PW).toFixed(1)} ${(T + (1 - Math.min(1.05, Math.max(-0.05, y))) * PH).toFixed(1)} `;
    pen = true;
  }
  return d;
}
function Frame({ children, xLabel, yLabel, x0, x1, y0, y1, label }: { children: React.ReactNode; xLabel: string; yLabel: string; x0: string; x1: string; y0: string; y1: string; label: string }) {
  return (
    <svg className="draw-plot" viewBox={`0 0 ${W} ${H}`} role="img" aria-label={label}>
      <rect x={L} y={T} width={PW} height={PH} className="draw-area" />
      {[0.25, 0.5, 0.75].map((f) => <g key={f}><line x1={L + f * PW} x2={L + f * PW} y1={T} y2={T + PH} className="draw-grid" /><line x1={L} x2={L + PW} y1={T + f * PH} y2={T + f * PH} className="draw-grid" /></g>)}
      {children}
      <text x={L} y={H - 18} className="draw-tick">{x0}</text><text x={L + PW} y={H - 18} textAnchor="end" className="draw-tick">{x1}</text>
      <text x={L + PW / 2} y={H - 4} textAnchor="middle" className="draw-axis">{xLabel}</text>
      <text x={L - 6} y={T + PH} textAnchor="end" className="draw-tick">{y0}</text><text x={L - 6} y={T + 9} textAnchor="end" className="draw-tick">{y1}</text>
      <text x={12} y={T + PH / 2} textAnchor="middle" transform={`rotate(-90 12 ${T + PH / 2})`} className="draw-axis">{yLabel}</text>
    </svg>
  );
}

function FormulaPlot({ d }: { d: Drawing }) {
  const [values, setValues] = useState(() => Object.fromEntries(d.variables.map((v) => [v.name, v.value])));
  const [x, setX] = useState(d.x ?? d.variables[0]!.name);
  const read = useMemo(() => compile(d.expression ?? "", d.variables.map((v) => v.name)), [d]);
  if (!read.ok) return <p className="note">This formula could not be drawn: {read.reason}.</p>;
  const xv = d.variables.find((v) => v.name === x)!, N = 160;
  const ys = Array.from({ length: N + 1 }, (_, i) => read.fn({ ...values, [x]: sweep(xv, i / N) }));
  const real = ys.filter(Number.isFinite);
  let lo = Math.min(...real), hi = Math.max(...real);
  if (!(hi > lo)) { const pad = Math.abs(lo) * 0.1 || 1; lo -= pad; hi += pad; }
  const now = read.fn(values), at = place(xv, values[x]!);
  return (
    <>
      <p className="draw-formula"><span>{d.output!.label}</span> = <code>{d.expression}</code></p>
      <Frame label={`${d.output!.label} against ${xv.label}`} xLabel={`${xv.label}${xv.unit ? ` (${xv.unit})` : ""}${xv.log ? ", evenly spaced by ratio" : ""}`} yLabel={`${d.output!.label}${d.output!.unit ? ` (${d.output!.unit})` : ""}`} x0={short(xv.min)} x1={short(xv.max)} y0={short(lo)} y1={short(hi)}>
        <path d={path(ys.map((y, i) => [i / N, (y - lo) / (hi - lo)]))} className="draw-curve" />
        {Number.isFinite(now) && <><line x1={L + at * PW} x2={L + at * PW} y1={T} y2={T + PH} className="draw-now" /><circle cx={L + at * PW} cy={T + (1 - (now - lo) / (hi - lo)) * PH} r="5" className="draw-dot" /></>}
      </Frame>
      <p className="draw-readout" role="status">With these values, {d.output!.label.toLowerCase()} = <strong>{withUnit(now, d.output!.unit)}</strong></p>
      {d.variables.length > 1 && (
        <p className="draw-across">Along the bottom: {d.variables.map((v) => <button key={v.name} className={v.name === x ? "on" : ""} aria-pressed={v.name === x} onClick={() => setX(v.name)}>{v.label}</button>)}</p>
      )}
      <Sliders vars={d.variables} values={values} set={(name, v) => setValues((o) => ({ ...o, [name]: v }))} />
    </>
  );
}

function Ready({ d }: { d: Drawing }) {
  const [values, setValues] = useState(() => Object.fromEntries(d.variables.map((v) => [v.name, v.value])));
  const set = (name: string, v: number) => setValues((o) => ({ ...o, [name]: v }));
  let picture: React.ReactNode = null;
  if (d.kind === "envelope") {
    const { attack = 0, decay = 0, sustain = 0, release = 0 } = values, hold = Math.max(200, (attack + decay + release) * 0.35), total = attack + decay + hold + release || 1, s = sustain / 100;
    const xs = [0, attack, attack + decay, attack + decay + hold, total].map((t) => t / total);
    picture = (
      <Frame label="The level over one note" xLabel="time (key held, then let go)" yLabel="level" x0="key down" x1={withUnit(total, "ms")} y0="0" y1="full">
        <line x1={L + xs[3]! * PW} x2={L + xs[3]! * PW} y1={T} y2={T + PH} className="draw-now" />
        <path d={path([[xs[0]!, 0], [xs[1]!, 1], [xs[2]!, s], [xs[3]!, s], [xs[4]!, 0]])} className="draw-curve" />
        <text x={L + xs[3]! * PW + 4} y={T + 12} className="draw-tick">key up</text>
      </Frame>
    );
  } else if (d.kind === "filter") {
    const state: SynthState = { ...INITIAL, filterOn: true, filterType: d.choice as SynthState["filterType"], cutoff: values.cutoff!, resonance: values.resonance! };
    const N = 180, lo = -48, hi = 24;
    picture = (
      <Frame label={`A ${d.choice}-pass filter's curve`} xLabel="frequency (Hz), evenly spaced by ratio" yLabel="level (dB)" x0="20" x1="20000" y0={String(lo)} y1={`+${hi}`}>
        <line x1={L} x2={L + PW} y1={T + (1 - (0 - lo) / (hi - lo)) * PH} y2={T + (1 - (0 - lo) / (hi - lo)) * PH} className="draw-now" />
        <path d={path(Array.from({ length: N + 1 }, (_, i) => [i / N, (Math.max(lo, filterResponseDb(state, 20 * 1000 ** (i / N), null)) - lo) / (hi - lo)] as [number, number]))} className="draw-curve" />
      </Frame>
    );
  } else if (d.kind === "harmonics") {
    const levels = waveHarmonics(d.choice ?? "saw");
    picture = (
      <Frame label={`The harmonics of a ${d.choice} wave`} xLabel="harmonic number" yLabel="level" x0="1" x1={String(levels.length)} y0="0" y1="1">
        {levels.map((v, i) => <rect key={i} x={L + (i / levels.length) * PW + 4} width={PW / levels.length - 8} y={T + (1 - v) * PH} height={Math.max(1, v * PH)} className={`draw-bar${v === 0 ? " none" : ""}`} />)}
      </Frame>
    );
  } else if (d.kind === "lfo") {
    const rate = values.rate!, N = 400, shape = d.choice as SynthState["lfo1Shape"];
    picture = (
      <Frame label={`A ${d.choice} movement at ${short(rate)} times a second`} xLabel="time" yLabel="how far it pushes" x0="0" x1="1 second" y0="down" y1="up">
        <line x1={L} x2={L + PW} y1={T + PH / 2} y2={T + PH / 2} className="draw-now" />
        <path d={path(Array.from({ length: N + 1 }, (_, i) => [i / N, 0.5 + 0.46 * lfoValue(shape, (i / N) * rate)] as [number, number]))} className="draw-curve" />
      </Frame>
    );
  } else if (d.kind === "chain") {
    const stages = d.stages ?? [];
    picture = <ol className="draw-chain" aria-label="The order the sound passes through">{stages.map((s, i) => <li key={i}>{s}</li>)}</ol>;
  }
  return <>{picture}{d.variables.length > 0 && <Sliders vars={d.variables} values={values} set={set} />}</>;
}

export function DrawingView({ drawing }: { drawing: Drawing }) {
  if (drawing.kind === "none") return <p className="note">No drawing for this step. {drawing.caption}</p>;
  return (
    <figure className="drawing">
      <figcaption className="draw-head"><span className="draw-tag">The guide’s drawing</span> <strong>{drawing.title}</strong></figcaption>
      {drawing.kind === "formula" ? <FormulaPlot d={drawing} /> : <Ready d={drawing} />}
      {drawing.caption && <p className="draw-caption">{drawing.caption}</p>}
      <p className="note">Drawn by the app from settings the guide chose: it is not a picture from a book. {drawing.variables.length > 0 && "Each slider says whether it starts at a value the step’s text states or at one the guide picked; how far a slider can travel is always the guide’s choice. "}{drawing.remembered && "Shown from the site’s memory, with no new call."}</p>
    </figure>
  );
}
