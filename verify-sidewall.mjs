import assert from 'node:assert/strict';
import {readFile,writeFile,mkdir} from 'node:fs/promises';
import {makeSidewall,traceSidewall,evaluateSidewall,DEFAULTS} from './dist/sidewall.mjs';
import {rgbaToGray} from './dist/image-input.mjs';
function checkTopology(triangles,name){
 const edges=new Map(),incident=new Map(),graph=triangles.map(()=>[]);let volume=0;
 for(let i=0;i<triangles.length;i++){
  const t=triangles[i];assert(t.length===9&&t.every(Number.isFinite),name+' finite triangle');
  const v=[0,3,6].map(k=>t.slice(k,k+3)),cross=[(t[4]-t[1])*(t[8]-t[2])-(t[5]-t[2])*(t[7]-t[1]),(t[5]-t[2])*(t[6]-t[0])-(t[3]-t[0])*(t[8]-t[2]),(t[3]-t[0])*(t[7]-t[1])-(t[4]-t[1])*(t[6]-t[0])];
  assert(Math.hypot(...cross)>1e-10,name+' nondegenerate triangle');
  volume+=(t[0]*(t[4]*t[8]-t[5]*t[7])+t[1]*(t[5]*t[6]-t[3]*t[8])+t[2]*(t[3]*t[7]-t[4]*t[6]))/6;
  const keys=v.map(a=>a.map(x=>Math.round(x*1e5)).join(','));
  for(let k=0;k<3;k++){const a=keys[k],b=keys[(k+1)%3],e=[a,b].sort().join('|');edges.set(e,(edges.get(e)||0)+1);if(!incident.has(e))incident.set(e,[]);incident.get(e).push(i);}
 }
 const bad=[...edges.values()].filter(n=>n!==2).length;assert.equal(bad,0,name+' manifold edges');
 for(const ids of incident.values()){graph[ids[0]].push(ids[1]);graph[ids[1]].push(ids[0]);}
 const seen=new Set([0]),stack=[0];while(stack.length){for(const n of graph[stack.pop()])if(!seen.has(n)){seen.add(n);stack.push(n);}}
 assert.equal(seen.size,triangles.length,name+' connected');assert(volume>0,name+' outward positive volume');
 return{name,triangles:triangles.length,closed:true,connected:true,outward:true,volumeMM3:volume};
}
function float32Roundtrip(triangles){return triangles.map(t=>t.map(Math.fround));}

const out=new URL('./test-output/sidewall-acceptance/',import.meta.url);await mkdir(out,{recursive:true});
const meta=JSON.parse(await readFile('tests/references/rdr2-hl_6048643.json','utf8')),gray=rgbaToGray(await readFile('tests/references/rdr2-hl_6048643.rgba'),meta.width,meta.height).gray;
const d=makeSidewall(gray,meta.width,meta.height),parts=[];assert.equal(d.panels.length,4);assert.equal(d.parts.length,6);
for(const panel of d.panels){const axis=panel.face%2===0?0:1;for(const t of panel.triangles)for(let k=axis;k<9;k+=3)assert(Math.min(Math.abs(Math.abs(t[k])-d.p.bodySide/2),Math.abs(Math.abs(t[k])-(d.p.bodySide/2-d.p.thickness)))<1e-7,'Panel must lie on one of four side planes');parts.push(checkTopology(panel.triangles,panel.name));}
for(const part of d.parts.slice(4))parts.push(checkTopology(part.triangles,part.name));
console.log('topology',parts);
assert(d.mount.shadowFitsBase);assert(d.mount.socketShadowRadius<d.p.bodySide/2);assert(d.mount.holderShadowRadius<d.p.bodySide/2);assert(d.q.maxZ<d.p.sourceZ);
const sim=traceSidewall(d,320,25),q=evaluateSidewall(d,sim);console.log('baseline',q);assert(q.accepted,JSON.stringify(q));let tp=0,fp=0,fn=0;for(let y=0;y<sim.height;y++)for(let x=0;x<sim.width;x++){const wx=((x+.5)/sim.width-.5)*sim.worldWidth+sim.centerX,wy=(.5-(y+.5)/sim.height)*sim.worldHeight+sim.centerY,ix=Math.floor(wx/d.pitch+d.ref.nx/2),iy=Math.floor(d.ref.ny/2-(wy-d.q.imageY)/d.pitch);if(ix<0||iy<0||ix>=d.ref.nx||iy>=d.ref.ny)continue;const goal=d.ref.raw[iy*d.ref.nx+ix],actual=sim.visibility[y*sim.width+x]<.5;if(actual&&goal)tp++;else if(actual)fp++;else if(goal)fn++;}assert.equal(q.iou,tp/(tp+fp+fn),'Every canonical pixel, including base, contributes to IoU');
const high=traceSidewall(d,320,49),hq=evaluateSidewall(d,high);console.log('49samples',hq);assert(hq.accepted);assert(Math.abs(hq.iou-q.iou)<.02,'Sample convergence');
const rounded={...d,parts:d.parts.map(p=>({...p,triangles:float32Roundtrip(p.triangles)})),socket:float32Roundtrip(d.socket)};rounded.triangles=[...rounded.parts.flatMap(p=>p.triangles),...rounded.socket];const rsim=traceSidewall(rounded,200,13),baseSmall=traceSidewall(d,200,13);let changed=0,maxError=0;for(let i=0;i<rsim.data.length;i++){changed+=+(rsim.visibility[i]!==baseSmall.visibility[i]);maxError=Math.max(maxError,Math.abs(rsim.data[i]-baseSmall.data[i]));}assert.equal(changed,0,'float32 STL roundtrip');
const bare={...d,triangles:d.parts.slice(4).flatMap(p=>p.triangles).concat(d.socket)},bareQ=evaluateSidewall(d,traceSidewall(bare,200,13));assert(!bareQ.accepted&&bareQ.iou<.3,'Removing sidewalls must remove portrait');
const shifted=traceSidewall(d,220,25,[.5,0]),shiftQ=evaluateSidewall(d,shifted);assert(shiftQ.iou>.8,'Half-mm source shift should preserve recognisable image');
const invalid={...sim,data:sim.data.slice()};invalid.data[4]=NaN;assert(!evaluateSidewall(d,invalid).accepted,'NaN must reject');
const black={...sim,data:new Float32Array(sim.data.length),visibility:new Float32Array(sim.visibility.length)};assert(!evaluateSidewall(d,black).accepted,'Black screen must reject');
const clear={...sim,data:sim.incident.slice(),visibility:new Float32Array(sim.visibility.length).fill(1)};assert(!evaluateSidewall(d,clear).accepted,'No shadow must reject');
for(const key of Object.keys(DEFAULTS).filter(k=>typeof DEFAULTS[k]==='number'))for(const value of [NaN,Infinity,'1'])assert.throws(()=>makeSidewall(gray,meta.width,meta.height,{[key]:value}),key+' invalid input');
assert.throws(()=>makeSidewall(gray,meta.width,meta.height,{bodySide:100,sourceZ:220,emitter:5}),'Unsafe socket shadow must reject');
for(const value of [0,1]){const g=new Float32Array(100*100).fill(value),blank=makeSidewall(g,100,100),bq=evaluateSidewall(blank,traceSidewall(blank,96,1));assert(!bq.accepted,'Blank reference must reject');}
const report={passed:true,fullCanonicalTarget:true,physicalValidation:false,settings:d.p,parts,baseline:q,convergence:{samples25:q,samples49:hq,deltaIoU:hq.iou-q.iou},float32:{pixels:rsim.data.length,changedPixels:changed,maxLightError:maxError},withoutSidewalls:bareQ,sourceShift05mm:shiftQ,mount:d.mount,negativeChecks:['NaN simulation','all black simulation','all clear simulation','NaN/Infinity/string settings','unsafe central mount','blank references']};await writeFile(new URL('report.json',out),JSON.stringify(report,null,2));
await writeFile(new URL('wall-shadow.pgm',out),Buffer.concat([Buffer.from(`P5\n${sim.width} ${sim.height}\n255\n`),Buffer.from(Uint8Array.from(sim.visibility,x=>Math.round(x*255)))]));console.log('Sidewall acceptance passed');
