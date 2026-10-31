import assert from'node:assert/strict';
import{makeConceptSource}from'./dist/concept-source.mjs';import{makeConceptYoke}from'./dist/concept-yoke.mjs';
import{meshAudit}from'./tests/service-mesh-audit.mjs';import{stlBuffer}from'./dist/core.mjs';import{buildBVH,occluded}from'./dist/projector-mesh.mjs';
const p={bodySide:160,sourceZ:140,thickness:1.2},source=makeConceptSource(p,{fieldRadius:466.30437927083443,mountAngles:[85,111]}),d=makeConceptYoke(p,{source,anchors:[{angle:92,rho:438},{angle:104,rho:427}]}),part=d.parts[0];
assert.equal(d.parts.length,1);assert.equal(d.purchased.length,0);assert.equal(d.parameters.requiresBooleanUnionWithShell,true);
const topology=meshAudit(part.triangles,part.name),b=Buffer.from(stlBuffer(part.triangles)),n=b.readUInt32LE(80),tris=Array.from({length:n},(_,i)=>Array.from({length:9},(_,k)=>b.readFloatLE(84+i*50+12+k*4)));meshAudit(tris,part.name+' float32');
for(const a of d.parameters.anchors){assert(Math.abs(Math.hypot(a.rootEnd[0],a.rootEnd[1])-80.2)<1e-8);assert.equal(a.inclinedWidth,10);assert.equal(a.rootThickness,1.6);assert(a.innerThickness>1.2);}
const bvh=buildBVH(part.triangles),fasteners=source.purchased.filter(p=>/cap-mount-(screw|washer)/.test(p.name));let fastenerEdgeIntersections=0;
for(const f of fasteners)for(const t of f.triangles)for(let k=0;k<3;k++){const a=t.slice(k*3,k*3+3),b=t.slice(((k+1)%3)*3,((k+1)%3)*3+3);if(occluded(bvh,a,b.map((v,i)=>v-a[i])))fastenerEdgeIntersections++;}
assert.equal(fastenerEdgeIntersections,0,'source mount screw/washer edges must clear yoke');
for(const t of part.triangles){const x=(t[0]+t[3]+t[6])/3,y=(t[1]+t[4]+t[7])/3,angle=Math.atan2(y,x)*180/Math.PI,anchor=d.parameters.anchors.reduce((a,b)=>Math.abs(a.angle-angle)<Math.abs(b.angle-angle)?a:b),radial=[Math.cos(anchor.angle*Math.PI/180),Math.sin(anchor.angle*Math.PI/180)];for(const eta of anchor.widthTransitionPlanes){const v=[0,3,6].map(k=>t[k+2]-140-eta*(t[k]*radial[0]+t[k+1]*radial[1]));assert(!(Math.min(...v)<-2e-5&&Math.max(...v)>2e-5),'triangle must be split at eta width transition');}}
const report={passed:true,widthTransitionSplitsVerified:true,topology,float32TopologyPassed:true,fastenerEdgeIntersections,physicalStrengthTested:false,parameters:d.parameters};console.log(JSON.stringify(report));
