import {loadRecommendationPack} from '../tests/fixtures/recommendations/golden-recommendations-pack-v1.mjs';
import {runRecommendationPack} from '../lib/credit-engine/recommendations/lab.ts';
import {auditRecommendationCoverage} from '../lib/credit-engine/recommendations/coverage.ts';
const results=runRecommendationPack(loadRecommendationPack());const report={summary:{total:results.length,PASS:results.filter(r=>r.result==='PASS').length,REVIEW:0,FAIL:results.filter(r=>r.result==='FAIL').length},coverage:auditRecommendationCoverage(),cases:results.map(({caseId,result,mismatches})=>({caseId,result,mismatches}))};console.log(JSON.stringify(report,null,2));if(report.summary.FAIL)process.exitCode=1;
