import { Injectable, Logger, BadRequestException } from '@nestjs/common';

export interface WhatsAppMediaInfo {
  url: string;
  mimeType: string;
  sha256: string;
  fileSize: number;
}

@Injectable()
export class WhatsAppMediaService {
  private readonly logger = new Logger(WhatsAppMediaService.name);
  private readonly apiUrl = 'https://graph.facebook.com/v23.0';
  private readonly token: string;

  constructor() {
    this.token = process.env.TOKEN_WA || '';

    if (!this.token) {
      this.logger.warn(
        'TOKEN_WA no está configurado. El servicio de descarga de medios de WhatsApp no funcionará.',
      );
    }
  }

  /**
   * Obtiene la información de un archivo multimedia de WhatsApp
   * @param mediaId ID del media recibido en el webhook
   * @returns Información del archivo incluyendo URL de descarga
   */
  async getMediaInfo(mediaId: string): Promise<WhatsAppMediaInfo> {
    try {
      if (!this.token) {
        throw new BadRequestException(
          'TOKEN_WA no está configurado. No se puede obtener información del media.',
        );
      }

      const url = `${this.apiUrl}/${mediaId}`;

      const response = await fetch(url, {
        method: 'GET',
        headers: {
          Authorization: `Bearer ${this.token}`,
        },
      });

      if (!response.ok) {
        const error = await response.json();
        this.logger.error(
          `Error al obtener información del media: ${JSON.stringify(error)}`,
        );
        throw new BadRequestException(
          `Error al obtener información del media: ${error.error?.message || 'Error desconocido'}`,
        );
      }

      const data = await response.json();

      return {
        url: data.url,
        mimeType: data.mime_type,
        sha256: data.sha256,
        fileSize: data.file_size,
      };
    } catch (error) {
      this.logger.error(
        `Error al obtener información del media ${mediaId}: ${error.message}`,
      );
      throw error;
    }
  }

  /**
   * Descarga el contenido de un archivo multimedia de WhatsApp
   * @param mediaId ID del media recibido en el webhook
   * @returns Buffer con el contenido del archivo
   */
  async downloadMedia(mediaId: string): Promise<{
    buffer: Buffer;
    mimeType: string;
    filename: string;
  }> {
    try {
      this.logger.log(`Descargando media de WhatsApp: ${mediaId}`);

      // 1. Obtener información del media (incluye URL de descarga)
      const mediaInfo = await this.getMediaInfo(mediaId);

      this.logger.log(
        `Media info obtenida: ${mediaInfo.mimeType}, tamaño: ${mediaInfo.fileSize} bytes`,
      );

      // 2. Descargar el archivo desde la URL
      const response = await fetch(mediaInfo.url, {
        method: 'GET',
        headers: {
          Authorization: `Bearer ${this.token}`,
        },
      });

      if (!response.ok) {
        throw new BadRequestException(
          `Error al descargar el media: ${response.statusText}`,
        );
      }

      // 3. Convertir a Buffer
      const arrayBuffer = await response.arrayBuffer();
      const buffer = Buffer.from(arrayBuffer);

      // 4. Generar nombre de archivo basado en mimeType
      const filename = this.generateFilename(mediaInfo.mimeType, mediaId);

      this.logger.log(
        `Media descargado exitosamente: ${filename}, ${buffer.length} bytes`,
      );

      return {
        buffer,
        mimeType: mediaInfo.mimeType,
        filename,
      };
    } catch (error) {
      this.logger.error(
        `Error al descargar media ${mediaId}: ${error.message}`,
      );
      throw error;
    }
  }

  /**
   * Genera un nombre de archivo basado en el MIME type
   */
  private generateFilename(mimeType: string, mediaId: string): string {
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
    return `whatsapp-${mediaId}.${extension}`;
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
}
