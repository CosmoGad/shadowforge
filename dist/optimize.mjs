import {integrationMetrics} from './integration.mjs?v=auto-integration-6';
import {makeWallDesign,simulateWall} from './wall.mjs?v=auto-integration-6';
import {measureContrast} from './clarity.mjs?v=auto-integration-6';
// Score against one fixed unsimplified target, so changing threshold/detail cannot
// improve the score merely by deleting inconvenient features. No central exclusion.
export function resultScore(d,sim,anchor){
 const actual=new Uint8Array(anchor.nx*anchor.ny),goal=anchor.referenceTarget;let tp=0,fp=0,fn=0,tn=0;
 for(let y=0;y<anchor.ny;y++)for(let x=0;x<anchor.nx;x++){const k=y*anchor.nx+x,wx=(x+.5-anchor.nx/2)*anchor.pitch+d.projection.imageX,wy=(anchor.ny/2-y-.5)*anchor.pitch+d.projection.imageY,sx=Math.floor(((wx-sim.centerX)/sim.worldWidth+.5)*sim.width),sy=Math.floor((.5-(wy-sim.centerY)/sim.worldHeight)*sim.height),a=sx>=0&&sy>=0&&sx<sim.width&&sy<sim.height?+(sim.shadow[sy*sim.width+sx]>=.5):0;actual[k]=a;if(a&&goal[k])tp++;else if(a)fp++;else if(goal[k])fn++;else tn++;}
 const edge=(a,k)=>a[k]!==a[k-1]||a[k]!==a[k-anchor.nx];let matches=0,ae=0,ge=0;
 for(let y=2;y<anchor.ny-2;y++)for(let x=2;x<anchor.nx-2;x++){const k=y*anchor.nx+x;if(edge(actual,k)){ae++;let near=false;for(let dy=-1;dy<=1;dy++)for(let dx=-1;dx<=1;dx++)if(edge(goal,k+dy*anchor.nx+dx))near=true;if(near)matches++;}if(edge(goal,k))ge++;}
 const iou=tp/Math.max(1,tp+fp+fn),balanced=(tp/Math.max(1,tp+fn)+tn/Math.max(1,tn+fp))/2,edgeF1=2*matches/Math.max(1,ae+ge),contrast=measureContrast(d,sim,d.p.ambient),covered=integrationMetrics({...anchor,projection:d.projection,rootW:d.rootW,rootH:d.rootH});
 const score=.35*iou+.25*balanced+.20*Math.min(1,edgeF1)+.20*contrast-.5*covered.coveredInk-.5*covered.coveredEdges;
 return{score,iou,balanced,edgeF1:Math.min(1,edgeF1),contrast,coveredInk:covered.coveredInk,coveredEdges:covered.coveredEdges};
}
export async function optimizeDesign(gray,iw,ih,settings,onProgress=()=>{},options={}){
 const anchor=makeWallDesign(gray,iw,ih,{...settings,threshold:options.goalThreshold??settings.threshold,shape:'square',resolution:96,layout:'center'}),trials=[],seen=new Set();let checked=0,errors=0;
 if(anchor.referenceTarget.reduce((a,b)=>a+b,0)<anchor.target.length*.005)throw new Error('Не удалось выделить рисунок. Измените порог или референс.');
 const test=async(p,stage)=>{const key=JSON.stringify([p.layout,p.sourceZ,p.bodySide,p.threshold,p.detailSize]);if(seen.has(key))return;seen.add(key);try{const d=makeWallDesign(gray,iw,ih,{...p,shape:'square',resolution:96}),sim=simulateWall(d,96,3),quality=resultScore(d,sim,anchor);trials.push({settings:{...p,shape:'square'},quality});}catch(e){errors++;}checked++;onProgress({checked,stage,errors});await new Promise(r=>setTimeout(r,0));};
 await test(settings,'Исходный вариант');const baseline=trials[0];
 for(const layout of options.layouts||['above','below','left','right','center'])for(const sourceZ of [...new Set([settings.sourceZ,150,200])])for(const bodySide of [...new Set([settings.bodySide,200])])await test({...settings,layout,sourceZ,bodySide},'Размещение, глубина и размер корпуса');
 const seeds=[...trials].sort((a,b)=>b.quality.score-a.quality.score).slice(0,2);
 for(const seed of seeds)for(const threshold of [...new Set([settings.threshold,.24,.38])])for(const detailSize of [...new Set([settings.detailSize,8,20])])await test({...seed.settings,threshold,detailSize},'Порог и крупность деталей');
 const finalists=[...trials].sort((a,b)=>b.quality.score-a.quality.score).slice(0,3);if(baseline&&!finalists.includes(baseline))finalists.push(baseline);
 let best,baseFinal;for(const candidate of finalists){try{const d=makeWallDesign(gray,iw,ih,{...candidate.settings,resolution:settings.resolution}),sim=simulateWall(d,200,9),quality=resultScore(d,sim,anchor);if(candidate===baseline)baseFinal=quality;if(!best||quality.score>best.quality.score)best={settings:d.p,d,sim,quality};}catch(e){errors++;}onProgress({checked:++checked,stage:'Проверка финалистов',errors});await new Promise(r=>setTimeout(r,0));}
 if(!best)throw new Error('Не удалось построить допустимый вариант. Попробуйте другой референс.');
 best.report={goalThreshold:options.goalThreshold??settings.threshold,tested:checked,errors,baseline:baseFinal||baseline?.quality,winner:best.quality,layout:best.settings.layout,search:'bounded deterministic geometric search',globalOptimum:false,physicalValidation:false};return best;
}
