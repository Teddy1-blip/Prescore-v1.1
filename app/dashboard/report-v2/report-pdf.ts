import type {Content,TDocumentDefinitions} from 'pdfmake/interfaces';
import type {ClientReportModelV1} from '../../../lib/credit-engine/contracts/client-report';
import type {DossierReport} from '../../../lib/workspace/dossier-report';
import {expertiseEditorial} from '../../../lib/credit-engine/expertise/editorial.ts';
import {printPeriod,type PrintBankingV1} from '../../../lib/workspace/print-banking.ts';

export type PdfReport={inn:string;decision?:ClientReportModelV1;banking?:PrintBankingV1|null;dossier?:DossierReport};
const number=new Intl.NumberFormat('ru-RU',{maximumFractionDigits:3});
const amount=(v:number|null|undefined)=>v==null?'Не определено':number.format(v)+' ₽';
const heading=(text:string):Content=>({text,style:'heading',headlineLevel:1});
const sub=(text:string):Content=>({text,style:'sub',headlineLevel:2});
const note=(text:string):Content=>({text,style:'note'});
function table(headers:string[],rows:string[][]):Content[]{
  if(!rows.length)return [];
  return [{layout:'lightHorizontalLines',margin:[0,5,0,7],table:{
    headerRows:1,widths:headers.map(()=>'*'),
    body:[headers.map(text=>({text,bold:true,fillColor:'#e7eff2'})),...rows],
  }}];
}

/** Format only values already authorized for this edition by the report page. */
export function reportDocument({inn,decision:m,banking,dossier:d}:PdfReport):TDocumentDefinitions{
  const title=m?.company.name||d?.name||'Финансовый профиль компании';
  const content:Content[]=[
    {text:'PRESCORE',color:'#047967',bold:true,characterSpacing:2},
    {text:title,style:'title'},note(['ИНН '+inn,m?.meta.asOfDate&&'Анализ на '+m.meta.asOfDate].filter(Boolean).join('   ·   ')),
  ];
  if(m){
    content.push(heading('Заключение'),sub(m.hero.headline),m.hero.summary,
      ...table(['Prescore Index','Готовность к финансированию','Долговая ёмкость'],[[
        m.index.value?.display??m.index.status,m.readiness.level,m.capacity.headline?.display??m.capacity.status]]),
      m.readiness.text,m.capacity.text,note(m.capacity.disclaimer));
    const expertise=expertiseEditorial(m);
    if(expertise?.sentences.length){
      content.push(sub('Экспертное заключение Prescore'),...expertise.sentences.map(s=>s.text));
    }
    if(m.checko?.rows.length)content.push(sub('Открытые сведения · Checko'),
      ...table(['Сведения','Значение'],m.checko.rows.map(r=>[r.label,r.value])));
    const factors=[...new Map([...m.primaryFactors,...m.contextHighlights,...m.readiness.constraints,...m.limitations]
      .map(f=>[f.claimId,f])).values()];
    if(factors.length)content.push(heading('Факторы и основания'));
    for(const f of factors){
      content.push(sub(f.title),f.text);
      if(f.why&&f.why!==f.text)content.push(f.why);
      const sources=f.sourceIds.map(id=>m.sources.find(s=>s.id===id)).filter(s=>s!==undefined);
      if(sources.length)content.push(note(sources.map(s=>[s.label,s.period||s.asOf].filter(Boolean).join(' · ')).join('\n')));
    }
  }
  if(banking){
    content.push(heading('Движение денег'),note(printPeriod(banking.periodFrom,banking.periodTo)),
      ...table(['Показатель','Значение','Период'],banking.facts.map(({label,fact})=>[
        label,fact.status==='UNKNOWN'?'Не определено':amount(fact.value),printPeriod(fact.periodFrom,fact.periodTo)])));
  }
  for(const period of (m?m.financialAnalysis:d?.financial)?.history??[]){
    content.push(heading('Бухгалтерская отчётность'),note(printPeriod(period.period.from,period.period.to)));
    for(const group of period.groups){
      const metrics=group.metrics.filter(v=>v.value!==null);
      if(metrics.length)content.push(sub(group.title),...table(['Показатель','Значение'],metrics.map(v=>[
        v.label,[typeof v.value==='number'?number.format(v.value):v.value,{RUB:'₽',PERCENT:'%',RATIO:'×',DAYS:'дн.',COUNT:''}[v.unit]].filter(Boolean).join(' ')])));
    }
  }
  for(const row of m?.reconciliation?.bankBfo??[]){
    content.push(sub(row.title));
    for(const side of [row.bank,row.accounting,...row.context]){
      if(side)content.push(side.label+' · '+amount(side.value),note(side.period.asOf||printPeriod(side.period.from,side.period.to)));
    }
    content.push(row.limitation);
    if(row.action)content.push(row.action);
  }
  const debts=m?.analysisV3?.portfolio.map(o=>[String(o.creditor.value??'Кредитор не указан'),
    amount(typeof o.principal.value==='number'?o.principal.value:null),o.principal.asOf??'Дата не указана'])
    ??d?.obligations.map(o=>[o.creditor??'Кредитор не указан',amount(o.principal),o.principalDate??'Дата не указана'])??[];
  if(debts.length)content.push(heading('Кредитный портфель'),...table(['Кредитор','Основной долг','Дата остатка'],debts));
  if(m){
    const products=[...m.productFit.primary,...m.productFit.other];
    if(products.length)content.push(heading('Финансирование'),note(m.productFit.bankSeparation));
    for(const p of products)content.push(sub(p.title+' · '+p.fit),p.purpose,p.capacity,...p.missing.map(note));
    const actions=[...m.recommendations.primary,...m.recommendations.backlog];
    if(actions.length)content.push(heading('Рекомендации'));
    for(const item of actions)content.push(sub(item.title),item.summary,note(item.why));
    content.push(heading('План действий'));
    for(const horizon of m.actionPlan.horizons){
      content.push(sub(horizon.title+' · '+horizon.date));
      if(horizon.items.length)for(const item of horizon.items){
        content.push({text:item.title,bold:true,margin:[0,6,0,2]},...item.steps,...item.evidence.map(note));
        if(item.recheck)content.push(note(item.recheck));
      }else content.push(note('На этот срок действия не назначены.'));
    }
    content.push(heading('Основания расчёта'),...table(['Источник','Дата или период','Подтверждение'],
      m.sources.map(s=>[s.label,s.period||s.asOf||'Дата не указана',s.confidence])));
  }else if(d?.claims.length){
    content.push(heading('Выводы по документам'));
    for(const c of d.claims)content.push(sub([c.horizon&&({DAY_7:'7 дней',DAY_30:'30 дней',DAY_60:'60 дней'}[c.horizon]),c.title].filter(Boolean).join(' · ')),c.text,note(c.sources.map((s,i)=>
      (d.sources.find(r=>r.id===c.sourceIds[i])?.name??s.type)+' · '+s.date).join('\n')));
  }
  if(d?.settlements?.length){
    content.push(heading('Остатки по ОСВ 60, 62 и 76'));
    for(const row of d.settlements){
      content.push(sub([row.party,row.contract].filter(Boolean).join(' · ')),
        row.account+' · '+row.asOf+' · Дебет '+amount(row.debit)+' · Кредит '+amount(row.credit),
        note(row.references.map(ref=>ref.name+' · '+(ref.page?'стр. ':'строка ')+ref.row).join('\n')));
      if(row.conflict)content.push(note('Требуется сверка источников'));
    }
  }
  if(d?.sources.length)content.push(heading('Документы досье на момент выпуска'),...table(['Документ','Получен'],
    d.sources.map(s=>[s.name,s.received.slice(0,10)])));
  if(m){content.push(note(m.printMeta.disclaimer));if(m.meta.snapshot)content.push(note('Версия расчёта · '+m.meta.snapshot.snapshotId));}
  return {info:{title:'Prescore · '+title,author:'Prescore'},pageSize:'A4',pageMargins:[42,42,42,46],
    defaultStyle:{font:'Roboto',fontSize:9.5,lineHeight:1.2,color:'#213a48'},
    styles:{title:{fontSize:23,bold:true,margin:[0,8,0,5]},heading:{fontSize:16,bold:true,color:'#0c6056',margin:[0,16,0,6]},
      sub:{fontSize:11,bold:true,margin:[0,8,0,3]},note:{fontSize:8.5,color:'#455e69',margin:[0,2,0,5]}},
    footer:(page,count)=>({text:'Prescore   ·   ИНН '+inn+'     |     '+page+' / '+count,alignment:'right',fontSize:8,color:'#516975',margin:[36,12,42,0]}),
    pageBreakBefore:(current,following)=>!!current.headlineLevel&&following.length===0,content};
}

export async function saveReportPdf(report:PdfReport){
  const [{default:pdfMake},{default:fonts}]=await Promise.all([import('pdfmake/build/pdfmake'),import('pdfmake/build/vfs_fonts')]);
  // The 0.2 build exports the embedded Roboto file dictionary directly.
  const pdf=pdfMake.createPdf(reportDocument(report),undefined,undefined,fonts as unknown as Record<string,string>);
  const stream=pdf.getStream();
  const blob=await new Promise<Blob>((resolve,reject)=>{
    const chunks:ArrayBuffer[]=[];
    stream.on('data',(chunk:Uint8Array)=>chunks.push(Uint8Array.from(chunk).buffer));
    stream.on('error',reject);
    stream.on('end',()=>resolve(new Blob(chunks,{type:'application/pdf'})));
    stream.end();
  });
  const url=URL.createObjectURL(blob),link=document.createElement('a');
  link.href=url;link.download='Prescore-'+report.inn+'.pdf';link.click();
  window.setTimeout(()=>URL.revokeObjectURL(url),60_000);
}
