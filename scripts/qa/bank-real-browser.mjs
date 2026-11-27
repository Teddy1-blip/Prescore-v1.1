// Invoked only with local private acceptance inputs. Never persist UI text or real screenshots.
import assert from 'node:assert/strict';
import {execFileSync} from 'node:child_process';
import fs from 'node:fs';
import {statementFixture} from '../../tests/fixtures/block1-statements.mjs';

export async function realBankBrowser(page,base,file,zeroFile) {
  const oracle=JSON.parse(execFileSync('python3',['scripts/qa/bank-statement-oracle.py',file],{encoding:'utf8'}));
  const real=fs.readFileSync(file);
  const zero=fs.readFileSync(zeroFile);
  await page.goto(base+'/dashboard?view=upload');
  const input=page.locator('input[type=file]').first();
  await input.waitFor({state:'attached'});
  const txt=(name,buffer)=>({name,mimeType:'text/plain',buffer});
  await input.setInputFiles([
    txt('bank-A.txt',real),txt('bank-A-copy.txt',real),txt('empty.txt',zero),
    txt('another-owner.txt',Buffer.from(statementFixture({inn:'9999999999'}))),
    {name:'unsupported.pdf',mimeType:'application/pdf',buffer:Buffer.from('%PDF-')},
  ]);
  await page.getByText(/Excel, PDF и архивы не поддерживаются/).first().waitFor();
  const saved=page.waitForResponse(r=>r.url().endsWith('/api/analysis') && r.request().method()==='POST');
  await page.getByRole('button',{name:'Рассчитать по выбранным файлам'}).click();
  const response=await saved;
  assert.equal(response.status(),200);
  const body=await response.json(), id=body.analysis.id;
  assert.deepEqual(body.screeningResults.map(r=>r.status),['ACCEPTED','DUPLICATE','UNRECOGNIZED','COMPANY_MISMATCH']);
  assert.match(body.screeningResults[2].reason,/нет операций/);
  await page.waitForURL(u=>u.searchParams.get('analysisId')===id);
  const summary=page.locator('details').filter({hasText:'another-owner.txt'}).last();
  if(await summary.count()){await summary.evaluate(el=>{el.open=true});await summary.getByText(/не совпадает/).first().waitFor();}
  await page.goto(base+'/dashboard?view=banking&analysisId='+id);
  await page.getByRole('group',{name:'Режим графика'}).waitFor();
  const endpoint=base+'/api/workspace-model?analysisId='+id;
  const model=await(await page.request.get(endpoint)).json();
  const facts=model.basic.bankingFacts;
  const raw=new TextDecoder('windows-1251').decode(real);
  const records=raw.split(/СекцияДокумент=/).slice(1).map(t=>Object.fromEntries(t.split('КонецДокумента')[0].split(/\r?\n/).filter(l=>l.includes('=')).map(l=>[l.slice(0,l.indexOf('=')),l.slice(l.indexOf('=')+1).trim()])));
  const accounts=new Set([...raw.matchAll(/^РасчСчет=(\d{20})/gm)].map(m=>m[1]));
  const company=model.basic.analysis.company;
  assert.ok(records.some(r=>['Плательщик','Получатель'].some(s=>accounts.has(r[s+'Счет']) && r[s+'ИНН']===company.inn &&
    [r[s],r[s+'1']].some(v=>v?.replace(/\s+/g,' ').trim()===company.name))));
  assert.ok(!/psb.?online|псб.?онлайн/i.test(company.name));
  assert.equal(model.basic.sources.statements.bankNames.includes('ПСБ'),true);
  await page.getByText(company.name,{exact:false}).first().waitFor({state:'attached'});
  const pageText=await page.locator('body').innerText();
  assert.ok(pageText.includes('ПСБ'));
  assert.deepEqual([model.basic.analysis.period.from,model.basic.analysis.period.to],oracle.period);
  const money=n=>new Intl.NumberFormat('ru-RU',{maximumFractionDigits:2}).format(n)+' ₽';
  const compact=s=>s.replace(/\s/g,'');
  const expected={grossInflow:oracle.total.external_in,grossOutflow:oracle.total.external_out,netCashFlow:oracle.total.external_in-oracle.total.external_out,
    endingBalance:oracle.closing,averageDailyBalance:oracle.average,minimumDailyBalance:oracle.minimum};
  for(const [key, cents] of Object.entries(expected)){
    assert.equal(Math.round(facts[key].value*100),cents,key);
    const field=page.locator('[data-banking-fact="'+key+'"]').first();await field.waitFor();
    assert.ok(compact(await field.innerText()).includes(compact(money(cents/100))),key);
  }
  assert.equal(facts.lowLiquidityDays.value,oracle.lowDays);
  const full=await page.request.get(base+'/__qa/assign?id='+id+'&full=1');assert.equal(full.status(),200);
  await page.reload();
  const month=facts.monthly.find(m=>m.externalInflows>0);
  const button=page.getByRole('button',{name:new RegExp('^Внешние поступления · '+month.month.split('-').reverse().join('\\.')+' ·')});
  await button.click();
  const detail=page.getByRole('region',{name:'Расшифровка операций'});await detail.locator('li').first().waitFor();
  assert.ok(compact(await detail.innerText()).includes(compact(money(oracle.months[month.month].external_in/100))));
  const savedData=async()=>JSON.stringify((await(await page.request.get(endpoint)).json()).basic.bankingFacts);
  const before=await savedData();
  const selectedUrl=page.url();await page.reload();await detail.locator('li').first().waitFor();
  assert.equal(page.url(),selectedUrl);assert.equal(await savedData(),before);
  const widths=[];
  for(const width of [1440,390]){
    await page.setViewportSize({width,height:900});
    const content=await page.evaluate(()=>document.documentElement.scrollWidth);
    assert.ok(content<=width,'Real banking layout overflow at '+width);widths.push(width);
  }
  return {realUpload:true,visibleBank:true,companyEvidence:true,sourcePeriod:true,checkedVisibleFacts:Object.keys(expected).length,
    originalRows:oracle.rows,emptyFileRejected:true,duplicateExcluded:true,mixedCompanyRejected:true,unsupportedReason:true,
    monthlyDrillDeltaKopecks:0,reloadIdentical:true,overflowFree:widths};
}
