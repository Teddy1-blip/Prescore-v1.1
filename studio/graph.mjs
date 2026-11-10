import fs from 'node:fs';
import {gunzipSync} from 'node:zlib';
import {compileExpression} from './expression.mjs';
import {baseline,ACTION,RISK,requireThat} from './methodology.mjs';
import {RISK_RULE_REGISTRY} from '../lib/credit-engine/risk/rules/registry.ts';
import {RECOMMENDATION_REGISTRY} from '../lib/credit-engine/recommendations/registry.ts';
import {FACT_UNITS} from '../lib/credit-engine/risk/common.ts';
const atlas=JSON.parse(gunzipSync(fs.readFileSync(new URL('data/atlas.json.gz',import.meta.url))));
export const areas=['Документы и источники','Качество источников','Нормализация','Классификация операций','Банковские показатели','Финансовая отчётность','Кредитный портфель','Сверка источников','Оценка рисков','Контекст','Prescore Index','Готовность к финансированию','Кредитное заключение','Долговая ёмкость','Подбор продуктов','Рекомендации и план','Объяснимость','AI и извлечение','Кабинет клиента','Кабинет партнёра','Администрирование','Credit Lab и версии'];
const blocks={'01':2,'02':3,'03':4,'04':5,'05':6,'06':8,'06.5':7,'07':9,'08':22,'09':10,'10':11,'11':12,'12':13,'13':14,'14':15,'15':16,'16':16,'17':17,'18':19,'19':18};
const kinds={sources:1,classification_rules:4,risk_rules:9,context_rules:10,recommendations:16,products:15,review_items:22,index_methodology:11,capacity_methodology:14,reconciliation_rules:8,evidence:17,ui_mappings:19,cases:22,index_examples:22,learning_cards:22,coverage:22};
function area(r,k){
 if(r.id==='UI-PARTNER'||r.id.startsWith('BOOK-PT-'))return 20;
 if(/^BOOK-(OPS|GL)-/.test(r.id))return 21;
 if(r.id.startsWith('BOOK-CL-'))return 19;
 if(r.id.startsWith('BLK-'))return blocks[r.program];
 if(Object.hasOwn(kinds,k))return kinds[k];
 if(k==='metrics')return r.id.startsWith('FSM-')?6:/PORTFOLIO/i.test(r.id)?7:5;
 if(k==='data_fields')return  /^(FIN_|FS_)/.test(r.program)?6:/^(BKI_|PORTFOLIO_)/.test(r.program)?7:r.program.startsWith('BANK_')?5:10;
 const block=r.related_ids?.find(x=>x.startsWith('BLK-'));return blocks[block?.slice(4)]|| (k==='blueprint_factors'?9:21);
}
const reviewTargets={
 'REV-PROXY':['RISK-FIN-NET-ASSETS-PROXY-NEGATIVE','RISK-FIN-EQUITY-NON-POSITIVE'],
 'REV-PERIOD':['RISK-FIN-REVENUE-DECLINE','RISK-CF-OPERATING-RECEIPTS-DECLINE'],
 'REV-LINEAGE':['IDX-CONTEXT','IDX-DUP'],'REV-RNP':['BLK-14','BLK-07'],
 'REV-VERSION':['BLK-08','BLK-10'],'REV-SHADOW':['BLK-11'],
 'REV-CALIB':['IDX-CAP','BLK-10','RISK-FIN-CURRENT-LIQUIDITY'],'REV-PRICE':['UI-10'],
 'REV-OCR':['BLK-19'],'REV-COVER':['IDX-PARTIAL','BLK-10']
};
export const fieldIds={CURRENT_ASSETS:'FSM-AMT-005',SHORT_TERM_LIABILITIES:'FSM-AMT-016',INVENTORIES:'FSM-AMT-006',CASH:'FSM-AMT-010',RECEIVABLES:'FSM-AMT-008'};
const supported=new Set([...Object.values(fieldIds),'FSM-LIQ-001',RISK,'ACT-'+ACTION]);
const nodes=Object.entries(atlas).filter(([,v])=>Array.isArray(v)).flatMap(([kind,v])=>v.map(r=>({...r,kind,area:area(r,kind),editable:supported.has(r.id)})));
const ids=new Set(nodes.map(n=>n.id));
const references=[];
for(const [id,targets] of Object.entries(reviewTargets))for(const to of targets){
 if(ids.has(id)&&ids.has(to))references.push({from:id,to,type:'RELATED',executable:false,owner:'studio/editorial-review-mapping'});
}
for(const n of nodes) for(const [key,type] of [['related_ids','RELATED'],['evidence_ids','EVIDENCE']]) for(const to of n[key]||[]){
 requireThat(ids.has(to),'Осиротевшая ссылка '+to);
 references.push({from:n.id,to,type,executable:false});
}
function wire(from,to,type,unit,period,owner){return {from,to,type,unit,period,owner,valueType:['RUB','RATIO','PERCENT','COUNT','DAYS','MONTHS'].includes(unit)?'number':unit==='BOOLEAN'?'boolean':unit==='TEXT'?'string':'record',executable:true};}
const stableEdges=[wire('FSM-LIQ-001','FACT-FIN_CURRENT_RATIO','COMPUTES','RATIO','BALANCE_AS_OF','risk/adapters/financial.ts')];
for(const r of RISK_RULE_REGISTRY)for(const code of r.requiredFactCodes){
 if(ids.has('FACT-'+code))stableEdges.push(wire('FACT-'+code,r.code,'DATA_INPUT',FACT_UNITS[code]||(code==='INTEGRITY_CONFIDENCE'?'PERCENT':'COUNT'),'fact.period / analysis.asOfDate','risk/engine.ts'));
}
for(const [from,to,type,unit] of [[RISK,'BLK-10','CONSTRAINS','RiskFinding'],['BLK-10','BLK-11','DATA_INPUT','PrescoreIndexV1'],['BLK-11','BLK-12','DATA_INPUT','FinancingReadinessV1'],['BLK-12','BLK-13','DATA_INPUT','CreditAssessmentV1'],['BLK-13','BLK-14','DATA_INPUT','DebtCapacityV1'],['BLK-14','BLK-15','DATA_INPUT','ProductSelectionV1'],['BLK-15','BLK-16','COMPUTES','RecommendationSetV1'],['BLK-16','BLK-17','DATA_INPUT','ActionPlanV1'],['BLK-17','BLK-18','PRESENTS','ExplainabilityV1']])stableEdges.push(wire(from,to,type,unit,'analysis.asOfDate','production/orchestrator.ts'));
// Conditional edges describe an available contract. A run records which ones actually fired.
for(const [from,to] of [['RISK-FIN-EQUITY-NON-POSITIVE','RISK-FIN-NET-ASSETS-PROXY-NEGATIVE'],['RISK-FIN-NET-LOSS-REPEATED','RISK-FIN-NET-LOSS-CURRENT']]){
 stableEdges.push(wire(from,to,'SUPPRESSES','RiskFinding','analysis.asOfDate','risk/engine.ts'));
}
stableEdges.push(wire('BLK-09','BLK-10','MODIFIES','ContextAssessmentV1','analysis.asOfDate','index/contributions.ts'));
export function checkConnection(edge,edges,ports){
 const {from,to,type}=edge, a=ports.get(from), b=ports.get(to);
 requireThat(a && b && type!=='RELATED' && type!=='EVIDENCE','Нет исполняемого порта');
 requireThat(a.unit===b.unit && a.period===b.period && a.valueType===b.valueType,'Несовместимые единицы, тип или периоды');
 const seen=new Set(),stack=[to];
 while(stack.length){const id=stack.pop();requireThat(id!==from,'Недопустимый цикл');if(seen.has(id))continue;seen.add(id);stack.push(...edges.filter(e=>e.executable&&e.from===id).map(e=>e.to));}
}
export function graph(m=baseline()){
 const extra=m.actions.filter(a=>a.code!==ACTION).map(a=>({id:'ACT-'+a.code,name_ru:a.title,kind:'recommendations',area:16,editable:true,status:'Эксперимент',type:'recommendations',explanation:a.text,related_ids:[],evidence_ids:[],trigger:a.trigger,version:'draft'}));
 const dynamic=compileExpression(m.expression).fields.map(f=>wire(fieldIds[f],'FSM-LIQ-001','DATA_INPUT','RUB','BALANCE_AS_OF','financial-analysis/metrics.ts'));
 const recEdges=[];
 for(const d of RECOMMENDATION_REGISTRY.definitions){
  const edited=m.actions.find(a=>a.code===d.code);
  const triggers=edited?[{kind:'RISK_FINDING_CODE',code:edited.trigger}]:d.triggerSpecification;
  for(const t of triggers)if(t.kind==='RISK_FINDING_CODE')recEdges.push(wire(t.code,'ACT-'+d.code,'RECOMMENDS','RiskFinding','analysis.asOfDate','recommendations/triggers.ts'));
 }
 for(const a of m.actions.filter(a=>a.code!==ACTION))recEdges.push(wire(a.trigger,'ACT-'+a.code,'RECOMMENDS','RiskFinding','analysis.asOfDate','recommendations/triggers.ts'));
 return {version:atlas.metadata.version,base:atlas.metadata.commit_sha,areas,nodes:[...nodes,...extra],edges:[...references,...stableEdges,...dynamic,...recEdges]};
}
export const graphBase=graph();
const moneyPort=Object.freeze({unit:'RUB',period:'BALANCE_AS_OF',valueType:'number'});
const findingPort=Object.freeze({unit:'RiskFinding',period:'analysis.asOfDate',valueType:'record'});
function declaredPort(id,asInput){
 if(asInput && id==='FSM-LIQ-001'||!asInput && Object.values(fieldIds).includes(id))return moneyPort;
 if(asInput && id.startsWith('ACT-')||!asInput && RISK_RULE_REGISTRY.some(r=>r.code===id))return findingPort;
 return null;
}
function validateEdge(from,to,type,edges){
 const ports=new Map([[from,declaredPort(from,false)],[to,declaredPort(to,true)]]);
 checkConnection({from,to,type},edges,ports);
}
export function validateWires(m){
 for(const f of compileExpression(m.expression).fields)validateEdge(fieldIds[f],'FSM-LIQ-001','DATA_INPUT',stableEdges);
 for(const a of m.actions)validateEdge(a.trigger,'ACT-'+a.code,'RECOMMENDS',stableEdges);
}
// An editable wire must correspond to an input the actual owner consumes.
export function connectPorts(m,{from,to,replace}){
 const copy=structuredClone(m);
 if(to==='FSM-LIQ-001'){
  validateEdge(from,to,'DATA_INPUT',stableEdges);
  const code=Object.keys(fieldIds).find(k=>fieldIds[k]===from);
  requireThat(compileExpression(copy.expression).fields.includes(replace),'Укажите существующий вход формулы');
  copy.expression=copy.expression.replace(/[A-Z][A-Z_0-9]*/g,word=>word===replace?code:word);
 }else{
  validateEdge(from,to,'RECOMMENDS',stableEdges);
  const target=copy.actions.find(a=>'ACT-'+a.code===to);
  requireThat(target,'Откройте поддерживаемую рекомендацию в черновике');target.trigger=from;
 }
 validateWires(copy);return copy;
}
