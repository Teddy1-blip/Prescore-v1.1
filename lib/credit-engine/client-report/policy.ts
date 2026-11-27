import {CLIENT_REPORT_POLICY_VERSION,type ClientReportPolicyV1} from '../contracts/client-report.ts';
import {freeze,id,stable} from '../explainability/common.ts';
export const CLIENT_REPORT_POLICY:ClientReportPolicyV1=freeze({
 version:CLIENT_REPORT_POLICY_VERSION,sectionOrder:['overview','factors','financing','plan','data','full'],
 printSectionOrder:['overview','index','readiness','factors','capacity','products','recommendations','plan','data','full','sources','methodology'],
 executiveFactorLimit:5,productCardLimit:3,overviewActionLimit:5,recommendationLimit:8,
 defaultCollapsedSections:['full','methodology','other-products','backlog'],
 severityDisplayMap:{CRITICAL:{label:'Требует первоочередной проверки',tone:'critical'},HIGH:{label:'Существенный фактор',tone:'attention'},MEDIUM:{label:'Требует внимания',tone:'attention'},LOW:{label:'Информация для проверки',tone:'info'},INFO:{label:'Информация',tone:'info'}},
 confidenceDisplayMap:{HIGH:'Высокая подтвержденность',MEDIUM:'Достаточная подтвержденность',LOW:'Требуется подтверждение',UNKNOWN:'Недостаточно данных'},
 fitDisplayMap:{STRONG_MATCH:'Хорошо соответствует задаче',MODERATE_MATCH:'Соответствует задаче',CONDITIONAL_MATCH:'Подходит при выполнении условий',WEAK_MATCH:'Ограниченное соответствие',NOT_APPLICABLE:'Не соответствует текущей задаче',UNKNOWN:'Недостаточно данных'},
 statusDisplayMap:{GENERATED:'Анализ сформирован',ASSESSED:'Оценка сформирована',CALCULATED:'Расчет выполнен',PARTIAL:'Частичный расчет',INSUFFICIENT_DATA:'Недостаточно данных',NOT_RATABLE_GLOBAL_STOP:'Сначала необходимо проверить статус компании'},
 ctaDecisionOrder:['DATA','PLAN','REPORT'],responsiveWidths:[360,390,768,1024,1440]
});
export function validateClientReportPolicy(p:ClientReportPolicyV1){if(p.version!==CLIENT_REPORT_POLICY_VERSION||p.executiveFactorLimit<1||p.executiveFactorLimit>5||p.productCardLimit<1||p.productCardLimit>3||p.overviewActionLimit<1||p.overviewActionLimit>5||p.recommendationLimit<5||p.recommendationLimit>10)throw Error('CLIENT_REPORT_POLICY_INVALID');if(new Set(p.sectionOrder).size!==6||p.sectionOrder.join()!=CLIENT_REPORT_POLICY.sectionOrder.join()||p.ctaDecisionOrder.join()!=='DATA,PLAN,REPORT')throw Error('CLIENT_REPORT_POLICY_ORDER_INVALID');if(p.printSectionOrder.join()!==CLIENT_REPORT_POLICY.printSectionOrder.join())throw Error('CLIENT_REPORT_PRINT_ORDER_INVALID');for(const key of ['HIGH','MEDIUM','LOW','UNKNOWN'])if(!p.confidenceDisplayMap[key])throw Error('CLIENT_REPORT_CONFIDENCE_LABEL_MISSING');}
export const policyFingerprint=(p:ClientReportPolicyV1=CLIENT_REPORT_POLICY)=>id('client-report-policy',stable(p));
