export function fadeWeight(phase,amount){
 const duration=Math.max(0,Math.min(1,amount));
 if(duration===0)return 0;
 const t=Math.max(0,Math.min(1,(phase-(1-duration))/duration));
 return t*t*(3-2*t);
}
export function mixIrradiance(a,b,t,out){
 if(a.length!==b.length||out.length!==a.length)throw Error('Incompatible light fields');
 for(let i=0;i<a.length;i++)out[i]=a[i]*(1-t)+b[i]*t;
 return out;
}
