import assert from 'node:assert/strict';
import {writeFileSync,mkdirSync} from 'node:fs';
import {CONFIG as c,makeModel,target,light,project,renderFrame,blocked,stl,assembly,sub,cross,dot} from './dist/ring/core.mjs';
const model=makeModel(),size=144,span=240,report={kind:'independent geometric and ray-intersection verification',physicalValidation:false,frames:[],checks:[],resolution:{size,spanMm:span}};
function isInside(x,y,verts){let sign=0;for(let i=0;i<3;i++){const a=verts[i],b=verts[(i+1)%3],s=(b[0]-a[0])*(y-a[1])-(b[1]-a[1])*(x-a[0]);if(Math.abs(s)<1e-8)continue;const t=Math.sign(s);if(sign&&sign!==t)return false;sign=t;}return true;}
function topology(mask){
 const edges=new Map();let volume=0;
 const key=p=>p.map(x=>x.toFixed(7)).join(',');
 for(const [a,b,d] of mask.triangles){volume+=dot(a,cross(b,d))/6;for(const [p,q] of[[a,b],[b,d],[d,a]]){const ak=key(p),bk=key(q),k=[ak,bk].sort().join('|');const row=edges.get(k)||{count:0,balance:0};row.count++;row.balance+=ak<bk?1:-1;edges.set(k,row);}}
 assert.ok([...edges.values()].every(x=>x.count===2&&x.balance===0),'closed consistently oriented mesh');
 assert.ok(volume>0,'positive volume');return volume;
}
for(let i=0;i<c.frames;i++){
 const m=model.masks[i],s=light(i),volume=topology(m);
 for(let k=0;k<6;k++){const p=project(m.vertices[k],s),t=m.target[k%3];assert.ok(Math.hypot(p[0]-t[0],p[1]-t[1])<1e-8);}
 for(const tri of m.triangles)for(let a=0;a<=5;a++)for(let b=0;b<=5-a;b++){const p=[0,1,2].map(k=>tri[0][k]*a/5+tri[1][k]*b/5+tri[2][k]*(1-(a+b)/5));assert.ok(Math.hypot(p[0],p[1])>=c.innerRadius-.001&&Math.hypot(p[0],p[1])<198);}
 const field=renderFrame(model,i,{size,span,diameter:0,mounts:false}),removed=renderFrame(model,i,{size,span,diameter:0,mounts:false,ignoreMask:i});
 let intersection=0,union=0,errors=0,foreignShadow=0,goalPixels=0;
 for(let y=0;y<size;y++)for(let x=0;x<size;x++){const px=(x+.5-size/2)*span/size,py=(size/2-y-.5)*span/size,k=y*size+x;if(Math.hypot(px,py)>110)continue;const expected=isInside(px,py,m.target),actual=field.visibility[k]<.5;if(expected)goalPixels++;if(expected&&actual)intersection++;if(expected||actual)union++;if(expected!==actual)errors++;if(removed.visibility[k]<.999)foreignShadow++;}
 assert.equal(errors,0,'point-source silhouette matches independently tested triangle for frame '+i);assert.equal(foreignShadow,0,'other figures or housing must not block central test area');
 report.frames.push({frame:i+1,idealIou:intersection/union,wrongPixels:errors,foreignShadowPixels:foreignShadow,targetPixels:goalPixels,volumeMm3:volume,dimensionsMm:m.bounds.max.map((v,k)=>v-m.bounds.min[k])});
 assert.ok(stl(m).startsWith('solid ring_frame_'),'STL export');
}
report.checks.push('12 closed, oriented positive-volume meshes; all fit under annulus','Exact projected vertices and independently rasterized triangle silhouettes','Remove each active figure: no shadow from the other 11 figures or housing within radius 110 mm');
const small=renderFrame(model,0,{size:240,span:240,diameter:.15,mounts:false}),large=renderFrame(model,0,{size:240,span:240,diameter:1,mounts:false});
const partial=f=>Array.from(f.visibility).filter(v=>v>.001&&v<.999).length;
assert.ok(partial(small)>0);assert.ok(partial(large)>partial(small));
report.finiteSource={smallDiameterMm:.15,largeDiameterMm:1,smallPartialPixels:partial(small),largePartialPixels:partial(large),sourceSamples:7};
const noMount=renderFrame(model,0,{size:360,span:300,diameter:0,mounts:false}),withMount=renderFrame(model,0,{size:360,span:300,diameter:0,mounts:true});
let extra=0;for(let k=0;k<noMount.visibility.length;k++)if(noMount.visibility[k]>.5&&withMount.visibility[k]<.5)extra++;
assert.ok(extra>0,'supports must cast additional shadows');
report.supports={diameterMm:.15,extraShadowPixels:extra,testSize:360,testSpanMm:300};
assert.equal(blocked(light(0),[0,0,0],model,{mounts:false}),true);
const rotated=target(12),first=target(0);assert.ok(rotated.every(p=>first.some(q=>Math.hypot(p[0]-q[0],p[1]-q[1])<1e-8)),'triangle sequence loops without shape jump');
report.sensitivity={sourceLateralShiftMm:.1,maxApproxWallShiftMm:.9,sourceDepthShiftMm:.1,centerRayApproxWallShiftMm:4.1625,description:'Local derivative at z=36 mm; fixed blocker; not an assembly tolerance qualification.'};
report.checks.push('Finite tilted emitter disk produces more partial shadow pixels as diameter increases','Opaque wire supports produce additional obstruction; excluded only by explicit comparison control','120 degree triangle symmetry gives continuous pose sequence at wrap');
if(process.argv.includes('--write')){
 mkdirSync('./dist/ring/print',{recursive:true});writeFileSync('./dist/ring/verification.json',JSON.stringify(report,null,2)+'\n');
 writeFileSync('./dist/ring/assembly.json',JSON.stringify(assembly(model),null,2)+'\n');
 for(const m of model.masks)writeFileSync('./dist/ring/print/frame-'+String(m.index+1).padStart(2,'0')+'.stl',stl(m));
}
console.log(JSON.stringify(report,null,2));
