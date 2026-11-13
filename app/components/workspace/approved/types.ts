export const pages = {
  home: ['Обзор', 'Ваша финансовая картина', 'Деньги, обязательства и следующий шаг'],
  banking: ['Финансы', 'Движение денег', 'От поступлений до конкретных платежей'],
  analysis: ['Кредитный профиль', 'Кредитный профиль', 'Выводы, их основания и ограничения'],
  obligations: ['Кредитный портфель', 'Кредитный портфель', 'Договоры, фактические выплаты и график'],
  counterparties: ['Контрагенты', 'Расчёты с покупателями', 'Дебиторка, сроки и рабочие договорённости'],
  financing: ['Финансирование', 'Финансирование бизнеса', 'От задачи до подготовленной заявки'],
  applications: ['Заявки', 'Ваши заявки', 'Документы, ответственные и следующий шаг'],
  documents: ['Документы', 'Данные компании', 'Периоды, источники и их согласованность'],
  actions: ['План действий', 'Что сделать дальше', 'Действия из анализа и задачи по расчётам'],
  billing: ['Подписка', 'Подписка компании', 'Доступ к рабочему пространству'],
} as const;
export type Page = keyof typeof pages;
export type Amount = number | null;
export type Row = {
  id: string;
  label: string;
  coverage?: string;
  incoming: Amount;
  outgoing: Amount;
  operating: Amount;
  debt: Amount;
  tax: Amount;
  net: Amount;
  parts?: number[];
  receipts?: number[];
};
export type Item = { title: string; detail: string };
export type CreditRiskItem = { id: string; status: 'GLOBAL_STOP' | 'CREDIT_RISK'; title: string; detail: string };
export type Task = Item & { id: string; route: Page; done?: boolean };
export type Category = { label: string; value: number; color: string };
export type AR = {
  asOf: string;
  total: number;
  advance: number;
  overdue: number;
  unclassified: number;
  rows: { id: string; name: string; amount: number; due: string; status: string; promise?: string }[];
};
export type Application = { id: string; product: string; amount: number; status: string; next: string };
export type ViewData = {
  company: string;
  period: string;
  asOf: string;
  plan: string;
  title: string;
  summary: string;
  score: Amount;
  scoreStatus: string;
  scoreExplanation?: string;
  components: { label: string; score: number; max: number }[];
  capacity: string;
  capacityText: string;
  opening: Amount;
  closing: Amount;
  closingDate: string;
  operating: Amount;
  incoming: Amount;
  outgoing: Amount;
  net: Amount;
  debt: Amount;
  debtDate: string;
  months: Row[];
  categories: Category[];
  tasks: Task[];
  factors: Item[];
  riskSummary: CreditRiskItem[] | null;
  products: Item[];
  bfo: string[][];
  hasBankBfo?: boolean;
  hasFinancialSource?: boolean;
  fiscalDate: string;
  obligations: string[][];
  sources: { label: string; date: string; status: string; route: Page }[];
  ar: AR | null;
};
const format = new Intl.NumberFormat('ru-RU', { maximumFractionDigits: 2 });
export const rub = (v: number) => format.format(v) + ' ₽';
export function money(value: Amount) {
  if (value === null) return '—';
  const cents = Math.round(value * 100);
  if (Math.abs(cents) >= 10000000 && cents % 1000000 === 0)
    return format.format(cents / 100000000) + ' млн ₽';
  return rub(value);
}
export const focusLabels = ['Собственник', 'Финансист', 'Бухгалтер'];
export const colorList = ['#7887db', '#a4b3ef', '#dfb05f', '#a08bd3', '#bfc9d8', '#e3e7ef'];
