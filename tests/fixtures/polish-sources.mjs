import {zipSync,strToU8} from 'fflate';
import {syntheticPdf} from '../../scripts/release/pdf-fixture.mjs';
export function financialText(inn,{period='2025 год',revenue=1200,profit=120,scale='тыс. руб.'}={}){return `Бухгалтерская отчетность за ${period}
Организация ООО Синтетическая компания
ИНН ${inn}
Единица измерения: ${scale}
Внеоборотные активы 1100 100
Оборотные активы 1200 900
Запасы 1210 200
Дебиторская задолженность 1230 400
Денежные средства 1250 300
БАЛАНС актив 1600 1000
Капитал и резервы 1300 600
Долгосрочные обязательства 1400 100
Заемные средства 1410 100
Краткосрочные обязательства 1500 300
Заемные средства 1510 100
Кредиторская задолженность 1520 200
БАЛАНС пассив 1700 1000
Выручка 2110 ${revenue}
Прибыль от продаж 2200 200
Проценты к уплате 2330 20
Чистая прибыль 2400 ${profit}`;}
export function financialFile(inn,ext='csv',options={}){const text=financialText(inn,options);const bytes=ext==='pdf'?syntheticPdf(text.split('\n')):ext==='xlsx'?zipSync({'xl/worksheets/sheet1.xml':strToU8('<worksheet><sheetData>'+text.split('\n').map((line,i)=>`<row r="${i+1}"><c t="inlineStr"><is><t>${line}</t></is></c></row>`).join('')+'</sheetData></worksheet>')}):text;return new File([bytes],'financial.'+ext);}
export function bkiFile(inn){return new File([syntheticPdf(['Субъект: Кредитная история юридического лица','ИНН','Номер',inn,'Сводка Счета','Все счета Всего: 0','При наличии вопросов обратитесь в НБКИ','Предоставлен 02-08-2026'])],'credit-history.pdf',{type:'application/pdf'});}
