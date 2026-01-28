/**
 * Utilidades para cálculos de diferencias de fecha y hora
 */

import { combineDateAndTime, parseTimeString } from './date-parser.util';

/**
 * Calcula la diferencia en horas entre dos fechas/horas
 *
 * - Si date2 (voucher) tiene hora 12:00:00, se asume que fue asignada automáticamente
 * - En ese caso, ignora la hora y solo compara fechas (día completo)
 * - Esto evita penalizar vouchers sin hora extraída del comprobante
 *
 * @param date1 Primera fecha (Date o string) - Transacción bancaria
 * @param time1 Primera hora (string HH:MM:SS) - Hora de transacción
 * @param date2 Segunda fecha (Date o string) - Voucher
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

  // Detectar si voucher (date2) tiene hora 12:00:00 (asignada automáticamente)
  const voucherTime =
    date2 instanceof Date
      ? `${date2.getHours().toString().padStart(2, '0')}:${date2.getMinutes().toString().padStart(2, '0')}:${date2.getSeconds().toString().padStart(2, '0')}`
      : null;
  const isAutoAssignedTime = voucherTime === '12:00:00';

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

  // Si voucher tiene hora 12:00:00, comparar solo fechas (ignorar hora)
  if (isAutoAssignedTime) {
    // Normalizar ambas fechas a medianoche para comparar solo día
    const date1Only = new Date(dateTime1);
    date1Only.setHours(0, 0, 0, 0);

    const date2Only = new Date(dateTime2);
    date2Only.setHours(0, 0, 0, 0);

    // Calcular diferencia en días completos (convertido a horas)
    const diffMs = Math.abs(date1Only.getTime() - date2Only.getTime());
    const diffHours = diffMs / (1000 * 60 * 60);

    return Math.round(diffHours * 100) / 100;
  }

  const diffMs = Math.abs(dateTime1.getTime() - dateTime2.getTime());

  // Convertir a horas y redondear a 2 decimales
  const diffHours = diffMs / (1000 * 60 * 60);

  return Math.round(diffHours * 100) / 100;
}

/**
 * Extrae el número de casa de los centavos de un monto
 * @param amount Monto numérico (ej: 500.15)
 * @returns Número de centavos extraído (0-99), requiere validación posterior
 *
 * @example
 * extractHouseNumberFromCents(500.15) // returns 15 (✅ válido si está en rango)
 * extractHouseNumberFromCents(500.00) // returns 0 (❌ inválido - requiere validación) 
 * @see isValidHouseNumber() - usar para validar el resultado
 */
export function extractHouseNumberFromCents(amount: number): number {
  const cents = Math.round((amount % 1) * 100);
  return cents;
}
