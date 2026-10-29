import assert from 'node:assert/strict';
import {readFile,writeFile} from 'node:fs/promises';
import {DEFAULTS,makeWallDesign,simulateWall,buildBVH,occluded} from './dist/wall.mjs';
import {projectionLayout,hubHalfSize} from './dist/integration.mjs';
import {rgbaToGray} from './dist/image-input.mjs';
import {optimizeDesign,resultScore} from './dist/optimize.mjs';
assert(hubHalfSize({...DEFAULTS,sourceZ:200})>hubHalfSize({...DEFAULTS,sourceZ:100}),'socket shadow grows with source depth');
const reports=[];
for(const stem of ['rdr2-hl_6048643','spw20_introd','hunting']){
 const meta=JSON.parse(await readFile(new URL('./tests/references/'+stem+'.json',import.meta.url),'utf8')),rgba=await readFile(new URL('./tests/references/'+stem+'.rgba',import.meta.url)),converted=rgbaToGray(rgba,meta.width,meta.height),gray=converted.gray;
 if(stem==='spw20_introd'){assert(converted.backgroundRemoved);assert.equal(gray[0],0);}
 const center=makeWallDesign(gray,meta.width,meta.height,{layout:'center'});const above=makeWallDesign(gray,meta.width,meta.height,{layout:'above'});assert(center.integration.coveredInk>0);assert.equal(above.integration.coveredInk,0);assert.equal(above.integration.coveredEdges,0);const deep=makeWallDesign(gray,meta.width,meta.height,{layout:'above',sourceZ:200});assert(deep.projection.imageY-deep.height/2>hubHalfSize(deep.p)+5);
 for(const layout of ['above','below','left','right']){const p=projectionLayout({...DEFAULTS,layout},above.height);assert(Number.isFinite(p.centerX+p.centerY+p.worldWidth+p.worldHeight));}
 const start=Date.now(),best=await optimizeDesign(gray,meta.width,meta.height,{...DEFAULTS,layout:'center'});assert(best.report.tested>=20);assert(best.quality.score>=best.report.baseline.score-1e-10);assert.equal(best.d.cover.length,0);assert.equal(best.settings.sourceX,0);assert.equal(best.settings.sourceY,0);assert(best.d.integration.coveredInk<center.integration.coveredInk);assert.equal(best.d.projection.layout,best.settings.layout);
 const anchor=makeWallDesign(gray,meta.width,meta.height,{resolution:96,layout:'center'}),repeat=resultScore(best.d,best.sim,anchor);assert(Math.abs(repeat.score-best.quality.score)<1e-10);
 reports.push({reference:meta.name,backgroundRemoved:converted.backgroundRemoved,seconds:(Date.now()-start)/1000,...best.report,settings:best.settings});console.log(JSON.stringify(reports.at(-1)));
}
await writeFile(new URL('./test-output/optimization-verification.json',import.meta.url),JSON.stringify({passed:true,reports},null,2));
