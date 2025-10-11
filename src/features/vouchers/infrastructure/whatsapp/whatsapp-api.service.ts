import { Injectable, Logger } from '@nestjs/common';

/**
 * Servicio genérico para realizar peticiones HTTP a WhatsApp Business API
 * Maneja autenticación, headers y logging de manera centralizada
 */
@Injectable()
export class WhatsAppApiService {
  private readonly logger = new Logger(WhatsAppApiService.name);
  private readonly apiUrl = 'https://graph.facebook.com/v23.0';
  private readonly token: string;
  private readonly phoneNumberId: string;

  constructor() {
    this.token = process.env.TOKEN_WA || '';
    this.phoneNumberId = process.env.PHONE_NUMBER_ID_WA || '';

    if (!this.token || !this.phoneNumberId) {
      this.logger.warn(
        'TOKEN_WA o PHONE_NUMBER_ID_WA no están configurados. El servicio de WhatsApp no funcionará correctamente.',
      );
    }
  }

  /**
   * Verifica si el servicio está configurado correctamente
   */
  isConfigured(): boolean {
    return !!this.token && !!this.phoneNumberId;
  }

  /**
   * Obtiene el Phone Number ID configurado
   */
  getPhoneNumberId(): string {
    return this.phoneNumberId;
  }

  /**
   * Realiza una petición HTTP genérica a WhatsApp API
   * @param endpoint - Endpoint relativo (ej: "/messages", "/{media_id}")
   * @param method - Método HTTP (GET, POST, DELETE)
   * @param body - Body de la petición (opcional)
   * @param customHeaders - Headers personalizados adicionales (opcional)
   * @returns Response parseada como JSON
   */
  async request<T = any>(
    endpoint: string,
    method: 'GET' | 'POST' | 'DELETE' = 'GET',
    body?: any,
    customHeaders?: Record<string, string>,
  ): Promise<T> {
    if (!this.isConfigured()) {
      this.logger.error(
        'WhatsApp API no está configurado correctamente (falta TOKEN_WA o PHONE_NUMBER_ID_WA)',
      );
      throw new Error('WhatsApp API not configured');
    }

    const url = `${this.apiUrl}${endpoint}`;

    const headers: Record<string, string> = {
      Authorization: `Bearer ${this.token}`,
      ...customHeaders,
    };

    // Solo agregar Content-Type si hay body
    if (body) {
      headers['Content-Type'] = 'application/json';
    }

    const options: RequestInit = {
      method,
      headers,
    };

    if (body) {
      options.body = JSON.stringify(body);
    }

    try {
      this.logger.debug(
        `[WhatsApp API] ${method} ${endpoint}${body ? ` - Body: ${JSON.stringify(body)}` : ''}`,
      );

      const response = await fetch(url, options);
      const data = await response.json();

      if (!response.ok) {
        this.logger.error(
          `[WhatsApp API] Error ${response.status}: ${JSON.stringify(data)}`,
        );
        throw new Error(
          `WhatsApp API error: ${data.error?.message || 'Unknown error'}`,
        );
      }

      this.logger.debug(
        `[WhatsApp API] Success: ${JSON.stringify(data).substring(0, 200)}`,
      );

      return data as T;
    } catch (error) {
      this.logger.error(`[WhatsApp API] Request failed: ${error.message}`);
      throw error;
    }
  }

  /**
   * Envía un mensaje a través de WhatsApp Business API
   * Método conveniente que construye el endpoint automáticamente
   * @param payload - Payload completo del mensaje (messaging_product, to, type, etc.)
   * @returns Response de WhatsApp API
   */
  async sendMessage(payload: any): Promise<any> {
    return this.request(`/${this.phoneNumberId}/messages`, 'POST', payload);
  }

  /**
   * Obtiene información de un media file
   * @param mediaId - ID del archivo multimedia
   * @returns Información del media (url, mime_type, etc.)
   */
  async getMediaInfo(mediaId: string): Promise<any> {
    return this.request(`/${mediaId}`, 'GET');
  }

  /**
   * Descarga un archivo multimedia de WhatsApp
   * @param mediaUrl - URL del archivo obtenida de getMediaInfo()
   * @returns Buffer del archivo descargado
   */
  async downloadMedia(mediaUrl: string): Promise<Buffer> {
    try {
      this.logger.debug(`[WhatsApp API] Downloading media from: ${mediaUrl}`);

      const response = await fetch(mediaUrl, {
        method: 'GET',
        headers: {
          Authorization: `Bearer ${this.token}`,
        },
      });

      if (!response.ok) {
        throw new Error(`Failed to download media: ${response.statusText}`);
      }

      const arrayBuffer = await response.arrayBuffer();
      return Buffer.from(arrayBuffer);
    } catch (error) {
      this.logger.error(
        `[WhatsApp API] Error downloading media: ${error.message}`,
      );
      throw error;
    }
  }
}
