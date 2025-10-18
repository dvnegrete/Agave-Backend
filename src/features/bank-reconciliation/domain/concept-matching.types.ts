/**
 * Tipos y interfaces para análisis y matching de conceptos bancarios
 */

/**
 * Resultado de extracción de número de casa del concepto
 */
export interface ConceptHouseExtractionResult {
  /**
   * Número de casa identificado (1-66) o null si no se encontró
   */
  houseNumber: number | null;

  /**
   * Nivel de confianza de la extracción
   */
  confidence: 'high' | 'medium' | 'low' | 'none';

  /**
   * Método usado para extraer: 'regex' o 'ai'
   */
  method: 'regex' | 'ai' | 'none';

  /**
   * Nombre del patrón que coincidió (si aplica)
   */
  patternName?: string;

  /**
   * Explicación breve del resultado
   */
  reason: string;

  /**
   * Información de mes si se identifica en el concepto
   */
  month?: {
    monthNumber: number;
    monthName: string;
    reason: string;
  };

  /**
   * Tipo de pago identificado en el concepto (si aplica)
   */
  paymentType?: {
    type: string; // e.g., "mantenimiento", "agua", "luz", etc.
    reason: string;
  };
}

/**
 * Resultado del análisis de concepto con IA
 */
export interface AIConceptAnalysisResult {
  /**
   * Número de casa identificado
   */
  houseNumber: number | null;

  /**
   * Confianza de la IA (0-1)
   */
  confidence: number;

  /**
   * Razonamiento de la IA
   */
  reasoning: string;

  /**
   * Información del mes si se identifica
   */
  month?: number;

  /**
   * Tipo de pago identificado
   */
  paymentType?: string;

  /**
   * Palabras clave encontradas
   */
  keywords?: string[];
}

/**
 * Request para análisis de concepto con IA
 */
export interface ConceptAnalysisRequest {
  /**
   * El concepto a analizar
   */
  concept: string;

  /**
   * Monto de la transacción (para contexto)
   */
  amount?: number;

  /**
   * Rango válido de números de casa
   */
  houseNumberRange?: {
    min: number;
    max: number;
  };
}

/**
 * Información consolidada de un match por concepto
 */
export interface ConceptMatchInfo {
  /**
   * Transacción bancaria ID
   */
  transactionBankId: string;

  /**
   * Concepto original
   */
  concept: string;

  /**
   * Número de casa extraído
   */
  houseNumber: number;

  /**
   * Confianza general del match
   */
  confidence: 'high' | 'medium' | 'low';

  /**
   * Indicadores que confirman el match
   */
  indicators: {
    /** Concepto claramente indica la casa */
    conceptMatch: boolean;
    /** Número extraído coincide con centavos */
    centsMatch?: boolean;
    /** Existe voucher para esta casa */
    voucherExists?: boolean;
  };

  /**
   * Métodos de validación usados
   */
  validationMethods: Array<'regex' | 'ai' | 'cents' | 'voucher'>;

  /**
   * Score final para ranking (0-1)
   */
  matchScore: number;
}
