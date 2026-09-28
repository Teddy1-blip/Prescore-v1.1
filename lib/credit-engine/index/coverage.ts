import {INDEX_COMPONENTS,type PrescoreIndexInputV1,type IndexCoverageV1,type IndexPolicyV1,type IndexCoverageComponent} from '../contracts/index.ts';
import {rank,weakest,unique} from './common.ts';
import {INDEX_POLICY} from './policy.ts';
export function indexCoverage(input:PrescoreIndexInputV1,policy:IndexPolicyV1=INDEX_POLICY):IndexCoverageV1{
 const r=input.riskAssessment,c=input.contextAssessment;
 const components:IndexCoverageComponent[]=INDEX_COMPONENTS.map(component=>{const spec=policy.coverage[component],known:string[]=[],missing:string[]=[],used:Array<(typeof r.facts)[number]|(typeof c.facts)[number]>=[];
 for(const code of spec.requiredFactCodes){const canonical=r.facts.filter(f=>f.semanticCode===code),xs=canonical.length?canonical:c.facts.filter(f=>f.semanticCode===code&&f.sourceClass!=='CLIENT_DECLARED');const f=xs[0];const good=xs.length===1&&(component!=='OPERATING_BEHAVIOR'||!!f.period.from&&!!f.period.to)&&f.status==='KNOWN'&&f.value!==null&&rank(f.confidence)>=2&&f.evidence.length>0&&f.evidence.every(e=>rank(e.confidence)>=2)&&!f.warnings.some(w=>/CONFLICT|SOURCE_STALE|SOURCE_NOT_READY/.test(w));if(good){known.push(code);used.push(f);}else missing.push(code);}
 let state:IndexCoverageComponent['state']=known.length>=spec.adequateKnown?'ADEQUATE':known.length>=spec.minimumKnown?'LIMITED':'INSUFFICIENT';
 if(component==='OPERATING_BEHAVIOR'&&used.find(f=>f.semanticCode==='BANK_COVERAGE_ADEQUATE')?.value!==true&&state==='ADEQUATE')state='LIMITED';
 return {component,state,knownFactCodes:known,missingFactCodes:missing,factIds:unique(used.map(f=>f.factId)),confidence:weakest(...used.flatMap(f=>[f.confidence,...f.evidence.map(e=>e.confidence)])),warnings:state==='ADEQUATE'?[]:['CORE_COVERAGE_'+state]};});
 return {components,adequateComponentCount:components.filter(c=>c.state==='ADEQUATE').length,limitedComponentCount:components.filter(c=>c.state==='LIMITED').length,insufficientComponentCount:components.filter(c=>c.state==='INSUFFICIENT').length,warnings:['OPTIONAL_BKI_PORTFOLIO_NOT_REQUIRED_FOR_CORE']};
}
