/**
 * Constantes relacionadas con pagos y configuración financiera
 */

export const PAYMENT_DEFAULTS = {
  DEFAULT_MAINTENANCE_AMOUNT: 800,
  DEFAULT_LATE_PENALTY_AMOUNT: 100,
  DEFAULT_PAYMENT_DUE_DAY: 15,
} as const;

export const PAYMENT_ALLOCATION = {
  CONCEPT_TYPE_MAINTENANCE: 'maintenance',
} as const;
