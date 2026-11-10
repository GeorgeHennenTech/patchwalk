import { useState } from "react";

const PAGE = 100;

function isContainer(v: unknown): v is object {
  return typeof v === "object" && v !== null && !(v instanceof Uint8Array);
}

function summary(v: object): string {
  if (Array.isArray(v)) return `[ ${v.length} item${v.length === 1 ? "" : "s"} ]`;
  const n = Object.keys(v).length;
  return `{ ${n} key${n === 1 ? "" : "s"} }`;
}

function Leaf({ value }: { value: unknown }) {
  if (typeof value === "string") return <span className="j-str">{JSON.stringify(value)}</span>;
  if (typeof value === "number") {
    // JSON.stringify would print -0 as 0; real presets can contain negative zero.
    return <span className="j-num">{Object.is(value, -0) ? "-0" : String(value)}</span>;
  }
  if (typeof value === "bigint") return <span className="j-num">{value.toString()}</span>;
  if (typeof value === "boolean") return <span className="j-bool">{String(value)}</span>;
  if (value instanceof Uint8Array) return <span className="j-null">{`<${value.length} bytes>`}</span>;
  return <span className="j-null">{value === undefined ? "undefined" : "null"}</span>;
}

function Node({ name, value, depth, openDepth }: { name?: string; value: unknown; depth: number; openDepth: number }) {
  const [open, setOpen] = useState(depth < openDepth);
  const [shown, setShown] = useState(PAGE);
  const label = name !== undefined && <span className="j-key">{name}: </span>;

  if (!isContainer(value)) {
    return (
      <div className="j-row j-leaf">
        {label}
        <Leaf value={value} />
      </div>
    );
  }

  const entries: [string, unknown][] = Array.isArray(value)
    ? value.map((v, i) => [String(i), v])
    : Object.entries(value);
  if (entries.length === 0) {
    return (
      <div className="j-row j-leaf">
        {label}
        <span className="j-null">{Array.isArray(value) ? "[]" : "{}"}</span>
      </div>
    );
  }

  return (
    <div className="j-row">
      <button className="j-toggle" onClick={() => setOpen(!open)} aria-expanded={open}>
        <span className="j-caret">{open ? "▾" : "▸"}</span>
        {label}
        <span className="j-sum">{summary(value)}</span>
      </button>
      {open && (
        <div className="j-children">
          {entries.slice(0, shown).map(([k, v]) => (
            <Node key={k} name={k} value={v} depth={depth + 1} openDepth={openDepth} />
          ))}
          {entries.length > shown && (
            <button className="j-more" onClick={() => setShown(shown + PAGE * 10)}>
              Show more ({entries.length - shown} hidden)
            </button>
          )}
        </div>
      )}
    </div>
  );
}

export function JsonView({ value, openDepth = 1 }: { value: unknown; openDepth?: number }) {
  return (
    <div className="json">
      <Node value={value} depth={0} openDepth={openDepth} />
    </div>
  );
}
