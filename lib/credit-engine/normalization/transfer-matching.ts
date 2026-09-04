import type { CanonicalTransaction, TransferPairConfidence } from "../contracts/transactions.ts";

function shiftedDate(value: string, days: number) {
  const date = new Date(`${value}T00:00:00Z`);
  date.setUTCDate(date.getUTCDate() + days);
  return date.toISOString().slice(0, 10);
}

function dayDistance(left: string, right: string) {
  return Math.abs(Date.parse(`${left}T00:00:00Z`) - Date.parse(`${right}T00:00:00Z`)) / 86_400_000;
}

function baseKey(item: CanonicalTransaction) {
  return `${item.amount}|${item.currency}|${item.companyInn}`;
}

function pushIndex(index: Map<string, CanonicalTransaction[]>, key: string, item: CanonicalTransaction) {
  const group = index.get(key) ?? [];
  group.push(item);
  index.set(key, group);
}

export function linkInternalTransfersAndReversals(items: CanonicalTransaction[]) {
  const ownIndex = new Map<string, CanonicalTransaction[]>();
  const reversalIndex = new Map<string, CanonicalTransaction[]>();
  let transferPairCount = 0;
  let possibleReversalCount = 0;

  for (const item of items) {
    if (item.amount === null || !item.date || item.direction === "UNKNOWN") continue;
    const opposite = item.direction === "IN" ? "OUT" : "IN";
    if (item.isOwnAccountTransfer && !item.transferPairId) {
      let pair: CanonicalTransaction | undefined;
      for (const offset of [0, -1, 1]) {
        pair = (ownIndex.get(`${baseKey(item)}|${opposite}|${shiftedDate(item.date, offset)}`) ?? []).find((candidate) =>
          !candidate.transferPairId && candidate.companyAccount !== item.companyAccount);
        if (pair) break;
      }
      if (pair) {
        const directAccountEvidence = Boolean(
          pair.companyAccount && item.companyAccount &&
          (pair.rawValues.payerAccount === item.rawValues.recipientAccount || pair.rawValues.recipientAccount === item.rawValues.payerAccount));
        const confidence: TransferPairConfidence = directAccountEvidence && dayDistance(pair.date!, item.date) === 0 ? "HIGH" : "MEDIUM";
        const pairId = `pair:${pair.transactionId}:${item.transactionId}`;
        pair.transferPairId = pairId;
        item.transferPairId = pairId;
        pair.transferPairConfidence = confidence;
        item.transferPairConfidence = confidence;
        transferPairCount += 1;
      }
      pushIndex(ownIndex, `${baseKey(item)}|${item.direction}|${item.date}`, item);
    }

    if (!item.isOwnAccountTransfer && item.counterparty.innNormalized) {
      const reversalBase = `${item.amount}|${item.currency}|${item.counterparty.innNormalized}`;
      let reversal: CanonicalTransaction | undefined;
      for (let offset = 0; offset <= 7 && !reversal; offset += 1) {
        const dates = offset === 0 ? [item.date] : [shiftedDate(item.date, -offset), shiftedDate(item.date, offset)];
        for (const date of dates) {
          reversal = (reversalIndex.get(`${reversalBase}|${opposite}|${date}`) ?? [])[0];
          if (reversal) break;
        }
      }
      if (reversal) {
        item.possibleReversalOfTransactionId = reversal.transactionId;
        possibleReversalCount += 1;
      }
      pushIndex(reversalIndex, `${reversalBase}|${item.direction}|${item.date}`, item);
    }
  }
  return { transferPairCount, possibleReversalCount };
}
