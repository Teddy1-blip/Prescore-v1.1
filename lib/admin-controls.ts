import { creditPolicyRules } from "./credit-policy.ts";
import { financingOffers } from "./financing-offers.ts";
import { partnerCommissions } from "./partner-commissions.ts";
import { guaranteePolicies } from "./bank-guarantees.ts";
import type { AnalysisResult, Recommendation, StopFactor } from "./prescore.ts";

export type ControlCategory = "stop_factor" | "policy_rule" | "recommendation" | "bank" | "product" | "metric";
export type ControlDefinition = {
  controlKey: string;
  category: ControlCategory;
  label: string;
  groupName: string;
  description: string;
  enabledByDefault: boolean;
};
export type ControlSetting = ControlDefinition & { enabled: number; updatedAt?: string };
export type ControlState = { enabled: Record<string, boolean>; disabled: Set<string> };

type PreparedStatement = { bind: (...values: unknown[]) => PreparedStatement; run: () => Promise<unknown>; first: <T = unknown>() => Promise<T | null> };
type RuntimeDatabase = { prepare: (query: string) => PreparedStatement; batch: (statements: PreparedStatement[]) => Promise<Array<{ results: unknown[] }>> };

function slug(value: string) {
  return value.toLocaleLowerCase("ru-RU").replace(/ё/g, "е").replace(/[^a-zа-я0-9]+/g, "-").replace(/^-|-$/g, "");
}

export const factorControlKey = (factor: Pick<StopFactor, "code" | "title">) => factor.code ? `rule:${factor.code}` : `factor:${slug(factor.title)}`;
export const factorTitleControlKey = (title: string) => `factor:${slug(title)}`;
export const recommendationControlKey = (item: Pick<Recommendation, "product"> | string) => `recommendation:${slug(typeof item === "string" ? item : item.product)}`;
export const bankControlKey = (provider: string) => `bank:${slug(provider)}`;
export const productControlKey = (product: string) => `product:${slug(product)}`;
export const metricControlKey = (metric: string) => `metric:${slug(metric)}`;

const runtimeFactors = [
  "Недостаточная история", "Короткая история", "Нет внешних поступлений", "Низкая распознаваемость",
  "Резкое падение оборота", "Снижение оборота", "Высокая волатильность поступлений", "Критическая концентрация",
  "Повышенная концентрация выручки", "Высокая доля рискованных списаний", "Высокая долговая нагрузка",
  "Повышенная долговая нагрузка", "Нерегулярные налоговые платежи", "Минимальный запас ликвидности",
  "Неоперационные поступления исключены", "Поступления требуют подтверждения", "Отрицательный расчётный остаток",
  "Частые периоды низкой ликвидности", "Выраженная сезонность", "Критических стоп-факторов нет",
  "Кредитный портфель не подтверждён", "Текущая просрочка по БКИ", "Отказной промежуточный финансовый профиль",
  "Платежи БКИ не полностью видны в выписках", "Концентрация контрактного портфеля",
];

const recommendationProducts = [
  "Долговая нагрузка", "БКИ и кредитный портфель", "Концентрация покупателей", "Качество выручки",
  "Основные средства", "Денежный поток", "Ликвидность", "Динамика оборота", "Налоговая дисциплина",
  "Комплаенс операций", "Сезонность и разрывы", "Диверсификация потока", "Полнота данных",
  "Кредитное досье", "Финансовая отчётность", "Капитал и чистые активы", "Юридические риски",
  "Исполнительные производства", "Контрактная дисциплина",
];

const analysisProducts = [
  "Возобновляемая кредитная линия", "Овердрафт", "Факторинг", "Рефинансирование",
  "Банковская гарантия", "Банковская гарантия / контрактное финансирование", "Финансирование селлеров", "Лизинг", "МФО / краудлендинг",
];

const metrics: Array<[string, string, string]> = [
  ["prescore-index", "Prescore Index / B-Score", "Итоговый индекс банковского потока"],
  ["readiness", "Готовность к финансированию", "Итоговый статус готовности"],
  ["estimated-limit", "Расчётный диапазон", "Нижняя и верхняя граница аналитического ориентира"],
  ["payment-capacity", "Допустимый ежемесячный платёж", "Базовая долговая ёмкость"],
  ["stress-limit", "Стресс-ориентир", "Консервативная граница лимита"],
  ["limit-confidence", "Достоверность расчёта", "Уверенность по полноте источников"],
  ["gross-inflow", "Валовые поступления", "Все входящие операции до классификации"],
  ["operating-inflow", "Операционная выручка", "Подтверждённые внешние поступления"],
  ["excluded-inflow", "Исключённые поступления", "Кредиты, возвраты, взносы и неясные операции"],
  ["avg-monthly-inflow", "Среднемесячная выручка", "Средний подтверждённый месячный поток"],
  ["monthly-trend", "Динамика поступлений", "Тренд входящего денежного потока"],
  ["volatility", "Волатильность", "Изменчивость месячных поступлений"],
  ["statements-accounts", "Выписки и счета", "Количество источников банковского потока"],
  ["top-one-concentration", "Концентрация TOP-1", "Зависимость от крупнейшего плательщика"],
  ["top-three-concentration", "Концентрация TOP-3", "Доля трёх крупнейших плательщиков"],
  ["debt-service-share", "Долговая нагрузка", "Видимые платежи по кредитам и лизингу"],
  ["risky-outflow-share", "Рискованные списания", "Наличные и переводы физическим лицам"],
  ["tax-regularity", "Налоговая регулярность", "Периодичность налоговых платежей"],
  ["liquidity", "Ликвидность и кассовые разрывы", "Остатки и дни низкой ликвидности"],
  ["data-quality", "Качество данных", "Полнота распознанных полей и периода"],
  ["bfo", "Показатели БФО", "Выручка, прибыль, капитал и структура баланса"],
  ["quarterly", "Квартальная отчётность", "Промежуточные показатели и динамика"],
  ["credit-portfolio", "Кредитный портфель", "Лимиты, остатки, платежи и обслуживание"],
  ["legal", "Правовые показатели", "Арбитраж, исполнительные производства и статус"],
  ["contracts", "Контрактные показатели", "Контракты, заказчики и концентрация"],
  ["evidence", "Цепочка доказательств", "Источник, период и значение для каждого вывода"],
];

function unique<T extends ControlDefinition>(items: T[]) {
  return [...new Map(items.map((item) => [item.controlKey, item])).values()];
}

export const controlDefinitions: ControlDefinition[] = unique([
  ...runtimeFactors.map((label) => ({ controlKey: factorTitleControlKey(label), category: "stop_factor" as const, label, groupName: "Активные сигналы", description: "Управляет показом и учётом сигнала в итоговом заключении", enabledByDefault: true })),
  ...creditPolicyRules.map((rule) => ({ controlKey: `rule:${rule.code}`, category: "policy_rule" as const, label: `${rule.code} · ${rule.factor}`, groupName: rule.layer, description: `${rule.decisionClass} · ${rule.condition} · ${rule.status}`, enabledByDefault: true })),
  ...recommendationProducts.map((label) => ({ controlKey: recommendationControlKey(label), category: "recommendation" as const, label, groupName: "Рекомендации клиенту", description: "Управляет рекомендациями, планом действий и продуктовым выводом", enabledByDefault: true })),
  ...unique(financingOffers.map((offer) => ({ controlKey: bankControlKey(offer.provider), category: "bank" as const, label: offer.provider, groupName: offer.kind, description: "Управляет всеми маршрутами этой организации", enabledByDefault: true }))),
  ...unique(partnerCommissions.map((offer) => ({ controlKey: bankControlKey(offer.bank), category: "bank" as const, label: offer.bank, groupName: offer.kind, description: "Управляет маршрутами банка в агентской воронке", enabledByDefault: true }))),
  ...guaranteePolicies.filter((policy) => policy.providerConfirmed).map((policy) => ({ controlKey: bankControlKey(policy.provider), category: "bank" as const, label: policy.provider, groupName: "Банковские гарантии", description: "Управляет подтверждённым маршрутом банковской гарантии", enabledByDefault: true })),
  ...unique(financingOffers.flatMap((offer) => offer.products.map((product) => ({ controlKey: productControlKey(product), category: "product" as const, label: product, groupName: offer.kind, description: "Управляет показом продукта во всех подходящих маршрутах", enabledByDefault: true })))),
  ...analysisProducts.map((product) => ({ controlKey: productControlKey(product), category: "product" as const, label: product, groupName: "Аналитический вывод", description: "Управляет показом продукта в кредитном профиле и отчёте", enabledByDefault: true })),
  ...unique(partnerCommissions.map((offer) => ({ controlKey: productControlKey(offer.product), category: "product" as const, label: offer.product, groupName: offer.kind, description: "Управляет продуктом в агентской воронке", enabledByDefault: true }))),
  ...metrics.map(([key, label, description]) => ({ controlKey: metricControlKey(key), category: "metric" as const, label, groupName: "Показатели отчёта", description, enabledByDefault: true })),
]);

const definitionsByKey = new Map(controlDefinitions.map((item) => [item.controlKey, item]));
const ruleKeysByFactorTitle = creditPolicyRules.reduce<Map<string, string[]>>((result, rule) => {
  const key = slug(rule.factor);
  result.set(key, [...(result.get(key) ?? []), `rule:${rule.code}`]);
  return result;
}, new Map());
export const isKnownControlKey = (key: string) => definitionsByKey.has(key);

export async function ensureControlSettings(database: RuntimeDatabase) {
  await database.prepare(`CREATE TABLE IF NOT EXISTS control_settings (
    control_key TEXT PRIMARY KEY, category TEXT NOT NULL, label TEXT NOT NULL, group_name TEXT NOT NULL DEFAULT '',
    description TEXT NOT NULL DEFAULT '', enabled INTEGER NOT NULL DEFAULT 1, updated_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP
  )`).run();
  const countResult = await database.batch([database.prepare("SELECT COUNT(*) AS count FROM control_settings")]);
  const existingCount = Number((countResult[0]?.results as Array<{ count?: number }> | undefined)?.[0]?.count ?? 0);
  if (existingCount >= controlDefinitions.length) return;
  const now = new Date().toISOString();
  for (let index = 0; index < controlDefinitions.length; index += 75) {
    await database.batch(controlDefinitions.slice(index, index + 75).map((item) => database.prepare(
      "INSERT OR IGNORE INTO control_settings (control_key, category, label, group_name, description, enabled, updated_at) VALUES (?, ?, ?, ?, ?, ?, ?)"
    ).bind(item.controlKey, item.category, item.label, item.groupName, item.description, item.enabledByDefault ? 1 : 0, now)));
  }
}

export async function readControlSettings(database: RuntimeDatabase): Promise<ControlSetting[]> {
  await ensureControlSettings(database);
  const response = await database.batch([database.prepare("SELECT control_key AS controlKey, category, label, group_name AS groupName, description, enabled, updated_at AS updatedAt FROM control_settings")]);
  const rows = response[0]?.results as Array<{ controlKey: string; category: ControlCategory; label: string; groupName: string; description: string; enabled: number; updatedAt: string }>;
  const stored = new Map(rows.map((item) => [item.controlKey, item]));
  return controlDefinitions.map((definition) => ({ ...definition, ...(stored.get(definition.controlKey) ?? {}), enabled: stored.get(definition.controlKey)?.enabled ?? Number(definition.enabledByDefault) }));
}

export async function readControlState(database: RuntimeDatabase): Promise<ControlState> {
  const settings = await readControlSettings(database);
  const enabled = Object.fromEntries(settings.map((item) => [item.controlKey, Boolean(item.enabled)]));
  return { enabled, disabled: new Set(settings.filter((item) => !item.enabled).map((item) => item.controlKey)) };
}

export function isFactorEnabled(factor: Pick<StopFactor, "code" | "title">, state: ControlState) {
  const keys = [factorTitleControlKey(factor.title), factor.code ? `rule:${factor.code}` : "", ...(ruleKeysByFactorTitle.get(slug(factor.title)) ?? [])].filter(Boolean);
  return keys.every((key) => !state.disabled.has(key));
}

export function recommendationCategory(item: Pick<Recommendation, "product" | "title" | "rationale">) {
  const text = `${item.product} ${item.title} ${item.rationale}`.toLocaleLowerCase("ru-RU");
  if (/бки|кредитн(ая|ый) истор|кредитн(ый|ого) портфел|просроч/.test(text)) return "БКИ и кредитный портфель";
  if (/рефинанс|долгов|кредитн(ая|ые) нагруз/.test(text)) return "Долговая нагрузка";
  if (/дебитор|концентрац|покупател|факторинг/.test(text)) return "Концентрация покупателей";
  if (/маркетплейс|селлер|качество выруч/.test(text)) return "Качество выручки";
  if (/лизинг|оборудован|техник|основн(ые|ых) средств|актив/.test(text)) return "Основные средства";
  if (/ликвид|овердрафт|кассов/.test(text)) return "Ликвидность";
  if (/сезон|волатиль|гибк(ий|ого) лимит/.test(text)) return "Сезонность и разрывы";
  if (/снижени|динамик|восстановлен.*оборот/.test(text)) return "Динамика оборота";
  if (/налог|енс/.test(text)) return "Налоговая дисциплина";
  if (/физлиц|наличн|комплаенс|рискованн.*списан/.test(text)) return "Комплаенс операций";
  if (/диверсиф|top.?5/.test(text)) return "Диверсификация потока";
  if (/выписк|полнот.*данн|остальн.*банк/.test(text)) return "Полнота данных";
  if (/бфо|квартальн|отч[её]тност|баланс/.test(text)) return "Финансовая отчётность";
  if (/капитал|чист(ые|ых) актив/.test(text)) return "Капитал и чистые активы";
  if (/фссп|исполнительн/.test(text)) return "Исполнительные производства";
  if (/юридич|егрюл|адрес|арбитраж|ефрсб|банкрот/.test(text)) return "Юридические риски";
  if (/контракт|закупк|исполнени.*догов/.test(text)) return "Контрактная дисциплина";
  if (/поток|линия/.test(text)) return "Денежный поток";
  return "Кредитное досье";
}

export function applyAnalysisControls<T extends AnalysisResult>(analysis: T, state: ControlState): T {
  const recommendations = analysis.recommendations.map((item) => ({ ...item, product: recommendationCategory(item) }));
  return {
    ...analysis,
    factors: analysis.factors.filter((item) => isFactorEnabled(item, state)),
    topRisks: analysis.topRisks.filter((item) => !state.disabled.has(factorTitleControlKey(item.title))),
    recommendations: recommendations.filter((item) => !state.disabled.has(recommendationControlKey(item))),
    productFits: analysis.productFits.filter((item) => !state.disabled.has(productControlKey(item.product))),
  };
}

export function metricEnabled(metric: string, state: ControlState) {
  return !state.disabled.has(metricControlKey(metric));
}

export function filterOfferProducts<T extends { bank: string; products: string[]; recommendedProduct: string }>(route: T, state: ControlState): T | null {
  if (state.disabled.has(bankControlKey(route.bank))) return null;
  const products = route.products.filter((product) => !state.disabled.has(productControlKey(product)));
  if (!products.length) return null;
  const recommendedProduct = products.includes(route.recommendedProduct) ? route.recommendedProduct : products[0];
  return { ...route, products, recommendedProduct };
}
