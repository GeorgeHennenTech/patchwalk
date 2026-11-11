export function Badge({ kind, title, children }: { kind: "warn" | "unknown" | "ok" | "muted" | "bad" | "info"; title?: string; children: React.ReactNode }) {
  return <span className={`badge badge-${kind}`} title={title}>{children}</span>;
}
