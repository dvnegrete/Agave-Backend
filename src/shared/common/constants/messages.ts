/**
 * Mensajes centralizados para el sistema
 * Estos strings se usan en diferentes partes del sistema
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
] as const;

export const HOUSE_STATUS_MESSAGES = {
  MOROSA: (unpaidCount: number, nextDueDate: string): string =>
    `Casa morosa con ${unpaidCount} periodo(s) sin pagar. Siguiente fecha limite: ${nextDueDate}`,
  AL_DIA: (nextDueDate: string): string =>
    `Al corriente. Siguiente fecha limite de pago: ${nextDueDate}`,
  SALDO_A_FAVOR: (nextDueDate: string): string =>
    `Saldo a favor disponible. Siguiente fecha limite de pago: ${nextDueDate}`,
} as const;

export const PENALTY_MESSAGES = {
  DESCRIPTION_TEMPLATE: (periodId: number): string =>
    `Penalidad por pago tardio - Periodo ${periodId}`,
} as const;
