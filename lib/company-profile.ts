import type { SourceEnvelope } from "./credit-engine/contracts/sources";

export type CompanyProfileData = {
  inn: string;
  source: string;
  fetchedAt: string;
  cached: boolean;
  failedMethods: string[];
  company: {
    name: string; fullName: string; ogrn: string; kpp: string; status: string;
    registrationDate: string; region: string; address: string; addressUnreliable: boolean;
    okvedCode: string; okved: string; capital: number;
    managers: Array<{ name: string; position: string; inn: string }>;
    foundersCount: number;
  };
  finances: {
    latestYear: string; years: string[]; revenue: number; revenueGrowth: number | null;
    profit: number; assets: number; currentAssets: number; equity: number;
    currentLiabilities: number; receivables: number; cash: number; payables: number;
    currentLiquidity: number | null; autonomy: number | null; returnOnSales: number | null;
    nonCurrentAssets?: number | null; inventories?: number | null; inputVat?: number | null;
    longTermLiabilities?: number | null; longTermBorrowings?: number | null; shortTermBorrowings?: number | null;
    costOfSales?: number | null; grossProfit?: number | null; operatingProfit?: number | null;
    interestExpense?: number | null; profitBeforeTax?: number | null;
    workingCapital?: number | null; debtToEquity?: number | null; interestCoverage?: number | null;
    fieldsPresent?: string[];
  };
  legal: { legalCases: number; enforcements: number; enforcementDebt: number; inspections: number; bankruptcyMessages: number };
  sourceManifest?: { bfo?: SourceEnvelope; external?: SourceEnvelope[] };
  sourceStatus?: Array<{ endpoint: string; status: "available" | "partial" | "unavailable"; retrievedAt: string }>;
  externalBanks?: Array<{ name: string; bik: string; account: string; status: "BANK_FOUND_IN_EXTERNAL_DATA"; evidence: string }>;
  timeline?: Array<{ eventType: string; eventDate: string; entityType: string; description: string; source: string; severityCandidate: "information" | "review" }>;
  enforcementItems?: Array<{ number: string; date: string; amount: number | null; state: string; subject: string; active: boolean; source: string }>;
  legalCaseItems?: Array<{ number: string; date: string; amount: number | null; role: "PLAINTIFF" | "DEFENDANT" | "OTHER"; status: string; court: string; source: string }>;
  inspectionItems?: Array<{ date: string; authority: string; type: string; result: string; violations: string; status: string; source: string }>;
  registryMessages?: Array<{ messageType: string; date: string; title: string; sourceId: string; classification: "INFORMATIONAL" | "REVIEW" | "HIGH_RISK_CANDIDATE" | "CRITICAL_CANDIDATE"; source: string }>;
  contracts?: {
    totalCount: number; activeCount: number; completedCount: number;
    totalAmount: number; activeAmount: number; topCustomerShare: number | null;
    items: Array<{ number: string; customer: string; law: string; amount: number; signedAt: string; executionAt?: string; status: string }>;
  };
  signals: Array<{ severity: "critical" | "warning" | "info"; title: string; detail: string }>;
};

export type AssessmentSignal = {
  severity: "critical" | "warning" | "info";
  title: string;
  detail: string;
  impact: string;
  action: string;
};

export type FinancialMetric = {
  label: string;
  value: string;
  benchmark: string;
  status: "good" | "warning" | "critical" | "unknown";
  explanation: string;
};

export type FinancialAssessment = {
  fScore: number | null;
  legalScore: number;
  index: number | null;
  grade: string;
  confidence: number;
  verdict: string;
  strengths: string[];
  factors: AssessmentSignal[];
  recommendations: Array<{ title: string; reason: string; action: string; horizon: string }>;
  metrics: FinancialMetric[];
};

export type CombinedInsight = {
  severity: "positive" | "attention" | "critical";
  title: string;
  evidence: string;
  conclusion: string;
  impact: string;
  action: string;
};

const clamp = (value: number, min = 0, max = 1) => Math.max(min, Math.min(max, value));
const pct = (value: number | null) => value == null ? "Нет данных" : `${value}%`;
const money = (value: number) => new Intl.NumberFormat("ru-RU", { style: "currency", currency: "RUB", maximumFractionDigits: 0 }).format(value || 0);

function gradeFor(index: number | null) {
  if (index == null) return "—";
  if (index >= 850) return "A";
  if (index >= 720) return "B+";
  if (index >= 620) return "B";
  if (index >= 520) return "C+";
  if (index >= 420) return "C";
  return "D";
}

function liquidityPoints(value: number | null) {
  if (value == null) return 32;
  if (value >= 2) return 80;
  if (value >= 1.5) return 70;
  if (value >= 1.2) return 60;
  if (value >= 1) return 48;
  if (value >= .8) return 28;
  return 8;
}

function autonomyPoints(equity: number, value: number | null) {
  if (equity <= 0) return 0;
  if (value == null) return 38;
  if (value >= 50) return 100;
  if (value >= 30) return 82;
  if (value >= 15) return 62;
  if (value >= 5) return 35;
  return 15;
}

function profitabilityPoints(profit: number, ros: number | null) {
  if (profit < 0 || (ros != null && ros < 0)) return 0;
  if (ros == null) return profit > 0 ? 42 : 28;
  if (ros >= 10) return 80;
  if (ros >= 5) return 66;
  if (ros >= 2) return 52;
  if (ros > 0) return 38;
  return 25;
}

function growthPoints(value: number | null) {
  if (value == null) return 26;
  if (value >= 15) return 60;
  if (value >= 5) return 52;
  if (value >= 0) return 43;
  if (value >= -10) return 32;
  if (value >= -25) return 16;
  return 5;
}

export function buildFinancialAssessment(profile: CompanyProfileData, bScore: number): FinancialAssessment {
  const f = profile.finances;
  const hasBfo = Boolean(f.latestYear && (f.assets || f.revenue || f.equity || f.currentAssets));
  const workingCapital = f.currentAssets - f.currentLiabilities;
  const workingCapitalRatio = f.currentAssets ? workingCapital / f.currentAssets : null;
  const receivablesToAssets = f.assets ? f.receivables / f.assets : null;
  const payablesToRevenue = f.revenue ? f.payables / f.revenue : null;
  const structurePoints = workingCapitalRatio == null ? 18 : workingCapitalRatio >= .25 ? 40 : workingCapitalRatio >= 0 ? 30 : workingCapitalRatio >= -.2 ? 15 : 3;
  const qualityPoints = receivablesToAssets == null ? 18 : receivablesToAssets <= .3 ? 40 : receivablesToAssets <= .5 ? 30 : receivablesToAssets <= .7 ? 17 : 6;
  const fScore = hasBfo ? Math.round(
    liquidityPoints(f.currentLiquidity) +
    autonomyPoints(f.equity, f.autonomy) +
    profitabilityPoints(f.profit, f.returnOnSales) +
    growthPoints(f.revenueGrowth) + structurePoints + qualityPoints
  ) : null;

  let legalScore = profile.company.status.toLowerCase().includes("действ") ? 30 : 0;
  legalScore += profile.company.addressUnreliable ? 0 : 10;
  legalScore += Math.max(0, 20 - Math.min(20, profile.legal.enforcements * 4));
  legalScore += Math.max(5, 25 - Math.min(20, profile.legal.bankruptcyMessages * 3));
  legalScore += Math.max(0, 15 - Math.min(15, profile.legal.legalCases + profile.legal.inspections));
  legalScore = Math.round(clamp(legalScore / 100) * 100);

  const index = fScore == null ? null : Math.round(bScore * .5 + fScore + legalScore);
  const factors: AssessmentSignal[] = [];
  const recommendations: FinancialAssessment["recommendations"] = [];
  const strengths: string[] = [];

  if (!profile.company.status.toLowerCase().includes("действ")) factors.push({ severity: "critical", title: "Статус компании ограничивает финансирование", detail: `В источнике указан статус: ${profile.company.status || "не определён"}.`, impact: "Большинство банков не рассматривает недействующие организации.", action: "Уточнить запись ЕГРЮЛ до подачи заявки." });
  if (!hasBfo) factors.push({ severity: "warning", title: "БФО недостаточно для F‑Score", detail: "В официальном источнике нет полного набора показателей последнего года.", impact: "Финансовая устойчивость и полный индекс не рассчитаны.", action: "Загрузить принятую годовую или квартальную отчётность в читаемом формате." });
  if (hasBfo && f.equity <= 0) factors.push({ severity: "critical", title: "Отрицательный или нулевой капитал", detail: `Собственный капитал: ${money(f.equity)}.`, impact: "Это частый формальный стоп для необеспеченного кредитования.", action: "Проверить чистые активы, причины убытков и план восстановления капитала." });
  else if (f.autonomy != null && f.autonomy < 15) factors.push({ severity: "warning", title: "Низкая финансовая независимость", detail: `Коэффициент автономии ${pct(f.autonomy)}.`, impact: "Компания сильно зависит от внешних обязательств.", action: "Ограничить новый долг либо подтвердить субординированное финансирование собственника." });
  if (f.currentLiquidity != null && f.currentLiquidity < .8) factors.push({ severity: "critical", title: "Дефицит текущей ликвидности", detail: `Коэффициент текущей ликвидности ${f.currentLiquidity}.`, impact: "Оборотных активов может не хватать для покрытия краткосрочных обязательств.", action: "Снизить короткую кредиторскую нагрузку и подготовить расшифровку оборотных активов." });
  else if (f.currentLiquidity != null && f.currentLiquidity < 1.2) factors.push({ severity: "warning", title: "Ликвидность ниже комфортного уровня", detail: `Коэффициент текущей ликвидности ${f.currentLiquidity}.`, impact: "Банк может снизить лимит или запросить обеспечение.", action: "Сопоставить сроки дебиторки и кредиторки, подтвердить ликвидность запасов." });
  if (f.profit < 0) factors.push({ severity: "critical", title: "Убыток по официальной отчётности", detail: `Чистый результат: ${money(f.profit)}.`, impact: "Снижается способность обслуживать новый долг по данным БФО.", action: "Подготовить квартальную управленческую отчётность и объяснение разовых расходов." });
  else if (f.returnOnSales != null && f.returnOnSales < 2) factors.push({ severity: "warning", title: "Низкая рентабельность продаж", detail: `Рентабельность продаж ${pct(f.returnOnSales)}.`, impact: "Рост стоимости кредита может сделать финансируемую сделку убыточной.", action: "Проверить маржу проекта в калькуляторе с учётом процентов и комиссий." });
  if (f.revenueGrowth != null && f.revenueGrowth < -20) factors.push({ severity: "critical", title: "Существенное снижение выручки", detail: `Динамика год к году ${pct(f.revenueGrowth)}.`, impact: "Банк может опираться на более низкий период и сократить лимит.", action: "Подтвердить восстановление выручки контрактами и актуальными оборотами." });
  else if (f.revenueGrowth != null && f.revenueGrowth < 0) factors.push({ severity: "warning", title: "Отрицательная динамика выручки", detail: `Динамика год к году ${pct(f.revenueGrowth)}.`, impact: "Потребуется объяснить снижение и показать текущий тренд по выпискам.", action: "Сопоставить БФО с последними 6–12 месяцами банковского потока." });
  if (workingCapital < 0) factors.push({ severity: "warning", title: "Отрицательный оборотный капитал", detail: `Оборотные активы меньше краткосрочных обязательств на ${money(Math.abs(workingCapital))}.`, impact: "Часть оборота финансируется короткими обязательствами.", action: "Расшифровать сроки дебиторки, запасов и краткосрочных обязательств; составить план высвобождения оборотного капитала и контрольный прогноз-факт." });
  if (receivablesToAssets != null && receivablesToAssets > .5) factors.push({ severity: "warning", title: "Высокая доля дебиторской задолженности", detail: `${Math.round(receivablesToAssets * 100)}% активов сосредоточено в дебиторке.`, impact: "Качество активов зависит от платёжной дисциплины покупателей.", action: "Добавить aging-реестр дебиторов, выделить просрочку, подтвердить акты и последующие оплаты по крупнейшим суммам." });
  if (profile.company.addressUnreliable) factors.push({ severity: "critical", title: "Недостоверность адреса", detail: "В ЕГРЮЛ присутствует отметка о недостоверности адреса.", impact: "Возможен формальный отказ или приостановка рассмотрения.", action: "Исправить сведения ЕГРЮЛ до подачи." });
  if (profile.legal.enforcements > 0 || profile.legal.enforcementDebt > 0) factors.push({ severity: "warning", title: "Исполнительные производства", detail: `${profile.legal.enforcements} производств, видимый остаток ${money(profile.legal.enforcementDebt)}.`, impact: "Нужно проверить актуальность, предмет и сумму каждого производства.", action: "Закрыть задолженность либо подготовить документы об оспаривании/погашении." });
  if (profile.legal.bankruptcyMessages > 0) factors.push({ severity: "warning", title: "Сообщения ЕФРСБ требуют проверки", detail: `Найдено сообщений: ${profile.legal.bankruptcyMessages}. Само сообщение не означает процедуру банкротства.`, impact: "Без проверки содержания нельзя делать вывод о доступности кредита.", action: "Открыть сообщения и подтвердить их связь с компанией и текущий статус." });

  if (hasBfo && f.equity > 0) strengths.push(`Положительный собственный капитал ${money(f.equity)}`);
  if (f.currentLiquidity != null && f.currentLiquidity >= 1.2) strengths.push(`Текущая ликвидность ${f.currentLiquidity} покрывает краткосрочные обязательства`);
  if (f.profit > 0) strengths.push(`Положительная чистая прибыль ${money(f.profit)}`);
  if (f.revenueGrowth != null && f.revenueGrowth > 0) strengths.push(`Выручка растёт на ${pct(f.revenueGrowth)} год к году`);
  if (!profile.legal.enforcements) strengths.push("Исполнительные производства не обнаружены");

  for (const factor of factors.filter((item) => item.severity !== "info").slice(0, 8)) recommendations.push({ title: factor.title, reason: factor.impact, action: factor.action, horizon: factor.severity === "critical" ? "До подачи" : "7–30 дней" });
  if (!recommendations.length) recommendations.push({ title: "Сохранить подтверждённую финансовую дисциплину", reason: "Критических сигналов БФО и юридического контура не выявлено.", action: "Обновлять платёжный календарь, квартальную отчётность, БКИ и юридические события; сохранять документы по крупным поступлениям и списаниям.", horizon: "Ежемесячно" });

  const metrics: FinancialMetric[] = [
    { label: "Текущая ликвидность", value: f.currentLiquidity == null ? "Нет данных" : String(f.currentLiquidity), benchmark: "Ориентир: от 1,2", status: f.currentLiquidity == null ? "unknown" : f.currentLiquidity >= 1.2 ? "good" : f.currentLiquidity >= .8 ? "warning" : "critical", explanation: "Показывает покрытие краткосрочных обязательств оборотными активами." },
    { label: "Коэффициент автономии", value: pct(f.autonomy), benchmark: "Ориентир: от 20–30%", status: f.autonomy == null ? "unknown" : f.autonomy >= 30 ? "good" : f.autonomy >= 15 ? "warning" : "critical", explanation: "Чем выше доля собственного капитала, тем устойчивее баланс для кредитора." },
    { label: "Рентабельность продаж", value: pct(f.returnOnSales), benchmark: "Положительная, с учётом отрасли", status: f.returnOnSales == null ? "unknown" : f.returnOnSales >= 5 ? "good" : f.returnOnSales >= 0 ? "warning" : "critical", explanation: "Маржа должна покрывать стоимость нового финансирования и операционный риск." },
    { label: "Динамика выручки", value: pct(f.revenueGrowth), benchmark: "Без резкого снижения", status: f.revenueGrowth == null ? "unknown" : f.revenueGrowth >= 0 ? "good" : f.revenueGrowth >= -20 ? "warning" : "critical", explanation: "Банк сопоставляет официальный годовой тренд с текущими оборотами по счетам." },
    { label: "Чистый оборотный капитал", value: money(workingCapital), benchmark: "Предпочтительно положительный", status: !hasBfo ? "unknown" : workingCapital >= 0 ? "good" : "warning", explanation: "Отражает запас оборотных активов после покрытия краткосрочных обязательств." },
    { label: "Дебиторка / активы", value: receivablesToAssets == null ? "Нет данных" : `${Math.round(receivablesToAssets * 100)}%`, benchmark: "Оценивается качество и сроки", status: receivablesToAssets == null ? "unknown" : receivablesToAssets <= .3 ? "good" : receivablesToAssets <= .5 ? "warning" : "critical", explanation: "Высокая доля дебиторки требует проверки крупнейших покупателей и просрочки." },
    { label: "Кредиторка / выручка", value: payablesToRevenue == null ? "Нет данных" : `${Math.round(payablesToRevenue * 100)}%`, benchmark: "Сопоставляется с оборотным циклом", status: payablesToRevenue == null ? "unknown" : payablesToRevenue <= .25 ? "good" : payablesToRevenue <= .5 ? "warning" : "critical", explanation: "Рост кредиторки может указывать на финансирование оборота за счёт поставщиков." },
    { label: "Денежные средства", value: money(f.cash), benchmark: "Сопоставляются с обязательствами", status: !hasBfo ? "unknown" : f.cash > 0 ? "good" : "warning", explanation: "Дополняют картину ликвидности, но не заменяют анализ ежедневного банковского потока." },
  ];

  const availableFields = [f.latestYear, f.assets, f.revenue, f.equity, f.currentLiquidity, f.autonomy, f.returnOnSales].filter((value) => value !== "" && value != null && value !== 0).length;
  const confidence = hasBfo ? Math.round(clamp(availableFields / 7) * 100) : 25;
  const critical = factors.filter((item) => item.severity === "critical").length;
  const verdict = !hasBfo ? "Недостаточно БФО для полного заключения" : critical ? "До подачи требуется устранить критические факторы" : index != null && index >= 720 ? "Финансовый профиль готов к подбору банков" : "Возможна подача с оговорками и подготовкой";

  return { fScore, legalScore, index, grade: gradeFor(index), confidence, verdict, strengths: strengths.slice(0, 5), factors, recommendations, metrics };
}

export function buildCombinedInsights(profile: CompanyProfileData, analysis: Omit<AnalysisResult, "transactions">): CombinedInsight[] {
  const f = profile.finances;
  const m = analysis.metrics;
  const annualizedBankFlow = m.avgMonthlyInflow * 12;
  const flowToRevenue = f.revenue > 0 ? annualizedBankFlow / f.revenue : null;
  const receivablesToAssets = f.assets > 0 ? f.receivables / f.assets : null;
  const items: CombinedInsight[] = [];
  const add = (item: CombinedInsight) => items.push(item);

  if (flowToRevenue != null && flowToRevenue > 1.55) add({
    severity: "attention", title: "Банковский поток заметно выше официальной выручки",
    evidence: `Годовой эквивалент поступлений ${money(annualizedBankFlow)} против выручки БФО ${money(f.revenue)}.`,
    conclusion: "В потоке могут быть займы, возвраты, транзитные или иные невыручечные поступления.",
    impact: "Без расшифровки банк может уменьшить учитываемый оборот и расчётный лимит.",
    action: "Разделить операционную выручку и прочие поступления, приложить оборотно-сальдовую ведомость по счету 51.",
  });
  else if (flowToRevenue != null && flowToRevenue < .55) add({
    severity: "attention", title: "По выпискам видна только часть официальной выручки",
    evidence: `Годовой эквивалент потока составляет ${Math.round(flowToRevenue * 100)}% выручки БФО.`,
    conclusion: "Вероятно, загружены не все счета либо текущий оборот снизился относительно отчётного года.",
    impact: "Неполные данные снижают достоверность долговой ёмкости и маршрута по банкам.",
    action: "Добавить выписки всех банков и объяснить расхождение между текущим потоком и БФО.",
  });
  else if (flowToRevenue != null) add({
    severity: "positive", title: "Текущий поток согласуется с официальной выручкой",
    evidence: `Соотношение годового эквивалента поступлений и БФО: ${Math.round(flowToRevenue * 100)}%.`,
    conclusion: "Между транзакционным и официальным контуром нет существенного противоречия.",
    impact: "Повышается доверие к расчёту оборота и источника погашения.",
    action: "Сохранить полный комплект выписок и расшифровку крупных разовых поступлений.",
  });

  if (m.monthlyTrend < -15 && (f.revenueGrowth ?? 0) < 0) add({
    severity: "critical", title: "Снижение подтверждается и выписками, и БФО",
    evidence: `Текущий тренд ${m.monthlyTrend}%, динамика выручки БФО ${f.revenueGrowth}%.`,
    conclusion: "Ухудшение носит не единичный, а подтверждённый двумя источниками характер.",
    impact: "Необеспеченный кредит и длинный срок могут быть ограничены.",
    action: "Подготовить контрактный портфель, подтверждённый прогноз восстановления и еженедельный контроль факта к плану.",
  });
  else if (m.monthlyTrend >= 0 && (f.revenueGrowth ?? -1) >= 0) add({
    severity: "positive", title: "Рост подтверждён двумя контурами",
    evidence: `Текущий тренд ${m.monthlyTrend >= 0 ? "+" : ""}${m.monthlyTrend}%, БФО ${f.revenueGrowth != null && f.revenueGrowth >= 0 ? "+" : ""}${f.revenueGrowth ?? 0}%.`,
    conclusion: "Операционный поток и официальная отчётность показывают одно направление.",
    impact: "Это усиливает аргументацию по оборотному лимиту.",
    action: "Подтвердить рост договорами и сохранить запас по долговому платежу.",
  });
  else if (Math.sign(m.monthlyTrend) !== Math.sign(f.revenueGrowth ?? m.monthlyTrend)) add({
    severity: "attention", title: "Текущая динамика расходится с БФО",
    evidence: `Выписки: ${m.monthlyTrend}%, официальная выручка: ${f.revenueGrowth ?? "нет сравнения"}%.`,
    conclusion: "БФО отражает прошлый год, а банковский поток - более свежую ситуацию.",
    impact: "Банк запросит объяснение перелома тренда и подтверждение устойчивости изменений.",
    action: "Добавить квартальную отчётность и управленческий прогноз на 6–12 месяцев.",
  });

  if (m.debtServiceShare > .25 && (f.returnOnSales == null || f.returnOnSales < 5)) add({
    severity: "critical", title: "Долговая нагрузка не поддержана маржой",
    evidence: `Платежи по долгам ${Math.round(m.debtServiceShare * 100)}% потока, рентабельность продаж ${pct(f.returnOnSales)}.`,
    conclusion: "Даже при хорошем обороте запас прибыли для нового процента ограничен.",
    impact: "Новый аннуитетный кредит может ухудшить платёжеспособность.",
    action: "Рассчитать DSCR по каждому обязательству, проверить остатки и построить устойчивый совокупный график без роста регулярного платежа.",
  });
  if ((m.liquidityDays ?? 999) < 10 && (f.currentLiquidity ?? 99) < 1.2) add({
    severity: "critical", title: "Дефицит ликвидности подтверждён выписками и балансом",
    evidence: `Запас денег ${m.liquidityDays ?? 0} дня расходов, текущая ликвидность ${f.currentLiquidity ?? "нет данных"}.`,
    conclusion: "Краткосрочные обязательства и ежедневный денежный поток одновременно напряжены.",
    impact: "Повышен риск кассового разрыва и снижения необеспеченного лимита.",
    action: "Синхронизировать дебиторку и кредиторку, сформировать 13-недельный платёжный календарь и установить контрольный запас денег.",
  });
  if (m.topOneConcentration > .35 && (receivablesToAssets ?? 0) > .4) add({
    severity: "attention", title: "Зависимость от покупателей видна и в потоке, и в активах",
    evidence: `TOP-1 даёт ${Math.round(m.topOneConcentration * 100)}% поступлений; дебиторка занимает ${Math.round((receivablesToAssets ?? 0) * 100)}% активов.`,
    conclusion: "Качество кредитного профиля зависит от оплаты ограниченного числа дебиторов.",
    impact: "Возможны снижение лимита или запрос реестра дебиторской задолженности.",
    action: "Проверить сроки и просрочку, подготовить договоры, акты и последующие оплаты; установить план снижения доли ключевого дебитора.",
  });
  if (f.equity <= 0 && analysis.score >= 650) add({
    severity: "critical", title: "Сильный поток не компенсирует отрицательный капитал",
    evidence: `B-Score ${analysis.score}, собственный капитал ${money(f.equity)}.`,
    conclusion: "Транзакционная активность есть, но структура баланса содержит формальный стоп.",
    impact: "Часть банков откажет по необеспеченному продукту независимо от оборотов.",
    action: "Проверить расчёт чистых активов и подготовить законный корпоративный план их фактического восстановления с последующим подтверждением отчётностью.",
  });
  if (profile.legal.enforcements > 0 && m.monthlyTrend < 0) add({
    severity: "critical", title: "Юридическое взыскание совпало со снижением потока",
    evidence: `${profile.legal.enforcements} исполнительных производств; тренд поступлений ${m.monthlyTrend}%.`,
    conclusion: "Юридический и финансовый сигналы взаимно усиливают риск.",
    impact: "До выяснения предмета и суммы взысканий подача может быть преждевременной.",
    action: "Закрыть или оспорить производства и подтвердить восстановление оборотов.",
  });
  if (!profile.legal.enforcements && !profile.company.addressUnreliable && f.equity > 0 && f.profit > 0 && analysis.score >= 700) add({
    severity: "positive", title: "Профиль поддержан тремя независимыми слоями",
    evidence: `B-Score ${analysis.score}, прибыль ${money(f.profit)}, положительный капитал, критические ФССП-сигналы не обнаружены.`,
    conclusion: "Банковский поток, баланс и правовой контур не содержат взаимного противоречия.",
    impact: "Можно переходить к адресному подбору 1–3 банков вместо массовой подачи.",
    action: "Подтвердить кредитную историю, полноту обязательств и актуальность всех финансовых и юридических сведений.",
  });
  if (m.riskyOutflowShare > .12 && m.taxRegularity < .6) add({
    severity: "attention", title: "Комплаенс-сигналы складываются в повышенный риск",
    evidence: `Рискованные списания ${Math.round(m.riskyOutflowShare * 100)}%, налоги видны в ${Math.round(m.taxRegularity * 100)}% месяцев.`,
    conclusion: "Наличные/физлица и нерегулярные налоги требуют совместной расшифровки.",
    impact: "Банк может запросить первичные документы и выписки остальных счетов.",
    action: "Разметить крупные операции, добавить ЕНС и счета, с которых фактически уплачиваются налоги.",
  });

  return items.slice(0, 12);
}
import type { AnalysisResult } from "./prescore";
