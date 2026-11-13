// The practice synth drawn as a rack of module panels, in the order the sound flows and the order most
// wavetable synths (Serum included) lay them out: sub, oscillator A, oscillator B, noise, filter. Each panel
// has its on/off switch and name on top, a picture of what it is doing, and its controls underneath.
import { useMemo } from "react";
import type { Panel, PlayableLesson } from "../../course/types";
import { adsr, ENV1_COLOR, envLevel, lfoValue, SOURCES, type Adsr, type ModSource } from "../../synth/mod";
import { harmonic, harmonicsA, HARMONICS, PARAMS, type Group, type SynthState } from "../../synth/params";
import type { Synth } from "../../synth/useSynth";
import { Control, isBox } from "./Controls";
import { FilterCurve } from "./Views";

export interface Module { id: string; name: string; groups: Group[]; toggle?: keyof SynthState; color?: string; source?: ModSource }
export const MODULES: Module[] = [
  { id: "sub", name: "Sub", groups: ["Sub"], toggle: "subOn" },
  { id: "a", name: "Osc A", groups: ["Oscillator A", "Unison"] },
  { id: "b", name: "Osc B", groups: ["Oscillator B"], toggle: "bOn" },
  { id: "noise", name: "Noise", groups: ["Noise"], toggle: "noiseOn" },
  { id: "filter", name: "Filter", groups: ["Filter"], toggle: "filterOn" },
];

/** The row underneath, where Serum also keeps them: the envelopes and LFOs, each in its own neon colour. */
export const MOD_MODULES: Module[] = [
  { id: "env1", name: "Env 1 · level", groups: ["Envelope 1"], color: ENV1_COLOR },
  ...SOURCES.map((x) => ({ id: x.id, name: x.name, groups: [x.kind === "env" ? "Envelope 2" : `LFO ${x.id.slice(3)}`] as Group[], color: x.color, source: x.id })),
];

/** An envelope drawn from its settings: a note held for a moment, then let go. */
export function envPath(e: Adsr, w = 200, height = 64, points = 120): string {
  const held = e.attack + e.decay + 0.25 * Math.max(0.2, e.attack + e.decay), total = held + e.release * 1.1 + 0.02;
  return Array.from({ length: points + 1 }, (_, i) => `${i === 0 ? "M" : "L"}${((i / points) * w).toFixed(1)} ${(height - 5 - envLevel(e, (i / points) * total, held) * (height - 10)).toFixed(1)}`).join(" ");
}
/** Two cycles of an LFO shape. */
export function lfoPath(shape: SynthState["lfo1Shape"], w = 200, height = 64, points = 160): string {
  return Array.from({ length: points + 1 }, (_, i) => `${i === 0 ? "M" : "L"}${((i / points) * w).toFixed(1)} ${(height / 2 - lfoValue(shape, (i / points) * 2 - 1e-9) * (height / 2 - 6)).toFixed(1)}`).join(" ");
}

/** One cycle of a wave, drawn from its harmonics and start phase: the same recipe the sound is made from. */
export function wavePath(h: ArrayLike<number>, phaseCycles: number, w = 200, height = 64, points = 160): string {
  const ys: number[] = [];
  let peak = 1e-9;
  for (let i = 0; i <= points; i++) {
    const t = i / points + phaseCycles;
    let y = 0;
    for (let n = 1; n < h.length; n++) if (h[n]) y += h[n]! * Math.sin(2 * Math.PI * n * t);
    ys.push(y); peak = Math.max(peak, Math.abs(y));
  }
  return ys.map((y, i) => `${i === 0 ? "M" : "L"}${((i / points) * w).toFixed(1)} ${(height / 2 - (y / peak) * (height / 2 - 5)).toFixed(1)}`).join(" ");
}
const shapeHarmonics = (shape: SynthState["bShape"]) => Array.from({ length: HARMONICS + 1 }, (_, n) => (n ? harmonic(shape, n) : 0));
const SINE = [0, 1];
/** A fixed scribble standing for noise: it has no shape to draw. */
const NOISE_PATH = Array.from({ length: 67 }, (_, i) => `${i === 0 ? "M" : "L"}${i * 3} ${(32 + Math.sin(i * 12.9898) * Math.cos(i * 78.233) * 24).toFixed(1)}`).join(" ");

function Display({ module, synth, note }: { module: Module; synth: Synth; note: number | null }) {
  const s = synth.state;
  const d = useMemo(() => {
    if (module.id === "a") return wavePath(harmonicsA(s), s.phase / 360);
    if (module.id === "b") return wavePath(shapeHarmonics(s.bShape), s.bPhase / 360);
    if (module.id === "sub") return wavePath(SINE, 0);
    if (module.id === "env1") return envPath(adsr(s, 1));
    if (module.id === "env2") return envPath(adsr(s, 2));
    if (module.source) return lfoPath(s[`${module.source as "lfo1"}Shape`]);
    return NOISE_PATH;
  }, [module, s.shape, s.table, s.position, s.phase, s.bShape, s.bPhase, s.envA, s.envD, s.envS, s.envR, s.env2A, s.env2D, s.env2S, s.env2R, s.lfo1Shape, s.lfo2Shape, s.lfo3Shape]); // eslint-disable-line react-hooks/exhaustive-deps
  if (module.id === "filter") return <FilterCurve synth={synth} note={note} compact />;
  return <svg className="mod-wave" viewBox="0 0 200 64" preserveAspectRatio="none" role="img" aria-label={`${module.name} wave`}><path d={d} /></svg>;
}

export function Rack({ synth, show, all, lesson, note }: { synth: Synth; show: Panel[]; all: boolean; lesson: PlayableLesson; note: number | null }) {
  const on = (p: Panel) => all || show.includes(p);
  const s = synth.state;
  const row = (modules: Module[], cls: string) => {
  const panels = modules.map((m) => {
    const ids = (Object.keys(PARAMS) as (keyof SynthState)[]).filter((id) => m.groups.includes(PARAMS[id]!.group) && id !== m.toggle && on(id) && (id !== "freeHz" || s.freeHz !== null));
    const toggle = m.toggle && on(m.toggle) ? m.toggle : undefined;
    const curve = m.id === "filter" && !all && show.includes("curve");
    return { m, ids, toggle, curve };
  }).filter((x) => all || x.ids.length || x.toggle || x.curve);
  if (!panels.length) return null;
  return (
    <div className={`rack ${cls}${all ? " full" : ""}`}>
      {panels.map(({ m, ids, toggle, curve }) => {
        const off = !!m.toggle && !s[m.toggle];
        const kind = (k: string) => ids.filter((id) => (k === "box" ? PARAMS[id]!.kind === "range" && isBox(id) : k === "knob" ? PARAMS[id]!.kind === "range" && !isBox(id) : PARAMS[id]!.kind === k));
        return (
          <section key={m.id} className={`mod mod-${m.id}${off && all ? " off" : ""}${m.color ? " neon" : ""}${idle(m) ? " idle" : ""}`} style={m.color ? ({ "--glow": m.color } as React.CSSProperties) : undefined} aria-label={m.name}>
            {toggle ? (
              <label className={`mod-head${show.includes(toggle) ? " spot" : ""}`}>
                <input type="checkbox" checked={!!s[toggle]} aria-label={PARAMS[toggle]!.label} onChange={(e) => synth.setState({ [toggle]: e.target.checked } as Partial<SynthState>)} />
                <span>{m.name}</span><em>{s[toggle] ? "on" : "off"}</em>
              </label>
            ) : <div className="mod-head"><span>{m.name}</span></div>}
            <div className="mod-body">
              {all && <Display module={m} synth={synth} note={note} />}
              {curve && <FilterCurve synth={synth} note={note} spot />}
              {kind("menu").map((id) => <Control key={id} id={id} synth={synth} spot={show.includes(id)} />)}
              {kind("choice").map((id) => <Control key={id} id={id} synth={synth} spot={show.includes(id)} only={!all && id === "shape" ? lesson.shapes : undefined} />)}
              {kind("box").length > 0 && <div className="mod-row">{kind("box").map((id) => <Control key={id} id={id} synth={synth} spot={show.includes(id)} />)}</div>}
              {kind("knob").length > 0 && <div className="mod-row">{kind("knob").map((id) => <Control key={id} id={id} synth={synth} spot={show.includes(id)} />)}</div>}
            </div>
          </section>
        );
      })}
    </div>
  );
  };
  /** A source that is not sent anywhere yet. */
  const idle = (m: Module) => !!m.source && s[`${m.source}Dest`] === "none";
  return <>{row(MODULES, "sources")}{row(MOD_MODULES, "mods")}</>;
}
