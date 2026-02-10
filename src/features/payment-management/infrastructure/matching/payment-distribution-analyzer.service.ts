import { Injectable, Logger } from '@nestjs/common';
import { OpenAIService } from '@/shared/libs/openai/openai.service';
import { VertexAIService } from '@/shared/libs/vertex-ai/vertex-ai.service';
import { getPaymentDistributionPrompt } from '../../config/payment-distribution-prompts.config';
import { PaymentManagementConfig } from '../../config/payment-management.config';
import {
  PaymentDistributionAIRequest,
  PaymentDistributionAIResponse,
  SuggestedAllocation,
} from '../../domain/payment-distribution.types';

@Injectable()
export class PaymentDistributionAnalyzerService {
  private readonly logger = new Logger(PaymentDistributionAnalyzerService.name);

  constructor(
    private readonly openAIService: OpenAIService,
    private readonly vertexAIService: VertexAIService,
  ) {}

  async analyzeDistribution(
    request: PaymentDistributionAIRequest,
  ): Promise<PaymentDistributionAIResponse | null> {
    if (!PaymentManagementConfig.ENABLE_AI_PAYMENT_DISTRIBUTION) {
      this.logger.debug('AI payment distribution deshabilitado');
      return null;
    }

    try {
      const unpaidPeriodsText = request.unpaid_periods
        .map(
          (p) =>
            `- Periodo ${p.display_name} (ID: ${p.period_id}): esperado $${p.expected_maintenance}, pagado $${p.paid_maintenance}, pendiente $${p.pending_maintenance}`,
        )
        .join('\n');

      const prompt = getPaymentDistributionPrompt(
        request.amount,
        request.house_number,
        request.credit_balance,
        request.total_debt,
        unpaidPeriodsText,
        PaymentManagementConfig.DEFAULT_MAINTENANCE_AMOUNT,
      );

      let aiResponse: PaymentDistributionAIResponse | null = null;

      // 1. Intentar con OpenAI
      try {
        this.logger.debug(
          `Analizando distribución con OpenAI: $${request.amount} para casa ${request.house_number}`,
        );
        aiResponse = await this.analyzeWithOpenAI(prompt);
      } catch (openaiError) {
        this.logger.warn(
          `Error con OpenAI: ${openaiError instanceof Error ? openaiError.message : 'Unknown'}. Fallback a Vertex AI...`,
        );

        // 2. Fallback a Vertex AI
        try {
          aiResponse = await this.analyzeWithVertexAI(prompt);
        } catch (vertexError) {
          this.logger.error(
            `Error con Vertex AI: ${vertexError instanceof Error ? vertexError.message : 'Unknown'}`,
          );
          return null;
        }
      }

      // 3. Validar respuesta
      if (!aiResponse) return null;

      const validated = this.validateResponse(aiResponse, request);
      return validated;
    } catch (error) {
      this.logger.error(
        `Error en análisis de distribución: ${error instanceof Error ? error.message : 'Unknown'}`,
      );
      return null;
    }
  }

  private async analyzeWithOpenAI(
    prompt: string,
  ): Promise<PaymentDistributionAIResponse> {
    const response = await this.openAIService.processTextWithPrompt(prompt);
    if (!response) {
      throw new Error('OpenAI retornó respuesta vacía');
    }
    return this.validateAndParseAIResponse(response);
  }

  private async analyzeWithVertexAI(
    prompt: string,
  ): Promise<PaymentDistributionAIResponse> {
    const response = await this.vertexAIService.processTextWithPrompt(prompt);
    if (!response) {
      throw new Error('Vertex AI retornó respuesta vacía');
    }
    return this.validateAndParseAIResponse(response);
  }

  private validateAndParseAIResponse(
    response: any,
  ): PaymentDistributionAIResponse {
    if (typeof response === 'object' && response !== null) {
      return this.ensureValidAIResponse(response);
    }

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

  private ensureValidAIResponse(response: any): PaymentDistributionAIResponse {
    const allocations: SuggestedAllocation[] = Array.isArray(
      response.allocations,
    )
      ? response.allocations.map((a: any) => ({
          period_id: parseInt(String(a.period_id), 10) || 0,
          concept_type: a.concept_type || 'maintenance',
          amount: parseFloat(String(a.amount)) || 0,
          reasoning: a.reasoning || '',
        }))
      : [];

    return {
      allocations,
      confidence: this.parseConfidence(response.confidence),
      reasoning: response.reasoning || 'Sin explicación',
      total_allocated: parseFloat(String(response.total_allocated)) || 0,
      remaining_as_credit:
        parseFloat(String(response.remaining_as_credit)) || 0,
    };
  }

  private parseConfidence(confidence: any): 'high' | 'medium' | 'low' {
    const valid = ['high', 'medium', 'low'];
    const level = String(confidence).toLowerCase();
    return valid.includes(level) ? (level as any) : 'low';
  }

  private validateResponse(
    response: PaymentDistributionAIResponse,
    request: PaymentDistributionAIRequest,
  ): PaymentDistributionAIResponse | null {
    // Validar que los montos suman al total
    const totalFromAllocations = response.allocations.reduce(
      (sum, a) => sum + a.amount,
      0,
    );
    const expectedTotal = totalFromAllocations + response.remaining_as_credit;
    const diff = Math.abs(expectedTotal - request.amount);

    if (diff > 1) {
      this.logger.warn(
        `AI response montos no cuadran: ${expectedTotal} vs ${request.amount} (diff: ${diff})`,
      );
      return null;
    }

    // Validar que los period_ids existen
    const validPeriodIds = new Set(
      request.unpaid_periods.map((p) => p.period_id),
    );
    for (const allocation of response.allocations) {
      if (!validPeriodIds.has(allocation.period_id)) {
        this.logger.warn(
          `AI sugirió periodo inexistente: ${allocation.period_id}`,
        );
        return null;
      }
      if (allocation.amount <= 0) {
        this.logger.warn(`AI sugirió monto no positivo: ${allocation.amount}`);
        return null;
      }
    }

    // Corregir total_allocated si difiere ligeramente
    response.total_allocated = Math.round(totalFromAllocations * 100) / 100;
    response.remaining_as_credit =
      Math.round((request.amount - totalFromAllocations) * 100) / 100;

    return response;
  }
}
