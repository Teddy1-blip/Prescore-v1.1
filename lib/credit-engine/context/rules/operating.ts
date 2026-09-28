import {rule,n,v} from './factory.ts';
export const operatingRules=[
 rule('OPERATING-TREND','OPERATING_PATTERN','NEUTRAL',['BANK_OPERATING_TREND','BANK_COVERAGE_ADEQUATE'],[],'Canonical operating receipts trend with complete supplied period',f=>v(f,'BANK_COVERAGE_ADEQUATE')===true),
 rule('VOLATILITY','OPERATING_PATTERN','NEUTRAL',['OPERATING_VOLATILITY'],[],'Canonical volatility observation, no new credit threshold'),
 rule('SEASONALITY-ELIGIBILITY','SEASONALITY','NEUTRAL',['SEASONALITY_ELIGIBILITY'],[],'Block 4 eligibility only: sufficient history allows review; eligibility is not proof that seasonality caused decline',f=>n(f,'SEASONALITY_ELIGIBILITY')===1),
 rule('MARKETPLACE-MODEL','CUSTOMER_STRUCTURE','EXPLAINS',['BANK_INTERMEDIATED_SHARE'],[],'Observed intermediary share; settlement platform is not the ultimate direct customer',f=>n(f,'BANK_INTERMEDIATED_SHARE')>0),
 rule('CONCENTRATION-CONTRACT','CUSTOMER_STRUCTURE','EXPLAINS',['CONCENTRATION_CONTRACT_CONTEXT'],['RISK-CF-CUSTOMER-CONCENTRATION'],'Active contract and direct-customer name provide capped supporting explanation only; concentration risk is retained',f=>v(f,'CONCENTRATION_CONTRACT_CONTEXT')===true),
 rule('SUPPLIER-STRUCTURE','CUSTOMER_STRUCTURE','NEUTRAL',['SUPPLIER_TOP1'],[],'Canonical supplier concentration, no bank policy'),
 rule('OWNER-FUNDING','CASH_FLOW','EXPLAINS',['OWNER_FUNDING'],[],'Owner contribution is funding, not operating revenue',f=>n(f,'OWNER_FUNDING')>0),
 rule('OWNER-LOANS','CASH_FLOW','EXPLAINS',['OWNER_LOANS'],[],'Owner loan is financing, not customer receipts',f=>n(f,'OWNER_LOANS')>0),
 rule('OWNER-WITHDRAWALS','CASH_FLOW','NEUTRAL',['OWNER_WITHDRAWALS'],[],'Canonical owner withdrawal flow; no new risk decision',f=>n(f,'OWNER_WITHDRAWALS')>0),
 rule('TAX-CONTINUITY','OPERATING_PATTERN','NEUTRAL',['TAX_PAYMENT_CONTINUITY'],[],'Observed tax-payment month share; not proof of full tax compliance'),
 rule('GROSS-OPERATING','CASH_FLOW','EXPLAINS',['GROSS_INFLOW','OPERATING_RECEIPTS'],[],'Gross external inflow and operating receipts remain distinct concepts',f=>n(f,'GROSS_INFLOW')!==n(f,'OPERATING_RECEIPTS'))
];
