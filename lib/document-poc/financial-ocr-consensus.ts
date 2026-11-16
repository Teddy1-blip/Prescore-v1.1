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

/** Some real F2 scans produce exactly the same line-code set in PSM6 and PSM11,
 * while the primary pass drops a profit cell that the sparse pass reads.
 * A safer selection is possible when at least three OTHER dated row codes
 * independently agree, no readable cell regresses and the alternate adds
 * strictly more bounded numeric evidence. Never fill cells across passes.
 */
function trustedDatedCells(rows:readonly PdfFinancialRow[]){
 const byCode=new Map<string,PdfFinancialRow[]>();
 for(const row of rows){
   const key=row.line.page+':'+row.code;
   const entries=byCode.get(key)??[];
   entries.push(row);byCode.set(key,entries);
 }
 const counts=new Map<string,{value:number;code:string;n:number}>();
 for(const matches of byCode.values()){
   if(matches.length!==1)continue;
   const row=matches[0];
   for(let i=0;i<Math.min(row.cells.length,row.headings.length,3);i++){
     const heading=headingKey(row.headings[i]??''),cell=row.cells[i];
     if(!heading||!cell||cell.uncertain)continue;
     const value=numeric(cell.raw.replace(/−/g,'-'));
     if(value===null)continue;
     const key=row.line.page+'|'+row.code+'|'+heading;
     const previous=counts.get(key);
     if(previous)previous.n++;
     else counts.set(key,{code:row.code,value,n:1});
   }
 }
 return new Map([...counts].filter(([,v])=>v.n===1).map(([k,v])=>[k,{code:v.code,value:v.value}]));
}
export function preferMoreCompleteFinancialOcr(
 primary:readonly PdfFinancialRow[],alternative:readonly PdfFinancialRow[]
):boolean{
 const first=trustedDatedCells(primary),second=trustedDatedCells(alternative);
 if(first.size<3||second.size<=first.size)return false;
 let introduced=0;
 const matchedCodes=new Set<string>();
 for(const [key,source] of first){
   const compared=second.get(key);
   if(!compared||!Object.is(compared.value,source.value))return false;
   matchedCodes.add(source.code);
 }
 for(const key of second.keys())if(!first.has(key))introduced++;
 return introduced>0&&matchedCodes.size>=3;
}
