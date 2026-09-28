// Generates synthetic preview material, NOT Golden expectations.
import fs from 'node:fs';
import {healthy,baseline,scenario,defect,presentationInput} from '../tests/fixtures/client-report/builders.mjs';
import {riskInputs} from '../tests/fixtures/recommendations/builders.mjs';
import {buildClientReportModel} from '../lib/credit-engine/client-report/adapter.ts';
const samples={healthy:healthy(),partial:baseline(),insufficient:baseline({missingCore:true}),zero:scenario({debt:1000000}),stop:scenario({values:riskInputs['RISK-LEGAL-ENTITY-TERMINATED']}),defect:defect(),nonzero:scenario({debt:125000}),free:baseline()};
const outputs=Object.fromEntries(Object.entries(samples).map(([key,x])=>[key,buildClientReportModel(presentationInput(x),{entitlement:key==='free'?'FREE':'FULL'})]));
fs.writeFileSync(new URL('../tests/fixtures/client-report/preview-models.json',import.meta.url),JSON.stringify(outputs,null,2)+'\n');
