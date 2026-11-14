import type {PortfolioObservation} from '../credit-engine/contracts/credit-portfolio.ts';
import {id} from '../credit-engine/credit-portfolio/common.ts';
import type {SourceRow} from './dossier-sources.ts';

export function ledgerObservations(rows:SourceRow[],inn:string):PortfolioObservation[]{
 return rows.flatMap(source=>source.kind==='DEBT_LEDGER'&&source.payload.envelope.companyInn===inn?
   (source.payload.ledger??[]).flatMap((line):PortfolioObservation[]=>{
     // The balance of 66/67 can include interest and fees. Require an identified principal subledger.
     if(!line.contract||line.component?.toLocaleLowerCase('ru')!=='основной долг'||line.credit==null||line.credit<0||line.debit!==null&&line.debit!==0)return [];
     const observationId=id('ledger-principal',source.id,line.row);
     return [{companyInn:inn,observationId,observationGroupId:observationId,obligationHints:{creditorName:line.party,creditorInn:line.partyInn,contractNumber:line.contract},
       fieldCode:'principalOutstanding',value:line.credit,unit:'RUB',knowledge:'KNOWN',origin:'REPORTED',confidence:'HIGH',observedAt:line.asOf,effectiveFrom:null,effectiveTo:null,
       evidence:[{evidenceId:observationId,sourceKind:'OTHER',sourceId:source.id,documentId:source.documentId??undefined,pageHint:'строка '+line.row,rawField:line.account,rawValue:line.credit,observedAt:line.asOf,description:'ОСВ · '+line.component+' · '+line.contract}],warnings:[]}];
   }):[]);
}
