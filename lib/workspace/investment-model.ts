export function businessValue(flows:number[],wacc:number,growth:number,netDebt:number|null){
  if(flows.length<1||flows.length>10||!flows.every(Number.isFinite)||!Number.isFinite(wacc)||!Number.isFinite(growth)||wacc<=0||growth<=-100||growth>=wacc||flows.at(-1)!<=0||netDebt!==null&&!Number.isFinite(netDebt))return null;
  const rate=wacc/100,g=growth/100;
  const terminal=flows.at(-1)!*(1+g)/(rate-g);
  const ev=flows.reduce((pv,f,i)=>pv+f/(1+rate)**(i+1),0)+terminal/(1+rate)**flows.length;
  if(!Number.isFinite(ev))return null;
  return {ev,equity:netDebt===null?null:ev-netDebt};
}
