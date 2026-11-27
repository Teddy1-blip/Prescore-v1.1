import type { CompanyProfileData } from "../company-profile.ts";
import type { AnalysisResult } from "../prescore.ts";
import { reconciliationForAnalysis } from "./reconciliation/integration.ts";
import { buildRiskShadow } from "./risk/integration.ts";
import { buildContextShadow } from "./context/integration.ts";
import { buildPrescoreIndexShadow } from "./index/integration.ts";
import { buildFinancingReadinessShadow } from "./readiness/integration.ts";
import { buildCreditAssessmentShadow } from "./credit-assessment/integration.ts";
import { buildDebtCapacityShadow } from "./debt-capacity/integration.ts";
import { buildProductSelectionShadow } from "./product-selection/integration.ts";
import { buildRecommendationShadow } from "./recommendations/integration.ts";
import { buildActionPlanShadow } from "./action-plan/integration.ts";
import { buildExplainabilityShadow } from "./explainability/integration.ts";
import type { RiskAssessmentV1 } from "./contracts/risk.ts";
import type { ContextAssessmentV1 } from "./contracts/context.ts";
import type { PrescoreIndexV1 } from "./contracts/index.ts";
import type { FinancingReadinessV1 } from "./contracts/readiness.ts";
import type { CreditAssessmentV1 } from "./contracts/credit-assessment.ts";
import type { DebtCapacityV1 } from "./contracts/debt-capacity.ts";
import type { ProductSelectionV1 } from "./contracts/product-selection.ts";
import type { RecommendationSetV1 } from "./contracts/recommendations.ts";
import type { ActionPlanV1 } from "./contracts/action-plan.ts";
import type { ExplainabilityV1 } from "./contracts/explainability.ts";

export type CreditEngineProfile = {
  version: "PRESCORE-CREDIT-PROFILE-1.0.0-SHADOW";
  mode: "SHADOW";
  status: "COMPLETE" | "PARTIAL" | "UNAVAILABLE";
  asOfDate: string;
  riskAssessmentV1?: RiskAssessmentV1;
  contextAssessmentV1?: ContextAssessmentV1;
  prescoreIndexV1?: PrescoreIndexV1;
  financingReadinessV1?: FinancingReadinessV1;
  creditAssessmentV1?: CreditAssessmentV1;
  debtCapacityV1?: DebtCapacityV1;
  productSelectionV1?: ProductSelectionV1;
  recommendationSetV1?: RecommendationSetV1;
  actionPlanV1?: ActionPlanV1;
  explainabilityV1?: ExplainabilityV1;
  warnings: string[];
};

function latestDate(...values: Array<string | null | undefined>) {
  return values.filter((value): value is string => Boolean(value) && /^\d{4}-\d{2}-\d{2}$/.test(value!)).sort().at(-1) ?? "";
}

export function composeCreditProfile(
  input: AnalysisResult,
  profile: CompanyProfileData,
  requestedAsOfDate?: string,
): CreditEngineProfile {
  const analysis: AnalysisResult = {
    ...input,
    ...reconciliationForAnalysis(input, profile),
  };
  const asOfDate = requestedAsOfDate && /^\d{4}-\d{2}-\d{2}$/.test(requestedAsOfDate)
    ? requestedAsOfDate
    : latestDate(analysis.periodTo, profile.fetchedAt?.slice(0, 10), analysis.creditHistory?.reportDate);
  const warnings: string[] = [];
  if (!asOfDate) warnings.push("CREDIT_PROFILE_AS_OF_DATE_MISSING");

  const risk = asOfDate
    ? buildRiskShadow({ analysis, companyProfile: profile, asOfDate })
    : { riskAssessmentV1: undefined, riskEngineWarnings: ["RISK_AS_OF_DATE_MISSING"] };
  const riskAssessmentV1 = risk.riskAssessmentV1;
  warnings.push(...(risk.riskEngineWarnings ?? []));

  const context = riskAssessmentV1 && asOfDate
    ? buildContextShadow({ analysis, companyProfile: profile, riskAssessment: riskAssessmentV1, asOfDate })
    : { contextAssessmentV1: undefined, contextEngineWarnings: ["CONTEXT_REQUIRES_RISK_ASSESSMENT"] };
  const contextAssessmentV1 = context.contextAssessmentV1;
  warnings.push(...context.contextEngineWarnings);

  const index = riskAssessmentV1 && contextAssessmentV1 && asOfDate
    ? buildPrescoreIndexShadow({ riskAssessment: riskAssessmentV1, contextAssessment: contextAssessmentV1, asOfDate })
    : { prescoreIndexV1: undefined, prescoreIndexWarnings: ["INDEX_REQUIRES_RISK_AND_CONTEXT"] };
  const prescoreIndexV1 = index.prescoreIndexV1;
  warnings.push(...index.prescoreIndexWarnings);

  const readiness = prescoreIndexV1 && riskAssessmentV1 && contextAssessmentV1 && asOfDate
    ? buildFinancingReadinessShadow({ riskAssessment: riskAssessmentV1, contextAssessment: contextAssessmentV1, prescoreIndex: prescoreIndexV1, asOfDate })
    : { financingReadinessV1: undefined, financingReadinessWarnings: ["READINESS_REQUIRES_INDEX"] };
  const financingReadinessV1 = readiness.financingReadinessV1;
  warnings.push(...readiness.financingReadinessWarnings);

  const creditAssessment = financingReadinessV1 && prescoreIndexV1 && riskAssessmentV1 && contextAssessmentV1 && asOfDate
    ? buildCreditAssessmentShadow({
      riskAssessment: riskAssessmentV1,
      contextAssessment: contextAssessmentV1,
      prescoreIndex: prescoreIndexV1,
      financingReadiness: financingReadinessV1,
      asOfDate,
    })
    : { creditAssessmentV1: undefined, creditAssessmentWarnings: ["CREDIT_ASSESSMENT_REQUIRES_READINESS"] };
  const creditAssessmentV1 = creditAssessment.creditAssessmentV1;
  warnings.push(...creditAssessment.creditAssessmentWarnings);

  const debtCapacity = creditAssessmentV1 && financingReadinessV1 && prescoreIndexV1 && riskAssessmentV1 && contextAssessmentV1 && analysis.metricsV2 && asOfDate
    ? buildDebtCapacityShadow({
      riskAssessment: riskAssessmentV1,
      contextAssessment: contextAssessmentV1,
      prescoreIndex: prescoreIndexV1,
      financingReadiness: financingReadinessV1,
      creditAssessment: creditAssessmentV1,
      bankMetrics: analysis.metricsV2,
      creditPortfolio: analysis.creditPortfolioV1,
      asOfDate,
    })
    : { debtCapacityV1: undefined, debtCapacityWarnings: [analysis.metricsV2 ? "DEBT_CAPACITY_REQUIRES_CREDIT_ASSESSMENT" : "DEBT_CAPACITY_BANK_METRICS_UNAVAILABLE"] };
  const debtCapacityV1 = debtCapacity.debtCapacityV1;
  warnings.push(...debtCapacity.debtCapacityWarnings);

  const productSelection = debtCapacityV1 && creditAssessmentV1 && financingReadinessV1 && prescoreIndexV1 && riskAssessmentV1 && contextAssessmentV1 && asOfDate
    ? buildProductSelectionShadow({
      riskAssessment: riskAssessmentV1,
      contextAssessment: contextAssessmentV1,
      prescoreIndex: prescoreIndexV1,
      financingReadiness: financingReadinessV1,
      creditAssessment: creditAssessmentV1,
      debtCapacity: debtCapacityV1,
      creditPortfolio: analysis.creditPortfolioV1,
      asOfDate,
    })
    : { productSelectionV1: undefined, productSelectionWarnings: ["PRODUCT_SELECTION_REQUIRES_DEBT_CAPACITY"] };
  const productSelectionV1 = productSelection.productSelectionV1;
  warnings.push(...productSelection.productSelectionWarnings);

  const recommendations = productSelectionV1 && debtCapacityV1 && creditAssessmentV1 && financingReadinessV1 && prescoreIndexV1 && riskAssessmentV1 && contextAssessmentV1 && asOfDate
    ? buildRecommendationShadow({
      riskAssessment: riskAssessmentV1,
      contextAssessment: contextAssessmentV1,
      prescoreIndex: prescoreIndexV1,
      financingReadiness: financingReadinessV1,
      creditAssessment: creditAssessmentV1,
      debtCapacity: debtCapacityV1,
      productSelection: productSelectionV1,
      creditPortfolio: analysis.creditPortfolioV1,
      asOfDate,
    })
    : { recommendationSetV1: undefined, recommendationWarnings: ["RECOMMENDATIONS_REQUIRE_PRODUCT_SELECTION"] };
  const recommendationSetV1 = recommendations.recommendationSetV1;
  warnings.push(...recommendations.recommendationWarnings);

  const actionPlan = recommendationSetV1 && productSelectionV1 && debtCapacityV1 && creditAssessmentV1 && financingReadinessV1 && prescoreIndexV1 && riskAssessmentV1 && contextAssessmentV1 && asOfDate
    ? buildActionPlanShadow({
      riskAssessment: riskAssessmentV1,
      contextAssessment: contextAssessmentV1,
      prescoreIndex: prescoreIndexV1,
      financingReadiness: financingReadinessV1,
      creditAssessment: creditAssessmentV1,
      debtCapacity: debtCapacityV1,
      productSelection: productSelectionV1,
      recommendationSet: recommendationSetV1,
      creditPortfolio: analysis.creditPortfolioV1,
      asOfDate,
    })
    : { actionPlanV1: undefined, actionPlanWarnings: ["ACTION_PLAN_REQUIRES_RECOMMENDATIONS"] };
  const actionPlanV1 = actionPlan.actionPlanV1;
  warnings.push(...actionPlan.actionPlanWarnings);

  const explainability = actionPlanV1 && recommendationSetV1 && productSelectionV1 && debtCapacityV1 && creditAssessmentV1 && financingReadinessV1 && prescoreIndexV1 && riskAssessmentV1 && contextAssessmentV1 && asOfDate
    ? buildExplainabilityShadow({
      riskAssessment: riskAssessmentV1,
      contextAssessment: contextAssessmentV1,
      prescoreIndex: prescoreIndexV1,
      financingReadiness: financingReadinessV1,
      creditAssessment: creditAssessmentV1,
      debtCapacity: debtCapacityV1,
      productSelection: productSelectionV1,
      recommendationSet: recommendationSetV1,
      actionPlan: actionPlanV1,
      creditPortfolio: analysis.creditPortfolioV1,
      asOfDate,
    })
    : { explainabilityV1: undefined, explainabilityWarnings: ["EXPLAINABILITY_REQUIRES_ACTION_PLAN"] };
  warnings.push(...explainability.explainabilityWarnings);

  const outputs = [
    riskAssessmentV1, contextAssessmentV1, prescoreIndexV1, financingReadinessV1, creditAssessmentV1,
    debtCapacityV1, productSelectionV1, recommendationSetV1, actionPlanV1, explainability.explainabilityV1,
  ];
  return {
    version: "PRESCORE-CREDIT-PROFILE-1.0.0-SHADOW",
    mode: "SHADOW",
    status: !outputs.some((item) => !item) && warnings.length === 0 ? "COMPLETE" : outputs.some(Boolean) ? "PARTIAL" : "UNAVAILABLE",
    asOfDate,
    riskAssessmentV1,
    contextAssessmentV1,
    prescoreIndexV1,
    financingReadinessV1,
    creditAssessmentV1,
    debtCapacityV1,
    productSelectionV1,
    recommendationSetV1,
    actionPlanV1,
    explainabilityV1: explainability.explainabilityV1,
    warnings: [...new Set(warnings)],
  };
}
