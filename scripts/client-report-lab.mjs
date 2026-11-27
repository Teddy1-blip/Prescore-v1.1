import {buildClientReportEntries} from '../tests/fixtures/client-report/golden-client-report-pack-v1.mjs';
import {runClientReportPack} from '../tests/fixtures/client-report/lab.mjs';
const report=runClientReportPack(buildClientReportEntries());console.log(JSON.stringify(report,null,2));if(report.results.some(r=>r.result!=='PASS'))process.exitCode=1;
