/**
 * Utilidades para cálculos de diferencias de fecha y hora
 */

import { combineDateAndTime, parseTimeString } from './date-parser.util';

/**
 * Calcula la diferencia en horas entre dos fechas/horas
 * @param date1 Primera fecha (Date o string)
 * @param time1 Primera hora (string HH:MM:SS)
 * @param date2 Segunda fecha (Date o string)
 * @param time2 Segunda hora (string HH:MM:SS opcional, si date2 ya es Date con hora)
 * @returns Diferencia en horas (valor absoluto, redondeado a 2 decimales)
 */
export function getDateDifferenceInHours(
  date1: Date | string,
  time1: string,
  date2: Date | string,
  time2?: string,
): number {
  let dateTime1: Date;
  let dateTime2: Date;

  // Convertir date1 y time1 a Date
  if (typeof date1 === 'string') {
    dateTime1 = combineDateAndTime(date1, time1);
  } else {
    // Si es Date, combinar con time1
    const { hours, minutes, seconds } = parseTimeString(time1);
    dateTime1 = new Date(date1);
    dateTime1.setHours(hours, minutes, seconds, 0);
  }

  // Convertir date2 (con o sin time2) a Date
  if (typeof date2 === 'string') {
    dateTime2 = time2 ? combineDateAndTime(date2, time2) : new Date(date2);
  } else {
    // date2 ya es Date
    dateTime2 = date2;
  }

  // Calcular diferencia en milisegundos
  const diffMs = Math.abs(dateTime1.getTime() - dateTime2.getTime());

  // Convertir a horas y redondear a 2 decimales
  const diffHours = diffMs / (1000 * 60 * 60);

  return Math.round(diffHours * 100) / 100;
}

/**
 * Extrae el número de casa de los centavos de un monto
 * @param amount Monto numérico (ej: 500.15)
 * @returns Número de casa (15) o 0 si no hay centavos
 *
 * @example
 * extractHouseNumberFromCents(500.15) // returns 15
 * extractHouseNumberFromCents(500.00) // returns 0
 * extractHouseNumberFromCents(500.05) // returns 5
 */
export function extractHouseNumberFromCents(amount: number): number {
  const cents = Math.round((amount % 1) * 100);
  return cents;
}
