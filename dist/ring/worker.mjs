import {makeModel,renderFrame} from './core.mjs';
let active=0;
onmessage=async({data})=>{
 active=data.id;const id=data.id,model=makeModel();
 try{
  const order=[data.selected,...Array.from({length:12},(_,i)=>i).filter(i=>i!==data.selected)];
  let count=0;
  for(const index of order){
   if(id!==active)return;
   const field=renderFrame(model,index,{diameter:data.diameter,mounts:data.mounts,size:256,span:440});
   postMessage({id,type:'frame',field,count:++count},[field.irradiance.buffer,field.visibility.buffer]);
   await new Promise(resolve=>setTimeout(resolve,0));
  }
  if(id===active)postMessage({id,type:'done'});
 }catch(error){postMessage({id,type:'error',message:error.message});}
};