import {validDate} from '../credit-engine/credit-portfolio/common.ts';
export type CalendarEntry={date:string;amount:number;direction:'IN'|'OUT';purpose:string;source:string;certainty:'DECLARED'|'SCENARIO'};
export function calendarEntry(value:Partial<Record<keyof CalendarEntry,unknown>>):CalendarEntry|null{
  if(!value||!validDate(value.date)||typeof value.amount!=='number'||value.amount<=0||!Number.isSafeInteger(Math.round(value.amount*100))||Math.abs(value.amount-Math.round(value.amount*100)/100)>1e-9)return null;
  if(value.direction!=='IN'&&value.direction!=='OUT'||value.certainty!=='DECLARED'&&value.certainty!=='SCENARIO')return null;
  if(typeof value.purpose!=='string'||!value.purpose.trim()||value.purpose.length>240||typeof value.source!=='string'||!value.source.trim()||value.source.length>240)return null;
  return {date:value.date,amount:value.amount,direction:value.direction,purpose:value.purpose.trim(),source:value.source.trim(),certainty:value.certainty};
}
