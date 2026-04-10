import { Injectable, Logger } from '@nestjs/common';
import { VertexAIService } from '@/shared/libs/vertex-ai/vertex-ai.service';
import { ColumnMapping } from '../interfaces/column-mapping.interface';
import { getColumnAnalysisPrompt } from '../config/column-analysis-prompts.config';

@Injectable()
export class ColumnAnalyzerService {
  private readonly logger = new Logger(ColumnAnalyzerService.name);

  constructor(private readonly vertexAIService: VertexAIService) {}

  /**
   * Analiza la estructura de un archivo bancario via IA para detectar
   * semánticamente qué columna corresponde a cada campo requerido.
   *
   * Retorna null ante cualquier fallo: el caller usa índices hardcodeados como fallback.
   *
   * @param headerRow  - Encabezados del archivo como array de strings
   * @param sampleRows - 1-2 filas de datos inmediatamente después del encabezado
   */
  async analyzeColumns(
    headerRow: string[],
    sampleRows: string[][],
  ): Promise<ColumnMapping | null> {
    try {
      const prompt = getColumnAnalysisPrompt(headerRow, sampleRows);
      const response = await this.vertexAIService.processTextWithPrompt(prompt);
      return this.validateAndParseMapping(response, headerRow.length);
    } catch (error) {
      this.logger.warn(
        `ColumnAnalyzerService: fallo al analizar columnas via IA, usando fallback. ` +
          `Razón: ${error instanceof Error ? error.message : 'desconocido'}`,
      );
      return null;
    }
  }

  private validateAndParseMapping(
    response: any,
    actualHeaderCount: number,
  ): ColumnMapping | null {
    if (typeof response !== 'object' || response === null) {
      this.logger.warn(
        'ColumnAnalyzerService: respuesta de IA no es un objeto válido',
      );
      return null;
    }

    const requiredNumericFields = [
      'fechaIndex',
      'horaIndex',
      'conceptoIndex',
      'retiroIndex',
      'depositoIndex',
      'expectedColumnCount',
      'trailingColumnsAfterDeposito',
    ];

    for (const field of requiredNumericFields) {
      if (typeof response[field] !== 'number') {
        this.logger.warn(
          `ColumnAnalyzerService: campo requerido '${field}' ausente o no numérico`,
        );
        return null;
      }
    }

    // Validar que los índices positivos están dentro del rango real del archivo
    const indexFields = [
      'fechaIndex',
      'horaIndex',
      'conceptoIndex',
      'retiroIndex',
      'depositoIndex',
    ];
    for (const field of indexFields) {
      const idx = response[field] as number;
      if (idx !== -1 && (idx < 0 || idx >= actualHeaderCount)) {
        this.logger.warn(
          `ColumnAnalyzerService: índice '${field}=${idx}' fuera de rango ` +
            `(0-${actualHeaderCount - 1})`,
        );
        return null;
      }
    }

    // conceptoIndex y depositoIndex son obligatorios
    if (response.conceptoIndex === -1 || response.depositoIndex === -1) {
      this.logger.warn(
        'ColumnAnalyzerService: conceptoIndex o depositoIndex no fueron encontrados por la IA',
      );
      return null;
    }

    return {
      fechaIndex: response.fechaIndex,
      horaIndex: response.horaIndex,
      conceptoIndex: response.conceptoIndex,
      retiroIndex: response.retiroIndex,
      depositoIndex: response.depositoIndex,
      saldoIndex: typeof response.saldoIndex === 'number' ? response.saldoIndex : -1,
      referenciaIndex:
        typeof response.referenciaIndex === 'number' ? response.referenciaIndex : -1,
      expectedColumnCount: response.expectedColumnCount,
      trailingColumnsAfterDeposito: response.trailingColumnsAfterDeposito,
    };
  }
}
