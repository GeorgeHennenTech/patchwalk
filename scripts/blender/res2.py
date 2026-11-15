# Funktion-One Res 2, modelled from the maker's dimensioned drawing (library/cad/funktion-one/R2-webdxf.dxf)
# and photograph, for the live 3D view. Units: metres. X is across, Z is up, the front faces -Y.
#
#   python res2.py -- <out.glb> <ao.png> [samples]
#
# Writes the model (one object per part, named for the page to find) and one picture holding the soft
# shadowing where surfaces meet ("ambient occlusion"), which the page lays over the model.
# Only the outside is the maker's. How deep each horn goes and its shape inside are illustrative.
import bpy, bmesh, math, sys
from mathutils import Vector

ARGS = sys.argv[sys.argv.index("--") + 1:]
OUT, AO, SAMPLES = ARGS[0], ARGS[1], int(ARGS[2]) if len(ARGS) > 2 else 96
W, WB, H, D = 0.522, 0.344, 0.92, 0.445
PURPLE, GREY, DARK, STEEL = (0.022, 0.016, 0.052), (0.46, 0.47, 0.5), (0.006, 0.006, 0.008), (0.5, 0.52, 0.55)
# openings on the front: metres from the left edge and from the top, measured off the drawing
MID, HIGH, BASS = (0.059, 0.464, 0.051, 0.3), (0.186, 0.338, 0.341, 0.428), (0.016, 0.506, 0.558, 0.905)
fx = lambda x: x - W / 2
fz = lambda y: H - y

bpy.ops.wm.read_factory_settings(use_empty=True)
scene = bpy.context.scene

def material(name, color, rough=0.6, metal=0.0):
    m = bpy.data.materials.new(name); m.use_nodes = True
    b = m.node_tree.nodes["Principled BSDF"]
    b.inputs["Base Color"].default_value = (*color, 1); b.inputs["Roughness"].default_value = rough; b.inputs["Metallic"].default_value = metal
    return m
MAT = {"Body": material("Body", PURPLE, 0.62), "Panel": material("Panel", GREY, 0.5), "MidHorn": material("MidHorn", GREY, 0.5), "HighHorn": material("HighHorn", GREY, 0.5),
       "BassHorn": material("BassHorn", (0.01, 0.008, 0.024), 0.75), "Plug": material("Plug", DARK, 0.4), "Recess": material("Recess", DARK, 0.8),
       "Steel": material("Steel", STEEL, 0.35, 1.0), "Bolt": material("Bolt", (0.08, 0.08, 0.09), 0.4, 1.0), "Socket": material("Socket", DARK, 0.5)}

def obj(name, verts, faces, mat):
    me = bpy.data.meshes.new(name); me.from_pydata([tuple(v) for v in verts], [], faces); me.update()
    bm = bmesh.new(); bm.from_mesh(me); bmesh.ops.recalc_face_normals(bm, faces=bm.faces); bm.to_mesh(me); bm.free()
    o = bpy.data.objects.new(name, me); scene.collection.objects.link(o); me.materials.append(MAT[mat]); return o

def frustum(name, front, y0, back, y1, mat):
    """A solid between two rectangles (x0, x1, z0, z1): one at depth y0, one at depth y1."""
    def ring(r, y): return [(r[0], y, r[2]), (r[1], y, r[2]), (r[1], y, r[3]), (r[0], y, r[3])]
    v = ring(front, y0) + ring(back, y1)
    return obj(name, v, [(0, 1, 2, 3), (7, 6, 5, 4), (0, 4, 5, 1), (1, 5, 6, 2), (2, 6, 7, 3), (3, 7, 4, 0)], mat)

def prism(name, outline, y0, y1, mat):
    """A flat outline of (x, z) points given thickness from depth y0 to y1."""
    n = len(outline); v = [(x, y0, z) for x, z in outline] + [(x, y1, z) for x, z in outline]
    return obj(name, v, [tuple(range(n)), tuple(range(2 * n - 1, n - 1, -1))] + [(i, (i + 1) % n, n + (i + 1) % n, n + i) for i in range(n)], mat)

def box(name, size, at, mat, rot_z=0.0):
    sx, sy, sz = [s / 2 for s in size]
    o = frustum(name, (-sx, sx, -sz, sz), -sy, (-sx, sx, -sz, sz), sy, mat); o.location = at; o.rotation_euler[2] = rot_z; return o

def cylinder(name, radius, length, at, axis, mat, segs=24):
    bpy.ops.mesh.primitive_cylinder_add(vertices=segs, radius=radius, depth=length, location=at)
    o = bpy.context.active_object; o.name = name; o.data.materials.append(MAT[mat])
    o.rotation_euler = Vector((0, 0, 1)).rotation_difference(Vector(axis).normalized()).to_euler()
    for p in o.data.polygons: p.use_smooth = len(p.vertices) == 4
    return o

def apply(o, kind, **kw):
    bpy.context.view_layer.objects.active = o
    m = o.modifiers.new(kind, kind)
    for k, val in kw.items(): setattr(m, k, val)
    bpy.ops.object.modifier_apply(modifier=m.name)

def bevel(o, width, segments=3):
    apply(o, "BEVEL", width=width, segments=segments, limit_method="ANGLE", angle_limit=math.radians(40))

def cut(target, cutter):
    """Take `cutter` out of `target`; the new surfaces keep the cutter's material. The cutter is removed."""
    bpy.context.view_layer.objects.active = target
    m = target.modifiers.new("cut", "BOOLEAN"); m.operation = "DIFFERENCE"; m.object = cutter; m.solver = "EXACT"
    try: m.material_mode = "TRANSFER"
    except Exception: pass
    bpy.ops.object.modifier_apply(modifier=m.name)
    bpy.data.objects.remove(cutter, do_unlink=True)

def cavity(name, mouth, throat, depth, mat, ahead=0.03):
    """The air inside a horn: from its mouth on the front back to a smaller throat. It starts a little ahead of the front so it cuts cleanly."""
    m = (fx(mouth[0]), fx(mouth[1]), fz(mouth[3]), fz(mouth[2])); t = (fx(throat[0]), fx(throat[1]), fz(throat[3]), fz(throat[2]))
    grow = ahead / depth; front = tuple(m[i] + (m[i] - t[i]) * grow for i in range(4))
    return frustum(name, front, -ahead, t, depth, mat)
centre = lambda o, w, h: ((o[0] + o[1]) / 2 - w / 2, (o[0] + o[1]) / 2 + w / 2, (o[2] + o[3]) / 2 - h / 2, (o[2] + o[3]) / 2 + h / 2)
MID_T, HIGH_T, BASS_T = centre(MID, 0.2, 0.13), centre(HIGH, 0.034, 0.034), (0.12, 0.402, 0.658, 0.812)

# the cabinet: wider at the front than the back, edges rounded, then the three horns and the handles cut out of it
body = frustum("Body", (-W / 2, W / 2, 0, H), 0, (-WB / 2, WB / 2, 0, H), D, "Body"); bevel(body, 0.007)
for slot, name, mouth, throat, depth in ((1, "MidHorn", MID, MID_T, 0.15), (2, "HighHorn", HIGH, HIGH_T, 0.085), (3, "BassHorn", BASS, BASS_T, 0.27)):
    c = cavity("c", mouth, throat, depth, name); body.data.materials.append(MAT[name]); cut(body, c)
lean = math.atan2((W - WB) / 2, D)
body.data.materials.append(MAT["Recess"])
def recess(size, at, rot_z=0.0):
    c = box("c", size, at, "Recess", rot_z); bevel(c, min(size) * 0.42, 4); cut(body, c)
recess((0.2, 0.045, 0.07), (0, 0.375, H))                                       # the hand slot in the top, by the back
for side in (-1, 1):                                                            # a hand slot in each side
    recess((0.06, 0.13, 0.04), (side * ((W + WB) / 4 + 0.012), D * 0.52, H * 0.74), -side * lean)
for z in (0.1, H - 0.07): recess((0.2, 0.05, 0.04), (0, D, z))                   # and two in the back

# the pale moulding the two upper horns sit in: square at the top, cut in at the bottom corners
panel = prism("Panel", [(fx(x), fz(y)) for x, y in ((0.03, 0.015), (0.492, 0.015), (0.492, 0.315), (0.35, 0.462), (0.172, 0.462), (0.03, 0.315))], -0.007, 0.004, "Panel")
bevel(panel, 0.003, 2)
for mouth, throat, depth in ((MID, MID_T, 0.15), (HIGH, HIGH_T, 0.085)): cut(panel, cavity("c", mouth, throat, depth, "Panel"))

# the shaped piece the drawing shows in the mouth of the mid horn: six-sided, wide, pointed to left and right
def revolve(name, profile, segs, mat):
    v, f = [], []
    for r, y in profile: v += [(r * math.cos(2 * math.pi * k / segs), y, r * math.sin(2 * math.pi * k / segs)) for k in range(segs)]
    for i in range(len(profile) - 1): f += [(i * segs + k, i * segs + (k + 1) % segs, (i + 1) * segs + (k + 1) % segs, (i + 1) * segs + k) for k in range(segs)]
    f += [tuple(range(segs)), tuple(range(len(v) - 1, len(v) - segs - 1, -1))]
    return obj(name, v, f, mat)
plug = revolve("Plug", [(0.012, -0.052), (0.036, -0.046), (0.068, 0.0), (0.04, 0.06), (0.012, 0.085)], 6, "Plug")
plug.scale = (1.85, 1, 1); plug.location = (0, 0.055, fz((MID[2] + MID[3]) / 2)); bevel(plug, 0.004, 3)

# inside the bass horn: the wall down its middle, and the strut the photograph shows
bx = (BASS_T[2] + BASS[3]) / 2
divider = box("Divider", (0.018, 0.27, BASS[3] - BASS_T[2] - 0.004), (0, 0.135, fz(bx)), "BassHorn"); bevel(divider, 0.003, 2)
a, b = Vector((fx(0.1), 0.02, fz(0.88))), Vector((fx(0.2), 0.25, fz(0.68)))
strut = cylinder("Strut", 0.007, (b - a).length, (a + b) / 2, b - a, "BassHorn", 12)

# fixings: screws round the moulding, flypoints up the sides and on top, the connector plate on the back
parts = []
for x, y in ((0.045, 0.03), (0.261, 0.026), (0.477, 0.03), (0.045, 0.176), (0.477, 0.176), (0.045, 0.31), (0.477, 0.31), (0.18, 0.448), (0.342, 0.448)):
    parts.append(cylinder("Bolt", 0.0055, 0.005, (fx(x), -0.008, fz(y)), (0, 1, 0), "Bolt", 12))
for side in (-1, 1):
    n = Vector((side * math.cos(lean), math.sin(lean), 0))
    for z in (H / 2 - 0.405, H / 2 + 0.405):
        parts.append(cylinder("Fly", 0.011, 0.006, Vector((side * (W + WB) / 4, D / 2, z)) + n * 0.002, n, "Steel", 20))
    parts.append(cylinder("Fly", 0.011, 0.006, (side * 0.105, 0.2, H + 0.002), (0, 0, 1), "Steel", 20))
plate = box("Plate", (0.11, 0.006, 0.08), (0, D + 0.002, H - 0.26), "Steel"); bevel(plate, 0.002, 2)
sockets = [cylinder("Socket", 0.013, 0.006, (x, D + 0.006, H - 0.26), (0, 1, 0), "Socket", 24) for x in (-0.026, 0.026)]

def join(name, objs):
    bpy.ops.object.select_all(action="DESELECT")
    for o in objs: o.select_set(True)
    bpy.context.view_layer.objects.active = objs[0]; bpy.ops.object.join(); objs[0].name = name; return objs[0]
bolts, flys = [o for o in parts if o.name.startswith("Bolt")], [o for o in parts if o.name.startswith("Fly")]
join("Bolts", bolts); join("Flypoints", flys); join("Sockets", sockets)

# the cabinet comes apart by material, so the page can light each horn by itself
bpy.ops.object.select_all(action="DESELECT"); body.select_set(True); bpy.context.view_layer.objects.active = body
bpy.ops.object.mode_set(mode="EDIT"); bpy.ops.mesh.separate(type="MATERIAL"); bpy.ops.object.mode_set(mode="OBJECT")
for o in [o for o in scene.objects if o.name.startswith("Body")]:
    used = {p.material_index for p in o.data.polygons}; name = o.data.materials[next(iter(used))].name if used else "Body"
    o.name = {"Recess": "Handles"}.get(name, name)
for o in scene.objects:
    if o.type == "MESH":
        for p in o.data.polygons: p.use_smooth = p.use_smooth and True
        o.data.name = o.name

# soft shadowing: one picture shared by every part, each part given its own patch of it
meshes = [o for o in scene.objects if o.type == "MESH"]
image = bpy.data.images.new("AO", 2048, 2048)
for m in bpy.data.materials:
    node = m.node_tree.nodes.new("ShaderNodeTexImage"); node.image = image; m.node_tree.nodes.active = node
bpy.ops.object.select_all(action="DESELECT")
for o in meshes: o.select_set(True)
bpy.context.view_layer.objects.active = meshes[0]
bpy.ops.object.mode_set(mode="EDIT"); bpy.ops.mesh.select_all(action="SELECT")
bpy.ops.uv.smart_project(angle_limit=math.radians(55), island_margin=0.004); bpy.ops.object.mode_set(mode="OBJECT")
# a floor for the shadowing only, so the underside is not lit from below
scene.render.engine = "CYCLES"; scene.cycles.samples = SAMPLES; scene.cycles.device = "CPU"
world = bpy.data.worlds.new("w"); scene.world = world; world.light_settings.distance = 0.5
bpy.ops.object.bake(type="AO", margin=12)
image.filepath_raw = AO; image.file_format = "PNG"; image.save()
for m in bpy.data.materials: m.node_tree.nodes.remove(m.node_tree.nodes.active)

bpy.ops.export_scene.gltf(filepath=OUT, export_format="GLB", export_apply=True, export_yup=True, export_texcoords=True, export_normals=True, export_materials="EXPORT")
print("PARTS", sorted((o.name, len(o.data.polygons)) for o in scene.objects if o.type == "MESH"))
