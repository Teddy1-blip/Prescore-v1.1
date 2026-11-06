import type {NormalizedTransaction} from '../../prescore.ts';

export type BalanceSection = {
  account: string;
  periodFrom: string;
  periodTo: string;
  openingBalance: number|null;
  endingBalance: number|null;
  declaredIn: number|null;
  declaredOut: number|null;
};
export type BalanceCheck =
  | {state:'UNAVAILABLE'|'MISMATCH'}
  | {state:'VERIFIED';from:string;to:string;opening:number;closing:number;inflow:number;outflow:number;accountCount:number};

export function statementMoney(raw: string): number|null {
  const normalized=raw.trim().replace(/[\s\u00a0]/g,'').replace(',','.');
  if (!/^[+-]?\d+(?:\.\d{1,2})?$/.test(normalized)) return null;
  const n=Number(normalized);
  return Number.isSafeInteger(Math.round(n*100)) ? n : null;
}

const cents=(n:number)=>Math.round(n*100);
const validDay=(d:string)=>/^\d{4}-\d{2}-\d{2}$/.test(d) && Number.isFinite(Date.parse(d)) && new Date(d).toISOString().slice(0,10)===d;

/** Confirm the statement headers independently against the posted operations of each account. */
export function reconcileStatementBalances(sections:BalanceSection[], transactions:Pick<NormalizedTransaction,"date"|"direction"|"amount"|"account"|"currency">[], incomplete:boolean, requireBankTurnovers=false): BalanceCheck {
  const unknown={state:'UNAVAILABLE'} as const, mismatch={state:'MISMATCH'} as const;
  if (incomplete || !sections.length) return unknown;
  const accounts=new Map<string, BalanceSection[]>();
  for (const s of sections) {
    if (!/^\d{5}(?:810|643)\d{12}$/.test(s.account) || !validDay(s.periodFrom) || !validDay(s.periodTo) ||
        s.periodFrom>s.periodTo || (s.openingBalance==null || s.endingBalance==null || (requireBankTurnovers && (s.declaredIn==null || s.declaredOut==null)))) return unknown;
    const group=accounts.get(s.account)??[];
    group.push(s);
    accounts.set(s.account,group);
  }
  const amounts=new Map<BalanceSection,{in:number;out:number}>();
  let from='',to='',opening=0,closing=0,inflow=0,outflow=0;
  for (const group of accounts.values()) {
    group.sort((a,b)=>a.periodFrom.localeCompare(b.periodFrom));
    const first=group[0],last=group[group.length-1];
    if (from && (from!==first.periodFrom || to!==last.periodTo)) return unknown;
    from=first.periodFrom; to=last.periodTo;
    for (const [i,s] of group.entries()) {
      if (i && Date.parse(s.periodFrom)-Date.parse(group[i-1].periodTo)!==86_400_000) return unknown;
      if (i && group[i-1].endingBalance!==s.openingBalance) return mismatch;
      amounts.set(s,{in:0,out:0});
    }
    opening+=cents(first.openingBalance!);
    closing+=cents(last.endingBalance!);
  }
  for (const t of transactions) {
    if ((t.currency && t.currency!=='RUB') || (t.direction!=='in' && t.direction!=='out') || !validDay(t.date)) return unknown;
    const section=accounts.get(t.account)?.find(s=>s.periodFrom<=t.date && t.date<=s.periodTo);
    if (!section) return unknown;
    amounts.get(section)![t.direction]+=cents(t.amount);
  }
  for (const [s,a] of amounts) {
    if ((s.declaredIn!=null && a.in!==cents(s.declaredIn)) || (s.declaredOut!=null && a.out!==cents(s.declaredOut)) ||
        cents(s.openingBalance!)+a.in-a.out!==cents(s.endingBalance!)) return mismatch;
    inflow+=a.in; outflow+=a.out;
  }
  if (![opening,closing,inflow,outflow].every(Number.isSafeInteger)) return unknown;
  return {state:'VERIFIED',from,to,opening:opening/100,closing:closing/100,inflow:inflow/100,outflow:outflow/100,accountCount:accounts.size};
}

/** Sum the latest reported endpoint once per supplied account, for a common date. */
export function reportedEndpoint(sections: BalanceSection[]): number | null {
  if (!sections.length || sections.some(s=>!s.account || !validDay(s.periodTo))) return null;
  const date = sections.map(s=>s.periodTo).sort().at(-1);
  const endpoints = new Map<string,number>();
  for (const section of sections.filter(s=>s.periodTo===date)) {
    const previous = endpoints.get(section.account);
    if (section.endingBalance==null || (previous!==undefined && previous!==section.endingBalance)) return null;
    endpoints.set(section.account,section.endingBalance);
  }
  if (endpoints.size!==new Set(sections.map(s=>s.account)).size) return null;
  const total=[...endpoints.values()].reduce((sum,v)=>sum+cents(v),0);
  return Number.isSafeInteger(total) ? total/100 : null;
}
