import { Injectable, BadRequestException } from '@nestjs/common';
import {
  WhatsAppWebhookDto,
  WhatsAppMessageDto,
  WhatsAppImageDto,
  WhatsAppDocumentDto,
  WhatsAppInteractiveDto,
  WhatsAppTextDto,
} from '../dto/whatsapp-webhook.dto';
import { ProcessVoucherUseCase } from './process-voucher.use-case';
import { HandleWhatsAppMessageUseCase } from './handle-whatsapp-message.use-case';
import { WhatsAppMessageClassifierService } from '../infrastructure/whatsapp/whatsapp-message-classifier.service';
import { WhatsAppMessagingService } from '../infrastructure/whatsapp/whatsapp-messaging.service';
import { ConversationStateService } from '../infrastructure/persistence/conversation-state.service';
import { ErrorMessages } from '@/shared/content';

export interface HandleWhatsAppWebhookOutput {
  success: boolean;
  message?: string;
}

interface ExtractedMessage {
  phoneNumber: string;
  type: string;
  data: WhatsAppMessageDto;
}

/**
 * Use Case: Manejar webhook de WhatsApp
 *
 * Responsabilidades:
 * - Parsear el payload del webhook de WhatsApp
 * - Extraer información relevante del mensaje
 * - Determinar el tipo de mensaje recibido
 * - Delegar al use case apropiado según el tipo de mensaje
 * - Manejar mensajes no soportados
 *
 * Tipos de mensaje soportados:
 * - image: Comprobantes en formato imagen
 * - document: Comprobantes en formato PDF
 * - interactive: Respuestas a botones o listas
 * - text: Mensajes de texto del usuario
 */
@Injectable()
export class HandleWhatsAppWebhookUseCase {
  constructor(
    private readonly processVoucher: ProcessVoucherUseCase,
    private readonly handleMessage: HandleWhatsAppMessageUseCase,
    private readonly messageClassifier: WhatsAppMessageClassifierService,
    private readonly whatsappMessaging: WhatsAppMessagingService,
    private readonly conversationState: ConversationStateService,
  ) {}

  async execute(
    webhook: WhatsAppWebhookDto,
  ): Promise<HandleWhatsAppWebhookOutput> {
    try {
      // 1. Extraer el mensaje del webhook
      const message = this.extractMessage(webhook);

      // Si no hay mensaje, retornar éxito (puede ser una notificación de estado)
      if (!message) {
        console.log('✅ Webhook sin mensaje (status update) - ignorado');
        return { success: true };
      }

      const { phoneNumber, type } = message;
      console.log(`📨 Mensaje recibido - Tipo: ${type}, De: ${phoneNumber}`);

      // 2. Delegar según el tipo de mensaje
      switch (type) {
        case 'image':
          console.log('🖼️  Procesando imagen...');
          return await this.handleImageMessage(message);

        case 'document':
          console.log('📄 Procesando documento...');
          return await this.handleDocumentMessage(message);

        case 'interactive':
          console.log('🔘 Procesando respuesta interactiva...');
          return await this.handleInteractiveMessage(message);

        case 'text':
          console.log('💬 Procesando mensaje de texto...');
          return await this.handleTextMessage(message);

        default:
          return await this.handleUnsupportedMessage(phoneNumber, type);
      }
    } catch (error) {
      console.error('❌ Error procesando mensaje de WhatsApp:', error);
      throw new BadRequestException('Error processing WhatsApp message');
    }
  }

  /**
   * Extrae el mensaje del payload del webhook de WhatsApp
   */
  private extractMessage(webhook: WhatsAppWebhookDto): ExtractedMessage | null {
    const entry = webhook.entry?.[0];
    const changes = entry?.changes?.[0];
    const value = changes?.value;
    const message = value?.messages?.[0];

    if (!message) {
      return null;
    }

    return {
      phoneNumber: message.from || '',
      type: message.type || '',
      data: message,
    };
  }

  /**
   * Maneja mensajes con imagen (comprobantes)
   */
  private async handleImageMessage(
    message: ExtractedMessage,
  ): Promise<HandleWhatsAppWebhookOutput> {
    const { phoneNumber, data } = message;

    if (!data.image) {
      console.log('⚠️  No se encontró objeto image en el mensaje');
      return { success: true };
    }

    const image: WhatsAppImageDto = data.image;
    const mediaId = image.id;
    const caption = image.caption || '';

    console.log(`📸 Imagen recibida - MediaID: ${mediaId}`);
    if (caption) {
      console.log(`📝 Caption recibido: ${caption}`);
    }

    console.log('🔄 Iniciando procesamiento de voucher...');
    await this.processVoucher.execute({
      phoneNumber,
      mediaId,
      mediaType: 'image',
    });
    console.log('✅ Voucher procesado exitosamente');

    return { success: true };
  }

  /**
   * Maneja mensajes con documento (PDF)
   */
  private async handleDocumentMessage(
    message: ExtractedMessage,
  ): Promise<HandleWhatsAppWebhookOutput> {
    const { phoneNumber, data } = message;

    if (!data.document) {
      return { success: true };
    }

    const document: WhatsAppDocumentDto = data.document;
    const mediaId = document.id;
    const mimeType = document.mime_type;

    // Validar que sea PDF
    if (mimeType === 'application/pdf') {
      await this.processVoucher.execute({
        phoneNumber,
        mediaId,
        mediaType: 'document',
      });
    } else {
      await this.whatsappMessaging.sendTextMessage(
        phoneNumber,
        ErrorMessages.onlyPdfSupported,
      );
    }

    return { success: true };
  }

  /**
   * Maneja mensajes interactivos (botones o listas)
   */
  private async handleInteractiveMessage(
    message: ExtractedMessage,
  ): Promise<HandleWhatsAppWebhookOutput> {
    const { phoneNumber, data } = message;

    if (!data.interactive) {
      return { success: true };
    }

    const interactive: WhatsAppInteractiveDto = data.interactive;

    // Extraer la respuesta del usuario
    let userResponse: string | undefined;

    if (interactive.type === 'button_reply') {
      userResponse = interactive.button_reply?.id;
    } else if (interactive.type === 'list_reply') {
      userResponse = interactive.list_reply?.id;
    }

    if (!userResponse) {
      return { success: true };
    }

    // Verificar si hay contexto activo
    const context = this.conversationState.getContext(phoneNumber);

    if (context) {
      console.log(`Contexto activo detectado: ${context.state}`);
      await this.handleMessage.execute({
        phoneNumber,
        messageText: userResponse,
      });
    }

    return { success: true };
  }

  /**
   * Maneja mensajes de texto
   */
  private async handleTextMessage(
    message: ExtractedMessage,
  ): Promise<HandleWhatsAppWebhookOutput> {
    const { phoneNumber, data } = message;

    if (!data.text) {
      return { success: true };
    }

    const text: WhatsAppTextDto = data.text;
    const messageText = text.body || '';
    console.log('Mensaje de texto recibido:', messageText);

    // Verificar si hay contexto activo
    const context = this.conversationState.getContext(phoneNumber);

    if (context) {
      // Hay contexto activo, manejar según el estado de conversación
      console.log(`Contexto activo detectado: ${context.state}`);
      await this.handleMessage.execute({
        phoneNumber,
        messageText,
      });
      return { success: true };
    }

    // Sin contexto activo, usar clasificador de IA
    console.log('No hay contexto activo, clasificando mensaje...');
    const classification =
      await this.messageClassifier.classifyMessage(messageText);

    console.log('Clasificación:', {
      intent: classification.intent,
      confidence: classification.confidence,
    });

    await this.whatsappMessaging.sendTextMessage(
      phoneNumber,
      classification.response,
    );

    return { success: true };
  }

  /**
   * Maneja tipos de mensaje no soportados
   */
  private async handleUnsupportedMessage(
    phoneNumber: string,
    messageType: string,
  ): Promise<HandleWhatsAppWebhookOutput> {
    console.log(`Tipo de mensaje no soportado: ${messageType}`);
    await this.whatsappMessaging.sendTextMessage(
      phoneNumber,
      ErrorMessages.unsupportedMessageType,
    );

    return { success: true };
  }
}
