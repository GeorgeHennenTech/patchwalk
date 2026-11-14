// Surfaces and surroundings that make a 3D view read as real things rather than plain shapes. Every texture
// here is drawn by code onto a small canvas when the view opens: no artwork is loaded.
import * as THREE from "three";

/** A small repeatable picture drawn by `paint`. `seed` keeps the noise the same every time. */
function tile(size: number, paint: (c: CanvasRenderingContext2D, rnd: () => number) => void, repeat: [number, number], color = true, seed = 7): THREE.CanvasTexture {
  const canvas = document.createElement("canvas"); canvas.width = canvas.height = size;
  let s = seed; const rnd = () => ((s = (s * 16807) % 2147483647) - 1) / 2147483646;
  paint(canvas.getContext("2d")!, rnd);
  const t = new THREE.CanvasTexture(canvas); t.wrapS = t.wrapT = THREE.RepeatWrapping; t.repeat.set(...repeat); t.anisotropy = 8;
  if (color) t.colorSpace = THREE.SRGBColorSpace;
  return t;
}
const speckle = (c: CanvasRenderingContext2D, rnd: () => number, size: number, base: number, spread: number, n: number, dot = 1) => {
  c.fillStyle = `rgb(${base},${base},${base})`; c.fillRect(0, 0, size, size);
  for (let i = 0; i < n; i++) { const v = Math.max(0, Math.min(255, base + (rnd() - 0.5) * spread)); c.fillStyle = `rgb(${v},${v},${v})`; c.fillRect(rnd() * size, rnd() * size, dot + rnd() * dot, dot + rnd() * dot); }
};

/** The textured paint on a touring loudspeaker: slightly rough, slightly bumpy. */
export function paint(color: string, o: Partial<THREE.MeshStandardMaterialParameters> = {}): THREE.MeshStandardMaterial {
  const bump = tile(128, (c, r) => speckle(c, r, 128, 128, 150, 5000), [6, 6], false);
  return new THREE.MeshStandardMaterial({ color, roughness: 0.72, metalness: 0.05, bumpMap: bump, bumpScale: 0.6, roughnessMap: bump, emissive: new THREE.Color("#000"), emissiveIntensity: 0, ...o });
}
/** A perforated steel grille: staggered round holes, `across` by `down` of them over the surface it is put on. */
export function grille(across: number, down: number): THREE.MeshStandardMaterial {
  const holes = (c: CanvasRenderingContext2D, steel: string, hole: string) => {
    c.fillStyle = steel; c.fillRect(0, 0, 64, 64); c.fillStyle = hole;
    for (const [x, y] of [[16, 16], [48, 16], [0, 48], [32, 48], [64, 48]]) { c.beginPath(); c.arc(x!, y!, 10.5, 0, Math.PI * 2); c.fill(); }
  };
  const map = tile(64, (c) => holes(c, "#3b3b40", "#060607"), [across / 2, down / 2]);
  const bump = tile(64, (c) => holes(c, "#fff", "#000"), [across / 2, down / 2], false);
  return new THREE.MeshStandardMaterial({ map, bumpMap: bump, bumpScale: 1.2, roughness: 0.5, metalness: 0.55, emissive: new THREE.Color("#000"), emissiveIntensity: 0 });
}
export const steel = (color = "#b9bcc2", roughness = 0.38) => new THREE.MeshStandardMaterial({ color, metalness: 0.95, roughness });
/** Mown grass seen from standing height and above. */
export function grass(repeat: number): THREE.MeshStandardMaterial {
  const map = tile(256, (c, r) => {
    c.fillStyle = "#6f8f4c"; c.fillRect(0, 0, 256, 256);
    for (let i = 0; i < 260; i++) { c.fillStyle = `rgba(${70 + r() * 60},${105 + r() * 60},${45 + r() * 40},0.16)`; c.beginPath(); c.arc(r() * 256, r() * 256, 6 + r() * 26, 0, 7); c.fill(); }
    for (let i = 0; i < 9000; i++) { c.fillStyle = `rgba(${55 + r() * 90},${95 + r() * 90},${35 + r() * 50},0.5)`; c.fillRect(r() * 256, r() * 256, 1, 1 + r() * 2.5); }
  }, [repeat, repeat]);
  return new THREE.MeshStandardMaterial({ map, roughness: 1 });
}
/** Birch plywood: pale wood with fine grain running one way. */
export function plywood(repeat: [number, number] = [1, 1], tint = "#c9a877"): THREE.MeshStandardMaterial {
  const map = tile(256, (c, r) => {
    c.fillStyle = tint; c.fillRect(0, 0, 256, 256);
    for (let i = 0; i < 150; i++) { const y = r() * 256, a = 0.05 + r() * 0.13; c.strokeStyle = r() > 0.5 ? `rgba(110,74,40,${a})` : `rgba(255,236,200,${a})`; c.lineWidth = 0.5 + r() * 2; c.beginPath(); c.moveTo(0, y); c.bezierCurveTo(85, y + (r() - 0.5) * 9, 170, y + (r() - 0.5) * 9, 256, y); c.stroke(); }
  }, repeat);
  return new THREE.MeshStandardMaterial({ map, roughness: 0.62, emissive: new THREE.Color("#000"), emissiveIntensity: 0 });
}
/** Pressed paper pulp, as a loudspeaker cone is made of: matt, with a fine fibre. */
export function paper(color = "#25232a"): THREE.MeshStandardMaterial {
  const bump = tile(128, (c, r) => { speckle(c, r, 128, 128, 120, 2500); for (let i = 0; i < 500; i++) { c.strokeStyle = `rgba(${r() > 0.5 ? 255 : 0},${r() > 0.5 ? 255 : 0},${r() > 0.5 ? 255 : 0},0.25)`; const x = r() * 128, y = r() * 128; c.beginPath(); c.moveTo(x, y); c.lineTo(x + (r() - 0.5) * 14, y + (r() - 0.5) * 14); c.stroke(); } }, [5, 5], false);
  return new THREE.MeshStandardMaterial({ color, roughness: 0.95, bumpMap: bump, bumpScale: 0.8, emissive: new THREE.Color("#000"), emissiveIntensity: 0 });
}

/** An open sky: a dome shaded from the horizon up, with a little haze over the far ground. */
export function sky(scene: THREE.Scene, radius: number, o: { top?: string; horizon?: string } = {}): void {
  const top = o.top ?? "#4d7fc4", horizon = o.horizon ?? "#dfe7ee";
  const canvas = document.createElement("canvas"); canvas.width = 4; canvas.height = 256;
  const c = canvas.getContext("2d")!, g = c.createLinearGradient(0, 0, 0, 256);
  g.addColorStop(0, top); g.addColorStop(0.36, "#8fb4dd"); g.addColorStop(0.5, horizon); g.addColorStop(1, horizon);
  c.fillStyle = g; c.fillRect(0, 0, 4, 256);
  const t = new THREE.CanvasTexture(canvas); t.colorSpace = THREE.SRGBColorSpace;
  const dome = new THREE.Mesh(new THREE.SphereGeometry(radius, 32, 24), new THREE.MeshBasicMaterial({ map: t, side: THREE.BackSide, fog: false, depthWrite: false }));
  dome.renderOrder = -1; scene.add(dome);
  scene.background = new THREE.Color(horizon); scene.fog = new THREE.Fog(horizon, radius * 0.35, radius * 1.05);
}
/** A photographer's table: a pale floor that only shows the shadows falling on it, under a softly shaded backdrop. */
export function studio(scene: THREE.Scene, floorY: number, radius: number): void {
  const canvas = document.createElement("canvas"); canvas.width = 4; canvas.height = 256;
  const c = canvas.getContext("2d")!, g = c.createLinearGradient(0, 0, 0, 256);
  g.addColorStop(0, "#f6f4ef"); g.addColorStop(0.5, "#e9e6df"); g.addColorStop(0.72, "#d3cec4"); g.addColorStop(1, "#c6c0b5");
  c.fillStyle = g; c.fillRect(0, 0, 4, 256);
  const t = new THREE.CanvasTexture(canvas); t.colorSpace = THREE.SRGBColorSpace;
  const dome = new THREE.Mesh(new THREE.SphereGeometry(radius * 6, 32, 24), new THREE.MeshBasicMaterial({ map: t, side: THREE.BackSide, depthWrite: false })); dome.renderOrder = -1; scene.add(dome);
  const floor = new THREE.Mesh(new THREE.CircleGeometry(radius * 3, 64), new THREE.ShadowMaterial({ opacity: 0.28 })); floor.rotation.x = -Math.PI / 2; floor.position.y = floorY; floor.receiveShadow = true; scene.add(floor);
}
/** Everything under `root` casts and receives shadows. */
export function shadowed(root: THREE.Object3D, receive = true): void {
  root.traverse((o) => { const m = o as THREE.Mesh; if (m.isMesh || (o as THREE.InstancedMesh).isInstancedMesh) { m.castShadow = true; m.receiveShadow = receive; } });
}

/** A length of lighting truss between two points: four tubes laced with diagonals, as stages and PA towers are built from. */
export function truss(from: THREE.Vector3, to: THREE.Vector3, size = 0.4, material: THREE.Material = steel("#c9ccd1", 0.42)): THREE.InstancedMesh {
  const axis = to.clone().sub(from), length = axis.length(), dir = axis.clone().normalize();
  const up = Math.abs(dir.y) > 0.9 ? new THREE.Vector3(1, 0, 0) : new THREE.Vector3(0, 1, 0);
  const a = new THREE.Vector3().crossVectors(dir, up).normalize(), b = new THREE.Vector3().crossVectors(dir, a).normalize();
  const corner = (i: number, along: number) => from.clone().addScaledVector(dir, along).addScaledVector(a, (i === 0 || i === 3 ? -1 : 1) * size / 2).addScaledVector(b, (i < 2 ? -1 : 1) * size / 2);
  const rods: [THREE.Vector3, THREE.Vector3, number][] = [];
  for (let i = 0; i < 4; i++) rods.push([corner(i, 0), corner(i, length), 0.025]);
  const bays = Math.max(1, Math.round(length / size)), step = length / bays;
  for (let k = 0; k < bays; k++) for (let i = 0; i < 4; i++) { const j = (i + 1) % 4, flip = (k + i) % 2 === 0; rods.push([corner(flip ? i : j, k * step), corner(flip ? j : i, (k + 1) * step), 0.012]); }
  const mesh = new THREE.InstancedMesh(new THREE.CylinderGeometry(1, 1, 1, 6), material, rods.length), m = new THREE.Matrix4(), q = new THREE.Quaternion(), y = new THREE.Vector3(0, 1, 0);
  rods.forEach(([p, r, radius], i) => { const d = r.clone().sub(p), len = d.length(); q.setFromUnitVectors(y, d.normalize()); m.compose(p.clone().add(r).multiplyScalar(0.5), q, new THREE.Vector3(radius, len, radius)); mesh.setMatrixAt(i, m); });
  mesh.instanceMatrix.needsUpdate = true; mesh.raycast = () => {};
  return mesh;
}

/** A small sign that always faces the viewer: `text` on a pill, `size` metres tall. Drawn by code. */
export function sign(text: string, size: number, o: { ink?: string; fill?: string } = {}): THREE.Sprite {
  const canvas = document.createElement("canvas"), c = canvas.getContext("2d")!, font = "600 44px system-ui, sans-serif";
  c.font = font; const w = Math.ceil(c.measureText(text).width) + 44; canvas.width = w; canvas.height = 72;
  c.fillStyle = o.fill ?? "rgba(24,20,32,0.86)"; c.beginPath(); c.roundRect(0, 0, w, 72, 22); c.fill();
  c.font = font; c.fillStyle = o.ink ?? "#fff"; c.textBaseline = "middle"; c.textAlign = "center"; c.fillText(text, w / 2, 38);
  const t = new THREE.CanvasTexture(canvas); t.colorSpace = THREE.SRGBColorSpace;
  const sprite = new THREE.Sprite(new THREE.SpriteMaterial({ map: t, depthTest: false, fog: false, transparent: true }));
  sprite.scale.set((size * w) / 72, size, 1); sprite.renderOrder = 5; sprite.raycast = () => {};
  return sprite;
}
