// Split every cap AND wall triangle at shared angular meridians before bending.
// Mapping only contour vertices would create long chords through the cylinder.
import {extrude} from './projector-mesh.mjs?v=service-5';
export function curvedExtrude(loops,point,halfWidth,steps=90,wrap=false){
 const flat=extrude(loops,([u,v],f)=>[u,v,f]),result=[],step=2*halfWidth/steps;
 const clip=(poly,bound,greater)=>{const out=[];for(let i=0;i<poly.length;i++){const a=poly[i],b=poly[(i+1)%poly.length],ia=greater?a[0]>=bound-1e-10:a[0]<=bound+1e-10,ib=greater?b[0]>=bound-1e-10:b[0]<=bound+1e-10;if(ia)out.push(a);if(ia!==ib){const t=(bound-a[0])/(b[0]-a[0]);out.push([bound,a[1]+t*(b[1]-a[1]),a[2]+t*(b[2]-a[2])]);}}return out.filter((p,i)=>i===0||p.some((v,k)=>Math.abs(v-out[i-1][k])>1e-9));};
 for(const t of flat){if(wrap&&[0,3,6].every(i=>Math.abs(t[i]-halfWidth)<1e-7)||wrap&&[0,3,6].every(i=>Math.abs(t[i]+halfWidth)<1e-7))continue;const vs=[t.slice(0,3),t.slice(3,6),t.slice(6,9)],lo=Math.min(steps-1,Math.max(0,Math.floor((Math.min(...vs.map(p=>p[0]))+halfWidth)/step))),hi=Math.min(steps-1,Math.floor((Math.max(...vs.map(p=>p[0]))+halfWidth)/step));for(let s=lo;s<=hi;s++){const poly=clip(clip(vs,-halfWidth+s*step,true),-halfWidth+(s+1)*step,false);if(poly.length<3)continue;for(let i=1;i+1<poly.length;i++){const a=poly[0],b=poly[i],c=poly[i+1],v=b.map((x,k)=>x-a[k]),w=c.map((x,k)=>x-a[k]);if(Math.hypot(v[1]*w[2]-v[2]*w[1],v[2]*w[0]-v[0]*w[2],v[0]*w[1]-v[1]*w[0])<1e-10)continue;const tri=[a,b,c].map(p=>point(p.slice(0,2),p[2]).map(v=>Math.round(v*1e4)/1e4));if(new Set(tri.map(p=>p.join(','))).size===3)result.push(tri.flat());}}}
 return result;
}
