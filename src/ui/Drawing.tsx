// The pictures behind "Draw this". The guide chose the kind and the settings; everything here is drawn by
// the app from those settings, and the sliders let the learner move them. Nothing on this page is a picture
// from a book, and it says so.
import { useEffect, useMemo, useRef, useState } from "react";
import { duckGainLooped, place, sweep, waveHarmonics, type DrawVar, type Drawing } from "../library/draw";
import { compile } from "../library/formula";
import { filterResponseDb } from "../synth/filter";
import { lfoValue } from "../synth/mod";
import { INITIAL, type SynthState } from "../synth/params";

const W = 520, H = 240, L = 54, R = 12, T = 12, B = 34, PW = W - L - R, PH = H - T - B;
/** A number short enough to read at a glance. */
export function short(v: number): string {
  if (!Number.isFinite(v)) return "–";
  const a = Math.abs(v);
  if (a === 0) return "0";
  if (a >= 100000 || a < 0.001) return v.toExponential(2);
  return String(Number(v.toPrecision(a >= 100 ? 4 : 3)));
}
const withUnit = (v: number, unit: string) => `${short(v)}${unit ? ` ${unit}` : ""}`;

function Sliders({ vars, values, set }: { vars: DrawVar[]; values: Record<string, number>; set: (name: string, v: number) => void }) {
  return (
    <div className="draw-sliders">
      {vars.map((v) => (
        <label key={v.name}>
          <span className="draw-var"><b>{v.label}</b>{v.name !== v.label.toLowerCase() && <i> {v.name}</i>} <span className={`draw-origin${v.stated ? " stated" : ""}`}>{v.stated ? "starts at the text’s value" : "starts at the guide’s choice"}</span></span>
          <input type="range" min={0} max={1000} value={Math.round(place(v, values[v.name]!) * 1000)} onChange={(e) => set(v.name, sweep(v, Number(e.target.value) / 1000))} aria-label={`${v.label}${v.unit ? `, in ${v.unit}` : ""}`} />
          <output>{withUnit(values[v.name]!, v.unit)}</output>
        </label>
      ))}
    </div>
  );
}

/** A curve inside the plot area, from points given as fractions (x 0..1 across, y 0..1 up); gaps where y is not a number. */
function path(points: [number, number][]): string {
  let d = "", pen = false;
  for (const [x, y] of points) {
    if (!Number.isFinite(y)) { pen = false; continue; }
    d += `${pen ? "L" : "M"}${(L + x * PW).toFixed(1)} ${(T + (1 - Math.min(1.05, Math.max(-0.05, y))) * PH).toFixed(1)} `;
    pen = true;
  }
  return d;
}
function Frame({ children, xLabel, yLabel, x0, x1, y0, y1, label }: { children: React.ReactNode; xLabel: string; yLabel: string; x0: string; x1: string; y0: string; y1: string; label: string }) {
  return (
    <svg className="draw-plot" viewBox={`0 0 ${W} ${H}`} role="img" aria-label={label}>
      <rect x={L} y={T} width={PW} height={PH} className="draw-area" />
      {[0.25, 0.5, 0.75].map((f) => <g key={f}><line x1={L + f * PW} x2={L + f * PW} y1={T} y2={T + PH} className="draw-grid" /><line x1={L} x2={L + PW} y1={T + f * PH} y2={T + f * PH} className="draw-grid" /></g>)}
      {children}
      <text x={L} y={H - 18} className="draw-tick">{x0}</text><text x={L + PW} y={H - 18} textAnchor="end" className="draw-tick">{x1}</text>
      <text x={L + PW / 2} y={H - 4} textAnchor="middle" className="draw-axis">{xLabel}</text>
      <text x={L - 6} y={T + PH} textAnchor="end" className="draw-tick">{y0}</text><text x={L - 6} y={T + 9} textAnchor="end" className="draw-tick">{y1}</text>
      <text x={12} y={T + PH / 2} textAnchor="middle" transform={`rotate(-90 12 ${T + PH / 2})`} className="draw-axis">{yLabel}</text>
    </svg>
  );
}

function FormulaPlot({ d }: { d: Drawing }) {
  const [values, setValues] = useState(() => Object.fromEntries(d.variables.map((v) => [v.name, v.value])));
  const [x, setX] = useState(d.x ?? d.variables[0]!.name);
  const read = useMemo(() => compile(d.expression ?? "", d.variables.map((v) => v.name)), [d]);
  if (!read.ok) return <p className="note">This formula could not be drawn: {read.reason}.</p>;
  const xv = d.variables.find((v) => v.name === x)!, N = 160;
  const ys = Array.from({ length: N + 1 }, (_, i) => read.fn({ ...values, [x]: sweep(xv, i / N) }));
  const real = ys.filter(Number.isFinite);
  let lo = Math.min(...real), hi = Math.max(...real);
  if (!(hi > lo)) { const pad = Math.abs(lo) * 0.1 || 1; lo -= pad; hi += pad; }
  const now = read.fn(values), at = place(xv, values[x]!);
  return (
    <>
      <p className="draw-formula"><span>{d.output!.label}</span> = <code>{d.expression}</code></p>
      <Frame label={`${d.output!.label} against ${xv.label}`} xLabel={`${xv.label}${xv.unit ? ` (${xv.unit})` : ""}${xv.log ? ", evenly spaced by ratio" : ""}`} yLabel={`${d.output!.label}${d.output!.unit ? ` (${d.output!.unit})` : ""}`} x0={short(xv.min)} x1={short(xv.max)} y0={short(lo)} y1={short(hi)}>
        <path d={path(ys.map((y, i) => [i / N, (y - lo) / (hi - lo)]))} className="draw-curve" />
        {Number.isFinite(now) && <><line x1={L + at * PW} x2={L + at * PW} y1={T} y2={T + PH} className="draw-now" /><circle cx={L + at * PW} cy={T + (1 - (now - lo) / (hi - lo)) * PH} r="5" className="draw-dot" /></>}
      </Frame>
      <p className="draw-readout" role="status">With these values, {d.output!.label.toLowerCase()} = <strong>{withUnit(now, d.output!.unit)}</strong></p>
      {d.variables.length > 1 && (
        <p className="draw-across">Along the bottom: {d.variables.map((v) => <button key={v.name} className={v.name === x ? "on" : ""} aria-pressed={v.name === x} onClick={() => setX(v.name)}>{v.label}</button>)}</p>
      )}
      <Sliders vars={d.variables} values={values} set={(name, v) => setValues((o) => ({ ...o, [name]: v }))} />
    </>
  );
}

function Ready({ d }: { d: Drawing }) {
  const [values, setValues] = useState(() => Object.fromEntries(d.variables.map((v) => [v.name, v.value])));
  const set = (name: string, v: number) => setValues((o) => ({ ...o, [name]: v }));
  let picture: React.ReactNode = null;
  if (d.kind === "envelope") {
    const { attack = 0, decay = 0, sustain = 0, release = 0 } = values, hold = Math.max(200, (attack + decay + release) * 0.35), total = attack + decay + hold + release || 1, s = sustain / 100;
    const xs = [0, attack, attack + decay, attack + decay + hold, total].map((t) => t / total);
    picture = (
      <Frame label="The level over one note" xLabel="time (key held, then let go)" yLabel="level" x0="key down" x1={withUnit(total, "ms")} y0="0" y1="full">
        <line x1={L + xs[3]! * PW} x2={L + xs[3]! * PW} y1={T} y2={T + PH} className="draw-now" />
        <path d={path([[xs[0]!, 0], [xs[1]!, 1], [xs[2]!, s], [xs[3]!, s], [xs[4]!, 0]])} className="draw-curve" />
        <text x={L + xs[3]! * PW + 4} y={T + 12} className="draw-tick">key up</text>
      </Frame>
    );
  } else if (d.kind === "filter") {
    const state: SynthState = { ...INITIAL, filterOn: true, filterType: d.choice as SynthState["filterType"], cutoff: values.cutoff!, resonance: values.resonance! };
    const N = 180, lo = -48, hi = 24;
    picture = (
      <Frame label={`A ${d.choice}-pass filter's curve`} xLabel="frequency (Hz), evenly spaced by ratio" yLabel="level (dB)" x0="20" x1="20000" y0={String(lo)} y1={`+${hi}`}>
        <line x1={L} x2={L + PW} y1={T + (1 - (0 - lo) / (hi - lo)) * PH} y2={T + (1 - (0 - lo) / (hi - lo)) * PH} className="draw-now" />
        <path d={path(Array.from({ length: N + 1 }, (_, i) => [i / N, (Math.max(lo, filterResponseDb(state, 20 * 1000 ** (i / N), null)) - lo) / (hi - lo)] as [number, number]))} className="draw-curve" />
      </Frame>
    );
  } else if (d.kind === "harmonics") {
    const levels = waveHarmonics(d.choice ?? "saw");
    picture = (
      <Frame label={`The harmonics of a ${d.choice} wave`} xLabel="harmonic number" yLabel="level" x0="1" x1={String(levels.length)} y0="0" y1="1">
        {levels.map((v, i) => <rect key={i} x={L + (i / levels.length) * PW + 4} width={PW / levels.length - 8} y={T + (1 - v) * PH} height={Math.max(1, v * PH)} className={`draw-bar${v === 0 ? " none" : ""}`} />)}
      </Frame>
    );
  } else if (d.kind === "lfo") {
    const rate = values.rate!, N = 400, shape = d.choice as SynthState["lfo1Shape"];
    picture = (
      <Frame label={`A ${d.choice} movement at ${short(rate)} times a second`} xLabel="time" yLabel="how far it pushes" x0="0" x1="1 second" y0="down" y1="up">
        <line x1={L} x2={L + PW} y1={T + PH / 2} y2={T + PH / 2} className="draw-now" />
        <path d={path(Array.from({ length: N + 1 }, (_, i) => [i / N, 0.5 + 0.46 * lfoValue(shape, (i / N) * rate)] as [number, number]))} className="draw-curve" />
      </Frame>
    );
  }
  return <>{picture}{d.variables.length > 0 && <Sliders vars={d.variables} values={values} set={set} />}</>;
}

/** Four beats of a kick and a held bass note, with the bass turned down by the kick or not, as sound. */
async function renderDuck(v: Record<string, number>, on: boolean): Promise<AudioBuffer> {
  const rate = 44100, beat = 60 / v.tempo!, length = beat * 4;
  const ctx = new OfflineAudioContext(1, Math.ceil(length * rate), rate);
  for (let k = 0; k < 4; k++) {
    const t = k * beat, osc = ctx.createOscillator(), amp = ctx.createGain();
    osc.frequency.setValueAtTime(160, t); osc.frequency.exponentialRampToValueAtTime(46, t + 0.11);
    amp.gain.setValueAtTime(0.0001, t); amp.gain.linearRampToValueAtTime(0.85, t + 0.003); amp.gain.exponentialRampToValueAtTime(0.0001, t + 0.3);
    osc.connect(amp).connect(ctx.destination); osc.start(t); osc.stop(t + 0.32);
  }
  const bass = ctx.createOscillator(), tone = ctx.createBiquadFilter(), level = ctx.createGain();
  bass.type = "sawtooth"; bass.frequency.value = 55; tone.type = "lowpass"; tone.frequency.value = 380;
  const steps = 800, curve = new Float32Array(steps);
  for (let i = 0; i < steps; i++) curve[i] = 0.32 * (on ? duckGainLooped((i / steps) * length, beat, v.amount!, v.attack!, v.release!) : 1);
  level.gain.setValueCurveAtTime(curve, 0, length);
  bass.connect(tone).connect(level).connect(ctx.destination); bass.start(0); bass.stop(length);
  return ctx.startRendering();
}

/**
 * Sidechain ducking as a working model: a kick on every beat, a held bass note, and the bass turned down
 * each time the kick lands. The picture is drawn from the same curve the sound is made with, and a line
 * shows where the sound has got to. The switch plays it with the ducking off, to hear what it is for.
 */
function DuckModel({ d }: { d: Drawing }) {
  const [values, setValues] = useState(() => Object.fromEntries(d.variables.map((v) => [v.name, v.value])));
  const [on, setOn] = useState(true);
  const [playing, setPlaying] = useState(false);
  const audio = useRef<{ ctx: AudioContext; source?: AudioBufferSourceNode; began: number; length: number }>(undefined);
  const head = useRef<SVGLineElement>(null);
  const beat = 60 / values.tempo!, length = beat * 4, N = 400;
  const gain = (t: number) => duckGainLooped(t, beat, values.amount!, values.attack!, values.release!);
  const lowest = Math.min(...Array.from({ length: N }, (_, i) => gain((i / N) * length)));
  const lane = (top: number, height: number, f: (t: number) => number) => { const mid = top + height / 2; let up = "", down = ""; for (let i = 0; i <= N; i++) { const x = L + (i / N) * PW, h = (f((i / N) * length) * height) / 2; up += `${i ? "L" : "M"}${x.toFixed(1)} ${(mid - h).toFixed(1)} `; down = `L${x.toFixed(1)} ${(mid + h).toFixed(1)} ${down}`; } return `${up}${down}Z`; };
  const kick = (t: number) => { const since = t % beat; return Math.exp(-since / 0.07); };

  // (re)start the loop whenever it is playing and something changed, keeping the place in the bar
  useEffect(() => {
    if (!playing) return;
    let gone = false;
    const timer = window.setTimeout(() => void renderDuck(values, on).then((buffer) => {
      if (gone) return;
      const a = audio.current ?? (audio.current = { ctx: new AudioContext(), began: 0, length: buffer.duration });
      const at = a.source ? ((a.ctx.currentTime - a.began) % a.length) / a.length : 0;
      a.source?.stop();
      const source = a.ctx.createBufferSource(); source.buffer = buffer; source.loop = true; source.connect(a.ctx.destination);
      a.length = buffer.duration; a.began = a.ctx.currentTime - at * buffer.duration;
      source.start(0, at * buffer.duration); a.source = source;
    }), 120);
    return () => { gone = true; window.clearTimeout(timer); };
  }, [playing, on, values]);
  useEffect(() => { if (!playing) { audio.current?.source?.stop(); if (audio.current) audio.current.source = undefined; head.current?.setAttribute("opacity", "0"); return; }
    let frame = 0;
    const tick = () => { const a = audio.current; if (a?.source && head.current) { const x = L + (((a.ctx.currentTime - a.began) % a.length) / a.length) * PW; head.current.setAttribute("x1", String(x)); head.current.setAttribute("x2", String(x)); head.current.setAttribute("opacity", "1"); } frame = requestAnimationFrame(tick); };
    frame = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(frame);
  }, [playing]);
  useEffect(() => () => { audio.current?.source?.stop(); void audio.current?.ctx.close(); }, []);

  return (
    <>
      <p className="draw-play">
        <button className="primary" onClick={() => setPlaying((p) => !p)}>{playing ? "■ Stop" : "▶ Play it"}</button>
        <span className="seg"><button className={on ? "on" : ""} aria-pressed={on} onClick={() => setOn(true)}>Ducking on</button><button className={!on ? "on" : ""} aria-pressed={!on} onClick={() => setOn(false)}>Ducking off</button></span>
        <span className="muted" role="status">{on ? `At its lowest the bass is turned down by ${short(-20 * Math.log10(lowest))} dB.` : "The bass stays at full level, on top of every kick."}</span>
      </p>
      <svg className="draw-plot" viewBox={`0 0 ${W} ${H}`} role="img" aria-label="One bar: four kick hits, and the level of the bass dipping at each one">
        <rect x={L} y={T} width={PW} height={PH} className="draw-area" />
        {[1, 2, 3].map((k) => <line key={k} x1={L + (k / 4) * PW} x2={L + (k / 4) * PW} y1={T} y2={T + PH} className="draw-grid" />)}
        <path d={lane(T + 6, 56, kick)} className="duck-kick" />
        <path d={lane(T + 74, PH - 82, () => 1)} className="duck-ghost" />
        <path d={lane(T + 74, PH - 82, on ? gain : () => 1)} className="duck-bass" />
        <line ref={head} y1={T} y2={T + PH} className="duck-head" opacity="0" />
        <text x={L - 6} y={T + 38} textAnchor="end" className="draw-axis">Kick</text><text x={L - 6} y={T + 74 + (PH - 82) / 2 + 4} textAnchor="end" className="draw-axis">Bass</text>
        {[1, 2, 3, 4].map((k) => <text key={k} x={L + ((k - 1) / 4) * PW + 4} y={H - 18} className="draw-tick">beat {k}</text>)}
        <text x={L + PW / 2} y={H - 4} textAnchor="middle" className="draw-axis">one bar at {short(values.tempo!)} bpm · the dashed outline is the bass with no ducking</text>
      </svg>
      <Sliders vars={d.variables} values={values} set={(name, v) => setValues((o) => ({ ...o, [name]: v }))} />
      <p className="note">A simplified model: a real compressor works out how far to turn down from its threshold and ratio.</p>
    </>
  );
}

export function DrawingView({ drawing }: { drawing: Drawing }) {
  if (drawing.kind === "chain") return <p className="note">This step had a boxes-and-arrows drawing, a kind that has been retired because it only repeated the step in other words. “Choose a different drawing” asks for a real one.</p>;
  if (drawing.kind === "none") return <p className="note">No drawing for this step. {drawing.caption}</p>;
  return (
    <figure className="drawing">
      <figcaption className="draw-head"><span className="draw-tag">The guide’s drawing</span> <strong>{drawing.title}</strong></figcaption>
      {drawing.kind === "formula" ? <FormulaPlot d={drawing} /> : drawing.kind === "duck" ? <DuckModel d={drawing} /> : <Ready d={drawing} />}
      {drawing.caption && <p className="draw-caption">{drawing.caption}</p>}
      <p className="note">Drawn by the app, not taken from a book. {drawing.kind === "formula" && "Slider ranges are the guide’s choice. "}{drawing.remembered && "Shown from the site’s memory, with no new call."}</p>
    </figure>
  );
}
