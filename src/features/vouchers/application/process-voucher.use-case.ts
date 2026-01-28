import { Injectable, Logger } from '@nestjs/common';
import {
  VoucherProcessorService,
  VoucherProcessingResult,
} from '../infrastructure/ocr/voucher-processor.service';
import {
  ConversationStateService,
  ConversationState,
} from '../infrastructure/persistence/conversation-state.service';
import { WhatsAppMessagingService } from '../infrastructure/whatsapp/whatsapp-messaging.service';
import { WhatsAppMediaService } from '../infrastructure/whatsapp/whatsapp-media.service';
import { GcsCleanupService } from '@/shared/libs/google-cloud';
import { VoucherValidator } from '../domain/voucher-validator';
import { ErrorMessages } from '@/shared/content';
import { CONFIRM_CANCEL_BUTTONS } from '../shared/constants/whatsapp-buttons.const';
import { generateRecentDates } from '../shared/helpers/date-converter.helper';

export interface ProcessVoucherInput {
  phoneNumber: string;
  mediaId: string;
  mediaType: 'image' | 'document';
}

export interface ProcessVoucherOutput {
  success: boolean;
  message?: string;
}

/**
 * Use Case: Procesar un voucher desde WhatsApp
 *
 * Responsabilidades:
 * - Descargar el archivo multimedia de WhatsApp
 * - Validar el tipo de archivo
 * - Procesar el voucher con OCR
 * - Determinar el flujo según datos extraídos (completos/falta casa/faltan datos)
 * - Actualizar el estado de conversación
 * - Enviar respuesta apropiada al usuario
 */
@Injectable()
export class ProcessVoucherUseCase {
  private readonly logger = new Logger(ProcessVoucherUseCase.name);

  constructor(
    private readonly voucherProcessor: VoucherProcessorService,
    private readonly whatsappMedia: WhatsAppMediaService,
    private readonly whatsappMessaging: WhatsAppMessagingService,
    private readonly conversationState: ConversationStateService,
    private readonly gcsCleanupService: GcsCleanupService,
  ) {}

  async execute(input: ProcessVoucherInput): Promise<ProcessVoucherOutput> {
    let gcsFilename: string | undefined;

    try {
      const { phoneNumber, mediaId, mediaType } = input;

      // 1. Descargar el archivo desde WhatsApp
      const { buffer, mimeType, filename } =
        await this.whatsappMedia.downloadMedia(mediaId);

      // 2. Validar que el tipo de archivo sea soportado
      if (!this.whatsappMedia.isSupportedMediaType(mimeType)) {
        await this.sendWhatsAppMessage(
          phoneNumber,
          ErrorMessages.unsupportedFileType(mimeType),
        );
        return { success: false };
      }

      // 3. Procesar el comprobante usando el servicio unificado
      const result = await this.voucherProcessor.processVoucher(
        buffer,
        filename,
        'es',
        phoneNumber,
      );

      // Guardar el nombre del archivo para eliminarlo en caso de error
      gcsFilename = result.gcsFilename;

      const voucherData = result.structuredData;

      // 4. Determinar el flujo según los datos extraídos
      if (!voucherData.faltan_datos && typeof voucherData.casa === 'number') {
        // CASO 1: Datos completos → Guardar y pedir confirmación
        return await this.handleCompleteData(phoneNumber, result);
      } else if (!voucherData.faltan_datos && voucherData.casa === null) {
        // CASO 2: Falta número de casa → Preguntar por casa
        return await this.handleMissingHouseNumber(phoneNumber, result);
      } else if (voucherData.faltan_datos) {
        // CASO 3: Faltan datos → Identificar y preguntar por primer campo
        return await this.handleMissingData(phoneNumber, result);
      }

      return { success: true };
    } catch (error) {
      // Eliminar el archivo del bucket si fue subido exitosamente antes del error
      if (gcsFilename) {
        await this.cleanupUploadedFile(gcsFilename);
      }

      await this.sendWhatsAppMessage(
        input.phoneNumber,
        ErrorMessages.processingError,
      );
      return { success: false, message: error.message };
    }
  }

  /**
   * Limpia el archivo temporal subido a Google Cloud Storage
   * Delegado al servicio centralizado de limpieza
   */
  private async cleanupUploadedFile(gcsFilename: string): Promise<void> {
    await this.gcsCleanupService.deleteTemporaryProcessingFile(
      gcsFilename,
      'error-en-procesamiento',
    );
  }

  /**
   * Maneja el caso cuando todos los datos están completos
   */
  private async handleCompleteData(
    phoneNumber: string,
    result: VoucherProcessingResult,
  ): Promise<ProcessVoucherOutput> {
    const voucherData = result.structuredData;

    this.conversationState.saveVoucherForConfirmation(
      phoneNumber,
      voucherData,
      result.gcsFilename,
      result.originalFilename,
    );

    await this.whatsappMessaging.sendButtonMessage(
      phoneNumber,
      result.whatsappMessage,
      CONFIRM_CANCEL_BUTTONS,
    );

    return { success: true };
  }

  /**
   * Maneja el caso cuando falta el número de casa
   */
  private async handleMissingHouseNumber(
    phoneNumber: string,
    result: VoucherProcessingResult,
  ): Promise<ProcessVoucherOutput> {
    const voucherData = result.structuredData;

    this.conversationState.setContext(
      phoneNumber,
      ConversationState.WAITING_HOUSE_NUMBER,
      {
        voucherData,
        gcsFilename: result.gcsFilename,
        originalFilename: result.originalFilename,
      },
    );

    await this.sendWhatsAppMessage(phoneNumber, result.whatsappMessage);

    return { success: true };
  }

  /**
   * Maneja el caso cuando faltan múltiples datos
   * Si el primer campo faltante es fecha_pago, envía lista de fechas recientes
   * Si es otro campo, pide entrada de texto
   */
  private async handleMissingData(
    phoneNumber: string,
    result: VoucherProcessingResult,
  ): Promise<ProcessVoucherOutput> {
    const voucherData = result.structuredData;
    const missingFields = VoucherValidator.identifyMissingFields(voucherData);

    this.conversationState.setContext(
      phoneNumber,
      ConversationState.WAITING_MISSING_DATA,
      {
        voucherData,
        gcsFilename: result.gcsFilename,
        originalFilename: result.originalFilename,
        missingFields,
      },
    );

    const firstMissingField = missingFields[0];
    const fieldLabel = VoucherValidator.getFieldLabel(firstMissingField);

    // Si el campo faltante es fecha_pago, enviar lista de fechas recientes
    if (firstMissingField === 'fecha_pago') {
      const dateOptions = generateRecentDates();
      await this.whatsappMessaging.sendListMessage(
        phoneNumber,
        'No pude extraer la fecha del comprobante.\n\nPor favor selecciona la fecha de pago:',
        'Seleccionar fecha',
        [
          {
            title: 'Fechas Recientes',
            rows: dateOptions,
          },
        ],
      );
    } else {
      // Para otros campos, pedir entrada de texto
      await this.sendWhatsAppMessage(
        phoneNumber,
        `No pude extraer todos los datos del comprobante.\n\nPor favor proporciona el siguiente dato:\n\n*${fieldLabel}*`,
      );
    }

    return { success: true };
  }

  private async sendWhatsAppMessage(
    to: string,
    message: string,
  ): Promise<void> {
    await this.whatsappMessaging.sendTextMessage(to, message);
  }
}
