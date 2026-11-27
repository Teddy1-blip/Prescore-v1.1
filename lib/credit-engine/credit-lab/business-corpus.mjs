import fs from 'node:fs';
import path from 'node:path';
import {unzipSync} from 'fflate';
import {buildBusinessInput} from './business-input.mjs';
let files;
export function corpusFiles(){return files??=unzipSync(fs.readFileSync(path.join(process.cwd(),'tests/fixtures/credit-lab/development-v1/business-sources.zip')));}
export function businessCatalog(){return JSON.parse(Buffer.from(corpusFiles()['catalog.json']).toString('utf8')).cases;}
export function loadBusiness(caseId){if(!businessCatalog().some(c=>c.caseId===caseId))throw Error('SYNTHETIC_CASE_NOT_ALLOWED');return buildBusinessInput('/synthetic',caseId,corpusFiles());}
