import {Board,escapeHTML as e,typeName} from './board.js';
import {RevisionController} from './state.js';
const $=id=>document.getElementById(id), root='/admin/studio/';
const el=(tag,text)=>Object.assign(document.createElement(tag),{textContent:text});
const fmt=n=>typeof n==='number'?n.toLocaleString('ru',{maximumFractionDigits:3}):n??'—';
const clone=x=>structuredClone(x), eq=(a,b)=>JSON.stringify(a)===JSON.stringify(b);
const risk='RISK-FIN-CURRENT-LIQUIDITY',action='BUILD_RECEIVABLES_AGING',metric='FSM-LIQ-001';
const steps={metric:'Показатель',rule:'Правило',actions:'Рекомендации',data:'Сценарий'};
const fields={'FSM-AMT-005':'1200','FSM-AMT-016':'1500','FSM-AMT-006':'1210','FSM-AMT-010':'1250','FSM-AMT-008':'1230'};
const fieldLabels={'1200':'Оборотные активы','1500':'Краткосрочные обязательства','1210':'Запасы','1250':'Деньги','1230':'Дебиторская задолженность'};
const components={FINANCIAL_STRENGTH:'Финансовая устойчивость',OPERATING_BEHAVIOR:'Операционная деятельность',DEBT_CREDIT:'Долг и кредитная история',LEGAL_CORPORATE:'Юридический профиль'};
const modeLabels={method:'Одни данные · разные методологии',data:'Одна методология · разные данные',combined:'Базовые данные и методология → черновик'};
const state=new RevisionController();let cohort=[],cfg,draft,run,board,graph,baseGraph,editing=false,tab='map',node=null,editor=null,activeAction=action,editedRun=null,versions=[],graphSeq=0;
const api=async(route,payload,signal)=>{const r=await fetch(root+route,{method:payload===undefined?'GET':'POST',headers:payload===undefined?{}:{'Content-Type':'application/json'},body:payload===undefined?undefined:JSON.stringify(payload),signal});if(!r.ok){const v=await r.json().catch(()=>({}));throw Error(v.error||'HTTP '+r.status);}return r.json();};
function notice(msg){$('notice').hidden=!msg;$('notice').textContent=msg||'';}
function safe(fn){return async(...args)=>{try{await fn(...args);}catch(error){if(error.name!=='AbortError')notice(error.message);}};}
const field=(title,html)=>'<label class="field">'+e(title)+html+'</label>';
const option=(values,selected)=>values.map(v=>{const [key,name]=Array.isArray(v)?v:[v,v];return '<option value="'+e(key)+'"'+(key===selected?' selected':'')+'>'+e(name)+'</option>';}).join('');
const inp=(id,value,type='text')=>'<input id="'+id+'" type="'+type+'" value="'+e(value)+'">';
const sel=(id,entries,selected)=>'<select id="'+id+'">'+option(entries,selected)+'</select>';
const btn=(id,label,cls='')=>'<button id="'+id+'" class="'+cls+'">'+e(label)+'</button>';
const section=(title,body)=>'<section class="section"><h3>'+e(title)+'</h3>'+body+'</section>';
const at=(id,fn)=>{if($(id))$(id).onclick=safe(fn);};
function markDirty(){cohort=[];run=null;editedRun=null;graphSeq++;notice('Есть изменения, результат ещё не пересчитан');displayResults();updateHeader();}
function mutate(fn){if(!editing)return;state.change(draft);fn(draft);draft.revision++;markDirty();}
function updateHeader(){
 $('draftBtn').hidden=editing;$('runBtn').hidden=!editing;$('modeTag').textContent=editing?'Черновик · r'+draft.revision:'Обзор';
 $('status').textContent=editing?'Черновик · '+draft.name+' · ревизия '+draft.revision:'Версия методологии · '+cfg.engine.baseCommit.slice(0,9);
 $('company').value=draft.scenario.company;
}
async function updateGraph(){
 const seq=++graphSeq,g=editing?await api('graph',draft):baseGraph;if(seq!==graphSeq)return;
 graph=g;board.update(g);
}
function startDraft(){editing=true;editor='metric';node=metric;draft.name='Эксперимент ликвидности';state.invalidate();state.undoStack=[];state.redoStack=[];run=null;editedRun=null;notice('Черновик создан на базовой методологии');updateHeader();board.focus();displayResults();}
function go(t){
 tab=t;for(const v of ['map','compare','versions'])$(v+'Tab').hidden=v!==t;
 document.querySelectorAll('nav [data-tab]').forEach(b=>b.classList.toggle('active',b.dataset.tab===t));
 $('heading').textContent={map:'Карта Prescore',compare:'Сравнение результатов',versions:'Версии и пакеты'}[t];
 if(t==='compare')compare();if(t==='versions')versionsPage();if(t==='map')requestAnimationFrame(()=>board.fit());
}
function select(id){
 node=id;editor=null;
 if(editing){if(id===metric)editor='metric';else if(id===risk)editor='rule';else if(id?.startsWith('ACT-')&&(id==='ACT-'+action||draft.method.actions.some(a=>'ACT-'+a.code===id))){editor='actions';activeAction=id.slice(4);}else if(fields[id])editor='data';}
 inspect();
}
function openEditor(name){editor=name;node={metric,rule:risk,actions:'ACT-'+activeAction,data:'FSM-AMT-005'}[name];board.selected=node;board.refresh();inspect();}
function observation(id){
 const r=run?.after.result;if(!r)return null;
 if(id===metric)return r.metric;
 if(fields[id])return {строка:fields[id],значение:draft.scenario.financial?draft.scenario.lines[fields[id]]:null,единица:'RUB',дата:'2026-06-30'};
 if(id.startsWith('FACT-'))return r.facts.find(v=>v.code===id.slice(5));
 if(id.startsWith('RISK-'))return r.risks.find(v=>v.code===id)||r.evaluations.filter(v=>v[0]===id);
 if(id.startsWith('ACT-'))return r.recommendations.filter(v=>v.code===id.slice(4));
 return ({'BLK-10':r.index,'BLK-11':r.readiness,'BLK-12':r.assessment,'BLK-13':r.capacity,'BLK-14':r.products,'BLK-15':r.recommendations.length,'BLK-16':r.plan})[id];
}
const details=(label,val)=>'<details><summary>'+e(label)+'</summary><pre>'+e(typeof val==='string'?val:JSON.stringify(val,null,2))+'</pre></details>';
const chip=(id,title)=>'<button data-node="'+e(id)+'">'+e(title||id)+'</button>';
function inspect(){
 const p=$('inspector'),n=board.map.get(node),areaId=node?.startsWith('area:')?Number(node.slice(5)):null;
 const nav=editing?'<div class="buttons section">'+Object.entries(steps).map(([v,t])=>'<button data-editor="'+v+'" '+(editor===v?'class="pill"':'')+'>'+t+'</button>').join('')+'</div>':'';
 if(areaId){
  const group=graph.nodes.filter(i=>i.area===areaId&&i.kind!=='evidence');p.innerHTML='<p class="code">ОБЛАСТЬ '+areaId+'</p><h2>'+e(graph.areas[areaId-1])+'</h2><p class="muted">'+group.length+' карточек. Выберите узел на карте.</p><div class="buttons">'+group.slice(0,6).map(k=>chip(k.id,k.name_ru)).join('')+'</div>'+nav;bindInspect();return;
 }
 const key=n?.id||metric,actual=n||board.map.get(metric);
 p.innerHTML='<p class="code">'+e(key)+'</p><h2>'+e(actual.name_ru)+'</h2><p class="muted">'+e(actual.explanation||'')+'</p>'+
 (key===metric?'<div class="micro">ФОРМУЛА · БФО</div><p class="formula">'+e(draft.method.expression)+'</p>':'')+
 '<div class="lineup"><span class="pill">'+e(actual.editable?'Доступно в черновике':'Для просмотра')+'</span></div>'+nav;
 if(editing&&editor)p.insertAdjacentHTML('beforeend',editorHTML());
 else if(!n)p.insertAdjacentHTML('beforeend',section('Расчётный контур','<p>Строки баланса → ликвидность → риск → Index и рекомендации.</p>'+btn('showFocus','Открыть контур','link')));
 const v=observation(key);
 if(v!=null)p.insertAdjacentHTML('beforeend',details('Значение в расчёте',v));
 if(n){
  const links=graph.edges.filter(x=>x.from===key||x.to===key),exec=links.filter(x=>x.executable),ev=links.filter(x=>x.type==='EVIDENCE'),reviews=graph.nodes.filter(x=>x.kind==='review_items'&&(x.related_ids.includes(key)||n.related_ids?.includes(x.id)||links.some(l=>l.from===x.id&&l.to===key)));
  const edges=exec.map(x=>x.type+' · '+x.from+' → '+x.to+' · '+x.unit+' · '+x.period+' · '+x.owner);
  p.insertAdjacentHTML('beforeend',section('Связи','<div class="buttons">'+[['in','Показать входы'],['out','Последствия'],['index','Путь к Index'],['rec','К рекомендациям']].map(([k,l])=>'<button data-path="'+k+'">'+l+'</button>').join('')+'</div>')+
   details('Паспорт и конфигурация',{тип:typeName(n.kind),область:graph.areas[n.area-1],реализация:n.status,исполнение:v!=null?'Значение из текущего запуска':exec.length?'Есть контрактная связь. Значение в этой проекции не выведено':'Не подключено к исполнению в Studio',редактор:n.editable?'Поддерживается':'Требует программной доработки',версия:n.version||graph.version,единица:n.unit||'По контракту',период:n.period||'По источнику',входы:n.inputs||n.input||[],выход:n.output||n.destination||[],конфигурация:n.implemented_expression||n.thresholds_raw||n.trigger||n.formula||n.program,ограничения:n.limits||n.missing||n.proposal||[]})+
   details('Подтверждённые порты · '+exec.length,edges)+
   '<details><summary>Связи атласа и основания · '+links.filter(x=>!x.executable).length+'</summary><div class="buttons">'+links.filter(x=>!x.executable).map(x=>{const other=x.from===key?x.to:x.from;return chip(other,x.type+' · '+(board.map.get(other)?.name_ru||other));}).join('')+'</div></details>'+
   (n.kind==='evidence'?details('Источник',{путь:n.path,строка:n.line,git_blob_sha:n.git_blob_sha}):'')+
   (reviews.length?section('Открытые вопросы владельца',reviews.map(a=>'<p>'+e(a.name_ru)+' · '+e(a.explanation)+'</p>').join('')):'')+
   '<details><summary>Комментарий владельца</summary>'+field('Локальная заметка', '<textarea id="ownerNote">'+e(localStorage.getItem('studio.note.'+key)||'')+'</textarea>')+'</details>');
 }
 bindInspect();bindEditor();
}
function bindInspect(){
 at('showFocus',()=>board.focus());document.querySelectorAll('[data-node]').forEach(b=>b.onclick=()=>board.reveal(b.dataset.node));
 document.querySelectorAll('[data-editor]').forEach(b=>b.onclick=()=>openEditor(b.dataset.editor));document.querySelectorAll('[data-path]').forEach(b=>b.onclick=()=>board.path(node,b.dataset.path));
 if($('ownerNote'))$('ownerNote').oninput=ev=>localStorage.setItem('studio.note.'+node,ev.target.value);
}
function editorHTML(){
 let body='';
 if(editor==='metric'){
  body=field('Выражение коэффициента','<textarea id="expression" class="formula" spellcheck="false">'+e(draft.method.expression)+'</textarea>')+
   '<details open><summary>Допустимые строки одного баланса</summary>'+Object.entries(cfg.fields).map(([id,title])=>'<div class="micro">'+e(id)+' · '+e(title)+'</div>').join('')+'</details><p class="micro">Операции + − × ÷ и скобки. В выражении используйте + - * /.</p>';
  const used=Object.keys(cfg.fields).filter(k=>draft.method.expression.match(/[A-Z][A-Z_0-9]*/g)?.includes(k));
  body+='<details><summary>Переподключить вход формулы</summary>'+field('Заменить порт',sel('oldPort',used,used[0]))+field('Подключить строку',sel('fromPort',Object.entries(fields).map(([id,k])=>[id,fieldLabels[k]+' · '+k]),'FSM-AMT-005'))+btn('wirePort','Соединить порты')+'</details>';
 }else if(editor==='rule'){
  const r=draft.method.rule;
  body=field('Вход',sel('rinput',[['FIN_CURRENT_RATIO','FIN_CURRENT_RATIO · коэффициент на дату']],r.input))+field('Условие',sel('rop',[['LT','Меньше (<)'],['LTE','Меньше или равно (≤)']],r.op))+field('Порог срабатывания',inp('rthreshold',r.threshold,'number'))+field('Граница HIGH',inp('rhigh',r.high,'number'))+field('Тяжесть основной зоны',sel('rseverity',['LOW','MEDIUM','HIGH'],r.severity))+field('Применимость',sel('rapplicability',[['ALL','Все доступные балансы'],['BFO','Только годовая БФО'],['QUARTERLY','Только промежуточная']],r.applicability))+field('Правило включено',' <input id="renabled" type="checkbox" '+(r.enabled?'checked':'')+'>');
 }else if(editor==='actions'){
  const a=draft.method.actions.find(x=>x.code===activeAction)||cfg.currentAction;
  body=field('Определение',sel('actionpick',[[action,'Действующая рекомендация'],...draft.method.actions.filter(v=>v.code!==action).map(v=>[v.code,v.title])],a.code))+btn('addAction','+ Создать рекомендацию')+'<p class="code">'+e(a.code)+'</p>'+
  field('Заголовок',inp('atitle',a.title))+field('Предлагаемое действие','<textarea id="atext">'+e(a.text)+'</textarea>')+field('Связать с finding',sel('atrigger',cfg.triggers,a.trigger))+field('Приоритет',sel('apriority',['P1_HIGH','P2_MEDIUM','P3_LOW'],a.priority))+field('Подтверждение',inp('aevidence',a.evidence))+field('Условие повторной проверки','<textarea id="arecheck">'+e(a.recheck)+'</textarea>')+'<p class="micro">Применимость задаёт finding. Горизонт 7/30/60 определяет Action Plan. У поддерживаемой рекомендации нет обязательных предшественников.</p>';
 }else{
  body=field('Тип сравнения',sel('comparisonMode',Object.entries(modeLabels),draft.mode))+field('БФО и промежуточный баланс',' <input id="financial" type="checkbox" '+(draft.scenario.financial?'checked':'')+'>')+field('БКИ компании',' <input id="bki" type="checkbox" '+(draft.scenario.bki?'checked':'')+(draft.scenario.company==='lab-service'?' disabled':'')+'>')+
  '<p class="micro">Промежуточный баланс на 30.06.2026. Пустое значение означает отсутствие строки.</p>'+Object.entries(fieldLabels).map(([k,t])=>field(t+' · '+k+' · ₽',inp('line'+k,draft.scenario.lines[k]??'','number'))).join('');
 }
 return section(steps[editor],body+'<div class="buttons">'+btn('validate','Проверить')+btn('undo','Отменить правку')+btn('redo','Повторить')+'</div>');
}
function bindEditor(){
 const bind=(id,fn,evt='input')=>{if($(id))$(id).addEventListener(evt,ev=>mutate(d=>fn(d,ev.target)));};
 bind('expression',(d,t)=>d.method.expression=t.value);
 for(const k of ['input','op','threshold','high','severity','applicability','enabled'])bind('r'+k,(d,t)=>d.method.rule[k]=k==='enabled'?t.checked:['threshold','high'].includes(k)?t.valueAsNumber:t.value);
 bind('comparisonMode',(d,t)=>d.mode=t.value);
 for(const k of ['financial','bki'])bind(k,(d,t)=>{d.scenario[k]=t.checked;if(d.mode==='method'&&eq(d.method,cfg.baseline))d.mode='data';if($('comparisonMode'))$('comparisonMode').value=d.mode;});
 for(const k of Object.keys(fieldLabels))bind('line'+k,(d,t)=>{d.scenario.lines[k]=t.value===''?null:t.valueAsNumber;if(d.mode==='method'&&eq(d.method,cfg.baseline))d.mode='data';if($('comparisonMode'))$('comparisonMode').value=d.mode;});
 for(const k of ['title','text','trigger','priority','evidence','recheck'])bind('a'+k,(d,t)=>{let a=d.method.actions.find(v=>v.code===activeAction);if(!a){a=clone(cfg.currentAction);d.method.actions.push(a);}a[k]=t.value;});
 if($('actionpick'))$('actionpick').onchange=t=>{activeAction=t.target.value;openEditor('actions');};
 at('wirePort',async()=>{const rev=draft.revision,method=await api('connect',{draft,edge:{from:$('fromPort').value,to:metric,replace:$('oldPort').value}});if(draft.revision!==rev)return;mutate(d=>d.method=method);await updateGraph();inspect();});
 at('addAction',()=>{const code='STUDIO_'+crypto.randomUUID().slice(0,8).toUpperCase();mutate(d=>d.method.actions.push({...cfg.currentAction,code,title:'Проверить сроки инкассации',text:'Составьте реестр ожидаемых поступлений по покупателям.'}));activeAction=code;openEditor('actions');});
 at('validate',async()=>{await api('validate',draft);await updateGraph();notice('Формула, правило, порты и рекомендации прошли проверку');});
 for(const [id,redo] of [['undo',false],['redo',true]])at(id,()=>{const prev=state.move(draft,redo);if(prev){prev.revision=draft.revision+1;draft=prev;markDirty();inspect();}});
}
function displayResults(){
 const a=run?.before?.result,b=run?.after?.result;const items=[['Prescore Index',b?.index,'Было '+fmt(a?.index)],['Текущая ликвидность',b?.metric.value,'Было '+fmt(a?.metric.value)],['Кредитные риски',b?.risks.filter(r=>r.scope==='CREDIT_RISK').length,'Подтверждённые findings'],['Долговая ёмкость',b?.capacity.prudential,'₽ в месяц · осторожный предел'],['Рекомендации',b?.recommendations.length,'По результатам анализа']];
 $('resultbar').innerHTML=items.map(([k,v,s])=>'<div class="metric"><label>'+e(k)+'</label><strong>'+e(fmt(v))+'</strong><small>'+e(b?s:'Ожидает расчёта')+'</small></div>').join('');
 if(tab==='compare')compare();
}
async function calculate(){
 const token=state.start();run=null;editedRun=null;displayResults();notice('Выполняется канонический расчёт…');
 const stop=el('button','Отменить расчёт');$('notice').append(' ',stop);stop.onclick=()=>{state.invalidate();notice('Расчёт отменён');};
 try{const v=await api('calculate',clone(draft),token.signal);if(!state.current(token.sequence))return;
  if(v.status!=='COMPLETE')throw Error(v.errors.join(' · '));run=v;editedRun=v.id;await updateGraph();if(!state.current(token.sequence))return;notice(v.after.result.metric.warnings?.includes('ZERO_DENOMINATOR')?'Деление на ноль. Значение показателя недоступно.':'');displayResults();inspect();if(tab==='versions')versionsPage();
 }catch(err){if(state.current(token.sequence)&&err.name!=='AbortError')notice(err.message);}
}
const rowDefs=[
 ['metric','Ликвидность',r=>fmt(r.metric.value)+' · '+r.metric.status,metric],['rule','Правило ликвидности',r=>r.rule.status+' '+r.rule.reasonCodes.join(', '),risk],
 ['index','Prescore Index',r=>fmt(r.index),'BLK-10'],['raw','Сумма до потолка',r=>fmt(r.raw),'BLK-10'],['ceiling','Потолок риска',r=>fmt(r.ceiling)+(r.capped?' · применён':''),'BLK-10'],
 ['components','Компоненты',r=>r.components.map(c=>(components[c.name]||c.name)+' '+fmt(c.score)+' / '+fmt(c.max)).join('\n'),'BLK-10'],
 ['status','Статус Index',r=>r.status,'BLK-10'],['coverage','Покрытие',r=>r.coverage.map(c=>(components[c[0]]||c[0])+' · '+c[1]).join('\n'),'BLK-10'],
 ['risks','Выявленные риски',r=>r.risks.map(v=>v.code+' · '+v.severity).join('\n')||'Нет выявленных','BLK-07'],['readiness','Готовность',r=>r.readiness.level+' · '+r.readiness.status,'BLK-11'],
 ['assessment','Кредитное заключение',r=>r.assessment.headline+'. '+r.assessment.text+'\nСтатус '+r.assessment.status+' · существенных рисков '+r.assessment.risks,'BLK-12'],
 ['capacity','Долговая ёмкость',r=>fmt(r.capacity.prudential)+' – '+fmt(r.capacity.maximumPolicy)+' ₽/мес · '+r.capacity.status,'BLK-13'],
 ['products','Подбор продуктов',r=>r.products.join(', ')||'Нет подходящих','BLK-14'],['recommendations','Рекомендации',r=>r.recommendations.length+' действий','BLK-15'],['plan','План 7/30/60',r=>Object.values(r.plan).map((p,i)=>[7,30,60][i]+' дней · '+p.actions.length+' действий').join('\n'),'BLK-16']];
function compare(){
 const p=$('compareTab'),r=run;if(!r){p.innerHTML='<section class="surface"><h2>Результат этой ревизии</h2><p>Запустите расчёт для выбранной компании.</p>'+btn('compareRun','Рассчитать','mint')+'</section>';at('compareRun',calculate);return;}
 const a=r.before.result,b=r.after.result,changed=new Set(r.changed);
 const recMap=z=>new Map(z.recommendations.map(i=>[i.code,i])),old=recMap(a),now=recMap(b);
 const cause=(key,id)=>{
  if(!changed.has(key))return key==='index'&&b.capped&&a.raw!==b.raw?'Итог удержан потолком '+b.ceiling:'Значение сохранилось';
  if(key==='metric')return b.metric.expression||b.metric.warnings.join(', ');
  if(key==='rule')return b.rule.reasonCodes.join(', ')||b.rule.status;
  if(key==='ceiling'||key==='index')return b.capped?'Ограничение по тяжести риска · '+fmt(b.ceiling):'См. вклад компонентов';
  if(key==='recommendations')return [...now.keys()].filter(k=>!old.has(k)).length+' добавлено · '+[...old.keys()].filter(k=>!now.has(k)).length+' исключено';
  if(key==='plan')return 'Пересчитаны задания и контрольные даты';
  if(key==='components')return b.components.filter((v,i)=>!eq(v,a.components[i])).map(v=>(components[v.name]||v.name)+' · штраф '+fmt(v.penalty)).join(', ');
  if(key==='raw')return 'Сумма баллов компонентов, до ограничения';
  if(key==='risks')return b.risks.filter(v=>!a.risks.some(x=>x.code===v.code&&x.severity===v.severity)).map(v=>v.code+' · '+v.severity).join(', ')||'Изменился состав подтверждений';
  if(key==='assessment')return 'Существенных рисков: '+a.assessment.risks+' → '+b.assessment.risks;
  return 'Изменился результат блока '+id;
 };
 p.innerHTML='<section class="surface"><div class="eyebrow">ПРОТОКОЛ РАСЧЁТА</div><h2>'+e(draft.name)+'</h2><p>'+e(modeLabels[draft.mode])+' · '+e(r.both?'Изменились и данные, и методология':r.before.snapshotHash===r.after.snapshotHash?'Одинаковый снимок данных':'Разные снимки данных')+'</p><div class="buttons">'+chip(metric,'Формула')+chip(risk,'Правило')+chip('ACT-'+(draft.method.actions.at(-1)?.code||action),'Рекомендация')+'</div><table><thead><tr><th>Результат</th><th>Было</th><th>Стало</th><th>Разница и основание</th></tr></thead><tbody>'+
 rowDefs.map(([key,title,show,id])=>'<tr><td>'+e(title)+'</td><td style="white-space:pre-line">'+e(show(a))+'</td><td style="white-space:pre-line" class="'+(changed.has(key)?'changed':'')+'">'+e(show(b))+'</td><td>'+e(cause(key,id))+'<br>'+chip(id,'На карте ↗')+'</td></tr>').join('')+'</tbody></table></section>'+
 '<div class="compare-grid"><article class="surface"><h2>Рекомендации после расчёта</h2>'+b.recommendations.map(v=>'<details><summary>'+e(v.title)+(old.has(v.code)?'':' · добавлена')+'</summary><p>'+e(v.text)+'</p><p>'+e(v.priority+' · '+v.horizon)+'</p>'+details('Почему появилась',{условие:v.trigger,findings:v.findings,исходныеФакты:v.facts.map(id=>b.facts.find(f=>f.id===id)||id),источники:v.sources,подтверждение:v.evidence,повторнаяПроверка:v.recheck})+'</details>').join('')+
 [...old].filter(([code])=>!now.has(code)).map(([,v])=>'<p class="muted">Исключена · '+e(v.title)+'</p>').join('')+'</article>'+
 '<article class="surface"><h2>Трасса запуска</h2><p class="code">'+e(r.runId)+' · '+e(b.asOfDate)+'</p>'+
 details('Входные строки и выражение',b.metric)+details('Факт и проверка правила',{fact:b.fact,rule:b.rule})+details('Подавленные findings',b.suppressed)+details('Вклады и потолок',{contributions:b.contributions,raw:b.raw,ceiling:b.ceiling,capped:b.capped,value:b.index})+details('План действий',b.plan)+details('Снимки и версии',{engine:r.engine,company:r.company,scope:r.scope,scenarioId:r.scenarioId,before:{input:r.before.inputHash,method:r.before.methodologyHash},after:{input:r.after.inputHash,method:r.after.methodologyHash},errors:r.errors})+'</article></div>';
 p.querySelectorAll('[data-node]').forEach(bt=>bt.onclick=()=>{go('map');board.reveal(bt.dataset.node);});
}
async function loadDraft(d,savedRun=null){
 state.invalidate();cohort=[];state.undoStack=[];state.redoStack=[];editing=true;draft=clone(d);run=savedRun;editedRun=savedRun?.id||null;activeAction=action;editor='metric';node=metric;
 updateHeader();displayResults();await updateGraph();go('map');board.focus();notice(savedRun?'Открыта сохранённая версия и её результат':'Открыт черновик. Готов к расчёту');
}
async function resetBase(company=draft.scenario.company){
 state.invalidate();cohort=[];editing=false;node=null;editor=null;draft=clone(cfg.initial);draft.scenario=clone(cfg.scenarios.find(s=>s.company===company));draft.baseScenario=clone(draft.scenario);
 run=null;editedRun=null;activeAction=action;graph=baseGraph;graphSeq++;board.update(graph);board.home();updateHeader();displayResults();inspect();go('map');await calculate();
}
function versionsPage(){
 const p=$('versionsTab');
 p.innerHTML='<div class="compare-grid"><article class="surface"><div class="eyebrow">ВЕРСИЯ МЕТОДОЛОГИИ</div><h2>'+e(editing?draft.name:'Базовая версия')+'</h2>'+
 (editing?field('Название черновика',inp('draftName',draft.name))+field('Тип сравнения',sel('verMode',Object.entries(modeLabels),draft.mode)):'<p>Действующая конфигурация движка.</p>')+
 '<div class="buttons">'+btn('saveVersion','Сохранить версию','mint')+btn('cloneVersion','Создать копию')+btn('baseline','Вернуться к baseline')+'</div><p class="micro">Версии и запуски сохраняются на диске у владельца preview. Раскладка и комментарии — в этом браузере.</p></article>'+
 '<article class="surface"><div class="eyebrow">ПОДГОТОВКА К ПРИМЕНЕНИЮ</div><h2>Пакет изменений</h2><p>'+e(run?'VALIDATED · расчёт завершён':'DRAFT · требуется расчёт')+'</p><p>Проверка владельцем и утверждение для интеграции выполняются отдельно. Активация на сайте отключена.</p><div class="buttons">'+btn('registry','Скачать реестр карты')+btn('cohort','Сравнить две компании')+btn('export','Экспорт JSON')+btn('import','Импорт JSON')+'</div><input id="importFile" type="file" accept=".json,application/json" hidden>'+
 (cohort.length?'<table><tr><th>Компания</th><th>Index · было → стало</th><th>Результат</th></tr>'+cohort.map(c=>'<tr><td>'+e(c.name)+'</td><td>'+e(fmt(c.before)+' → '+fmt(c.after))+'</td><td>'+e(c.status)+'</td></tr>').join('')+'</table>':'')+details('Изменённые параметры и совместимость',{методология:draft.method,сценарий:draft.scenario,базаДанных:draft.baseScenario,база:cfg.engine,затронутыеРезультаты:run?.changed??[],результатыПроверок:run?.status??'Ожидает проверки',порядокУтверждения:cfg.promotion,согласование:{владелец:null,дата:null}})+'</article></div>'+
 '<section class="surface"><h2>Сохранённые сравнения</h2>'+[['formula','Ликвидность без дебиторской задолженности'],['source','Исключение БФО']].map(([k,n])=>'<div class="entry row"><span>'+e(n)+'</span><button data-sample="'+k+'">Открыть пример</button></div>').join('')+
 versions.map(v=>'<div class="entry row"><span>'+e(v.name)+' · r'+v.revision+' · '+e(v.state)+'</span><small>'+e(v.at)+'</small><button data-version="'+e(v.id)+'">Открыть</button></div>').join('')+'</section>';
 $('export').disabled=!run;$('saveVersion').disabled=!editing;
 if($('draftName'))$('draftName').onchange=ev=>{mutate(d=>d.name=ev.target.value);versionsPage();};
 if($('verMode'))$('verMode').onchange=ev=>{mutate(d=>d.mode=ev.target.value);versionsPage();};
 at('registry',()=>{const data=new Blob([JSON.stringify(graph)],{type:'application/json'}),url=URL.createObjectURL(data),a=el('a','');a.href=url;a.download='Prescore-Studio-Graph-v0.1.json';a.click();setTimeout(()=>URL.revokeObjectURL(url),5000);});
 at('cohort',async()=>{const rev=state.sequence,method=clone(draft.method),rows=[];notice('Проверяются обе синтетические компании…');for(const [i,c] of cfg.companies.entries()){const s=clone(cfg.scenarios[i]),d={...clone(draft),method,mode:'method',scenario:s,baseScenario:clone(s)};const r=await api('calculate',d);if(rev!==state.sequence)return;rows.push({name:c.name,before:r.before?.result.index,after:r.after?.result.index,status:r.status,id:r.id});}cohort=rows;notice('Проверка набора завершена');versionsPage();});
 at('cloneVersion',()=>loadDraft({...clone(draft),name:(draft.name.slice(0,62)+' · копия'),revision:draft.revision+1}));
 at('baseline',()=>resetBase());
 at('saveVersion',async()=>{const v=await api('save',{draft,run:editedRun});versions=await api('versions');versionsPage();notice('Сохранена версия '+v.id.slice(0,8));});
 at('export',async()=>{const payload=await api('export',{draft,run:editedRun});const url=URL.createObjectURL(new Blob([JSON.stringify(payload,null,2)],{type:'application/json'}));const a=el('a','');a.href=url;a.download='Prescore-Studio-r'+draft.revision+'.json';a.click();setTimeout(()=>URL.revokeObjectURL(url),5000);});
 at('import',()=>$('importFile').click());$('importFile').onchange=safe(async ev=>{const f=ev.target.files[0];if(!f||f.size>160000)throw Error('Допустим JSON до 160 КБ');await loadDraft(await api('import',JSON.parse(await f.text())));});
 p.querySelectorAll('[data-sample]').forEach(b=>b.onclick=safe(async()=>{await loadDraft(await api('import',await api('sample/'+b.dataset.sample)));await calculate();go('compare');}));
 p.querySelectorAll('[data-version]').forEach(b=>b.onclick=safe(async()=>{const v=await api('version/'+b.dataset.version);const r=v.run?await api('run/'+v.run):null;await loadDraft(v.draft,r?{id:v.run,...r}:null);}));
}
async function init(){
 [cfg,baseGraph]=await Promise.all([api('bootstrap'),api('graph')]);graph=baseGraph;versions=cfg.versions;draft=clone(cfg.initial);
 board=new Board(graph,select);$('company').replaceChildren(...cfg.companies.map(c=>new Option(c.name+' · синтетическая',c.id)));$('company').onchange=safe(ev=>resetBase(ev.target.value));
 document.querySelectorAll('[data-tab]').forEach(b=>b.onclick=()=>go(b.dataset.tab));at('draftBtn',startDraft);at('runBtn',calculate);
 updateHeader();inspect();displayResults();await calculate();
}
safe(init)();
