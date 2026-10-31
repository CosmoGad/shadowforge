// Serviceable, low-voltage mechanical package. Coordinates in mm; wall z=0.
import{extrude,rectangle,circle,surface,wallBetween,annulus}from'./projector-mesh.mjs?v=service-5';
import{makeGlareScreen,evaluateFrontScreen}from'./glare-screen.mjs?v=round-2';
const area=p=>p.reduce((s,a,i)=>{const b=p[(i+1)%p.length];return s+a[0]*b[1]-b[0]*a[1];},0)/2;
const cw=p=>area(p)<0?p:[...p].reverse(),ccw=p=>area(p)>0?p:[...p].reverse();
const ring=(x,y,r)=>circle(x,y,r,32,false),hole=(x,y,r)=>cw(ring(x,y,r));
const key=(a,b)=>a<b?a+'|'+b:b+'|'+a;
function volume(t){return t.reduce((s,a)=>s+(a[0]*(a[4]*a[8]-a[5]*a[7])+a[1]*(a[5]*a[6]-a[3]*a[8])+a[2]*(a[3]*a[7]-a[4]*a[6]))/6,0);}
const orient=t=>volume(t)>=0?t:t.map(a=>[...a.slice(0,3),...a.slice(6,9),...a.slice(3,6)]);
function atRect(w,h,x,y){return rectangle(w,h).map(p=>[p[0]+x,p[1]+y]);}
function rounded(w,h,r=2){const p=[];for(const[x,y,start]of[[w/2-r,h/2-r,0],[-w/2+r,h/2-r,90],[-w/2+r,-h/2+r,180],[w/2-r,-h/2+r,270]])for(let j=0;j<=6;j++){const a=(start+j*15)*Math.PI/180;p.push([x+r*Math.cos(a),y+r*Math.sin(a)]);}return ccw(p);}
function keyhole(x,y){const R=4.6,r=2.25,c=y-6,join=c+Math.sqrt(R*R-r*r),a=Math.acos(r/R),p=[];for(let j=0;j<=12;j++){const t=j/12*Math.PI;p.push([x+r*Math.cos(t),y+6+r*Math.sin(t)]);}for(let j=0;j<=40;j++){const t=Math.PI-a+j/40*(Math.PI+2*a);p.push([x+R*Math.cos(t),c+R*Math.sin(t)]);}return ccw(p);}
function tube(outer,inner,z0,z1,x=0,y=0){return extrude([ring(x,y,outer),hole(x,y,inner)],([a,b],f)=>[a,b,z0+f*(z1-z0)]);}
function cylinder(r,z0,z1,x=0,y=0,n=32){return extrude([circle(x,y,r,n,false)],([a,b],f)=>[a,b,z0+f*(z1-z0)]);}
function box(w,h,z0,z1,x=0,y=0){return extrude([atRect(w,h,x,y)],([a,b],f)=>[a,b,z0+f*(z1-z0)]);}
function beam(a,b,r=.7){const v=b.map((n,i)=>n-a[i]),length=Math.hypot(...v),n=v.map(x=>x/length),pick=Math.abs(n[2])<.9?[0,0,1]:[0,1,0],u=[n[1]*pick[2]-n[2]*pick[1],n[2]*pick[0]-n[0]*pick[2],n[0]*pick[1]-n[1]*pick[0]],ul=Math.hypot(...u),U=u.map(x=>x/ul),V=[n[1]*U[2]-n[2]*U[1],n[2]*U[0]-n[0]*U[2],n[0]*U[1]-n[1]*U[0]];return extrude([circle(0,0,r,8,false)],([x,y],f)=>a.map((q,i)=>q+U[i]*x+V[i]*y+v[i]*f));}
function wireMesh(points,r){return points.slice(1).flatMap((p,i)=>beam(points[i],p,r));}
function mapped(tris,face){return tris.map(t=>{const out=[];for(let k=0;k<9;k+=3){const[u,n,z]=t.slice(k,k+3),p=face===0?[n,u,z]:face===1?[-u,n,z]:face===2?[-n,-u,z]:[u,-n,z];out.push(...p);}return[...out.slice(0,3),...out.slice(6,9),...out.slice(3,6)];});}
function clip(B,t,face,round=false){const u=6,n0=B-10,n1=B-t-3,n2=B-t-(round?.8:.3),n3=B+.3,n4=B+2.3,z0=14,z1=16,z2=17.5,z3=20,tris=[];
 const outer=atRect(12,n1-n0,0,(n0+n1)/2),screw=hole(0,B-7,1.1);surface(tris,[outer,screw],z0,true);surface(tris,[outer,screw],z1);const walls=[];wallBetween(walls,outer,z0,z1);tris.push(...walls.filter(t=>![0,3,6].every(k=>Math.abs(t[k+1]-n1)<1e-7)));wallBetween(tris,ccw(screw),z0,z1,true);
 // Shared interface is omitted, forming one connected U clip, not overlapping boxes.
 const profile=ccw(round?[[n1,z0],[n2,z0],[n2,z2],[n4,z2],[n4,z3],[n1,z3],[n1,z1]]:[[n1,z0],[n2,z0],[n2,z2],[n3,z2],[n3,z0],[n4,z0],[n4,z3],[n1,z3],[n1,z1]]),arch=orient(extrude([profile],([n,z],f)=>[u-2*u*f,n,z]));
 for(const tri of arch){if([0,3,6].every(k=>Math.abs(tri[k+1]-n1)<1e-7&&tri[k+2]<=z1+1e-7))continue;tris.push(tri);}return mapped(tris,face);
}
export function makeServiceParts(p){
 const B=p.bodySide/2,S=p.sourceZ,lift=p.filamentLift??12,od=p.socketDiameter??10.6,sh=p.socketHeight??13.2,cable=p.cableDiameter??2.8,pcbTop=S-lift-sh,pcbBottom=pcbTop-1.6,platformBottom=pcbBottom-2.4,deckBottom=11,deckTop=14,corner=p.bodyShape==='round'?(B-12)/Math.sqrt(2):B-20,clampY=-(B-28),gap=cable-.15,clampBottom=3+gap,slack=Math.ceil(Math.max(150,pcbTop-deckTop+40)/10)*10;
 if(![B,S,lift,od,sh,cable].every(Number.isFinite)||B<60||B>105||lift<8||lift>20||od<9||od>14||sh<10||sh>20||cable<2||cable>3.5||platformBottom<deckTop+30)throw Error('Проверьте размеры сервисного узла.');
 const corners=[[-corner,-corner],[corner,-corner],[corner,corner],[-corner,corner]],keys=[[-B*.45,B-32],[B*.45,B-32]],lock=[0,-(B-16)],outer=p.bodyShape==='round'?circle(0,0,B,180,false):rounded(p.bodySide,p.bodySide,2),back=[],deck=[],carrier=[],parts=[],purchased=[];
 const keyloops=keys.map(([x,y])=>keyhole(x,y)),hexes=corners.map(([x,y])=>circle(x,y,3.3,6,false)),posts=corners.map(([x,y])=>ring(x,y,6)),cornerHoles=corners.map(([x,y])=>hole(x,y,1.7)),clampCenters=[[-7,clampY],[7,clampY]];
 surface(back,[outer,...hexes.map(cw),...keyloops.map(cw),hole(...lock,2.25)],0,true);
 surface(back,[outer,...posts.map(cw),...keyloops.map(cw),hole(...lock,2.25),...clampCenters.map(([x,y])=>hole(x,y,2.5))],3);wallBetween(back,outer,0,3);
 for(const h of keyloops)wallBetween(back,h,0,3,true);wallBetween(back,ring(...lock,2.25),0,3,true);
 for(let i=0;i<corners.length;i++){const[x,y]=corners[i];wallBetween(back,hexes[i],0,2.5,true);surface(back,[hexes[i],cornerHoles[i]],2.5,true);wallBetween(back,ring(x,y,1.7),2.5,11,true);wallBetween(back,posts[i],3,11);annulus(back,x,y,1.7,6,11);}
 for(const[x,y]of clampCenters){wallBetween(back,ring(x,y,2.5),3,clampBottom);wallBetween(back,ring(x,y,.8),1.2,clampBottom,true);surface(back,[ring(x,y,.8)],1.2);annulus(back,x,y,.8,2.5,clampBottom);}
 const carrierBolts=[[-16,0],[16,0]],clipCenters=Array.from({length:4},(_,f)=>f===0?[B-7,0]:f===1?[0,B-7]:f===2?[-B+7,0]:[0,-B+7]),deckHoles=[...carrierBolts.map(([x,y])=>hole(x,y,1.7)),hole(0,0,7.5),hole(...lock,5.25)],deckTopHoles=[...deckHoles,...corners.map(([x,y])=>hole(x,y,3.5)),...clipCenters.map(([x,y])=>hole(x,y,.8))];
 surface(deck,[outer,...deckHoles,...cornerHoles],deckBottom,true);surface(deck,[outer,...deckTopHoles],deckTop);wallBetween(deck,outer,deckBottom,deckTop);
 for(const h of deckHoles)wallBetween(deck,ccw(h),deckBottom,deckTop,true);
 for(const[x,y]of corners){wallBetween(deck,ring(x,y,3.5),14,16);wallBetween(deck,ring(x,y,1.7),11,16,true);annulus(deck,x,y,1.7,3.5,16);}
 for(const[x,y]of clipCenters){wallBetween(deck,ring(x,y,.8),11.5,14,true);surface(deck,[ring(x,y,.8)],11.5);}
 // Replaceable carrier: axial M3 bolts, accessible bore, PCB support and cap pilots.
 const flange=rounded(42,28,3),shaft=ring(0,0,11),inner=ring(0,0,7),platform=rounded(26,30,2),pcbMounts=[[0,-10.5],[0,10.5]],capMounts=[[-4.5,-13],[4.5,-13]];
 surface(carrier,[flange,cw(inner),...carrierBolts.map(([x,y])=>hole(x,y,1.7))],14,true);surface(carrier,[flange,cw(shaft),...carrierBolts.map(([x,y])=>hole(x,y,1.7))],18);wallBetween(carrier,flange,14,18);for(const[x,y]of carrierBolts)wallBetween(carrier,ring(x,y,1.7),14,18,true);
 wallBetween(carrier,shaft,18,platformBottom);surface(carrier,[platform,cw(shaft),...capMounts.map(([x,y])=>hole(x,y,.8))],platformBottom,true);wallBetween(carrier,platform,platformBottom,pcbBottom);
 surface(carrier,[platform,cw(inner),...pcbMounts.map(([x,y])=>hole(x,y,.8))],pcbBottom);wallBetween(carrier,inner,14,pcbBottom,true);
 for(const[x,y]of pcbMounts){wallBetween(carrier,ring(x,y,.8),platformBottom+.4,pcbBottom,true);surface(carrier,[ring(x,y,.8)],platformBottom+.4);}
 for(const[x,y]of capMounts){wallBetween(carrier,ring(x,y,.8),platformBottom,platformBottom+2.2,true);surface(carrier,[ring(x,y,.8)],platformBottom+2.2,true);}
 const strain=extrude([atRect(20,8,0,clampY),...clampCenters.map(([x,y])=>hole(x,y,1.1))],([x,y],f)=>[x,y,clampBottom+f*2]);
 const plug=[];surface(plug,[ring(...lock,6.5)],14);surface(plug,[ring(...lock,5.1)],11.2,true);wallBetween(plug,ring(...lock,5.1),11.2,14);annulus(plug,...lock,5.1,6.5,14,true);wallBetween(plug,ring(...lock,6.5),14,15.6);surface(plug,[ring(...lock,6.5)],15.6);
 // Remove the internal disk; the flange underside is an annulus.
 const plugFixed=plug.filter(t=>![0,3,6].every(k=>Math.abs(t[k+2]-14)<1e-8&&Math.hypot(t[k]-lock[0],t[k+1]-lock[1])<=6.50001));
 annulus(plugFixed,...lock,5.1,6.5,14,false);
 parts.push({name:'service-backplate',triangles:orient(back)},{name:'optical-deck',triangles:orient(deck)},{name:'socket-carrier',triangles:orient(carrier)},{name:'cable-clamp',triangles:orient(strain)},{name:'mount-access-plug',triangles:orient(plugFixed)});
 for(let face=0;face<4;face++)parts.push({name:'panel-clip-'+(face+1),triangles:orient(clip(B,p.thickness,face,p.bodyShape==='round'))});
 const socket=extrude([ring(0,0,od/2)],([x,y],f)=>[x,y,pcbTop+f*sh]),pcb=extrude([atRect(18,26,0,0),...pcbMounts.map(([x,y])=>hole(x,y,1.1)),hole(-5,0,.8),hole(5,0,.8)],([x,y],f)=>[x,y,pcbBottom+1.6*f]);purchased.push({name:'socket-pcb',triangles:pcb});
 for(const[x,y]of corners)purchased.push({name:'M3-deck-screw-'+purchased.length,triangles:[...cylinder(1.5,0,16,x,y),...cylinder(3,16,18,x,y)]});
 for(const[x,y]of carrierBolts)purchased.push({name:'M3-carrier-screw-'+purchased.length,triangles:[...cylinder(1.5,8,18,x,y),...cylinder(3,18,20,x,y)]});
 const zEntry=3+cable/2,zLoop=6.6,R=Math.min(B-16,(slack-12)/(Math.PI*1.7)),points=[[28,-B-20,zEntry],[28,clampY-6,zEntry],[6,clampY-6,zEntry]];for(let i=1;i<=12;i++){const a=-Math.PI/2-i/12*Math.PI/2;points.push([6+6*Math.cos(a),clampY+6*Math.sin(a),zEntry]);}points.push([0,clampY+6,zEntry],[0,-R,zLoop]);for(let i=1;i<=42;i++){const a=-Math.PI/2+i/42*Math.PI*1.7;points.push([R*Math.cos(a),R*Math.sin(a),zLoop]);}points.push([-12,0,zLoop],[-7.5,0,5.2]);for(let i=1;i<=12;i++){const a=i/12*Math.PI/2;points.push([-7.5*Math.cos(a),0,5.2+7.5*Math.sin(a)]);}points.push([0,0,pcbBottom-23]);
 const normals=[];for(let i=0;i<points.length;i++){const a=points[Math.max(0,i-1)],b=points[Math.min(points.length-1,i+1)],v=b.map((q,k)=>q-a[k]),l=Math.hypot(...v),n=v.map(q=>q/l);let side=[n[1],-n[0],0];if(Math.hypot(...side)<.05){const prev=normals.at(-1)||[1,0,0],dot=prev.reduce((q,v,k)=>q+v*n[k],0);side=prev.map((v,k)=>v-dot*n[k]);}const length=Math.hypot(...side);normals.push(side.map(v=>v/length));}
 const wires=[{name:'service-wire-positive',color:'#cf3e38',radius:.6,points:points.map((p,i)=>p.map((v,k)=>v+.8*normals[i][k]))},{name:'service-wire-negative',color:'#263344',radius:.6,points:points.map((p,i)=>p.map((v,k)=>v-.8*normals[i][k]))}];
 for(const wire of wires)purchased.push({name:wire.name,triangles:wireMesh(wire.points,wire.radius)});purchased.push({name:'2-pin-service-plug',triangles:box(8,6,pcbBottom-23,pcbBottom-15)});
 for(const x of[-5,5]){const path=[[x<0?-1.5:1.5,0,pcbBottom-15],[x,0,pcbTop-4],[x,0,pcbTop]];wires.push({name:x<0?'socket-module-negative':'socket-module-positive',radius:.6,points:path});purchased.push({name:'socket-pin-'+x,triangles:wireMesh(path,.6)});}
 let glare=null;if(p.glareScreen){glare=makeGlareScreen({...p,platformBottom});parts.push(...glare.parts);}
 const service={version:1,deckBottom,deckTop,backGap:8,platformBottom,pcbBottom,pcbTop,filamentLift:lift,filamentMeasured:false,socketDiameter:od,socketHeight:sh,wireDiameter:cable,clampGap:gap,compressionAssumed:cable-gap,serviceSlackMM:slack,boreDiameter:14,deckHoleDiameter:15,connectorMaxDiagonal:10,pcbSize:[18,26,1.6],pcbMounts,pcbPinCenters:[[-5,0],[5,0]],pcbPinHoleDiameter:1.6,capMounts,wallMount:{keyholes:keys.map(([x,y])=>({x,y,entry:[x,y-6],seat:[x,y+6],entryDiameter:9.2,neckDiameter:4.5,drop:12})),lock,lockHole:4.5,toolHole:10.5,headGap:3.6,anchorsMeasured:false},panelClips:clipCenters,wallMountPartNames:['service-backplate'],explode:{'service-backplate':[0,0,-25],'optical-deck':[0,0,15],'socket-carrier':[0,0,50],'cable-clamp':[0,-20,-5],'glare-screen':[0,0,70],'glare-bracket':[0,-25,35]},glare:glare?.validation||null,physicalTested:false,thermalTested:false};
 if(glare)service.glareAudit=evaluateFrontScreen({...p,platformBottom},glare.parts);
 return{parts,purchased,socket,wires,service,baseTop:deckTop,base:deck,holder:carrier,mount:{seatZ:pcbTop,topZ:pcbTop+sh,socketRadius:od/2,outerRadius:15,shadowFitsBase:false}};
}
