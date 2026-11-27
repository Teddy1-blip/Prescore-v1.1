import type { CanonicalDirection, DirectionEvidence, DirectionEvidenceRule } from "../contracts/transactions.ts";

type DirectionInput = {
  postingSide?: "IN" | "OUT";
  companyInn: string | null;
  companyAccounts: Set<string>;
  payerInn: string | null;
  recipientInn: string | null;
  payerAccount: string | null;
  recipientAccount: string | null;
};

const PRIORITY: DirectionEvidenceRule[] = [
  "COMPANY_PAYER_ACCOUNT",
  "COMPANY_RECIPIENT_ACCOUNT",
  "COMPANY_PAYER_INN",
  "COMPANY_RECIPIENT_INN",
];

export function determineDirection(input: DirectionInput): { direction: CanonicalDirection; evidence: DirectionEvidence; warnings: string[] } {
  const candidates: DirectionEvidence["candidates"] = [];
  const add = (direction: CanonicalDirection, rule: DirectionEvidenceRule, condition: boolean) => {
    if (condition) candidates.push({ direction, rule });
  };
  add("OUT", "COMPANY_PAYER_ACCOUNT", Boolean(input.payerAccount && input.companyAccounts.has(input.payerAccount)));
  add("IN", "COMPANY_RECIPIENT_ACCOUNT", Boolean(input.recipientAccount && input.companyAccounts.has(input.recipientAccount)));
  add("OUT", "COMPANY_PAYER_INN", Boolean(input.companyInn && input.payerInn === input.companyInn));
  add("IN", "COMPANY_RECIPIENT_INN", Boolean(input.companyInn && input.recipientInn === input.companyInn));
  candidates.sort((a, b) => PRIORITY.indexOf(a.rule) - PRIORITY.indexOf(b.rule));
  // Both sides belong to this statement. A single bank posting date identifies
  // the ledger leg even when a transfer uses the same document number twice.
  if (input.postingSide && input.payerAccount && input.recipientAccount &&
      input.companyAccounts.has(input.payerAccount) && input.companyAccounts.has(input.recipientAccount)) {
    candidates.unshift({direction: input.postingSide, rule: "OWN_TRANSFER_POSTING_SIDE"});
    return {direction: input.postingSide, evidence: {selectedRule: "OWN_TRANSFER_POSTING_SIDE", candidates, conflict: false}, warnings: []};
  }
  const selected = candidates[0];
  const conflict = new Set(candidates.map((item) => item.direction)).size > 1;
  const direction = selected?.direction ?? "UNKNOWN";
  return {
    direction,
    evidence: {
      selectedRule: selected?.rule ?? "NOT_DETERMINED",
      candidates,
      conflict,
    },
    warnings: [...(conflict ? ["DIRECTION_EVIDENCE_CONFLICT"] : []), ...(direction === "UNKNOWN" ? ["DIRECTION_UNKNOWN"] : [])],
  };
}
