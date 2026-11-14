// Funktion-One's Res 2 as a model you can turn: its three horns, which one a frequency comes out of, and how
// wide its sound spreads. The outside follows the maker's dimensioned drawing; the insides are not published,
// so the drivers are shown only as stand-ins of the stated sizes.
import { useEffect, useRef, useState } from "react";
import * as THREE from "three";
import { BAND_TEXT, bandAt, LANDMARKS, noteNear, OPENINGS, RES2, RES2_PARTS, spread, type Res2Band } from "../soundsystems/res2";
import { paint, paper, shadowed, sign, steel, studio } from "./three/look";
import { makeStage, type Stage } from "./three/stage";

const { front: W, back: WB, height: H, depth: D } = RES2;
const BASE = 0.9;          // the cabinet stands on a plinth this high (illustrative)
const T = 0.018;           // panel thickness (illustrative)
const GLOW = "#ff2e93", GREY = "#b4b7bd";
const toHz = (v: number) => 20 * Math.pow(1000, v), toV = (hz: number) => Math.log(hz / 20) / Math.log(1000);
const hzText = (hz: number) => (hz >= 1000 ? `${(hz / 1000).toFixed(hz >= 10000 ? 0 : 1)} kHz` : `${Math.round(hz)} Hz`);
/** A point on the front, from metres across and down the drawing, to model space (x right, y up, z towards the listener). */
const px = (x: number) => x - W / 2, py = (y: number) => BASE + H - y;

/** A horn seen from the front: four sloping walls from a mouth to a smaller throat `depth` behind it, and a back to the throat. */
function hornGeometry(m: { x0: number; x1: number; y0: number; y1: number }, t: { x0: number; x1: number; y0: number; y1: number }, depth: number): THREE.BufferGeometry {
  const M = [[m.x0, m.y0], [m.x1, m.y0], [m.x1, m.y1], [m.x0, m.y1]].map(([x, y]) => [px(x!), py(y!), 0]);
  const Th = [[t.x0, t.y0], [t.x1, t.y0], [t.x1, t.y1], [t.x0, t.y1]].map(([x, y]) => [px(x!), py(y!), -depth]);
  const pts: number[] = [];
  const quad = (a: number[], b: number[], c: number[], d: number[]) => pts.push(...a, ...b, ...c, ...a, ...c, ...d);
  for (let i = 0; i < 4; i++) quad(M[i]!, M[(i + 1) % 4]!, Th[(i + 1) % 4]!, Th[i]!);
  quad(Th[0]!, Th[1]!, Th[2]!, Th[3]!);
  const g = new THREE.BufferGeometry(); g.setAttribute("position", new THREE.Float32BufferAttribute(pts, 3)); g.computeVertexNormals();
  return g;
}

export default function Res2View() {
  const mount = useRef<HTMLDivElement>(null), stage = useRef<Stage | undefined>(undefined);
  const [picked, setPicked] = useState<string>(), [hover, setHover] = useState<string>();
  const [v, setV] = useState(toV(110)), [playing, setPlaying] = useState(false);
  const [inside, setInside] = useState(false), [cover, setCover] = useState(false), [sizes, setSizes] = useState(true), [far, setFar] = useState(8);
  const [failed, setFailed] = useState(false);
  const hz = toHz(v), band = bandAt(hz);
  const live = useRef({ lit: undefined as string | undefined, band: band as Res2Band, playing: false, inside: false, cover: false, sizes: true, far: 8 });
  Object.assign(live.current, { lit: hover ?? picked, band, playing, inside, cover, sizes, far });

  useEffect(() => {
    const groups: Record<string, THREE.MeshStandardMaterial[]> = {};
    const walls: THREE.MeshStandardMaterial[] = [], drivers = new THREE.Group(), beam = new THREE.Group(), dims = new THREE.Group();
    let beamFar = 0;
    const st = makeStage(mount.current!, { camera: [0.95, 1.6, 1.85], target: [0, BASE + H / 2 - 0.05, -0.15], near: 0.05, far: 400, min: 0.9, max: 60, sun: [3, 5, 4], shadow: 3.2, exposure: 0.95, ratio: 0.62,
      onHover: setHover, onPick: setPicked,
      onFrame: (t) => {
        const s = live.current, pulse = s.playing ? 0.34 + 0.2 * Math.sin(t * 9) : 0.3;
        for (const part of RES2_PARTS) for (const m of groups[part.id] ?? []) { const on = part.lights.includes(s.band); m.emissiveIntensity = part.id === s.lit ? 0.6 : on ? pulse : 0; }
        for (const id of ["bassDriver", "midDriver", "highDriver"]) for (const m of groups[id] ?? []) m.emissiveIntensity = (id === "bassDriver" ? s.band === "bass" : s.band === "midhigh") ? pulse : 0;
        drivers.visible = s.inside; for (const m of walls) { m.opacity = s.inside ? 0.16 : 1; m.transparent = s.inside; m.depthWrite = !s.inside; }
        beam.visible = s.cover; dims.visible = s.sizes && !s.cover;
        if (s.cover && beamFar !== s.far) { beamFar = s.far; drawBeam(s.far); }
      } });
    if (!st) { setFailed(true); return; }
    stage.current = st;
    studio(st.scene, 0, 6);
    const add = (id: string, mesh: THREE.Object3D, mats: THREE.MeshStandardMaterial[], parent: THREE.Object3D = st.scene) => { mesh.userData.id = id; parent.add(mesh); if (parent === st.scene) st.pickable.push(mesh); (groups[id] ??= []).push(...mats); for (const m of mats) m.emissive.set(GLOW); return mesh; };
    const skin = () => { const m = paint("#242040"); walls.push(m); return m; }; // the deep blue-purple of the maker's photograph
    // the body: a lid, a floor, two sides that close in towards the back, and a back; hollow, so the horns can be seen into
    const outline = new THREE.Shape([new THREE.Vector2(-W / 2, 0), new THREE.Vector2(W / 2, 0), new THREE.Vector2(WB / 2, D), new THREE.Vector2(-WB / 2, D)]);
    for (const y of [BASE + H - T, BASE]) { const m = skin(), lid = new THREE.Mesh(new THREE.ExtrudeGeometry(outline, { depth: T, bevelEnabled: false }), m); lid.rotation.x = -Math.PI / 2; lid.position.y = y; add("body", lid, [m]); }
    const run = Math.hypot((W - WB) / 2, D), lean = Math.atan2((W - WB) / 2, D);
    for (const side of [-1, 1]) { const m = skin(), wall = new THREE.Mesh(new THREE.BoxGeometry(T, H, run), m); wall.position.set(side * (W + WB) / 4, BASE + H / 2, -D / 2); wall.rotation.y = side * lean; add("body", wall, [m]); }
    { const m = skin(), backPanel = new THREE.Mesh(new THREE.BoxGeometry(WB, H, T), m); backPanel.position.set(0, BASE + H / 2, -D); add("body", backPanel, [m]); }
    // the front: one panel with the three openings cut out of it
    const face = new THREE.Shape([new THREE.Vector2(-W / 2, BASE), new THREE.Vector2(W / 2, BASE), new THREE.Vector2(W / 2, BASE + H), new THREE.Vector2(-W / 2, BASE + H)]);
    for (const o of Object.values(OPENINGS)) face.holes.push(new THREE.Path([new THREE.Vector2(px(o.x0), py(o.y0)), new THREE.Vector2(px(o.x0), py(o.y1)), new THREE.Vector2(px(o.x1), py(o.y1)), new THREE.Vector2(px(o.x1), py(o.y0))]));
    { const m = skin(), panel = new THREE.Mesh(new THREE.ExtrudeGeometry(face, { depth: T, bevelEnabled: false }), m); panel.position.z = -T; add("body", panel, [m]); }
    // the horns: walls running back from each opening to a smaller throat (throat sizes after the drawing; depths illustrative)
    // the bass horn is the cabinet's own purple inside; the mid and high horns are one pale grey moulding
    const lining = (color = "#1b1832") => { const m = paint(color, { roughness: color === GREY ? 0.55 : 0.85, side: THREE.DoubleSide }); walls.push(m); return m; };
    { // the grey panel the two upper horns sit in: square at the top, cut in at the bottom corners (outline after the drawing)
      const panel = new THREE.Shape([[0.03, 0.015], [0.492, 0.015], [0.492, 0.315], [0.35, 0.462], [0.172, 0.462], [0.03, 0.315]].map(([x, y]) => new THREE.Vector2(px(x!), py(y!))));
      for (const o of [OPENINGS.mid, OPENINGS.high]) panel.holes.push(new THREE.Path([new THREE.Vector2(px(o.x0), py(o.y0)), new THREE.Vector2(px(o.x0), py(o.y1)), new THREE.Vector2(px(o.x1), py(o.y1)), new THREE.Vector2(px(o.x1), py(o.y0))]));
      const m = lining(GREY), mesh = new THREE.Mesh(new THREE.ExtrudeGeometry(panel, { depth: 0.006, bevelEnabled: false }), m); mesh.position.z = 0.0005; add("body", mesh, [m]); }
    const centre = (o: { x0: number; x1: number; y0: number; y1: number }, w: number, h: number) => ({ x0: (o.x0 + o.x1) / 2 - w / 2, x1: (o.x0 + o.x1) / 2 + w / 2, y0: (o.y0 + o.y1) / 2 - h / 2, y1: (o.y0 + o.y1) / 2 + h / 2 });
    { const m = lining(); add("bassHorn", new THREE.Mesh(hornGeometry(OPENINGS.bass, { x0: 0.12, x1: 0.402, y0: 0.658, y1: 0.812 }, 0.27), m), [m]);
      const d = lining(), divider = new THREE.Mesh(new THREE.BoxGeometry(T, OPENINGS.bass.y1 - 0.658, 0.27), d); divider.position.set(0, py((0.658 + OPENINGS.bass.y1) / 2), -0.135); add("bassHorn", divider, [d]); }
    { const m = lining(GREY); add("midHorn", new THREE.Mesh(hornGeometry(OPENINGS.mid, centre(OPENINGS.mid, 0.2, 0.13), 0.15), m), [m]); }
    { const m = lining(GREY); add("highHorn", new THREE.Mesh(hornGeometry(OPENINGS.high, centre(OPENINGS.high, 0.03, 0.03), 0.08), m), [m]); }
    // the shaped piece the drawing shows in the mouth of the mid horn: wide, flat-fronted, pointed to left and right
    { const m = paint("#0d0c11", { roughness: 0.45 }), g = new THREE.LatheGeometry([[0, 0.05], [0.035, 0.045], [0.068, 0], [0.035, -0.07], [0, -0.09]].map(([r, z]) => new THREE.Vector2(r!, z!)), 6);
      g.rotateX(Math.PI / 2); g.scale(1.85, 1, 1); const plug = new THREE.Mesh(g, m); plug.position.set(0, py((OPENINGS.mid.y0 + OPENINGS.mid.y1) / 2), -0.055); add("plug", plug, [m]); }
    // flypoints up each side, and the connector plate on the back
    for (const side of [-1, 1]) for (const y of [BASE + H / 2 - RES2.flypointsApart / 2, BASE + H / 2 + RES2.flypointsApart / 2]) { const m = steel("#c9ccd1", 0.3) as THREE.MeshStandardMaterial, p = new THREE.Mesh(new THREE.CylinderGeometry(0.013, 0.013, 0.012, 16), m); p.rotation.z = Math.PI / 2; p.position.set(side * ((W + WB) / 4 + 0.012), y, -D / 2); p.rotation.y = side * lean; add("fly", p, [m]); }
    { const m = steel("#8f9298", 0.5) as THREE.MeshStandardMaterial, plate = new THREE.Mesh(new THREE.BoxGeometry(0.11, 0.075, 0.006), m); plate.position.set(0, BASE + H - 0.2, -D - T / 2 - 0.003); add("plate", plate, [m]);
      for (const x of [-0.026, 0.026]) { const s = new THREE.Mesh(new THREE.CylinderGeometry(0.014, 0.014, 0.008, 20), paint("#08080a")); s.rotation.x = Math.PI / 2; s.position.set(x, BASE + H - 0.2, -D - T / 2 - 0.008); s.userData.id = "plate"; st.scene.add(s); st.pickable.push(s); } }
    // stand-ins for the three drivers, at their stated sizes, behind their horns (where exactly they sit is not published)
    const cone = (id: string, inches: number, y: number, z: number) => {
      const r = (inches * 0.0254) / 2, m = paper("#3a3642"), mag = steel("#7d8087", 0.5) as THREE.MeshStandardMaterial, g = new THREE.Group();
      const c = new THREE.Mesh(new THREE.LatheGeometry([[r * 0.22, -r * 0.42], [r, 0], [r * 1.06, 0]].map(([a, b]) => new THREE.Vector2(a!, b!)), 40), m); c.rotation.x = Math.PI / 2;
      const motor = new THREE.Mesh(new THREE.CylinderGeometry(r * 0.5, r * 0.5, r * 0.3, 32), mag); motor.rotation.x = Math.PI / 2; motor.position.z = -r * 0.62;
      m.side = THREE.DoubleSide; g.add(c, motor); g.position.set(0, y, z); drivers.add(g); (groups[id] ??= []).push(m); m.emissive.set(GLOW);
    };
    cone("bassDriver", 15, py(0.735), -0.3); cone("midDriver", 8, py((OPENINGS.mid.y0 + OPENINGS.mid.y1) / 2), -0.19); cone("highDriver", 1, py((OPENINGS.high.y0 + OPENINGS.high.y1) / 2), -0.1);
    st.scene.add(drivers);
    // a plain plinth to stand it at ear height
    const plinth = new THREE.Mesh(new THREE.BoxGeometry(W * 0.9, BASE, D * 0.9), paint("#3b3840", { roughness: 0.9 })); plinth.position.set(0, BASE / 2, -D / 2); st.scene.add(plinth);
    shadowed(st.scene);
    // sizes: thin lines with a figure on each
    const rule = (a: [number, number, number], b: [number, number, number], text: string) => {
      const l = new THREE.Line(new THREE.BufferGeometry().setFromPoints([new THREE.Vector3(...a), new THREE.Vector3(...b)]), new THREE.LineBasicMaterial({ color: "#3d3550" })); l.raycast = () => {};
      const s = sign(text, 0.06); s.position.set((a[0] + b[0]) / 2, (a[1] + b[1]) / 2, (a[2] + b[2]) / 2); dims.add(l, s);
    };
    rule([-W / 2, BASE + H + 0.07, 0], [W / 2, BASE + H + 0.07, 0], "522 mm");
    rule([W / 2 + 0.09, BASE, 0], [W / 2 + 0.09, BASE + H, 0], "920 mm");
    rule([-W / 2 - 0.07, BASE + H + 0.02, 0], [-W / 2 - 0.07, BASE + H + 0.02, -D], "445 mm");
    rule([-WB / 2, BASE + H + 0.07, -D], [WB / 2, BASE + H + 0.07, -D], "344 mm");
    st.scene.add(dims, beam);
    // coverage: the stated 50 by 25 degrees as a wedge, with its width and height written at the far end
    const drawBeam = (reach: number) => {
      for (const o of [...beam.children]) { beam.remove(o); (o as THREE.Mesh).geometry?.dispose(); }
      const { wide, tall } = spread(reach), y = BASE + H * 0.72, corners = [[-1, 1], [1, 1], [1, -1], [-1, -1]].map(([a, b]) => new THREE.Vector3((a! * wide) / 2, y + (b! * tall) / 2, reach));
      const pts: number[] = [], apex = new THREE.Vector3(0, y, 0);
      for (let i = 0; i < 4; i++) pts.push(...apex.toArray(), ...corners[i]!.toArray(), ...corners[(i + 1) % 4]!.toArray());
      const g = new THREE.BufferGeometry(); g.setAttribute("position", new THREE.Float32BufferAttribute(pts, 3));
      const wedge = new THREE.Mesh(g, new THREE.MeshBasicMaterial({ color: GLOW, transparent: true, opacity: 0.13, side: THREE.DoubleSide, depthWrite: false })); wedge.raycast = () => {};
      const edge = new THREE.LineLoop(new THREE.BufferGeometry().setFromPoints(corners), new THREE.LineBasicMaterial({ color: GLOW })); edge.raycast = () => {};
      const size = Math.max(0.12, reach * 0.045), a = sign(`${wide.toFixed(1)} m wide`, size), b = sign(`${tall.toFixed(1)} m tall`, size), c = sign(`${reach} m away`, size);
      a.position.set(0, y + tall / 2 + size, reach); b.position.set(wide / 2 + size * 2.4, y, reach); c.position.set(0, Math.max(0.2, y - tall / 2 - size), reach / 2);
      beam.add(wedge, edge, a, b, c);
    };
    return () => { st.dispose(); stage.current = undefined; };
  }, []);

  // when coverage is switched on or its distance changes, step back far enough to see the far end
  useEffect(() => { const s = stage.current; if (!s) return; if (cover) s.lookFrom([-far * 0.9 - 2, BASE + H + far * 0.35, -far * 0.45], [0, BASE + H / 2, far * 0.5]); else s.lookFrom([0.95, 1.6, 1.85], [0, BASE + H / 2 - 0.05, -0.15]); }, [cover, far]);

  // the tone: a plain sine at the chosen frequency, quiet
  const audio = useRef<{ ctx: AudioContext; osc: OscillatorNode; gain: GainNode } | undefined>(undefined);
  useEffect(() => {
    if (!playing) { const a = audio.current; if (a) { a.gain.gain.setTargetAtTime(0, a.ctx.currentTime, 0.02); setTimeout(() => { a.osc.stop(); void a.ctx.close(); }, 200); audio.current = undefined; } return; }
    const ctx = new AudioContext(), osc = ctx.createOscillator(), gain = ctx.createGain();
    osc.frequency.value = toHz(v); gain.gain.value = 0; gain.gain.setTargetAtTime(0.12, ctx.currentTime, 0.03);
    osc.connect(gain).connect(ctx.destination); osc.start(); audio.current = { ctx, osc, gain };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [playing]);
  useEffect(() => { audio.current?.osc.frequency.setTargetAtTime(hz, audio.current.ctx.currentTime, 0.02); }, [hz]);
  useEffect(() => () => { const a = audio.current; if (a) { a.osc.stop(); void a.ctx.close(); } }, []);

  const part = RES2_PARTS.find((p) => p.id === (hover ?? picked)), now = BAND_TEXT[band], reach = spread(far);
  const mark = (f: number) => `${(toV(f) * 100).toFixed(1)}%`;
  return (
    <>
      <p className="muted">The maker’s sheet calls the Res 2 “the classic horn-loaded, full range Funktion-One loudspeaker”: one cabinet with a 15-inch for bass, an 8-inch for the middle and a 1-inch for the top, each playing through its own horn. Move the frequency and watch which horn the sound comes out of. Drag to turn it.</p>
      <div className="driver-grid">
        <div className="driver-stage three" ref={mount} role="img" aria-label="A tall loudspeaker cabinet on a plinth, with a wide horn and a small horn in its upper half and a large divided horn mouth in its lower half">
          {failed && <p className="driver-failed">This browser could not start 3D drawing.</p>}
        </div>
        <div className="driver-side">
          <div className="driver-parts" role="group" aria-label="Views">
            <button aria-pressed={inside} className={inside ? "on" : ""} onClick={() => setInside((x) => !x)}>See the drivers</button>
            <button aria-pressed={cover} className={cover ? "on" : ""} onClick={() => setCover((x) => !x)}>Coverage</button>
            <button aria-pressed={sizes} className={sizes ? "on" : ""} onClick={() => setSizes((x) => !x)}>Sizes</button>
          </div>
          <div className="driver-parts vero-key" role="group" aria-label="Parts">
            {RES2_PARTS.map((p) => <button key={p.id} className={(hover ?? picked) === p.id ? "on" : ""} aria-pressed={picked === p.id} onClick={() => setPicked(picked === p.id ? undefined : p.id)} onPointerEnter={() => setHover(p.id)} onPointerLeave={() => setHover(undefined)}>{p.name}</button>)}
          </div>
          <div className="driver-info" role="status">
            {part ? <><h3>{part.name}</h3><p>{part.job}</p></> : <><h3>{now.title}</h3><p>{now.text}</p></>}
            {inside && <p className="muted">The drivers are stand-ins at their stated sizes (15, 8 and 1 inch). Funktion-One does not publish where they sit or how the horns are shaped inside, so that is not drawn.</p>}
            {cover && <p>By its stated coverage of 50° across and 25° up and down, at {far} m the sound has spread to about {reach.wide.toFixed(1)} m wide and {reach.tall.toFixed(1)} m tall.</p>}
          </div>
        </div>
      </div>
      <div className="res2-band" aria-hidden="true">
        <i className={`below${band === "below" ? " on" : ""}`} style={{ width: mark(RES2.lowest) }}>too low</i>
        <i className={`bass${band === "bass" ? " on" : ""}`} style={{ width: `${(toV(RES2.crossover) - toV(RES2.lowest)) * 100}%` }}>15-inch · bass horn</i>
        <i className={`midhigh${band === "midhigh" ? " on" : ""}`} style={{ width: `${(toV(RES2.highest) - toV(RES2.crossover)) * 100}%` }}>8-inch and 1-inch · mid and high horns</i>
        <i className={`above${band === "above" ? " on" : ""}`} style={{ flex: 1 }} />
        <b style={{ left: mark(hz) }} />
      </div>
      <div className="driver-controls">
        <label className="driver-slider">
          <span>Frequency</span>
          <input type="range" min={0} max={1} step={0.002} value={v} onChange={(e) => setV(Number(e.target.value))} aria-valuetext={`${hzText(hz)}, ${now.title}`} />
          <output>{hzText(hz)} · {noteNear(hz)}</output>
        </label>
        <button className={playing ? "" : "primary"} onClick={() => setPlaying((x) => !x)}>{playing ? "Stop the tone" : "Play this tone"}</button>
        {cover && <label className="driver-slider tone"><span>Distance</span><input type="range" min={2} max={30} step={1} value={far} onChange={(e) => setFar(Number(e.target.value))} /><output>{far} m</output></label>}
      </div>
      <div className="driver-parts" role="group" aria-label="Jump to a sound">
        {LANDMARKS.map((l) => <button key={l.label} onClick={() => setV(toV(l.hz))}>{l.label} · {hzText(l.hz)}</button>)}
      </div>
      <aside className="side-note res2-missing" aria-label="What this diagram is missing">
        <div className="side-note-inner">
          <span className="side-note-tag">What’s missing here</span>
          <p>Funktion-One publishes the outside of this cabinet and its figures, not its insides. Four things you would want are not in this diagram, and each one matters:</p>
          <ul>
            <li><strong>The shape of each horn inside.</strong> A horn’s length and how fast it widens decide how low it can play and how it spreads the sound. Without it this diagram can show you <em>that</em> the cabinet stops at 60 Hz and covers 50° by 25°, but not <em>why</em>.</li>
            <li><strong>Where the three drivers sit.</strong> Each one is a different distance from your ear, so their sound sets off at different moments and has to be lined up. The stand-ins here are only the right sizes, so nothing about timing can be read off them.</li>
            <li><strong>Where the 8-inch hands over to the 1-inch.</strong> Around a handover two drivers play the same notes together. Not knowing it means this diagram cannot tell you which horn a lead at, say, 3 kHz comes out of: only that it is one of the upper two.</li>
            <li><strong>What the shaped piece in the mid horn does.</strong> The drawing shows it and the sheet does not explain it. A Funktion One patent describes a centre piece in a different, lower horn, but nothing we have says this is the same idea, so the page does not guess.</li>
          </ul>
          <p>So treat the outside, the sizes and the numbers as the maker’s, and everything behind the front panel as a sketch.</p>
        </div>
      </aside>
      <p className="muted driver-draft">From the maker’s drawing: the cabinet’s sizes, its 28° taper, and where the three openings are on the front. From the maker’s spec sheet (Funktion-One documents, page {RES2.page}): the three drivers, 60 Hz to 18 kHz, the 250 Hz crossover, 50° by 25° coverage, 48 kg, two NL4 connectors, M10 flypoints. Colours follow the maker’s photograph by eye: a deep purple cabinet with a pale grey moulding for the two upper horns. Drawn for illustration: how deep each horn goes and its shape inside, the drivers’ positions, the plinth, and panel thickness. The landmark sounds are rough conventions, not measurements. Your own speakers or headphones are what you hear the tone through, so very low and very high tones may be faint or silent on them.</p>
    </>
  );
}
