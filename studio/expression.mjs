// Only stock values from one normalized balance snapshot can enter this compiler.
// The dimension is a RUB exponent. Dates, rows from other periods and functions cannot be named.
export const FIELDS = Object.freeze({CURRENT_ASSETS:'Оборотные активы · 1200', SHORT_TERM_LIABILITIES:'Краткосрочные обязательства · 1500', INVENTORIES:'Запасы · 1210', CASH:'Денежные средства · 1250', RECEIVABLES:'Дебиторская задолженность · 1230'});
export const STANDARD = 'CURRENT_ASSETS / SHORT_TERM_LIABILITIES';
const invalid = message => { throw new Error(message); };
export function compileExpression(expression) {
  if (typeof expression !== 'string' || !expression.trim() || expression.length > 320) invalid('Длина выражения должна быть от 1 до 320 символов');
  const tokens = expression.match(/[A-Z][A-Z_0-9]*|(?:\d+(?:\.\d+)?|\.\d+)|[()+*/-]|[^\s]/g) || [];
  if (tokens.length > 80) invalid('Слишком сложное выражение');
  const fields = []; let cursor = 0;
  function atom(depth) {
    if (depth > 12) invalid('Слишком большая глубина скобок');
    const token = tokens[cursor++];
    if (token === '(') {
      const inner = parse(0, depth + 1);
      if (tokens[cursor++] !== ')') invalid('Нужна закрывающая скобка');
      return inner;
    }
    if (token === '-') { const inner = atom(depth + 1); return {dim:inner.dim, read:x=>-inner.read(x)}; }
    if (typeof token === 'string' && /^(?:\d+(?:\.\d+)?|\.\d+)$/.test(token)) {
      const n=Number(token); if (!Number.isFinite(n) || n>1e9) invalid('Недопустимое число');
      return {dim:0,read:()=>n};
    }
    if (!Object.hasOwn(FIELDS,token)) invalid('Неизвестное поле или операция: '+(token ?? 'конец выражения'));
    if (!fields.includes(token)) fields.push(token);
    const field=fields.indexOf(token);
    return {dim:1,read:x=>x[field]};
  }
  function parse(minimum, depth) {
    let a = atom(depth);
    while (cursor < tokens.length) {
      const op=tokens[cursor], priority=['+','-'].includes(op)?1:['*','/'].includes(op)?2:0;
      if (!priority || priority < minimum) break;
      cursor++;
      const b=parse(priority+1,depth), left=a;
      if (priority===1 && left.dim!==b.dim) invalid('Несовместимые единицы в сумме или разности');
      a={dim:priority===1?left.dim:op==='*'?left.dim+b.dim:left.dim-b.dim,read(values) {
        const x=left.read(values),y=b.read(values);
        if (op==='/' && y===0) throw new RangeError('ZERO_DENOMINATOR');
        return op==='+'?x+y:op==='-'?x-y:op==='*'?x*y:x/y;
      }};
    }
    return a;
  }
  const ast=parse(0,0);
  if (cursor!==tokens.length) invalid('Лишний символ: '+tokens[cursor]);
  if (ast.dim!==0 || !fields.length) invalid('Результат должен быть коэффициентом со ссылкой на строки баланса');
  return Object.freeze({expression,fields:Object.freeze(fields),evaluate:values=>ast.read(values)});
}
