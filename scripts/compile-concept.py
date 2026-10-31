import bpy,bmesh,json,sys,struct
from pathlib import Path
from mathutils import Vector
import math
args=sys.argv[sys.argv.index('--')+1:];src=Path(args[0]);out=Path(args[1]);raw=json.loads(src.read_text('utf-8'));bpy.ops.wm.read_factory_settings(use_empty=True)
def obj(part):
    verts=[];faces=[];index={}
    for t in part['triangles']:
        f=[]
        for k in (0,3,6):
            p=tuple(t[k:k+3]);key=tuple(round(x,6) for x in p)
            if key not in index:index[key]=len(verts);verts.append(p)
            f.append(index[key])
        faces.append(f)
    mesh=bpy.data.meshes.new(part['name']);mesh.from_pydata(verts,[],faces);mesh.update();o=bpy.data.objects.new(part['name'],mesh);bpy.context.collection.objects.link(o);return o
shell=obj(next(p for p in raw['parts'] if p['name']=='round-optical-shell'));yoke=obj(next(p for p in raw['parts'] if p['name']=='concept-yoke'))
bpy.context.view_layer.objects.active=shell;shell.select_set(True)
mod=shell.modifiers.new('Real union of shell and support','BOOLEAN');mod.operation='UNION';mod.solver='EXACT';mod.object=yoke;bpy.ops.object.modifier_apply(modifier=mod.name)
bm=bmesh.new();bm.from_mesh(shell.data);bmesh.ops.remove_doubles(bm,verts=list(bm.verts),dist=1e-6);bmesh.ops.recalc_face_normals(bm,faces=list(bm.faces));bmesh.ops.triangulate(bm,faces=list(bm.faces));bm.to_mesh(shell.data);bm.free();shell.data.update();shell.data.calc_loop_triangles()
tris=[[float(v) for i in t.vertices for v in shell.data.vertices[i].co] for t in shell.data.loop_triangles]
out.parent.mkdir(parents=True,exist_ok=True)
with out.open('wb') as f:
    f.write(b'ShadowForge real Blender union, millimetres'.ljust(80,b' '));f.write(struct.pack('<I',len(tris)))
    for t in tris:f.write(struct.pack('<12fH',0,0,0,*t,0))
print('COMPILED_SHELL',json.dumps({'triangles':len(tris),'file':str(out)}))

cap=obj(next(p for p in raw['parts'] if p['name']=='glare-cap'));angle=raw['service']['conceptAnchors'][0]['angle']*math.pi/180;r=(raw['service']['sourceAperture']['radius']+raw['service']['sourceAperture']['outerRadius'])/2;z=raw['service']['diskBack']-2.3
bpy.ops.mesh.primitive_cylinder_add(vertices=32,radius=1.2,depth=6,location=(r*math.cos(angle),r*math.sin(angle),z));port=bpy.context.object;port.rotation_mode='QUATERNION';port.rotation_quaternion=Vector((math.cos(angle),math.sin(angle),0)).to_track_quat('Z','Y')
bpy.context.view_layer.objects.active=cap;cut=cap.modifiers.new('Real insulated wire port','BOOLEAN');cut.operation='DIFFERENCE';cut.solver='EXACT';cut.object=port;bpy.ops.object.modifier_apply(modifier=cut.name)
bm=bmesh.new();bm.from_mesh(cap.data);bmesh.ops.remove_doubles(bm,verts=list(bm.verts),dist=1e-5);bmesh.ops.dissolve_degenerate(bm,dist=1e-5,edges=list(bm.edges));bmesh.ops.recalc_face_normals(bm,faces=list(bm.faces));bmesh.ops.triangulate(bm,faces=list(bm.faces));bm.to_mesh(cap.data);bm.free();cap.data.calc_loop_triangles();tris=[[float(v) for i in t.vertices for v in cap.data.vertices[i].co] for t in cap.data.loop_triangles]
capout=out.with_name('source-cap.stl')
with capout.open('wb') as f:
    f.write(b'ShadowForge source cap with real wire passage'.ljust(80,b' '));f.write(struct.pack('<I',len(tris)))
    for t in tris:f.write(struct.pack('<12fH',0,0,0,*t,0))
print('COMPILED_CAP',json.dumps({'triangles':len(tris),'file':str(capout),'wirePort':{'angle':angle*180/math.pi,'z':z,'diameter':2.4}}))
