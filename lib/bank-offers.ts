import type { AnalysisResult } from "./prescore.ts";
import type { CompanyProfileData, FinancialAssessment } from "./company-profile.ts";
import { buildFinancialAssessment } from "./company-profile.ts";
import type { FinancingNeed, FundingKind } from "./financing-offers.ts";
import {
  financingNeedLabels, financingOffers, fundingKindLabels,
  needProductMap, offerSupportsNeed, productTermsDate,
} from "./financing-offers.ts";

export type BankRouteStatus = "go" | "conditional" | "stop";

export type BankRoute = {
  id: string;
  bank: string;
  kind: FundingKind;
  kindLabel: string;
  status: BankRouteStatus;
  statusLabel: string;
  products: string[];
  amount: number;
  minLimit?: number;
  maxLimit?: number;
  limitLabel: string;
  term: string;
  rate: string;
  geography: string;
  comment: string;
  needMatch: boolean;
  matchedNeeds: FinancingNeed[];
  reasons: string[];
  actions: string[];
  recommendedProduct: string;
  existingRelationship: boolean;
  activityReason: string;
};

const M = 1_000_000;
const marketplacePattern = /(wildberries|вайлдберриз|wb\b|ozon|озон|яндекс\s*маркет|yandex\s*market|мегамаркет|mega\s*market|ламода|lamoda|marketplace|маркетплейс)/i;
const governmentPattern = /(фку|фгбу|гбу|мку|муп|гуп|казначейств|министерств|департамент|администраци|государственн|муниципальн|44[‑-]?фз|223[‑-]?фз|госконтракт)/i;
const assetIntensivePattern = /(строител|подряд|монтаж|производств|промышлен|транспорт|логист|грузоперевоз|сельск|фермер|добыч|карьер|медицин|клиник|склад|дорожн|инженер)/i;

function monthsSince(value: string) {
  if (!value) return null;
  const start = new Date(`${value}T00:00:00`);
  if (Number.isNaN(start.getTime())) return null;
  const now = new Date();
  return Math.max(0, (now.getFullYear() - start.getFullYear()) * 12 + now.getMonth() - start.getMonth());
}

function excludedSouth(region: string, includeCrimea = false) {
  const value = region.toLowerCase();
  const south = /(дагестан|ингуш|чечен|кабардино|карачаево|северная осетия)/.test(value);
  return south || (includeCrimea && /(крым|севастопол)/.test(value));
}

function isMoscow(region: string) {
  return /(москв|московск)/i.test(region);
}

function normalizeProvider(value: string) {
  return value.toLowerCase().replace(/ё/g, "е").replace(/[^a-zа-я0-9]/g, "");
}

export function detectMarketplaceFlow(analysis: Omit<AnalysisResult, "transactions"> & { transactions?: AnalysisResult["transactions"] }) {
  const counterparties = analysis.topCounterparties.map((item) => item.name);
  const transactionText = (analysis.transactions ?? []).flatMap((item) => [item.counterparty, item.purpose]);
  return [...counterparties, ...transactionText].some((value) => marketplacePattern.test(value));
}

export function detectLeasingNeed(analysis: Omit<AnalysisResult, "transactions"> & { transactions?: AnalysisResult["transactions"] }) {
  return (analysis.transactions ?? []).some((item) =>
    item.category === "leasing" || /(автомобил|автотранспорт|оборудован|станок|спецтехник|лизинг)/i.test(item.purpose),
  );
}

export function detectGovernmentFlow(analysis: Omit<AnalysisResult, "transactions"> & { transactions?: AnalysisResult["transactions"] }) {
  const counterparties = analysis.topCounterparties.map((item) => item.name);
  const transactionText = (analysis.transactions ?? []).flatMap((item) => [item.counterparty, item.purpose]);
  return [...counterparties, ...transactionText].some((value) => governmentPattern.test(value));
}

export function detectAssetIntensiveActivity(profile: CompanyProfileData | null) {
  if (!profile) return false;
  return assetIntensivePattern.test(`${profile.company.okvedCode} ${profile.company.okved}`);
}

function inferNeeds(analysis: Omit<AnalysisResult, "transactions"> & { transactions?: AnalysisResult["transactions"] }, profile: CompanyProfileData | null) {
  const needs = new Set<FinancingNeed>(["working-capital"]);
  const marketplace = detectMarketplaceFlow(analysis);
  const leasing = detectLeasingNeed(analysis) || detectAssetIntensiveActivity(profile);
  const hasContracts = Boolean(profile?.contracts?.activeCount) || detectGovernmentFlow(analysis);
  const receivablesShare = profile?.finances.assets ? profile.finances.receivables / profile.finances.assets : 0;
  if ((analysis.metrics.liquidityDays ?? 999) < 20) needs.add("cash-gap");
  if (analysis.metrics.volatility <= .75) needs.add("staged-limit");
  if (analysis.metrics.topOneConcentration >= .3 || receivablesShare >= .25) needs.add("receivables");
  if (hasContracts) needs.add("government-contract");
  if (marketplace) needs.add("marketplace");
  if (leasing) needs.add("equipment");
  if (analysis.metrics.debtServiceShare >= .2 || (analysis.creditHistory?.summary.outstandingPrincipal ?? 0) > 0) needs.add("refinance");
  if (analysis.factors.some((item) => item.severity === "critical") || (profile?.finances.equity ?? 1) <= 0) needs.add("secured");
  return [...needs];
}

function offerNeedMatches(products: string[], kind: FundingKind, needs: FinancingNeed[]) {
  if (kind === "factoring") return needs.includes("receivables");
  if (kind === "seller") return needs.includes("marketplace");
  if (kind === "leasing") return needs.includes("equipment");
  if (kind === "secured-personal") return needs.includes("secured");
  return needs.some((need) => need !== "auto" && needProductMap[need].some((expected) => products.some((product) => product.includes(expected) || expected.includes(product))));
}

export function evaluateBankRoutes(
  analysis: Omit<AnalysisResult, "transactions"> & { transactions?: AnalysisResult["transactions"] },
  profile: CompanyProfileData | null,
  selectedNeed: FinancingNeed = "auto",
) {
  const assessment: FinancialAssessment | null = profile ? buildFinancialAssessment(profile, analysis.score) : null;
  const age = profile ? monthsSince(profile.company.registrationDate) : null;
  const region = profile?.company.region || "";
  const bCritical = analysis.factors.filter((item) => item.severity === "critical");
  const fCritical = assessment?.factors.filter((item) => item.severity === "critical") ?? [];
  const requested = Math.max(0, analysis.creditPortfolioComparison?.adjustedLimitMax ?? analysis.metrics.estimatedLimitMax);
  const inferredNeeds = inferNeeds(analysis, profile);
  const activeNeeds = selectedNeed === "auto" ? inferredNeeds : [selectedNeed];
  const marketplaceDetected = inferredNeeds.includes("marketplace");
  const contractDetected = inferredNeeds.includes("government-contract");
  const receivablesDetected = inferredNeeds.includes("receivables");
  const leasingDetected = inferredNeeds.includes("equipment");
  const servicingBanks = [...new Set((analysis.bankNames ?? []).filter((name) => name && name !== "Банк не определён"))];

  const assessedRoutes = financingOffers.map((offer): BankRoute => {
    let status: BankRouteStatus = "go";
    const reasons: string[] = [];
    const actions: string[] = [];
    const matchedNeeds = activeNeeds.filter((need) => offerSupportsNeed(offer, need));
    const needMatch = selectedNeed === "auto"
      ? offerNeedMatches(offer.products, offer.kind, activeNeeds)
      : offerSupportsNeed(offer, selectedNeed);
    const stop = (reason: string, action?: string) => { status = "stop"; reasons.push(reason); if (action) actions.push(action); };
    const conditional = (reason: string, action?: string) => { if (status !== "stop") status = "conditional"; reasons.push(reason); if (action) actions.push(action); };

    if (!needMatch) conditional(`Маршрут не первый по выбранной задаче «${financingNeedLabels[selectedNeed === "auto" ? activeNeeds[0] : selectedNeed]}»`, "Выбрать цель финансирования, если этот инструмент действительно нужен");

    if (offer.subject === "ip-only" && analysis.companyInn.length !== 12) stop("Программа указана только для ИП", "Выбрать предложение для юридического лица");
    if (offer.subject === "individual") conditional("Это обязательство физического лица, а не корпоративный кредит", "Рассматривать только после отдельного решения, проверки и согласия собственника");

    if (age == null && offer.minAgeMonths > 0) conditional("Стаж компании не подтверждён", "Проверить дату регистрации");
    else if (age != null && age < offer.minAgeMonths) stop(`Стаж ${age} мес., требуется от ${offer.minAgeMonths} мес.`, "Выбрать маршрут с подходящим минимальным стажем");
    else if (offer.minAgeMonths > 0 && age != null) reasons.push(`Стаж ${age} мес. проходит порог от ${offer.minAgeMonths} мес.`);

    if (offer.geography === "moscow" && region && !isMoscow(region)) stop("Регион не входит в заявленную географию", "Выбрать федеральный маршрут");
    else if (offer.geography === "exclude-south" && region && excludedSouth(region)) stop("Регион входит в исключения программы", "Проверить другой федеральный или региональный маршрут");
    else if (offer.geography === "exclude-south-crimea" && region && excludedSouth(region, true)) stop("Регион входит в исключения программы", "Проверить другой федеральный или региональный маршрут");
    else if (["limited", "regions", "cities-250"].includes(offer.geography)) conditional("География требует подтверждения по конкретному региону", "Уточнить доступность до передачи документов");
    else if (region) reasons.push("Региональный фильтр предварительно пройден");

    if (offer.minLimit && requested && requested < offer.minLimit) stop(`Расчётный диапазон ниже минимальной суммы ${offer.limitLabel}`, "Выбрать предложение без минимального порога");
    if (offer.maxLimit && requested > offer.maxLimit) conditional(`Запрос выше максимума программы; ориентир ограничен ${offer.limitLabel}`, "Снизить сумму, разделить потребность или выбрать более крупный маршрут");
    if (!requested && !["factoring", "leasing", "secured-personal"].includes(offer.kind)) conditional("Долговая ёмкость пока не рассчитана", "Добавить полный банковский поток и БКИ");

    const secured = Boolean(offer.collateral);
    if (secured) conditional(offer.collateral === "over-30m" && requested <= 30 * M ? "Залог нужен только при сумме свыше 30 млн ₽" : "Предложение требует залога", "Подтвердить собственника, оценку, ликвидность и отсутствие обременений");

    if (bCritical.length) {
      if (offer.kind === "bank" && !secured) stop(`Банковский поток содержит критических факторов: ${bCritical.length}`, "Сначала выполнить план подготовки");
      else conditional("Критические сигналы потока не исчезают в альтернативном продукте", "Проверить экономику сделки и источник погашения");
    } else if (analysis.score < 520 && offer.kind === "bank" && !secured) stop(`B‑Score ${analysis.score}: массовая необеспеченная подача преждевременна`, "Сначала выполнить план 7/30/60");
    else if (analysis.score < 620) conditional(`B‑Score ${analysis.score}: потребуется индивидуальное рассмотрение`, "Подготовить пояснения и доказательства по ключевым сигналам");
    else reasons.push(`B‑Score ${analysis.score} поддерживает предварительное рассмотрение`);

    if (!assessment || assessment.fScore == null) conditional("F‑Score не рассчитан полностью", "Добавить официальную или читаемую квартальную отчётность");
    else if (fCritical.length) {
      if (offer.kind === "bank" && !secured) stop(`БФО и правовой контур содержат критические факторы: ${fCritical.length}`, "Не направлять необеспеченную заявку до проверки стопов");
      else conditional("Финансовые или правовые стопы требуют отдельной проверки", "Подготовить расшифровки и подтверждающие документы");
    } else if (assessment.fScore < 180) conditional(`F‑Score ${assessment.fScore} из 400 требует усиления`, "Проверить ликвидность, капитал, прибыльность и структуру дебиторки");
    else reasons.push(`F‑Score ${assessment.fScore} из 400 без критических стопов`);

    if (["STOP", "HIGH_RISK"].includes(analysis.quarterlyReport?.verdictCode ?? "")) {
      if (offer.kind === "bank" && !secured) stop(`Квартальная Q‑оценка: ${analysis.quarterlyReport?.verdict}`, "Не направлять текущий комплект; показатели не изменяются ради заявки");
      else conditional(`Квартальная Q‑оценка: ${analysis.quarterlyReport?.verdict}`, "Проверить корректность формы и экономику альтернативного продукта");
    } else if (analysis.quarterlyReport?.verdictCode === "REVIEW") conditional(`Квартальная Q‑оценка: ${analysis.quarterlyReport.verdict}`, "Приложить расшифровки промежуточного баланса");

    if (offer.kind === "mfo") conditional("МФО/краудлендинг — резервный, обычно более дорогой маршрут", "Сопоставить полную стоимость со сроком денег и маржой сделки");
    if (offer.kind === "seller") {
      if (marketplaceDetected || selectedNeed === "marketplace") reasons.push("В поступлениях/выбранной цели есть контур маркетплейса");
      else conditional("В данных не обнаружен подтверждённый поток маркетплейса", "Добавить отчёт площадки, остатки, возвраты и динамику продаж");
    }
    if (offer.kind === "factoring") {
      if (receivablesDetected || selectedNeed === "receivables") reasons.push("Дебиторка или концентрация покупателей поддерживает проверку факторинга");
      actions.push("Подготовить договор, УПД/акты, реестр дебиторки, сроки отсрочки и проверить запрет уступки");
    }
    if (offer.kind === "leasing") {
      if (detectLeasingNeed(analysis)) reasons.push("В выписках обнаружены лизинговые платежи или расчёты за транспорт/оборудование");
      else if (detectAssetIntensiveActivity(profile)) reasons.push(`Вид деятельности «${profile?.company.okved || "капиталоёмкая отрасль"}» предполагает потребность в технике или оборудовании`);
      conditional("Лизинг подходит только под конкретный ликвидный предмет", "Указать предмет, стоимость, аванс, продавца и срок эксплуатации");
    }
    if (contractDetected && offer.products.includes("КИК")) reasons.push(profile?.contracts?.activeCount ? `Официальные реестры показывают активные госконтракты: ${profile.contracts.activeCount} на ${Math.round((profile.contracts.activeAmount ?? 0) / M)} млн ₽` : "В банковском потоке обнаружены государственные или муниципальные заказчики");
    if (selectedNeed === "government-contract" && !offer.products.includes("КИК")) conditional("Продукт не является первым маршрутом для исполнения госконтракта", "Проверить КИК и документы закупки");
    if (selectedNeed === "refinance" && !offer.products.includes("Рефинансирование")) conditional("В условиях не указано рефинансирование", "Выбрать предложение с прямым рефинансированием");

    const existingRelationship = servicingBanks.some((bank) => normalizeProvider(bank).includes(normalizeProvider(offer.provider)) || normalizeProvider(offer.provider).includes(normalizeProvider(bank)));
    if (existingRelationship) {
      reasons.push("Банк уже обнаружен в загруженных выписках");
      actions.push("Проверить персональные условия действующего РКО, но не считать наличие счёта одобрением");
    }

    if (!reasons.length) reasons.push("Формальные фильтры требуют дополнительной проверки");
    const amount = Math.max(0, offer.maxLimit ? Math.min(offer.maxLimit, requested) : requested);
    return {
      id: offer.id,
      bank: offer.provider,
      kind: offer.kind,
      kindLabel: fundingKindLabels[offer.kind],
      status,
      statusLabel: status === "go" ? "Предварительно подходит" : status === "conditional" ? "После проверки условий" : "Не подходит сейчас",
      products: offer.products,
      amount,
      minLimit: offer.minLimit,
      maxLimit: offer.maxLimit,
      limitLabel: offer.limitLabel,
      term: offer.term,
      rate: offer.rate,
      geography: offer.geographyLabel,
      comment: offer.comment,
      needMatch,
      matchedNeeds,
      reasons: [...new Set(reasons)].slice(0, 6),
      actions: [...new Set(actions)].slice(0, 5),
      recommendedProduct: offer.kind === "leasing" ? "Лизинг" : offer.kind === "factoring" ? "Факторинг" : offer.kind === "seller" ? "Финансирование селлеров" : contractDetected && offer.products.includes("КИК") ? "Контрактный кредит / КИК" : marketplaceDetected && offer.products.includes("Селлеры") ? "Оборотное финансирование селлера" : offer.products.includes("ВКЛ") ? "Возобновляемая кредитная линия" : offer.products[0] ?? "Оборотное финансирование",
      existingRelationship,
      activityReason: marketplaceDetected ? "Подтверждён поток маркетплейса" : contractDetected ? "Подтверждена контрактная логика" : leasingDetected ? "Выявлена потребность в основных средствах" : receivablesDetected ? "Выявлена дебиторская логика" : "Соответствует оборотной потребности компании",
    };
  });

  const order: Record<BankRouteStatus, number> = { go: 0, conditional: 1, stop: 2 };
  const kindOrder: Record<FundingKind, number> = { bank: 0, factoring: 1, seller: 2, leasing: 3, mfo: 4, "secured-personal": 5 };
  const routes = assessedRoutes.filter((route) => {
    if (!route.needMatch || route.status === "stop") return false;
    if (route.kind === "seller") return marketplaceDetected;
    if (route.kind === "factoring") return receivablesDetected;
    if (route.kind === "leasing") return leasingDetected;
    if (route.kind === "secured-personal") return inferredNeeds.includes("secured");
    return route.kind === "bank" || route.kind === "mfo";
  });
  return {
    assessment,
    selectedNeed,
    inferredNeeds,
    marketplaceDetected,
    contractDetected,
    receivablesDetected,
    leasingDetected,
    servicingBanks,
    excludedCount: assessedRoutes.length - routes.length,
    sourceNote: "Госконтракты учитываются по официальным реестрам; обслуживающие банки определяются по заголовкам загруженных выписок.",
    routes: routes.sort((a, b) => Number(b.needMatch) - Number(a.needMatch) || order[a.status] - order[b.status] || kindOrder[a.kind] - kindOrder[b.kind] || b.amount - a.amount),
  };
}

export { productTermsDate };
