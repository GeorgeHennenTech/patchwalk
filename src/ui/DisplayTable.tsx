import { allSpecs } from "../display/registry";
import { Badge } from "./Badge";

export function DisplayTable() {
  const specs = allSpecs();
  const count = (s: string) => specs.filter((x) => x.spec.status === s).length;
  return (
    <div>
      <p className="banner">
        Nothing here has been confirmed against Serum’s screen yet. {count("unverified")} entries apply a conversion that is a reasoned guess;
        {" "}{count("raw")} show the stored number as-is because no conversion is known; {count("verified")} are verified.
        See <code>docs/PROBES.md</code> for the presets that would confirm each one.
      </p>
      <table className="grid">
        <thead><tr><th>Module</th><th>Stored name</th><th>Shown as</th><th>Status</th><th>Basis</th></tr></thead>
        <tbody>
          {specs.map(({ moduleType, param, spec }) => (
            <tr key={moduleType + param}>
              <td>{moduleType}</td>
              <td className="mono">{param}</td>
              <td>{spec.label}</td>
              <td><Badge kind={spec.status === "verified" ? "ok" : spec.status === "unverified" ? "warn" : "unknown"}>{spec.status === "raw" ? "stored value" : spec.status}</Badge></td>
              <td className="muted">{spec.basis}</td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}
