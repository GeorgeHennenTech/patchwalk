// Funktion-One's Res 2 as a model you can turn: its three horns, which one a frequency comes out of, and how
// wide its sound spreads. The outside follows the maker's dimensioned drawing; the insides are not published,
// so the drivers are shown only as stand-ins of the stated sizes.
import { useEffect, useRef, useState } from "react";
import * as THREE from "three";
import { BAND_TEXT, bandAt, frontGap, LANDMARKS, noteNear, OPENINGS, RES2, RES2_PARTS, spread, type Res2Band } from "../soundsystems/res2";
import { BANDS, bandNear, LEGEND, level, levelAt, levelColour, SOURCE } from "../soundsystems/directivity";
import { BeamwidthChart, PolarPlot } from "./Directivity";
import { paint, paper, shadowed, sign, steel, studio } from "./three/look";
import { GLTFLoader } from "three/examples/jsm/loaders/GLTFLoader.js";
import { makeStage, type Stage } from "./three/stage";
import modelUrl from "../assets/diagrams/res2/res2.glb?url";
import aoUrl from "../assets/diagrams/res2/ao.webp";

const { front: W, back: WB, height: H, depth: D } = RES2;
const BASE = 0.9;          // the cabinet stands on a plinth this high (illustrative)
const GLOW = "#ff2e93";
const WAVE_SPEED = 0.55;  // how fast the drawn wavefronts travel, metres a second (sound itself: 343)
const WAVE_REACH = 4.5;   // how far they are drawn, metres
const lengthText = (m: number) => (m >= 1 ? `${m.toFixed(m >= 10 ? 0 : 1)} m` : m >= 0.01 ? `${(m * 100).toFixed(m >= 0.1 ? 0 : 1)} cm` : `${(m * 1000).toFixed(0)} mm`);
const toHz = (v: number) => 20 * Math.pow(1000, v), toV = (hz: number) => Math.log(hz / 20) / Math.log(1000);
const hzText = (hz: number) => (hz >= 999.5 ? `${(hz / 1000).toFixed(hz >= 10000 ? 0 : 1)} kHz` : `${Math.round(hz)} Hz`);
/** A point on the front, from metres across and down the drawing, to model space (x right, y up, z towards the listener). */
const py = (y: number) => BASE + H - y;


export default function Res2View() {
  const mount = useRef<HTMLDivElement>(null), stage = useRef<Stage | undefined>(undefined);
  const [picked, setPicked] = useState<string>(), [hover, setHover] = useState<string>();
  const [v, setV] = useState(toV(110)), [playing, setPlaying] = useState(false);
  const [inside, setInside] = useState(false), [cover, setCover] = useState(false), [sizes, setSizes] = useState(false), [waves, setWaves] = useState(true), [far, setFar] = useState(8);
  const [failed, setFailed] = useState(false);
  // two ways to look: the simple picture, or the maker's measurements drawn the way a system engineer reads them
  const [pro, setProState] = useState(() => { try { return localStorage.getItem("patchwalk.res2.view") === "pro"; } catch { return false; } });
  const setPro = (on: boolean) => { setProState(on); try { localStorage.setItem("patchwalk.res2.view", on ? "pro" : "simple"); } catch { /* not remembered */ } };
  const [floor, setFloor] = useState(true);
  const hz = toHz(v), band = bandAt(hz), measured = bandNear(hz);
  const live = useRef({ lit: undefined as string | undefined, band: band as Res2Band, playing: false, inside: false, cover: false, sizes: false, waves: true, hz: 110, far: 8, pro: false, measured: undefined as number | undefined, floor: true });
  Object.assign(live.current, { lit: hover ?? picked, band, playing, inside, cover, sizes, waves, hz, far, pro, measured, floor });

  useEffect(() => {
    const groups: Record<string, THREE.MeshStandardMaterial[]> = {};
    const walls: THREE.MeshStandardMaterial[] = [], inks: THREE.LineBasicMaterial[] = [], drivers = new THREE.Group(), beam = new THREE.Group(), dims = new THREE.Group();
    let beamFar = 0;
    const st = makeStage(mount.current!, { camera: [2.25, 1.85, 1.35], target: [0, BASE + H / 2 - 0.02, 0.45], near: 0.05, far: 400, min: 0.9, max: 60, sun: [3, 5, 4], shadow: 3.2, exposure: 0.95, ratio: 0.62,
      onHover: setHover, onPick: setPicked,
      onFrame: (t) => {
        const s = live.current, pulse = s.playing ? 0.34 + 0.2 * Math.sin(t * 9) : 0.3;
        for (const part of RES2_PARTS) for (const m of groups[part.id] ?? []) { const on = part.lights.includes(s.band); m.emissiveIntensity = part.id === s.lit ? 0.6 : on ? pulse : 0; }
        for (const id of ["bassDriver", "midDriver", "highDriver"]) for (const m of groups[id] ?? []) m.emissiveIntensity = (id === "bassDriver" ? s.band === "bass" : s.band === "midhigh") ? pulse : 0;
        drivers.visible = s.inside; for (const m of walls) { m.opacity = s.inside ? 0.16 : 1; m.transparent = s.inside; m.depthWrite = !s.inside; }
        beam.visible = s.cover; dims.visible = s.sizes && !s.cover;
        // sound leaving the horn that is playing: fronts one wavelength apart (or every nth, when they would crowd), slowed right down
        // the engineer's view: the measured "balloon" at the horn and the level map on the floor, redrawn when the band changes
        const showing = s.pro && s.measured !== undefined ? s.measured : -1;
        balloon.visible = showing >= 0; map.visible = marks.visible = showing >= 0 && s.floor;
        if (showing >= 0 && showing !== drawn) { drawn = showing; drawMeasured(showing); }
        const src = s.band === "bass" ? MOUTH.bass : s.band === "midhigh" ? MOUTH.mid : undefined, gap = frontGap(s.hz);
        fronts.forEach((f, k) => {
          const r = (t * WAVE_SPEED + k * gap.shown) % (fronts.length * gap.shown);
          f.g.visible = !!src && s.waves && !s.pro && r > 0.05 && r < WAVE_REACH; if (!f.g.visible) return;
          const fade = 1 - r / WAVE_REACH;
          f.g.position.set(0, src!, 0.02); f.g.scale.setScalar(r); f.fill.opacity = 0.1 * fade; f.line.opacity = 0.95 * fade;
        });
        if (s.cover && beamFar !== s.far) { beamFar = s.far; drawBeam(s.far); }
      } });
    if (!st) { setFailed(true); return; }
    stage.current = st;
    studio(st.scene, 0, 6);
    // a second, softer light from the other side, so the cabinet's dark paint does not go black in shadow
    const fill = new THREE.DirectionalLight(0xdfe6ff, 1.1); fill.position.set(-3, 2.5, -2.5); st.scene.add(fill); st.scene.environmentIntensity = 0.9;
    // the cabinet itself: modelled in Blender from the maker's drawing (scripts/blender/res2.py), one object per part,
    // with the soft shadowing where surfaces meet worked out there and laid over it here
    const PART: Record<string, string> = { Body: "body", Handles: "body", Panel: "body", Bolts: "body", MidHorn: "midHorn", HighHorn: "highHorn", Plug: "plug", BassHorn: "bassHorn", Divider: "bassHorn", Strut: "bassHorn", Flypoints: "fly", Plate: "plate", Sockets: "plate" };
    const FADES = ["Body", "Handles", "Panel", "MidHorn", "HighHorn", "BassHorn", "Divider", "Bolts"]; // what "See the drivers" makes see-through
    const INK: Record<string, string> = { Panel: "#4b4d55", MidHorn: "#4b4d55", HighHorn: "#4b4d55", Plate: "#33343a", Flypoints: "#33343a" }; // edge lines: dark on the pale parts
    const ao = new THREE.TextureLoader().load(aoUrl); ao.flipY = false; ao.colorSpace = THREE.NoColorSpace;
    let gone = false;
    new GLTFLoader().load(modelUrl, (gltf) => {
      if (gone) return;
      const model = gltf.scene; model.position.y = BASE;
      model.traverse((o) => {
        const mesh = o as THREE.Mesh; if (!mesh.isMesh) return;
        const name = mesh.name.replace(/[._]\d+$/, ""), id = PART[name] ?? "body";
        const m = (mesh.material as THREE.MeshStandardMaterial).clone(); mesh.material = m;
        m.aoMap = ao; m.aoMapIntensity = 1; m.side = THREE.DoubleSide; m.emissive.set(GLOW); m.emissiveIntensity = 0;
        if (name === "Body" || name === "BassHorn" || name === "Divider") { const grain = paint("#000"); m.bumpMap = grain.bumpMap; m.bumpScale = 0.5; }
        mesh.userData.id = id; mesh.castShadow = mesh.receiveShadow = true; (groups[id] ??= []).push(m); if (FADES.includes(name)) walls.push(m);
        // crisp lines along every real edge, as in a technical drawing
        const ink = new THREE.LineSegments(new THREE.EdgesGeometry(mesh.geometry, 28), new THREE.LineBasicMaterial({ color: INK[name] ?? "#7d74c9", transparent: true, opacity: name === "Body" || name === "Handles" ? 0.55 : 0.9 }));
        ink.raycast = () => {}; mesh.add(ink); inks.push(ink.material as THREE.LineBasicMaterial);
      });
      st.scene.add(model); st.pickable.push(model);
    }, undefined, () => setFailed(true));

    // stand-ins for the three drivers, at their stated sizes, behind their horns (where exactly they sit is not published)
    const cone = (id: string, inches: number, y: number, z: number) => {
      const r = (inches * 0.0254) / 2, m = paper("#3a3642"), mag = steel("#7d8087", 0.5) as THREE.MeshStandardMaterial, g = new THREE.Group();
      const c = new THREE.Mesh(new THREE.LatheGeometry([[r * 0.22, -r * 0.42], [r, 0], [r * 1.06, 0]].map(([a, b]) => new THREE.Vector2(a!, b!)), 40), m); c.rotation.x = Math.PI / 2;
      const motor = new THREE.Mesh(new THREE.CylinderGeometry(r * 0.5, r * 0.5, r * 0.3, 32), mag); motor.rotation.x = Math.PI / 2; motor.position.z = -r * 0.62;
      m.side = THREE.DoubleSide; g.add(c, motor); g.position.set(0, y, z); drivers.add(g); (groups[id] ??= []).push(m); m.emissive.set(GLOW);
    };
    cone("bassDriver", 15, py(0.735), -0.3); cone("midDriver", 8, py((OPENINGS.mid.y0 + OPENINGS.mid.y1) / 2), -0.19); cone("highDriver", 1, py((OPENINGS.high.y0 + OPENINGS.high.y1) / 2), -0.1);
    st.scene.add(drivers);
    // it stands on a bass cabinet, because below 60 Hz it needs one. A plain stand-in: not drawn to any model.
    { const purple = paint("#1f1b38"), dark = paint("#0b0a14", { roughness: 0.9 }), bw = W * 1.12, bd = D * 1.25;
      const box = new THREE.Mesh(new THREE.BoxGeometry(bw, BASE, bd), purple); box.position.set(0, BASE / 2, -bd / 2 + 0.04);
      const mouth = new THREE.Mesh(new THREE.BoxGeometry(bw * 0.86, BASE * 0.78, 0.02), dark); mouth.position.set(0, BASE / 2, 0.045);
      const bar = new THREE.Mesh(new THREE.BoxGeometry(0.03, BASE * 0.78, 0.03), purple); bar.position.set(0, BASE / 2, 0.055);
      const tag = sign("a bass cabinet (stand-in)", 0.06); tag.position.set(0, 0.1, 0.12);
      st.scene.add(box, mouth, bar, tag); }
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
    // measured directivity. The balloon: a surface whose distance from the horn in each direction is the level in that
    // direction (36 dB from its skin to its centre), coloured in 3 dB steps. The map: level at ear height on the ground.
    const BALLOON = 0.95, MAP = { wide: 16, deep: 16, cells: 128, ear: 1.7 }, rad5 = (5 * Math.PI) / 180;
    const balloonGeo = new THREE.BufferGeometry(), bIdx: number[] = [];
    for (let m = 0; m < 72; m++) for (let q = 0; q < 36; q++) { const a = m * 37 + q, b = ((m + 1) % 72) * 37 + q; bIdx.push(a, b, a + 1, b, b + 1, a + 1); }
    balloonGeo.setIndex(bIdx); balloonGeo.setAttribute("position", new THREE.Float32BufferAttribute(new Float32Array(72 * 37 * 3), 3)); balloonGeo.setAttribute("color", new THREE.Float32BufferAttribute(new Float32Array(72 * 37 * 3), 3));
    const balloon = new THREE.Mesh(balloonGeo, new THREE.MeshBasicMaterial({ vertexColors: true, transparent: true, opacity: 0.82, side: THREE.DoubleSide })); balloon.raycast = () => {}; balloon.visible = false; balloon.frustumCulled = false;
    const canvas = document.createElement("canvas"); canvas.width = canvas.height = MAP.cells; const ctx = canvas.getContext("2d")!, tex = new THREE.CanvasTexture(canvas); tex.colorSpace = THREE.SRGBColorSpace; tex.magFilter = THREE.LinearFilter;
    const map = new THREE.Mesh(new THREE.PlaneGeometry(MAP.wide, MAP.deep), new THREE.MeshBasicMaterial({ map: tex, transparent: true, opacity: 0.9, depthWrite: false })); map.rotation.x = -Math.PI / 2; map.position.set(0, 0.012, MAP.deep / 2 + 0.3); map.raycast = () => {}; map.visible = false;
    const marks = new THREE.Group(); // distances along the map's edge
    for (let d = 2; d <= 16; d += 2) { const sg = sign(`${d} m`, 0.36); sg.position.set(-MAP.wide / 2 - 0.8, 0.3, d); marks.add(sg); }
    map.onBeforeRender = () => {}; st.scene.add(marks);
    st.scene.add(balloon, map); let drawn = -1;
    const drawMeasured = (b: number) => {
      const srcY = BANDS[b]!.driver === "1-inch" ? MOUTH.high : MOUTH.midOnly, pos = balloonGeo.attributes.position as THREE.BufferAttribute, col = balloonGeo.attributes.color as THREE.BufferAttribute, c = new THREE.Color();
      for (let m = 0; m < 72; m++) for (let q = 0; q < 37; q++) {
        const db = level(b, q * 5, m * 5), r = BALLOON * Math.max(0.02, 1 + Math.max(-36, db) / 36), th = q * rad5, ph = m * rad5, i = m * 37 + q, [cr, cg, cb] = levelColour(db);
        pos.setXYZ(i, r * Math.sin(th) * Math.sin(ph), r * Math.sin(th) * Math.cos(ph), r * Math.cos(th)); c.setRGB(cr / 255, cg / 255, cb / 255, THREE.SRGBColorSpace); col.setXYZ(i, c.r, c.g, c.b);
      }
      pos.needsUpdate = col.needsUpdate = true; balloon.position.set(0, srcY, 0.02);
      const img = ctx.createImageData(MAP.cells, MAP.cells);
      for (let j = 0; j < MAP.cells; j++) for (let i = 0; i < MAP.cells; i++) {
        const x = ((i + 0.5) / MAP.cells - 0.5) * MAP.wide, z = 0.3 + (1 - (j + 0.5) / MAP.cells) * MAP.deep, [r, g, bl] = levelColour(levelAt(b, x, MAP.ear - srcY, z)), k = (j * MAP.cells + i) * 4;
        img.data[k] = r; img.data[k + 1] = g; img.data[k + 2] = bl; img.data[k + 3] = 255;
      }
      ctx.putImageData(img, 0, 0); tex.needsUpdate = true;
    };
    // one wavefront: the piece of a sphere inside the cabinet's stated 50 by 25 degrees, facing the listener; drawn at size 1 and scaled
    const rad = Math.PI / 180, { across, upDown } = RES2.coverage;
    const cap = new THREE.SphereGeometry(1, 28, 10, (90 - across / 2) * rad, across * rad, (90 - upDown / 2) * rad, upDown * rad);
    // each front is a bright outline with only a faint fill, so one seen face-on does not blot out the cabinet
    const edge: THREE.Vector3[] = [], on = (phi: number, theta: number) => new THREE.Vector3(-Math.cos(phi) * Math.sin(theta), Math.cos(theta), Math.sin(phi) * Math.sin(theta));
    const p0 = (90 - across / 2) * rad, p1 = (90 + across / 2) * rad, t0 = (90 - upDown / 2) * rad, t1 = (90 + upDown / 2) * rad, N = 24;
    for (let i = 0; i <= N; i++) edge.push(on(p0 + ((p1 - p0) * i) / N, t0));
    for (let i = 0; i <= N; i++) edge.push(on(p1, t0 + ((t1 - t0) * i) / N));
    for (let i = 0; i <= N; i++) edge.push(on(p1 - ((p1 - p0) * i) / N, t1));
    for (let i = 0; i <= N; i++) edge.push(on(p0, t1 - ((t1 - t0) * i) / N));
    const rim = new THREE.BufferGeometry().setFromPoints(edge);
    const fronts = Array.from({ length: 16 }, () => {
      const g = new THREE.Group(), fill = new THREE.Mesh(cap, new THREE.MeshBasicMaterial({ color: GLOW, transparent: true, opacity: 0.08, side: THREE.DoubleSide, depthWrite: false }));
      const line = new THREE.LineLoop(rim, new THREE.LineBasicMaterial({ color: GLOW, transparent: true, opacity: 0.9 }));
      fill.raycast = () => {}; line.raycast = () => {}; g.add(fill, line); g.visible = false; st.scene.add(g); return { g, fill: fill.material, line: line.material };
    });
    const MOUTH = { bass: py((OPENINGS.bass.y0 + OPENINGS.bass.y1) / 2), mid: py((OPENINGS.mid.y0 + OPENINGS.high.y1) / 2), midOnly: py((OPENINGS.mid.y0 + OPENINGS.mid.y1) / 2), high: py((OPENINGS.high.y0 + OPENINGS.high.y1) / 2) };
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
    return () => { gone = true; st.dispose(); stage.current = undefined; };
  }, []);

  // when coverage is switched on or its distance changes, step back far enough to see the far end
  useEffect(() => {
    const s = stage.current; if (!s) return;
    if (pro && floor) s.lookFrom([9.5, 9, -4.5], [0, 0.4, 6.5]);
    else if (pro) s.lookFrom([2.6, 2.3, 2.3], [0, BASE + H * 0.62, 0.35]);
    else if (cover) s.lookFrom([-far * 0.9 - 2, BASE + H + far * 0.35, -far * 0.45], [0, BASE + H / 2, far * 0.5]);
    else s.lookFrom([2.25, 1.85, 1.35], [0, BASE + H / 2 - 0.02, 0.45]);
  }, [cover, far, pro, floor]);

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

  const gap = frontGap(hz), mb = measured !== undefined ? BANDS[measured] : undefined;
  const part = RES2_PARTS.find((p) => p.id === (hover ?? picked)), now = BAND_TEXT[band], reach = spread(far);
  const mark = (f: number) => `${(toV(f) * 100).toFixed(1)}%`;
  return (
    <>
      <p className="muted">The maker’s sheet calls the Res 2 “the classic horn-loaded, full range Funktion-One loudspeaker”: one cabinet with a 15-inch for bass, an 8-inch for the middle and a 1-inch for the top, each playing through its own horn. Move the frequency and watch which horn the sound comes out of. Drag to turn it.</p>
      <div className="seg res2-mode" role="tablist" aria-label="How to look at it">
        <button role="tab" aria-selected={!pro} className={!pro ? "on" : ""} onClick={() => setPro(false)}>Simple view</button>
        <button role="tab" aria-selected={pro} className={pro ? "on" : ""} onClick={() => setPro(true)}>How an engineer sees it</button>
      </div>
      {pro && <p className="muted">These are Funktion-One’s own measurements of the mid and high horns, the kind of data a system engineer loads into prediction software. The coloured shape at the horn is a “balloon”: the further its skin is from the horn in a direction, the louder the sound in that direction. The colours on the floor show how loud it would be at ear height, in open air. Move the frequency and watch the spread change: it is not one fixed angle.</p>}
      <div className="driver-grid">
        <div className="driver-stage three" ref={mount} role="img" aria-label="A tall loudspeaker cabinet on a plinth, with a wide horn and a small horn in its upper half and a large divided horn mouth in its lower half">
          {failed && <p className="driver-failed">This browser could not start 3D drawing.</p>}
          <div className="fig-card" aria-live="polite">
            <span className="fig-kicker">Funktion-One · Res 2{pro ? " · measured" : ""}</span>
            {pro && mb ? <>
              <strong className="fig-number">{hzText(mb.hz)}</strong>
              <span className="fig-line">band · {mb.driver} driver’s file</span>
              <span className="fig-line">{mb.across >= 360 ? "everywhere" : `${Math.round(mb.across)}°`} across · {mb.upDown >= 360 ? "everywhere" : `${Math.round(mb.upDown)}°`} up and down</span>
              <span className="fig-line dim">width where it is 6 dB down</span>
            </> : pro ? <>
              <strong className="fig-number">{hzText(hz)}</strong>
              <span className="fig-line">{hz < 250 ? "no measurement here" : "above the measured bands"}</span>
              <span className="fig-line dim">{hz < 250 ? "the files cover 250 Hz and up" : "the files stop at 20 kHz"}</span>
            </> : <>
              <strong className="fig-number">{hzText(hz)}</strong>
              <span className="fig-line">{noteNear(hz)} · {{ below: "too low for this cabinet", bass: "bass horn · 15-inch", midhigh: "mid and high horns", above: "above its range" }[band]}</span>
              <span className="fig-line dim">waves {lengthText(gap.wavelength)} apart{gap.every > 1 && (band === "bass" || band === "midhigh") ? ` · every ${gap.every}${gap.every === 2 ? "nd" : gap.every === 3 ? "rd" : "th"} one drawn` : ""}</span>
            </>}
          </div>
        </div>
        <div className="driver-side">
          <div className="driver-parts" role="group" aria-label="Views">
            <button aria-pressed={inside} className={inside ? "on" : ""} onClick={() => setInside((x) => !x)}>See the drivers</button>
            <button aria-pressed={cover} className={cover ? "on" : ""} onClick={() => setCover((x) => !x)}>Coverage</button>
            <button aria-pressed={sizes} className={sizes ? "on" : ""} onClick={() => setSizes((x) => !x)}>Sizes</button>
            {!pro && <button aria-pressed={waves} className={waves ? "on" : ""} onClick={() => setWaves((x) => !x)}>Sound waves</button>}
            {pro && <button aria-pressed={floor} className={floor ? "on" : ""} onClick={() => setFloor((x) => !x)}>Floor map</button>}
          </div>
          <div className="driver-parts vero-key" role="group" aria-label="Parts">
            {RES2_PARTS.map((p) => <button key={p.id} className={(hover ?? picked) === p.id ? "on" : ""} aria-pressed={picked === p.id} onClick={() => setPicked(picked === p.id ? undefined : p.id)} onPointerEnter={() => setHover(p.id)} onPointerLeave={() => setHover(undefined)}>{p.name}</button>)}
          </div>
          <div className="driver-info" role="status">
            {part ? <><h3>{part.name}</h3><p>{part.job}</p></> : pro && mb ? <>
              <h3>{hzText(mb.hz)}: {mb.across >= 360 ? "going everywhere" : `${Math.round(mb.across)}° by ${Math.round(mb.upDown)}°`}</h3>
              <p>{mb.across >= 180 || mb.upDown >= 180 ? "At this frequency the horn barely steers the sound: it spreads very widely." : mb.across < RES2.coverage.across * 0.8 ? "Narrower side to side than the sheet’s 50°: step off to the side and this part of the sound falls away sooner." : mb.across > RES2.coverage.across * 1.3 ? "Wider side to side than the sheet’s 50°." : "Close to the sheet’s stated 50° side to side."}</p>
              <p className="muted">Straight ahead, this band is {mb.sensitivity} dB at 1 m by the file’s own figure. The sheet’s “50° by 25°” is one round number for the whole range; the measurements show how much it moves.</p>
            </> : pro ? <><h3>No measurement at {hzText(hz)}</h3><p>{hz < 250 ? "The maker’s files here cover the mid and high horns only, from 250 Hz up. There is none for the bass horn, so nothing is drawn rather than guessed." : "The files stop at the 20 kHz band."}</p></> : <><h3>{now.title}</h3><p>{now.text}</p></>}
            {inside && <p className="muted">The drivers are stand-ins at their stated sizes (15, 8 and 1 inch). Funktion-One does not publish where they sit or how the horns are shaped inside, so that is not drawn.</p>}
            {cover && <p>By its stated coverage of 50° across and 25° up and down, at {far} m the sound has spread to about {reach.wide.toFixed(1)} m wide and {reach.tall.toFixed(1)} m tall.</p>}
          </div>
        </div>
      </div>
      {pro && (
        <>
          <div className="dir-legend" aria-label="What the colours mean">
            <span>Level against 1 m straight ahead:</span>
            {LEGEND.map((db) => { const [r, g, b] = levelColour(db); return <i key={db} style={{ background: `rgb(${r},${g},${b})` }}>{db === 0 ? "0 dB" : db}</i>; })}
            <span className="muted">each step is 3 dB quieter; 6 dB is half the sound pressure</span>
          </div>
          {measured !== undefined && <div className="dir-charts"><PolarPlot band={measured} /><BeamwidthChart band={measured} nominal={RES2.coverage} /></div>}
        </>
      )}
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
      {pro && (
        <aside className="side-note res2-missing" aria-label="How far to trust the measured view">
          <div className="side-note-inner">
            <span className="side-note-tag">Reading the measured view</span>
            <ul>
              <li><strong>What it is.</strong> {SOURCE}. Funktion-One publishes these for use in prediction software.</li>
              <li><strong>Each driver alone.</strong> The 8-inch file covers 250 Hz to 5 kHz and the 1-inch file 6.3 kHz to 20 kHz. So the handover sits between those two bands in these files; the pair playing together around it is not shown.</li>
              <li><strong>Open air only.</strong> The floor map takes away 6 dB for each doubling of distance and nothing else: no floor bounce, no walls, no second cabinet, no bass horn.</li>
              <li><strong>Relative, not absolute.</strong> Colours compare each spot with 1 m straight ahead in the same band. How loud that is depends on the amplifier.</li>
              <li><strong>Ears at 1.7 m.</strong> The map is for someone standing; the cabinet sits at a height we chose.</li>
            </ul>
          </div>
        </aside>
      )}
      <aside className="side-note res2-missing" aria-label="What this diagram is missing">
        <div className="side-note-inner">
          <span className="side-note-tag">What’s missing here</span>
          <p>Funktion-One publishes the outside of this cabinet and its figures, not its insides. Four things you would want are not in this diagram, and each one matters:</p>
          <ul>
            <li><strong>The shape of each horn inside.</strong> A horn’s length and how fast it widens decide how low it can play and how it spreads the sound. Without it this diagram can show you <em>that</em> the cabinet stops at 60 Hz and covers 50° by 25°, but not <em>why</em>.</li>
            <li><strong>Where the three drivers sit.</strong> Each one is a different distance from your ear, so their sound sets off at different moments and has to be lined up. The stand-ins here are only the right sizes, so nothing about timing can be read off them.</li>
            <li><strong>Where the 8-inch hands over to the 1-inch.</strong> Around a handover two drivers play the same notes together. The spec sheet does not give it. The maker’s measurement files (see “How an engineer sees it”) split between the 5 kHz and 6.3 kHz bands, which points to a handover there, so a lead at 3 kHz would be the 8-inch; but that is read off the files, not stated by Funktion-One.</li>
            <li><strong>What the shaped piece in the mid horn does.</strong> The drawing shows it and the sheet does not explain it. A Funktion One patent describes a centre piece in a different, lower horn, but nothing we have says this is the same idea, so the page does not guess.</li>
          </ul>
          <p>So treat the outside, the sizes and the numbers as the maker’s, and everything behind the front panel as a sketch.</p>
        </div>
      </aside>
      <p className="muted driver-draft">From the maker’s drawing: the cabinet’s sizes, its 28° taper, and where the three openings are on the front. From the maker’s spec sheet (Funktion-One documents, page {RES2.page}): the three drivers, 60 Hz to 18 kHz, the 250 Hz crossover, 50° by 25° coverage, 48 kg, two NL4 connectors, M10 flypoints. Colours follow the maker’s photograph by eye: a deep purple cabinet with a pale grey moulding for the two upper horns. The model was built in Blender from that drawing, with rounded edges, hand slots, screws and the strut in the bass horn placed by eye from the photograph. Drawn for illustration: how deep each horn goes and its shape inside, the drivers’ positions, and the bass cabinet it stands on (a stand-in, not any model; the sheet says a Res 2 can be supplemented with separate bass). The pink wavefronts are a picture, not a measurement: they are spaced one true wavelength apart (sound travels 343 m a second, so the wavelength is 343 divided by the frequency), travel hundreds of times slower than sound so they can be seen, and are drawn inside the stated 50° by 25° at every frequency, although in life low notes spread wider than that. The landmark sounds are rough conventions, not measurements. Your own speakers or headphones are what you hear the tone through, so very low and very high tones may be faint or silent on them.</p>
    </>
  );
}
