import type {PrintBankingV1} from "../../workspace/print-banking.ts";
import type {ClientReportModelV1} from "../contracts/client-report.ts";
import type {CanonicalCreditAnalysisV1} from "./orchestrator.ts";
import type {ReportAccess} from "./report-service.ts";
import {decisionSnapshot} from "./snapshot.ts";

export const DECISION_HISTORY_VERSION = "PRESCORE-DECISION-HISTORY-1" as const;

type DigestAmount = {value:number|null; confidence:string};
type DigestRisk = {key:string; code:string; severity:string; scope:string; decisionImpact:string; subjectKey:string|null; obligationId:string|null};
type DigestObligation = {obligationId:string; type:string; exposureClass:string; status:string|null; creditor:string|null; principal:number|null; principalKnowledge:string; confidence:string};
type DigestProduct = {productFamily:string; fitLevel:string; rank:number|null; primary:boolean; confidence:string};
type DigestAction = {continuityKey:string; recommendationCode:string; horizon:string; status:string; completionState:string};

export type DecisionHistoryDigestV1 = {
  version: typeof DECISION_HISTORY_VERSION;
  snapshotId: string;
  analysisId: string;
  asOfDate: string;
  sourceIds: string[];
  index: {value:number|null; status:string; confidence:string};
  readiness: {level:string; status:string; confidence:string};
  risks: DigestRisk[];
  portfolio: {
    activeObligationCount:number;
    fundedDebt:DigestAmount;
    scheduledPayments30d:DigestAmount;
    obligations:DigestObligation[];
  };
  capacity: {
    status:string; confidence:string;
    recurringPrudential:number|null; recurringMaximum:number|null;
    nearTermPrudential:number|null; nearTermMaximum:number|null;
  };
  products: DigestProduct[];
  actions: DigestAction[];
};

export type DecisionRevisionDatabase = {
  prepare(sql:string): {
    bind(...values:unknown[]): {
      run():Promise<unknown>;
      first<T=unknown>():Promise<T|null>;
      all<T=unknown>():Promise<{results?:T[]}>;
    };
  };
};

export type DecisionRevisionSummaryV1 = {
  snapshotId:string; analysisId:string; asOfDate:string; createdAt:string;
  inputFingerprint:string; engineVersion:string; reportVersion:string; indexValue:number|null; readinessLevel:string|null;
};

export type DecisionChangeArea = "SOURCES"|"INDEX"|"READINESS"|"RISK"|"PORTFOLIO"|"CAPACITY"|"PRODUCTS"|"ACTIONS";
export type DecisionChangeV1 = {
  area:DecisionChangeArea;
  entityId:string;
  kind:"ADDED"|"REMOVED"|"CHANGED";
  before:unknown;
  after:unknown;
};

function amount(value:{value:number|null;confidence:string}):DigestAmount {
  return {value:value.value,confidence:value.confidence};
}
function same(a:unknown,b:unknown){return JSON.stringify(a)===JSON.stringify(b);}
function sorted<T>(values:T[], key:(value:T)=>string){return [...values].sort((a,b)=>key(a).localeCompare(key(b)));}

export function buildDecisionHistoryDigest(result:CanonicalCreditAnalysisV1):DecisionHistoryDigestV1 {
  const snapshot=decisionSnapshot(result);
  const risks=sorted(result.riskAssessment.findings.map(f=>({
    key:[f.code,f.subjectKey??"",f.portfolioObligationId??""].join("|"),
    code:f.code,severity:f.severity,scope:f.scope,decisionImpact:f.decisionImpact,
    subjectKey:f.subjectKey??null,obligationId:f.portfolioObligationId??null,
  })),v=>v.key);
  const obligations=sorted(result.creditPortfolio.obligations.map(o=>({
    obligationId:o.obligationId,type:o.type,exposureClass:o.exposureClass,status:o.status.value??null,
    creditor:o.identity.creditorName.value??null,principal:o.currentPosition.principalOutstanding.value,
    principalKnowledge:o.currentPosition.principalOutstanding.knowledge,
    confidence:o.currentPosition.principalOutstanding.confidence,
  })),v=>v.obligationId);
  const products=sorted(result.productSelection.candidates.map(p=>({
    productFamily:p.productFamily,fitLevel:p.fitLevel,rank:p.rank,primary:p.primaryCandidate,confidence:p.confidence,
  })),v=>v.productFamily);
  const actions=sorted(result.actionPlan.items.map(a=>({
    continuityKey:a.continuityKey,recommendationCode:a.recommendationCode,horizon:a.horizon,status:a.status,completionState:a.completionState,
  })),v=>v.continuityKey);
  return {
    version:DECISION_HISTORY_VERSION,snapshotId:snapshot.snapshotId,analysisId:result.analysisId,asOfDate:result.asOfDate,
    sourceIds:[...new Set(result.sourceObservations.map(s=>s.sourceId))].sort(),
    index:{value:result.prescoreIndex.value,status:result.prescoreIndex.status,confidence:result.prescoreIndex.confidence},
    readiness:{level:result.financingReadiness.level,status:result.financingReadiness.status,confidence:result.financingReadiness.confidence},
    risks,
    portfolio:{
      activeObligationCount:result.creditPortfolio.summary.activeObligationCount,
      fundedDebt:amount(result.creditPortfolio.summary.fundedDebt),
      scheduledPayments30d:amount(result.creditPortfolio.summary.scheduledPayments30d),
      obligations,
    },
    capacity:{
      status:result.debtCapacity.status,confidence:result.debtCapacity.confidence,
      recurringPrudential:result.debtCapacity.recurringView.incrementalHeadroom.prudential,
      recurringMaximum:result.debtCapacity.recurringView.incrementalHeadroom.maximumPolicy,
      nearTermPrudential:result.debtCapacity.nearTerm30dView.incrementalHeadroom.prudential,
      nearTermMaximum:result.debtCapacity.nearTerm30dView.incrementalHeadroom.maximumPolicy,
    },
    products,actions,
  };
}

export function compareDecisionHistoryDigests(before:DecisionHistoryDigestV1,after:DecisionHistoryDigestV1) {
  const changes:DecisionChangeV1[]=[];
  const emit=(area:DecisionChangeArea,entityId:string,kind:DecisionChangeV1["kind"],a:unknown,b:unknown)=>{
    changes.push({area,entityId,kind,before:a,after:b});
  };
  if(!same(before.sourceIds,after.sourceIds)) emit("SOURCES","sources","CHANGED",before.sourceIds,after.sourceIds);
  if(!same(before.index,after.index)) emit("INDEX","prescore-index","CHANGED",before.index,after.index);
  if(!same(before.readiness,after.readiness)) emit("READINESS","financing-readiness","CHANGED",before.readiness,after.readiness);
  const mapDiff=<T>(area:DecisionChangeArea,a:T[],b:T[],key:(v:T)=>string)=>{
    const left=new Map(a.map(v=>[key(v),v])),right=new Map(b.map(v=>[key(v),v]));
    for(const id of [...new Set([...left.keys(),...right.keys()])].sort()){
      if(!left.has(id)) emit(area,id,"ADDED",null,right.get(id));
      else if(!right.has(id)) emit(area,id,"REMOVED",left.get(id),null);
      else if(!same(left.get(id),right.get(id))) emit(area,id,"CHANGED",left.get(id),right.get(id));
    }
  };
  mapDiff("RISK",before.risks,after.risks,v=>v.key);
  const beforePortfolio={activeObligationCount:before.portfolio.activeObligationCount,fundedDebt:before.portfolio.fundedDebt,scheduledPayments30d:before.portfolio.scheduledPayments30d};
  const afterPortfolio={activeObligationCount:after.portfolio.activeObligationCount,fundedDebt:after.portfolio.fundedDebt,scheduledPayments30d:after.portfolio.scheduledPayments30d};
  if(!same(beforePortfolio,afterPortfolio)) emit("PORTFOLIO","portfolio-summary","CHANGED",beforePortfolio,afterPortfolio);
  mapDiff("PORTFOLIO",before.portfolio.obligations,after.portfolio.obligations,v=>v.obligationId);
  if(!same(before.capacity,after.capacity)) emit("CAPACITY","debt-capacity","CHANGED",before.capacity,after.capacity);
  mapDiff("PRODUCTS",before.products,after.products,v=>v.productFamily);
  mapDiff("ACTIONS",before.actions,after.actions,v=>v.continuityKey);
  const counts=Object.fromEntries(["SOURCES","INDEX","READINESS","RISK","PORTFOLIO","CAPACITY","PRODUCTS","ACTIONS"].map(area=>[area,changes.filter(c=>c.area===area).length]));
  return {version:DECISION_HISTORY_VERSION,fromSnapshotId:before.snapshotId,toSnapshotId:after.snapshotId,changes,counts};
}

export async function persistDecisionRevision(db:DecisionRevisionDatabase,input:{canonical:CanonicalCreditAnalysisV1;report:ClientReportModelV1;access:ReportAccess;banking?:PrintBankingV1|null}) {
  const snapshot=decisionSnapshot(input.canonical);
  if(input.report.meta.snapshot && input.report.meta.snapshot.snapshotId!==snapshot.snapshotId) throw new Error("DECISION_SNAPSHOT_MISMATCH");
  const owner=input.access.row.ownerEmail;
  if(!owner) return false;
  const report=structuredClone(input.report);
  report.meta.snapshot=snapshot;
  const digest=buildDecisionHistoryDigest(input.canonical);
  const result=await db.prepare(`INSERT INTO analysis_decision_revisions
    (snapshot_id,analysis_id,owner_email,company_inn,as_of_date,input_fingerprint,engine_version,report_version,public_model,decision_digest)
    VALUES (?,?,?,?,?,?,?,?,?,?) ON CONFLICT (snapshot_id) DO NOTHING`)
    .bind(snapshot.snapshotId,input.canonical.analysisId,owner,input.canonical.creditAssessment.companyInn,snapshot.asOfDate,snapshot.inputFingerprint,snapshot.engineVersion,snapshot.reportVersion,JSON.stringify(report),JSON.stringify({...digest,printBanking:input.banking??null})).run() as {meta?:{changes?:number};changes?:number};
  return (result.meta?.changes??result.changes??0)>0;
}

export async function listDecisionRevisions(db:DecisionRevisionDatabase,analysisId:string):Promise<DecisionRevisionSummaryV1[]> {
  const rows=await db.prepare(`SELECT snapshot_id AS "snapshotId",analysis_id AS "analysisId",as_of_date AS "asOfDate",
    created_at AS "createdAt",input_fingerprint AS "inputFingerprint",engine_version AS "engineVersion",report_version AS "reportVersion",
    (decision_digest::jsonb #>> '{index,value}')::double precision AS "indexValue",decision_digest::jsonb #>> '{readiness,level}' AS "readinessLevel"
    FROM analysis_decision_revisions WHERE analysis_id=? ORDER BY created_at DESC,snapshot_id DESC`)
    .bind(analysisId).all<DecisionRevisionSummaryV1>();
  return rows.results??[];
}

export async function readDecisionRevision(db:DecisionRevisionDatabase,analysisId:string,snapshotId:string) {
  const row=await db.prepare(`SELECT public_model AS "publicModel",decision_digest AS "decisionDigest"
    FROM analysis_decision_revisions WHERE analysis_id=? AND snapshot_id=? LIMIT 1`).bind(analysisId,snapshotId)
    .first<{publicModel:string;decisionDigest:string}>();
  if(!row)return null;
  try{
    const {printBanking,...digest}=JSON.parse(row.decisionDigest) as DecisionHistoryDigestV1 & {printBanking?:PrintBankingV1|null};
    return {model:JSON.parse(row.publicModel) as ClientReportModelV1,digest,banking:printBanking??null};
  }
  catch{return null;}
}

export async function compareDecisionRevisions(db:DecisionRevisionDatabase,analysisId:string,fromSnapshotId:string,toSnapshotId:string) {
  const [before,after]=await Promise.all([readDecisionRevision(db,analysisId,fromSnapshotId),readDecisionRevision(db,analysisId,toSnapshotId)]);
  if(!before||!after)return null;
  return compareDecisionHistoryDigests(before.digest,after.digest);
}
