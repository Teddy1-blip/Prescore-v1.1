import type {RecommendationV1 as Rec} from '../contracts/recommendations.ts';
import {fail} from './common.ts';
export type DependencyGraph={orderedIds:string[];prerequisites:Map<string,string[]>;dependents:Map<string,string[]>;unblockers:Set<string>};
// Kahn traversal: each edge is visited once; no recursive path explosion.
export function resolveActionPlanDependencies(rs:Rec[],compare:(a:Rec,b:Rec)=>number=(a,b)=>a.recommendationId.localeCompare(b.recommendationId)):DependencyGraph{
 const byId=new Map(rs.map(r=>[r.recommendationId,r])),prerequisites=new Map<string,string[]>(),dependents=new Map<string,string[]>(),counts=new Map<string,number>();if(byId.size!==rs.length)fail('DUPLICATE_RECOMMENDATION_ID');
 for(const r of rs){const ps=[...new Set(r.prerequisiteRecommendationIds)].sort();if(ps.length!==r.prerequisiteRecommendationIds.length)fail('DUPLICATE_DEPENDENCY');for(const p of ps){if(!byId.has(p))fail('DANGLING_DEPENDENCY');dependents.set(p,[...(dependents.get(p)??[]),r.recommendationId]);}prerequisites.set(r.recommendationId,ps);counts.set(r.recommendationId,ps.length);}
 const ready=rs.filter(r=>!counts.get(r.recommendationId)),orderedIds:string[]=[];
 while(ready.length){ready.sort(compare);const r=ready.shift()!;orderedIds.push(r.recommendationId);for(const d of dependents.get(r.recommendationId)??[]){counts.set(d,counts.get(d)!-1);if(!counts.get(d))ready.push(byId.get(d)!);}}
 if(orderedIds.length!==rs.length)fail('DEPENDENCY_CYCLE');const unblockers=new Set<string>();
 for(const key of [...orderedIds].reverse()){const r=byId.get(key)!;if(unblockers.has(key)||['P0_CRITICAL','P1_HIGH'].includes(r.priority))for(const p of prerequisites.get(key)!)unblockers.add(p);}
 return {orderedIds,prerequisites,dependents,unblockers};
}
