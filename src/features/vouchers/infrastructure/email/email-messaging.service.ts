import { Injectable, Logger } from '@nestjs/common';
import { EmailApiService } from './email-api.service';

/**
 * EmailMessagingService
 *
 * Servicio de alto nivel para enviar respuestas por email
 * Encapsula la lógica de formateo y envío de mensajes
 */
@Injectable()
export class EmailMessagingService {
  private readonly logger = new Logger(EmailMessagingService.name);

  constructor(private readonly emailApi: EmailApiService) {}

  /**
   * Envía un mensaje de texto simple
   */
  async sendTextMessage(to: string, message: string): Promise<void> {
    await this.emailApi.sendEmail({
      to,
      subject: 'Procesamiento de Comprobante - Agave',
      text: message,
    });
  }

  /**
   * Envía un mensaje de confirmación con los datos del voucher
   */
  async sendConfirmationRequest(
    to: string,
    voucherData: {
      monto: string;
      fecha_pago: string;
      casa: number;
      referencia: string;
      hora_transaccion: string;
    },
  ): Promise<void> {
    const message = `Hola,

He procesado tu comprobante de pago con los siguientes datos:

💰 Monto: $${voucherData.monto}
📅 Fecha: ${voucherData.fecha_pago}
🏠 Casa: ${voucherData.casa}
🔢 Referencia: ${voucherData.referencia || 'No disponible'}
⏰ Hora: ${voucherData.hora_transaccion}

El registro ha sido guardado con estatus "pendiente verificación en banco".

Si los datos son incorrectos, por favor responde a este correo indicando las correcciones necesarias.

Saludos,
Sistema Agave`;

    await this.emailApi.sendEmail({
      to,
      subject: '✅ Comprobante Procesado - Confirmación',
      text: message,
    });
  }

  /**
   * Envía un mensaje de error
   */
  async sendErrorMessage(to: string, errorMessage: string): Promise<void> {
    const message = `Hola,

Hubo un problema al procesar tu comprobante:

${errorMessage}

Por favor intenta nuevamente o contacta al administrador.

Saludos,
Sistema Agave`;

    await this.emailApi.sendEmail({
      to,
      subject: '❌ Error al Procesar Comprobante',
      text: message,
    });
  }

  /**
   * Envía un mensaje solicitando datos faltantes
   */
  async sendMissingDataRequest(
    to: string,
    missingFields: string[],
  ): Promise<void> {
    const fieldsList = missingFields.join('\n- ');
    const message = `Hola,

No pude extraer todos los datos de tu comprobante.

Por favor responde a este correo indicando los siguientes datos:

- ${fieldsList}

Saludos,
Sistema Agave`;

    await this.emailApi.sendEmail({
      to,
      subject: 'Datos Faltantes - Comprobante',
      text: message,
    });
  }

  /**
   * Envía un mensaje solicitando número de casa
   */
  async sendHouseNumberRequest(to: string): Promise<void> {
    const message = `Hola,

No pude identificar el número de casa desde el comprobante.

Por favor responde a este correo indicando el número de casa (1-66) al que corresponde el pago.

Saludos,
Sistema Agave`;

    await this.emailApi.sendEmail({
      to,
      subject: 'Número de Casa Requerido',
      text: message,
    });
  }

  /**
   * Envía un mensaje indicando que no se encontró adjunto
   */
  async sendNoAttachmentMessage(to: string): Promise<void> {
    const message = `Hola,

No encontré ningún comprobante adjunto en tu correo.

Por favor envía tu comprobante como archivo adjunto (imagen JPG/PNG o PDF).

Formatos soportados: JPG, PNG, WEBP, GIF, BMP, TIFF, PDF
Tamaño máximo: 10MB

Saludos,
Sistema Agave`;

    await this.emailApi.sendEmail({
      to,
      subject: 'Falta Adjunto - Comprobante',
      text: message,
    });
  }
}
