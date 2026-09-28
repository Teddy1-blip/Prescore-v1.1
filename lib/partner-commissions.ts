import { financingOffers, fundingKindLabels, productTermsDate } from "./financing-offers.ts";

export type PartnerCommission = {
  id: string;
  bank: string;
  product: string;
  kind: string;
  rate: number;
  cap?: number;
  rateLabel: string;
  rateAvailable: boolean;
};

export const subscriptionPrice = 6_500;
export const referralShare = 0.3;
export const recurringReferralPayment = subscriptionPrice * referralShare;
export const curatorShare = 0.1;
export const recurringCuratorPayment = subscriptionPrice * curatorShare;
export const commissionTermsDate = productTermsDate;

export const partnerCommissions: PartnerCommission[] = financingOffers.map((offer) => ({
  id: offer.id,
  bank: offer.provider,
  product: offer.products.join(" / "),
  kind: fundingKindLabels[offer.kind],
  rate: offer.commissionRate ?? 0,
  cap: offer.commissionCap,
  rateLabel: offer.commissionLabel,
  rateAvailable: offer.commissionRate != null,
}));

const publishedCommissionRates = partnerCommissions.filter((item) => item.rateAvailable && item.rate > 0).map((item) => item.rate);

export const averagePartnerCommissionRate = publishedCommissionRates.length
  ? publishedCommissionRates.reduce((sum, rate) => sum + rate, 0) / publishedCommissionRates.length
  : 0;

export function calculateAveragePartnerForecast(amount: number) {
  if (!Number.isFinite(amount)) return 0;
  return Math.max(0, amount) * averagePartnerCommissionRate;
}

export function calculatePotentialCommission(amount: number, rate: number, cap?: number) {
  if (!Number.isFinite(amount) || !Number.isFinite(rate)) return 0;
  const result = Math.max(0, amount) * Math.max(0, rate);
  return cap == null ? result : Math.min(result, Math.max(0, cap));
}
