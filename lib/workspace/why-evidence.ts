import {COPY,publicText} from '../credit-engine/client-report/copy.ts';
import type {ExplainabilityV1, ExplanationClaimV1, ExplanationSourceReferenceV1, ExplanationValueBindingV1} from '../credit-engine/contracts/explainability.ts';

// Read-only presentation traversal. No engine rerun, textual joins or analysis-wide dates.
const concrete = (c:ExplanationClaimV1) => c.claimKind==='FINDING'||(c.claimKind==='DATA_LIMITATION'&&c.riskFactIds.length>0);
export function linkedWhyClaims(e:ExplainabilityV1|undefined, ids:string[]) {
 const roots=e?.claims?.filter(c=>ids.includes(c.claimId))??[];
 const seen=new Set<string>();
 const result:{claim:ExplanationClaimV1;linked:boolean;missingLinked:boolean}[]=[];
 for(const root of roots){
  const related=concrete(root)?[]:e!.claims.filter(c=>concrete(c)&&c.riskFindingIds.some(id=>root.riskFindingIds.includes(id)));
  for(const claim of [...related,root])if(!seen.has(claim.claimId)){
   seen.add(claim.claimId);
   result.push({claim,linked:claim===root&&related.length>0,missingLinked:claim===root&&!concrete(root)&&root.riskFindingIds.length>0&&!related.length});
  }
 }
 return result;
}
export function whyTitle(e:ExplainabilityV1|undefined, claimId:string, fallback:string) {
 const linked=linkedWhyClaims(e,[claimId]).filter(x=>concrete(x.claim));
 return linked.length?linked.map(x=>x.claim.titleRu).join('; '):fallback;
}
export const whyBindings=(c:ExplanationClaimV1)=>c.valueBindings.filter(v=>v.bindingCode!=='ORIGIN'&&!/penalty|modifier|weight|threshold/i.test(v.bindingCode));
export function whySources(e:ExplainabilityV1, c:ExplanationClaimV1) {
 const bindings=whyBindings(c), ids=bindings.length?bindings.flatMap(b=>b.sourceReferenceIds):c.sourceReferenceIds;
 const seen=new Set<string>();
 return e.sourceReferences.filter(s=>ids.includes(s.sourceReferenceId)).filter(s=>{
  // Same actual source identities AND dates/confidence; a source-kind label is never a join key.
  const key=s.sourceIds.length?JSON.stringify([s.sourceKind,[...s.sourceIds].sort(),s.periodFrom,s.periodTo,s.asOf,s.confidence]):s.sourceReferenceId;
  if(seen.has(key))return false;seen.add(key);return true;
 });
}
const iso=(s:string|null)=>s&&/^\d{4}-\d{2}-\d{2}$/.test(s)&&Number.isFinite(Date.parse(s))&&new Date(s).toISOString().slice(0,10)===s?s:null;
const date=(s:string)=>s.split('-').reverse().join('.');
export function whySourceDates(s:Pick<ExplanationSourceReferenceV1,'periodFrom'|'periodTo'|'asOf'>) {
 const from=iso(s.periodFrom),to=iso(s.periodTo),asOf=iso(s.asOf);
 const period=from&&to&&from<=to?date(from)+' — '+date(to):from&&!to?'С '+date(from)+'; конец периода не подтверждён':to&&!from?'По '+date(to)+'; начало периода не подтверждено':'Период не подтверждён';
 return period+(asOf?' · Сведения на '+date(asOf):'');
}
const names:Record<string,string>={BANK_TOP1:'Доля крупнейшего прямого покупателя',BANK_CONCENTRATION_COVERAGE:'Покрытие оценки концентрации',BANK_IDENTITY_COVERAGE:'Покрытие идентификации покупателей',BANK_INTERMEDIATED_SHARE:'Доля поступлений через посредников'};
export function whyBindingText(v:ExplanationValueBindingV1) {
 const unit=v.unit==='RATIO'?' (доля от 1)':v.unit==='DAYS'?' дней':v.unit==='MONTHS'?' месяцев':'';
 return (names[v.bindingCode]??'Значение')+': '+v.formattedValueRu+(typeof v.rawValue==='number'?unit:'');
}

// Wording for the evidence dialog only. Untranslated references remain available for a detailed reconciliation.
const warningLabels:Record<string,string>={
 ...COPY.requirements,
 PRESCORE_ANALYTICAL_CHECKPOINT_NOT_LEGAL_DEADLINE:'Дата в плане указывает, когда вернуться к проверке.',
 TASK_COMPLETION_NOT_ANALYTICAL_RESOLUTION:'После выполнения действия повторите анализ, чтобы проверить изменение фактора.',
 WEAK_EVIDENCE_VERIFY_FIRST:'Сначала подтвердите исходные сведения документами.',
 ACCOUNT_COVERAGE_NOT_PROVEN:'Полнота выписок по счетам компании пока не подтверждена.',
 ASSESSMENT_NOT_COMPLETE:'Для завершения оценки требуются дополнительные сведения.',
 CAPACITY_NOT_COMPLETE:'Для оценки доступного платежа нужны дополнительные сведения.',
 DEBT_PAYMENT_UNMATCHED:'Часть платежей по долгу требует сверки с договорами.',
 UNSPLIT_PAYMENT_NOT_PRINCIPAL_REDUCTION:'Для определения погашенной суммы разделите основной долг и проценты по документам кредитора.',
 NEW_OBLIGATION_REQUIRES_REVIEW:'Подтвердите условия выявленного обязательства.',
 'SOURCE_MISSING:QUARTERLY':'Для проверки нужна промежуточная бухгалтерская отчётность.',
 'SOURCE_MISSING:BFO':'Для проверки нужна бухгалтерская отчётность.',
 'SOURCE_MISSING:BKI':'Для проверки нужен отчёт о кредитной истории.',
 SHORT_FULL_MONTH_HISTORY:'В выписке недостаточно полных месяцев для этого расчёта.',
 PRODUCT_FIT_NOT_BANK_APPROVAL:'Условия финансирования подтверждает кредитор после рассмотрения заявки.',
};
export function whyWarnings(warnings:readonly string[]){
 const labels=new Set<string>(),references=new Set<string>();
 for(const value of warnings){
  const warning=value.trim();
  if(!warning)continue;
  const label=warningLabels[warning];
  if(label)labels.add(label);
  else if(/[А-Яа-яЁё]/.test(warning))labels.add(publicText(warning));
  else references.add(warning);
 }
 return {labels:[...labels],references:[...references]};
}
