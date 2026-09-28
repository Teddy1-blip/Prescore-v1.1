import {rule,n,v} from './factory.ts';
import {independent} from '../common.ts';
const revenue=['RISK-FIN-REVENUE-DECLINE'],liquidity=['RISK-FIN-CURRENT-LIQUIDITY'];
const bases=['FIN_ANNUAL_REVENUE_CHANGE','BANK_OPERATING_TREND','BANK_COVERAGE_ADEQUATE'];
const recent=(fs:Parameters<typeof n>[0])=>{const a=fs.find(f=>f.semanticCode===bases[0])!,b=fs.find(f=>f.semanticCode===bases[1])!;return independent(a,b)&&!!a.period.to&&!!b.period.from&&b.period.from>a.period.to&&v(fs,'BANK_COVERAGE_ADEQUATE')===true;};
export const financialRules=[
 rule('REVENUE-CORROBORATION','WORKING_CAPITAL','CORROBORATES',bases,revenue,'Independent annual accrual decline and later negative operating cash trend; no score adjustment',f=>recent(f)&&n(f,bases[0])<0&&n(f,bases[1])<0),
 rule('REVENUE-RECOVERY','WORKING_CAPITAL','MITIGATES',bases,revenue,'Later independent operating receipts recovery limits persistence interpretation of historical annual decline only; original risk remains',f=>recent(f)&&n(f,bases[0])<0&&n(f,bases[1])>0),
 rule('LIQUIDITY-CORROBORATION','WORKING_CAPITAL','CORROBORATES',['FIN_CURRENT_RATIO','BANK_LOW_LIQUIDITY_SHARE','BANK_COVERAGE_ADEQUATE'],liquidity,'Independent balance-sheet and observed bank cash pressure; no new risk threshold',f=>independent(f[0],f[1])&&n(f,'BANK_LOW_LIQUIDITY_SHARE')>0&&v(f,'BANK_COVERAGE_ADEQUATE')===true),
 rule('LIQUIDITY-CURRENT-CASH','WORKING_CAPITAL','MITIGATES',['FIN_CURRENT_RATIO','BANK_LOW_LIQUIDITY_SHARE','CASH_AVERAGE_BALANCE','BANK_COVERAGE_ADEQUATE'],liquidity,'Zero canonical low-liquidity share, positive average cash and complete supplied period mitigate current cash pressure only; structural liquidity risk remains',f=>independent(f[0],f[1])&&n(f,'BANK_LOW_LIQUIDITY_SHARE')===0&&n(f,'CASH_AVERAGE_BALANCE')>0&&v(f,'BANK_COVERAGE_ADEQUATE')===true&&!!f[1].period.to&&!!f[0].period.to&&f[1].period.to>f[0].period.to),
 rule('PROFITABILITY','WORKING_CAPITAL','NEUTRAL',['FIN_ANNUAL_NET_PROFIT','FIN_INTEREST_COVERAGE'],[],'Canonical profitability and interest coverage; not another F-Score'),
 rule('CAPITAL','WORKING_CAPITAL','NEUTRAL',['FIN_EQUITY','FIN_WORKING_CAPITAL'],[],'Canonical capital and working capital, preserving reported/proxy methodology upstream')
];
