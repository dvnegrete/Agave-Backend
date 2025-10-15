/**
 * Configuración para el proceso de conciliación bancaria
 *
 * IMPORTANTE: Estos valores NO deben estar en variables de entorno.
 * Son configuraciones específicas del feature de conciliación.
 */
export const ReconciliationConfig = {
  /**
   * Tolerancia de fecha/hora en horas
   * Permite hasta ±36 horas de diferencia entre voucher y transacción bancaria
   */
  DATE_TOLERANCE_HOURS: 36,

  /**
   * Tolerancia de tiempo en minutos (para comparaciones más precisas)
   */
  TIME_TOLERANCE_MINUTES: 30,

  /**
   * Requiere voucher obligatorio cuando no hay centavos identificables
   */
  REQUIRE_VOUCHER_FOR_NO_CENTS: true,

  /**
   * Número máximo de casas en el proyecto
   */
  MAX_HOUSE_NUMBER: 66,

  /**
   * Umbral de similitud para considerar matches automáticos
   * Valor entre 0 y 1 (0.9 = 90% de similitud)
   */
  AUTO_MATCH_SIMILARITY_THRESHOLD: 0.95,

  /**
   * TODO: Implementar validación por concepto usando servicios de IA
   * cuando se llegue a evaluar por concepto, usar IA para buscar
   * palabras clave que indiquen a qué casa corresponde el pago
   */
  ENABLE_CONCEPT_MATCHING: false, // Por ahora deshabilitado
};
