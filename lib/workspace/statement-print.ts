import {financialLabel} from '../credit-engine/client-report/source-detail.ts';
import {statementColumns,statementGroups,statementCodes,statementNumber,type StatementMatrix} from './statement-matrix.ts';

// Four periods per page-width band. Freeze the column range at the issue date.
export function statementPrintBands(matrix:StatementMatrix) {
  const columns=statementColumns(matrix,true),result=[];
  for(let i=0;i<columns.length;i+=4){
    const band=columns.slice(i,i+4);
    const headers=['Показатель · тыс. ₽',...band.map(c=>[c.title,c.basis].filter(Boolean).join('\n'))];
    const sources=band.flatMap(c=>{
      if(!c.period)return [];
      const s=c.period.selected;
      return [c.title+' · '+c.basis+' · '+s.name+' · '+s.received.slice(0,10)];
    });
    for(const form of ['Ф1','Ф2'] as const){
      const rows=statementGroups.filter(g=>g.form===form).flatMap(g=>g.fields.map(key=>[
        statementCodes[key]+' · '+financialLabel(key),...band.map(c=>statementNumber(c.period?.selected.values[key]?.value,1000))]));
      result.push({title:form==='Ф1'?'Ф1 · Бухгалтерский баланс':'Ф2 · Финансовые результаты',headers,rows,sources});
    }
  }
  return result;
}
