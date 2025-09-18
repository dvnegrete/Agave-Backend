// Context-aware date parser that handles different default formats based on file type
export function parseContextualDate(
  dateStr: string | Date,
  preferredFormat: 'MM/DD' | 'DD/MM' = 'MM/DD',
): Date {
  if (!dateStr) {
    throw new Error('Fecha requerida');
  }

  if (dateStr instanceof Date) {
    return dateStr;
  }

  const trimmed = dateStr.toString().trim();

  // Handle Spanish month format first: DD/mmm/YY (ej: 31/jul/25)
  const spanishMonthPattern =
    /^(\d{1,2})\/(ene|feb|mar|abr|may|jun|jul|ago|sep|oct|nov|dic)\/(\d{2,4})$/i;
  const spanishMatch = trimmed.toLowerCase().match(spanishMonthPattern);
  if (spanishMatch) {
    const [, day, month, year] = spanishMatch;
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
    const date = new Date(fullYear, monthIndex, dayNum);
    if (!isNaN(date.getTime())) return date;
  }

  // Try to detect the format based on date components
  const slashPattern = /^(\d{1,2})\/(\d{1,2})\/(\d{2,4})$/;
  const slashMatch = trimmed.match(slashPattern);
  if (slashMatch) {
    const [, first, second, year] = slashMatch;
    const firstNum = parseInt(first, 10);
    const secondNum = parseInt(second, 10);
    const yearNum = parseInt(year, 10);
    const fullYear =
      yearNum < 100
        ? yearNum < 50
          ? 2000 + yearNum
          : 1900 + yearNum
        : yearNum;

    // Heuristic to determine MM/DD vs DD/MM format:
    // If first number > 12, it must be DD/MM format
    // If second number > 12, it must be MM/DD format
    // Otherwise, use the preferred format based on file type

    let monthNum: number;
    let dayNum: number;

    if (firstNum > 12) {
      // First number > 12, must be DD/MM format
      dayNum = firstNum;
      monthNum = secondNum - 1; // Month is 0-indexed
    } else if (secondNum > 12) {
      // Second number > 12, must be MM/DD format
      monthNum = firstNum - 1; // Month is 0-indexed
      dayNum = secondNum;
    } else {
      // Ambiguous case (both <= 12), use preferred format based on file type
      if (preferredFormat === 'MM/DD') {
        // CSV default: MM/DD format
        monthNum = firstNum - 1; // Month is 0-indexed
        dayNum = secondNum;
      } else {
        // XLSX default: DD/MM format
        dayNum = firstNum;
        monthNum = secondNum - 1; // Month is 0-indexed
      }
    }

    // Validate ranges
    if (monthNum >= 0 && monthNum <= 11 && dayNum >= 1 && dayNum <= 31) {
      const date = new Date(fullYear, monthNum, dayNum);
      if (!isNaN(date.getTime()) && date.getDate() === dayNum) {
        return date;
      }
    }

    // If the preferred format failed and it was ambiguous, try the alternative
    if (firstNum <= 12 && secondNum <= 12) {
      let altMonthNum: number;
      let altDayNum: number;

      if (preferredFormat === 'MM/DD') {
        // Try DD/MM as fallback
        altDayNum = firstNum;
        altMonthNum = secondNum - 1;
      } else {
        // Try MM/DD as fallback
        altMonthNum = firstNum - 1;
        altDayNum = secondNum;
      }

      if (
        altMonthNum >= 0 &&
        altMonthNum <= 11 &&
        altDayNum >= 1 &&
        altDayNum <= 31
      ) {
        const altDate = new Date(fullYear, altMonthNum, altDayNum);
        if (!isNaN(altDate.getTime()) && altDate.getDate() === altDayNum) {
          return altDate;
        }
      }
    }
  }

  // Try YYYY-MM-DD format (ISO standard)
  const isoPattern = /^(\d{4})-(\d{1,2})-(\d{1,2})$/;
  const isoMatch = trimmed.match(isoPattern);
  if (isoMatch) {
    const [, year, month, day] = isoMatch;
    const date = new Date(
      parseInt(year, 10),
      parseInt(month, 10) - 1,
      parseInt(day, 10),
    );
    if (!isNaN(date.getTime())) {
      return date;
    }
  }

  // Fallback to native Date parsing
  const native = new Date(trimmed);
  if (!isNaN(native.getTime())) {
    return native;
  }

  throw new Error(`Formato de fecha inválido: ${dateStr}`);
}
