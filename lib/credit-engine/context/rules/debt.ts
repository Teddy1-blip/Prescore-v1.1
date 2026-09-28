import {rule,n,v} from './factory.ts';
export const debtRules=[
 rule('DEBT-SERVICE-PORTFOLIO','DEBT_STRUCTURE','EXPLAINS',['PORTFOLIO_FUNDED_PRINCIPAL'],['RISK-CF-DEBT-SERVICE-BURDEN'],'Known funded obligation accompanies aggregate cash debt service; not a payment match or independent risk confirmation',f=>n(f,'PORTFOLIO_FUNDED_PRINCIPAL')>0,true),
 rule('UNRESOLVED-DEBT','DEBT_STRUCTURE','REQUIRES_REVIEW',['PORTFOLIO_UNRESOLVED'],['RISK-CF-DEBT-SERVICE-BURDEN'],'Unresolved canonical obligations limit debt-service interpretation; no invented exposure',f=>n(f,'PORTFOLIO_UNRESOLVED')>0),
 rule('CONTINGENT-GUARANTORSHIP','DEBT_STRUCTURE','NEUTRAL',['OBLIGATION_TYPE'],[],'Guarantorship remains contingent; never company funded principal',f=>v(f,'OBLIGATION_TYPE')==='GUARANTORSHIP',true),
 rule('CONTINGENT-BANK-GUARANTEE','DEBT_STRUCTURE','NEUTRAL',['OBLIGATION_TYPE'],[],'Bank guarantee is contingent exposure, not funded principal',f=>v(f,'OBLIGATION_TYPE')==='BANK_GUARANTEE',true),
 rule('MATURITY','DEBT_STRUCTURE','NEUTRAL',['OBLIGATION_MATURITY'],[],'Known contractual date, including future maturity; no overdue or refinancing decision',()=>true,true),
 rule('FACTORING-FLOWS','DEBT_STRUCTURE','EXPLAINS',['FACTORING_INFLOW'],[],'Factoring financing flow separate from operating revenue; no recourse assumption',f=>n(f,'FACTORING_INFLOW')>0),
 rule('UNMATCHED-PAYMENTS','DEBT_STRUCTURE','REQUIRES_REVIEW',['PORTFOLIO_UNMATCHED'],[],'Canonical unmatched payments retained; no rematching or principal inference',f=>n(f,'PORTFOLIO_UNMATCHED')>0),
 rule('UNSPLIT-PAYMENTS','DEBT_STRUCTURE','EXPLAINS',['PORTFOLIO_UNSPLIT'],[],'Unsplit debt service does not establish principal reduction',f=>n(f,'PORTFOLIO_UNSPLIT')>0),
 rule('BKI-CURRENT-CLEAR','CREDIT_HISTORY','MITIGATES',['BKI_HISTORY_DAYS','BKI_OVERDUE'],['RISK-BKI-HISTORICAL-DELINQUENCY'],'Same company obligation: historical delinquency retained; known fresh current overdue zero limits current relevance only',f=>n(f,'BKI_HISTORY_DAYS')>0&&n(f,'BKI_OVERDUE')===0,true),
 rule('BKI-ZERO-HISTORY','CREDIT_HISTORY','EXPLAINS',['BKI_HISTORY_DAYS','BKI_OVERDUE'],['RISK-BKI-CURRENT-OVERDUE'],'Current overdue with reported historical maximum zero does not establish any historical delinquency band',f=>n(f,'BKI_HISTORY_DAYS')===0&&n(f,'BKI_OVERDUE')>0,true),
 rule('BKI-STALE','CREDIT_HISTORY','REQUIRES_REVIEW',['BKI_HISTORY_DAYS'],[],'Historical evidence retained; stale bureau source cannot establish current debt state',f=>f.some(x=>x.warnings.includes('SOURCE_STALE')),true)
];
