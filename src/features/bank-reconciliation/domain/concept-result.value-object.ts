import { ConceptHouseExtractionResult } from './concept-matching.types';

/**
 * Value Object que encapsula el resultado de extracción de concepto
 * Simplifica la lógica de decisión en el servicio de matching
 *
 * Propósito:
 * - Encapsular la complejidad de ConceptHouseExtractionResult
 * - Proveer métodos de consulta simples y expresivos
 * - Facilitar el testing y mantenimiento
 */
export class ConceptResult {
  private constructor(
    public readonly house: number | null,
    public readonly confidence: 'high' | 'medium' | 'low' | 'none',
  ) {}

  /**
   * Crea un ConceptResult desde un resultado de extracción
   */
  static from(extraction: ConceptHouseExtractionResult): ConceptResult {
    return new ConceptResult(extraction.houseNumber, extraction.confidence);
  }

  /**
   * Crea un ConceptResult vacío (sin extracción)
   */
  static none(): ConceptResult {
    return new ConceptResult(null, 'none');
  }

  /**
   * Verifica si se identificó un número de casa
   */
  hasHouse(): boolean {
    return this.house !== null && this.house > 0;
  }

  /**
   * Verifica si la confianza es alta
   */
  isHighConfidence(): boolean {
    return this.confidence === 'high';
  }

  /**
   * Verifica si la confianza es suficiente (high o medium)
   */
  isSufficientConfidence(): boolean {
    return this.confidence === 'high' || this.confidence === 'medium';
  }
}
