import {RISK_RULE_REGISTRY} from '../risk/rules/registry.ts';
import {INDEX_COMPONENTS} from '../contracts/index.ts';
import {PRODUCT_SELECTION_POLICY} from '../product-selection/policy.ts';
import {ACTION_PLAN_POLICY} from '../action-plan/policy.ts';
import type {ExplainabilityCoverageReportV1} from '../contracts/explainability.ts';
import {EXPLANATION_TEMPLATE_REGISTRY,CATEGORY_COPY} from './templates.ts';
export function auditExplainabilityCoverage(r=EXPLANATION_TEMPLATE_REGISTRY):ExplainabilityCoverageReportV1{const codes=new Set(r.templates.map(t=>t.code));const required=[...RISK_RULE_REGISTRY.map(r=>r.code),...Object.entries(CATEGORY_COPY).flatMap(([g,vs])=>Object.keys(vs).map(k=>g+':'+k))];return {riskRuleCount:RISK_RULE_REGISTRY.length,riskRulesExplained:RISK_RULE_REGISTRY.map(r=>r.code).filter(c=>codes.has(c)).sort(),indexComponentsExplained:INDEX_COMPONENTS.filter(c=>codes.has('INDEX:'+c)),productFamiliesExplained:PRODUCT_SELECTION_POLICY.supportedProducts.filter(c=>codes.has('PRODUCT:'+c)),rerunTriggerTypesExplained:ACTION_PLAN_POLICY.rerunTriggerOrder.filter(c=>codes.has('RERUN:'+c)),unmappedCodes:required.filter(c=>!codes.has(c)).sort(),templateCount:r.templates.length};}
