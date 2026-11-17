// The Studio tab: the start of the DAW. For now it is the drum programmer.
import { useEffect, useState } from "react";
import { DrumGrid, useDrumMachine } from "./DrumGrid";
import { BPM_MAX, BPM_MIN, STARTERS, SWING_MAX, clearAll, setLength, setSwing, setTempo, type Pattern } from "../daw/drums";
import { loadSaved, loadWork, saveWork, storeSaved, withSaved, withoutSaved } from "../daw/store";

const copy = (p: Pattern): Pattern => ({ ...p, lanes: p.lanes.map((l) => ({ ...l, steps: [...l.steps] })) });

export default function DawView() {
  const drums = useDrumMachine(() => loadWork() ?? copy(STARTERS[0]!));
  const { pattern, change, playing, toggle, step, audition } = drums;
  const [saved, setSaved] = useState(loadSaved);
  const [help, setHelp] = useState(false);
  useEffect(() => { saveWork(pattern); }, [pattern]);
  useEffect(() => {
    const key = (e: KeyboardEvent) => {
      const t = e.target as HTMLElement | null;
      if (e.code !== "Space" || (t && (t.tagName === "INPUT" && (t as HTMLInputElement).type === "text" || t.tagName === "TEXTAREA" || t.tagName === "SELECT"))) return;
      e.preventDefault(); toggle();
    };
    window.addEventListener("keydown", key);
    return () => window.removeEventListener("keydown", key);
  }, [toggle]);
  const keep = () => { const next = withSaved(saved, copy(pattern)); setSaved(next); storeSaved(next); };
  const drop = (name: string) => { const next = withoutSaved(saved, name); setSaved(next); storeSaved(next); };
  const isSaved = saved.some((s) => s.name === pattern.name.trim());
  return (
    <section className="panel daw">
      <h2>Studio <small>drums</small></h2>
      <p className="daw-lede">Each row is a drum, each box a step: sixteen steps make one bar. Click boxes to place hits, then press Play.</p>
      <div className="daw-bar">
        <button className="primary daw-play" onClick={toggle} aria-pressed={playing}>{playing ? "■ Stop" : "▶ Play"}</button>
        <label className="daw-knob"><span>Tempo <b>{pattern.bpm}</b> bpm</span>
          <input type="range" min={BPM_MIN} max={BPM_MAX} value={pattern.bpm} onChange={(e) => change((p) => setTempo(p, Number(e.target.value)))} /></label>
        <label className="daw-knob" title="Plays every second step late. 0 is straight; around 55 to 65 is a shuffle."><span>Swing <b>{pattern.swing}</b>%</span>
          <input type="range" min={0} max={SWING_MAX} value={pattern.swing} onChange={(e) => change((p) => setSwing(p, Number(e.target.value)))} /></label>
        <div className="seg" role="group" aria-label="Pattern length">
          <button className={pattern.length === 16 ? "on" : ""} onClick={() => change((p) => setLength(p, 16))}>1 bar</button>
          <button className={pattern.length === 32 ? "on" : ""} onClick={() => change((p) => setLength(p, 32))}>2 bars</button>
        </div>
        <button onClick={() => change(clearAll)}>Clear all</button>
      </div>
      <DrumGrid pattern={pattern} onChange={change} step={step} onAudition={audition} />
      <p className="daw-key"><span className="cell h1" /> soft <span className="cell h2" /> normal <span className="cell h3" /> accent
        <button className="linkish" onClick={() => setHelp(!help)} aria-expanded={help}>{help ? "Hide the controls" : "How to use it"}</button></p>
      {help && <ul className="daw-help">
        <li><b>Click</b> a box to add a hit, click again to remove it. <b>Drag</b> across boxes to paint.</li>
        <li><b>Shift-click</b> or right-click a hit to change how hard it is struck: normal, accent, soft.</li>
        <li>Click a drum's <b>name</b> to hear it. <b>M</b> silences a row, <b>S</b> plays only that row, the slider is its level.</li>
        <li><b>Space</b> starts and stops. With a box selected: Enter toggles, 1 2 3 set the strength, arrows move along.</li>
        <li>You can change anything while it plays.</li>
      </ul>}
      <div className="daw-shelf">
        <div>
          <h3>Starting points</h3>
          <div className="daw-chips">{STARTERS.map((s) => <button key={s.name} onClick={() => change(copy(s))}>{s.name}</button>)}</div>
        </div>
        <div>
          <h3>Your patterns</h3>
          <div className="daw-save">
            <input type="text" value={pattern.name} maxLength={40} aria-label="Pattern name" onChange={(e) => change((p) => ({ ...p, name: e.target.value }))} />
            <button onClick={keep}>{isSaved ? "Save over it" : "Save"}</button>
          </div>
          {saved.length === 0 ? <p className="muted">Nothing saved yet. Saved patterns stay in this browser.</p> :
            <div className="daw-chips">{saved.map((s) => <span key={s.name} className="daw-chip"><button onClick={() => change(copy(s))}>{s.name}</button><button aria-label={`Delete ${s.name}`} title="Delete" onClick={() => drop(s.name)}>×</button></span>)}</div>}
        </div>
      </div>
      <details className="daw-missing"><summary>What is missing here</summary>
        <p>The drums are made by the browser from tones and noise as they play. They are our own recipes, not recordings and not a model of any drum machine, and nobody has tuned them by ear yet. Still to come: your own sounds per drum, notes for the synth, more than one pattern in a row, a mixer and effects.</p>
      </details>
    </section>
  );
}
