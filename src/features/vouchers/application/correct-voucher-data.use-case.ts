import { Injectable } from '@nestjs/common';
import {
  ConversationStateService,
  ConversationState,
} from '../infrastructure/persistence/conversation-state.service';
import { WhatsAppMessagingService } from '../infrastructure/whatsapp/whatsapp-messaging.service';
import { VoucherValidator } from '../domain/voucher-validator';
import { validateAndSetVoucherField } from '../shared/helpers/field-validator.helper';
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
import { GcsCleanupService } from '@/shared/libs/google-cloud';
import { ConfirmationMessages, ErrorMessages } from '@/shared/content';
import { CONFIRM_CANCEL_BUTTONS } from '../shared/constants/whatsapp-buttons.const';

export interface CorrectVoucherDataInput {
  phoneNumber: string;
  fieldId?: string;
  newValue?: string;
}

export interface CorrectVoucherDataOutput {
  success: boolean;
  message?: string;
}

/**
 * Use Case: Corregir datos del voucher
 *
 * Responsabilidades:
 * - Manejar selección del campo a corregir
 * - Validar que el campo seleccionado sea válido
 * - Manejar caso especial: cancelar todo el registro (eliminar archivo de GCS)
 * - Manejar corrección de fecha con lista interactiva
 * - Validar y actualizar el nuevo valor del campo
 * - Volver a estado de confirmación con datos actualizados
 */
@Injectable()
export class CorrectVoucherDataUseCase {
  constructor(
    private readonly conversationState: ConversationStateService,
    private readonly whatsappMessaging: WhatsAppMessagingService,
    private readonly gcsCleanupService: GcsCleanupService,
  ) {}

  async execute(
    input: CorrectVoucherDataInput,
  ): Promise<CorrectVoucherDataOutput> {
    const { phoneNumber, fieldId, newValue } = input;

    // Si se proporciona fieldId, es la selección del campo a corregir
    if (fieldId && !newValue) {
      return await this.handleCorrectionTypeSelection(phoneNumber, fieldId);
    }

    // Si se proporciona newValue, es el nuevo valor para el campo
    if (newValue) {
      return await this.handleCorrectionValueResponse(phoneNumber, newValue);
    }

    return { success: false, message: 'Invalid input' };
  }

  /**
   * Maneja la selección del campo a corregir
   */
  private async handleCorrectionTypeSelection(
    phoneNumber: string,
    fieldId: string,
  ): Promise<CorrectVoucherDataOutput> {
    // Caso especial: usuario quiere cancelar todo el registro
    if (fieldId === 'cancelar_todo') {
      return await this.handleCancellation(phoneNumber);
    }

    // Validar que el campo seleccionado sea válido
    const validFields = [
      'casa',
      'referencia',
      'fecha_pago',
      'hora_transaccion',
    ];
    if (!validFields.includes(fieldId)) {
      await this.sendWhatsAppMessage(
        phoneNumber,
        'Opción no válida. Por favor selecciona una opción de la lista.',
      );
      return { success: false, message: 'Invalid field' };
    }

    // Guardar el campo a corregir en el contexto
    const context = this.conversationState.getContext(phoneNumber);
    if (!context?.data) {
      await this.sendWhatsAppMessage(phoneNumber, ErrorMessages.sessionExpired);
      this.conversationState.clearContext(phoneNumber);
      return { success: false, message: 'No context data' };
    }

    context.data.fieldToCorrect = fieldId;
    this.conversationState.setContext(
      phoneNumber,
      ConversationState.WAITING_CORRECTION_VALUE,
      context.data,
    );

    // Si el campo a corregir es fecha_pago, enviar lista interactiva
    if (fieldId === 'fecha_pago') {
      const dateOptions = generateRecentDates();
      await this.whatsappMessaging.sendListMessage(
        phoneNumber,
        '📅 Selecciona la fecha correcta del pago:',
        'Seleccionar fecha',
        [
          {
            title: 'Fechas Recientes',
            rows: dateOptions,
          },
        ],
      );
    } else {
      // Para otros campos, pedir el nuevo valor con mensaje de texto
      const fieldLabel = VoucherValidator.getFieldLabel(fieldId);
      await this.sendWhatsAppMessage(
        phoneNumber,
        `Por favor, envía el nuevo valor para: *${fieldLabel}*\n\n` +
          `⚠️ *IMPORTANTE:* Es tu responsabilidad proporcionar los datos correctos para la verificación de tu pago. ` +
          `Verifica cuidadosamente la información antes de enviarla.`,
      );
    }

    return { success: true };
  }

  /**
   * Maneja la cancelación completa del registro
   */
  private async handleCancellation(
    phoneNumber: string,
  ): Promise<CorrectVoucherDataOutput> {
    const savedData =
      this.conversationState.getVoucherDataForConfirmation(phoneNumber);

    if (savedData?.gcsFilename) {
      await this.gcsCleanupService.deleteTemporaryProcessingFile(
        savedData.gcsFilename,
        'cancelacion-usuario',
      );
    }

    await this.sendWhatsAppMessage(phoneNumber, ConfirmationMessages.cancelled);

    this.conversationState.clearContext(phoneNumber);
    return { success: true };
  }

  /**
   * Maneja la respuesta del usuario con el nuevo valor para el campo a corregir
   */
  private async handleCorrectionValueResponse(
    phoneNumber: string,
    newValue: string,
  ): Promise<CorrectVoucherDataOutput> {
    const context = this.conversationState.getContext(phoneNumber);

    if (!context?.data?.fieldToCorrect) {
      await this.sendWhatsAppMessage(phoneNumber, ErrorMessages.sessionExpired);
      this.conversationState.clearContext(phoneNumber);
      return { success: false, message: 'No field to correct' };
    }

    const fieldToCorrect = context.data.fieldToCorrect;
    const fieldLabel = VoucherValidator.getFieldLabel(fieldToCorrect);

    // Si el campo es fecha_pago y el usuario seleccionó "otra", pedir entrada manual
    if (fieldToCorrect === 'fecha_pago' && newValue.trim() === 'otra') {
      await this.sendWhatsAppMessage(
        phoneNumber,
        '📅 Por favor escribe la fecha manualmente.\n\nFormato: DD/MM/AAAA\nEjemplo: 10/10/2025',
      );
      return { success: true };
    }

    // Convertir IDs de fecha si aplica
    let valueToUpdate = newValue.trim();
    if (fieldToCorrect === 'fecha_pago') {
      const convertedDate = convertDateIdToString(valueToUpdate);
      if (convertedDate) {
        valueToUpdate = convertedDate;
      }
    }

    // Validar que tenemos los datos del voucher
    if (!context.data.voucherData) {
      await this.sendWhatsAppMessage(phoneNumber, ErrorMessages.sessionExpired);
      this.conversationState.clearContext(phoneNumber);
      return { success: false, message: 'No voucher data' };
    }

    // Validar el nuevo valor
    const validationResult = validateAndSetVoucherField(
      context.data.voucherData,
      fieldToCorrect,
      valueToUpdate,
    );

    if (!validationResult.isValid) {
      await this.sendWhatsAppMessage(
        phoneNumber,
        `❌ ${validationResult.error}\n\nPor favor, proporciona nuevamente el *${fieldLabel}*:`,
      );
      return { success: true }; // Continue conversation
    }

    // Actualizar el campo en los datos del voucher
    this.conversationState.updateVoucherField(
      phoneNumber,
      fieldToCorrect,
      validationResult.value!,
    );

    // Limpiar el campo temporal
    delete context.data.fieldToCorrect;

    // Volver al estado de confirmación
    this.conversationState.setContext(
      phoneNumber,
      ConversationState.WAITING_CONFIRMATION,
      context.data,
    );

    // Obtener datos actualizados
    const updatedData = context.data.voucherData;

    if (!updatedData) {
      await this.sendWhatsAppMessage(phoneNumber, ErrorMessages.sessionExpired);
      this.conversationState.clearContext(phoneNumber);
      return { success: false, message: 'No updated data' };
    }

    // Enviar confirmación con datos actualizados y botones
    const confirmationMessage = this.buildConfirmationMessage(
      updatedData,
      fieldLabel,
    );

    await this.whatsappMessaging.sendButtonMessage(
      phoneNumber,
      confirmationMessage,
      CONFIRM_CANCEL_BUTTONS,
    );

    return { success: true };
  }

  /**
   * Construye el mensaje de confirmación con datos actualizados
   * Protege contra valores vacíos usando funciones de formato
   */
  private buildConfirmationMessage(
    voucherData: StructuredDataWithCasa,
    updatedFieldLabel: string,
  ): string {
    const parts = [
      `✅ *${updatedFieldLabel}* actualizado correctamente.\n`,
      'Por favor, confirma que los siguientes datos son correctos:\n',
      `📍 Casa: *${formatCasa(voucherData.casa)}*`,
      `💰 Monto: *${formatMonto(voucherData.monto)}*`,
      `📅 Fecha: *${formatFecha(voucherData.fecha_pago)}*`,
      `🕒 Hora: *${formatHora(voucherData.hora_transaccion)}*`,
      `🔢 Referencia: *${formatReferencia(voucherData.referencia)}*`,
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
