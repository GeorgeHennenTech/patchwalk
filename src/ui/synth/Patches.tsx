// Save the sound on the practice synth under a name, bring one back, or move one between browsers as a file.
import { useRef, useState } from "react";
import { deletePatch, fromFile, loadPatches, savePatch, toFile, type Patch } from "../../synth/patches";
import type { Synth } from "../../synth/useSynth";

export function PatchBar({ synth }: { synth: Synth }) {
  const [list, setList] = useState<Patch[]>(() => loadPatches());
  const [name, setName] = useState(""), [note, setNote] = useState<string>();
  const file = useRef<HTMLInputElement>(null);
  const save = () => { setList(savePatch(name, synth.state, Date.now())); setNote(`Saved “${name.trim() || "Untitled"}”.`); };
  const load = (p: Patch) => { synth.reset(p.state); setName(p.name); setNote(`Loaded “${p.name}”.`); };
  const download = (p: Patch) => { const a = document.createElement("a"); a.href = URL.createObjectURL(new Blob([toFile(p)], { type: "application/json" })); a.download = `${p.name.replace(/[^\w-]+/g, "_")}.patchwalk.json`; a.click(); URL.revokeObjectURL(a.href); };
  const open = async (f: File | undefined) => {
    if (!f) return;
    const got = fromFile(await f.text());
    if (!got) { setNote("That file is not a Patchwalk patch."); return; }
    synth.reset(got.state); setName(got.name); setNote(`Opened “${got.name}” from the file. Save it to keep it here.`);
  };
  return (
    <details className="patch-bar">
      <summary>My patches ({list.length})</summary>
      <form onSubmit={(e) => { e.preventDefault(); save(); }}>
        <input value={name} onChange={(e) => setName(e.target.value)} maxLength={40} placeholder="Name this sound" aria-label="Name for this patch" />
        <button className="primary">Save</button>
        <button type="button" onClick={() => file.current?.click()}>Open a file…</button>
        <input ref={file} type="file" accept=".json,application/json" hidden onChange={(e) => { void open(e.target.files?.[0]); e.target.value = ""; }} />
      </form>
      {note && <p className="muted" role="status">{note}</p>}
      {list.length > 0 && (
        <ul>
          {list.map((p) => (
            <li key={p.name}><strong>{p.name}</strong> <span className="muted">{new Date(p.savedAt).toLocaleDateString()}</span>
              <button className="link" onClick={() => load(p)}>Load</button> <button className="link" onClick={() => download(p)}>Download</button> <button className="link" onClick={() => { if (window.confirm(`Delete “${p.name}”?`)) setList(deletePatch(p.name)); }}>Delete</button></li>
          ))}
        </ul>
      )}
      <p className="muted">Kept in this browser only. Download a patch to move it to another computer. These are sounds on this practice synth, not Serum presets.</p>
    </details>
  );
}
