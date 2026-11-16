/**
 * Navigation for the ONE existing client /dashboard.
 * Dossier identity is not a saved bank-analysis identity.
 * A company without a statement must never navigate as analysisId=<dossier>.
 */
export type CompanyChoice={id:string;inn:string};
type BankVersion={id:string;companyInn:string;historyPurpose?:string;createdAt?:string;periodTo?:string};

export function latestCompanyVersion(versions:BankVersion[],inn:string){
 return versions.filter(v=>v.companyInn===inn&&v.historyPurpose!=='QA')
   .sort((a,b)=>(b.createdAt??b.periodTo??"").localeCompare(a.createdAt??a.periodTo??""))[0];
}

export function resolveClientSelection(query:URLSearchParams,companies:CompanyChoice[],versions:BankVersion[],remembered:string){
 const client=query.get('client');
 if(client)return {dossier:undefined,version:query.get('analysisId')??client};
 const requested=query.get('dossierId'),explicit=query.get('analysisId');
 const selected=explicit?versions.find(v=>v.id===explicit):undefined;
 let dossier:CompanyChoice|undefined;
 if(requested){
  dossier=companies.find(d=>d.id===requested);
  if(!dossier)throw Error('Выбранное досье недоступно.');
  if(explicit&&(!selected||selected.companyInn!==dossier.inn))throw Error('Эта версия анализа не относится к выбранной компании.');
 }else if(explicit){dossier=companies.find(d=>d.inn===selected?.companyInn);}
 else{dossier=companies.find(d=>d.id===remembered)??companies[0];}
 const version=explicit??(dossier?latestCompanyVersion(versions,dossier.inn)?.id:undefined)??'';
 return {dossier,version};
}

export function clientNavigationHref(
  search: string,
  view: string,
  analysisId = '',
  dossierId = '',
): string {
  const query = new URLSearchParams(search);
  if (dossierId) {
    query.set('dossierId', dossierId);
    if (analysisId && analysisId !== dossierId && view !== 'upload') {
      query.set('analysisId', analysisId);
      query.set('view', view);
      return '?' + query.toString();
    }
    query.delete('analysisId');
    // Cash filter state only belongs to a selected bank analysis.
    for (const key of ['bankMonth', 'cashFor', 'cashMonth', 'cashSeries', 'cashMode']) query.delete(key);
  } else if (analysisId) {
    query.set('analysisId', analysisId);
    query.delete('dossierId');
  } else {
    query.delete('analysisId');
    query.delete('dossierId');
  }
  query.set('view', view);
  return '?' + query.toString();
}
