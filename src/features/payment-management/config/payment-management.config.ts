/**
 * Configuración centralizada para gestión de pagos
 * Estos valores pueden ser sobreescritos por la base de datos (PeriodConfig)
 */
export const PaymentManagementConfig = {
  ENABLE_AI_PAYMENT_DISTRIBUTION: true,
  AI_CONFIDENCE_THRESHOLD: 'medium' as const,
  MAX_PERIODS_FOR_DISTRIBUTION: 12,
  DEFAULT_MAINTENANCE_AMOUNT: 800,
  DEFAULT_LATE_PENALTY_AMOUNT: 100,
} as const;
