import {financialRules} from './financial.ts';
import {operatingRules} from './operating.ts';
import {debtRules} from './debt.ts';
import {dataRules} from './data.ts';
import {caseRules} from './case.ts';
export const CONTEXT_RULE_REGISTRY=[...financialRules,...operatingRules,...debtRules,...dataRules,...caseRules].sort((a,b)=>a.domain.localeCompare(b.domain)||a.code.localeCompare(b.code));
