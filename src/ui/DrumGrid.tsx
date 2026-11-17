// The drum grid and the hook that plays it. Both are made to be used anywhere: the Studio tab uses them
// today, and a lesson can show the same grid with its own pattern.
import { useCallback, useEffect, useRef, useState } from "react";
import { DrumMachine } from "../daw/machine";
import { VOICE_NAMES, nextStrength, setHit, setLane, clearLane, dropSample, type Hit, type Pattern, type Voice } from "../daw/drums";
import { checkFile, deleteSample, listSamples, putSample, sampleName } from "../daw/samples";

export interface SampleInfo { id: string; name: string }

export function useDrumMachine(initial: () => Pattern) {
  const [pattern, setPattern] = useState(initial);
  const now = useRef(pattern);
  const machine = useRef<DrumMachine | null>(null);
  if (!machine.current) machine.current = new DrumMachine(() => now.current);
  const [playing, setPlaying] = useState(false);
  const [step, setStep] = useState(-1);
  const change = useCallback((next: Pattern | ((p: Pattern) => Pattern)) => {
    const before = now.current, after = typeof next === "function" ? next(before) : next;
    now.current = after;
    if (before.bpm !== after.bpm || before.swing !== after.swing) machine.current!.retime(before);
    setPattern(after);
  }, []);
  const toggle = useCallback(() => {
    const m = machine.current!;
    if (m.playing) { m.stop(); setPlaying(false); setStep(-1); } else { m.start(); setPlaying(true); }
  }, []);
  const audition = useCallback((voice: Voice) => machine.current!.audition(voice), []);
  useEffect(() => {
    if (!playing) return;
    let frame = 0;
    const tick = () => { setStep(machine.current!.step()); frame = requestAnimationFrame(tick); };
    frame = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(frame);
  }, [playing]);
  useEffect(() => () => { machine.current?.stop(); }, []);
  // the learner's own sounds: read from this browser's storage once, decoded so they can be struck
  const [samples, setSamples] = useState<SampleInfo[]>([]);
  useEffect(() => {
    let live = true;
    listSamples().then(async (all) => {
      const ok: SampleInfo[] = [];
      for (const s of all) { try { await machine.current!.load(s.id, s.bytes); ok.push({ id: s.id, name: s.name }); } catch { /* a file the browser can no longer read is left out */ } }
      if (live) setSamples(ok);
    }).catch(() => { /* no storage here: built-in drums still work */ });
    return () => { live = false; };
  }, []);
  /** Take in a sound file. Gives back its id, or throws an Error whose message can be shown. */
  const addSample = useCallback(async (file: File, have: number): Promise<SampleInfo> => {
    const no = checkFile(file.name, file.type, file.size, have);
    if (no) throw new Error(no);
    const bytes = await file.arrayBuffer(), id = `s${Date.now().toString(36)}${Math.random().toString(36).slice(2, 8)}`;
    try { await machine.current!.load(id, bytes); } catch { throw new Error("The browser could not read that file as sound. Try saving it as a WAV."); }
    const info = { id, name: sampleName(file.name) };
    try { await putSample({ ...info, bytes, added: Date.now() }); } catch { machine.current!.forget(id); throw new Error("The browser would not store the file (its storage may be full or switched off)."); }
    setSamples((list) => [...list, info]);
    return info;
  }, []);
  const removeSample = useCallback((id: string) => {
    machine.current!.forget(id); void deleteSample(id).catch(() => undefined);
    setSamples((list) => list.filter((s) => s.id !== id));
    change((p) => dropSample(p, id));
  }, [change]);
  return { pattern, change, playing, toggle, step, audition, samples, addSample, removeSample };
}

const WORDS: Record<Hit, string> = { 0: "off", 1: "soft", 2: "normal", 3: "accent" };

/** One lane per drum, one cell per step. Click to put a hit in or take it out, drag to paint, Shift-click (or right-click) a hit to change how hard it is struck. */
export function DrumGrid({ pattern, onChange, step, onAudition, lanes, onSound, open, onFile }: { pattern: Pattern; onChange: (p: Pattern) => void; step: number; onAudition: (v: Voice) => void; /** show only these drums (for lessons) */ lanes?: Voice[]; /** open this drum's sound settings */ onSound?: (lane: number) => void; open?: number; /** a sound file was dropped on this drum */ onFile?: (lane: number, file: File) => void }) {
  const [over, setOver] = useState(-1);
  const paint = useRef<Hit | null>(null);
  useEffect(() => { const up = () => { paint.current = null; }; window.addEventListener("mouseup", up); return () => window.removeEventListener("mouseup", up); }, []);
  const press = (lane: number, i: number, hit: Hit, harder: boolean) => {
    if (harder && hit) { onChange(setHit(pattern, lane, i, nextStrength(hit))); return; }
    const to: Hit = hit ? 0 : 2;
    paint.current = to;
    onChange(setHit(pattern, lane, i, to));
    if (to) onAudition(pattern.lanes[lane]!.voice);
  };
  return (
    <div className={`drum-grid len${pattern.length}`} onContextMenu={(e) => e.preventDefault()}>
      {pattern.lanes.map((lane, li) => (lanes && !lanes.includes(lane.voice) ? null : (
        <div className={`drum-lane${lane.mute ? " muted" : ""}${over === li ? " over" : ""}`} key={lane.voice}
          onDragOver={onFile ? (e) => { if (e.dataTransfer.types.includes("Files")) { e.preventDefault(); setOver(li); } } : undefined}
          onDragLeave={onFile ? () => setOver(-1) : undefined}
          onDrop={onFile ? (e) => { e.preventDefault(); setOver(-1); const f = e.dataTransfer.files[0]; if (f) onFile(li, f); } : undefined}>
          <button className="drum-name" onClick={() => onAudition(lane.voice)} title="Hear this drum">{VOICE_NAMES[lane.voice]}</button>
          {onSound && <button className={`drum-flag sound${lane.sample ? " own" : ""}${open === li ? " on" : ""}`} aria-pressed={open === li} onClick={() => onSound(li)} title={lane.sample ? "Your own sound. Click to change it" : "Choose this drum's sound"} aria-label={`${VOICE_NAMES[lane.voice]} sound`}>♪</button>}
          <button className={`drum-flag${lane.mute ? " on" : ""}`} aria-pressed={lane.mute} onClick={() => onChange(setLane(pattern, li, { mute: !lane.mute }))} title="Mute: silence this drum">M</button>
          <button className={`drum-flag solo${lane.solo ? " on" : ""}`} aria-pressed={lane.solo} onClick={() => onChange(setLane(pattern, li, { solo: !lane.solo }))} title="Solo: hear only this drum">S</button>
          <input className="drum-level" type="range" min={0} max={100} value={lane.level} aria-label={`${VOICE_NAMES[lane.voice]} level`} title={`Level ${lane.level}`} onChange={(e) => onChange(setLane(pattern, li, { level: Number(e.target.value) }))} />
          <div className="drum-cells" role="group" aria-label={`${VOICE_NAMES[lane.voice]} steps`}>
            {lane.steps.map((hit, i) => (
              <button key={i} className={`cell h${hit}${i % 4 === 0 ? " beat" : ""}${Math.floor(i / 4) % 2 ? " odd" : ""}${i === step ? " now" : ""}`}
                aria-label={`${VOICE_NAMES[lane.voice]}, step ${i + 1}, ${WORDS[hit]}`} aria-pressed={hit > 0}
                onMouseDown={(e) => { e.preventDefault(); (e.currentTarget as HTMLButtonElement).focus(); press(li, i, hit, e.shiftKey || e.button === 2); }}
                onMouseEnter={() => { if (paint.current !== null && hit !== paint.current) onChange(setHit(pattern, li, i, paint.current)); }}
                onKeyDown={(e) => {
                  if (e.key === "Enter") { e.preventDefault(); press(li, i, hit, e.shiftKey); paint.current = null; }
                  else if (e.key === "1" || e.key === "2" || e.key === "3") onChange(setHit(pattern, li, i, Number(e.key) as Hit));
                  else if (e.key === "Backspace" || e.key === "Delete" || e.key === "0") onChange(setHit(pattern, li, i, 0));
                  else if (e.key === "ArrowRight" || e.key === "ArrowLeft") { const sib = (e.key === "ArrowRight" ? e.currentTarget.nextElementSibling : e.currentTarget.previousElementSibling) as HTMLElement | null; sib?.focus(); }
                }} />
            ))}
          </div>
          <button className="drum-clear" onClick={() => onChange(clearLane(pattern, li))} title="Clear this drum's row" aria-label={`Clear ${VOICE_NAMES[lane.voice]}`}>×</button>
        </div>
      )))}
      <div className="drum-lane drum-count" aria-hidden="true">
        <span className="drum-name" />{onSound && <span className="drum-flag" />}<span className="drum-flag" /><span className="drum-flag" /><span className="drum-level" />
        <div className="drum-cells">{Array.from({ length: pattern.length }, (_, i) => <span key={i} className={`count${i % 4 === 0 ? " beat" : ""}${i === step ? " now" : ""}`}>{i % 4 === 0 ? (i / 4) % 4 + 1 : "·"}</span>)}</div>
        <span className="drum-clear" />
      </div>
    </div>
  );
}
