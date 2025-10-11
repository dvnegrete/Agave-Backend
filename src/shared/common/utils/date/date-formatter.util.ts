/**
 * Utilidades para formatear fechas
 */

/**
 * Formatea un Date a DD/MM/YYYY
 * @param date - Objeto Date
 * @returns String en formato DD/MM/YYYY
 */
export function formatDateToDDMMYYYY(date: Date): string {
  const day = String(date.getDate()).padStart(2, '0');
  const month = String(date.getMonth() + 1).padStart(2, '0');
  const year = date.getFullYear();
  return `${day}/${month}/${year}`;
}

/**
 * Genera un código de confirmación único
 * Formato: YYYYMM-XXXXX (año + mes + 5 caracteres alfanuméricos)
 * @returns Código de confirmación
 * @example "202510-A7K2M"
 */
export function generateConfirmationCode(): string {
  const now = new Date();
  const year = now.getFullYear();
  const month = String(now.getMonth() + 1).padStart(2, '0');
  const random = Math.random().toString(36).substring(2, 7).toUpperCase();
  return `${year}${month}-${random}`;
}

/**
 * Nombres de meses en español
 */
export const MONTH_NAMES = [
  'Enero',
  'Febrero',
  'Marzo',
  'Abril',
  'Mayo',
  'Junio',
  'Julio',
  'Agosto',
  'Septiembre',
  'Octubre',
  'Noviembre',
  'Diciembre',
];

/**
 * Obtiene el nombre del mes en español
 * @param monthIndex - Índice del mes (0-11)
 * @returns Nombre del mes
 */
export function getMonthName(monthIndex: number): string {
  return MONTH_NAMES[monthIndex];
}
