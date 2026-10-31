// Geometry-only verification; accepts an assembly reconstructed from browser STL.
import fs from 'node:fs';
import assert from 'node:assert/strict';
import {fileURLToPath} from 'node:url';
import {buildBVH,occluded,circle,extrude} from './dist/projector-mesh.mjs';

const input=process.argv[2]||fileURLToPath(new URL('assembly.json',import.meta.url));
const output=process.argv[3]||fileURLToPath(new URL('clip-path-validation.json',import.meta.url));
const a=JSON.parse(fs.readFileSync(input,'utf8'));
const shell=a.parts.find(p=>p.name==='round-optical-shell');
assert(shell,'round optical shell required');
const R=a.bodySide/2,S=a.sourceZ;
assert(Number.isFinite(R)&&Number.isFinite(S));
const dirs=[[1,0],[0,1],[-1,0],[0,-1]],clips=a.parts.filter(p=>/^panel-clip-[1-4]$/.test(p.name));
assert.equal(clips.length,4);
const vertices=t=>[t.slice(0,3),t.slice(3,6),t.slice(6,9)];
const sub=(a,b)=>a.map((v,k)=>v-b[k]);
const cross=(a,b)=>[a[1]*b[2]-a[2]*b[1],a[2]*b[0]-a[0]*b[2],a[0]*b[1]-a[1]*b[0]];
const dot=(a,b)=>a[0]*b[0]+a[1]*b[1]+a[2]*b[2];
const bounds=vs=>({min:[0,1,2].map(k=>Math.min(...vs.map(p=>p[k]))),max:[0,1,2].map(k=>Math.max(...vs.map(p=>p[k])))});
const overlaps=(x,y)=>[0,1,2].every(k=>x.max[k]>=y.min[k]-1e-7&&y.max[k]>=x.min[k]-1e-7);
const shellBVH=buildBVH(shell.triangles);
const candidates=(bvh,box)=>{const out=[],stack=[bvh.root];while(stack.length){const n=stack.pop();if(!overlaps(n,box))continue;if(n.ids)out.push(...n.ids);else stack.push(n.left,n.right);}return out;};

// SAT for the convex hull of a translated triangle (a swept triangular prism)
// against a static triangle. Additional in-plane axes cover degenerate prisms.
function sweptTriangleHit(start,delta,tri){
 const end=start.map(p=>p.map((v,k)=>v+delta[k])),prism=[...start,...end],b=vertices(tri);
 if(!overlaps(bounds(prism),bounds(b)))return false;
 const ea=[sub(start[1],start[0]),sub(start[2],start[1]),sub(start[0],start[2])];
 const eb=[sub(b[1],b[0]),sub(b[2],b[1]),sub(b[0],b[2])];
 const na=cross(ea[0],ea[1]),nb=cross(eb[0],eb[1]);
 const axes=[na,nb,...ea.map(e=>cross(e,delta)),...ea.map(e=>cross(na,e)),cross(na,delta),...eb.map(e=>cross(nb,e))];
 for(const e of [...ea,delta])for(const f of eb)axes.push(cross(e,f));
 for(const axis of axes){const length=Math.hypot(...axis);if(length<1e-12)continue;const n=axis.map(v=>v/length),pa=prism.map(p=>dot(n,p)),pb=b.map(p=>dot(n,p));if(Math.max(...pa)<Math.min(...pb)-1e-7||Math.max(...pb)<Math.min(...pa)-1e-7)return false;}
 return true;
}
function continuousSweepHits(moving,bvh,staticTris,shift,delta){let hits=0,pairsTested=0;for(const t of moving){const start=vertices(t).map(p=>p.map((v,k)=>v+shift[k])),box=bounds([...start,...start.map(p=>p.map((v,k)=>v+delta[k]))]);for(const id of candidates(bvh,box)){pairsTested++;if(sweptTriangleHit(start,delta,staticTris[id]))hits++;}}return{hits,pairsTested};}
function sampledEdgeHits(moving,bvh,shift){let hits=0;for(const t of moving){const vs=vertices(t).map(p=>p.map((v,k)=>v+shift[k]));for(let j=0;j<3;j++){const p=vs[j],q=vs[(j+1)%3];hits+=+occluded(bvh,p,sub(q,p));}}return hits;}

const clipChecks=[];
for(const clip of clips){
 const dir=dirs[Number(clip.name.at(-1))-1],shift=[-15*dir[0],-15*dir[1],0],delta=shift.map(v=>-v);
 const samples=[];for(let i=0;i<=60;i++){const dn=-15+i*.25;const hits=sampledEdgeHits(clip.triangles,shellBVH,[dn*dir[0],dn*dir[1],0]);samples.push({radialOffsetMM:dn,edgeCrossings:hits});}
 const sweep=continuousSweepHits(clip.triangles,shellBVH,shell.triangles,shift,delta);
 const final=continuousSweepHits(clip.triangles,shellBVH,shell.triangles,[0,0,0],[0,0,0]);
 clipChecks.push({name:clip.name,path:'radial from 15 mm inward to seated; reverse for removal',samples,continuousSweptTriangleIntersections:sweep.hits,continuousCandidatePairs:sweep.pairsTested,finalTriangleIntersections:final.hits,passed:samples.every(s=>s.edgeCrossings===0)&&sweep.hits===0&&final.hits===0});
}

// Cap is explicitly removed. The 3 mm tool approaches each clip screw axially
// from above and stops 0.05 mm above the seat; it does not pass through the pilot.
const obstacles=[...a.parts.filter(p=>!p.name.startsWith('panel-clip-')&&p.name!=='glare-cap'),...(a.purchased||[]),{name:'purchased-socket',triangles:a.socket||[]}];
const toolChecks=[];
for(let f=0;f<4;f++){
 const dir=dirs[f],x=(R-7)*dir[0],y=(R-7)*dir[1],clip=clips.find(p=>p.name==='panel-clip-'+(f+1)),zTop=Math.max(...clip.triangles.flatMap(t=>[t[2],t[5],t[8]])),z0=zTop+.05,z1=Math.max(S+100,z0+100),tool=extrude([circle(x,y,1.5,48,false)],([u,v],layer)=>[u,v,z0+layer*(z1-z0)]),toolBVH=buildBVH(tool),hits=[];
 for(const ob of obstacles){if(!ob.triangles.length)continue;const bv=buildBVH(ob.triangles),test=continuousSweepHits(tool,bv,ob.triangles,[0,0,0],[0,0,0]);let reverseEdgeCrossings=0;for(const t of ob.triangles){const box=bounds(vertices(t));if(!overlaps(box,{min:[x-1.5,y-1.5,z0],max:[x+1.5,y+1.5,z1]}))continue;reverseEdgeCrossings+=sampledEdgeHits([t],toolBVH,[0,0,0]);}if(test.hits||reverseEdgeCrossings)hits.push({part:ob.name,triangleIntersections:test.hits,reverseEdgeCrossings});}
 toolChecks.push({clip:clip.name,axisXY:[x,y],diameterMM:3,zRangeMM:[z0,z1],glareCapRemoved:true,intersections:hits,passed:hits.length===0});
}
const report={passed:clipChecks.every(c=>c.passed)&&toolChecks.every(c=>c.passed),assembly:input,scope:'Rigid geometric radial clip path and 3 mm axial screwdriver clearance; cap removed. No flex, thread holding, torque, thermal or physical validation.',physicalValidation:false,clipChecks,toolChecks};
fs.writeFileSync(output,JSON.stringify(report,null,2));
console.log(JSON.stringify({passed:report.passed,output,clips:clipChecks.map(({name,passed,continuousSweptTriangleIntersections,finalTriangleIntersections})=>({name,passed,continuousSweptTriangleIntersections,finalTriangleIntersections})),toolChecks}));
assert(report.passed,'Clip installation path or screwdriver clearance failed; see report');
