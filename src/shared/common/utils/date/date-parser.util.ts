/**
 * Utilidades para parsear fechas en diferentes formatos
 */

export interface ParsedDate {
  year: number;
  month: number;
  day: number;
}

/**
 * Parsea una fecha en formato DD/MM/YYYY, DD-MM-YYYY o YYYY-MM-DD
 * @param dateString - Fecha como string
 * @returns Objeto con año, mes y día parseados
 * @throws Error si el formato no es válido
 */
export function parseDateString(dateString: string): ParsedDate {
  let year: number, month: number, day: number;

  if (dateString.includes('/')) {
    const parts = dateString.split('/');
    if (parts[0].length === 4) {
      // Formato YYYY/MM/DD
      [year, month, day] = parts.map(Number);
    } else {
      // Formato DD/MM/YYYY
      [day, month, year] = parts.map(Number);
    }
  } else if (dateString.includes('-')) {
    const parts = dateString.split('-');
    if (parts[0].length === 4) {
      // Formato YYYY-MM-DD
      [year, month, day] = parts.map(Number);
    } else {
      // Formato DD-MM-YYYY
      [day, month, year] = parts.map(Number);
    }
  } else {
    throw new Error('Formato de fecha no válido');
  }

  return { year, month, day };
}

/**
 * Parsea una hora en formato HH:MM o HH:MM:SS
 * @param timeString - Hora como string
 * @returns Objeto con horas, minutos y segundos
 */
export function parseTimeString(timeString: string): {
  hours: number;
  minutes: number;
  seconds: number;
} {
  const timeParts = timeString.split(':').map(Number);
  return {
    hours: timeParts[0] || 0,
    minutes: timeParts[1] || 0,
    seconds: timeParts[2] || 0,
  };
}

/**
 * Combina una fecha y hora en un objeto Date
 * @param dateString - Fecha en formato DD/MM/YYYY o YYYY-MM-DD
 * @param timeString - Hora en formato HH:MM o HH:MM:SS
 * @returns Date object con fecha y hora combinadas
 */
export function combineDateAndTime(
  dateString: string,
  timeString: string,
): Date {
  const { year, month, day } = parseDateString(dateString);
  const { hours, minutes, seconds } = parseTimeString(timeString);

  // Crear Date object (month es 0-indexed en JavaScript)
  return new Date(year, month - 1, day, hours, minutes, seconds);
}
