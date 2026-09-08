import type { NormalizedTransaction } from "../../prescore.ts";
import type { DebtPaymentObservation } from "../contracts/credit-portfolio.ts";
import { finite, id, normalize, unique, validDate } from "./common.ts";
export function contractReferences(purpose: string): string[] {
  const matches = [...purpose.matchAll(/(?:договор\S*|контракт\S*|agreement|contract)\s*(?:№|N(?:o)?\.?|номер)?\s*([\p{L}\d][\p{L}\d/_.-]*)/giu)].map(m => normalize(m[1])).filter(v => !["от", "по", "за"].includes(v));
  return unique(matches);
}
export function buildDebtPaymentObservations(transactions: NormalizedTransaction[], companyInn: string): DebtPaymentObservation[] {
  const kinds: Record<string, DebtPaymentObservation["paymentKind"]> = { LOAN_PRINCIPAL_PAYMENT: "PRINCIPAL", INTEREST_PAYMENT: "INTEREST", DEBT_SERVICE_UNSPLIT: "UNSPLIT_DEBT_SERVICE", LEASING_PAYMENT: "LEASING", FACTORING_FEE: "FACTORING_FEE" };
  const output: DebtPaymentObservation[] = [];
  for (const tx of transactions) {
    const code = tx.classification?.primaryCategory, kind = code ? kinds[code] : undefined;
    if (!kind || tx.direction !== "out" || !finite(tx.amount) || tx.amount < 0 || !validDate(tx.date) || tx.duplicateStatus === "EXACT") continue;
    const transactionId = tx.canonicalTransactionId ?? tx.id;
    const sourceIds = tx.sourceId ? [tx.sourceId] : [];
    const c = tx.classification!.confidence;
    const e = { evidenceId: id("payment-evidence", companyInn, transactionId, code), sourceKind: "BANK_STATEMENT" as const, sourceId: tx.sourceId ?? null,
      transactionId, rawField: "classification.primaryCategory", rawValue: code, observedAt: tx.date, description: "Canonical classified transaction; no reclassification" };
    output.push({ observationId: id("debt-payment", companyInn, transactionId, code), companyInn, transactionId, sourceIds, date: tx.date, amount: tx.amount, paymentKind: kind,
      principalAmount: kind === "PRINCIPAL" ? tx.amount : null, interestAmount: kind === "INTEREST" ? tx.amount : null,
      creditorName: tx.counterparty || null, creditorInn: tx.counterpartyInn || null, purpose: tx.purpose, contractReferences: contractReferences(tx.purpose),
      classificationCode: code!, classificationConfidence: c, evidence: [e], warnings: kind === "UNSPLIT_DEBT_SERVICE" ? ["UNSPLIT_PAYMENT_PRINCIPAL_UNKNOWN"] : kind === "INTEREST" ? ["INTEREST_DOES_NOT_REDUCE_PRINCIPAL"] : kind === "LEASING" ? ["LEASING_DOES_NOT_REDUCE_LOAN_PRINCIPAL"] : [] });
  }
  return [...new Map(output.map(o => [o.observationId, o])).values()].sort((a, b) => a.date.localeCompare(b.date) || a.observationId.localeCompare(b.observationId));
}
