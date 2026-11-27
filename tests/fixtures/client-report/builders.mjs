import {healthy,baseline,scenario,defect,complete,reorder} from '../explainability/builders.mjs';
import {buildExplainability} from '../../../lib/credit-engine/explainability/engine.ts';
import {consumer} from '../action-plan/builders.mjs';
export {healthy,baseline,scenario,defect,complete,reorder,consumer};
export function presentationInput(x){return {explainability:buildExplainability(x),actionPlan:x.actionPlan,recommendationSet:x.recommendationSet,productSelection:x.productSelection,debtCapacity:x.debtCapacity,creditAssessment:x.creditAssessment,financingReadiness:x.financingReadiness,prescoreIndex:x.prescoreIndex,asOfDate:x.asOfDate,company:{name:'ООО «Пример промышленной компании»',inn:x.creditAssessment.companyInn}};}
