// The guide's playable models: each one is a picture drawn from the same maths that makes its sound, with
// sliders that change both while it plays. Two ways of making sound are used. A model whose sound is a
// fixed pattern (hits, echoes) is worked out whole and looped, with a line showing where the sound has got
// to. A model whose sound is a held note (beating, FM, folding) runs live, and its controls change the note
// as it sounds.
import { useEffect, useRef, useState } from "react";
import type { DrawKind, Drawing } from "../library/draw";
import { beatsPerSecond, compOutDb, echoes, fmPartials, foldBack, foldDrive, foldedHarmonics, foldedSine } from "../synth/models";
import { Frame, H, L, PH, PW, Sliders, T, W, short } from "./drawkit";

type Values = Record<string, number>;
const startValues = (d: Drawing): Values => Object.fromEntries(d.variables.map((v) => [v.name, v.value]));

/** Plays a worked-out sound round and round while `playing`, re-making it when `key` changes and keeping its place. Gives the fraction of the way through (0..1) to `at`. */
function useLoop(playing: boolean, key: string, render: () => Promise<AudioBuffer>, at: (fraction: number | undefined) => void) {
  const audio = useRef<{ ctx: AudioContext; source?: AudioBufferSourceNode; began: number; length: number }>(undefined);
  const make = useRef(render); make.current = render;
  const tell = useRef(at); tell.current = at;
  useEffect(() => {
    if (!playing) return;
    let gone = false;
    const timer = window.setTimeout(() => void make.current().then((buffer) => {
      if (gone) return;
      const a = audio.current ?? (audio.current = { ctx: new AudioContext(), began: 0, length: buffer.duration });
      const place = a.source ? ((a.ctx.currentTime - a.began) % a.length) / a.length : 0;
      a.source?.stop();
      const source = a.ctx.createBufferSource(); source.buffer = buffer; source.loop = true; source.connect(a.ctx.destination);
      a.length = buffer.duration; a.began = a.ctx.currentTime - place * buffer.duration;
      source.start(0, place * buffer.duration); a.source = source;
    }), 120);
    return () => { gone = true; window.clearTimeout(timer); };
  }, [playing, key]);
  useEffect(() => {
    if (!playing) { audio.current?.source?.stop(); if (audio.current) audio.current.source = undefined; tell.current(undefined); return; }
    let frame = 0;
    const tick = () => { const a = audio.current; if (a?.source) tell.current(((a.ctx.currentTime - a.began) % a.length) / a.length); frame = requestAnimationFrame(tick); };
    frame = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(frame);
  }, [playing]);
  useEffect(() => () => { audio.current?.source?.stop(); void audio.current?.ctx.close(); }, []);
}
/** A line across the plot at a fraction of the way along, moved straight on the page so the picture need not be redrawn. */
function usePlayhead(from = L, width = PW) {
  const line = useRef<SVGLineElement>(null);
  const move = (f: number | undefined) => { const el = line.current; if (!el) return; if (f === undefined) { el.setAttribute("opacity", "0"); return; } const x = String(from + f * width); el.setAttribute("x1", x); el.setAttribute("x2", x); el.setAttribute("opacity", "1"); };
  return { line, move };
}

/** Holds a note that sounds for as long as `playing`: `build` wires it up once, and what it returns is told the newest values whenever they change. */
function useLive(playing: boolean, values: Values, build: (ctx: AudioContext, out: GainNode, v: Values) => { set: (v: Values) => void; stop: () => void }) {
  const live = useRef<{ ctx: AudioContext; out: GainNode; voice: { set: (v: Values) => void; stop: () => void } }>(undefined);
  const wire = useRef(build); wire.current = build;
  const newest = useRef(values); newest.current = values;
  useEffect(() => {
    if (!playing) return;
    const ctx = new AudioContext(), out = ctx.createGain();
    out.gain.setValueAtTime(0, ctx.currentTime); out.gain.linearRampToValueAtTime(0.22, ctx.currentTime + 0.04); out.connect(ctx.destination);
    live.current = { ctx, out, voice: wire.current(ctx, out, newest.current) };
    return () => { const l = live.current; live.current = undefined; if (!l) return; l.out.gain.setTargetAtTime(0, l.ctx.currentTime, 0.02); window.setTimeout(() => { l.voice.stop(); void l.ctx.close(); }, 150); };
  }, [playing]);
  useEffect(() => { live.current?.voice.set(values); }, [values]);
}

function PlayRow({ playing, toggle, children }: { playing: boolean; toggle: () => void; children?: React.ReactNode }) {
  return <p className="draw-play"><button className="primary" onClick={toggle}>{playing ? "■ Stop" : "▶ Play it"}</button>{children}</p>;
}
const Switch = ({ on, set, yes, no }: { on: boolean; set: (v: boolean) => void; yes: string; no: string }) => (
  <span className="seg"><button className={on ? "on" : ""} aria-pressed={on} onClick={() => set(true)}>{yes}</button><button className={!on ? "on" : ""} aria-pressed={!on} onClick={() => set(false)}>{no}</button></span>
);

/* ---- Compressor: the curve, and a loud and a quiet hit before and after ---- */
const HITS = [-6, -24, -6, -24]; // the levels of the four hits, in dB
function CompressorModel({ d }: { d: Drawing }) {
  const [v, setV] = useState(() => startValues(d));
  const [on, setOn] = useState(true);
  const [playing, setPlaying] = useState(false);
  const { line, move } = usePlayhead(L + PH + 46, W - (L + PH + 46) - 14);
  const out = (inDb: number) => (on ? compOutDb(inDb, v.threshold!, v.ratio!, v.makeup!) : inDb);
  useLoop(playing, JSON.stringify([v, on]), async () => {
    const rate = 44100, gap = 0.5, ctx = new OfflineAudioContext(1, rate * gap * HITS.length, rate);
    HITS.forEach((db, k) => {
      const t = k * gap, osc = ctx.createOscillator(), amp = ctx.createGain(), peak = Math.min(1, 10 ** (out(db) / 20));
      osc.type = "triangle"; osc.frequency.value = 196;
      amp.gain.setValueAtTime(0.0001, t); amp.gain.linearRampToValueAtTime(peak, t + 0.004); amp.gain.exponentialRampToValueAtTime(0.0001, t + 0.36);
      osc.connect(amp).connect(ctx.destination); osc.start(t); osc.stop(t + 0.4);
    });
    return ctx.startRendering();
  }, move);
  const lo = -60, hi = 6, S = PH, x = (db: number) => L + ((db - lo) / (hi - lo)) * S, y = (db: number) => T + (1 - (Math.max(lo, Math.min(hi, db)) - lo) / (hi - lo)) * S;
  const curve = Array.from({ length: 121 }, (_, i) => { const db = lo + (i / 120) * (0 - lo); return `${i ? "L" : "M"}${x(db).toFixed(1)} ${y(out(db)).toFixed(1)}`; }).join(" ");
  const bx = L + S + 46, bw = (W - bx - 14) / HITS.length;
  const gap = 20 * Math.log10(10 ** (out(-6) / 20) / 10 ** (out(-24) / 20));
  return (
    <>
      <PlayRow playing={playing} toggle={() => setPlaying((p) => !p)}><Switch on={on} set={setOn} yes="Compressor on" no="Compressor off" /><span className="muted" role="status">The loud hit is now {short(gap)} dB above the quiet one (18 dB apart going in).</span></PlayRow>
      <svg className="draw-plot" viewBox={`0 0 ${W} ${H}`} role="img" aria-label="Left: level going in against level coming out. Right: a loud and a quiet hit, before and after.">
        <rect x={L} y={T} width={S} height={S} className="draw-area" />
        <line x1={x(lo)} y1={y(lo)} x2={x(0)} y2={y(0)} className="draw-now" />
        {on && <line x1={x(v.threshold!)} x2={x(v.threshold!)} y1={T} y2={T + S} className="draw-grid model-mark" />}
        <path d={curve} className="draw-curve" />
        {HITS.slice(0, 2).map((db) => <circle key={db} cx={x(db)} cy={y(out(db))} r="5" className="draw-dot" />)}
        <text x={L + S / 2} y={H - 4} textAnchor="middle" className="draw-axis">level going in (dB)</text>
        <text x={12} y={T + S / 2} textAnchor="middle" transform={`rotate(-90 12 ${T + S / 2})`} className="draw-axis">coming out (dB)</text>
        <text x={L} y={H - 18} className="draw-tick">{lo}</text><text x={x(0)} y={H - 18} textAnchor="middle" className="draw-tick">0</text>
        {on && <text x={x(v.threshold!)} y={T + 11} textAnchor="middle" className="draw-tick">threshold</text>}
        {HITS.map((db, k) => { const h = (d2: number) => Math.max(2, ((Math.max(lo, Math.min(0, d2)) - lo) / (0 - lo)) * (S - 24)); return (
          <g key={k}><rect x={bx + k * bw + 4} width={bw - 8} y={T + S - h(db)} height={h(db)} className="model-before" /><rect x={bx + k * bw + 9} width={bw - 18} y={T + S - h(out(db))} height={h(out(db))} className="draw-bar" /></g>
        ); })}
        <line ref={line} y1={T} y2={T + S} className="duck-head" opacity="0" />
        <text x={bx + (HITS.length * bw) / 2} y={H - 4} textAnchor="middle" className="draw-axis">four hits: dashed in, solid out</text>
      </svg>
      <Sliders vars={d.variables} values={v} set={(name, val) => setV((o) => ({ ...o, [name]: val }))} />
      <p className="note">The corner is sharp and it acts at once: a real compressor also takes its attack and release time to move.</p>
    </>
  );
}

/* ---- Delay: one sound and its echoes ---- */
function DelayModel({ d }: { d: Drawing }) {
  const [v, setV] = useState(() => startValues(d));
  const [playing, setPlaying] = useState(false);
  const { line, move } = usePlayhead();
  const span = 3, list = echoes(v.time!, v.feedback!, v.mix!, span);
  useLoop(playing, JSON.stringify(v), async () => {
    const rate = 44100, ctx = new OfflineAudioContext(1, rate * span, rate);
    for (const e of list) {
      const osc = ctx.createOscillator(), amp = ctx.createGain();
      osc.type = "triangle"; osc.frequency.setValueAtTime(660, e.t); osc.frequency.exponentialRampToValueAtTime(440, e.t + 0.05);
      amp.gain.setValueAtTime(0.0001, e.t); amp.gain.linearRampToValueAtTime(0.6 * e.level, e.t + 0.003); amp.gain.exponentialRampToValueAtTime(0.0001, e.t + 0.16);
      osc.connect(amp).connect(ctx.destination); osc.start(e.t); osc.stop(e.t + 0.18);
    }
    return ctx.startRendering();
  }, move);
  return (
    <>
      <PlayRow playing={playing} toggle={() => setPlaying((p) => !p)}><span className="muted" role="status">{list.length - 1} echo{list.length === 2 ? "" : "es"} you can hear in three seconds, {short(v.time!)} ms apart.</span></PlayRow>
      <Frame label="One sound and its echoes over three seconds" xLabel="time (seconds)" yLabel="how loud" x0="0" x1="3" y0="0" y1="full">
        {list.map((e, i) => <rect key={i} x={L + (e.t / span) * PW} width={Math.max(3, PW / 90)} y={T + (1 - e.level) * PH} height={Math.max(1, e.level * PH)} className={i === 0 ? "model-first" : "draw-bar"} />)}
        <line ref={line} y1={T} y2={T + PH} className="duck-head" opacity="0" />
      </Frame>
      <Sliders vars={d.variables} values={v} set={(name, val) => setV((o) => ({ ...o, [name]: val }))} />
      <p className="note">The dark bar is the sound itself; each echo is the one before it times the feedback. Three seconds, then it starts again.</p>
    </>
  );
}

/* ---- Beating: two notes slightly out of tune ---- */
function BeatingModel({ d }: { d: Drawing }) {
  const [v, setV] = useState(() => startValues(d));
  const [playing, setPlaying] = useState(false);
  const rate = beatsPerSecond(v.note!, v.detune!);
  useLive(playing, v, (ctx, out, first) => {
    const a = ctx.createOscillator(), b = ctx.createOscillator(), half = ctx.createGain();
    a.type = b.type = "sawtooth"; half.gain.value = 0.5; a.connect(half); b.connect(half); half.connect(out);
    const set = (x: Values) => { a.frequency.setTargetAtTime(x.note!, ctx.currentTime, 0.01); b.frequency.setTargetAtTime(x.note!, ctx.currentTime, 0.01); b.detune.setTargetAtTime(x.detune!, ctx.currentTime, 0.01); };
    a.frequency.value = b.frequency.value = first.note!; b.detune.value = first.detune!; a.start(); b.start();
    return { set, stop: () => { a.stop(); b.stop(); } };
  });
  const span = 2, N = 300, swell = (t: number) => Math.abs(Math.cos(Math.PI * rate * t));
  let up = "", down = "";
  for (let i = 0; i <= N; i++) { const x = L + (i / N) * PW, h = (swell((i / N) * span) * PH * 0.92) / 2, mid = T + PH / 2; up += `${i ? "L" : "M"}${x.toFixed(1)} ${(mid - h).toFixed(1)} `; down = `L${x.toFixed(1)} ${(mid + h).toFixed(1)} ${down}`; }
  return (
    <>
      <PlayRow playing={playing} toggle={() => setPlaying((p) => !p)}><span className="muted" role="status">{rate < 0.05 ? "In tune: one steady note, no swelling." : `The two notes swell and fade ${short(rate)} times a second.`}</span></PlayRow>
      <Frame label="How loud the two notes are together, over two seconds" xLabel="time (seconds)" yLabel="how loud together" x0="0" x1="2" y0="" y1="">
        <path d={`${up}${down}Z`} className="duck-bass" />
      </Frame>
      <Sliders vars={d.variables} values={v} set={(name, val) => setV((o) => ({ ...o, [name]: val }))} />
      <p className="note">The shape is how the pair’s loudness rises and falls. Slide Detune while it plays: the swelling speeds up, then turns into thickness.</p>
    </>
  );
}

/* ---- FM: the partials it adds ---- */
function FmModel({ d }: { d: Drawing }) {
  const [v, setV] = useState(() => startValues(d));
  const [playing, setPlaying] = useState(false);
  useLive(playing, v, (ctx, out, first) => {
    const car = ctx.createOscillator(), mod = ctx.createOscillator(), depth = ctx.createGain();
    const set = (x: Values) => { const now = ctx.currentTime, fm = x.note! * x.ratio!; car.frequency.setTargetAtTime(x.note!, now, 0.01); mod.frequency.setTargetAtTime(fm, now, 0.01); depth.gain.setTargetAtTime(x.amount! * fm, now, 0.01); };
    car.frequency.value = first.note!; mod.frequency.value = first.note! * first.ratio!; depth.gain.value = first.amount! * first.note! * first.ratio!;
    mod.connect(depth).connect(car.frequency); car.connect(out); car.start(); mod.start();
    return { set, stop: () => { car.stop(); mod.stop(); } };
  });
  const parts = fmPartials(v.note!, v.ratio!, v.amount!), top = Math.max(v.note! * 2, ...parts.map((p) => p.hz)) * 1.05, most = Math.max(0.001, ...parts.map((p) => p.level));
  return (
    <>
      <PlayRow playing={playing} toggle={() => setPlaying((p) => !p)}><span className="muted" role="status">{v.amount! < 0.05 ? "No FM: just the played note." : `${parts.length} partials, spaced ${short(v.note! * v.ratio!)} Hz apart.`}</span></PlayRow>
      <Frame label="The partials in the sound" xLabel="frequency (Hz)" yLabel="strength" x0="0" x1={short(top)} y0="0" y1="strongest">
        {parts.map((p) => <rect key={p.hz} x={L + (p.hz / top) * PW - 2.5} width="5" y={T + (1 - p.level / most) * PH} height={Math.max(1, (p.level / most) * PH)} className={Math.abs(p.hz - v.note!) < 0.5 ? "model-first" : "draw-bar"} />)}
      </Frame>
      <Sliders vars={d.variables} values={v} set={(name, val) => setV((o) => ({ ...o, [name]: val }))} />
      <p className="note">The dark bar is the note you play. Turn the amount up while it sounds and partials grow on both sides of it; a whole-number ratio keeps them in tune with the note.</p>
    </>
  );
}

/* ---- Wavefolding ---- */
function FoldModel({ d }: { d: Drawing }) {
  const [v, setV] = useState(() => startValues(d));
  const [playing, setPlaying] = useState(false);
  useLive(playing, v, (ctx, out, first) => {
    const osc = ctx.createOscillator(), drive = ctx.createGain(), shaper = ctx.createWaveShaper(), trim = ctx.createGain();
    // the shaper holds the fold for inputs from -6 to 6; the drive in front of it sets how far the sine reaches into it
    const curve = new Float32Array(4097); for (let i = 0; i < curve.length; i++) curve[i] = foldBack(((i / (curve.length - 1)) * 2 - 1) * 6);
    shaper.curve = curve; shaper.oversample = "4x"; osc.frequency.value = 165; drive.gain.value = foldDrive(first.amount!) / 6; trim.gain.value = 0.9;
    osc.connect(drive).connect(shaper).connect(trim).connect(out); osc.start();
    return { set: (x) => drive.gain.setTargetAtTime(foldDrive(x.amount!) / 6, ctx.currentTime, 0.015), stop: () => osc.stop() };
  });
  const N = 240, harm = foldedHarmonics(v.amount!), half = PW / 2 - 14, hx = L + PW / 2 + 14;
  const wave = Array.from({ length: N + 1 }, (_, i) => `${i ? "L" : "M"}${(L + (i / N) * half).toFixed(1)} ${(T + PH / 2 - foldedSine(i / N, v.amount!) * PH * 0.45).toFixed(1)}`).join(" ");
  const plain = Array.from({ length: N + 1 }, (_, i) => `${i ? "L" : "M"}${(L + (i / N) * half).toFixed(1)} ${(T + PH / 2 - Math.max(-1, Math.min(1, Math.sin((2 * Math.PI * i) / N))) * PH * 0.45).toFixed(1)}`).join(" ");
  return (
    <>
      <PlayRow playing={playing} toggle={() => setPlaying((p) => !p)}><span className="muted" role="status">{harm.filter((h) => h > 0.05).length} harmonics you would notice; the sine is turned up {short(foldDrive(v.amount!))} times before folding.</span></PlayRow>
      <svg className="draw-plot" viewBox={`0 0 ${W} ${H}`} role="img" aria-label="Left: one cycle of the folded wave. Right: its harmonics.">
        <rect x={L} y={T} width={half} height={PH} className="draw-area" /><rect x={hx} y={T} width={half} height={PH} className="draw-area" />
        <path d={plain} className="duck-ghost" /><path d={wave} className="draw-curve" />
        {harm.map((h, i) => <rect key={i} x={hx + (i / harm.length) * half + 2} width={half / harm.length - 4} y={T + (1 - h) * PH} height={Math.max(1, h * PH)} className={`draw-bar${h < 0.01 ? " none" : ""}`} />)}
        <text x={L + half / 2} y={H - 4} textAnchor="middle" className="draw-axis">one cycle (dashed: the plain sine)</text>
        <text x={hx + half / 2} y={H - 4} textAnchor="middle" className="draw-axis">harmonics 1 to {harm.length}</text>
      </svg>
      <Sliders vars={d.variables} values={v} set={(name, val) => setV((o) => ({ ...o, [name]: val }))} />
      <p className="note">Each time a peak is pushed past the edge it is folded back, and every fold adds harmonics. This is the plain triangle fold, not a model of any one circuit.</p>
    </>
  );
}

/** The playable model for each kind of drawing that has one. */
export const MODELS: Partial<Record<DrawKind, (props: { d: Drawing }) => React.ReactNode>> = { compressor: CompressorModel, delay: DelayModel, beating: BeatingModel, fm: FmModel, fold: FoldModel };
