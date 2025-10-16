import { Injectable } from '@nestjs/common';
import { ConversationStateService } from '../infrastructure/persistence/conversation-state.service';
import { WhatsAppMessagingService } from '../infrastructure/whatsapp/whatsapp-messaging.service';
import { StructuredDataWithCasa } from '../infrastructure/ocr/voucher-processor.service';
import { validateHouseNumber } from '@/shared/common/utils/validation/field-validator.util';
import {
  formatMonto,
  formatCasa,
  formatFecha,
  formatHora,
  formatReferencia,
} from '../shared/helpers/voucher-formatter.helper';
import { ErrorMessages } from '@/shared/content';
import { CONFIRM_CANCEL_BUTTONS } from '../shared/constants/whatsapp-buttons.const';

export interface HandleHouseNumberInput {
  phoneNumber: string;
  messageText: string;
}

export interface HandleHouseNumberOutput {
  success: boolean;
  message?: string;
}

/**
 * Use Case: Manejar respuesta del número de casa
 *
 * Responsabilidades:
 * - Validar el número de casa proporcionado por el usuario
 * - Actualizar los datos del voucher con el número de casa
 * - Mostrar confirmación final con todos los datos completos
 */
@Injectable()
export class HandleHouseNumberUseCase {
  constructor(
    private readonly conversationState: ConversationStateService,
    private readonly whatsappMessaging: WhatsAppMessagingService,
  ) {}

  async execute(
    input: HandleHouseNumberInput,
  ): Promise<HandleHouseNumberOutput> {
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

    const { voucherData, gcsFilename, originalFilename } = context.data;

    // 2. Verificar que tenemos todos los datos necesarios
    if (!voucherData || !gcsFilename || !originalFilename) {
      await this.sendWhatsAppMessage(phoneNumber, ErrorMessages.sessionExpired);
      this.conversationState.clearContext(phoneNumber);
      return { success: false, message: 'Missing data' };
    }

    // 3. Validar el número de casa
    const validationResult = validateHouseNumber(messageText, 1, 66);

    if (!validationResult.isValid) {
      await this.sendWhatsAppMessage(
        phoneNumber,
        validationResult.error ||
          'El número de casa debe ser un número entre 1 y 66',
      );
      return { success: true }; // Continue conversation
    }

    // 4. Actualizar el voucher con el número de casa
    voucherData.casa = parseInt(validationResult.value!, 10);

    // 5. Guardar para confirmación
    this.conversationState.saveVoucherForConfirmation(
      phoneNumber,
      voucherData,
      gcsFilename,
      originalFilename,
    );

    // 5. Mostrar confirmación final
    const confirmationMessage = this.buildConfirmationMessage(voucherData);

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
