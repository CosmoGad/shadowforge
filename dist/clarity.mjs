// Relative geometric optics. Illumination is normalized to the same point lamp
// at 100 mm on the wall normal; no measured lumen/lux claim is made.
export function incidentLight(sx,sy,sz,wx,wy){const r2=(wx-sx)**2+(wy-sy)**2+sz*sz;return 10000*sz/Math.pow(r2,1.5);}
export function detailLimits(p,height){
  let magnification,penumbra,projectedPrint;
  if(p.shape==='square'){
    magnification=Math.max(1,Math.max(p.wallWidth,height)/p.bodySide);
    penumbra=p.emitter*Math.max(0,magnification-1);
    // Side-wall projection has different scales along the rim and along depth.
    projectedPrint=p.minWeb*Math.max(magnification,magnification*magnification*p.bodySide/(2*p.sourceZ));
  }else{const z=p.gap+p.relief/2;magnification=p.sourceZ/(p.sourceZ-z);penumbra=p.emitter*(magnification-1);projectedPrint=p.minWeb*magnification;}
  const opticalFloor=Math.max(2*penumbra,projectedPrint),requested=p.detailSize??12;
  return{magnification,penumbra,projectedPrint,opticalFloor,minDetailMM:p.opticsAware===false?requested:Math.max(requested,opticalFloor)};
}
export function morphology(mask,nx,ny,r,dilate){const out=new Uint8Array(mask.length);for(let y=1;y<ny-1;y++)for(let x=1;x<nx-1;x++){let v=dilate?0:1;outer:for(let dy=-r;dy<=r;dy++)for(let dx=-r;dx<=r;dx++){if(dx*dx+dy*dy>r*r)continue;const xx=x+dx,yy=y+dy,a=xx>=0&&yy>=0&&xx<nx&&yy<ny?mask[yy*nx+xx]:0;if(dilate&&a){v=1;break outer;}if(!dilate&&!a){v=0;break outer;}}out[y*nx+x]=v;}return out;}
function regions(mask,w,h,value,tones){const seen=new Uint8Array(mask.length),queue=new Int32Array(mask.length),result=[];
  for(let start=0;start<mask.length;start++){if(seen[start]||mask[start]!==value)continue;let a=0,b=0,sx=0,sy=0,sum=0,border=false;queue[b++]=start;seen[start]=1;
    while(a<b){const k=queue[a++],x=k%w,y=Math.floor(k/w);sx+=x;sy+=y;sum+=tones?.[k]||0;if(!x||!y||x===w-1||y===h-1)border=true;for(const next of[x>0?k-1:-1,x<w-1?k+1:-1,y>0?k-w:-1,y<h-1?k+w:-1])if(next>=0&&!seen[next]&&mask[next]===value){seen[next]=1;queue[b++]=next;}}
    result.push({pixels:Array.from(queue.subarray(0,b)),area:b,x:sx/b,y:sy/b,brightness:sum/b,border});
  }return result;
}
function gaussian(mask,w,h,sigma){if(sigma<.2)return Float32Array.from(mask);const r=Math.max(1,Math.ceil(sigma*3)),kernel=Array.from({length:r*2+1},(_,i)=>Math.exp(-((i-r)**2)/(2*sigma*sigma))),sum=kernel.reduce((a,b)=>a+b,0);for(let i=0;i<kernel.length;i++)kernel[i]/=sum;const temp=new Float32Array(mask.length),out=new Float32Array(mask.length);
  for(let y=0;y<h;y++)for(let x=0;x<w;x++){let v=0;for(let i=-r;i<=r;i++)v+=(mask[y*w+Math.max(0,Math.min(w-1,x+i))]||0)*kernel[i+r];temp[y*w+x]=v;}
  for(let y=0;y<h;y++)for(let x=0;x<w;x++){let v=0;for(let i=-r;i<=r;i++)v+=temp[Math.max(0,Math.min(h-1,y+i))*w+x]*kernel[i+r];out[y*w+x]=v;}return out;
}
function edges(mask,w){let n=0;for(let k=w;k<mask.length;k++){if(k%w&&mask[k]!==mask[k-1])n++;if(mask[k]!==mask[k-w])n++;}return n;}
export function simplifyTarget(raw,tones,w,h,pitch,p,limits){
  const featurePixels=Math.max(1,limits.minDetailMM/pitch),radius=Math.max(1,Math.min(12,Math.floor(featurePixels/2))),minArea=Math.max(4,Math.PI*(featurePixels/2)**2*.75);
  const originalInk=regions(raw,w,h,1),originalHoles=regions(raw,w,h,0,tones).filter(x=>!x.border);
  const blurred=gaussian(raw,w,h,Math.min(8,featurePixels*.22));let target=Uint8Array.from(blurred,x=>+(x>=.5));
  target=morphology(morphology(target,w,h,radius,false),w,h,radius,true);
  let removedComponents=0,filledHoles=0;for(const r of regions(target,w,h,1))if(r.area<minArea){for(const k of r.pixels)target[k]=0;removedComponents++;}
  for(const r of regions(target,w,h,0))if(!r.border&&r.area<minArea){for(const k of r.pixels)target[k]=1;filledHoles++;}
  // Preserve a small number of strong enclosed highlights (e.g. eyes), enlarging
  // them rather than attempting to print their original, unresolved size.
  const budget=Math.max(3,Math.min(10,Math.round(12-limits.minDetailMM*.5)));
  const important=originalHoles.filter(r=>r.area>=Math.max(3,minArea*.15)).sort((a,b)=>b.area*(.25+b.brightness)**2-a.area*(.25+a.brightness)**2).slice(0,budget);
  for(const r of important){for(const k of r.pixels)target[k]=0;const rr=Math.max(1,featurePixels*.5);for(let y=Math.max(1,Math.floor(r.y-rr));y<=Math.min(h-2,Math.ceil(r.y+rr));y++)for(let x=Math.max(1,Math.floor(r.x-rr));x<=Math.min(w-2,Math.ceil(r.x+rr));x++)if((x-r.x)**2+(y-r.y)**2<=rr*rr)target[y*w+x]=0;}
  let changed=0;for(let k=0;k<raw.length;k++)if(raw[k]!==target[k])changed++;
  return{target,stats:{...limits,featurePixels,removedComponents,filledHoles,preservedHighlights:important.length,rawComponents:originalInk.length,components:regions(target,w,h,1).length,rawHoles:originalHoles.length,holes:regions(target,w,h,0).filter(x=>!x.border).length,changedRatio:changed/raw.length,rawEdges:edges(raw,w),edges:edges(target,w)}};
}
export function measureContrast(d,sim,ambient){let light=0,dark=0,nLight=0,nDark=0;
  for(let y=0;y<sim.height;y++)for(let x=0;x<sim.width;x++){
    const wx=((x+.5)/sim.width-.5)*sim.worldWidth,wy=(.5-(y+.5)/sim.height)*sim.worldHeight,ix=Math.floor(wx/d.pitch+d.nx/2),iy=Math.floor(d.ny/2-wy/d.pitch);if(ix<0||iy<0||ix>=d.nx||iy>=d.ny||(Math.abs(wx)<d.rootW/2+5&&Math.abs(wy)<d.rootH/2+5))continue;
    const k=y*sim.width+x,v=(sim.data[k]+ambient)/(sim.incident[k]+ambient+1e-10);if(d.target[iy*d.nx+ix]){dark+=v;nDark++;}else{light+=v;nLight++;}}
  if(!nLight||!nDark)return 0;light/=nLight;dark/=nDark;return Math.max(0,Math.min(1,(light-dark)/(light+dark+1e-10)));
}
const srgb=x=>x<=.0031308?12.92*x:1.055*Math.pow(x,1/2.4)-.055;
export function displayRGB(light,ambient,exposureEV){const gain=2**exposureEV;return[1,.66,.28].map(color=>{const linear=(light*3*color+ambient)*gain,mapped=linear/(1+linear);return Math.round(255*srgb(Math.max(0,Math.min(1,mapped))));});}
export function autoExposure(sim,ambient){const values=Array.from(sim.data).filter(x=>x>1e-6).sort((a,b)=>a-b);if(!values.length)return 0;const reference=values[Math.floor(values.length*.9)];return Math.max(-3,Math.min(3,Math.log2(1/(reference*3+ambient))));}
