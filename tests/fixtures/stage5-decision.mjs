import {loadBusiness} from '../../lib/credit-engine/credit-lab/business-corpus.mjs';
import {normalizeProfile} from '../../lib/external/checko-profile.ts';
import {parseEisRecords} from '../../lib/external/eis.ts';
import {eisInclusion,eisExclusion} from './stage4-external.mjs';
import {savedCanonicalInput} from '../../lib/workspace/financing-request.ts';

const asOf='2026-06-30';
const rows=records=>({data:{Записи:records,ЗапВсего:records.length,СтрВсего:1}});
export function scenario(number,variant='legacy'){
  const input=loadBusiness('CL-RU-BUS-'+String(number).padStart(3,'0')).input;
  const a=input.analysis,inn=a.companyInn;
  if(['bankrupt','terminated'].includes(variant))input.companyProfile.company.status=variant==='bankrupt'?'BANKRUPTCY_ACTIVE':'TERMINATED';
  if(['delinquent','historic','unknown-principal','unknown-overdue'].includes(variant)){
    const o=a.creditHistory.obligations[0];o.maxDelinquencyDays=95;o.fieldProvenance.maxDelinquencyDays={origin:'REPORTED',value:95,reference:'Synthetic history'};
    if(variant!=='historic'){o.currentDelinquencyDays=93;o.overdueAmount=variant==='unknown-overdue'?null:25000;
      if(variant==='unknown-principal')o.outstandingPrincipal=null;}
  }
  if(['ready','contract'].includes(variant)){
    a.financingRequestV1={receivedAt:asOf,...(variant==='contract'?{contractReference:'S5-44'}:{}),purpose:variant==='ready'?'WORKING_CAPITAL':'CONTRACT_EXECUTION',product:variant==='ready'?'CREDIT_LINE':'BANK_GUARANTEE',amount:300000,termMonths:12,annualRatePercent:18,urgency:'WITHIN_30_DAYS'};
    Object.assign(input,savedCanonicalInput(a,input.companyProfile));
  }
  if(['rnp','excluded','unverified','contract','partial','fssp','aggregator','concentration'].includes(variant)){
    const data={company:{data:{ИНН:inn,ДатаСвед:asOf,Статус:{Наим:'Действует'},НедобПост:variant==='aggregator',ЮрАдрес:{Недост:false}}},
      enforcements:rows(variant==='fssp'?[{ИспПрНомер:'S5-TEST',ИспПрДата:asOf,Статус:'На исполнении',ОстЗадолж:5000000}]:[]),
      'legal-cases':rows([]),'bankruptcy-messages':rows([]),fedresurs:rows([]),inspections:rows([]),
      'contracts:223':rows([]),'contracts:44':rows(['contract','concentration'].includes(variant)?[{РегНомер:'S5-44',Дата:'2026-02-01',Статус:'На исполнении',Цена:900000,
        Заказ:{ИНН:a.metricsV2.customers.directGroups[0].inn},Постав:[{ИНН:inn}]}]:[])};
    for(const [key,body] of Object.entries(data)) if(key!=='company')body.company={ИНН:inn};
    const p=normalizeProfile(inn,data,variant==='partial'?{inspections:'SYNTHETIC_TIMEOUT'}:{},asOf);
    if(['rnp','excluded','unverified'].includes(variant)){
      const inclusion=new TextDecoder().decode(eisInclusion('S5-RNP',inn)).replaceAll('2026-07-01','2026-05-01');
      const exclusion=new TextDecoder().decode(eisExclusion('S5-RNP')).replaceAll('2026-07-16','2026-06-16');
      const result=parseEisRecords((variant==='excluded'?[inclusion,exclusion]:[inclusion]).map(xml=>new TextEncoder().encode(xml)),
        {inn,retrievedAt:asOf,completeCurrentRegister:true,origin:variant==='unverified'?'OFFLINE_SAMPLE':'OFFICIAL_ARCHIVE',rnpRegisterScope:'44-ФЗ'});
      p.externalFacts.rnp=result.rnp;p.externalFacts.receipts.push(...result.receipts);
    }
    input.companyProfile=p;
  }
  return input;
}
