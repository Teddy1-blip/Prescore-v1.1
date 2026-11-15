import {writeFileSync} from 'node:fs';
import {initial,runComparison,makePackage} from './runtime.mjs';
for(const kind of ['formula','source']){
 const d=initial();
 if(kind==='formula'){d.name='Ликвидность без дебиторской задолженности';d.method.expression='(CURRENT_ASSETS - RECEIVABLES) / SHORT_TERM_LIABILITIES';}
 else{d.name='Исключение БФО';d.mode='data';d.scenario.financial=false;}
 const run=runComparison(d,'synthetic-fixture');
 writeFileSync(new URL('samples/'+kind+'.json',import.meta.url),JSON.stringify(makePackage(d,run),null,2)+'\n');
}
