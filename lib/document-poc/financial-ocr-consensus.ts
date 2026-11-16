import {numeric} from './fields.ts';
import type {PdfFinancialRow} from './financial-layout.ts';

/** Compare independent Tesseract PSM6/PSM11 reads of the SAME raster page.
 * Only numbers in an identical, date-labelled financial column are comparable.
 * Disagreement downgrades the selected cell to REVIEW; it never chooses a value
 * by confidence, amount size or a vote. No inferred totals enter scoring.
 */
export const FINANCIAL_OCR_CONSENSUS_VERSION='PRESCORE-OCR-FINANCIAL-CONSENSUS-0.1' as const;
export type FinancialOcrDisagreement={code:string;column:number;page:number};
function headingKey(text:string):string|null{
 const norm=text.normalize('NFKC').toLocaleLowerCase('ru').replace(/ё/g,'е')
   .replace(/[.,]/g,'').replace(/\s+/g,' ').trim();
 // A bare "На" or an undated table is NOT sufficient to bind two OCR variants.
 if(!/(?:^|\s)(?:19|20)\d{2}(?:\s|$)/u.test(norm))return null;
 if(!/^(?:на|за|current|previous)(?:\s|$)/u.test(norm))return null;
 return norm;
}
export function reconcileFinancialOcrRows(
 chosen:readonly PdfFinancialRow[],alternative:readonly PdfFinancialRow[]
):{rows:PdfFinancialRow[];disagreements:FinancialOcrDisagreement[]}{
 const unique=(rows:readonly PdfFinancialRow[])=>{
  const m=new Map<string,PdfFinancialRow[]>();
  for(const row of rows){
   const list=m.get(row.code)??[];
   list.push(row);m.set(row.code,list);
  }
  return m;
 };
 const chosenByCode=unique(chosen),otherByCode=unique(alternative);
 const disagreements:FinancialOcrDisagreement[]=[];
 const rows=chosen.map(row=>{
  const selected=chosenByCode.get(row.code)??[],other=otherByCode.get(row.code)??[];
  if(selected.length!==1||other.length!==1||other[0].line.page!==row.line.page)return row;
  const compare=other[0];
  let updated:PdfFinancialRow|null=null;
  for(let i=0;i<Math.min(row.cells.length,compare.cells.length,3);i++){
   const leftHeading=headingKey(row.headings[i]??''),rightHeading=headingKey(compare.headings[i]??'');
   if(!leftHeading||leftHeading!==rightHeading)continue;
   const a=row.cells[i],b=compare.cells[i];
   if(!a||!b||a.uncertain||b.uncertain)continue;
   const av=numeric(a.raw.replace(/−/g,'-')),bv=numeric(b.raw.replace(/−/g,'-'));
   if(av===null||bv===null||Object.is(av,bv))continue;
   if(!updated)updated={...row,cells:row.cells.map(c=>({...c}))};
   updated.cells[i].uncertain=true;
   disagreements.push({code:row.code,column:i,page:row.line.page});
  }
  return updated??row;
 });
 return {rows,disagreements};
}
