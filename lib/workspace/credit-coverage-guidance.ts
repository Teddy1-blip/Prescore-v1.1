/** Presentation-only diagnostics for already-calculated credit coverage.
 * Never fabricates missing observations or recalculates a score. */
export type CoverageRow = {component:string;state:string;missingFactCodes:string[]};
export type IndexGapGuidance = {component:string;factCode:string;label:string;action:string;blocksNumericIndex:boolean};

const components:Record<string,string>={
 FINANCIAL_STRENGTH:'Финансовая устойчивость',
 OPERATING_BEHAVIOR:'Операционная деятельность',
 DEBT_CREDIT:'Долг и кредитная история',
 LEGAL_CORPORATE:'Юридический профиль',
};
const facts:Record<string,{label:string;action:string}>={
 LEGAL_LIFECYCLE:{label:'Не подтверждён юридический статус компании',action:'Нужны проверяемые сведения о действующем состоянии организации. Отсутствие источника не означает ни отсутствия, ни наличия юридического риска.'},
 BANK_TOP1:{label:'Не подтверждена концентрация банковских поступлений',action:'Проверьте классификацию поступлений и относящиеся к ним источники.'},
 BANK_OPERATING_TREND:{label:'Не подтверждена динамика банковского оборота',action:'Нужна сопоставимая история полных банковских месяцев. Отдельный месяц не подтверждает устойчивый тренд.'},
 BANK_COVERAGE_ADEQUATE:{label:'Не подтверждена полнота банковского периода',action:'Проверьте полные месяцы, счета и границы выписок; пропуски не считаются нулевыми оборотами.'},
 BANK_DEBT_SERVICE_RATIO:{label:'Не подтверждено обслуживание долга',action:'Проверьте распознанные долговые платежи и их связь с обязательствами; неизвестные значения не равны нулю.'},
 FIN_EQUITY:{label:'Не подтверждён собственный капитал',action:'Нужна финансовая отчётность с датой, единицами измерения и соответствующей строкой.'},
 FIN_CURRENT_RATIO:{label:'Не подтверждена текущая ликвидность по отчётности',action:'Нужны сопоставимые оборотные активы и краткосрочные обязательства из отчётности.'},
 FIN_ANNUAL_REVENUE:{label:'Не подтверждена годовая выручка',action:'Нужна годовая отчётность с подтверждённой выручкой и единицами измерения.'},
 FIN_ANNUAL_NET_PROFIT:{label:'Не подтверждена годовая чистая прибыль',action:'Нужна годовая отчётность с подтверждённой чистой прибылью.'},
};
export function indexGapGuidance(rows:readonly CoverageRow[]):IndexGapGuidance[]{
 return rows.flatMap(row=>(row.state==='ADEQUATE'?[]:row.missingFactCodes.map(factCode=>({
  component:components[row.component]??row.component,
  factCode,
  label:facts[factCode]?.label??`Не подтверждён факт ${factCode}`,
  action:facts[factCode]?.action??'Проверьте источник, его период и достоверность.',
  blocksNumericIndex:row.state==='INSUFFICIENT',
 }))));
}
export type CapacityGuidanceInput={
 status:string;
 operatingBasis:{fullMonthCount:number};
 creditAssessmentReference:{status:string};
 portfolioScheduledDebtService30d:{value:number|null;complete:boolean;excludedObligationIds:string[];unknownObligationIds:string[]};
};
export function capacityGapGuidance(capacity:CapacityGuidanceInput, requiredFullMonths:number|undefined):string[]{
 if(capacity.status==='CALCULATED')return [];
 const notes:string[]=[];
 if(typeof requiredFullMonths==='number' && requiredFullMonths>0 && capacity.operatingBasis.fullMonthCount<requiredFullMonths)notes.push(`Полных месяцев банковских выписок: ${capacity.operatingBasis.fullMonthCount}. Действующая методика требует минимум ${requiredFullMonths} полных месяцев для числовой оценки ёмкости.`);
 if(capacity.creditAssessmentReference.status==='INSUFFICIENT_DATA')notes.push('Кредитная оценка ещё не полна. Даже достаточная история банковских выписок сама по себе не обеспечит числовую ёмкость.');
 const schedule=capacity.portfolioScheduledDebtService30d;
 if(!schedule.complete)notes.push('Договорный график на ближайшие 30 дней подтверждён не полностью. Отсутствующую сумму нельзя считать нулевым платежом.');
 if(schedule.excludedObligationIds.length)notes.push(`Обязательств вне расчётной классификации графика: ${schedule.excludedObligationIds.length}. Платёж из БКИ может быть показан в портфеле, но не включён в базу ёмкости; проверьте тип и фактическую задолженность.`);
 if(schedule.unknownObligationIds.length)notes.push(`По ${schedule.unknownObligationIds.length} обязательствам данные о графике или статусе недостаточны.`);
 return notes;
}

/** Membership comes only from the calculated schedule. No eligibility is inferred here. */
export function obligationScheduleGuidance(id:string, exposure:string, schedule:CapacityGuidanceInput['portfolioScheduledDebtService30d'] & {eligibleObligationIds:string[]}):string{
 if(schedule.excludedObligationIds.includes(id)){
  if(exposure==='CREDIT_LIMIT')return 'Не включено в график ёмкости: обязательство классифицировано как лимит кредитной линии. Лимит не приравнивается к подтверждённому выданному долгу. Указанный платёж сохраняется в портфеле на дату источника; требуется подтверждение вида задолженности.';
  if(exposure==='CONTINGENT')return 'Не включено в график ёмкости: условное обязательство учитывается отдельно от выданного долга.';
  return 'Исключено расчётной моделью из графика ёмкости. Проверьте тип, класс обязательства и подтверждённый действующий статус; это не означает отсутствия платежа или долга.';
 }
 if(schedule.unknownObligationIds.includes(id))return 'График или статус подтверждены недостаточно. Известный платёж может учитываться как нижняя граница; неизвестный остаток графика не считается нулём.';
 if(schedule.eligibleObligationIds.includes(id))return 'Обязательство допущено расчётной моделью. Учитываются только подтверждённые платежи в расчётном окне ближайших 30 дней.';
 return 'Основание участия в графике в текущем расчёте не раскрыто.';
}
