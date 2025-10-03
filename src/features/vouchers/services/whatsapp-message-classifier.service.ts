import { Injectable, Logger } from '@nestjs/common';
import { VertexAIService } from '@/shared/libs/vertex-ai/vertex-ai.service';
import { OpenAIService } from '@/shared/libs/openai/openai.service';

export enum MessageIntent {
  PAYMENT_INFO = 'payment_info', // Preguntas sobre pagos
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
   */
  private buildClassificationPrompt(messageText: string): string {
    return `Eres un asistente de WhatsApp para un condominio que SOLO maneja información de pagos.

Tu trabajo es clasificar el mensaje del usuario en una de estas categorías:

1. "payment_info" - Si el usuario pregunta sobre:
   - Estado de sus pagos
   - Cómo hacer un pago
   - Monto a pagar
   - Fechas de pago
   - Información de cuenta bancaria
   - Cualquier duda relacionada con pagos del condominio

2. "payment_voucher" - Si el mensaje indica que:
   - Está enviando un comprobante de pago
   - Ya realizó un pago y quiere reportarlo
   - Menciona "comprobante", "pago realizado", "transferencia hecha"

3. "greeting" - Si es un saludo simple:
   - Hola, Buenos días, Buenas tardes, etc.

4. "off_topic" - Si el mensaje NO está relacionado con pagos:
   - Preguntas sobre mantenimiento del condominio
   - Quejas o sugerencias no relacionadas con pagos
   - Conversación general
   - Cualquier tema fuera de pagos

IMPORTANTE: Debes responder SOLO en formato JSON con esta estructura exacta:
{
  "intent": "payment_info" | "payment_voucher" | "greeting" | "off_topic",
  "confidence": 0.0 a 1.0,
  "response": "Texto de respuesta apropiado"
}

Reglas para las respuestas:
- Si es "off_topic": SIEMPRE responder "Lo lamento, solo estoy configurado para recibir información respecto a los pagos en el condominio."
- Si es "greeting": Responder con un saludo cordial y ofrecer ayuda con pagos
- Si es "payment_info": Dar una respuesta útil y profesional sobre la consulta de pago
- Si es "payment_voucher": Confirmar que esperas recibir el comprobante y dar instrucciones

Mensaje del usuario a clasificar:
"${messageText}"`;
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
      case 'payment_info':
        return MessageIntent.PAYMENT_INFO;
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
   */
  private getDefaultResponse(intent: MessageIntent): string {
    switch (intent) {
      case MessageIntent.OFF_TOPIC:
        return 'Lo lamento, solo estoy configurado para recibir información respecto a los pagos en el condominio.';
      case MessageIntent.GREETING:
        return '¡Hola! Estoy aquí para ayudarte con información sobre los pagos del condominio. ¿En qué puedo asistirte?';
      case MessageIntent.PAYMENT_INFO:
        return 'Con gusto te ayudo con información sobre pagos. ¿Qué necesitas saber?';
      case MessageIntent.PAYMENT_VOUCHER:
        return 'Perfecto, espero tu comprobante de pago. Por favor envíalo como imagen.';
      default:
        return 'Lo lamento, solo estoy configurado para recibir información respecto a los pagos en el condominio.';
    }
  }
}
