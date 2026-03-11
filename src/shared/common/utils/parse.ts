/**
 * Parsea una fecha desde múltiples formatos y valida rango de años
 * @param dateStr - Fecha como string o Date object
 * @param options - Opciones de validación (minYear, maxYear)
 * @returns Date object validado
 * @throws Error si la fecha es inválida o está fuera del rango permitido
 *
 * Formatos soportados:
 * - DD/mmm/YY (ej: 31/jul/25, 15/abr/2025)
 * - DD/MM/YYYY o DD/MM/YY (ej: 31/12/2025)
 * - YYYY-MM-DD (ej: 2025-12-31)
 * - Formatos nativos de JavaScript (ej: 2025-12-31T00:00:00Z)
 *
 * Conversión de años de 2 dígitos:
 * - 00-99 → 2000-2099
 *
 * Validación de rango:
 * - Por defecto: 1950-2100
 * - Se rechaza cualquier año fuera del rango especificado
 */
export function parseDateFlexible(
  dateStr: string | Date,
  options?: { minYear?: number; maxYear?: number },
): Date {
  const minYear = options?.minYear ?? 1950;
  const maxYear = options?.maxYear ?? 2100;

  if (!dateStr) {
    throw new Error('Fecha requerida');
  }

  if (dateStr instanceof Date) {
    const year = dateStr.getFullYear();
    if (year < minYear || year > maxYear) {
      throw new Error(
        `Año ${year} está fuera del rango permitido (${minYear}-${maxYear})`,
      );
    }
    return dateStr;
  }

  const trimmed = dateStr.toString().trim();

  // Helper function para validar año
  const validateYear = (year: number): void => {
    if (year < minYear || year > maxYear) {
      throw new Error(
        `Año ${year} está fuera del rango permitido (${minYear}-${maxYear})`,
      );
    }
  };

  // Helper function para crear Date y validar
  const createValidatedDate = (
    fullYear: number,
    month: number,
    day: number,
  ): Date => {
    validateYear(fullYear);
    const date = new Date(fullYear, month, day);
    if (isNaN(date.getTime())) {
      throw new Error(`Fecha inválida: ${dateStr}`);
    }
    return date;
  };

  // Formato español corto: DD/mmm/YY (ej: 31/jul/25)
  const spanishMonthPattern =
    /^(\d{1,2})\/(ene|feb|mar|abr|may|jun|jul|ago|sep|oct|nov|dic)\/(\d{2,4})$/i;
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
    const monthIndex = monthMap[month];
    const dayNum = parseInt(day, 10);
    const yearNum = parseInt(year, 10);
    const fullYear = yearNum < 100 ? 2000 + yearNum : yearNum;
    return createValidatedDate(fullYear, monthIndex, dayNum);
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
    return createValidatedDate(fullYear, monthNum, dayNum);
  }

  // Formato YYYY-MM-DD
  const isoPattern = /^(\d{4})-(\d{1,2})-(\d{1,2})$/;
  const isoMatch = trimmed.match(isoPattern);
  if (isoMatch) {
    const [, year, month, day] = isoMatch;
    const yearNum = parseInt(year, 10);
    const monthNum = parseInt(month, 10) - 1;
    const dayNum = parseInt(day, 10);
    return createValidatedDate(yearNum, monthNum, dayNum);
  }

  // Último intento: Usar parser nativo de JavaScript
  const native = new Date(trimmed);
  if (!isNaN(native.getTime())) {
    const year = native.getFullYear();
    if (year < minYear || year > maxYear) {
      throw new Error(
        `Año ${year} está fuera del rango permitido (${minYear}-${maxYear})`,
      );
    }
    return native;
  }

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

export function parseAmountWithSign(amountInput: string | number): {
  amount: number;
  isNegative: boolean;
} {
  if (amountInput === null || amountInput === undefined || amountInput === '') {
    throw new Error('Monto requerido');
  }

  let isNegative = false;
  let numericValue: number;

  if (typeof amountInput === 'number') {
    numericValue = amountInput;
    isNegative = amountInput < 0;
  } else {
    const strAmount = amountInput.toString().trim();
    isNegative = strAmount.startsWith('-') || strAmount.startsWith('(');
    const cleanAmount = strAmount.replace(/[^\d.,-]/g, '');
    numericValue = parseFloat(cleanAmount.replace(',', '.'));

    if (isNaN(numericValue)) {
      throw new Error(`Monto inválido: ${amountInput}`);
    }
  }

  return {
    amount: Math.abs(numericValue),
    isNegative,
  };
}

export function parseBooleanFlexible(value: any): boolean {
  if (typeof value === 'boolean') return value;
  if (!value) throw new Error('Valor booleano requerido');
  const lower = value.toString().toLowerCase().trim();
  if (
    [
      'true',
      '1',
      'yes',
      'si',
      'sí',
      'deposit',
      'deposito',
      'ingreso',
      'abono',
    ].includes(lower)
  )
    return true;
  if (
    ['false', '0', 'no', 'withdrawal', 'retiro', 'gasto', 'cargo'].includes(
      lower,
    )
  )
    return false;
  throw new Error(`Valor booleano inválido: ${value}`);
}
