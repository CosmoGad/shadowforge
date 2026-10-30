// Side-cut square shadow lamp. Wall z=0; the emitting plane is z=sourceZ.
// Every image-forming surface lies on one of four planes x/y=±bodySide/2.
import {makeServiceParts} from './service-parts.mjs?v=service-5';
import {smoothContours} from './smooth-contours.mjs?v=service-5';
import {prepareShadowTarget} from './shadow-target.mjs?v=stencil-3';
import {extrude,rectangle,circle,contours,connect,fixDiagonal,flood} from './projector-mesh.mjs?v=service-5';
import {morphology} from './clarity.mjs';
import {traceProjector} from './projector.mjs?v=service-5';
export {stlBuffer,zipStore} from './core.mjs';
export const DEFAULTS=Object.freeze({bodySide:160,wallWidth:600,sourceZ:140,imageY:200,emitter:1.2,minWeb:.8,thickness:1.2,threshold:.34,contrast:1,resolution:200,panelPitch:.65,style:'portrait',ambient:.002,exposureEV:0,socket:14,smooth:0,detailMM:0,composition:'free',serviceMode:0,glareScreen:1,filamentLift:12,socketDiameter:10.6,socketHeight:13.2,cableDiameter:2.8,stencilMode:'legacy'});
export const FACE_NAMES=['Правая стенка','Верхняя стенка','Левая стенка','Нижняя стенка'];
const toWorld=(face,u,z,normal)=>face===0?[normal,u,z]:face===1?[-u,normal,z]:face===2?[-normal,-u,z]:[u,-normal,z];
function closedSurface(triangles){const edges=new Map();for(const t of triangles){const a=[t[3]-t[0],t[4]-t[1],t[5]-t[2]],b=[t[6]-t[0],t[7]-t[1],t[8]-t[2]];if(Math.hypot(a[1]*b[2]-a[2]*b[1],a[2]*b[0]-a[0]*b[2],a[0]*b[1]-a[1]*b[0])<1e-10)return false;const vs=[0,3,6].map(k=>t.slice(k,k+3).map(v=>Math.round(v*1e7)).join(','));for(let i=0;i<3;i++){const e=[vs[i],vs[(i+1)%3]].sort().join('|');edges.set(e,(edges.get(e)||0)+1);}}return [...edges.values()].every(n=>n===2);}
const range=(v,lo,hi)=>Number.isFinite(v)&&v>=lo&&v<=hi;
export function makeSidewall(gray,iw,ih,settings={},preparedReference=null){
 const p={...DEFAULTS,...settings};for(const k of Object.keys(DEFAULTS))if(typeof DEFAULTS[k]==='number'&&(typeof p[k]!=='number'||!Number.isFinite(p[k])))throw new Error('Некорректный параметр: '+k);
 if(!range(p.bodySide,100,210)||!range(p.wallWidth,240,800)||!range(p.sourceZ,90,220)||!range(p.imageY,-400,600)||!range(p.emitter,0,5)||!range(p.minWeb,.5,2)||!range(p.thickness,.8,3)||!range(p.threshold,.05,.9)||!range(p.contrast,.5,2)||!range(p.resolution,96,512)||!range(p.smooth,0,2)||!range(p.detailMM,0,10)||!['free','surround'].includes(p.composition)||!range(p.panelPitch,.4,1.5)||!range(p.ambient,0,.1)||!range(p.exposureEV,-4,8)||!range(p.socket,10,24)||!['portrait','silhouette'].includes(p.style))throw new Error('Параметры вне рабочего диапазона.');
 if(![0,1].includes(p.serviceMode)||![0,1].includes(p.glareScreen))throw new Error('Некорректный режим сборки.');const servicePack=p.serviceMode?makeServiceParts(p):null;
 if(!['legacy','bold','balanced','detail'].includes(p.stencilMode))throw Error('Некорректный режим эскиза.');
 const ref=preparedReference?{...preparedReference,target:preparedReference.target.slice()}:prepareShadowTarget(gray,iw,ih,p),pitch=p.wallWidth/ref.nx,height=ref.ny*pitch,B=p.bodySide/2,S=p.sourceZ,z0=servicePack?.baseTop||3,radialExtent=Math.max(p.wallWidth/2,Math.abs(p.imageY)+height/2)+20;
 const sourceGap=Math.max(24,S*B/radialExtent),z1=S-sourceGap;if(z1-z0<24)throw new Error('Недостаточная глубина фигурных стенок.');
 // The socket faces outward. Its opaque shadow must fit under the physical base.
 const socketRadius=(p.socket-2)/2,holderRadius=p.socket/2+2.4,sourceRadius=p.emitter/2;
 const socketShadowRadius=socketRadius*S/12+sourceRadius*(S-12)/12,holderShadowRadius=holderRadius*S/20+sourceRadius*(S-20)/20;
 if(!servicePack&&Math.max(socketShadowRadius,holderShadowRadius)>B-1)throw new Error('Тень патрона выходит за квадратное основание. Увеличьте корпус или уменьшите расстояние источника до стены.');
 if(p.detailMM>0&&p.stencilMode==='legacy'){const r=Math.max(1,Math.round(p.detailMM/(2*pitch)));ref.target=morphology(morphology(ref.target,ref.nx,ref.ny,r,false),ref.nx,ref.ny,r,true);ref.target=morphology(morphology(ref.target,ref.nx,ref.ny,r,true),ref.nx,ref.ny,r,false);}
 const nx=Math.min(p.smooth?480:240,Math.ceil(p.bodySide/p.panelPitch)+2),px=p.bodySide/(nx-2),ny=Math.ceil((z1-z0)/px)+2,pz=(z1-z0)/(ny-2),panels=[];let bridges=0,holes=0;
 // Sample a continuous coverage field. Nearest-neighbour target lookup produced
 // staircase boundaries even after smoothing the panel's cell contour.
 const coverage=new Float32Array(ref.target.length);for(let y=0;y<ref.ny;y++)for(let x=0;x<ref.nx;x++){let sum=0,weight=0;for(let j=-1;j<=1;j++)for(let i=-1;i<=1;i++){const xx=x+i,yy=y+j,w=(i===0?2:1)*(j===0?2:1);if(xx>=0&&yy>=0&&xx<ref.nx&&yy<ref.ny)sum+=ref.target[yy*ref.nx+xx]*w;weight+=w;}coverage[y*ref.nx+x]=sum/weight;}
 const target=(wx,wy)=>{if(!p.smooth){const x=Math.floor(wx/pitch+ref.nx/2),y=Math.floor(ref.ny/2-(wy-p.imageY)/pitch);return x>=0&&y>=0&&x<ref.nx&&y<ref.ny?ref.target[y*ref.nx+x]:0;}const fx=wx/pitch+ref.nx/2-.5,fy=ref.ny/2-(wy-p.imageY)/pitch-.5,x=Math.floor(fx),y=Math.floor(fy),a=fx-x,b=fy-y,at=(u,v)=>u>=0&&v>=0&&u<ref.nx&&v<ref.ny?coverage[v*ref.nx+u]:0;return +((1-a)*(1-b)*at(x,y)+a*(1-b)*at(x+1,y)+(1-a)*b*at(x,y+1)+a*b*at(x+1,y+1)>=.5);};
 const radius=Math.max(1,Math.ceil(p.minWeb/Math.min(px,pz)*.5)),rearRows=Math.max(4,Math.ceil(3/pz));
 for(let face=0;face<4;face++){
  let mask=new Uint8Array(nx*ny);
  for(let y=1;y<ny-1;y++)for(let x=1;x<nx-1;x++){
   const u=(x-.5)*px-B,z=z0+(ny-y-1.5)*pz,[xx,yy]=toWorld(face,u,z,B),M=S/(S-z);mask[y*nx+x]=target(xx*M,yy*M);
  }
  // A one-cell opening deletes useful strokes wholesale. Preserve the sampled contour
  // at the nominal setting; wider requested webs trigger a physical opening. Tabs
  // are widened below. Local neck widths still require slicer inspection.
  if(radius>1)mask=morphology(morphology(mask,nx,ny,radius,false),nx,ny,radius,true);
  // No front lip and no tall corner rails: those would cast the spurious X.
  for(let y=ny-1-rearRows;y<ny-1;y++)for(let x=1;x<nx-1;x++)mask[y*nx+x]=1;
  for(let x=0;x<nx;x++){mask[x]=0;mask[(ny-1)*nx+x]=0;}for(let y=0;y<ny;y++){mask[y*nx]=0;mask[y*nx+nx-1]=0;}
  const notches=[];if(servicePack)for(let y=1;y<ny-1;y++)for(let x=1;x<nx-1;x++){const u=(x-.5)*px-B,z=z0+(ny-y-1.5)*pz;if(Math.abs(u)<6.8&&z>z0+3&&z<21){mask[y*nx+x]=0;notches.push(y*nx+x);}}
  const root=(ny-2)*nx+1,tabs=connect(mask,nx,ny,radius,root);bridges+=tabs;fixDiagonal(mask,nx,ny);for(const k of notches)mask[k]=0;
  if(flood(mask,nx,ny,root).cells.length!==mask.reduce((a,b)=>a+b,0))throw new Error('На стенке остались несвязанные фрагменты.');
  const originalLoops=contours(mask,nx,ny,1),smoothed=p.smooth?smoothContours(originalLoops,{tolerance:p.smooth>1?1.1:.8,cornerRadius:p.smooth>1?2:.75,iterations:p.smooth>1?3:2,preserveBottom:true,bottomBand:servicePack?Math.ceil(8/pz):rearRows,maxDeviation:p.smooth>1?2.8:1.65,quantum:p.smooth>1?.1:0}):null,initialLoops=smoothed?.loops||originalLoops,k=(B-p.thickness)/B;
  let loops=initialLoops;
  holes+=loops.filter(loop=>loop.reduce((s,a,i)=>{const b=loop[(i+1)%loop.length];return s+a[0]*b[1]-b[0]*a[1];},0)<0).length;
  const point=([u,v],outer)=>{
   const uu=u*px,z=z0+(v+ny/2-1)*pz;
   // The rear contact edge stays at z=3 on both faces, giving an area bond to the base.
   const innerZ=servicePack?z+Math.max(0,Math.min(1,(z-z0-4.3)/4))*(1-k)*(S-z):Math.abs(z-z0)<1e-4?z:S+k*(z-S);
   return outer?toWorld(face,uu,z,B):toWorld(face,uu*k,innerZ,B-p.thickness);
  };
  let triangles=extrude(loops,point);if(p.smooth&&!closedSurface(triangles)){loops=originalLoops;triangles=extrude(loops,point);smoothed.stats.meshFallback=true;smoothed.stats.fallbackReason='Cap triangulation failed closed-edge verification';}if(!closedSurface(triangles))throw new Error('Не удалось замкнуть стенку. Увеличьте размер деталей или измените порог.');
  panels.push({face,name:'side-panel-'+(face+1),label:FACE_NAMES[face],triangles,mask,nx,ny,NX:nx,NY:ny,pitch:px,zPitch:pz,z0,z1,side:p.bodySide,bridges:tabs,loops:loops.length,smoothing:smoothed?.stats||null,contourLoops:loops});
 }
 const base=extrude([rectangle(p.bodySide,p.bodySide),circle(0,B-9,1.7),circle(0,-B+9,1.7),circle(0,0,2.2)],([x,y],f)=>[x,y,f*z0]);
 // Printed cup supports a purchased socket. Both stay below the emitting plane.
 const seatZ=S-28,topZ=S-20;
 const pedestal=extrude([circle(0,0,holderRadius,32,false),circle(0,0,2.2)],([x,y],f)=>[x,y,z0+f*(seatZ-z0)]);
 const cup=extrude([circle(0,0,holderRadius,32,false),circle(0,0,p.socket/2)],([x,y],f)=>[x,y,seatZ+f*(topZ-seatZ)]);
 // Merge the two stepped rings through shared cap topology (remove the shared annulus).
 const holder=[];
 for(const t of pedestal){const top=t[2]===seatZ&&t[5]===seatZ&&t[8]===seatZ;if(!top)holder.push(t);}
 for(const t of cup){const bottom=t[2]===seatZ&&t[5]===seatZ&&t[8]===seatZ;if(!bottom)holder.push(t);}
 const seat=extrude([circle(0,0,p.socket/2,32,false),circle(0,0,2.2)],([x,y],f)=>[x,y,seatZ+f*.001]);
 // Only the upward seat annulus is needed at the common level; using its bottom reverses orientation.
 for(const t of seat)if(t[2]===seatZ+.001&&t[5]===seatZ+.001&&t[8]===seatZ+.001)holder.push(t.map((v,i)=>i%3===2?seatZ:v));
 const legacySocket=extrude([circle(0,0,socketRadius,32,false)],([x,y],f)=>[x,y,seatZ+f*16]);
 const socket=servicePack?.socket||legacySocket,purchased=servicePack?.purchased||[],parts=[...panels.map(p=>({name:p.name,triangles:p.triangles})),...(servicePack?servicePack.parts:[{name:'square-base',triangles:base},{name:'central-holder',triangles:holder}])],triangles=[...parts.flatMap(p=>p.triangles),...socket,...purchased.flatMap(p=>p.triangles)];
 const x0=Math.min(-p.wallWidth/2,-B),x1=Math.max(p.wallWidth/2,B),y0=Math.min(p.imageY-height/2,-B),y1=Math.max(p.imageY+height/2,B),scene={centerX:(x0+x1)/2,centerY:(y0+y1)/2,width:(x1-x0)*1.2,height:(y1-y0)*1.2};
 const faceCounts=[0,0,0,0];for(let y=0;y<ref.ny;y++)for(let x=0;x<ref.nx;x++){if(!ref.raw[y*ref.nx+x])continue;const wx=(x+.5-ref.nx/2)*pitch,wy=(ref.ny/2-y-.5)*pitch+p.imageY;if(Math.max(Math.abs(wx),Math.abs(wy))<=(servicePack?B*S/(S-z0):B)+3)continue;faceCounts[Math.abs(wx)>Math.abs(wy)?wx>0?0:2:wy>0?1:3]++;}const faceTotal=faceCounts.reduce((a,b)=>a+b,0),faceShares=faceCounts.map(n=>n/Math.max(1,faceTotal));
 const maxM=S/(S-z1),q={imageX:0,imageY:p.imageY,layout:'sidewall',minZ:z0,maxZ:z1,sourceGap,penumbra:p.emitter*(maxM-1),magnification:maxM,baseHalf:B,baseShadowHalf:servicePack?B*S/(S-z0):B,rearRailMaxZ:z0+rearRows*pz};
 return{p,ref,pitch,height,q,scene,parts,socket,triangles,panels,bridges,holes,holder:servicePack?.holder||holder,base:servicePack?.base||base,purchased,wires:servicePack?.wires||[],service:servicePack?.service||null,faceCounts,faceShares,mount:servicePack?.mount||{seatZ,topZ,outerRadius:holderRadius,socketRadius,socketShadowRadius,holderShadowRadius,shadowFitsBase:true},limits:{nominalWeb:p.minWeb,physicalGridPitch:[px,pz],penumbra:q.penumbra,minimumReliableDetail:Math.max(2*q.penumbra,p.minWeb*maxM),webCertified:false},validation:{physical:false,glassModelled:false,bulbFluxKnown:false}};
}
export function traceSidewall(d,width=320,count=25,offset=[0,0]){
 if(!Number.isInteger(width)||width<48||width>1200||!Number.isInteger(count)||count<1||count>256||!Array.isArray(offset)||offset.length!==2||!offset.every(Number.isFinite))throw new Error('Некорректная точность трассировки.');
 return traceProjector(d,width,count,offset);
}
export function evaluateSidewall(d,sim){
 let tp=0,fp=0,fn=0,tn=0,light=0,dark=0,nl=0,nd=0,outside=0,outsideShadow=0,strayTotal=0,stray=0,rtp=0,rfp=0,rfn=0,baseLightPixels=0,basePixels=0;
 const size=sim.width*sim.height,expected=new Uint8Array(size),actual=new Uint8Array(size),inside=new Uint8Array(size),guard=Math.max(d.pitch,2*d.scene.width/sim.width),B=d.p.bodySide/2,railRadius=B*d.p.sourceZ/(d.p.sourceZ-d.q.rearRailMaxZ)+d.q.penumbra;
 const valid=[sim.worldWidth,sim.worldHeight,sim.centerX,sim.centerY].every(Number.isFinite)&&sim.worldWidth>0&&sim.worldHeight>0&&Number.isInteger(sim.width)&&Number.isInteger(sim.height)&&sim.visibility?.length===size&&sim.data?.length===size&&sim.incident?.length===size&&sim.visibility.every(v=>Number.isFinite(v)&&v>=0&&v<=1)&&sim.data.every(v=>Number.isFinite(v)&&v>=0)&&sim.incident.every(v=>Number.isFinite(v)&&v>0);
 if(!valid)return{iou:0,edgeF1:0,contrast:0,strayShadow:1,outsideShadow:1,accepted:false,reasons:['Ошибка численной проверки'],score:-1,physicalValidation:false};
 for(let y=0;y<sim.height;y++)for(let x=0;x<sim.width;x++){
  const k=y*sim.width+x,wx=((x+.5)/sim.width-.5)*sim.worldWidth+sim.centerX,wy=(.5-(y+.5)/sim.height)*sim.worldHeight+sim.centerY,ix=Math.floor(wx/d.pitch+d.ref.nx/2),iy=Math.floor(d.ref.ny/2-(wy-d.q.imageY)/d.pitch),a=+(sim.visibility[k]<.5);actual[k]=a;
  if(ix>=0&&iy>=0&&ix<d.ref.nx&&iy<d.ref.ny){inside[k]=1;const goal=d.ref.raw[iy*d.ref.nx+ix];expected[k]=goal;if(a&&goal)tp++;else if(a)fp++;else if(goal)fn++;else tn++;
   const v=(sim.data[k]+d.p.ambient)/(sim.incident[k]+d.p.ambient);if(goal){dark+=v;nd++;}else{light+=v;nl++;}
   if(Math.max(Math.abs(wx),Math.abs(wy))>B+guard){if(a&&goal)rtp++;else if(a)rfp++;else if(goal)rfn++;}else{basePixels++;baseLightPixels+=+!goal;}
  }else{outside++;outsideShadow+=1-sim.visibility[k];if(Math.abs(wx)>d.p.wallWidth/2+guard||Math.abs(wy-d.q.imageY)>d.height/2+guard){if(Math.max(Math.abs(wx),Math.abs(wy))>railRadius+guard){strayTotal++;stray+=1-sim.visibility[k];}}}
 }
 const goalMap=new Uint8Array(size),actualMap=new Uint8Array(size),goalEdges=[],actualEdges=[];
 for(let y=2;y<sim.height-2;y++)for(let x=2;x<sim.width-2;x++){const k=y*sim.width+x;if(inside[k]&&inside[k-1]&&inside[k-sim.width]){if(expected[k]!==expected[k-1]||expected[k]!==expected[k-sim.width]){goalMap[k]=1;goalEdges.push(k);}if(actual[k]!==actual[k-1]||actual[k]!==actual[k-sim.width]){actualMap[k]=1;actualEdges.push(k);}}}
 const tolerance=Math.max(1,Math.ceil(Math.max(d.q.penumbra*.6,d.pitch)*sim.width/d.scene.width)),near=(k,map)=>{const x=k%sim.width,y=(k/sim.width)|0;for(let dy=-tolerance;dy<=tolerance;dy++)for(let dx=-tolerance;dx<=tolerance;dx++){if(dx*dx+dy*dy<=tolerance*tolerance&&x+dx>=0&&x+dx<sim.width&&y+dy>=0&&y+dy<sim.height&&map[(y+dy)*sim.width+x+dx])return true;}return false;};
 const precision=actualEdges.filter(k=>near(k,goalMap)).length/Math.max(1,actualEdges.length),recall=goalEdges.filter(k=>near(k,actualMap)).length/Math.max(1,goalEdges.length),edgeF1=2*precision*recall/Math.max(1e-9,precision+recall),iou=tp/Math.max(1,tp+fp+fn),reachableIoU=rtp/Math.max(1,rtp+rfp+rfn),contrast=Math.max(0,(light/Math.max(1,nl)-dark/Math.max(1,nd))/(light/Math.max(1,nl)+dark/Math.max(1,nd)+1e-10)),strayShadow=stray/Math.max(1,strayTotal),coverage=d.ref.raw.reduce((a,b)=>a+b,0)/d.ref.raw.length;
 const reasons=[];if(![iou,edgeF1,contrast,strayShadow].every(Number.isFinite))reasons.push('Ошибка численной проверки');if(coverage<.02||coverage>.98)reasons.push('В референсе нет различимого силуэта');if(iou<.85)reasons.push('Слишком много потерь исходного рисунка');if(edgeF1<.8)reasons.push('Контуры недостаточно точны');if(contrast<.55)reasons.push('Недостаточный расчётный контраст');if(strayShadow>.02)reasons.push('Лишние тени вне рисунка и основания');if(d.p.composition==='surround'&&d.faceShares.some(v=>v<.04))reasons.push('Одна из четырёх стенок почти не участвует в рисунке');
 return{iou,edgeF1,precision,recall,contrast,strayShadow,faceShares:d.faceShares,leakage:strayShadow,outsideShadow:outsideShadow/Math.max(1,outside),reachableIoU,inaccessibleLightFraction:baseLightPixels/Math.max(1,basePixels),targetCoverage:coverage,accepted:reasons.length===0,reasons,score:.55*iou+.3*edgeF1+.15*contrast-2*strayShadow,source:'fixed raw target; all canonical pixels including base; outside expected light except unavoidable physical base/rear rail',physicalValidation:false};
}
