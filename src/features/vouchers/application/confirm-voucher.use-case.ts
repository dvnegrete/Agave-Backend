import { Injectable } from '@nestjs/common';
import { VoucherRepository } from '@/shared/database/repositories/voucher.repository';
import { ConversationStateService } from '../services/conversation-state.service';
import { WhatsAppMessagingService } from '../services/whatsapp-messaging.service';
import { ConfirmationMessages, ErrorMessages } from '@/shared/content';
import { combineDateAndTime } from '@/shared/common/utils';
import { generateUniqueConfirmationCode } from '../shared/helpers';

export interface ConfirmVoucherInput {
  phoneNumber: string;
}

export interface ConfirmVoucherOutput {
  success: boolean;
  confirmationCode?: string;
  error?: string;
}

/**
 * Use Case: Confirmar y registrar un voucher en la base de datos
 *
 * Responsabilidades:
 * - Validar que existan datos guardados para confirmación
 * - Combinar fecha y hora
 * - Generar código de confirmación único (con retry logic)
 * - Insertar voucher en base de datos
 * - Enviar mensaje de éxito al usuario
 * - Limpiar contexto de conversación
 */
@Injectable()
export class ConfirmVoucherUseCase {
  constructor(
    private readonly voucherRepository: VoucherRepository,
    private readonly conversationState: ConversationStateService,
    private readonly whatsappMessaging: WhatsAppMessagingService,
  ) {}

  async execute(input: ConfirmVoucherInput): Promise<ConfirmVoucherOutput> {
    try {
      const { phoneNumber } = input;

      // 1. Obtener datos guardados para confirmación
      const savedData =
        this.conversationState.getVoucherDataForConfirmation(phoneNumber);

      if (!savedData) {
        await this.sendWhatsAppMessage(phoneNumber, ErrorMessages.sessionExpired);
        this.conversationState.clearContext(phoneNumber);
        return { success: false, error: 'Session expired' };
      }

      // 2. Combinar fecha y hora para el campo timestamp
      const dateTime = combineDateAndTime(
        savedData.voucherData.fecha_pago,
        savedData.voucherData.hora_transaccion,
      );

      // 3. Preparar datos del voucher
      const voucherData = {
        date: dateTime,
        authorization_number: savedData.voucherData.referencia || 'N/A',
        amount: parseFloat(savedData.voucherData.monto),
        confirmation_status: false,
        url: savedData.gcsFilename,
      };

      // 4. Generar código único e insertar voucher (con retry logic)
      const result = await generateUniqueConfirmationCode(
        this.voucherRepository,
        voucherData,
      );

      if (!result.success) {
        await this.sendWhatsAppMessage(
          phoneNumber,
          'Hubo un error al registrar tu pago. Por favor intenta nuevamente más tarde.',
        );
        this.conversationState.clearContext(phoneNumber);
        return { success: false, error: result.error };
      }

      // 5. Enviar mensaje de éxito con el código de confirmación
      const confirmationData = {
        casa: savedData.voucherData.casa!,
        monto: savedData.voucherData.monto,
        fecha_pago: savedData.voucherData.fecha_pago,
        referencia: savedData.voucherData.referencia,
        hora_transaccion: savedData.voucherData.hora_transaccion,
        confirmation_code: result.code!,
      };

      await this.sendWhatsAppMessage(
        phoneNumber,
        ConfirmationMessages.success(confirmationData),
      );

      // 6. Limpiar contexto
      this.conversationState.clearContext(phoneNumber);

      return { success: true, confirmationCode: result.code };
    } catch (error) {
      console.error(`Error confirmando voucher: ${error.message}`);
      await this.sendWhatsAppMessage(
        input.phoneNumber,
        'Hubo un error al registrar tu pago. Por favor intenta nuevamente más tarde.',
      );
      this.conversationState.clearContext(input.phoneNumber);
      return { success: false, error: error.message };
    }
  }

  private async sendWhatsAppMessage(
    to: string,
    message: string,
  ): Promise<void> {
    await this.whatsappMessaging.sendTextMessage(to, message);
  }
}
