#!/usr/bin/env python3
"""Generate 24 deterministic, fictitious Credit Lab source bundles.

No Prescore result is fabricated. Bank documents are raw 1C text.
BFO/BKI/legal JSON files are explicitly adapter-test fixtures, not official
bureau/API responses. All identifiers are local test identifiers, not claimed
registered entities, real accounts or deliverable email addresses.
"""
from __future__ import annotations
import argparse
import calendar
import hashlib
import json
from pathlib import Path
from typing import Any

AS_OF = '2026-06-30'
SPECS = [
 ('Ровный поток', 'Стабильная B2B-компания, пять покупателей, умеренный долг.', 'stable', ['REPORT_COMPUTED_FROM_SOURCES','PAYMENT_ANCHOR_FROM_EVIDENCE']),
 ('Рост оборота', 'Поступления постепенно растут, долговой платёж фиксирован.', 'growth', ['COMPARABLE_TREND_ONLY','NO_PROMISED_APPROVAL']),
 ('Падение оборота', 'В последние три месяца операционные поступления уменьшились.', 'decline', ['DECLINE_FROM_REAL_MONTHS','NO_LEGACY_SUBSTITUTION']),
 ('Сезонный бизнес', 'Два полных года с повторяющимся сезонным профилем.', 'seasonal', ['SEASONALITY_NEEDS_COMPARABLE_HISTORY','NO_FORCED_DECLINE_LABEL']),
 ('Крупный покупатель', '70% продаж одному идентифицированному покупателю.', 'concentration', ['TOP1_IS_ACTUAL_BUYER','SOURCE_TRACEABILITY']),
 ('Розница и эквайринг', 'Розничная выручка поступает через эквайринг.', 'acquiring', ['INTERMEDIARY_NOT_ULTIMATE_BUYER','NO_FAKE_DIRECT_TOP1']),
 ('Маркетплейс', 'Выручка от реализации поступает от платформы.', 'marketplace', ['PLATFORM_NOT_ULTIMATE_BUYER','NO_APPROVAL_INFERENCE']),
 ('Взнос собственника', 'Разовый взнос собственника дополнительно к продажам.', 'owner', ['OWNER_FUNDING_NOT_REVENUE','CAPACITY_NOT_INFLATED_BY_FUNDING']),
 ('Новый кредит', 'Разовый кредитный транш дополнительно к операционным поступлениям.', 'loan', ['LOAN_INFLOW_NOT_REVENUE','BORROWING_IS_NOT_OPERATING_GROWTH']),
 ('Два банка', 'Два счёта покрывают один период, между ними есть собственные переводы.', 'two_accounts', ['OWN_TRANSFER_NET_ZERO','MULTI_ACCOUNT_IS_NOT_DUPLICATED_SALES','COVERAGE_PER_ACCOUNT_REVIEW']),
 ('Три счёта', 'Три счёта с разными датами начала покрытия.', 'three_accounts', ['PRESERVE_ACCOUNT_SPECIFIC_COVERAGE','NO_ZERO_FOR_UNOBSERVED_ACCOUNT']),
 ('Высокие платежи', 'Подтверждённое обслуживание долга забирает большую часть поступлений.', 'high_debt', ['DEBT_ANCHOR_FROM_BANK_AND_BKI','NO_COMFORTABLE_LABEL_WITHOUT_BASIS']),
 ('Просрочка без истории', 'Текущая просрочка есть, исторические дни подтверждены нулём.', 'overdue_zero_history', ['CURRENT_OVERDUE_NOT_HISTORY_DAYS','NO_FABRICATED_DELINQUENCY_BAND']),
 ('Просрочка с историей', 'Текущая просрочка и подтверждённая история 60 дней.', 'overdue_history', ['PRESERVE_REPORTED_HISTORY','NO_DOUBLE_COUNT_SAME_OBLIGATION']),
 ('БКИ не предоставлено', 'Есть выписки, БФО и правовые сведения, но нет БКИ.', 'no_bki', ['UNKNOWN_DEBT_NOT_ZERO','NO_INVENTED_CLEAN_CREDIT_HISTORY']),
 ('Только выписки', 'Банковский комплект без БФО, БКИ и правового источника.', 'bank_only', ['UNKNOWN_NOT_ZERO','PARTIAL_REPORT_NOT_SOFTWARE_FAILURE','NO_FORCED_NUMERIC_INDEX']),
 ('Ликвидация', 'Подтверждённый правовой статус ликвидации.', 'liquidation', ['GLOBAL_STOP_FROM_EXPLICIT_SOURCE','NO_OPTIMISTIC_CAPACITY_COPY']),
 ('Убыточное производство', 'Два убыточных года и отрицательный капитал в согласованном балансе.', 'loss_equity', ['BALANCE_RECONCILES','NEGATIVE_EQUITY_NOT_GLOBAL_STOP','NO_DUPLICATED_LOSS_FACTOR']),
 ('Год и полугодие', 'Годовая БФО и полугодовой отчёт: разные длительности периодов.', 'annual_interim', ['DO_NOT_COMPARE_6M_TO_12M_AS_DECLINE','NO_SILENT_ANNUALIZATION']),
 ('Пропущенный декабрь', 'Выписки по одному счёту не покрывают декабрь.', 'missing_month', ['MISSING_MONTH_NOT_ZERO_MONTH','DATA_COVERAGE_NOT_BORROWER_WEAKNESS']),
 ('Дубликат файла', 'Одна и та же выписка передана под двумя именами.', 'duplicate', ['BYTE_DUPLICATE_IDEMPOTENT','SAME_TOTALS_AS_SINGLE_SOURCE']),
 ('Конфликт двух выгрузок', 'Две версии выписки одного счёта расходятся по одной операции.', 'conflict', ['CONFLICT_REVIEW_NOT_SILENT_SELECTION','NO_SILENT_DOUBLE_COUNT']),
 ('Месяц без операций', 'Весь первый месяц покрыт выпиской, но операций в нём нет.', 'zero_month', ['COVERED_ZERO_MONTH_NOT_MISSING','HEADER_PERIOD_BEFORE_FIRST_TRANSACTION']),
 ('Большая выписка', 'Более 10 000 операций для проверки хранения и повторного открытия отчёта.', 'large', ['CANONICAL_METRICS_FROM_ALL_ROWS','NEVER_RECOMPUTE_FROM_TRUNCATED_DISPLAY_ROWS']),
]

def dump(p: Path, value: Any) -> None:
    p.write_text(json.dumps(value, ensure_ascii=False, indent=2, allow_nan=False)+'\n', encoding='utf-8')

def months(n: int) -> list[str]:
    end = 2026*12+5
    return [f'{i//12:04d}-{i%12+1:02d}' for i in range(end-n+1,end+1)]

def last_day(month: str) -> str:
    y,m=map(int,month.split('-'))
    return f'{month}-{calendar.monthrange(y,m)[1]:02d}'

def russian_date(iso: str) -> str:
    y,m,d=iso.split('-');return f'{d}.{m}.{y}'

def money(cents: int) -> str:
    return f'{cents//100}.{cents%100:02d}'

def account(i: int) -> str:
    return f'407028109900{i:08d}'

def tx(date: str, cents: int, direction: str, number: str, kind: str,
       buyer: int = 1, own_to: str | None = None) -> dict[str,Any]:
    return dict(date=date,cents=cents,direction=direction,number=number,kind=kind,buyer=buyer,own_to=own_to)

PURPOSE={
 'sale':'Оплата за поставленный товар по синтетическому договору. В том числе НДС.',
 'supplier':'Оплата поставщику за товар по синтетическому договору. В том числе НДС.',
 'tax':'Уплата налога за отчётный период. Синтетическая операция.',
 'payroll':'Перечисление заработной платы по синтетическому реестру.',
 'overhead':'Оплата аренды помещения по синтетическому договору.',
 'principal':'Погашение основного долга по кредитному договору SYNTH-LOAN-1.',
 'interest':'Уплата процентов по кредитному договору SYNTH-LOAN-1.',
 'owner':'Взнос учредителя в уставный капитал. Без НДС. Синтетическая операция.',
 'loan':'Выдача кредита по кредитному договору SYNTH-LOAN-2. Без НДС.',
 'own':'Перевод собственных средств между своими счетами. Без НДС.',
 'acquiring':'Возмещение по операциям торгового эквайринга за реализованные товары по реестру. Синтетическая операция.',
 'marketplace':'Перечисление выручки за реализованные товары по агентскому договору маркетплейса. Синтетическая операция.',
}

def raw_statement(inn: str, name: str, acc: str, rows: list[dict], start: str,
                  end: str, opening: int) -> tuple[str,dict]:
    incoming=sum(t['cents'] for t in rows if t['direction']=='in')
    outgoing=sum(t['cents'] for t in rows if t['direction']=='out')
    final=opening+incoming-outgoing
    lines=['1CClientBankExchange','ВерсияФормата=1.03','Кодировка=Windows',
           'Отправитель=Синтетический банк Credit Lab','Получатель=1С',
           f'ДатаСоздания={russian_date(AS_OF)}','ВремяСоздания=12:00:00',
           f'ДатаНачала={russian_date(start)}',f'ДатаКонца={russian_date(end)}',f'РасчСчет={acc}',
           'СекцияРасчСчет',f'ДатаНачала={russian_date(start)}',f'ДатаКонца={russian_date(end)}',
           f'РасчСчет={acc}',f'НачальныйОстаток={money(opening)}',
           f'ВсегоПоступило={money(incoming)}',f'ВсегоСписано={money(outgoing)}',
           f'КонечныйОстаток={money(final)}','КонецРасчСчет']
    for t in sorted(rows,key=lambda t:(t['date'],t['number'])):
        other_inn=inn if t['own_to'] else f"990000{100+t['buyer']:04d}"
        other_name=name if t['own_to'] else f"Синтетический контрагент {t['buyer']:02d}"
        if t['kind'] in ('acquiring','marketplace'):
            other_name='Синтетический оператор '+('эквайринга' if t['kind']=='acquiring' else 'маркетплейса')
        other_acc=t['own_to'] or account(8000+t['buyer'])
        own=(name,inn,acc);other=(other_name,other_inn,other_acc)
        payer,payee=(other,own) if t['direction']=='in' else (own,other)
        lines+=['СекцияДокумент=Платежное поручение',f"Номер={t['number']}",f"Дата={russian_date(t['date'])}",
                f"Сумма={money(t['cents'])}",f'Плательщик={payer[0]}',f'ПлательщикИНН={payer[1]}',
                f'ПлательщикСчет={payer[2]}','ПлательщикБанк1=Синтетический банк отправителя',
                f'Получатель={payee[0]}',f'ПолучательИНН={payee[1]}',f'ПолучательСчет={payee[2]}',
                'ПолучательБанк1=Синтетический банк получателя',
                ('ДатаПоступило=' if t['direction']=='in' else 'ДатаСписано=')+russian_date(t['date']),
                'НазначениеПлатежа='+PURPOSE[t['kind']],'КонецДокумента']
    lines+=['КонецФайла','']
    # File bytes follow the encoding declared in the 1C header.
    raw='\r\n'.join(lines)
    return raw,{'recordCount':len(rows),'openingCents':opening,'incomingCents':incoming,
                'outgoingCents':outgoing,'endingCents':final,'periodFrom':start,'periodTo':end,
                'accountFixture':acc,'encoding':'windows-1251'}

def business_rows(mode: str, ms: list[str], accs: list[str]) -> list[list[dict]]:
    result=[[] for _ in accs]
    for mi,m in enumerate(ms):
        if mode=='zero_month' and mi==0: continue
        op=100_000_000 # cents, = 1,000,000 RUB
        if mode=='growth':op=70_000_000+mi*6_000_000
        if mode=='decline' and mi>=len(ms)-3:op=50_000_000
        if mode=='seasonal':op=[60,70,100,140,180,120,80,60,70,100,160,200][int(m[5:])-1]*1_000_000
        sales=1000 if mode=='large' else 5
        parts=[op//sales]*sales;parts[-1]+=op-sum(parts)
        if mode=='concentration':parts=[op*70//100]+[op*75//1000]*4
        for k,amount in enumerate(parts):
            ai=k%len(accs)
            if mode=='three_accounts' and ai==2 and mi<6: ai=0
            kind='acquiring' if mode=='acquiring' else 'marketplace' if mode=='marketplace' else 'sale'
            buyer=90 if mode in ('acquiring','marketplace') else 1+k%5
            day=5+(k%20)
            result[ai].append(tx(f'{m}-{day:02d}',amount,'in',f'{mi:02d}-S-{k:04d}',kind,buyer))
        for j,(kind,share) in enumerate([('supplier',55),('tax',6),('payroll',10),('overhead',5)]):
            result[0].append(tx(m+'-26',op*share//100,'out',f'{mi:02d}-C-{j}',kind,50+j))
        payment=50_000_000 if mode=='high_debt' else 10_000_000
        for j,(kind,share) in enumerate([('principal',80),('interest',20)]):
            result[0].append(tx(m+'-27',payment*share//100,'out',f'{mi:02d}-D-{j}',kind,60))
        if mode=='two_accounts':
            result[0].append(tx(m+'-28',500_000,'out',f'{mi:02d}-T-0','own',own_to=accs[1]))
            result[1].append(tx(m+'-28',500_000,'in',f'{mi:02d}-T-0','own',own_to=accs[0]))
        if mi==4 and mode in ('owner','loan'):
            result[0].append(tx(m+'-15',500_000_000,'in',f'{mi:02d}-F-0',mode,70))
    return result

def financial(year: int, mode: str, inn: str, name: str, interim: bool=False) -> dict:
    revenue=12_000_000 if year==2025 else 11_000_000
    equity=-1_000_000 if mode=='loss_equity' else 5_000_000
    short=9_000_000 if equity<0 else 3_000_000
    profit=-200_000 if mode=='loss_equity' else 2_300_000
    raw={'1600':10000000,'1100':4000000,'1150':4000000,'1200':6000000,'1210':2000000,
         '1230':3500000,'1250':500000,'1300':equity,'1370':equity-10000,
         '1400':2000000,'1410':1500000,'1500':short,'1510':0,'1520':short,'1700':10000000,
         '2110':revenue,'2120':-8000000,'2100':revenue-8000000,'2210':0,'2220':-1000000,
         '2200':revenue-9000000,'2320':0,'2330':-300000,'2340':0,'2350':0}
    if mode=='loss_equity': raw.update({'2120':-(revenue-100000),'2100':100000,'2220':0,'2200':100000,'2410':0})
    elif interim:
        for c in ('2110','2120','2100','2220','2200','2330'):raw[c]=round(raw[c]/2)
    pretax=raw['2200']+raw['2330'];tax=0 if pretax<=0 else round(pretax*.2)
    raw.update({'2300':pretax,'2410':-tax,'2400':pretax-tax})
    return {'fixtureFormat':'PRESCORE-FINANCIAL-RAW-INPUT-1','synthetic':True,'companyInn':inn,'companyName':name,
            'sourceType':'QUARTERLY' if interim else 'BFO','currency':'RUB','scale':1,
            'period':{'kind':'INTERIM' if interim else 'ANNUAL','from':f'{year}-01-01',
                      'to':f'{year}-06-30' if interim else f'{year}-12-31',
                      'asOf':f'{year}-06-30' if interim else f'{year}-12-31','year':year,
                      'monthsCovered':6 if interim else 12,'flowPeriodType':'CUMULATIVE_YTD' if interim else 'FULL_YEAR',
                      'confidence':'HIGH'},'receivedAt':AS_OF if interim else f'{year+1}-03-01',
            'reportedNetAssets':equity,'rawLines':raw}

def generate(root: Path) -> list[dict]:
    root.mkdir(parents=True,exist_ok=False)
    catalog=[]
    for n,(title,description,mode,checks) in enumerate(SPECS,1):
        cid=f'CL-RU-BUS-{n:03d}';p=root/cid;p.mkdir()
        inn=f'990000{2000+n:04d}';name=f'Синтетическая компания «{title}»'
        ms=months(24 if mode=='seasonal' else 12)
        accs=[account(n*10+k) for k in range(1,4 if mode=='three_accounts' else 3 if mode=='two_accounts' else 2)]
        groups=business_rows(mode,ms,accs)
        docs=[]
        for ai,rows in enumerate(groups):
            selections=[(rows,ms[0]+'-01',last_day(ms[-1]))]
            if mode=='three_accounts' and ai==2:selections=[(rows,ms[6]+'-01',last_day(ms[-1]))]
            if mode=='missing_month':
                selections=[([r for r in rows if r['date'][:7]<'2025-12'],'2025-07-01','2025-11-30'),
                            ([r for r in rows if r['date'][:7]>'2025-12'],'2026-01-01','2026-06-30')]
            for si,(rr,start,end) in enumerate(selections):
                raw,oracle=raw_statement(inn,name,accs[ai],rr,start,end,1_000_000_000)
                fn=f'bank-{ai+1}-{si+1}.txt';b=raw.encode('cp1251');(p/fn).write_bytes(b)
                docs.append({'path':fn,'kind':'BANK_STATEMENT','format':'1CClientBankExchange','synthetic':True,
                             'sha256Bytes':hashlib.sha256(b).hexdigest(),
                             'sha256DecodedText':hashlib.sha256(raw.encode('utf-8')).hexdigest(),**oracle})
        if mode=='duplicate':
            b=(p/docs[0]['path']).read_bytes();(p/'bank-duplicate.txt').write_bytes(b)
            docs.append({**docs[0],'path':'bank-duplicate.txt','exactDuplicateOf':docs[0]['path']})
        if mode=='conflict':
            rr=[dict(r) for r in groups[0]];rr[0]['cents']+=100_000
            raw,oracle=raw_statement(inn,name,accs[0],rr,ms[0]+'-01',last_day(ms[-1]),1_000_000_000)
            b=raw.encode('cp1251');(p/'bank-conflicting-version.txt').write_bytes(b)
            docs.append({'path':'bank-conflicting-version.txt','kind':'BANK_STATEMENT','format':'1CClientBankExchange',
                         'synthetic':True,'conflictsWith':docs[0]['path'],'sha256Bytes':hashlib.sha256(b).hexdigest(),
                         'sha256DecodedText':hashlib.sha256(raw.encode()).hexdigest(),**oracle})
        if mode!='bank_only':
            for year in (2024,2025):dump(p/f'bfo-{year}.json',financial(year,mode,inn,name))
            if mode=='annual_interim':dump(p/'interim-2026-6m.json',financial(2026,mode,inn,name,True))
            payment=500000 if mode=='high_debt' else 100000
            credit={'source':'Синтетическая БКИ-фикстура Credit Lab','subjectType':'Юридическое лицо','subjectInn':inn,
                    'relationshipToCompany':'Компания-заёмщик','affectsCompanyDebt':True,'reportDate':AS_OF,
                    'parserConfidence':98,'warnings':['SYNTHETIC_ADAPTER_FIXTURE_NOT_BUREAU_EXPORT'],'summary':{},
                    'obligations':[{'id':cid+'-loan-1','creditor':'Синтетический кредитор','product':'Срочный кредит',
                     'role':'Заёмщик','status':'Действующий','openedAt':'2024-01-01','scheduledCloseAt':'2028-06-30',
                     'outstandingPrincipal':1500000,'totalOutstanding':1500000,'originalAmount':2500000,
                     'accountNumber':'','annualRate':20,'overdueAmount':1000 if mode.startswith('overdue_') else 0,
                     'maxDelinquencyDays':60 if mode=='overdue_history' else 0,'monthlyPayment':payment,
                     'nextPaymentAmount':payment,'nextPaymentDate':'2026-07-15','creditLimit':None,
                     'guaranteeAmount':None,'collateral':''}]}
            if mode!='no_bki':dump(p/'bki-adapter-input.json',credit)
            methods=['company','enforcements','legal-cases','inspections','fedresurs','bankruptcy-messages']
            external=[{'sourceId':f'external:{m}:synthetic:{cid}','sourceType':'CHECKO','status':'READY',
                       'companyInn':inn,'receivedAt':AS_OF,'confidence':98,'warnings':['SYNTHETIC_PROVIDER_FIXTURE'],
                       'rawReference':f'external:/{m}:{AS_OF}', 'fieldAvailability':{'addressUnreliable':'KNOWN'}} for m in methods]
            dump(p/'legal-adapter-input.json',{'inn':inn,'fetchedAt':AS_OF,'failedMethods':[],
                 'company':{'name':name,'status':'В процессе ликвидации' if mode=='liquidation' else 'Действующее','addressUnreliable':False},
                 'legal':{'bankruptcyMessages':0},'signals':[],'sourceManifest':{'external':external},
                 'enforcementItems':[],'legalCaseItems':[],'inspectionItems':[],'registryMessages':[]})
        scenarios=[{'scenarioId':cid+f'-annuity-{term}','annualRatePercent':20,'termMonths':term,
                    'paymentFrequency':'MONTHLY','amortization':'ANNUITY','scenarioSource':'synthetic-explicit-test-assumption-not-bank-offer',
                    'evidenceAsOf':AS_OF,'confidence':'HIGH'} for term in (12,24,36)]
        dump(p/'scenarios.json',scenarios)
        expected={'status':'DRAFT','basis':'Independent source arithmetic and approved contract invariants; not observed engine output',
                  'mustCheck':checks+['MODEL_EQUALS_CANONICAL_OUTPUT','EXPLAINABILITY_HAS_LINEAGE','NO_BANK_APPROVAL_PROMISE'],
                  'doNotAssert':['A fixed Index merely because business is named stable','Positive capacity merely because all files exist'],
                  'unknownRules':['Missing source is UNKNOWN, not zero or a good credit history'],
                  'scenarioRules':['20% is a test-only assumption, not a lender rate','12/24/36 values must come from the existing scenario engine']}
        case={'schema':'PRESCORE-CREDIT-LAB-BUSINESS-SOURCES-1','caseId':cid,'synthetic':True,'origin':'SYNTHETIC',
              'status':'DRAFT','companyInn':inn,'companyName':name,'description':description,'mode':mode,'asOfDate':AS_OF,
              'sourceKinds':{'bank':'raw 1C Windows-1251','bfo':'raw-line adapter fixture','bki':'CreditHistoryReport adapter fixture',
                             'legal':'provider-boundary adapter fixture'},
              'bankDocuments':docs,'expected':expected,
              'restrictions':['Never call external providers for this INN','No real company, lender or outcome',
                              'No real client payload or credentials','Do not load into production or mix with real client records']}
        dump(p/'case.json',case)
        catalog.append({'caseId':cid,'title':title,'description':description,'companyInn':inn,'mode':mode,
                        'bankFiles':len(docs),'bankRecordCount':sum(d['recordCount'] for d in docs),
                        'uniqueBankRecordsBeforeSemanticDedup':sum(d['recordCount'] for d in docs if 'exactDuplicateOf' not in d),
                        'fullPipelineStatus':'NOT_RUN','checks':checks,'path':cid})
    dump(root/'catalog.json',{'version':'PRESCORE-CREDIT-LAB-BUSINESS-SOURCES-1','asOfDate':AS_OF,'cases':catalog})
    return catalog

def validate(root: Path) -> dict:
    data=json.loads((root/'catalog.json').read_text())
    assert len(data['cases'])==24
    total_files=total_rows=0
    for c in data['cases']:
        p=root/c['path'];case=json.loads((p/'case.json').read_text())
        assert case['synthetic'] is True and case['status']=='DRAFT'
        assert case['companyInn'].startswith('990000')
        for d in case['bankDocuments']:
            b=(p/d['path']).read_bytes();s=b.decode('cp1251');assert hashlib.sha256(b).hexdigest()==d['sha256Bytes']
            assert hashlib.sha256(s.encode()).hexdigest()==d['sha256DecodedText']
            assert s.count('СекцияДокумент=')==d['recordCount']
            assert d['openingCents']+d['incomingCents']-d['outgoingCents']==d['endingCents']
            assert s.rstrip().endswith('КонецФайла')
            if 'exactDuplicateOf' in d:assert b==(p/d['exactDuplicateOf']).read_bytes()
            total_files+=1;total_rows+=d['recordCount']
        for fp in list(p.glob('bfo-*.json'))+list(p.glob('interim-*.json')):
            a=json.loads(fp.read_text());r=a['rawLines'];assert r['1600']==r['1100']+r['1200']==r['1300']+r['1400']+r['1500']==r['1700']
            assert r['2110']+r['2120']==r['2100'];assert r['2300']+r['2410']==r['2400']
    large=next(c for c in data['cases'] if c['mode']=='large');assert large['bankRecordCount']>10000
    return {'bundles':24,'bankFiles':total_files,'sourceRecords':total_rows,'structuralValidation':'PASS',
            'engineAcceptance':'NOT_RUN','asOfDate':AS_OF}

def main() -> None:
    parser=argparse.ArgumentParser(description=__doc__)
    parser.add_argument('output',type=Path,help='new directory; existing directories are not overwritten')
    parser.add_argument('--validate-only',action='store_true')
    args=parser.parse_args()
    if not args.validate_only:generate(args.output)
    print(json.dumps(validate(args.output),ensure_ascii=False,indent=2))

if __name__=='__main__':main()
