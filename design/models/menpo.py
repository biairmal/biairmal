# Menpō (samurai face armour) built procedurally in Blender.
# Run:  /tmp/bl/bin/python menpo.py [render] [export]
# Z up, the face looks toward -Y, units are metres.
import bpy, bmesh, math, sys, random
from mathutils import Vector, Matrix

R = random.Random(4)
ARGS = sys.argv[1:]
OUT = '/tmp/blend/out'
import os; os.makedirs(OUT, exist_ok=True)

bpy.ops.wm.read_factory_settings(use_empty=True)
import addon_utils; addon_utils.enable('cycles')
scene = bpy.context.scene

def smooth(x): x = max(0.0, min(1.0, x)); return x * x * (3 - 2 * x)
def g(x, s): return math.exp(-(x / s) ** 2)

# ------------------------------------------------------------ materials
def mat_lacquer(name, base, wear_amt=0.35):
    m = bpy.data.materials.new(name); m.use_nodes = True
    nt = m.node_tree; N = nt.nodes; L = nt.links
    bsdf = N['Principled BSDF']
    bsdf.inputs['Base Color'].default_value = (*base, 1)
    bsdf.inputs['Roughness'].default_value = 0.32
    bsdf.inputs['Coat Weight'].default_value = 1.0
    bsdf.inputs['Coat Roughness'].default_value = 0.07
    # wear: lacquer rubbed through to dark iron on sharp, exposed edges
    geo = N.new('ShaderNodeNewGeometry')
    ramp = N.new('ShaderNodeValToRGB'); ramp.color_ramp.elements[0].position = 0.52; ramp.color_ramp.elements[1].position = 0.6
    noise = N.new('ShaderNodeTexNoise'); noise.inputs['Scale'].default_value = 90; noise.inputs['Detail'].default_value = 8
    nr = N.new('ShaderNodeValToRGB'); nr.color_ramp.elements[0].position = 0.45; nr.color_ramp.elements[1].position = 0.62
    mul = N.new('ShaderNodeMath'); mul.operation = 'MULTIPLY'
    mul2 = N.new('ShaderNodeMath'); mul2.operation = 'MULTIPLY'; mul2.inputs[1].default_value = wear_amt
    L.new(geo.outputs['Pointiness'], ramp.inputs['Fac']); L.new(noise.outputs['Fac'], nr.inputs['Fac'])
    L.new(ramp.outputs['Color'], mul.inputs[0]); L.new(nr.outputs['Color'], mul.inputs[1]); L.new(mul.outputs[0], mul2.inputs[0])
    mixc = N.new('ShaderNodeMix'); mixc.data_type = 'RGBA'
    mixc.inputs['A'].default_value = (*base, 1); mixc.inputs['B'].default_value = (0.05, 0.045, 0.04, 1)
    L.new(mul2.outputs[0], mixc.inputs['Factor']); L.new(mixc.outputs['Result'], bsdf.inputs['Base Color'])
    L.new(mul2.outputs[0], bsdf.inputs['Metallic'])
    mr = N.new('ShaderNodeMapRange'); mr.inputs['To Min'].default_value = 0.3; mr.inputs['To Max'].default_value = 0.55
    L.new(mul2.outputs[0], mr.inputs['Value']); L.new(mr.outputs['Result'], bsdf.inputs['Roughness'])
    cw = N.new('ShaderNodeMath'); cw.operation = 'SUBTRACT'; cw.inputs[0].default_value = 1.0
    L.new(mul2.outputs[0], cw.inputs[1]); L.new(cw.outputs[0], bsdf.inputs['Coat Weight'])
    # faint orange-peel in the lacquer
    bn = N.new('ShaderNodeTexNoise'); bn.inputs['Scale'].default_value = 900
    bump = N.new('ShaderNodeBump'); bump.inputs['Strength'].default_value = 0.03
    L.new(bn.outputs['Fac'], bump.inputs['Height']); L.new(bump.outputs['Normal'], bsdf.inputs['Normal'])
    return m

def mat_silk():
    m = bpy.data.materials.new('silk'); m.use_nodes = True
    N = m.node_tree.nodes; L = m.node_tree.links; b = N['Principled BSDF']
    b.inputs['Base Color'].default_value = (0.62, 0.6, 0.57, 1)
    b.inputs['Roughness'].default_value = 0.6
    b.inputs['Sheen Weight'].default_value = 1.0; b.inputs['Sheen Roughness'].default_value = 0.35
    w = N.new('ShaderNodeTexWave'); w.inputs['Scale'].default_value = 900; w.wave_type = 'BANDS'; w.bands_direction = 'Z'
    bump = N.new('ShaderNodeBump'); bump.inputs['Strength'].default_value = 0.25
    L.new(w.outputs['Fac'], bump.inputs['Height']); L.new(bump.outputs['Normal'], b.inputs['Normal'])
    return m

def mat_hair():
    m = bpy.data.materials.new('horsehair'); m.use_nodes = True
    b = m.node_tree.nodes['Principled BSDF']
    b.inputs['Base Color'].default_value = (0.86, 0.85, 0.82, 1); b.inputs['Roughness'].default_value = 0.38
    b.inputs['Sheen Weight'].default_value = 0.6
    return m

def mat_iron():
    m = bpy.data.materials.new('iron'); m.use_nodes = True
    b = m.node_tree.nodes['Principled BSDF']
    b.inputs['Base Color'].default_value = (0.06, 0.058, 0.055, 1); b.inputs['Metallic'].default_value = 1; b.inputs['Roughness'].default_value = 0.42
    return m

BLACK = mat_lacquer('lacquer_black', (0.009, 0.009, 0.01))
RED = mat_lacquer('lacquer_red', (0.42, 0.045, 0.035), 0.15)  # shu-urushi inside, as on real menpō
SILK, HAIR, IRON = mat_silk(), mat_hair(), mat_iron()

def obj_from_bm(name, bm, mats):
    me = bpy.data.meshes.new(name); bm.to_mesh(me); bm.free()
    o = bpy.data.objects.new(name, me); scene.collection.objects.link(o)
    for m in mats: me.materials.append(m)
    for p in me.polygons: p.use_smooth = True
    return o

def mods(o, thick=0.0025, subd=2, offset=-1, matoff=1):
    s = o.modifiers.new('solid', 'SOLIDIFY'); s.thickness = thick; s.offset = offset; s.material_offset = matoff; s.material_offset_rim = 0; s.use_even_offset = True
    d = o.modifiers.new('subd', 'SUBSURF'); d.levels = subd; d.render_levels = subd
    return o

# ------------------------------------------------------------ face shell
TH = 1.6  # half-angle around the face, radians

def z_top(t):   # upper edge: under the nose, rising over the cheekbones toward the eyes
    a = abs(t); return 0.004 + 0.036 * smooth((a - 0.28) / 0.75) - 0.012 * smooth((a - 1.35) / 0.4)
def z_bot(t):   # lower edge: chin, rising along the jaw
    a = abs(t); return -0.072 + 0.04 * (a / TH) ** 2.2
def mouth_c(t): return -0.026 + 0.0065 * (t / 0.34) ** 2   # a grim, down-turned mouth line
def mouth_hw(t): return 0.0036 * max(0.0, 1 - (t / 0.34) ** 2) ** 0.5

def face_point(t, z):
    a = abs(t)
    v = (z + 0.075) / 0.13
    hw = 0.072 * (0.82 + 0.18 * smooth(v * 1.3))          # half width (narrower at the chin)
    hd = 0.092                                            # half depth
    d = 0.0
    d += 0.0065 * g(t, 0.45) * g(z + 0.058, 0.02)                 # chin
    d += 0.012 * g(t, 0.55) * g(z + 0.02, 0.026)                  # muzzle
    d += 0.009 * g(a - 0.95, 0.28) * g(z - 0.022, 0.02)           # cheekbones
    # nasolabial folds
    for s in (-1, 1):
        tt = s * t
        lt = 0.3 + (0.004 - z) * 6.5
        if -0.045 < z < 0.02: d -= 0.0035 * g(tt - lt, 0.055)
    # wrinkles over the cheeks (ressei-men)
    w = smooth((a - 0.62) / 0.2) * (1 - smooth((a - 1.3) / 0.15)) * smooth((z + 0.04) / 0.02) * (1 - smooth((z - 0.03) / 0.015))
    ph = (z + a * 0.02 + 0.002 * math.sin(a * 9.0)) / 0.0085 * 2 * math.pi
    d += 0.0006 * math.sin(ph) * w * (0.6 + 0.4 * math.sin(a * 5 + z * 300))
    # lips
    md = z - mouth_c(t)
    if a < 0.5: d += 0.003 * g(md, 0.007) * (1 - smooth((a - 0.3) / 0.16))
    # hiyoke: flanges flaring out at the sides
    d += 0.008 * smooth((a - 1.33) / 0.27)
    n = Vector((math.sin(t), -math.cos(t) * hd / hw, 0)).normalized()
    p = Vector((hw * math.sin(t), -hd * math.cos(t), z))
    return p + n * d

bm = bmesh.new()
NU, NV = 220, 130
Z0, ZR = -0.085, 0.15
grid = []; PAR = {}
for j in range(NV + 1):
    row = []
    for i in range(NU + 1):
        t = -TH + 2 * TH * i / NU
        z = Z0 + ZR * j / NV
        v = bm.verts.new(face_point(t, z)); PAR[v] = (t, z)
        row.append(v)
    grid.append(row)
for j in range(NV):
    for i in range(NU):
        bm.faces.new((grid[j][i], grid[j][i + 1], grid[j + 1][i + 1], grid[j + 1][i]))
# cut to outline and open the mouth
dead = []
for f in bm.faces:
    c = f.calc_center_median()
    i = sum(v.index for v in f.verts)  # unused
for j in range(NV):
    for i in range(NU):
        t = -TH + 2 * TH * (i + 0.5) / NU
        z = Z0 + ZR * (j + 0.5) / NV
        cut = z > z_top(t) or z < z_bot(t)
        if abs(t) < 0.34 and abs(z - mouth_c(t)) < mouth_hw(t): cut = True
        if cut: dead.append((j, i))
fl = {}
for f in bm.faces: pass
faces = list(bm.faces)
kill = set(j * NU + i for j, i in dead)
bmesh.ops.delete(bm, geom=[faces[k] for k in kill], context='FACES')
bmesh.ops.delete(bm, geom=[v for v in bm.verts if not v.link_faces], context='VERTS')
for v in bm.verts:   # snap the outline onto the exact curves so edges are clean
    if not v.is_boundary: continue
    t, z = PAR[v]
    if abs(abs(t) - TH) < 1e-6: continue
    cands = [z_top(t), z_bot(t)]
    if abs(t) < 0.345: cands += [mouth_c(t) + mouth_hw(t), mouth_c(t) - mouth_hw(t)]
    zz = min(cands, key=lambda c: abs(c - z))
    if abs(zz - z) < 2.5 * ZR / NV: v.co = face_point(t, zz)
face = mods(obj_from_bm('menpo_face', bm, [BLACK, RED]), thick=0.0028)

# ------------------------------------------------------------ nose (separate, hinged)
bm = bmesh.new()
rings = []
LEV, SEG = 26, 24
for k in range(LEV + 1):
    s = k / LEV                                  # 0 bridge → 1 tip
    z = 0.042 - 0.04 * s - 0.006 * smooth((s - 0.85) / 0.15)
    w = 0.012 + 0.012 * s ** 1.2 + 0.006 * smooth((s - 0.65) / 0.35)
    h = 0.008 + 0.016 * s ** 1.0 - 0.006 * smooth((s - 0.9) / 0.1)
    y0 = -0.09 - 0.008 * s
    ring = []
    for q in range(SEG + 1):
        ph = -math.pi / 2 + math.pi * q / SEG
        u = math.sin(ph)                      # -1 … 1 across the nose
        x = w * u
        y = y0 - h * (1 - abs(u)) ** 1.25 - 0.006 * smooth((s - 0.72) / 0.28) * math.exp(-((abs(u) - 0.75) / 0.18) ** 2)
        ring.append(bm.verts.new((x, y, z)))
    rings.append(ring)
for k in range(LEV):
    for q in range(SEG):
        bm.faces.new((rings[k][q], rings[k + 1][q], rings[k + 1][q + 1], rings[k][q + 1]))
nose = mods(obj_from_bm('menpo_nose', bm, [BLACK, RED]), thick=0.0024)
for x in (-0.014, 0.014):   # hinge pins
    bpy.ops.mesh.primitive_cylinder_add(radius=0.002, depth=0.004, location=(x, -0.0905, 0.041), rotation=(0, math.pi / 2, 0))
    pin = bpy.context.object; pin.name = 'hinge_pin'; pin.data.materials.append(IRON)

# ------------------------------------------------------------ odegane: cord hooks on the cheeks
for s in (-1, 1):
    t = s * 1.2; z = -0.03
    p = face_point(t, z); n = Vector((math.sin(t), -math.cos(t), 0)).normalized()
    bpy.ops.mesh.primitive_cylinder_add(radius=0.0024, depth=0.012, location=p + n * 0.006)
    post = bpy.context.object; post.rotation_euler = Vector((0, 0, 1)).rotation_difference(n).to_euler(); post.data.materials.append(BLACK)
    bpy.ops.mesh.primitive_torus_add(major_radius=0.006, minor_radius=0.0018, location=p + n * 0.012 + Vector((0, 0, 0.004)))
    hook = bpy.context.object; hook.rotation_euler = (math.pi / 2, 0, t); hook.data.materials.append(BLACK)
    for o in (post, hook): bpy.ops.object.shade_smooth()
# drain hole under the chin
bpy.ops.mesh.primitive_cylinder_add(radius=0.0025, depth=0.01, location=face_point(0, -0.07) + Vector((0, 0.006, 0)))
tube = bpy.context.object; tube.rotation_euler = (math.radians(70), 0, 0); tube.data.materials.append(RED)

# ------------------------------------------------------------ moustache: white horsehair
bm_curves = []
cd = bpy.data.curves.new('moustache', 'CURVE'); cd.dimensions = '3D'; cd.bevel_depth = 0.00022; cd.bevel_resolution = 1
for s in (-1, 1):
    for k in range(140):
        u = R.random()
        x0 = s * (0.005 + 0.016 * u); z0 = -0.007 - 0.004 * u + R.uniform(-0.0015, 0.0015)
        length = 0.03 + 0.03 * R.random() ** 0.7
        pts = []
        for q in range(10):
            f = q / 9
            x = x0 + s * length * (0.55 * f + 0.25 * f * f) + R.uniform(-0.001, 0.001) * f
            z = z0 - length * (0.25 * f + 0.75 * f ** 1.8)
            tt = math.atan2(x, 0.09)
            y = face_point(tt, z).y - 0.0025 - 0.002 * math.sin(f * math.pi) + R.uniform(-0.0006, 0.0006)
            pts.append((x, y, z))
        sp = cd.splines.new('POLY'); sp.points.add(len(pts) - 1)
        for q, p in enumerate(pts): sp.points[q].co = (*p, 1)
mo = bpy.data.objects.new('moustache', cd); scene.collection.objects.link(mo); cd.materials.append(HAIR)

# ------------------------------------------------------------ yodare-kake: laced throat guard
def lame(idx):
    bm = bmesh.new()
    top = -0.066 - idx * 0.021; h = 0.03
    rx, ry = 0.088 + idx * 0.008, 0.1 + idx * 0.008
    A = 1.55 + idx * 0.05
    NA, NH = 90, 8
    G = []
    for j in range(NH + 1):
        row = []
        for i in range(NA + 1):
            t = -A + 2 * A * i / NA; f = j / NH
            flare = 1 + 0.08 * f
            row.append(bm.verts.new((rx * flare * math.sin(t), -ry * flare * math.cos(t) + 0.012, top - h * f)))
        G.append(row)
    for j in range(NH):
        for i in range(NA): bm.faces.new((G[j][i], G[j][i + 1], G[j + 1][i + 1], G[j + 1][i]))
    o = mods(obj_from_bm(f'yodare_lame_{idx}', bm, [BLACK, BLACK]), thick=0.0022, subd=1, offset=1)
    # lacing: dense vertical silk cords (kebiki odoshi)
    bm = bmesh.new()
    arc = 2 * A * (rx + ry) / 2
    n = int(arc / 0.0047)
    for i in range(n):
        if i % 10 == 9: continue
        t = -A + 2 * A * (i + 0.5) / n
        for (z0, z1) in ((top - 0.001, top - h + 0.0055),):
            f0 = (top - z0) / h; f1 = (top - z1) / h
            p0 = Vector((rx * (1 + 0.08 * f0) * math.sin(t), -ry * (1 + 0.08 * f0) * math.cos(t) + 0.012, z0))
            p1 = Vector((rx * (1 + 0.08 * f1) * math.sin(t), -ry * (1 + 0.08 * f1) * math.cos(t) + 0.012, z1))
            nrm = Vector((rx * math.sin(t) / rx ** 2, -ry * math.cos(t) / ry ** 2, 0)).normalized()
            p0 += nrm * 0.0029; p1 += nrm * 0.0029
            d = p1 - p0
            res = bmesh.ops.create_cube(bm, size=1)
            side = d.cross(nrm).normalized(); up = d.normalized(); out = nrm
            M = Matrix.Translation((p0 + p1) / 2) @ Matrix((side, out, up)).transposed().to_4x4() @ Matrix.Diagonal((0.0034 if i % 2 else 0.0038, 0.0012, d.length, 1))
            bmesh.ops.transform(bm, matrix=M, verts=res['verts'])
    lo = obj_from_bm(f'yodare_lace_{idx}', bm, [SILK])
    return o, lo
if not os.environ.get('NO_YODARE'):
    for i in range(3): lame(i)

# ------------------------------------------------------------ hooded head (context only)
cloth = bpy.data.materials.new('hood'); cloth.use_nodes = True
cb = cloth.node_tree.nodes['Principled BSDF']; cb.inputs['Base Color'].default_value = (0.004, 0.004, 0.005, 1); cb.inputs['Roughness'].default_value = 0.95
cb.inputs['Sheen Weight'].default_value = 0.1; cb.inputs['Sheen Tint'].default_value = (0.2, 0.2, 0.22, 1)
bpy.ops.mesh.primitive_uv_sphere_add(segments=64, ring_count=32, radius=1, location=(0, 0.006, 0.012))
head = bpy.context.object; head.name = 'hood'; head.scale = (0.066, 0.086, 0.112); head.data.materials.append(cloth); bpy.ops.object.shade_smooth()
bpy.ops.mesh.primitive_cylinder_add(radius=0.05, depth=0.2, location=(0, 0.012, -0.12))
neck = bpy.context.object; neck.data.materials.append(cloth); bpy.ops.object.shade_smooth()
for o in (head, neck): o['context_only'] = True

# ------------------------------------------------------------ export / render
if 'export' in ARGS:
    for o in list(scene.objects):
        o.select_set(not o.get('context_only'))
    bpy.ops.export_scene.gltf(filepath=f'{OUT}/menpo.glb', export_apply=True, export_format='GLB', use_selection=True)
bpy.ops.wm.save_as_mainfile(filepath=f'{OUT}/menpo.blend')

if 'render' in ARGS:
    scene.render.engine = 'CYCLES'
    scene.cycles.device = 'CPU'; scene.cycles.samples = int(os.environ.get('SAMPLES', 96)); scene.cycles.use_denoising = True
    scene.render.resolution_x, scene.render.resolution_y = 1200, 900
    scene.view_settings.view_transform = 'AgX'; scene.view_settings.look = 'AgX - Medium High Contrast'
    w = bpy.data.worlds.new('w'); scene.world = w; w.use_nodes = True
    w.node_tree.nodes['Background'].inputs['Color'].default_value = (0.004, 0.0045, 0.006, 1)
    def area(name, loc, energy, size, color, target=(0, -0.05, -0.02)):
        l = bpy.data.lights.new(name, 'AREA'); l.energy = energy; l.size = size; l.color = color
        o = bpy.data.objects.new(name, l); scene.collection.objects.link(o); o.location = loc
        o.rotation_euler = (Vector(target) - Vector(loc)).to_track_quat('-Z', 'Y').to_euler()
    area('moon_rim', (0.45, 0.55, 0.35), 60, 0.4, (0.85, 0.9, 1.0))
    area('rim2', (-0.5, 0.4, 0.1), 25, 0.3, (0.85, 0.9, 1.0))
    area('key', (-0.35, -0.6, 0.35), 9, 0.6, (1.0, 0.97, 0.93))
    area('floor_bounce', (0.1, -0.4, -0.5), 2, 0.8, (0.7, 0.75, 0.9))
    cam_d = bpy.data.cameras.new('cam'); cam_d.lens = 85; cam_d.dof.use_dof = True; cam_d.dof.aperture_fstop = 5.6
    cam = bpy.data.objects.new('cam', cam_d); scene.collection.objects.link(cam); scene.camera = cam
    shots = {'front': ((0.3, -0.62, 0.08), (0, -0.05, -0.03)), 'profile': ((0.62, -0.2, 0.03), (0, -0.03, -0.035)), 'low': ((-0.2, -0.5, -0.22), (0, -0.06, -0.04))}
    which = os.environ.get('SHOTS', 'front').split(',')
    for name in which:
        loc, tgt = shots[name]
        cam.location = loc; cam.rotation_euler = (Vector(tgt) - Vector(loc)).to_track_quat('-Z', 'Y').to_euler()
        cam_d.dof.focus_distance = (Vector(tgt) - Vector(loc)).length
        scene.render.filepath = f'{OUT}/menpo_{name}.png'
        bpy.ops.render.render(write_still=True)
print('done')
