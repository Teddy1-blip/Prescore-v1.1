export type FundingKind = "bank" | "mfo" | "factoring" | "seller" | "leasing" | "secured-personal";
export type FinancingNeed = "auto" | "working-capital" | "staged-limit" | "cash-gap" | "receivables" | "government-contract" | "marketplace" | "equipment" | "refinance" | "secured";

export const fundingKindLabels: Record<FundingKind, string> = {
  bank: "Банки", mfo: "МФО и краудлендинг", factoring: "Факторинг", seller: "Селлеры", leasing: "Лизинг", "secured-personal": "Залог физлица",
};

export const financingNeedLabels: Record<FinancingNeed, string> = {
  auto: "Автоподбор", "working-capital": "Оборотные средства", "staged-limit": "Лимит частями", "cash-gap": "Кассовый разрыв", receivables: "Дебиторка", "government-contract": "Госконтракт", marketplace: "Маркетплейс", equipment: "Авто и оборудование", refinance: "Рефинансирование", secured: "Есть залог",
};
