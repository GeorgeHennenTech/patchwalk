import { useState } from "react";
import { resolveParam } from "../display/registry";
import type { Analysis } from "../flow/build";
import { nodeLabel } from "../patch/labels";
import { byNaturalId } from "../patch/model";
import { Badge } from "./Badge";

const KIND = { active: "ok", disabled: "muted", unused: "muted", untouched: "muted" } as const;

export function ModulesView({ analysis }: { analysis: Analysis }) {
  const [showAll, setShowAll] = useState(false);
  const rows = analysis.diffs
    .filter((d) => {
      const a = analysis.activity.get(d.node.id);
      if (a === "untouched") return false;
      return showAll || a === "active";
    })
    .filter((d) => d.params.length || d.extras.length || !d.inInit || analysis.activity.get(d.node.id) === "active")
    .sort((a, b) => byNaturalId(a.node, b.node));
  const hidden = [...analysis.activity.values()].filter((a) => a === "disabled" || a === "unused").length;
  const untouched = [...analysis.activity.values()].filter((a) => a === "untouched").length;

  return (
    <div>
      <div className="toolbar">
        <span>{rows.length} modules shown. {untouched} identical to Init are hidden.</span>
        <span className="spacer" />
        <label className="check"><input type="checkbox" checked={showAll} onChange={(e) => setShowAll(e.target.checked)} /> Show {hidden} disabled or unused</label>
      </div>
      <table className="grid">
        <thead><tr><th>Module</th><th>State</th><th>Differs from Init</th></tr></thead>
        <tbody>
          {rows.map((d) => {
            const a = analysis.activity.get(d.node.id)!;
            return (
              <tr key={d.node.id} className={a === "active" ? "" : "dim"}>
                <td><strong>{nodeLabel(d.node)}</strong><div className="mono muted">{d.node.id}</div></td>
                <td><Badge kind={KIND[a]}>{a}</Badge></td>
                <td>
                  {d.params.length === 0 && d.extras.length === 0 && <span className="muted">{d.inInit ? "nothing (on by default)" : "added; all settings at factory default"}</span>}
                  {d.params.map((p) => {
                    const r = p.value === undefined ? undefined : resolveParam(d.node.type, p.param, p.value);
                    return (
                      <div key={p.param} className="kv">
                        <span>{r?.label ?? resolveParam(d.node.type, p.param, p.init!).label}</span>
                        <span className="mono">{r ? r.display.text : "factory default"}</span>
                        <span className="muted mono">{p.param} = {p.value === undefined ? "(not stored)" : String(typeof p.value === "number" ? Number(p.value.toPrecision(6)) : p.value)}</span>
                      </div>
                    );
                  })}
                  {d.extras.map((e) => <div key={e.key} className="kv"><span>{e.key}</span><span className="muted">changed</span><span /></div>)}
                </td>
              </tr>
            );
          })}
        </tbody>
      </table>
      <p className="note">On/off state is inferred: modules that are off in Init store an enable flag when switched on. “Unused” means an envelope, LFO or macro that no modulation route listens to.</p>
    </div>
  );
}
