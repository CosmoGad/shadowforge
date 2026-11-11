// Coordinates are from the optical model. Package markers are enlarged annotations.
export function drawSources(ctx,model,index,blend,scale){
 const c=model.config;
 ctx.beginPath();ctx.arc(0,0,c.outerRadius*scale,0,Math.PI*2);ctx.arc(0,0,c.innerRadius*scale,0,Math.PI*2,true);ctx.fillStyle='#283b3c';ctx.fill();
 for(const m of model.masks){
  const n=m.target.length;ctx.beginPath();let offset=0;
  for(const contour of [m.outer,...m.holes]){const vertices=m.vertices.slice(offset,offset+contour.length);vertices.forEach((p,j)=>{const x=p[0]*scale,y=-p[1]*scale;j?ctx.lineTo(x,y):ctx.moveTo(x,y);});ctx.closePath();offset+=contour.length;}
  ctx.fillStyle=m.index===index?'#8dd5c9':'#557b75';ctx.fill('evenodd');
 }
 for(const m of model.masks){
  const i=m.index,s=m.source,x=s[0]*scale,y=-s[1]*scale,power=i===index?1-blend:i===(index+1)%c.frames?blend:0;
  ctx.save();ctx.translate(x,y);ctx.rotate(Math.atan2(-y,-x)-Math.PI/2);
  ctx.fillStyle='#101f23';ctx.strokeStyle='#8b9fa0';ctx.lineWidth=1.5;ctx.fillRect(-10,-7,20,14);ctx.strokeRect(-10,-7,20,14);
  if(power>0){ctx.shadowColor='#fff1b4';ctx.shadowBlur=12+18*power;}
  ctx.fillStyle=power>0?'rgba(255,235,172,'+(.25+.75*power)+')':'#657476';ctx.fillRect(-5,-5,10,10);ctx.shadowBlur=0;
  // Only a short local arrow, ending near the mask: no rays across the artwork.
  if(power>0){ctx.strokeStyle='#8dd5c9';ctx.lineWidth=2;ctx.beginPath();ctx.moveTo(0,12);ctx.lineTo(0,31);ctx.moveTo(-4,25);ctx.lineTo(0,31);ctx.lineTo(4,25);ctx.stroke();}
  ctx.restore();
  const r=Math.hypot(x,y),lx=x*(r+26)/r,ly=y*(r+26)/r;
  ctx.font='bold 16px Arial';ctx.textAlign='center';ctx.textBaseline='middle';ctx.fillStyle=power>0?'#fff1ba':'#a9b7b2';ctx.fillText(String(i+1).padStart(2,'0'),lx,ly);
 }
}
