# A cutaway of a moving-coil cone loudspeaker driver, built from revolved profiles. Units: centimetres.
import bpy, bmesh, json, math, sys
from mathutils import Vector
from bpy_extras.object_utils import world_to_camera_view

OUT = sys.argv[sys.argv.index("--") + 1] if "--" in sys.argv else "driver"
A0, A1, STEPS = math.radians(-38), math.radians(218), 128   # the wedge facing the camera is left out

bpy.ops.wm.read_factory_settings(use_empty=True)
scene = bpy.context.scene

def material(name, color, rough=0.5, metal=0.0):
    m = bpy.data.materials.new(name); m.use_nodes = True
    b = m.node_tree.nodes["Principled BSDF"]
    b.inputs["Base Color"].default_value = (*color, 1); b.inputs["Roughness"].default_value = rough; b.inputs["Metallic"].default_value = metal
    return m

def revolve(name, profile, mat, a0=A0, a1=A1, steps=STEPS):
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
steel = material("steel", (0.6, 0.62, 0.66), 0.5, 1.0)
ferrite = material("magnet", (0.07, 0.07, 0.08), 0.6)
copper = material("copper", (0.85, 0.42, 0.2), 0.3, 1.0)
paper = material("cone", (0.16, 0.16, 0.18), 0.85)
rubber = material("surround", (0.03, 0.03, 0.03), 0.45)
cloth = material("spider", (0.85, 0.62, 0.2), 0.8)
kapton = material("former", (0.75, 0.5, 0.12), 0.4)
frame = material("basket", (0.25, 0.3, 0.42), 0.4, 0.8)
cap = material("dustcap", (0.1, 0.1, 0.11), 0.7)

# the motor: back plate and pole piece (one piece of steel), ring magnet, top plate; the gap is between pole and top plate
revolve("Back plate and pole piece", [(0, -5.0), (6.0, -5.0), (6.0, -4.2), (2.4, -4.2), (2.4, -1.4), (0, -1.4)], steel)
revolve("Magnet", box(3.3, 6.0, -4.2, -2.2), ferrite)
revolve("Top plate", box(2.78, 6.0, -2.2, -1.4), steel)
# the moving parts
revolve("Former", box(2.53, 2.58, -3.3, 0.75), kapton)
revolve("Voice coil", box(2.58, 2.70, -2.75, -0.85), copper)
cone_line = [(2.58 + (9.0 - 2.58) * u, 0.55 + 4.05 * (u ** 0.82)) for u in [i / 24 for i in range(25)]]
revolve("Cone", shell(cone_line, 0.13), paper)
dome = [(2.95 * math.sin(t), 0.95 + 1.15 * math.cos(t)) for t in [math.radians(88) * i / 16 for i in range(17)]]
revolve("Dust cap", shell(dome, 0.1), cap)
roll = [(9.0, 4.6)] + [(9.8 - 0.75 * math.cos(t), 4.6 + 0.75 * math.sin(t)) for t in [math.pi * i / 16 for i in range(17)]] + [(10.9, 4.6)]
revolve("Surround", shell(roll, 0.11), rubber)
spider = [(2.58 + (6.5 - 2.58) * u, 0.05 + 0.2 * math.sin(u * math.pi * 7)) for u in [i / 56 for i in range(57)]]
revolve("Spider", shell(spider, 0.07), cloth)
# the basket: from the top plate up to the spider's ledge, then out to the rim
basket = [(6.0, -1.5), (6.9, -1.5), (6.95, 0.05), (6.5, 0.05), (6.95, 0.05), (8.2, 1.2), (10.9, 4.3), (10.9, 4.6), (11.7, 4.6)]
revolve("Basket", shell(basket, 0.24), frame)

# ground, light and camera
bpy.ops.mesh.primitive_plane_add(size=400, location=(0, 0, -5.02))
ground = bpy.context.object; ground.data.materials.append(material("ground", (0.93, 0.92, 0.9), 0.9))
world = bpy.data.worlds.new("w"); scene.world = world; world.use_nodes = True
world.node_tree.nodes["Background"].inputs[0].default_value = (0.95, 0.95, 0.97, 1); world.node_tree.nodes["Background"].inputs[1].default_value = 0.9
def light(kind, loc, energy, size=10, rot=(0, 0, 0)):
    d = bpy.data.lights.new(kind, kind); d.energy = energy
    if kind == "AREA": d.size = size
    o = bpy.data.objects.new(kind, d); o.location = loc; o.rotation_euler = rot; scene.collection.objects.link(o); return o
def aim(o, target=(0, 0, 0)):
    o.rotation_euler = (Vector(target) - o.location).to_track_quat("-Z", "Y").to_euler()
for loc, e, s in [((-6, -30, 26), 9000, 18), ((24, -18, 10), 3500, 14), ((0, -26, -1), 2500, 10)]:
    aim(light("AREA", loc, e, s))
cam = bpy.data.objects.new("cam", bpy.data.cameras.new("cam")); scene.collection.objects.link(cam); scene.camera = cam
cam.location = (2.5, -36, 17); cam.data.lens = 41; aim(cam, (0, 0, -0.3))

scene.render.engine = "CYCLES"; scene.cycles.samples = int(sys.argv[sys.argv.index("--") + 2]) if len(sys.argv) > sys.argv.index("--") + 2 else 64
scene.cycles.use_denoising = True; scene.render.resolution_x, scene.render.resolution_y = 2700, 1400
scene.view_settings.view_transform = "Standard"; scene.render.filepath = OUT + ".png"
bpy.context.view_layer.update()

# where each label points: a spot on the cut face nearest the right of the picture, as picture coordinates
cut = A0
def spot(r, z, a=cut):
    v = world_to_camera_view(scene, cam, Vector((r * math.cos(a), r * math.sin(a), z)))
    return [round(v.x, 4), round(1 - v.y, 4)]
left = A1
anchors = {
  "Dust cap": spot(1.5, 1.94, left), "Cone": spot(6.2, 3.3), "Surround": spot(9.8, 5.3), "Spider": spot(4.8, 0.1),
  "Basket (frame)": spot(9.5, 2.72, left), "Voice coil": spot(2.64, -1.8), "Former": spot(2.55, 0.35, left),
  "Top plate": spot(4.6, -1.8), "Magnet": spot(4.7, -3.2), "Pole piece": spot(1.2, -2.6), "Back plate": spot(4.2, -4.6, left), "Magnetic gap": spot(2.74, -1.5, left),
}
json.dump(anchors, open(OUT + ".json", "w"), indent=1)
bpy.ops.render.render(write_still=True)
