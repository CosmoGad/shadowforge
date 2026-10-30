import assert from 'node:assert/strict';
export function meshAudit(triangles,name,{components=1}={}){
 const edges=new Map(),incidence=new Map(),adjacency=triangles.map(()=>[]);let volume=0;const bounds=[[Infinity,-Infinity],[Infinity,-Infinity],[Infinity,-Infinity]];
 for(let i=0;i<triangles.length;i++){
  const t=triangles[i];assert(t.length===9&&t.every(Number.isFinite),name+' finite triangles');
  const a=[t[3]-t[0],t[4]-t[1],t[5]-t[2]],b=[t[6]-t[0],t[7]-t[1],t[8]-t[2]],cross=[a[1]*b[2]-a[2]*b[1],a[2]*b[0]-a[0]*b[2],a[0]*b[1]-a[1]*b[0]];assert(Math.hypot(...cross)>1e-10,name+' nondegenerate');
  volume+=(t[0]*(t[4]*t[8]-t[5]*t[7])+t[1]*(t[5]*t[6]-t[3]*t[8])+t[2]*(t[3]*t[7]-t[4]*t[6]))/6;
  const keys=[];for(let k=0;k<9;k+=3){keys.push(t.slice(k,k+3).map(v=>Math.round(v*1e5)).join(','));for(let axis=0;axis<3;axis++){bounds[axis][0]=Math.min(bounds[axis][0],t[k+axis]);bounds[axis][1]=Math.max(bounds[axis][1],t[k+axis]);}}
  for(let j=0;j<3;j++){const edge=[keys[j],keys[(j+1)%3]].sort().join('|');edges.set(edge,(edges.get(edge)||0)+1);if(!incidence.has(edge))incidence.set(edge,[]);incidence.get(edge).push(i);}
 }
 const bad=[...edges.values()].filter(v=>v!==2);assert.equal(bad.length,0,name+' closed manifold');assert(volume>0,name+' outward positive volume');
 for(const ids of incidence.values()){adjacency[ids[0]].push(ids[1]);adjacency[ids[1]].push(ids[0]);}
 const seen=new Set();let connectedComponents=0;for(let i=0;i<triangles.length;i++)if(!seen.has(i)){connectedComponents++;const stack=[i];seen.add(i);while(stack.length)for(const next of adjacency[stack.pop()])if(!seen.has(next)){seen.add(next);stack.push(next);}}
 assert.equal(connectedComponents,components,name+' connected component count');
 return{name,triangles:triangles.length,closed:true,components:connectedComponents,outward:true,volumeMM3:volume,bounds};
}
export function finiteQuality(q){for(const k of ['iou','edgeF1','contrast','strayShadow'])assert(Number.isFinite(q[k]),'finite quality '+k);}
export function transformed(triangles,matrix){return triangles.map(t=>{const out=[];for(let i=0;i<9;i+=3)for(let axis=0;axis<3;axis++)out.push(matrix[axis*4]*t[i]+matrix[axis*4+1]*t[i+1]+matrix[axis*4+2]*t[i+2]+matrix[axis*4+3]);return out;});}
