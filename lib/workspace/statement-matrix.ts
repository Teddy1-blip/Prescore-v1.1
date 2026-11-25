import {BALANCE_CODES, INCOME_CODES, type FinancialStatementSnapshot} from '../credit-engine/contracts/financial-statements.ts';
import {validDate} from '../credit-engine/financial-analysis/periods.ts';

export const statementGroups = [
  {form:'Ф1', title:'Актив · I. Внеоборотные активы', fields:['NON_CURRENT_ASSETS','INTANGIBLE_ASSETS','FIXED_ASSETS']},
  {form:'Ф1', title:'Актив · II. Оборотные активы', fields:['CURRENT_ASSETS','INVENTORIES','INPUT_VAT','RECEIVABLES','SHORT_TERM_FIN_INVESTMENTS','CASH','OTHER_CURRENT_ASSETS','ASSETS_TOTAL']},
  {form:'Ф1', title:'Пассив · III. Капитал и резервы', fields:['EQUITY','RETAINED_EARNINGS']},
  {form:'Ф1', title:'Пассив · IV. Долгосрочные обязательства', fields:['LONG_TERM_LIABILITIES','LONG_TERM_BORROWINGS']},
  {form:'Ф1', title:'Пассив · V. Краткосрочные обязательства', fields:['SHORT_TERM_LIABILITIES','SHORT_TERM_BORROWINGS','PAYABLES','OTHER_SHORT_TERM_LIABILITIES','BALANCE_TOTAL']},
  {form:'Ф2', title:'Отчёт о финансовых результатах', fields:Object.keys(INCOME_CODES) as (keyof typeof INCOME_CODES)[]},
] as const;
export const statementCodes = {...BALANCE_CODES,...INCOME_CODES};
export type StatementField = keyof typeof statementCodes;
export type StatementCell = {value:number; original:number; confidence:string};
export type StatementEvidence = {id:string; name:string; received:string; documentId:string|null; scale:number|null;
  values:Partial<Record<StatementField,StatementCell>>};
export type StatementPeriod = {id:string; period:FinancialStatementSnapshot['period']; selected:StatementEvidence; alternatives:StatementEvidence[]; difference:number|null; changes?:Partial<Record<StatementField,{value:number;previousDate:string}>>};
export type StatementMatrix = {inn:string; through:string; interim:boolean; periods:StatementPeriod[]};
export function projectStatement(source:FinancialStatementSnapshot, documentId:string|null):StatementEvidence {
  const values:StatementEvidence['values']={};
  const fields={...source.balance,...source.income};
  for(const key of Object.keys(statementCodes) as StatementField[]){
    const fact=fields[key];
    if(key in INCOME_CODES && source.period.flowPeriodType==='UNKNOWN')continue;
    if(fact?.status==='KNOWN' && fact.origin==='REPORTED' && ['HIGH','MEDIUM'].includes(fact.confidence)
      && source.confirmedScale && Number.isFinite(fact.value) && Number.isFinite(fact.rawValue)){
      values[key]={value:fact.value!,original:fact.rawValue!,confidence:fact.confidence};
    }
  }
  return {id:source.sourceId,name:source.source.fileName||source.source.sourceName||(source.sourceType==='BFO'?'Бухгалтерская отчётность':'Промежуточная отчётность'),
    received:source.source.receivedAt,documentId,scale:source.confirmedScale,values};
}
const ends=['03-31','06-30','09-30'];
export function validStatementPeriod(p:FinancialStatementSnapshot['period']){
  if(!validDate(p.asOf)||p.year!==Number(p.asOf!.slice(0,4)))return false;
  if(p.kind==='SNAPSHOT')return p.flowPeriodType==='UNKNOWN';
  if(!validDate(p.from)||!validDate(p.to)||p.to!==p.asOf||p.from!>p.to!||p.from!.slice(0,4)!==String(p.year))return false;
  if(p.kind==='ANNUAL')return p.flowPeriodType==='FULL_YEAR'&&p.monthsCovered===12&&p.from===p.year+'-01-01'&&p.to===p.year+'-12-31';
  const quarter=ends.indexOf(p.to!.slice(5))+1;
  if(p.kind!=='INTERIM'||!quarter)return false;
  return p.flowPeriodType==='CUMULATIVE_YTD'?p.from===p.year+'-01-01'&&p.monthsCovered===quarter*3
    :p.flowPeriodType==='STANDALONE_PERIOD'?p.monthsCovered===3&&p.from===p.year+'-'+['01','04','07'][quarter-1]+'-01':p.flowPeriodType==='UNKNOWN';
}
export type StatementColumn={id:string;year:number;annual:boolean;title:string;basis:string;period?:StatementPeriod};
export function statementColumns(matrix:StatementMatrix,history=false):StatementColumn[]{
  const periods=matrix.periods.filter(p=>p.period.asOf&&p.period.asOf<=matrix.through);
  const years=periods.filter(p=>p.period.kind==='ANNUAL').map(p=>p.period.year!);
  const lastAnnual=years.length?Math.max(...years):0;
  const columns:StatementColumn[]=[];
  for(let year=years.length?Math.min(...years):1;year<=lastAnnual;year++){
    const period=periods.find(p=>p.period.kind==='ANNUAL'&&p.period.year===year);
    columns.push({id:period?.id??'year-'+year,year,title:String(year),annual:true,basis:'Полный год',period});
  }
  if(!matrix.interim)return columns;
  const interim=periods.filter(p=>p.period.kind!=='ANNUAL'&&(history||p.period.year!>lastAnnual));
  const interimYears=new Set(interim.map(p=>p.period.year!));
  if(lastAnnual)for(let y=lastAnnual+1;y<=Number(matrix.through.slice(0,4));y++)interimYears.add(y);
  for(const year of [...interimYears].sort()){
    for(const [index,end] of ends.entries()){
      const date=year+'-'+end, matches=interim.filter(p=>p.period.asOf===date);
      if(date>matrix.through&&!matches.length)continue;
      const title=year+' · '+(index+1)+' кв.';
      if(!matches.length)columns.push({id:date,year,title,annual:false,basis:'',period:undefined});
      for(const p of matches){
        const basis=p.period.flowPeriodType==='CUMULATIVE_YTD'?p.period.monthsCovered+' мес. с начала года':p.period.flowPeriodType==='STANDALONE_PERIOD'?'Отдельный квартал':'Только баланс';
        columns.push({id:p.id,year,title,annual:false,basis,period:p});
      }
    }
    for(const p of interim.filter(p=>p.period.year===year&&!ends.includes(p.period.asOf!.slice(5)))){
      columns.push({id:p.id,year,title:p.period.asOf!,annual:false,basis:'Только баланс',period:p});
    }
  }
  return columns;
}
export const displayUnits:Record<number,string>={1:'₽',1000:'тыс. ₽',1000000:'млн ₽'};
const numberFormat=new Intl.NumberFormat('ru-RU',{maximumFractionDigits:8});
export function statementNumber(value:number|undefined,scale:number){return value===undefined?'—':numberFormat.format(value/scale);}

