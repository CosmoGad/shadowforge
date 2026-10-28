// All distances in millimetres. The source is at z=0, the mask starts at z=a.
export const DEFAULTS = Object.freeze({width:96, columns:64, web:0.65, minHole:0.45, thickness:1.6, border:4, sourceDistance:100, wallDistance:400, emitter:1.2, sourceX:0, sourceY:0, gamma:0.55, contrast:1, threshold:0.28, mode:'tone', invert:false, exposure:1.5, ambient:0.015, socket:14, samples:25});
export const clamp=(x,a=0,b=1)=>Math.max(a,Math.min(b,x));
export function makeDesign(gray, iw, ih, settings={}) {
  const p={...DEFAULTS,...settings}, nx=Math.round(p.columns), ny=Math.round(nx*ih/iw);
  const pitch=p.width/nx, height=pitch*ny, maxHole=pitch-p.web;
  if(maxHole<p.minHole) throw new Error('Слишком плотная сетка: уменьшите число столбцов или ширину перемычки.');
  if(p.sourceDistance<=p.thickness || p.wallDistance<=p.thickness) throw new Error('Расстояния должны превышать толщину вставки.');
  const holes=[], target=new Float32Array(nx*ny); let count=0, area=0, lost=0;
  for(let j=0;j<ny;j++) for(let i=0;i<nx;i++) {
    const px=Math.min(iw-1,Math.floor((i+.5)*iw/nx)), py=Math.min(ih-1,Math.floor((j+.5)*ih/ny));
    let g=clamp((gray[py*iw+px]-.5)*p.contrast+.5); if(p.invert)g=1-g;
    g=p.mode==='binary' ? +(g>=p.threshold) : Math.pow(g,p.gamma);
    target[j*nx+i]=g;
    let size=maxHole*Math.sqrt(g); if(size<p.minHole){if(g>0.04)lost++;size=0;}
    if(size){count++;area+=size*size;}
    holes.push({x:(i+.5)*pitch-p.width/2,y:height/2-(j+.5)*pitch,size,i,j});
  }
  const scale=(p.sourceDistance+p.thickness)/p.sourceDistance;
  return {p,nx,ny,pitch,height,maxHole,holes,target,count,lost,openRatio:area/(p.width*height),scale,
    outerWidth:p.width+2*p.border,outerHeight:height+2*p.border,
    magnification:(p.sourceDistance+p.wallDistance)/p.sourceDistance};
}
export function meshBuilder(){
  const triangles=[];
  return {triangles,tri(a,b,c){triangles.push([...a,...b,...c]);},quad(a,b,c,d){triangles.push([...a,...b,...c],[...a,...c,...d]);}};
}
const rect=(x0,y0,x1,y1,z,k=1)=>[[x0*k,y0*k,z],[x1*k,y0*k,z],[x1*k,y1*k,z],[x0*k,y1*k,z]];
function ringFace(m,outer,inner,reverse){
  for(let i=0;i<4;i++){const j=(i+1)%4; if(reverse)m.quad(outer[j],outer[i],inner[i],inner[j]);else m.quad(outer[i],outer[j],inner[j],inner[i]);}
}
function sides(m,near,far,inside=false){for(let i=0;i<near.length;i++){const j=(i+1)%near.length;if(inside)m.quad(near[j],near[i],far[i],far[j]);else m.quad(near[i],near[j],far[j],far[i]);}}
export function maskMesh(d){
  const m=meshBuilder(), {p,pitch,scale:k}=d, a=p.sourceDistance, b=a+p.thickness;
  // Every shared tile edge has identical endpoints: no overlapping solids / T-junctions.
  const xs=[-d.outerWidth/2,...Array.from({length:d.nx+1},(_,i)=>-p.width/2+i*pitch),d.outerWidth/2];
  const ys=[-d.outerHeight/2,...Array.from({length:d.ny+1},(_,j)=>-d.height/2+j*pitch),d.outerHeight/2];
  for(let j=0;j<ys.length-1;j++)for(let i=0;i<xs.length-1;i++){
    const n=rect(xs[i],ys[j],xs[i+1],ys[j+1],a), f=rect(xs[i],ys[j],xs[i+1],ys[j+1],b,k);
    const h=i>0&&i<=d.nx&&j>0&&j<=d.ny?d.holes[(d.ny-j)*d.nx+i-1]:null;
    if(h?.size){const r=h.size/2, hn=rect(h.x-r,h.y-r,h.x+r,h.y+r,a), hf=rect(h.x-r,h.y-r,h.x+r,h.y+r,b,k);ringFace(m,n,hn,true);ringFace(m,f,hf,false);sides(m,hn,hf,true);}
    else {m.quad(n[3],n[2],n[1],n[0]);m.quad(f[0],f[1],f[2],f[3]);}
    if(j===0)m.quad(n[0],n[1],f[1],f[0]);if(i===xs.length-2)m.quad(n[1],n[2],f[2],f[1]);
    if(j===ys.length-2)m.quad(n[2],n[3],f[3],f[2]);if(i===0)m.quad(n[3],n[0],f[0],f[3]);
  }
  return m.triangles;
}
export function housingDimensions(d){const iw=d.outerWidth*d.scale+.6,ih=d.outerHeight*d.scale+.6;return{iw,ih,ow:iw+4.4,oh:ih+4.4,z0:-18,z1:d.p.sourceDistance+d.p.thickness};}
export function housingMesh(d){
  const q=housingDimensions(d), m=meshBuilder();const on=rect(-q.ow/2,-q.oh/2,q.ow/2,q.oh/2,q.z0), of=rect(-q.ow/2,-q.oh/2,q.ow/2,q.oh/2,q.z1);
  const inn=rect(-q.iw/2,-q.ih/2,q.iw/2,q.ih/2,q.z0), inf=rect(-q.iw/2,-q.ih/2,q.iw/2,q.ih/2,q.z1);
  ringFace(m,on,inn,true);ringFace(m,of,inf,false);sides(m,on,of);sides(m,inn,inf,true);return m.triangles;
}
export function backMesh(d){
  const q=housingDimensions(d),m=meshBuilder(), n=64, r=d.p.socket/2, near=[],far=[],hn=[],hf=[];
  for(let i=0;i<n;i++){
    const side=Math.floor(i/(n/4)),u=(i%(n/4))/(n/4),w=q.ow/2,h=q.oh/2;
    const xy=side===0?[-w+2*w*u,-h]:side===1?[w,-h+2*h*u]:side===2?[w-2*w*u,h]:[-w,h-2*h*u];
    const angle=Math.atan2(xy[1],xy[0]);near.push([...xy,q.z0-2]);far.push([...xy,q.z0]);hn.push([r*Math.cos(angle),r*Math.sin(angle),q.z0-2]);hf.push([r*Math.cos(angle),r*Math.sin(angle),q.z0]);
  }
  for(let i=0;i<n;i++){let j=(i+1)%n;m.quad(near[j],near[i],hn[i],hn[j]);m.quad(far[i],far[j],hf[j],hf[i]);}
  sides(m,near,far);sides(m,hn,hf,true);return m.triangles;
}
export function stlBuffer(triangles, label='ShadowForge millimetres'){
  const buf=new ArrayBuffer(84+triangles.length*50),v=new DataView(buf);new Uint8Array(buf).set(new TextEncoder().encode(label.slice(0,80)));v.setUint32(80,triangles.length,true);
  triangles.forEach((t,i)=>{let o=84+50*i; const u=[t[3]-t[0],t[4]-t[1],t[5]-t[2]],w=[t[6]-t[0],t[7]-t[1],t[8]-t[2]];
    const n=[u[1]*w[2]-u[2]*w[1],u[2]*w[0]-u[0]*w[2],u[0]*w[1]-u[1]*w[0]],len=Math.hypot(...n)||1;
    [...n.map(x=>x/len),...t].forEach((x,k)=>v.setFloat32(o+4*k,x,true));v.setUint16(o+48,0,true);});return buf;
}
export function sourceSamples(diameter,count){
  if(!diameter||count<=1)return [[0,0]];
  // Deterministic, uniformly weighted emitting disk. A real filament needs calibration.
  return Array.from({length:count},(_,i)=>{const r=diameter*.5*Math.sqrt((i+.5)/count),phi=i*2.399963229728653;return[r*Math.cos(phi),r*Math.sin(phi)];});
}
export function rayPasses(d,wx,wy,sx,sy){
  const {p}=d,L=p.sourceDistance+p.wallDistance;
  const x=sx+(wx-sx)*p.sourceDistance/L,y=sy+(wy-sy)*p.sourceDistance/L;
  const i=Math.floor((x+p.width/2)/d.pitch),j=Math.floor((d.height/2-y)/d.pitch);
  if(i<0||j<0||i>=d.nx||j>=d.ny)return false;
  const h=d.holes[j*d.nx+i],r=h.size/2;if(!r||Math.abs(x-h.x)>r||Math.abs(y-h.y)>r)return false;
  const xf=(sx+(wx-sx)*(p.sourceDistance+p.thickness)/L)/d.scale, yf=(sy+(wy-sy)*(p.sourceDistance+p.thickness)/L)/d.scale;
  return Math.abs(xf-h.x)<=r&&Math.abs(yf-h.y)<=r;
}
export function simulate(d,width=384,samples=d.p.samples){
  const height=Math.round(width*d.height/d.p.width),data=new Float32Array(width*height),pts=sourceSamples(d.p.emitter,samples),M=d.magnification;
  const projectedWidth=d.p.width*M,projectedHeight=d.height*M;let sum=0;
  for(let j=0;j<height;j++)for(let i=0;i<width;i++){
    const wx=((i+.5)/width-.5)*projectedWidth,wy=(.5-(j+.5)/height)*projectedHeight;let value=0;
    for(const pt of pts){const sx=d.p.sourceX+pt[0],sy=d.p.sourceY+pt[1];if(rayPasses(d,wx,wy,sx,sy)){
      const r2=(wx-sx)**2+(wy-sy)**2+(d.p.sourceDistance+d.p.wallDistance)**2;
      value+=Math.pow((d.p.sourceDistance+d.p.wallDistance)**2/r2,1.5);}}
    data[j*width+i]=value/pts.length;sum+=value/pts.length;
  }
  return {width,height,data,mean:sum/data.length,samples:pts.length,blur:d.p.emitter*d.p.wallDistance/d.p.sourceDistance};
}
export function averageCells(d,sim){
  const result=new Float32Array(d.nx*d.ny),counts=new Uint32Array(result.length);
  for(let y=0;y<sim.height;y++)for(let x=0;x<sim.width;x++){const i=Math.min(d.nx-1,Math.floor(x/sim.width*d.nx)),j=Math.min(d.ny-1,Math.floor(y/sim.height*d.ny)),k=j*d.nx+i;result[k]+=sim.data[y*sim.width+x];counts[k]++;}
  for(let i=0;i<result.length;i++)result[i]/=counts[i]||1;return result;
}
export function compare(d,sim){
  const actual=averageCells(d,sim);let dot=0,den=0;for(let i=0;i<actual.length;i++){dot+=actual[i]*d.target[i];den+=actual[i]**2;}const gain=den?dot/den:0;
  let error=0;for(let i=0;i<actual.length;i++)error+=(clamp(actual[i]*gain)-d.target[i])**2;
  return {rmse:Math.sqrt(error/actual.length),gain,actual};
}
function crc32(data){let c=0xffffffff;for(const x of data){c^=x;for(let j=0;j<8;j++)c=(c>>>1)^((c&1)?0xedb88320:0);}return(c^0xffffffff)>>>0;}
export function zipStore(files){
  let offset=0;const chunks=[],central=[];for(const [name,raw]of files){const n=new TextEncoder().encode(name),data=typeof raw==='string'?new TextEncoder().encode(raw):new Uint8Array(raw),crc=crc32(data);
    const h=new Uint8Array(30+n.length),v=new DataView(h.buffer);v.setUint32(0,0x04034b50,true);v.setUint16(4,20,true);v.setUint16(6,0x800,true);v.setUint32(14,crc,true);v.setUint32(18,data.length,true);v.setUint32(22,data.length,true);v.setUint16(26,n.length,true);h.set(n,30);chunks.push(h,data);
    const c=new Uint8Array(46+n.length),cv=new DataView(c.buffer);cv.setUint32(0,0x02014b50,true);cv.setUint16(4,20,true);cv.setUint16(6,20,true);cv.setUint16(8,0x800,true);cv.setUint32(16,crc,true);cv.setUint32(20,data.length,true);cv.setUint32(24,data.length,true);cv.setUint16(28,n.length,true);cv.setUint32(42,offset,true);c.set(n,46);central.push(c);offset+=h.length+data.length;}
  const size=central.reduce((s,c)=>s+c.length,0),end=new Uint8Array(22),ev=new DataView(end.buffer);ev.setUint32(0,0x06054b50,true);ev.setUint16(8,files.length,true);ev.setUint16(10,files.length,true);ev.setUint32(12,size,true);ev.setUint32(16,offset,true);return new Blob([...chunks,...central,end],{type:'application/zip'});
}
