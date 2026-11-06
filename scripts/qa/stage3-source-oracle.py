"""Independent Poppler layout / Decimal oracle for the private acceptance set."""
import calendar, datetime, json, re, subprocess, sys
from decimal import Decimal

def read(pdf):
    return subprocess.check_output(['pdftotext', '-layout', pdf, '-'], stderr=subprocess.DEVNULL).decode().replace('\xa0', ' ')

def number(token):
    t = token.strip().replace(' ', '').replace(',', '.')
    if t in ['-', '—', '–']:
        return 0
    if re.fullmatch('\\([\\d.]+\\)', t):
        t = '-' + t[1:-1]
    if not re.fullmatch('-?\\d+(\\.\\d+)?', t):
        return None
    return Decimal(t)

def finance(pdf):
    text = read(pdf)
    lines = text.splitlines()
    cells = {}
    for line in lines:
        hit = re.search('\\s(1100|1200|1210|1230|1250|1300|1400|1410|1500|1510|1520|1600|1700|2110|2120|2200|2300|2330|2400)\\s{2,}(.+)$', line)
        if hit and hit[1] not in cells:
            cells[hit[1]] = number(re.split('\\s{2,}', hit[2].strip())[0])
    inn = re.search('Идентификационный номер налогоплательщика[^\\n]*?\\b(\\d{10}|\\d{12})\\b', text, re.I) or re.search('ИНН\\s+(\\d{10}|\\d{12})\\b', text, re.I)
    span = re.search('за\\s+(?:(\\d+)\\s+месяц\\S*|Январь\\s*[-–—]\\s*(март|июнь|сентябрь|декабрь))\\s+(20\\d{2})', text, re.I)
    if not span:
        raise ValueError('No independent period basis')
    months = int(span[1]) if span[1] else {'март': 3, 'июнь': 6, 'сентябрь': 9, 'декабрь': 12}[span[2].lower()]
    y = int(span[3])
    assert re.search('Единица измерения[^\\n]*тыс\\.?\\s*руб', text, re.I)
    assert inn and cells.get('1600') == cells.get('1700') and (cells['2110'] is not None) and (cells['2400'] is not None)

    basis = cells.copy()
    # The simplified form labels its equity aggregate and prints the dominant component code.
    for line in lines:
        fields = re.split(r"\s{2,}", line.strip())
        if len(fields) >= 3 and fields[0].lower() == "капитал и резервы" and fields[1] == "1370":
            basis['1300'] = number(fields[2])

    def ratio(a, b):
        if basis.get(a) is None or not basis.get(b):
            return None
        return float(basis[a] / basis[b])
    return dict(inn=inn[1], fromDate=f'{y}-01-01', toDate=f'{y}-{months:02}-{calendar.monthrange(y, months)[1]}', raw={k: None if v is None else float(v) for k, v in cells.items()}, scale=1000, ratios={'currentRatio': ratio('1200', '1500'), 'equityRatio': ratio('1300', '1600'), 'netMargin': ratio('2400', '2110')})

def bureau(pdf):
    text = read(pdf)
    headings = list(re.finditer('^\\s*(?:Банк|Оператор сервиса рассрочки):[^\\n]+$', text, re.M))
    report = re.search('Отч[её]т от (\\d+) (\\w+) (20\\d{2})', text, re.I)
    months = 'января февраля марта апреля мая июня июля августа сентября октября ноября декабря'.split()
    date = datetime.date(int(report[3]), months.index(report[2].lower()) + 1, int(report[1])).isoformat()
    first = text[headings[0].start():headings[1].start()]

    def after(marker):
        return first.split(marker, 1)[1]

    def currency_values(line):
        return [number(x) for x in re.findall('([\\d][\\d ]*[.,]\\d{2})\\s*₽', line)]
    payment_lines = after('Выплатили').split('Полная стоимость кредита')[0].splitlines()
    values = [currency_values(l) for l in payment_lines if '₽' in l]
    cost = next((l for l in after('Полная стоимость кредита').splitlines() if 'годовых' in l and '₽' in l))
    dated = next((l for l in after('Ближайший платёж').splitlines() if re.search('\\d{2}\\.\\d{2}\\.\\d{4}', l) and '₽' in l))
    assert values and re.match('^\\s*нет\\s', dated, re.I)
    d = re.search('(\\d{2})\\.(\\d{2})\\.(\\d{4})', dated)
    inn = re.search('(?i)\\bИНН\\s*[: ]*\\s*(\\d{12})\\b', text)
    return dict(date=date, subjectInn=inn[1] if inn else None, count=len(headings), active=sum(('Действующий' in h[0] for h in headings)), first=dict(totalOutstanding=float(values[0][-1]), outstandingPrincipal=float(values[1][-1]), monthlyPayment=float(currency_values(cost)[-1]), nextPaymentAmount=float(currency_values(dated)[-1]), nextPaymentDate=f'{d[3]}-{d[2]}-{d[1]}', overdueAmount=0))
if __name__ == '__main__':
    print(json.dumps((finance if sys.argv[1] == 'financial' else bureau)(sys.argv[2])))
