import {buildBVH,occluded} from './projector-mesh.mjs?v=projector-5';
import {sourceSamples} from './core.mjs';

const dot=(a,b)=>a[0]*b[0]+a[1]*b[1]+a[2]*b[2];
const clamp01=x=>Math.max(0,Math.min(1,x));

function boxNear(box,o,dir,limit){
 let lo=0,hi=limit;
 for(let axis=0;axis<3;axis++){
  if(Math.abs(dir[axis])<1e-14){if(o[axis]<box.min[axis]||o[axis]>box.max[axis])return Infinity;continue;}
  let a=(box.min[axis]-o[axis])/dir[axis],b=(box.max[axis]-o[axis])/dir[axis];
  if(a>b)[a,b]=[b,a];lo=Math.max(lo,a);hi=Math.min(hi,b);if(lo>hi)return Infinity;
 }
 return lo;
}

// Moller-Trumbore distance along the finite eye -> wall segment.
function triangleDistance(t,o,d,limit){
 const h=[d[1]*t.e2[2]-d[2]*t.e2[1],d[2]*t.e2[0]-d[0]*t.e2[2],d[0]*t.e2[1]-d[1]*t.e2[0]],det=dot(t.e1,h);
 if(Math.abs(det)<1e-12)return Infinity;
 const s=[o[0]-t.a[0],o[1]-t.a[1],o[2]-t.a[2]],u=dot(s,h)/det;
 if(u<0||u>1)return Infinity;
 const q=[s[1]*t.e1[2]-s[2]*t.e1[1],s[2]*t.e1[0]-s[0]*t.e1[2],s[0]*t.e1[1]-s[1]*t.e1[0]],v=dot(d,q)/det;
 if(v<0||u+v>1)return Infinity;
 const distance=dot(t.e2,q)/det;
 return distance>1e-9&&distance<limit?distance:Infinity;
}

function nearestHit(bvh,o,dir){
 let distance=1-1e-9,id=-1;
 const stack=[bvh.root];
 while(stack.length){
  const node=stack.pop();if(boxNear(node,o,dir,distance)===Infinity)continue;
  if(node.ids){for(const candidate of node.ids){const t=triangleDistance(bvh.records[candidate],o,dir,distance);if(t<distance){distance=t;id=candidate;}}}
  else{
   const left=boxNear(node.left,o,dir,distance),right=boxNear(node.right,o,dir,distance);
   // The closer child goes last and is visited first, allowing earlier pruning.
   if(left<right){if(right!==Infinity)stack.push(node.right);if(left!==Infinity)stack.push(node.left);}
   else{if(left!==Infinity)stack.push(node.left);if(right!==Infinity)stack.push(node.right);}
  }
 }
 if(id<0)return null;
 return{id,distance,point:o.map((v,k)=>v+dir[k]*distance),normal:bvh.records[id].normal};
}

function validate(d,sim,options){
 if(!Array.isArray(d?.triangles)||!d.triangles.length)throw new Error('Camera view requires non-empty physical triangles.');
 if(!Number.isFinite(d.p?.sourceZ)||d.p.sourceZ<=0||!Number.isFinite(d.p?.emitter)||d.p.emitter<0)throw new Error('Camera view requires a finite positive source position and finite emitter size.');
 if(!Number.isInteger(sim?.width)||!Number.isInteger(sim?.height)||sim.width<1||sim.height<1||sim.width*sim.height>4_000_000)throw new Error('Invalid camera raster dimensions.');
 const count=sim.width*sim.height;
 if(sim.data?.length!==count||sim.incident?.length!==count||sim.visibility?.length!==count||![sim.worldWidth,sim.worldHeight,sim.centerX,sim.centerY].every(Number.isFinite)||sim.worldWidth<=0||sim.worldHeight<=0)throw new Error('Invalid wall-radiance contract.');
 if(!sim.data.every(v=>Number.isFinite(v)&&v>=0)||!sim.incident.every(v=>Number.isFinite(v)&&v>0)||!sim.visibility.every(v=>Number.isFinite(v)&&v>=0&&v<=1))throw new Error('Camera input contains invalid radiance or visibility.');
 for(const key of ['angleX','angleY','bodyReflectance','wallReflectance','lightingSamples'])if(!Number.isFinite(options[key]))throw new Error('Invalid camera option: '+key);
 if(options.distance!==Infinity&&!Number.isFinite(options.distance))throw new Error('Camera distance must be finite or Infinity.');
 if(Math.abs(options.angleX)>=80||Math.abs(options.angleY)>=80||options.bodyReflectance<0||options.bodyReflectance>1||options.wallReflectance<=0||options.wallReflectance>1||!Number.isInteger(options.lightingSamples)||options.lightingSamples<1||options.lightingSamples>256)throw new Error('Camera options outside supported range.');
 if(options.distance===Infinity&&(options.angleX||options.angleY))throw new Error('Orthographic mode currently requires zero view angles.');
}

/**
 * Frontal, wall-registered camera visibility and direct diffuse body lighting.
 * Angles are degrees; distance is the eye's z coordinate in millimetres.
 * Both wall and body are Lambertian: L = rho E / pi. Since sim.data omits
 * wall albedo/pi, the body is expressed in the same units with rhoBody/rhoWall.
 * No extra cosine to the camera is applied to Lambertian radiance.
 * Glass, direct camera emission from the filament and secondary bounces are absent.
 */
export function traceView(d,sim,options={}){
 const opt={distance:2000,angleX:0,angleY:0,bodyReflectance:.02,wallReflectance:.8,lightingSamples:25,...options};
 validate(d,sim,opt);
 const bvh=buildBVH(d.triangles);
 let maxZ=-Infinity;
 for(const record of bvh.records){
  const n=[record.e1[1]*record.e2[2]-record.e1[2]*record.e2[1],record.e1[2]*record.e2[0]-record.e1[0]*record.e2[2],record.e1[0]*record.e2[1]-record.e1[1]*record.e2[0]],length=Math.hypot(...n);
  if(!Number.isFinite(length)||length<1e-14)throw new Error('Camera geometry contains a degenerate triangle.');
  record.normal=n.map(v=>v/length);maxZ=Math.max(maxZ,record.max[2]);
 }
 if(opt.distance!==Infinity&&opt.distance<=maxZ+1)throw new Error('Camera must be in front of the complete physical assembly.');
 const radians=Math.PI/180,eye=opt.distance===Infinity?null:[opt.distance*Math.tan(opt.angleX*radians),opt.distance*Math.tan(opt.angleY*radians),opt.distance],orthoZ=maxZ+Math.max(sim.worldWidth,sim.worldHeight,100),epsilon=Math.max(1e-5,sim.worldWidth*1e-7),ratio=opt.bodyReflectance/opt.wallReflectance;
 const data=sim.data.slice(),visibility=sim.visibility.slice(),bodyMask=new Uint8Array(data.length),bodyIrradiance=new Float32Array(data.length),bodyDepthZ=new Float32Array(data.length),samples=sourceSamples(d.p.emitter,opt.lightingSamples);
 let hitPixels=0,backFaceHits=0;
 for(let y=0;y<sim.height;y++)for(let x=0;x<sim.width;x++){
  const k=y*sim.width+x,wx=((x+.5)/sim.width-.5)*sim.worldWidth+sim.centerX,wy=(.5-(y+.5)/sim.height)*sim.worldHeight+sim.centerY,o=eye||[wx,wy,orthoZ],dir=eye?[wx-eye[0],wy-eye[1],-eye[2]]:[0,0,-orthoZ],hit=nearestHit(bvh,o,dir);
  if(!hit)continue;
  hitPixels++;bodyMask[k]=1;bodyDepthZ[k]=hit.point[2];
  const towardEye=o.map((v,i)=>v-hit.point[i]);if(dot(hit.normal,towardEye)<-1e-7)backFaceHits++;
  let irradiance=0;
  // First-hit surface shadow rays use the same BVH as the wall simulation.
  for(const [dx,dy]of samples){
   const source=[dx,dy,d.p.sourceZ],toSource=source.map((v,i)=>v-hit.point[i]),r2=dot(toSource,toSource),r=Math.sqrt(r2);
   if(r<=epsilon)continue;
   const cosine=dot(hit.normal,toSource)/r;if(cosine<=0)continue;
   const start=hit.point.map((v,i)=>v+hit.normal[i]*epsilon),shadowDir=source.map((v,i)=>v-start[i]);
   if(!occluded(bvh,start,shadowDir))irradiance+=10000*cosine/r2;
  }
  irradiance/=samples.length;bodyIrradiance[k]=irradiance;data[k]=irradiance*ratio;visibility[k]=clamp01(data[k]/Math.max(1e-20,sim.incident[k]));
 }
 return{...sim,data,visibility,wallData:sim.data,wallVisibility:sim.visibility,bodyMask,bodyIrradiance,bodyDepthZ,view:{...opt,orthographic:eye===null,hitPixels,backFaceHits,sourceLightingSamples:samples.length,normalization:'wall units; body irradiance * bodyReflectance / wallReflectance',assumptions:{lambertian:true,reflectancesMeasured:false,directEmitterCameraEmission:false,glass:false,secondaryBounces:false,ambientBodyTransport:false}}};
}
