// Synthetic inputs only; use the same saved-analysis input shape as Workspace service.
import fs from 'node:fs';
import {loadBusiness} from '../../lib/credit-engine/credit-lab/business-corpus.mjs';
import {buildCanonicalCreditAnalysis} from '../../lib/credit-engine/production/orchestrator.ts';
import {publicCanonicalModel} from '../../lib/credit-engine/production/public-model.ts';
const rows=['001','011','013','016','017','022'].map(n=>{
 const b=loadBusiness('CL-RU-BUS-'+n),result=buildCanonicalCreditAnalysis({analysis:b.input.analysis,companyProfile:b.input.companyProfile}),report=publicCanonicalModel(result.model,result);
 return {caseId:'CL-RU-BUS-'+n,origin:'synthetic business corpus; saved-analysis inputs, no lab-only credit scenarios',hero:report.hero,index:{value:result.prescoreIndex.value,status:result.prescoreIndex.status,label:report.index.status},readiness:report.readiness,capacity:{status:report.capacity.status,prudential:result.debtCapacity.headlineCapacity.monthlyIncrementalDebtServiceCapacity.prudential},bankingCompleteness:b.input.analysis.integrity.completeness,missingSources:b.input.analysis.integrity.missingSources,sourceStatuses:Object.fromEntries(Object.entries(b.input.analysis.sourceManifest).filter(([,v])=>v&&typeof v==='object'&&!Array.isArray(v)).map(([k,v])=>[k,v.status]))};
});
fs.writeFileSync(process.argv[2]??'build/workspace-field-audit.json',JSON.stringify(rows,null,2));
console.log(JSON.stringify(rows.map(r=>({case:r.caseId,index:r.index,completeness:r.bankingCompleteness,missing:r.missingSources,sources:r.sourceStatuses})),null,2));
