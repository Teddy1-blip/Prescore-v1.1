"""Read BIFF workbook cells as tabular text for the canonical import adapters."""
import math
import resource
import sys

import xlrd

MAX_INPUT = 25 * 1024 * 1024
MAX_OUTPUT = 8 * 1024 * 1024


def extract():
    resource.setrlimit(resource.RLIMIT_AS, (320 * 1024**2, 320 * 1024**2))
    resource.setrlimit(resource.RLIMIT_CPU, (8, 8))
    data = sys.stdin.buffer.read(MAX_INPUT + 1)
    if len(data) > MAX_INPUT:
        raise ValueError()
    book = xlrd.open_workbook(file_contents=data, on_demand=True)
    size = cells = 0
    if book.nsheets > 64:
        raise ValueError()
    for index in range(book.nsheets):
        sheet = book.sheet_by_index(index)
        cells += sheet.nrows * sheet.ncols
        if cells > 300000:
            raise ValueError()
        for row in range(sheet.nrows):
            values = []
            for cell in sheet.row(row):
                if cell.ctype == xlrd.XL_CELL_DATE:
                    value = xlrd.xldate_as_datetime(cell.value, book.datemode).isoformat()
                    if value.endswith('T00:00:00'):
                        value = value[:10]
                elif cell.ctype == xlrd.XL_CELL_NUMBER:
                    if not math.isfinite(cell.value):
                        raise ValueError()
                    value = format(cell.value, '.15g')
                elif cell.ctype == xlrd.XL_CELL_TEXT:
                    value = cell.value
                elif cell.ctype in (xlrd.XL_CELL_EMPTY, xlrd.XL_CELL_BLANK):
                    value = ''
                else:
                    # An Excel error cannot be interpreted as an empty amount.
                    raise ValueError()
                values.append(' '.join(value.splitlines()).replace('\t', ' '))
            line = '\t'.join(values) + '\n'
            size += len(line.encode('utf-8'))
            if size > MAX_OUTPUT:
                raise ValueError()
            sys.stdout.write(line)
        book.unload_sheet(index)


if __name__ == '__main__':
    try:
        extract()
    except Exception:
        sys.exit(1)
