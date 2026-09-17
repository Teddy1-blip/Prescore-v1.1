import {baseline as base,scenario as sourceScenario,defect as sourceDefect,portfolio} from '../action-plan/builders.mjs';
import {buildActionPlan} from '../../../lib/credit-engine/action-plan/engine.ts';
export {portfolio};
export const complete=x=>({...x,actionPlan:buildActionPlan(x)});
export const baseline=(options={})=>complete(base(options));
export const scenario=options=>complete(sourceScenario(options));
export const defect=()=>complete(sourceDefect());
export function reorder(x){const y=structuredClone(x);for(const k of ['facts','findings','evaluations'])y.riskAssessment[k].reverse();for(const k of ['facts','relations','evaluations'])y.contextAssessment[k].reverse();y.prescoreIndex.components.reverse();y.prescoreIndex.contributions.reverse();y.financingReadiness.constraints.reverse();y.creditAssessment.drivers.reverse();y.creditAssessment.limitations.reverse();y.productSelection.candidates.reverse();y.recommendationSet.recommendations.reverse();y.actionPlan.items.reverse();return y;}
import {compose,bank} from '../debt-capacity/builders.mjs';
import {finish} from '../product-selection/builders.mjs';
import {buildProductSelection} from '../../../lib/credit-engine/product-selection/engine.ts';
import {buildRecommendations} from '../../../lib/credit-engine/recommendations/engine.ts';
// Complete reported period is independently supplied; healthy fixture must have
// no concentration finding rather than masking it by changing an Index scalar.
export function healthy({operating=Array(12).fill(1000000)}={}){const x=sourceScenario({values:{BANK_TOP1:.2,BANK_IDENTITY_COVERAGE:1,BANK_CONCENTRATION_COVERAGE:1},caseValues:{financingPurpose:'WORKING_CAPITAL',requestedProduct:'CREDIT_LINE',requestedAmount:1000000,requestedTermMonths:12,urgency:'WITHIN_30_DAYS'}});const f=x.riskAssessment.facts.find(f=>f.semanticCode==='BANK_TOP1');f.period={from:'2025-07-01',to:x.asOfDate,asOf:x.asOfDate};/* Canonical-consumer boundary: independently supplied complete risk confidence, not a claim about the Risk runner's empty-finding confidence. */ x.riskAssessment.summary.evidenceConfidence='HIGH';const up=finish({...compose(x),bankMetrics:bank({operating})});up.productSelection=buildProductSelection(up);up.recommendationSet=buildRecommendations(up);return complete(up);}
