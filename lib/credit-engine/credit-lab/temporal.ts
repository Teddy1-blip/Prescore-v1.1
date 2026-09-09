import type { CreditLabCaseMaterial, CreditLabTemporalDiagnostic } from "../contracts/credit-lab.ts";
import type { RiskFact } from "../contracts/risk.ts";
import { buildFinancialAnalysis } from "../financial-analysis/engine.ts";
import { validDate } from "./common.ts";
const availableDate=(d:unknown,cutoff:string)=>d==null||d===""||typeof d==="string"&&validDate(d.slice(0,10))&&d.slice(0,10)<=cutoff;
// Availability dates, not future maturity/payment/calendar dates.
export function knownByCutoff(x:unknown,cutoff:string):boolean {
 if(!x||typeof x!=="object")return true;
 return Object.entries(x).every(([k,v])=>["receivedAt","fetchedAt","observedAt","requestedAt"].includes(k)?availableDate(v,cutoff):knownByCutoff(v,cutoff));
}
export function eligibleFact(f:RiskFact,cutoff:string){return [f.period.from,f.period.to,f.period.asOf,...f.evidence.flatMap(e=>[e.periodFrom,e.periodTo,e.asOf])].every(d=>availableDate(d,cutoff));}
export function prepareMaterial(material:CreditLabCaseMaterial,cutoff:string,diagnostics:CreditLabTemporalDiagnostic[]=[]):CreditLabCaseMaterial {
 const keep=(eligible:boolean,path:string)=>{if(!eligible)diagnostics.push({code:"TEMPORAL_LEAKAGE_CANDIDATE",path,cutoff,reason:"Excluded: source availability or applicable evidence period does not satisfy case cutoff"});return eligible;};
 const m=structuredClone(material);
 if(m.kind==="RISK_FACTS"){m.facts=m.facts.filter(f=>keep(eligibleFact(f,cutoff),`facts:${f.factId}:period/evidence`));return m;}
 const a=m.analysis;
 delete a.riskAssessmentV1;delete a.riskComparison;delete a.riskEngineWarnings;
 const manifest=a.sourceManifest;
 if(a.metricsV2&&!keep(availableDate(a.metricsV2.period.to,cutoff)&&knownByCutoff(manifest?.bankStatements,cutoff),"analysis.metricsV2")){delete a.metricsV2;delete a.integrity;}
 if(a.creditHistory&&!keep(availableDate(a.creditHistory.reportDate,cutoff)&&knownByCutoff(manifest?.bki,cutoff),"analysis.creditHistory"))delete a.creditHistory;
 if(a.creditPortfolioV1&&!keep(availableDate(a.creditPortfolioV1.asOfDate,cutoff)&&knownByCutoff(a.creditPortfolioV1,cutoff),"analysis.creditPortfolioV1"))delete a.creditPortfolioV1;
 if(m.companyProfile&&!keep(availableDate(m.companyProfile.fetchedAt,cutoff),"companyProfile"))delete m.companyProfile;
 for(const host of [a,m.companyProfile])if(host?.financialAnalysisV2){
  const snapshots=host.financialAnalysisV2.history.map(h=>h.snapshot).filter(s=>keep(availableDate(s.period.asOf,cutoff)&&knownByCutoff(s,cutoff),`financialAnalysisV2.history:${s.snapshotId}`));
  host.financialAnalysisV2=buildFinancialAnalysis(snapshots);
 }
 if(a.reconciliationV1){
  a.reconciliationV1.findings=a.reconciliationV1.findings.filter(f=>keep(knownByCutoff(f,cutoff)&&[...f.leftFacts,...f.rightFacts].every(v=>[v.period.from,v.period.to,v.period.asOf].every(d=>availableDate(d,cutoff))),`reconciliation.findings:${f.findingId}`));
 }
 for(const host of [a,m.companyProfile])if(host?.sourceManifest){const s=host.sourceManifest;
  if("bankStatements" in s){s.bankStatements=s.bankStatements.filter((v,i)=>keep(knownByCutoff(v,cutoff),`sourceManifest.bankStatements:${i}`));for(const key of ["bki","quarterly"]as const)if(s[key]&&!keep(knownByCutoff(s[key],cutoff),`sourceManifest.${key}`))delete s[key];}
  if(s.bfo&&!keep(knownByCutoff(s.bfo,cutoff),"sourceManifest.bfo"))delete s.bfo;
  if(s.external)s.external=s.external.filter((v,i)=>keep(knownByCutoff(v,cutoff),`sourceManifest.external:${i}`));
 }
 return m;
}
