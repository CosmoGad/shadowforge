import assert from'node:assert/strict';
import{makeConceptDecor}from'./dist/concept-front.mjs';
import{meshAudit}from'./tests/service-mesh-audit.mjs';
import{stlBuffer}from'./dist/core.mjs';
for(const diameter of[100,120,160,210]){
 const {parts,parameters}=makeConceptDecor({diameter,frontZ:159});assert.equal(parts.length,2);assert.equal(parameters.rosettePetals,8);
 for(const part of parts){meshAudit(part.triangles,part.name);const b=Buffer.from(stlBuffer(part.triangles)),n=b.readUInt32LE(80),tris=Array.from({length:n},(_,i)=>Array.from({length:9},(_,k)=>b.readFloatLE(84+i*50+12+k*4)));meshAudit(tris,part.name+' float32 STL');for(const t of tris)for(let k=0;k<9;k+=3){assert(Math.hypot(t[k],t[k+1])<diameter/2);assert(t[k+2]>=159);}}
 console.log(JSON.stringify({diameter,parts:parts.map(p=>({name:p.name,triangles:p.triangles.length})),float32TopologyPassed:true,...parameters}));
}
for(const args of[{}, {diameter:99,frontZ:0},{diameter:211,frontZ:0},{diameter:160,frontZ:NaN}])assert.throws(()=>makeConceptDecor(args));
