import type { Diagram } from "../flow/diagrams";
import type { FlowGraph } from "../flow/facts";

const PAD = 6;

export function DiagramView({ d }: { d: Diagram }) {
  const labelH = d.kind === "envelope" ? 18 : 0;
  return (
    <figure className="diagram">
      <svg viewBox={`${-PAD} ${-PAD} ${d.width + PAD * 2} ${d.height + PAD * 2 + labelH}`} role="img" aria-label={d.title} style={{ maxWidth: Math.max(260, d.width * 1.6) }}>
        <line x1={0} y1={d.height} x2={d.width} y2={d.height} className="axis" />
        {d.kind === "envelope"
          ? d.segments.map((s) => (
              <g key={s.name}>
                <line x1={s.from[0]} y1={s.from[1]} x2={s.to[0]} y2={s.to[1]} className={s.isDefault ? "trace dashed" : "trace"} />
                <line x1={s.to[0]} y1={0} x2={s.to[0]} y2={d.height} className="tick" />
                <text x={(s.from[0] + s.to[0]) / 2} y={d.height + 13} textAnchor="middle" className={s.isDefault ? "lbl dim" : "lbl"}>{s.label}</text>
              </g>
            ))
          : <polyline points={d.points.map((p) => p.join(",")).join(" ")} className="trace" fill="none" />}
      </svg>
      <figcaption><strong>{d.title}.</strong> {d.caption}</figcaption>
    </figure>
  );
}

/** Sources on the left, destinations on the right, one line per route. Line weight follows the amount. */
export function ModMap({ mods }: { mods: FlowGraph["mods"] }) {
  if (!mods.length) return null;
  const from = [...new Set(mods.map((m) => m.from))];
  const to = [...new Set(mods.map((m) => m.to))];
  const ROW = 26, W = 640, COL = 215;
  const h = Math.max(from.length, to.length) * ROW + 8;
  const y = (i: number, n: number) => ((i + 0.5) * (h - 8)) / n + 4;
  return (
    <figure className="diagram">
      <svg viewBox={`0 0 ${W} ${h}`} role="img" aria-label="Modulation map" style={{ maxWidth: W, minWidth: 480 }}>
        {mods.map((m, i) => {
          const y1 = y(from.indexOf(m.from), from.length), y2 = y(to.indexOf(m.to), to.length);
          const amt = Math.abs(parseFloat(m.amount ?? ""));
          const neg = (m.amount ?? "").trim().startsWith("-");
          return <path key={i} d={`M ${COL} ${y1} C ${W / 2} ${y1}, ${W / 2} ${y2}, ${W - COL} ${y2}`} className={neg ? "wire neg" : "wire"} strokeWidth={Number.isFinite(amt) ? 0.8 + (amt / 100) * 2.4 : 1} strokeDasharray={Number.isFinite(amt) ? undefined : "3 3"} fill="none" />;
        })}
        {from.map((f, i) => <text key={f} x={COL - 8} y={y(i, from.length) + 4} textAnchor="end" className="lbl">{f.length > 30 ? f.slice(0, 29) + "…" : f}</text>)}
        {to.map((t, i) => <text key={t} x={W - COL + 8} y={y(i, to.length) + 4} className="lbl">{t.length > 30 ? t.slice(0, 29) + "…" : t}</text>)}
      </svg>
      <figcaption><strong>Modulation map.</strong> Thicker lines are larger amounts; dotted lines are routes left at the factory default amount; a second colour marks negative amounts.</figcaption>
    </figure>
  );
}
