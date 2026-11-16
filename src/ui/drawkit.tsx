// The shared pieces every drawing is made from: the plot's size, number formatting, sliders and a framed graph.
import type { DrawVar } from "../library/draw";
import { place, sweep } from "../library/draw";

export const W = 520, H = 240, L = 54, R = 12, T = 12, B = 34, PW = W - L - R, PH = H - T - B;
/** A number short enough to read at a glance. */
export function short(v: number): string {
  if (!Number.isFinite(v)) return "–";
  const a = Math.abs(v);
  if (a === 0) return "0";
  if (a >= 100000 || a < 0.001) return v.toExponential(2);
  return String(Number(v.toPrecision(a >= 100 ? 4 : 3)));
}
export const withUnit = (v: number, unit: string) => `${short(v)}${unit ? ` ${unit}` : ""}`;

export function Sliders({ vars, values, set, symbols }: { vars: DrawVar[]; values: Record<string, number>; set: (name: string, v: number) => void; /** show each setting's symbol beside its name (for a formula) */ symbols?: boolean }) {
  return (
    <div className="draw-sliders">
      {vars.map((v) => (
        <label key={v.name}>
          <span className="draw-var"><b>{v.label}</b>{symbols && v.name !== v.label.toLowerCase() && <i> {v.name}</i>}{v.stated && <span className="draw-origin stated">starts at the text’s value</span>}</span>
          <input type="range" min={0} max={1000} value={Math.round(place(v, values[v.name]!) * 1000)} onChange={(e) => set(v.name, sweep(v, Number(e.target.value) / 1000))} aria-label={`${v.label}${v.unit ? `, in ${v.unit}` : ""}`} />
          <output>{withUnit(values[v.name]!, v.unit)}</output>
        </label>
      ))}
    </div>
  );
}

/** A curve inside the plot area, from points given as fractions (x 0..1 across, y 0..1 up); gaps where y is not a number. */
export function path(points: [number, number][]): string {
  let d = "", pen = false;
  for (const [x, y] of points) {
    if (!Number.isFinite(y)) { pen = false; continue; }
    d += `${pen ? "L" : "M"}${(L + x * PW).toFixed(1)} ${(T + (1 - Math.min(1.05, Math.max(-0.05, y))) * PH).toFixed(1)} `;
    pen = true;
  }
  return d;
}
export function Frame({ children, xLabel, yLabel, x0, x1, y0, y1, label }: { children: React.ReactNode; xLabel: string; yLabel: string; x0: string; x1: string; y0: string; y1: string; label: string }) {
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

