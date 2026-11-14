# A cutaway of a moving-coil cone loudspeaker driver, built from revolved outlines. Units: centimetres.
#
#   python driver.py -- <out-prefix> [samples]                 one large picture + <out>.json (where each label points)
#   python driver.py -- <out.glb> --glb                        the model itself for the live 3D view: one object per
#                                                              part; the surround and spider carry an "out" shape
#   python driver.py -- <out-dir> [samples] --frames           the cone at seven positions, each with a map of
#                                                              which part is where (flat colours), + parts.json
#
# Run with Blender's Python module (pip install bpy). The picture has no text: labels are drawn by code.
import bpy, bmesh, json, math, os, sys
from mathutils import Vector
from bpy_extras.object_utils import world_to_camera_view

ARGS = sys.argv[sys.argv.index("--") + 1:] if "--" in sys.argv else ["driver"]
OUT, SAMPLES, FRAMES, GLB = ARGS[0], int(ARGS[1]) if len(ARGS) > 1 and ARGS[1].isdigit() else 64, "--frames" in ARGS, "--glb" in ARGS
A0, A1, STEPS = math.radians(-38), math.radians(218), 72 if "--glb" in sys.argv else 128   # the wedge facing the camera is left out
TRAVEL = [-0.6, -0.4, -0.2, 0.0, 0.2, 0.4, 0.6]             # how far the cone is pushed out (+) or pulled in (-)

# name, colour, roughness, metallic. The order is also each part's number in the map.
PARTS = [
    ("Back plate", (0.6, 0.62, 0.66), 0.5, 1.0), ("Pole piece", (0.6, 0.62, 0.66), 0.5, 1.0), ("Magnet", (0.07, 0.07, 0.08), 0.6, 0.0),
    ("Top plate", (0.6, 0.62, 0.66), 0.5, 1.0), ("Former", (0.75, 0.5, 0.12), 0.4, 0.0), ("Voice coil", (0.85, 0.42, 0.2), 0.3, 1.0),
    ("Cone", (0.16, 0.16, 0.18), 0.85, 0.0), ("Dust cap", (0.1, 0.1, 0.11), 0.7, 0.0), ("Surround", (0.03, 0.03, 0.03), 0.45, 0.0),
    ("Spider", (0.85, 0.62, 0.2), 0.8, 0.0), ("Basket", (0.25, 0.3, 0.42), 0.4, 0.8),
]
# one flat colour per part for the map: easy to tell apart exactly
MAP = [(255, 0, 0), (0, 255, 0), (0, 0, 255), (255, 255, 0), (255, 0, 255), (0, 255, 255), (255, 128, 0), (128, 0, 255), (0, 128, 255), (128, 255, 0), (255, 255, 255)]

def material(name, color, rough=0.5, metal=0.0):
    m = bpy.data.materials.new(name); m.use_nodes = True
    b = m.node_tree.nodes["Principled BSDF"]
    b.inputs["Base Color"].default_value = (*color, 1); b.inputs["Roughness"].default_value = rough; b.inputs["Metallic"].default_value = metal
    return m

def flat(name, rgb):
    """A material that shows one exact colour whatever the light: for the map of parts."""
    m = bpy.data.materials.new(name); m.use_nodes = True; nt = m.node_tree; nt.nodes.clear()
    e = nt.nodes.new("ShaderNodeEmission"); e.inputs["Color"].default_value = (*[c / 255 for c in rgb], 1); e.inputs["Strength"].default_value = 1
    o = nt.nodes.new("ShaderNodeOutputMaterial"); nt.links.new(e.outputs[0], o.inputs["Surface"])
    return m

def revolve(scene, name, profile, mat, a0=A0, a1=A1, steps=STEPS):
    """Sweep a closed (r, z) outline round the axis from a0 to a1, with flat faces at both ends."""
    bm = bmesh.new(); rings = []
    for k in range(steps + 1):
        a = a0 + (a1 - a0) * k / steps
        rings.append([bm.verts.new((r * math.cos(a), r * math.sin(a), z)) for r, z in profile])
    n = len(profile)
    for k in range(steps):
        for i in range(n):
            j = (i + 1) % n
            if profile[i][0] < 1e-6 and profile[j][0] < 1e-6: continue   # on the axis: no surface
            try: bm.faces.new((rings[k][i], rings[k][j], rings[k + 1][j], rings[k + 1][i]))
            except ValueError: pass
    bm.faces.new(rings[0]); bm.faces.new(list(reversed(rings[-1])))
    bmesh.ops.remove_doubles(bm, verts=bm.verts, dist=1e-5)
    bmesh.ops.recalc_face_normals(bm, faces=bm.faces)
    me = bpy.data.meshes.new(name); bm.to_mesh(me); bm.free()
    for p in me.polygons: p.use_smooth = len(p.vertices) == 4
    ob = bpy.data.objects.new(name, me); scene.collection.objects.link(ob); ob.data.materials.append(mat)
    return ob

def shell(line, t):
    """A thin sheet following a centre line: the outline that is t thick."""
    up, down = [], []
    for i, (r, z) in enumerate(line):
        a, b = line[max(0, i - 1)], line[min(len(line) - 1, i + 1)]
        dx, dz = b[0] - a[0], b[1] - a[1]; L = math.hypot(dx, dz) or 1
        nx, nz = -dz / L, dx / L
        up.append((max(0, r + nx * t / 2), z + nz * t / 2)); down.append((max(0, r - nx * t / 2), z - nz * t / 2))
    return up + down[::-1]

box = lambda r0, r1, z0, z1: [(r0, z0), (r1, z0), (r1, z1), (r0, z1)]
lift = lambda outline, dz: [(r, z + dz) for r, z in outline]

def build(off=0.0, size=(2700, 1400), lens=41):
    """The whole scene with the moving parts pushed `off` cm along the axis. Returns the scene, camera and the parts by name."""
    bpy.ops.wm.read_factory_settings(use_empty=True)
    scene = bpy.context.scene
    mats = {name: material(name, c, r, m) for name, c, r, m in PARTS}
    part = lambda name, outline: revolve(scene, name, outline, mats[name])
    obs = {}
    # the motor: these never move. The gap is the ring-shaped slot between the pole piece and the top plate.
    obs["Back plate"] = part("Back plate", box(0, 6.0, -5.0, -4.2))
    obs["Pole piece"] = part("Pole piece", box(0, 2.4, -4.2, -1.4))
    obs["Magnet"] = part("Magnet", box(3.3, 6.0, -4.2, -2.2))
    obs["Top plate"] = part("Top plate", box(2.78, 6.0, -2.2, -1.4))
    # the moving parts: former, coil, cone and dust cap move as one
    obs["Former"] = part("Former", lift(box(2.53, 2.58, -3.3, 0.75), off))
    obs["Voice coil"] = part("Voice coil", lift(box(2.58, 2.70, -2.75, -0.85), off))
    cone_line = [(2.58 + (9.0 - 2.58) * u, 0.55 + 4.05 * (u ** 0.82)) for u in [i / 24 for i in range(25)]]
    obs["Cone"] = part("Cone", lift(shell(cone_line, 0.13), off))
    dome = [(2.95 * math.sin(t), 0.95 + 1.15 * math.cos(t)) for t in [math.radians(88) * i / 16 for i in range(17)]]
    obs["Dust cap"] = part("Dust cap", lift(shell(dome, 0.1), off))
    # the two suspensions flex: their inner edge moves with the cone, their outer edge stays on the basket
    roll = [(9.0, 4.6)] + [(9.8 - 0.75 * math.cos(t), 4.6 + 0.75 * math.sin(t)) for t in [math.pi * i / 16 for i in range(17)]] + [(10.9, 4.6)]
    obs["Surround"] = part("Surround", shell([(r, z + off * (10.9 - r) / 1.9) for r, z in roll], 0.11))
    spider = [(2.58 + (6.5 - 2.58) * u, 0.05 + 0.2 * math.sin(u * math.pi * 7) + off * (1 - u)) for u in [i / 56 for i in range(57)]]
    obs["Spider"] = part("Spider", shell(spider, 0.07))
    basket = [(6.0, -1.5), (6.9, -1.5), (6.95, 0.05), (6.5, 0.05), (6.95, 0.05), (8.2, 1.2), (10.9, 4.3), (10.9, 4.6), (11.7, 4.6)]
    obs["Basket"] = part("Basket", shell(basket, 0.24))

    bpy.ops.mesh.primitive_plane_add(size=400, location=(0, 0, -5.02))
    ground = bpy.context.object; ground.name = "ground"; ground.data.materials.append(material("ground", (0.93, 0.92, 0.9), 0.9))
    world = bpy.data.worlds.new("w"); scene.world = world; world.use_nodes = True
    world.node_tree.nodes["Background"].inputs[0].default_value = (0.95, 0.95, 0.97, 1); world.node_tree.nodes["Background"].inputs[1].default_value = 0.9
    def aim(o, target=(0, 0, 0)): o.rotation_euler = (Vector(target) - o.location).to_track_quat("-Z", "Y").to_euler()
    for loc, e, s in [((-6, -30, 26), 9000, 18), ((24, -18, 10), 3500, 14), ((0, -26, -1), 2500, 10)]:
        d = bpy.data.lights.new("AREA", "AREA"); d.energy = e; d.size = s
        o = bpy.data.objects.new("light", d); o.location = loc; scene.collection.objects.link(o); aim(o)
    cam = bpy.data.objects.new("cam", bpy.data.cameras.new("cam")); scene.collection.objects.link(cam); scene.camera = cam
    cam.location = (2.5, -36, 17); cam.data.lens = lens; aim(cam, (0, 0, -0.3))
    scene.render.engine = "CYCLES"; scene.cycles.samples = SAMPLES; scene.cycles.use_denoising = True
    scene.render.resolution_x, scene.render.resolution_y = size
    scene.view_settings.view_transform = "Standard"
    bpy.context.view_layer.update()
    return scene, cam, obs, ground

def render_map(scene, obs, ground, path):
    """The same view with every part one flat colour and nothing else: tells the page which part is under the pointer."""
    for i, (name, *_rest) in enumerate(PARTS):
        obs[name].data.materials.clear(); obs[name].data.materials.append(flat("map-" + name, MAP[i]))
    ground.hide_render = True
    scene.world.node_tree.nodes["Background"].inputs[0].default_value = (0, 0, 0, 1)
    for o in scene.objects:
        if o.type == "LIGHT": o.hide_render = True
    scene.cycles.samples = 1; scene.cycles.use_denoising = False; scene.cycles.filter_width = 0.01
    scene.view_settings.view_transform = "Raw"; scene.render.image_settings.color_mode = "RGB"
    scene.render.filepath = path; bpy.ops.render.render(write_still=True)

if GLB:
    # The model for the browser. Moving parts are moved by the page; the two suspensions bend, so each carries
    # a second shape ("out": the cone pushed 6 mm out) that the page blends towards or away from.
    scene, cam, obs, ground = build(0.0)
    scene2, _c, obs2, _g = build(TRAVEL[-1])
    out = {n: [v.co.copy() for v in obs2[n].data.vertices] for n in ("Surround", "Spider")}
    scene, cam, obs, ground = build(0.0)
    for n in ("Surround", "Spider"):
        ob = obs[n]; assert len(ob.data.vertices) == len(out[n]), n
        ob.shape_key_add(name="Basis"); key = ob.shape_key_add(name="out")
        for v, co in zip(key.data, out[n]): v.co = co
    for o in scene.objects: o.select_set(o.name in obs)
    bpy.ops.export_scene.gltf(filepath=OUT, export_format="GLB", use_selection=True, export_morph=True, export_yup=True, export_apply=False)
elif FRAMES:
    os.makedirs(OUT, exist_ok=True)
    for k, off in enumerate(TRAVEL):
        scene, cam, obs, ground = build(off, size=(1600, 830))
        scene.render.filepath = f"{OUT}/frame{k}.png"; bpy.ops.render.render(write_still=True)
        render_map(scene, obs, ground, f"{OUT}/map{k}.png")
    json.dump({"travel": TRAVEL, "rest": TRAVEL.index(0.0), "parts": [{"name": n, "map": MAP[i]} for i, (n, *_r) in enumerate(PARTS)]}, open(f"{OUT}/parts.json", "w"), indent=1)
else:
    scene, cam, obs, ground = build()
    def spot(r, z, a=A0):
        v = world_to_camera_view(scene, cam, Vector((r * math.cos(a), r * math.sin(a), z)))
        return [round(v.x, 4), round(1 - v.y, 4)]
    anchors = {
        "Dust cap": spot(1.5, 1.94, A1), "Cone": spot(6.2, 3.3), "Surround": spot(9.8, 5.3), "Spider": spot(4.8, 0.1),
        "Basket (frame)": spot(9.5, 2.72, A1), "Voice coil": spot(2.64, -1.8), "Former": spot(2.55, 0.35, A1),
        "Top plate": spot(4.6, -1.8), "Magnet": spot(4.7, -3.2), "Pole piece": spot(1.2, -2.6), "Back plate": spot(4.2, -4.6, A1), "Magnetic gap": spot(2.74, -1.5, A1),
    }
    json.dump(anchors, open(OUT + ".json", "w"), indent=1)
    scene.render.filepath = OUT + ".png"; bpy.ops.render.render(write_still=True)
