import type { RiskFact, RiskShadowInput } from "../contracts/risk.ts";
import { bankFacts } from "./adapters/bank.ts";
import { financialFacts } from "./adapters/financial.ts";
import { legalFacts } from "./adapters/legal.ts";
import { bkiFacts } from "./adapters/bki.ts";
import { portfolioFacts } from "./adapters/portfolio.ts";
import { reconciliationFacts } from "./adapters/reconciliation.ts";
import { integrityFacts } from "./adapters/integrity.ts";
export function adaptRiskFacts(input: RiskShadowInput): RiskFact[] {
  const financial = financialFacts(input);
  return [...bankFacts(input), ...financial, ...legalFacts(input, financial), ...bkiFacts(input), ...portfolioFacts(input), ...reconciliationFacts(input), ...integrityFacts(input), ...(input.extraFacts ?? [])];
}
