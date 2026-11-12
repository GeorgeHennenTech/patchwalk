import { useState } from "react";
import type { Card } from "../lesson/cards";
import { runSelfTest, type SelfTestReport } from "../lesson/selftest";
import { Badge } from "./Badge";

export function SelfTest({ cards }: { cards: Card[] }) {
  const [state, setState] = useState<"idle" | "running" | SelfTestReport>("idle");
  const report = typeof state === "object" ? state : undefined;
  const summary = report ? [`Explanation service test: ${report.ok ? "PASS" : "FAIL"}`, report.headline, ...report.details].join("\n") : "";

  return (
    <section className="panel selftest">
      <div className="toolbar">
        <h2>Explanation service</h2>
        <span className="spacer" />
        <button className="primary" disabled={state === "running"} onClick={async () => { setState("running"); setState(await runSelfTest(cards)); }}>
          {state === "running" ? "Testing… (up to a minute)" : "Run test"}
        </button>
      </div>
      <p className="muted">Sends one small built-in step to the narrator to check that “Explain why” works end to end. No preset is needed or sent. Each run is one paid Claude call.</p>
      {report && (
        <div className="selftest-result">
          <p><Badge kind={report.ok ? "ok" : "bad"}>{report.ok ? "pass" : "fail"}</Badge> <strong>{report.headline}</strong></p>
          <ul>{report.details.map((d) => <li key={d}>{d}</li>)}</ul>
          {report.sample && (
            <div className="why">
              <p className="lead">{report.sample.do}</p>
              <p><strong>Why it works.</strong> {report.sample.why}</p>
              <p><strong>Listen for.</strong> {report.sample.listen_for}</p>
            </div>
          )}
          <button className="link" onClick={() => navigator.clipboard?.writeText(summary).catch(() => {})}>Copy this result</button>
        </div>
      )}
    </section>
  );
}
