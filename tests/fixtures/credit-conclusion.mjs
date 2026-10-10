// Existing canonical business corpus; no hand-written result values or live data.
import {loadBusiness} from '../../lib/credit-engine/credit-lab/business-corpus.mjs';
import {buildCanonicalCreditAnalysis} from '../../lib/credit-engine/production/orchestrator.ts';
import {publicCanonicalModel} from '../../lib/credit-engine/production/public-model.ts';
import {projectWorkspaceBasic,WORKSPACE_MODEL_V1} from '../../lib/workspace/model.ts';
export function conclusionFixture(caseId='CL-RU-BUS-019'){
 const input=loadBusiness(caseId).input,c=buildCanonicalCreditAnalysis(input);
 const model={version:WORKSPACE_MODEL_V1,state:'READY_FULL',analysisId:c.analysisId,access:{role:'OWNER',readOnly:false},entitlement:'FULL',fullAvailability:'READY',basic:projectWorkspaceBasic(input.analysis),full:{report:publicCanonicalModel(c.model,c),canonical:{prescoreIndex:c.prescoreIndex,financingReadiness:c.financingReadiness,creditAssessment:c.creditAssessment,debtCapacity:c.debtCapacity,productSelection:c.productSelection,recommendations:c.recommendationSet,actionPlan:c.actionPlan,explainability:c.explainability,expertise:null}}};
 return {input,canonical:c,model};
}
