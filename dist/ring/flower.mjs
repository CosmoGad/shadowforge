// Connected five-petal silhouette. Wall millimetres; positive y points up.
export const OPENING=Object.freeze([0,.08,.28,.60,.86,1,1,.86,.60,.28,.08,0]);
const lerp=(a,b,t)=>a+(b-a)*t;
export function flowerTarget(index){
 const f=OPENING[((index%12)+12)%12],v=(a,b)=>[lerp(a[0],b[0],f),lerp(a[1],b[1],f)];
 const right=[[4,-20]];
 function curve(c1,c2,end){
  const start=right[right.length-1];
  for(let j=1;j<=6;j++){const t=j/6,u=1-t;right.push([0,1].map(k=>u*u*u*start[k]+3*u*u*t*c1[k]+3*u*t*t*c2[k]+t*t*t*end[k]));}
 }
 curve(v([12,-20],[23,-20]),v([15,7],[49,0]),v([9,25],[48,24]));
 curve(v([8.5,24],[42,24]),v([7,17],[32,18]),v([6,15],[27,20]));
 curve(v([5,22],[34,28]),v([6,34],[34,39]),v([6,42],[30,45]));
 curve(v([5,43],[23,44]),v([3.5,34],[17,35]),v([3,31],[12,33]));
 curve(v([2,38],[14,43]),[3.5,46],[0,50]);
 return [[4,-48],...right,...right.slice(0,-1).reverse().map(([x,y])=>[-x,y]),[-4,-48]].map(([x,y])=>[x,y,0]);
}
export function makeBVH(triangles,indices=triangles.map((_,i)=>i)){
 const vertices=indices.flatMap(i=>triangles[i]),min=[0,1,2].map(k=>Math.min(...vertices.map(p=>p[k]))),max=[0,1,2].map(k=>Math.max(...vertices.map(p=>p[k])));
 const node={min,max};
 if(indices.length<=8){node.indices=indices;return node;}
 const extent=max.map((v,k)=>v-min[k]),axis=extent.indexOf(Math.max(...extent));
 indices.sort((a,b)=>triangles[a].reduce((s,p)=>s+p[axis],0)-triangles[b].reduce((s,p)=>s+p[axis],0));
 const mid=indices.length>>1;node.left=makeBVH(triangles,indices.slice(0,mid));node.right=makeBVH(triangles,indices.slice(mid));return node;
}
