// Remove only an edge-connected, dominant, saturated solid background.
// This is color segmentation, not semantic recognition or face detection.
export function rgbaToGray(rgba,w,h){const gray=new Float32Array(w*h),bins=new Map(),border=[];
 for(let y=0;y<h;y++)for(let x=0;x<w;x++){const k=y*w+x,i=k*4;gray[k]=(.2126*rgba[i]+.7152*rgba[i+1]+.0722*rgba[i+2])/255;if(x<2||y<2||x>=w-2||y>=h-2){const key=(rgba[i]>>4)*256+(rgba[i+1]>>4)*16+(rgba[i+2]>>4),b=bins.get(key)||{n:0,r:0,g:0,b:0};b.n++;b.r+=rgba[i];b.g+=rgba[i+1];b.b+=rgba[i+2];bins.set(key,b);border.push(k);}}
 const dominant=[...bins.values()].sort((a,b)=>b.n-a.n)[0],rgb=[dominant.r,dominant.g,dominant.b].map(x=>x/dominant.n),saturation=(Math.max(...rgb)-Math.min(...rgb))/255;
 const remove=dominant.n/border.length>.35&&saturation>.25;if(remove){const seen=new Uint8Array(gray.length),queue=new Int32Array(gray.length);let a=0,b=0;const near=k=>Math.hypot(rgba[k*4]-rgb[0],rgba[k*4+1]-rgb[1],rgba[k*4+2]-rgb[2])<50;for(const k of border)if(!seen[k]&&near(k)){queue[b++]=k;seen[k]=1;}while(a<b){const k=queue[a++],x=k%w,y=Math.floor(k/w);gray[k]=0;for(const q of[x>0?k-1:-1,x<w-1?k+1:-1,y>0?k-w:-1,y<h-1?k+w:-1])if(q>=0&&!seen[q]&&near(q)){queue[b++]=q;seen[q]=1;}}}
 return{gray,backgroundRemoved:remove};}
