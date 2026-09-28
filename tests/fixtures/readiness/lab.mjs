import {buildFinancingReadiness} from '../../../lib/credit-engine/readiness/engine.ts';
import {id,stable,levelRank,rank} from '../../../lib/credit-engine/readiness/common.ts';
export const fingerprint=e=>id('readiness-golden',e);
const matches=(c,x)=>Object.entries(x).every(([k,v])=>c[k]===v);
export function expectations(e,r,error=null){const out=[];const check=(ok,code,expected,actual,level='HARD')=>{if(!ok)out.push({mismatchId:id('readiness-mismatch',e.caseId,code,expected,actual),code,expected,actual,level});};const ex=e.expected;
 if(ex.invalid){check(!!error&&error.includes(ex.invalid),'EXPECTED_REJECTION',ex.invalid,error);return out;}
 check(!!r&&!error,'EXECUTION',true,error);if(!r)return out;
 for(const k of ['status','level','baseLevel','confidence','comparable','uncertaintyCapApplied'])if(Object.hasOwn(ex,k))check(r[k]===ex[k],k.toUpperCase()+'_MISMATCH',ex[k],r[k]);
 if(Object.hasOwn(ex,'indexValue'))check(r.indexReference.value===ex.indexValue,'INDEX_VALUE_MISMATCH',ex.indexValue,r.indexReference.value);
 for(const reason of ex.capReasons??[])check(r.uncertaintyCapReasons.includes(reason),'CAP_REASON',reason,r.uncertaintyCapReasons);
 for(const x of ex.required??[])check(r.constraints.some(c=>matches(c,x)),'MISSING_CONSTRAINT',x,r.constraints);
 for(const x of ex.forbidden??[])check(!r.constraints.some(c=>matches(c,x)),'FORBIDDEN_CONSTRAINT',x,r.constraints);
 for(const [k,v] of Object.entries(ex.summary??{}))check(r.summary[k]===v,'SUMMARY_'+k,v,r.summary[k]);
 if(ex.caseDefinitionStatus)check(r.caseDefinition.status===ex.caseDefinitionStatus,'CASE_DEFINITION',ex.caseDefinitionStatus,r.caseDefinition.status);
 if(ex.invariants){check(r.indexReference.value===e.input.prescoreIndex.value,'NO_SECOND_SCORE',e.input.prescoreIndex.value,r.indexReference.value);check(rank(r.confidence)<=rank(e.input.prescoreIndex.confidence),'CONFIDENCE_NOT_PROMOTED',true,r.confidence);check(!r.comparable||r.status==='ASSESSED'&&e.input.prescoreIndex.comparable,'COMPARABILITY',true,r.comparable);check(levelRank[r.level]<=levelRank[r.baseLevel],'CAP_ONLY_DOWNWARD',true,r.level);check(r.constraints.every(c=>c.riskFindingIds.length||c.contextRelationIds.length),'CONSTRAINT_LINEAGE',true,r.constraints);}
 if(ex.defect)check(r.constraints.every(c=>!c.reasonCodes.some(s=>['DELINQUENCY_1_29','DELINQUENCY_30_59','DELINQUENCY_60_PLUS'].includes(s))),'HISTORICAL_ZERO_NOT_DELAY_BAND',true,r.constraints);
 for(const a of ex.reviewAssertions??[])check(r[a.field]===a.value,'REVIEW_'+a.field,a.value,r[a.field],'REVIEW');
 return out;}
export function compareReadiness(a,b,operator='EQ',field='level'){const get=r=>field==='output'?stable(r):field==='indexValue'?r.indexReference.value:field==='level'||field==='baseLevel'?levelRank[r[field]]:r[field];const x=get(a),y=get(b);return operator==='EQ'?x===y:x===null||y===null?false:operator==='GT'?x>y:x<y;}
export function runReadinessPack(pack){for(const e of pack.entries)if(pack.fingerprints[e.caseId]!==fingerprint(e))throw Error('READINESS_GOLDEN_FINGERPRINT_MISMATCH');const rs=pack.entries.map(e=>{const before=stable(e.input);let actual=null,error=null;try{actual=buildFinancingReadiness(e.input);}catch(ex){error=ex.message;}const mismatches=expectations(e,actual,error);if(stable(e.input)!==before)mismatches.push({code:'UPSTREAM_MUTATED',level:'HARD'});return {caseId:e.caseId,actual,error,mismatches};});for(const e of pack.entries){const r=rs.find(r=>r.caseId===e.caseId);for(const p of e.expected.relative??[]){const other=rs.find(r=>r.caseId===p.other);if(!r.actual||!other?.actual||!compareReadiness(r.actual,other.actual,p.operator,p.field))r.mismatches.push({code:'PAIRWISE_MISMATCH',level:'HARD',expected:p});}}return rs.map(r=>({...r,result:r.mismatches.some(m=>m.level==='HARD')?'FAIL':r.mismatches.length?'REVIEW':'PASS'}));}
