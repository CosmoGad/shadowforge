import {DEFAULTS,clamp,makeDesign,maskMesh,housingMesh,backMesh,housingDimensions,stlBuffer,zipStore} from './core.mjs';
const $=id=>document.getElementById(id), numberIds=['width','thickness','columns','web','minHole','sourceDistance','wallDistance','emitter','gamma','contrast','threshold','sourceX','sourceY','socket','exposure'];
let settings={...DEFAULTS}, design, sim, comparison, gray, iw, ih, sourceURL='assets/batman.png', referenceName='Batman', view='projection', generation=0, worker, debounce, model, lastQuality=25, toastTimer;
const referenceCanvas=document.createElement('canvas');
const fmt=(n,d=0)=>Number(n).toLocaleString('ru-RU',{maximumFractionDigits:d});
function toast(text){$('toast').textContent=text;$('toast').hidden=false;clearTimeout(toastTimer);toastTimer=setTimeout(()=>$('toast').hidden=true,5000);}
function setBusy(value){$('busy').hidden=!value;$('liveState').classList.toggle('calculating',value);$('liveState').innerHTML=`<i></i> ${value?'Расчёт лучей':'Расчёт готов'}`;}
function syncControls(){
  for(const id of numberIds){$(id).value=settings[id];updateOutput(id);}
  $('invert').checked=settings.invert;$('ambientCheck').checked=settings.ambient>0;
  document.querySelectorAll('[data-mode]').forEach(b=>b.classList.toggle('active',b.dataset.mode===settings.mode));
  document.querySelectorAll('.tone-field').forEach(x=>x.hidden=settings.mode!=='tone');document.querySelectorAll('.binary-field').forEach(x=>x.hidden=settings.mode!=='binary');
}
function updateOutput(id){const el=$(id),out=$(id+'Out');if(out){let val=fmt(+el.value,2);if(['sourceDistance','wallDistance','emitter'].includes(id))val+=' мм';if(id==='columns')val+=' столбца';if(['contrast','exposure','gamma'].includes(id))val+='×';out.value=val;}if(el.type==='range')el.style.setProperty('--pct',100*(el.value-el.min)/(el.max-el.min)+'%');}
async function setImage(url,name='Изображение'){
  const image=new Image();await new Promise((resolve,reject)=>{image.onload=resolve;image.onerror=()=>reject(new Error('Не удалось прочитать изображение. Используйте PNG, JPEG или WebP.'));image.src=url;});
  const scale=Math.min(1,720/Math.max(image.width,image.height)),nextWidth=Math.round(image.width*scale),nextHeight=Math.round(image.height*scale);
  if(nextWidth/nextHeight<.2||nextWidth/nextHeight>5)throw new Error('Выберите изображение с соотношением сторон от 1:5 до 5:1.');
  iw=nextWidth;ih=nextHeight;
  referenceCanvas.width=iw;referenceCanvas.height=ih;const ctx=referenceCanvas.getContext('2d',{willReadFrequently:true});ctx.fillStyle='#000';ctx.fillRect(0,0,iw,ih);ctx.drawImage(image,0,0,iw,ih);
  const rgba=ctx.getImageData(0,0,iw,ih).data;gray=new Float32Array(iw*ih);for(let i=0;i<gray.length;i++)gray[i]=(.2126*rgba[i*4]+.7152*rgba[i*4+1]+.0722*rgba[i*4+2])/255;
  sourceURL=referenceCanvas.toDataURL('image/png');referenceName=name;$('thumb').src=sourceURL;$('referenceImage').src=sourceURL;$('imageName').textContent=name;$('referenceTitle').textContent=name;
  document.querySelector('.project-name').innerHTML='<span class="status-dot"></span><span></span><span class="muted">/</span><span class="muted">исследование № 001</span>';document.querySelector('.project-name>span:nth-child(2)').textContent=name;
  requestCalculation();
}
function requestCalculation(samples=25,resolution=384){
  clearTimeout(debounce);generation++;sim=null;comparison=null;$('export').disabled=true;$('downloadMask').disabled=true;
  if(!gray)return;try{
    for(const id of numberIds){const input=$(id);if(!input.checkValidity())throw new Error(`Проверьте значение: ${input.parentElement.textContent.trim().split('\n')[0]}.`);}
    design=makeDesign(gray,iw,ih,settings);updateDesign();setBusy(true);
    debounce=setTimeout(()=>{
      worker?.terminate();worker=new Worker('worker.mjs',{type:'module'});const id=generation;
      worker.onmessage=({data})=>{if(data.id!==generation)return;if(data.error){showError(data.error);return;}sim=data.sim;comparison=data.comparison;lastQuality=samples;setBusy(false);$('export').disabled=false;$('downloadMask').disabled=false;paintProjection();paintComparison();updateMetrics();if(view==='model')void update3D();};
      worker.onerror=e=>showError('Ошибка расчёта: '+e.message);worker.postMessage({id,gray,iw,ih,settings,resolution,samples});
    },130);
  }catch(e){showError(e.message);}
}
function showError(text){worker?.terminate();setBusy(false);$('liveState').textContent='Проверьте параметры';$('readyChip').textContent='Есть ошибка';$('readyChip').classList.add('warn');$('warningNote').textContent=text;$('export').disabled=true;$('downloadMask').disabled=true;toast(text);}
function updateDesign(){
  const d=design,p=d.p;$('holesMetric').textContent=fmt(d.count);$('gridMetric').textContent=`сетка ${d.nx} × ${d.ny}`;
  $('sizeMetric').textContent=`${fmt(p.width*d.magnification/10)} × ${fmt(d.height*d.magnification/10)} см`;
  $('projectionWidth').textContent=fmt(p.width*d.magnification)+' мм';$('svgA').textContent=fmt(p.sourceDistance)+' мм';$('svgB').textContent=fmt(p.wallDistance)+' мм';
  $('meshLabel').textContent=`Маска ${fmt(d.outerWidth,1)} × ${fmt(d.outerHeight,1)} × ${fmt(p.thickness,1)} мм`;
  const bad=p.web<.6||p.minHole<.45,blur=p.emitter*p.wallDistance/p.sourceDistance;
  $('readyChip').textContent=bad?'Тонкие детали':'Геометрия OK';$('readyChip').classList.toggle('warn',bad);
  const entries=[['Единая сетка перемычек',false],[`Минимальная перемычка ${fmt(p.web,2)} мм`,p.web<.6],[`Минимальное отверстие ${fmt(p.minHole,2)} мм`,p.minHole<.45],[`Открытая площадь ${fmt(d.openRatio*100,1)}%`,d.openRatio<.03],[`Пропущено мелких ячеек: ${fmt(d.lost)}`,d.lost>d.holes.length*.2]];
  $('checks').replaceChildren(...entries.map(([text,warn])=>{const li=document.createElement('li');li.textContent=text;if(warn)li.className='warn';return li;}));
  $('warningNote').textContent=blur>10?'Источник размывает мелкие детали. Уменьшите светящийся участок или увеличение.':bad?'Мелкие элементы могут не пропечататься. Проверьте слои в слайсере.':'Связность обеспечена сеткой. Проверьте отверстия в слайсере и откалибруйте источник на образце.';
  if(model)model.dirty=true;
}
function updateMetrics(){if(!sim)return;$('blurMetric').textContent=fmt(sim.blur,1)+' мм';$('errorMetric').textContent=fmt(comparison.rmse,3);$('sampleLabel').textContent=`${sim.samples} выборок источника / пиксель`;$('stageCaption').textContent=settings.emitter===0?'Идеальный точечный источник · без размытия':'Геометрическая оптика · модель светящейся области';}
function paintProjection(){
  if(!sim)return;const c=$('projectionCanvas');c.width=sim.width;c.height=sim.height;const ctx=c.getContext('2d'),image=ctx.createImageData(c.width,c.height),maxFill=(design.maxHole/design.pitch)**2;
  // Display exposure is separate from the optical calculation; no reference overlay.
  for(let i=0;i<sim.data.length;i++){
    const e=sim.data[i]*settings.exposure/Math.max(.15,maxFill),v=1-Math.exp(-e),amb=settings.ambient;
    image.data[i*4]=Math.round(clamp(.055+amb+v*.94)*255);image.data[i*4+1]=Math.round(clamp(.065+amb+Math.pow(v,1.18)*.61)*255);image.data[i*4+2]=Math.round(clamp(.043+amb*.6+Math.pow(v,1.4)*.22)*255);image.data[i*4+3]=255;
  }ctx.putImageData(image,0,0);if(model)model.projectionDirty=true;
}
function paintComparison(){
  if(!sim)return;const d=design;
  [['targetCanvas',d.target],['actualCanvas',comparison.actual.map(x=>clamp(x*comparison.gain))],['errorCanvas',comparison.actual.map((x,i)=>Math.abs(clamp(x*comparison.gain)-d.target[i]))]].forEach(([id,values])=>{
    const c=$(id);c.width=d.nx;c.height=d.ny;const ctx=c.getContext('2d'),im=ctx.createImageData(d.nx,d.ny);for(let i=0;i<values.length;i++){const v=clamp(values[i]);im.data[i*4]=v*255;im.data[i*4+1]=v*(id==='errorCanvas'?95:235);im.data[i*4+2]=v*(id==='errorCanvas'?40:205);im.data[i*4+3]=255;}ctx.putImageData(im,0,0);
  });
}
async function switchView(next){view=next;document.querySelectorAll('[data-view]').forEach(b=>{const yes=b.dataset.view===view;b.classList.toggle('active',yes);b.setAttribute('aria-selected',String(yes));});$('projectionContainer').hidden=view!=='projection';$('modelContainer').hidden=view!=='model';$('compareContainer').hidden=view!=='compare';$('sceneLabel').textContent=view==='model'?'МОДЕЛЬ И ОПТИЧЕСКАЯ ОСЬ':view==='compare'?'СРАВНЕНИЕ С ЦЕЛЬЮ':'ПРОЕКЦИЯ НА СТЕНУ';if(view==='model')await update3D();}
async function update3D(){
  if(!design)return;
  try{if(!model){
    const THREE=await import('three'),{OrbitControls}=await import('./vendor/OrbitControls.js');
    const host=$('modelContainer'),renderer=new THREE.WebGLRenderer({antialias:true,alpha:true});renderer.setPixelRatio(Math.min(devicePixelRatio,2));host.appendChild(renderer.domElement);
    const scene=new THREE.Scene(),camera=new THREE.PerspectiveCamera(36,1,1,4000);camera.position.set(240,170,350);
    const controls=new OrbitControls(camera,renderer.domElement);controls.enableDamping=true;controls.target.set(0,0,40);controls.minDistance=60;controls.maxDistance=1500;
    scene.add(new THREE.HemisphereLight(0xf0e4ca,0x29352b,2.4));const key=new THREE.DirectionalLight(0xffda9c,3);key.position.set(100,200,250);scene.add(key);const rim=new THREE.DirectionalLight(0xa8c4dc,2);rim.position.set(-150,0,-80);scene.add(rim);
    const group=new THREE.Group();scene.add(group);model={THREE,renderer,scene,camera,controls,group,dirty:true};
    const resize=()=>{const r=host.getBoundingClientRect();if(r.width&&r.height){renderer.setSize(r.width,r.height,false);camera.aspect=r.width/r.height;camera.updateProjectionMatrix();}};new ResizeObserver(resize).observe(host);resize();
    renderer.setAnimationLoop(()=>{if(view==='model'){controls.update();renderer.render(scene,camera);}});
  }
  if(!model.dirty)return;const {THREE,group}=model;for(const child of [...group.children]){group.remove(child);child.geometry?.dispose();if(Array.isArray(child.material))child.material.forEach(m=>m.dispose());else child.material?.dispose();}
  const d=design,q=housingDimensions(d),parts=[['mask',maskMesh(d),0xd8ba81],['housing',housingMesh(d),0x4b574b],['back',backMesh(d),0x727c69]];
  for(const [name,tris,color] of parts){const geometry=new THREE.BufferGeometry();geometry.setAttribute('position',new THREE.Float32BufferAttribute(tris.flat(),3));geometry.computeVertexNormals();const mat=new THREE.MeshStandardMaterial({color,roughness:.75,side:THREE.DoubleSide});const mesh=new THREE.Mesh(geometry,mat);mesh.name=name;if(name==='housing'){mat.transparent=true;mat.opacity=.28;mat.depthWrite=false;}group.add(mesh);}
  const bulb=new THREE.Mesh(new THREE.SphereGeometry(5.5,20,16),new THREE.MeshStandardMaterial({color:0xffd894,emissive:0xff9f30,emissiveIntensity:1.4,transparent:true,opacity:.7}));bulb.name='bulb';bulb.position.set(d.p.sourceX,d.p.sourceY,-1);group.add(bulb);
  const filament=new THREE.Mesh(new THREE.SphereGeometry(Math.max(.5,d.p.emitter/2),12,10),new THREE.MeshBasicMaterial({color:0xffe7ab}));filament.position.set(d.p.sourceX,d.p.sourceY,0);group.add(filament);
  const cap=new THREE.Mesh(new THREE.CylinderGeometry(5,5,10,20),new THREE.MeshStandardMaterial({color:0xa0a28e,metalness:.7,roughness:.35}));cap.rotation.x=Math.PI/2;cap.position.z=-11;group.add(cap);
  const near=new THREE.Vector3(d.p.sourceX,d.p.sourceY,0),corners=[[-d.p.width/2,-d.height/2],[d.p.width/2,-d.height/2],[d.p.width/2,d.height/2],[-d.p.width/2,d.height/2]];
  for(const [x,y]of corners){const geo=new THREE.BufferGeometry().setFromPoints([near,new THREE.Vector3(x,y,d.p.sourceDistance)]);group.add(new THREE.Line(geo,new THREE.LineBasicMaterial({color:0xdfb869,transparent:true,opacity:.3})));}
  const grid=new THREE.GridHelper(Math.max(q.ow,q.oh)*2.5,16,0x46533c,0x2a3826);grid.position.y=-q.oh/2-1;grid.position.z=d.p.sourceDistance/2;group.add(grid);model.dirty=false;applyModelOptions();
  }catch(e){toast('3D-просмотр недоступен: '+e.message);}
}
function applyModelOptions(){if(!model)return;const explode=$('explode').checked;for(const c of model.group.children){if(c.name==='housing')c.visible=$('showHousing').checked;if(c.name==='mask')c.position.z=explode?30:0;if(c.name==='back')c.position.z=explode?-25:0;}}
function download(blob,name){const url=URL.createObjectURL(blob),a=document.createElement('a');a.href=url;a.download=name;a.click();setTimeout(()=>URL.revokeObjectURL(url),1500);}
function printMesh(triangles){let min=Infinity;for(const t of triangles)min=Math.min(min,t[2],t[5],t[8]);return triangles.map(t=>t.map((x,i)=>i%3===2?x-min:x));}
function setupText(){const d=design,p=d.p;return `ShadowForge — тестовая сборка\n\nЛампа: прозрачная E10 3.5 V / 0.2 A / 0.7 W. Пример: https://www.batterien-und-akkus.com/kugellampe-e10-3-5v-0-2a\nКарточка: диаметр колбы 11 мм, общая длина 23 мм, цена 0.59 EUR без доставки (28.10.2026).\n\nРАЗМЕРЫ\nНить -> вход маски: ${p.sourceDistance} мм\nВход маски -> стена: ${p.wallDistance} мм\nМаска: ${d.outerWidth.toFixed(2)} x ${d.outerHeight.toFixed(2)} x ${p.thickness} мм (входная сторона); выход расширен в ${d.scale.toFixed(4)} раза.\nПроекция активной области: ${(p.width*d.magnification).toFixed(1)} x ${(d.height*d.magnification).toFixed(1)} мм\nСдвиг источника для теста: ${p.sourceX}, ${p.sourceY} мм. Посадка крышки остаётся на оси.\nДиаметр посадки покупного патрона: ${p.socket} мм, УТОЧНИТЬ ПО ПАТРОНУ.\nРасчётная светящаяся область: ${p.emitter} мм, ЭТО ОЦЕНКА, НЕ ДАННЫЕ ПРОДАВЦА.\n\nФАЙЛЫ\nmask.stl — цельная маска с сеткой перемычек.\nhousing.stl — непрозрачный корпус с открытыми торцами.\nback.stl — задняя крышка с круглой посадкой под покупной патрон.\nproject.json — настройки и встроенный референс для повторного открытия.\nprojection.png — отображение расчётной проекции с экспозицией.\nsetup.svg — схема.\n\nПЕЧАТЬ И СБОРКА\nSTL в миллиметрах. Каждая деталь отдельно опущена на z=0 для печати; автоматическое взаимное размещение деталей в слайсере НЕ является сборкой. Печатать из непрозрачного материала. Рамка маски устанавливается на переднем торце: узкие входы каналов обращены к нити, расширенные выходы — к стене. Маска входит в корпус с расчётным зазором 0.3 мм на сторону у выхода; фиксация рамки и крышки требует подгонки и отдельного крепежа/клея. Печатной резьбы, защёлок и посадки конкретного патрона нет.\nПоложение покупного патрона подберите так, чтобы нить была в 18 мм перед задним торцом корпуса и в ${p.sourceDistance} мм от входа маски. Учитывайте фактическое положение нити внутри колбы.\n\nПИТАНИЕ\nНужен покупной патрон E10, регулируемое питание 3.5 V DC с ограничением тока и провода. НЕ ПОДКЛЮЧАТЬ К 230 V. Колба не должна касаться пластика. Тепловой расчёт и испытания не выполнены: измерить нагрев, обеспечить вентиляцию/зазор до длительной работы.\n\nСИМУЛЯЦИЯ\nРавномерный светящийся диск, геометрическая оптика, проверка обоих концов каждого конического квадратного канала, косинус/расстояние до стены. Каналы направлены на номинальную ось (0,0,0). Цвет исходника не воспроизводится. Не моделируются стекло колбы, реальная форма нити, отражения, просвечивание пластика, дифракция, нагрев. Яркость относительная; значения в люксах не предсказываются. В оценке ошибки яркость нормализована и усреднена по ячейкам. Фотографической проверки нет.\n`;}
function projectData(){return{format:'shadowforge',version:1,name:referenceName,settings,image:referenceCanvas.toDataURL('image/png')};}
async function exportBundle(){if(!sim||!design)return;const button=$('export');button.disabled=true;toast('Подготавливаю модели и расчёт…');try{
  await new Promise(r=>setTimeout(r,20));const d=design,project=JSON.stringify(projectData(),null,2),png=await new Promise(r=>$('projectionCanvas').toBlob(r,'image/png'));
  const svg=new XMLSerializer().serializeToString($('setupSvg')).replace(/(<svg[^>]*>)/,'$1<style>text{fill:#b7c3a6;font:8px sans-serif}svg{background:#192016}</style>');
  const files=[['mask.stl',stlBuffer(printMesh(maskMesh(d)))],['housing.stl',stlBuffer(printMesh(housingMesh(d)))],['back.stl',stlBuffer(printMesh(backMesh(d)))],['project.json',project],['README.txt',setupText()],['setup.svg',svg],['projection.png',await png.arrayBuffer()]];
  download(zipStore(files),'shadowforge-kit.zip');toast('Комплект готов: 3 STL, схема, проект и проекция.');
  }catch(e){toast('Не удалось сохранить комплект: '+e.message);}finally{button.disabled=false;}}
for(const id of numberIds){$(id).addEventListener('input',()=>{updateOutput(id);settings[id]=+$(id).value;if(id==='exposure'){paintProjection();return;}requestCalculation();});}
document.querySelectorAll('[data-mode]').forEach(b=>b.addEventListener('click',()=>{settings.mode=b.dataset.mode;syncControls();requestCalculation();}));
document.querySelectorAll('[data-view]').forEach(b=>b.addEventListener('click',()=>switchView(b.dataset.view)));
$('invert').addEventListener('change',()=>{settings.invert=$('invert').checked;requestCalculation();});$('ambientCheck').addEventListener('change',()=>{settings.ambient=$('ambientCheck').checked?.015:0;paintProjection();});
$('showHousing').addEventListener('change',applyModelOptions);$('explode').addEventListener('change',applyModelOptions);
$('highQuality').addEventListener('click',()=>{requestCalculation(81,512);toast('Проверка: 81 выборка светящейся области, 512 пикселей по ширине.');});
$('reset').addEventListener('click',()=>{settings={...DEFAULTS};syncControls();requestCalculation();toast('Параметры возвращены к исходным.');});
$('imageInput').addEventListener('change',async e=>{const file=e.target.files[0];if(!file)return;if(file.size>20e6){toast('Изображение должно быть меньше 20 МБ.');return;}const url=URL.createObjectURL(file);try{await setImage(url,file.name.replace(/\.[^.]+$/,''));}catch(err){toast(err.message);}finally{URL.revokeObjectURL(url);}e.target.value='';});
$('projectInput').addEventListener('change',async e=>{try{const file=e.target.files[0];if(!file)return;if(file.size>15e6)throw new Error('Проект слишком большой.');const data=JSON.parse(await file.text());if(data.format!=='shadowforge'||data.version!==1||!/^data:image\/png;base64,/.test(data.image))throw new Error('Это не поддерживаемый проект ShadowForge.');const next={...DEFAULTS};for(const id of numberIds){if(typeof data.settings?.[id]!=='number'||!Number.isFinite(data.settings[id]))throw new Error('Некорректный параметр: '+id);const el=$(id),value=data.settings[id];if(value<+el.min||value>+el.max)throw new Error('Параметр вне диапазона: '+id);next[id]=value;}next.mode=['tone','binary'].includes(data.settings.mode)?data.settings.mode:'tone';next.invert=!!data.settings.invert;next.ambient=data.settings.ambient>0?.015:0;settings=next;syncControls();await setImage(data.image,String(data.name||'Проект').slice(0,100));toast('Проект открыт.');}catch(err){toast('Не удалось открыть проект: '+err.message);}e.target.value='';});
$('saveProject').addEventListener('click',()=>{if(gray)download(new Blob([JSON.stringify(projectData(),null,2)],{type:'application/json'}),'shadowforge-project.json');});
$('downloadMask').addEventListener('click',()=>{if(design)download(new Blob([stlBuffer(printMesh(maskMesh(design)))],{type:'model/stl'}),'shadowforge-mask.stl');});
$('export').addEventListener('click',exportBundle);$('helpExport').addEventListener('click',exportBundle);$('instructions').addEventListener('click',()=>$('helpDialog').showModal());$('closeHelp').addEventListener('click',()=>$('helpDialog').close());$('helpDialog').addEventListener('click',e=>{if(e.target===$('helpDialog'))$('helpDialog').close();});
const helpTop=document.createElement('button');helpTop.className='button help-top';helpTop.textContent='?';helpTop.setAttribute('aria-label','Детали и сборка');helpTop.addEventListener('click',()=>$('helpDialog').showModal());document.querySelector('.header-actions').insertBefore(helpTop,$('export'));
const shopLink=document.createElement('a');shopLink.href='https://www.batterien-und-akkus.com/kugellampe-e10-3-5v-0-2a';shopLink.target='_blank';shopLink.rel='noopener';shopLink.className='dialog-shop';shopLink.textContent='Лампа в магазине · E10 · €0,59 без доставки ↗';$('helpDialog').insertBefore(shopLink,$('helpExport'));
syncControls();setImage(sourceURL,'Batman').catch(e=>showError(e.message));
