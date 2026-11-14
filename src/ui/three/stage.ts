// The shared set-up for a 3D view: a renderer in a host element, a camera you can turn, soft light, and
// pointing at things. Each view adds its own objects and says what to do every frame.
import * as THREE from "three";
import { OrbitControls } from "three/examples/jsm/controls/OrbitControls.js";
import { RoomEnvironment } from "three/examples/jsm/environments/RoomEnvironment.js";

export interface Stage {
  scene: THREE.Scene; camera: THREE.PerspectiveCamera; controls: OrbitControls;
  /** Objects that can be pointed at; each carries `userData.id`. */ pickable: THREE.Object3D[];
  /** Move the camera and where it looks, smoothly enough to follow. */ lookFrom(position: [number, number, number], target: [number, number, number]): void;
  dispose(): void;
}

export function makeStage(host: HTMLElement, o: { camera: [number, number, number]; target: [number, number, number]; near?: number; far?: number; min?: number; max?: number; background?: string; ratio?: number;
  onHover(id: string | undefined): void; onPick(id: string | undefined): void; onFrame?(seconds: number): void }): Stage | undefined {
  let renderer: THREE.WebGLRenderer;
  try { renderer = new THREE.WebGLRenderer({ antialias: true }); } catch { return undefined; }
  renderer.setPixelRatio(Math.min(2, window.devicePixelRatio || 1));
  renderer.toneMapping = THREE.ACESFilmicToneMapping; renderer.toneMappingExposure = 0.85;
  host.appendChild(renderer.domElement);
  const scene = new THREE.Scene(); scene.background = new THREE.Color(o.background ?? "#efeeea");
  const pmrem = new THREE.PMREMGenerator(renderer);
  scene.environment = pmrem.fromScene(new RoomEnvironment(), 0.04).texture; scene.environmentIntensity = 0.55;
  const sun = new THREE.DirectionalLight(0xffffff, 1.6); sun.position.set(-20, 40, 30); scene.add(sun);
  scene.add(new THREE.HemisphereLight(0xffffff, 0x8a8494, 0.4));
  const camera = new THREE.PerspectiveCamera(34, 2, o.near ?? 0.1, o.far ?? 2000); camera.position.set(...o.camera);
  const controls = new OrbitControls(camera, renderer.domElement);
  controls.target.set(...o.target); controls.enableDamping = true; controls.minDistance = o.min ?? 1; controls.maxDistance = o.max ?? 500; controls.maxPolarAngle = Math.PI * 0.495; controls.update();
  const size = () => { const w = host.clientWidth, h = Math.round(w * (o.ratio ?? 0.56)); renderer.setSize(w, h); camera.aspect = w / h; camera.updateProjectionMatrix(); };
  size(); const watcher = new ResizeObserver(size); watcher.observe(host);

  const pickable: THREE.Object3D[] = [];
  const ray = new THREE.Raycaster(), at = new THREE.Vector2();
  const under = (e: PointerEvent): string | undefined => {
    const b = renderer.domElement.getBoundingClientRect();
    at.set(((e.clientX - b.left) / b.width) * 2 - 1, -((e.clientY - b.top) / b.height) * 2 + 1);
    ray.setFromCamera(at, camera);
    let hit: THREE.Object3D | null | undefined = ray.intersectObjects(pickable, true)[0]?.object;
    while (hit && hit.userData.id === undefined) hit = hit.parent;
    return hit?.userData.id as string | undefined;
  };
  let downAt: [number, number] | undefined;
  const el = renderer.domElement;
  const onMove = (e: PointerEvent) => o.onHover(under(e)), onLeave = () => o.onHover(undefined);
  const onDown = (e: PointerEvent) => { downAt = [e.clientX, e.clientY]; };
  // a click picks; a drag turns the view and picks nothing
  const onUp = (e: PointerEvent) => { if (downAt && Math.hypot(e.clientX - downAt[0], e.clientY - downAt[1]) < 5) o.onPick(under(e)); downAt = undefined; };
  el.addEventListener("pointermove", onMove); el.addEventListener("pointerleave", onLeave); el.addEventListener("pointerdown", onDown); el.addEventListener("pointerup", onUp);

  let goal: { p: THREE.Vector3; t: THREE.Vector3 } | undefined, frame = 0;
  const loop = (ms: number) => {
    if (goal) { camera.position.lerp(goal.p, 0.12); controls.target.lerp(goal.t, 0.12); if (camera.position.distanceTo(goal.p) < 0.02) goal = undefined; }
    o.onFrame?.(ms / 1000); controls.update(); renderer.render(scene, camera);
    frame = requestAnimationFrame(loop);
  };
  frame = requestAnimationFrame(loop);
  return { scene, camera, controls, pickable,
    lookFrom: (p, t) => { goal = { p: new THREE.Vector3(...p), t: new THREE.Vector3(...t) }; },
    dispose: () => { cancelAnimationFrame(frame); watcher.disconnect();
      el.removeEventListener("pointermove", onMove); el.removeEventListener("pointerleave", onLeave); el.removeEventListener("pointerdown", onDown); el.removeEventListener("pointerup", onUp);
      controls.dispose(); pmrem.dispose(); renderer.dispose(); el.remove(); } };
}
