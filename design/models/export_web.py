import bpy
bpy.ops.wm.open_mainfile(filepath='/tmp/blend/out/menpo.blend')
for o in bpy.data.objects:
    for m in o.modifiers:
        if m.type == 'SUBSURF': m.levels = 1
for c in bpy.data.curves: c.bevel_resolution = 0
bpy.ops.object.select_all(action='DESELECT')
for o in bpy.context.scene.objects:
    o.select_set(not o.get('context_only') and o.type in ('MESH', 'CURVE'))
bpy.ops.export_scene.gltf(filepath='/tmp/viewer/menpo.glb', export_format='GLB', use_selection=True, export_apply=True,
    export_normals=True, export_texcoords=False, export_materials='EXPORT')
