import type {DebtCapacityInputV1,DebtCapacityV1,DebtCapacityShadowFields} from '../contracts/debt-capacity.ts';
import {buildDebtCapacity} from './engine.ts';
export function buildDebtCapacityShadow(x:DebtCapacityInputV1,builder:(x:DebtCapacityInputV1)=>DebtCapacityV1=buildDebtCapacity):DebtCapacityShadowFields{try{return {debtCapacityV1:builder(x),debtCapacityWarnings:[]};}catch(e){return {debtCapacityWarnings:['DEBT_CAPACITY_SHADOW_UNAVAILABLE',...(e instanceof Error&&e.message.startsWith('DEBT_CAPACITY_INPUT_INVALID:')?[e.message]:[])]};}}
