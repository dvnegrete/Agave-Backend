import { Injectable, Logger } from '@nestjs/common';
import * as TelegramBot from 'node-telegram-bot-api';

/**
 * Servicio para interactuar con Telegram Bot API
 * Maneja autenticación, envío de mensajes, descarga de archivos y configuración de webhook
 */
@Injectable()
export class TelegramApiService {
  private readonly logger = new Logger(TelegramApiService.name);
  private readonly bot: TelegramBot | null = null;
  private readonly botToken: string;
  private readonly apiUrl = 'https://api.telegram.org';

  constructor() {
    this.botToken = process.env.TELEGRAM_BOT_TOKEN || '';

    if (!this.botToken) {
      this.logger.warn(
        'TELEGRAM_BOT_TOKEN no está configurado. El servicio de Telegram no funcionará correctamente.',
      );
    } else {
      // Inicializar bot sin polling (usaremos webhooks)
      this.bot = new TelegramBot(this.botToken, { polling: false });
      this.logger.log('TelegramApiService inicializado correctamente');
    }
  }

  /**
   * Verifica si el servicio está configurado correctamente
   */
  isConfigured(): boolean {
    return !!this.botToken && !!this.bot;
  }

  /**
   * Obtiene información del bot
   */
  async getMe(): Promise<TelegramBot.User> {
    if (!this.isConfigured()) {
      throw new Error('Telegram Bot not configured');
    }

    try {
      const botInfo = await this.bot!.getMe();
      this.logger.debug(`Bot info: @${botInfo.username}`);
      return botInfo;
    } catch (error) {
      this.logger.error(`Error getting bot info: ${error.message}`);
      throw error;
    }
  }

  /**
   * Configura el webhook para recibir actualizaciones
   * @param webhookUrl - URL completa del webhook (ej: https://your-domain.com/vouchers/telegram-webhook)
   */
  async setWebhook(webhookUrl: string): Promise<boolean> {
    if (!this.isConfigured()) {
      throw new Error('Telegram Bot not configured');
    }

    try {
      this.logger.log(`Setting webhook to: ${webhookUrl}`);
      const result = await this.bot!.setWebHook(webhookUrl);

      if (result) {
        this.logger.log('Webhook set successfully');
      } else {
        this.logger.error('Failed to set webhook');
      }

      return result;
    } catch (error) {
      this.logger.error(`Error setting webhook: ${error.message}`);
      throw error;
    }
  }

  /**
   * Obtiene información del webhook actual
   */
  async getWebhookInfo(): Promise<TelegramBot.WebhookInfo> {
    if (!this.isConfigured()) {
      throw new Error('Telegram Bot not configured');
    }

    try {
      const info = await this.bot!.getWebHookInfo();
      this.logger.debug(`Webhook info: ${JSON.stringify(info)}`);
      return info;
    } catch (error) {
      this.logger.error(`Error getting webhook info: ${error.message}`);
      throw error;
    }
  }

  /**
   * Elimina el webhook actual
   */
  async deleteWebhook(): Promise<boolean> {
    if (!this.isConfigured()) {
      throw new Error('Telegram Bot not configured');
    }

    try {
      const result = await this.bot!.deleteWebHook();
      this.logger.log('Webhook deleted');
      return result;
    } catch (error) {
      this.logger.error(`Error deleting webhook: ${error.message}`);
      throw error;
    }
  }

  /**
   * Envía un mensaje de texto a un chat
   * @param chatId - ID del chat de Telegram
   * @param text - Texto del mensaje
   * @param options - Opciones adicionales (reply_markup, parse_mode, etc.)
   */
  async sendMessage(
    chatId: number | string,
    text: string,
    options?: TelegramBot.SendMessageOptions,
  ): Promise<TelegramBot.Message> {
    if (!this.isConfigured()) {
      throw new Error('Telegram Bot not configured');
    }

    try {
      this.logger.debug(`Sending message to chat ${chatId}: ${text.substring(0, 50)}...`);
      const message = await this.bot!.sendMessage(chatId, text, options);
      this.logger.debug(`Message sent successfully to ${chatId}`);
      return message;
    } catch (error) {
      this.logger.error(`Error sending message to ${chatId}: ${error.message}`);
      throw error;
    }
  }

  /**
   * Envía una foto a un chat
   * @param chatId - ID del chat
   * @param photo - Buffer, Stream o file_id de la foto
   * @param options - Opciones adicionales (caption, reply_markup, etc.)
   */
  async sendPhoto(
    chatId: number | string,
    photo: string | Buffer,
    options?: TelegramBot.SendPhotoOptions,
  ): Promise<TelegramBot.Message> {
    if (!this.isConfigured()) {
      throw new Error('Telegram Bot not configured');
    }

    try {
      this.logger.debug(`Sending photo to chat ${chatId}`);
      const message = await this.bot!.sendPhoto(chatId, photo, options);
      this.logger.debug(`Photo sent successfully to ${chatId}`);
      return message;
    } catch (error) {
      this.logger.error(`Error sending photo to ${chatId}: ${error.message}`);
      throw error;
    }
  }

  /**
   * Obtiene información de un archivo
   * @param fileId - ID del archivo en Telegram
   * @returns Información del archivo incluyendo file_path
   */
  async getFile(fileId: string): Promise<TelegramBot.File> {
    if (!this.isConfigured()) {
      throw new Error('Telegram Bot not configured');
    }

    try {
      this.logger.debug(`Getting file info for: ${fileId}`);
      const file = await this.bot!.getFile(fileId);
      return file;
    } catch (error) {
      this.logger.error(`Error getting file ${fileId}: ${error.message}`);
      throw error;
    }
  }

  /**
   * Descarga un archivo desde Telegram
   * @param fileId - ID del archivo
   * @returns Buffer del archivo descargado
   */
  async downloadFile(fileId: string): Promise<Buffer> {
    if (!this.isConfigured()) {
      throw new Error('Telegram Bot not configured');
    }

    try {
      this.logger.debug(`Downloading file: ${fileId}`);

      // Obtener información del archivo (incluye file_path)
      const file = await this.getFile(fileId);

      if (!file.file_path) {
        throw new Error('File path not available');
      }

      // Construir URL de descarga
      const fileUrl = `${this.apiUrl}/file/bot${this.botToken}/${file.file_path}`;

      this.logger.debug(`Downloading from URL: ${fileUrl}`);

      const response = await fetch(fileUrl);

      if (!response.ok) {
        throw new Error(`Failed to download file: ${response.statusText}`);
      }

      const arrayBuffer = await response.arrayBuffer();
      const buffer = Buffer.from(arrayBuffer);

      this.logger.debug(`File downloaded successfully (${buffer.length} bytes)`);

      return buffer;
    } catch (error) {
      this.logger.error(`Error downloading file ${fileId}: ${error.message}`);
      throw error;
    }
  }

  /**
   * Responde a un callback query (botón inline presionado)
   * @param callbackQueryId - ID del callback query
   * @param text - Texto opcional para mostrar al usuario
   */
  async answerCallbackQuery(
    callbackQueryId: string,
    text?: string,
  ): Promise<boolean> {
    if (!this.isConfigured()) {
      throw new Error('Telegram Bot not configured');
    }

    try {
      const result = await this.bot!.answerCallbackQuery(callbackQueryId, { text });
      return result;
    } catch (error) {
      this.logger.error(`Error answering callback query: ${error.message}`);
      throw error;
    }
  }
}
