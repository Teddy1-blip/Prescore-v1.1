export function validInn(value: string) {
  if (!/^\d{10}$|^\d{12}$/.test(value)) return false;
  const digits = value.split("").map(Number);
  const checksum = (weights: number[]) => weights.reduce((sum, weight, index) => sum + weight * digits[index], 0) % 11 % 10;
  if (digits.length === 10) return checksum([2, 4, 10, 3, 5, 9, 4, 6, 8]) === digits[9];
  return checksum([7, 2, 4, 10, 3, 5, 9, 4, 6, 8]) === digits[10]
    && checksum([3, 7, 2, 4, 10, 3, 5, 9, 4, 6, 8]) === digits[11];
}

export function invalidInnMessage(inn: string) {
  return /^\d{10}$|^\d{12}$/.test(inn)
    ? 'Контрольная цифра ИНН в досье неверна. Сверьте ИНН владельца счёта с исходной выпиской.'
    : 'Для проверки нужны 10 цифр ИНН организации или 12 цифр ИНН предпринимателя. Сверьте реквизиты в выписке.';
}
