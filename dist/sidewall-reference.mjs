// Fit a new reference to the reachable sidewall field without changing lamp hardware.
import {DEFAULTS} from './sidewall.mjs?v=sidewall-6';
export function settingsForReference(iw,ih,current=DEFAULTS){
 if(!Number.isFinite(iw)||!Number.isFinite(ih)||iw<=0||ih<=0)throw Error('Некорректные размеры изображения.');
 const p={...DEFAULTS,...current,wallWidth:DEFAULTS.wallWidth,imageY:DEFAULTS.imageY},ratio=ih/iw,B=p.bodySide/2,R=p.sourceZ*B/24;
 if(ratio>.9){
  const aboveWidth=Math.floor(Math.min(600,(R-B-32)/ratio,2*(400-B-12)/ratio)/10)*10;
  if(aboveWidth>=240){p.wallWidth=aboveWidth;p.imageY=Math.ceil((B+12+aboveWidth*ratio/2)/10)*10;}
  else{p.wallWidth=Math.max(240,Math.floor(Math.min(600,2*(R-24)/ratio)/10)*10);p.imageY=0;}
 }else{
  // Keep a suitable landscape composition; shrink only when it exceeds the angular field.
  const extent=Math.max(p.wallWidth/2,Math.abs(p.imageY)+p.wallWidth*ratio/2);
  if(extent>R-20){const scale=(R-20)/extent;p.wallWidth=Math.max(240,Math.floor(p.wallWidth*scale/10)*10);p.imageY=Math.max(0,Math.floor(p.imageY*scale/10)*10);}
 }
 return p;
}
