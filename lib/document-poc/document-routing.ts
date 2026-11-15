/**
 * Document upload contract / conservative content routing.
 * No OCR, AI calls, accounting mutations or conclusions about legal validity.
 * A filename, chosen uploader or stored category never establishes document type.
 */
export const DOCUMENT_ROUTING_VERSION = 'PRESCORE-DOCUMENT-ROUTING-0.3.1' as const;
export type UploadFamily = 'BFO' | 'CREDIT' | 'COMMERCIAL';
export type DocumentFamily = UploadFamily | 'OTHER' | 'UNKNOWN' | 'MIXED';
export type DocumentSubtype =
  | 'BALANCE_SHEET' | 'INCOME_STATEMENT' | 'CASH_FLOW_STATEMENT'
  | 'EQUITY_STATEMENT' | 'AUDIT_REPORT' | 'FINANCIAL_NOTES'
  | 'CREDIT_AGREEMENT' | 'LOAN_AGREEMENT' | 'CREDIT_LINE' | 'OVERDRAFT'
  | 'CREDIT_PAYMENT_SCHEDULE' | 'GUARANTEE' | 'SURETY' | 'PLEDGE'
  | 'LEASING' | 'FACTORING'
  | 'SUPPLY' | 'PURCHASE_SALE' | 'WORKS' | 'SUBCONTRACT' | 'SERVICES'
  | 'FRAMEWORK' | 'SPECIFICATION' | 'ACCEPTANCE_DOCUMENT'
  | 'AMENDMENT' | 'UNLINKED_PAYMENT_SCHEDULE'
  | 'TRIAL_BALANCE' | 'ACCOUNT_CARD' | 'BANK_STATEMENT' | 'CREDIT_REPORT'
  | 'TAX_DECLARATION';
export type EvidencePage = {
  page: number;
  logicalPage: number;
  segment?: 'FULL' | 'LEFT' | 'RIGHT';
  method: 'TEXT' | 'OCR' | 'UNREADABLE';
  text: string;
};
export type TypeEvidence = {
  family: DocumentFamily;
  subtype: DocumentSubtype;
  physicalPage: number;
  logicalPage: number;
  line: number;
  text: string;
};
export type RoutingDecision = {
  version: typeof DOCUMENT_ROUTING_VERSION;
  expectedFamily: UploadFamily | null;
  actualFamily: DocumentFamily;
  subtypes: DocumentSubtype[];
  status: 'READY_FOR_REVIEW' | 'INCOMPLETE' | 'TYPE_MISMATCH' | 'MIXED_REVIEW'
    | 'TYPE_REVIEW' | 'PARENT_REQUIRED' | 'RELATED_DOCUMENT_REVIEW'
    | 'RETRY_CONFLICT' | 'INPUT_INVALID';
  parser: 'FINANCIAL_STATEMENT' | 'CREDIT_AGREEMENT' | 'COMMERCIAL_CONTRACT' | null;
  suggestedFamily: UploadFamily | null;
  coverage: {
    totalPhysicalPages: number | null;
    receivedPhysicalPages: number;
    missingPhysicalPages: number[];
    unreadableLogicalPages: number[];
    complete: boolean;
  };
  evidence: TypeEvidence[];
  warnings: string[];
  reasons: string[];
  automaticApply: false;
};
export type RoutingInput = {
  expectedFamily?: UploadFamily | null;
  pages: readonly EvidencePage[];
  totalPhysicalPages?: number | null;
  layout?: 'SINGLE' | 'TWO_UP_ROTATED';
  /** Actual OCR warnings; truncation must never be presented as complete coverage. */
  extractionWarnings?: readonly string[];
};

export const DOCUMENT_UPLOAD_DEFINITIONS = {
  BFO: {
    title: 'Бухгалтерская отчётность', action: 'Загрузить отчётность',
    location: 'Финансы → Бухгалтерская отчётность',
    acceptedDescription: 'Баланс и отчёт о финансовых результатах; приложения определяются отдельно.',
    excludedDescription: 'ОСВ, карточки счетов, выписки и декларации не являются БФО.',
    fields: ['Компания и ИНН', 'Форма и версия', 'Отчётная дата и период',
      'Периоды числовых колонок', 'Валюта и единица измерения',
      'Код и название строки', 'Исходное значение и знак', 'Текущий и сравнительные периоды',
      'Пустая ячейка / прочерк / ноль / нечитаемое значение', 'Проверка итогов'],
  },
  CREDIT: {
    title: 'Кредитные документы', action: 'Загрузить кредитные документы',
    location: 'Кредитный портфель → Кредитные договоры',
    acceptedDescription: 'Кредит, заём, линия, овердрафт; графики и изменения связываются с договором.',
    excludedDescription: 'Гарантия, залог и поручительство не создают выданный кредит.',
    fields: ['Номер и дата договора', 'Кредитор, заёмщик и роль компании',
      'Вид финансирования', 'Сумма и лимиты — отдельно', 'Валюта',
      'Срок доступности и погашения', 'Ставка / индекс / надбавка',
      'Комиссии и базы начисления', 'График: долг / проценты / комиссии',
      'Обеспечение', 'Ковенанты и период проверки', 'Досрочное погашение',
      'Родительский договор и версия изменений'],
  },
  COMMERCIAL: {
    title: 'Договоры с контрагентами', action: 'Загрузить договор',
    location: 'Контрагенты → выбранный контрагент → Договоры',
    acceptedDescription: 'Поставка, подряд, субподряд, услуги; спецификации, акты и изменения — связанные документы.',
    excludedDescription: 'Цена договора не является текущим остатком дебиторской задолженности.',
    fields: ['Номер, дата, стороны и роль компании', 'Цена / лимит / спецификации',
      'Валюта и НДС', 'Аванс: размер, «до», право или обязанность',
      'Условия зачёта аванса', 'Этапы и промежуточные платежи',
      'Отсрочка и вид дней', 'События и документы для начала срока',
      'Условия окончательного расчёта', 'Приёмка', 'Начало и конец исполнения',
      'Срок действия договора', 'Переход собственности', 'Переход рисков',
      'Удержания и обеспечение', 'Встречные услуги', 'Уступка денежного требования',
      'Штрафы и основания', 'Допсоглашения и конфликты версий'],
  },
} satisfies Record<UploadFamily, {
  title: string; action: string; location: string; acceptedDescription: string;
  excludedDescription: string; fields: readonly string[];
}>;

/** The ordered patterns match document headings, not mentions anywhere in a clause. */
type Rule = { family: DocumentFamily; subtype: DocumentSubtype; pattern: RegExp };
const rules: readonly Rule[] = [
  {family:'OTHER',subtype:'TRIAL_BALANCE',pattern:/^оборотно[\s-]*сальдовая\s+ведомость(?:\s|$)/iu},
  {family:'OTHER',subtype:'ACCOUNT_CARD',pattern:/^карточка\s+(?:счета|сч[.\s])/iu},
  {family:'OTHER',subtype:'BANK_STATEMENT',pattern:/^(?:банковская\s+выписка|выписка\s+(?:по|из|с)\s+(?:расчетного\s+)?счет[ау]|1cclientbankexchange)(?:\s|$)/iu},
  {family:'OTHER',subtype:'CREDIT_REPORT',pattern:/^(?:кредитный\s+отчет|отчет\s+(?:о\s+кредитной\s+истории|бюро\s+кредитных\s+историй))(?:\s|$)/iu},
  {family:'OTHER',subtype:'TAX_DECLARATION',pattern:/^налоговая\s+декларация(?:\s|$)/iu},
  {family:'BFO',subtype:'BALANCE_SHEET',pattern:/^(?:упрощенный\s+)?бухгалтерский\s+баланс(?:\s|$)/iu},
  {family:'BFO',subtype:'INCOME_STATEMENT',pattern:/^(?:упрощенный\s+)?отчет\s+о\s+финансовых\s+результатах(?:\s|$)/iu},
  {family:'BFO',subtype:'CASH_FLOW_STATEMENT',pattern:/^отчет\s+о\s+движении\s+денежных\s+средств(?:\s|$)/iu},
  {family:'BFO',subtype:'EQUITY_STATEMENT',pattern:/^отчет\s+об\s+изменениях\s+капитала(?:\s|$)/iu},
  {family:'BFO',subtype:'AUDIT_REPORT',pattern:/^аудиторское\s+заключение(?:\s|$)/iu},
  {family:'BFO',subtype:'FINANCIAL_NOTES',pattern:/^пояснения\s+к\s+(?:бухгалтерскому\s+балансу|бухгалтерской\s+отчетности)(?:\s|$)/iu},
  {family:'CREDIT',subtype:'CREDIT_LINE',pattern:/^(?:договор\s+(?:об?\s+)?(?:открытии\s+)?(?:возобновляемой\s+|невозобновляемой\s+)?кредитной\s+линии|кредитный\s+договор\s+.*кредитной\s+линии)(?:\s|$)/iu},
  {family:'CREDIT',subtype:'OVERDRAFT',pattern:/^(?:договор\s+(?:кредитования\s+(?:в\s+форме\s+)?|о\s+предоставлении\s+)?овердрафта|овердрафт)(?:\s|$)/iu},
  {family:'CREDIT',subtype:'CREDIT_AGREEMENT',pattern:/^кредитный\s+договор(?:\s|$|№|N)/iu},
  {family:'CREDIT',subtype:'LOAN_AGREEMENT',pattern:/^договор\s+(?:(?:денежного|процентного|беспроцентного)\s+)?займа(?:\s|$|№|N)/iu},
  {family:'CREDIT',subtype:'GUARANTEE',pattern:/^(?:(?:банковская|независимая)\s+гарантия|договор\s+(?:о\s+)?(?:выдаче|предоставлении)\s+(?:банковской|независимой)\s+гарантии)(?:\s|$|№)/iu},
  {family:'CREDIT',subtype:'SURETY',pattern:/^договор\s+поручительства(?:\s|$|№)/iu},
  {family:'CREDIT',subtype:'PLEDGE',pattern:/^договор\s+(?:залога|ипотеки)(?:\s|$|№)/iu},
  {family:'CREDIT',subtype:'LEASING',pattern:/^договор\s+(?:финансовой\s+аренды|лизинга)(?:\s|$|№)/iu},
  {family:'CREDIT',subtype:'FACTORING',pattern:/^договор\s+(?:факторинга|финансирования\s+под\s+уступку\s+денежного\s+требования)(?:\s|$|№)/iu},
  {family:'COMMERCIAL',subtype:'SUBCONTRACT',pattern:/^(?:договор\s+субподряда|субподрядный\s+договор)(?:\s|$|№)/iu},
  {family:'COMMERCIAL',subtype:'WORKS',pattern:/^(?:договор\s+(?:строительного\s+)?подряда|(?:государственный\s+|муниципальный\s+)?контракт\s+на\s+(?:выполнение|производство)\s+работ)(?:\s|$|№)/iu},
  {family:'COMMERCIAL',subtype:'SUPPLY',pattern:/^(?:договор\s+поставки|(?:государственный\s+|муниципальный\s+)?контракт\s+на\s+поставку)(?:\s|$|№)/iu},
  {family:'COMMERCIAL',subtype:'PURCHASE_SALE',pattern:/^договор\s+купли[\s-]+продажи(?:\s|$|№)/iu},
  {family:'COMMERCIAL',subtype:'SERVICES',pattern:/^(?:договор\s+(?:возмездного\s+)?оказания\s+услуг|(?:государственный\s+|муниципальный\s+)?контракт\s+на\s+оказание\s+услуг)(?:\s|$|№)/iu},
  {family:'COMMERCIAL',subtype:'FRAMEWORK',pattern:/^рамочный\s+договор\s+(?:поставки|подряда|оказания\s+услуг)(?:\s|$|№)/iu},
  {family:'UNKNOWN',subtype:'AMENDMENT',pattern:/^дополнительное\s+соглашение(?:\s|$|№)/iu},
  {family:'UNKNOWN',subtype:'SPECIFICATION',pattern:/^спецификация(?:\s|$|№)/iu},
  {family:'UNKNOWN',subtype:'UNLINKED_PAYMENT_SCHEDULE',pattern:/^график\s+(?:платежей|погашения|оплаты|расчетов)(?:\s|$|№)/iu},
  {family:'UNKNOWN',subtype:'ACCEPTANCE_DOCUMENT',pattern:/^(?:акт\s+(?:приемки|выполненных\s+работ|оказанных\s+услуг)|универсальный\s+передаточный\s+документ|товарная\s+накладная)(?:\s|$|№)/iu},
];
const normal = (s: string) => s.replace(/ё/giu,'е').replace(/[\u00a0\u202f]/gu,' ')
  .replace(/[\t ]+/gu,' ').replace(/^["«]+|["»]+$/gu,'').trim();
const compact = (s: string) => s.replace(/\s+/gu,' ').trim();
const supported = new Set<DocumentSubtype>([
  'BALANCE_SHEET','INCOME_STATEMENT','CREDIT_AGREEMENT','LOAN_AGREEMENT','CREDIT_LINE','OVERDRAFT',
  'SUPPLY','PURCHASE_SALE','WORKS','SUBCONTRACT','SERVICES','FRAMEWORK',
]);
const dependent = new Set<DocumentSubtype>(['AMENDMENT','SPECIFICATION','UNLINKED_PAYMENT_SCHEDULE','ACCEPTANCE_DOCUMENT']);
const related = new Set<DocumentSubtype>(['GUARANTEE','SURETY','PLEDGE','LEASING','FACTORING']);
const families: readonly UploadFamily[] = ['BFO','CREDIT','COMMERCIAL'];
function familyGuard(value: unknown): value is UploadFamily { return families.includes(value as UploadFamily); }

export function routeDocument(input: RoutingInput): RoutingDecision {
  const result: RoutingDecision = {
    version:DOCUMENT_ROUTING_VERSION, expectedFamily:input.expectedFamily??null,
    actualFamily:'UNKNOWN',subtypes:[],status:'TYPE_REVIEW',parser:null,suggestedFamily:null,
    coverage:{totalPhysicalPages:input.totalPhysicalPages??null,receivedPhysicalPages:0,
      missingPhysicalPages:[],unreadableLogicalPages:[],complete:false},
    evidence:[],warnings:['PRELIMINARY_TYPE_REVIEW','NOT_IMPORTED_INTO_CREDIT_ENGINE'],reasons:[],automaticApply:false,
  };
  const invalid = () => {result.status='INPUT_INVALID';result.reasons=['DOCUMENT_ROUTING_INPUT_INVALID'];return result;};
  if ((input.expectedFamily!=null&&!familyGuard(input.expectedFamily)) || !Array.isArray(input.pages)
    || input.pages.length>256 || !['SINGLE','TWO_UP_ROTATED'].includes(input.layout??'SINGLE')
    || (input.totalPhysicalPages!=null&&(!Number.isSafeInteger(input.totalPhysicalPages)
    || input.totalPhysicalPages<1||input.totalPhysicalPages>64))) return invalid();
  if (input.extractionWarnings!=null && (!Array.isArray(input.extractionWarnings)
    || input.extractionWarnings.some(x=>typeof x!=='string'))) return invalid();

  const pages=new Map<string,EvidencePage>();
  let retryConflict=false, chars=0;
  for (const page of input.pages) {
    if(!page||!Number.isSafeInteger(page.page)||page.page<1||page.page>64
      ||!Number.isSafeInteger(page.logicalPage)||page.logicalPage<1||page.logicalPage>128
      ||!['TEXT','OCR','UNREADABLE'].includes(page.method)||typeof page.text!=='string'
      ||page.text.length>26000||(page.segment!=null&&!['FULL','LEFT','RIGHT'].includes(page.segment))
      ||(input.totalPhysicalPages!=null&&page.page>input.totalPhysicalPages))return invalid();
    chars+=page.text.length;if(chars>3_500_000)return invalid();
    const key=String(page.page)+':'+(page.segment??'FULL');
    const previous=pages.get(key);
    if(previous&&(compact(previous.text)!==compact(page.text)||previous.logicalPage!==page.logicalPage))retryConflict=true;
    if(!previous)pages.set(key,page); // Order never chooses between disagreeing OCR variants.
  }
  const ordered=[...pages.values()].sort((a,b)=>a.page-b.page||a.logicalPage-b.logicalPage);
  const received=new Set(ordered.map(p=>p.page));
  result.coverage.receivedPhysicalPages=received.size;
  result.coverage.unreadableLogicalPages=ordered.filter(p=>p.method==='UNREADABLE'||!p.text.trim()).map(p=>p.logicalPage);
  if(input.totalPhysicalPages!=null) {
    for(let page=1;page<=input.totalPhysicalPages;page++) {
      const segments=ordered.filter(p=>p.page===page);
      const validSegments=(input.layout??'SINGLE')==='SINGLE'
        ? segments.length===1&&(segments[0].segment??'FULL')==='FULL'
        : segments.length===2&&segments.some(p=>p.segment==='LEFT')&&segments.some(p=>p.segment==='RIGHT');
      if(!validSegments)result.coverage.missingPhysicalPages.push(page);
    }
  }
  const truncated=(input.extractionWarnings??[]).some(w=>/TRUNCATED|TEXT_LIMIT|UNREADABLE/iu.test(w));
  result.coverage.complete=input.totalPhysicalPages!=null&&input.pages.length>0
    &&!result.coverage.missingPhysicalPages.length&&!result.coverage.unreadableLogicalPages.length&&!truncated;
  if(input.totalPhysicalPages==null)result.warnings.push('TOTAL_PAGE_COUNT_NOT_PROVEN');
  if(truncated)result.warnings.push('EXTRACTION_INCOMPLETE');
  if(retryConflict){result.status='RETRY_CONFLICT';result.reasons=['OCR_VARIANTS_DISAGREE'];return result;}

  let repeatedPrimary=false;
  const headingPages=new Map<string,Set<number>>();
  for(const page of ordered) {
    const originalLines=page.text.split(/\r?\n/u);
    const lines=originalLines.map(normal);
    const firstUseful=lines.findIndex(x=>x.length>2);
    // Generic numbered headings need corroboration in the preamble/subject;
    // the number itself carries no financial meaning.
    const genericIndex=lines.findIndex((line,i)=>i<=firstUseful+14
      && /^(?:договор|контракт)\s*(?:№|N)\s*[\p{L}\d][\p{L}\d./_ -]*$/iu.test(line));
    if(genericIndex>=0) {
      const lead=lines.slice(genericIndex+1,genericIndex+85).join(' ');
      const introduced=(role:string)=>new RegExp('именуем[а-я]*.{0,50}'+role,'iu').test(lead);
      const roleCandidates:Array<{family:UploadFamily;subtype:DocumentSubtype}>=[];
      if(introduced('генподрядчик')&&introduced('субподрядчик'))roleCandidates.push({family:'COMMERCIAL',subtype:'SUBCONTRACT'});
      else if(introduced('заказчик')&&introduced('подрядчик'))roleCandidates.push({family:'COMMERCIAL',subtype:'WORKS'});
      if(introduced('поставщик')&&introduced('покупатель'))roleCandidates.push({family:'COMMERCIAL',subtype:'SUPPLY'});
      if(introduced('заказчик')&&introduced('исполнитель'))roleCandidates.push({family:'COMMERCIAL',subtype:'SERVICES'});
      if(introduced('кредитор')&&introduced('заемщик')&&/предостав[а-я]*.{0,80}кредит/iu.test(lead))roleCandidates.push({family:'CREDIT',subtype:'CREDIT_AGREEMENT'});
      if(introduced('заимодавец')&&introduced('заемщик')&&/предостав[а-я]*.{0,80}за[её]м/iu.test(lead))roleCandidates.push({family:'CREDIT',subtype:'LOAN_AGREEMENT'});
      if(roleCandidates.length===1) {
        const match=roleCandidates[0];
        result.evidence.push({...match,physicalPage:page.page,logicalPage:page.logicalPage,
          line:genericIndex+1,text:originalLines.slice(genericIndex,genericIndex+85).join('\n').slice(0,800)});
        const key=match.family+':'+lines[genericIndex].toLowerCase();
        const starts=headingPages.get(key)??new Set<number>();starts.add(page.logicalPage);headingPages.set(key,starts);
      } else if(roleCandidates.length>1) {
        result.warnings.push('AMBIGUOUS_PARTY_ROLES:'+page.logicalPage);
      }
    }
    for(let i=0;i<lines.length;i++) {
      if(!lines[i])continue;
      // Only heading-sized strings, near the top or preceded by a blank line.
      // References, quotations and body sentences containing document names do not qualify.
      const text=lines[i];
      if(text.length>210 || /[«“"]/.test(text)
        || /^(?:\d+[.)]\s+|приложени[ея]\s+\d|перечень\s+документов|например|см\.|согласно|включая)/iu.test(text))continue;
      if(i>firstUseful+14 && (i===0||lines[i-1]!==''))continue;
      const joined=lines[i+1]&&lines[i+1].length<=130?text+' '+lines[i+1]:text;
      const match=rules.find(r=>r.pattern.test(text))??rules.find(r=>r.pattern.test(joined));
      if(!match)continue;
      const evidence:TypeEvidence={family:match.family,subtype:match.subtype,
        physicalPage:page.page,logicalPage:page.logicalPage,line:i+1,text:originalLines[i].slice(0,210)};
      if(!result.evidence.some(e=>e.physicalPage===page.page&&e.logicalPage===page.logicalPage&&e.subtype===match.subtype))result.evidence.push(evidence);
      if(['CREDIT','COMMERCIAL'].includes(match.family)&&supported.has(match.subtype)) {
        const key=match.family+':'+text.toLowerCase();
        const starts=headingPages.get(key)??new Set<number>();starts.add(page.logicalPage);headingPages.set(key,starts);
      }
    }
  }
  // Repeated header text can be a running title; different explicit numbered titles
  // within the same family require boundary review rather than one merged contract.
  const primaryTitles=[...headingPages.keys()];
  const numberedTitles=primaryTitles.filter(x=>/(?:№|\bN\s*)\s*[\p{L}\d]/u.test(x));
  repeatedPrimary=numberedTitles.length>1;
  result.subtypes=[...new Set(result.evidence.map(e=>e.subtype))];
  const found=[...new Set(result.evidence.map(e=>e.family).filter(f=>f!=='UNKNOWN'))];
  result.actualFamily=found.length===0?'UNKNOWN':found.length>1?'MIXED':found[0];
  if(result.actualFamily==='MIXED'||repeatedPrimary) {
    result.status='MIXED_REVIEW';result.reasons=[repeatedPrimary?'MULTIPLE_PRIMARY_DOCUMENTS':'MULTIPLE_DOCUMENT_FAMILIES'];
    return result;
  }
  if(familyGuard(result.actualFamily))result.suggestedFamily=result.actualFamily;
  if(input.expectedFamily&&result.actualFamily!=='UNKNOWN'&&result.actualFamily!==input.expectedFamily) {
    result.status='TYPE_MISMATCH';result.reasons=['EXPECTED_FAMILY_DIFFERS_FROM_CONTENT'];return result;
  }
  if(result.subtypes.some(s=>dependent.has(s))) {
    result.status='PARENT_REQUIRED';result.reasons=['DOCUMENT_RELATIONSHIP_REQUIRES_REVIEW'];return result;
  }
  if(result.subtypes.some(s=>related.has(s)) || (result.actualFamily==='BFO'
    &&!result.subtypes.some(s=>s==='BALANCE_SHEET'||s==='INCOME_STATEMENT'))) {
    result.status='RELATED_DOCUMENT_REVIEW';result.reasons=['NO_AUTOMATIC_STANDARD_LOAN_OR_BFO_MAPPING'];return result;
  }
  if(!result.coverage.complete) {
    result.status='INCOMPLETE';result.reasons=['FULL_DOCUMENT_NOT_READ'];return result;
  }
  if(!result.subtypes.some(s=>supported.has(s))||!familyGuard(result.actualFamily)) {
    result.status='TYPE_REVIEW';result.reasons=['TYPE_NOT_ESTABLISHED'];return result;
  }
  result.status='READY_FOR_REVIEW';
  result.parser=result.actualFamily==='BFO'?'FINANCIAL_STATEMENT':result.actualFamily==='CREDIT'?'CREDIT_AGREEMENT':'COMMERCIAL_CONTRACT';
  result.reasons=['CONTENT_MATCHES_REVIEW_PARSER'];
  return result;
}
