import type {PortableDatabase} from '../db/compatibility.ts';
import type {WorkspaceModelV1} from '../workspace/model.ts';
import {WORKSPACE_MODEL_V1} from '../workspace/model.ts';
import {CANONICAL_WIRING_VERSION} from '../credit-engine/production/orchestrator.ts';
import {rows} from './resources.ts';
// Version follows the public projection and canonical wiring. Fingerprint follows both saved inputs.
export const OBSERVATION_VERSION=WORKSPACE_MODEL_V1+':'+CANONICAL_WIRING_VERSION;
export const fingerprintSQL="md5(a.payload || COALESCE((SELECT p.payload FROM checko_profiles p WHERE p.inn=a.company_inn),''))";
export async function observeCanonical(db:PortableDatabase,model:WorkspaceModelV1,expectedFingerprint?:string){
 const input=(await rows(db,`SELECT ${fingerprintSQL} AS fingerprint FROM analyses a WHERE a.id=?`,[model.analysisId]))[0];
 if(!input||expectedFingerprint&&input.fingerprint!==expectedFingerprint)return;
 const c=model.full?.canonical;
 const source=model.basic?.sources;
 const incomplete=(source?.completeness!==null&&source?.completeness!==undefined&&source.completeness<100)||source?.missingSources?.length||source?.availability?.some(s=>s.status!=='READY');
 const canonicalState=model.fullAvailability==='READY'&&c?'READY':'UNAVAILABLE';
 const sourceState=source?.completeness===null||source?.completeness===undefined?'UNKNOWN':incomplete?'INCOMPLETE':'COMPLETE';
 await db.prepare(`INSERT INTO admin_analysis_observations (analysis_id,input_fingerprint,canonical_version,canonical_state,source_state,completeness,index_value,readiness,assessment,debt_capacity_status,critical_count,observed_at)
 VALUES (?,?,?,?,?,?,?,?,?,?,?,?) ON CONFLICT(analysis_id) DO UPDATE SET input_fingerprint=excluded.input_fingerprint,canonical_version=excluded.canonical_version,canonical_state=excluded.canonical_state,source_state=excluded.source_state,completeness=excluded.completeness,index_value=excluded.index_value,readiness=excluded.readiness,assessment=excluded.assessment,debt_capacity_status=excluded.debt_capacity_status,critical_count=excluded.critical_count,observed_at=excluded.observed_at`)
 .bind(model.analysisId,input.fingerprint,OBSERVATION_VERSION,canonicalState,sourceState,source?.completeness??null,c?.prescoreIndex.value??null,c?.financingReadiness.level??null,c?.creditAssessment.status??null,c?.debtCapacity.status??null,c?new Set(c.creditAssessment.drivers.filter(d=>d.severity==='CRITICAL').map(d=>d.riskFindingId)).size:null,new Date().toISOString()).run();
}
export const observationJoin=`LEFT JOIN admin_analysis_observations o ON o.analysis_id=a.id AND o.input_fingerprint=${fingerprintSQL} AND o.canonical_version='${OBSERVATION_VERSION}'`;
export const observationColumns=`COALESCE(o.canonical_state,'UNKNOWN') AS canonicalState,COALESCE(o.source_state,'UNKNOWN') AS sourceState,o.completeness AS completeness,o.index_value AS prescoreIndex,o.readiness AS readiness,o.assessment AS assessment,o.debt_capacity_status AS debtCapacityStatus,o.observed_at AS observedAt`;
