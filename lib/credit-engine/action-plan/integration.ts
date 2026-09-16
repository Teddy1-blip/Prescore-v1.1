import type {ActionPlanInputV1,ActionPlanShadowFields} from '../contracts/action-plan.ts';
import {buildActionPlan} from './engine.ts';
export function buildActionPlanShadow(input:ActionPlanInputV1,entitlement:'FREE'|'FULL'='FULL'):ActionPlanShadowFields{if(entitlement==='FREE')return {actionPlanWarnings:[]};try{return {actionPlanV1:buildActionPlan(input),actionPlanWarnings:[]};}catch{return {actionPlanWarnings:['ACTION_PLAN_SHADOW_UNAVAILABLE']};}}
