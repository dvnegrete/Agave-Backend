import { Injectable, Logger } from '@nestjs/common';
import { ProcessedEmailDto } from '../dto/email-webhook.dto';
import { EmailMediaService } from '../infrastructure/email/email-media.service';
import { EmailMessagingService } from '../infrastructure/email/email-messaging.service';
import { VoucherProcessorService } from '../infrastructure/ocr/voucher-processor.service';
import { GcsCleanupService } from '@/shared/libs/google-cloud';
import { formatFecha } from '../shared/helpers/voucher-formatter.helper';

export interface HandleEmailWebhookOutput {
  success: boolean;
  message?: string;
}

/**
 * Use Case: Procesar webhook de email con comprobante adjunto
 *
 * Responsabilidades:
 * - Validar que el email tenga adjunto válido
 * - Procesar el comprobante con OCR
 * - Insertar en base de datos si los datos son completos
 * - Enviar respuesta por email al remitente
 *
 * NOTA: A diferencia de WhatsApp, el flujo de email es más simple:
 * - Si los datos están completos → Insertar directamente y confirmar
 * - Si faltan datos → Solicitar datos faltantes por email
 * - No hay gestión de estado conversacional complejo
 */
@Injectable()
export class HandleEmailWebhookUseCase {
  private readonly logger = new Logger(HandleEmailWebhookUseCase.name);

  constructor(
    private readonly emailMedia: EmailMediaService,
    private readonly emailMessaging: EmailMessagingService,
    private readonly voucherProcessor: VoucherProcessorService,
    private readonly gcsCleanupService: GcsCleanupService,
  ) {}

  async execute(emailData: ProcessedEmailDto): Promise<HandleEmailWebhookOutput> {
    const senderEmail = emailData.from;
    let gcsFilename: string | undefined;

    try {
      this.logger.log(`Processing email from: ${senderEmail}`);

      // 1. Validar que tenga adjuntos
      if (!emailData.attachments || emailData.attachments.length === 0) {
        await this.emailMessaging.sendNoAttachmentMessage(senderEmail);
        return { success: false, message: 'No attachments found' };
      }

      // 2. Obtener primer adjunto válido
      const firstValidAttachment =
        this.emailMedia.getFirstValidAttachment(emailData.attachments);

      if (!firstValidAttachment) {
        await this.emailMessaging.sendErrorMessage(
          senderEmail,
          'No se encontró ningún archivo de imagen o PDF válido en los adjuntos.',
        );
        return { success: false, message: 'No valid attachments' };
      }

      // 3. Procesar adjunto
      const processedAttachment =
        this.emailMedia.processAttachment(firstValidAttachment);

      // 4. Procesar voucher con OCR
      const result = await this.voucherProcessor.processVoucher(
        processedAttachment.buffer,
        processedAttachment.filename,
        'es',
      );

      gcsFilename = result.gcsFilename;
      const voucherData = result.structuredData;

      // 5. Determinar flujo según datos extraídos
      if (!voucherData.faltan_datos && typeof voucherData.casa === 'number') {
        // CASO 1: Datos completos → Insertar directamente
        return await this.handleCompleteData(senderEmail, result);
      } else if (!voucherData.faltan_datos && voucherData.casa === null) {
        // CASO 2: Falta número de casa → Solicitar por email
        await this.emailMessaging.sendHouseNumberRequest(senderEmail);
        return { success: true, message: 'Missing house number requested' };
      } else if (voucherData.faltan_datos) {
        // CASO 3: Faltan datos → Solicitar por email
        // TODO: Implementar identificación de campos faltantes
        await this.emailMessaging.sendMissingDataRequest(senderEmail, [
          'Monto',
          'Fecha',
          'Referencia',
        ]);
        return { success: true, message: 'Missing data requested' };
      }

      return { success: true };
    } catch (error) {
      this.logger.error(
        `Error processing email from ${senderEmail}: ${error.message}`,
      );

      // Limpiar archivo subido en caso de error
      if (gcsFilename) {
        await this.cleanupUploadedFile(gcsFilename);
      }

      await this.emailMessaging.sendErrorMessage(
        senderEmail,
        `Error al procesar el comprobante: ${error.message}`,
      );

      return { success: false, message: error.message };
    }
  }

  /**
   * Maneja el caso cuando todos los datos están completos
   *
   * TODO: Implementar inserción directa en BD
   * Por ahora solo envía confirmación al usuario
   *
   * La inserción completa requiere:
   * 1. Crear Voucher (date, authorization_number, amount, url, confirmation_code)
   * 2. Crear Record (vouchers_id)
   * 3. Buscar/Crear User por email
   * 4. Buscar/Crear House (house_number)
   * 5. Crear HouseRecord (house_id, record_id)
   *
   * Ver: src/features/vouchers/application/confirm-voucher.use-case.ts (líneas 150-250)
   */
  private async handleCompleteData(
    senderEmail: string,
    result: any,
  ): Promise<HandleEmailWebhookOutput> {
    const voucherData = result.structuredData;

    try {
      // Por ahora solo notificamos al usuario con los datos extraídos
      // NO insertamos en BD hasta implementar el flujo completo
      await this.emailMessaging.sendConfirmationRequest(senderEmail, {
        monto: voucherData.monto,
        fecha_pago: formatFecha(voucherData.fecha_pago),
        casa: voucherData.casa,
        referencia: voucherData.referencia,
        hora_transaccion: voucherData.hora_transaccion,
      });

      this.logger.log(
        `Voucher processed from email (NOT inserted): Casa ${voucherData.casa}, Monto ${voucherData.monto}`,
      );

      return {
        success: true,
        message: `Voucher processed (email notification sent)`,
      };
    } catch (error) {
      this.logger.error(`Error processing complete data: ${error.message}`);

      // Si falla, limpiar archivo
      if (result.gcsFilename) {
        await this.cleanupUploadedFile(result.gcsFilename);
      }

      throw error;
    }
  }

  /**
   * Limpia el archivo temporal subido a Google Cloud Storage
   */
  private async cleanupUploadedFile(gcsFilename: string): Promise<void> {
    await this.gcsCleanupService.deleteTemporaryProcessingFile(
      gcsFilename,
      'error-en-procesamiento-email',
    );
  }
}
