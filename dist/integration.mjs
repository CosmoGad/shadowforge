// World coordinates: wall z=0, lamp fixed at x=y=0.
export const LAYOUTS={above:'Над лампой',below:'Под лампой',left:'Слева от лампы',right:'Справа от лампы',center:'Вокруг лампы'};
export function hubHalfSize(p){const r=p.emitter/2,collar=(p.socket/2+2.4)*p.sourceZ/16+r*(p.sourceZ/16-1),socket=(p.socket-2)/2*p.sourceZ/12+r*(p.sourceZ/12-1);return Math.max(p.bodySide/2*p.sourceZ/(p.sourceZ-3),collar,socket);}
export function projectionLayout(p,height){
 const square=p.shape==='square',root=square?2*hubHalfSize(p):96,layout=square?(p.layout||'center'):'center',dx=(p.wallWidth+root)/2+8,dy=(height+root)/2+8;
 const imageX=layout==='left'?-dx:layout==='right'?dx:0,imageY=layout==='above'?dy:layout==='below'?-dy:0;
 const left=Math.min(imageX-p.wallWidth/2,-root/2),right=Math.max(imageX+p.wallWidth/2,root/2),bottom=Math.min(imageY-height/2,-root/2),top=Math.max(imageY+height/2,root/2);
 return{layout,imageX,imageY,centerX:(left+right)/2,centerY:(bottom+top)/2,worldWidth:(right-left)*1.18,worldHeight:(top-bottom)*1.18};
}
export function bodyCovers(d,wx,wy){return Math.abs(wx)<d.rootW/2+5&&Math.abs(wy)<d.rootH/2+5;}
export function integrationMetrics(d){const q=d.projection||{imageX:0,imageY:0};let ink=0,coveredInk=0,edge=0,coveredEdge=0;
 for(let y=1;y<d.ny-1;y++)for(let x=1;x<d.nx-1;x++){const k=y*d.nx+x,a=d.referenceTarget[k],e=a!==d.referenceTarget[k-1]||a!==d.referenceTarget[k-d.nx],covered=bodyCovers(d,(x+.5-d.nx/2)*d.pitch+q.imageX,(d.ny/2-y-.5)*d.pitch+q.imageY);ink+=a;edge+=+e;if(covered){coveredInk+=a;coveredEdge+=+e;}}
 return{coveredInk:coveredInk/Math.max(1,ink),coveredEdges:coveredEdge/Math.max(1,edge),inkPixels:ink};
}
