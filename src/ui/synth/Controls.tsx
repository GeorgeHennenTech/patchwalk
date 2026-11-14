import { useEffect, useRef, useState } from "react";
import { BOX_IDS, DEST_NAMES, FAST_DESTS, fromTravel, INITIAL, MOD_DESTS, PARAMS, SLOW_DESTS, toTravel, type ParamSpec, type SynthState } from "../../synth/params";
import { slotPush, slotsTo } from "../../synth/macros";
import { connect, currentDrag, dragName, endDrag } from "../../synth/connect";
import { routes, routesTo, SOURCES, withRouteAmount, type Route } from "../../synth/mod";
import { clickVelocity, KEY_MAP, type Synth } from "../../synth/useSynth";

const fmt = (id: string, v: number) => {
  const unit = PARAMS[id]!.unit ?? "";
  if (id === "freeHz") return `${Math.round(v)} Hz`;
  if (unit === "ms") return v >= 1000 ? `${(v / 1000).toFixed(2)} s` : `${Math.round(v)} ms`;
  if (id.endsWith("Rate")) return `${v.toFixed(2)} Hz`;
  if (id.endsWith("Amount") && v > 0) return `+${v}%`;
  if (id === "cutoff") return v >= 1000 ? `${(v / 1000).toFixed(v >= 10000 ? 1 : 2)} kHz` : `${Math.round(v)} Hz`;
  const signed = ["octave", "semitone", "fine", "bOctave", "bSemitone", "bFine"].includes(id) && v > 0 ? "+" : "";
  return `${signed}${v}${unit === "%" || unit === "°" ? unit : unit ? ` ${unit}` : ""}`;
};

/** The name printed under a control. Its module panel already says which oscillator or section it belongs to. */
export const shortLabel = (label: string) => label.replace(/^(A|B|Sub|Noise|Filter|Wave|Env \d|LFO \d|Velocity|Key position|Mod wheel|Distortion|EQ|Compressor|Chorus|Delay|Reverb|Macro \d slot \d) /, "");

/** Settings shown as a small number box (a few whole steps) and not as a knob. */
const BOXES = new Set<string>(BOX_IDS);
export const isBox = (id: keyof SynthState) => BOXES.has(id);

const clamp01 = (x: number) => Math.min(1, Math.max(0, x));
export { fromTravel, toTravel };
/** One press of an arrow key: the smallest step, or about 1% for wide-ranging settings. `big` is ten times that. */
export function nudge(spec: ParamSpec, v: number, dir: 1 | -1, big: boolean): number {
  const step = spec.step ?? 1;
  const size = spec.log ? Math.max(step, Math.round((v * (big ? 0.1 : 0.01)) / step) * step) : step * (big ? 10 : 1);
  return tidy(Math.min(spec.max!, Math.max(spec.min!, v + dir * size)));
}
/** Steps smaller than one (an LFO's rate) must not pick up stray digits from floating-point sums. */
const tidy = (v: number) => Number(v.toFixed(4));

const SWEEP = 270; // degrees a knob turns from minimum to maximum
const point = (deg: number, r: number) => { const a = ((deg - 90) * Math.PI) / 180; return `${(24 + r * Math.cos(a)).toFixed(2)} ${(24 + r * Math.sin(a)).toFixed(2)}`; };
const degrees = (travel: number) => -SWEEP / 2 + clamp01(travel) * SWEEP;
/** The stretch of a knob's travel one source sweeps it across: both ways for an LFO, one way for an envelope. */
export function ringSpan(travel: number, amount: number, kind: "env" | "lfo"): [number, number] {
  const reach = amount / 200;
  return kind === "lfo" ? [clamp01(travel - Math.abs(reach)), clamp01(travel + Math.abs(reach))] : [clamp01(Math.min(travel, travel + reach)), clamp01(Math.max(travel, travel + reach))];
}
const arc = (from: number, to: number, r: number) => {
  const [a, b] = from <= to ? [from, to] : [to, from];
  return `M ${point(a, r)} A ${r} ${r} 0 ${b - a > 180 ? 1 : 0} 1 ${point(b, r)}`;
};

/**
 * The destination menu, grouped: first the ones moved inside the sound itself, then every other knob by the
 * panel it lives on. Used by each source's "sends to" menu and by the matrix.
 */
export function DestOptions() {
  const groups: Record<string, string[]> = {};
  for (const id of SLOW_DESTS) (groups[PARAMS[id]!.group] ??= []).push(id);
  return (
    <>
      <option value="none">{DEST_NAMES.none}</option>
      <optgroup label="Smoothest (moved inside the sound)">{FAST_DESTS.filter((d) => d !== "none").map((d) => <option key={d} value={d}>{DEST_NAMES[d]}</option>)}</optgroup>
      {Object.entries(groups).map(([group, ids]) => <optgroup key={group} label={group}>{ids.map((d) => <option key={d} value={d}>{DEST_NAMES[d]}</option>)}</optgroup>)}
    </>
  );
}

/**
 * The small coloured handle a knob wears for each source that moves it. Drag it up or down (or click it and
 * use the arrow keys) to set how far that source moves this knob, without going to the source's panel.
 * Double-click sets it to zero.
 */
function DepthHandle({ route, label, synth, onShow }: { route: Route; label: string; synth: Synth; onShow: (text: string | null) => void }) {
  const drag = useRef<{ y: number; amount: number } | null>(null);
  const text = (amount: number) => `${route.source.name} ${amount > 0 ? "+" : ""}${amount}%`;
  const set = (amount: number) => { const v = Math.max(-100, Math.min(100, Math.round(amount))); synth.flag("depth"); synth.setState(withRouteAmount(synth.state, route.key, v)); onShow(text(v)); };
  return (
    <i className="depth" role="slider" tabIndex={0} style={{ background: route.source.color, color: route.source.color }}
      aria-label={`${route.source.name} amount on ${label}`} aria-orientation="vertical" aria-valuemin={-100} aria-valuemax={100} aria-valuenow={route.amount} aria-valuetext={text(route.amount)}
      title={`${text(route.amount)}: drag up or down to set how far ${route.source.name} moves ${label}. Double-click for zero.`}
      onPointerDown={(e) => { e.stopPropagation(); e.currentTarget.setPointerCapture(e.pointerId); e.currentTarget.focus(); drag.current = { y: e.clientY, amount: route.amount }; onShow(text(route.amount)); }}
      onPointerMove={(e) => { if (!drag.current) return; e.stopPropagation(); set(drag.current.amount + (drag.current.y - e.clientY) / (e.shiftKey ? 6 : 1.2)); }}
      onPointerUp={(e) => { e.stopPropagation(); drag.current = null; }} onPointerCancel={() => { drag.current = null; }}
      onDoubleClick={(e) => { e.stopPropagation(); set(0); }}
      onFocus={() => onShow(text(route.amount))} onBlur={() => onShow(null)}
      onKeyDown={(e) => {
        const step = e.shiftKey ? 10 : 1, by = e.key === "ArrowUp" || e.key === "ArrowRight" ? step : e.key === "ArrowDown" || e.key === "ArrowLeft" ? -step : e.key === "PageUp" ? 10 : e.key === "PageDown" ? -10 : 0;
        if (e.key.startsWith("Arrow") || e.key.startsWith("Page") || e.key === "Home" || e.key === "End") { e.stopPropagation(); e.preventDefault(); }
        if (by) set(route.amount + by); else if (e.key === "Home") set(-100); else if (e.key === "End") set(100);
      }} />
  );
}

/**
 * The moving pointer on a knob that a source is moving: a coloured line and dot that follow where the
 * sources have put the knob at this instant, redrawn every frame. The knob's own pointer stays where the
 * learner left it. Updated directly on the page, so a moving knob does not redraw the whole synth.
 */
function LivePointer({ id, spec, synth, color }: { id: keyof SynthState; spec: ParamSpec; synth: Synth; color: string }) {
  const line = useRef<SVGPathElement>(null), dot = useRef<SVGCircleElement>(null);
  const live = useRef(synth.live);
  live.current = synth.live;
  useEffect(() => {
    let frame = 0;
    const loop = () => {
      const deg = degrees(toTravel(spec, live.current()[id] as number));
      line.current?.setAttribute("d", `M ${point(deg, 4)} L ${point(deg, 14)}`);
      const [x, y] = point(deg, 20).split(" ");
      dot.current?.setAttribute("cx", x!); dot.current?.setAttribute("cy", y!);
      frame = requestAnimationFrame(loop);
    };
    frame = requestAnimationFrame(loop);
    return () => cancelAnimationFrame(frame);
  }, [id, spec]);
  return <g className="knob-live" style={{ stroke: color, fill: color }}><path ref={line} /><circle ref={dot} r="2.8" /></g>;
}

/**
 * A knob (or, for a few whole-step settings, a number box). Drag up and down to turn it freely; hold Shift
 * while dragging for fine movement. Click it and use the arrow keys for exact steps (Shift or Page Up/Down
 * for bigger ones, Home/End for the ends). Double-click returns it to its starting value.
 */
function Knob({ id, synth, spot }: { id: keyof SynthState; synth: Synth; spot: boolean }) {
  const spec = PARAMS[id]!;
  const value = (synth.state[id] ?? spec.min!) as number;
  const box = isBox(id);
  const drag = useRef<{ y: number; travel: number; moved: boolean } | null>(null);
  const [depthText, setDepthText] = useState<string | null>(null);
  /** While a source is being dragged over this knob: whether it can be dropped here, and what to say. */
  const [over, setOver] = useState<{ ok: boolean; text: string } | null>(null);
  const offer = () => { const d = currentDrag(); return d ? connect(synth.state, d, id as string) : null; };
  const set = (v: number) => { if (v !== synth.state[id]) synth.setState({ [id]: v } as Partial<SynthState>); };
  const steps = (spec.max! - spec.min!) / (spec.step ?? 1);
  const pixels = box ? Math.max(60, steps * 14) : 170; // drag distance for the whole travel
  const onKey = (e: React.KeyboardEvent) => {
    const big = e.shiftKey;
    const next = e.key === "ArrowUp" || e.key === "ArrowRight" ? nudge(spec, value, 1, big)
      : e.key === "ArrowDown" || e.key === "ArrowLeft" ? nudge(spec, value, -1, big)
      : e.key === "PageUp" ? nudge(spec, value, 1, true) : e.key === "PageDown" ? nudge(spec, value, -1, true)
      : e.key === "Home" ? spec.min! : e.key === "End" ? spec.max! : null;
    if (next === null) return;
    e.preventDefault();
    set(next);
  };
  const reset = () => { const v = INITIAL[id]; if (typeof v === "number") set(v); };
  const t = toTravel(spec, value);
  const angle = -SWEEP / 2 + t * SWEEP;
  const mods = routesTo(synth.state, id);
  // handles are kept for connections at zero too, so one can be dragged through zero and brought back
  const handles = routes(synth.state).filter((r) => r.dest === id);
  const slots = slotsTo(synth.state, id);
  const lit = mods.length + slots.length > 0;
  // where the macros have actually put this knob, when that differs from where it was left
  const played = slots.length ? toTravel(spec, synth.effective[id] as number) : t;
  const zero = spec.min! < 0 && spec.max! > 0 ? -SWEEP / 2 + toTravel(spec, 0) * SWEEP : -SWEEP / 2;
  return (
    <div className={`${box ? "nbox" : "knob"}${spot ? " spot" : ""}${lit ? " moved" : ""}${over ? (over.ok ? " drop-yes" : " drop-no") : ""}`}
      onDragEnter={() => { const c = offer(); if (c) setOver(c.ok ? { ok: true, text: `Drop to connect ${dragName(currentDrag()!)}` } : { ok: false, text: c.why }); }}
      onDragOver={(e) => { const c = offer(); if (c?.ok) { e.preventDefault(); e.dataTransfer.dropEffect = "link"; } }}
      onDragLeave={() => setOver(null)}
      onDrop={(e) => { e.preventDefault(); const c = offer(); setOver(null); endDrag(); if (c?.ok) { synth.flag("dropped"); synth.setState(c.change); } }} style={lit ? ({ "--glow": mods[0]?.source.color ?? slots[0]!.color } as React.CSSProperties) : undefined} role="slider" tabIndex={0} aria-label={spec.label} aria-orientation="vertical"
      aria-valuemin={spec.min} aria-valuemax={spec.max} aria-valuenow={value} aria-valuetext={fmt(id, value)}
      title={`${spec.label}: ${box ? "click the right half to go up and the left half to go down, drag up or down, or use the arrow keys" : "drag up or down, or click and use the arrow keys"}. Double-click to reset.${lit ? ` Moved by ${[...mods.map((m) => m.source.name), ...slots.map((m) => m.name)].join(" and ")}.` : ""}`}
      onKeyDown={onKey} onDoubleClick={reset}
      onPointerDown={(e) => { e.currentTarget.setPointerCapture(e.pointerId); e.currentTarget.focus(); drag.current = { y: e.clientY, travel: t, moved: false }; }}
      onPointerMove={(e) => {
        if (!drag.current) return;
        if (Math.abs(drag.current.y - e.clientY) > 3) drag.current.moved = true;
        const moved = (drag.current.y - e.clientY) / pixels;
        set(fromTravel(spec, drag.current.travel + (e.shiftKey ? moved / 8 : moved)));
      }}
      onPointerUp={(e) => {
        // a number box also steps with a plain click: the right half goes up, the left half down
        if (box && drag.current && !drag.current.moved) { const r = e.currentTarget.getBoundingClientRect(); set(nudge(spec, value, e.clientX > r.left + r.width / 2 ? 1 : -1, false)); }
        drag.current = null;
      }} onPointerCancel={() => { drag.current = null; }}>
      {!box && (
        <svg viewBox="-6 -6 60 60" aria-hidden>
          {mods.map((m, i) => {
            const [from, to] = ringSpan(t, m.amount, m.oneWay ? "env" : "lfo");
            return <path key={m.key} className="knob-ring" style={{ stroke: m.source.color, filter: `drop-shadow(0 0 2.5px ${m.source.color})` }} d={arc(degrees(from), Math.max(degrees(to), degrees(from) + 1), 24.5 + i * 3.4)}><title>{`${m.source.name} moves this`}</title></path>;
          })}
          {slots.map((m, i) => {
            // a macro's ring: dim across everything it could reach, bright as far as it is turned up now
            const r = 24.5 + (mods.length + i) * 3.4, reach = t + m.amount / 100, now = t + slotPush(m);
            return (
              <g key={`${m.macro}-${m.slot}`} style={{ stroke: m.color }}>
                <path className="knob-ring reach" d={arc(degrees(Math.min(t, reach)), Math.max(degrees(Math.max(t, reach)), degrees(Math.min(t, reach)) + 1), r)}><title>{`${m.name} can move this`}</title></path>
                {m.value > 0 && <path className="knob-ring" style={{ filter: `drop-shadow(0 0 2.5px ${m.color})` }} d={arc(degrees(Math.min(t, now)), Math.max(degrees(Math.max(t, now)), degrees(Math.min(t, now)) + 1), r)} />}
              </g>
            );
          })}
          <path className="knob-track" d={arc(-SWEEP / 2, SWEEP / 2, 20)} />
          {angle !== zero && <path className="knob-value" d={arc(zero, angle, 20)} />}
          <circle className="knob-rim" cx="24" cy="24" r="15.4" />
          <circle className="knob-cap" cx="24" cy="24" r="14" />
          <ellipse className="knob-shine" cx="20.5" cy="18.5" rx="7" ry="4.2" transform="rotate(-28 20.5 18.5)" />
          <path className="knob-mark" d={`M ${point(angle, 5)} L ${point(angle, 13)}`} />
          {mods.length > 0 && <LivePointer id={id} spec={spec} synth={synth} color={mods[0]!.source.color} />}
          {played !== t && <circle className="knob-played" cx={point(degrees(played), 20).split(" ")[0]} cy={point(degrees(played), 20).split(" ")[1]} r="2.6"><title>Where the macros have put it</title></circle>}
        </svg>
      )}
      {/* every source moving this knob gets a handle here: its depth can be set without leaving the knob */}
      {handles.length > 0 && <span className="depths">{handles.map((m) => <DepthHandle key={m.key} route={m} label={spec.label} synth={synth} onShow={setDepthText} />)}</span>}
      <span className="knob-name">{shortLabel(spec.label)}</span>
      <output>{over?.text ?? depthText ?? fmt(id, value)}</output>
    </div>
  );
}

/** One control for any setting: a knob or number box, a set of choices, or an on/off switch, from its spec. */
export function Control({ id, synth, spot, only }: { id: keyof SynthState; synth: Synth; spot: boolean; only?: readonly string[] }) {
  const spec = PARAMS[id]!;
  if (spec.kind === "toggle") {
    return (
      <label className={`ctl toggle${spot ? " spot" : ""}`}>
        <input type="checkbox" checked={!!synth.state[id]} onChange={(e) => synth.setState({ [id]: e.target.checked } as Partial<SynthState>)} />
        <span className="ctl-name">{spec.label}</span>
      </label>
    );
  }
  if (spec.kind === "menu") {
    return (
      <label className={`pick menu${spot ? " spot" : ""}`}>
        <span className="knob-name">{shortLabel(spec.label)}</span>
        {/* blur after choosing so the letter keys go back to playing notes */}
        <select value={String(synth.state[id])} aria-label={spec.label} onChange={(e) => { synth.setState({ [id]: e.target.value } as Partial<SynthState>); e.target.blur(); }}>
          {spec.choices === MOD_DESTS ? <DestOptions /> : spec.choices!.map((c) => <option key={c} value={c}>{spec.names?.[c] ?? c}</option>)}
        </select>
      </label>
    );
  }
  if (spec.kind === "choice") {
    const two = id === "shape" && only?.length === 2;
    const names: Record<string, string> = two ? { sine: "Pure tone", saw: "Bright tone" } : (spec.names ?? {});
    return (
      <div className={`pick${spot ? " spot" : ""}`}>
        <span className="knob-name">{two ? "Tone" : shortLabel(spec.label)}</span>
        <div className="seg" role="radiogroup" aria-label={spec.label}>
          {(id === "shape" && only ? only : spec.choices!).map((c) => (
            <button key={c} role="radio" aria-checked={synth.state[id] === c} className={synth.state[id] === c ? "on" : ""} onClick={() => synth.setState({ [id]: c } as Partial<SynthState>)}>{names[c] ?? c}</button>
          ))}
        </div>
      </div>
    );
  }
  return <Knob id={id} synth={synth} spot={spot} />;
}

const WHITE = [0, 2, 4, 5, 7, 9, 11];

/**
 * A wheel beside the keyboard, as on a real one. `spring` is the bend wheel: it runs -1 to 1 and returns to
 * the middle when let go. Without it, it is the mod wheel: 0 to 1, and it stays where it is left.
 */
export function Wheel({ label, value, spring, color, onChange, text }: { label: string; value: number; spring?: boolean; color?: string; onChange: (v: number) => void; text: string }) {
  const ref = useRef<HTMLDivElement>(null), dragging = useRef(false);
  const lo = spring ? -1 : 0;
  const at = (e: React.PointerEvent) => { const b = ref.current!.getBoundingClientRect(); return lo + (1 - Math.min(1, Math.max(0, (e.clientY - b.top) / b.height))) * (1 - lo); };
  const end = () => { if (dragging.current) { dragging.current = false; if (spring) onChange(0); } };
  const step = spring ? 0.25 : 0.05;
  return (
    <div className={`wheel${spring ? " spring" : ""}`} style={color ? ({ "--glow": color } as React.CSSProperties) : undefined}>
      <div ref={ref} className="wheel-track" role="slider" tabIndex={0} aria-label={label} aria-orientation="vertical" aria-valuemin={lo * 100} aria-valuemax={100} aria-valuenow={Math.round(value * 100)} aria-valuetext={text} title={`${label}: drag up or down${spring ? "; it springs back when you let go" : ""}`}
        onPointerDown={(e) => { e.currentTarget.setPointerCapture(e.pointerId); dragging.current = true; onChange(at(e)); }}
        onPointerMove={(e) => { if (dragging.current) onChange(at(e)); }} onPointerUp={end} onPointerCancel={end}
        onKeyDown={(e) => { if (e.key === "ArrowUp" || e.key === "ArrowDown") { e.preventDefault(); onChange(Math.min(1, Math.max(lo, value + (e.key === "ArrowUp" ? step : -step)))); } else if (e.key === "Home") { e.preventDefault(); onChange(spring ? 0 : lo); } }}
        onKeyUp={(e) => { if (spring && (e.key === "ArrowUp" || e.key === "ArrowDown")) onChange(0); }}>
        <i style={{ bottom: `${((value - lo) / (1 - lo)) * 100}%` }} />
      </div>
      <span className="wheel-name">{label}</span><span className="wheel-value">{text}</span>
    </div>
  );
}

export function Keyboard({ synth, from = 48, octaves = 3, wheels = false }: { synth: Synth; from?: number; octaves?: number; wheels?: boolean }) {
  const pressed = useRef<number | null>(null);
  // Z and X move the whole keyboard by octaves: the keys on screen, the letters on them, and what a click plays.
  const first = from + 12 * synth.keyOctave;
  const notes = Array.from({ length: octaves * 12 + 1 }, (_, i) => first + i);
  const LABEL = Object.fromEntries(Object.entries(KEY_MAP).map(([k, n]) => [n + 12 * synth.keyOctave, k.toUpperCase()]));
  const shown = LABEL[first] !== undefined || Object.keys(LABEL).some((n) => notes.includes(Number(n)));
  const whites = notes.filter((n) => WHITE.includes(n % 12));
  const release = () => { if (pressed.current !== null) { synth.noteOff(pressed.current); pressed.current = null; } };
  useEffect(() => { window.addEventListener("pointerup", release); return () => window.removeEventListener("pointerup", release); });
  // Lower on the key strikes harder, as on many on-screen keyboards.
  const press = (n: number, e: React.PointerEvent<HTMLButtonElement>) => {
    const box = e.currentTarget.getBoundingClientRect();
    release(); pressed.current = n; synth.noteOn(n, "mouse", clickVelocity((e.clientY - box.top) / box.height));
  };
  return (
    <div className="keys-wrap">
    <div className="keys-row">
    {wheels && (
      <div className="wheels" role="group" aria-label="Wheels">
        <Wheel label="Bend" spring value={synth.bend} onChange={synth.setBend} text={`${synth.bend >= 0 ? "+" : "-"}${Math.abs(synth.bend * synth.state.bendRange).toFixed(1)} st`} />
        <Wheel label="Mod" value={synth.state.wheel / 100} color={SOURCES.find((x) => x.id === "wheel")!.color} onChange={(v) => synth.setState({ wheel: Math.round(v * 100) })} text={`${synth.state.wheel}%`} />
      </div>
    )}
    <div className={`keys${synth.running ? "" : " off"}`} role="group" aria-label="Keyboard">
      {whites.map((n, i) => {
        const black = notes.includes(n + 1) && !WHITE.includes((n + 1) % 12) ? n + 1 : null;
        return (
          <div key={n} className="key-slot" style={{ width: `${100 / whites.length}%` }}>
            <button className={`key white${synth.held.includes(n) ? " down" : ""}`} onPointerDown={(e) => press(n, e)} aria-label={`Note ${n}`}>{LABEL[n] && <span>{LABEL[n]}</span>}{n % 12 === 0 && <em>C{n / 12 - 1}</em>}</button>
            {black !== null && i < whites.length - 1 && (
              <button className={`key black${synth.held.includes(black) ? " down" : ""}`} onPointerDown={(e) => press(black, e)} aria-label={`Note ${black}`}>{LABEL[black] && <span>{LABEL[black]}</span>}</button>
            )}
          </div>
        );
      })}
    </div>
    </div>
    {synth.state.freeHz !== null && <p className="keys-hint fixed" role="note">In this lesson every key plays the same pitch: the Frequency knob sets it, so the keys, octave and semitone do not change the note.</p>}
    <p className="keys-hint" role="status">Computer keys: <kbd>Z</kbd> octave down, <kbd>X</kbd> octave up, <kbd>C</kbd> softer, <kbd>V</kbd> harder (now {synth.keyVelocity} of 127). With the mouse, click lower on a key to strike harder.{synth.keyOctave !== 0 && ` Now ${synth.keyOctave > 0 ? "+" : ""}${synth.keyOctave} octave${Math.abs(synth.keyOctave) === 1 ? "" : "s"}${shown ? "" : " (beyond the keys drawn here)"}.`}</p>
    {wheels && (
      <div className="keys-hint midi" role="status">
        {synth.midi.status === "on" ? <>MIDI keyboard connected: {synth.midi.name}. Its keys, mod wheel and bend wheel play the synth.</>
          : <><button className="link" onClick={() => void synth.connectMidi()}>Connect a MIDI keyboard</button>{synth.midi.status === "none" && " No keyboard found yet: plug one in and it will be picked up."}{synth.midi.status === "unsupported" && " This browser cannot use MIDI keyboards; Chrome and Edge can."}{synth.midi.status === "refused" && " The browser did not allow it. Allow MIDI for this site and try again."}</>}
        <details className="midi-how">
          <summary>How to connect one</summary>
          <ol>
            <li>Plug the keyboard into this computer with its USB cable and switch it on. (An older keyboard with round five-pin MIDI sockets needs a USB MIDI interface in between.)</li>
            <li>Use Chrome or Edge on a computer. Safari, and browsers on an iPhone or iPad, cannot use MIDI keyboards.</li>
            <li>Press <b>Start audio</b>, then <b>Connect a MIDI keyboard</b> above.</li>
            <li>The browser asks whether this site may use your MIDI devices. Choose <b>Allow</b>.</li>
            <li>The line above now names your keyboard. Play a key: its keys, its mod wheel and its pitch-bend wheel all play the synth, and how hard you strike is the velocity.</li>
          </ol>
          <p>If nothing happens: unplug the keyboard and plug it in again (it is picked up without reloading), close other music programs that may be using it, and check the site's permissions (the icon at the left of the address bar) to see that MIDI is allowed. You only have to allow it once; after that, one click on the link reconnects it.</p>
        </details>
      </div>
    )}
    </div>
  );
}
