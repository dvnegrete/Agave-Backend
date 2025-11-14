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
   * Habilita matching por análisis de concepto
   * Utiliza regex y servicios de IA para extraer número de casa
   */
  ENABLE_CONCEPT_MATCHING: true,

  /**
   * Confianza mínima requerida para considerar un match por concepto como válido
   * Valores: 'high' | 'medium' | 'low'
   */
  CONCEPT_MATCHING_MIN_CONFIDENCE: 'medium' as const,

  /**
   * Habilita análisis de concepto con IA cuando regex no es concluyente
   */
  ENABLE_AI_CONCEPT_ANALYSIS: true,

  /**
   * Umbral de similitud para escalar a validación manual
   * Si la diferencia entre el mejor y segundo mejor candidato es < 5% → validación manual
   * Evita decisiones automáticas cuando hay múltiples opciones muy similares
   */
  SIMILARITY_THRESHOLD: 0.05,

  /**
   * Habilita validación manual para casos ambiguos
   * Cuando hay múltiples vouchers válidos candidatos
   */
  ENABLE_MANUAL_VALIDATION: true,

  /**
   * Meses del año en español (para identificar en conceptos)
   */
  MONTHS_ES: [
    'enero',
    'febrero',
    'marzo',
    'abril',
    'mayo',
    'junio',
    'julio',
    'agosto',
    'septiembre',
    'octubre',
    'noviembre',
    'diciembre',
  ],
};

/**
 * Patrones regex para extraer número de casa del concepto
 * Ordenados por especificidad (más específicos primero)
 */
export const CONCEPT_HOUSE_PATTERNS = [
  // Patrones con palabra "casa" explícita
  { pattern: /casa\s*[#-]?\s*(\d{1,2})/gi, name: 'casa_numero', confidence: 'high' as const },
  { pattern: /casa\s+(\d{1,2})/gi, name: 'casa_numero_espacio', confidence: 'high' as const },

  // Abreviaturas: c5, c50, c64, c-1, cs02, etc.
  { pattern: /\bc\s*-?(\d{1,2})(?:\b|[^0-9])/gi, name: 'c_abbreviation', confidence: 'high' as const },
  { pattern: /\bc([0-9])/gi, name: 'c_single_digit', confidence: 'high' as const },
  { pattern: /\bcs\s*-?(\d{1,2})/gi, name: 'cs_abbreviation', confidence: 'medium' as const },

  // Apartamento
  { pattern: /apto\s*[#.-]?\s*(\d{1,2})/gi, name: 'apto_numero', confidence: 'high' as const },
  { pattern: /apt\s*[#.-]?\s*(\d{1,2})/gi, name: 'apt_numero', confidence: 'high' as const },
  { pattern: /apart\s*[#.-]?\s*(\d{1,2})/gi, name: 'apart_numero', confidence: 'high' as const },

  // Lote, Manzana, Propiedad
  { pattern: /lote\s*[#.-]?\s*(\d{1,2})/gi, name: 'lote_numero', confidence: 'medium' as const },
  { pattern: /manzana\s*[#.-]?\s*(\d{1,2})/gi, name: 'manzana_numero', confidence: 'medium' as const },
  { pattern: /propiedad\s*[#.-]?\s*(\d{1,2})/gi, name: 'propiedad_numero', confidence: 'medium' as const },

  // Número aislado al inicio (menos confiable)
  { pattern: /^(\d{1,2})(?:\s|$)/i, name: 'leading_number', confidence: 'low' as const },
];
