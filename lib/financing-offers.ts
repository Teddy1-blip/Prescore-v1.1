export type FundingKind = "bank" | "mfo" | "factoring" | "seller" | "leasing" | "secured-personal";

export type FinancingNeed =
  | "auto"
  | "working-capital"
  | "staged-limit"
  | "cash-gap"
  | "receivables"
  | "government-contract"
  | "marketplace"
  | "equipment"
  | "refinance"
  | "secured";

export type FinancingOffer = {
  id: string;
  provider: string;
  kind: FundingKind;
  products: string[];
  minLimit?: number;
  maxLimit?: number;
  limitLabel: string;
  minAgeMonths: number;
  term: string;
  geography: "all" | "moscow" | "exclude-south" | "exclude-south-crimea" | "limited" | "regions" | "cities-250";
  geographyLabel: string;
  rate: string;
  commissionRate?: number;
  commissionCap?: number;
  commissionLabel: string;
  collateral?: boolean | "over-30m";
  subject?: "business" | "ip-only" | "individual";
  assetTypes?: string[];
  comment: string;
};

const M = 1_000_000;
const B = 1_000_000_000;

export const productTermsDate = "03.08.2026";

export const fundingKindLabels: Record<FundingKind, string> = {
  bank: "Банки",
  mfo: "МФО и краудлендинг",
  factoring: "Факторинг",
  seller: "Селлеры",
  leasing: "Лизинг",
  "secured-personal": "Залог физлица",
};

export const financingNeedLabels: Record<FinancingNeed, string> = {
  auto: "Автоподбор",
  "working-capital": "Оборотные средства",
  "staged-limit": "Лимит частями",
  "cash-gap": "Кассовый разрыв",
  receivables: "Дебиторка",
  "government-contract": "Госконтракт",
  marketplace: "Маркетплейс",
  equipment: "Авто и оборудование",
  refinance: "Рефинансирование",
  secured: "Есть залог",
};

export const financingOffers: FinancingOffer[] = [
  { id: "realist", provider: "Реалист Банк", kind: "bank", products: ["КИК", "ПОС", "ВКЛ", "Овердрафт"], maxLimit: 500 * M, limitLabel: "до 500 млн ₽", minAgeMonths: 24, term: "до 60 мес.", geography: "limited", geographyLabel: "Россия, ограниченная география", rate: "от 26%", commissionRate: .01, commissionLabel: "1% от суммы кредита", comment: "Индивидуальные условия" },
  { id: "morskoy", provider: "Морской Банк", kind: "bank", products: ["Овердрафт", "ВКЛ"], maxLimit: 300 * M, limitLabel: "до 300 млн ₽", minAgeMonths: 18, term: "овердрафт до 36 мес.; кредит до 24 мес.", geography: "limited", geographyLabel: "Россия, ограниченная география", rate: "от 23,9%", commissionRate: .01, commissionLabel: "1% от суммы кредита", comment: "Индивидуальное рассмотрение" },
  { id: "centr-invest", provider: "Центр-инвест", kind: "bank", products: ["КИК", "ПОС"], maxLimit: 25 * M, limitLabel: "до 25 млн ₽", minAgeMonths: 12, term: "до 60 мес.", geography: "moscow", geographyLabel: "Москва и Московская область", rate: "от 18,9%", commissionRate: .01, commissionLabel: "1% от суммы кредита", comment: "Выгодные ставки по исходным условиям" },
  { id: "round", provider: "Банк Раунд", kind: "bank", products: ["КИК", "ПОС", "ВКЛ", "Овердрафт"], minLimit: 40 * M, maxLimit: 500 * M, limitLabel: "40–500 млн ₽", minAgeMonths: 12, term: "до 36 мес.", geography: "limited", geographyLabel: "Россия, ограниченная география", rate: "ключевая ставка + 4%", commissionRate: .01, commissionLabel: "1% от суммы кредита", comment: "Выгодные ставки по исходным условиям" },
  { id: "psb", provider: "Промсвязьбанк", kind: "bank", products: ["КИК", "ПОС"], maxLimit: 100 * M, limitLabel: "до 100 млн ₽", minAgeMonths: 12, term: "ПОС до 36 мес.; КИК до 26 мес.", geography: "exclude-south", geographyLabel: "Россия, кроме Северного Кавказа", rate: "от 17,72%", commissionRate: .005, commissionLabel: "0,5% от суммы кредита", comment: "Минимальный комплект по исходным условиям" },
  { id: "globus", provider: "Банк Глобус", kind: "bank", products: ["КИК", "ПОС"], maxLimit: 140 * M, limitLabel: "до 140 млн ₽", minAgeMonths: 12, term: "до 84 мес.", geography: "moscow", geographyLabel: "Москва и Московская область", rate: "ключевая ставка + 3%", commissionRate: .01, commissionLabel: "1% от суммы кредита", comment: "Индивидуальные условия" },
  { id: "sovcom", provider: "Совкомбанк", kind: "bank", products: ["КИК", "ПОС"], limitLabel: "до 30 млн ₽ без залога; свыше — с залогом", minAgeMonths: 12, term: "до 60 мес.", geography: "exclude-south-crimea", geographyLabel: "Россия, кроме Крыма и Северного Кавказа", rate: "ключевая ставка + 3%", commissionRate: .01, commissionLabel: "1% от суммы кредита", collateral: "over-30m", comment: "Минимальный комплект по исходным условиям" },
  { id: "tbank", provider: "Т-Банк", kind: "bank", products: ["КИК", "ПОС", "ВКЛ", "Овердрафт"], maxLimit: 500 * M, limitLabel: "до 500 млн ₽", minAgeMonths: 3, term: "до 60 мес.", geography: "all", geographyLabel: "Вся Россия", rate: "от 1,5–3,5% в месяц; крупные чеки — ключевая ставка + 3%", commissionRate: .005, commissionLabel: "0,5% от суммы кредита", comment: "Быстрое рассмотрение" },
  { id: "alfa-pos", provider: "Альфа-Банк", kind: "bank", products: ["ПОС"], maxLimit: 200 * M, limitLabel: "до 200 млн ₽", minAgeMonths: 9, term: "до 36 мес.", geography: "exclude-south-crimea", geographyLabel: "Россия, кроме Крыма и Северного Кавказа", rate: "от 19%", commissionRate: .005, commissionLabel: "0,5% по ПОС", comment: "Индивидуальное рассмотрение" },
  { id: "alfa-lines", provider: "Альфа-Банк", kind: "bank", products: ["КИК", "ВКЛ", "Овердрафт"], maxLimit: 200 * M, limitLabel: "до 200 млн ₽", minAgeMonths: 9, term: "до 36 мес.", geography: "exclude-south-crimea", geographyLabel: "Россия, кроме Крыма и Северного Кавказа", rate: "от 19%", commissionRate: .0025, commissionLabel: "0,25% по ВКЛ и кредитной карте", comment: "Индивидуальное рассмотрение" },
  { id: "yandex", provider: "Яндекс Банк", kind: "bank", products: ["КИК", "ПОС"], maxLimit: 1.5 * B, limitLabel: "до 1,5 млрд ₽", minAgeMonths: 12, term: "до 12 мес.", geography: "exclude-south-crimea", geographyLabel: "Россия, кроме Крыма и Северного Кавказа", rate: "от 16%", commissionRate: .01, commissionLabel: "1% от суммы кредита", comment: "Быстрое рассмотрение" },
  { id: "bspb", provider: "Банк Санкт-Петербург", kind: "bank", products: ["КИК", "ПОС", "НКЛ", "Рефинансирование"], maxLimit: 10 * M, limitLabel: "до 10 млн ₽", minAgeMonths: 12, term: "до 26 мес.", geography: "limited", geographyLabel: "Россия, ограниченная география", rate: "от 25,83%", commissionRate: .01, commissionLabel: "1% от суммы кредита", comment: "Индивидуальное рассмотрение" },
  { id: "domrf", provider: "Банк ДОМ.РФ", kind: "bank", products: ["КИК", "ВКЛ", "Рефинансирование"], maxLimit: 300 * M, limitLabel: "до 300 млн ₽", minAgeMonths: 12, term: "до 60 мес.", geography: "exclude-south", geographyLabel: "Россия, кроме Северного Кавказа", rate: "от 24%", commissionRate: .01, commissionLabel: "1% от суммы кредита", comment: "Льготные программы требуют отдельного подтверждения" },
  { id: "vtb", provider: "ВТБ", kind: "bank", products: ["КИК", "ПОС"], maxLimit: 30 * M, limitLabel: "до 30 млн ₽", minAgeMonths: 12, term: "до 36 мес.", geography: "exclude-south-crimea", geographyLabel: "Россия, кроме Крыма и Северного Кавказа", rate: "от 26%", commissionRate: .01, commissionLabel: "1% от суммы кредита", comment: "Быстрое решение" },
  { id: "sdm", provider: "СДМ-Банк", kind: "bank", products: ["КИК", "НКЛ", "ВКЛ", "Овердрафт"], maxLimit: 500 * M, limitLabel: "до 500 млн ₽", minAgeMonths: 12, term: "до 60 мес.", geography: "limited", geographyLabel: "Россия, ограниченная география", rate: "ключевая ставка + 4,6%", commissionRate: .01, commissionLabel: "1% от суммы кредита", comment: "Индивидуальное рассмотрение" },
  { id: "msp", provider: "МСП Банк", kind: "bank", products: ["ПОС", "КИК"], maxLimit: 50 * M, limitLabel: "до 50 млн ₽", minAgeMonths: 12, term: "до 36 мес.", geography: "all", geographyLabel: "Вся Россия", rate: "от 22,5%", commissionRate: .005, commissionLabel: "0,5% от суммы кредита", comment: "Выгодные ставки по исходным условиям" },
  { id: "levoberezhny", provider: "Банк Левобережный", kind: "bank", products: ["КИК"], maxLimit: 60 * M, limitLabel: "до 60 млн ₽", minAgeMonths: 12, term: "до 12 мес.", geography: "exclude-south-crimea", geographyLabel: "Россия, кроме Крыма и Северного Кавказа", rate: "ключевая ставка + 8%", commissionRate: .01, commissionLabel: "1% от суммы кредита", comment: "Контрактный маршрут" },
  { id: "uralsib", provider: "Уралсиб", kind: "bank", products: ["КИК", "ПОС", "ВКЛ", "Овердрафт", "Рефинансирование"], maxLimit: 200 * M, limitLabel: "до 200 млн ₽", minAgeMonths: 18, term: "до 36 мес.", geography: "exclude-south-crimea", geographyLabel: "Россия, кроме Крыма и Северного Кавказа", rate: "от 28%", commissionRate: .01, commissionLabel: "1% от суммы кредита", comment: "Доступно рефинансирование" },

  { id: "venets", provider: "Банк Венец", kind: "bank", products: ["КИК", "ПОС", "Овердрафт"], maxLimit: 100 * M, limitLabel: "до 100 млн ₽", minAgeMonths: 12, term: "до 36 мес.", geography: "limited", geographyLabel: "Россия, ограниченная география", rate: "ключевая ставка + 5%", commissionRate: .01, commissionLabel: "1% от суммы кредита", collateral: true, comment: "Только с залогом" },
  { id: "prostobank", provider: "ПростоБанк / Банк КУБ", kind: "bank", products: ["ВКЛ"], maxLimit: 10 * M, limitLabel: "до 10 млн ₽", minAgeMonths: 12, term: "до 22 мес.", geography: "limited", geographyLabel: "Россия, ограниченная география", rate: "ключевая ставка + 7%", commissionRate: .01, commissionLabel: "1% от суммы кредита", collateral: true, comment: "Только с залогом" },
  { id: "solid", provider: "Солид Банк", kind: "bank", products: ["ВКЛ", "НКЛ"], minLimit: 50 * M, maxLimit: 1.2 * B, limitLabel: "50 млн – 1,2 млрд ₽", minAgeMonths: 12, term: "до 24 мес.", geography: "limited", geographyLabel: "Россия, ограниченная география", rate: "ключевая ставка + 3%", commissionRate: .01, commissionLabel: "1% от суммы кредита", collateral: true, comment: "Только с залогом" },
  { id: "primsoc", provider: "Примсоцбанк", kind: "bank", products: ["КИК", "ПОС", "ВКЛ"], maxLimit: 100 * M, limitLabel: "до 100 млн ₽", minAgeMonths: 12, term: "до 60 мес.", geography: "limited", geographyLabel: "Россия, ограниченная география", rate: "от 25,5%", commissionRate: .005, commissionLabel: "0,5% от суммы кредита", collateral: true, comment: "Только с залогом" },

  { id: "investmen", provider: "ИНВЕСТМЕН", kind: "mfo", products: ["КИК", "ПОС"], maxLimit: 5 * M, limitLabel: "до 5 млн ₽", minAgeMonths: 12, term: "до 12 мес.", geography: "exclude-south-crimea", geographyLabel: "Россия, кроме Крыма и Северного Кавказа", rate: "30%", commissionRate: .01, commissionLabel: "1% от займа и пролонгации", comment: "Резервный маршрут; проверить полную стоимость" },
  { id: "fordevind", provider: "МФК Фордевинд", kind: "mfo", products: ["КИК", "ПОС", "Селлеры"], maxLimit: 300 * M, limitLabel: "до 300 млн ₽", minAgeMonths: 12, term: "до 6 мес.", geography: "exclude-south-crimea", geographyLabel: "Россия, кроме Крыма и Северного Кавказа", rate: "3–3,5% в месяц", commissionRate: .01, commissionLabel: "1% от суммы кредита", comment: "Минимальный комплект; короткий дорогой ресурс" },
  { id: "invoicecafe", provider: "ИнвойсКафе", kind: "mfo", products: ["КИК", "ПОС", "Селлеры"], maxLimit: 20 * M, limitLabel: "до 20 млн ₽", minAgeMonths: 12, term: "до 24 мес.", geography: "exclude-south", geographyLabel: "Россия, кроме Северного Кавказа", rate: "от 28%", commissionRate: .005, commissionLabel: "0,5% от суммы кредита", comment: "Быстрое решение" },
  { id: "summit", provider: "МФК Саммит", kind: "mfo", products: ["КИК", "ПОС", "Селлеры"], maxLimit: .1 * M, limitLabel: "до 100 тыс. ₽", minAgeMonths: 3, term: "до 24 мес.", geography: "limited", geographyLabel: "Россия, ограниченная география", rate: "от 5,5% в месяц", commissionRate: .01, commissionLabel: "1% от суммы кредита", subject: "ip-only", comment: "Только для ИП; проверить полную стоимость" },
  { id: "liga-capital", provider: "МКК Лига капитал", kind: "mfo", products: ["КИК", "ПОС", "Селлеры"], maxLimit: 15 * M, limitLabel: "до 15 млн ₽", minAgeMonths: 12, term: "до 3 мес.", geography: "moscow", geographyLabel: "Москва и Московская область", rate: "3% в месяц", commissionRate: .01, commissionLabel: "1% от суммы кредита", comment: "Короткий дорогой ресурс" },
  { id: "mk", provider: "МФК МК", kind: "mfo", products: ["КИК", "ПОС", "Селлеры"], maxLimit: 30 * M, limitLabel: "до 30 млн ₽", minAgeMonths: 12, term: "до 12 мес.", geography: "exclude-south-crimea", geographyLabel: "Россия, кроме Крыма и Северного Кавказа", rate: "3% в месяц", commissionRate: .005, commissionLabel: "0,5% от суммы кредита", comment: "Резервный маршрут; проверить полную стоимость" },
  { id: "ozon-credit", provider: "ОЗОН КРЕДИТ", kind: "mfo", products: ["КИК", "ПОС", "Селлеры"], maxLimit: 2 * B, limitLabel: "до 2 млрд ₽", minAgeMonths: 12, term: "до 180 мес.", geography: "exclude-south-crimea", geographyLabel: "Россия, кроме Крыма и Северного Кавказа", rate: "от 0,97% в месяц", commissionRate: .005, commissionCap: 25_000, commissionLabel: "0,5%, но не более 25 тыс. ₽", comment: "Без открытия РКО; вознаграждение ограничено" },
  { id: "jetlend", provider: "Джетленд", kind: "mfo", products: ["КИК", "ПОС", "Селлеры"], maxLimit: 100 * M, limitLabel: "до 100 млн ₽", minAgeMonths: 12, term: "до 36 мес.", geography: "all", geographyLabel: "Вся Россия", rate: "от 17,5%", commissionRate: .004, commissionLabel: "0,4% от суммы кредита", comment: "Быстрое решение" },
  { id: "click-invest", provider: "Клик Инвест", kind: "mfo", products: ["ТЗ", "КИК", "ПОС"], maxLimit: 10 * M, limitLabel: "до 10 млн ₽", minAgeMonths: 12, term: "до 90 дней", geography: "exclude-south-crimea", geographyLabel: "Россия, кроме Крыма и Северного Кавказа", rate: "8% в месяц", commissionRate: .01, commissionLabel: "1% от кредита и пролонгации", comment: "Рассмотрение и выдача за 1 день; высокая стоимость" },
  { id: "potok", provider: "Поток.Диджитал", kind: "mfo", products: ["КИК", "ПОС", "Селлеры"], maxLimit: 25 * M, limitLabel: "до 25 млн ₽", minAgeMonths: 6, term: "до 24 мес.", geography: "exclude-south", geographyLabel: "Россия, кроме Северного Кавказа", rate: "от 21%", commissionRate: .01, commissionLabel: "1% от суммы кредита", comment: "Минимальный комплект" },
  { id: "vipzaim", provider: "МКК Випзайм", kind: "mfo", products: ["ПОС"], maxLimit: 1 * M, limitLabel: "до 1 млн ₽", minAgeMonths: 3, term: "до 180 дней", geography: "exclude-south", geographyLabel: "Россия, кроме Северного Кавказа", rate: "от 0,4% в день", commissionRate: .015, commissionLabel: "1,5% от суммы кредита", comment: "Очень высокая стоимость; только после расчёта экономики" },
  { id: "bro22", provider: "МКК Бро 22", kind: "mfo", products: ["КИК", "ПОС", "Селлеры"], maxLimit: 20 * M, limitLabel: "до 20 млн ₽", minAgeMonths: 24, term: "до 12 мес.", geography: "exclude-south-crimea", geographyLabel: "Россия, кроме Крыма и Северного Кавказа", rate: "3% в месяц", commissionRate: .01, commissionLabel: "1% от суммы кредита", comment: "Индивидуальное рассмотрение" },
  { id: "growth-share", provider: "Доля роста", kind: "mfo", products: ["КИК", "ПОС", "Партнёрское финансирование"], maxLimit: 20 * M, limitLabel: "до 20 млн ₽; партнёрское — до 15 млн ₽", minAgeMonths: 12, term: "до 12 мес.; партнёрское — до 49 лет", geography: "exclude-south-crimea", geographyLabel: "Россия, кроме Крыма и Северного Кавказа", rate: "от 30%", commissionRate: .005, commissionLabel: "0,5% от суммы кредита", comment: "Партнёрское финансирование — отдельная правовая и экономическая проверка" },
  { id: "lendly", provider: "Лендли", kind: "mfo", products: ["КИК", "ПОС", "Селлеры"], maxLimit: 50 * M, limitLabel: "до 50 млн ₽", minAgeMonths: 1, term: "до 18 мес.", geography: "limited", geographyLabel: "Россия, ограниченная география", rate: "от 28%", commissionRate: .01, commissionLabel: "1% от суммы займа", collateral: true, comment: "Только с залогом" },
  { id: "vremyadengi", provider: "ВремяДеньги", kind: "mfo", products: ["КИК", "ПОС", "Селлеры"], maxLimit: 100 * M, limitLabel: "до 100 млн ₽", minAgeMonths: 12, term: "до 6 мес.", geography: "exclude-south-crimea", geographyLabel: "Россия, кроме Крыма и Северного Кавказа", rate: "3–3,5% в месяц", commissionRate: .01, commissionLabel: "1% от суммы займа", collateral: true, comment: "Только с залогом; короткий дорогой ресурс" },
  { id: "delo-dengi", provider: "Дело и Деньги", kind: "mfo", products: ["КИК", "ПОС", "Селлеры"], maxLimit: 30 * M, limitLabel: "до 30 млн ₽", minAgeMonths: 6, term: "до 12 мес.", geography: "limited", geographyLabel: "Россия, ограниченная география", rate: "от 3% в месяц", commissionRate: .005, commissionLabel: "0,5% от суммы займа", collateral: true, comment: "Только с залогом" },
  { id: "euro-express", provider: "Европейский Экспресс Кредит", kind: "mfo", products: ["КИК", "ПОС", "Селлеры"], maxLimit: 20 * M, limitLabel: "до 20 млн ₽", minAgeMonths: 0, term: "до 12 мес.", geography: "moscow", geographyLabel: "Москва и Московская область", rate: "от 6% в месяц", commissionRate: .01, commissionLabel: "1% от суммы займа", collateral: true, comment: "Только с залогом; высокая стоимость" },
  { id: "lender-invest", provider: "Лэндэр-Инвест", kind: "mfo", products: ["КИК", "ПОС", "Селлеры"], maxLimit: 999 * M, limitLabel: "до 999 млн ₽", minAgeMonths: 6, term: "до 60 мес.", geography: "all", geographyLabel: "Вся Россия", rate: "от 21%", commissionRate: .005, commissionLabel: "0,5% от суммы займа", collateral: true, comment: "Только с залогом" },
  { id: "vdelo", provider: "ВДЕЛО", kind: "mfo", products: ["КИК", "ПОС", "Селлеры"], maxLimit: 10 * M, limitLabel: "до 10 млн ₽", minAgeMonths: 12, term: "до 12 мес.", geography: "exclude-south-crimea", geographyLabel: "Россия, кроме Крыма и Северного Кавказа", rate: "от 30%", commissionRate: .01, commissionLabel: "1% от суммы займа", collateral: true, comment: "Только с залогом" },

  { id: "rovi-factor", provider: "Рови Факторинг Плюс", kind: "factoring", products: ["Факторинг"], maxLimit: 200 * M, limitLabel: "до 200 млн ₽", minAgeMonths: 0, term: "до 180 дней", geography: "all", geographyLabel: "География уточняется", rate: "индивидуально", commissionLabel: "Не указано", comment: "Финансирование под уступку денежного требования" },
  { id: "ksk-factor", provider: "КСК", kind: "factoring", products: ["Факторинг"], maxLimit: 100 * M, limitLabel: "до 100 млн ₽", minAgeMonths: 0, term: "до 200 дней", geography: "all", geographyLabel: "География уточняется", rate: "от 21%", commissionRate: .01, commissionLabel: "1% годовых", comment: "Нужны договор, реестр дебиторки и документы приёмки" },
  { id: "ozon-invest-factor", provider: "Озон Инвест", kind: "factoring", products: ["Факторинг"], maxLimit: 500 * M, limitLabel: "до 500 млн ₽", minAgeMonths: 0, term: "до 180 дней", geography: "all", geographyLabel: "География уточняется", rate: "индивидуально", commissionRate: .005, commissionLabel: "0,5% годовых", comment: "Нужны договор, реестр дебиторки и документы приёмки" },
  { id: "sovcom-factor", provider: "Совкомбанк", kind: "factoring", products: ["Факторинг"], maxLimit: 500 * M, limitLabel: "до 500 млн ₽", minAgeMonths: 0, term: "до 200 дней", geography: "all", geographyLabel: "География уточняется", rate: "от 22,5%", commissionRate: .005, commissionLabel: "0,5% годовых", comment: "Финансирование зависит от качества дебитора" },
  { id: "bspb-factor", provider: "Банк Санкт-Петербург", kind: "factoring", products: ["Факторинг"], maxLimit: 100 * M, limitLabel: "до 100 млн ₽", minAgeMonths: 0, term: "до 180 дней", geography: "all", geographyLabel: "География уточняется", rate: "индивидуально", commissionLabel: "Не указано", comment: "Финансирование зависит от качества дебитора" },

  { id: "seller-capital", provider: "Seller Capital", kind: "seller", products: ["Финансирование селлеров"], maxLimit: 50 * M, limitLabel: "до 50 млн ₽", minAgeMonths: 6, term: "3–12 мес.", geography: "all", geographyLabel: "Вся Россия", rate: "от 1,75% в месяц", commissionRate: .005, commissionLabel: "0,5% от суммы кредита", comment: "Гибкие транши; проверяются обороты площадок" },
  { id: "metallinvest-seller", provider: "Металлинвестбанк", kind: "seller", products: ["Финансирование селлеров"], maxLimit: 150 * M, limitLabel: "до 150 млн ₽", minAgeMonths: 9, term: "до 24 мес.", geography: "exclude-south-crimea", geographyLabel: "Россия, кроме Крыма и новых территорий", rate: "от 25,5%", commissionRate: .01, commissionLabel: "1% от суммы кредита", comment: "Для продавцов на маркетплейсах" },
  { id: "cofi-seller", provider: "Ко-Фи", kind: "seller", products: ["Финансирование селлеров"], maxLimit: 100 * M, limitLabel: "до 100 млн ₽", minAgeMonths: 4, term: "6, 9 или 12 мес.", geography: "all", geographyLabel: "Вся Россия", rate: "21–35%", commissionRate: .01, commissionLabel: "1% от суммы кредита", comment: "Проверяются продажи, остатки и сезонность" },

  { id: "europlan", provider: "Европлан", kind: "leasing", products: ["Лизинг"], maxLimit: 500 * M, limitLabel: "до 500 млн ₽", minAgeMonths: 0, term: "до 60 мес.", geography: "all", geographyLabel: "География уточняется", rate: "13–15%", commissionLabel: "Не указано", assetTypes: ["Авто", "Оборудование", "Недвижимость"], comment: "Предмет сделки служит экономическим основанием" },
  { id: "sber-leasing", provider: "Сбербанк Лизинг", kind: "leasing", products: ["Лизинг"], maxLimit: 50 * M, limitLabel: "до 50 млн ₽", minAgeMonths: 0, term: "до 60 мес.", geography: "all", geographyLabel: "География уточняется", rate: "13–15%", commissionLabel: "Не указано", assetTypes: ["Авто", "Оборудование", "Недвижимость"], comment: "Проверить аванс и ликвидность предмета" },
  { id: "msb-leasing", provider: "МСБ-ЛИЗИНГ", kind: "leasing", products: ["Лизинг"], maxLimit: 100 * M, limitLabel: "до 100 млн ₽", minAgeMonths: 0, term: "до 60 мес.", geography: "all", geographyLabel: "География уточняется", rate: "13–15%", commissionLabel: "Не указано", assetTypes: ["Авто", "Оборудование", "Нестандартные предметы"], comment: "Проверить аванс и ликвидность предмета" },
  { id: "vtb-leasing", provider: "ВТБ Лизинг", kind: "leasing", products: ["Лизинг"], maxLimit: 80 * M, limitLabel: "до 80 млн ₽", minAgeMonths: 0, term: "до 60 мес.", geography: "all", geographyLabel: "География уточняется", rate: "10–20%", commissionLabel: "Не указано", assetTypes: ["Авто"], comment: "Проверить аванс и график" },
  { id: "sovcom-leasing", provider: "Совкомбанк Лизинг", kind: "leasing", products: ["Лизинг"], maxLimit: 100 * M, limitLabel: "до 100 млн ₽", minAgeMonths: 0, term: "до 60 мес.", geography: "all", geographyLabel: "География уточняется", rate: "10–20%", commissionLabel: "Не указано", assetTypes: ["Авто", "Оборудование"], comment: "Проверить аванс и ликвидность предмета" },
  { id: "ozon-leasing", provider: "Озон Лизинг", kind: "leasing", products: ["Лизинг"], maxLimit: 300 * M, limitLabel: "до 300 млн ₽", minAgeMonths: 0, term: "до 60 мес.", geography: "all", geographyLabel: "География уточняется", rate: "13–15%", commissionLabel: "Не указано", assetTypes: ["Авто", "Оборудование", "Недвижимость"], comment: "Проверить аванс и налоговый эффект" },
  { id: "gpb-leasing", provider: "Газпромбанк Автолизинг", kind: "leasing", products: ["Лизинг"], maxLimit: 60 * M, limitLabel: "до 60 млн ₽", minAgeMonths: 0, term: "до 60 мес.", geography: "all", geographyLabel: "География уточняется", rate: "13–15%", commissionLabel: "Не указано", assetTypes: ["Авто", "Оборудование", "Недвижимость"], comment: "Проверить аванс и налоговый эффект" },
  { id: "carcade", provider: "CARCADE Лизинг", kind: "leasing", products: ["Лизинг"], limitLabel: "без указанного ограничения", minAgeMonths: 0, term: "до 60 мес.", geography: "all", geographyLabel: "География уточняется", rate: "7–15%", commissionLabel: "Не указано", assetTypes: ["Авто"], comment: "Лимит и аванс подтверждаются индивидуально" },

  { id: "capital-development", provider: "Банк Развитие Столица", kind: "secured-personal", products: ["Кредит физлица под залог квартиры"], maxLimit: 80 * M, limitLabel: "до 80 млн ₽", minAgeMonths: 0, term: "до 15 лет", geography: "moscow", geographyLabel: "Москва и Московская область", rate: "от 24%", commissionLabel: "Не указано", collateral: true, subject: "individual", assetTypes: ["Квартира"], comment: "Не является корпоративным кредитом; требуется отдельное решение и согласие физлица" },
  { id: "bzhf", provider: "Банк БЖФ", kind: "secured-personal", products: ["Кредит физлица под залог квартиры"], maxLimit: 30 * M, limitLabel: "до 30 млн ₽", minAgeMonths: 0, term: "до 25 лет", geography: "regions", geographyLabel: "Регионы присутствия", rate: "от 21%", commissionLabel: "Не указано", collateral: true, subject: "individual", assetTypes: ["Квартира"], comment: "Отдельная оценка физлица и объекта" },
  { id: "credit-club", provider: "Кредит.Клаб", kind: "secured-personal", products: ["Кредит физлица под залог квартиры"], maxLimit: 15 * M, limitLabel: "до 15 млн ₽", minAgeMonths: 0, term: "до 20 лет", geography: "cities-250", geographyLabel: "250 городов", rate: "от 20%", commissionLabel: "Не указано", collateral: true, subject: "individual", assetTypes: ["Квартира"], comment: "Не является корпоративным кредитом; требуется отдельное решение и согласие физлица" },
];

export const financingOfferCounts = financingOffers.reduce<Record<FundingKind, number>>((result, offer) => {
  result[offer.kind] += 1;
  return result;
}, { bank: 0, mfo: 0, factoring: 0, seller: 0, leasing: 0, "secured-personal": 0 });

export const needProductMap: Record<Exclude<FinancingNeed, "auto">, string[]> = {
  "working-capital": ["КИК", "ПОС", "ВКЛ"],
  "staged-limit": ["ВКЛ", "НКЛ"],
  "cash-gap": ["Овердрафт"],
  receivables: ["Факторинг"],
  "government-contract": ["КИК"],
  marketplace: ["Финансирование селлеров", "Селлеры"],
  equipment: ["Лизинг"],
  refinance: ["Рефинансирование"],
  secured: ["КИК", "ПОС", "ВКЛ", "НКЛ", "Кредит физлица под залог квартиры"],
};

export function offerSupportsNeed(offer: FinancingOffer, need: FinancingNeed) {
  if (need === "auto") return true;
  if (need === "secured") return Boolean(offer.collateral);
  return offer.products.some((product) => needProductMap[need].some((expected) => product.includes(expected) || expected.includes(product)));
}
