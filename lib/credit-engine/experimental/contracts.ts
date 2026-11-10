import type { RiskRule } from '../contracts/risk.ts';
import type { RecommendationRegistryV1 } from '../contracts/recommendations.ts';

// Only the internal Studio compiler constructs these per-request dependencies.
// Callers of the normal report service never supply them.
export type CurrentRatioExpression = Readonly<{
  expression: string;
  fields: string[];
  evaluate: (values: number[]) => number;
}>;
export type ExperimentalMethodology = Readonly<{
  currentRatio?: CurrentRatioExpression;
  riskRules?: RiskRule[];
  recommendationRegistry?: RecommendationRegistryV1;
}>;
