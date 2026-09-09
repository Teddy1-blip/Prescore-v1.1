import { legalRules } from "./legal.ts";
import { financialRules } from "./financial.ts";
import { cashFlowRules } from "./cash-flow.ts";
import { creditHistoryRules } from "./credit-history.ts";
import { dataRules } from "./data.ts";
export const RISK_RULE_REGISTRY = [...legalRules, ...financialRules, ...cashFlowRules, ...creditHistoryRules, ...dataRules];
