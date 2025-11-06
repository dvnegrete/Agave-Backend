import { Injectable, Logger } from '@nestjs/common';
import {
  SendGridInboundWebhookDto,
  ProcessedEmailDto,
  EmailAttachmentDto,
} from '../../dto/email-webhook.dto';

/**
 * EmailParserService
 *
 * Servicio para parsear datos del webhook de SendGrid Inbound Parse
 * SendGrid envía datos en formato multipart/form-data con estructura compleja
 */
@Injectable()
export class EmailParserService {
  private readonly logger = new Logger(EmailParserService.name);

  /**
   * Parsea el webhook de SendGrid y extrae datos relevantes
   */
  parseInboundEmail(rawData: any): ProcessedEmailDto {
    const from = this.extractEmailAddress(rawData.from);
    const to = this.extractEmailAddress(rawData.to);

    // Parsear adjuntos
    const attachments = this.parseAttachments(rawData);

    this.logger.log(
      `Parsed email from ${from} with ${attachments.length} attachments`,
    );

    return {
      from,
      to,
      subject: rawData.subject || '',
      textBody: rawData.text || '',
      attachments,
    };
  }

  /**
   * Extrae la dirección de email limpia desde un string
   * Ejemplos:
   * - "usuario@example.com" → "usuario@example.com"
   * - "Usuario <usuario@example.com>" → "usuario@example.com"
   * - "Usuario Name <usuario@example.com>" → "usuario@example.com"
   */
  private extractEmailAddress(emailString: string): string {
    if (!emailString) return '';

    // Buscar email entre < >
    const match = emailString.match(/<(.+?)>/);
    if (match) {
      return match[1].trim();
    }

    // Si no tiene < >, asumir que es el email directo
    return emailString.trim();
  }

  /**
   * Parsea los adjuntos desde el webhook de SendGrid
   *
   * SendGrid envía adjuntos de dos formas:
   * 1. Como campos individuales: attachment1, attachment2, etc.
   * 2. Como JSON en el campo 'attachment-info'
   *
   * Preferimos usar 'attachment-info' si está disponible
   */
  private parseAttachments(rawData: any): EmailAttachmentDto[] {
    const attachments: EmailAttachmentDto[] = [];

    // Método 1: Parsear desde attachment-info (JSON)
    if (rawData['attachment-info']) {
      try {
        const attachmentInfo = JSON.parse(rawData['attachment-info']);

        // attachment-info es un objeto con claves como "attachment1", "attachment2"
        Object.keys(attachmentInfo).forEach((key) => {
          const info = attachmentInfo[key];

          // El contenido del archivo viene en rawData[key] (base64)
          if (rawData[key]) {
            attachments.push({
              filename: info.filename || key,
              contentType: info.type || 'application/octet-stream',
              content: rawData[key], // Base64 string
              size: info.length || 0,
            });
          }
        });

        return attachments;
      } catch (error) {
        this.logger.warn(
          `Error parsing attachment-info JSON: ${error.message}`,
        );
      }
    }

    // Método 2: Buscar campos attachment1, attachment2, etc. manualmente
    const attachmentCount = parseInt(rawData.attachments || '0', 10);

    for (let i = 1; i <= attachmentCount; i++) {
      const attachmentKey = `attachment${i}`;
      const attachmentContent = rawData[attachmentKey];

      if (attachmentContent) {
        // Intentar obtener metadata si existe
        const contentType =
          rawData[`${attachmentKey}-type`] || 'application/octet-stream';
        const filename = rawData[`${attachmentKey}-name`] || attachmentKey;

        attachments.push({
          filename,
          contentType,
          content: attachmentContent, // Base64
          size: Buffer.from(attachmentContent, 'base64').length,
        });
      }
    }

    return attachments;
  }

  /**
   * Valida que los datos mínimos estén presentes
   */
  validateInboundEmail(data: ProcessedEmailDto): boolean {
    return !!(data.from && data.to);
  }
}
