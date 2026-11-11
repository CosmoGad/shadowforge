import {makeModel,renderFrame} from './core.mjs?v=lotus2';
let active=0;
onmessage=async({data})=>{
 active=data.id;const id=data.id,model=makeModel(undefined,data.pattern);
 try{
  const order=[data.selected,...Array.from({length:12},(_,i)=>i).filter(i=>i!==data.selected)];
  let count=0;
  for(const index of order){
   if(id!==active)return;
   let field;
   if(data.pattern==='flower'&&data.diameter===.15&&!data.mounts){try{const response=await fetch('./flower/cache/frame-'+String(index+1).padStart(2,'0')+'.f32?v=lotus2');if(!response.ok)throw Error('cache');const buf=await response.arrayBuffer();if(buf.byteLength!==2*256*256*4)throw Error('cache length');const values=new Float32Array(buf);field={index,size:256,span:440,samples:7,irradiance:values.slice(0,256*256),visibility:values.slice(256*256)};}catch{}}
   if(!field)field=renderFrame(model,index,{diameter:data.diameter,mounts:data.mounts,size:256,span:440});
   postMessage({id,type:'frame',field,count:++count},[field.irradiance.buffer,field.visibility.buffer]);
   await new Promise(resolve=>setTimeout(resolve,0));
  }
  if(id===active)postMessage({id,type:'done'});
 }catch(error){postMessage({id,type:'error',message:error.message});}
};