import type { CanonicalTransaction } from "../contracts/transactions.ts";
import type { TransactionSignals } from "../contracts/classification.ts";
import { normalizeAmount } from "../normalization/value-normalizers.ts";

function normalizeText(value: string | null | undefined) {
  return (value ?? "").toLowerCase().replace(/ё/g, "е").replace(/[«»„“”]/g, '"').replace(/\s+/g, " ").trim();
}

function extractComponentAmount(text: string, expression: RegExp) {
  const match = text.match(expression);
  if (!match?.[1]) return null;
  return normalizeAmount(match[1]).value;
}

export function buildTransactionSignals(tx: CanonicalTransaction): TransactionSignals {
  const purpose = normalizeText(tx.purposeNormalized || tx.purposeRaw);
  const counterparty = normalizeText(tx.counterparty.nameNormalized || tx.counterparty.nameRaw);
  const flags = new Set<string>();
  const add = (code: string, condition: boolean) => { if (condition) flags.add(code); };

  add("SALE_SPECIFIC", /(оплат[а-яa-z]*|расчет[а-яa-z]*|поступлен[а-яa-z]*).*(товар|материал|услуг|работ|поставк|реализац)|(?:за|по счету за)\s+(?:поставлен[а-яa-z]*\s+)?(?:товар|материал|услуг|работ)|договор[а-яa-z]*.*поставк|выручк/.test(purpose));
  add("GENERIC_CONTRACT_PAYMENT", /оплат[а-яa-z]*\s+по\s+договор/.test(purpose));
  add("CUSTOMER_ADVANCE", /аванс|предоплат|предварительн[а-яa-z]*\s+оплат/.test(purpose));
  add("ACQUIRING_SETTLEMENT", /торгов[а-яa-z]*\s+эквайринг|эквайрингов[а-яa-z]*\s+(зачислен|выплат|возмещ)|merchant\s+settlement|выплат[а-яa-z]*\s+процессинг/.test(purpose));
  const marketplace = /(wildberries|вайлдберриз|\bwb\b|ozon|озон|яндекс\s*маркет|мегамаркет|lamoda|ламода|маркетплейс)/.test(`${purpose} ${counterparty}`);
  add("MARKETPLACE", marketplace);
  add("MARKETPLACE_SETTLEMENT", marketplace && /(выплат|перечислен|зачислен|реестр|settlement|реализац|продаж)/.test(purpose));

  add("LOAN_WORD", /кредит|займ|заем|ссуд/.test(purpose));
  add("BANK_LOAN_RECEIVED", /(выдач|предоставлен|зачислен|получен).*кредит|кредитн[а-яa-z]*\s+(средств|транш)|транш.*кредитн[а-яa-z]*\s+лини/.test(purpose));
  add("OTHER_LOAN_RECEIVED", /(займ|заем)\s+от|получен[а-яa-z]*\s+(займ|заем)|предоставлен[а-яa-z]*\s+(займ|заем)\s+компани/.test(purpose));
  add("OWNER", /учредител|собственник|участник/.test(`${purpose} ${counterparty}`));
  add("OWNER_LOAN", /(?:займ|заем).*(?:учредител|собственник|участник)|(?:учредител|собственник|участник).*(?:займ|заем)/.test(purpose));
  add("OWNER_CONTRIBUTION", /вклад.*имущество|взнос.*уставн|увеличен.*капитал|безвозмездн.*вклад|добавочн.*капитал/.test(purpose));
  add("OWNER_FUNDING_UNSPECIFIED", /финансов[а-яa-z]*\s+помощ.*(?:учредител|собственник|участник)|(?:учредител|собственник|участник).*финансов[а-яa-z]*\s+помощ/.test(purpose));
  add("FACTORING", /факторинг|финансирован.*уступк|уступк.*денежн.*требован|вознагражден.*фактор/.test(purpose));
  add("FACTORING_FEE", /(комисси|вознагражден).*(фактор|факторинг)|(фактор|факторинг).*(комисси|вознагражден)/.test(purpose));
  add("LOAN_REPAYMENT_RECEIVED", /(возврат|погашен).*(ранее\s+выданн[а-яa-z]*\s+)?(займ|заем)|возврат.*денежн.*средств.*по.*договор.*займ/.test(purpose));
  add("LOAN_PRINCIPAL", /погашен.*основн[а-яa-z]*\s+долг|возврат.*основн[а-яa-z]*\s+долг|погашен.*кредит(?!.*процент)|возврат.*(?:займ|заем)(?!.*процент)/.test(purpose));
  add("INTEREST", /процент.*(?:кредит|займ|заем)|уплат[а-яa-z]*\s+процент|процентн[а-яa-z]*\s+платеж/.test(purpose));
  add("DEBT_UNSPLIT", /(погашен|возврат).*(кредит|займ|заем).*процент|(основн[а-яa-z]*\s+долг).*процент/.test(purpose));
  add("LEASING", /лизинг|лизингов/.test(purpose));
  add("LOAN_ISSUED", /выдач[а-яa-z]*\s+(займ|заем)|предоставлен[а-яa-z]*\s+(займ|заем)|перечислен.*по\s+договору\s+(займ|заем)|оплат[а-яa-z]*\s+по\s+договору\s+(займ|заем)/.test(purpose));

  add("TAX", /налог|\bндс\b|\bенп\b|единый налогов|налог.*прибыл|\bусн\b|фнс|уфк/.test(`${purpose} ${counterparty}`));
  add("SOCIAL_CONTRIBUTION", /страхов[а-яa-z]*\s+взнос|социальн[а-яa-z]*\s+(взнос|платеж)|сфр|пенсионн[а-яa-z]*\s+взнос/.test(`${purpose} ${counterparty}`));
  add("TAX_REFUND", /(возврат|возмещен).*(налог|ндс|енп)|(налог|ндс).*(возврат|возмещен)/.test(purpose));
  add("SUBSIDY", /субсид|грант|бюджетн[а-яa-z]*\s+финансирован|господдержк/.test(purpose));
  add("INSURANCE_PAYOUT", /страхов[а-яa-z]*\s+(выплат|возмещен)|выплат.*страхов/.test(purpose));

  add("PAYROLL", /заработн[а-яa-z]*\s+плат|зарплат|зарплатн[а-яa-z]*\s+реестр|аванс.*сотрудник/.test(purpose));
  add("EMPLOYEE_REIMBURSEMENT", /под\s*отчет|возмещен[а-яa-z]*\s+расход.*сотрудник|авансов[а-яa-z]*\s+отчет/.test(purpose));
  add("INDIVIDUAL_BUSINESS", /\bгпх\b|гражданско.?правов|самозанят|услуг.*физическ|подряд.*физическ|возмещен.*подтвержденн.*расход/.test(purpose));

  add("BANK_FEE", /комисси.*банк|банковск[а-яa-z]*\s+комисси|расчетно.?кассов|\bрко\b/.test(purpose));
  add("ACQUIRING_FEE", /комисси.*эквайринг|эквайрингов[а-яa-z]*\s+комисси/.test(purpose));
  add("ASSET", /автомобил|транспортн[а-яa-z]*\s+средств|оборудован|станок|недвижим|основн[а-яa-z]*\s+средств|спецтехник/.test(purpose));
  add("ASSET_PURCHASE", /(покупк|приобретен|оплат|за).*(автомобил|оборудован|станок|недвижим|основн[а-яa-z]*\s+средств|спецтехник)/.test(purpose));
  add("ASSET_SALE", /(продаж|реализац|отчужден).*(автомобил|оборудован|станок|недвижим|основн[а-яa-z]*\s+средств|спецтехник)/.test(purpose));

  add("REFUND", /возврат|сторно/.test(purpose));
  add("REFUND_RECEIVED", /(возврат|сторно).*(ошиб|излиш|аванс|оплат|денеж)|(поставщик).*(возврат|сторно)/.test(purpose));
  add("CUSTOMER_REFUND", /(возврат|сторно).*(покупател|заказчик|оплат|аванс|ошиб)/.test(purpose));
  add("RENT", /арендн[а-яa-z]*\s+плат|субаренд|аренд/.test(purpose));
  add("SUPPLIER", /(оплат|расчет|перечислен).*(товар|материал|услуг|работ(?:а|ы|у|ой|ами|ах)?\b|поставк|поставщик|подряд)|(?:за|по счету за)\s+(?:поставлен[а-яa-z]*\s+)?(?:товар|материал|услуг|работ(?:а|ы|у|ой|ами|ах)?\b)/.test(purpose));
  add("CASH", /сняти[а-яa-z]*\s+налич|выдач[а-яa-z]*\s+налич|чеков[а-яa-z]*\s+книж|\bcash\b/.test(purpose));
  add("DIVIDEND", /дивиденд/.test(purpose));
  add("OWNER_WITHDRAWAL", /(изъят|вывод|выдач).*(собственник|учредител|участник)/.test(purpose));
  add("OTHER_KNOWN", /прочи[а-яa-z]*\s+(поступлен|доход|списан|расход)/.test(purpose));
  add("NEGATIVE_OPERATING", flags.has("LOAN_WORD") || flags.has("FACTORING") || flags.has("LEASING") || flags.has("REFUND") || flags.has("TAX") || flags.has("ASSET"));

  const isFinancialInstitution = /(банк|кредитн[а-яa-z]*\s+организац|мфо|микрофинанс|фактор|лизинг)/.test(counterparty);
  const isIndividualCounterparty = tx.counterparty.innNormalized?.length === 12 || /(физическ[а-яa-z]*\s+лиц|самозанят|гражданин)/.test(counterparty);
  const principalAmount = extractComponentAmount(purpose, /(?:основн(?:ого|ой)?\s+долг|погашени[ея]\s+кредита)\s*[:—-]?\s*([\d][\d\s.,]*?)(?=\s*(?:руб|₽|,?\s*процент|$))/);
  const interestAmount = extractComponentAmount(purpose, /процент(?:ы|ов)?\s*[:—-]?\s*([\d][\d\s.,]*?)(?=\s*(?:руб|₽|$))/);

  return {
    purpose,
    counterparty,
    direction: tx.direction,
    isFinancialInstitution,
    isIndividualCounterparty,
    isMarketplace: flags.has("MARKETPLACE"),
    isRelatedParty: tx.relatedPartyStatus === "RELATED",
    isReversalCandidate: Boolean(tx.possibleReversalOfTransactionId),
    isOwnAccount: tx.isOwnAccountTransfer,
    hasTransferPair: Boolean(tx.transferPairId),
    principalAmount,
    interestAmount,
    flags,
  };
}
