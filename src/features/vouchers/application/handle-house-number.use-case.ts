import { Injectable } from '@nestjs/common';
import { ConversationStateService } from '../infrastructure/persistence/conversation-state.service';
import { WhatsAppMessagingService } from '../infrastructure/whatsapp/whatsapp-messaging.service';
import { StructuredDataWithCasa } from '../infrastructure/ocr/voucher-processor.service';
import { validateHouseNumber } from '@/shared/common/utils/validation/field-validator.util';
import { ErrorMessages } from '@/shared/content';

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
      [
        { id: 'confirm', title: '✅ Sí, es correcto' },
        { id: 'cancel', title: '❌ No, editar datos' },
      ],
    );

    return { success: true };
  }

  /**
   * Construye el mensaje de confirmación con los datos del voucher
   */
  private buildConfirmationMessage(
    voucherData: StructuredDataWithCasa,
  ): string {
    const parts = [
      '📋 *Datos del comprobante:*\n',
      `🏠 Casa: *${voucherData.casa}*`,
      `💰 Monto: *$${voucherData.monto}*`,
      `📅 Fecha: *${voucherData.fecha_pago}*`,
    ];

    if (voucherData.referencia) {
      parts.push(`🔢 Referencia: *${voucherData.referencia}*`);
    }

    parts.push(
      `⏰ Hora: *${voucherData.hora_transaccion}*`,
      '\n¿Los datos son correctos?',
    );

    return parts.join('\n');
  }

  private async sendWhatsAppMessage(
    to: string,
    message: string,
  ): Promise<void> {
    await this.whatsappMessaging.sendTextMessage(to, message);
  }
}
