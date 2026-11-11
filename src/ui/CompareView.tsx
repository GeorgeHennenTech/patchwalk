import { useMemo } from "react";
import { compare, tally, type Verdict } from "../compare/compare";
import type { Analysis } from "../flow/build";
import { STAGES } from "../flow/facts";
import { Badge } from "./Badge";
import { DropZone } from "./DropZone";

const KIND: Record<Verdict, "ok" | "info" | "bad" | "warn"> = { match: "ok", close: "info", different: "bad", missing: "bad", extra: "warn" };
const WORD: Record<Verdict, string> = { match: "matches", close: "close", different: "different", missing: "not done yet", extra: "extra" };

export function CompareView({ target, attempt, attemptName, attemptError, onFile }: {
  target: Analysis; attempt?: Analysis; attemptName?: string; attemptError?: string; onFile: (f: File) => void;
}) {
  const steps = useMemo(() => (attempt ? compare(target, attempt) : []), [target, attempt]);
  const t = tally(steps);
  const total = t.match + t.close + t.different + t.missing;
  return (
    <div>
      <DropZone onFile={onFile} compact label={attempt ? "Drop another attempt" : "Drop your attempt (.SerumPreset)"} />
      {attemptError && <p className="banner bad">{attemptError}</p>}
      {!attempt && !attemptError && <p className="muted">Save your version in Serum 2 and drop it here. It is compared with the target in this tab; neither file leaves your browser.</p>}
      {attempt && (
        <>
          <p className="summary">
            <strong>{attemptName}</strong>: {t.match} of {total} target settings match
            {t.close ? `, ${t.close} close` : ""}{t.different ? `, ${t.different} different` : ""}{t.missing ? `, ${t.missing} not done yet` : ""}{t.extra ? `; ${t.extra} extra in yours` : ""}.
          </p>
          {STAGES.map((stage) => {
            const mine = steps.filter((s) => s.stage === stage.id);
            if (!mine.length) return null;
            return (
              <section key={stage.id} className="stage">
                <h3>{stage.title}</h3>
                {mine.map((s) => (
                  <article key={s.id} className="step">
                    <h4>{s.title} <Badge kind={KIND[s.verdict]}>{WORD[s.verdict]}</Badge></h4>
                    <ul className="lines">
                      {s.facts.filter((f) => f.verdict !== "match").map((f, i) => (
                        <li key={i}><span>{f.text}</span><Badge kind={KIND[f.verdict]}>{WORD[f.verdict]}</Badge></li>
                      ))}
                    </ul>
                    {s.facts.every((f) => f.verdict === "match") && <p className="muted">All {s.facts.length} settings match.</p>}
                  </article>
                ))}
              </section>
            );
          })}
          <p className="note">“Close” means within 10% of the target’s stored value. Values are compared as stored, so unverified display conversions do not affect the result.</p>
        </>
      )}
    </div>
  );
}
