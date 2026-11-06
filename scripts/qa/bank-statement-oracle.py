"""Independent acceptance calculator for complete ruble 1C journals. stdout is private."""
import sys
import json
from collections import defaultdict
from datetime import datetime, timedelta
from decimal import Decimal, ROUND_HALF_UP
from pathlib import Path

def money(value):
    return Decimal(value.replace(" ", "").replace("\xa0", "").replace(",", "."))
def cents(value):
    return int((value * 100).quantize(Decimal(1), rounding=ROUND_HALF_UP))
def day(value):
    return datetime.strptime(value, "%d.%m.%Y").date()
def blocks(text):
    accounts, entries = [], []
    current = None
    for line in text.splitlines():
        line = line.strip()
        if line == 'СекцияРасчСчет':
            current = {}
            accounts.append(current)
        elif line.startswith('СекцияДокумент='):
            current = {}
            entries.append(current)
        elif line in ('КонецРасчСчет', 'КонецДокумента'):
            current = None
        elif current is not None and '=' in line:
            key, value = line.split('=', 1)
            current[key] = value.strip()
    return accounts, entries

def calculate(path):
    raw = Path(path).read_bytes()
    try:
        text = raw.decode('utf-8-sig')
    except UnicodeDecodeError:
        text = raw.decode('cp1251')
    accounts, rows = blocks(text)
    assert accounts and rows
    by_account = defaultdict(list)
    for section in accounts:
        by_account[section['РасчСчет']].append(section)
    spans = set()
    opening = closing = Decimal(0)
    for sections in by_account.values():
        sections.sort(key=lambda s: day(s['ДатаНачала']))
        for previous, following in zip(sections, sections[1:]):
            assert day(previous['ДатаКонца']) + timedelta(days=1) == day(following['ДатаНачала'])
            assert money(previous['КонечныйОстаток']) == money(following['НачальныйОстаток'])
        spans.add((day(sections[0]['ДатаНачала']), day(sections[-1]['ДатаКонца'])))
        opening += money(sections[0]['НачальныйОстаток'])
        closing += money(sections[-1]['КонечныйОстаток'])
    assert len(spans) == 1
    start, end = spans.pop()
    population = defaultdict(int)
    totals = defaultdict(Decimal)
    daily = defaultdict(Decimal)
    monthly = defaultdict(lambda: defaultdict(Decimal))
    account_days = defaultdict(lambda: defaultdict(Decimal))
    for row in rows:
        payer, receiver = row.get('ПлательщикСчет'), row.get('ПолучательСчет')
        debit, credit = payer in by_account, receiver in by_account
        if debit and credit:
            assert bool(row.get('ДатаСписано')) != bool(row.get('ДатаПоступило'))
            debit = bool(row.get('ДатаСписано'))
        else:
            assert debit or credit
        direction = 'out' if debit else 'in'
        posted = day(row.get('ДатаСписано' if debit else 'ДатаПоступило') or row['Дата'])
        value = money(row['Сумма'])
        assert value > 0 and start <= posted <= end
        own = (payer in by_account and receiver in by_account) or (row.get('ПлательщикИНН') and row.get('ПлательщикИНН') == row.get('ПолучательИНН'))
        key = ('internal_' if own else 'external_') + direction
        population[key] += 1
        totals[key] += value
        monthly[posted.strftime('%Y-%m')][key] += value
        daily[posted] += -value if debit else value
        account_days[(payer if debit else receiver, posted)][direction] += value
    for account, sections in by_account.items():
        for sec in sections:
            sums = defaultdict(Decimal)
            for (acct,when), amounts in account_days.items():
                if acct == account and day(sec['ДатаНачала']) <= when <= day(sec['ДатаКонца']):
                    for side, value in amounts.items():
                        sums[side] += value
            assert sums['in']==money(sec['ВсегоПоступило']) and sums['out']==money(sec['ВсегоСписано'])
    balances = []
    balance = opening
    current = start
    while current <= end:
        monthly[current.strftime('%Y-%m')]
        balance += daily[current]
        balances.append(balance)
        current += timedelta(days=1)
    assert balance == closing
    limit = totals['external_out'] * 3 / len(balances)
    return dict(period=[start.isoformat(),end.isoformat()], accounts=len(by_account), rows=len(rows), populations=dict(population),
                total={k:cents(v) for k,v in totals.items()}, months={k:{x:cents(y) for x,y in v.items()} for k,v in monthly.items()},
                opening=cents(opening), closing=cents(closing), days=len(balances), average=cents(sum(balances)/len(balances)),
                minimum=cents(min(balances)), lowDays=sum(b < limit for b in balances))
if __name__ == '__main__':
    print(json.dumps(calculate(sys.argv[1])))
