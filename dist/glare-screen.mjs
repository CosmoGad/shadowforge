// Front anti-glare screen and a single removable support, in the same millimetre
// coordinates used by the exact sidewall light simulation.
import {extrude,rectangle,circle,surface,wallBetween,buildBVH,occluded} from './projector-mesh.mjs?v=service-5';
import {sourceSamples} from './core.mjs';
const area=p=>p.reduce((s,a,i)=>{const b=p[(i+1)%p.length];return s+a[0]*b[1]-b[0]*a[1];},0)/2;
const ccw=p=>area(p)>0?p:[...p].reverse();
const rotate=(t,a)=>{const c=Math.cos(a),s=Math.sin(a),r=[];for(let i=0;i<9;i+=3)r.push(t[i]*c-t[i+1]*s,t[i]*s+t[i+1]*c,t[i+2]);return r;};
export function makeGlareScreen(p={}){
 const sourceZ=p.sourceZ??140,platformBottom=p.platformBottom??sourceZ-29.2,angle=p.shieldAngle??0,gap=p.shieldGap??16,size=p.shieldSize??52,thickness=3;
 for(const [key,value]of Object.entries({sourceZ,platformBottom,angle,gap,size}))if(typeof value!=='number'||!Number.isFinite(value))throw new Error('Invalid glare-screen parameter: '+key);
 if(sourceZ<90||sourceZ>220||angle<0||angle>=360||gap<16||gap>24||size<52||size>64)throw new Error('Glare-screen parameter outside supported range.');
 const S=sourceZ,zFoot0=platformBottom-2.4,zFoot1=platformBottom,zTab1=S+gap,zTab0=zTab1-5,zNutTop=zTab1-2.4;if(platformBottom<S-50||platformBottom>S-20)throw new Error('Glare bracket platform height outside supported range.');
 // The two M2 foot clearances fit matching underside platform pilots. The
 // centre strip of its rear side is intentionally open for the joined arch.
 const footOuter=ccw([[-7,-15],[-1.5,-15],[1.5,-15],[7,-15],[7,-11],[-7,-11]]),foot=extrude([footOuter,circle(-4.5,-13,1.1),circle(4.5,-13,1.1)],([x,y],f)=>[x,y,zFoot0+f*(zFoot1-zFoot0)]);
 const footOpen=foot.filter(t=>!([1,4,7].every(i=>Math.abs(t[i]+15)<1e-7)&&[0,3,6].every(i=>Math.abs(t[i])<=1.500001)));
 const yz=ccw([[-15,zFoot0],[-30,S-9],[-30,zTab0],[-27,zTab0],[-27,S-8],[-15,zFoot1]]),arch=extrude([yz],([y,z],f)=>[-1.5+f*3,y,z]);
 const archOpen=arch.filter(t=>!([1,4,7].every(i=>Math.abs(t[i]+15)<1e-7)||[2,5,8].every(i=>Math.abs(t[i]-zTab0)<1e-7)));
 // The tab bottom has an open rectangular interface shared with the arch.
 const tabOuter=ccw([[-6,-31],[6,-31],[6,-16.5],[-6,-16.5]]),clearance=circle(0,-21.5,1.7),nutPocket=circle(0,-21.5,5.8/Math.sqrt(3),6),join=ccw([[-1.5,-30],[1.5,-30],[1.5,-27],[-1.5,-27]]).reverse(),tab=[];
 surface(tab,[tabOuter,nutPocket,join],zTab0,true);surface(tab,[tabOuter,clearance],zTab1);surface(tab,[[...nutPocket].reverse(),clearance],zNutTop,true);wallBetween(tab,tabOuter,zTab0,zTab1);wallBetween(tab,nutPocket,zTab0,zNutTop);wallBetween(tab,clearance,zNutTop,zTab1);
 const bracket=[...footOpen,...archOpen,...tab],cap=extrude([rectangle(size,size),circle(0,-21.5,1.7)],([x,y],f)=>[x,y,S+gap+f*thickness]),radians=angle*Math.PI/180;
 const xy=([x,y])=>[x*Math.cos(radians)-y*Math.sin(radians),x*Math.sin(radians)+y*Math.cos(radians)];
 const parts=[{name:'glare-bracket',triangles:bracket.map(t=>rotate(t,radians)),printHint:'On its side with local supports under the narrow arch; inspect the slicer preview.'},{name:'glare-cap',triangles:cap.map(t=>rotate(t,radians)),printHint:'Flat front face on the bed; remove cap before changing bulb.'}];
 return {parts,parameters:{sourceZ:S,shieldAngle:angle,shieldSize:size,shieldGap:gap,shieldThickness:thickness,capZ:[S+gap,S+gap+thickness],nominalGlassTipZ:S+6,nominalGlassClearance:gap-6,foot:{holeDiameter:2.2,holes:[[-4.5,-13],[4.5,-13]].map(xy),z:[zFoot0,zFoot1],platformContactZ:zFoot1,fasteners:'2 x M2x5 with 0.5 mm washers; longer screws may reach the PCB',prototypeEngagement:2.1},frontFastener:{type:'M3 thumb screw',clearanceDiameter:3.4,nut:'M3 hex nut',nutPocketAcrossFlats:5.8,nutPocketDepth:2.6,antiRotationPocket:true,axis:'z',xy:xy([0,-21.5]),prototypeLength:8},platformPilotRotationRequired:angle!==0,bulbRemovalClearanceDiameter:32,service:'Insert M3 nut from the rear into its anti-rotation pocket before fitting the cap. Undo front M3 screw and lift the cap forward; sidewalls and socket carrier stay assembled.'},validation:{physical:false,thermal:false,threadRetention:false,glassEnvelopeNominal:true,frontConeVerified:false,allViewingAngles:false}};
}

/** Direct-emitter audit only: opaque screen, no glass or reflected-light model. */
export function evaluateFrontScreen(p,parts,options={}){
 const S=p.sourceZ??140,r=(p.emitter??1.2)/2,D=options.distance??2000,yaw=options.yaw??40,pitch=options.pitch??30,gap=p.shieldGap??16,size=p.shieldSize??52,angle=(p.shieldAngle??0)*Math.PI/180;
 if(![S,r,D,yaw,pitch,gap,size,angle].every(Number.isFinite)||D<=S+gap+3||r<0||yaw<0||yaw>=80||pitch<0||pitch>=80)throw new Error('Invalid direct-glare viewing cone.');
 const t=gap/(D-S),x=(1-t)*r+t*D*Math.tan(yaw*Math.PI/180),y=(1-t)*r+t*D*Math.tan(pitch*Math.PI/180),u=x*Math.abs(Math.cos(angle))+y*Math.abs(Math.sin(angle)),v=x*Math.abs(Math.sin(angle))+y*Math.abs(Math.cos(angle)),holeDistance=Math.max(0,21.5-v),continuousConeCovered=u<size/2&&v<size/2&&holeDistance>1.7;
 const bvh=buildBVH(parts.flatMap(part=>part.triangles)),samples=sourceSamples(r*2,25);let visibleEmitterSamples=0,poses=0;
 for(let a=-yaw;a<=yaw+1e-8;a+=yaw?yaw/4:1)for(let b=-pitch;b<=pitch+1e-8;b+=pitch?pitch/3:1){const eye=[D*Math.tan(a*Math.PI/180),D*Math.tan(b*Math.PI/180),D];poses++;for(const[dx,dy]of samples){const source=[dx,dy,S];visibleEmitterSamples+=+!occluded(bvh,source,eye.map((q,i)=>q-source[i]));}}
 return{passed:continuousConeCovered&&visibleEmitterSamples===0,continuousConeCovered,visibleEmitterSamples,poses,samplesPerPose:samples.length,distanceMM:D,yawDegrees:yaw,pitchDegrees:pitch,screenFootprintHalfSizeMM:[u,v],screenHalfSizeMM:size/2,holeClearanceMM:holeDistance-1.7,scope:'Direct filament visibility within the stated frontal cone; side views, reflections, translucency, glass and heat are not certified.'};
}
