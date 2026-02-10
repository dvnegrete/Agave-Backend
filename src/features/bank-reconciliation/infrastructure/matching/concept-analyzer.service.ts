import { Injectable, Logger } from '@nestjs/common';
import { OpenAIService } from '@/shared/libs/openai/openai.service';
import { VertexAIService } from '@/shared/libs/vertex-ai/vertex-ai.service';
import { getConceptAnalysisPrompt } from '../../config/concept-analysis-prompts.config';
import { ReconciliationConfig } from '../../config/reconciliation.config';
import {
  ConceptHouseExtractionResult,
  AIConceptAnalysisResult,
  ConceptAnalysisRequest,
} from '../../domain/concept-matching.types';
import { ConceptAnalysisAIResponse } from '../../dto/concept-analysis.dto';

/**
 * Servicio para análisis de conceptos con servicios de IA
 * Proporciona análisis detallado cuando los patrones regex no son conclusivos
 *
 * Estrategia:
 * 1. Utiliza OpenAI por defecto
 * 2. Fallback a Vertex AI si OpenAI falla
 * 3. Parsea respuesta JSON con validación
 * 4. Convierte resultado de IA a ConceptHouseExtractionResult
 */
@Injectable()
export class ConceptAnalyzerService {
  private readonly logger = new Logger(ConceptAnalyzerService.name);

  constructor(
    private readonly openAIService: OpenAIService,
    private readonly vertexAIService: VertexAIService,
  ) {}

  /**
   * Analiza un concepto con IA para extraer información
   * @param request - Request con concepto y contexto
   * @returns Resultado de extracción con información de IA
   */
  async analyzeConceptWithAI(
    request: ConceptAnalysisRequest,
  ): Promise<ConceptHouseExtractionResult> {
    if (!ReconciliationConfig.ENABLE_AI_CONCEPT_ANALYSIS) {
      return {
        houseNumber: null,
        confidence: 'none',
        method: 'none',
        reason: 'Análisis con IA deshabilitado',
      };
    }

    try {
      // Obtener prompt único para ambos proveedores
      const prompt = getConceptAnalysisPrompt(request.concept);

      let aiResponse: ConceptAnalysisAIResponse | null = null;

      // 1. Intentar con OpenAI
      try {
        this.logger.debug(
          `Analizando concepto con OpenAI: "${request.concept}"`,
        );
        aiResponse = await this.analyzeWithOpenAI(prompt);
      } catch (openaiError) {
        this.logger.warn(
          `Error al analizar con OpenAI: ${openaiError instanceof Error ? openaiError.message : 'Unknown error'}. Intentando Vertex AI...`,
        );

        // 2. Fallback a Vertex AI
        try {
          this.logger.debug(
            `Intentando análisis con Vertex AI: "${request.concept}"`,
          );
          aiResponse = await this.analyzeWithVertexAI(prompt);
        } catch (vertexError) {
          this.logger.error(
            `Error al analizar con Vertex AI: ${vertexError instanceof Error ? vertexError.message : 'Unknown error'}`,
          );
          throw vertexError;
        }
      }

      // 3. Convertir respuesta de IA a ConceptHouseExtractionResult
      return this.convertAIResponseToExtractionResult(aiResponse, request);
    } catch (error) {
      this.logger.error(
        `Error en análisis con IA: ${error instanceof Error ? error.message : 'Unknown error'}`,
      );

      return {
        houseNumber: null,
        confidence: 'none',
        method: 'none',
        reason: `Error al procesar concepto con IA: ${error instanceof Error ? error.message : 'Unknown error'}`,
      };
    }
  }

  /**
   * Analiza concepto usando OpenAI
   * @param prompt - Prompt formateado
   * @returns Respuesta parseada de IA
   */
  private async analyzeWithOpenAI(
    prompt: string,
  ): Promise<ConceptAnalysisAIResponse> {
    const response = await this.openAIService.processTextWithPrompt(prompt);

    if (!response) {
      throw new Error('OpenAI retornó respuesta vacía');
    }

    return this.validateAndParseAIResponse(response);
  }

  /**
   * Analiza concepto usando Vertex AI
   * @param prompt - Prompt formateado
   * @returns Respuesta parseada de IA
   */
  private async analyzeWithVertexAI(
    prompt: string,
  ): Promise<ConceptAnalysisAIResponse> {
    const response = await this.vertexAIService.processTextWithPrompt(prompt);

    if (!response) {
      throw new Error('Vertex AI retornó respuesta vacía');
    }

    return this.validateAndParseAIResponse(response);
  }

  /**
   * Valida y parsea la respuesta de IA
   * @param response - Respuesta a validar
   * @returns Respuesta validada
   */
  private validateAndParseAIResponse(response: any): ConceptAnalysisAIResponse {
    // Si ya es un objeto, usarlo directamente
    if (typeof response === 'object' && response !== null) {
      return this.ensureValidAIResponse(response);
    }

    // Si es string, intentar parsear como JSON
    if (typeof response === 'string') {
      try {
        const parsed = JSON.parse(response);
        return this.ensureValidAIResponse(parsed);
      } catch {
        throw new Error('No se pudo parsear respuesta de IA como JSON');
      }
    }

    throw new Error('Formato de respuesta IA inválido');
  }

  /**
   * Asegura que la respuesta tenga la estructura esperada
   * @param response - Respuesta a validar
   * @returns Respuesta con estructura garantizada
   */
  private ensureValidAIResponse(response: any): ConceptAnalysisAIResponse {
    return {
      house_number: this.parseHouseNumber(response.house_number),
      confidence: this.parseConfidence(response.confidence),
      month_number: this.parseMonthNumber(response.month_number),
      month_name: response.month_name || null,
      payment_type: response.payment_type || null,
      keywords: Array.isArray(response.keywords) ? response.keywords : [],
      reasoning: response.reasoning || 'Sin explicación',
      indicators: {
        clear_house_pattern: response.indicators?.clear_house_pattern ?? false,
        month_indicator: response.indicators?.month_indicator ?? false,
        payment_type_found: response.indicators?.payment_type_found ?? false,
      },
    };
  }

  /**
   * Parsea y valida el número de casa de la IA
   * @param houseNumber - Valor a parsear
   * @returns Número válido o null
   */
  private parseHouseNumber(houseNumber: any): number | null {
    if (houseNumber === null || houseNumber === undefined) {
      return null;
    }

    const num = parseInt(String(houseNumber), 10);
    if (isNaN(num) || num < 1 || num > ReconciliationConfig.MAX_HOUSE_NUMBER) {
      return null;
    }

    return num;
  }

  /**
   * Parsea y valida el nivel de confianza
   * @param confidence - Valor a parsear
   * @returns Nivel de confianza válido
   */
  private parseConfidence(confidence: any): 'high' | 'medium' | 'low' | 'none' {
    const validLevels = ['high', 'medium', 'low', 'none'];
    const level = String(confidence).toLowerCase();
    return validLevels.includes(level) ? (level as any) : 'none';
  }

  /**
   * Parsea y valida el número de mes
   * @param monthNumber - Valor a parsear
   * @returns Número de mes válido o null
   */
  private parseMonthNumber(monthNumber: any): number | null {
    if (monthNumber === null || monthNumber === undefined) {
      return null;
    }

    const num = parseInt(String(monthNumber), 10);
    if (isNaN(num) || num < 1 || num > 12) {
      return null;
    }

    return num;
  }

  /**
   * Convierte la respuesta de IA a ConceptHouseExtractionResult
   * @param aiResponse - Respuesta de IA
   * @param request - Request original
   * @returns Resultado de extracción
   */
  private convertAIResponseToExtractionResult(
    aiResponse: ConceptAnalysisAIResponse,
    request: ConceptAnalysisRequest,
  ): ConceptHouseExtractionResult {
    // Validar rango si se especificó
    if (
      request.houseNumberRange &&
      aiResponse.house_number &&
      (aiResponse.house_number < request.houseNumberRange.min ||
        aiResponse.house_number > request.houseNumberRange.max)
    ) {
      return {
        houseNumber: null,
        confidence: 'none',
        method: 'ai',
        reason: `IA extrajo número fuera del rango válido: ${aiResponse.house_number}`,
      };
    }

    const result: ConceptHouseExtractionResult = {
      houseNumber: aiResponse.house_number,
      confidence: aiResponse.confidence,
      method: 'ai',
      reason: aiResponse.reasoning,
    };

    // Agregar información de mes si existe
    if (aiResponse.month_number) {
      result.month = {
        monthNumber: aiResponse.month_number,
        monthName: aiResponse.month_name || '',
        reason: `Mes identificado por IA`,
      };
    }

    // Agregar información de tipo de pago si existe
    if (aiResponse.payment_type) {
      result.paymentType = {
        type: aiResponse.payment_type,
        reason: 'Tipo de pago identificado por IA',
      };
    }

    this.logger.debug(
      `Análisis con IA completado: Casa ${result.houseNumber}, Confianza: ${result.confidence}`,
    );

    return result;
  }
}
