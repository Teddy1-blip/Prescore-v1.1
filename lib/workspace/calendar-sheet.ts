import {calendarEntry,type CalendarEntry} from './calendar-entry.ts';
export type SheetMapping={date:number;amount:number;purpose:number;direction:'IN'|'OUT';header:number};
export function calendarSheet(text:string):string[][]{
 const rows=text.replace(/^\uFEFF/,'').trimEnd().split(/\r?\n/).map(line=>line.split('\t').map(c=>c.trim()));
 if(!rows.length||rows.length>2500||rows.some(r=>r.length>100||r.some(c=>c.length>500)))throw Error('Таблица слишком велика. Выберите один график до 2500 строк и 100 колонок.');
 return rows;
}
export function mapSheetRow(rows:string[][],map:SheetMapping,index:number,name:string):CalendarEntry|null{
 if(!map||!Number.isSafeInteger(index)||!Number.isSafeInteger(map.header)||map.header<0||index<=map.header||index>=rows.length||!['IN','OUT'].includes(map.direction))return null;
 const columns=[map.date,map.amount,map.purpose];
 if(new Set(columns).size!==3||columns.some(c=>!Number.isSafeInteger(c)||c<0||c>=(rows[map.header]?.length??0)))return null;
 const row=rows[index],raw=row[map.date]??'';
 let date=raw;
 if(/^\d{2}\.\d{2}\.\d{4}$/.test(raw))date=raw.split('.').reverse().join('-');
 // Spreadsheet serials are intentionally unsupported without workbook date-system metadata.
 const money=(row[map.amount]??'').replace(/[\s\u00a0]/g,'').replace(',','.');
 if(!/^\d+(?:\.\d{1,2})?$/.test(money)||/^(?:итого|всего|сальдо|остаток)(?:\s|$)/iu.test(row[map.purpose]??''))return null;
 return calendarEntry({date,amount:Number(money),direction:map.direction,purpose:row[map.purpose],source:name+' · строка '+(index+1),certainty:'DECLARED'});
}
