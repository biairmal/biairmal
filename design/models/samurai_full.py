# Full armoured samurai, built procedurally in Blender (static ready stance, no rig yet).
# Run: /tmp/bl/bin/python samurai_full.py [render] [export]
# Z up, he faces -Y, his right side is -X. Units: metres. Origin between his feet.
import bpy, bmesh, math, sys, os, random
from mathutils import Vector, Matrix, Euler

ARGS = ARGS_SAVED = sys.argv[1:]
HERE = os.path.dirname(os.path.abspath(__file__))
OUT = '/tmp/blend/out'

# ---- the menpō script builds the face armour, its materials and a hooded head
sys.argv = ['menpo.py']
exec(open(os.path.join(HERE, 'menpo.py')).read())
sys.argv = ['samurai_full.py'] + ARGS_SAVED; ARGS = ARGS_SAVED
scene = bpy.context.scene
R = random.Random(11)
HEAD = Vector((0, -0.012, 1.612))          # where the menpō's local origin goes
menpo_objs = [o for o in scene.objects if o.type in ('MESH', 'CURVE')]
for o in menpo_objs:
    if o.name.startswith('Cylinder') and o.get('context_only'): bpy.data.objects.remove(o); continue
    o.location += HEAD
    if o.get('context_only'): del o['context_only']   # the hood is now part of him

def smooth(x): x = max(0.0, min(1.0, x)); return x * x * (3 - 2 * x)
def gs(x, s): return math.exp(-(x / s) ** 2)

# ---------------------------------------------------------------- materials
def mat_fabric(name, col, sheen=0.4, scale=600):
    m = bpy.data.materials.new(name); m.use_nodes = True
    N = m.node_tree.nodes; L = m.node_tree.links; b = N['Principled BSDF']
    b.inputs['Base Color'].default_value = (*col, 1); b.inputs['Roughness'].default_value = 0.88
    b.inputs['Sheen Weight'].default_value = sheen; b.inputs['Sheen Roughness'].default_value = 0.5
    w = N.new('ShaderNodeTexWave'); w.inputs['Scale'].default_value = scale; w.wave_type = 'BANDS'
    w2 = N.new('ShaderNodeTexWave'); w2.inputs['Scale'].default_value = scale; w2.wave_type = 'BANDS'; w2.bands_direction = 'Y'
    mx = N.new('ShaderNodeMath'); mx.operation = 'MULTIPLY'
    L.new(w.outputs['Fac'], mx.inputs[0]); L.new(w2.outputs['Fac'], mx.inputs[1])
    bump = N.new('ShaderNodeBump'); bump.inputs['Strength'].default_value = 0.12
    L.new(mx.outputs[0], bump.inputs['Height']); L.new(bump.outputs['Normal'], b.inputs['Normal'])
    return m
HAKAMA = mat_fabric('fabric_hakama', (0.006, 0.006, 0.007), 0.12)
SLEEVE = mat_fabric('fabric_sleeve', (0.014, 0.014, 0.016), 0.2, 900)
GLOVE = mat_fabric('fabric_glove', (0.012, 0.011, 0.011), 0.3, 1200)
def mat_simple(name, col, rough, metal=0.0, emit=0.0):
    m = bpy.data.materials.new(name); m.use_nodes = True; b = m.node_tree.nodes['Principled BSDF']
    b.inputs['Base Color'].default_value = (*col, 1); b.inputs['Roughness'].default_value = rough; b.inputs['Metallic'].default_value = metal
    if emit: b.inputs['Emission Color'].default_value = (*col, 1); b.inputs['Emission Strength'].default_value = emit
    return m
STRAW = mat_fabric('straw_kasa', (0.018, 0.016, 0.014), 0.08, 260)
SEAM = mat_simple('seam_light', (0.85, 0.9, 1.0), 0.3, 0, 6.0)        # the "digital" hairlines
WOOD = mat_simple('wood_sandal', (0.06, 0.05, 0.04), 0.8)

# ---------------------------------------------------------------- helpers
def new_obj(name, bm, mats, smooth_shade=True):
    me = bpy.data.meshes.new(name); bm.to_mesh(me); bm.free()
    o = bpy.data.objects.new(name, me); scene.collection.objects.link(o)
    for m in mats: me.materials.append(m)
    if smooth_shade:
        for p in me.polygons: p.use_smooth = True
    return o

def solid(o, t=0.0025, subd=1, offset=1, matoff=0):
    s = o.modifiers.new('solid', 'SOLIDIFY'); s.thickness = t; s.offset = offset; s.use_even_offset = True; s.material_offset = matoff
    if subd:
        d = o.modifiers.new('subd', 'SUBSURF'); d.levels = subd; d.render_levels = subd
    return o

def laced_band(name, P, NRM, u0, u1, nu, h, nh=6, cord_step=0.0048, gap_every=10, cords=True, plate_mat=None, lift=0.0028):
    """A lacquer plate following P(u, f) (f: 0 top … 1 bottom) with silk cords running down it.
    P returns a Vector; NRM(u) the outward normal at u."""
    bm = bmesh.new(); G = []
    for j in range(nh + 1):
        f = j / nh
        G.append([bm.verts.new(P(u0 + (u1 - u0) * i / nu, f)) for i in range(nu + 1)])
    for j in range(nh):
        for i in range(nu): bm.faces.new((G[j][i], G[j][i + 1], G[j + 1][i + 1], G[j + 1][i]))
    plate = solid(new_obj(name, bm, [plate_mat or BLACK]), 0.0022, 1, 1)
    lace = None
    if cords:
        bm = bmesh.new()
        length = sum((P(u0 + (u1 - u0) * (k + 1) / 60, 0.5) - P(u0 + (u1 - u0) * k / 60, 0.5)).length for k in range(60))
        n = max(4, int(length / cord_step))
        for i in range(n):
            if gap_every and i % gap_every == gap_every - 1: continue
            u = u0 + (u1 - u0) * (i + 0.5) / n
            p0 = P(u, 0.02) + NRM(u) * lift; p1 = P(u, 0.8) + NRM(u) * lift
            d = p1 - p0
            res = bmesh.ops.create_cube(bm, size=1)
            side = d.cross(NRM(u)).normalized()
            M = Matrix.Translation((p0 + p1) / 2) @ Matrix((side, NRM(u), d.normalized())).transposed().to_4x4() @ Matrix.Diagonal((0.0035 if i % 2 else 0.0039, 0.0012, d.length, 1))
            bmesh.ops.transform(bm, matrix=M, verts=res['verts'])
        lace = new_obj(name + '_lace', bm, [SILK])
    return plate, lace

def tube(name, pts, radii, mat, res=8):
    cd = bpy.data.curves.new(name, 'CURVE'); cd.dimensions = '3D'; cd.bevel_depth = 1.0; cd.bevel_resolution = res // 2; cd.use_fill_caps = True
    sp = cd.splines.new('BEZIER'); sp.bezier_points.add(len(pts) - 1)
    for bp, p, r in zip(sp.bezier_points, pts, radii):
        bp.co = p; bp.radius = r; bp.handle_left_type = bp.handle_right_type = 'AUTO'
    o = bpy.data.objects.new(name, cd); scene.collection.objects.link(o); cd.materials.append(mat)
    return o

def place(o, loc=(0, 0, 0), rot=(0, 0, 0), parent=None):
    o.location = loc; o.rotation_euler = rot
    if parent: o.parent = parent
    return o

def empty(name, loc=(0, 0, 0), rot=(0, 0, 0)):
    e = bpy.data.objects.new(name, None); scene.collection.objects.link(e); e.location = loc; e.rotation_euler = rot; return e

def seam_ring(name, P, u0, u1, f, n=120, r=0.0011, lift=0.0035, NRM=None):
    pts = [P(u0 + (u1 - u0) * k / n, f) + (NRM(u0 + (u1 - u0) * k / n) * lift if NRM else Vector()) for k in range(n + 1)]
    cd = bpy.data.curves.new(name, 'CURVE'); cd.dimensions = '3D'; cd.bevel_depth = r; cd.bevel_resolution = 1
    sp = cd.splines.new('POLY'); sp.points.add(len(pts) - 1)
    for k, p in enumerate(pts): sp.points[k].co = (*p, 1)
    o = bpy.data.objects.new(name, cd); scene.collection.objects.link(o); cd.materials.append(SEAM); return o

# ---------------------------------------------------------------- hakama: pleated, wide, to the ankles
WAIST, HEM = 1.03, 0.035
def hakama_point(u, z):
    t = (WAIST - z) / (WAIST - HEM)                     # 0 waist → 1 hem
    a = 0.17 + 0.2 * t ** 0.9 + 0.03 * math.sin(t * math.pi)   # half width
    b = 0.13 + 0.13 * t ** 0.9                           # half depth
    k = (u / (2 * math.pi)) * 22 + 0.25
    saw = (k - math.floor(k)); saw = saw if saw < 0.86 else (1 - saw) / 0.14 * 0.86   # knife pleats
    d = (0.004 + 0.016 * t) * saw
    # the divided legs: a soft crease front and back toward the hem
    d -= 0.05 * smooth((t - 0.35) / 0.6) * (gs(math.sin(u / 2), 0.07) + gs(math.cos(u / 2), 0.07))
    r = 1 + d / ((a + b) / 2)
    return Vector((a * math.sin(u) * r, -b * math.cos(u) * r, z))
bm = bmesh.new(); NU, NZ = 220, 60; G = []
for j in range(NZ + 1):
    z = WAIST - (WAIST - HEM) * j / NZ
    row = []
    for i in range(NU):
        u = 2 * math.pi * i / NU
        p = hakama_point(u, z)
        if j == NZ: p.z += 0.008 * math.sin(u * 3) + 0.006 * math.sin(u * 7 + 1)
        row.append(bm.verts.new(p))
    G.append(row)
for j in range(NZ):
    for i in range(NU): bm.faces.new((G[j][i], G[j][(i + 1) % NU], G[j + 1][(i + 1) % NU], G[j + 1][i]))
hakama = solid(new_obj('hakama', bm, [HAKAMA]), 0.004, 1, 1)

# sandals and tabi
for s in (-1, 1):
    bpy.ops.mesh.primitive_cube_add(size=1, location=(s * 0.13, -0.12, 0.012)); sole = bpy.context.object
    sole.scale = (0.1, 0.26, 0.022); sole.data.materials.append(WOOD); sole.name = 'waraji'
    bpy.ops.object.modifier_add(type='BEVEL'); sole.modifiers[-1].width = 0.008; sole.modifiers[-1].segments = 2
    bpy.ops.mesh.primitive_uv_sphere_add(radius=1, location=(s * 0.13, -0.17, 0.045)); toe = bpy.context.object
    toe.scale = (0.045, 0.085, 0.035); toe.data.materials.append(GLOVE); bpy.ops.object.shade_smooth(); toe.name = 'tabi'
    tube('sandal_strap', [Vector((s * 0.09, -0.2, 0.03)), Vector((s * 0.13, -0.21, 0.07)), Vector((s * 0.17, -0.2, 0.03))], [0.004, 0.004, 0.004], SILK)

# ---------------------------------------------------------------- dō: laced cuirass
def do_ab(z):
    t = (z - 1.0) / 0.42
    return 0.165 + 0.04 * smooth(t * 1.3), 0.125 + 0.03 * math.sin(min(t, 1) * math.pi * 0.8)
def do_P(z0, h, flare=0.05):
    def P(u, f):
        z = z0 - h * f; a, b = do_ab(z); k = 1 + flare * f
        return Vector((a * k * math.sin(u), -b * k * math.cos(u), z))
    return P
def do_N(z):
    def N(u):
        a, b = do_ab(z); return Vector((math.sin(u) / a, -math.cos(u) / b, 0)).normalized()
    return N
U0, U1 = -math.pi / 2 + 0.07, 3 * math.pi / 2 - 0.07      # open at his right side, where the dō hinges
for r in range(6):
    top = 1.025 + r * 0.054
    laced_band(f'do_lame_{r}', do_P(top + 0.062, 0.068), do_N(top + 0.03), U0, U1, 160, 0.068)
# muna-ita: plain lacquer chest plate, and the matching back plate
for side, (u0, u1) in (('front', (-0.75, 0.75)), ('back', (math.pi - 0.8, math.pi + 0.8))):
    P = do_P(1.43, 0.07, -0.04)
    plate, _ = laced_band(f'muna_ita_{side}', P, do_N(1.4), u0, u1, 60, 0.07, cords=False)
    seam_ring(f'muna_seam_{side}', P, u0, u1, 0.0, 60, 0.0011, 0.004, do_N(1.43))
# watagami: shoulder straps
for s in (-1, 1):
    a, b = do_ab(1.43)
    tube('watagami', [Vector((s * 0.12, -b + 0.012, 1.425)), Vector((s * 0.135, -0.06, 1.475)), Vector((s * 0.135, 0.05, 1.475)), Vector((s * 0.12, b - 0.012, 1.425))], [0.011, 0.012, 0.012, 0.011], BLACK).name = 'watagami'
# under-kimono collar
tube('collar', [Vector((-0.06, -0.04, 1.47)), Vector((0, -0.075, 1.43)), Vector((0.06, -0.04, 1.47))], [0.018, 0.02, 0.018], SLEEVE)

# ---------------------------------------------------------------- kusazuri: five laced skirt panels
def kus_panel(idx, ang):
    root = empty(f'kusazuri_{idx}', (0, 0, 0), (0, 0, ang))
    for r in range(5):
        top = 1.0 - r * 0.052; w = 0.2 + r * 0.008
        def P(u, f, top=top, r=r):
            z = top - 0.062 * f; out = 0.2 + 0.035 * (1 - (1 - (1.0 - z) / 0.3)) + 0.012 * f
            return Vector((u, -out - 0.06 * ((1.0 - z) / 0.28), z))
        N = lambda u: Vector((0, -1, -0.15)).normalized()
        plate, lace = laced_band(f'kusazuri_{idx}_{r}', P, N, -w / 2, w / 2, 40, 0.062, 4, gap_every=8)
        for o in (plate, lace): o.parent = root
        if r == 4: seam_ring('kus_seam', P, -w / 2, w / 2, 1.0, 30, 0.001, 0.003, N).parent = root
    return root
for i, ang in enumerate((0, 1.05, -1.05, 2.3, -2.3)): kus_panel(i, ang)

# ---------------------------------------------------------------- sode: shoulder guards
def sode(s):
    root = empty('sode_' + ('L' if s > 0 else 'R'), (s * 0.245, 0.0, 1.475), (0, s * -0.22, 0))
    for r in range(6):
        top = -r * 0.05; w = 0.23
        def P(u, f, top=top, r=r):
            z = top - 0.058 * f; R0 = 0.3
            out = 0.012 * r + 0.008 * f
            return Vector((s * (out + R0 - R0 * math.cos(u / R0)) * 0.6, u, z))
        N = lambda u: Vector((s * 1, 0, -0.1)).normalized()
        plate, lace = laced_band(f'sode_{s}_{r}', P, N, -w / 2, w / 2, 40, 0.058, 4, gap_every=9)
        for o in (plate, lace): o.parent = root
        if r == 5: seam_ring('sode_seam', P, -w / 2, w / 2, 1.0, 30, 0.001, 0.003, N).parent = root
    # kanmuri-ita: the top plate, plain lacquer
    def P(u, f): return Vector((s * 0.01, u, 0.02 - 0.03 * f))
    plate, _ = laced_band('sode_top', P, lambda u: Vector((s, 0, 0)), -0.12, 0.12, 30, 0.03, 2, cords=False)
    plate.parent = root
for s in (-1, 1): sode(s)

# ---------------------------------------------------------------- arms, kote, hands
ARM = {
    'R': [Vector((-0.2, 0.0, 1.44)), Vector((-0.27, 0.03, 1.16)), Vector((-0.25, -0.03, 0.9))],   # relaxed at his side
    'L': [Vector((0.2, 0.0, 1.44)), Vector((0.29, -0.04, 1.18)), Vector((0.16, -0.19, 1.03))],    # thumb on the tsuba
}
for side, (sh, el, wr) in ARM.items():
    tube('sleeve_' + side, [sh, sh.lerp(el, 0.5) + Vector((0, 0.01, 0)), el, el.lerp(wr, 0.5), wr], [0.06, 0.058, 0.05, 0.045, 0.038], SLEEVE, 10)
    # kote: three lacquer splints along the forearm and a plate over the elbow
    d = (wr - el).normalized(); out = Vector((math.copysign(1, sh.x), -0.4, 0.2)).normalized()
    out = (out - d * out.dot(d)).normalized()
    for k in range(3):
        a = el.lerp(wr, 0.12 + 0.28 * k); b = el.lerp(wr, 0.36 + 0.28 * k)
        bpy.ops.mesh.primitive_cube_add(size=1, location=(a + b) / 2 + out * 0.044)
        sp = bpy.context.object; sp.name = f'kote_{side}_{k}'
        sp.rotation_euler = Matrix((out.cross(d), out, d)).transposed().to_euler()
        sp.scale = (0.038, 0.004, (b - a).length * 0.95); sp.data.materials.append(BLACK)
        bv = sp.modifiers.new('bev', 'BEVEL'); bv.width = 0.003; bv.segments = 2
    bpy.ops.mesh.primitive_uv_sphere_add(radius=1, location=el + out * 0.05); cap = bpy.context.object; cap.name = 'kote_elbow'
    cap.scale = (0.032, 0.04, 0.014); cap.rotation_euler = Matrix((out.cross(d), d, out)).transposed().to_euler(); cap.data.materials.append(BLACK); bpy.ops.object.shade_smooth()
    # hand: a gloved fist with a tekko plate over the back
    hand_dir = d if side == 'R' else (Vector((-0.2, -0.6, -0.5))).normalized()
    hc = wr + hand_dir * 0.06
    bpy.ops.mesh.primitive_cube_add(size=1, location=hc); hand = bpy.context.object; hand.name = 'hand_' + side
    hand.scale = (0.05, 0.03, 0.085); hand.rotation_euler = Vector((0, 0, 1)).rotation_difference(hand_dir).to_euler(); hand.data.materials.append(GLOVE)
    m = hand.modifiers.new('subd', 'SUBSURF'); m.levels = 2; m.render_levels = 2; bpy.ops.object.shade_smooth()
    bpy.ops.mesh.primitive_cube_add(size=1, location=hc + out * 0.03); tek = bpy.context.object; tek.name = 'tekko_' + side
    tek.scale = (0.045, 0.006, 0.06); tek.rotation_euler = Matrix((out.cross(hand_dir), out, hand_dir)).transposed().to_euler(); tek.data.materials.append(BLACK)
    m = tek.modifiers.new('subd', 'SUBSURF'); m.levels = 2; m.render_levels = 2; bpy.ops.object.shade_smooth()

# ---------------------------------------------------------------- kasa: lacquered straw hat
bm = bmesh.new(); NA, NR = 160, 40; G = []
for j in range(NR + 1):
    t = j / NR; r = 0.005 + t * 0.44
    z = 0.17 * (1 - t) ** 1.08 - 0.02 * t * t
    G.append([bm.verts.new((r * math.cos(2 * math.pi * i / NA), r * math.sin(2 * math.pi * i / NA), z + 0.0015 * math.sin(i * 1.7) * t)) for i in range(NA)])
for j in range(NR):
    for i in range(NA): bm.faces.new((G[j][i], G[j][(i + 1) % NA], G[j + 1][(i + 1) % NA], G[j + 1][i]))
kasa = solid(new_obj('kasa', bm, [STRAW]), 0.004, 1, -1)
kasa.location = HEAD + Vector((0, 0.01, 0.118)); kasa.rotation_euler = (math.radians(-7), 0, 0)
rim = seam_ring('kasa_rim', lambda u, f: Vector((0.442 * math.cos(u), 0.442 * math.sin(u), -0.021)), 0, 2 * math.pi, 0, 200, 0.0016)
rim.parent = kasa
for s in (-1, 1):
    tube('kasa_cord', [kasa.location + Vector((s * 0.075, 0.03, -0.01)), HEAD + Vector((s * 0.078, 0.02, -0.03)), HEAD + Vector((s * 0.06, 0.01, -0.09))], [0.002] * 3, SILK)

# ---------------------------------------------------------------- daishō: katana and wakizashi at the left hip
ITO = mat_simple('ito_wrap', (0.6, 0.58, 0.55), 0.6)
def sword(name, mouth, direction, L_saya, L_tsuka, scale=1.0):
    d = direction.normalized()
    root = empty(name)
    # saya: tapered, slightly curved, black lacquer
    pts = [mouth + d * (L_saya * k / 4) + Vector((0, 0, -0.012 * (k / 4) ** 2)) for k in range(5)]
    tube(name + '_saya', pts, [0.018 * scale, 0.0175 * scale, 0.017 * scale, 0.016 * scale, 0.015 * scale], BLACK, 10).parent = root
    seam_ring(name + '_koiguchi', lambda u, f: mouth + Vector((0.0, 0, 0)) + (Vector((math.cos(u), 0, math.sin(u))) * 0.0195 * scale), 0, 2 * math.pi, 0, 40, 0.0012).parent = root
    # tsuba, tsuka with silk wrap, kashira
    ts = mouth - d * 0.008
    bpy.ops.mesh.primitive_cylinder_add(radius=0.04 * scale, depth=0.007, location=ts); t = bpy.context.object; t.name = name + '_tsuba'
    t.rotation_euler = Vector((0, 0, 1)).rotation_difference(d).to_euler(); t.data.materials.append(IRON); t.parent = root
    bv = t.modifiers.new('bev', 'BEVEL'); bv.width = 0.002; bv.segments = 2
    a = ts - d * 0.006; b = ts - d * L_tsuka
    tube(name + '_tsuka', [a, a.lerp(b, 0.5), b], [0.016 * scale, 0.015 * scale, 0.0165 * scale], ITO, 8).parent = root
    for k in range(9):   # the black diamonds of the wrap read as dark bands
        p = a.lerp(b, (k + 0.5) / 9)
        bpy.ops.mesh.primitive_uv_sphere_add(radius=1, location=p); dm = bpy.context.object; dm.name = name + '_ito_knot'
        dm.scale = (0.012 * scale, 0.0045, 0.012 * scale); dm.rotation_euler = Vector((0, 0, 1)).rotation_difference(d).to_euler()
        dm.data.materials.append(BLACK); dm.parent = root
    bpy.ops.mesh.primitive_cylinder_add(radius=0.017 * scale, depth=0.018, location=b - d * 0.008); k = bpy.context.object; k.name = name + '_kashira'
    k.rotation_euler = Vector((0, 0, 1)).rotation_difference(d).to_euler(); k.data.materials.append(IRON); k.parent = root
    # sageo: white cord looped round the saya
    s0 = mouth + d * 0.12
    tube(name + '_sageo', [s0 + Vector((0.0, 0, 0.02)), s0 + Vector((-0.03, -0.02, -0.05)), s0 + Vector((-0.02, 0.06, -0.14)), s0 + Vector((0.02, 0.1, -0.12))], [0.0035] * 4, SILK).parent = root
    return root
sword('katana', Vector((0.15, -0.17, 1.0)), Vector((0.12, 0.92, -0.38)), 0.78, 0.26)
sword('wakizashi', Vector((0.13, -0.16, 1.06)), Vector((0.1, 0.94, -0.3)), 0.52, 0.17, 0.9)

# ---------------------------------------------------------------- export / render
os.makedirs(OUT, exist_ok=True)
bpy.ops.wm.save_as_mainfile(filepath=f'{OUT}/samurai.blend')
if 'export' in ARGS:
    for o in bpy.data.objects:
        for m in o.modifiers:
            if m.type == 'SUBSURF': m.levels = 1
    for c in bpy.data.curves: c.bevel_resolution = min(c.bevel_resolution, 2)
    bpy.ops.object.select_all(action='DESELECT')
    for o in scene.objects: o.select_set(o.type in ('MESH', 'CURVE'))
    bpy.ops.export_scene.gltf(filepath=f'{OUT}/samurai.glb', export_format='GLB', use_selection=True, export_apply=True, export_texcoords=False)

if 'render' in ARGS:
    scene.render.engine = 'CYCLES'; scene.cycles.device = 'CPU'
    scene.cycles.samples = int(os.environ.get('SAMPLES', 96)); scene.cycles.use_denoising = True
    scene.render.resolution_x, scene.render.resolution_y = (int(v) for v in os.environ.get('RES', '1000x1400').split('x'))
    scene.view_settings.view_transform = 'AgX'; scene.view_settings.look = 'AgX - Medium High Contrast'
    w = bpy.data.worlds.new('w'); scene.world = w; w.use_nodes = True
    w.node_tree.nodes['Background'].inputs['Color'].default_value = (0.004, 0.0045, 0.006, 1)
    def area(name, loc, energy, size, color, target=(0, 0, 1.1)):
        l = bpy.data.lights.new(name, 'AREA'); l.energy = energy; l.size = size; l.color = color
        o = bpy.data.objects.new(name, l); scene.collection.objects.link(o); o.location = loc
        o.rotation_euler = (Vector(target) - Vector(loc)).to_track_quat('-Z', 'Y').to_euler()
    area('moon_rim', (2.2, 2.6, 2.6), 900, 1.4, (0.82, 0.88, 1.0))
    area('rim2', (-2.4, 2.0, 2.0), 450, 1.2, (0.82, 0.88, 1.0))
    area('key', (-1.6, -2.6, 2.4), 220, 2.0, (1.0, 0.97, 0.93))
    area('bounce', (0.3, -2.0, -0.4), 40, 3.0, (0.6, 0.66, 0.8))
    bpy.ops.mesh.primitive_plane_add(size=30); floor = bpy.context.object
    fm = mat_simple('floor', (0.006, 0.006, 0.007), 0.25); floor.data.materials.append(fm)
    cam_d = bpy.data.cameras.new('cam'); cam_d.lens = 70
    cam = bpy.data.objects.new('cam', cam_d); scene.collection.objects.link(cam); scene.camera = cam
    shots = {'hero': ((1.7, -4.2, 1.15), (0, 0, 0.98)), 'back': ((-2.2, 3.8, 1.4), (0, 0, 1.0)), 'bust': ((0.8, -1.9, 1.55), (0, 0, 1.38))}
    for name in os.environ.get('SHOTS', 'hero').split(','):
        loc, tgt = shots[name]
        cam.location = loc; cam.rotation_euler = (Vector(tgt) - Vector(loc)).to_track_quat('-Z', 'Y').to_euler()
        scene.render.filepath = f'{OUT}/samurai_{name}.png'
        bpy.ops.render.render(write_still=True)
print('done')
