import { Injectable, Logger } from '@nestjs/common';
import { TelegramApiService } from './telegram-api.service';
import TelegramBot from 'node-telegram-bot-api';

export interface InlineButtonOption {
  text: string;
  callbackData: string;
}

/**
 * Servicio de alto nivel para enviar mensajes a través de Telegram Bot API
 * Soporta mensajes de texto, botones inline, markdown y formato
 */
@Injectable()
export class TelegramMessagingService {
  private readonly logger = new Logger(TelegramMessagingService.name);

  constructor(private readonly telegramApi: TelegramApiService) {}

  /**
   * Envía un mensaje de texto simple
   * @param chatId - ID del chat de Telegram
   * @param message - Texto del mensaje
   */
  async sendTextMessage(
    chatId: number | string,
    message: string,
  ): Promise<void> {
    try {
      await this.telegramApi.sendMessage(chatId, message);
      this.logger.log(`Mensaje de texto enviado exitosamente a ${chatId}`);
    } catch (error) {
      this.logger.error(
        `Error al enviar mensaje de texto a ${chatId}: ${error.message}`,
      );
      throw error;
    }
  }

  /**
   * Envía un mensaje con formato Markdown
   * @param chatId - ID del chat
   * @param message - Texto con formato Markdown
   */
  async sendMarkdownMessage(
    chatId: number | string,
    message: string,
  ): Promise<void> {
    try {
      await this.telegramApi.sendMessage(chatId, message, {
        parse_mode: 'Markdown',
      });
      this.logger.log(
        `Mensaje con Markdown enviado exitosamente a ${chatId}`,
      );
    } catch (error) {
      this.logger.error(
        `Error al enviar mensaje con Markdown a ${chatId}: ${error.message}`,
      );
      throw error;
    }
  }

  /**
   * Envía un mensaje con botones inline
   * @param chatId - ID del chat
   * @param message - Texto del mensaje
   * @param buttons - Array de botones inline (hasta 8 por fila recomendado)
   */
  async sendMessageWithButtons(
    chatId: number | string,
    message: string,
    buttons: InlineButtonOption[],
  ): Promise<void> {
    try {
      // Crear teclado inline (botones en filas)
      const keyboard: TelegramBot.InlineKeyboardButton[][] = buttons.map(
        (btn) => [
          {
            text: btn.text,
            callback_data: btn.callbackData,
          },
        ],
      );

      await this.telegramApi.sendMessage(chatId, message, {
        reply_markup: {
          inline_keyboard: keyboard,
        },
      });

      this.logger.log(
        `Mensaje con ${buttons.length} botones enviado exitosamente a ${chatId}`,
      );
    } catch (error) {
      this.logger.error(
        `Error al enviar mensaje con botones a ${chatId}: ${error.message}`,
      );
      throw error;
    }
  }

  /**
   * Envía solicitud de confirmación de datos del voucher
   * @param chatId - ID del chat
   * @param voucherData - Datos extraídos del voucher
   */
  async sendConfirmationRequest(
    chatId: number | string,
    voucherData: {
      monto: string;
      fecha_pago: string;
      casa: number;
      referencia: string;
      hora_transaccion: string;
    },
  ): Promise<void> {
    const message = `
✅ *Datos extraídos del comprobante:*

💰 Monto: *$${voucherData.monto}*
📅 Fecha: ${voucherData.fecha_pago}
🏠 Casa: *${voucherData.casa}*
🔢 Referencia: ${voucherData.referencia}
⏰ Hora: ${voucherData.hora_transaccion}

¿Los datos son correctos?
    `.trim();

    const buttons: InlineButtonOption[] = [
      { text: '✅ Sí, confirmar', callbackData: 'confirm_yes' },
      { text: '❌ No, corregir', callbackData: 'confirm_no' },
    ];

    await this.sendMessageWithButtons(chatId, message, buttons);
  }

  /**
   * Envía solicitud de número de casa
   * @param chatId - ID del chat
   */
  async sendHouseNumberRequest(chatId: number | string): Promise<void> {
    const message = `
🏠 *Número de casa no detectado*

Por favor, responde con el número de casa para este comprobante.

Ejemplo: 101
    `.trim();

    await this.sendMarkdownMessage(chatId, message);
  }

  /**
   * Envía solicitud de datos faltantes
   * @param chatId - ID del chat
   * @param missingFields - Lista de campos faltantes
   */
  async sendMissingDataRequest(
    chatId: number | string,
    missingFields: string[],
  ): Promise<void> {
    const fieldsText = missingFields
      .map((field) => `• ${this.translateField(field)}`)
      .join('\n');

    const message = `
⚠️ *Datos incompletos en el comprobante*

Faltan los siguientes datos:
${fieldsText}

Por favor, envía los datos faltantes en el siguiente formato:
\`\`\`
Campo: Valor
Campo: Valor
\`\`\`

Ejemplo:
\`\`\`
Casa: 101
Monto: 1500.00
\`\`\`
    `.trim();

    await this.sendMarkdownMessage(chatId, message);
  }

  /**
   * Envía mensaje de error
   * @param chatId - ID del chat
   * @param errorMessage - Mensaje de error
   */
  async sendErrorMessage(
    chatId: number | string,
    errorMessage: string,
  ): Promise<void> {
    const message = `
❌ *Error al procesar comprobante*

${errorMessage}

Por favor, intenta enviar el comprobante nuevamente o contacta al administrador.
    `.trim();

    await this.sendMarkdownMessage(chatId, message);
  }

  /**
   * Envía mensaje de éxito
   * @param chatId - ID del chat
   * @param details - Detalles adicionales (opcional)
   */
  async sendSuccessMessage(
    chatId: number | string,
    details?: string,
  ): Promise<void> {
    const message = details
      ? `✅ *Comprobante procesado exitosamente*\n\n${details}`
      : '✅ *Comprobante procesado exitosamente*';

    await this.sendMarkdownMessage(chatId, message);
  }

  /**
   * Envía mensaje de bienvenida
   * @param chatId - ID del chat
   */
  async sendWelcomeMessage(chatId: number | string): Promise<void> {
    const message = `
👋 *¡Bienvenido al Bot de Comprobantes!*

Envíame una foto o documento PDF de tu comprobante de pago y lo procesaré automáticamente.

📸 Formatos soportados:
• Fotos (JPG, PNG)
• Documentos PDF

💡 Asegúrate de que el comprobante sea legible y contenga:
• Monto del pago
• Fecha de transacción
• Referencia o número de operación
    `.trim();

    await this.sendMarkdownMessage(chatId, message);
  }

  /**
   * Envía mensaje de ayuda
   * @param chatId - ID del chat
   */
  async sendHelpMessage(chatId: number | string): Promise<void> {
    const message = `
ℹ️ *Ayuda - Bot de Comprobantes*

*Cómo usar:*
1. Envía una foto o PDF de tu comprobante
2. El bot extraerá los datos automáticamente
3. Confirma o corrige los datos si es necesario

*Comandos:*
/start - Mensaje de bienvenida
/ayuda - Ver este mensaje de ayuda

*¿Problemas?*
Contacta al administrador del sistema.
    `.trim();

    await this.sendMarkdownMessage(chatId, message);
  }

  /**
   * Traduce nombres de campos técnicos a texto legible
   */
  private translateField(field: string): string {
    const translations: { [key: string]: string } = {
      monto: 'Monto',
      fecha_pago: 'Fecha de pago',
      casa: 'Número de casa',
      referencia: 'Referencia',
      hora_transaccion: 'Hora de transacción',
    };

    return translations[field] || field;
  }
}
