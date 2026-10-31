// Reverse-facing E10 module carried by the front plate. Millimetres; wall z=0.
// The cup clips a radial field. Supports and supply wires are deliberately
// supplied by the caller, so they cannot silently disappear from ray tracing.
import {circle,rectangle,extrude,surface,wallBetween} from './projector-mesh.mjs?v=service-5';

const loop=(x,y,r,n=32)=>circle(x,y,r,n,false);
const hole=p=>[...p].reverse();
const atRect=(w,h,x=0,y=0)=>rectangle(w,h).map(p=>[p[0]+x,p[1]+y]);
const disk=(r,z0,z1,x=0,y=0)=>extrude([loop(x,y,r)],([a,b],f)=>[a,b,z0+f*(z1-z0)]);
function steppedScrew(x,y,zUnderHead,length=4){
 const out=[],head=loop(x,y,1.8),shaft=loop(x,y,1);
 surface(out,[head],zUnderHead-1.6,true);wallBetween(out,head,zUnderHead-1.6,zUnderHead);
 surface(out,[head,hole(shaft)],zUnderHead);wallBetween(out,shaft,zUnderHead,zUnderHead+length);surface(out,[shaft],zUnderHead+length);
 return out;
}

/**
 * @returns {{parts:Array,purchased:Array,socket:Array,sourceAperture:object,
 * service:object,sourceZ:number,frontZ:number,diskBack:number}}
 * frontZ is the OUTERMOST face of the opaque printed disk, before decoration.
 */
export function makeConceptSource(p={}, {fieldRadius,mountAngles=[90,102]}={}){
 const D=p.bodySide??160,S=p.sourceZ??140,lift=p.filamentLift??12,
  sh=p.socketHeight??13.2,od=p.socketDiameter??10.6,emitter=p.emitter??1.2;
 for(const [name,v] of Object.entries({D,S,lift,sh,od,emitter,fieldRadius}))
  if(typeof v!=='number'||!Number.isFinite(v))throw Error('Invalid concept source parameter: '+name);
 if(D<100||D>210||S<90||S>220||lift<8||lift>20||sh<10||sh>20||od<9||od>14||emitter<0||emitter>5)
  throw Error('Concept source dimensions outside the supported range.');
 const B=D/2,a=.66*B,outerRadius=a+2,e=emitter/2;
 if(fieldRadius<=B+4)throw Error('The illuminated field must extend beyond the lamp body.');
 if(!Array.isArray(mountAngles)||mountAngles.length!==2||!mountAngles.every(Number.isFinite))
  throw Error('Exactly two finite front-module mount angles are required.');
 // The nearest source sample to the aperture edge is fully blocked at R_zero.
 const h=S*(a+e)/(fieldRadius+e),lipZ=S-h;
 const pcbTop=S+lift+sh,pcbBottom=pcbTop+1.6,diskBack=pcbBottom+4.2,frontZ=diskBack+3;
 const postZ=pcbBottom,pilotDepth=2.4,pilotTop=postZ+pilotDepth,postR=3.2,pilotR=.8;
 const pcbMounts=[[0,-10.5],[0,10.5]],pinCenters=[[-5,0],[5,0]];
 const mountRadialPosition=outerRadius+6,mountPostR=3,mountBottom=diskBack-4,mountPilotTop=diskBack+1.5;
 const mounts=mountAngles.map(angle=>{const radians=angle*Math.PI/180,xy=[mountRadialPosition*Math.cos(radians),mountRadialPosition*Math.sin(radians)];return {
  angleDegrees:angle,center:xy,xy,radius:mountPostR,radialPosition:mountRadialPosition,
  z:[mountBottom,diskBack],pilotRadius:.8,pilotDiameter:1.6,
  pilotZ:[mountBottom,mountPilotTop],pilotDepth:5.5,frontSkin:1.5,
  footContactZ:mountBottom,footThickness:3,fastener:'M2x8 with 0.5 mm washer',
  nominalPilotEngagement:4.5,screwAxis:[0,0,1]
 };});
 if(Math.hypot(mounts[0].xy[0]-mounts[1].xy[0],mounts[0].xy[1]-mounts[1].xy[1])<2*mountPostR+.2)
  throw Error('Front-module mount bosses overlap; increase their angular separation.');
 const mountPosts=mounts.map(m=>loop(...m.xy,mountPostR));
 const big=loop(0,0,B,180),outer=loop(0,0,outerRadius,180),inner=loop(0,0,a,180),
  posts=pcbMounts.map(([x,y])=>loop(x,y,postR)),cap=[];

 // One joined shell: back annulus, outer/inner walls, front disk and its posts.
 // No caps are left across the cup-to-disk or post-to-disk interfaces.
 surface(cap,[outer,hole(inner)],lipZ,true);
 wallBetween(cap,outer,lipZ,diskBack);wallBetween(cap,inner,lipZ,diskBack,true);
 surface(cap,[big,hole(outer),...mountPosts.map(hole)],diskBack,true);
 surface(cap,[inner,...posts.map(hole)],diskBack,true);
 wallBetween(cap,big,diskBack,frontZ);surface(cap,[big],frontZ);
 for(let i=0;i<posts.length;i++){
  const [x,y]=pcbMounts[i],pilot=loop(x,y,pilotR);
  surface(cap,[posts[i],hole(pilot)],postZ,true);wallBetween(cap,posts[i],postZ,diskBack);
  wallBetween(cap,pilot,postZ,pilotTop,true);surface(cap,[pilot],pilotTop,true);
 }
 for(let i=0;i<mounts.length;i++){
  const pilot=loop(...mounts[i].xy,.8);
  surface(cap,[mountPosts[i],hole(pilot)],mountBottom,true);
  wallBetween(cap,mountPosts[i],mountBottom,diskBack);
  wallBetween(cap,pilot,mountBottom,mountPilotTop,true);
  surface(cap,[pilot],mountPilotTop,true);
 }

 const socket=disk(od/2,S+lift,S+lift+sh),
  pcb=extrude([atRect(18,26),...pcbMounts.map(([x,y])=>hole(loop(x,y,1.1))),
   ...pinCenters.map(([x,y])=>hole(loop(x,y,.8)))],([x,y],f)=>[x,y,pcbTop+f*1.6]);
 const purchased=[{name:'socket-pcb',triangles:pcb,nominal:true}];
 for(let i=0;i<pcbMounts.length;i++){
  const [x,y]=pcbMounts[i];
  purchased.push({name:'concept-PCB-screw-'+(i+1),triangles:steppedScrew(x,y,pcbTop-.5),spec:'M2x4, nominal unthreaded envelope'});
  purchased.push({name:'concept-PCB-washer-'+(i+1),triangles:extrude([loop(x,y,2.1),hole(loop(x,y,1.1))],([a,b],f)=>[a,b,pcbTop-.5+f*.5]),spec:'0.5 mm washer'});
 }
 for(let i=0;i<pinCenters.length;i++){
  const [x,y]=pinCenters[i];purchased.push({name:'socket-pin-'+(i+1),triangles:disk(.45,pcbTop-.6,pcbBottom+1.5,x,y),nominal:true});
 }
 for(let i=0;i<mounts.length;i++){
  const [x,y]=mounts[i].xy,underHead=mountBottom-3-.5;
  purchased.push({name:'concept-cap-mount-screw-'+(i+1),triangles:steppedScrew(x,y,underHead,8),spec:'M2x8, nominal unthreaded envelope'});
  purchased.push({name:'concept-cap-mount-washer-'+(i+1),triangles:extrude([loop(x,y,2.1),hole(loop(x,y,1.1))],([a,b],f)=>[a,b,underHead+f*.5]),spec:'0.5 mm washer'});
 }
 const sourceAperture={radius:a,outerRadius,z:lipZ,h,
  fieldFullRadius:Math.max(0,(S*a-(S-h)*e)/h),fieldZeroRadius:fieldRadius,
  fieldNominalRadius:S*a/h,emitterRadius:e,geometryModelled:true};
 const service={version:2,type:'reversed-E10-front-module',reversedE10:true,
  sourceZ:S,frontZ,diskBack,pcbTop,pcbBottom,pcbSize:[18,26,1.6],pcbMounts,
  pcbPinCenters:pinCenters,pcbPinHoleDiameter:1.6,filamentLift:lift,
  filamentMeasured:false,socketDiameter:od,socketHeight:sh,
  socketZ:[S+lift,S+lift+sh],sourceAperture,
  postRadius:postR,postBottomZ:postZ,pilotDiameter:pilotR*2,pilotDepth,
  pcbFasteners:'2 x M2x4 with 0.5 mm washers, installed from the lamp-facing side',mounts,
  nominalPilotEngagement:1.9,frontPlateThickness:3,cupWallThickness:2,
  frontOpaque:true,frontThroughFasteners:false,supportsIncluded:false,wiresIncluded:false,
  glassModelled:false,nominalGlassWallSideTipZ:S-6,
  physicalTested:false,thermalTested:false,threadRetentionTested:false};
 return {parts:[{name:'glare-cap',triangles:cap}],purchased,socket,sourceAperture,mounts,
  service,sourceZ:S,frontZ,diskBack};
}
