export function parseDateFlexible(dateStr: string | Date): Date {
  if (!dateStr) {
    throw new Error('Fecha requerida');
  }

  if (dateStr instanceof Date) {
    return dateStr;
  }

  const trimmed = dateStr.toString().trim();

  // Formato español corto: DD/mmm/YY (ej: 31/jul/25)
  const spanishMonthPattern = /^(\d{1,2})\/(ene|feb|mar|abr|may|jun|jul|ago|sep|oct|nov|dic)\/(\d{2,4})$/i;
  const match = trimmed.toLowerCase().match(spanishMonthPattern);
  if (match) {
    const [, day, month, year] = match;
    const monthMap: { [key: string]: number } = {
      ene: 0,
      feb: 1,
      mar: 2,
      abr: 3,
      may: 4,
      jun: 5,
      jul: 6,
      ago: 7,
      sep: 8,
      oct: 9,
      nov: 10,
      dic: 11,
    };
    const monthIndex = monthMap[month as string];
    const dayNum = parseInt(day as string, 10);
    const yearNum = parseInt(year as string, 10);
    const fullYear = yearNum < 100 ? 2000 + yearNum : yearNum;
    const date = new Date(fullYear, monthIndex, dayNum);
    if (!isNaN(date.getTime())) return date;
  }

  // Formato DD/MM/YYYY o DD/MM/YY
  const datePattern = /^(\d{1,2})\/(\d{1,2})\/(\d{2,4})$/;
  const dateMatch = trimmed.match(datePattern);
  if (dateMatch) {
    const [, day, month, year] = dateMatch;
    const dayNum = parseInt(day, 10);
    const monthNum = parseInt(month, 10) - 1;
    const yearNum = parseInt(year, 10);
    const fullYear = yearNum < 100 ? 2000 + yearNum : yearNum;
    const date = new Date(fullYear, monthNum, dayNum);
    if (!isNaN(date.getTime())) return date;
  }

  // Formato YYYY-MM-DD
  const isoPattern = /^(\d{4})-(\d{1,2})-(\d{1,2})$/;
  const isoMatch = trimmed.match(isoPattern);
  if (isoMatch) {
    const [, year, month, day] = isoMatch;
    const date = new Date(parseInt(year, 10), parseInt(month, 10) - 1, parseInt(day, 10));
    if (!isNaN(date.getTime())) return date;
  }

  const native = new Date(trimmed);
  if (!isNaN(native.getTime())) return native;

  throw new Error(`Formato de fecha inválido: ${dateStr}`);
}

export function parseAmountFlexible(amountInput: string | number): number {
  if (amountInput === null || amountInput === undefined || amountInput === '') {
    throw new Error('Monto requerido');
  }
  if (typeof amountInput === 'number') {
    return amountInput;
  }
  const strAmount = amountInput.toString();
  const cleanAmount = strAmount.replace(/[^\d.,-]/g, '');
  const amount = parseFloat(cleanAmount.replace(',', '.'));
  if (isNaN(amount)) {
    throw new Error(`Monto inválido: ${amountInput}`);
  }
  return amount;
}

export function parseBooleanFlexible(value: any): boolean {
  if (typeof value === 'boolean') return value;
  if (!value) throw new Error('Valor booleano requerido');
  const lower = value.toString().toLowerCase().trim();
  if (['true', '1', 'yes', 'si', 'sí', 'deposit', 'deposito', 'ingreso', 'abono'].includes(lower)) return true;
  if (['false', '0', 'no', 'withdrawal', 'retiro', 'gasto', 'cargo'].includes(lower)) return false;
  throw new Error(`Valor booleano inválido: ${value}`);
}


