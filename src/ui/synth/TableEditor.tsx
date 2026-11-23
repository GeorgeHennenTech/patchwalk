// The wavetable editor: draw a wave, shape its harmonics, manage a table's frames, morph between them, write
// formulas, and bring sound or pictures in. What it can do follows the wavetable editor described in the
// Serum 2 User Guide; the look and the wording are this app's own. All the maths is in src/synth/wtedit.ts.
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { isUserTable, tableMorph, tableName, tableSamples, type UserTableId } from "../../synth/params";
import { forgetTable, heldTable, holdTable, newTableId } from "../../synth/tablestore";
import type { Synth } from "../../synth/useSynth";
import {
  alignFundamental, averagePeriod, BIN_COMMAND_NAMES, BIN_COMMANDS, binCommand, BINS, blank, blurFrames, blurPhasesBins, blurSpectraBins, crossfadeEdges, draw, fadeEdges, flipHorizontal, flipVertical,
  FRAME, fromImage, insertAfter, joinPairs, keepRange, lowPass, MAX_FRAMES, morphAt, moveFrame, normalize, normalizeSame, pasteFrames, pwmFrom, readWav, reduceTo, removeDc, removeFundamental, removeLowPhases,
  removeLowSpectra, removeRange, renderMorph, sameplace, sampleRedux, sawFrame, setBin, setPhasesFrom, setSpectraFrom, shiftToZero, SORT_NAMES, SORTS, sortFrames, splitByHarmonics, splitFixed, splitFollowing,
  splitHalves, splitSizeOf, splitSpectral, stretchTo, subtractSpectra, table8bit, tableWav, toBins, TOOL_NAMES, TOOLS, zeroPhases, type BinCommand, type Morph, type Sort, type Tool, type Wave,
} from "../../synth/wtedit";
import { applyFormula, FORMULA_EXAMPLES, readFormula } from "../../synth/wtformula";

interface Doc { name: string; morph: Morph; frames: Wave[] }
const GRIDS = [1, 2, 3, 4, 6, 8, 12, 16, 24, 32, 48, 64];
const SHOWN = [32, 64, 128, 256, 512];
const FULL = 2 / Math.PI; // the height of a full saw's first harmonic: the top of the harmonic display
const IMPORTS: [string, string][] = [
  ["average", "One cycle length for the whole sound (try this first)"], ["follow", "Follow the pitch as it moves"], ["snap", "Follow the pitch, cutting where the wave crosses zero"],
  ["harmonics", "Measure the harmonics and rebuild them"], ["fft256", "Blocks of 256 samples as harmonics"], ["fft512", "Blocks of 512 samples as harmonics"], ["fft1024", "Blocks of 1024 samples as harmonics"],
  ["fft2048", "Blocks of 2048 samples as harmonics"], ["fixed", "A fixed length (type a number or a note in the formula box)"], ["single", "One cycle, into the selected frame"], ["singles", "Several one-cycle files, a frame each"], ["picture", "A picture (each column is a frame)"],
];
const save = (bytes: Uint8Array, name: string, type = "audio/wav") => { const a = document.createElement("a"); a.href = URL.createObjectURL(new Blob([bytes as BlobPart], { type })); a.download = name; a.click(); setTimeout(() => URL.revokeObjectURL(a.href), 4000); };
const css = (el: Element, name: string, fallback: string) => getComputedStyle(el).getPropertyValue(name).trim() || fallback;

/** A small picture of one frame. */
function Thumb({ wave }: { wave: Wave }) {
  const ref = useRef<HTMLCanvasElement>(null);
  useEffect(() => {
    const c = ref.current; if (!c) return; const g = c.getContext("2d")!; g.clearRect(0, 0, c.width, c.height); g.strokeStyle = css(c, "--accent", "#b4521e"); g.lineWidth = 1.2; g.beginPath();
    for (let x = 0; x < c.width; x++) { const y = c.height / 2 - wave[Math.floor((x / c.width) * FRAME)]! * (c.height / 2 - 2); x ? g.lineTo(x, y) : g.moveTo(x, y); }
    g.stroke();
  }, [wave]);
  return <canvas ref={ref} width={64} height={34} />;
}

export function TableEditor({ synth, osc, onClose }: { synth: Synth; osc: "a" | "b"; onClose: () => void }) {
  const key = osc === "a" ? "table" : "bTable", posKey = osc === "a" ? "position" : "bPosition", shapeKey = osc === "a" ? "shape" : "bShape";
  const first = useMemo<{ id: UserTableId | null; doc: Doc }>(() => {
    const t = synth.state[key], held = isUserTable(t) ? heldTable(t) : undefined;
    if (isUserTable(t) && held) return { id: t, doc: { name: held.name, morph: held.morph, frames: held.frames } };
    return { id: null, doc: { name: t === "none" ? "My table" : `${tableName(t)} copy`.slice(0, 40), morph: tableMorph(t), frames: tableSamples(t, synth.state[shapeKey]) } };
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);
  const [doc, setDoc] = useState<Doc>(first.doc);
  const id = useRef<UserTableId | null>(first.id);
  const [sel, setSel] = useState(0), [anchor, setAnchor] = useState(0);
  const [tool, setTool] = useState<Tool>("flat"), [grid, setGrid] = useState(16), [mirror, setMirror] = useState(false);
  const [shown, setShown] = useState(64), [only, setOnly] = useState<"all" | "even" | "odd">("all"), [quarters, setQuarters] = useState(false), [byNumber, setByNumber] = useState(false);
  const [formula, setFormula] = useState(""), [note, setNote] = useState("Draw in the wave, drag the harmonic bars, or use the menus. Everything can be undone.");
  const [menu, setMenu] = useState<{ x: number; y: number; bin: number } | null>(null);
  const [importMode, setImportMode] = useState("average");
  const undo = useRef<Doc[]>([]), redo = useRef<Doc[]>([]), clip = useRef<Wave[]>([]), seed = useRef(1);
  const docRef = useRef(doc); docRef.current = doc;
  const [, bump] = useState(0);
  const lo = Math.min(sel, anchor), hi = Math.max(sel, anchor), frame = doc.frames[Math.min(sel, doc.frames.length - 1)] ?? blank();

  /** Make the change real: play it, keep it, and remember what was there (unless this is one move of a drag). */
  const put = useCallback((next: Partial<Doc>, remember = true) => {
    const before = docRef.current, after = { ...before, ...next };
    if (remember) { undo.current.push(before); if (undo.current.length > 80) undo.current.shift(); redo.current = []; }
    docRef.current = after; setDoc(after);
    if (!id.current) id.current = newTableId();
    holdTable(id.current, after.name, after.morph, after.frames);
    if (synth.state[key] !== id.current) synth.setState({ [key]: id.current });
    bump((n) => n + 1);
  }, [key, synth]);
  const pick = (i: number, range = false) => { const n = Math.max(0, Math.min(docRef.current.frames.length - 1, i)); setSel(n); if (!range) setAnchor(n); };
  const frames = (next: Wave[], say?: string, at = sel) => { const list = next.length ? next.slice(0, MAX_FRAMES) : [sawFrame()]; put({ frames: list }); const n = Math.max(0, Math.min(list.length - 1, at)); setSel(n); setAnchor(n); if (say) setNote(say); };
  const each = (f: (w: Wave, i: number) => Wave, from = lo, to = hi, say?: string) => frames(doc.frames.map((w, i) => (i >= from && i <= to ? f(w, i) : w)), say);
  const all = (f: (w: Wave, i: number) => Wave, say?: string) => each(f, 0, doc.frames.length - 1, say);
  const step = (dir: -1 | 1) => { const from = dir < 0 ? undo.current : redo.current, to = dir < 0 ? redo.current : undo.current, d = from.pop(); if (!d) return; to.push(docRef.current); docRef.current = d; setDoc(d); if (id.current) holdTable(id.current, d.name, d.morph, d.frames); pick(Math.min(sel, d.frames.length - 1)); bump((n) => n + 1); };
  const other = (): Wave[] => { const t = synth.state[osc === "a" ? "bTable" : "table"]; return (isUserTable(t) ? heldTable(t)?.frames : undefined) ?? tableSamples(t, synth.state[osc === "a" ? "bShape" : "shape"]); };

  // ---- the wave display
  const waveRef = useRef<HTMLCanvasElement>(null), dragRef = useRef<{ base: Wave; y0: number; last: number } | null>(null);
  useEffect(() => {
    const c = waveRef.current; if (!c) return; const g = c.getContext("2d")!, w = c.width, h = c.height;
    g.clearRect(0, 0, w, h); g.strokeStyle = css(c, "--line", "#ccc"); g.lineWidth = 1;
    for (let i = 0; i <= grid; i++) { const x = Math.round((i / grid) * w) + 0.5; g.beginPath(); g.moveTo(x, 0); g.lineTo(x, h); g.stroke(); }
    g.beginPath(); g.moveTo(0, h / 2); g.lineTo(w, h / 2); g.stroke();
    g.strokeStyle = css(c, "--accent", "#b4521e"); g.lineWidth = 2; g.beginPath();
    for (let x = 0; x <= w; x++) { const v = frame[Math.min(FRAME - 1, Math.floor((x / w) * FRAME))]!, y = h / 2 - v * (h / 2 - 3); x ? g.lineTo(x, y) : g.moveTo(x, y); }
    g.stroke();
  }, [frame, grid]);
  const drawAt = (e: React.PointerEvent<HTMLCanvasElement>, start: boolean) => {
    const c = e.currentTarget, r = c.getBoundingClientRect(), s = Math.max(0, Math.min(grid - 1, Math.floor(((e.clientX - r.left) / r.width) * grid))), y = Math.max(-1, Math.min(1, 1 - (2 * (e.clientY - r.top)) / r.height));
    if (start) { dragRef.current = { base: frame, y0: y, last: -1 }; seed.current++; put({}, true); c.setPointerCapture(e.pointerId); }
    const d = dragRef.current; if (!d) return;
    const dragged = tool === "nudge" || tool === "noise", cur = docRef.current.frames[sel] ?? frame;
    const next = dragged ? draw(d.base, tool, s, grid, (y - d.y0) * (tool === "noise" ? 1 : 1), mirror, seed.current) : draw(cur, tool, s, grid, y, mirror, seed.current);
    put({ frames: docRef.current.frames.map((f, i) => (i === sel ? next : f)) }, false);
  };

  // ---- the harmonic display: strengths on top, phases underneath
  const binsRef = useRef<HTMLCanvasElement>(null), bins = useMemo(() => toBins(frame), [frame]), TOP = 0.7;
  useEffect(() => {
    const c = binsRef.current; if (!c) return; const g = c.getContext("2d")!, w = c.width, h = c.height, bw = w / shown, top = h * TOP;
    g.clearRect(0, 0, w, h); g.fillStyle = css(c, "--accent", "#b4521e");
    for (let k = 1; k <= shown; k++) { const m = Math.min(1, (bins.mag[k]! * (byNumber ? k : 1)) / FULL); g.globalAlpha = only === "all" || (only === "even") === (k % 2 === 0) ? 1 : 0.35; g.fillRect((k - 1) * bw + 0.5, top - m * (top - 2), Math.max(1, bw - 1), m * (top - 2)); }
    g.globalAlpha = 1; g.fillStyle = css(c, "--muted", "#777");
    for (let k = 1; k <= shown; k++) { if (bins.mag[k]! < 1e-5) continue; const mid = top + (h - top) / 2, ph = bins.phase[k]! * (h - top - 4); g.fillRect((k - 1) * bw + 0.5, Math.min(mid, mid - ph), Math.max(1, bw - 1), Math.max(1, Math.abs(ph))); }
    g.strokeStyle = css(c, "--line", "#ccc"); g.beginPath(); g.moveTo(0, top + 0.5); g.lineTo(w, top + 0.5); g.moveTo(0, top + (h - top) / 2); g.lineTo(w, top + (h - top) / 2); g.stroke();
  }, [bins, shown, only, byNumber]);
  const binOf = (e: { clientX: number; currentTarget: Element }) => { const r = e.currentTarget.getBoundingClientRect(); return Math.max(1, Math.min(shown, Math.floor(((e.clientX - r.left) / r.width) * shown) + 1)); };
  const barAt = (e: React.PointerEvent<HTMLCanvasElement>, start: boolean) => {
    if (e.button === 2) return; const c = e.currentTarget, r = c.getBoundingClientRect(), k = binOf(e), y = (e.clientY - r.top) / r.height;
    if (start) { put({}, true); c.setPointerCapture(e.pointerId); dragRef.current = { base: frame, y0: y < TOP ? 0 : 1, last: -1 }; }
    const d = dragRef.current; if (!d) return; if (only !== "all" && (only === "even") !== (k % 2 === 0)) return;
    const cur = docRef.current.frames[sel] ?? frame; let next: Wave;
    if (d.y0 === 0) { let v = Math.max(0, Math.min(1, 1 - y / TOP)); if (quarters) v = Math.round(v * 4) / 4; next = setBin(cur, k, "mag", (v * FULL) / (byNumber ? k : 1)); }
    else next = setBin(cur, k, "phase", Math.max(-0.5, Math.min(0.5, 0.5 - (y - TOP) / (1 - TOP))));
    put({ frames: docRef.current.frames.map((f, i) => (i === sel ? next : f)) }, false);
  };
  const runBin = (cmd: BinCommand, at: number) => { seed.current++; each((w) => binCommand(w, cmd, at, seed.current, Math.min(shown, 16)), sel, sel, `${BIN_COMMAND_NAMES[cmd]}.`); setMenu(null); };

  // ---- menus
  const frameMenu = (v: string) => {
    if (v === "init") frames([sawFrame()], "A new table: one saw frame.", 0);
    else if (v === "insert") frames(insertAfter(doc.frames, sel, frame.slice()), doc.frames.length >= MAX_FRAMES ? `A table holds ${MAX_FRAMES} frames at most.` : "Added a copy of this frame after it.", sel + 1);
    else if (v === "remove") frames(removeRange(doc.frames, sel, sel), undefined, Math.max(0, sel - 1));
    else if (v === "removeSel") frames(removeRange(doc.frames, lo, hi), undefined, Math.max(0, lo - 1));
    else if (v === "removeStart") frames(removeRange(doc.frames, 0, sel), undefined, 0);
    else if (v === "removeEnd") frames(removeRange(doc.frames, sel, doc.frames.length - 1), undefined, Math.max(0, sel - 1));
    else if (v === "keep") frames(keepRange(doc.frames, lo, hi), undefined, 0);
    else if (v.startsWith("every")) frames(reduceTo(doc.frames, Number(v.slice(5))), `Kept every ${v.slice(5)}${v.slice(5) === "2" ? "nd" : "th"} frame.`, 0);
  };
  const single = (v: string) => {
    const f: Record<string, (w: Wave) => Wave> = { normalize: (w) => normalize(w), dc: removeDc, flipV: flipVertical, flipH: flipHorizontal, zero: shiftToZero, silence: () => blank(), fade: (w) => fadeEdges(w, grid), xfade: (w) => crossfadeEdges(w, FRAME / grid), filter: (w) => lowPass(w, grid), redux: (w) => sampleRedux(w, grid) };
    if (f[v]) each(f[v]!);
  };
  const whole = (v: string) => {
    const n = doc.frames.length, o = () => other();
    const f: Record<string, () => void> = {
      normEach: () => all((w) => normalize(w)), normSame: () => frames(normalizeSame(doc.frames)), dc: () => all(removeDc), flipV: () => all(flipVertical), flipH: () => all(flipHorizontal), fade: () => all((w) => fadeEdges(w, grid)),
      xfade: () => all((w) => crossfadeEdges(w, FRAME / grid)), xfade16: () => all((w) => crossfadeEdges(w, 16)), filter: () => all((w) => lowPass(w, grid)), noFund: () => all(removeFundamental), lowSpec: () => all((w) => removeLowSpectra(w, grid)),
      lowPhase: () => all((w) => removeLowPhases(w, grid)), redux: () => all((w) => sampleRedux(w, grid)), halves: () => frames(splitHalves(doc.frames), "Each frame is now two.", sel * 2), pairs: () => frames(joinPairs(doc.frames), "Each pair of frames is now one.", Math.floor(sel / 2)),
      pwm: () => frames(pwmFrom(frame, 64), "64 frames: this wave squeezed into less and less of the cycle.", 0), align: () => all(alignFundamental), specAll: () => all((w) => setSpectraFrom(w, frame)), phaseAll: () => all((w) => setPhasesFrom(w, frame)),
      specOther: () => { const x = o(); all((w, i) => setSpectraFrom(w, sameplace(x, i, n))); }, phaseOther: () => { const x = o(); all((w, i) => setPhasesFrom(w, sameplace(x, i, n))); }, subOther: () => { const x = o(); all((w, i) => subtractSpectra(w, sameplace(x, i, n))); },
      blurSpecBins: () => all((w) => blurSpectraBins(w, Math.max(1, Math.round(grid / 4)))), blurPhaseBins: () => all((w) => blurPhasesBins(w, Math.max(1, Math.round(grid / 4)))),
      blurSpecFrames: () => frames(blurFrames(doc.frames, Math.max(1, Math.round(grid / 8)), "mag")), blurPhaseFrames: () => frames(blurFrames(doc.frames, Math.max(1, Math.round(grid / 8)), "phase")),
    };
    f[v]?.();
  };
  const morphMenu = (v: string) => {
    if (v === "none" || v === "crossfade" || v === "spectral") { put({ morph: v }); setNote(v === "none" ? "Position now jumps from frame to frame." : v === "crossfade" ? "Position now mixes neighbouring frames." : "Position now moves each harmonic from one frame to the next."); }
    else if (v === "spectralFund") { put({ frames: doc.frames.map(alignFundamental), morph: "spectral" }); setNote("First harmonics lined up, then a harmonic morph. This changed the frames: Undo puts them back."); }
    else if (v === "spectralZero") { put({ frames: doc.frames.map(zeroPhases), morph: "spectral" }); setNote("All phases set to zero, then a harmonic morph: the smoothest, but it changes how each frame looks and can change its sound."); }
    else if (v.startsWith("write")) frames(renderMorph(doc.frames, doc.morph, Number(v.slice(5))), `Wrote the in-between waves out as ${v.slice(5)} real frames.`, 0);
  };
  const runFormula = (text = formula) => {
    const size = splitSizeOf(text);
    if (size) { setNote(`A cycle length for bringing sound in: ${size} samples (${(44100 / size).toFixed(1)} Hz at 44.1 kHz). Choose "A fixed length" under Bring in.`); setImportMode("fixed"); return; }
    const r = readFormula(text); if (!r.ok) { setNote(r.reason); return; }
    seed.current++; const next = applyFormula(doc.frames, sel, r.formula, seed.current);
    frames(next, r.formula.uses.has("y") || r.formula.uses.has("z") ? `Wrote all ${next.length} frames.` : r.formula.uses.has("q") ? "Wrote this frame's harmonics." : "Wrote this frame.");
  };

  // ---- bringing sound and pictures in
  const fileRef = useRef<HTMLInputElement>(null), thumbDrop = useRef<number | null>(null);
  const sound = async (file: File): Promise<{ samples: Float32Array; rate: number }> => {
    const bytes = new Uint8Array(await file.arrayBuffer()), wav = readWav(bytes); if (wav) return { samples: wav.samples.slice(0, wav.rate * 60), rate: wav.rate };
    const ctx = synth.engine.current?.ctx ?? new AudioContext(), buf = await ctx.decodeAudioData(bytes.buffer.slice(0) as ArrayBuffer); return { samples: buf.getChannelData(0).slice(0, buf.sampleRate * 60), rate: buf.sampleRate };
  };
  const bringIn = async (files: File[], mode: string, into: number | null = null) => {
    if (!files.length) return;
    try {
      const picture = files[0]!.type.startsWith("image/") || /\.png$/i.test(files[0]!.name);
      if (picture) {
        const bmp = await createImageBitmap(files[0]!), c = document.createElement("canvas"); c.width = bmp.width; c.height = bmp.height; const g = c.getContext("2d")!; g.drawImage(bmp, 0, 0);
        const px = g.getImageData(0, 0, c.width, c.height).data, lum = new Uint8Array(c.width * c.height); for (let i = 0; i < lum.length; i++) lum[i] = Math.round(0.2126 * px[i * 4]! + 0.7152 * px[i * 4 + 1]! + 0.0722 * px[i * 4 + 2]!);
        frames(fromImage(lum, c.width, c.height), `A picture ${c.width} wide: ${Math.min(MAX_FRAMES, c.width)} frames, one for each column.`, 0); return;
      }
      if (into !== null || mode === "single") { const s = await sound(files[0]!), at = into ?? sel; frames(doc.frames.map((f, i) => (i === at ? stretchTo(s.samples) : f)), `"${files[0]!.name}" is now frame ${at + 1}, as one cycle.`, at); return; }
      if (files.length > 1 || mode === "singles") { const list: Wave[] = []; for (const f of files.slice(0, MAX_FRAMES)) list.push(stretchTo((await sound(f)).samples)); frames(list, `${list.length} files, each one frame.`, 0); return; }
      const s = await sound(files[0]!), typed = splitSizeOf(formula);
      if (mode === "fixed" && !typed) { setNote("Type a cycle length (32 to 9999 samples) or a note such as A2 in the formula box first."); return; }
      const period = mode === "fixed" ? typed! * (s.rate / 44100) : mode === "average" ? averagePeriod(s.samples) : 0;
      if (mode === "average" && !period) { setNote("No steady pitch was found in that sound. Try the harmonic blocks, or type a cycle length and use the fixed length."); return; }
      const made = mode === "average" || mode === "fixed" ? splitFixed(s.samples, period) : mode === "follow" ? splitFollowing(s.samples, false) : mode === "snap" ? splitFollowing(s.samples, true) : mode === "harmonics" ? splitByHarmonics(s.samples) : splitSpectral(s.samples, Number(mode.slice(3)));
      frames(made, `${made.length} frames from "${files[0]!.name}"${period ? `, cut every ${period.toFixed(1)} samples (${(s.rate / period).toFixed(1)} Hz)` : ""}. If it buzzes, try All frames, Crossfade the edges.`, 0);
    } catch { setNote("That file could not be read as a sound or a picture."); }
  };
  const exportAs = (v: string) => {
    const name = doc.name.replace(/[^\w -]+/g, "").trim() || "table", out = doc.morph === "none" || doc.frames.length < 2 ? doc.frames : doc.frames;
    if (v === "wav16" || v === "wav32") save(tableWav(out, v === "wav16" ? 16 : 32), `${name}.wav`);
    else if (v === "sel") save(tableWav(doc.frames.slice(lo, hi + 1), 32), `${name} ${lo + 1}-${hi + 1}.wav`);
    else if (v === "singles") doc.frames.slice(0, 32).forEach((f, i) => setTimeout(() => save(tableWav([f], 32), `${name} ${String(i + 1).padStart(3, "0")}.wav`), i * 150));
    else if (v === "eight") save(table8bit(out), `${name}.256`, "application/octet-stream");
    setNote(v === "singles" && doc.frames.length > 32 ? "Saved the first 32 frames as separate files." : "Saved. A WAV here is one channel, 44.1 kHz, 2048 samples a frame.");
  };

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") { if (menu) setMenu(null); else onClose(); }
      else if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === "z") { e.preventDefault(); step(e.shiftKey ? 1 : -1); }
      else if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === "y") { e.preventDefault(); step(1); }
    };
    window.addEventListener("keydown", onKey); return () => window.removeEventListener("keydown", onKey);
  });
  const pos = synth.state[posKey], action = (run: (v: string) => void) => (e: React.ChangeEvent<HTMLSelectElement>) => { const v = e.target.value; e.target.value = ""; e.target.blur(); if (v) run(v); };
  const held = synth.held.length > 0;

  return (
    <div className="wted" role="dialog" aria-label="Wavetable editor" onClick={() => menu && setMenu(null)}>
      <div className="wted-panel" onDragOver={(e) => e.preventDefault()} onDrop={(e) => { e.preventDefault(); const into = thumbDrop.current; thumbDrop.current = null; void bringIn([...e.dataTransfer.files], importMode, into); }}>
        <header className="wted-head">
          <strong>Wavetable editor</strong><span className="muted">Osc {osc.toUpperCase()}</span>
          <label>Name <input value={doc.name} maxLength={40} aria-label="Table name" onChange={(e) => put({ name: e.target.value }, false)} /></label>
          <button onClick={() => step(-1)} disabled={!undo.current.length}>Undo</button><button onClick={() => step(1)} disabled={!redo.current.length}>Redo</button>
          <button className={held ? "on" : ""} onClick={() => (held ? synth.held.forEach((n) => synth.noteOff(n)) : (void synth.start(), synth.setHold(true), synth.noteOn(45, "mouse")))}>{held ? "Stop the note" : "Hold a note"}</button>
          <label className="wted-pos">Position <input type="range" min={0} max={100} step={0.5} value={pos} aria-label="Wavetable position" onChange={(e) => synth.setState({ [posKey]: Number(e.target.value) })} /> <output>{Math.round(pos)}%</output></label>
          <button className="wted-close" onClick={onClose}>Close</button>
        </header>
        <div className="wted-tools" role="toolbar" aria-label="Drawing tools">
          {TOOLS.map((t) => <button key={t} className={tool === t ? "on" : ""} aria-pressed={tool === t} onClick={() => setTool(t)}>{TOOL_NAMES[t]}</button>)}
          <button className={mirror ? "on" : ""} aria-pressed={mirror} title="Whatever you draw is also drawn on the other side of the middle" onClick={() => setMirror(!mirror)}>Mirror</button>
          <label>Grid <select value={grid} aria-label="Grid size" onChange={(e) => setGrid(Number(e.target.value))}>{GRIDS.map((g) => <option key={g}>{g}</option>)}</select></label>
        </div>
        <canvas ref={waveRef} className="wted-wave" width={1100} height={230} aria-label={`Frame ${sel + 1}: the wave. Draw here with the chosen tool.`} onPointerDown={(e) => drawAt(e, true)} onPointerMove={(e) => dragRef.current && drawAt(e, false)} onPointerUp={() => { dragRef.current = null; }} />
        <div className="wted-binbar">
          <span className="wted-label">Harmonics: strengths on top, timing underneath. Right-click a bar for more.</span>
          <label>Show <select value={shown} aria-label="Harmonics shown" onChange={(e) => setShown(Number(e.target.value))}>{SHOWN.map((n) => <option key={n}>{n}</option>)}</select></label>
          <label>Draw on <select value={only} aria-label="Which harmonics drawing touches" onChange={(e) => setOnly(e.target.value as "all")}><option value="all">all</option><option value="even">even only</option><option value="odd">odd only</option></select></label>
          <label><input type="checkbox" checked={quarters} onChange={(e) => setQuarters(e.target.checked)} /> Snap to quarters</label>
          <label title="Each bar is multiplied by its number, so a saw is a level line"><input type="checkbox" checked={byNumber} onChange={(e) => setByNumber(e.target.checked)} /> Scale by number</label>
        </div>
        <canvas ref={binsRef} className="wted-bins" width={1100} height={150} aria-label="Harmonics of this frame. Drag a bar to set it." onPointerDown={(e) => barAt(e, true)} onPointerMove={(e) => dragRef.current && barAt(e, false)} onPointerUp={() => { dragRef.current = null; }}
          onContextMenu={(e) => { e.preventDefault(); const r = e.currentTarget.parentElement!.getBoundingClientRect(); setMenu({ x: e.clientX - r.left, y: e.clientY - r.top, bin: binOf(e) }); }} />
        {menu && <ul className="wted-menu" style={{ left: menu.x, top: menu.y }} role="menu" aria-label={`Harmonic ${menu.bin}`}>
          <li className="wted-menu-head">Harmonic {menu.bin}</li>
          {BIN_COMMANDS.map((c) => <li key={c}><button role="menuitem" onClick={(e) => { e.stopPropagation(); runBin(c, menu.bin); }}>{BIN_COMMAND_NAMES[c]}</button></li>)}
        </ul>}
        <div className="wted-formula">
          <label>Formula <input value={formula} placeholder="(type a formula, such as sin(2*pi*w), or a cycle length such as 2048)" aria-label="Formula" spellCheck={false} onChange={(e) => setFormula(e.target.value)} onKeyDown={(e) => { e.stopPropagation(); if (e.key === "Enter") runFormula(); }} /></label>
          <button onClick={() => runFormula()}>Run</button>
          <select aria-label="Starting formulas" defaultValue="" onChange={action((v) => { setFormula(v); runFormula(v); })}><option value="">Starting formulas…</option>{FORMULA_EXAMPLES.map((f) => <option key={f.name} value={f.text}>{f.name}</option>)}</select>
        </div>
        <div className="wted-menus">
          <select aria-label="Frames" defaultValue="" onChange={action(frameMenu)}><option value="">Frames…</option><option value="init">New table (one saw frame)</option><option value="insert">Add a frame after this one</option><option value="remove">Remove this frame</option><option value="removeSel">Remove the selected frames</option><option value="removeStart">Remove from the start to here</option><option value="removeEnd">Remove from here to the end</option><option value="keep">Keep only the selected</option><option value="every2">Keep every 2nd frame</option><option value="every4">Keep every 4th frame</option><option value="every8">Keep every 8th frame</option></select>
          <select aria-label="Sort" defaultValue="" onChange={action((v) => { seed.current++; frames(sortFrames(doc.frames, v as Sort, seed.current), `Sorted: ${SORT_NAMES[v as Sort].toLowerCase()}.`, 0); })}><option value="">Sort…</option>{SORTS.map((s) => <option key={s} value={s}>{SORT_NAMES[s]}</option>)}</select>
          <select aria-label="This frame" defaultValue="" onChange={action(single)}><option value="">This frame…</option><option value="normalize">Make it full height</option><option value="dc">Remove any offset</option><option value="flipV">Flip upside down</option><option value="flipH">Reverse</option><option value="zero">Start at a zero crossing</option><option value="silence">Silence</option><option value="fade">Fade the edges (grid)</option><option value="xfade">Crossfade the edges (grid)</option><option value="filter">Keep the lowest harmonics (grid)</option><option value="redux">Lower the sample rate (grid)</option></select>
          <select aria-label="All frames" defaultValue="" onChange={action(whole)}><option value="">All frames…</option><option value="normEach">Make each full height</option><option value="normSame">Make full height together</option><option value="dc">Remove any offset</option><option value="flipV">Flip upside down</option><option value="flipH">Reverse</option><option value="fade">Fade the edges (grid)</option><option value="xfade">Crossfade the edges (grid)</option><option value="xfade16">Crossfade the edges (16 samples)</option><option value="filter">Keep the lowest harmonics (grid)</option><option value="noFund">Remove the first harmonic</option><option value="lowSpec">Remove the lowest harmonics (grid)</option><option value="lowPhase">Zero the lowest phases (grid)</option><option value="redux">Lower the sample rate (grid)</option><option value="halves">Split each frame in two</option><option value="pairs">Join frames in pairs</option><option value="pwm">Pulse width from this frame</option><option value="align">Line up the first harmonics</option><option value="specAll">Give all frames this frame's strengths</option><option value="phaseAll">Give all frames this frame's phases</option><option value="specOther">Take strengths from the other oscillator</option><option value="phaseOther">Take phases from the other oscillator</option><option value="subOther">Subtract the other oscillator's strengths</option><option value="blurSpecBins">Blur strengths across harmonics (grid)</option><option value="blurPhaseBins">Blur phases across harmonics (grid)</option><option value="blurSpecFrames">Blur strengths across frames (grid)</option><option value="blurPhaseFrames">Blur phases across frames (grid)</option></select>
          <select aria-label="Morph" value="" onChange={action(morphMenu)}><option value="">Morph: {doc.morph === "none" ? "steps" : doc.morph === "crossfade" ? "crossfade" : "by harmonics"}…</option><option value="crossfade">Crossfade between frames</option><option value="spectral">Morph by harmonics</option><option value="spectralFund">Morph by harmonics, first harmonics lined up</option><option value="spectralZero">Morph by harmonics, all phases zero</option><option value="none">No morph (steps)</option><option value="write64">Write the in-between waves out: 64 frames</option><option value="write256">Write the in-between waves out: 256 frames</option></select>
          <label>Bring in <select value={importMode} aria-label="How to bring a file in" onChange={(e) => setImportMode(e.target.value)}>{IMPORTS.map(([v, n]) => <option key={v} value={v}>{n}</option>)}</select></label>
          <button onClick={() => fileRef.current?.click()}>Choose a file…</button>
          <input ref={fileRef} type="file" hidden multiple accept="audio/*,image/png,.wav,.aif,.aiff,.flac,.mp3,.ogg,.png" onChange={(e) => { const list = [...(e.target.files ?? [])]; e.target.value = ""; void bringIn(list, importMode); }} />
          <select aria-label="Save as a file" defaultValue="" onChange={action(exportAs)}><option value="">Save as a file…</option><option value="wav16">All frames, 16-bit WAV</option><option value="wav32">All frames, 32-bit WAV</option><option value="sel">The selected frames, WAV</option><option value="singles">Each frame as its own WAV</option><option value="eight">All frames, 8-bit (.256)</option></select>
          {id.current && <button className="wted-danger" onClick={() => { if (!confirm(`Delete "${doc.name}" for good?`)) return; const gone = id.current!; synth.setState({ [key]: "none" }); void forgetTable(gone); onClose(); }}>Delete this table</button>}
        </div>
        <div className="wted-strip">
          <div className="wted-strip-buttons">
            <button aria-label="Add a frame" onClick={() => frameMenu("insert")}>+</button><button aria-label="Remove this frame" onClick={() => frameMenu("remove")}>−</button>
            <button onClick={() => { clip.current = doc.frames.slice(lo, hi + 1).map((f) => f.slice()); setNote(`Copied ${hi - lo + 1} frame${hi > lo ? "s" : ""}.`); }}>Copy</button>
            <button disabled={!clip.current.length} onClick={() => frames(pasteFrames(doc.frames, sel, clip.current), `Pasted ${clip.current.length} frame${clip.current.length > 1 ? "s" : ""} starting here.`)}>Paste</button>
            <span className="muted">{doc.frames.length} frame{doc.frames.length > 1 ? "s" : ""}{hi > lo ? `, ${lo + 1} to ${hi + 1} selected` : `, frame ${sel + 1}`}</span>
          </div>
          <ol className="wted-thumbs" aria-label="Frames">
            {doc.frames.map((f, i) => (
              <li key={i} className={`${i === sel ? "on" : ""}${i >= lo && i <= hi ? " in" : ""}`} draggable onDragStart={(e) => { e.dataTransfer.setData("text/x-frame", String(i)); e.dataTransfer.effectAllowed = "move"; }}
                onDragOver={(e) => e.preventDefault()} onDrop={(e) => { const from = e.dataTransfer.getData("text/x-frame"); if (from !== "") { e.preventDefault(); e.stopPropagation(); frames(moveFrame(doc.frames, Number(from), i), undefined, i); } else thumbDrop.current = i; }}>
                <button aria-label={`Frame ${i + 1}`} aria-pressed={i === sel} onClick={(e) => pick(i, e.shiftKey)}><Thumb wave={f} /><span>{i + 1}</span></button>
              </li>
            ))}
          </ol>
        </div>
        <p className="wted-note" role="status">{note}</p>
        <p className="wted-fine muted">The synth plays the first 512 harmonics of each frame: everything the harmonic display shows. Tables are kept in this browser. {doc.frames.length > 1 && <>The wave between frames at the current position looks like this: <MiniWave wave={morphAt(doc.frames, pos / 100, doc.morph)} /></>}</p>
      </div>
    </div>
  );
}
function MiniWave({ wave }: { wave: Wave }) { return <span className="wted-mini"><Thumb wave={wave} /></span>; }
