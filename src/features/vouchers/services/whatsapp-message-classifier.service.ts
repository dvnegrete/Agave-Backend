import { Injectable, Logger } from '@nestjs/common';
import { VertexAIService } from '@/shared/libs/vertex-ai/vertex-ai.service';
import { OpenAIService } from '@/shared/libs/openai/openai.service';
import {
  MessageClassifierPrompt,
  GreetingMessages,
  OffTopicMessages,
  ContextualMessages,
  URLs,
} from '@/shared/content';

export enum MessageIntent {
  PAYMENT_VOUCHER = 'payment_voucher', // Envío de comprobante
  OFF_TOPIC = 'off_topic', // Temas no relacionados
  GREETING = 'greeting', // Saludos
}

export interface ClassificationResult {
  intent: MessageIntent;
  confidence: number;
  response: string;
  requiresVoucherProcessing?: boolean;
}

@Injectable()
export class WhatsAppMessageClassifierService {
  private readonly logger = new Logger(WhatsAppMessageClassifierService.name);
  private readonly useVertexAI: boolean;

  constructor(
    private readonly vertexAIService: VertexAIService,
    private readonly openAIService: OpenAIService,
  ) {
    // Determinar qué servicio usar basado en variables de entorno
    this.useVertexAI = !!process.env.PROJECT_ID_GCP;
  }

  /**
   * Clasifica un mensaje de texto de WhatsApp y determina la respuesta apropiada
   * @param messageText Texto del mensaje recibido
   * @returns Resultado de la clasificación con la respuesta sugerida
   */
  async classifyMessage(messageText: string): Promise<ClassificationResult> {
    try {
      const prompt = this.buildClassificationPrompt(messageText);

      let aiResponse: any;

      if (this.useVertexAI) {
        aiResponse = await this.classifyWithVertexAI(prompt);
      } else {
        aiResponse = await this.classifyWithOpenAI(prompt);
      }

      return this.parseClassificationResponse(aiResponse);
    } catch (error) {
      this.logger.error(`Error al clasificar mensaje: ${error.message}`);
      // En caso de error, respuesta por defecto
      return {
        intent: MessageIntent.OFF_TOPIC,
        confidence: 0,
        response:
          'Disculpa, hubo un error al procesar tu mensaje. Por favor, intenta nuevamente.',
      };
    }
  }

  /**
   * Construye el prompt para clasificar el mensaje
   * Usa el prompt centralizado del sistema de contenido
   */
  private buildClassificationPrompt(messageText: string): string {
    return MessageClassifierPrompt.build(messageText);
  }

  /**
   * Clasifica usando Vertex AI (Gemini)
   */
  private async classifyWithVertexAI(prompt: string): Promise<any> {
    try {
      const response = await this.vertexAIService.processTextWithPrompt(
        '',
        prompt,
      );
      return response;
    } catch (error) {
      this.logger.error(`Error con Vertex AI: ${error.message}`);
      throw error;
    }
  }

  /**
   * Clasifica usando OpenAI
   */
  private async classifyWithOpenAI(prompt: string): Promise<any> {
    try {
      const response = await this.openAIService.processTextWithPrompt(
        '',
        prompt,
      );
      return response;
    } catch (error) {
      this.logger.error(`Error con OpenAI: ${error.message}`);
      throw error;
    }
  }

  /**
   * Parsea la respuesta de la IA y la convierte en ClassificationResult
   */
  private parseClassificationResponse(aiResponse: any): ClassificationResult {
    const intent = this.mapIntent(aiResponse.intent);
    const confidence = aiResponse.confidence || 0.8;
    const response = aiResponse.response || this.getDefaultResponse(intent);

    return {
      intent,
      confidence,
      response,
      requiresVoucherProcessing: intent === MessageIntent.PAYMENT_VOUCHER,
    };
  }

  /**
   * Mapea el intent string al enum
   */
  private mapIntent(intentString: string): MessageIntent {
    switch (intentString) {
      case 'payment_voucher':
        return MessageIntent.PAYMENT_VOUCHER;
      case 'greeting':
        return MessageIntent.GREETING;
      case 'off_topic':
      default:
        return MessageIntent.OFF_TOPIC;
    }
  }

  /**
   * Obtiene una respuesta por defecto según el intent
   * Usa los mensajes centralizados del sistema de contenido
   */
  private getDefaultResponse(intent: MessageIntent): string {
    switch (intent) {
      case MessageIntent.OFF_TOPIC:
        return OffTopicMessages.paymentsInfo(URLs.portalWeb);
      case MessageIntent.GREETING:
        return GreetingMessages.initial;
      case MessageIntent.PAYMENT_VOUCHER:
        return ContextualMessages.requestVoucher;
      default:
        return OffTopicMessages.default;
    }
  }
}
