"""Shared Blender helpers for JG RoveaRange aircraft models.

Axes: Blender +Y is the nose, +X the right wing, +Z up. The glTF exporter turns this into three.js
x right, y up, nose toward -z, which is the game's body frame.
Moving parts are empty-free mesh objects whose origin sits on the hinge line with identity rotation, so the game
can rotate them about local x (ailerons, elevator) or local y (rudder, steering) exactly like the procedural model.
Paint materials are named paint_primary / paint_secondary / paint_accent so the hangar can recolour them.
"""
import bpy, bmesh, math
from mathutils import Vector, Matrix

CY_U = [(0, 0), (0.0125, 0.0315), (0.025, 0.042), (0.05, 0.056), (0.1, 0.073), (0.2, 0.0915), (0.3, 0.0965), (0.4, 0.095), (0.5, 0.087), (0.6, 0.075), (0.7, 0.06), (0.8, 0.0425), (0.9, 0.023), (1, 0.0012)]
CY_L = [(0, 0), (0.0125, -0.012), (0.025, -0.017), (0.05, -0.0205), (0.1, -0.022), (0.2, -0.02), (0.3, -0.017), (0.5, -0.011), (0.7, -0.006), (0.9, -0.002), (1, 0)]
SYM_U = [(0, 0), (0.0125, 0.0126), (0.025, 0.0174), (0.05, 0.0237), (0.1, 0.0312), (0.2, 0.0384), (0.3, 0.04), (0.4, 0.0387), (0.5, 0.0353), (0.6, 0.0306), (0.7, 0.0247), (0.8, 0.0177), (0.9, 0.0097), (1, 0.0008)]
SYM_L = [(x, -y) for x, y in SYM_U]


def reset():
    bpy.ops.wm.read_factory_settings(use_empty=True)


def lerp_tab(tab, x):
    for i in range(1, len(tab)):
        if x <= tab[i][0]:
            x0, y0 = tab[i - 1]; x1, y1 = tab[i]
            return y0 + (y1 - y0) * (x - x0) / (x1 - x0)
    return tab[-1][1]


def mat(name, color, rough=0.5, metal=0.0, alpha=1.0, clearcoat=0.0):
    m = bpy.data.materials.get(name) or bpy.data.materials.new(name)
    m.use_nodes = True
    b = m.node_tree.nodes.get('Principled BSDF')
    b.inputs['Base Color'].default_value = (*color, 1)
    b.inputs['Roughness'].default_value = rough
    b.inputs['Metallic'].default_value = metal
    if 'Coat Weight' in b.inputs:
        b.inputs['Coat Weight'].default_value = clearcoat
    if alpha < 1:
        b.inputs['Alpha'].default_value = alpha
        m.blend_method = 'BLEND' if hasattr(m, 'blend_method') else None
    return m


def srgb(hexstr):
    h = hexstr.lstrip('#')
    c = [int(h[i:i + 2], 16) / 255 for i in (0, 2, 4)]
    return tuple(((v + 0.055) / 1.055) ** 2.4 if v > 0.04045 else v / 12.92 for v in c)


def obj_from_bm(name, bm, material=None, smooth=True, origin=(0, 0, 0), parent=None):
    me = bpy.data.meshes.new(name)
    bm.to_mesh(me); bm.free()
    if smooth:
        for p in me.polygons:
            p.use_smooth = True
    o = bpy.data.objects.new(name, me)
    bpy.context.collection.objects.link(o)
    if material:
        me.materials.append(material)
    if origin != (0, 0, 0):
        me.transform(Matrix.Translation(-Vector(origin)))
        o.location = Vector(origin)
    if parent:
        o.parent = parent
        o.location = o.location - parent.matrix_world.translation if parent else o.location
    return o


def superellipse_loft(name, sections, n=3.2, seg=32, material=None, cap=True):
    """sections: list of (y, width, height, zc). Rounded-box cross sections lofted along Y."""
    bm = bmesh.new()
    rings = []
    for (y, w, h, zc) in sections:
        ring = []
        for k in range(seg):
            t = k / seg * 2 * math.pi
            c, s = math.cos(t), math.sin(t)
            x = math.copysign(abs(c) ** (2 / n), c) * w / 2
            z = zc + math.copysign(abs(s) ** (2 / n), s) * h / 2
            ring.append(bm.verts.new((x, y, z)))
        rings.append(ring)
    for a, b in zip(rings, rings[1:]):
        for k in range(seg):
            bm.faces.new((a[k], a[(k + 1) % seg], b[(k + 1) % seg], b[k]))
    if cap:
        for ring, rev in ((rings[0], True), (rings[-1], False)):
            c = sum((v.co for v in ring), Vector()) / len(ring)
            cv = bm.verts.new(c)
            for k in range(seg):
                f = (ring[k], ring[(k + 1) % seg], cv)
                bm.faces.new(f if not rev else f[::-1])
    bmesh.ops.recalc_face_normals(bm, faces=bm.faces)
    return obj_from_bm(name, bm, material)


def wing_panel(name, stations, x0, x1, upper=CY_U, lower=CY_L, npts=24, material=None, origin=(0, 0, 0)):
    """Lofted airfoil panel. stations: function(x) -> (le_y, chord, z, twist) for spanwise x.
    x0..x1 spanwise (sign gives side). Chord runs from le_y toward -Y (aft)."""
    xs = [x0 + (x1 - x0) * i / 12 for i in range(13)]
    fr = [0.5 - 0.5 * math.cos(math.pi * i / (npts - 1)) for i in range(npts)]
    prof = [(f, lerp_tab(upper, f)) for f in fr] + [(f, lerp_tab(lower, f)) for f in reversed(fr[1:-1])]
    bm = bmesh.new()
    rings = []
    for x in xs:
        le, c, z, tw = stations(x)
        ring = []
        for (f, t) in prof:
            yy = le - f * c
            zz = z + t * c
            # twist about the quarter chord
            dy, dz = yy - (le - 0.25 * c), zz - z
            ca, sa = math.cos(tw), math.sin(tw)
            ring.append(bm.verts.new((x, (le - 0.25 * c) + dy * ca - dz * sa, z + dy * sa + dz * ca)))
        rings.append(ring)
    m = len(prof)
    for a, b in zip(rings, rings[1:]):
        for k in range(m):
            f = (a[k], a[(k + 1) % m], b[(k + 1) % m], b[k])
            bm.faces.new(f if x1 > x0 else f[::-1])
    for ring, flip in ((rings[0], x1 > x0), (rings[-1], x1 <= x0)):
        f = bm.faces.new(ring if flip else ring[::-1])
    bmesh.ops.recalc_face_normals(bm, faces=bm.faces)
    return obj_from_bm(name, bm, material, origin=origin)


def outline_plate(name, pts, thick, plane='XY', material=None, bevel=0.6, origin=(0, 0, 0)):
    """Flat plate from a 2D outline (list of (u,v)), extruded by thick, edges rounded.
    plane 'XY': u->X, v->Y, thickness on Z (stabiliser). plane 'YZ': u->Y, v->Z, thickness on X (fin)."""
    bm = bmesh.new()
    vs = []
    for (u, v) in pts:
        if plane == 'XY':
            vs.append(bm.verts.new((u, v, -thick / 2)))
        else:
            vs.append(bm.verts.new((-thick / 2, u, v)))
    f = bm.faces.new(vs)
    ext = bmesh.ops.extrude_face_region(bm, geom=[f])
    vec = Vector((0, 0, thick)) if plane == 'XY' else Vector((thick, 0, 0))
    bmesh.ops.translate(bm, vec=vec, verts=[e for e in ext['geom'] if isinstance(e, bmesh.types.BMVert)])
    bmesh.ops.recalc_face_normals(bm, faces=bm.faces)
    edges = [e for e in bm.edges if not e.is_boundary]
    bmesh.ops.bevel(bm, geom=[e for e in bm.edges], offset=thick * 0.45 * bevel, segments=2, affect='EDGES', clamp_overlap=True)
    return obj_from_bm(name, bm, material, smooth=False, origin=origin)


def rounded_outline(pts, r=0.01, seg=4):
    """smooth a polygon's corners with small arcs (Chaikin-style subdivision)"""
    out = pts
    for _ in range(seg):
        nxt = []
        n = len(out)
        for i in range(n):
            a = Vector(out[i]); b = Vector(out[(i + 1) % n])
            nxt.append(tuple(a * 0.75 + b * 0.25)); nxt.append(tuple(a * 0.25 + b * 0.75))
        out = nxt
    return out


def tube(name, a, b, r, material=None, seg=10):
    a, b = Vector(a), Vector(b)
    d = b - a
    bpy.ops.mesh.primitive_cylinder_add(vertices=seg, radius=r, depth=d.length, location=(a + b) / 2)
    o = bpy.context.active_object
    o.name = name
    o.rotation_mode = 'QUATERNION'
    o.rotation_quaternion = Vector((0, 0, 1)).rotation_difference(d.normalized())
    if material:
        o.data.materials.append(material)
    bpy.ops.object.shade_smooth()
    return o


def wheel(name, center, r, width, tyre_mat, hub_mat):
    bpy.ops.mesh.primitive_torus_add(major_radius=r - width * 0.42, minor_radius=width * 0.5, major_segments=32, minor_segments=12, location=center, rotation=(0, math.pi / 2, 0))
    t = bpy.context.active_object; t.name = name + '_tyre'; t.data.materials.append(tyre_mat); bpy.ops.object.shade_smooth()
    bpy.ops.mesh.primitive_cylinder_add(vertices=20, radius=r * 0.55, depth=width * 0.75, location=center, rotation=(0, math.pi / 2, 0))
    h = bpy.context.active_object; h.name = name + '_hub'; h.data.materials.append(hub_mat); bpy.ops.object.shade_smooth()
    return t, h


def join(objs, name):
    bpy.ops.object.select_all(action='DESELECT')
    for o in objs:
        o.select_set(True)
    bpy.context.view_layer.objects.active = objs[0]
    bpy.ops.object.join()
    o = bpy.context.active_object
    o.name = name
    return o


def apply_all():
    for o in bpy.context.scene.objects:
        if o.type == 'MESH':
            bpy.context.view_layer.objects.active = o
            for m in o.modifiers:
                bpy.ops.object.modifier_apply(modifier=m.name)


def set_parent_keep(child, parent):
    mw = child.matrix_world.copy()
    child.parent = parent
    child.matrix_world = mw


def export_glb(path):
    bpy.ops.export_scene.gltf(filepath=path, export_format='GLB', export_yup=True, export_apply=True, use_selection=False,
                              export_materials='EXPORT', export_image_format='AUTO', export_draco_mesh_compression_enable=False)


def studio_render(path, target=(0, 0, 0), dist=1.4, elev=0.32, azim=-0.65, size=(1280, 720), samples=48):
    """quick product render: three-point light, soft floor, Cycles on CPU"""
    sc = bpy.context.scene
    sc.render.engine = 'CYCLES'
    sc.cycles.samples = samples
    sc.cycles.device = 'CPU'
    sc.render.resolution_x, sc.render.resolution_y = size
    sc.render.film_transparent = False
    world = bpy.data.worlds.new('w'); sc.world = world; world.use_nodes = True
    world.node_tree.nodes['Background'].inputs['Color'].default_value = (0.58, 0.64, 0.7, 1)
    world.node_tree.nodes['Background'].inputs['Strength'].default_value = 0.6
    bpy.ops.mesh.primitive_plane_add(size=20, location=(0, 0, -0.13))
    fl = bpy.context.active_object; fl.name = 'floor'; fl.data.materials.append(mat('floor', (0.42, 0.44, 0.46), 0.9))
    for (loc, en, sz) in (((2, -2, 3), 900, 3), ((-3, 1, 2), 350, 4), ((0, 3, 1), 250, 3)):
        bpy.ops.object.light_add(type='AREA', location=loc); L = bpy.context.active_object; L.data.energy = en; L.data.size = sz
        L.rotation_euler = (Vector(target) - Vector(loc)).to_track_quat('-Z', 'Y').to_euler()
    t = Vector(target)
    cam_loc = t + Vector((math.cos(azim) * math.cos(elev), math.sin(azim) * math.cos(elev), math.sin(elev))) * dist
    bpy.ops.object.camera_add(location=cam_loc)
    cam = bpy.context.active_object; cam.data.lens = 50
    cam.rotation_euler = (t - cam_loc).to_track_quat('-Z', 'Y').to_euler()
    sc.camera = cam
    sc.render.filepath = path
    bpy.ops.render.render(write_still=True)
