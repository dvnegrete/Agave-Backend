import { Injectable } from '@nestjs/common';
import {
  ConversationStateService,
  ConversationState,
} from '../infrastructure/persistence/conversation-state.service';
import { WhatsAppMessagingService } from '../infrastructure/whatsapp/whatsapp-messaging.service';
import { VoucherValidator } from '../domain/voucher-validator';
import { validateAndUpdateVoucherField } from '../shared/helpers/field-validator.helper';
import {
  generateRecentDates,
  convertDateIdToString,
} from '../shared/helpers/date-converter.helper';
import {
  formatMonto,
  formatCasa,
  formatFecha,
  formatHora,
  formatReferencia,
} from '../shared/helpers/voucher-formatter.helper';
import { StructuredDataWithCasa } from '../infrastructure/ocr/voucher-processor.service';
import { ErrorMessages } from '@/shared/content';
import { CONFIRM_CANCEL_BUTTONS } from '../shared/constants/whatsapp-buttons.const';
import { GcsCleanupService } from '@/shared/libs/google-cloud';

export interface HandleMissingDataInput {
  phoneNumber: string;
  messageText: string;
}

export interface HandleMissingDataOutput {
  success: boolean;
  message?: string;
}

/**
 * Use Case: Manejar respuestas del usuario para datos faltantes
 *
 * Responsabilidades:
 * - Obtener el campo actual que se está solicitando
 * - Manejar selección de fecha (si es fecha_pago) - mostrar lista o convertir IDs
 * - Validar el valor proporcionado
 * - Actualizar datos del voucher en el contexto
 * - Determinar si hay más campos faltantes o mostrar confirmación final
 */
@Injectable()
export class HandleMissingDataUseCase {
  constructor(
    private readonly conversationState: ConversationStateService,
    private readonly whatsappMessaging: WhatsAppMessagingService,
    private readonly gcsCleanupService: GcsCleanupService,
  ) {}

  async execute(
    input: HandleMissingDataInput,
  ): Promise<HandleMissingDataOutput> {
    const { phoneNumber, messageText } = input;

    // 1. Obtener contexto actual
    const context = this.conversationState.getContext(phoneNumber);
    if (!context?.data) {
      await this.sendWhatsAppMessage(
        phoneNumber,
        'No tengo datos guardados. Por favor envía nuevamente el comprobante.',
      );
      this.conversationState.clearContext(phoneNumber);
      return { success: false, message: 'No context data found' };
    }

    const { voucherData, missingFields, gcsFilename, originalFilename } =
      context.data;

    if (!missingFields || missingFields.length === 0) {
      return await this.handleNoMoreMissingFields(phoneNumber, gcsFilename);
    }

    // 2. Obtener el campo actual que se está solicitando
    const currentField = missingFields[0];

    // 3. Si el usuario seleccionó "otra" fecha, pedir entrada manual
    if (currentField === 'fecha_pago' && messageText === 'otra') {
      await this.sendWhatsAppMessage(
        phoneNumber,
        'Por favor escribe la fecha de pago en formato DD/MM/YYYY (ejemplo: 15/01/2025)',
      );
      return { success: true };
    }

    // 4. Convertir IDs de fecha si aplica
    let valueToValidate = messageText;
    if (currentField === 'fecha_pago') {
      const convertedDate = convertDateIdToString(messageText);
      if (convertedDate) {
        valueToValidate = convertedDate;
      }
    }

    // 5. Validar y actualizar el valor atomicamente
    if (!voucherData) {
      await this.sendWhatsAppMessage(phoneNumber, ErrorMessages.sessionExpired);
      this.conversationState.clearContext(phoneNumber);
      return { success: false, message: 'No voucher data' };
    }

    const validationResult = validateAndUpdateVoucherField(
      voucherData,
      currentField,
      valueToValidate,
    );

    if (!validationResult.isValid) {
      await this.sendWhatsAppMessage(
        phoneNumber,
        validationResult.error || 'Valor inválido',
      );
      return { success: true }; // Continue conversation
    }

    // El valor ya está actualizado en voucherData de forma atomica

    // 6. Remover el campo de la lista de faltantes
    const updatedMissingFields = missingFields.slice(1);

    // 7. Verificar si hay más campos faltantes
    if (updatedMissingFields.length > 0) {
      // Actualizar contexto con nuevo campo faltante
      this.conversationState.setContext(
        phoneNumber,
        ConversationState.WAITING_MISSING_DATA,
        {
          voucherData,
          gcsFilename,
          originalFilename,
          missingFields: updatedMissingFields,
        },
      );

      // Preguntar por el siguiente campo
      const nextField = updatedMissingFields[0];

      if (nextField === 'fecha_pago') {
        // Mostrar lista de fechas
        await this.whatsappMessaging.sendListMessage(
          phoneNumber,
          'Selecciona la fecha de pago',
          'Seleccionar fecha',
          [{ rows: generateRecentDates() }],
        );
      } else {
        // Preguntar por el siguiente campo
        const fieldLabel = VoucherValidator.getFieldLabel(nextField);
        await this.sendWhatsAppMessage(
          phoneNumber,
          `Por favor proporciona el siguiente dato:\n\n*${fieldLabel}*`,
        );
      }

      return { success: true };
    } else {
      // 8. Todos los datos están completos → Mostrar confirmación
      // Verificar que tenemos los datos del archivo
      if (!gcsFilename || !originalFilename) {
        await this.sendWhatsAppMessage(
          phoneNumber,
          'Error: No se encontraron los datos del archivo.',
        );
        this.conversationState.clearContext(phoneNumber);
        return { success: false, message: 'Missing file data' };
      }

      return await this.showFinalConfirmation(
        phoneNumber,
        voucherData,
        gcsFilename,
        originalFilename,
      );
    }
  }

  /**
   * Maneja el caso cuando no hay más campos faltantes
   * BUGFIX: Limpia archivo GCS temporal para evitar archivos huérfanos
   */
  private async handleNoMoreMissingFields(
    phoneNumber: string,
    gcsFilename?: string,
  ): Promise<HandleMissingDataOutput> {
    // Limpiar archivo GCS temporal (prevenir archivos huérfanos)
    if (gcsFilename) {
      await this.gcsCleanupService.deleteTemporaryProcessingFile(
        gcsFilename,
        'flujo-incompleto-sin-campos-faltantes',
      );
    }

    await this.sendWhatsAppMessage(
      phoneNumber,
      'Ocurrió un error en el flujo. Por favor envía nuevamente el comprobante.',
    );
    this.conversationState.clearContext(phoneNumber);
    return {
      success: false,
      message: 'No missing fields but unexpected state',
    };
  }

  /**
   * Muestra la confirmación final con todos los datos completos
   */
  private async showFinalConfirmation(
    phoneNumber: string,
    voucherData: StructuredDataWithCasa,
    gcsFilename: string,
    originalFilename: string,
  ): Promise<HandleMissingDataOutput> {
    // Verificar que tenemos todos los datos necesarios
    if (!gcsFilename || !originalFilename) {
      await this.sendWhatsAppMessage(
        phoneNumber,
        'Error: No se encontraron los datos del archivo.',
      );
      this.conversationState.clearContext(phoneNumber);
      return { success: false, message: 'Missing file data' };
    }

    // Guardar para confirmación
    this.conversationState.saveVoucherForConfirmation(
      phoneNumber,
      voucherData,
      gcsFilename,
      originalFilename,
    );

    // Construir mensaje de confirmación
    const confirmationMessage = this.buildConfirmationMessage(voucherData);

    // Enviar botones de confirmación
    await this.whatsappMessaging.sendButtonMessage(
      phoneNumber,
      confirmationMessage,
      CONFIRM_CANCEL_BUTTONS,
    );

    return { success: true };
  }

  /**
   * Construye el mensaje de confirmación con los datos del voucher
   * Protege contra valores vacíos usando funciones de formato
   */
  private buildConfirmationMessage(
    voucherData: StructuredDataWithCasa,
  ): string {
    const parts = [
      '📋 *Datos del comprobante:*\n',
      `🏠 Casa: *${formatCasa(voucherData.casa)}*`,
      `💰 Monto: *${formatMonto(voucherData.monto)}*`,
      `📅 Fecha: *${formatFecha(voucherData.fecha_pago)}*`,
      `🔢 Referencia: *${formatReferencia(voucherData.referencia)}*`,
      `⏰ Hora: *${formatHora(voucherData.hora_transaccion)}*`,
      '\n¿Los datos son correctos?',
    ];

    return parts.join('\n');
  }

  private async sendWhatsAppMessage(
    to: string,
    message: string,
  ): Promise<void> {
    await this.whatsappMessaging.sendTextMessage(to, message);
  }
}
