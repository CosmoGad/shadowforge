// Coordinates: millimetres; wall z=0, observer in +z. No artwork overlay.
export const CONFIG = Object.freeze({outerRadius:200,innerRadius:140,sourceRadius:185,sourceZ:40,frontZ:45,maskBack:33,maskFront:36,frames:12,targetRadius:50,wireDiameter:.15,beamHalfAngle:90});
export const add=(a,b)=>a.map((x,i)=>x+b[i]);
export const sub=(a,b)=>a.map((x,i)=>x-b[i]);
export const mul=(a,s)=>a.map(x=>x*s);
export const dot=(a,b)=>a.reduce((s,x,i)=>s+x*b[i],0);
export const cross=(a,b)=>[a[1]*b[2]-a[2]*b[1],a[2]*b[0]-a[0]*b[2],a[0]*b[1]-a[1]*b[0]];
export const norm=a=>Math.sqrt(dot(a,a));
export const unit=a=>mul(a,1/norm(a));
const clamp=x=>Math.max(0,Math.min(1,x));
const cross2=(a,b)=>a[0]*b[1]-a[1]*b[0];
export function light(i,c=CONFIG){const a=Math.PI/2-i*2*Math.PI/c.frames;return [c.sourceRadius*Math.cos(a),c.sourceRadius*Math.sin(a),c.sourceZ];}
export function target(i,c=CONFIG){return Array.from({length:3},(_,j)=>{const a=Math.PI/2+j*2*Math.PI/3-i*2*Math.PI/(3*c.frames);return [c.targetRadius*Math.cos(a),c.targetRadius*Math.sin(a),0];});}
export function lift(p,s,z){return [p[0]+(s[0]-p[0])*z/s[2],p[1]+(s[1]-p[1])*z/s[2],z];}
export function project(p,s){const t=s[2]/(s[2]-p[2]);return [s[0]+t*(p[0]-s[0]),s[1]+t*(p[1]-s[1]),0];}
export function bounds(vertices){return {min:[0,1,2].map(k=>Math.min(...vertices.map(v=>v[k]))),max:[0,1,2].map(k=>Math.max(...vertices.map(v=>v[k])))};}
export function makeModel(c=CONFIG){
 const masks=[],wires=[];
 for(let i=0;i<c.frames;i++){
  const s=light(i,c),goal=target(i,c),vertices=[...goal.map(p=>lift(p,s,c.maskBack)),...goal.map(p=>lift(p,s,c.maskFront))];
  const center=mul(vertices.reduce(add,[0,0,0]),1/6);
  const ids=[[0,2,1],[3,4,5],[0,1,4],[0,4,3],[1,2,5],[1,5,4],[2,0,3],[2,3,5]];
  const triangles=ids.map(ids=>{let t=ids.map(k=>vertices[k]);if(dot(cross(sub(t[1],t[0]),sub(t[2],t[0])),sub(t[0],center))<0)t=[t[0],t[2],t[1]];return t;});
  masks.push({index:i,vertices,triangles,bounds:bounds(vertices),target:goal,source:s});
  const e=[s[0]/c.sourceRadius,s[1]/c.sourceRadius,0];
  let r=Infinity;
  for(let j=0;j<3;j++){const a=goal[j],edge=sub(goal[(j+1)%3],a),den=cross2(e,edge);if(Math.abs(den)<1e-8)continue;const t=cross2(a,edge)/den,u=cross2(a,e)/den;if(t>0&&u>=-1e-8&&u<=1+1e-8)r=Math.min(r,t);}
  if(!Number.isFinite(r))throw Error('Mount intersection failed');
  for(const z of[c.maskBack,c.maskFront]){
   const a=lift(mul(e,r),s,z),b=[e[0]*(c.outerRadius-1),e[1]*(c.outerRadius-1),z],rad=c.wireDiameter/2,bb=bounds([a,b]);
   wires.push({index:i,a,b,radius:rad,bounds:{min:bb.min.map(x=>x-rad),max:bb.max.map(x=>x+rad)}});
  }
 }
 return {config:c,masks,wires};
}
export function inTriangle(p,t){const v=t.map((a,i)=>cross2(sub(t[(i+1)%3],a),sub(p,a)));return v.every(x=>x>=-1e-8)||v.every(x=>x<=1e-8);}
function boxHit(o,d,box){
 let lo=1e-7,hi=1-1e-7;
 for(let k=0;k<3;k++){if(Math.abs(d[k])<1e-10){if(o[k]<box.min[k]||o[k]>box.max[k])return false;}else{let a=(box.min[k]-o[k])/d[k],b=(box.max[k]-o[k])/d[k];if(a>b)[a,b]=[b,a];lo=Math.max(lo,a);hi=Math.min(hi,b);if(lo>hi)return false;}}
 return true;
}
export function triangleHit(o,d,t){
 const e1=sub(t[1],t[0]),e2=sub(t[2],t[0]),h=cross(d,e2),det=dot(e1,h);if(Math.abs(det)<1e-10)return false;
 const inv=1/det,s=sub(o,t[0]),u=inv*dot(s,h);if(u<0||u>1)return false;
 const q=cross(s,e1),v=inv*dot(d,q);if(v<0||u+v>1)return false;
 const at=inv*dot(e2,q);return at>1e-7&&at<1-1e-7;
}
export function segmentDistanceSquared(p,q,a,b){
 const d=sub(q,p),e=sub(b,a),w=sub(p,a),aa=dot(d,d),bb=dot(d,e),cc=dot(e,e),dd=dot(d,w),ee=dot(e,w),den=aa*cc-bb*bb;
 let best=Infinity;
 const test=(s,t)=>{const v=sub(add(p,mul(d,s)),add(a,mul(e,t)));best=Math.min(best,dot(v,v));};
 if(den>1e-12){const s=(bb*ee-cc*dd)/den,t=(aa*ee-bb*dd)/den;if(s>=0&&s<=1&&t>=0&&t<=1)test(s,t);}
 test(0,clamp(ee/cc));test(1,clamp((ee+bb)/cc));test(clamp(-dd/aa),0);test(clamp((bb-dd)/aa),1);
 return best;
}
function annulusHit(o,d,z0,z1,r0,r1){
 let a=(z0-o[2])/d[2],b=(z1-o[2])/d[2];if(a>b)[a,b]=[b,a];a=Math.max(1e-7,a);b=Math.min(1-1e-7,b);if(a>b)return false;
 const rr=t=>(o[0]+t*d[0])**2+(o[1]+t*d[1])**2,den=d[0]**2+d[1]**2;
 const v=den?Math.max(a,Math.min(b,-(o[0]*d[0]+o[1]*d[1])/den)):a;
 return Math.min(rr(a),rr(b),rr(v))<=r1*r1&&Math.max(rr(a),rr(b))>=r0*r0;
}
export function blocked(o,p,model,{mounts=true,ignoreMask=-1,ignoreHousing=false}={}){
 const d=sub(p,o),c=model.config;
 if(!ignoreHousing&&(annulusHit(o,d,0,3,180,c.outerRadius)||annulusHit(o,d,42,c.frontZ,c.innerRadius,c.outerRadius)||annulusHit(o,d,0,c.frontZ,198,c.outerRadius)))return true;
 for(const m of model.masks)if(m.index!==ignoreMask&&boxHit(o,d,m.bounds)&&m.triangles.some(t=>triangleHit(o,d,t)))return true;
 if(mounts)for(const w of model.wires)if(boxHit(o,d,w.bounds)&&segmentDistanceSquared(o,p,w.a,w.b)<=w.radius*w.radius)return true;
 return false;
}
export function sourceSamples(i,diameter,c=CONFIG){
 const s=light(i,c);if(diameter===0)return[s];
 const axis=unit(mul(s,-1)),tangent=unit([-s[1],s[0],0]),other=unit(cross(axis,tangent)),points=[s];
 for(let j=0;j<6;j++){const a=j*Math.PI/3,r=diameter*.39;points.push(add(s,add(mul(tangent,r*Math.cos(a)),mul(other,r*Math.sin(a)))));}
 return points;
}
export function renderFrame(model,index,{size=256,span=440,diameter=.15,mounts=true,ignoreMask=-1}={}){
 const c=model.config,s=light(index,c),axis=unit(mul(s,-1)),sources=sourceSamples(index,diameter,c),irradiance=new Float32Array(size*size),visibility=new Float32Array(size*size),cosLimit=Math.cos(c.beamHalfAngle*Math.PI/180);
 const reference=c.sourceZ/Math.pow(c.sourceRadius*c.sourceRadius+c.sourceZ*c.sourceZ,1.5);
 for(let y=0;y<size;y++)for(let x=0;x<size;x++){
  const p=[(x+.5-size/2)*span/size,(size/2-y-.5)*span/size,0];let full=0,visible=0;
  for(const o of sources){const d=sub(p,o),len=norm(d);if(dot(d,axis)/len<cosLimit)continue;const e=o[2]/(len**3)*Math.max(0,dot(d,axis)/len);full+=e;if(!blocked(o,p,model,{mounts,ignoreMask}))visible+=e;}
  const k=y*size+x;irradiance[k]=visible/(sources.length*reference);visibility[k]=full?visible/full:1;
 }
 return {size,span,irradiance,visibility,index,samples:sources.length};
}
export function rgba(field){
 const out=new Uint8ClampedArray(field.size*field.size*4);
 for(let k=0;k<field.irradiance.length;k++){const b=.12+.85*(1-Math.exp(-.88*field.irradiance[k]));out[4*k]=Math.round(241*b);out[4*k+1]=Math.round(228*b);out[4*k+2]=Math.round(204*b);out[4*k+3]=255;}
 return out;
}
export function stl(mask){
 const min=mask.bounds.min;
 const triangles=mask.triangles.map(t=>t.map(p=>sub(p,min)));
 const rows=['solid ring_frame_'+String(mask.index+1).padStart(2,'0')];
 for(const t of triangles){const n=unit(cross(sub(t[1],t[0]),sub(t[2],t[0])));rows.push('facet normal '+n.join(' '),' outer loop',...t.map(v=>'  vertex '+v.map(x=>x.toFixed(6)).join(' ')),' endloop','endfacet');}
 rows.push('endsolid');return rows.join('\n');
}
export function assembly(model){
 const c=model.config;
 return {name:'ShadowForge Ring / optical prototype 01',units:'mm',wall:'z=0; +z toward viewer',config:c,sequence:{frames:c.frames,fps:24,oneChannelAtATime:true,rotationPerLoopDegrees:120,physicalValidation:false},source:{type:'effective emitting disk perpendicular to aim',diameterMm:.15,samples:7,photometry:'relative Lambertian cosine intensity over forward hemisphere; real LED distribution unverified; no lumen/lux claim'},housing:{frontAnnulus:[140,200,42,45],rearAnnulus:[180,200,0,3],outerWall:[198,200,0,45],status:'envelope; full housing and electronics mounts not production-designed'},masks:model.masks.map(m=>({frame:m.index+1,source:m.source,aim:[0,0,0],target:m.target,assemblyVertices:m.vertices,printToAssemblyTranslation:m.bounds.min,printFile:'print/frame-'+String(m.index+1).padStart(2,'0')+'.stl'})),mounts:model.wires.map(w=>({frame:w.index+1,from:w.a,to:w.b,diameter:2*w.radius,material:'opaque wire; purchased, not printable; no mechanical qualification'})),limitations:['No physical prototype tested.','Absolute light output, heating, wiring, source package, connectors and tolerances not validated.','Source disk quadrature uses seven samples; preview is not a photometric measurement.','Opaque wire supports and all masks/housing are included in ray tests.','Thin optical parts may require slicer supports; inspect before printing.']};
}
