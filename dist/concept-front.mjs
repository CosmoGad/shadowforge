// Printable relief applied to the opaque front disc, not a projected texture.
import {extrude,circle} from './projector-mesh.mjs?v=service-5';

/** Two separate, flat-backed parts for adhesive bonding or multi-material printing. */
export function makeConceptDecor({diameter,frontZ}={}){
 if(!Number.isFinite(diameter)||diameter<100||diameter>210||!Number.isFinite(frontZ))throw new Error('Invalid concept-front dimensions.');
 const rimRadius=diameter/2-.35,rimWidth=1.8,motifRadius=diameter*.155;
 const rimLoops=[circle(0,0,rimRadius,240,false),circle(0,0,rimRadius-rimWidth,240,true)];
 const outer=Array.from({length:384},(_,i)=>{const a=i/384*Math.PI*2,r=motifRadius*(.76+.24*Math.cos(8*a));return[r*Math.cos(a),r*Math.sin(a)];});
 const petalHoles=Array.from({length:8},(_,i)=>{const a=i*Math.PI/4,c=Math.cos(a),s=Math.sin(a);return Array.from({length:48},(_,j)=>{const t=-j/48*Math.PI*2,u=motifRadius*(.57+.33*Math.cos(t)),v=motifRadius*.10*Math.sin(t);return[u*c-v*s,u*s+v*c];});});
 const rosetteLoops=[outer,...petalHoles,circle(0,0,motifRadius*.14,48,true)];
 const flat=(loops,height)=>extrude(loops,([x,y],f)=>[x,y,frontZ+height*f]);
 return {parts:[
  {name:'concept-gold-rim',triangles:flat(rimLoops,1),material:'gold',printHint:'Flat rear face on the bed. Bond to the opaque front disc; no optical aperture.'},
  {name:'concept-rosette',triangles:flat(rosetteLoops,.8),material:'gold',printHint:'Flat rear face on the bed. Centre on the opaque front disc; adhesive or multi-material printing.'}
 ],parameters:{diameter,frontZ,rimOuterRadius:rimRadius,rimWidth,rimThickness:1,rosetteDiameter:2*motifRadius,rosetteThickness:.8,rosettePetals:8,attachment:'Adhesive bonding or multi-material printing; no fasteners or text are included.',physicalFitTested:false}};
}
