import { BusinessValues } from '@/shared/content/config/business-values.config';

/**
 * ⚠️ DEPRECATED: Use BusinessValues from @/shared/content/config/business-values.config
 *
 * Este archivo se mantiene SOLO para backwards compatibility durante transición.
 * Todos los valores se han migrado a BusinessValues.payments (fuente única de verdad).
 *
 * RAZÓN DE MANTENCIÓN:
 * - Evitar quiebre de imports en código existente durante refactoring
 * - Permitir transición gradual sin cambios masivos en una sola PR
 *
 * ACCIÓN REQUERIDA:
 * Reemplazar imports en código existente:
 *   // ANTES (deprecado):
 *   import { PaymentManagementConfig } from '@/features/payment-management/config/payment-management.config'
 *   const value = PaymentManagementConfig.DEFAULT_MAINTENANCE_AMOUNT
 *
 *   // DESPUÉS (correcto):
 *   import { BusinessValues } from '@/shared/content/config/business-values.config'
 *   const value = BusinessValues.payments.defaultMaintenanceAmount
 *
 * Este archivo será ELIMINADO en la próxima refactoración de configuración.
 */
export const PaymentManagementConfig = {
  ENABLE_AI_PAYMENT_DISTRIBUTION: BusinessValues.payments.enableAiPaymentDistribution,
  AI_CONFIDENCE_THRESHOLD: BusinessValues.payments.aiConfidenceThreshold,
  MAX_PERIODS_FOR_DISTRIBUTION: BusinessValues.payments.maxPeriodsForDistribution,
  DEFAULT_MAINTENANCE_AMOUNT: BusinessValues.payments.defaultMaintenanceAmount,
  DEFAULT_WATER_AMOUNT: BusinessValues.payments.defaultWaterAmount,
  DEFAULT_EXTRAORDINARY_FEE_AMOUNT: BusinessValues.payments.defaultExtraordinaryFeeAmount,
  DEFAULT_LATE_PENALTY_AMOUNT: BusinessValues.payments.defaultLatePenaltyAmount,
} as const;
