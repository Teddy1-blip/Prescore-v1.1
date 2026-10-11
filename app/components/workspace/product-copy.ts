// Labels for existing canonical reasons. This file never evaluates product fit.
const purpose:Record<string,string>={WORKING_CAPITAL:'Пополнение оборотных средств',CONTRACT_EXECUTION:'Исполнение контракта',CAPEX:'Покупка основных средств',REFINANCING:'Рефинансирование обязательств',LIQUIDITY_BUFFER:'Резерв ликвидности',RECEIVABLES_FINANCE:'Финансирование дебиторской задолженности'};
const reasons:Record<string,string>={
 CONTRACT_DOCUMENT_MATCHED:'Документы подтверждают связь с контрактом.',
 ACTIVE_CONTRACT_CONTEXT_PRESENT:'В источниках есть действующие контракты.',
 EXISTING_FACTORING_FLOW_OBSERVED:'В выписках обнаружен факторинговый поток.',
 POSITIVE_DEBT_SERVICE_HEADROOM:'Расчёт показывает запас обслуживания дополнительного долга.',
 CAPACITY_NOT_DIRECT_PRODUCT_LIMIT:'Долговая ёмкость даёт косвенный ориентир и не определяет лимит продукта.',
 EXISTING_PRODUCT_EXPOSURE_PRESENT:'В доступном портфеле уже есть такой инструмент.',
 CLIENT_REQUESTED_PRODUCT:'Этот продукт указан в запросе клиента; само по себе это не подтверждает соответствие.',
 PURPOSE_NOT_MODELED_PRECISELY:'Цель финансирования требует уточнения.',
 CONTRACT_EVIDENCE_REQUIRED:'Нужны документы, подтверждающие контракт.',
 RECEIVABLES_OR_INVOICE_EVIDENCE_REQUIRED:'Нужны сведения о дебиторской задолженности и счетах.',
 CAPACITY_CONSTRAINED:'Расчётная долговая ёмкость ограничивает использование продукта.',
 ZERO_DEBT_SERVICE_HEADROOM:'Расчётный запас дополнительного обслуживания равен нулю.'
};
export function productReason(code:string){
 const match=/^PURPOSE_(.+)_MATCH$/.exec(code);
 return match?'Соответствует цели: '+(purpose[match[1]]??'заявленной цели финансирования')+'.':reasons[code]??'Есть дополнительное условие по данным текущего анализа. Уточните его до подачи заявки.';
}
export function productPurpose(family:string){return ({TERM_LOAN:'Разовая потребность в финансировании с погашением по графику.',CREDIT_LINE:'Финансирование нескольких потребностей в рамках договорного лимита.',REVOLVING_CREDIT_LINE:'Повторное использование лимита по мере погашения задолженности.',OVERDRAFT:'Краткосрочное покрытие кассовых разрывов на расчётном счёте.',BANK_GUARANTEE:'Обеспечение обязательств перед заказчиком; гарантия не является выдачей денег.',FACTORING:'Финансирование поставок с отсрочкой оплаты на основе дебиторской задолженности.',LEASING:'Приобретение имущества с платежами по договору лизинга.'} as Record<string,string>)[family]??'Назначение инструмента нужно уточнить с кредитором.';}
