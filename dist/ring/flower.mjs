// Connected five-petal silhouette. Wall millimetres; positive y points up.
export const OPENING=Object.freeze([0,.08,.28,.60,.86,1,1,.86,.60,.28,.08,0]);
const lerp=(a,b,t)=>a+(b-a)*t;
export function flowerTarget(index){
 const f=OPENING[((index%12)+12)%12],outer=Math.sin(f*Math.PI/2),inner=f*f*(3-2*f),v=(a,b,t=outer)=>[lerp(a[0],b[0],t),lerp(a[1],b[1],t)];
 const right=[[4,-20]];
 function curve(c1,c2,end){
  const start=right[right.length-1];
  for(let j=1;j<=6;j++){const t=j/6,u=1-t;right.push([0,1].map(k=>u*u*u*start[k]+3*u*u*t*c1[k]+3*u*t*t*c2[k]+t*t*t*end[k]));}
 }
 curve(v([12,-20],[27,-20]),v([15,7],[50,-12]),v([9,25],[56,5]));
 curve(v([8.5,24],[43,-2]),v([7,17],[35,0]),v([6,15],[27,4]));
 curve(v([5,22],[38,7],inner),v([6,34],[40,23],inner),v([6,42],[37,33],inner));
 curve(v([5,43],[29,23],inner),v([3.5,34],[18,18],inner),v([3,31],[12,17],inner));
 curve(v([2,38],[13,29],inner),v([3.5,46],[6,38],inner),v([0,50],[0,42],inner));
 const stem=[[2,-56]];
 const bez=(a,b,c)=>{const p=stem[stem.length-1];for(let j=1;j<=6;j++){const t=j/6,u=1-t;stem.push([0,1].map(k=>u*u*u*p[k]+3*u*u*t*a[k]+3*u*t*t*b[k]+t*t*t*c[k]));}};
 bez([3,-51],[4,-46],[4,-42]);bez([17,-44],[26,-36],[31,-27]);bez([18,-28],[11,-33],[5,-36]);bez([5,-30],[4,-25],[4,-20]);
 const body=[...stem,...right.slice(1),...right.slice(0,-1).reverse().map(([x,y])=>[-x,y])];
 stem.length=0;stem.push([-4,-20]);bez([-4,-26],[-3,-32],[-3,-36]);bez([-11,-29],[-22,-27],[-28,-29]);bez([-24,-39],[-14,-44],[-3,-43]);bez([-3,-47],[-4,-52],[-4,-56]);
 let contour=[...body,...stem.slice(1)];for(let pass=0;pass<3;pass++)contour=contour.filter((p,i,a)=>{const b=a[(i+a.length-1)%a.length],c=a[(i+1)%a.length];return Math.abs((p[0]-b[0])*(c[1]-p[1])-(p[1]-b[1])*(c[0]-p[0]))>1e-8;});return contour.map(([x,y])=>[x*1.55,y*1.55,0]);
}
export function flowerHoles(index){
 const f=OPENING[((index%12)+12)%12],sx=.20+.80*Math.sin(f*Math.PI/2),right=[];
 const curve=(a,b,c,d)=>{for(let j=0;j<10;j++){const t=j/10,u=1-t;right.push([sx*(u*u*u*a[0]+3*u*u*t*b[0]+3*u*t*t*c[0]+t*t*t*d[0]),u*u*u*a[1]+3*u*u*t*b[1]+3*u*t*t*c[1]+t*t*t*d[1],0]);}};
 curve([5,-13],[17,-10],[25,-3],[27,7]);
 curve([27,7],[17,4],[10,-5],[5,-13]);
 return [right.slice().reverse(),right.map(([x,y,z])=>[-x,y,z])].map(p=>p.map(([x,y,z])=>[x*1.55,y*1.55,z]));
}
export function makeBVH(triangles,indices=triangles.map((_,i)=>i)){
 const vertices=indices.flatMap(i=>triangles[i]),min=[0,1,2].map(k=>Math.min(...vertices.map(p=>p[k]))),max=[0,1,2].map(k=>Math.max(...vertices.map(p=>p[k])));
 const node={min,max};
 if(indices.length<=8){node.indices=indices;return node;}
 const extent=max.map((v,k)=>v-min[k]),axis=extent.indexOf(Math.max(...extent));
 indices.sort((a,b)=>triangles[a].reduce((s,p)=>s+p[axis],0)-triangles[b].reduce((s,p)=>s+p[axis],0));
 const mid=indices.length>>1;node.left=makeBVH(triangles,indices.slice(0,mid));node.right=makeBVH(triangles,indices.slice(mid));return node;
}
