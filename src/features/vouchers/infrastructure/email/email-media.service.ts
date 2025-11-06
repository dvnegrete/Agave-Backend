import { Injectable, Logger, BadRequestException } from '@nestjs/common';

export interface EmailAttachment {
  filename: string;
  content: string; // Base64 encoded
  contentType: string;
  size?: number;
}

export interface ProcessedAttachment {
  buffer: Buffer;
  filename: string;
  mimeType: string;
}

/**
 * EmailMediaService
 *
 * Servicio para procesar adjuntos de emails (SendGrid Inbound Parse)
 * Maneja la descarga y validación de archivos adjuntos
 */
@Injectable()
export class EmailMediaService {
  private readonly logger = new Logger(EmailMediaService.name);

  /**
   * Tipos MIME soportados para vouchers
   */
  private readonly SUPPORTED_MIME_TYPES = [
    // Images
    'image/jpeg',
    'image/jpg',
    'image/png',
    'image/webp',
    'image/gif',
    'image/bmp',
    'image/tiff',
    // Documents
    'application/pdf',
  ];

  /**
   * Tamaño máximo de archivo: 10MB
   */
  private readonly MAX_FILE_SIZE = 10 * 1024 * 1024; // 10MB

  /**
   * Procesa un adjunto de email desde SendGrid Inbound Parse
   * Los adjuntos vienen en formato base64
   */
  processAttachment(attachment: EmailAttachment): ProcessedAttachment {
    // 1. Validar tamaño
    if (attachment.size && attachment.size > this.MAX_FILE_SIZE) {
      throw new BadRequestException(
        `El archivo ${attachment.filename} excede el tamaño máximo permitido (10MB)`,
      );
    }

    // 2. Validar tipo MIME
    if (!this.isSupportedMediaType(attachment.contentType)) {
      throw new BadRequestException(
        `Tipo de archivo no soportado: ${attachment.contentType}. ` +
          `Formatos válidos: JPG, PNG, WEBP, GIF, BMP, TIFF, PDF`,
      );
    }

    // 3. Decodificar contenido base64 a Buffer
    const buffer = Buffer.from(attachment.content, 'base64');

    this.logger.log(
      `Attachment processed: ${attachment.filename} (${attachment.contentType}, ${attachment.size} bytes)`,
    );

    return {
      buffer,
      filename: attachment.filename,
      mimeType: attachment.contentType,
    };
  }

  /**
   * Verifica si el tipo MIME es soportado
   */
  isSupportedMediaType(mimeType: string): boolean {
    return this.SUPPORTED_MIME_TYPES.includes(mimeType.toLowerCase());
  }

  /**
   * Filtra adjuntos válidos de un email
   * Retorna solo los que son imágenes o PDFs soportados
   */
  filterValidAttachments(attachments: EmailAttachment[]): EmailAttachment[] {
    return attachments.filter((att) =>
      this.isSupportedMediaType(att.contentType),
    );
  }

  /**
   * Extrae el primer adjunto válido de un email
   * Retorna null si no hay adjuntos válidos
   */
  getFirstValidAttachment(
    attachments: EmailAttachment[],
  ): EmailAttachment | null {
    const validAttachments = this.filterValidAttachments(attachments);
    return validAttachments.length > 0 ? validAttachments[0] : null;
  }
}
