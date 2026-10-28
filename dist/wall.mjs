import earcut from './vendor/earcut.mjs';
import {clamp,sourceSamples} from './core.mjs';
export {stlBuffer,zipStore} from './core.mjs';
// Wall is z=0. The source is in front of the sculpture, at positive z.
export const DEFAULTS=Object.freeze({wallWidth:330,resolution:144,threshold:.30,style:'solid',contrast:1,gap:42,relief:18,thickness:2.4,sourceZ:100,emitter:1.2,sourceX:0,sourceY:0,minWeb:1.4,socket:14,exposure:2.2,invert:false,ambient:.018});
const key=(x,y)=>x+','+y;
const cross=(a,b,c)=>(b[0]-a[0])*(c[1]-a[1])-(b[1]-a[1])*(c[0]-a[0]);
const area=p=>p.reduce((s,a,i)=>{const b=p[(i+1)%p.length];return s+a[0]*b[1]-b[0]*a[1];},0)/2;
const pointIn=(p,poly)=>{let inside=false;for(let i=0,j=poly.length-1;i<poly.length;j=i++){const a=poly[i],b=poly[j];if((a[1]>p[1])!==(b[1]>p[1])&&p[0]<(b[0]-a[0])*(p[1]-a[1])/(b[1]-a[1])+a[0])inside=!inside;}return inside;};
function disk(mask,nx,ny,cx,cy,r,value=1){for(let y=Math.max(1,Math.floor(cy-r));y<=Math.min(ny-2,Math.ceil(cy+r));y++)for(let x=Math.max(1,Math.floor(cx-r));x<=Math.min(nx-2,Math.ceil(cx+r));x++)if((x-cx)**2+(y-cy)**2<=r*r)mask[y*nx+x]=value;}
function morphology(mask,nx,ny,r,dilate){const out=new Uint8Array(mask.length);for(let y=1;y<ny-1;y++)for(let x=1;x<nx-1;x++){let v=dilate?0:1;outer:for(let dy=-r;dy<=r;dy++)for(let dx=-r;dx<=r;dx++){if(dx*dx+dy*dy>r*r)continue;const xx=x+dx,yy=y+dy,a=xx>=0&&yy>=0&&xx<nx&&yy<ny?mask[yy*nx+xx]:0;if(dilate&&a){v=1;break outer;}if(!dilate&&!a){v=0;break outer;}}out[y*nx+x]=v;}return out;}
function flood(mask,nx,ny,start){const seen=new Uint8Array(mask.length),queue=new Int32Array(mask.length);let a=0,b=0;if(mask[start]){seen[start]=1;queue[b++]=start;}while(a<b){const k=queue[a++],x=k%nx,y=Math.floor(k/nx);for(const v of[x>0?k-1:-1,x<nx-1?k+1:-1,y>0?k-nx:-1,y<ny-1?k+nx:-1])if(v>=0&&mask[v]&&!seen[v]){seen[v]=1;queue[b++]=v;}}return{seen,cells:queue.subarray(0,b)};}
function connect(mask,nx,ny,radius){let bridges=0;const start=Math.floor(ny/2)*nx+Math.floor(nx/2);for(let iteration=0;iteration<400;iteration++){
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
    // Round each corner without creating a regular pattern of holes.
    const smooth=[];for(let i=0;i<simple.length;i++){const a=simple[(i+simple.length-1)%simple.length],b=simple[i],c=simple[(i+1)%simple.length];smooth.push([b[0]*.84+a[0]*.16,b[1]*.84+a[1]*.16],[b[0]*.84+c[0]*.16,b[1]*.84+c[1]*.16]);}
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
function supportMesh(d){
  const tris=[],outer=rectangle(64,86),holes=d.posts.map(([x,y])=>circle(x,y,2.65,6)),wallHoles=[circle(0,-31,2),circle(0,31,2)];
  surface(tris,[outer,...holes,...wallHoles],0,true);surface(tris,[outer,...d.posts.map(([x,y])=>circle(x,y,2.5)),...wallHoles],3);wallBetween(tris,outer,0,3);
  for(const h of wallHoles)wallBetween(tris,[...h].reverse(),0,3,true);
  for(const [x,y]of d.posts){wallBetween(tris,circle(x,y,2.65,6,false),0,1.8,true);surface(tris,[circle(x,y,2.65,6,false),circle(x,y,1.1)],1.8,true);wallBetween(tris,circle(x,y,1.1,32,false),1.8,d.p.gap,true);wallBetween(tris,circle(x,y,2.5,32,false),3,d.p.gap-2);annulus(tris,x,y,2.5,5,d.p.gap-2,false);wallBetween(tris,circle(x,y,5,32,false),d.p.gap-2,d.p.gap);annulus(tris,x,y,1.1,5,d.p.gap,true);}
  return tris;
}
function choosePosts(target,nx,ny,pitch,scale){
  const radius=40, score=angle=>{const c=Math.cos(angle),s=Math.sin(angle);let error=0,count=0;for(let r=radius/scale;r<Math.hypot(nx,ny)*pitch*.5;r+=pitch){const x=Math.round(nx/2+r*c/pitch),y=Math.round(ny/2-r*s/pitch);if(x<2||x>=nx-2||y<2||y>=ny-2)break;error+=1-target[y*nx+x];count++;}return count?error/count:1;};
  return [[-70,-65,-60,60,65,70],[110,115,120,240,245,250]].map(list=>{const angle=list.map(a=>({a:a*Math.PI/180,cost:score(a*Math.PI/180)})).sort((a,b)=>a.cost-b.cost)[0].a;return[radius*Math.cos(angle),radius*Math.sin(angle)];});
}
export function makeWallDesign(gray,iw,ih,settings={}){
  const p={...DEFAULTS,...settings},nx=Math.round(p.resolution),ny=Math.round(nx*ih/iw),pitch=p.wallWidth/nx,height=ny*pitch;
  if(p.sourceZ-p.gap-p.relief-p.thickness<20)throw new Error('Между источником и самым высоким участком нужно оставить минимум 20 мм.');
  if(p.gap<8)throw new Error('Зазор до стены слишком мал.');
  const scale=1-p.gap/p.sourceZ,minScale=1-(p.gap+p.relief+p.thickness)/p.sourceZ;
  if(p.minWeb>pitch*minScale*4)throw new Error('Перемычки слишком широкие для этой детализации.');
  let border=0,borderN=0;for(let y=0;y<ih;y++)for(let x=0;x<iw;x++)if(x<iw*.04||x>iw*.96||y<ih*.04||y>ih*.96){border+=gray[y*iw+x];borderN++;}
  const darkBackground=border/borderN<.45,target=new Uint8Array(nx*ny),tones=new Float32Array(nx*ny);let mask=new Uint8Array(target.length),foreground=new Uint8Array(target.length);
  for(let y=2;y<ny-2;y++)for(let x=2;x<nx-2;x++){let sum=0;for(const [dx,dy]of[[.2,.2],[.8,.2],[.2,.8],[.8,.8]]){const xx=Math.min(iw-1,Math.floor((x+dx)*iw/nx)),yy=Math.min(ih-1,Math.floor((y+dy)*ih/ny));sum+=gray[yy*iw+xx];}const raw=sum/4,g=clamp((raw-.5)*p.contrast+.5);tones[y*nx+x]=g;foreground[y*nx+x]=darkBackground?+(raw>.022):+(raw<.97);}
  foreground=morphology(morphology(foreground,nx,ny,2,true),nx,ny,2,false);const background=Uint8Array.from(foreground,x=>1-x),outside=flood(background,nx,ny,0).seen;for(let k=0;k<foreground.length;k++)foreground[k]=outside[k]?0:1;
  for(let y=2;y<ny-2;y++)for(let x=2;x<nx-2;x++){const k=y*nx+x,g=tones[k],ink=p.style==='lines'?(darkBackground?g>=p.threshold:g<=1-p.threshold):!!foreground[k]&&g<=p.threshold;target[k]=p.invert?(foreground[k]?+!ink:0):+ink;}
  const radius=Math.max(1,Math.floor(p.minWeb/(pitch*minScale)*.5));
  mask=morphology(target,nx,ny,1,true);mask=morphology(mask,nx,ny,1,false);mask=morphology(mask,nx,ny,radius,false);mask=morphology(mask,nx,ny,radius,true);
  const rootW=72,rootH=96,flatW=70/scale,flatH=92/scale,posts=choosePosts(target,nx,ny,pitch,scale);
  if(flatW>p.wallWidth*.9||flatH>height*.9)throw new Error('Крепление перекрывает почти весь рисунок. Увеличьте картину или приблизьте фигуру к стене.');
  disk(mask,nx,ny,nx/2,ny/2,8/pitch);
  for(const [x,y]of posts)disk(mask,nx,ny,nx/2+x/(scale*pitch),ny/2-y/(scale*pitch),6/(scale*pitch));
  const before=mask.slice(),bridges=connect(mask,nx,ny,Math.max(1,radius));fixDiagonal(mask,nx,ny);
  // Oversized square clearances for the two printed posts, entirely inside the central pad.
  for(const [px,py]of posts){const cx=px/scale,cy=py/scale,r=3.3/Math.min(scale,scale-p.thickness/p.sourceZ);for(let y=1;y<ny-1;y++)for(let x=1;x<nx-1;x++)if(Math.abs((x+.5-nx/2)*pitch-cx)<r&&Math.abs((ny/2-y-.5)*pitch-cy)<r)mask[y*nx+x]=0;}
  fixDiagonal(mask,nx,ny);const loops=contours(mask,nx,ny,pitch),outerCount=loops.filter(x=>area(x)>0).length;
  if(outerCount!==1)throw new Error('Фрагменты не соединились в одну деталь. Измените порог или перемычки.');
  const d={p,nx,ny,pitch,height,mask,target,before,bridges,posts,loops,rootW,rootH,darkBackground,minFeature:pitch*minScale,holes:loops.filter(x=>area(x)<0).length};
  const point=([x,y],front)=>{const r=Math.max(Math.abs(x)/(flatW/2),Math.abs(y)/(flatH/2)),u=clamp((r-1)/2),z=p.gap+p.relief*u*(.75+.25*Math.cos(Math.atan2(y,x)*3))+front*p.thickness,k=1-z/p.sourceZ;return[x*k,y*k,z];};
  d.sculpture=extrude(loops,point);d.support=supportMesh(d);d.cover=extrude([rectangle(64,86),circle(0,0,p.socket/2),...posts.map(([x,y])=>circle(x,y,1.1))],([x,y],f)=>[x,y,p.sourceZ+16+f*3]);
  d.hardware=posts.flatMap(([x,y])=>extrude([circle(x,y,1,32,false)],([x,y],f)=>[x,y,f*(p.sourceZ+24)]));
  d.washer=extrude([circle(0,0,6,32,false),circle(0,0,1.1)],([x,y],f)=>[x,y,f*1.5]);
  d.washers=posts.flatMap(([x,y])=>d.washer.map(t=>t.map((v,i)=>v+([x,y,p.gap+p.thickness][i%3]))));
  d.bounds=[[Infinity,-Infinity],[Infinity,-Infinity],[Infinity,-Infinity]];for(const t of d.sculpture)for(let i=0;i<9;i++){const a=i%3;d.bounds[a][0]=Math.min(d.bounds[a][0],t[i]);d.bounds[a][1]=Math.max(d.bounds[a][1],t[i]);}
  d.addedPixels=mask.reduce((s,x,i)=>s+(x&&!before[i]?1:0),0);return d;
}
// BVH over the exact triangles used for STL export, including the structural posts.
export function buildBVH(triangles){
  const records=triangles.map(t=>{const a=t.slice(0,3),e1=[t[3]-t[0],t[4]-t[1],t[5]-t[2]],e2=[t[6]-t[0],t[7]-t[1],t[8]-t[2]];return{a,e1,e2,min:[0,1,2].map(i=>Math.min(t[i],t[i+3],t[i+6])),max:[0,1,2].map(i=>Math.max(t[i],t[i+3],t[i+6]))};});
  function node(ids){const min=[Infinity,Infinity,Infinity],max=[-Infinity,-Infinity,-Infinity];for(const id of ids)for(let a=0;a<3;a++){min[a]=Math.min(min[a],records[id].min[a]);max[a]=Math.max(max[a],records[id].max[a]);}if(ids.length<=10)return{min,max,ids};const size=max.map((x,i)=>x-min[i]),axis=size.indexOf(Math.max(...size));ids.sort((a,b)=>(records[a].min[axis]+records[a].max[axis])-(records[b].min[axis]+records[b].max[axis]));const half=ids.length>>1;return{min,max,left:node(ids.slice(0,half)),right:node(ids.slice(half))};}
  return{root:node(records.map((_,i)=>i)),records};
}
function boxHit(n,o,dir){let lo=1e-7,hi=.9999999;for(let a=0;a<3;a++){if(Math.abs(dir[a])<1e-12){if(o[a]<n.min[a]||o[a]>n.max[a])return false;continue;}let x=(n.min[a]-o[a])/dir[a],y=(n.max[a]-o[a])/dir[a];if(x>y)[x,y]=[y,x];lo=Math.max(lo,x);hi=Math.min(hi,y);if(lo>hi)return false;}return true;}
export function triangleHit(t,o,d){const h0=d[1]*t.e2[2]-d[2]*t.e2[1],h1=d[2]*t.e2[0]-d[0]*t.e2[2],h2=d[0]*t.e2[1]-d[1]*t.e2[0],det=t.e1[0]*h0+t.e1[1]*h1+t.e1[2]*h2;if(Math.abs(det)<1e-10)return false;const sx=o[0]-t.a[0],sy=o[1]-t.a[1],sz=o[2]-t.a[2],u=(sx*h0+sy*h1+sz*h2)/det;if(u<0||u>1)return false;const q0=sy*t.e1[2]-sz*t.e1[1],q1=sz*t.e1[0]-sx*t.e1[2],q2=sx*t.e1[1]-sy*t.e1[0],v=(d[0]*q0+d[1]*q1+d[2]*q2)/det;if(v<0||u+v>1)return false;const distance=(t.e2[0]*q0+t.e2[1]*q1+t.e2[2]*q2)/det;return distance>1e-7&&distance<.9999999;}
export function occluded(bvh,o,dir){const stack=[bvh.root];while(stack.length){const n=stack.pop();if(!boxHit(n,o,dir))continue;if(n.ids){for(const id of n.ids)if(triangleHit(bvh.records[id],o,dir))return true;}else{stack.push(n.left,n.right);}}return false;}
export function simulateWall(d,width=280,count=13){
  const triangles=[...d.sculpture,...d.support,...d.cover,...d.hardware,...d.washers],bvh=buildBVH(triangles),height=Math.round(width*d.height/d.p.wallWidth),data=new Float32Array(width*height),shadow=new Float32Array(width*height),samples=sourceSamples(d.p.emitter,count),worldWidth=d.p.wallWidth*1.18,worldHeight=worldWidth*height/width,p=d.p;
  let intersection=0,union=0,error=0,scored=0;for(let y=0;y<height;y++)for(let x=0;x<width;x++){
    const wx=((x+.5)/width-.5)*worldWidth,wy=(.5-(y+.5)/height)*worldHeight,k=y*width+x;let light=0,blocked=0;
    for(const [dx,dy]of samples){const o=[p.sourceX+dx,p.sourceY+dy,p.sourceZ],dir=[wx-o[0],wy-o[1],-p.sourceZ];if(occluded(bvh,o,dir)){blocked++;continue;}const r2=dir[0]**2+dir[1]**2+p.sourceZ**2;light+=Math.pow(p.sourceZ**2/r2,1.5);}
    data[k]=light/samples.length;shadow[k]=blocked/samples.length;
    const ix=Math.floor(wx/d.pitch+d.nx/2),iy=Math.floor(d.ny/2-wy/d.pitch);if(ix>=0&&iy>=0&&ix<d.nx&&iy<d.ny&&!(Math.abs(wx)<d.rootW/2+5&&Math.abs(wy)<d.rootH/2+5)){
      const target=d.target[iy*d.nx+ix],actual=shadow[k]>=.5;intersection+=actual&&target?1:0;union+=actual||target?1:0;error+=(shadow[k]-target)**2;scored++;}}
  return{width,height,data,shadow,worldWidth,worldHeight,samples:samples.length,iou:union?intersection/union:1,rmse:Math.sqrt(error/Math.max(1,scored)),blur:p.emitter*(p.gap+p.relief/2)/(p.sourceZ-p.gap-p.relief/2),triangles:triangles.length};
}
