import {DEBT_CAPACITY_POLICY_VERSION,type DebtCapacityPolicyV1} from '../contracts/debt-capacity.ts';
import {freeze,id,stable} from '../credit-assessment/common.ts';
export const DEBT_CAPACITY_POLICY:DebtCapacityPolicyV1=freeze({version:DEBT_CAPACITY_POLICY_VERSION,minimumFullMonthsForNumericCapacity:6,preferredFullMonths:12,recentMonths:3,prudentialTotalDebtServiceRatio:.20,maximumTotalDebtServiceRatio:.25,nearTermDays:30,eligiblePortfolioExposureClasses:['FUNDED_DEBT','LEASE'],scenarioAmortization:'ANNUITY',minimumEvidenceConfidence:'MEDIUM',rounding:'FLOOR_RUB_CENTS',monthsPerYear:12});
export const DEBT_CAPACITY_POLICY_FINGERPRINT=id('debt-capacity-policy',DEBT_CAPACITY_POLICY);
export function validateCapacityPolicy(p:DebtCapacityPolicyV1){if(stable(p)!==stable(DEBT_CAPACITY_POLICY))throw Error('DEBT_CAPACITY_INPUT_INVALID:POLICY');}
