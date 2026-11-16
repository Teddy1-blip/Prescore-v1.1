/** Strict per-agreement evidence from NBKI's dated *history* tables.
 * Never an on-report-date current balance, and never a Credit Engine input.
 */
export type NbkiTermination={date:string;reason:'FULFILLED';page:number};
export type NbkiHistoricalDebt={asOf:string;principalRub:number;totalRub:number;page:number;lastPaymentBasis:boolean};
type Page={page:number;text:string};
const isoDate=(value:string):string|null=>{
 const m=/^(\d{2})-(\d{2})-(\d{4})$/.exec(value);
 if(!m)return null;
 const iso=m[3]+'-'+m[2]+'-'+m[1],date=new Date(iso+'T00:00:00Z');
 return Number.isFinite(date.valueOf())&&date.toISOString().slice(0,10)===iso?iso:null;
};
const money=(value:string):number|null=>{
 if(!/^\d+(?:[,.]\d{2})$/.test(value))return null;
 const n=Number(value.replace(',','.'));
 return Number.isFinite(n)&&n>=0&&n<=1e13?n:null;
};
function terminations({page,text}:Page):NbkiTermination[]{
 const rows=[...text.matchAll(/(?:^|\n)[ \t]*Прекращение обязательства[ \t]{2,}Дата прекращения[ \t]*\r?\n[ \t]*Надлежащее исполнение обязательства[ \t]{2,}(\d{2}-\d{2}-\d{4})(?=[ \t]*\r?\n|$)/gim)];
 return rows.flatMap(row=>{const date=isoDate(row[1]);return date?[{date,reason:'FULFILLED' as const,page}]:[];});
}
function urgentDebt({page,text}:Page):NbkiHistoricalDebt[]{
 const heading=text.match(/(?:^|\n)[ \t]*Срочная задолженность[ \t]*(?=\r?\n)/im);
 if(!heading)return []; // "Срочная задолженность: Н/Д" is not a zero.
 const tail=text.slice((heading.index??0)+heading[0].length);
 const after=tail.search(/(?:^|\n)[ \t]*(?:Просроченная задолженность|Условия платежей|Внесение платежей|УИд договора:|Сведения об источнике формирования кредитной истории)/im);
 const section=after>=0?tail.slice(0,after):tail;
 if(!/Дата возникн\./iu.test(section)||!/Сумма по осн\.долгу/iu.test(section)||!/Дата расчета/iu.test(section))return [];
 const out:NbkiHistoricalDebt[]=[];
 for(const line of section.split(/\r?\n/u)){
  const cells=line.trim().split(/[ \t]{2,}/u);
  if(cells.length!==8||!isoDate(cells[0])||!['Да','Нет'].includes(cells[1]))continue;
  const totalRub=money(cells[2]),principalRub=money(cells[3]);
  const asOf=isoDate(cells[6]),event=isoDate(cells[7]);
  if(asOf===null||event===null||totalRub===null||principalRub===null||principalRub>totalRub)continue;
  out.push({asOf,principalRub,totalRub,page,lastPaymentBasis:cells[1]==='Да'});
 }
 return out;
}
/** All outputs are evidence only. A newer N/D row never gets converted into zero. */
export function datedNbkiEvidence(pages:readonly Page[],kind:'LOAN'|'GUARANTEE'|'UNKNOWN',reportDate?:string){
 const issues:string[]=[];
 const ends=pages.flatMap(terminations);
 const endDates=[...new Set(ends.map(x=>x.date))];
 if(endDates.length>1||ends.some(x=>reportDate&&x.date>reportDate))
  issues.push('BUREAU_TERMINATION_DATE_CONFLICT');
 const termination:NbkiTermination|null=issues.length?null:ends[0]??null;
 const entries=kind==='LOAN'?pages.flatMap(urgentDebt):[];
 const positions=new Map<string,NbkiHistoricalDebt>();
 for(const row of entries){
  if(reportDate&&row.asOf>reportDate){issues.push('BUREAU_DATED_DEBT_CONFLICT');continue;}
  const prior=positions.get(row.asOf);
  if(prior&&(prior.principalRub!==row.principalRub||prior.totalRub!==row.totalRub||prior.lastPaymentBasis!==row.lastPaymentBasis)){
   issues.push('BUREAU_DATED_DEBT_CONFLICT');continue;
  }
  if(!prior)positions.set(row.asOf,row);
 }
 const historicalDebt:NbkiHistoricalDebt|null=issues.includes('BUREAU_DATED_DEBT_CONFLICT')
   ?null:[...positions.values()].sort((a,b)=>b.asOf.localeCompare(a.asOf))[0]??null;
 return {termination,historicalDebt,issues:[...new Set(issues)]};
}
