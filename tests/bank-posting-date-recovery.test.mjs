import test from 'node:test';
import assert from 'node:assert/strict';
import {adaptOneCDocument} from '../lib/credit-engine/normalization/one-c-parser-adapter.ts';
import {normalizeTransaction} from '../lib/credit-engine/normalization/transaction-normalizer.ts';
import {analyzeBankStatements} from '../lib/prescore.ts';

const own='40702810111110000001',other='40702810999990000001';
const context={companyInn:'9900000012',companyAccounts:[own],sourceId:'synthetic-posting',sourceFileId:'synthetic-posting',sourceFileName:'synthetic.txt',parserVersion:'test',ordinal:0};
const document={Номер:'1',Дата:'30.06.2026',Сумма:'100',ПлательщикСчет:other,ПолучательСчет:own,ПлательщикИНН:'9900000020',ПолучательИНН:'9900000012',Плательщик:'Покупатель',Получатель:'Компания',НазначениеПлатежа:'Оплата работ',__account:own};
const run=doc=>normalizeTransaction(adaptOneCDocument(doc,context));
test('incoming follows the receiving bank date and retains original document date',()=>{
 const r=run({...document,ДатаПоступило:'01.07.2026',ДатаСписано:'30.06.2026'});
 assert.equal(r.direction,'IN');assert.equal(r.date,'2026-07-01');assert.equal(r.rawValues.date,'01.07.2026');assert.equal(r.rawValues.documentDate,'30.06.2026');
});
test('outgoing follows debit date, not the receiving bank date',()=>{
 const r=run({...document,ПлательщикСчет:own,ПолучательСчет:other,ПлательщикИНН:'9900000012',ПолучательИНН:'9900000020',ДатаСписано:'01.07.2026',ДатаПоступило:'02.07.2026'});
 assert.equal(r.direction,'OUT');assert.equal(r.date,'2026-07-01');
});
test('missing own-side posting date falls back only to the document date',()=>{
 const r=run({...document,ДатаСписано:'02.07.2026'});
 assert.equal(r.date,'2026-06-30');assert.equal('documentDate'in r.rawValues,false);
});
test('invalid explicit bank date is not silently replaced with a valid document date',()=>{
 const r=run({...document,ДатаПоступило:'31.02.2026'});
 assert.equal(r.date,null);assert.ok(r.quality.warnings.includes('DATE_INVALID'));
});
test('unknown direction does not arbitrarily choose either bank-side date',()=>{
 const r=run({...document,ПлательщикСчет:other,ПолучательСчет:'40702810888880000001',ПлательщикИНН:'9900000020',ПолучательИНН:'9900000039',ДатаСписано:'01.07.2026',ДатаПоступило:'02.07.2026'});
 assert.equal(r.direction,'UNKNOWN');assert.equal(r.date,'2026-06-30');
});
test('same-company transfer follows the supplied account side without changing transfer classification',()=>{
 const r=run({...document,ПлательщикИНН:'9900000012',ДатаСписано:'30.06.2026',ДатаПоступило:'01.07.2026'});
 assert.equal(r.direction,'IN');assert.equal(r.isOwnAccountTransfer,true);assert.equal(r.date,'2026-07-01');
});
test('actual TXT processing assigns cross-month cash to the bank posting month',()=>{
 const text=`1CClientBankExchange\nДатаНачала=01.07.2026\nДатаКонца=31.07.2026\nРасчСчет=${own}\nСекцияРасчСчет\nДатаНачала=01.07.2026\nДатаКонца=31.07.2026\nРасчСчет=${own}\nНачальныйОстаток=0\nКонечныйОстаток=100\nКонецРасчСчет\nСекцияДокумент=Платежное поручение\nНомер=1\nДата=30.06.2026\nДатаПоступило=01.07.2026\nСумма=100\nПлательщикСчет=${other}\nПлательщикИНН=9900000020\nПлательщик=ООО ПОКУПАТЕЛЬ\nПолучательСчет=${own}\nПолучательИНН=9900000012\nПолучатель=ООО КОМПАНИЯ\nНазначениеПлатежа=Оплата работ\nКонецДокумента\nКонецФайла`;
 const r=analyzeBankStatements([{text,fileName:'synthetic.txt'}]);
 assert.equal(r.transactions[0].date,'2026-07-01');assert.deepEqual(r.metricsV2.monthly.map(m=>m.month),['2026-07']);assert.equal(r.metricsV2.liquidity.averageDailyBalance.value,100);assert.equal(r.metricsV2.liquidity.minimumDailyBalance.value,100);
});
