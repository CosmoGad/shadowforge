import {writeFileSync,mkdirSync,readFileSync} from 'node:fs';
import assert from 'node:assert/strict';
import {makeModel,lift,project} from './dist/ring/core.mjs';
import {fadeWeight,mixIrradiance} from './dist/ring/transition.mjs';
const model=makeModel(undefined,'flower');
mkdirSync('dist/ring/flower/cut',{recursive:true});
const path=contours=>contours.map(p=>'M'+p.map(v=>v.slice(0,2).map(n=>n.toFixed(6)).join(',')).join('L')+'Z').join(' ');
const layout=[];
let sheet='<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 1200 570"><rect width="1200" height="570" fill="#f4f1e9"/><text x="24" y="30" font-family="Arial" font-size="18">SHADOWFORGE / НОЧНОЙ ЛОТОС — ЦЕЛЕВЫЕ ПОЗЫ</text>';
for(const m of model.masks){
 const contours=[m.outer,...m.holes].map(c=>c.map(p=>lift(p,m.source,34.9))),all=contours.flat(),minX=Math.min(...all.map(p=>p[0])),maxX=Math.max(...all.map(p=>p[0])),minY=Math.min(...all.map(p=>p[1])),maxY=Math.max(...all.map(p=>p[1]));
 const file='frame-'+String(m.index+1).padStart(2,'0')+'.svg',w=maxX-minX,h=maxY-minY;
 const svgContours=contours.map(c=>c.map(([x,y])=>[x-minX,maxY-y]));
 writeFileSync('dist/ring/flower/cut/'+file,'<svg xmlns="http://www.w3.org/2000/svg" width="'+w+'mm" height="'+h+'mm" viewBox="0 0 '+w+' '+h+'"><path d="'+path(svgContours)+'" fill="#000" fill-rule="evenodd"/></svg>');
 for(let i=0;i<contours.length;i++)for(let j=0;j<contours[i].length;j++){const [x,y]=svgContours[i][j],p=project([x+minX,maxY-y,34.9],m.source),goal=[m.outer,...m.holes][i][j];assert.ok(Math.hypot(p[0]-goal[0],p[1]-goal[1])<1e-8);}
 layout.push({frame:m.index+1,file,widthMm:w,heightMm:h,svgToAssembly:{x:'svgX + offsetX',y:'offsetY - svgY',z:34.9,offsetX:minX,offsetY:maxY},thicknessMm:.2,kerfCompensated:false});
 const x=(m.index%6)*200,y=Math.floor(m.index/6)*265+45;
 sheet+='<g transform="translate('+x+','+y+')"><rect x="5" y="5" width="190" height="250" rx="8" fill="#fffaf0" stroke="#d3c9b3"/><text x="20" y="28" font-family="Arial" font-size="14">'+String(m.index+1).padStart(2,'0')+'</text><path transform="translate(100,140)" d="'+path([m.outer,...m.holes].map(c=>c.map(([x,y])=>[x,-y])))+'" fill="#262b25" fill-rule="evenodd"/></g>';
}
writeFileSync('dist/ring/flower/cut/layout.json',JSON.stringify(layout,null,2));
writeFileSync('dist/ring/flower/sequence.svg',sheet+'</svg>');
const a=new Float32Array([0,1,2,4]),b=new Float32Array([4,2,1,0]),out=new Float32Array(4);
assert.deepEqual([...mixIrradiance(a,b,0,out)],[...a]);assert.deepEqual([...mixIrradiance(a,b,1,out)],[...b]);
assert.deepEqual([...mixIrradiance(a,b,.5,out)],[2,1.5,1.5,2]);
for(const amount of[0,.2,.8,1]){let prev=0;for(let i=0;i<=100;i++){const w=fadeWeight(i/100,amount);assert.ok(w>=prev&&w>=0&&w<=1);prev=w;}assert.equal(fadeWeight(0,amount),0);assert.equal(fadeWeight(1,amount),amount?1:0);}
for(let i=1;i<=12;i++){const data=readFileSync('dist/ring/flower/cache/frame-'+String(i).padStart(2,'0')+'.f32');assert.equal(data.length,524288);for(let k=0;k<data.length;k+=4)assert.ok(Number.isFinite(data.readFloatLE(k)));}
console.log('12 SVG masks: inverse projection verified; fade endpoints, monotonic weights, linear light mixing and all cached fields passed.');
