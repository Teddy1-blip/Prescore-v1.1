import type {sourceProjection} from './dossier-sources.ts';
import {validDate} from '../credit-engine/credit-portfolio/common.ts';

export type CalendarSources=Pick<ReturnType<typeof sourceProjection>,'schedule'|'settlements'|'calendar'|'obligations'|'sources'>;
export type CashEvent={id:string;date:string;amount:number;direction:'IN'|'OUT';label:string;basis:string;type:'Договор'|'Ожидаемое поступление'|'План клиента'|'Предположение';ambiguous?:boolean};
export const shiftDate=(date:string,days:number)=>new Date(Date.parse(date)+86400000*days).toISOString().slice(0,10);
const positive=(value:number|null):value is number=>value!==null&&Number.isFinite(value)&&value>0;
export function calendarEvents(profile:CalendarSources):CashEvent[]{
  const events:CashEvent[]=[];
  const name=(ids:string[])=>ids.map(id=>profile.sources.find(s=>s.id===id)?.name).filter(Boolean).join(', ')||'Кредитный портфель';
  for(const e of profile.schedule){
    if(e.type!=='PAYMENT_DUE'||e.exposure==='CONTINGENT'||e.status!=='SCHEDULED'||!positive(e.amount))continue;
    events.push({id:e.id,date:e.date,amount:e.amount,direction:'OUT',label:[e.creditor,e.contract].filter(Boolean).join(' · ')||'Платёж по графику',basis:name(e.sourceIds),type:'Договор'});
  }
  for(const o of profile.obligations){
    if(o.exposure==='CONTINGENT'||!positive(o.nextAmount)||!o.nextDate||profile.schedule.some(e=>e.obligationId===o.id&&e.type==='PAYMENT_DUE'&&e.date===o.nextDate))continue;
    events.push({id:'next:'+o.id,date:o.nextDate,amount:o.nextAmount,direction:'OUT',label:[o.creditor,o.contract].filter(Boolean).join(' · ')||'Очередной платёж',basis:name(o.sourceIds),type:'Договор'});
  }
  for(const p of profile.settlements){
    if(p.conflict||p.side==='other'||!p.dueDate||!positive(p.remaining))continue;
    const incoming=p.side==='buyers';
    events.push({id:'osv:'+p.id,date:p.dueDate,amount:p.remaining,direction:incoming?'IN':'OUT',label:[p.party,p.contract].filter(Boolean).join(' · '),basis:p.references.map(r=>r.name).join(', '),type:incoming?'Ожидаемое поступление':'Договор'});
  }
  for(const [i,e] of profile.calendar.entries()){
    const ambiguous=events.some(p=>p.date===e.date&&p.amount===e.amount&&p.direction===e.direction);
    events.push({id:'manual:'+i,date:e.date,amount:e.amount,direction:e.direction,label:e.purpose,basis:e.source,type:e.certainty==='SCENARIO'?'Предположение':'План клиента',ambiguous});
  }
  return events.sort((a,b)=>a.date.localeCompare(b.date)||a.id.localeCompare(b.id));
}
export function cashForecast(events:CashEvent[],opening:number|null,asOf:string,horizon:30|60|90|180,delay:number,includeAssumptions:boolean){
  if(!validDate(asOf)||![30,60,90,180].includes(horizon)||!Number.isInteger(delay)||delay<0||delay>180)throw Error('Проверьте период и задержку поступлений.');
  const end=shiftDate(asOf,horizon);
  const rows=events.filter(e=>validDate(e.date)&&e.date>asOf&&positive(e.amount)&&!e.ambiguous&&(includeAssumptions||e.type!=='Предположение')).map(e=>({...e,expected:e.direction==='IN'?shiftDate(e.date,delay):e.date})).filter(e=>e.expected<=end).sort((a,b)=>a.expected.localeCompare(b.expected)||a.id.localeCompare(b.id));
  const days=new Map<string,{incoming:number;outgoing:number;items:string[]}>();
  for(const e of rows){const d=days.get(e.expected)??{incoming:0,outgoing:0,items:[]};d[e.direction==='IN'?'incoming':'outgoing']+=Math.round(e.amount*100);d.items.push(e.label);days.set(e.expected,d);}
  let balance=opening===null||!Number.isFinite(opening)?null:Math.round(opening*100);
  let minimum=balance,minDate=asOf,firstGap=balance!==null&&balance<0?asOf:null;
  const daily=[...days].map(([date,d])=>{
    if(balance!==null){balance+=d.incoming-d.outgoing;if(minimum===null||balance<minimum){minimum=balance;minDate=date;}if(balance<0&&!firstGap)firstGap=date;}
    return {date,incoming:d.incoming/100,outgoing:d.outgoing/100,balance:balance===null?null:balance/100,items:d.items};
  });
  return {rows,daily,end,minimum:minimum===null?null:minimum/100,minDate,firstGap};
}
