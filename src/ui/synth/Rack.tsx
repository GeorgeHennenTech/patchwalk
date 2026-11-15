// The practice synth drawn as a rack of module panels, in the order the sound flows and the order most
// wavetable synths (Serum included) lay them out: sub, oscillator A, oscillator B, noise, filter. Each panel
// has its on/off switch and name on top, a picture of what it is doing, and its controls underneath.
import { useEffect, useMemo, useRef, useState } from "react";
import type { Panel, PlayableLesson } from "../../course/types";
import { dragColor, dragName, endDrag, startDrag, type Draggable } from "../../synth/connect";
import { MACRO_COLORS } from "../../synth/macros";
import { FX_NAMES, FX_ORDER, fxOrderOf, moveFx, type FxId } from "../../synth/fx";
import { adsr, ENV1_COLOR, envLevel, lfoHz, lfoStartPhase, lfoValue, routes, SOURCES, type Adsr, type ModSource } from "../../synth/mod";
import { harmonic, spectrumA, HARMONICS, LFO_STEPS, MACRO_SLOTS, MACROS, PARAMS, type Group, type SynthState, harmonicsB } from "../../synth/params";
import type { Synth } from "../../synth/useSynth";
import { Control, isBox } from "./Controls";
import { FilterCurve, Matrix, Reduction } from "./Views";

export interface Module { id: string; name: string; groups: Group[]; toggle?: keyof SynthState; color?: string; source?: ModSource }
export const MODULES: Module[] = [
  { id: "sub", name: "Sub", groups: ["Sub"], toggle: "subOn" },
  { id: "a", name: "Osc A", groups: ["Oscillator A", "Unison"], toggle: "aOn" },
  { id: "b", name: "Osc B", groups: ["Oscillator B"], toggle: "bOn" },
  { id: "noise", name: "Noise", groups: ["Noise"], toggle: "noiseOn" },
  { id: "filter", name: "Filter", groups: ["Filter"], toggle: "filterOn" },
  { id: "voice", name: "Voicing", groups: ["Voicing"], color: "#ff4fa3" },
];

/** The row underneath, where Serum also keeps them: the envelopes and LFOs, each in its own neon colour. */
export const MOD_MODULES: Module[] = [
  { id: "env1", name: "Env 1 · level", groups: ["Envelope 1"], color: ENV1_COLOR },
  ...SOURCES.map((x) => ({ id: x.id, name: x.name, groups: [x.kind === "env" ? "Envelope 2" : x.kind === "lfo" ? `LFO ${x.id.slice(3)}` : x.name] as Group[], color: x.color, source: x.id })),
];
/** The effects, in the order the sound passes through them. */
export const FX_MODULES: Module[] = FX_ORDER.map((id) => ({ id: `fx-${id}`, name: FX_NAMES[id], groups: [FX_NAMES[id]] as Group[], toggle: `${id}On` as keyof SynthState }));
/** Macros get their own row and their own layout (see MacroPanel). */
export const MACRO_MODULES: Module[] = MACROS.map((n) => ({ id: `macro${n}`, name: `Macro ${n}`, groups: [`Macro ${n}`] as Group[], color: MACRO_COLORS[n - 1] }));

/** An envelope drawn from its settings: a note held for a moment, then let go. */
export function envPath(e: Adsr, w = 200, height = 64, points = 120): string {
  const held = e.attack + e.decay + 0.25 * Math.max(0.2, e.attack + e.decay), total = held + e.release * 1.1 + 0.02;
  return Array.from({ length: points + 1 }, (_, i) => `${i === 0 ? "M" : "L"}${((i / points) * w).toFixed(1)} ${(height - 5 - envLevel(e, (i / points) * total, held) * (height - 10)).toFixed(1)}`).join(" ");
}
/** Two cycles of an LFO shape. */
/** `oneWay` draws it as it is used then: squeezed into the top half, never dipping below the middle line. */
export function lfoPath(shape: SynthState["lfo1Shape"], oneWay = false, steps?: number[], w = 200, height = 64, points = 160): string {
  const at = (t: number) => { const v = lfoValue(shape, t, steps); return oneWay ? (v + 1) / 2 : v; };
  return Array.from({ length: points + 1 }, (_, i) => `${i === 0 ? "M" : "L"}${((i / points) * w).toFixed(1)} ${(height / 2 - at((i / points) * 2 - 1e-9) * (height / 2 - 6)).toFixed(1)}`).join(" ");
}

/** One cycle of a wave, drawn from its harmonics and start phase: the same recipe the sound is made from. */
export function wavePath(h: ArrayLike<number>, phaseCycles: number, cos?: ArrayLike<number>, w = 200, height = 64, points = 160): string {
  const ys: number[] = [];
  let peak = 1e-9;
  for (let i = 0; i <= points; i++) {
    const t = i / points + phaseCycles;
    let y = 0;
    for (let n = 1; n < h.length; n++) { if (h[n]) y += h[n]! * Math.sin(2 * Math.PI * n * t); if (cos?.[n]) y += cos[n]! * Math.cos(2 * Math.PI * n * t); }
    ys.push(y); peak = Math.max(peak, Math.abs(y));
  }
  return ys.map((y, i) => `${i === 0 ? "M" : "L"}${((i / points) * w).toFixed(1)} ${(height / 2 - (y / peak) * (height / 2 - 5)).toFixed(1)}`).join(" ");
}
const shapeHarmonics = (shape: SynthState["bShape"]) => Array.from({ length: HARMONICS + 1 }, (_, n) => (n ? harmonic(shape, n) : 0));
const SINE = [0, 1];
/** A fixed scribble standing for noise: it has no shape to draw. */
const NOISE_PATH = Array.from({ length: 67 }, (_, i) => `${i === 0 ? "M" : "L"}${i * 3} ${(32 + Math.sin(i * 12.9898) * Math.cos(i * 78.233) * 24).toFixed(1)}`).join(" ");

function Display({ module, synth, note }: { module: Module; synth: Synth; note: number | null }) {
  // drawn from what is actually playing, so a macro's push shows in the pictures
  const s = synth.effective;
  const d = useMemo(() => {
    if (module.id === "a") { const sp = spectrumA(s); return wavePath(sp.sin, s.phase / 360, sp.cos); }
    if (module.id === "b") return wavePath(harmonicsB(s), s.bPhase / 360);
    if (module.id === "sub") return wavePath(SINE, 0);
    if (module.id === "env1") return envPath(adsr(s, 1));
    if (module.id === "env2") return envPath(adsr(s, 2));
    if (module.source === "vel" || module.source === "key" || module.source === "wheel" || module.id.startsWith("fx-") || module.id === "voice") return "";
    if (module.source) return lfoPath(s[`${module.source as "lfo1"}Shape`], s[`${module.source as "lfo1"}Way`] === "up", s[`${module.source as "lfo1"}Steps`]);
    return NOISE_PATH;
  }, [module, s.shape, s.table, s.position, s.phase, s.warp, s.warpAmount, s.bShape, s.bTable, s.bPosition, s.bPhase, s.envA, s.envD, s.envS, s.envR, s.env2A, s.env2D, s.env2S, s.env2R, s.lfo1Shape, s.lfo2Shape, s.lfo3Shape, s.lfo1Way, s.lfo2Way, s.lfo3Way, s.lfo1Steps, s.lfo2Steps, s.lfo3Steps]); // eslint-disable-line react-hooks/exhaustive-deps
  // While a note sounds, an oscillator's picture follows whatever is moving its wave (position, warp,
  // phase, shape), drawn straight onto the page each frame; it returns to the settings when the note stops.
  const wave = useRef<SVGPathElement>(null);
  const latest = useRef({ synth, d });
  latest.current = { synth, d };
  const moving = module.id === "a" || module.id === "b";
  useEffect(() => {
    if (!moving) return;
    let frame = 0, shown = "", lastRest = "";
    const loop = () => {
      const { synth: sy, d: rest } = latest.current, el = wave.current;
      if (rest !== lastRest) { lastRest = rest; shown = "?"; } // the settings changed: draw afresh
      if (el) {
        const l = sy.engine.current?.liveNote ? sy.live() : null;
        const key = !l ? "" : module.id === "a" ? `${l.shape}|${l.table}|${l.position.toFixed(1)}|${l.phase.toFixed(0)}|${l.warp}|${l.warpAmount.toFixed(1)}` : `${l.bShape}|${l.bTable}|${l.bPosition.toFixed(1)}|${l.bPhase.toFixed(0)}`;
        if (key !== shown) {
          shown = key;
          if (!l) el.setAttribute("d", rest);
          else if (module.id === "a") { const sp = spectrumA(l); el.setAttribute("d", wavePath(sp.sin, l.phase / 360, sp.cos)); }
          else el.setAttribute("d", wavePath(harmonicsB(l), l.bPhase / 360));
        }
      }
      frame = requestAnimationFrame(loop);
    };
    frame = requestAnimationFrame(loop);
    return () => cancelAnimationFrame(frame);
  }, [moving, module.id]);
  if (module.id === "filter") return <FilterCurve synth={synth} note={note} compact />;
  if (!d) return null;
  if (module.source?.startsWith("lfo") && synth.state[`${module.source as "lfo1"}Shape`] === "drawn") return <LfoDraw id={module.source as "lfo1"} synth={synth} />;
  return <svg className="mod-wave" viewBox="0 0 200 64" preserveAspectRatio="none" role="img" aria-label={`${module.name} wave`}>{module.source?.startsWith("lfo") && <line className="mod-mid" x1="0" x2="200" y1="32" y2="32" />}<path ref={wave} d={d} />{module.source?.startsWith("lfo") && <Playhead id={module.source as "lfo1"} synth={synth} width={100} height={64} />}</svg>;
}

/**
 * A line that travels across an LFO's picture showing where in its cycle it is for the note sounding now.
 * `width` is how wide one cycle is drawn. Hidden when nothing is playing.
 */
function Playhead({ id, synth, width, height }: { id: "lfo1" | "lfo2" | "lfo3"; synth: Synth; width: number; height: number }) {
  const ref = useRef<SVGLineElement>(null);
  const latest = useRef(synth);
  latest.current = synth;
  useEffect(() => {
    let frame = 0;
    const loop = () => {
      const sy = latest.current, n = sy.engine.current?.liveNote, el = ref.current;
      if (el) {
        if (!n || n.age < 0) el.setAttribute("visibility", "hidden");
        else {
          const cycles = lfoStartPhase(sy.state, id, n.startedAt) + n.age * lfoHz(sy.live(), id), x = (cycles - Math.floor(cycles)) * width;
          el.setAttribute("visibility", "visible"); el.setAttribute("x1", x.toFixed(1)); el.setAttribute("x2", x.toFixed(1));
        }
      }
      frame = requestAnimationFrame(loop);
    };
    frame = requestAnimationFrame(loop);
    return () => cancelAnimationFrame(frame);
  }, [id, width]);
  return <line ref={ref} className="playhead" y1="0" y2={height} visibility="hidden" />;
}

/**
 * The handle a source is dragged by. Drop it on any knob to connect the source to that knob; what happens
 * then is decided by `connect` (the source's own connection first, then a matrix row; a macro's next free slot).
 */
export function Grip({ id }: { id: Draggable }) {
  return (
    <span className="grip" draggable role="img" aria-label={`Drag ${dragName(id)} onto a knob to connect it`} title={`Drag ${dragName(id)} onto any knob to connect it`} style={{ color: dragColor(id) }}
      onClick={(e) => e.preventDefault()}
      onDragStart={(e) => { e.dataTransfer.setData("text/plain", id); e.dataTransfer.effectAllowed = "link"; startDrag(id); }} onDragEnd={endDrag}>✥</span>
  );
}

export function Rack({ synth, show, all, lesson, note }: { synth: Synth; show: Panel[]; all: boolean; lesson: PlayableLesson; note: number | null }) {
  const on = (p: Panel) => all || show.includes(p);
  const s = synth.state;
  const [page, setPage] = useState<"synth" | "fx" | "matrix">("synth");
  const [tabs, setTabs] = useState<Record<string, string>>({ env: "env1", lfo: "lfo1", note: "vel" });
  /** A source that is not sent anywhere yet. */
  const idle = (m: Module) => !!m.source && s[`${m.source}Dest`] === "none";
  /** How long one turn of an LFO takes, for the skin: a connected LFO's panel pulses at the LFO's own speed. */
  const period = (m: Module) => (m.source?.startsWith("lfo") ? `${Math.min(20, Math.max(0.08, 1 / lfoHz(s, m.source as "lfo1"))).toFixed(3)}s` : undefined);
  const idsOf = (m: Module) => (Object.keys(PARAMS) as (keyof SynthState)[]).filter((id) => m.groups.includes(PARAMS[id]!.group) && id !== m.toggle && on(id) && (id !== "freeHz" || s.freeHz !== null));
  /** A module's picture and controls: menus, choices, number boxes, then knobs. */
  const body = (m: Module, ids: (keyof SynthState)[], curve: boolean) => {
    const kind = (k: string) => ids.filter((id) => (k === "box" ? PARAMS[id]!.kind === "range" && isBox(id) : k === "knob" ? PARAMS[id]!.kind === "range" && !isBox(id) : PARAMS[id]!.kind === k));
    return (
      <div className="mod-body">
        {/* an LFO's shape is shown whenever its controls are, so a lesson can point at it */}
        {(all || m.source?.startsWith("lfo")) && <Display module={m} synth={synth} note={note} />}
        {m.source?.startsWith("lfo") && s[`${m.source as "lfo1"}Shape`] !== "drawn" && (all || show.includes(`${m.source}Shape` as Panel)) && (
          <button className="link draw-own" title="Turns the current shape into sixteen bars you can drag to any height" onClick={() => {
            const id = m.source as "lfo1", shape = s[`${id}Shape`];
            // start from the shape that is there, so drawing changes it instead of starting from nothing
            const steps = Array.from({ length: LFO_STEPS }, (_, k) => Math.round(lfoValue(shape, (k + 0.5) / LFO_STEPS) * 8) / 8);
            synth.flag("lfoDraw"); synth.setState({ [`${id}Shape`]: "drawn", [`${id}Steps`]: steps } as Partial<SynthState>);
          }}>Draw your own shape</button>
        )}
        {m.id === "a" && s.freeHz !== null && (
          <p className="fixed-pitch">Osc A’s pitch is fixed by the Frequency knob in this lesson, so the keys, Octave, Semitone and Fine do not change it. <button className="link" onClick={() => synth.setState({ freeHz: null })}>Follow the keys instead</button></p>
        )}
        {m.id === "a" && s.freeHz === null && typeof lesson.initial?.freeHz === "number" && (
          <p className="fixed-pitch">Osc A is following the keys. This lesson’s steps need its pitch fixed. <button className="link" onClick={() => synth.setState({ freeHz: lesson.initial!.freeHz as number })}>Fix the pitch again</button></p>
        )}
        {curve && <FilterCurve synth={synth} note={note} spot />}
        {m.id === "fx-comp" && <Reduction synth={synth} />}
        {kind("menu").map((id) => <Control key={id} id={id} synth={synth} spot={show.includes(id)} />)}
        {kind("choice").map((id) => <Control key={id} id={id} synth={synth} spot={show.includes(id)} only={!all && id === "shape" ? lesson.shapes : undefined} />)}
        {kind("box").length > 0 && <div className="mod-row">{kind("box").map((id) => <Control key={id} id={id} synth={synth} spot={show.includes(id)} />)}</div>}
        {kind("knob").length > 0 && <div className="mod-row">{kind("knob").map((id) => <Control key={id} id={id} synth={synth} spot={show.includes(id)} />)}</div>}
      </div>
    );
  };
  const row = (modules: Module[], cls: string) => {
    // effects are shown in the order the sound passes through them
    if (cls === "fx") { const order = fxOrderOf(s.fxOrder); modules = [...modules].sort((a, b) => order.indexOf(a.id.slice(3) as FxId) - order.indexOf(b.id.slice(3) as FxId)); }
    const panels = modules.map((m) => ({ m, ids: idsOf(m), toggle: m.toggle && on(m.toggle) ? m.toggle : undefined, curve: m.id === "filter" && !all && show.includes("curve") }))
      .filter((x) => all || x.ids.length || x.toggle || x.curve);
    if (!panels.length) return null;
    return (
      <div className={`rack ${cls}${all ? " full" : ""}`}>
        {panels.map(({ m, ids, toggle, curve }) => {
          const off = !!m.toggle && !s[m.toggle];
          return (
            <section key={m.id} className={`mod mod-${m.id}${off && all ? " off" : ""}${m.color ? " neon" : ""}${idle(m) ? " idle" : ""}`} style={m.color ? ({ "--glow": m.color, "--period": period(m) } as React.CSSProperties) : undefined} aria-label={m.name}>
              {toggle ? (
                <label className={`mod-head${show.includes(toggle) ? " spot" : ""}`}>
                  <input type="checkbox" checked={!!s[toggle]} aria-label={PARAMS[toggle]!.label} onChange={(e) => synth.setState({ [toggle]: e.target.checked } as Partial<SynthState>)} />
                  <span>{m.name}</span><em>{s[toggle] ? "on" : "off"}</em>
                </label>
              ) : <div className="mod-head">{m.source && <Grip id={m.source} />}<span>{m.name}</span></div>}
              {all && cls === "fx" && (() => { const id = m.id.slice(3) as FxId, at = fxOrderOf(s.fxOrder).indexOf(id); return (
                <div className="fx-move" role="group" aria-label={`Where ${m.name} sits in the chain`}>
                  <button disabled={at === 0} aria-label={`Move ${m.name} earlier`} onClick={() => synth.setState({ fxOrder: moveFx(s.fxOrder, id, -1) })}>◀</button>
                  <span>{at + 1} of {FX_ORDER.length}</span>
                  <button disabled={at === FX_ORDER.length - 1} aria-label={`Move ${m.name} later`} onClick={() => synth.setState({ fxOrder: moveFx(s.fxOrder, id, 1) })}>▶</button>
                </div>
              ); })()}
              {body(m, ids, curve)}
            </section>
          );
        })}
      </div>
    );
  };
  const macros = MACRO_MODULES.filter((m, i) => all || (Object.keys(PARAMS) as Panel[]).some((id) => PARAMS[id as string]!.group === m.groups[0] && show.includes(id)) || show.includes(`macro${i + 1}Name` as Panel));

  // In a lesson step: only the panels that step needs, large.
  if (!all) return (
    <>
      {row(MODULES, "sources")}{row(MOD_MODULES, "mods")}{row(FX_MODULES, "fx")}
      {macros.length > 0 && <div className="rack macros">{macros.map((m) => <MacroPanel key={m.id} n={Number(m.id.slice(5))} color={m.color!} synth={synth} show={show} all={false} />)}</div>}
    </>
  );

  // The whole synth: three pages, as Serum has. Sources of movement share tabbed panels so it fits one screen.
  const group = (key: string, label: string, modules: Module[]) => {
    const m = modules.find((x) => x.id === tabs[key]) ?? modules[0]!;
    const count = (x: Module) => (x.source ? routes(s).filter((r) => r.source.id === x.source && r.amount !== 0).length : 0);
    return (
      <section className={`mod neon tabbed group-${key}${idle(m) ? " idle" : ""}`} style={{ "--glow": m.color, "--period": period(m) } as React.CSSProperties} aria-label={label}>
        <div className="mod-tabs" role="tablist" aria-label={label}>
          {modules.map((x) => (
            // not a <button>: browsers will not start a drag from inside one, and the handle lives in here
            <div key={x.id} role="tab" tabIndex={0} aria-selected={x.id === m.id} className={`mod-tab${x.id === m.id ? " on" : ""}`} style={{ "--glow": x.color } as React.CSSProperties}
              onClick={() => setTabs((t) => ({ ...t, [key]: x.id }))} onKeyDown={(e) => { if (e.key === "Enter" || e.key === " ") { e.preventDefault(); setTabs((t) => ({ ...t, [key]: x.id })); } }}>
              {x.source && <Grip id={x.source} />}{({ env1: "Env 1", vel: "Vel", key: "Key", wheel: "Wheel", voice: "Voice" } as Record<string, string>)[x.id] ?? x.name}{count(x) > 0 && <b title={`${count(x)} connection${count(x) === 1 ? "" : "s"}`}>{count(x)}</b>}
            </div>
          ))}
        </div>
        {body(m, idsOf(m), false)}
      </section>
    );
  };
  const mod = (id: string) => MOD_MODULES.find((m) => m.id === id)!;
  return (
    <>
      <div className="synth-tabs" role="tablist" aria-label="Synth pages">
        {([["synth", "Synth"], ["fx", "FX"], ["matrix", "Matrix"]] as const).map(([id, label]) => <button key={id} role="tab" aria-selected={page === id} className={page === id ? "on" : ""} onClick={() => setPage(id)}>{label}{id === "fx" && FX_ORDER.some((f) => s[`${f}On`]) && <b>{FX_ORDER.filter((f) => s[`${f}On`]).length}</b>}</button>)}
      </div>
      {page === "synth" && (
        <>
          {row(MODULES.filter((m) => m.id !== "voice"), "sources")}
          <div className="rack full modrow">
            <MacroGrid synth={synth} />
            {group("env", "Envelopes", [mod("env1"), mod("env2")])}
            {group("lfo", "LFOs", [mod("lfo1"), mod("lfo2"), mod("lfo3")])}
            {group("note", "From the keys", [mod("vel"), mod("key"), mod("wheel"), MODULES.find((m) => m.id === "voice")!])}
          </div>
        </>
      )}
      {page === "fx" && row(FX_MODULES, "fx")}
      {page === "matrix" && <Matrix synth={synth} />}
    </>
  );
}

/**
 * The macros as Serum places them: a small block at the bottom left, one compact knob each with its name
 * underneath and a handle to drag onto a knob. Clicking a name opens that macro's slots for editing.
 */
function MacroGrid({ synth }: { synth: Synth }) {
  const [editing, setEditing] = useState<number | null>(null);
  const s = synth.state as unknown as Record<string, string | number>;
  return (
    <section className="mod mod-macros" aria-label="Macros">
      <div className="mod-head"><span>Macros</span></div>
      <div className="mod-body">
        <div className="macro-grid">
          {MACROS.map((n) => {
            const used = MACRO_SLOTS.filter((k) => s[`macro${n}Dest${k}`] !== "none").length;
            return (
              <div key={n} className={`macro-cell${used ? "" : " idle"}`} style={{ "--glow": MACRO_COLORS[n - 1] } as React.CSSProperties}>
                <Grip id={`macro${n}`} />
                <Control id={`macro${n}` as keyof SynthState} synth={synth} spot={false} />
                <button className="macro-label" aria-expanded={editing === n} title="Name this macro and choose what it moves" onClick={() => setEditing(editing === n ? null : n)}>{(s[`macro${n}Name`] as string) || `Macro ${n}`}{used > 0 && <b>{used}</b>}</button>
              </div>
            );
          })}
        </div>
        {editing !== null && <MacroPanel n={editing} color={MACRO_COLORS[editing - 1]!} synth={synth} show={[]} all bare />}
      </div>
    </section>
  );
}

/**
 * One macro: its name, its knob, and three slots. Each slot is "send to this knob, by this much". The slots
 * are laid out as pairs so it is plain which amount belongs to which destination.
 */
function MacroPanel({ n, color, synth, show, all, bare }: { n: number; color: string; synth: Synth; show: Panel[]; all: boolean; bare?: boolean }) {
  const on = (id: string) => all || show.includes(id as Panel);
  const s = synth.state as unknown as Record<string, string | number>;
  const name = s[`macro${n}Name`] as string;
  const used = MACRO_SLOTS.some((k) => s[`macro${n}Dest${k}`] !== "none");
  return (
    <section className={`mod mod-macro neon${used ? "" : " idle"}${bare ? " bare" : ""}`} style={{ "--glow": color } as React.CSSProperties} aria-label={`Macro ${n}`}>
      {!bare && <div className="mod-head"><Grip id={`macro${n}`} /><span>{name || `Macro ${n}`}</span></div>}
      <div className="mod-body">
        {on(`macro${n}Name`) && (
          <label className={`pick menu${show.includes(`macro${n}Name` as Panel) ? " spot" : ""}`}>
            <span className="knob-name">name</span>
            <input className="macro-name" type="text" maxLength={18} value={name} aria-label={`Macro ${n} name`} onChange={(e) => synth.setState({ [`macro${n}Name`]: e.target.value } as Partial<SynthState>)} />
          </label>
        )}
        {on(`macro${n}`) && !bare && <div className="mod-row"><Control id={`macro${n}` as keyof SynthState} synth={synth} spot={show.includes(`macro${n}` as Panel)} /></div>}
        {MACRO_SLOTS.filter((k) => on(`macro${n}Dest${k}`) || on(`macro${n}Amt${k}`)).map((k) => (
          <div key={k} className="macro-slot">
            {on(`macro${n}Dest${k}`) && <Control id={`macro${n}Dest${k}` as keyof SynthState} synth={synth} spot={show.includes(`macro${n}Dest${k}` as Panel)} />}
            {on(`macro${n}Amt${k}`) && <Control id={`macro${n}Amt${k}` as keyof SynthState} synth={synth} spot={show.includes(`macro${n}Amt${k}` as Panel)} />}
          </div>
        ))}
      </div>
    </section>
  );
}

/**
 * The drawn LFO shape: sixteen bars. Drag across them to set each one's height; the middle line is the
 * knob's own setting, above it pushes the destination up and below it pushes it down.
 */
function LfoDraw({ id, synth }: { id: "lfo1" | "lfo2" | "lfo3"; synth: Synth }) {
  const steps = synth.state[`${id}Steps`];
  const drawing = useRef(false);
  const W = 200, H = 96, bar = W / LFO_STEPS;
  const paint = (e: React.PointerEvent<SVGSVGElement>) => {
    const box = e.currentTarget.getBoundingClientRect();
    const k = Math.min(LFO_STEPS - 1, Math.max(0, Math.floor(((e.clientX - box.left) / box.width) * LFO_STEPS)));
    // snap to eighths so two bars can be set to exactly the same height
    const v = Math.round(Math.min(1, Math.max(-1, 1 - (2 * (e.clientY - box.top)) / box.height)) * 8) / 8;
    if (steps[k] !== v) synth.setState({ [`${id}Steps`]: steps.map((old, i) => (i === k ? v : old)) } as Partial<SynthState>);
  };
  return (
    <svg className="mod-wave lfo-draw" viewBox={`0 0 ${W} ${H}`} preserveAspectRatio="none" role="img" aria-label="Drawn LFO shape: sixteen steps. Drag across the bars to set their heights."
      onPointerDown={(e) => { e.currentTarget.setPointerCapture(e.pointerId); drawing.current = true; synth.flag("lfoDraw"); paint(e); }}
      onPointerMove={(e) => { if (drawing.current) paint(e); }} onPointerUp={() => { drawing.current = false; }} onPointerCancel={() => { drawing.current = false; }}>
      {steps.map((v, k) => <rect key={k} className="lfo-bar" x={k * bar + 0.8} width={bar - 1.6} y={v >= 0 ? H / 2 - (v * H) / 2 : H / 2} height={Math.max(1.5, (Math.abs(v) * H) / 2)} />)}
      <line className="mod-mid" x1="0" x2={W} y1={H / 2} y2={H / 2} />
      <Playhead id={id} synth={synth} width={W} height={H} />
    </svg>
  );
}
