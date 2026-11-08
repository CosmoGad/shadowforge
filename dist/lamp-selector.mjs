const host=document.createElement('div');
const root=host.attachShadow({mode:'open'});
root.innerHTML=`<style>:host{display:block;background:#f5f1e9;color:#252720;border-bottom:1px solid #ded8ca;font:14px/1.5 system-ui}.bar{padding:14px 4vw;display:flex;flex-wrap:wrap;align-items:center;gap:12px}a{color:inherit}select{font:inherit;padding:10px;border:1px solid #bdb5a6;border-radius:8px;background:#fffdf8;max-width:100%}a:focus-visible,select:focus-visible{outline:3px solid #a88142;outline-offset:3px}</style><div class="bar"><a href="/index.html">← Все варианты</a><label for="variant">Вариант лампы</label><select id="variant"></select></div>`;
const select=root.querySelector('select');
for(const [path,label] of [['/budget/review.html','Без трубы · текущая модель'],['/hilal/review.html','С PMMA-гильзой · архив'],['/generator.html','Свой рисунок · генератор'],["/inserts/crescent-star/review.html", "Полумесяц и звезда"],["/inserts/mosque/review.html", "Мечеть с двумя минаретами"],["/inserts/fanous/review.html", "Фанус — фонарь Рамадана"],["/inserts/rosette/review.html", "Восьмилучевая розетка"],["/inserts/mihrab/review.html", "Арка и сад"]]){const option=new Option(label,path);option.selected=location.pathname===path;select.add(option)}
select.addEventListener('change',()=>location.assign(select.value));
document.body.prepend(host);
