import assert from 'node:assert/strict';
import {writeFileSync,mkdirSync} from 'node:fs';
import {CONFIG as c,makeModel,project,renderFrame,stl,assembly,sub,cross,dot,light,triangleHit,blocked} from './dist/ring/core.mjs';
import {OPENING,flowerTarget} from './dist/ring/flower.mjs';
const model=makeModel(c,'flower'),size=160,span=240,report={name:'Opening flower / independent optical checks',physicalValidation:false,mountsIncluded:false,artisticDepthValidated:false,sourceDiameterMm:.15,sourceSamples:7,frames:[],checks:[]};
function inside(x,y,poly){let odd=false;for(let i=0,j=poly.length-1;i<poly.length;j=i++){const a=poly[i],b=poly[j];if((a[1]>y)!==(b[1]>y)&&x<(b[0]-a[0])*(y-a[1])/(b[1]-a[1])+a[0])odd=!odd;}return odd;}
function orient(a,b,c){return(b[0]-a[0])*(c[1]-a[1])-(b[1]-a[1])*(c[0]-a[0]);}
function meshCheck(m){
 const edges=new Map(),key=p=>p.map(v=>v.toFixed(7)).join(',');let volume=0;
 for(const [a,b,d] of m.triangles){assert.ok(Math.hypot(...cross(sub(b,a),sub(d,a)))>1e-9);volume+=dot(a,cross(b,d))/6;for(const [u,v] of[[a,b],[b,d],[d,a]]){const ku=key(u),kv=key(v),k=[ku,kv].sort().join('|'),row=edges.get(k)||[0,0];row[0]++;row[1]+=ku<kv?1:-1;edges.set(k,row);}}
 assert.ok([...edges.values()].every(([count,balance])=>count===2&&balance===0),'closed oriented manifold mesh');assert.ok(volume>0);return volume;
}
for(let i=0;i<12;i++){
 const m=model.masks[i],n=m.target.length,volume=meshCheck(m);
 for(const contour of [m.outer,...m.holes])for(let a=0;a<contour.length;a++)for(let b=a+2;b<contour.length;b++){if(a===0&&b===contour.length-1)continue;const p=contour[a],q=contour[(a+1)%contour.length],r=contour[b],s=contour[(b+1)%contour.length];assert.ok(!(orient(p,q,r)*orient(p,q,s)<-1e-10&&orient(r,s,p)*orient(r,s,q)<-1e-10),'simple non-intersecting silhouette at frame '+i);}
 for(let k=0;k<2*n;k++){const p=project(m.vertices[k],m.source),g=m.target[k%n];assert.ok(Math.hypot(p[0]-g[0],p[1]-g[1])<1e-8);}
 for(const tri of m.triangles)for(let a=0;a<=4;a++)for(let b=0;b<=4-a;b++){const p=[0,1,2].map(k=>tri[0][k]*a/4+tri[1][k]*b/4+tri[2][k]*(1-(a+b)/4)),r=Math.hypot(p[0],p[1]);assert.ok(r>140&&r<198,'fits in annulus');}
 const point=renderFrame(model,i,{size,span,diameter:0,mounts:false}),removed=renderFrame(model,i,{size:80,span,diameter:0,mounts:false,ignoreMask:i}),real=renderFrame(model,i,{size,span,diameter:.15,mounts:false});
 let idealWrong=0,intersection=0,union=0,foreign=0,soft=0;
 for(let y=0;y<size;y++)for(let x=0;x<size;x++){const px=(x+.5-size/2)*span/size,py=(size/2-y-.5)*span/size,k=y*size+x;if(Math.hypot(px,py)>110)continue;const want=inside(px,py,m.outer)&&!m.holes.some(h=>inside(px,py,h)),actual=point.visibility[k]<.5,finite=real.visibility[k]<.5;if(want!==actual)idealWrong++;if(want&&finite)intersection++;if(want||finite)union++;if(real.visibility[k]>.001&&real.visibility[k]<.999)soft++;}
 for(let y=0;y<80;y++)for(let x=0;x<80;x++)if(Math.hypot((x+.5-40)*span/80,(40-y-.5)*span/80)<110&&removed.visibility[y*80+x]<.999)foreign++;
 assert.equal(idealWrong,0,'ray mesh matches independent point-in-polygon at frame '+i);assert.equal(foreign,0,'other masks must not obstruct center');
 for(let j=0;j<20;j++){const p=[(j%5-2)*21,(Math.floor(j/5)-1.5)*25,0],o=light(i),d=sub(p,o);const brute=model.masks.some(mask=>mask.triangles.some(t=>triangleHit(o,d,t)));assert.equal(blocked(o,p,model,{mounts:false,ignoreHousing:true}),brute,'BVH equals brute-force ray test');}
 report.frames.push({frame:i+1,opening:OPENING[i],idealWrongPixels:idealWrong,foreignShadowPixels:foreign,finiteSourceIou:intersection/union,partialPixels:soft,volumeMm3:volume,triangles:m.triangles.length,dimensionsMm:m.bounds.max.map((v,k)=>v-m.bounds.min[k])});
}
assert.deepEqual(flowerTarget(0),flowerTarget(11),'closed endpoint poses match');
assert.deepEqual(flowerTarget(5),flowerTarget(6),'open hold poses match');
for(let i=0;i<12;i++)assert.deepEqual(flowerTarget(i),flowerTarget(11-i),'opening and closing share pose geometry');
report.checks=['12 simple outer contours with two light apertures','12 closed consistently oriented positive-volume solids','All optical solids fit beneath ring annulus','All ideal ray silhouettes match independent polygon fill','Removal test detects no foreign obstruction within radius 110 mm','BVH ray tests match brute-force triangle intersection','Closed loop and open/closed hold poses'];
report.pixelScope={size,spanMm:span,radiusMm:110};
report.finiteIouRange=[Math.min(...report.frames.map(f=>f.finiteSourceIou)),Math.max(...report.frames.map(f=>f.finiteSourceIou))];
if(process.argv.includes('--write')){
 mkdirSync('dist/ring/flower/print',{recursive:true});mkdirSync('dist/ring/flower/cache',{recursive:true});
 for(const m of model.masks)writeFileSync('dist/ring/flower/print/frame-'+String(m.index+1).padStart(2,'0')+'.stl',stl(m));
 const a=assembly(model);a.masks.forEach(m=>m.printFile=m.printFile.replace('flower/',''));writeFileSync('dist/ring/flower/assembly.json',JSON.stringify(a,null,2)+'\n');
 writeFileSync('dist/ring/flower/verification.json',JSON.stringify(report,null,2)+'\n');
 for(let i=0;i<12;i++){const field=renderFrame(model,i,{size:256,span:440,diameter:.15,mounts:false}),buf=Buffer.alloc(2*256*256*4);for(let k=0;k<256*256;k++){buf.writeFloatLE(field.irradiance[k],k*4);buf.writeFloatLE(field.visibility[k],(k+256*256)*4);}writeFileSync('dist/ring/flower/cache/frame-'+String(i+1).padStart(2,'0')+'.f32',buf);}
}
console.log(JSON.stringify({frames:report.frames.length,idealWrongPixels:report.frames.reduce((s,f)=>s+f.idealWrongPixels,0),finiteIouRange:report.finiteIouRange,triangles:report.frames[0].triangles,checks:report.checks},null,2));
