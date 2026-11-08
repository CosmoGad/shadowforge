import * as THREE from 'three';
import {OrbitControls} from '/hilal/vendor/OrbitControls.js';
const $=id=>document.getElementById(id),fmt=(v,d=1)=>Number(v).toLocaleString('ru-RU',{maximumFractionDigits:d});
const labels={'rear-mount':'Настенное основание','optical-insert':'Оптическая вставка','front-body':'Батарейный корпус','front-cover-ivory':'Лицевая крышка с розеткой','front-brass-rim':'Золотистый обод'};
let scene,camera,renderer,controls,group,sourceMarker,activeTab='model',assembly,wall,loaded=[];

/** Binary STL stores 50 bytes per triangle after its 84-byte header. */
export function parseBinarySTL(buffer){
 if(!(buffer instanceof ArrayBuffer)||buffer.byteLength<84)throw Error('STL слишком короткий.');
 const view=new DataView(buffer),count=view.getUint32(80,true);
 if(!count||count>5e6||84+50*count!==buffer.byteLength)throw Error('Некорректный бинарный STL.');
 const positions=new Float32Array(count*9);
 for(let i=0;i<count;i++)for(let k=0;k<9;k++){const v=view.getFloat32(84+50*i+12+4*k,true);if(!Number.isFinite(v))throw Error('STL содержит некорректные координаты.');positions[i*9+k]=v;}
 const geometry=new THREE.BufferGeometry();geometry.setAttribute('position',new THREE.BufferAttribute(positions,3));geometry.computeVertexNormals();geometry.computeBoundingBox();return geometry;
}
async function readJSON(file){const r=await fetch(file,{cache:'no-store'});if(!r.ok)throw Error(file+' недоступен');return r.json();}
async function metrics(){
 $('refreshMetrics').disabled=true;
 try{const q=await readJSON('final-metrics.json'),metric=q.quality||q,percent=(key,id)=>$(id).textContent=Number.isFinite(metric[key])?fmt(metric[key]*100,2)+'%':'—';percent('iou','metricIou');percent('missingTargetFraction','metricMissing');percent('lightWeightedExtraShadow','metricExtra');$('metricSamples').textContent=Number.isFinite(q.samples)?fmt(q.samples,0):'—';$('metricsStatus').textContent='Загружены финальные результаты расчёта';$('metricScope').textContent=q.region||metric.region||'Область оценки не указана в файле результатов.';const a=q.assumptions||{};if(a.photometry)$('metricScope').textContent+=' '+a.photometry;if(a.physicalValidation===false)$('metricScope').textContent+=' Физическое испытание ещё не проведено.';
 }catch{$('metricsStatus').textContent='Финальный расчёт ещё не опубликован';$('metricScope').textContent='Готовые значения появятся после сохранения final-metrics.json. Промежуточные оценки не подставляются.';for(const id of['metricIou','metricMissing','metricExtra','metricSamples'])$(id).textContent='—';}finally{$('refreshMetrics').disabled=false;}
 try{const r=await fetch('./print/optical-insert.stl',{method:'HEAD',cache:'no-store'});if(r.ok){$('kitDownload').setAttribute('aria-disabled','false');$('kitDownload').textContent='Скачать вставку для трубы';}}catch{}
}
function switchTab(name){activeTab=name;for(const b of document.querySelectorAll('[data-tab]')){const selected=b.dataset.tab===name;b.setAttribute('aria-selected',String(selected));b.tabIndex=selected?0:-1;}for(const n of['model','shadow','analysis'])$('pane-'+n).hidden=n!==name;if(renderer&&name!=='analysis'){ $(name==='shadow'?'shadowViewer':'viewer').prepend(renderer.domElement); if(wall)wall.visible=name==='shadow';controls.minAzimuthAngle=name==='shadow'?-1.4:-Infinity;controls.maxAzimuthAngle=name==='shadow'?1.4:Infinity;scene.traverse(o=>{if(o.isLight){o.userData.studioIntensity??=o.intensity;o.intensity=o.userData.studioIntensity*(name==='shadow'?.3:1);}}); renderer.setClearColor(name==='shadow'?0x171912:0xeae5db); refreshOptions();setCamera(name==='shadow');resize();}}
function resize(){if(!renderer)return;const host=$(activeTab==='shadow'?'shadowViewer':'viewer'),w=host.clientWidth,h=host.clientHeight;if(!w||!h)return;renderer.setSize(w,h,false);camera.aspect=w/h;camera.updateProjectionMatrix();}
function setCamera(front=false){camera.up.set(0,1,0);const shadow=activeTab==='shadow';controls.target.set(0,shadow?90:0,shadow?0:70);camera.position.set(...(shadow?(front?[0,90,1450]:[700,350,1300]):(front?[0,0,520]:[300,165,440])));controls.update();}
function refreshOptions(){
 const lighting=activeTab==='shadow',exploded=!lighting&&$('explode').checked,hardware=lighting||$('hardware').checked,opened=!lighting&&$('openCover').checked;
 for(const entry of loaded){const {mesh,name,bought}=entry;mesh.visible=(!bought||hardware)&&!(opened&&(name==='front-cover-ivory'||name==='front-brass-rim'||name.includes('cover-M2')));let z=0;
  if(exploded)z=name==='rear-mount'?-25:name==='optical-insert'?-7:name==='front-cover-ivory'?85:name==='front-brass-rim'?95:name==='optical-sleeve'?0:35;
  mesh.position.set(0,0,z);
 }
 if(sourceMarker){sourceMarker.visible=activeTab!=='shadow'&&$('showSource').checked;sourceMarker.position.set(...assembly.source);if(exploded)sourceMarker.position.z+=35;}
}
async function init(){
 try{
  assembly=await readJSON('assembly.json');if(!Array.isArray(assembly.parts)||!Array.isArray(assembly.hardware)||!Array.isArray(assembly.source)||assembly.source.length!==3)throw Error('Неполные данные сборки.');
  const host=$('viewer');renderer=new THREE.WebGLRenderer({antialias:true});renderer.setPixelRatio(Math.min(devicePixelRatio,2));renderer.outputColorSpace=THREE.SRGBColorSpace;renderer.setClearColor(0xeae5db,1);host.prepend(renderer.domElement);renderer.domElement.setAttribute('aria-label','Вращаемая STL-сборка светильника');
  scene=new THREE.Scene();camera=new THREE.PerspectiveCamera(34,1,.1,2500);controls=new OrbitControls(camera,renderer.domElement);controls.enableDamping=true;controls.minDistance=100;controls.maxDistance=2400;controls.maxPolarAngle=Math.PI;controls.enablePan=true;scene.add(new THREE.HemisphereLight(0xfff7e7,0x727268,2.7));const a=new THREE.DirectionalLight(0xfff4dd,3.6);a.position.set(130,180,280);scene.add(a);const b=new THREE.DirectionalLight(0xffffff,1.3);b.position.set(-150,40,180);scene.add(b);group=new THREE.Group();scene.add(group);setCamera();new ResizeObserver(resize).observe(host);new ResizeObserver(resize).observe($('shadowViewer'));resize();
  const entries=[...assembly.parts.map(p=>({...p,bought:false})),...assembly.hardware.map(p=>({...p,bought:true}))],links=$('partLinks');links.replaceChildren();
  for(const p of assembly.parts){const a=document.createElement('a');a.href='print/'+encodeURIComponent(p.name)+'.stl';a.download=p.name+'.stl';const title=document.createElement('b'),ext=document.createElement('span');title.textContent=labels[p.name]||p.name;ext.textContent='STL ↗';a.append(title,ext);links.append(a);}
  let done=0;await Promise.all(entries.map(async entry=>{const r=await fetch(entry.file);if(!r.ok)throw Error('Не удалось загрузить '+entry.name);const geometry=parseBinarySTL(await r.arrayBuffer()),sleeve=entry.role==='optical-sleeve'||entry.name==='optical-sleeve',gold=entry.name.includes('brass'),color=gold?new THREE.Color(0xb48b43):entry.name.includes('optical-insert')?new THREE.Color(0x252721):entry.bought?new THREE.Color(entry.name.includes('AA-cell')?0x807d70:0x555950):new THREE.Color(0xe8dfcb),material=new THREE.MeshStandardMaterial({color:sleeve?0xdfe9e8:color,roughness:gold?.37:.72,metalness:gold?.6:entry.bought?.25:0,transparent:sleeve,opacity:sleeve?.15:1,depthWrite:!sleeve,side:sleeve?THREE.DoubleSide:THREE.FrontSide}),mesh=new THREE.Mesh(geometry,material);mesh.name=entry.name;mesh.userData.role=entry.role||'printable';group.add(mesh);loaded.push({mesh,name:entry.name,bought:entry.bought});$('loadStatus').textContent='Загружено деталей: '+(++done)+' / '+entries.length;
   // assembly/*.stl already contains assembly coordinates. printToAssembly is
   // provenance for print/*.stl and must NOT be applied a second time here.
  }));
  sourceMarker=new THREE.Mesh(new THREE.SphereGeometry(.9,16,12),new THREE.MeshBasicMaterial({color:0xffb526,depthTest:false}));sourceMarker.renderOrder=4;scene.add(sourceMarker);refreshOptions();$('loadStatus').hidden=true;
  void loadWall();renderer.setAnimationLoop(()=>{if(activeTab!=='analysis'){controls.update();renderer.render(scene,camera);}});
 }catch(e){$('loadStatus').textContent='Не удалось открыть сборку: '+e.message+(location.protocol==='file:'?' Откройте просмотр через локальный веб-сервер.':'');$('loadStatus').hidden=false;}
}
for(const b of document.querySelectorAll('[data-tab]')){b.addEventListener('click',()=>switchTab(b.dataset.tab));b.addEventListener('keydown',e=>{if(!['ArrowLeft','ArrowRight','Home','End'].includes(e.key))return;e.preventDefault();const tabs=[...document.querySelectorAll('[data-tab]')],index=tabs.indexOf(b),next=e.key==='Home'?0:e.key==='End'?tabs.length-1:(index+(e.key==='ArrowRight'?1:-1)+tabs.length)%tabs.length;tabs[next].focus();switchTab(tabs[next].dataset.tab);});}
for(const id of['explode','hardware','openCover','showSource'])$(id).addEventListener('change',refreshOptions);
$('frontView').addEventListener('click',()=>{if(camera)setCamera(true);});$('angleView').addEventListener('click',()=>{if(camera)setCamera(false);});$('refreshMetrics').addEventListener('click',metrics);
for(const id of['analysisImage'])$(id).addEventListener('error',()=>{$(id).hidden=true;$(id).nextElementSibling.hidden=false;});
void metrics();void init();



// Wall is the stored numerical ray-traced field, located in assembly millimetres.
// Orbit changes the observer only; light, wall and STL remain fixed together.
async function loadWall(){
 try{
  const meta=await readJSON('final.json'),r=await fetch('final-irradiance.f32');
  if(!r.ok)throw Error('Карта освещения недоступна');
  const values=new Float32Array(await r.arrayBuffer());
  if(values.length!==meta.n*meta.n)throw Error('Размер карты не совпадает с расчётом');
  const canvas=document.createElement('canvas');canvas.width=canvas.height=meta.n;
  const ctx=canvas.getContext('2d'),pixels=ctx.createImageData(meta.n,meta.n);
  const texture=new THREE.CanvasTexture(canvas);texture.colorSpace=THREE.SRGBColorSpace;
  texture.generateMipmaps=false;texture.minFilter=THREE.LinearFilter;texture.magFilter=THREE.LinearFilter;
  function expose(){const exposure=Number($('exposure').value);for(let i=0;i<values.length;i++){
   const level=Math.pow(1-Math.exp(-exposure*(values[i]+.002)),1/2.2);
   pixels.data.set([255*level,255*.84*level,255*.58*level,255],4*i);
  }ctx.putImageData(pixels,0,0);texture.needsUpdate=true;}
  expose();$('exposure').addEventListener('input',expose);
  wall=new THREE.Mesh(new THREE.PlaneGeometry(meta.span,meta.span),new THREE.MeshBasicMaterial({map:texture,side:THREE.DoubleSide,toneMapped:false}));
  wall.position.set(meta.cx,meta.cy,-.05);wall.visible=activeTab==='shadow';scene.add(wall);
  $('shadowStatus').hidden=true;
 }catch(e){$('shadowStatus').textContent='Не удалось открыть расчёт: '+e.message;}
}
$('shadowFront').addEventListener('click',()=>{if(camera)setCamera(true);});
$('shadowAngle').addEventListener('click',()=>{if(camera)setCamera(false);});

