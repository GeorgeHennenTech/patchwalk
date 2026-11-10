import { useMemo, useState } from "react";
import { decodePreset, PresetError, type DecodedPreset } from "./format";
import { DropZone } from "./ui/DropZone";
import { JsonView } from "./ui/JsonView";

type State =
  | { kind: "empty" }
  | { kind: "error"; fileName: string; message: string }
  | { kind: "ok"; fileName: string; preset: DecodedPreset };

const kb = (n: number) => (n < 1024 ? `${n} B` : `${(n / 1024).toFixed(1)} KB`);

export function App() {
  const [state, setState] = useState<State>({ kind: "empty" });
  const [filter, setFilter] = useState("");

  async function onFile(file: File) {
    try {
      // The file is read into memory in this tab. Nothing is uploaded or stored.
      const bytes = new Uint8Array(await file.arrayBuffer());
      setState({ kind: "ok", fileName: file.name, preset: decodePreset(bytes) });
    } catch (e) {
      const message = e instanceof PresetError ? e.message : "Something unexpected went wrong while reading this file.";
      if (!(e instanceof PresetError)) console.error(e);
      setState({ kind: "error", fileName: file.name, message });
    }
  }

  const filtered = useMemo(() => {
    if (state.kind !== "ok") return {};
    const q = filter.trim().toLowerCase();
    const entries = Object.entries(state.preset.root);
    return Object.fromEntries(q ? entries.filter(([k]) => k.toLowerCase().includes(q)) : entries);
  }, [state, filter]);

  return (
    <main>
      <header className="top">
        <h1>Patchwalk</h1>
        <p>Drop a Serum 2 preset to see what is inside it. The file stays in this browser tab.</p>
      </header>

      <DropZone onFile={onFile} compact={state.kind !== "empty"} />

      {state.kind === "error" && (
        <section className="panel error" role="alert">
          <h2>Could not read {state.fileName}</h2>
          <p>{state.message}</p>
        </section>
      )}

      {state.kind === "ok" && (
        <>
          <section className="panel">
            <h2>{state.preset.header.presetName || state.fileName}</h2>
            <dl className="facts">
              <div><dt>File</dt><dd>{state.fileName}</dd></div>
              <div><dt>Author</dt><dd>{state.preset.header.presetAuthor || "—"}</dd></div>
              <div><dt>Made in</dt><dd>{state.preset.header.product} {state.preset.header.productVersion}</dd></div>
              <div><dt>Format version</dt><dd>{state.preset.header.version}</dd></div>
              <div><dt>Tags</dt><dd>{state.preset.header.tags?.join(", ") || "—"}</dd></div>
              <div><dt>Size</dt><dd>{kb(state.preset.stats.fileBytes)} on disk, {kb(state.preset.stats.decompressedBytes)} decoded</dd></div>
              <div><dt>Top-level keys</dt><dd>{state.preset.stats.rootKeys}</dd></div>
              <div><dt>Param blocks changed</dt><dd>{state.preset.stats.nonDefaultParamBlocks} of {state.preset.stats.paramBlocks}</dd></div>
            </dl>
            {state.preset.header.presetDescription && <p className="desc">{state.preset.header.presetDescription}</p>}
          </section>

          <section className="panel">
            <h2>Header</h2>
            <JsonView value={state.preset.header} openDepth={1} />
          </section>

          <section className="panel">
            <div className="panel-head">
              <h2>Decoded data</h2>
              <input
                type="search"
                placeholder="Filter modules, e.g. Env or ModSlot"
                value={filter}
                onChange={(e) => setFilter(e.target.value)}
                aria-label="Filter top-level keys"
              />
            </div>
            <p className="hint">
              Raw stored values, not what Serum shows on screen. {Object.keys(filtered).length} of{" "}
              {state.preset.stats.rootKeys} keys shown.
            </p>
            <JsonView key={state.fileName + filter} value={filtered} openDepth={1} />
          </section>
        </>
      )}
    </main>
  );
}
