import {rule,n,v} from './factory.ts';
export const dataRules=[
 rule('SOURCE-CONFIDENCE','DATA_QUALITY','REQUIRES_REVIEW',['CONTEXT_LOW_CONFIDENCE_COUNT'],[],'Weak or missing context evidence requires review, not a borrower-risk conclusion',f=>n(f,'CONTEXT_LOW_CONFIDENCE_COUNT')>0),
 rule('RECON-CONFLICT','DATA_QUALITY','REQUIRES_REVIEW',['RECON_OUTCOME'],[],'Canonical reconciliation conflict requires source review; neither source selected',f=>v(f,'RECON_OUTCOME')==='CONFLICT',true),
 rule('CASH-ACCRUAL','DATA_QUALITY','EXPLAINS',['RECON_OUTCOME'],[],'RELATIONSHIP_OBSERVED remains a cash/accrual relationship, not data conflict',f=>v(f,'RECON_OUTCOME')==='RELATIONSHIP_OBSERVED',true),
 rule('MISSING-SOURCES','DATA_QUALITY','REQUIRES_REVIEW',['SOURCE_MISSING_COUNT'],[],'Missing source limits context, not borrower credit quality',f=>n(f,'SOURCE_MISSING_COUNT')>0),
 rule('BANK-COVERAGE','DATA_QUALITY','REQUIRES_REVIEW',['BANK_COVERAGE_ADEQUATE'],[],'Missing/partial supplied months prevent complete operating interpretation; missing is not zero',f=>v(f,'BANK_COVERAGE_ADEQUATE')===false),
 rule('UNKNOWN-INFLOWS','DATA_QUALITY','REQUIRES_REVIEW',['BANK_UNKNOWN_INFLOW_SHARE'],[],'Canonical unknown inflow share limits economic interpretation',f=>n(f,'BANK_UNKNOWN_INFLOW_SHARE')>0)
];
