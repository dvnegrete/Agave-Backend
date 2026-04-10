import { Injectable, Logger } from '@nestjs/common';
import { OpenAIService } from '@/shared/libs/openai/openai.service';
import { VertexAIService } from '@/shared/libs/vertex-ai/vertex-ai.service';
import { ColumnMapping } from '../interfaces/column-mapping.interface';
import { ColumnAnalysisAIResponse } from '../dto/column-analysis.dto';
import { getColumnAnalysisPrompt } from '../config/column-analysis-prompts.config';

/**
 * Servicio para análisis semántico de columnas en archivos bancarios (CSV/XLSX).
 * Detecta qué columna corresponde a cada campo requerido aunque cambien nombres o posiciones.
 *
 * Estrategia:
 * 1. Utiliza OpenAI por defecto
 * 2. Fallback a Vertex AI si OpenAI falla
 * 3. Si ambos fallan, retorna null → el caller usa índices hardcodeados como fallback
 */
@Injectable()
export class ColumnAnalyzerService {
  private readonly logger = new Logger(ColumnAnalyzerService.name);

  constructor(
    private readonly openAIService: OpenAIService,
    private readonly vertexAIService: VertexAIService,
  ) {}

  /**
   * Analiza la estructura de un archivo bancario via IA para detectar
   * semánticamente qué columna corresponde a cada campo requerido.
   *
   * @param headerRow  - Encabezados del archivo como array de strings
   * @param sampleRows - 1-2 filas de datos inmediatamente después del encabezado
   * @returns ColumnMapping validado, o null si ambos proveedores fallan
   */
  async analyzeColumns(
    headerRow: string[],
    sampleRows: string[][],
  ): Promise<ColumnMapping | null> {
    const prompt = getColumnAnalysisPrompt(headerRow, sampleRows);
    let aiResponse: ColumnAnalysisAIResponse | null = null;

    // 1. Intentar con OpenAI
    try {
      aiResponse = await this.analyzeWithOpenAI(prompt);
    } catch (openaiError) {
      this.logger.warn(
        `Error al analizar columnas con OpenAI: ${openaiError instanceof Error ? openaiError.message : 'desconocido'}. Intentando Vertex AI...`,
      );

      // 2. Fallback a Vertex AI
      try {
        aiResponse = await this.analyzeWithVertexAI(prompt);
      } catch (vertexError) {
        this.logger.warn(
          `Error al analizar columnas con Vertex AI: ${vertexError instanceof Error ? vertexError.message : 'desconocido'}. Usando índices hardcodeados.`,
        );
        return null;
      }
    }

    return this.validateAndParseMapping(aiResponse, headerRow.length);
  }

  private async analyzeWithOpenAI(
    prompt: string,
  ): Promise<ColumnAnalysisAIResponse> {
    const response = await this.openAIService.processTextWithPrompt(prompt);

    if (!response) {
      throw new Error('OpenAI retornó respuesta vacía');
    }

    return this.ensureValidAIResponse(response);
  }

  private async analyzeWithVertexAI(
    prompt: string,
  ): Promise<ColumnAnalysisAIResponse> {
    const response = await this.vertexAIService.processTextWithPrompt(prompt);

    if (!response) {
      throw new Error('Vertex AI retornó respuesta vacía');
    }

    return this.ensureValidAIResponse(response);
  }

  private ensureValidAIResponse(response: any): ColumnAnalysisAIResponse {
    if (typeof response === 'string') {
      try {
        response = JSON.parse(response);
      } catch {
        throw new Error('No se pudo parsear respuesta de IA como JSON');
      }
    }

    if (typeof response !== 'object' || response === null) {
      throw new Error('Formato de respuesta IA inválido');
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
      confidence: response.confidence ?? 'low',
      reasoning: response.reasoning ?? '',
    };
  }

  private validateAndParseMapping(
    aiResponse: ColumnAnalysisAIResponse | null,
    actualHeaderCount: number,
  ): ColumnMapping | null {
    if (!aiResponse) return null;

    const requiredNumericFields: (keyof ColumnAnalysisAIResponse)[] = [
      'fechaIndex',
      'horaIndex',
      'conceptoIndex',
      'retiroIndex',
      'depositoIndex',
      'expectedColumnCount',
    ];

    for (const field of requiredNumericFields) {
      if (typeof aiResponse[field] !== 'number') {
        this.logger.warn(
          `ColumnAnalyzerService: campo '${field}' ausente o no numérico en respuesta IA`,
        );
        return null;
      }
    }

    const indexFields: (keyof ColumnAnalysisAIResponse)[] = [
      'fechaIndex',
      'horaIndex',
      'conceptoIndex',
      'retiroIndex',
      'depositoIndex',
    ];
    for (const field of indexFields) {
      const idx = aiResponse[field] as number;
      if (idx !== -1 && (idx < 0 || idx >= actualHeaderCount)) {
        this.logger.warn(
          `ColumnAnalyzerService: índice '${field}=${idx}' fuera de rango (0-${actualHeaderCount - 1})`,
        );
        return null;
      }
    }

    if (aiResponse.conceptoIndex === -1 || aiResponse.depositoIndex === -1) {
      this.logger.warn(
        'ColumnAnalyzerService: conceptoIndex o depositoIndex no detectados por IA',
      );
      return null;
    }

    // Derivar trailingColumnsAfterDeposito de forma determinística.
    // No se le pide a la IA para evitar errores de cálculo que rompan el parse-from-right.
    const trailingColumnsAfterDeposito =
      aiResponse.expectedColumnCount - aiResponse.depositoIndex - 1;

    this.logger.log(
      `Columnas detectadas — fecha:[${aiResponse.fechaIndex}] concepto:[${aiResponse.conceptoIndex}] retiro:[${aiResponse.retiroIndex}] deposito:[${aiResponse.depositoIndex}] trailing:${trailingColumnsAfterDeposito} confianza:${aiResponse.confidence}`,
    );

    return {
      fechaIndex: aiResponse.fechaIndex,
      horaIndex: aiResponse.horaIndex,
      conceptoIndex: aiResponse.conceptoIndex,
      retiroIndex: aiResponse.retiroIndex,
      depositoIndex: aiResponse.depositoIndex,
      saldoIndex: aiResponse.saldoIndex,
      referenciaIndex: aiResponse.referenciaIndex,
      expectedColumnCount: aiResponse.expectedColumnCount,
      trailingColumnsAfterDeposito,
    };
  }
}
