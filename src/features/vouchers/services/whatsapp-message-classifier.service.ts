import { Injectable, Logger } from '@nestjs/common';
import { VertexAIService } from '@/shared/libs/vertex-ai/vertex-ai.service';
import { OpenAIService } from '@/shared/libs/openai/openai.service';

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
   */
  private buildClassificationPrompt(messageText: string): string {
    return `Eres un asistente automático de WhatsApp para un condominio. Tu ÚNICA función es procesar comprobantes de pago que los usuarios envían como imágenes o PDFs.

IMPORTANTE: NO puedes proporcionar información sobre estados de cuenta, saldos, montos a pagar, fechas de vencimiento, ni ninguna otra información de pagos. Solo procesas comprobantes.

Tu trabajo es clasificar el mensaje del usuario en una de estas categorías:

1. "payment_voucher" - Si el mensaje indica que:
   - Está enviando un comprobante de pago
   - Ya realizó un pago y quiere reportarlo
   - Menciona "comprobante", "pago realizado", "transferencia hecha", "ya pagué"
   - Pregunta cómo enviar el comprobante

2. "greeting" - Si es un saludo simple:
   - Hola, Buenos días, Buenas tardes, Qué tal, etc.

3. "off_topic" - Si el mensaje NO está relacionado con enviar comprobantes:
   - Preguntas sobre estado de pagos, saldos, cuánto debe pagar
   - Preguntas sobre fechas de pago, cuenta bancaria, métodos de pago
   - Preguntas sobre mantenimiento, servicios, quejas
   - Conversación general
   - Cualquier tema que NO sea sobre enviar un comprobante de pago

IMPORTANTE: Debes responder SOLO en formato JSON con esta estructura exacta:
{
  "intent": "payment_voucher" | "greeting" | "off_topic",
  "confidence": 0.0 a 1.0,
  "response": "Texto de respuesta apropiado"
}

Reglas para las respuestas:
- Si es "off_topic" y pregunta sobre información de pagos (saldos, estados, montos): Responder "Para consultar información sobre tus pagos, saldos o estados de cuenta, por favor ingresa al portal web: https://agave1.up.railway.app"
- Si es "off_topic" y NO pregunta sobre pagos: Responder "Lo lamento, solo estoy configurado para recibir comprobantes de pago del condominio."
- Si es "greeting": Responder con un saludo breve y directo: "¡Hola! Envíame tu comprobante de pago como imagen o PDF para procesarlo."
- Si es "payment_voucher": Responder "Perfecto, por favor envía tu comprobante de pago como imagen o PDF."

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
        return 'Lo lamento, solo estoy configurado para recibir comprobantes de pago del condominio. Para consultar información sobre tus pagos, por favor ingresa al portal web: https://agave1.up.railway.app';
      case MessageIntent.GREETING:
        return '¡Hola! Envíame tu comprobante de pago como imagen o PDF para procesarlo.';
      case MessageIntent.PAYMENT_VOUCHER:
        return 'Perfecto, por favor envía tu comprobante de pago como imagen o PDF.';
      default:
        return 'Lo lamento, solo estoy configurado para recibir comprobantes de pago del condominio.';
    }
  }
}
