import {OPENING,flowerTarget} from './flower.mjs';
import {CONFIG as C,makeModel,rgba,stl,light,sub,norm,unit,mul,add} from './core.mjs';
const pattern=document.body.dataset.pattern||'triangle',isFlower=pattern==='flower';
const $=id=>document.getElementById(id),model=makeModel(undefined,pattern),frames=new Map(),worker=new Worker('./worker.mjs',{type:'module'});
let index=0,view='wall',playing=false,lastTick=0,requestId=0,complete=false;
let THREE,scene,camera,renderer,orbit,wallTexture,wallMesh,housing,cover,maskMeshes=[],wireMeshes=[],sourceMeshes=[],rayGroup,threePromise;
const wallCanvas=$('wallCanvas'),ctx=wallCanvas.getContext('2d'),textureCanvas=document.createElement('canvas');
textureCanvas.width=textureCanvas.height=256;
const texctx=textureCanvas.getContext('2d');
const fmt=x=>Number(x).toLocaleString('ru-RU',{maximumFractionDigits:2});
function download(name,data,type){const url=URL.createObjectURL(new Blob([data],{type})),a=document.createElement('a');a.href=url;a.download=name;a.click();setTimeout(()=>URL.revokeObjectURL(url),1000);}
const strips=[];
for(let i=0;i<C.frames;i++){
 const button=document.createElement('button');button.type='button';button.setAttribute('aria-label','Кадр '+(i+1)+(isFlower?', раскрытие '+Math.round(OPENING[i]*100)+' процентов':', поворот '+i*10+' градусов'));
 const pts=isFlower?flowerTarget(i).map(p=>p[0]+','+(-p[1])).join(' '):'0,-48 41.57,24 -41.57,24';
 button.innerHTML='<svg viewBox="-60 -60 120 120" aria-hidden="true"><polygon points="'+pts+'" transform="rotate('+(isFlower?0:i*10)+')" fill="currentColor"/></svg><span>'+String(i+1).padStart(2,'0')+'</span>';
 button.addEventListener('click',()=>{pause();selectFrame(i);});$('frameStrip').append(button);strips.push(button);
}
function setStatus(message){$('calcStatus').textContent=message;}
function recalculate(){
 pause();complete=false;frames.clear();$('play').disabled=true;$('loadStatus').hidden=false;$('loadStatus').textContent='Считаем лучи выбранного кадра…';
 setStatus('0 / 12 кадров · лучевая проверка');requestId++;
 worker.postMessage({id:requestId,pattern,selected:index,diameter:Number($('emitter').value),mounts:$('mounts').checked});
 const d=Number($('emitter').value);
 $('observation').textContent=d===0?'Идеальный точечный источник проверяет геометрию. Такой вариант не показывает физическую полутень.':d>=.3?'Сравните края силуэта: близость фигур к источнику и косой свет увеличивают полутень. Яркость апертуры требует отдельного опыта.':'Малая апертура сохраняет читаемый контур. Проверяем, хватит ли её светового потока для реальной стены.';
 $('supportNote').textContent=$('mounts').checked?'Две проволоки Ø 0,15 мм держат каждую фигуру. Их дополнительные тени входят в расчёт. Прочность крепления не проверена.':'Крепление исключено из расчёта для сравнения. Свободно висящая в воздухе фигура физически невозможна: для сборки нужно вернуть крепёж.';
}
worker.onmessage=({data})=>{
 if(data.id!==requestId)return;
 if(data.type==='error'){setStatus('Ошибка расчёта: '+data.message);$('loadStatus').textContent='Не удалось рассчитать: '+data.message;return;}
 if(data.type==='frame'){
  frames.set(data.field.index,data.field);setStatus(data.count+' / 12 кадров · '+data.field.samples+' отсч. источника · 256² лучей');
  if(data.field.index===index){$('loadStatus').hidden=true;paint();}
 }
 if(data.type==='done'){complete=true;$('play').disabled=false;setStatus('12 / 12 готовы · '+(Number($('emitter').value)===0?'точечный источник':'7 отсчётов источника')+' · 256² точек стены');}
};
worker.onerror=()=>{setStatus('Ошибка запуска вычислений. Перезагрузите страницу.');$('loadStatus').textContent='Не удалось запустить расчёт лучей.';};
function selectFrame(i){
 index=(i+C.frames)%C.frames;$('frame').value=String(index);$('frameLabel').textContent='КАДР '+String(index+1).padStart(2,'0')+' / 12';$('angle').textContent=isFlower?Math.round(OPENING[index]*100)+'%':index*10+'°';
 $('downloadFrame').firstChild.textContent='Скачать фигуру кадра '+String(index+1).padStart(2,'0')+' ';
 strips.forEach((b,j)=>b.setAttribute('aria-pressed',String(j===index)));
 if(frames.has(index)){$('loadStatus').hidden=true;paint();}else{$('loadStatus').hidden=false;$('loadStatus').textContent='Считаем кадр '+(index+1)+'…';}
 if(renderer)refresh3D();
}
function paint(){
 const field=frames.get(index);if(!field)return;
 const image=new ImageData(rgba(field),field.size,field.size);texctx.putImageData(image,0,0);
 const w=wallCanvas.width,h=wallCanvas.height,scale=w/field.span;ctx.clearRect(0,0,w,h);ctx.imageSmoothingEnabled=true;ctx.drawImage(textureCanvas,0,0,w,h);
 ctx.save();ctx.translate(w/2,h/2);
 // The ring is a diagram of the front bezel; channel markers are annotations.
 const gradient=ctx.createLinearGradient(-200*scale,-200*scale,200*scale,200*scale);gradient.addColorStop(0,isFlower?'#f1e9d5':'#4c5146');gradient.addColorStop(.3,isFlower?'#d7c9ac':'#77796a');gradient.addColorStop(.55,isFlower?'#e7dcc4':'#40473c');gradient.addColorStop(1,isFlower?'#b6a688':'#282f27');
 ctx.beginPath();ctx.arc(0,0,C.outerRadius*scale,0,Math.PI*2);ctx.arc(0,0,C.innerRadius*scale,0,Math.PI*2,true);ctx.fillStyle=gradient;ctx.fill();
 ctx.strokeStyle='#b4a374';ctx.lineWidth=1.2;ctx.beginPath();ctx.arc(0,0,(C.outerRadius-1.5)*scale,0,Math.PI*2);ctx.stroke();ctx.strokeStyle='#20271f';ctx.lineWidth=3;ctx.beginPath();ctx.arc(0,0,C.innerRadius*scale,0,Math.PI*2);ctx.stroke();
 for(let j=0;j<C.frames;j++){const s=light(j),x=s[0]*scale,y=-s[1]*scale;ctx.beginPath();ctx.arc(x,y,12,0,Math.PI*2);ctx.fillStyle=j===index?'#b59b60':isFlower?'#e2d7bd':'#323b30';ctx.fill();ctx.fillStyle=j===index?'#30392e':isFlower?'#756b54':'#b1b39d';ctx.font='12px Arial';ctx.textAlign='center';ctx.textBaseline='middle';ctx.fillText(String(j+1).padStart(2,'0'),x,y);}
 ctx.restore();
 if(wallTexture)wallTexture.needsUpdate=true;
}
function pause(){playing=false;$('play').textContent='▶ Смотреть движение';$('play').setAttribute('aria-label','Запустить анимацию');}
$('play').addEventListener('click',()=>{if(playing){pause();return;}if(!complete)return;playing=true;lastTick=performance.now();$('play').textContent='Ⅱ Остановить';$('play').setAttribute('aria-label','Остановить анимацию');});
$('previous').addEventListener('click',()=>{pause();selectFrame(index-1);});
$('next').addEventListener('click',()=>{pause();selectFrame(index+1);});
$('frame').addEventListener('input',()=>{pause();selectFrame(Number($('frame').value));});
$('fps').addEventListener('input',()=>{$('fpsLabel').textContent=$('fps').value+' кадра/с';lastTick=performance.now();});
for(const id of['emitter','mounts'])$(id).addEventListener('change',()=>{recalculate();if(renderer)refresh3D();});
$('downloadFrame').addEventListener('click',()=>download((isFlower?'flower-frame-':'ring-frame-')+String(index+1).padStart(2,'0')+'.stl',stl(model.masks[index]),'model/stl'));
$('cover').addEventListener('change',refresh3D);
document.addEventListener('visibilitychange',()=>{if(document.hidden)pause();});
function tick(now){
 if(playing&&!document.hidden){const dt=1000/Number($('fps').value);if(now-lastTick>=dt){const steps=Math.floor((now-lastTick)/dt);lastTick+=steps*dt;selectFrame(index+steps);}}
 if(renderer&&view!=='wall'){orbit.update();renderer.render(scene,camera);}requestAnimationFrame(tick);
}
function geometry(triangles){const vertices=new Float32Array(triangles.flat(2)),g=new THREE.BufferGeometry();g.setAttribute('position',new THREE.BufferAttribute(vertices,3));g.computeVertexNormals();return g;}
function annulus(inner,outer,z,depth,color){
 const shape=new THREE.Shape();shape.absarc(0,0,outer,0,Math.PI*2,false);const hole=new THREE.Path();hole.absarc(0,0,inner,0,Math.PI*2,true);shape.holes.push(hole);
 const g=new THREE.ExtrudeGeometry(shape,{depth,bevelEnabled:false,curveSegments:128}),mesh=new THREE.Mesh(g,new THREE.MeshStandardMaterial({color,metalness:.5,roughness:.52}));mesh.position.z=z;return mesh;
}
function cylinder(a,b,r,color){
 const d=sub(b,a),mesh=new THREE.Mesh(new THREE.CylinderGeometry(r,r,norm(d),8),new THREE.MeshStandardMaterial({color,metalness:.7,roughness:.5}));
 mesh.position.fromArray(mul(add(a,b),.5));mesh.quaternion.setFromUnitVectors(new THREE.Vector3(0,1,0),new THREE.Vector3(...unit(d)));return mesh;
}
async function init3D(){
 if(renderer)return;
 THREE=await import('three');const {OrbitControls}=await import('../vendor/OrbitControls.js');
 const host=$('modelView');renderer=new THREE.WebGLRenderer({antialias:true});renderer.setPixelRatio(Math.min(devicePixelRatio,2));renderer.setClearColor(0x30352d);renderer.outputColorSpace=THREE.SRGBColorSpace;host.append(renderer.domElement);renderer.domElement.setAttribute('aria-label','3D-модель кольца, объёмных фигур и лучей');
 scene=new THREE.Scene();camera=new THREE.PerspectiveCamera(35,1,.1,2500);orbit=new OrbitControls(camera,renderer.domElement);orbit.enableDamping=true;orbit.minDistance=8;orbit.maxDistance=1600;
 scene.add(new THREE.HemisphereLight(0xfff5d9,0x404d3e,2.5));const key=new THREE.DirectionalLight(0xfff5d5,3);key.position.set(-200,250,400);scene.add(key);
 wallTexture=new THREE.CanvasTexture(textureCanvas);wallTexture.colorSpace=THREE.SRGBColorSpace;
 wallMesh=new THREE.Mesh(new THREE.PlaneGeometry(440,440),new THREE.MeshBasicMaterial({map:wallTexture,side:THREE.DoubleSide}));wallMesh.position.z=-.02;scene.add(wallMesh);
 housing=new THREE.Group();housing.add(annulus(180,200,0,3,0x424a3b),annulus(198,200,0,45,0x434b3e));scene.add(housing);
 cover=annulus(140,200,42,3,isFlower?0xe0d6bf:0x69705a);scene.add(cover);
 for(const m of model.masks){const mesh=new THREE.Mesh(geometry(m.triangles),new THREE.MeshStandardMaterial({color:0x353e31,roughness:.75,side:THREE.DoubleSide}));scene.add(mesh);maskMeshes.push(mesh);}
 for(const w of model.wires){const mesh=cylinder(w.a,w.b,w.radius,0xbab79f);mesh.userData.index=w.index;scene.add(mesh);wireMeshes.push(mesh);}
 for(let i=0;i<12;i++){const s=light(i),mesh=new THREE.Mesh(new THREE.SphereGeometry(1.4,12,8),new THREE.MeshBasicMaterial({color:0x8d9067}));mesh.position.fromArray(s);scene.add(mesh);sourceMeshes.push(mesh);}
 rayGroup=new THREE.Group();scene.add(rayGroup);new ResizeObserver(resize3D).observe(host);resize3D();
}
function resize3D(){if(!renderer)return;const host=$('modelView'),w=host.clientWidth,h=host.clientHeight;if(!w||!h)return;renderer.setSize(w,h,false);camera.aspect=w/h;camera.updateProjectionMatrix();}
function refresh3D(){
 if(!renderer)return;
 const detail=view==='detail';cover.visible=!detail&&$('cover').checked;housing.visible=!detail;wallMesh.visible=!detail;
 maskMeshes.forEach((m,i)=>{m.visible=!detail||i===index;m.material.color.setHex(i===index?0xbda36b:0x353e31);});
 sourceMeshes.forEach((m,i)=>{m.visible=!detail||i===index;m.material.color.setHex(i===index?0xffd47b:0x737b5c);});
 wireMeshes.forEach(m=>m.visible=$('mounts').checked&&(!detail||m.userData.index===index));
 while(rayGroup.children.length){const child=rayGroup.children[0];rayGroup.remove(child);child.geometry.dispose();child.material.dispose();}
 const selected=model.masks[index],s=selected.source,outline=detail?selected.vertices.slice(0,selected.target.length):selected.target,rayEnds=isFlower?outline.filter((_,i)=>i%8===0):outline;
 for(const p of rayEnds){const g=new THREE.BufferGeometry().setFromPoints([new THREE.Vector3(...s),new THREE.Vector3(...p)]),line=new THREE.Line(g,new THREE.LineBasicMaterial({color:0xd1b570,transparent:true,opacity:.65}));rayGroup.add(line);}
 if(detail){const center=mul(selected.vertices.reduce(add,[0,0,0]),1/selected.vertices.length);orbit.target.set(...center);camera.position.set(center[0]+22,center[1]+24,center[2]+48);orbit.update();}
}
async function setView(name){
 view=name;document.querySelectorAll('[data-view]').forEach(b=>b.setAttribute('aria-pressed',String(b.dataset.view===name)));
 $('wallCanvas').hidden=name!=='wall';$('modelView').hidden=name==='wall';$('coverControl').hidden=name!=='model';
 $('viewCaption').textContent=name==='wall'?'Тень — расчёт · номера каналов — схема':name==='model'?'Вращайте мышью · крышка снята для осмотра':'Реальный объём клина · золотой контур — лучи от источника';
 if(name==='wall')return;
 try{threePromise??=init3D();await threePromise;refresh3D();if(name==='model'){orbit.target.set(0,0,15);camera.position.set(330,180,650);orbit.update();}resize3D();}
 catch(error){$('loadStatus').hidden=false;$('loadStatus').textContent='3D недоступен: '+error.message+'. Расчёт тени доступен в первом виде.';}
}
document.querySelectorAll('[data-view]').forEach(b=>b.addEventListener('click',()=>setView(b.dataset.view)));
selectFrame(isFlower?5:0);recalculate();requestAnimationFrame(tick);
