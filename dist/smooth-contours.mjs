// Vector smoothing of the actual printable contour. No display blur is involved.
const EPS=1e-8;
const cross=(a,b,c)=>(b[0]-a[0])*(c[1]-a[1])-(b[1]-a[1])*(c[0]-a[0]);
const area=p=>p.reduce((s,a,i)=>{const b=p[(i+1)%p.length];return s+a[0]*b[1]-b[0]*a[1];},0)/2;
const distance=(a,b)=>Math.hypot(a[0]-b[0],a[1]-b[1]);
function pointDistance(p,a,b){const dx=b[0]-a[0],dy=b[1]-a[1],den=dx*dx+dy*dy,t=den?Math.max(0,Math.min(1,((p[0]-a[0])*dx+(p[1]-a[1])*dy)/den)):0;return Math.hypot(p[0]-a[0]-t*dx,p[1]-a[1]-t*dy);}
function pointIn(p,poly){let inside=false;for(let i=0,j=poly.length-1;i<poly.length;j=i++){const a=poly[i],b=poly[j];if((a[1]>p[1])!==(b[1]>p[1])&&p[0]<(b[0]-a[0])*(p[1]-a[1])/(b[1]-a[1])+a[0])inside=!inside;}return inside;}
function on(a,b,p){return Math.abs(cross(a,b,p))<EPS&&p[0]>=Math.min(a[0],b[0])-EPS&&p[0]<=Math.max(a[0],b[0])+EPS&&p[1]>=Math.min(a[1],b[1])-EPS&&p[1]<=Math.max(a[1],b[1])+EPS;}
function intersects(a,b,c,d){const x=cross(a,b,c),y=cross(a,b,d),z=cross(c,d,a),w=cross(c,d,b);return x*y<0&&z*w<0||Math.abs(x)<EPS&&on(a,b,c)||Math.abs(y)<EPS&&on(a,b,d)||Math.abs(z)<EPS&&on(c,d,a)||Math.abs(w)<EPS&&on(c,d,b);}
function clean(poly){let p=[];for(const a of poly){const b=a.map(v=>Math.round(v*1e5)/1e5);if(!p.length||distance(b,p.at(-1))>EPS)p.push(b);}if(p.length>1&&distance(p[0],p.at(-1))<EPS)p.pop();return p.filter((b,i)=>Math.abs(cross(p[(i+p.length-1)%p.length],b,p[(i+1)%p.length]))>EPS);}
function openRDP(p,tol){if(p.length<=2)return p;const keep=new Uint8Array(p.length),stack=[[0,p.length-1]];keep[0]=keep[p.length-1]=1;while(stack.length){const [a,b]=stack.pop();let max=tol,k=-1;for(let i=a+1;i<b;i++){const v=pointDistance(p[i],p[a],p[b]);if(v>max){max=v;k=i;}}if(k>=0){keep[k]=1;stack.push([a,k],[k,b]);}}return p.filter((_,i)=>keep[i]);}
function simplifyClosed(p,tol,protectedPoint){const n=p.length,anchors=[];for(let i=0;i<n;i++)if(protectedPoint(p[i]))anchors.push(i);if(!anchors.length)anchors.push(0);const first=anchors[0];let far=0,best=-1;for(let i=0;i<n;i++){const v=distance(p[i],p[first]);if(v>best){best=v;far=i;}}if(!anchors.includes(far))anchors.push(far);anchors.sort((a,b)=>a-b);const out=[];for(let i=0;i<anchors.length;i++){const a=anchors[i],b=anchors[(i+1)%anchors.length],arc=[p[a]];for(let j=(a+1)%n;j!==b;j=(j+1)%n)arc.push(p[j]);arc.push(p[b]);out.push(...openRDP(arc,tol).slice(0,-1));}return clean(out);}
function roundCorners(p,radius,protectedPoint){const out=[];for(let i=0;i<p.length;i++){const a=p[(i+p.length-1)%p.length],b=p[i],c=p[(i+1)%p.length];if(protectedPoint(b)){out.push(b);continue;}const ta=Math.min(.25,radius/Math.max(EPS,distance(a,b))),tc=Math.min(.25,radius/Math.max(EPS,distance(b,c)));out.push([b[0]+(a[0]-b[0])*ta,b[1]+(a[1]-b[1])*ta],[b[0]+(c[0]-b[0])*tc,b[1]+(c[1]-b[1])*tc]);}return clean(out);}
function segments(p){return p.map((a,i)=>({a,b:p[(i+1)%p.length],i}));}
function spatial(list,step=4,pad=0){const bins=new Map();for(let k=0;k<list.length;k++){const {a,b}=list[k];for(let y=Math.floor((Math.min(a[1],b[1])-pad)/step);y<=Math.floor((Math.max(a[1],b[1])+pad)/step);y++)for(let x=Math.floor((Math.min(a[0],b[0])-pad)/step);x<=Math.floor((Math.max(a[0],b[0])+pad)/step);x++){const key=x+','+y;if(!bins.has(key))bins.set(key,[]);bins.get(key).push(k);}}return{bins,step};}
function nearby(hash,a,b=a){const found=new Set();for(let y=Math.floor(Math.min(a[1],b[1])/hash.step);y<=Math.floor(Math.max(a[1],b[1])/hash.step);y++)for(let x=Math.floor(Math.min(a[0],b[0])/hash.step);x<=Math.floor(Math.max(a[0],b[0])/hash.step);x++)for(const i of hash.bins.get(x+','+y)||[])found.add(i);return found;}
function selfSimple(p){if(p.length<3||Math.abs(area(p))<EPS)return false;const ss=segments(p),hash=spatial(ss);for(let i=0;i<ss.length;i++)for(const j of nearby(hash,ss[i].a,ss[i].b)){if(j<=i||j===(i+1)%ss.length||i===(j+1)%ss.length)continue;if(intersects(ss[i].a,ss[i].b,ss[j].a,ss[j].b))return false;}return true;}
function loopsCross(a,b){const ss=segments(b),hash=spatial(ss);for(const s of segments(a))for(const k of nearby(hash,s.a,s.b))if(intersects(s.a,s.b,ss[k].a,ss[k].b))return true;return false;}
function deviationBound(a,b,maximum){const step=Math.min(.3,maximum/4),ss=segments(b),hash=spatial(ss,4,maximum+step);let max=0;for(const s of segments(a)){const n=Math.max(1,Math.ceil(distance(s.a,s.b)/step));for(let i=0;i<=n;i++){const p=[s.a[0]+(s.b[0]-s.a[0])*i/n,s.a[1]+(s.b[1]-s.a[1])*i/n];let best=Infinity;for(const k of nearby(hash,p))best=Math.min(best,pointDistance(p,ss[k].a,ss[k].b));max=Math.max(max,best);if(max>maximum)return Infinity;}}return max+step/2;}
function turnEnergy(p){let sum=0;for(let i=0;i<p.length;i++){const a=p[(i+p.length-1)%p.length],b=p[i],c=p[(i+1)%p.length],angle=Math.atan2(cross(a,b,c),(b[0]-a[0])*(c[0]-b[0])+(b[1]-a[1])*(c[1]-b[1]));sum+=angle*angle;}return sum;}
/**
 * @param {Array<Array<[number,number]>>} input Closed loops, no repeated end point.
 * @returns {{loops:Array,stats:object}} Same topology, rejected loops kept unchanged.
 * Units are the input contour units: use grid cells for contours(mask,nx,ny,1).
 * maxDeviation is a conservative sampled Hausdorff bound, not a web-width certificate.
 */
export function smoothContours(input,options={}){
 const opt={tolerance:.8,cornerRadius:.75,iterations:2,preserveBottom:true,bottomBand:2,maxDeviation:1.65,quantum:0,...options};
 for(const k of ['tolerance','cornerRadius','iterations','bottomBand','maxDeviation','quantum'])if(typeof opt[k]!=='number'||!Number.isFinite(opt[k])||opt[k]<0)throw Error('Invalid smoothing option: '+k);
 if(typeof opt.preserveBottom!=='boolean'||!Number.isInteger(opt.iterations)||opt.iterations>3||opt.maxDeviation<=0)throw Error('Invalid smoothing iteration/deviation limit.');
 if(!Array.isArray(input)||input.some(p=>!Array.isArray(p)||p.length<3||p.some(v=>!Array.isArray(v)||v.length!==2||!v.every(Number.isFinite))))throw Error('Invalid printable contour.');
 const original=input.map(p=>clean(p));if(original.some(p=>p.length<3||!selfSimple(p)))throw Error('Input contour must be simple and nondegenerate.');const loops=original.map(p=>p.map(v=>[...v])),bottom=original.reduce((m,p)=>p.reduce((n,v)=>Math.min(n,v[1]),m),Infinity),protectedPoint=p=>opt.preserveBottom&&p[1]<=bottom+opt.bottomBand+EPS;
 const relation=original.map((a,i)=>original.map((b,j)=>i!==j&&pointIn(a[0],b))),reports=[];
 for(let i=0;i<loops.length;i++){
  const before=original[i];let reason=null,maxDeviation=Infinity,candidate=before,strategy='original';
  const attempts=[{tolerance:opt.tolerance,radius:opt.cornerRadius,name:'RDP + curves'},{tolerance:opt.tolerance*.45,radius:opt.cornerRadius*.75,name:'conservative RDP + curves'},{tolerance:0,radius:opt.cornerRadius*.65,name:'curves only'}];
  for(const attempt of attempts){
   candidate=attempt.tolerance?simplifyClosed(before,attempt.tolerance,protectedPoint):before.map(p=>[...p]);for(let j=0;j<opt.iterations;j++)candidate=roundCorners(candidate,attempt.radius,protectedPoint);if(opt.quantum)candidate=clean(candidate.map(p=>p.map(v=>Math.round(v/opt.quantum)*opt.quantum)));
   reason=null;maxDeviation=Infinity;
   if(!selfSimple(candidate))reason='self-intersection';
   else if(Math.sign(area(before))!==Math.sign(area(candidate))||Math.abs(area(candidate))<Math.abs(area(before))*.25)reason='orientation/area';
   else{maxDeviation=Math.max(deviationBound(candidate,before,opt.maxDeviation),deviationBound(before,candidate,opt.maxDeviation));if(maxDeviation>opt.maxDeviation)reason='deviation';}
   if(!reason)for(let j=0;j<loops.length;j++)if(i!==j&&(loopsCross(candidate,loops[j])||pointIn(candidate[0],loops[j])!==relation[i][j]||pointIn(loops[j][0],candidate)!==relation[j][i])){reason='hole containment/intersection';break;}
   if(!reason){loops[i]=candidate;strategy=attempt.name;break;}
  }
  reports.push({loop:i,accepted:!reason,reason,strategy,verticesBefore:before.length,verticesAfter:loops[i].length,maxDeviationBound:Number.isFinite(maxDeviation)?maxDeviation:null,turnEnergyBefore:turnEnergy(before),turnEnergyAfter:turnEnergy(loops[i])});
 }
 return{loops,stats:{method:'closed RDP + bounded Chaikin; topology checked',loops:loops.length,accepted:reports.filter(r=>r.accepted).length,rejected:reports.filter(r=>!r.accepted).length,verticesBefore:original.reduce((s,p)=>s+p.length,0),verticesAfter:loops.reduce((s,p)=>s+p.length,0),turnEnergyBefore:reports.reduce((s,r)=>s+r.turnEnergyBefore,0),turnEnergyAfter:reports.reduce((s,r)=>s+r.turnEnergyAfter,0),maxDeviationLimit:opt.maxDeviation,minimumWebCertified:false,reports}};
}
