import earcut from './vendor/earcut.mjs';
const key=(x,y)=>x+','+y;
const cross=(a,b,c)=>(b[0]-a[0])*(c[1]-a[1])-(b[1]-a[1])*(c[0]-a[0]);
const area=p=>p.reduce((s,a,i)=>{const b=p[(i+1)%p.length];return s+a[0]*b[1]-b[0]*a[1];},0)/2;
const pointIn=(p,poly)=>{let inside=false;for(let i=0,j=poly.length-1;i<poly.length;j=i++){const a=poly[i],b=poly[j];if((a[1]>p[1])!==(b[1]>p[1])&&p[0]<(b[0]-a[0])*(p[1]-a[1])/(b[1]-a[1])+a[0])inside=!inside;}return inside;};
function disk(mask,nx,ny,cx,cy,r,value=1){for(let y=Math.max(1,Math.floor(cy-r));y<=Math.min(ny-2,Math.ceil(cy+r));y++)for(let x=Math.max(1,Math.floor(cx-r));x<=Math.min(nx-2,Math.ceil(cx+r));x++)if((x-cx)**2+(y-cy)**2<=r*r)mask[y*nx+x]=value;}
function flood(mask,nx,ny,start){const seen=new Uint8Array(mask.length),queue=new Int32Array(mask.length);let a=0,b=0;if(mask[start]){seen[start]=1;queue[b++]=start;}while(a<b){const k=queue[a++],x=k%nx,y=Math.floor(k/nx);for(const v of[x>0?k-1:-1,x<nx-1?k+1:-1,y>0?k-nx:-1,y<ny-1?k+nx:-1])if(v>=0&&mask[v]&&!seen[v]){seen[v]=1;queue[b++]=v;}}return{seen,cells:queue.subarray(0,b)};}
function connect(mask,nx,ny,radius,start=Math.floor(ny/2)*nx+Math.floor(nx/2)){let bridges=0;for(let iteration=0;iteration<400;iteration++){
  const root=flood(mask,nx,ny,start);if(root.cells.length===mask.reduce((s,x)=>s+x,0))return bridges;
  const parent=new Int32Array(mask.length);parent.fill(-1);const queue=new Int32Array(mask.length);let a=0,b=0,found=-1;for(const k of root.cells){parent[k]=k;queue[b++]=k;}
  while(a<b&&found<0){const k=queue[a++],x=k%nx,y=Math.floor(k/nx);for(const v of[x>1?k-1:-1,x<nx-2?k+1:-1,y>1?k-nx:-1,y<ny-2?k+nx:-1])if(v>=0&&parent[v]===-1){parent[v]=k;if(mask[v]&&!root.seen[v]){found=v;break;}queue[b++]=v;}}
  if(found<0)break;let k=found;while(!root.seen[k]){disk(mask,nx,ny,k%nx,Math.floor(k/nx),radius);k=parent[k];}bridges++;
}return bridges;}
function fixDiagonal(mask,nx,ny){let changes=0;for(let pass=0;pass<3;pass++)for(let y=1;y<ny-2;y++)for(let x=1;x<nx-2;x++){const k=y*nx+x,a=mask[k],b=mask[k+1],c=mask[k+nx],d=mask[k+nx+1];if(a&&d&&!b&&!c){mask[k+1]=1;changes++;}else if(b&&c&&!a&&!d){mask[k]=1;changes++;}}return changes;}
function contours(mask,nx,ny,pitch){
  const edges=new Map();const add=(a,b)=>{const k=key(...a);if(edges.has(k))throw new Error('Неоднозначный контур: увеличьте толщину перемычек.');edges.set(k,b);};
  for(let y=1;y<ny-1;y++)for(let x=1;x<nx-1;x++)if(mask[y*nx+x]){
    if(!mask[(y+1)*nx+x])add([x,y+1],[x+1,y+1]);if(!mask[y*nx+x+1])add([x+1,y+1],[x+1,y]);if(!mask[(y-1)*nx+x])add([x+1,y],[x,y]);if(!mask[y*nx+x-1])add([x,y],[x,y+1]);}
  const result=[];while(edges.size){const first=edges.keys().next().value,parts=first.split(',').map(Number),loop=[parts];let k=first,guard=0;do{const next=edges.get(k);if(!next)throw new Error('Незамкнутый контур.');edges.delete(k);k=key(...next);if(k!==first)loop.push(next);if(++guard>nx*ny*4)throw new Error('Ошибка обхода контура.');}while(k!==first);
    let simple=loop.filter((b,i)=>cross(loop[(i+loop.length-1)%loop.length],b,loop[(i+1)%loop.length])!==0);
    if(simple.length<3)continue;
    // Bound corner rounding to a quarter grid cell; long edges must not cut image corners.
    const smooth=[];for(let i=0;i<simple.length;i++){const a=simple[(i+simple.length-1)%simple.length],b=simple[i],c=simple[(i+1)%simple.length];const ta=Math.min(.16,.25/Math.hypot(a[0]-b[0],a[1]-b[1])),tc=Math.min(.16,.25/Math.hypot(c[0]-b[0],c[1]-b[1]));smooth.push([b[0]*(1-ta)+a[0]*ta,b[1]*(1-ta)+a[1]*ta],[b[0]*(1-tc)+c[0]*tc,b[1]*(1-tc)+c[1]*tc]);}
    const world=smooth.map(([x,y])=>[Math.round((x-nx/2)*pitch*1e5)/1e5,Math.round((ny/2-y)*pitch*1e5)/1e5]);
    result.push(world.filter((b,i)=>Math.abs(cross(world[(i+world.length-1)%world.length],b,world[(i+1)%world.length]))>1e-8));
  }return result;
}
function triangulate(loops){const outers=loops.filter(l=>area(l)>0),holes=loops.filter(l=>area(l)<0),groups=[];
  for(const outer of outers){const inner=holes.filter(h=>pointIn(h[0],outer)&&!outers.some(o=>o!==outer&&Math.abs(area(o))<Math.abs(area(outer))&&pointIn(h[0],o)));const all=[outer,...inner],points=all.flat(),starts=[];let offset=outer.length;for(const h of inner){starts.push(offset);offset+=h.length;}const idx=earcut(points.flat().map(x=>Math.round(x*1e5)),starts,2);groups.push({points,indices:idx,loops:all});}return groups;
}
function extrude(loops,point){const tris=[];for(const group of triangulate(loops)){
  const near=group.points.map(p=>point(p,0)),far=group.points.map(p=>point(p,1));for(let i=0;i<group.indices.length;i+=3){let[a,b,c]=group.indices.slice(i,i+3);if(cross(group.points[a],group.points[b],group.points[c])<0)[b,c]=[c,b];tris.push([...near[c],...near[b],...near[a]],[...far[a],...far[b],...far[c]]);}
  let offset=0;for(const loop of group.loops){for(let i=0;i<loop.length;i++){let a=offset+i,b=offset+(i+1)%loop.length;tris.push([...near[a],...near[b],...far[b]],[...near[a],...far[b],...far[a]]);}offset+=loop.length;}}
  return tris;
}
const rectangle=(w,h)=>[[-w/2,-h/2],[w/2,-h/2],[w/2,h/2],[-w/2,h/2]];
function circle(x,y,r,n=32,clockwise=true){return Array.from({length:n},(_,i)=>{const a=(clockwise?-1:1)*i/n*Math.PI*2;return[x+r*Math.cos(a),y+r*Math.sin(a)];});}
function surface(tris,loops,z,reverse=false){for(const g of triangulate(loops))for(let i=0;i<g.indices.length;i+=3){let[a,b,c]=g.indices.slice(i,i+3);if(cross(g.points[a],g.points[b],g.points[c])<0)[b,c]=[c,b];if(reverse)[b,c]=[c,b];tris.push(...[[...g.points[a],z,...g.points[b],z,...g.points[c],z]]);}}
function wallBetween(tris,loop,z0,z1,inside=false){for(let i=0;i<loop.length;i++){const a=[...loop[i],z0],b=[...loop[(i+1)%loop.length],z0],c=[...loop[(i+1)%loop.length],z1],d=[...loop[i],z1];if(inside)tris.push([...b,...a,...d],[...b,...d,...c]);else tris.push([...a,...b,...c],[...a,...c,...d]);}}
function annulus(tris,x,y,r0,r1,z,up=true){const a=circle(x,y,r0,32,false),b=circle(x,y,r1,32,false);for(let i=0;i<32;i++){const j=(i+1)%32,v0=[...a[i],z],v1=[...b[i],z],v2=[...b[j],z],v3=[...a[j],z];if(up)tris.push([...v0,...v1,...v2],[...v0,...v2,...v3]);else tris.push([...v0,...v2,...v1],[...v0,...v3,...v2]);}}
export function buildBVH(triangles){
  const records=triangles.map(t=>{const a=t.slice(0,3),e1=[t[3]-t[0],t[4]-t[1],t[5]-t[2]],e2=[t[6]-t[0],t[7]-t[1],t[8]-t[2]];return{a,e1,e2,min:[0,1,2].map(i=>Math.min(t[i],t[i+3],t[i+6])),max:[0,1,2].map(i=>Math.max(t[i],t[i+3],t[i+6]))};});
  function node(ids){const min=[Infinity,Infinity,Infinity],max=[-Infinity,-Infinity,-Infinity];for(const id of ids)for(let a=0;a<3;a++){min[a]=Math.min(min[a],records[id].min[a]);max[a]=Math.max(max[a],records[id].max[a]);}if(ids.length<=10)return{min,max,ids};const size=max.map((x,i)=>x-min[i]),axis=size.indexOf(Math.max(...size));ids.sort((a,b)=>(records[a].min[axis]+records[a].max[axis])-(records[b].min[axis]+records[b].max[axis]));const half=ids.length>>1;return{min,max,left:node(ids.slice(0,half)),right:node(ids.slice(half))};}
  return{root:node(records.map((_,i)=>i)),records};
}
function boxHit(n,o,dir){let lo=1e-7,hi=.9999999;for(let a=0;a<3;a++){if(Math.abs(dir[a])<1e-12){if(o[a]<n.min[a]||o[a]>n.max[a])return false;continue;}let x=(n.min[a]-o[a])/dir[a],y=(n.max[a]-o[a])/dir[a];if(x>y)[x,y]=[y,x];lo=Math.max(lo,x);hi=Math.min(hi,y);if(lo>hi)return false;}return true;}
export function triangleHit(t,o,d){const h0=d[1]*t.e2[2]-d[2]*t.e2[1],h1=d[2]*t.e2[0]-d[0]*t.e2[2],h2=d[0]*t.e2[1]-d[1]*t.e2[0],det=t.e1[0]*h0+t.e1[1]*h1+t.e1[2]*h2;if(Math.abs(det)<1e-10)return false;const sx=o[0]-t.a[0],sy=o[1]-t.a[1],sz=o[2]-t.a[2],u=(sx*h0+sy*h1+sz*h2)/det;if(u<0||u>1)return false;const q0=sy*t.e1[2]-sz*t.e1[1],q1=sz*t.e1[0]-sx*t.e1[2],q2=sx*t.e1[1]-sy*t.e1[0],v=(d[0]*q0+d[1]*q1+d[2]*q2)/det;if(v<0||u+v>1)return false;const distance=(t.e2[0]*q0+t.e2[1]*q1+t.e2[2]*q2)/det;return distance>1e-7&&distance<.9999999;}
export function occluded(bvh,o,dir){const stack=[bvh.root];while(stack.length){const n=stack.pop();if(!boxHit(n,o,dir))continue;if(n.ids){for(const id of n.ids)if(triangleHit(bvh.records[id],o,dir))return true;}else{stack.push(n.left,n.right);}}return false;}

export {flood,extrude,rectangle,circle,contours,connect,fixDiagonal,surface,wallBetween,annulus};
