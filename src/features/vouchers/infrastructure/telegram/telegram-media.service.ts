import { Injectable, Logger } from '@nestjs/common';
import { TelegramApiService } from './telegram-api.service';

export interface TelegramMediaInfo {
  fileId: string;
  fileUniqueId: string;
  fileSize?: number;
  mimeType?: string;
  fileName?: string;
}

@Injectable()
export class TelegramMediaService {
  private readonly logger = new Logger(TelegramMediaService.name);

  constructor(private readonly telegramApi: TelegramApiService) {}

  /**
   * Descarga un archivo desde Telegram (foto, documento, etc.)
   * @param fileId - ID del archivo en Telegram
   * @param mimeType - MIME type del archivo (opcional)
   * @param fileName - Nombre original del archivo (opcional)
   * @returns Buffer, mimeType y filename
   */
  async downloadMedia(
    fileId: string,
    mimeType?: string,
    fileName?: string,
  ): Promise<{
    buffer: Buffer;
    mimeType: string;
    filename: string;
  }> {
    try {
      this.logger.log(`Descargando media de Telegram: ${fileId}`);

      // 1. Descargar el archivo usando TelegramApiService
      const buffer = await this.telegramApi.downloadFile(fileId);

      // 2. Determinar MIME type
      const finalMimeType = mimeType || this.guessMimeTypeFromBuffer(buffer);

      // 3. Generar nombre de archivo
      const filename =
        fileName || this.generateFilename(finalMimeType, fileId);

      this.logger.log(
        `Media descargado exitosamente: ${filename}, ${buffer.length} bytes`,
      );

      return {
        buffer,
        mimeType: finalMimeType,
        filename,
      };
    } catch (error) {
      this.logger.error(`Error al descargar media ${fileId}: ${error.message}`);
      throw error;
    }
  }

  /**
   * Descarga la foto de mayor resolución de un array de PhotoSize
   * @param photos - Array de PhotoSize de Telegram
   * @returns Buffer, mimeType y filename de la foto descargada
   */
  async downloadPhoto(photos: any[]): Promise<{
    buffer: Buffer;
    mimeType: string;
    filename: string;
  }> {
    if (!photos || photos.length === 0) {
      throw new Error('No photo sizes available');
    }

    // Telegram envía múltiples tamaños, tomar el más grande (último en el array)
    const largestPhoto = photos[photos.length - 1];

    this.logger.log(
      `Descargando foto (${largestPhoto.width}x${largestPhoto.height}): ${largestPhoto.file_id}`,
    );

    return this.downloadMedia(
      largestPhoto.file_id,
      'image/jpeg', // Telegram photos are always JPEG
      `telegram-photo-${largestPhoto.file_id}.jpg`,
    );
  }

  /**
   * Descarga un documento de Telegram
   * @param document - Objeto Document de Telegram
   * @returns Buffer, mimeType y filename del documento
   */
  async downloadDocument(document: any): Promise<{
    buffer: Buffer;
    mimeType: string;
    filename: string;
  }> {
    this.logger.log(
      `Descargando documento: ${document.file_name || document.file_id}`,
    );

    return this.downloadMedia(
      document.file_id,
      document.mime_type,
      document.file_name,
    );
  }

  /**
   * Genera un nombre de archivo basado en el MIME type
   */
  private generateFilename(mimeType: string, fileId: string): string {
    const extensions: { [key: string]: string } = {
      'image/jpeg': 'jpg',
      'image/png': 'png',
      'image/gif': 'gif',
      'image/webp': 'webp',
      'image/bmp': 'bmp',
      'image/tiff': 'tiff',
      'application/pdf': 'pdf',
    };

    const extension = extensions[mimeType] || 'bin';
    const timestamp = Date.now();
    return `telegram-${timestamp}-${fileId.substring(0, 8)}.${extension}`;
  }

  /**
   * Intenta adivinar el MIME type desde los bytes iniciales del archivo
   */
  private guessMimeTypeFromBuffer(buffer: Buffer): string {
    // Magic numbers para identificar tipos de archivo
    const signatures: { [key: string]: number[] } = {
      'image/jpeg': [0xff, 0xd8, 0xff],
      'image/png': [0x89, 0x50, 0x4e, 0x47],
      'image/gif': [0x47, 0x49, 0x46],
      'application/pdf': [0x25, 0x50, 0x44, 0x46],
    };

    for (const [mimeType, signature] of Object.entries(signatures)) {
      const matches = signature.every(
        (byte, index) => buffer[index] === byte,
      );
      if (matches) {
        return mimeType;
      }
    }

    // Fallback
    return 'application/octet-stream';
  }

  /**
   * Valida si el tipo de medio es soportado para procesamiento de vouchers
   */
  isSupportedMediaType(mimeType: string): boolean {
    const supportedTypes = [
      'image/jpeg',
      'image/png',
      'image/gif',
      'image/webp',
      'image/bmp',
      'image/tiff',
      'application/pdf',
    ];

    return supportedTypes.includes(mimeType);
  }

  /**
   * Valida el tamaño máximo de archivo (20MB - límite de Telegram Bot API para descarga)
   */
  isValidFileSize(fileSize?: number): boolean {
    if (!fileSize) {
      return true; // Si no se proporciona, asumir válido
    }

    const MAX_FILE_SIZE = 20 * 1024 * 1024; // 20MB
    return fileSize <= MAX_FILE_SIZE;
  }
}
