// Thin, solid support for a fixed concept preset. Intended to be Boolean-unioned
// with the optical shell; the two 0.2 mm root overlaps are deliberate.
import {extrude,circle,surface,wallBetween} from './projector-mesh.mjs?v=service-5';
const area=p=>p.reduce((s,a,i)=>{const b=p[(i+1)%p.length];return s+a[0]*b[1]-b[0]*a[1];},0)/2;
const ccw=p=>area(p)>0?p:[...p].reverse(),cw=p=>area(p)<0?p:[...p].reverse();
const volume=ts=>ts.reduce((s,t)=>s+(t[0]*(t[4]*t[8]-t[5]*t[7])+t[1]*(t[5]*t[6]-t[3]*t[8])+t[2]*(t[3]*t[7]-t[4]*t[6]))/6,0);
const orient=ts=>volume(ts)>0?ts:ts.map(t=>[...t.slice(0,3),...t.slice(6,9),...t.slice(3,6)]);
function sector(r0,r1,a0,a1){const p=[],n=Math.ceil((a1-a0)*180/Math.PI);for(let i=0;i<=n;i++){const a=a0+(a1-a0)*i/n;p.push([r1*Math.cos(a),r1*Math.sin(a)]);}for(let i=n;i>=0;i--){const a=a0+(a1-a0)*i/n;p.push([r0*Math.cos(a),r0*Math.sin(a)]);}return ccw(p);}
export function makeConceptYoke(p,{source,anchors}={}){
 const R=p.bodySide/2,S=p.sourceZ,mounts=source?.mounts;
 if(!Number.isFinite(R)||R<50||R>105||!Number.isFinite(S)||!Array.isArray(mounts)||mounts.length!==2||!Array.isArray(anchors)||anchors.length!==2)throw Error('Invalid concept yoke dimensions.');
 const rM=mounts[0].radialPosition,zContact=mounts[0].footContactZ,zFlange=zContact-3,width=10,depth=1.6,halfRadial=1.3,topWidth=8;
 if(mounts.some(m=>Math.abs(m.radialPosition-rM)>1e-7||Math.abs(m.footContactZ-zContact)>1e-7))throw Error('Yoke mount bosses must share radius and contact height.');
 const angles=[...mounts.map(m=>m.angleDegrees),...anchors.map(a=>a.angle)];if(angles.some(a=>!Number.isFinite(a))||Math.max(...angles)-Math.min(...angles)>70)throw Error('Unsupported yoke sector.');
 const flange=sector(rM-3,rM+3,(Math.min(...angles)-5)*Math.PI/180,(Math.max(...angles)+5)*Math.PI/180),holes=mounts.map(m=>circle(...m.xy,1.1)),joins=[],legs=[],details=[];
 for(const {angle,rho}of anchors){
  const a=angle*Math.PI/180,n=[Math.cos(a),Math.sin(a)],tangent=[-n[1],n[0]],q=S/rho,zAt=r=>S-q*r,r1=R+.2,rL=rM-halfRadial,rH=rM+halfRadial,zQ=zAt(rM),zTaper=zQ+2;
  if(!Number.isFinite(rho)||rho<=R+10||rM>=R-4||zTaper>=zFlange-8)throw Error('Insufficient yoke clearance.');
  const low=r=>zAt(r)-depth*r/R/2,high=r=>zAt(r)+depth*r/R/2;
  const neckWidth=.8,etaStart=-S/rho+depth/(2*R),rhoStart=-S/etaStart,
   etaNeck=-S/(rhoStart+1.5),etaDark=-S/(source.sourceAperture.fieldZeroRadius+3),etaWiden=-S/(source.sourceAperture.fieldZeroRadius+30);
  if(![etaStart,etaNeck,etaDark,etaWiden].every(Number.isFinite)||!(etaStart<etaNeck&&etaNeck<etaDark&&etaDark<etaWiden))throw Error('Invalid optical neck intervals.');
  const profile=ccw([[r1,low(r1)],[rL,low(rL)],[rL,zFlange],[rH,zFlange],[rH,high(rH)],[r1,high(r1)]]);
  const lerp=(a,b,t)=>a+(b-a)*t;
  const halfWidth=eta=>eta<=etaStart?width/2:eta<etaNeck?lerp(width/2,neckWidth/2,(eta-etaStart)/(etaNeck-etaStart)):eta<=etaDark?neckWidth/2:eta<etaWiden?lerp(neckWidth/2,topWidth/2,(eta-etaDark)/(etaWiden-etaDark)):topWidth/2;
  const xyz=(r,z,t)=>[n[0]*r+tangent[0]*t,n[1]*r+tangent[1]*t,z];
  // Each transition is a ray plane z-S-eta*r=0. Split caps AND walls
  // before changing width, so the full radial thickness changes at the same
  // projected wall radius rather than at a horizontal height.
  const flat=extrude([profile],([r,z],f)=>[r,z,1-2*f]),leg=[],cuts=[-1e6,etaStart,etaNeck,etaDark,etaWiden,1e6],value=(p,bound)=>p[1]-S-bound*p[0];
  const clip=(poly,bound,greater)=>{const out=[];for(let i=0;i<poly.length;i++){const a=poly[i],b=poly[(i+1)%poly.length],fa=value(a,bound),fb=value(b,bound),ia=greater?fa>=-1e-10:fa<=1e-10,ib=greater?fb>=-1e-10:fb<=1e-10;if(ia)out.push(a);if(ia!==ib){const t=fa/(fa-fb);out.push(a.map((v,k)=>v+t*(b[k]-v)));}}return out.filter((p,i)=>i===0||p.some((v,k)=>Math.abs(v-out[i-1][k])>1e-9));};
  for(const tri of flat){if([1,4,7].every(k=>Math.abs(tri[k]-zFlange)<1e-7))continue;const vs=[tri.slice(0,3),tri.slice(3,6),tri.slice(6,9)],owner=cuts.findIndex((bound,k)=>k>0&&k<cuts.length-1&&vs.every(p=>Math.abs(value(p,bound))<1e-9));for(let j=0;j<cuts.length-1;j++){if(owner>=0&&j!==owner)continue;const poly=clip(clip(vs,cuts[j],true),cuts[j+1],false);for(let i=1;i+1<poly.length;i++){const mapped=[poly[0],poly[i],poly[i+1]].map(([r,z,t])=>xyz(r,z,t*halfWidth((z-S)/r))),[A,B,C]=mapped,u=B.map((v,k)=>v-A[k]),v=C.map((v,k)=>v-A[k]);if(new Set(mapped.map(p=>p.join(','))).size<3||Math.hypot(u[1]*v[2]-u[2]*v[1],u[2]*v[0]-u[0]*v[2],u[0]*v[1]-u[1]*v[0])<1e-10)continue;leg.push(mapped.flat());}}}
  for(const tri of leg)if(![2,5,8].every(k=>Math.abs(tri[k]-zFlange)<1e-7))legs.push(tri);
  joins.push(cw([[rL,-topWidth/2],[rH,-topWidth/2],[rH,topWidth/2],[rL,topWidth/2]].map(([r,t])=>[n[0]*r+tangent[0]*t,n[1]*r+tangent[1]*t])));
  details.push({angle,rho,root:xyz(R,zAt(R),0),rootEnd:xyz(r1,zAt(r1),0),innerQ:xyz(rM,zQ,0),inclinedWidth:width,rootThickness:depth,innerThickness:depth*rM/R,homothetic:true,rootOverlapMM:.2,rootRadialEnd:r1,requiresBooleanUnionWithShell:true,topColumnWidth:topWidth,neckWidth,etaStart,etaNeck,etaDark,etaWiden,rhoStart,neckSectionMM2:neckWidth*(2*halfRadial),widthTransitionMode:'ray-plane-eta',widthTransitionPlanes:[etaStart,etaNeck,etaDark,etaWiden]});
 }
 const triangles=[...legs];surface(triangles,[flange,...holes,...joins],zFlange,true);surface(triangles,[flange,...holes],zContact);wallBetween(triangles,flange,zFlange,zContact);for(const h of holes)wallBetween(triangles,[...h].reverse(),zFlange,zContact,true);
 return {parts:[{name:'concept-yoke',triangles:orient(triangles.map(t=>t.map(Math.fround))),printHint:'Do not print this support separately: Boolean-union with the optical shell first. Inspect thin inclined strips and supports in the slicer.'}],purchased:[],parameters:{width,rootDepth:depth,topColumnWidth:topWidth,flangeBottom:zFlange,flangeTop:zContact,flangeHoleDiameter:2.2,anchors:details,rootOverlapMM:.2,requiresBooleanUnionWithShell:true,fixedPresetOnly:true,assembly:'Shell and yoke must be one joined printable mesh. Mount the removable front source module with its two M2 screws.',physicalFitTested:false,strengthTested:false,threadRetentionTested:false}};
}
