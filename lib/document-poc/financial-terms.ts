/** Evidence-first extraction hints. These are NOT verified financial facts. */
import type {OcrPage} from './local-ocr.ts';
export type FinancialConditionKind='AMOUNT'|'ADVANCE'|'PAYMENT_TERM'|'PAYMENT_TRIGGER'|'TITLE_TRANSFER'|'ASSIGNMENT'|'SECURITY';
export type FinancialConditionHint={kind:FinancialConditionKind;page:number;sourceText:string;status:'REVIEW'};
const checks:Array<[FinancialConditionKind,RegExp]>=[
 ['AMOUNT',/(?:сумм[аыуе]|стоимост[ьи]|цена договора|размер обязательства)/iu],
 ['ADVANCE',/(?:аванс|предоплат|предварительн.{0,18}оплат)/iu],
 ['PAYMENT_TERM',/(?:отсрочк|в течение\s+\d+\s+(?:рабочих\s+|календарных\s+)?дн|срок оплат)/iu],
 ['PAYMENT_TRIGGER',/(?:подписани[яе] акта|при[её]мк[иа]|поставк[иа]|сч[её]та на оплату|после отгрузки)/iu],
 ['TITLE_TRANSFER',/(?:переход.{0,40}права собственности|право собственности.{0,30}переход)/iu],
 ['ASSIGNMENT',/(?:уступк[аиуе]|цессия|уступать.{0,30}требован|переуступ)/iu],
 ['SECURITY',/(?:удержани[ея]|неустойк|залог|поручительств)/iu],
];
export function contractEvidence(pages:OcrPage[]):FinancialConditionHint[]{
 const out:FinancialConditionHint[]=[];
 for(const p of pages){
  const lines=p.text.split(/\r?\n/).map(s=>s.trim()).filter(Boolean);
  for(let i=0;i<lines.length;i++){
   const line=lines[i].slice(0,350);
   for(const [kind,re] of checks){
    if(re.test(line)&&out.filter(x=>x.kind===kind).length<12){
     out.push({kind,page:p.page,sourceText:line,status:'REVIEW'});
    }
   }
   if(out.length>=100)return out;
  }
 }
 return out;
}
