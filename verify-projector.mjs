import assert from 'node:assert/strict';
import {readFile,writeFile,mkdir} from 'node:fs/promises';
import {rgbaToGray} from './dist/image-input.mjs';
import {makeProjector,traceProjector,evaluateProjector} from './dist/projector.mjs';
await mkdir('test-output/projector',{recursive:true});
for(const stem of ['rdr2-hl_6048643','spw20_introd','hunting']){const meta=JSON.parse(await readFile('tests/references/'+stem+'.json','utf8')),rgba=await readFile('tests/references/'+stem+'.rgba'),gray=rgbaToGray(rgba,meta.width,meta.height).gray;const start=Date.now();const d=makeProjector(gray,meta.width,meta.height);console.log(stem,'geometry',d.triangles.length,d.bridges,d.q);const sim=traceProjector(d,320,25),quality=evaluateProjector(d,sim);assert(quality.accepted,stem+': '+quality.reasons.join(', '));assert([sim.width,sim.height].every(Number.isInteger));assert(sim.data.length===sim.width*sim.height);console.log(stem,quality,'seconds',(Date.now()-start)/1000);await writeFile('test-output/projector/'+stem+'.pgm',Buffer.concat([Buffer.from('P5\n'+sim.width+' '+sim.height+'\n255\n'),Buffer.from(Uint8Array.from(sim.visibility,x=>Math.round(x*255)))]));await writeFile('test-output/projector/'+stem+'.json',JSON.stringify({q:d.q,quality,limits:d.limits,bridges:d.bridges},null,2));}

const numeric=['bodySide','wallWidth','sourceZ','emitter','minWeb','thickness','threshold','resolution'];const meta=JSON.parse(await readFile('tests/references/rdr2-hl_6048643.json','utf8')),g=rgbaToGray(await readFile('tests/references/rdr2-hl_6048643.rgba'),meta.width,meta.height).gray;for(const key of numeric)assert.throws(()=>makeProjector(g,meta.width,meta.height,{[key]:NaN}));
console.log('All three references and invalid input rejection passed.');
