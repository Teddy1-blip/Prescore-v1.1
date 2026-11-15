import {validInn, invalidInnMessage} from './checko-inn.ts';
import type {CompanyProfileData} from '../company-profile.ts';
import type {CheckoState} from './checko-cache.ts';
const names:Record<string,string>={company:'ЕГРЮЛ',entrepreneur:'ЕГРИП',enforcements:'ФССП','legal-cases':'Арбитраж',fedresurs:'Федресурс','bankruptcy-messages':'Сообщения о банкротстве',inspections:'Проверки',contracts:'Контракты',finances:'Бухгалтерская отчётность'};
export function checkoSummary(p?:CompanyProfileData,attempt?:CheckoState){
  if(!p?.externalFacts&&!attempt)return;
  const f=p?.externalFacts;
  const rows:Array<{label:string;value:string;sourceId:string}>=[];
  const base=f?.receipts.find(r=>r.method==='company'||r.method==='entrepreneur');
  if(f&&base && base.status==='READY'){
    const i=f.identity;
    for(const [label,value] of Object.entries({'Юридический статус':i.status,'Регистрация':i.registered,'Регион':i.region,'ОКВЭД':i.okved,'Уставный капитал, ₽':i.capital,'Руководители':i.managerNames.join(', '),'Учредители':i.founders,'Недостоверный адрес':i.unreliable===null?null:i.unreliable?'Да':'Нет'}))
      if(value!==null && value!==undefined && value!=='') rows.push({label,value:String(value),sourceId:base.id});
    for(const r of f.receipts.filter(r=>names[r.method] && !['company','entrepreneur','finances'].includes(r.method))) {
      rows.push({label:names[r.method],value:['READY','EMPTY'].includes(r.status)&&r.total!==null?String(r.total)+(r.total!==r.visible?' · видны '+r.visible:''):r.status==='FAILED'?'Ошибка источника':'Количество не подтверждено',sourceId:r.id});
    }
  }
  const status=p?(attempt?.status==='STALE'&&attempt.fetchedAt===p.fetchedAt?'STALE':p.failedMethods?.length||f?.receipts.some(r=>r.provider==='CHECKO'&&r.status==='FAILED')?'PARTIAL':'READY'):attempt?.status??'NOT_REQUESTED';
  return {status,fetchedAt:p?.fetchedAt??attempt?.fetchedAt??null,rows};
}
export function checkoStatusText(status: CheckoState['status'], inn: string) {
  return status === 'FAILED' && !validInn(inn) ? invalidInnMessage(inn) : checkoLabels[status];
}
export const checkoLabels:Record<CheckoState['status'],string>={READY:'Подключено',PARTIAL:'Частично',STALE:'Сохранённые сведения устарели',NOT_CONFIGURED:'Источник не настроен',NOT_REQUESTED:'Ещё не запрашивался',RETRY_LATER:'Ожидает повторного запроса',FAILED:'Ошибка получения сведений'};
