import { Injectable, Logger } from '@nestjs/common';
import { WhatsAppApiService } from './whatsapp-api.service';

export interface ButtonOption {
  id: string;
  title: string;
}

export interface ListSection {
  title?: string;
  rows: Array<{
    id: string;
    title: string;
    description?: string;
  }>;
}

/**
 * Servicio para enviar mensajes a través de WhatsApp Business API
 * Soporta mensajes de texto, botones interactivos y listas
 */
@Injectable()
export class WhatsAppMessagingService {
  private readonly logger = new Logger(WhatsAppMessagingService.name);

  constructor(private readonly whatsappApi: WhatsAppApiService) {}

  /**
   * Envía un mensaje de texto simple
   * @param to - Número de teléfono del destinatario
   * @param message - Texto del mensaje
   */
  async sendTextMessage(to: string, message: string): Promise<void> {
    try {
      const payload = {
        messaging_product: 'whatsapp',
        recipient_type: 'individual',
        to: to,
        type: 'text',
        text: {
          preview_url: false,
          body: message,
        },
      };

      await this.whatsappApi.sendMessage(payload);
      this.logger.log(`Mensaje de texto enviado exitosamente a ${to}`);
    } catch (error) {
      this.logger.error(
        `Error al enviar mensaje de texto a ${to}: ${error.message}`,
      );
      throw error;
    }
  }

  /**
   * Envía un mensaje con botones interactivos (máximo 3 botones)
   * @param to - Número de teléfono del destinatario
   * @param bodyText - Texto del mensaje
   * @param buttons - Arreglo de botones con id y título
   */
  async sendButtonMessage(
    to: string,
    bodyText: string,
    buttons: ButtonOption[],
  ): Promise<void> {
    try {
      if (buttons.length > 3) {
        this.logger.warn(
          `Se intentaron enviar ${buttons.length} botones, pero el límite es 3. Se enviarán solo los primeros 3.`,
        );
        buttons = buttons.slice(0, 3);
      }

      const payload = {
        messaging_product: 'whatsapp',
        to: to,
        type: 'interactive',
        interactive: {
          type: 'button',
          body: {
            text: bodyText,
          },
          action: {
            buttons: buttons.map((btn) => ({
              type: 'reply',
              reply: {
                id: btn.id,
                title: btn.title,
              },
            })),
          },
        },
      };

      await this.whatsappApi.sendMessage(payload);
    } catch (error) {
      this.logger.error(
        `Error al enviar mensaje con botones a ${to}: ${error.message}`,
      );
      throw error;
    }
  }

  /**
   * Envía un mensaje con lista de opciones (máximo 10 opciones por sección)
   * @param to - Número de teléfono del destinatario
   * @param bodyText - Texto del mensaje
   * @param buttonText - Texto del botón que abre la lista
   * @param sections - Secciones con filas de opciones
   */
  async sendListMessage(
    to: string,
    bodyText: string,
    buttonText: string,
    sections: ListSection[],
  ): Promise<void> {
    try {
      const payload = {
        messaging_product: 'whatsapp',
        to: to,
        type: 'interactive',
        interactive: {
          type: 'list',
          body: {
            text: bodyText,
          },
          action: {
            button: buttonText,
            sections: sections,
          },
        },
      };

      await this.whatsappApi.sendMessage(payload);
      this.logger.log(`Mensaje con lista enviado exitosamente a ${to}`);
    } catch (error) {
      this.logger.error(
        `Error al enviar mensaje con lista a ${to}: ${error.message}`,
      );
      throw error;
    }
  }

  /**
   * Envía un mensaje con imagen
   * @param to - Número de teléfono del destinatario
   * @param imageUrl - URL de la imagen (o media_id)
   * @param caption - Caption opcional
   */
  async sendImageMessage(
    to: string,
    imageUrl: string,
    caption?: string,
  ): Promise<void> {
    try {
      const payload = {
        messaging_product: 'whatsapp',
        to: to,
        type: 'image',
        image: {
          link: imageUrl,
          caption: caption,
        },
      };

      await this.whatsappApi.sendMessage(payload);
      this.logger.log(`Mensaje con imagen enviado exitosamente a ${to}`);
    } catch (error) {
      this.logger.error(
        `Error al enviar mensaje con imagen a ${to}: ${error.message}`,
      );
      throw error;
    }
  }

  /**
   * Envía un mensaje con documento (PDF, etc.)
   * @param to - Número de teléfono del destinatario
   * @param documentUrl - URL del documento (o media_id)
   * @param filename - Nombre del archivo
   * @param caption - Caption opcional
   */
  async sendDocumentMessage(
    to: string,
    documentUrl: string,
    filename: string,
    caption?: string,
  ): Promise<void> {
    try {
      const payload = {
        messaging_product: 'whatsapp',
        to: to,
        type: 'document',
        document: {
          link: documentUrl,
          filename: filename,
          caption: caption,
        },
      };

      await this.whatsappApi.sendMessage(payload);
      this.logger.log(`Mensaje con documento enviado exitosamente a ${to}`);
    } catch (error) {
      this.logger.error(
        `Error al enviar mensaje con documento a ${to}: ${error.message}`,
      );
      throw error;
    }
  }
}
