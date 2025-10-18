import { Injectable, Logger, BadRequestException } from '@nestjs/common';
import { OcrService } from './ocr.service';
import { getVouchersBusinessRules } from '@/shared/config/business-rules.config';
import { formatFecha } from '../../shared/helpers/voucher-formatter.helper';

export interface StructuredData {
  monto: string;
  fecha_pago: string;
  referencia: string;
  hora_transaccion: string;
}

export interface StructuredDataWithCasa extends StructuredData {
  casa: number | null;
  faltan_datos?: boolean;
  pregunta?: string;
}

export interface VoucherProcessingResult {
  success: boolean;
  structuredData: StructuredDataWithCasa;
  whatsappMessage: string;
  originalFilename: string;
  gcsFilename?: string;
  phoneNumber?: string; // Opcional, solo para WhatsApp
  confirmationCode?: string; // Código de confirmación único para el pago
}

@Injectable()
export class VoucherProcessorService {
  private readonly logger = new Logger(VoucherProcessorService.name);

  constructor(private readonly ocrService: OcrService) {}

  /**
   * Genera un código de confirmación único
   * Formato: YYYYMM-XXXXX (año + mes + 5 caracteres alfanuméricos)
   * Ejemplo: 202410-A7K2M
   */
  generateConfirmationCode(): string {
    const now = new Date();
    const year = now.getFullYear();
    const month = String(now.getMonth() + 1).padStart(2, '0');
    const random = Math.random().toString(36).substring(2, 7).toUpperCase();
    return `${year}${month}-${random}`;
  }

  /**
   * Procesa un comprobante de pago (voucher) desde un buffer de archivo
   * Esta función unifica la lógica de procesamiento para:
   * - Endpoint POST /ocr-service (upload directo)
   * - Webhook de WhatsApp (descarga de media)
   *
   * @param fileBuffer Buffer del archivo (imagen o PDF)
   * @param filename Nombre del archivo
   * @param language Idioma para OCR (opcional)
   * @param phoneNumber Número de WhatsApp (opcional, solo para tracking)
   * @returns Resultado del procesamiento con datos estructurados y mensaje de respuesta
   */
  async processVoucher(
    fileBuffer: Buffer,
    filename: string,
    language?: string,
    phoneNumber?: string,
  ): Promise<VoucherProcessingResult> {
    try {
      const source = phoneNumber ? 'WhatsApp' : 'HTTP Upload';

      // 1. Validar formato de archivo
      await this.ocrService.validateImageFormat(fileBuffer, filename);

      // 2. Extraer texto usando OCR
      const resultOCR = await this.ocrService.extractTextFromImage(
        fileBuffer,
        filename,
        language,
      );

      // 3. Extraer número de casa desde los centavos
      const dataWithHouse = this.extractCentavos(resultOCR.structuredData);

      // 4. Generar mensaje de respuesta según los casos (SIN código de confirmación todavía)
      const whatsappMessage = this.generateWhatsAppMessage(dataWithHouse);

      this.logger.log(`[${source}] Voucher procesado: ${filename}`);

      return {
        success: true,
        structuredData: dataWithHouse,
        whatsappMessage,
        originalFilename: resultOCR.originalFilename,
        gcsFilename: resultOCR.gcsFilename,
        phoneNumber,
        // confirmationCode se generará después del INSERT
      };
    } catch (error) {
      const source = phoneNumber ? 'WhatsApp' : 'HTTP Upload';
      this.logger.error(
        `[${source}] Error al procesar voucher ${filename}: ${error.message}`,
      );
      throw new BadRequestException(
        `Error al procesar el comprobante: ${error.message}`,
      );
    }
  }

  /**
   * Extrae el número de casa desde los centavos del monto
   * Regla de negocio:
   * - .1 → casa 10, .2 → casa 20, .3 → casa 30, .4 → casa 40, etc.
   * - .01 → casa 1, .04 → casa 4, .05 → casa 5, etc.
   * - .0 o .00 → null (inválido)
   * - Valores > 66 → null (excede máximo)
   *
   * Ejemplos:
   * - 1000.1 → 10 (un dígito se multiplica por 10)
   * - 1000.4 → 40 (un dígito se multiplica por 10)
   * - 1000.04 → 4 (dos dígitos se interpretan como está)
   * - 1000.05 → 5
   * - 1000.00 → null
   */
  private extractCentavos(
    structuredData: StructuredData,
  ): StructuredDataWithCasa {
    const modifiedData: StructuredDataWithCasa = {
      ...structuredData,
      casa: null,
    };
    const businessRules = getVouchersBusinessRules();

    if (modifiedData.monto) {
      const montoStr = String(modifiedData.monto);
      const parts = montoStr.split('.');

      if (parts.length === 2) {
        const centavosStr = parts[1];

        // Normalizar: si tiene un solo dígito, multiplicar por 10
        // Ejemplo: ".1" → "10", ".4" → "40"
        const normalizedCentavos =
          centavosStr.length === 1
            ? parseInt(centavosStr, 10) * 10
            : parseInt(centavosStr, 10);

        if (
          isNaN(normalizedCentavos) ||
          normalizedCentavos === 0 ||
          normalizedCentavos > businessRules.maxCasas
        ) {
          modifiedData.casa = null;
        } else if (
          normalizedCentavos >= businessRules.minCasas &&
          normalizedCentavos <= businessRules.maxCasas
        ) {
          modifiedData.casa = normalizedCentavos;
        } else {
          modifiedData.casa = null;
        }
      } else {
        modifiedData.casa = null;
      }
    } else {
      modifiedData.casa = null;
    }

    return modifiedData;
  }

  /**
   * Genera el mensaje de respuesta de WhatsApp según el estado de los datos
   * NOTA: Este mensaje NO incluye el código de confirmación porque aún no se ha insertado en BD
   */
  private generateWhatsAppMessage(data: StructuredDataWithCasa): string {
    // Caso 3: faltan_datos = true
    if (data.faltan_datos) {
      return `No pude extraer los siguientes datos del comprobante que enviaste. Por favor indícame los valores correctos para los siguientes conceptos:\n\n${data.pregunta || 'Datos faltantes no especificados'}`;
    }

    // Caso 2: faltan_datos = false y casa = null
    if (!data.faltan_datos && data.casa === null) {
      return `Para poder registrar tu pago por favor indica el número de casa a la que corresponde el pago: (El valor debe ser entre 1 y 66).`;
    }

    // Caso 1: faltan_datos = false y casa es un valor numérico
    if (!data.faltan_datos && typeof data.casa === 'number') {
      return `Voy a registrar tu pago con el estatus "pendiente verificación en banco" con los siguientes datos que he encontrado en el comprobante:
      💰 Monto: *$${data.monto}*
      📅 Fecha: *${formatFecha(data.fecha_pago)}*
      🏠 Casa: *${data.casa}*
      🔢 Referencia: *${data.referencia || 'No disponible'}*
      ⏰ Hora: *${data.hora_transaccion}*

      ¿Los datos son correctos?`;
    }

    // Fallback
    return 'Error al procesar el comprobante. Por favor intenta nuevamente.';
  }
}
