import type { AnalysisResult, NormalizedTransaction } from "../../prescore.ts";
import type { CreditPortfolioShadowFields, PortfolioInput } from "../contracts/credit-portfolio.ts";
import { adaptUploadedBki } from "./bki-adapter.ts";
import { buildCreditPortfolio } from "./resolver.ts";
import { buildDebtPaymentObservations } from "./payment-observations.ts";
import { validDate } from "./common.ts";
export function buildCreditPortfolioShadow(input: PortfolioInput): CreditPortfolioShadowFields {
  try { return { creditPortfolioV1: buildCreditPortfolio(input), creditPortfolioWarnings: [] }; }
  catch { return { creditPortfolioV1: undefined, creditPortfolioWarnings: ["CREDIT_PORTFOLIO_SHADOW_UNAVAILABLE"] }; }
}
export function portfolioForAnalysis(analysis: AnalysisResult, options: { completeTransactions?: NormalizedTransaction[]; asOfDate: string }): CreditPortfolioShadowFields {
  try {
    const payments = options.completeTransactions !== undefined ? buildDebtPaymentObservations(options.completeTransactions, analysis.companyInn) : analysis.debtPaymentObservationsV1;
    const source = analysis.sourceManifest?.bki;
    const snapshot = analysis.creditHistory && source ? adaptUploadedBki(analysis.creditHistory, { companyInn: analysis.companyInn, source }) : undefined;
    if (!validDate(options.asOfDate)) throw Error("AS_OF_REQUIRED");
    const result = buildCreditPortfolioShadow({ companyInn: analysis.companyInn, asOfDate: options.asOfDate, previousPortfolio: analysis.creditPortfolioV1,
      creditHistorySnapshots: snapshot ? [snapshot] : [], paymentObservations: payments });
    return { ...result, debtPaymentObservationsV1: payments, creditPortfolioWarnings: [...(result.creditPortfolioWarnings ?? []), ...(payments === undefined ? ["PAYMENT_OBSERVATIONS_UNAVAILABLE"] : [])] };
  } catch { return { creditPortfolioV1: undefined, creditPortfolioWarnings: ["CREDIT_PORTFOLIO_SHADOW_UNAVAILABLE"] }; }
}
