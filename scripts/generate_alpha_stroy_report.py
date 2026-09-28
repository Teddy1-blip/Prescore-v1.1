from pathlib import Path

from reportlab.graphics.shapes import Circle, Drawing, Line, PolyLine, Rect, String
from reportlab.lib import colors
from reportlab.lib.enums import TA_CENTER, TA_LEFT, TA_RIGHT
from reportlab.lib.pagesizes import A4
from reportlab.lib.styles import ParagraphStyle, getSampleStyleSheet
from reportlab.lib.units import mm
from reportlab.pdfbase import pdfmetrics
from reportlab.pdfbase.ttfonts import TTFont
from reportlab.platypus import (
    BaseDocTemplate,
    Frame,
    PageBreak,
    PageTemplate,
    Paragraph,
    Spacer,
    Table,
    TableStyle,
)


ROOT = Path(__file__).resolve().parents[1]
OUTPUT = ROOT / "output" / "pdf" / "prescore-sample-report.pdf"
PUBLIC = ROOT / "public" / "files" / "prescore-sample-report.pdf"
OUTPUT.parent.mkdir(parents=True, exist_ok=True)
PUBLIC.parent.mkdir(parents=True, exist_ok=True)

FONT_DIR = Path("/usr/share/fonts/truetype/dejavu")
pdfmetrics.registerFont(TTFont("DejaVu", str(FONT_DIR / "DejaVuSans.ttf")))
pdfmetrics.registerFont(TTFont("DejaVu-Bold", str(FONT_DIR / "DejaVuSans-Bold.ttf")))

NAVY = colors.HexColor("#092238")
BLUE = colors.HexColor("#0C5F99")
TEAL = colors.HexColor("#15947A")
ORANGE = colors.HexColor("#D77C45")
RED = colors.HexColor("#B95648")
INK = colors.HexColor("#173246")
MUTED = colors.HexColor("#657D8B")
LINE = colors.HexColor("#D9E5EB")
GRID = colors.HexColor("#E9F0F3")
SOFT = colors.HexColor("#F3F7F9")
PALE_BLUE = colors.HexColor("#EAF2F8")
PALE_GREEN = colors.HexColor("#E9F7F3")
PALE_ORANGE = colors.HexColor("#FFF3E8")
PALE_RED = colors.HexColor("#FCEBE8")
WHITE = colors.white

PAGE_W, PAGE_H = A4
MX = 16 * mm
MT = 19 * mm
MB = 15 * mm
CONTENT_W = PAGE_W - 2 * MX

base = getSampleStyleSheet()
BODY = ParagraphStyle(
    "Body",
    parent=base["BodyText"],
    fontName="DejaVu",
    fontSize=9.6,
    leading=13.6,
    textColor=INK,
    spaceAfter=4,
)
SMALL = ParagraphStyle("Small", parent=BODY, fontSize=7.9, leading=10.8, textColor=MUTED)
TINY = ParagraphStyle("Tiny", parent=SMALL, fontSize=6.9, leading=9.1)
H1 = ParagraphStyle(
    "H1", parent=base["Heading1"], fontName="DejaVu-Bold", fontSize=23,
    leading=27, textColor=NAVY, spaceAfter=8,
)
H2 = ParagraphStyle(
    "H2", parent=base["Heading2"], fontName="DejaVu-Bold", fontSize=14.5,
    leading=18, textColor=NAVY, spaceBefore=3, spaceAfter=7,
)
H3 = ParagraphStyle("H3", parent=base["Heading3"], fontName="DejaVu-Bold", fontSize=10.2, leading=13.2, textColor=INK)
EYEBROW = ParagraphStyle(
    "Eyebrow", parent=SMALL, fontName="DejaVu-Bold", fontSize=7.6,
    leading=9.2, textColor=BLUE, tracking=0.7, spaceAfter=5,
)
WHITE_H1 = ParagraphStyle("WhiteH1", parent=H1, fontSize=27, leading=31, textColor=WHITE)
WHITE_BODY = ParagraphStyle("WhiteBody", parent=BODY, fontSize=10.2, leading=14.2, textColor=colors.HexColor("#D8E6EF"))
KPI_LABEL = ParagraphStyle("KpiLabel", parent=TINY, fontName="DejaVu-Bold", textColor=MUTED)
KPI_VALUE = ParagraphStyle("KpiValue", parent=BODY, fontName="DejaVu-Bold", fontSize=14.7, leading=17, textColor=NAVY)
TH = ParagraphStyle("TH", parent=TINY, fontName="DejaVu-Bold", textColor=WHITE)
TD = ParagraphStyle("TD", parent=TINY, textColor=INK)
TD_BOLD = ParagraphStyle("TDBold", parent=TD, fontName="DejaVu-Bold")
RIGHT = ParagraphStyle("Right", parent=SMALL, alignment=TA_RIGHT)
CENTER = ParagraphStyle("Center", parent=SMALL, alignment=TA_CENTER)


def p(text, style=BODY):
    return Paragraph(str(text), style)


def section(code, title, subtitle=None):
    items = [p(code.upper(), EYEBROW), p(title, H1)]
    if subtitle:
        items.append(p(subtitle, BODY))
    items.append(Spacer(1, 2 * mm))
    return items


def callout(title, text, tone="blue"):
    palette = {
        "blue": (PALE_BLUE, BLUE),
        "green": (PALE_GREEN, TEAL),
        "orange": (PALE_ORANGE, ORANGE),
        "red": (PALE_RED, RED),
    }
    bg, accent = palette[tone]
    result = Table(
        [[p(title, ParagraphStyle("CallTitle", parent=H3, textColor=accent)), p(text, SMALL)]],
        colWidths=[47 * mm, 117 * mm],
    )
    result.setStyle(TableStyle([
        ("BACKGROUND", (0, 0), (-1, -1), bg),
        ("BOX", (0, 0), (-1, -1), 0.7, colors.Color(accent.red, accent.green, accent.blue, alpha=0.5)),
        ("LINEBEFORE", (0, 0), (0, -1), 3, accent),
        ("VALIGN", (0, 0), (-1, -1), "TOP"),
        ("LEFTPADDING", (0, 0), (-1, -1), 9),
        ("RIGHTPADDING", (0, 0), (-1, -1), 9),
        ("TOPPADDING", (0, 0), (-1, -1), 7),
        ("BOTTOMPADDING", (0, 0), (-1, -1), 7),
    ]))
    return result


def kpis(items):
    cells = []
    for label, value, note, tone in items:
        color = TEAL if tone == "good" else RED if tone == "bad" else ORANGE if tone == "warn" else NAVY
        cells.append([
            p(label.upper(), KPI_LABEL),
            p(value, ParagraphStyle("KpiTone", parent=KPI_VALUE, textColor=color)),
            p(note, TINY),
        ])
    result = Table([cells], colWidths=[41 * mm] * len(cells))
    result.setStyle(TableStyle([
        ("BACKGROUND", (0, 0), (-1, -1), WHITE),
        ("BOX", (0, 0), (-1, -1), 0.6, LINE),
        ("INNERGRID", (0, 0), (-1, -1), 0.45, LINE),
        ("VALIGN", (0, 0), (-1, -1), "TOP"),
        ("LEFTPADDING", (0, 0), (-1, -1), 8),
        ("RIGHTPADDING", (0, 0), (-1, -1), 8),
        ("TOPPADDING", (0, 0), (-1, -1), 6.5),
        ("BOTTOMPADDING", (0, 0), (-1, -1), 6.5),
    ]))
    return result


def data_table(headers, rows, widths, status_col=None):
    data = [[p(x, TH) for x in headers]]
    for row in rows:
        data.append([x if hasattr(x, "wrap") else p(x, TD) for x in row])
    result = Table(data, colWidths=widths, repeatRows=1)
    styling = [
        ("BACKGROUND", (0, 0), (-1, 0), NAVY),
        ("BOX", (0, 0), (-1, -1), 0.55, LINE),
        ("INNERGRID", (0, 1), (-1, -1), 0.35, LINE),
        ("VALIGN", (0, 0), (-1, -1), "TOP"),
        ("LEFTPADDING", (0, 0), (-1, -1), 6),
        ("RIGHTPADDING", (0, 0), (-1, -1), 6),
        ("TOPPADDING", (0, 0), (-1, -1), 4.3),
        ("BOTTOMPADDING", (0, 0), (-1, -1), 4.3),
    ]
    for index in range(1, len(data)):
        if index % 2 == 0:
            styling.append(("BACKGROUND", (0, index), (-1, index), SOFT))
    if status_col is not None:
        for index, row in enumerate(rows, start=1):
            value = str(row[status_col]).lower()
            if any(x in value for x in ["подходит", "пройдено", "хорошее", "низкий", "можно", "рекомендуется", "нет"]):
                bg = PALE_GREEN
            elif any(x in value for x in ["стоп", "не сейчас", "критический", "высокий"]):
                bg = PALE_RED
            else:
                bg = PALE_ORANGE
            styling.append(("BACKGROUND", (status_col, index), (status_col, index), bg))
    result.setStyle(TableStyle(styling))
    return result


def bullets(items, tone=TEAL, width=159 * mm):
    rows = [[p("●", ParagraphStyle("Dot", parent=TINY, textColor=tone, fontName="DejaVu-Bold")), p(item, SMALL)] for item in items]
    result = Table(rows, colWidths=[5 * mm, width])
    result.setStyle(TableStyle([
        ("VALIGN", (0, 0), (-1, -1), "TOP"),
        ("LEFTPADDING", (0, 0), (-1, -1), 0),
        ("RIGHTPADDING", (0, 0), (-1, -1), 2),
        ("TOPPADDING", (0, 0), (-1, -1), 1),
        ("BOTTOMPADDING", (0, 0), (-1, -1), 3),
    ]))
    return result


def grouped_bar_chart(labels, incoming, outgoing, width=164 * mm, height=42 * mm):
    w, h = float(width), float(height)
    drawing = Drawing(w, h)
    left, right, bottom, top = 31, 8, 20, 14
    plot_w, plot_h = w - left - right, h - bottom - top
    max_value = 12
    for tick in [0, 4, 8, 12]:
        y = bottom + plot_h * tick / max_value
        drawing.add(Line(left, y, w - right, y, strokeColor=GRID, strokeWidth=0.7))
        drawing.add(String(left - 6, y - 2.5, str(tick), fontName="DejaVu", fontSize=6.2, fillColor=MUTED, textAnchor="end"))
    group_w = plot_w / len(labels)
    bar_w = group_w * 0.27
    for index, label in enumerate(labels):
        center = left + group_w * (index + 0.5)
        for offset, value, color in [(-bar_w * 0.55, incoming[index], TEAL), (bar_w * 0.55, outgoing[index], BLUE)]:
            bh = plot_h * value / max_value
            drawing.add(Rect(center + offset - bar_w / 2, bottom, bar_w, bh, fillColor=color, strokeColor=None))
        drawing.add(String(center, 7, label, fontName="DejaVu", fontSize=6.3, fillColor=MUTED, textAnchor="middle"))
        drawing.add(String(center - bar_w * 0.55, bottom + plot_h * incoming[index] / max_value + 3, f"{incoming[index]:.1f}", fontName="DejaVu", fontSize=5.7, fillColor=TEAL, textAnchor="middle"))
    drawing.add(Rect(w - 134, h - 7, 7, 4, fillColor=TEAL, strokeColor=None))
    drawing.add(String(w - 123, h - 7, "поступления", fontName="DejaVu", fontSize=6.2, fillColor=MUTED))
    drawing.add(Rect(w - 66, h - 7, 7, 4, fillColor=BLUE, strokeColor=None))
    drawing.add(String(w - 55, h - 7, "списания", fontName="DejaVu", fontSize=6.2, fillColor=MUTED))
    return drawing


def line_chart(labels, values, width=164 * mm, height=38 * mm):
    w, h = float(width), float(height)
    drawing = Drawing(w, h)
    left, right, bottom, top = 31, 8, 19, 12
    plot_w, plot_h = w - left - right, h - bottom - top
    max_value = 2.2
    for tick in [0, 0.5, 1.0, 1.5, 2.0]:
        y = bottom + plot_h * tick / max_value
        drawing.add(Line(left, y, w - right, y, strokeColor=GRID, strokeWidth=0.7))
        drawing.add(String(left - 6, y - 2.5, f"{tick:.1f}", fontName="DejaVu", fontSize=6.1, fillColor=MUTED, textAnchor="end"))
    points = []
    for index, value in enumerate(values):
        x = left + plot_w * index / (len(values) - 1)
        y = bottom + plot_h * value / max_value
        points.append((x, y))
        drawing.add(Circle(x, y, 2.4, fillColor=TEAL, strokeColor=WHITE, strokeWidth=0.8))
        drawing.add(String(x, 6, labels[index], fontName="DejaVu", fontSize=6.2, fillColor=MUTED, textAnchor="middle"))
    drawing.add(PolyLine(points, strokeColor=TEAL, strokeWidth=2.2))
    threshold_y = bottom + plot_h * 0.5 / max_value
    drawing.add(Line(left, threshold_y, w - right, threshold_y, strokeColor=ORANGE, strokeWidth=1, strokeDashArray=[3, 2]))
    drawing.add(String(w - right, threshold_y + 3, "зона напряжения", fontName="DejaVu", fontSize=5.8, fillColor=ORANGE, textAnchor="end"))
    return drawing


def concentration_chart(items, width=164 * mm, height=42 * mm):
    w, h = float(width), float(height)
    drawing = Drawing(w, h)
    label_w, value_w = 112, 26
    bar_left = label_w
    bar_w = w - bar_left - value_w
    row_h = h / len(items)
    for index, (label, value, tone) in enumerate(items):
        y = h - row_h * (index + 1) + 5
        color = ORANGE if tone == "warn" else BLUE if tone == "blue" else TEAL
        drawing.add(String(0, y + 2, label, fontName="DejaVu", fontSize=6.5, fillColor=INK))
        drawing.add(Rect(bar_left, y, bar_w, 7, fillColor=GRID, strokeColor=None))
        drawing.add(Rect(bar_left, y, bar_w * value / 35, 7, fillColor=color, strokeColor=None))
        drawing.add(String(w, y + 1.5, f"{value}%", fontName="DejaVu-Bold", fontSize=6.5, fillColor=color, textAnchor="end"))
    return drawing


def header_footer(canvas, doc):
    canvas.saveState()
    page = canvas.getPageNumber()
    canvas.setFont("DejaVu-Bold", 7.4)
    canvas.setFillColor(NAVY)
    canvas.drawString(MX, PAGE_H - 10 * mm, "ПРЕСКОР / КЛИЕНТСКИЙ ОТЧЁТ")
    canvas.setFont("DejaVu", 6.5)
    canvas.setFillColor(MUTED)
    canvas.drawRightString(PAGE_W - MX, PAGE_H - 10 * mm, "ДЕМО · ВЫМЫШЛЕННАЯ КОМПАНИЯ · PSR-DEMO-AS-2026")
    canvas.setStrokeColor(LINE)
    canvas.line(MX, PAGE_H - 12.5 * mm, PAGE_W - MX, PAGE_H - 12.5 * mm)
    canvas.line(MX, 10.5 * mm, PAGE_W - MX, 10.5 * mm)
    canvas.setFont("DejaVu", 6.3)
    canvas.drawString(MX, 6.8 * mm, "Информационно-аналитический отчёт. Не является решением или гарантией финансирования.")
    canvas.drawRightString(PAGE_W - MX, 6.8 * mm, f"{page:02d}")
    canvas.restoreState()


doc = BaseDocTemplate(
    str(OUTPUT), pagesize=A4, leftMargin=MX, rightMargin=MX, topMargin=MT, bottomMargin=MB,
    title="Прескор — демонстрационный кредитный отчёт ООО Альфа Строй",
    author="Прескор",
    subject="Готовый пример клиентского информационно-аналитического отчёта",
    keywords="Прескор, демонстрационный отчёт, выписки, БФО, БКИ, кредитный портфель",
)
frame = Frame(MX, MB, CONTENT_W, PAGE_H - MT - MB, id="content")
doc.addPageTemplates([PageTemplate(id="report", frames=[frame], onPage=header_footer)])

story = []

# 01 — Cover and decision
cover = Table([
    [p("ПРЕСКОР", ParagraphStyle("CoverBrand", parent=EYEBROW, textColor=colors.HexColor("#7FC6EF"), fontSize=10)), ""],
    [p("Кредитное заключение бизнеса", WHITE_H1), ""],
    [p("Готовый результат анализа в личном кабинете", WHITE_BODY), ""],
], colWidths=[124 * mm, 40 * mm])
cover.setStyle(TableStyle([
    ("BACKGROUND", (0, 0), (-1, -1), NAVY),
    ("SPAN", (0, 0), (1, 0)),
    ("SPAN", (0, 1), (1, 1)),
    ("SPAN", (0, 2), (1, 2)),
    ("LEFTPADDING", (0, 0), (-1, -1), 17),
    ("RIGHTPADDING", (0, 0), (-1, -1), 17),
    ("TOPPADDING", (0, 0), (-1, 0), 15),
    ("BOTTOMPADDING", (0, 0), (-1, 0), 10),
    ("TOPPADDING", (0, 1), (-1, 1), 7),
    ("BOTTOMPADDING", (0, 1), (-1, 1), 8),
    ("TOPPADDING", (0, 2), (-1, 2), 4),
    ("BOTTOMPADDING", (0, 2), (-1, 2), 16),
]))
story += [Spacer(1, 9 * mm), cover, Spacer(1, 13 * mm)]
story += [p("ДЕМОНСТРАЦИОННЫЙ ОТЧЁТ ПО ОДНОЙ КОМПАНИИ", EYEBROW), p("ООО «Альфа Строй»", H1)]
story += [
    p("ИНН 7700000000 <font color='#B95648'>(вымышленный)</font> · строительство и подрядные работы · Москва", BODY),
    p("Возраст бизнеса: 6 лет · Период выписок: 01.02–31.07.2026 · Дата отчёта: 20.08.2026", SMALL),
    Spacer(1, 7 * mm),
]
story.append(kpis([
    ("Prescore Index", "776 / 1000", "Итоговый класс B+", "good"),
    ("Готовность", "78%", "Нужно закрыть 4 пункта", "warn"),
    ("Расчётный лимит", "8,5–11,0 млн ₽", "Рабочий запрос 9,8 млн ₽", "neutral"),
    ("Решение", "ГОТОВИТЬ", "Адресная подача после действий", "warn"),
]))
story += [
    Spacer(1, 9 * mm),
    callout(
        "Краткий итог",
        "Компания имеет устойчивый оборот, прибыль, положительный капитал и хорошую кредитную дисциплину. Финансирование реалистично в диапазоне 8,5–11,0 млн ₽. До подачи необходимо устранить прогнозный кассовый разрыв, подтвердить крупнейшего заказчика и полностью сверить долговые графики.",
        "green",
    ),
    Spacer(1, 8 * mm),
]
story.append(data_table(
    ["Потребность", "Рекомендуемый запрос", "Основной продукт", "Статус"],
    [["Пополнение оборотных средств под контракты", "9,8 млн ₽", "Возобновляемая кредитная линия", "Подготовка к подаче"]],
    [49 * mm, 35 * mm, 48 * mm, 32 * mm], status_col=3,
))
story += [
    Spacer(1, 9 * mm),
    callout(
        "Формат за 6 500 ₽",
        "30 дней доступа по одному клиенту: обновление выписок, БФО, БКИ и документов, пересчёт выводов, кредитный портфель, рекомендации и готовый PDF.",
        "blue",
    ),
    Spacer(1, 8 * mm),
    p("Все сведения, наименования контрагентов, договоры, банки и числовые значения в этом отчёте являются демонстрационными и не относятся к реальной компании.", SMALL),
]
story.append(PageBreak())

# 02 — Executive summary
story += section("ОБЩЕЕ ЗАКЛЮЧЕНИЕ", "Результат анализа", "Единый вывод по выпискам, финансовой отчётности, кредитной истории, контрактам и правовым событиям")
story.append(data_table(["Блок", "Результат", "Ключевой факт", "Влияние"], [
    ["Банковские обороты", "Пройдено", "58,8 млн ₽ поступлений / 9,8 млн ₽ в месяц", "Источник погашения подтверждён"],
    ["Финансовое состояние", "Пройдено с условием", "Выручка 126 млн ₽ / EBITDA 15,2 млн ₽", "Бизнес прибыльный, дебиторка растёт"],
    ["Кредитная история", "Пройдено с условием", "Остаток 13,2 млн ₽ / просрочка 0 ₽", "Дисциплина хорошая, нужна сверка платежей"],
    ["Правовые риски", "Пройдено", "2 дела на 0,62 млн ₽ / ФССП 0 ₽", "Критического юридического риска нет"],
    ["Контракты", "Пройдено", "4 действующих / 31,2 млн ₽", "Подтверждают будущий поток"],
], [35 * mm, 34 * mm, 52 * mm, 43 * mm], status_col=1))
story += [Spacer(1, 7 * mm)]
strengths = bullets([
    "Выручка выросла с 108 до 126 млн ₽ за год (+16,7%).",
    "Среднемесячные поступления 9,8 млн ₽; резких провалов оборота нет.",
    "EBITDA 15,2 млн ₽ и чистая прибыль 6,4 млн ₽.",
    "Положительный капитал 23,4 млн ₽; просрочка по БКИ отсутствует.",
    "Действующие контракты на 31,2 млн ₽ подтверждают загрузку.",
], width=72 * mm)
risks = bullets([
    "Запас ликвидности около 5 дней; прогнозный разрыв — 1,15 млн ₽.",
    "Крупнейший покупатель даёт 32% поступлений; TOP-3 — 65%.",
    "Дебиторская задолженность выросла до 37,6 млн ₽ на 30.06.2026.",
    "Платёж по БКИ выше распознанного в выписках на 160 тыс. ₽ в месяц.",
    "По двум обязательствам не приложены актуальные графики.",
], tone=ORANGE, width=72 * mm)
compare = Table([
    [p("Сильные стороны", H2), p("Основные риски", H2)],
    [strengths, risks],
], colWidths=[82 * mm, 82 * mm])
compare.setStyle(TableStyle([
    ("BACKGROUND", (0, 0), (0, -1), PALE_GREEN),
    ("BACKGROUND", (1, 0), (1, -1), PALE_ORANGE),
    ("BOX", (0, 0), (-1, -1), 0.6, LINE),
    ("INNERGRID", (0, 0), (-1, -1), 0.45, LINE),
    ("VALIGN", (0, 0), (-1, -1), "TOP"),
    ("LEFTPADDING", (0, 0), (-1, -1), 9),
    ("RIGHTPADDING", (0, 0), (-1, -1), 9),
    ("TOPPADDING", (0, 0), (-1, -1), 7),
    ("BOTTOMPADDING", (0, 0), (-1, -1), 8),
]))
story.append(compare)
story += [Spacer(1, 7 * mm)]
story.append(kpis([
    ("Сильные сигналы", "7", "Подтверждены данными", "good"),
    ("Ограничения", "4", "Нужно закрыть до подачи", "warn"),
    ("Критические стопы", "0", "На дату отчёта", "good"),
    ("Горизонт готовности", "7–14 дней", "При наличии документов", "neutral"),
]))
story += [Spacer(1, 7 * mm), callout(
    "Экспертное заключение",
    "Профиль не выглядит отказным. Массовая подача сейчас не рекомендуется: адресный запрос на 9,8 млн ₽ следует направлять после сверки БКИ, подтверждения TOP-1 заказчика и формирования платёжного календаря.",
    "orange",
)]
story.append(PageBreak())

# 03 — Bank statements and turnover
story += section("БАНКОВСКИЕ ВЫПИСКИ", "Обороты и динамика поступлений", "Три банка · четыре расчётных счёта · 2 116 операций · внутренние переводы исключены")
story.append(kpis([
    ("Поступления", "58,80 млн ₽", "9,80 млн ₽ в месяц", "good"),
    ("Списания", "58,05 млн ₽", "9,68 млн ₽ в месяц", "neutral"),
    ("Чистый поток", "+0,75 млн ₽", "+1,3% от поступлений", "good"),
    ("Долговые платежи", "4,56 млн ₽", "0,76 млн ₽ в месяц", "warn"),
]))
story += [Spacer(1, 6 * mm), p("Поступления и списания, млн ₽", H2)]
story.append(grouped_bar_chart(
    ["Фев", "Мар", "Апр", "Май", "Июн", "Июл"],
    [9.3, 10.2, 8.9, 9.7, 10.0, 10.7],
    [9.15, 10.05, 9.22, 9.45, 9.91, 10.27],
))
story += [Spacer(1, 4 * mm)]
story.append(data_table(["Месяц", "Поступления", "Списания", "Чистый поток", "Остаток на конец"], [
    ["Февраль", "9,30 млн ₽", "9,15 млн ₽", "+0,15 млн ₽", "1,18 млн ₽"],
    ["Март", "10,20 млн ₽", "10,05 млн ₽", "+0,15 млн ₽", "1,31 млн ₽"],
    ["Апрель", "8,90 млн ₽", "9,22 млн ₽", "−0,32 млн ₽", "0,98 млн ₽"],
    ["Май", "9,70 млн ₽", "9,45 млн ₽", "+0,25 млн ₽", "1,22 млн ₽"],
    ["Июнь", "10,00 млн ₽", "9,91 млн ₽", "+0,09 млн ₽", "1,28 млн ₽"],
    ["Июль", "10,70 млн ₽", "10,27 млн ₽", "+0,43 млн ₽", "1,71 млн ₽"],
    [p("Итого / среднее", TD_BOLD), p("58,80 млн ₽", TD_BOLD), p("58,05 млн ₽", TD_BOLD), p("+0,75 млн ₽", TD_BOLD), p("1,28 млн ₽", TD_BOLD)],
], [29 * mm, 34 * mm, 34 * mm, 34 * mm, 33 * mm]))
story += [Spacer(1, 6 * mm), p("Структура списаний", H2)]
story.append(data_table(["Категория", "Сумма", "Доля списаний", "Вывод"], [
    ["Поставщики и субподрядчики", "34,20 млн ₽", "58,9%", "Соответствует строительному циклу"],
    ["Фонд оплаты труда", "9,60 млн ₽", "16,5%", "Регулярные выплаты"],
    ["Налоги и сборы", "4,90 млн ₽", "8,4%", "Платежи регулярны"],
    ["Кредиты и лизинг", "4,56 млн ₽", "7,9%", "Нагрузка сверяется с БКИ"],
    ["Прочие операционные расходы", "4,79 млн ₽", "8,3%", "Существенных аномалий нет"],
], [48 * mm, 31 * mm, 30 * mm, 55 * mm]))
story += [Spacer(1, 6 * mm), callout("Вывод по оборотам", "Поступления стабильны и покрывают текущие списания. Основное ограничение — небольшой свободный денежный поток при высокой доле расчётов с субподрядчиками и действующей долговой нагрузке.", "blue")]
story.append(PageBreak())

# 04 — Liquidity and customer concentration
story += section("ЛИКВИДНОСТЬ И ПОКУПАТЕЛИ", "Кассовые разрывы и концентрация", "Оценка фактических остатков и ближайшего платёжного цикла")
story.append(kpis([
    ("Средний остаток", "1,58 млн ₽", "Среднедневной", "neutral"),
    ("Минимальный остаток", "0,34 млн ₽", "4 дня ниже 0,5 млн ₽", "warn"),
    ("Запас ликвидности", "≈ 5 дней", "При текущем расходе", "warn"),
    ("Прогнозный разрыв", "−1,15 млн ₽", "До оплаты контракта", "bad"),
]))
story += [Spacer(1, 6 * mm), p("Минимальный дневной остаток по месяцам, млн ₽", H2)]
story.append(line_chart(["Фев", "Мар", "Апр", "Май", "Июн", "Июл"], [0.62, 0.51, 0.44, 0.39, 0.34, 0.58]))
story += [Spacer(1, 5 * mm), p("Прогноз платёжного календаря на сентябрь", H2)]
story.append(data_table(["Период", "Входящий поток", "Исходящий поток", "Расчётный остаток", "Комментарий"], [
    ["01–10 сентября", "3,20 млн ₽", "2,50 млн ₽", "2,28 млн ₽", "Штатный режим"],
    ["11–20 сентября", "2,10 млн ₽", "5,48 млн ₽", "−1,10 млн ₽", "Пик зарплаты, налогов и поставщиков"],
    ["21–30 сентября", "5,40 млн ₽", "3,10 млн ₽", "1,20 млн ₽", "Оплата по контракту закрывает разрыв"],
], [32 * mm, 31 * mm, 31 * mm, 33 * mm, 37 * mm]))
story += [Spacer(1, 6 * mm), callout("Кассовый разрыв", "Без резервной линии компании потребуется перенести часть платежей поставщикам примерно на 8 дней. Рабочая потребность в коротком финансировании — 1,2–2,0 млн ₽; основной лимит нужен для сглаживания нескольких контрактных циклов.", "orange"), Spacer(1, 6 * mm)]
story += [p("Концентрация поступлений по покупателям", H2)]
story.append(concentration_chart([
    ("ГКУ «Дирекция дорожного строительства»", 32, "warn"),
    ("АО «СтройИнвест»", 19, "blue"),
    ("ООО «Север Девелопмент»", 14, "blue"),
    ("ГБУ «Жилищник-Север»", 11, "good"),
    ("Прочие покупатели", 24, "good"),
]))
story += [Spacer(1, 2 * mm), p("<b>Вывод по покупателям.</b> TOP-1 формирует 32% поступлений, TOP-3 — 65%. Концентрация управляемая при подтверждённых договорах и графике оплат, но ограничивает верхнюю границу необеспеченного запроса.", SMALL)]
story.append(PageBreak())

# 05 — Financial statements
story += section("ФИНАНСОВАЯ ОТЧЁТНОСТЬ", "Финансовое состояние", "Годовая отчётность за 2024–2025 годы и промежуточные данные за 6 месяцев 2026 года")
story.append(kpis([
    ("Выручка 2025", "126,0 млн ₽", "+16,7% год к году", "good"),
    ("EBITDA", "15,2 млн ₽", "Маржа 12,1%", "good"),
    ("Чистая прибыль", "6,4 млн ₽", "Маржа 5,1%", "good"),
    ("Собственный капитал", "23,4 млн ₽", "29,4% активов", "good"),
]))
story += [Spacer(1, 7 * mm)]
story.append(data_table(["Показатель", "2024", "2025", "6 мес. 2026", "Комментарий"], [
    ["Выручка", "108,0 млн ₽", "126,0 млн ₽", "67,4 млн ₽", "Рост сохраняется"],
    ["EBITDA", "11,7 млн ₽", "15,2 млн ₽", "7,3 млн ₽", "Операционная прибыль положительная"],
    ["Чистая прибыль", "4,9 млн ₽", "6,4 млн ₽", "2,6 млн ₽", "Маржа снизилась до 3,9%"],
    ["Активы", "72,1 млн ₽", "79,6 млн ₽", "84,3 млн ₽", "Рост за счёт оборотных активов"],
    ["Собственный капитал", "18,2 млн ₽", "23,4 млн ₽", "26,0 млн ₽", "Положительный и растущий"],
    ["Дебиторская задолженность", "27,1 млн ₽", "31,8 млн ₽", "37,6 млн ₽", "Рост требует расшифровки"],
    ["Кредиторская задолженность", "24,9 млн ₽", "28,6 млн ₽", "34,2 млн ₽", "Следует сверить с графиком работ"],
], [47 * mm, 26 * mm, 26 * mm, 29 * mm, 36 * mm]))
story += [Spacer(1, 7 * mm), p("Ключевые финансовые показатели", H2)]
story.append(data_table(["Показатель", "Значение", "Оценка", "Практический вывод"], [
    ["Текущая ликвидность", "1,21", "Умеренный запас", "Дополнительная нагрузка должна быть ограничена"],
    ["Чистый оборотный капитал", "11,0 млн ₽", "Положительный", "Оборотный цикл финансируется не только кредиторами"],
    ["Долг / EBITDA", "0,87×", "Умеренный", "Текущий долг соответствует масштабу бизнеса"],
    ["Дебиторка / активы", "39,9%", "Повышенная роль", "Нужны реестр и подтверждение TOP-дебиторов"],
    ["Рентабельность чистой прибыли", "5,1%", "Положительная", "Есть запас, но чувствительность к росту затрат высокая"],
], [49 * mm, 27 * mm, 34 * mm, 54 * mm]))
story += [Spacer(1, 7 * mm), callout("Вывод по отчётности", "Финансовое состояние устойчивое: убытка и отрицательных чистых активов нет. Основной риск — ускоренный рост дебиторки и кредиторки при снижении маржи в промежуточной отчётности.", "green")]
story.append(PageBreak())

# 06 — Contracts and legal risks
story += section("КОНТРАКТЫ И ПРАВОВЫЕ РИСКИ", "Заказы, суды и юридические события", "Состояние на 20.08.2026")
story.append(kpis([
    ("Контрактов в истории", "22", "164,6 млн ₽", "good"),
    ("Действующие", "4", "31,2 млн ₽", "good"),
    ("Арбитраж ответчик", "0,62 млн ₽", "2 дела", "warn"),
    ("ФССП / просрочка", "0 ₽", "Открытых требований нет", "good"),
]))
story += [Spacer(1, 7 * mm), p("Действующий контрактный портфель", H2)]
story.append(data_table(["Контракт", "Заказчик", "Сумма", "Срок", "Кредитное значение"], [
    ["0473…214", "ГКУ «Дирекция дорожного строительства»", "12,4 млн ₽", "12.2026", "Оборотное финансирование / гарантия"],
    ["0473…188", "МБУ «Капстрой»", "8,6 млн ₽", "10.2026", "Короткий контрактный цикл"],
    ["2234…061", "АО «РегионИнжСтрой»", "6,1 млн ₽", "11.2026", "Возможен факторинг"],
    ["0473…237", "ГБУ «Жилищник-Север»", "4,1 млн ₽", "09.2026", "Ближайшее ожидаемое поступление"],
], [29 * mm, 53 * mm, 28 * mm, 22 * mm, 32 * mm]))
story += [Spacer(1, 7 * mm), p("Юридические риски", H2)]
story.append(data_table(["Проверка", "Факт", "Уровень", "Заключение"], [
    ["Статус компании", "Действует; сведения достоверны", "Низкий", "Ограничений не выявлено"],
    ["Арбитражные дела", "2 дела как ответчик / 0,62 млн ₽", "Умеренный", "Сумма 0,5% годовой выручки; проверить исход"],
    ["Исполнительные производства", "Открытый остаток 0 ₽", "Низкий", "Критического сигнала нет"],
    ["Банкротные сообщения", "Активные процедуры не обнаружены", "Низкий", "Критического сигнала нет"],
    ["Проверки", "1 завершённая / нарушений не выявлено", "Низкий", "Дополнительных действий не требуется"],
    ["Руководитель и участники", "Состав стабилен более 4 лет", "Низкий", "Резких корпоративных изменений нет"],
], [43 * mm, 55 * mm, 25 * mm, 41 * mm], status_col=2))
story += [Spacer(1, 7 * mm), callout("Вывод", "Критического юридического стоп-фактора не выявлено. Действующие контракты поддерживают оборотное финансирование, банковские гарантии и факторинг. Перед подачей нужно обновить статусы двух судебных дел и подтвердить календарь оплат по контрактам.", "green"), Spacer(1, 5 * mm)]
story.append(p("Юридические сведения и предложения финансирования носят информационно-аналитический характер и не являются юридическим заключением, офертой или решением кредитной организации.", SMALL))
story.append(PageBreak())

# 07 — Credit portfolio
story += section("КРЕДИТНАЯ ИСТОРИЯ", "Кредитный портфель", "Демонстрационный отчёт БКИ от 15.08.2026 · сведения по юридическому лицу")
story.append(kpis([
    ("Суммы и лимиты", "28,0 млн ₽", "5 обязательств", "neutral"),
    ("Остаток долга", "13,2 млн ₽", "47% от лимитов и сумм", "neutral"),
    ("Платёж в месяц", "0,92 млн ₽", "+0,16 млн ₽ к выпискам", "warn"),
    ("Текущая просрочка", "0 ₽", "Качество хорошее", "good"),
]))
story += [Spacer(1, 7 * mm)]
story.append(data_table(["Кредитор / продукт", "Сумма / лимит", "Остаток", "Платёж", "Ставка", "Качество"], [
    ["Банк А / кредитная линия", "8,0 млн ₽", "4,6 млн ₽", "290 тыс. ₽", "20,4%", "Хорошее"],
    ["Банк Б / срочный кредит", "7,0 млн ₽", "3,1 млн ₽", "340 тыс. ₽", "21,5%", "Хорошее"],
    ["Лизинговая компания / техника", "6,5 млн ₽", "4,2 млн ₽", "210 тыс. ₽", "18,8%*", "Хорошее"],
    ["Банк В / овердрафт", "3,5 млн ₽", "1,3 млн ₽", "80 тыс. ₽", "22,8%", "Хорошее"],
    ["Банк Г / гарантия", "3,0 млн ₽", "0 ₽", "—", "3,2% комиссия", "Требований нет"],
], [39 * mm, 29 * mm, 25 * mm, 25 * mm, 20 * mm, 26 * mm], status_col=5))
story += [Spacer(1, 5 * mm), p("Платёжный календарь по действующим обязательствам", H2)]
story.append(data_table(["Месяц", "Основной долг и проценты", "Лизинг", "Всего", "Комментарий"], [
    ["Сентябрь 2026", "710 тыс. ₽", "210 тыс. ₽", "920 тыс. ₽", "Максимальная текущая нагрузка"],
    ["Октябрь 2026", "710 тыс. ₽", "210 тыс. ₽", "920 тыс. ₽", "Без изменения"],
    ["Ноябрь 2026", "700 тыс. ₽", "210 тыс. ₽", "910 тыс. ₽", "Снижение срочного кредита"],
    ["Декабрь 2026", "670 тыс. ₽", "210 тыс. ₽", "880 тыс. ₽", "Плановое снижение"],
    ["Январь 2027", "650 тыс. ₽", "210 тыс. ₽", "860 тыс. ₽", "Плановое снижение"],
    ["Февраль 2027", "620 тыс. ₽", "210 тыс. ₽", "830 тыс. ₽", "Плановое снижение"],
], [31 * mm, 49 * mm, 30 * mm, 28 * mm, 26 * mm]))
story += [Spacer(1, 6 * mm)]
story.append(data_table(["Сверка", "Выписки", "БКИ", "Результат"], [
    ["Средний ежемесячный платёж", "0,76 млн ₽", "0,92 млн ₽", "Для оценки принят полный платёж БКИ"],
    ["Количество обязательств", "4 распознано", "5 обязательств", "Гарантия добавлена в портфель"],
    ["Просрочка", "Не выявлена", "0 ₽", "Положительный сигнал"],
], [45 * mm, 34 * mm, 34 * mm, 51 * mm]))
story += [Spacer(1, 6 * mm), callout("Вывод по БКИ", "Качество обслуживания долга хорошее. Новый запрос допустим только с учётом платежа 0,92 млн ₽ в месяц. До подачи требуется приложить два отсутствующих графика и актуальные справки об остатках.", "green"), Spacer(1, 4 * mm)]
story.append(p("* Для лизинга показана расчётная эффективная стоимость в демонстрационных данных.", TINY))
story.append(PageBreak())

# 08 — Stops, readiness and limit
story += section("СТОП-ФАКТОРЫ И ЛИМИТ", "Что мешает подаче сейчас", "Критические стоп-факторы отсутствуют · четыре ограничения требуют действий")
story.append(data_table(["Приоритет", "Фактор", "Подтверждение", "Влияние", "Действие"], [
    ["1", "Прогнозный кассовый разрыв", "−1,15 млн ₽ в сентябре", "Риск переноса платежей", "Сформировать календарь и резервную линию"],
    ["2", "Концентрация покупателя", "TOP-1 — 32% поступлений", "Ограничивает верхний лимит", "Договор, акты и история оплат"],
    ["3", "Неполная сверка долга", "Разница 160 тыс. ₽ в месяц", "Снижает доступный новый платёж", "Добавить два графика и справки"],
    ["4", "Рост дебиторки", "31,8 → 37,6 млн ₽", "Деньги дольше остаются в расчётах", "Реестр TOP-10 и сроки погашения"],
    ["Контроль", "Арбитраж", "2 дела / 0,62 млн ₽", "Некритично на дату отчёта", "Обновить статус перед подачей"],
], [18 * mm, 38 * mm, 42 * mm, 34 * mm, 32 * mm]))
story += [Spacer(1, 7 * mm)]
story.append(kpis([
    ("Готовность", "78%", "Профиль близок к подаче", "warn"),
    ("Критические стопы", "0", "Отказной сигнал не выявлен", "good"),
    ("Условия до подачи", "4", "Документы и ликвидность", "warn"),
    ("Ожидаемый срок", "7–14 дней", "При оперативной загрузке", "neutral"),
]))
story += [Spacer(1, 8 * mm), p("Расчётный диапазон финансирования", H2)]
story.append(data_table(["Сценарий", "Сумма", "Условия", "Статус"], [
    ["Стресс-сценарий", "8,5 млн ₽", "Снижение поступлений на 12% и сохранение текущей нагрузки", "Допустимо"],
    ["Рабочий запрос", "9,8 млн ₽", "Закрыты 4 ограничения; без новых негативных событий", "Рекомендуется"],
    ["Верхняя граница", "11,0 млн ₽", "Подтверждён TOP-1 и календарь действующих контрактов", "Возможно"],
    ["Свыше диапазона", "> 11,0 млн ₽", "Потребуется обеспечение или дополнительный подтверждённый поток", "Не сейчас"],
], [38 * mm, 31 * mm, 66 * mm, 29 * mm], status_col=3))
story += [Spacer(1, 7 * mm), callout("Рекомендуемая сумма заявки", "9,8 млн ₽ на возобновляемую кредитную линию сроком до 24 месяцев. Ожидаемая дополнительная нагрузка при частичном использовании лимита — 0,18–0,28 млн ₽ в месяц.", "green"), Spacer(1, 4 * mm)]
story.append(p("До подачи должны быть загружены все 5 обязательств с графиками, документы TOP-1 заказчика, платёжный календарь на 8 недель и реестр TOP-10 дебиторов. Диапазон не является одобрением, офертой или обязательством кредитной организации.", SMALL))
story.append(PageBreak())

# 09 — Financing products
story += section("ПОДХОДЯЩЕЕ ФИНАНСИРОВАНИЕ", "Продукты под деятельность компании", "Предложения отобраны с учётом строительного цикла, контрактов, дебиторки, техники и действующего долга")
story.append(data_table(["Вид финансирования", "Ориентир", "Почему подходит", "Что потребуется", "Приоритет"], [
    ["Возобновляемая кредитная линия", "8,5–11,0 млн ₽", "Регулярные обороты и повторяющиеся закупки", "Выписки, БФО, БКИ, договоры", "Основной"],
    ["Контрактное финансирование", "6,0–9,0 млн ₽", "4 действующих контракта на 31,2 млн ₽", "Контракт, смета, календарь этапов", "Высокий"],
    ["Банковская гарантия", "3,0–6,0 млн ₽", "Подрядные и государственные контракты", "Закупочная документация и обеспечение", "Высокий"],
    ["Факторинг", "3,0–5,0 млн ₽", "Дебиторка 37,6 млн ₽ и платёжеспособные заказчики", "Договор, УПД, реестр поставок", "Дополнительный"],
    ["Лизинг техники", "4,0–7,0 млн ₽", "Строительная техника используется в деятельности", "Аванс и спецификация предмета", "Дополнительный"],
], [39 * mm, 28 * mm, 43 * mm, 36 * mm, 18 * mm], status_col=4))
story += [Spacer(1, 8 * mm), p("Рекомендуемая структура", H2)]
story.append(data_table(["Задача", "Инструмент", "Сумма", "Результат"], [
    ["Сгладить контрактные платежи", "Возобновляемая линия", "9,8 млн ₽", "Основной оборотный резерв"],
    ["Профинансировать контракт 12,4 млн ₽", "Контрактный кредит", "до 6,0 млн ₽", "Деньги привязаны к этапам работ"],
    ["Высвободить деньги из дебиторки", "Факторинг", "3,0–5,0 млн ₽", "Сокращение кассового цикла"],
    ["Обновить спецтехнику", "Лизинг", "4,0–7,0 млн ₽", "Сохранение оборотных средств"],
], [48 * mm, 42 * mm, 29 * mm, 45 * mm]))
story += [Spacer(1, 8 * mm), callout("Что не рекомендуется сейчас", "Необеспеченный запрос на 15 млн ₽, МФО и краудлендинг не являются приоритетными: сумма выше расчётного диапазона, а стоимость альтернативного финансирования не соответствует текущему качеству профиля.", "orange"), Spacer(1, 7 * mm)]
story.append(kpis([
    ("Основной продукт", "Кредитная линия", "Рабочий запрос 9,8 млн ₽", "good"),
    ("Параллельный маршрут", "Факторинг", "После проверки дебиторов", "neutral"),
    ("Под контракты", "Кредит + БГ", "По календарю этапов", "good"),
    ("На технику", "Лизинг", "Без изъятия всего оборота", "neutral"),
]))
story += [Spacer(1, 7 * mm), p("Названия конкретных кредитных организаций в публичном демонстрационном отчёте обезличены. Финальное решение, ставка, срок и обеспечение определяются выбранной организацией после рассмотрения заявки.", SMALL)]
story.append(PageBreak())

# 10 — Recommendations and final conclusion
story += section("РЕКОМЕНДАЦИИ", "План улучшения 7 / 30 / 60", "Конкретные действия, ожидаемый результат и контрольная метрика")
story.append(data_table(["Срок", "Что сделать", "Ожидаемый результат", "Контроль"], [
    ["7 дней", "Загрузить два кредитных графика и справки об остатках; добавить договор, акты и историю оплат TOP-1; собрать платёжный календарь на 8 недель; обновить статусы двух судебных дел.", "Полная долговая нагрузка, подтверждённый источник погашения и объяснённый кассовый разрыв.", "Готовность 88–92%; итоговый запрос 9,8 млн ₽"],
    ["30 дней", "Закрепить минимальный денежный резерв; согласовать с поставщиками даты платежей после поступлений по контрактам; завершить реестр TOP-10 дебиторов; обновить квартальную отчётность.", "Запас ликвидности 7–10 дней и меньше риска переноса обязательных платежей.", "Отсутствие отрицательного остатка в календаре"],
    ["60 дней", "Ускорить взыскание дебиторки; добавить новых заказчиков; перевести часть подтверждённой дебиторки в факторинг; не наращивать дорогой краткосрочный долг.", "Снижение концентрации, более короткий денежный цикл и устойчивый запас для следующего пересмотра лимита.", "TOP-1 около 27%; дебиторка начинает снижаться"],
], [23 * mm, 62 * mm, 51 * mm, 28 * mm]))
story += [Spacer(1, 8 * mm), p("Следующие действия в личном кабинете", H2)]
story.append(data_table(["Шаг", "Действие", "Статус"], [
    ["1", "Загрузить недостающие кредитные документы и обновить БКИ", "Обязательно"],
    ["2", "Добавить документы по крупнейшему заказчику и реестр дебиторки", "Обязательно"],
    ["3", "Сформировать платёжный календарь и повторить расчёт", "Обязательно"],
    ["4", "Выбрать кредитную линию 9,8 млн ₽ и 1–3 адресных маршрута", "После пересчёта"],
], [18 * mm, 111 * mm, 35 * mm], status_col=2))
story += [Spacer(1, 8 * mm), callout(
    "Итоговое заключение",
    "ООО «Альфа Строй» демонстрирует достаточный масштаб, устойчивые обороты и приемлемую кредитную дисциплину для подготовки заявки. Рекомендуемый рабочий запрос — 9,8 млн ₽ на возобновляемую кредитную линию. Контрактное финансирование, банковская гарантия, факторинг и лизинг могут использоваться как дополнительные инструменты. Подачу выполнить после закрытия четырёх ограничений; ожидаемый срок готовности — 7–14 дней.",
    "green",
), Spacer(1, 8 * mm)]
story.append(kpis([
    ("Индекс", "776 / 1000", "Итоговый класс B+", "good"),
    ("Готовность", "78% → 90%", "После выполнения плана", "warn"),
    ("Рабочий запрос", "9,8 млн ₽", "В диапазоне 8,5–11,0", "good"),
    ("Вердикт", "ГОТОВИТЬ", "Затем адресно подавать", "warn"),
]))
story += [Spacer(1, 8 * mm), callout("Что получает клиент", "Полный отчёт, обновления и пересчёты по одной компании в течение 30 дней входят в подписку 6 500 ₽. Новый несвязанный клиент требует отдельного доступа.", "blue"), Spacer(1, 7 * mm)]
story.append(p("Все данные в документе демонстрационные. ООО «Альфа Строй», ИНН, контрагенты, договоры, банки, кредитные обязательства и финансовые значения вымышлены. Отчёт показывает формат результата Prescore и не содержит сведений о реальном юридическом лице.", SMALL))

doc.build(story)
PUBLIC.write_bytes(OUTPUT.read_bytes())
print(OUTPUT)
print(PUBLIC)
