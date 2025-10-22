import { Injectable, Logger } from '@nestjs/common';
import { CONCEPT_HOUSE_PATTERNS, ReconciliationConfig } from '../../config/reconciliation.config';
import { ConceptHouseExtractionResult } from '../../domain/concept-matching.types';

/**
 * Servicio de infraestructura para extracción rápida de número de casa del concepto
 * Utiliza patrones regex para identificar el número de casa en el concepto bancario
 *
 * Estrategia:
 * 1. Intenta coincidir con patrones regex ordenados por confiabilidad
 * 2. Valida que el número esté en rango válido (1-66)
 * 3. Intenta identificar información adicional (mes, tipo de pago)
 * 4. Retorna resultado con nivel de confianza
 */
@Injectable()
export class ConceptHouseExtractorService {
  private readonly logger = new Logger(ConceptHouseExtractorService.name);

  /**
   * Extrae el número de casa del concepto usando patrones regex
   * @param concept - Texto del concepto de la transacción
   * @returns Resultado de extracción con número de casa y confianza
   */
  extractHouseNumber(concept: string): ConceptHouseExtractionResult {
    if (!concept || concept.trim().length === 0) {
      return {
        houseNumber: null,
        confidence: 'none',
        method: 'none',
        reason: 'Concepto vacío',
      };
    }

    const conceptLower = concept.toLowerCase().trim();

    // 1. Intentar coincidir con patrones regex
    for (const patternConfig of CONCEPT_HOUSE_PATTERNS) {
      const matches = conceptLower.matchAll(patternConfig.pattern);

      for (const match of matches) {
        if (match[1]) {
          const extractedNumber = parseInt(match[1], 10);

          // Validar que sea un número válido
          if (extractedNumber > 0 && extractedNumber <= ReconciliationConfig.MAX_HOUSE_NUMBER) {
            const result: ConceptHouseExtractionResult = {
              houseNumber: extractedNumber,
              confidence: patternConfig.confidence,
              method: 'regex',
              patternName: patternConfig.name,
              reason: `Patrón '${patternConfig.name}' coincidió: "${match[0].trim()}"`,
            };

            // 2. Intentar extraer información adicional
            this.enrichResultWithAdditionalInfo(result, conceptLower);

            this.logger.debug(
              `Casa extraída: ${extractedNumber} (${patternConfig.confidence}) de: "${concept}"`,
            );

            return result;
          }
        }
      }
    }

    // Si no encontró patrón claro, retornar resultado negativo
    return {
      houseNumber: null,
      confidence: 'none',
      method: 'none',
      reason: 'No se encontró patrón de número de casa en el concepto',
    };
  }

  /**
   * Enriquece el resultado con información adicional como mes y tipo de pago
   * @param result - Resultado a enriquecer
   * @param conceptLower - Concepto en minúsculas
   */
  private enrichResultWithAdditionalInfo(
    result: ConceptHouseExtractionResult,
    conceptLower: string,
  ): void {
    // Intentar extraer mes
    const monthInfo = this.extractMonth(conceptLower);
    if (monthInfo) {
      result.month = monthInfo;
    }

    // Intentar extraer tipo de pago
    const paymentType = this.extractPaymentType(conceptLower);
    if (paymentType) {
      result.paymentType = paymentType;
    }
  }

  /**
   * Extrae el mes del concepto si está presente
   * @param conceptLower - Concepto en minúsculas
   * @returns Información del mes o undefined
   */
  private extractMonth(
    conceptLower: string,
  ): { monthNumber: number; monthName: string; reason: string } | undefined {
    // Buscar nombres de meses en español
    for (let i = 0; i < ReconciliationConfig.MONTHS_ES.length; i++) {
      const monthName = ReconciliationConfig.MONTHS_ES[i];
      if (conceptLower.includes(monthName)) {
        return {
          monthNumber: i + 1,
          monthName: monthName.charAt(0).toUpperCase() + monthName.slice(1),
          reason: `Mes '${monthName}' encontrado en el concepto`,
        };
      }
    }

    // Buscar números de mes (01-12, 1-12)
    const monthMatch = conceptLower.match(/(?:mes|m[eé]s|mes-|mes\s+)?([01]?\d)(?:\s|$|[^0-9])/);
    if (monthMatch && monthMatch[1]) {
      const monthNum = parseInt(monthMatch[1], 10);
      if (monthNum >= 1 && monthNum <= 12) {
        return {
          monthNumber: monthNum,
          monthName: ReconciliationConfig.MONTHS_ES[monthNum - 1],
          reason: `Mes numérico '${monthNum}' encontrado`,
        };
      }
    }

    return undefined;
  }

  /**
   * Extrae el tipo de pago del concepto
   * @param conceptLower - Concepto en minúsculas
   * @returns Información del tipo de pago o undefined
   */
  private extractPaymentType(
    conceptLower: string,
  ): { type: string; reason: string } | undefined {
    // Palabras clave comunes para tipos de pago
    const paymentKeywords: Record<string, string> = {
      mantenimiento: 'Pago de mantenimiento',
      agua: 'Pago de agua',
      luz: 'Pago de luz/energía',
      cuota: 'Cuota de pago',
      administración: 'Cuota administrativa',
      renta: 'Pago de renta',
      arriendo: 'Pago de arriendo',
      servicios: 'Servicios',
      expensas: 'Expensas',
      condominio: 'Cuota de condominio',
      piscina: 'Acceso/cuota de piscina',
      estacionamiento: 'Estacionamiento',
      parqueadero: 'Parqueadero',
      basura: 'Recolección de basura',
      reserva: 'Fondo de reserva',
      fondo: 'Fondo de reserva',
      seguro: 'Seguro',
      impuesto: 'Impuesto/predial',
    };

    for (const [keyword, description] of Object.entries(paymentKeywords)) {
      if (conceptLower.includes(keyword)) {
        return {
          type: keyword,
          reason: description,
        };
      }
    }

    return undefined;
  }

  /**
   * Valida si un número de casa es válido
   * @param houseNumber - Número a validar
   * @returns true si es válido
   */
  isValidHouseNumber(houseNumber: number): boolean {
    return houseNumber > 0 && houseNumber <= ReconciliationConfig.MAX_HOUSE_NUMBER;
  }

  /**
   * Obtiene el nivel de confianza mínimo configurado
   * @returns Nivel de confianza mínimo
   */
  getMinimumConfidenceLevel(): 'high' | 'medium' | 'low' {
    return ReconciliationConfig.CONCEPT_MATCHING_MIN_CONFIDENCE;
  }

  /**
   * Compara dos niveles de confianza
   * @param confidence1 - Primer nivel
   * @param confidence2 - Segundo nivel
   * @returns true si confidence1 es mayor o igual que confidence2
   */
  isConfidenceAboveOrEqual(
    confidence1: 'high' | 'medium' | 'low' | 'none',
    confidence2: 'high' | 'medium' | 'low' | 'none',
  ): boolean {
    const confidenceOrder: Record<string, number> = {
      high: 3,
      medium: 2,
      low: 1,
      none: 0,
    };
    return confidenceOrder[confidence1] >= confidenceOrder[confidence2];
  }
}
