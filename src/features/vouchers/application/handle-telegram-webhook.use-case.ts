import { Injectable, Logger } from '@nestjs/common';
import {
  VoucherProcessorService,
  VoucherProcessingResult,
} from '../infrastructure/ocr/voucher-processor.service';
import {
  ConversationStateService,
  ConversationState,
} from '../infrastructure/persistence/conversation-state.service';
import { TelegramMessagingService } from '../infrastructure/telegram/telegram-messaging.service';
import { TelegramMediaService } from '../infrastructure/telegram/telegram-media.service';
import { TelegramApiService } from '../infrastructure/telegram/telegram-api.service';
import { GcsCleanupService } from '@/shared/libs/google-cloud';
import { VoucherValidator } from '../domain/voucher-validator';
import { ErrorMessages } from '@/shared/content';
import {
  ProcessedTelegramMessageDto,
  TelegramWebhookDto,
} from '../dto/telegram-webhook.dto';

export interface HandleTelegramWebhookOutput {
  success: boolean;
  message?: string;
}

/**
 * Use Case: Procesar webhook de Telegram
 *
 * Responsabilidades:
 * - Parsear update de Telegram y clasificar tipo de mensaje
 * - Manejar comandos (/start, /ayuda)
 * - Manejar fotos y documentos (vouchers)
 * - Manejar callback queries (botones inline presionados)
 * - Manejar entrada de texto (respuestas del usuario)
 * - Delegar procesamiento de vouchers al VoucherProcessorService
 */
@Injectable()
export class HandleTelegramWebhookUseCase {
  private readonly logger = new Logger(HandleTelegramWebhookUseCase.name);

  constructor(
    private readonly voucherProcessor: VoucherProcessorService,
    private readonly telegramMedia: TelegramMediaService,
    private readonly telegramMessaging: TelegramMessagingService,
    private readonly telegramApi: TelegramApiService,
    private readonly conversationState: ConversationStateService,
    private readonly gcsCleanupService: GcsCleanupService,
  ) {}

  async execute(
    webhookData: TelegramWebhookDto,
  ): Promise<HandleTelegramWebhookOutput> {
    try {
      // 1. Parsear el webhook
      const processedMessage = this.parseWebhook(webhookData);

      if (!processedMessage) {
        this.logger.warn('Webhook sin datos procesables');
        return { success: false, message: 'No processable data' };
      }

      // 2. Enrutar según tipo de mensaje
      switch (processedMessage.messageType) {
        case 'text':
          return await this.handleTextMessage(processedMessage);

        case 'photo':
          return await this.handlePhotoMessage(processedMessage);

        case 'document':
          return await this.handleDocumentMessage(processedMessage);

        case 'callback_query':
          return await this.handleCallbackQuery(processedMessage);

        default:
          await this.telegramMessaging.sendTextMessage(
            processedMessage.chatId,
            'Tipo de mensaje no soportado. Por favor envía una foto o documento PDF.',
          );
          return { success: false, message: 'Unsupported message type' };
      }
    } catch (error) {
      this.logger.error(
        `Error en HandleTelegramWebhookUseCase: ${error.message}`,
      );
      return { success: false, message: error.message };
    }
  }

  /**
   * Parsea el webhook de Telegram y extrae información relevante
   */
  private parseWebhook(
    webhookData: TelegramWebhookDto,
  ): ProcessedTelegramMessageDto | null {
    // Callback query (botón presionado)
    if (webhookData.callback_query) {
      const cbq = webhookData.callback_query;
      return {
        chatId: cbq.message?.chat.id || cbq.from.id,
        userId: cbq.from.id,
        username: cbq.from.username,
        messageId: cbq.message?.message_id || 0,
        messageType: 'callback_query',
        callbackData: cbq.data,
        timestamp: new Date(),
      };
    }

    // Mensaje regular
    if (webhookData.message) {
      const msg = webhookData.message;

      // Detectar tipo de mensaje
      let messageType: ProcessedTelegramMessageDto['messageType'] = 'unknown';
      if (msg.photo && msg.photo.length > 0) {
        messageType = 'photo';
      } else if (msg.document) {
        messageType = 'document';
      } else if (msg.text) {
        messageType = 'text';
      }

      return {
        chatId: msg.chat.id,
        userId: msg.from.id,
        username: msg.from.username,
        messageId: msg.message_id,
        messageType,
        text: msg.text || msg.caption,
        photos: msg.photo,
        document: msg.document,
        timestamp: new Date(msg.date * 1000),
      };
    }

    return null;
  }

  /**
   * Maneja mensajes de texto (comandos y respuestas del usuario)
   */
  private async handleTextMessage(
    message: ProcessedTelegramMessageDto,
  ): Promise<HandleTelegramWebhookOutput> {
    const chatId = message.chatId.toString();
    const text = message.text?.trim() || '';

    // Comandos
    if (text.startsWith('/')) {
      return await this.handleCommand(message.chatId, text);
    }

    // Verificar si el usuario está en un flujo de conversación
    const context = this.conversationState.getContext(chatId);

    if (!context) {
      // No hay contexto, probablemente mensaje aleatorio
      await this.telegramMessaging.sendTextMessage(
        message.chatId,
        'Por favor envía una foto o PDF de tu comprobante de pago. Usa /ayuda para más información.',
      );
      return { success: true };
    }

    // Manejar respuestas según el estado de conversación
    switch (context.state) {
      case ConversationState.WAITING_HOUSE_NUMBER:
        return await this.handleHouseNumberResponse(
          message.chatId,
          text,
          context,
        );

      case ConversationState.WAITING_MISSING_DATA:
        return await this.handleMissingDataResponse(
          message.chatId,
          text,
          context,
        );

      default:
        await this.telegramMessaging.sendTextMessage(
          message.chatId,
          'No entiendo tu mensaje. Usa /ayuda para ver los comandos disponibles.',
        );
        return { success: true };
    }
  }

  /**
   * Maneja comandos de Telegram
   */
  private async handleCommand(
    chatId: number,
    command: string,
  ): Promise<HandleTelegramWebhookOutput> {
    switch (command.toLowerCase()) {
      case '/start':
        await this.telegramMessaging.sendWelcomeMessage(chatId);
        break;

      case '/ayuda':
      case '/help':
        await this.telegramMessaging.sendHelpMessage(chatId);
        break;

      default:
        await this.telegramMessaging.sendTextMessage(
          chatId,
          'Comando no reconocido. Usa /ayuda para ver los comandos disponibles.',
        );
    }

    return { success: true };
  }

  /**
   * Maneja fotos enviadas (vouchers)
   */
  private async handlePhotoMessage(
    message: ProcessedTelegramMessageDto,
  ): Promise<HandleTelegramWebhookOutput> {
    let gcsFilename: string | undefined;

    try {
      if (!message.photos || message.photos.length === 0) {
        await this.telegramMessaging.sendErrorMessage(
          message.chatId,
          'No se pudo procesar la foto. Por favor intenta nuevamente.',
        );
        return { success: false };
      }

      // 1. Descargar la foto
      const { buffer, mimeType, filename } =
        await this.telegramMedia.downloadPhoto(message.photos);

      // 2. Validar tipo de archivo
      if (!this.telegramMedia.isSupportedMediaType(mimeType)) {
        await this.telegramMessaging.sendErrorMessage(
          message.chatId,
          `Tipo de archivo no soportado: ${mimeType}`,
        );
        return { success: false };
      }

      // 3. Procesar el voucher usando el servicio unificado
      const chatIdStr = message.chatId.toString();
      const result = await this.voucherProcessor.processVoucher(
        buffer,
        filename,
        'es',
        chatIdStr,
      );

      gcsFilename = result.gcsFilename;

      // 4. Determinar flujo según datos extraídos
      return await this.handleProcessingResult(message.chatId, result);
    } catch (error) {
      this.logger.error(`Error procesando foto: ${error.message}`);

      if (gcsFilename) {
        await this.cleanupUploadedFile(gcsFilename);
      }

      await this.telegramMessaging.sendErrorMessage(
        message.chatId,
        ErrorMessages.processingError,
      );
      return { success: false, message: error.message };
    }
  }

  /**
   * Maneja documentos enviados (PDFs)
   */
  private async handleDocumentMessage(
    message: ProcessedTelegramMessageDto,
  ): Promise<HandleTelegramWebhookOutput> {
    let gcsFilename: string | undefined;

    try {
      if (!message.document) {
        await this.telegramMessaging.sendErrorMessage(
          message.chatId,
          'No se pudo procesar el documento. Por favor intenta nuevamente.',
        );
        return { success: false };
      }

      // Validar tamaño de archivo
      if (!this.telegramMedia.isValidFileSize(message.document.file_size)) {
        await this.telegramMessaging.sendErrorMessage(
          message.chatId,
          'El archivo es demasiado grande. El tamaño máximo es 20MB.',
        );
        return { success: false };
      }

      // 1. Descargar el documento
      const { buffer, mimeType, filename } =
        await this.telegramMedia.downloadDocument(message.document);

      // 2. Validar tipo de archivo
      if (!this.telegramMedia.isSupportedMediaType(mimeType)) {
        await this.telegramMessaging.sendErrorMessage(
          message.chatId,
          `Tipo de archivo no soportado: ${mimeType}. Por favor envía un PDF o imagen.`,
        );
        return { success: false };
      }

      // 3. Procesar el voucher
      const chatIdStr = message.chatId.toString();
      const result = await this.voucherProcessor.processVoucher(
        buffer,
        filename,
        'es',
        chatIdStr,
      );

      gcsFilename = result.gcsFilename;

      // 4. Determinar flujo
      return await this.handleProcessingResult(message.chatId, result);
    } catch (error) {
      this.logger.error(`Error procesando documento: ${error.message}`);

      if (gcsFilename) {
        await this.cleanupUploadedFile(gcsFilename);
      }

      await this.telegramMessaging.sendErrorMessage(
        message.chatId,
        ErrorMessages.processingError,
      );
      return { success: false, message: error.message };
    }
  }

  /**
   * Maneja callback queries (botones inline presionados)
   */
  private async handleCallbackQuery(
    message: ProcessedTelegramMessageDto,
  ): Promise<HandleTelegramWebhookOutput> {
    const chatIdStr = message.chatId.toString();
    const callbackData = message.callbackData;

    // Responder al callback query (requerido por Telegram API)
    // await this.telegramApi.answerCallbackQuery(message.messageId.toString());

    if (callbackData === 'confirm_yes') {
      // Confirmar voucher
      const context = this.conversationState.getContext(chatIdStr);
      if (!context || !context.data?.voucherData) {
        await this.telegramMessaging.sendErrorMessage(
          message.chatId,
          'No hay datos para confirmar. Por favor envía el comprobante nuevamente.',
        );
        return { success: false };
      }

      // TODO: Implementar confirmación de voucher (similar a confirm-voucher.use-case.ts)
      // Por ahora solo enviamos mensaje de éxito
      await this.telegramMessaging.sendSuccessMessage(
        message.chatId,
        'Comprobante confirmado exitosamente.',
      );

      // Limpiar contexto
      this.conversationState.clearContext(chatIdStr);
      return { success: true };
    } else if (callbackData === 'confirm_no') {
      // Cancelar
      await this.telegramMessaging.sendTextMessage(
        message.chatId,
        'Operación cancelada. Por favor envía el comprobante nuevamente.',
      );

      this.conversationState.clearContext(chatIdStr);
      return { success: true };
    }

    return { success: true };
  }

  /**
   * Determina el flujo según el resultado del procesamiento
   */
  private async handleProcessingResult(
    chatId: number,
    result: VoucherProcessingResult,
  ): Promise<HandleTelegramWebhookOutput> {
    const voucherData = result.structuredData;
    const chatIdStr = chatId.toString();

    // CASO 1: Datos completos → Pedir confirmación
    if (!voucherData.faltan_datos && typeof voucherData.casa === 'number') {
      this.conversationState.saveVoucherForConfirmation(
        chatIdStr,
        voucherData,
        result.gcsFilename,
        result.originalFilename,
      );

      // Type guard garantiza que casa es number aquí
      await this.telegramMessaging.sendConfirmationRequest(chatId, {
        ...voucherData,
        casa: voucherData.casa, // TypeScript ya sabe que es number aquí
      });
      return { success: true };
    }

    // CASO 2: Falta número de casa
    if (!voucherData.faltan_datos && voucherData.casa === null) {
      this.conversationState.setContext(
        chatIdStr,
        ConversationState.WAITING_HOUSE_NUMBER,
        {
          voucherData,
          gcsFilename: result.gcsFilename,
          originalFilename: result.originalFilename,
        },
      );

      await this.telegramMessaging.sendHouseNumberRequest(chatId);
      return { success: true };
    }

    // CASO 3: Faltan múltiples datos
    if (voucherData.faltan_datos) {
      const missingFields = VoucherValidator.identifyMissingFields(voucherData);

      this.conversationState.setContext(
        chatIdStr,
        ConversationState.WAITING_MISSING_DATA,
        {
          voucherData,
          gcsFilename: result.gcsFilename,
          originalFilename: result.originalFilename,
          missingFields,
        },
      );

      await this.telegramMessaging.sendMissingDataRequest(
        chatId,
        missingFields,
      );
      return { success: true };
    }

    return { success: true };
  }

  /**
   * Maneja respuesta de número de casa
   */
  private async handleHouseNumberResponse(
    chatId: number,
    text: string,
    context: any,
  ): Promise<HandleTelegramWebhookOutput> {
    const houseNumber = parseInt(text, 10);

    if (isNaN(houseNumber) || houseNumber <= 0) {
      await this.telegramMessaging.sendTextMessage(
        chatId,
        'Por favor envía un número de casa válido (ejemplo: 101)',
      );
      return { success: true };
    }

    // Actualizar voucher con número de casa
    context.voucherData.casa = houseNumber;
    context.voucherData.faltan_datos = false;

    // Pasar a confirmación
    const chatIdStr = chatId.toString();
    this.conversationState.saveVoucherForConfirmation(
      chatIdStr,
      context.voucherData,
      context.gcsFilename,
      context.originalFilename,
    );

    // Ahora casa es definitivamente un número
    await this.telegramMessaging.sendConfirmationRequest(chatId, {
      ...context.voucherData,
      casa: houseNumber, // Usar el número validado directamente
    });
    return { success: true };
  }

  /**
   * Maneja respuesta de datos faltantes
   */
  private async handleMissingDataResponse(
    chatId: number,
    text: string,
    context: any,
  ): Promise<HandleTelegramWebhookOutput> {
    // TODO: Implementar lógica de parseo de datos faltantes
    // Por ahora solo notificamos
    await this.telegramMessaging.sendTextMessage(
      chatId,
      'Funcionalidad de datos faltantes en desarrollo. Por favor envía el comprobante nuevamente.',
    );

    const chatIdStr = chatId.toString();
    this.conversationState.clearContext(chatIdStr);
    return { success: true };
  }

  /**
   * Limpia archivo temporal de GCS
   */
  private async cleanupUploadedFile(gcsFilename: string): Promise<void> {
    await this.gcsCleanupService.deleteTemporaryProcessingFile(
      gcsFilename,
      'error-en-procesamiento-telegram',
    );
  }
}
