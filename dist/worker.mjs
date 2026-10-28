import {makeDesign,simulate,compare} from './core.mjs';
self.onmessage=({data})=>{try{const d=makeDesign(data.gray,data.iw,data.ih,data.settings),sim=simulate(d,data.resolution,data.samples),comparison=compare(d,sim);self.postMessage({id:data.id,sim,comparison},[sim.data.buffer,comparison.actual.buffer]);}catch(e){self.postMessage({id:data.id,error:e.message});}};
