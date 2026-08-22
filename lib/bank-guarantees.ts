export type GuaranteeRequest = {
  amount: number;
  law: string;
  guaranteeType: string;
  termDays?: number | null;
  opf?: string;
  ageMonths?: number | null;
  region?: string;
};

export type GuaranteePolicy = {
  id: string;
  provider: string;
  providerConfirmed: boolean;
  minAmount: number;
  maxAmount: number;
  principalLimit: number;
  maxTermDays: number | null;
  laws: string[];
  types: string[];
  minAgeMonths: number;
  opf: string[];
  regionStop: string[];
  note: string;
};

const allTypes = ["Участие", "Исполнение контракта", "Возврат аванса", "Гарантийные обязательства"];

export const guaranteePolicies: GuaranteePolicy[] = [
  { id: "bg-01", provider: "ВТБ", providerConfirmed: true, minAmount: 300_000, maxAmount: 100_000_000, principalLimit: 200_000_000, maxTermDays: 1885, laws: ["44-ФЗ", "223-ФЗ", "615-ПП", "Коммерция"], types: allTypes, minAgeMonths: 6, opf: ["ООО", "АО", "ПАО", "ИП"], regionStop: ["ДНР", "ЛНР", "Запорож", "Херсон"], note: "Коммерческие гарантии и гарантии в пользу ФНС/ФТС имеют отдельные лимиты и сроки." },
  { id: "bg-02", provider: "Партнёр БГ №2", providerConfirmed: false, minAmount: 100_000, maxAmount: 200_000_000, principalLimit: 250_000_000, maxTermDays: 1885, laws: ["44-ФЗ", "223-ФЗ", "615-ПП", "Коммерция"], types: allTypes, minAgeMonths: 6, opf: ["ООО", "АО", "ПАО", "ГУП", "МУП", "ИП"], regionStop: [], note: "Повышенный лимит для медицинской деятельности; требуется годовая отчётность." },
  { id: "bg-03", provider: "Партнёр БГ №3", providerConfirmed: false, minAmount: 10_000, maxAmount: 50_000_000, principalLimit: 50_000_000, maxTermDays: 1861, laws: ["44-ФЗ", "223-ФЗ", "615-ПП", "Коммерция"], types: allTypes, minAgeMonths: 6, opf: ["ООО", "ИП"], regionStop: ["ДНР", "ЛНР", "Запорож", "Херсон"], note: "Лимит зависит от годовой выручки; закрытые закупки допустимы без гостайны." },
  { id: "bg-04", provider: "Партнёр БГ №4", providerConfirmed: false, minAmount: 100_000, maxAmount: 100_000_000, principalLimit: 150_000_000, maxTermDays: 1930, laws: ["44-ФЗ", "223-ФЗ", "Коммерция"], types: allTypes, minAgeMonths: 12, opf: ["ООО", "АО", "ПАО", "ФГУП", "ГУП", "МУП", "ИП"], regionStop: ["Крым", "Севастополь", "ДНР", "ЛНР", "Запорож", "Херсон", "Курск", "Брянск", "Белгород"], note: "Возможны поручительство, депозит, страхование, залог или перевод оборотов." },
  { id: "bg-05", provider: "ББР Банк", providerConfirmed: true, minAmount: 100_000, maxAmount: 100_000_000, principalLimit: 100_000_000, maxTermDays: 1950, laws: ["44-ФЗ", "223-ФЗ", "Коммерция"], types: allTypes, minAgeMonths: 12, opf: ["ООО", "АО", "ПАО", "ФГУП", "ГУП", "МУП"], regionStop: ["Крым", "Севастополь", "ДНР", "ЛНР", "Запорож", "Херсон", "Дагестан", "Ингуш", "Чечен", "Осет"], note: "Для гарантийных обязательств проверяется, где выпускались ОИК и аванс." },
  { id: "bg-06", provider: "НОВИКОМ", providerConfirmed: true, minAmount: 3_000_000, maxAmount: 50_000_000, principalLimit: 150_000_000, maxTermDays: 1127, laws: ["44-ФЗ", "223-ФЗ", "275-ФЗ", "Коммерция"], types: allTypes, minAgeMonths: 12, opf: ["ООО", "АО", "ПАО", "ФГУП", "ГУП", "МУП"], regionStop: [], note: "Свыше 10 млн ₽ обычно требуется срок деятельности от 36 месяцев." },
  { id: "bg-07", provider: "Партнёр БГ №7", providerConfirmed: false, minAmount: 500_000, maxAmount: 15_000_000, principalLimit: 15_000_000, maxTermDays: 2956, laws: ["44-ФЗ", "223-ФЗ"], types: ["Исполнение контракта", "Возврат аванса", "Гарантийные обязательства"], minAgeMonths: 12, opf: ["ООО", "АО", "ПАО"], regionStop: ["Крым", "Севастополь", "ДНР", "ЛНР", "Запорож", "Херсон", "Дагестан", "Ингуш", "Чечен", "Осет"], note: "Увеличенный срок предусмотрен для энергосервисных контрактов." },
  { id: "bg-08", provider: "Партнёр БГ №8", providerConfirmed: false, minAmount: 100_000, maxAmount: 50_000_000, principalLimit: 100_000_000, maxTermDays: 1885, laws: ["44-ФЗ", "223-ФЗ", "Коммерция"], types: allTypes, minAgeMonths: 12, opf: ["ООО", "АО", "ПАО", "ФГУП", "ГУП", "МУП"], regionStop: ["Крым", "Севастополь", "ДНР", "ЛНР", "Запорож", "Херсон", "Ростов", "Белгород", "Курск", "Дагестан", "Ингуш", "Чечен", "Осет", "Ставропол"], note: "Для коммерческой гарантии дополнительно проверяются параметры бенефициара." },
  { id: "bg-09", provider: "Партнёр БГ №9", providerConfirmed: false, minAmount: 100_000, maxAmount: 50_000_000, principalLimit: 100_000_000, maxTermDays: 2191, laws: ["44-ФЗ", "223-ФЗ", "615-ПП", "Коммерция"], types: ["Участие", "Исполнение контракта", "Гарантийные обязательства"], minAgeMonths: 3, opf: ["ООО", "АО", "ПАО", "ФГУП", "ГУП", "МУП", "ИП"], regionStop: ["Курск", "Брянск", "Белгород"], note: "Минимальный возраст зависит от суммы и наличия аванса; по 615-ПП действует отдельный лимит." },
  { id: "bg-10", provider: "Партнёр БГ №10", providerConfirmed: false, minAmount: 100_000, maxAmount: 10_000_000, principalLimit: 30_000_000, maxTermDays: null, laws: ["44-ФЗ", "223-ФЗ"], types: allTypes, minAgeMonths: 6, opf: ["ООО", "ИП"], regionStop: [], note: "Только субъекты МСП; для ИП сумма обычно ограничена 1 млн ₽." },
  { id: "bg-13", provider: "Партнёр БГ №13", providerConfirmed: false, minAmount: 1_000_000, maxAmount: 14_000_000, principalLimit: 14_000_000, maxTermDays: 1500, laws: ["44-ФЗ", "223-ФЗ"], types: ["Участие", "Исполнение контракта", "Гарантийные обязательства"], minAgeMonths: 6, opf: ["ООО", "АО", "ПАО", "ФГУП", "ГУП", "МУП", "ИП"], regionStop: ["Крым", "Севастополь", "Дагестан", "Ингуш", "Чечен", "Осет", "Адыге", "Кабардино", "Карачаево"], note: "Переобеспечение рассматривается только в предусмотренных политикой случаях." },
  { id: "bg-11", provider: "Партнёр БГ №11", providerConfirmed: false, minAmount: 500_000, maxAmount: 25_000_000, principalLimit: 25_000_000, maxTermDays: 540, laws: ["44-ФЗ", "223-ФЗ"], types: ["Участие", "Исполнение контракта"], minAgeMonths: 6, opf: ["ООО", "АО", "ПАО", "ИП"], regionStop: ["Алтай", "Калмык", "Мордов", "Хакас", "Тыва", "Татарстан", "Краснодар", "Белгород", "Брянск", "Воронеж", "Курск", "Ростов", "Оренбург"], note: "Исполнение — без аванса; по 223-ФЗ преимущественно участие." },
  { id: "bg-extra-01", provider: "Партнёр БГ · крупный лимит №1", providerConfirmed: false, minAmount: 50_000_000, maxAmount: 500_000_000, principalLimit: 500_000_000, maxTermDays: null, laws: ["44-ФЗ", "223-ФЗ", "Коммерция"], types: ["Исполнение контракта", "Возврат аванса", "Гарантийные обязательства"], minAgeMonths: 12, opf: ["ООО", "АО", "ПАО", "ФГУП", "ГУП", "МУП", "ИП"], regionStop: [], note: "Ограничения по общему сроку нет; гарантийные обязательства — до 10 лет и 2 месяцев. Крым и новые территории рассматриваются индивидуально." },
  { id: "bg-extra-02", provider: "Партнёр БГ · крупный лимит №2", providerConfirmed: false, minAmount: 50_000_000, maxAmount: 150_000_000, principalLimit: 500_000_000, maxTermDays: 1959, laws: ["44-ФЗ", "223-ФЗ", "Коммерция"], types: allTypes, minAgeMonths: 12, opf: ["ООО", "АО", "ПАО", "ФГУП", "ГУП", "МУП"], regionStop: ["Дагестан", "Ингуш", "Осет", "Чечен", "ДНР", "ЛНР", "Запорож", "Херсон", "Севастополь"], note: "Свыше 150 млн ₽ требуется обеспечение. Отдельно проверяются стоп-заказчики и стоп-деятельность, включая жилищное строительство и развлечения." },
  { id: "bg-extra-03", provider: "Партнёр БГ · крупный лимит №3", providerConfirmed: false, minAmount: 50_000_000, maxAmount: 200_000_000, principalLimit: 200_000_000, maxTermDays: 1096, laws: ["44-ФЗ", "223-ФЗ", "615-ПП", "Коммерция"], types: ["Исполнение контракта", "Возврат аванса"], minAgeMonths: 12, opf: ["ООО", "АО", "ИП"], regionStop: ["Крым", "Севастополь", "ДНР", "ЛНР", "Запорож", "Херсон", "Брянск", "Курск", "Белгород", "Дагестан", "Ингуш", "Чечен", "Осет"], note: "Переобеспечение — только денежными средствами; закрытые закупки и Минобороны не рассматриваются. Есть стоп-заказчики и стоп-предметы контрактов." },
  { id: "bg-extra-04", provider: "Партнёр БГ · крупный лимит №4", providerConfirmed: false, minAmount: 50_000_000, maxAmount: 450_000_000, principalLimit: 500_000_000, maxTermDays: 1826, laws: ["44-ФЗ", "223-ФЗ", "615-ПП", "185-ФЗ", "Коммерция"], types: ["Исполнение контракта", "Возврат аванса", "Гарантийные обязательства"], minAgeMonths: 12, opf: ["ООО", "АО", "ИП"], regionStop: ["Крым", "ДНР", "ЛНР", "Запорож", "Херсон", "Краснодар"], note: "Свыше базовых лимитов требуется дополнительное обеспечение; СКФО и ДВФО рассматриваются индивидуально, закрытые закупки и ГОЗ исключены." },
  { id: "bg-extra-05", provider: "Партнёр БГ · ФКР Москвы", providerConfirmed: false, minAmount: 50_000_000, maxAmount: 200_000_000, principalLimit: 200_000_000, maxTermDays: 730, laws: ["615-ПП", "185-ФЗ"], types: ["Исполнение контракта", "Возврат аванса"], minAgeMonths: 12, opf: ["ООО", "АО", "ИП"], regionStop: [], note: "Специализированный маршрут: принципал — Москва, бенефициар — ФКР Москвы; исполнение либо исполнение с авансом." },
];

function lawMatches(policy: GuaranteePolicy, value: string) {
  const normalized = value.toLowerCase().replace(/\s/g, "");
  return policy.laws.some((law) => normalized.includes(law.toLowerCase().replace(/\s/g, "")) || law.toLowerCase().replace(/\s/g, "").includes(normalized));
}

export function matchGuaranteePolicies(request: GuaranteeRequest) {
  return guaranteePolicies.map((policy) => {
    const rejected: string[] = [];
    const conditions: string[] = [];
    if (request.amount < policy.minAmount || request.amount > policy.maxAmount) rejected.push("сумма вне диапазона");
    if (!lawMatches(policy, request.law)) rejected.push("ФЗ/тип закупки не поддерживается");
    if (!policy.types.some((type) => type.toLowerCase() === request.guaranteeType.toLowerCase())) rejected.push("вид гарантии не поддерживается");
    if (request.termDays != null && policy.maxTermDays != null && request.termDays > policy.maxTermDays) rejected.push("срок превышает политику");
    if (request.ageMonths != null && request.ageMonths < policy.minAgeMonths) rejected.push("недостаточный возраст бизнеса");
    if (request.opf && !policy.opf.some((opf) => request.opf!.toUpperCase().includes(opf))) rejected.push("ОПФ не соответствует политике");
    if (request.region && policy.regionStop.some((stop) => request.region!.toLowerCase().includes(stop.toLowerCase()))) rejected.push("регион требует исключения/согласования");
    if (!policy.providerConfirmed) conditions.push("название партнёра необходимо подтвердить по исходному справочнику");
    if (request.amount > policy.principalLimit) rejected.push("превышен лимит на принципала");
    conditions.push(policy.note);
    return { policy, eligible: rejected.length === 0, rejected, conditions };
  }).sort((a, b) => Number(b.eligible) - Number(a.eligible) || b.policy.maxAmount - a.policy.maxAmount);
}
