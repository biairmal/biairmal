# Rig and animate the ronin: skeleton, skin weights, IK controls, two baked clips (idle, iai).
# Input: /tmp/blend/out/ronin.blend (from ronin.py, cloth already simulated). Output: ronin_rigged.blend / .glb
# Run: /tmp/bl/bin/python rig.py
import bpy, bmesh, math, os
import numpy as np
from mathutils import Vector, Matrix, Quaternion, Euler

OUT = '/tmp/blend/out'
FPS = 30
bpy.ops.wm.open_mainfile(filepath=f'{OUT}/ronin.blend')
scene = bpy.context.scene
scene.render.fps = FPS
V = Vector

def smooth(x): x = max(0.0, min(1.0, x)); return x * x * (3 - 2 * x)

# ------------------------------------------------------------------ sword geometry (read from the model)
ts_obj = bpy.data.objects['katana_tsuba']
TS = ts_obj.location.copy()
D0 = (ts_obj.matrix_world.to_3x3() @ V((0, 0, 1))).normalized()       # from the tsuba toward the saya's tail
MOUTH = TS + D0 * 0.008
E0 = (V((0, 0, 1)) - D0 * D0.z).normalized()                         # edge up, as a katana is worn
G0 = TS - D0 * 0.05                                                   # where the right hand grips
BLADE_L = 0.72

# a blade, hidden inside the saya at rest
steel = bpy.data.materials.new('blade_steel'); steel.use_nodes = True
b = steel.node_tree.nodes['Principled BSDF']; b.inputs['Base Color'].default_value = (0.8, 0.82, 0.85, 1); b.inputs['Metallic'].default_value = 1; b.inputs['Roughness'].default_value = 0.12
bm = bmesh.new(); X0 = D0.cross(E0)
N = 30; prof = []
for k in range(N + 1):
    f = k / N; s = f * BLADE_L
    w = 0.03 * (1 - 0.3 * f) if f < 0.94 else 0.03 * 0.7 * (1 - (f - 0.94) / 0.06) + 0.001
    curve = 0.02 * f * f                                     # sori: gentle curve toward the back
    base = TS + D0 * (0.012 + s) - E0 * curve
    edge = base + E0 * (w * 0.5); back = base - E0 * (w * 0.5)
    th = 0.0035 * (1 - 0.5 * f)
    prof.append([bm.verts.new(edge), bm.verts.new(back + X0 * th), bm.verts.new(back - X0 * th)])
for k in range(N):
    a, c = prof[k], prof[k + 1]
    for i in range(3): bm.faces.new((a[i], a[(i + 1) % 3], c[(i + 1) % 3], c[i]))
me = bpy.data.meshes.new('katana_blade'); bm.to_mesh(me); bm.free()
blade = bpy.data.objects.new('katana_blade', me); scene.collection.objects.link(blade); me.materials.append(steel)
habaki_m = bpy.data.materials.get('iron')
bpy.ops.mesh.primitive_cube_add(size=1, location=TS + D0 * 0.02); hb = bpy.context.object; hb.name = 'katana_habaki'
hb.rotation_euler = Matrix((X0, D0, E0)).transposed().to_euler(); hb.scale = (0.012, 0.03, 0.036); hb.data.materials.append(habaki_m)

# ------------------------------------------------------------------ flatten the model into plain meshes
for o in scene.objects: o.hide_set(False); o.hide_render = False
for o in scene.objects:
    for m in o.modifiers:
        if m.type == 'SUBSURF': m.levels = 1
for c in bpy.data.curves: c.bevel_resolution = min(c.bevel_resolution, 2)
bpy.ops.object.select_all(action='DESELECT')
objs = [o for o in scene.objects if o.type in ('MESH', 'CURVE')]
for o in objs: o.select_set(True)
bpy.context.view_layer.objects.active = objs[0]
bpy.ops.object.parent_clear(type='CLEAR_KEEP_TRANSFORM')
bpy.ops.object.convert(target='MESH')
bpy.ops.object.transform_apply(location=True, rotation=True, scale=True)
for o in [o for o in scene.objects if o.type == 'EMPTY']: bpy.data.objects.remove(o)
objs = [o for o in scene.objects if o.type == 'MESH']
print('meshes', len(objs), 'verts', sum(len(o.data.vertices) for o in objs), flush=True)

# ------------------------------------------------------------------ skeleton (rest = the modelled pose)
ARM = {'R': (V((-0.2, 0.0, 1.43)), V((-0.245, 0.02, 1.16)), V((-0.235, -0.05, 0.9))),
       'L': (V((0.2, 0.0, 1.43)), V((0.245, 0.0, 1.16)), V((0.22, -0.08, 0.92)))}
LEG = {s: (V((x * 0.1, 0.0, 0.92)), V((x * 0.135, -0.02, 0.5)), V((x * 0.14, 0.0, 0.08))) for s, x in (('R', -1), ('L', 1))}
B = {}   # name: (head, tail, parent, deform, roll_align)
B['root'] = (V((0, 0, 0)), V((0, 0.2, 0)), None, False, None)
B['hips'] = (V((0, 0, 0.92)), V((0, 0, 1.05)), 'root', True, V((0, -1, 0)))
B['spine'] = (V((0, 0, 1.05)), V((0, 0, 1.22)), 'hips', True, V((0, -1, 0)))
B['chest'] = (V((0, 0, 1.22)), V((0, 0, 1.43)), 'spine', True, V((0, -1, 0)))
B['neck'] = (V((0, 0, 1.43)), V((0, 0, 1.55)), 'chest', True, V((0, -1, 0)))
B['head'] = (V((0, 0, 1.55)), V((0, 0, 1.8)), 'neck', True, V((0, -1, 0)))
for s, (sh, el, wr) in ARM.items():
    x = 1 if s == 'L' else -1
    hd = (wr - el).normalized()
    B[f'shoulder_{s}'] = (V((x * 0.05, 0, 1.42)), sh, 'chest', True, V((0, -1, 0)))
    B[f'upperarm_{s}'] = (sh, el, f'shoulder_{s}', True, V((0, 1, 0)))
    B[f'forearm_{s}'] = (el, wr, f'upperarm_{s}', True, V((0, 1, 0)))
    B[f'hand_{s}'] = (wr, wr + hd * 0.1, f'forearm_{s}', True, V((0, 1, 0)))
    B[f'ik_hand_{s}'] = (wr, wr + hd * 0.03, 'root', False, V((0, 1, 0)))
    B[f'pole_arm_{s}'] = (el + V((0, 0.45, 0)), el + V((0, 0.5, 0)), 'chest', False, None)
for s, (hp, kn, an) in LEG.items():
    toe = V((hp.x * 1.4, -0.17, 0.03))
    B[f'thigh_{s}'] = (hp, kn, 'hips', True, V((0, -1, 0)))
    B[f'shin_{s}'] = (kn, an, f'thigh_{s}', True, V((0, -1, 0)))
    B[f'foot_{s}'] = (an, toe, f'shin_{s}', True, V((0, 0, 1)))
    B[f'ik_foot_{s}'] = (an, an + (toe - an).normalized() * 0.03, 'root', False, V((0, 0, 1)))
    B[f'pole_leg_{s}'] = (kn + V((0, -0.5, 0)), kn + V((0, -0.55, 0)), 'root', False, None)
B['katana'] = (G0, G0 + D0 * 0.1, 'root', True, E0)
B['saya'] = (MOUTH, MOUTH + D0 * 0.1, 'hips', True, E0)

arm_data = bpy.data.armatures.new('ronin_rig'); rig = bpy.data.objects.new('ronin_rig', arm_data); scene.collection.objects.link(rig)
bpy.context.view_layer.objects.active = rig; bpy.ops.object.mode_set(mode='EDIT')
for name, (h, t, p, d, roll) in B.items():
    eb = arm_data.edit_bones.new(name); eb.head = h; eb.tail = t; eb.use_deform = d
    if roll is not None: eb.align_roll(roll)
for name, (h, t, p, d, roll) in B.items():
    if p: arm_data.edit_bones[name].parent = arm_data.edit_bones[p]
bpy.ops.object.mode_set(mode='OBJECT')
REST = {bn.name: bn.matrix_local.copy() for bn in arm_data.bones}

# ------------------------------------------------------------------ skin weights by distance to bone segments, per body region
def seg_dist(P, a, b):
    ab = np.array(b - a); ap = P - np.array(a)
    t = np.clip(ap @ ab / (ab @ ab), 0, 1)
    return np.linalg.norm(ap - t[:, None] * ab, axis=1)
def region(o):
    n = o.name.split('.')[0]
    c = sum((o.matrix_world @ V(bb) for bb in o.bound_box), V()) / 8
    side = 'L' if c.x > 0 else 'R'
    if n.startswith('katana_') and n not in ('katana_saya', 'katana_koiguchi', 'katana_sageo', 'katana_tassel'): return {'katana': 1}
    if n in ('katana_saya', 'katana_koiguchi', 'katana_sageo', 'katana_tassel'): return {'saya': 1}
    if n.startswith('wakizashi') or n in ('pouch', 'pouch_tie', 'juzu', 'rope_end', 'Sphere'): return {'hips': 1}
    if n in ('hand', 'finger', 'thumb'): return {f'hand_{side}': 1}
    if n in ('sleeve',): return {'chest': 0.4, f'shoulder_{side}': 1, f'upperarm_{side}': 1, f'forearm_{side}': 1}
    if n in ('arm_wrap', 'forearm'): return {f'forearm_{side}': 1, f'hand_{side}': 0.5}
    if n in ('trousers', 'leg_wrap', 'shin', 'wrap_tie'): return {'hips': 1, f'thigh_{side}': 1, f'shin_{side}': 1}
    if n in ('tabi', 'waraji', 'sandal_strap'): return {f'foot_{side}': 1}
    if n in ('kimono', 'vest', 'eri', 'vest_seam', 'obi', 'rope_belt', 'cowl'):
        return {'hips': 1, 'spine': 1, 'chest': 1, 'neck': 0.6, 'thigh_L': 0.35, 'thigh_R': 0.35}
    if c.z > 1.5: return {'head': 1}
    return {'hips': 1, 'spine': 1, 'chest': 1}
for o in objs:
    reg = region(o)
    n = len(o.data.vertices); co = np.empty(n * 3); o.data.vertices.foreach_get('co', co); P = co.reshape(-1, 3)
    names = list(reg)
    if len(names) == 1:
        o.vertex_groups.new(name=names[0]).add(range(n), 1.0, 'REPLACE'); continue
    W = np.stack([reg[k] / (seg_dist(P, B[k][0], B[k][1]) + 0.015) ** 4 for k in names], 1)
    keep = np.argsort(-W, 1)[:, :3]
    mask = np.zeros_like(W); np.put_along_axis(mask, keep, 1, 1); W *= mask
    W /= W.sum(1, keepdims=True)
    for j, k in enumerate(names):
        idx = np.nonzero(W[:, j] > 0.01)[0]
        if not len(idx): continue
        vg = o.vertex_groups.new(name=k)
        for w in np.unique(np.round(W[idx, j], 2)):
            sel = idx[np.round(W[idx, j], 2) == w]
            vg.add(sel.tolist(), float(w), 'REPLACE')
print('weights done', flush=True)

# one mesh, bound to the rig
bpy.ops.object.select_all(action='DESELECT')
for o in objs: o.select_set(True)
bpy.context.view_layer.objects.active = objs[0]
bpy.ops.object.join()
body = bpy.context.object; body.name = 'ronin'
body.parent = rig
am = body.modifiers.new('rig', 'ARMATURE'); am.object = rig

# ------------------------------------------------------------------ IK controls
pb = rig.pose.bones
for p in pb: p.rotation_mode = 'QUATERNION'
def ik(owner, target, pole):
    c = pb[owner].constraints.new('IK'); c.target = rig; c.subtarget = target; c.pole_target = rig; c.pole_subtarget = pole; c.chain_count = 2
    return c
def copy_rot(owner, target):
    c = pb[owner].constraints.new('COPY_ROTATION'); c.target = rig; c.subtarget = target
IKC = {}
for s in 'RL':
    IKC[f'forearm_{s}'] = ik(f'forearm_{s}', f'ik_hand_{s}', f'pole_arm_{s}'); copy_rot(f'hand_{s}', f'ik_hand_{s}')
    IKC[f'shin_{s}'] = ik(f'shin_{s}', f'ik_foot_{s}', f'pole_leg_{s}'); copy_rot(f'foot_{s}', f'ik_foot_{s}')
# pole angles: choose the one that leaves the rest pose untouched
def err(chain):
    bpy.context.view_layer.update()
    return sum(sum(abs(x) for r in (rig.pose.bones[b].matrix - REST[b]) for x in r) for b in chain)
for owner, c in IKC.items():
    parent = rig.data.bones[owner].parent.name
    best = min(range(-180, 181, 5), key=lambda a: (setattr(c, 'pole_angle', math.radians(a)), err([owner, parent]))[1])
    c.pole_angle = math.radians(best); print('pole', owner, best, round(err([owner, parent]), 4), flush=True)

# ------------------------------------------------------------------ animation helpers
def basis(pos, Y, Z):
    Y = Y.normalized(); Z = (Z - Y * Z.dot(Y)).normalized(); X = Y.cross(Z)
    m = Matrix((X, Y, Z)).transposed().to_4x4(); m.translation = pos; return m
def blend_m(a, b, t):
    q = a.to_quaternion().slerp(b.to_quaternion(), t); p = a.translation.lerp(b.translation, t)
    m = q.to_matrix().to_4x4(); m.translation = p; return m
HIP_HEAD = B['hips'][0]
def hips_delta(off, yaw, pitch):
    R = (Euler((pitch, 0, yaw)).to_matrix().to_4x4())
    return Matrix.Translation(HIP_HEAD + off) @ R @ Matrix.Translation(-HIP_HEAD)
def grip_hand(G, D, E, back=0.0):
    """Wrist and hand orientation for a hand closed on the hilt at G (back: how far down the hilt)."""
    p = G - D * back
    return basis(p - E * 0.075, E, D)
def key_frame(f, P):
    """P: a pose dict in model space. Sets and keys every control bone for frame f."""
    Hd = hips_delta(P['hip'], P['hy'], P['hp'])
    # hips
    pb['hips'].matrix = Hd @ REST['hips']
    # spine twist and lean (local rotations)
    for bn, k in (('spine', 0.4), ('chest', 0.6)):
        pb[bn].rotation_quaternion = Euler((P['lean'] * k, P['cy'] * k, 0)).to_quaternion()
    pb['neck'].rotation_quaternion = Euler((P['hd'] * 0.4, -P['cy'] * 0.3, 0)).to_quaternion()
    pb['head'].rotation_quaternion = Euler((P['hd'] * 0.6, -P['cy'] * 0.3 + P['hturn'], 0)).to_quaternion()
    # saya slides back along its own axis (saya-biki)
    pb['saya'].location = V((0, P['s'], 0))
    # sword: in model space; while sheathed it rides with the hips
    G, D, E = P['G'], P['D'], P['E']
    a = P['attach']
    Gh = Hd @ G; Dh = Hd.to_3x3() @ D; Eh = Hd.to_3x3() @ E
    G = G.lerp(Gh, a); D = D.lerp(Dh, a).normalized(); E = E.lerp(Eh, a).normalized()
    pb['katana'].matrix = basis(G, D, E)
    # right hand: at rest, or on the grip
    pb['ik_hand_R'].matrix = blend_m(REST['ik_hand_R'], grip_hand(G, D, E), P['wR'])
    # left hand: on the saya by the mouth (thumb on the tsuba), or on the hilt behind the right
    mouth = Hd @ (MOUTH + D0 * P['s']); d0 = Hd.to_3x3() @ D0; e0 = Hd.to_3x3() @ E0
    saya_hand = basis(mouth + d0 * 0.05 - e0 * 0.07, e0, d0)
    pb['ik_hand_L'].matrix = blend_m(saya_hand, grip_hand(G, D, E, 0.12), P['wL'])
    for s in 'RL':
        pb[f'ik_foot_{s}'].matrix = Matrix.Translation(P['f' + s]) @ REST[f'ik_foot_{s}']
    for bn in ('hips', 'katana', 'ik_hand_R', 'ik_hand_L', 'ik_foot_R', 'ik_foot_L', 'saya', 'spine', 'chest', 'neck', 'head'):
        if bn != 'saya': pb[bn].keyframe_insert('rotation_quaternion', frame=f)
        pb[bn].keyframe_insert('location', frame=f)

REST_POSE = dict(G=G0, D=D0, E=E0, wR=0.0, wL=0.0, s=0.0, attach=1.0, hip=V((0, 0, 0)), hy=0.0, hp=0.0, lean=0.0, cy=0.0, hd=0.0, hturn=0.0,
                 fR=V((0, 0, 0)), fL=V((0, 0, 0)))
def orient(D, E):
    return basis(V(), D, E).to_quaternion()
def interp(keys, t):
    """keys: [(time, partial pose)]; values carry forward; eased between keys."""
    full = []; cur = dict(REST_POSE)
    for tk, d in keys:
        cur = dict(cur); cur.update(d)
        if 'D' in d and 'E' not in d: cur['E'] = -V((0, 0, 1)).cross(cur['D'])
        full.append((tk, cur))
    if t <= full[0][0]: return full[0][1]
    for (t0, a), (t1, b) in zip(full, full[1:]):
        if t <= t1:
            u = smooth((t - t0) / (t1 - t0)); out = {}
            for k in a:
                if k in ('D', 'E'): continue
                out[k] = a[k] + (b[k] - a[k]) * u if not isinstance(a[k], Vector) else a[k].lerp(b[k], u)
            q = orient(a['D'], a['E']).slerp(orient(b['D'], b['E']), u).to_matrix()
            out['D'] = q.col[1].copy(); out['E'] = q.col[2].copy()
            return out
    return full[-1][1]

def make_action(name, keys, length):
    rig.animation_data_create()
    act = bpy.data.actions.new(name + '_ctrl'); rig.animation_data.action = act
    frames = int(round(length * FPS))
    for f in range(frames + 1):
        key_frame(f + 1, interp(keys, f / FPS))
    return frames + 1

# ------------------------------------------------------------------ clips
def nd(*v): return V(v).normalized()
IDLE = [(0, {})]
def idle_pose(t):
    b = math.sin(t / 4 * 2 * math.pi)
    p = dict(REST_POSE); p.update(hip=V((0, 0, -0.004 * (1 - math.cos(t / 4 * 2 * math.pi)) / 2)), lean=0.012 * b, hd=0.01 * b,
                                  hturn=0.03 * math.sin(t / 4 * 2 * math.pi + 1), wL=0.0, cy=0.015 * b)
    return p

draw = lambda s, out: G0 - D0 * (out - s)             # grip while the blade slides out of a saya pulled back by s
IAI = [
    (0.0, {}),
    (0.45, dict(wR=1.0, hd=0.08)),                                             # right hand to the hilt
    (0.7, dict(G=G0 - D0 * 0.03, hip=V((0, -0.02, -0.02)), hp=0.03)),          # koiguchi: the seal breaks
    (0.85, dict(fR=V((0, -0.16, 0.07)))),
    (1.05, dict(s=0.2, G=draw(0.2, 0.72), hip=V((0, -0.12, -0.07)), hp=0.06, cy=0.35, lean=0.1, fR=V((0, -0.32, 0)))),
    (1.1, dict(attach=0.0)),
    (1.2, dict(G=V((0.05, -0.56, 1.22)), D=nd(1, -0.6, 0.05), cy=0.2)),       # nukitsuke: horizontal cut
    (1.31, dict(G=V((-0.12, -0.6, 1.2)), D=nd(0, -1, 0.03), cy=0.0)),
    (1.45, dict(G=V((-0.38, -0.42, 1.2)), D=nd(-0.85, -0.5, 0.05), cy=-0.32, hy=-0.1, s=0.05)),
    (1.9, dict(s=0.0)),                                                         # zanshin
    (2.25, dict(G=V((-0.02, -0.22, 1.72)), D=nd(0, 0.6, 0.8), E=nd(0, -0.8, 0.6), wL=1.0, cy=0.0, hy=0.0, lean=0.0, hd=-0.05)),  # furikaburi
    (2.4, dict(G=V((-0.02, -0.24, 1.74)))),
    (2.58, dict(G=V((0.0, -0.58, 1.05)), D=nd(0, -0.97, -0.25), E=nd(0, 0.25, -0.97), hip=V((0, -0.16, -0.11)), lean=0.18, hd=0.1)),  # kirioroshi
    (3.1, dict()),
    (3.35, dict(G=V((-0.33, -0.38, 1.06)), D=nd(-0.5, -0.8, -0.35), wL=0.0, lean=0.1, hip=V((0, -0.12, -0.08)))),   # chiburi
    (3.55, dict()),
    (3.95, dict(s=0.15, G=draw(0.15, 0.72), D=D0, E=E0, cy=0.3, attach=0.0)),  # tip to the koiguchi
    (4.0, dict(attach=1.0)),
    (4.9, dict(s=0.0, G=G0, cy=0.05, hip=V((0, -0.08, -0.05)), lean=0.05)),     # nōtō: slide home, slowly
    (5.15, dict(fR=V((0, -0.16, 0.07)), hip=V((0, -0.04, -0.02)))),
    (5.4, dict(fR=V((0, 0, 0)), hip=V((0, 0, 0)), lean=0.0, cy=0.0, hp=0.0, hd=0.0)),
    (5.8, dict(wR=0.0)),
    (6.2, dict()),
]

clips = {}
rig.animation_data_create()
# idle
act = bpy.data.actions.new('idle_ctrl'); rig.animation_data.action = act
n_idle = 4 * FPS
for f in range(n_idle + 1): key_frame(f + 1, idle_pose(f / FPS))
clips['idle'] = (act, n_idle + 1)
act = bpy.data.actions.new('iai_ctrl'); rig.animation_data.action = act
n_iai = int(6.2 * FPS)
for f in range(n_iai + 1): key_frame(f + 1, interp(IAI, f / FPS))
clips['iai'] = (act, n_iai + 1)
print('keyed', flush=True)

# ------------------------------------------------------------------ bake IK into plain bone rotations, one action per clip
bpy.context.view_layer.objects.active = rig; rig.select_set(True); body.select_set(False)
bpy.ops.object.mode_set(mode='POSE')
baked = {}
for name, (act, end) in clips.items():
    rig.animation_data.action = act
    bpy.ops.pose.select_all(action='SELECT')
    bpy.ops.nla.bake(frame_start=1, frame_end=end, only_selected=True, visual_keying=True, clear_constraints=False,
                     use_current_action=False, bake_types={'POSE'})
    b_act = rig.animation_data.action; b_act.name = name; baked[name] = b_act
    print('baked', name, end, flush=True)
bpy.ops.object.mode_set(mode='OBJECT')
for p in rig.pose.bones:
    for c in list(p.constraints): p.constraints.remove(c)
for name, (act, end) in clips.items(): bpy.data.actions.remove(act)
# put every clip on the NLA so the exporter writes each as its own animation
rig.animation_data.action = None
for name, act in baked.items():
    tr = rig.animation_data.nla_tracks.new(); tr.name = name
    st = tr.strips.new(name, 1, act)
    try: st.action_slot = act.slots[0]
    except Exception: pass
    act.use_fake_user = True
bpy.ops.wm.save_as_mainfile(filepath=f'{OUT}/ronin_rigged.blend')
bpy.ops.object.select_all(action='DESELECT'); rig.select_set(True); body.select_set(True)
bpy.ops.export_scene.gltf(filepath=f'{OUT}/ronin_rigged.glb', export_format='GLB', use_selection=True, export_texcoords=False,
                          export_animation_mode='NLA_TRACKS', export_force_sampling=True, export_frame_range=False)
print('exported', flush=True)
