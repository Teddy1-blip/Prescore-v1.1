const $=id=>document.getElementById(id);
const icons=['◇','▣','≋','⌘','∿','▤','▥','⇄','△','⋈','◎','◔','▧','≜','◈','↗','⤷','✧','▦','◫','⚙','⌬'];
const tints=['#8bcae8','#83dabb','#e8bc78','#baa5d9'];
const lanes=[[1,2,3,4,5,6],[7,8,9,10,11,12],[13,14,15,16,17,18],[19,20,21,22]];
const laneNames=['ДАННЫЕ И ПОКАЗАТЕЛИ','АНАЛИЗ И ИНДЕКС','РЕШЕНИЯ И ДЕЙСТВИЯ','КАБИНЕТЫ И КОНТРОЛЬ'];
const focusIds=['FSM-AMT-005','FSM-AMT-016','FSM-LIQ-001','FACT-FIN_CURRENT_RATIO','RISK-FIN-CURRENT-LIQUIDITY','BLK-10','ACT-BUILD_RECEIVABLES_AGING','BLK-15','BLK-16'];
const types={metrics:'Показатель',data_fields:'Факт',risk_rules:'Правило риска',recommendations:'Рекомендация',context_rules:'Контекст',constructor:'Конструктор',evidence:'Основание',analysis_outputs:'Блок',review_items:'Ревизия'};
const ss='http://www.w3.org/2000/svg';
export const typeName=k=>types[k]||k;
export function escapeHTML(v){return String(v??'').replace(/[&<>"']/g,k=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[k]));}
export class Board{
 constructor(g,select){
  this.g=g;this.onSelect=select;this.map=new Map(g.nodes.map(n=>[n.id,n]));this.view='all';this.list=[];this.selected=null;this.scale=1;this.x=0;this.y=0;
  try{this.layout=JSON.parse(localStorage.getItem('prescore.studio.layout.v1')||'{}');}catch{this.layout={};}
  this.pane=$('viewport');this.frame=0;this.bind();this.home();
  new ResizeObserver(()=>this.fit()).observe(this.pane);
 }
 update(g){this.g=g;this.map=new Map(g.nodes.map(n=>[n.id,n]));this.refresh();}
 home(){this.view='all';this.scope=null;this.selected=null;$('search').value='';['byArea','byStatus','byKind'].forEach(id=>$(id).value='');this.refresh(true);}
 focus(){$('search').value='';['byArea','byStatus','byKind'].forEach(id=>$(id).value='');this.view='focus';this.selected='FSM-LIQ-001';this.refresh(true);this.onSelect(this.selected);}
 group(n){this.view='group';this.scope=n;this.selected=null;this.refresh(true);this.onSelect('area:'+n);}
 choose(id){this.selected=id;this.refresh();this.onSelect(id);}
 reveal(id){if(!this.map.has(id))return;this.view='path';this.list=[id,...new Set(this.g.edges.filter(e=>e.executable && (e.from===id||e.to===id)).map(e=>e.from===id?e.to:e.from))];this.choose(id);this.fit();}
 path(id,kind){
  if(!this.map.has(id))return;
  const exec=this.g.edges.filter(e=>e.executable),inv=kind==='in',goal=kind==='index'?'BLK-10':kind==='rec'?'BLK-15':null;
  let found=null,seen=new Set([id]),queue=[[id]],result=[];
  while(queue.length){const p=queue.shift(),last=p.at(-1);
   if(goal && (last===goal || kind==='rec'&&last.startsWith('ACT-'))){found=p;break;}
   if(!goal && (kind==='in'&&p.length>=2||p.length>=6))continue;
   for(const e of exec.filter(e=>(inv?e.to:e.from)===last)){const next=inv?e.from:e.to;if(!seen.has(next)){seen.add(next);result.push(next);queue.push([...p,next]);}}
  }
  this.view='path';this.list=goal?(found||[id]):[id,...result];this.selected=id;this.refresh(true);
  if(goal&&!found)$('mapLocation').textContent='Подтверждённый расчётный путь не найден';
 }
 filtered(){
  const q=$('search').value.trim().toLowerCase(),a=$('byArea').value,k=$('byKind').value,s=$('byStatus').value;
  return this.g.nodes.filter(n=>(!a||n.area===+a)&&(!k||n.kind===k)&&(!s||n.status===s)&&($('showRefs').checked||n.kind!=='evidence')&&(!q||[n.id,n.name_ru,n.program].join(' ').toLowerCase().includes(q)));
 }
 refresh(fit=false){
  let items=[],edges=[],labels=[];const nodes=this.g.nodes;
  if(this.view==='all'){
   for(const [col,group] of lanes.entries()){
    labels.push({text:laneNames[col],x:col*228,y:0});
    group.forEach((area,row)=>items.push({id:'area:'+area,title:this.g.areas[area-1],sub:nodes.filter(n=>n.area===area&&n.kind!=='evidence').length.toLocaleString('ru')+' · в реестре',x:col*228,y:22+row*73,tint:tints[col],icon:icons[area-1]}));
   }
   const seen=new Set();
   for(const e of this.g.edges){if(!e.executable)continue;const a=this.map.get(e.from)?.area,b=this.map.get(e.to)?.area;if(!a||!b||a===b||seen.has(a+'-'+b))continue;seen.add(a+'-'+b);edges.push({from:'area:'+a,to:'area:'+b,executable:true});}
  }else{
   let subset=this.view==='focus'?[...new Set([...focusIds,...this.g.edges.filter(e=>e.to==='FSM-LIQ-001'&&e.executable).map(e=>e.from),...nodes.filter(n=>n.status==='Эксперимент').map(n=>n.id)])].map(id=>this.map.get(id)).filter(Boolean)
    :this.view==='path'?this.list.map(id=>this.map.get(id)).filter(Boolean):this.filtered().filter(n=>this.view!=='group'||n.area===this.scope);
   const cols=this.view==='focus'?3:this.view==='path'?Math.min(4,Math.max(1,Math.ceil(Math.sqrt(subset.length)))):3;
   items=subset.map((n,i)=>({id:n.id,title:n.name_ru,sub:n.id,x:(i%cols)*235,y:Math.floor(i/cols)*82,tint:n.editable?tints[1]:tints[0],icon:icons[n.area-1]}));
   const idset=new Set(items.map(i=>i.id));edges=this.g.edges.filter(e=>idset.has(e.from)&&idset.has(e.to)&&(e.executable||this.selected===e.from||this.selected===e.to)&&($('showRefs').checked||e.type!=='EVIDENCE'));
  }
  this.items=items.map(i=>Object.assign(i,this.layout[this.view+'|'+i.id]||{}));this.edges=edges;this.labels=labels;this.pos=new Map(this.items.map(i=>[i.id,i]));
  const box=this.bounds();this.box=box;
  $('mapLocation').textContent=this.view==='all'?'Архитектура · 22 области':this.view==='focus'?'Расчётный контур · ликвидность':this.view==='group'?this.g.areas[this.scope-1]+' · '+items.length.toLocaleString('ru')+' · в реестре':this.view==='filter'?'Найдено · '+items.length:'Путь · '+items.length+' узлов';
  $('total').textContent=this.g.nodes.length.toLocaleString('ru')+' узла · '+this.g.edges.length.toLocaleString('ru')+' связей';
  if(fit)this.fit();else this.draw();
 }
 bounds(){const a=this.items;if(!a.length)return {x:0,y:0,w:500,h:250};const x=Math.min(...a.map(i=>i.x)),y=Math.min(0,...a.map(i=>i.y));return {x,y,w:Math.max(...a.map(i=>i.x+205))-x,h:Math.max(...a.map(i=>i.y+58))-y};}
 fit(){if(!this.items)return;const {w,h,x,y}=this.bounds(),pw=this.pane.clientWidth,ph=this.pane.clientHeight;if(!pw||!ph)return;this.scale=Math.max(this.items.length>35?.70:.32,Math.min(1.22,(pw-60)/w,(ph-85)/h));this.x=(pw-w*this.scale)/2-x*this.scale;this.y=this.items.length>35?36:(ph-h*this.scale)/2-y*this.scale-5;this.draw();}
 zoom(f,cx=this.pane.clientWidth/2,cy=this.pane.clientHeight/2){
  const old=this.scale;this.scale=Math.max(.22,Math.min(2.8,old*f));this.x=cx-(cx-this.x)*this.scale/old;this.y=cy-(cy-this.y)*this.scale/old;
  if(this.view==='all'&&this.scale>1.7){const gx=(cx-this.x)/this.scale,gy=(cy-this.y)/this.scale,i=this.items.find(i=>gx>=i.x&&gx<=i.x+205&&gy>=i.y&&gy<=i.y+58);if(i){this.group(+i.id.slice(5));return;}}
  this.draw();
 }
 draw(){if(this.frame)return;this.frame=requestAnimationFrame(()=>{this.frame=0;this.paint();});}
 paint(){
  const {x,y,scale:s}=this,pw=this.pane.clientWidth,ph=this.pane.clientHeight;
  $('world').style.transform='translate('+x+'px,'+y+'px) scale('+s+')';$('zoomPct').textContent=Math.round(s*100)+'%';
  const visible=this.items.filter(i=>i.x*s+x<pw+30 && (i.x+205)*s+x>-30 && i.y*s+y<ph+40 && (i.y+58)*s+y>-40);
  const visibleIds=new Set(visible.map(i=>i.id)),connected=new Set([this.selected]);for(const e of this.edges)if(e.from===this.selected||e.to===this.selected){connected.add(e.from);connected.add(e.to);}
  const f=document.createDocumentFragment();
  for(const label of this.labels){const div=document.createElement('div');div.className='lane';div.style.transform='translate('+label.x+'px,'+label.y+'px)';div.textContent=label.text;f.append(div);}
  for(const i of visible){const b=document.createElement('button');b.className='node'+(this.selected===i.id?' selected':this.selected && !connected.has(i.id)?' dim':'');b.dataset.id=i.id;b.style.transform='translate('+i.x+'px,'+i.y+'px)';b.style.setProperty('--tint',i.tint);
   b.innerHTML='<span class="symbol">'+escapeHTML(i.icon)+'</span><span><b>'+escapeHTML(i.title)+'</b><small>'+escapeHTML(i.sub)+'</small></span>';b.title=i.title+' · '+i.sub;
   b.onclick=e=>{if(performance.now()<this.noClick)return;if(i.id.startsWith('area:'))this.group(+i.id.slice(5));else this.choose(i.id);};f.append(b);}
  $('cards').replaceChildren(f);const paths=document.createDocumentFragment();
  for(const e of this.edges){if(!visibleIds.has(e.from)&&!visibleIds.has(e.to))continue;const a=this.pos.get(e.from),b=this.pos.get(e.to);if(!a||!b)continue;
   const path=document.createElementNS(ss,'path'),right=b.x>=a.x,ax=a.x+(right?205:0),bx=b.x+(right?0:205),ay=a.y+29,by=b.y+29,mid=ax+(right?1:-1)*Math.max(18,Math.min(80,Math.abs(bx-ax)/2));
   path.setAttribute('d','M'+ax+' '+ay+' C'+mid+' '+ay+' '+(bx+(right?-1:1)*30)+' '+by+' '+bx+' '+by);
   path.setAttribute('fill','none');path.setAttribute('stroke',e.executable?'#73be9f':'#819293');path.setAttribute('opacity',this.selected?(e.from===this.selected||e.to===this.selected?'.95':'.13'):'.38');path.setAttribute('stroke-width',e.executable?'1.8':'1');if(!e.executable)path.setAttribute('stroke-dasharray','4 5');paths.append(path);}
  $('edges').replaceChildren(paths);this.minimap();
 }
 minimap(){const c=$('mini'),ctx=c.getContext('2d'),b=this.box;if(!b)return;ctx.clearRect(0,0,c.width,c.height);const f=Math.min((c.width-8)/b.w,(c.height-8)/b.h);this.miniFactor=f;
  for(const n of this.items){ctx.fillStyle=n.id===this.selected?'#bdf9ce':n.tint;ctx.globalAlpha=.62;ctx.fillRect(4+(n.x-b.x)*f,4+(n.y-b.y)*f,Math.max(2,205*f),Math.max(1,48*f));}
  ctx.globalAlpha=1;ctx.strokeStyle='#e0f0e4';ctx.strokeRect(4+(-this.x/this.scale-b.x)*f,4+(-this.y/this.scale-b.y)*f,this.pane.clientWidth/this.scale*f,this.pane.clientHeight/this.scale*f);
 }
 bind(){
  $('home').onclick=()=>{this.home();this.onSelect(null);};$('focus').onclick=()=>this.focus();$('plus').onclick=()=>this.zoom(1.25);$('minus').onclick=()=>this.zoom(.8);$('fit').onclick=()=>this.fit();
  const options=(id,entries,first)=>{$(id).replaceChildren(new Option(first,''),...entries.map(([v,n])=>new Option(n,v)));};
  options('byArea',this.g.areas.map((n,i)=>[i+1,n]),'Все области');options('byKind',[...new Set(this.g.nodes.map(n=>n.kind))].map(k=>[k,typeName(k)]),'Все типы');options('byStatus',[...new Set(this.g.nodes.map(n=>n.status))].map(k=>[k,k]),'Все статусы');
  $('filters').onclick=()=>{$('filterbox').hidden=!$('filterbox').hidden;$('filters').setAttribute('aria-expanded',String(!$('filterbox').hidden));this.fit();};
  for(const id of ['search','byArea','byKind','byStatus','showRefs'])$(id).addEventListener('input',()=>{this.view='filter';this.selected=null;this.refresh(true);});
  this.pane.addEventListener('wheel',e=>{e.preventDefault();const r=this.pane.getBoundingClientRect();this.zoom(Math.exp(-Math.max(-100,Math.min(100,e.deltaY))*.002),e.clientX-r.left,e.clientY-r.top);},{passive:false});
  this.pane.onpointerdown=e=>{if(e.button!==0||e.target.closest('.zoom,#mini'))return;const b=e.target.closest('.node');this.drag={px:e.clientX,py:e.clientY,ox:this.x,oy:this.y,node:b?this.pos.get(b.dataset.id):null};if(this.drag.node){this.drag.nx=this.drag.node.x;this.drag.ny=this.drag.node.y;}};
  window.addEventListener('pointermove',e=>{const d=this.drag;if(!d)return;const dx=e.clientX-d.px,dy=e.clientY-d.py;if(Math.abs(dx)+Math.abs(dy)<5&&!d.moved)return;d.moved=true;if(d.node){d.node.x=d.nx+dx/this.scale;d.node.y=d.ny+dy/this.scale;}else{this.x=d.ox+dx;this.y=d.oy+dy;}this.draw();});
  window.addEventListener('pointerup',()=>{const d=this.drag;this.drag=null;if(d?.moved){this.noClick=performance.now()+150;if(d.node){this.layout[this.view+'|'+d.node.id]={x:d.node.x,y:d.node.y};localStorage.setItem('prescore.studio.layout.v1',JSON.stringify(this.layout));this.box=this.bounds();}}});
  $('mini').onclick=e=>{const c=$('mini'),rect=c.getBoundingClientRect(),x=this.box.x+((e.clientX-rect.left)*c.width/rect.width-4)/this.miniFactor,y=this.box.y+((e.clientY-rect.top)*c.height/rect.height-4)/this.miniFactor;this.x=this.pane.clientWidth/2-x*this.scale;this.y=this.pane.clientHeight/2-y*this.scale;this.draw();};
 }
}
