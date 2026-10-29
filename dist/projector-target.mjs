// Black (1) is opaque material; white (0) is a light aperture.
// Preparation is deterministic tone/connected-region processing, not semantic AI.
// style="silhouette" preserves an isolated external contour with enclosed highlights;
// it is a silhouette with apertures, not an entirely filled outline.
const clamp=(v,a=0,b=1)=>Math.max(a,Math.min(b,v));
function regions(mask,w,h,value){
 const seen=new Uint8Array(mask.length),queue=new Int32Array(mask.length),out=[];
 for(let start=0;start<mask.length;start++){if(seen[start]||mask[start]!==value)continue;let a=0,b=0,border=false;seen[start]=1;queue[b++]=start;
  while(a<b){const k=queue[a++],x=k%w,y=(k/w)|0;border ||= x===0||y===0||x===w-1||y===h-1;
   for(const q of [x?k-1:-1,x<w-1?k+1:-1,y?k-w:-1,y<h-1?k+w:-1])if(q>=0&&!seen[q]&&mask[q]===value){seen[q]=1;queue[b++]=q;}}
  out.push({pixels:queue.slice(0,b),border,area:b});
 }return out;
}
function resample(gray,iw,ih,w,h){
 const out=new Float32Array(w*h);
 // Exact box integration avoids phase-dependent loss of thin lines on downsample.
 for(let y=0;y<h;y++)for(let x=0;x<w;x++){const x0=x*iw/w,x1=(x+1)*iw/w,y0=y*ih/h,y1=(y+1)*ih/h;let sum=0,weight=0;
  for(let sy=Math.floor(y0);sy<Math.ceil(y1);sy++)for(let sx=Math.floor(x0);sx<Math.ceil(x1);sx++){const a=(Math.min(x1,sx+1)-Math.max(x0,sx))*(Math.min(y1,sy+1)-Math.max(y0,sy));if(a<=0)continue;sum+=clamp(gray[Math.min(ih-1,sy)*iw+Math.min(iw-1,sx)])*a;weight+=a;}out[y*w+x]=sum/weight;
 }return out;
}
function localMean(a,w,h,r){const stride=w+1,integral=new Float64Array((w+1)*(h+1)),out=new Float32Array(a.length);for(let y=0;y<h;y++){let row=0;for(let x=0;x<w;x++){row+=a[y*w+x];integral[(y+1)*stride+x+1]=integral[y*stride+x+1]+row;}}
 for(let y=0;y<h;y++)for(let x=0;x<w;x++){const x0=Math.max(0,x-r),x1=Math.min(w,x+r+1),y0=Math.max(0,y-r),y1=Math.min(h,y+r+1);out[y*w+x]=(integral[y1*stride+x1]-integral[y0*stride+x1]-integral[y1*stride+x0]+integral[y0*stride+x0])/((x1-x0)*(y1-y0));}return out;
}
function isolatedForeground(tones,w,h){
 const dark=Uint8Array.from(tones,v=>+(v<=.025));
 // Only an almost-black edge is a removable background. Red poster borders are ink.
 let black=0,total=0;for(let y=0;y<h;y++)for(let x=0;x<w;x++)if(x<2||y<2||x>=w-2||y>=h-2){black+=dark[y*w+x];total++;}
 if(black/total<.72)return null;
 const fg=new Uint8Array(dark.length);fg.fill(1);for(const r of regions(dark,w,h,1))if(r.border)for(const k of r.pixels)fg[k]=0;
 const coverage=fg.reduce((a,b)=>a+b,0)/fg.length;return coverage>.01&&coverage<.90?fg:null;
}
/** @returns {{nx:number,ny:number,tones:Float32Array,raw:Uint8Array,target:Uint8Array,stats:object}} */
export function prepareTarget(gray,iw,ih,options={}){
 if(!Number.isInteger(iw)||!Number.isInteger(ih)||iw<2||ih<2||iw*ih!==gray?.length||iw*ih>30_000_000)throw new Error('Invalid reference dimensions.');
 if(!gray.every(Number.isFinite))throw new Error('Reference contains non-finite pixels.');
 for(const key of ['resolution','threshold','contrast','detailPixels'])if(options[key]!==undefined&&(typeof options[key]!=='number'||!Number.isFinite(options[key])))throw new Error('Invalid target option: '+key);
 const nx=Math.round(clamp(options.resolution??200,32,512)),ny=Math.max(16,Math.round(nx*ih/iw));if(ny>1536)throw new Error('Reference aspect ratio exceeds the working canvas.');
 const threshold=clamp(options.threshold??.34,.03,.95),contrast=clamp(options.contrast??1,.25,3),style=options.style==='silhouette'?'silhouette':'portrait',detailPixels=Math.round(clamp(options.detailPixels??0,0,2));
 const sampled=resample(gray,iw,ih,nx,ny),mean=localMean(sampled,nx,ny,Math.max(2,Math.round(nx*.025))),tones=new Float32Array(sampled.length);
 // Mild unsharp contrast keeps existing line work; it never creates circular holes.
 for(let k=0;k<tones.length;k++)tones[k]=clamp((sampled[k]-.5)*contrast+.5+.12*(sampled[k]-mean[k]));
 const foreground=isolatedForeground(sampled,nx,ny),raw=new Uint8Array(tones.length);let silhouetteFilledPixels=0;
 for(let k=0;k<raw.length;k++)raw[k]=+(tones[k]<=threshold&&(!foreground||foreground[k]));
 if(foreground){
  const bright=Uint8Array.from(foreground,(v,k)=>+(v&&tones[k]>threshold));
  for(const region of regions(bright,nx,ny,1)){let touchesContour=false;
   for(const k of region.pixels){const x=k%nx,y=(k/nx)|0;for(let dy=-2;dy<=2&&!touchesContour;dy++)for(let dx=-2;dx<=2;dx++){const xx=x+dx,yy=y+dy;if(xx<0||yy<0||xx>=nx||yy>=ny||!foreground[yy*nx+xx]){touchesContour=true;break;}}if(touchesContour)break;}
   if(touchesContour||style==='silhouette'&&region.area<3){for(const k of region.pixels){raw[k]=1;silhouetteFilledPixels++;}}
  }
 }
 let target=raw.slice(),removedDarkPixels=0,filledLightPixels=0;
 // Default cleanup changes only one/two-pixel isolated islands, never a radius of two.
 for(const region of regions(target,nx,ny,1))if(region.area<=2){for(const k of region.pixels){target[k]=0;removedDarkPixels++;}}
 for(const region of regions(target,nx,ny,0))if(!region.border&&region.area<=2){for(const k of region.pixels){target[k]=1;filledLightPixels++;}}
 if(detailPixels){const smooth=localMean(target,nx,ny,1),next=target.slice();for(let k=0;k<next.length;k++){const neighbors=smooth[k];if(detailPixels===2&&neighbors>=.89)next[k]=1;else if(neighbors<=.11)next[k]=0;}target=next;}
 let changes=0,blackPixels=0;for(let k=0;k<target.length;k++){changes+=+(target[k]!==raw[k]);blackPixels+=target[k];}
 return{nx,ny,tones,raw,target,stats:{threshold,contrast,style,detailPixels,isolatedOnDark:!!foreground,silhouetteFilledPixels,removedDarkPixels,filledLightPixels,blackPixels,inkCoverage:blackPixels/target.length,changedRatio:changes/target.length,components:regions(target,nx,ny,1).length,holes:regions(target,nx,ny,0).filter(r=>!r.border).length}};
}
