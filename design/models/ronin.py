# Wandering ronin, no armour: layered worn clothing, ribbed kasa, menpō, rope belt, wrapped legs,
# daishō at the left hip. Built procedurally in Blender (static pose, no rig yet).
# Run: /tmp/bl/bin/python ronin.py [render] [export]
# Z up, he faces -Y, his right side is -X. Origin between his feet.
import bpy, bmesh, math, sys, os, random
from mathutils import Vector, Matrix
from mathutils.noise import noise as pnoise

ARGS = ARGS_SAVED = sys.argv[1:]
HERE = os.path.dirname(os.path.abspath(__file__))
OUT = '/tmp/blend/out'

os.environ['NO_YODARE'] = '1'
sys.argv = ['menpo.py']
exec(open(os.path.join(HERE, 'menpo.py')).read())
sys.argv = ['ronin.py'] + ARGS_SAVED; ARGS = ARGS_SAVED
scene = bpy.context.scene
R = random.Random(23)
HEAD = Vector((0, -0.01, 1.615))
for o in [o for o in scene.objects if o.type in ('MESH', 'CURVE')]:
    if o.name.startswith('Cylinder') and o.get('context_only'): bpy.data.objects.remove(o); continue
    o.location += HEAD
    if o.get('context_only'): del o['context_only']

def smooth(x): x = max(0.0, min(1.0, x)); return x * x * (3 - 2 * x)
def gs(x, s): return math.exp(-(x / s) ** 2)
def n3(x, y, z): return pnoise(Vector((x, y, z)))

# ---------------------------------------------------------------- materials
def fabric(name, col, pattern=0.0, sheen=0.25, rough=0.9, weave=700):
    """Woven cloth: fine weave bump, optional faint geometric pattern, worn lighter patches."""
    m = bpy.data.materials.new(name); m.use_nodes = True
    N = m.node_tree.nodes; L = m.node_tree.links; b = N['Principled BSDF']
    b.inputs['Roughness'].default_value = rough; b.inputs['Specular IOR Level'].default_value = 0.18
    b.inputs['Sheen Weight'].default_value = sheen * 0.4; b.inputs['Sheen Roughness'].default_value = 0.5
    tc = N.new('ShaderNodeTexCoord')
    w1 = N.new('ShaderNodeTexWave'); w1.inputs['Scale'].default_value = weave; w1.wave_type = 'BANDS'; w1.bands_direction = 'Z'
    w2 = N.new('ShaderNodeTexWave'); w2.inputs['Scale'].default_value = weave; w2.wave_type = 'BANDS'; w2.bands_direction = 'X'
    mx = N.new('ShaderNodeMath'); mx.operation = 'MULTIPLY'
    for w in (w1, w2): L.new(tc.outputs['Object'], w.inputs['Vector'])
    L.new(w1.outputs['Fac'], mx.inputs[0]); L.new(w2.outputs['Fac'], mx.inputs[1])
    bump = N.new('ShaderNodeBump'); bump.inputs['Strength'].default_value = 0.15
    L.new(mx.outputs[0], bump.inputs['Height']); L.new(bump.outputs['Normal'], b.inputs['Normal'])
    # wear: dusty, faded patches
    nz = N.new('ShaderNodeTexNoise'); nz.inputs['Scale'].default_value = 6; nz.inputs['Detail'].default_value = 6
    L.new(tc.outputs['Object'], nz.inputs['Vector'])
    ramp = N.new('ShaderNodeValToRGB'); ramp.color_ramp.elements[0].position = 0.45; ramp.color_ramp.elements[1].position = 0.75
    ramp.color_ramp.elements[0].color = (*col, 1); ramp.color_ramp.elements[1].color = (col[0] * 1.7 + 0.004, col[1] * 1.7 + 0.004, col[2] * 1.7 + 0.005, 1)
    L.new(nz.outputs['Fac'], ramp.inputs['Fac'])
    base = ramp.outputs['Color']
    if pattern:   # a faint woven lattice in the cloth
        br = N.new('ShaderNodeTexBrick'); br.inputs['Scale'].default_value = 60; br.inputs['Mortar Size'].default_value = 0.08
        br.inputs['Color1'].default_value = (1, 1, 1, 1); br.inputs['Color2'].default_value = (1, 1, 1, 1); br.inputs['Mortar'].default_value = (0, 0, 0, 1)
        L.new(tc.outputs['Object'], br.inputs['Vector'])
        mix = N.new('ShaderNodeMix'); mix.data_type = 'RGBA'; mix.blend_type = 'MULTIPLY'; mix.inputs['Factor'].default_value = pattern
        L.new(base, mix.inputs['A']); L.new(br.outputs['Color'], mix.inputs['B']); base = mix.outputs['Result']
    L.new(base, b.inputs['Base Color'])
    return m
VEST = fabric('cloth_vest', (0.006, 0.006, 0.007), 0.35, 0.12)
KIMONO = fabric('cloth_kimono', (0.016, 0.016, 0.018), 0.0, 0.15, 0.85, 900)
UNDER = fabric('cloth_under', (0.06, 0.06, 0.064), 0.0, 0.15, 0.85, 1100)
TROUSER = fabric('cloth_trousers', (0.005, 0.005, 0.006), 0.0, 0.1)
WRAP = fabric('cloth_wraps', (0.014, 0.013, 0.013), 0.0, 0.1, 0.92, 1400)
ROPE = fabric('rope', (0.05, 0.048, 0.045), 0.0, 0.1, 0.95, 300)
OBI = fabric('cloth_obi', (0.01, 0.01, 0.011), 0.25, 0.1)
def simple(name, col, rough, metal=0.0, emit=0.0, coat=0.0):
    m = bpy.data.materials.new(name); m.use_nodes = True; b = m.node_tree.nodes['Principled BSDF']
    b.inputs['Base Color'].default_value = (*col, 1); b.inputs['Roughness'].default_value = rough; b.inputs['Metallic'].default_value = metal
    b.inputs['Coat Weight'].default_value = coat
    if emit: b.inputs['Emission Color'].default_value = (*col, 1); b.inputs['Emission Strength'].default_value = emit
    return m
SEAM = simple('seam_light', (0.85, 0.9, 1.0), 0.3, 0, 2.5)
BEAD_D = simple('bead_dark', (0.01, 0.01, 0.012), 0.25, 0, 0, 1)
BEAD_L = simple('bead_light', (0.55, 0.55, 0.56), 0.3, 0, 0, 1)
KASA = simple('kasa_lacquer', (0.012, 0.012, 0.013), 0.4, 0, 0, 0.8)
WOOD = simple('wood_sandal', (0.05, 0.042, 0.035), 0.85)
ITO = simple('ito_wrap', (0.03, 0.03, 0.032), 0.7)

# ---------------------------------------------------------------- helpers
def new_obj(name, bm, mats):
    me = bpy.data.meshes.new(name); bm.to_mesh(me); bm.free()
    o = bpy.data.objects.new(name, me); scene.collection.objects.link(o)
    for m in mats: me.materials.append(m)
    for p in me.polygons: p.use_smooth = True
    return o
def solid(o, t=0.003, subd=1, offset=1):
    s = o.modifiers.new('solid', 'SOLIDIFY'); s.thickness = t; s.offset = offset; s.use_even_offset = True
    if subd: d = o.modifiers.new('subd', 'SUBSURF'); d.levels = subd; d.render_levels = subd
    return o
def wrinkles(o, strength=0.006, size=0.06):
    tx = bpy.data.textures.new(o.name + '_wr', 'CLOUDS'); tx.noise_scale = size; tx.noise_depth = 2
    d = o.modifiers.new('wrinkle', 'DISPLACE'); d.texture = tx; d.strength = strength; d.mid_level = 0.5; d.texture_coords = 'OBJECT'
    o.modifiers.move(len(o.modifiers) - 1, 0)
    return o
def tube(name, pts, radii, mat, res=8, poly=False):
    cd = bpy.data.curves.new(name, 'CURVE'); cd.dimensions = '3D'; cd.bevel_depth = 1.0; cd.bevel_resolution = res // 2; cd.use_fill_caps = True
    if poly:
        sp = cd.splines.new('POLY'); sp.points.add(len(pts) - 1)
        for k, (p, r) in enumerate(zip(pts, radii)): sp.points[k].co = (*p, 1); sp.points[k].radius = r
    else:
        sp = cd.splines.new('BEZIER'); sp.bezier_points.add(len(pts) - 1)
        for bp, p, r in zip(sp.bezier_points, pts, radii):
            bp.co = p; bp.radius = r; bp.handle_left_type = bp.handle_right_type = 'AUTO'
    o = bpy.data.objects.new(name, cd); scene.collection.objects.link(o); cd.materials.append(mat)
    return o
def grid_obj(name, F, us, zs, mats, keep=None, closed=False):
    """Surface from F(u, z) over the u and z samples; keep(u, z) removes faces where it is False."""
    bm = bmesh.new(); G = [[bm.verts.new(F(u, z)) for u in us] for z in zs]
    nu = len(us) if closed else len(us) - 1
    for j in range(len(zs) - 1):
        for i in range(nu):
            i2 = (i + 1) % len(us)
            uc = (us[i] + (us[i2] if i2 else us[i] + (us[1] - us[0]))) / 2; zc = (zs[j] + zs[j + 1]) / 2
            if keep and not keep(uc, zc): continue
            bm.faces.new((G[j][i], G[j][i2], G[j + 1][i2], G[j + 1][i]))
    bmesh.ops.delete(bm, geom=[v for v in bm.verts if not v.link_faces], context='VERTS')
    return new_obj(name, bm, mats)
lin = lambda a, b, n: [a + (b - a) * k / n for k in range(n + 1)]
TAU = 2 * math.pi

# ---------------------------------------------------------------- body shell (under-kimono torso)
def torso_ab(z):
    t = smooth((z - 0.9) / 0.5)
    a = 0.165 + 0.045 * t; b = 0.12 + 0.03 * t
    sh = smooth((z - 1.4) / 0.13)                     # shoulders round off into the neck
    return a * (1 - 0.62 * sh), b * (1 - 0.45 * sh)
def torso_P(off=0.0, flare=0.0, waist=1.0):
    def F(u, z):
        a, b = torso_ab(min(z, 1.53))
        below = max(0.0, waist - z)
        a += off + flare * below; b += off * 0.85 + flare * 0.8 * below
        fold = 0.004 * math.sin(u * 9 + z * 20) * smooth((waist - z) / 0.2)    # hanging folds below the belt
        return Vector(((a + fold) * math.sin(u), -(b + fold) * math.cos(u), z))
    return F
kimono = grid_obj('kimono', torso_P(0.0, 0.05), lin(0, TAU, 96)[:-1], lin(1.53, 0.8, 50), [KIMONO], closed=True)
solid(kimono, 0.003, 1); wrinkles(kimono, 0.004, 0.05)
# crossed collar (left over right), lighter under-layer showing at the neck
for s, w in ((1, 0.024), (-1, 0.02)):
    tube('eri', [Vector((s * 0.06, 0.02, 1.53)), Vector((s * 0.07, -0.085, 1.47)), Vector((-s * 0.005, -0.14, 1.33)), Vector((-s * 0.03, -0.15, 1.2))], [w * 0.7, w * 0.7, w * 0.6, w * 0.5], UNDER if s < 0 else KIMONO)

# ---------------------------------------------------------------- outer vest: sleeveless, belted, ragged hem, open front and side slits
def hem(u):
    return 0.6 + 0.035 * n3(u * 3, 1.3, 0) + 0.025 * math.sin(u * 2.0) + 0.02 * abs(n3(u * 11, 4.0, 0))
def vest_keep(u, z):
    a = (u + math.pi) % TAU - math.pi               # -π … π, 0 = front
    if abs(a) < 0.16 + 0.32 * smooth((1.0 - z) / 0.2) - 0.08 * smooth((z - 1.3) / 0.15): return False   # open front
    if z < 0.86 and abs(abs(a) - math.pi / 2) < 0.035: return False        # side slits
    if z < hem(u): return False
    if z < hem(u) + 0.05 and n3(u * 30, z * 30, 2.0) > 0.25: return False   # torn notches along the hem
    return True
vest = grid_obj('vest', torso_P(0.022, 0.13, 0.98), lin(0, TAU, 140)[:-1], lin(1.5, 0.52, 80), [VEST], vest_keep, closed=True)
solid(vest, 0.004, 1); wrinkles(vest, 0.007, 0.07)
# hood / cowl rolled around the neck
tube('cowl', [Vector((0.075 * math.sin(u), -0.06 * math.cos(u) + 0.01, 1.505 + 0.012 * math.cos(u))) for u in lin(0.5, TAU - 0.5, 10)], [0.028] * 11, VEST, 8, True)
# a light seam along the vest's front edges (the digital hairline)
for s in (-1, 1):
    pts = []
    for z in lin(1.48, 1.0, 20):
        a0 = 0.16 - 0.08 * smooth((z - 1.3) / 0.15) + 0.003
        p = torso_P(0.027, 0.13, 0.98)(s * a0, z); pts.append(p)
    tube('vest_seam', pts, [0.0008] * len(pts), SEAM, 4, True)

# ---------------------------------------------------------------- belt: obi, twisted rope, prayer beads, pouch
obi = grid_obj('obi', lambda u, z: torso_P(0.03, 0.0, 0.0)(u, z), lin(0, TAU, 96)[:-1], lin(1.03, 0.93, 4), [OBI], closed=True)
solid(obi, 0.004, 1)
def rope_ring(name, z, off, twist=14, r=0.009):
    for strand in range(3):
        pts = []; rr = []
        for k in range(160):
            u = TAU * k / 159
            base = torso_P(off, 0, 0)(u, z)
            ph = u * twist + strand * TAU / 3
            pts.append(base + Vector((0, 0, r * 0.9 * math.sin(ph))) + Vector((math.sin(u), -math.cos(u), 0)) * r * 0.9 * math.cos(ph))
            rr.append(r * 0.6)
        tube(name, pts, rr, ROPE, 4, True)
rope_ring('rope_belt', 0.985, 0.045)
for s, L0 in ((1, 0.28), (1, 0.22)):            # knot ends hanging at the front-left
    start = torso_P(0.05, 0, 0)(0.35, 0.975)
    tube('rope_end', [start, start + Vector((0.02, -0.02, -0.08)), start + Vector((0.01, -0.03, -L0)), start + Vector((0.03, -0.02, -L0 - 0.05))], [0.009, 0.008, 0.007, 0.006], ROPE)
bpy.ops.mesh.primitive_uv_sphere_add(radius=1, location=torso_P(0.06, 0, 0)(0.35, 0.98)); knot = bpy.context.object; knot.scale = (0.025, 0.02, 0.022); knot.data.materials.append(ROPE); bpy.ops.object.shade_smooth()
# juzu: a loop of beads over the belt, hanging at his left front
for k in range(46):
    f = k / 45
    u = 0.15 + 0.95 * f
    sag = 0.07 * math.sin(f * math.pi)
    p = torso_P(0.06, 0, 0)(u, 1.0 - sag) + Vector((0, -0.004, 0))
    bpy.ops.mesh.primitive_uv_sphere_add(radius=0.0085 if k % 9 else 0.012, segments=16, ring_count=8, location=p)
    bd = bpy.context.object; bd.name = 'juzu'; bd.data.materials.append(BEAD_L if k % 9 == 0 else BEAD_D); bpy.ops.object.shade_smooth()
# pouch at the right hip
pp = torso_P(0.06, 0.13, 0.98)(-1.15, 0.86)
bpy.ops.mesh.primitive_uv_sphere_add(radius=1, segments=24, ring_count=16, location=pp); pouch = bpy.context.object; pouch.name = 'pouch'
pouch.scale = (0.05, 0.04, 0.07); pouch.data.materials.append(VEST); bpy.ops.object.shade_smooth()
tube('pouch_tie', [pp + Vector((0, 0, 0.07)), pp + Vector((0.005, -0.01, 0.12))], [0.004, 0.004], ROPE)

# ---------------------------------------------------------------- trousers, leg wraps, tabi, waraji
LEG = {s: (Vector((s * 0.1, 0.0, 0.92)), Vector((s * 0.135, -0.02, 0.5)), Vector((s * 0.14, 0.0, 0.08))) for s in (-1, 1)}
for s, (hip, knee, ank) in LEG.items():
    # loose trousers to below the knee, gathered into the wraps
    pts = [hip, hip.lerp(knee, 0.5), knee, knee.lerp(ank, 0.25)]
    tr = tube('trousers', pts, [0.105, 0.1, 0.085, 0.06], TROUSER, 12)
    # kyahan: spiral-wrapped shins
    tube('shin', [knee.lerp(ank, 0.15), knee.lerp(ank, 0.6), ank + Vector((0, 0, 0.03))], [0.057, 0.05, 0.045], WRAP, 10)
    for k in range(9):
        z0 = 0.43 - k * 0.04
        c = knee.lerp(ank, (0.5 - z0) / 0.42)
        rr = 0.056 - 0.012 * (0.43 - z0) / 0.36
        tube('leg_wrap', [c + Vector((math.cos(a) * rr, math.sin(a) * rr, (a / TAU) * 0.04)) for a in lin(0, TAU, 14)], [0.009] * 15, WRAP, 6, True)
    tube('wrap_tie', [knee + Vector((0, -0.05, -0.05)), knee + Vector((0.02 * s, -0.07, -0.09)), knee + Vector((0.03 * s, -0.06, -0.15))], [0.004] * 3, ROPE)
    # foot: tabi and sandal
    bpy.ops.mesh.primitive_uv_sphere_add(radius=1, location=(s * 0.14, -0.06, 0.05)); ft = bpy.context.object; ft.name = 'tabi'
    ft.scale = (0.048, 0.12, 0.045); ft.data.materials.append(WRAP); bpy.ops.object.shade_smooth()
    bpy.ops.mesh.primitive_cube_add(size=1, location=(s * 0.14, -0.065, 0.01)); so = bpy.context.object; so.name = 'waraji'
    so.scale = (0.1, 0.27, 0.02); so.data.materials.append(WOOD); bv = so.modifiers.new('bev', 'BEVEL'); bv.width = 0.008; bv.segments = 2
    tube('sandal_strap', [Vector((s * 0.1, -0.15, 0.03)), Vector((s * 0.14, -0.16, 0.07)), Vector((s * 0.18, -0.15, 0.03))], [0.004] * 3, ROPE)

# ---------------------------------------------------------------- arms: wide sleeves, forearm wraps, gloved hands
ARM = {'R': (Vector((-0.2, 0.0, 1.43)), Vector((-0.245, 0.02, 1.16)), Vector((-0.235, -0.05, 0.9))),
       'L': (Vector((0.2, 0.0, 1.43)), Vector((0.245, 0.0, 1.16)), Vector((0.22, -0.08, 0.92)))}
for side, (sh, el, wr) in ARM.items():
    sx = 1 if side == 'L' else -1
    # kimono sleeve: a wide bag hanging from the arm, open at the cuff
    pts = [sh, sh.lerp(el, 0.5), el, el.lerp(wr, 0.35)]
    tube('sleeve', pts, [0.07, 0.078, 0.082, 0.08], KIMONO, 12)
    bag = tube('sleeve_bag', [el + Vector((0, 0.02, -0.02)), el.lerp(wr, 0.3) + Vector((0, 0.05, -0.06)), el.lerp(wr, 0.45) + Vector((0, 0.06, -0.12))], [0.07, 0.07, 0.04], KIMONO, 10)
    # forearm wraps
    fa0 = el.lerp(wr, 0.32); d = (wr - fa0).normalized()
    side_v = d.cross(Vector((0, 0, 1))).normalized(); up_v = side_v.cross(d)
    tube('forearm', [fa0, wr], [0.04, 0.034], WRAP, 8)
    for k in range(7):
        c = fa0.lerp(wr, k / 7)
        tube('arm_wrap', [c + (side_v * math.cos(a) + up_v * math.sin(a)) * (0.04 - 0.006 * k / 7) + d * (a / TAU) * 0.03 for a in lin(0, TAU, 12)], [0.006] * 13, WRAP, 6, True)
    # gloved hand: palm and four curled fingers and a thumb
    hp = wr + d * 0.055
    bpy.ops.mesh.primitive_cube_add(size=1, location=hp); palm = bpy.context.object; palm.name = 'hand'
    palm.scale = (0.03, 0.075, 0.085); palm.rotation_euler = Matrix((side_v, up_v, d)).transposed().to_euler()
    palm.rotation_euler = (Matrix((up_v, side_v, d)).transposed()).to_euler()
    palm.data.materials.append(WRAP); m = palm.modifiers.new('subd', 'SUBSURF'); m.levels = 2; m.render_levels = 2; bpy.ops.object.shade_smooth()
    for f in range(4):
        base = hp + d * 0.04 + side_v * (-0.026 + f * 0.017)
        tip = base + d * 0.035 - up_v * 0.03 * sx * 0 + Vector((0, -0.02, -0.01))
        tube('finger', [base, base + d * 0.025, tip], [0.0085, 0.008, 0.0075], WRAP, 6)
    tube('thumb', [hp - side_v * 0.03 * sx + d * 0.0, hp - side_v * 0.04 * sx + d * 0.03 + Vector((0, -0.02, 0))], [0.009, 0.008], WRAP, 6)

# ---------------------------------------------------------------- kasa: wide, shallow, ribbed, lacquered
bm = bmesh.new(); NA, NR = 240, 36; G = []
RIBS = 30
for j in range(NR + 1):
    t = j / NR; r = 0.004 + t * 0.4
    z = 0.14 * (1 - t) ** 1.35 - 0.05 * smooth((t - 0.7) / 0.3)       # crown, brim droops at the edge
    row = []
    for i in range(NA):
        a = TAU * i / NA
        rib = 0.0035 * (abs(math.sin(a * RIBS / 2)) ** 0.5) * smooth(t * 3)
        row.append(bm.verts.new(((r + rib) * math.cos(a), (r + rib) * math.sin(a), z + rib * 0.5)))
    G.append(row)
for j in range(NR):
    for i in range(NA): bm.faces.new((G[j][i], G[j][(i + 1) % NA], G[j + 1][(i + 1) % NA], G[j + 1][i]))
kasa = solid(new_obj('kasa', bm, [KASA]), 0.004, 1, -1)
kasa.location = HEAD + Vector((0, 0.0, 0.045)); kasa.rotation_euler = (math.radians(-12), math.radians(4), 0)
# stitched rings and a light seam at the rim
for rr, mat, rad in ((0.15, ROPE, 0.0018), (0.27, ROPE, 0.0018), (0.403, SEAM, 0.0016)):
    t = (rr - 0.004) / 0.4
    z = 0.14 * (1 - t) ** 1.35 - 0.05 * smooth((t - 0.7) / 0.3) + 0.004
    ring = tube('kasa_ring', [Vector((rr * math.cos(a), rr * math.sin(a), z)) for a in lin(0, TAU, 120)], [rad] * 121, mat, 4, True)
    ring.parent = kasa
for s in (-1, 1):
    tube('kasa_cord', [kasa.location + Vector((s * 0.075, 0.03, -0.01)), HEAD + Vector((s * 0.078, 0.02, -0.03)), HEAD + Vector((s * 0.06, 0.01, -0.09))], [0.0022] * 3, ROPE)

# ---------------------------------------------------------------- daishō through the belt at the left hip, hilts forward
def sword(name, mouth, direction, L_saya, L_tsuka, sc=1.0):
    d = direction.normalized()
    pts = [mouth + d * (L_saya * k / 4) + Vector((0, 0, -0.012 * (k / 4) ** 2)) for k in range(5)]
    tube(name + '_saya', pts, [0.018 * sc, 0.0175 * sc, 0.017 * sc, 0.016 * sc, 0.015 * sc], BLACK, 10)
    ring = [mouth + (Vector((math.cos(u), 0, math.sin(u))) * 0.0195 * sc) for u in lin(0, TAU, 32)]
    tube(name + '_koiguchi', ring, [0.0012] * 33, SEAM, 4, True)
    ts = mouth - d * 0.008
    bpy.ops.mesh.primitive_cylinder_add(radius=0.038 * sc, depth=0.007, location=ts); t = bpy.context.object; t.name = name + '_tsuba'
    t.rotation_euler = Vector((0, 0, 1)).rotation_difference(d).to_euler(); t.data.materials.append(IRON)
    a = ts - d * 0.006; b = ts - d * L_tsuka
    tube(name + '_tsuka', [a, a.lerp(b, 0.5), b], [0.016 * sc, 0.015 * sc, 0.0165 * sc], ITO, 8)
    for k in range(10):        # diamond wrap: light silk crossing the dark hilt
        p = a.lerp(b, (k + 0.5) / 10)
        bpy.ops.mesh.primitive_uv_sphere_add(radius=1, segments=12, ring_count=6, location=p); dm = bpy.context.object; dm.name = name + '_ito'
        dm.scale = (0.0115 * sc, 0.006, 0.0115 * sc); dm.rotation_euler = Vector((0, 0, 1)).rotation_difference(d).to_euler(); dm.data.materials.append(SILK)
    bpy.ops.mesh.primitive_cylinder_add(radius=0.017 * sc, depth=0.018, location=b - d * 0.008); k = bpy.context.object; k.name = name + '_kashira'
    k.rotation_euler = Vector((0, 0, 1)).rotation_difference(d).to_euler(); k.data.materials.append(IRON)
    s0 = mouth + d * 0.13
    tube(name + '_sageo', [s0, s0 + Vector((0.025, 0.0, -0.06)), s0 + Vector((0.02, 0.05, -0.16))], [0.0035] * 3, SILK)
    tip = s0 + Vector((0.02, 0.05, -0.16))
    for q in range(10):  # tassel
        tube(name + '_tassel', [tip, tip + Vector((R.uniform(-0.008, 0.008), R.uniform(-0.008, 0.008), -0.05))], [0.0012, 0.0012], SILK, 4, True)
sword('katana', torso_P(0.06, 0, 0)(0.95, 0.99) + Vector((0, -0.01, 0)), Vector((0.14, 0.84, -0.52)), 0.78, 0.26)
sword('wakizashi', torso_P(0.06, 0, 0)(0.75, 1.02) + Vector((0, -0.01, 0)), Vector((0.16, 0.86, -0.46)), 0.52, 0.17, 0.9)

# ---------------------------------------------------------------- export / render
os.makedirs(OUT, exist_ok=True)
bpy.ops.wm.save_as_mainfile(filepath=f'{OUT}/ronin.blend')
if 'export' in ARGS:
    for o in bpy.data.objects:
        for m in o.modifiers:
            if m.type == 'SUBSURF': m.levels = 1
    for c in bpy.data.curves: c.bevel_resolution = min(c.bevel_resolution, 2)
    bpy.ops.object.select_all(action='DESELECT')
    for o in scene.objects: o.select_set(o.type in ('MESH', 'CURVE'))
    bpy.ops.export_scene.gltf(filepath=f'{OUT}/ronin.glb', export_format='GLB', use_selection=True, export_apply=True, export_texcoords=False)

if 'render' in ARGS:
    scene.render.engine = 'CYCLES'; scene.cycles.device = 'CPU'
    scene.cycles.samples = int(os.environ.get('SAMPLES', 96)); scene.cycles.use_denoising = True
    scene.render.resolution_x, scene.render.resolution_y = (int(v) for v in os.environ.get('RES', '1000x1400').split('x'))
    scene.view_settings.view_transform = 'AgX'; scene.view_settings.look = 'AgX - Medium High Contrast'
    w = bpy.data.worlds.new('w'); scene.world = w; w.use_nodes = True
    WN = w.node_tree.nodes; WL = w.node_tree.links
    bg = WN['Background']; bg.inputs['Color'].default_value = (0.06, 0.06, 0.065, 1); bg.inputs['Strength'].default_value = 1.0
    cam_bg = WN.new('ShaderNodeBackground'); cam_bg.inputs['Color'].default_value = (0.62, 0.62, 0.64, 1)    # pale mist behind him
    lp = WN.new('ShaderNodeLightPath'); mixw = WN.new('ShaderNodeMixShader'); outw = WN['World Output']
    WL.new(lp.outputs['Is Camera Ray'], mixw.inputs['Fac']); WL.new(bg.outputs[0], mixw.inputs[1]); WL.new(cam_bg.outputs[0], mixw.inputs[2]); WL.new(mixw.outputs[0], outw.inputs['Surface'])
    def area(name, loc, energy, size, color, target=(0, 0, 1.1)):
        l = bpy.data.lights.new(name, 'AREA'); l.energy = energy; l.size = size; l.color = color
        o = bpy.data.objects.new(name, l); scene.collection.objects.link(o); o.location = loc
        o.rotation_euler = (Vector(target) - Vector(loc)).to_track_quat('-Z', 'Y').to_euler()
    area('key', (-2.0, -2.4, 3.0), 260, 2.5, (1.0, 0.98, 0.95))
    area('fill', (2.5, -2.0, 1.0), 60, 3.0, (0.85, 0.88, 0.95))
    area('rim', (2.2, 2.4, 2.4), 300, 1.5, (0.9, 0.93, 1.0))
    bpy.ops.mesh.primitive_plane_add(size=40); floor = bpy.context.object
    floor.is_shadow_catcher = True
    scene.render.film_transparent = True
    cam_d = bpy.data.cameras.new('cam'); cam_d.lens = 65
    cam = bpy.data.objects.new('cam', cam_d); scene.collection.objects.link(cam); scene.camera = cam
    shots = {'hero': ((1.5, -4.4, 1.05), (0, 0, 0.92)), 'bust': ((0.75, -1.9, 1.55), (0, 0, 1.36)), 'side': ((4.2, -1.0, 1.1), (0, 0, 0.92))}
    for name in os.environ.get('SHOTS', 'hero').split(','):
        loc, tgt = shots[name]
        cam.location = loc; cam.rotation_euler = (Vector(tgt) - Vector(loc)).to_track_quat('-Z', 'Y').to_euler()
        scene.render.filepath = f'{OUT}/ronin_{name}.png'
        bpy.ops.render.render(write_still=True)
        # composite onto a pale ink-wash backdrop
        try:
            from PIL import Image, ImageDraw, ImageFilter
        except ImportError:
            continue
        fg = Image.open(scene.render.filepath).convert('RGBA'); W_, H_ = fg.size
        bgi = Image.new('RGBA', fg.size)
        px = bgi.load()
        for y in range(H_):
            t = y / H_
            v = int(232 - 18 * t + 10 * math.exp(-((t - 0.55) / 0.2) ** 2))
            for x in range(W_): px[x, y] = (v, v, v + 2, 255)
        Image.alpha_composite(bgi, fg).convert('RGB').save(scene.render.filepath.replace('.png', '_comp.png'))
print('done')
