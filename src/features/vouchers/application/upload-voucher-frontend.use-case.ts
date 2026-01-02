import { Injectable, Logger } from '@nestjs/common';
import { VoucherProcessorService } from '../infrastructure/ocr/voucher-processor.service';
import {
  FrontendVoucherResponseDto,
  ValidationResultDto,
} from '../dto/frontend-voucher-response.dto';
import {
  MIN_HOUSE_NUMBER,
  MAX_HOUSE_NUMBER,
} from '@/shared/config/business-rules.config';
import { VOUCHER_FRONTEND_MESSAGES } from '../shared/constants';

export interface UploadVoucherFrontendInput {
  fileBuffer: Buffer;
  filename: string;
  language?: string;
  userId?: string | null;
}

export interface UploadVoucherFrontendOutput extends FrontendVoucherResponseDto {}

/**
 * Use Case: Procesar voucher desde Frontend (HTTP)
 *
 * Responsabilidades:
 * - Procesar la imagen/PDF con OCR usando VoucherProcessorService
 * - Validar los datos extraídos
 * - Retornar respuesta con datos estructurados y validación
 * - No guarda en BD (el Frontend decidirá si guardar como draft)
 */
@Injectable()
export class UploadVoucherFrontendUseCase {
  private readonly logger = new Logger(UploadVoucherFrontendUseCase.name);

  constructor(private readonly voucherProcessor: VoucherProcessorService) {}

  async execute(
    input: UploadVoucherFrontendInput,
  ): Promise<UploadVoucherFrontendOutput> {
    try {
      const { fileBuffer, filename, language } = input;

      this.logger.debug(`Procesando archivo: ${filename}`);

      // 1. Procesar con OCR (reutilizar servicio existente)
      const ocrResult = await this.voucherProcessor.processVoucher(
        fileBuffer,
        filename,
        language || 'es',
      );

      // 2. Validar datos extraídos
      const validation = this.validateExtractedData(ocrResult.structuredData);

      // 3. Construir respuesta
      const response: UploadVoucherFrontendOutput = {
        success: true,
        structuredData: ocrResult.structuredData,
        validation,
        gcsFilename: ocrResult.gcsFilename,
        originalFilename: ocrResult.originalFilename,
        suggestions: {
          casaDetectedFromCentavos:
            ocrResult.structuredData.casa !== null &&
            ocrResult.structuredData.casa !== undefined,
          autoAssignedTime:
            ocrResult.structuredData.hora_asignada_automaticamente || false,
        },
      };

      this.logger.debug(
        `Voucher procesado exitosamente. Casa: ${ocrResult.structuredData.casa}, Datos válidos: ${validation.isValid}`,
      );

      return response;
    } catch (error) {
      this.logger.error(`Error procesando voucher: ${error.message}`);
      throw error;
    }
  }

  /**
   * Valida los datos extraídos por OCR/IA
   */
  private validateExtractedData(data: any): ValidationResultDto {
    const missingFields: string[] = [];
    const errors: Record<string, string> = {};
    const warnings: string[] = [];

    // Verificar campos obligatorios
    if (!data.monto || data.monto === '0' || data.monto === '') {
      missingFields.push('monto');
    }

    if (!data.fecha_pago) {
      missingFields.push('fecha_pago');
    }

    if (!data.hora_transaccion) {
      missingFields.push('hora_transaccion');
    }

    if (!data.casa && data.casa !== 0) {
      missingFields.push('casa');
    }

    // Notar que referencia es OPCIONAL

    // Validaciones de formato/rango
    if (data.monto) {
      try {
        const amount = parseFloat(data.monto);
        if (isNaN(amount) || !isFinite(amount) || amount <= 0) {
          errors.monto =
            VOUCHER_FRONTEND_MESSAGES.VALIDATION.AMOUNT.MUST_BE_POSITIVE;
        }
      } catch (error) {
        errors.monto =
          VOUCHER_FRONTEND_MESSAGES.VALIDATION.AMOUNT.INVALID_FORMAT;
      }
    }

    if (data.casa !== null && data.casa !== undefined) {
      const casa = parseInt(data.casa, 10);
      if (isNaN(casa) || casa < MIN_HOUSE_NUMBER || casa > MAX_HOUSE_NUMBER) {
        errors.casa =
          VOUCHER_FRONTEND_MESSAGES.VALIDATION.HOUSE_NUMBER.OUT_OF_RANGE(
            MIN_HOUSE_NUMBER,
            MAX_HOUSE_NUMBER,
          );
      }
    }

    // Validar fecha si está presente
    if (data.fecha_pago) {
      if (!this.isValidDate(data.fecha_pago)) {
        errors.fecha_pago =
          VOUCHER_FRONTEND_MESSAGES.VALIDATION.DATE.INVALID_FORMAT;
      }
    }

    // Validar hora si está presente
    if (data.hora_transaccion) {
      if (!this.isValidTime(data.hora_transaccion)) {
        errors.hora_transaccion =
          VOUCHER_FRONTEND_MESSAGES.VALIDATION.TIME.INVALID_FORMAT;
      }
    }

    // Advertencias
    if (data.hora_asignada_automaticamente) {
      warnings.push(VOUCHER_FRONTEND_MESSAGES.WARNINGS.AUTO_ASSIGNED_TIME);
    }

    return {
      isValid: missingFields.length === 0 && Object.keys(errors).length === 0,
      missingFields,
      errors,
      warnings: warnings.length > 0 ? warnings : undefined,
    };
  }

  /**
   * Valida que una fecha esté en formato YYYY-MM-DD
   */
  private isValidDate(dateString: string): boolean {
    const dateRegex = /^\d{4}-\d{2}-\d{2}$/;
    if (!dateRegex.test(dateString)) {
      return false;
    }

    const date = new Date(dateString);
    return !isNaN(date.getTime());
  }

  /**
   * Valida que una hora esté en formato HH:MM:SS
   */
  private isValidTime(timeString: string): boolean {
    const timeRegex = /^([0-1][0-9]|2[0-3]):[0-5][0-9]:[0-5][0-9]$/;
    return timeRegex.test(timeString);
  }
}
