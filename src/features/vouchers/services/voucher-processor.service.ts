import { Injectable, Logger, BadRequestException } from '@nestjs/common';
import { OcrService } from './ocr.service';
import { getVouchersBusinessRules } from '@/shared/config/business-rules.config';

interface StructuredData {
  monto: string;
  fecha_pago: string;
  referencia: string;
  hora_transaccion: string;
}

interface StructuredDataWithCasa extends StructuredData {
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
}

@Injectable()
export class VoucherProcessorService {
  private readonly logger = new Logger(VoucherProcessorService.name);

  constructor(private readonly ocrService: OcrService) {}

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
      this.logger.log(
        `[${source}] Iniciando procesamiento de voucher: ${filename}${phoneNumber ? ` (de ${phoneNumber})` : ''}`,
      );

      // 1. Validar formato de archivo
      await this.ocrService.validateImageFormat(fileBuffer, filename);
      this.logger.log(`[${source}] Formato de archivo validado: ${filename}`);

      // 2. Extraer texto usando OCR
      const resultOCR = await this.ocrService.extractTextFromImage(
        fileBuffer,
        filename,
        language,
      );
      this.logger.log(
        `[${source}] OCR completado. GCS filename: ${resultOCR.gcsFilename}`,
      );
      this.logger.log(
        `[${source}] Datos extraídos: ${JSON.stringify(resultOCR.structuredData, null, 2)}`,
      );

      // 3. Extraer número de casa desde los centavos
      const dataWithHouse = this.extractCentavos(resultOCR.structuredData);
      this.logger.log(
        `[${source}] Número de casa extraído: ${dataWithHouse.casa || 'No identificado'}`,
      );

      // 4. Generar mensaje de respuesta según los casos
      const whatsappMessage = this.generateWhatsAppMessage(dataWithHouse);

      // 5. Log del resultado final
      this.logger.log(`[${source}] Procesamiento completado exitosamente`);
      this.logger.log(`[${source}] Mensaje generado: ${whatsappMessage}`);

      // TODO: Aquí se insertará en la BD cuando esté listo
      this.logger.log(`[${source}] ⚠️  Pendiente: Inserción en BD (TypeORM)`);

      return {
        success: true,
        structuredData: dataWithHouse,
        whatsappMessage,
        originalFilename: resultOCR.originalFilename,
        gcsFilename: resultOCR.gcsFilename,
        phoneNumber,
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
   * Regla de negocio: los centavos indican el número de casa (ej: 123.05 → casa 5)
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
        const centavos = parseInt(parts[1], 10);

        if (
          isNaN(centavos) ||
          centavos === 0 ||
          centavos > businessRules.maxCasas
        ) {
          modifiedData.casa = null;
        } else if (
          centavos >= businessRules.minCasas &&
          centavos <= businessRules.maxCasas
        ) {
          modifiedData.casa = centavos;
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
      Monto de pago: ${data.monto}
      Fecha de Pago: ${data.fecha_pago}
      Numero de Casa: ${data.casa}
      Referencia: ${data.referencia}
      Hora de Transacción: ${data.hora_transaccion}
      
      Si los datos son correctos, escribe SI`;
    }

    // Fallback
    return 'Error al procesar el comprobante. Por favor intenta nuevamente.';
  }
}
