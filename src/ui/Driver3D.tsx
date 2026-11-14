// The loudspeaker driver as a live 3D model: turn it, zoom, point at parts, move the cone by hand, or play
// a tone and watch the cone follow it, slowed down. The model comes from scripts/blender/driver.py (--glb).
import { useEffect, useRef, useState } from "react";
import * as THREE from "three";
import { GLTFLoader } from "three/examples/jsm/loaders/GLTFLoader.js";
import { OrbitControls } from "three/examples/jsm/controls/OrbitControls.js";
import { RoomEnvironment } from "three/examples/jsm/environments/RoomEnvironment.js";
import { DRIVER_PARTS } from "../soundsystems/driver";
import modelUrl from "../assets/diagrams/driver/driver.glb?url";

/** Parts that travel with the cone, and the two that bend. Distances are centimetres, as in the model. */
const TRAVELLERS = ["Former", "Voice coil", "Cone", "Dust cap"], BENDERS = ["Surround", "Spider"];
const MAX = 0.6;          // furthest the cone goes either way
const SLOWED = 50;        // the picture runs this many times slower than the sound
const NAMES = DRIVER_PARTS.map((p) => p.name);
const key = (name: string) => name.replace(/[\s_.]+/g, "").toLowerCase();

export default function Driver3D() {
  const mount = useRef<HTMLDivElement>(null);
  const [picked, setPicked] = useState<number>();
  const [hover, setHover] = useState(-1);
  const [offset, setOffset] = useState(0);       // where the slider has the cone, in cm
  const [hz, setHz] = useState(60);
  const [playing, setPlaying] = useState(false);
  const [failed, setFailed] = useState<string>();
  const live = useRef({ offset: 0, hz: 60, playing: false, lit: -1, startedAt: 0 });
  live.current.offset = offset; live.current.hz = hz; live.current.playing = playing; live.current.lit = hover >= 0 ? hover : picked ?? -1;
  const pickRef = useRef<(i: number | undefined) => void>(() => {}); pickRef.current = setPicked;
  const hoverRef = useRef<(i: number) => void>(() => {}); hoverRef.current = setHover;

  useEffect(() => {
    const host = mount.current!;
    let renderer: THREE.WebGLRenderer;
    try { renderer = new THREE.WebGLRenderer({ antialias: true }); } catch { setFailed("This browser could not start 3D drawing. The rendered picture still works."); return; }
    renderer.setPixelRatio(Math.min(2, window.devicePixelRatio || 1));
    renderer.toneMapping = THREE.ACESFilmicToneMapping; renderer.toneMappingExposure = 0.82;
    host.appendChild(renderer.domElement);
    const scene = new THREE.Scene(); scene.background = new THREE.Color("#efeeea");
    const pmrem = new THREE.PMREMGenerator(renderer);
    scene.environment = pmrem.fromScene(new RoomEnvironment(), 0.04).texture;   // something for the steel to reflect
    scene.environmentIntensity = 0.55;
    const sun = new THREE.DirectionalLight(0xffffff, 1.6); sun.position.set(-8, 30, 26); scene.add(sun);
    scene.add(new THREE.HemisphereLight(0xffffff, 0x8a8494, 0.35));
    const camera = new THREE.PerspectiveCamera(32, 2, 0.5, 400); camera.position.set(2.2, 14.5, 28);
    const controls = new OrbitControls(camera, renderer.domElement);
    controls.target.set(0, -0.3, 0); controls.enableDamping = true; controls.minDistance = 10; controls.maxDistance = 90; controls.maxPolarAngle = Math.PI * 0.92; controls.update();

    const parts: (THREE.Mesh | undefined)[] = [];
    const homeY = new Map<THREE.Object3D, number>();
    new GLTFLoader().load(modelUrl, (gltf) => {
      gltf.scene.traverse((o) => {
        const mesh = o as THREE.Mesh; if (!mesh.isMesh) return;
        const i = NAMES.findIndex((n) => key(n) === key(mesh.name) || key(n) === key(mesh.parent?.name ?? ""));
        if (i < 0) return;
        mesh.material = (mesh.material as THREE.MeshStandardMaterial).clone();
        (mesh.material as THREE.MeshStandardMaterial).side = THREE.DoubleSide;   // the cut shows the insides of thin parts
        mesh.userData.part = i; parts[i] = mesh; homeY.set(mesh, mesh.position.y);
      });
      scene.add(gltf.scene);
    }, undefined, () => setFailed("The 3D model could not be loaded. The rendered picture still works."));

    const size = () => { const w = host.clientWidth, h = Math.round(w * 0.56); renderer.setSize(w, h); camera.aspect = w / h; camera.updateProjectionMatrix(); };
    size(); const watcher = new ResizeObserver(size); watcher.observe(host);

    // pointing: which part is under the pointer
    const ray = new THREE.Raycaster(), at = new THREE.Vector2();
    const under = (e: PointerEvent) => {
      const b = renderer.domElement.getBoundingClientRect();
      at.set(((e.clientX - b.left) / b.width) * 2 - 1, -((e.clientY - b.top) / b.height) * 2 + 1);
      ray.setFromCamera(at, camera);
      const hit = ray.intersectObjects(parts.filter(Boolean) as THREE.Mesh[], false)[0];
      return hit ? (hit.object.userData.part as number) : -1;
    };
    let downAt: [number, number] | undefined;
    const onMove = (e: PointerEvent) => hoverRef.current(under(e));
    const onLeave = () => hoverRef.current(-1);
    const onDown = (e: PointerEvent) => { downAt = [e.clientX, e.clientY]; };
    // a click picks a part; a drag turns the model and picks nothing
    const onUp = (e: PointerEvent) => { if (downAt && Math.hypot(e.clientX - downAt[0], e.clientY - downAt[1]) < 5) { const p = under(e); pickRef.current(p >= 0 ? p : undefined); } downAt = undefined; };
    const el = renderer.domElement;
    el.addEventListener("pointermove", onMove); el.addEventListener("pointerleave", onLeave); el.addEventListener("pointerdown", onDown); el.addEventListener("pointerup", onUp);

    let frame = 0;
    const glow = new THREE.Color("#ff2e93"), none = new THREE.Color(0, 0, 0);
    const loop = (t: number) => {
      const s = live.current;
      // with a tone playing the cone follows the wave, slowed so the eye can keep up; otherwise it sits where the slider is
      const off = s.playing ? MAX * 0.85 * Math.sin((2 * Math.PI * s.hz * ((t - s.startedAt) / 1000)) / SLOWED) : s.offset;
      parts.forEach((mesh, i) => {
        if (!mesh) return;
        const name = NAMES[i]!;
        if (TRAVELLERS.includes(name)) mesh.position.y = homeY.get(mesh)! + off;
        if (BENDERS.includes(name) && mesh.morphTargetInfluences) mesh.morphTargetInfluences[0] = off / MAX;
        const m = mesh.material as THREE.MeshStandardMaterial;
        m.emissive.copy(i === s.lit ? glow : none); m.emissiveIntensity = i === s.lit ? 0.28 : 0;
      });
      controls.update(); renderer.render(scene, camera);
      frame = requestAnimationFrame(loop);
    };
    frame = requestAnimationFrame(loop);
    return () => {
      cancelAnimationFrame(frame); watcher.disconnect();
      el.removeEventListener("pointermove", onMove); el.removeEventListener("pointerleave", onLeave); el.removeEventListener("pointerdown", onDown); el.removeEventListener("pointerup", onUp);
      controls.dispose(); pmrem.dispose(); renderer.dispose(); el.remove();
    };
  }, []);

  // the tone: a plain sine at the chosen frequency, quiet
  const audio = useRef<{ ctx: AudioContext; osc: OscillatorNode; gain: GainNode } | undefined>(undefined);
  useEffect(() => {
    if (!playing) { const a = audio.current; if (a) { a.gain.gain.setTargetAtTime(0, a.ctx.currentTime, 0.02); const old = a; setTimeout(() => { old.osc.stop(); void old.ctx.close(); }, 200); audio.current = undefined; } return; }
    const ctx = new AudioContext(), osc = ctx.createOscillator(), gain = ctx.createGain();
    osc.frequency.value = live.current.hz; gain.gain.value = 0; gain.gain.setTargetAtTime(0.18, ctx.currentTime, 0.03);
    osc.connect(gain).connect(ctx.destination); osc.start();
    audio.current = { ctx, osc, gain }; live.current.startedAt = performance.now();
  }, [playing]);
  useEffect(() => { audio.current?.osc.frequency.setTargetAtTime(hz, audio.current.ctx.currentTime, 0.02); }, [hz]);
  useEffect(() => () => { const a = audio.current; if (a) { a.osc.stop(); void a.ctx.close(); } }, []);

  const shown = picked ?? (hover >= 0 ? hover : undefined), part = shown !== undefined ? DRIVER_PARTS[shown] : undefined;
  return (
    <>
      <div className="driver-grid">
        <div className="driver-stage three" ref={mount} aria-label="A 3D model of a loudspeaker driver with a wedge cut out. Drag to turn it, scroll to zoom." role="img">
          {failed && <p className="driver-failed">{failed}</p>}
        </div>
        <div className="driver-side">
          <div className="driver-parts" role="group" aria-label="Parts">
            {DRIVER_PARTS.map((p, i) => <button key={p.name} className={i === (picked ?? hover) ? "on" : ""} aria-pressed={i === picked} onClick={() => setPicked(i === picked ? undefined : i)} onPointerEnter={() => setHover(i)} onPointerLeave={() => setHover(-1)}>{p.name}</button>)}
          </div>
          <div className="driver-info" role="status">
            {part ? <><h3>{part.name}</h3><p>{part.job}</p><p className="muted">When the cone moves, this part {part.moves === "with the cone" ? "moves with it" : part.moves === "flexes" ? "flexes: its inner edge moves and its outer edge stays put" : "stays still"}.</p></>
              : <p className="muted">Drag to turn the driver, scroll or pinch to zoom, and point at a part to see what it does. The narrow slot between the pole piece and the top plate is the magnetic gap; the voice coil sits in it.</p>}
          </div>
        </div>
      </div>
      <div className="driver-controls">
        <label className="driver-slider">
          <span>Cone position</span>
          <input type="range" min={-MAX} max={MAX} step={0.02} value={offset} disabled={playing} onChange={(e) => setOffset(Number(e.target.value))} aria-valuetext={`${Math.abs(Math.round(offset * 10))} millimetres ${offset >= 0 ? "out" : "in"}`} />
          <output>{Math.abs(offset) < 0.01 ? "at rest" : `${Math.abs(offset * 10).toFixed(1)} mm ${offset > 0 ? "out" : "in"}`}</output>
        </label>
        <button className={playing ? "" : "primary"} onClick={() => setPlaying((v) => !v)}>{playing ? "Stop the tone" : "Play a tone and watch"}</button>
        <label className="driver-slider tone">
          <span>Tone</span>
          <input type="range" min={30} max={200} step={1} value={hz} onChange={(e) => setHz(Number(e.target.value))} />
          <output>{hz} Hz</output>
        </label>
      </div>
      <p className="muted">{playing ? `The cone is following the tone, shown ${SLOWED} times slower than it really moves: at ${hz} Hz it goes in and out ${hz} times a second, far too fast to see. Raise the tone and it moves faster. The distance it travels here is exaggerated so you can see it.` : "Play a tone to hear it and watch the cone follow it in slow motion. Keep the volume low: these are low notes."}</p>
    </>
  );
}
