import type {ReadinessInputV1,ReadinessShadowFields,FinancingReadinessV1} from '../contracts/readiness.ts';
import {buildFinancingReadiness} from './engine.ts';
export function buildFinancingReadinessShadow(input:ReadinessInputV1,builder:(input:ReadinessInputV1)=>FinancingReadinessV1=buildFinancingReadiness):ReadinessShadowFields{try{return {financingReadinessV1:builder(input),financingReadinessWarnings:[]};}catch(e){return {financingReadinessWarnings:['FINANCING_READINESS_SHADOW_UNAVAILABLE',...(e instanceof Error&&e.message.startsWith('READINESS_INPUT_INVALID:')?[e.message]:[])]};}}
