import { Injectable } from '@nestjs/common';
import { ConversationStateService, ConversationState } from '../services/conversation-state.service';
import { ConfirmVoucherUseCase } from './confirm-voucher.use-case';
import { HandleMissingDataUseCase } from './handle-missing-data.use-case';
import { HandleHouseNumberUseCase } from './handle-house-number.use-case';
import { CorrectVoucherDataUseCase } from './correct-voucher-data.use-case';
import { WhatsAppMessagingService } from '../services/whatsapp-messaging.service';
import { ConfirmationMessages } from '@/shared/content';

export interface HandleWhatsAppMessageInput {
  phoneNumber: string;
  messageText: string;
}

export interface HandleWhatsAppMessageOutput {
  success: boolean;
  message?: string;
}

/**
 * Use Case: Manejar mensajes de WhatsApp según el contexto de conversación
 *
 * Responsabilidades:
 * - Detectar el estado de la conversación
 * - Delegar a los use-cases apropiados según el estado
 * - Manejar confirmación (SI/NO)
 * - Manejar respuesta de casa faltante
 * - Manejar datos faltantes
 * - Manejar selección de campo a corregir
 * - Manejar nuevo valor de corrección
 */
@Injectable()
export class HandleWhatsAppMessageUseCase {
  constructor(
    private readonly conversationState: ConversationStateService,
    private readonly confirmVoucher: ConfirmVoucherUseCase,
    private readonly handleMissingData: HandleMissingDataUseCase,
    private readonly handleHouseNumber: HandleHouseNumberUseCase,
    private readonly correctVoucherData: CorrectVoucherDataUseCase,
    private readonly whatsappMessaging: WhatsAppMessagingService,
  ) {}

  async execute(
    input: HandleWhatsAppMessageInput,
  ): Promise<HandleWhatsAppMessageOutput> {
    const { phoneNumber, messageText } = input;

    // Obtener contexto de conversación
    const context = this.conversationState.getContext(phoneNumber);

    if (!context) {
      // No hay contexto activo, no hacer nada
      return { success: true };
    }

    // Actualizar timestamp de último mensaje
    this.conversationState.updateLastMessageTime(phoneNumber);

    // Delegar según el estado de la conversación
    switch (context.state) {
      case ConversationState.WAITING_CONFIRMATION:
        return await this.handleConfirmation(phoneNumber, messageText);

      case ConversationState.WAITING_HOUSE_NUMBER:
        return await this.handleHouseNumber.execute({ phoneNumber, messageText });

      case ConversationState.WAITING_MISSING_DATA:
        return await this.handleMissingData.execute({ phoneNumber, messageText });

      case ConversationState.WAITING_CORRECTION_TYPE:
        return await this.handleCorrectionType(phoneNumber, messageText);

      case ConversationState.WAITING_CORRECTION_VALUE:
        return await this.correctVoucherData.execute({ phoneNumber, newValue: messageText });

      default:
        console.log(`Estado no manejado: ${context.state}`);
        this.conversationState.clearContext(phoneNumber);
        return { success: false, message: 'Estado no reconocido' };
    }
  }

  /**
   * Maneja la confirmación del usuario (SI/NO)
   */
  private async handleConfirmation(
    phoneNumber: string,
    messageText: string,
  ): Promise<HandleWhatsAppMessageOutput> {
    const isConfirmation =
      messageText === 'confirm' ||
      this.conversationState.isConfirmationMessage(messageText);

    const isNegation =
      messageText === 'cancel' ||
      this.conversationState.isNegationMessage(messageText);

    if (isConfirmation) {
      // Usuario confirmó → Registrar voucher
      return await this.confirmVoucher.execute({ phoneNumber });
    } else if (isNegation) {
      // Usuario indicó que los datos NO son correctos → Ofrecer corrección
      return await this.offerCorrection(phoneNumber);
    } else {
      // Mensaje no reconocido, pedir confirmación nuevamente
      await this.whatsappMessaging.sendTextMessage(
        phoneNumber,
        ConfirmationMessages.retry,
      );
      return { success: true };
    }
  }

  /**
   * Ofrece opciones de corrección al usuario
   */
  private async offerCorrection(
    phoneNumber: string,
  ): Promise<HandleWhatsAppMessageOutput> {
    const context = this.conversationState.getContext(phoneNumber);
    if (context?.data) {
      this.conversationState.setContext(
        phoneNumber,
        ConversationState.WAITING_CORRECTION_TYPE,
        context.data,
      );

      await this.whatsappMessaging.sendListMessage(
        phoneNumber,
        '¿Qué dato deseas corregir?',
        'Seleccionar dato',
        [
          {
            rows: [
              {
                id: 'casa',
                title: 'Número de casa',
                description: 'Corregir el número de casa',
              },
              {
                id: 'referencia',
                title: 'Referencia',
                description: 'Corregir la referencia bancaria',
              },
              {
                id: 'fecha_pago',
                title: 'Fecha',
                description: 'Corregir la fecha de pago',
              },
              {
                id: 'hora_transaccion',
                title: 'Hora',
                description: 'Corregir la hora de transacción',
              },
              {
                id: 'cancelar_todo',
                title: '❌ Cancelar registro',
                description: 'No registrar este pago',
              },
            ],
          },
        ],
      );
    }

    return { success: true };
  }

  /**
   * Maneja la selección del tipo de corrección
   */
  private async handleCorrectionType(
    phoneNumber: string,
    fieldId: string,
  ): Promise<HandleWhatsAppMessageOutput> {
    // Delegar al use-case de corrección
    return await this.correctVoucherData.execute({
      phoneNumber,
      fieldId,
    });
  }
}
