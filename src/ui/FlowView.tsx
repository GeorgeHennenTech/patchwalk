import type { FlowGraph } from "../flow/facts";
import { ModMap } from "./Diagrams";

function Lane({ title, items, empty }: { title: string; items: { id: string; label: string; sub?: string }[]; empty: string }) {
  return (
    <div className="lane">
      <div className="lane-title">{title}</div>
      <div className="lane-items">
        {items.length ? items.map((i) => <div key={i.id} className="node">{i.label}{i.sub && <small>{i.sub}</small>}</div>) : <div className="node ghost">{empty}</div>}
      </div>
    </div>
  );
}

export function FlowView({ graph }: { graph: FlowGraph }) {
  return (
    <div>
      <div className="flow">
        <Lane title="Sources" items={graph.sources} empty="none" />
        <div className="arrow" aria-hidden>→</div>
        <Lane title="Filters" items={graph.filters.map((f) => ({ ...f, sub: f.type }))} empty="bypassed" />
        <div className="arrow" aria-hidden>→</div>
        <Lane title="FX rack (in order)" items={graph.fx.map((f, i) => ({ ...f, label: `${i + 1}. ${f.label}` }))} empty="empty" />
        <div className="arrow" aria-hidden>→</div>
        <Lane title="Out" items={[{ id: "out", label: "Output" }]} empty="" />
      </div>
      <h3 className="sub">Modulation</h3>
      <div className="scroll-x"><ModMap mods={graph.mods} /></div>
      {graph.mods.length ? (
        <table className="grid">
          <thead><tr><th>Source</th><th>Destination</th><th>Amount</th></tr></thead>
          <tbody>{graph.mods.map((m, i) => <tr key={i}><td>{m.from}</td><td>{m.to}</td><td>{m.amount ?? "factory default"}</td></tr>)}</tbody>
        </table>
      ) : <p className="muted">No modulation routes.</p>}
      {graph.caveats.map((c) => <p key={c} className="note">{c}</p>)}
    </div>
  );
}
