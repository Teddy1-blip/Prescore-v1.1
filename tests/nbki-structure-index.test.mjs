import test from 'node:test';
import assert from 'node:assert/strict';
import {nbkiStructureIndex} from '../lib/workspace/nbki-structure-index.ts';
import {nbkiLegacyStatusEvidence} from '../lib/workspace/nbki-legacy-status.ts';
import {nbkiLegacyUidEvidence} from '../lib/workspace/nbki-legacy-uid.ts';
const uidA='a1b2c3d4-1111-2222-3333-444455556666-1';
const uidB='b1c2d3e4-aaaa-bbbb-cccc-1234567890ab-2';
const page=(page,text)=>({page,text});
const cover=(uid,body)=>[
 'УИд договора: '+uid+'     Номер сделки: Н/Д',
 'Вид участия      Дата сделки     Тип           Вид займа       Цель займа',
 body,
].join('\n');
const guarantee=(id=uidA)=>cover(id,'Принципал по     01-08-2023      Независимая          Н/Д\nгарантии                         гарантия')
  +'\nСумма                   Валюта                Сумма обеспечения\n8311107,42              RUB                   8311107,42 Н/Д';
const loan=(id=uidB)=>cover(id,'Заемщик          16-02-2023      Договор займа       Заем (кредит)\n                                 (кредита)')
  +'\nСумма                   Валюта                Сумма обеспечения\n700000,00              RUB                   Н/Д';
const legacy=(account,creditor='Учебный банк')=>[
 'Счет','Вид: Н/Д                Размер/лимит: Н/Д          Открыт: Н/Д',
 'Отношение: Принципал       Статус: Н/Д',
 'Кредитор: '+creditor+'        Просрочено: Н/Д',
 'Счет: '+account+'            Финальн.платеж: Н/Д',
 'УИД договора(сделки): Н/Д',
 'Банковские гарантии','Сумма: RUB 500000',
].join('\n');
test('modern UUIDs classify loan/guarantee without fabricating outstanding or overdue',()=>{
 const r=nbkiStructureIndex([page(5,guarantee()),page(21,loan())]);
 assert.equal(r.modern.length,2);
 assert.equal(r.modern[0].kind,'GUARANTEE');
 assert.equal(r.modern[0].role,'GUARANTEE_PRINCIPAL');
 assert.equal(r.modern[0].nominalRub,8311107.42);
 assert.equal(r.modern[0].agreementDate,'2023-08-01');
 assert.equal(r.modern[1].kind,'LOAN');
 assert.equal(r.modern[1].nominalRub,700000);
 assert.equal(r.modern[1].agreementDate,'2023-02-16');
 for(const entry of r.modern){
  assert.equal(entry.currentPrincipalRub,null);
  assert.equal(entry.overdueRub,null);
  assert.equal(entry.status,'SOURCE_ONLY');
 }
 assert.equal(r.automaticApply,false);
});
test('repeated UUID deduplicates only consistent evidence and flags role conflicts',()=>{
 const a=nbkiStructureIndex([page(5,guarantee()),page(6,guarantee())]);
 assert.equal(a.modern.length,1);
 assert.deepEqual(a.modern[0].pages,[5,6]);
 assert.equal(a.modern[0].status,'SOURCE_ONLY');
 const b=nbkiStructureIndex([page(5,guarantee()),page(6,loan(uidA))]);
 assert.equal(b.modern.length,1);
 assert.equal(b.modern[0].status,'CONFLICT');
 assert.ok(b.issues.includes('BUREAU_MODERN_UUID_CONFLICT'));
});
test('legacy account deduplicates only with same creditor; unknown kind not a loan',()=>{
 const r=nbkiStructureIndex([page(46,legacy('QA-GUAR-908/2026')),page(50,legacy('QA-GUAR-908/2026.')),
  page(52,legacy('QA-GUAR-908/2026','Другой банк'))]);
 assert.equal(r.legacy.length,2);
 assert.deepEqual(r.legacy[0].pages,[46,50]);
 assert.equal(r.legacy[0].kind,'UNKNOWN');
 assert.equal(r.legacy[0].linkedModernUid,null);
});
test('only exact printed UID links formats, equal amount or creditor cannot',()=>{
 const l=legacy('BG-2026').replace('УИД договора(сделки): Н/Д','УИД договора(сделки): '+uidA);
 const r=nbkiStructureIndex([page(5,guarantee()),page(46,l),page(48,legacy('BG-2027'))]);
 assert.equal(r.exactUidLinks,1);
 assert.equal(r.legacy.find(x=>x.account==='BG-2026').linkedModernUid,uidA);
 assert.equal(r.legacy.find(x=>x.account==='BG-2027').linkedModernUid,null);
});
test('historical NBKI summary and unlabelled UUID cannot create balance or contract amount',()=>{
 const r=nbkiStructureIndex([page(4,'Сводка\nВсего: 64\nТекущая: RUB 4015000'),
 page(5,'УИд договора: '+uidA+'\nЗадолженность: 4015000\nНезависимая гарантия')]);
 assert.equal(r.modern.length,1);
 assert.equal(r.modern[0].kind,'UNKNOWN');
 assert.equal(r.modern[0].nominalRub,null);
 assert.equal(r.modern[0].currentPrincipalRub,null);
 assert.equal(r.legacy.length,0);
});

test('ambiguous cross-format UID or conflicting role is not counted as a verified link',()=>{
 const uid='a1b2c3d4-1111-2222-3333-444455556666-1';
 const row=(account,role,kind)=>[
  'Вид: '+kind,'Отношение: '+role,'Кредитор: Учебный банк',
  'Счет: '+account+'       Дополнение: Н/Д','УИД договора(сделки): '+uid,
 ].join('\n');
 const duplicate=nbkiStructureIndex([
  page(5,guarantee()),page(50,row('BG-1','Принципал','Н/Д')),page(51,row('BG-2','Принципал','Н/Д')),
 ]);
 assert.equal(duplicate.exactUidLinks,0);
 assert.ok(duplicate.issues.includes('BUREAU_CROSS_FORMAT_UID_REVIEW'));
 assert.equal(duplicate.legacy.filter(r=>r.status==='CONFLICT').length,2);
 const conflict=nbkiStructureIndex([
  page(5,guarantee()),page(50,row('BG-1','Заемщик','Срочный кредит')),
 ]);
 assert.equal(conflict.exactUidLinks,0);
 assert.equal(conflict.modern[0].status,'CONFLICT');
 assert.ok(conflict.issues.includes('BUREAU_CROSS_FORMAT_UID_REVIEW'));
});

test('fulfilled termination has a source page; no automatic current zero',()=>{
 const report=loan()+'\nПрекращение обязательства                   Дата прекращения\nНадлежащее исполнение обязательства          25-05-2023';
 const r=nbkiStructureIndex([page(21,report)],'2023-08-24');
 assert.deepEqual(r.modern[0].termination,{date:'2023-05-25',reason:'FULFILLED',page:21});
 assert.equal(r.modern[0].currentPrincipalRub,null);
 assert.equal(r.modern[0].overdueRub,null);
});
test('termination from a continuation page stays with its UID, not the next contract',()=>{
 const ending='Прекращение обязательства                   Дата прекращения\nНадлежащее исполнение обязательства          21-07-2023';
 const r=nbkiStructureIndex([page(5,guarantee()),page(6,ending)],'2023-08-24');
 assert.deepEqual(r.modern[0].termination,{date:'2023-07-21',reason:'FULFILLED',page:6});
 const mixed=nbkiStructureIndex([page(5,guarantee()),page(6,loan()+'\n'+ending)],'2023-08-24');
 assert.equal(mixed.modern.find(x=>x.uid===uidA).termination,null);
 assert.equal(mixed.modern.find(x=>x.uid===uidB).termination?.page,6);
});
test('conflicting or future closure cannot be silently confirmed',()=>{
 const line=date=>loan()+'\nПрекращение обязательства                   Дата прекращения\nНадлежащее исполнение обязательства          '+date;
 const conflict=nbkiStructureIndex([page(21,line('25-05-2023')),page(24,line('26-05-2023'))],'2023-08-24');
 assert.equal(conflict.modern[0].status,'CONFLICT');
 const future=nbkiStructureIndex([page(21,line('21-07-2028'))],'2023-08-24');
 assert.equal(future.modern[0].termination,null);
 assert.equal(future.modern[0].status,'CONFLICT');
});
test('dated urgent-debt amounts remain historical when later rows have N/D',()=>{
 const text=loan()+'\nСрочная задолженность\n'
  +'Дата возникн.     Расчет по        Сумма               Сумма по осн.долгу       Сумма по %%   Сумма по иным      Дата расчета      Дата события\n'
  +'16-02-2023       Да               700000,00           700000,00               0,00          0,00               16-02-2023       16-02-2023\n'
  +'16-02-2023       Да               1750,00             0,00                     1750,00       0,00               21-05-2023       21-05-2023\n'
  +'Н/Д              Н/Д              0,00                Н/Д                     Н/Д           Н/Д               25-05-2023       25-05-2023\n'
  +'Просроченная задолженность: Н/Д';
 const r=nbkiStructureIndex([page(21,text)],'2023-08-24').modern[0];
 assert.deepEqual(r.historicalDebt,{asOf:'2023-05-21',principalRub:0,totalRub:1750,page:21,lastPaymentBasis:true});
 assert.equal(r.currentPrincipalRub,null);
 assert.equal(r.overdueRub,null);
});
test('guarantees and missing tables never borrow an amount from debt history or summary',()=>{
 const g=nbkiStructureIndex([page(5,guarantee()+'\nСрочная задолженность: Н/Д\nПросроченная задолженность: 0,00')]).modern[0];
 assert.equal(g.historicalDebt,null);assert.equal(g.overdueRub,null);
 const l=nbkiStructureIndex([page(21,loan()+'\nСрочная задолженность: Н/Д\nПросроченная задолженность: Н/Д')]).modern[0];
 assert.equal(l.historicalDebt,null);assert.equal(l.currentPrincipalRub,null);
});

test('a dated urgent-debt row marked Нет is historical evidence, never current principal',()=>{
 const text=loan()+'\nСрочная задолженность\n'
  +'Дата возникн.    Расчет по     Сумма            Сумма по осн.долгу      Сумма по %%    Сумма по иным      Дата расчета      Дата события\n'
  +'21-09-2022      Нет           410000,00        410000,00              0,00           0,00               25-11-2022       14-12-2022\n'
  +'Просроченная задолженность: Н/Д';
 const entry=nbkiStructureIndex([page(29,text)],'2023-08-24').modern[0];
 assert.deepEqual(entry.historicalDebt,
   {asOf:'2022-11-25',principalRub:410000,totalRub:410000,page:29,lastPaymentBasis:false});
 assert.equal(entry.currentPrincipalRub,null);
 assert.equal(entry.overdueRub,null);
});

test('same as-of date with conflicting last-payment-basis indicators requires review',()=>{
 const state=flag=>loan()+'\nСрочная задолженность\n'
  +'Дата возникн.    Расчет по     Сумма           Сумма по осн.долгу      Сумма по %%     Сумма по иным    Дата расчета      Дата события\n'
  +'21-09-2022      '+flag.padEnd(4)+'          410000,00       410000,00              0,00            0,00             25-11-2022       14-12-2022\n'
  +'Просроченная задолженность: Н/Д';
 const report=nbkiStructureIndex([page(29,state('Да')),page(31,state('Нет'))],'2023-08-24');
 assert.equal(report.modern.length,1);
 assert.equal(report.modern[0].status,'CONFLICT');
 assert.ok(report.issues.includes('BUREAU_MODERN_UUID_CONFLICT'));
 assert.equal(report.modern[0].currentPrincipalRub,null);
});

test('printed three-column legacy card reads ACTIVE and evidence date, never live debt',()=>{
 const block=['Счет                   Договор                       Состояние',
  'Вид: Н/Д               Размер/лимит: Н/Д             Открыт: 21-12-2021',
  'Отношение: Принципал   ПСК%%: Н/Д                    Статус: Активный',
  'Кредитор: Учебный банк  Финальн.платеж: Н/Д        Дата статуса: 19-07-2023',
  'УИД договора(сделки): Н/Д Финальн.платеж %%: Н/Д   Последн.обновление: 20-07-2023'].join('\n');
 const r=nbkiLegacyStatusEvidence(block,73,'2023-08-24');
 assert.deepEqual(r.issues,[]);
 assert.equal(r.evidence?.reportedState,'ACTIVE');
 assert.equal(r.evidence?.statusDate,'2023-07-19');
 assert.equal(r.evidence?.lastUpdatedAt,'2023-07-20');
 assert.equal(r.evidence?.openedAt,'2021-12-21');
 assert.equal(r.evidence?.page,73);
});
test('CLOSED, TRANSFERRED and unknown statuses never collapse into each other',()=>{
 const block=raw=>['Счет','Вид: Н/Д       Открыт: Н/Д','Отношение: Принципал     Статус: '+raw,
  'Кредитор: Учебный банк       Последн.обновление: 20-07-2023'].join('\n');
 assert.equal(nbkiLegacyStatusEvidence(block('Счет закрыт'),86,'2023-08-24').evidence?.reportedState,'CLOSED');
 assert.equal(nbkiLegacyStatusEvidence(block('Счет закрыт - переведен на обслуживание в другую организацию'),86,'2023-08-24').evidence?.reportedState,'TRANSFERRED');
 assert.equal(nbkiLegacyStatusEvidence(block('Н/Д'),86,'2023-08-24').evidence?.reportedState,'UNKNOWN');
 assert.equal(nbkiLegacyStatusEvidence('Кредитор: Учебный банк\nСтатус: Активный',86,'2023-08-24').evidence,null);
});
test('duplicate legacy account with contradictory reported statuses remains in review',()=>{
 const src=status=>['Счет','Вид: Н/Д          Открыт: Н/Д',
  'Отношение: Принципал          Статус: '+status,
  'Кредитор: Учебный банк       Последн.обновление: 20-07-2023',
  'Счет: BG-DEMO-2026             Финальн.платеж: Н/Д','УИД договора(сделки): Н/Д'].join('\n');
 const r=nbkiStructureIndex([page(46,src('Активный')),page(47,src('Счет закрыт'))],'2023-08-24');
 assert.equal(r.legacy.length,1);
 assert.equal(r.legacy[0].status,'CONFLICT');
 assert.ok(r.issues.includes('BUREAU_LEGACY_ACCOUNT_STATUS_CONFLICT'));
 assert.equal(r.legacy[0].statusEvidence?.reportedState,'ACTIVE');
});
test('invalid, impossible and future legacy status dates downgrade to unknown',()=>{
 const src=date=>['Счет','Вид: Н/Д          Открыт: Н/Д',
  'Отношение: Принципал          Статус: Активный',
  'Кредитор: Учебный банк       Последн.обновление: '+date].join('\n');
 for(const date of ['30-11-2028','31-02-2023','02-01-1900']){
  const r=nbkiLegacyStatusEvidence(src(date),71,'2023-08-24');
  assert.ok(r.issues.length>0);
  assert.equal(r.evidence?.reportedState,'UNKNOWN');
 }
});
test('modern fulfilled versus later legacy ACTIVE needs cross-format conflict review',()=>{
 const modern=guarantee()+
  '\nПрекращение обязательства                   Дата прекращения'+
  '\nНадлежащее исполнение обязательства          20-06-2023';
 const legacySource=['Счет','Вид: Н/Д      Открыт: Н/Д',
  'Отношение: Принципал       Статус: Активный',
  'Кредитор: Учебный банк     Дата статуса: 19-07-2023',
  'Последн.обновление: 20-07-2023',
  'Счет: BG-DEMO-2026','УИД договора(сделки): '+uidA].join('\n');
 const r=nbkiStructureIndex([page(5,modern),page(73,legacySource)],'2023-08-24');
 assert.equal(r.modern[0].termination?.date,'2023-06-20');
 assert.equal(r.exactUidLinks,0);
 assert.equal(r.modern[0].status,'CONFLICT');
 assert.equal(r.legacy[0].status,'CONFLICT');
 assert.ok(r.issues.includes('BUREAU_CROSS_FORMAT_STATUS_REVIEW'));
});

test('legacy NBKI UID wrapped at the 19+19 break reconstructs only exact 38-character UUID',()=>{
 const first=uidA.slice(0,19),second=uidA.slice(19);
 assert.equal(first.length,19);assert.equal(second.length,19);
 const card='УИД договора(сделки): '+first+'    Финальн.платеж %%: Н/Д   Последн.обновление: 20-07-2023\n'+
  second+'\n                    Выплата осн.: Н/Д';
 assert.deepEqual(nbkiLegacyUidEvidence(card),{uid:uidA,wrapped:true,review:'EXACT'});
});
test('complete legacy NBKI UID may occupy one line; N/D or missing UID remains absent',()=>{
 assert.deepEqual(nbkiLegacyUidEvidence('УИД договора(сделки): '+uidA+'    Последн.обновление: Н/Д'),
  {uid:uidA,wrapped:false,review:'EXACT'});
 for(const str of ['УИД договора(сделки): Н/Д     Финальн.платеж: Н/Д',
                    'Последн.обновление: 20-07-2023']){
  assert.equal(nbkiLegacyUidEvidence(str).review,'ABSENT');
 }
});
test('broken UID must never be patched with date, neighbour account or unrelated numbers',()=>{
 const half=uidA.slice(0,19),second=uidA.slice(19);
 for(const next of ['20-07-2023','Счет: BG-OTHER','УИД договора(сделки): '+second,'','0123456789012345678']){
  const evidence=nbkiLegacyUidEvidence('УИД договора(сделки): '+half+'    Последн.обновление: 20-07-2023\n'+next);
  assert.equal(evidence.uid,null);
  assert.equal(evidence.review,'PARTIAL');
 }
});
test('wrapped exact UID links modern and legacy strictly without creating current exposure',()=>{
 const old=['Счет','Вид: Н/Д             Открыт: Н/Д',
  'Отношение: Принципал     Статус: Н/Д',
  'Кредитор: Учебный банк   Последн.обновление: 20-07-2023',
  'Счет: BG-FICTIVE           Финальн.платеж: Н/Д',
  'УИД договора(сделки): '+uidA.slice(0,19)+'    Финальн.платеж %%: Н/Д',
  uidA.slice(19)].join('\n');
 const r=nbkiStructureIndex([page(5,guarantee()),page(46,old)],'2023-08-24');
 assert.equal(r.legacy.length,1);assert.equal(r.exactUidLinks,1);
 assert.equal(r.legacy[0].printedUid,uidA);assert.equal(r.legacy[0].uidWrapped,true);
 assert.equal(r.legacy[0].linkedModernUid,uidA);
 assert.equal(r.modern[0].currentPrincipalRub,null);
});
test('same bank/account with conflicting complete source UIDs remains in review',()=>{
 const old=uid=>['Счет','Вид: Н/Д        Открыт: Н/Д',
 'Отношение: Принципал     Статус: Н/Д',
 'Кредитор: Учебный банк  Последн.обновление: 20-07-2023',
 'Счет: BG-FICTIVE','УИД договора(сделки): '+uid].join('\n');
 const r=nbkiStructureIndex([page(48,old(uidA)),page(50,old(uidB))],'2023-08-24');
 assert.equal(r.legacy.length,1);assert.equal(r.legacy[0].status,'CONFLICT');
 assert.ok(r.issues.includes('BUREAU_LEGACY_UID_CONFLICT'));
});
test('corporate loan is classified from explicit loan relationship, not the vague purpose label',()=>{
 const old=['Счет                Договор               Состояние',
  'Вид: На развитие бизнеса            Размер/лимит: RUB 700000     Открыт: 21-09-2022',
  'Отношение: Кредит юридическому лицу    ПСК%%: Н/Д         Статус: Активный',
  'Кредитор: Учебный банк      Последн.обновление: 20-07-2023',
  'Счет: QA-LOAN-2026','УИД договора(сделки): Н/Д'].join('\n');
 const r=nbkiStructureIndex([page(73,old)],'2023-08-24');
 assert.equal(r.legacy.length,1);
 assert.equal(r.legacy[0].kind,'LOAN');assert.equal(r.legacy[0].role,'BORROWER');
 assert.equal(r.legacy[0].statusEvidence?.reportedState,'ACTIVE');
 assert.equal(r.legacy[0].statusEvidence?.lastUpdatedAt,'2023-07-20');
});
