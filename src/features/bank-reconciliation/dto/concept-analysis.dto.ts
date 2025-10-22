/**
 * DTOs para análisis de conceptos bancarios con IA
 */

/**
 * Response de OpenAI/Vertex AI para análisis de concepto
 */
export interface ConceptAnalysisAIResponse {
  /**
   * Número de casa identificado o null
   */
  house_number: number | null;

  /**
   * Nivel de confianza
   */
  confidence: 'high' | 'medium' | 'low' | 'none';

  /**
   * Número del mes identificado (1-12) o null
   */
  month_number: number | null;

  /**
   * Nombre del mes en español
   */
  month_name: string | null;

  /**
   * Tipo de pago/concepto identificado
   */
  payment_type: string | null;

  /**
   * Palabras clave encontradas en el concepto
   */
  keywords: string[];

  /**
   * Razonamiento detallado de por qué se extrajo este número
   */
  reasoning: string;

  /**
   * Indicadores encontrados
   */
  indicators: {
    /** Patrón claro de casa encontrado */
    clear_house_pattern: boolean;
    /** Indicación de mes encontrada */
    month_indicator: boolean;
    /** Tipo de pago identificado */
    payment_type_found: boolean;
  };
}
