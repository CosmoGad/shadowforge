import assert from 'node:assert/strict';
import {readFile,writeFile,mkdir} from 'node:fs/promises';
import {makeDesign,maskMesh,housingMesh,backMesh,rayPasses,simulate,compare,stlBuffer,zipStore} from './dist/core.mjs';
const output=new URL('./test-output/',import.meta.url);await mkdir(output,{recursive:true});
function inspect(tris,name){
  const edges=new Map(),points=new Set();let volume=0;
  const key=v=>v.map(x=>x.toFixed(5)).join(',');
  for(const t of tris){const a=t.slice(0,3),b=t.slice(3,6),c=t.slice(6,9);for(const v of[a,b,c]){assert(v.every(Number.isFinite));points.add(key(v));}
    const cross=[(b[1]-a[1])*(c[2]-a[2])-(b[2]-a[2])*(c[1]-a[1]),(b[2]-a[2])*(c[0]-a[0])-(b[0]-a[0])*(c[2]-a[2]),(b[0]-a[0])*(c[1]-a[1])-(b[1]-a[1])*(c[0]-a[0])];assert(Math.hypot(...cross)>1e-9,'degenerate triangle');
    volume+=(a[0]*(b[1]*c[2]-b[2]*c[1])+a[1]*(b[2]*c[0]-b[0]*c[2])+a[2]*(b[0]*c[1]-b[1]*c[0]))/6;
    for(const [v,w] of[[a,b],[b,c],[c,a]]){const vk=key(v),wk=key(w),ek=[vk,wk].sort().join('|'),sign=vk<wk?1:-1;const old=edges.get(ek)||{count:0,balance:0};old.count++;old.balance+=sign;edges.set(ek,old);}
  }
  const invalid=[...edges.values()].filter(e=>e.count!==2||e.balance!==0);assert.equal(invalid.length,0,name+': watertight, consistently wound edges');assert(volume>0,name+': outward normals');return{name,triangles:tris.length,vertices:points.size,edges:edges.size,volumeMM3:+volume.toFixed(3),watertight:true};
}
function rayTriangle(o,dir,t){
  const a=t.slice(0,3),b=t.slice(3,6),c=t.slice(6,9),sub=(v,w)=>v.map((x,i)=>x-w[i]),cross=(v,w)=>[v[1]*w[2]-v[2]*w[1],v[2]*w[0]-v[0]*w[2],v[0]*w[1]-v[1]*w[0]],dot=(v,w)=>v.reduce((s,x,i)=>s+x*w[i],0);
  const e1=sub(b,a),e2=sub(c,a),h=cross(dir,e2),det=dot(e1,h);if(Math.abs(det)<1e-8)return false;const s=sub(o,a),u=dot(s,h)/det;if(u<0||u>1)return false;const q=cross(s,e1),v=dot(dir,q)/det;if(v<0||u+v>1)return false;const distance=dot(e2,q)/det;return distance>0&&distance<1;
}
const basic=makeDesign(new Float32Array([0,1,1,0]),2,2,{columns:24,width:60,contrast:1,gamma:1});
assert.equal(basic.count,24*24/2);assert.equal(basic.magnification,5);assert.throws(()=>makeDesign(new Float32Array([1]),1,1,{width:40,columns:100}));
const reports=[];for(const [name,fn]of[['mask',maskMesh],['housing',housingMesh],['back',backMesh]])reports.push(inspect(fn(basic),name));
const h=basic.holes.find(h=>h.size);assert(rayPasses(basic,h.x*5,h.y*5,0,0));const black=basic.holes.find(h=>!h.size);assert(!rayPasses(basic,black.x*5,black.y*5,0,0));
const mesh=maskMesh(basic);let state=281;const random=()=>{state=(state*1664525+1013904223)>>>0;return state/2**32;};
for(let i=0;i<180;i++){const sx=(random()-.5)*10,sy=(random()-.5)*10,wx=(random()-.5)*basic.p.width*5,wy=(random()-.5)*basic.height*5;const o=[sx,sy,0],dir=[wx-sx,wy-sy,500];const hit=mesh.some(t=>rayTriangle(o,dir,t));assert.equal(rayPasses(basic,wx,wy,sx,sy),!hit,'analytic channel must match triangle mesh');}
const point=simulate(makeDesign(new Float32Array([1]),1,1,{width:60,columns:24,emitter:0,contrast:1,gamma:1}),96,1);assert.equal(point.samples,1);assert.equal(point.blur,0);assert(point.mean>0);
const shifted=simulate(makeDesign(new Float32Array([1]),1,1,{width:60,columns:24,sourceX:10,emitter:0,contrast:1,gamma:1}),96,1);assert(point.data.some((v,i)=>v!==shifted.data[i]));
const pixels=await readFile(new URL('./tests/batman.gray',import.meta.url));
const source={width:306,height:418,gray:Float32Array.from(pixels,x=>x/255)};
const d=makeDesign(new Float32Array(source.gray),source.width,source.height),batman=simulate(d,384,81),quality=compare(d,batman);assert(d.count>1000);assert(quality.rmse<.2);assert(batman.data.every(x=>x>=0&&x<=1));
const fullMask=maskMesh(d);reports.push(inspect(fullMask,'batman-mask'));
const stl=stlBuffer(fullMask);assert.equal(new DataView(stl).getUint32(80,true),fullMask.length);assert.equal(stl.byteLength,84+fullMask.length*50);
const zip=zipStore([['mask.stl',stl],['hello.txt','Привет']]);await writeFile(new URL('test.zip',output),new Uint8Array(await zip.arrayBuffer()));
const report={passed:true,triangleRayComparisons:180,models:reports,batman:{holes:d.count,grid:[d.nx,d.ny],rmse:quality.rmse,blur:batman.blur,sourceSamples:batman.samples},limitations:'Geometric simulation only; no physical or thermal validation.'};
await writeFile(new URL('verification.json',output),JSON.stringify(report,null,2));console.log(JSON.stringify(report,null,2));
