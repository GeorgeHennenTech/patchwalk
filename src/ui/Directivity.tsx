// Two charts a sound-system engineer reads, drawn by code from the maker's measurements: a polar plot of one
// band (how the level falls as you move off to the side, and up and down), and beamwidth against frequency.
import { BANDS, level } from "../soundsystems/directivity";

const ACROSS = "#c2185b", UPDOWN = "#1565c0";
/** One band as a polar plot: straight ahead is up; rings are 6 dB apart; the outer ring is the level straight ahead. */
export function PolarPlot({ band }: { band: number }) {
  const R = 118, C = 140, FLOOR = -30, r = (db: number) => (Math.max(FLOOR, Math.min(3, db)) - FLOOR) / -FLOOR * R;
  const curve = (phi: number) => Array.from({ length: 73 }, (_, i) => { const deg = -180 + i * 5, d = level(band, Math.abs(deg), deg < 0 ? phi + 180 : phi), a = (deg * Math.PI) / 180; return `${(C + r(d) * Math.sin(a)).toFixed(1)},${(C - r(d) * Math.cos(a)).toFixed(1)}`; }).join(" ");
  return (
    <figure className="dir-chart">
      <svg viewBox="0 0 280 290" role="img" aria-label={`Polar plot of the ${BANDS[band]!.hz} hertz band: level against direction, side to side and up and down`}>
        {[0, -6, -12, -18, -24].map((db) => <g key={db}><circle cx={C} cy={C} r={r(db)} className="dir-ring" /><text x={C + 3} y={C - r(db) + 11} className="dir-tick">{db === 0 ? "0 dB" : db}</text></g>)}
        {[0, 30, 60, 90, 120, 150].map((a) => { const x = Math.sin((a * Math.PI) / 180) * R, y = Math.cos((a * Math.PI) / 180) * R; return <line key={a} x1={C - x} y1={C + y} x2={C + x} y2={C - y} className="dir-spoke" />; })}
        {[["0°", 0], ["30°", 30], ["60°", 60], ["90°", 90], ["30°", -30], ["60°", -60], ["90°", -90], ["180°", 180]].map(([t, a]) => <text key={`${a}`} x={C + Math.sin((Number(a) * Math.PI) / 180) * (R + 13)} y={C - Math.cos((Number(a) * Math.PI) / 180) * (R + 13) + 4} textAnchor="middle" className="dir-tick">{t}</text>)}
        <polygon points={curve(90)} fill="none" stroke={ACROSS} strokeWidth="2.2" />
        <polygon points={curve(0)} fill="none" stroke={UPDOWN} strokeWidth="2.2" strokeDasharray="5 3" />
      </svg>
      <figcaption><b style={{ color: ACROSS }}>━ side to side</b> · <b style={{ color: UPDOWN }}>╍ up and down</b>. Straight ahead is at the top; each ring is 6 dB quieter.</figcaption>
    </figure>
  );
}

/** Beamwidth (the angle between the two directions that are 6 dB down) for every band, with the sheet's stated 50 and 25 degrees for comparison. */
export function BeamwidthChart({ band, nominal }: { band: number | undefined; nominal: { across: number; upDown: number } }) {
  const W = 420, H = 250, L = 44, B = 34, T = 12, x = (i: number) => L + (i / (BANDS.length - 1)) * (W - L - 12), y = (deg: number) => T + (1 - Math.min(180, deg) / 180) * (H - T - B);
  const line = (k: "across" | "upDown") => BANDS.map((b, i) => `${x(i).toFixed(1)},${y(b[k]).toFixed(1)}`).join(" ");
  return (
    <figure className="dir-chart">
      <svg viewBox={`0 0 ${W} ${H}`} role="img" aria-label="Beamwidth against frequency: how wide the sound spreads, side to side and up and down, in each band">
        {[0, 30, 60, 90, 120, 150, 180].map((d) => <g key={d}><line x1={L} y1={y(d)} x2={W - 12} y2={y(d)} className="dir-ring" /><text x={L - 6} y={y(d) + 4} textAnchor="end" className="dir-tick">{d}°</text></g>)}
        {BANDS.map((b, i) => (i % 3 === 0 || i === BANDS.length - 1) && <text key={b.hz} x={x(i)} y={H - 14} textAnchor="middle" className="dir-tick">{b.hz >= 1000 ? `${b.hz / 1000}k` : b.hz}</text>)}
        <line x1={L} y1={y(nominal.across)} x2={W - 12} y2={y(nominal.across)} stroke={ACROSS} strokeDasharray="2 4" /><line x1={L} y1={y(nominal.upDown)} x2={W - 12} y2={y(nominal.upDown)} stroke={UPDOWN} strokeDasharray="2 4" />
        <polyline points={line("across")} fill="none" stroke={ACROSS} strokeWidth="2.2" /><polyline points={line("upDown")} fill="none" stroke={UPDOWN} strokeWidth="2.2" strokeDasharray="5 3" />
        {band !== undefined && <line x1={x(band)} y1={T} x2={x(band)} y2={H - B} className="dir-now" />}
        <text x={W - 14} y={H - 1} textAnchor="end" className="dir-tick">Hz</text>
      </svg>
      <figcaption><b style={{ color: ACROSS }}>━ side to side</b> · <b style={{ color: UPDOWN }}>╍ up and down</b>. Dotted lines: the sheet’s stated 50° and 25°. At 180° or more the sound is going nearly everywhere.</figcaption>
    </figure>
  );
}
