import { useRef, useState, type FormEvent } from 'react';
import { Drawer } from './primitives';
export type RequestInput = { product: string; amount: number; next: string };
export function ApplicationForm({
  company,
  close,
  save,
  product,
}: {
  company: string;
  product?: string;
  close: () => void;
  save: (d: RequestInput) => Promise<void>;
}) {
  const choices = [
    'Пополнение оборотных средств',
    'Исполнение контракта',
    'Факторинг',
    'Лизинг',
    'Рефинансирование',
    'Другая цель',
  ];
  if (product && !choices.includes(product)) choices.unshift(product);
  const [busy, setBusy] = useState(false),
    [error, setError] = useState('');
  const pending = useRef(false);
  async function submit(e: FormEvent<HTMLFormElement>) {
    e.preventDefault();
    if (pending.current) return;
    const form = new FormData(e.currentTarget);
    const amount = Number(form.get('amount'));
    if (!Number.isSafeInteger(amount) || amount <= 0) return;
    pending.current = true;
    setBusy(true);
    setError('');
    try {
      await save({
        product: String(form.get('product')),
        amount,
        next: String(form.get('next') || 'Проверить комплект документов'),
      });
      close();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Сохранение не подтверждено.');
    } finally {
      pending.current = false;
      setBusy(false);
    }
  }
  return (
    <Drawer title="Подготовить заявку" company={company} close={close}>
      <p className="note">Черновик в кабинете компании. Отправка кредитору оформляется отдельно.</p>
      <form onSubmit={submit}>
        <fieldset disabled={busy}>
          <label className="formfield">
            Цель / продукт
            <select name="product" defaultValue={product} required>
              {choices.map((s) => (
                <option key={s}>{s}</option>
              ))}
            </select>
          </label>
          <label className="formfield">
            Сумма, ₽<input name="amount" type="number" step="1" min="1" max="1000000000000" required />
          </label>
          <label className="formfield">
            Следующий шаг
            <input name="next" maxLength={160} placeholder="Что подготовить и к какой дате" />
          </label>
          <button className="btn primary">{busy ? 'Сохраняем…' : 'Сохранить черновик'}</button>
        </fieldset>
        {error && <p role="alert">{error}</p>}
      </form>
    </Drawer>
  );
}
