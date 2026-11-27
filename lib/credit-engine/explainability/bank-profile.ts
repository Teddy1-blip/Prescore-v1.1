import type {ClaimAssembly} from './sources.ts';
import {location} from './common.ts';
export function explainBankProfile(a:ClaimAssembly) {
  for(const o of a.input.creditAssessment.bankObservations??[]) {
    const path=location('creditAssessment','bankObservations','code',o.code);
    const binding=a.binding(o.code,[...path,'value'],o.unit,a.source(path));
    const title=o.title;
    const amount=o.unit==='RATIO' && typeof o.value==='number'?new Intl.NumberFormat('ru-RU',{style:'percent',maximumFractionDigits:1}).format(o.value):binding.formattedValueRu;
    a.claim('PROFILE:'+o.code,path,{section:'CREDIT_PROFILE',claimKind:'STATUS',claimRole:o.positive?'POSITIVE_CONTEXT':'NEUTRAL_CONTEXT',
      titleRu:title,textRu:title+' — '+amount+(o.period.from&&o.period.to?' ('+o.period.from+' – '+o.period.to+')':''),
      valueBindings:[binding],calculationBasis:o.calculationBasis});
  }
}
