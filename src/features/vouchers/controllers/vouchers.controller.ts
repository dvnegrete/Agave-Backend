import {
  Controller,
  Post,
  Get,
  Put,
  Delete,
  Body,
  Param,
  Query,
  UploadedFile,
  UseInterceptors,
  BadRequestException,
  ParseFilePipe,
  MaxFileSizeValidator,
  FileTypeValidator,
  UnauthorizedException,
} from '@nestjs/common';
import { FileInterceptor } from '@nestjs/platform-express';
import { VouchersService } from '../services/vouchers.service';
import {
  CreateTransactionDto,
  UpdateTransactionDto,
} from '../dto/transaction.dto';
import { ProcessFileDto } from '../dto/process-file.dto';
import { ProcessedTransaction } from '../interfaces/transaction.interface';
import { OcrService } from '../services/ocr.service';
import { OcrServiceDto, OcrResponseDto } from '../dto/ocr-service.dto';
import { getVouchersBusinessRules } from '@/shared/config/business-rules.config';
import { WhatsAppMessageClassifierService } from '../services/whatsapp-message-classifier.service';

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

@Controller('vouchers')
export class VouchersController {
  constructor(
    private readonly vouchersService: VouchersService,
    private readonly ocrService: OcrService,
    private readonly messageClassifier: WhatsAppMessageClassifierService,
  ) { }

  @Post('upload')
  @UseInterceptors(FileInterceptor('file'))
  async uploadFile(
    @UploadedFile(
      new ParseFilePipe({
        validators: [
          new MaxFileSizeValidator({ maxSize: 10 * 1024 * 1024 }), // 10MB
          new FileTypeValidator({ fileType: '.(csv|txt|json|xml)' }),
        ],
      }),
    )
    file: Express.Multer.File,
    @Body() processFileDto: ProcessFileDto,
  ) {
    try {
      const result = await this.vouchersService.processFile(
        file,
        processFileDto,
      );
      return {
        message: 'Archivo procesado exitosamente',
        ...result,
      };
    } catch (error) {
      throw new BadRequestException(error.message);
    }
  }

  @Post('ocr-service')
  @UseInterceptors(FileInterceptor('file'))
  async processOcr(
    @UploadedFile(
      new ParseFilePipe({
        validators: [
          new MaxFileSizeValidator({ maxSize: 10 * 1024 * 1024 }), // 10MB
          new FileTypeValidator({
            fileType: '.(jpg|jpeg|png|gif|bmp|webp|tiff|pdf)',
          }),
        ],
      }),
    )
    file: Express.Multer.File,
    @Body() ocrServiceDto: OcrServiceDto,
  ) {
    try {
      // Validar formato de imagen
      await this.ocrService.validateImageFormat(file.buffer, file.originalname);

      // Procesar OCR
      const resultOCR = await this.ocrService.extractTextFromImage(
        file.buffer,
        file.originalname,
        ocrServiceDto.language,
      );
      const dataWithHouse = this.extractCentavos(resultOCR.structuredData);

      // Generar respuesta según los casos
      const whatsappMessage = this.generateWhatsAppMessage(dataWithHouse);

      return {
        ...resultOCR,
        structuredData: dataWithHouse,
        whatsappMessage,
      };
    } catch (error) {
      throw new BadRequestException(error.message);
    }
  }

  /**
   * TODO: Verificar si es funcional en producción, sino es así, eliminar este endpoint.
   * @returns JSON con el estado de configuración del servicio OCR (Google Cloud)
   */
  @Get('ocr-service/status')
  async getOcrStatus(): Promise<{
    isConfigured: boolean;
    services: {
      vision: boolean;
      storage: boolean;
      translate: boolean;
      textToSpeech: boolean;
      speech: boolean;
    };
    projectId?: string;
    message: string;
  }> {
    try {
      const visionClient =
        this.ocrService['googleCloudClient'].getVisionClient();
      const storageClient =
        this.ocrService['googleCloudClient'].getStorageClient();
      const translateClient =
        this.ocrService['googleCloudClient'].getTranslateClient();
      const textToSpeechClient =
        this.ocrService['googleCloudClient'].getTextToSpeechClient();
      const speechClient =
        this.ocrService['googleCloudClient'].getSpeechClient();

      const config = this.ocrService['googleCloudClient'].getConfig();

      return {
        isConfigured: this.ocrService['googleCloudClient'].isReady(),
        services: {
          vision: !!visionClient,
          storage: !!storageClient,
          translate: !!translateClient,
          textToSpeech: !!textToSpeechClient,
          speech: !!speechClient,
        },
        projectId: config?.projectId,
        message: this.ocrService['googleCloudClient'].isReady()
          ? 'Google Cloud está configurado y funcionando correctamente'
          : 'Google Cloud no está configurado o hay errores en la configuración',
      };
    } catch (error) {
      return {
        isConfigured: false,
        services: {
          vision: false,
          storage: false,
          translate: false,
          textToSpeech: false,
          speech: false,
        },
        message: `Error al verificar configuración: ${error.message}`,
      };
    }
  }

  @Get()
  async getAllTransactions(
    @Query('status') status?: 'pending' | 'processed' | 'failed',
    @Query('startDate') startDate?: string,
    @Query('endDate') endDate?: string,
  ) {
    if (status) {
      return await this.vouchersService.getTransactionsByStatus(status);
    }

    if (startDate && endDate) {
      const start = new Date(startDate);
      const end = new Date(endDate);
      return await this.vouchersService.getTransactionsByDateRange(start, end);
    }

    return await this.vouchersService.getAllTransactions();
  }

  /**
   * TODO: Verificar si es funcional en producción, sino es así, eliminar este endpoint.
   * @returns Resumen de transacciones: total, por estado, por categoría, etc.
   */
  @Get('summary')
  async getTransactionSummary() {
    return await this.vouchersService.getTransactionSummary();
  }

  @Get(':id')
  async getTransactionById(
    @Param('id') id: string,
  ): Promise<ProcessedTransaction> {
    return await this.vouchersService.getTransactionById(id);
  }

  @Post()
  async createTransaction(
    @Body() createTransactionDto: CreateTransactionDto,
  ): Promise<ProcessedTransaction> {
    return await this.vouchersService.createTransaction(createTransactionDto);
  }

  @Put(':id')
  async updateTransaction(
    @Param('id') id: string,
    @Body() updateTransactionDto: UpdateTransactionDto,
  ): Promise<ProcessedTransaction> {
    return await this.vouchersService.updateTransaction(
      id,
      updateTransactionDto,
    );
  }

  @Delete(':id')
  async deleteTransaction(
    @Param('id') id: string,
  ): Promise<{ message: string }> {
    await this.vouchersService.deleteTransaction(id);
    return { message: 'Transacción eliminada exitosamente' };
  }

  @Get('webhook/whatsapp')
  verifyWebhook(
    @Query('hub.mode') mode?: string,
    @Query('hub.challenge') challenge?: string,
    @Query('hub.verify_token') verifyToken?: string,
  ) {
    const expectedToken = process.env.ACCESS_TOKEN_VERIFY_WA;

    if (!expectedToken) {
      throw new UnauthorizedException('Access token not configured');
    }

    if (mode === 'subscribe' && verifyToken === expectedToken) {
      return challenge;
    }

    throw new UnauthorizedException('Invalid verification token');
  }

  /**
   * Procesa mensajes entrantes desde el webhook de WhatsApp.
   * Este endpoint recibe las notificaciones de mensajes enviados por usuarios de WhatsApp.
   * Usa IA para clasificar el mensaje y determinar la respuesta apropiada.
   *
   * @param body - Payload del webhook de WhatsApp con la estructura de mensajes
   * @returns Objeto con status de éxito
   * @throws BadRequestException si hay error procesando el mensaje
   */
  @Post('webhook/whatsapp')
  async receiveWhatsAppMessage(@Body() body: any) {
    try {
      // Extraer datos del webhook de WhatsApp
      const entry = body.entry?.[0];
      const changes = entry?.changes?.[0];
      const value = changes?.value;
      const messages = value?.messages?.[0];

      if (messages) {
        const phoneNumber = messages.from;
        const messageText = messages.text?.body || '';

        console.log('Número de WhatsApp:', phoneNumber);
        console.log('Mensaje recibido:', messageText);

        // Clasificar el mensaje usando IA
        const classification = await this.messageClassifier.classifyMessage(messageText);

        console.log('Clasificación:', {
          intent: classification.intent,
          confidence: classification.confidence,
        });

        // Enviar respuesta basada en la clasificación
        await this.sendWhatsAppMessage(phoneNumber, classification.response);
      }

      return { success: true };
    } catch (error) {
      console.error('Error procesando mensaje de WhatsApp:', error);
      throw new BadRequestException('Error processing WhatsApp message');
    }
  }

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

  private generateCSV(transactions: ProcessedTransaction[]): string {
    const headers = [
      'ID',
      'Fecha',
      'Descripción',
      'Monto',
      'Tipo',
      'Número de Cuenta',
      'Referencia',
      'Categoría',
      'Estado',
      'Fecha de Creación',
    ];

    const rows = transactions.map((transaction) => [
      transaction.id,
      transaction.date.toISOString().split('T')[0],
      `"${transaction.description.replace(/"/g, '""')}"`,
      transaction.amount,
      transaction.type,
      transaction.accountNumber,
      transaction.reference || '',
      transaction.category || '',
      transaction.status,
      transaction.createdAt.toISOString(),
    ]);

    const csvContent = [
      headers.join(','),
      ...rows.map((row) => row.join(',')),
    ].join('\n');
    return csvContent;
  }

  /**
   * Envía un mensaje de texto a través de WhatsApp Business API
   * @param to Número de teléfono del destinatario
   * @param message Mensaje de texto a enviar
   */
  private async sendWhatsAppMessage(
    to: string,
    message: string,
  ): Promise<void> {
    try {
      const token = process.env.TOKEN_WA;
      const phoneNumberId = process.env.PHONE_NUMBER_ID_WA;

      if (!token || !phoneNumberId) {
        console.error(
          'WhatsApp no está configurado correctamente (falta TOKEN_WA o PHONE_NUMBER_ID_WA)',
        );
        return;
      }

      const url = `https://graph.facebook.com/v23.0/${phoneNumberId}/messages`;

      const response = await fetch(url, {
        method: 'POST',
        headers: {
          Authorization: `Bearer ${token}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          messaging_product: 'whatsapp',
          recipient_type: 'individual',
          to: to,
          type: 'text',
          text: {
            preview_url: false,
            body: message,
          },
        }),
      });

      const data = await response.json();

      if (!response.ok) {
        console.error(
          `Error al enviar mensaje de WhatsApp: ${JSON.stringify(data)}`,
        );
      } else {
        console.log(`Mensaje enviado exitosamente a ${to}`);
      }
    } catch (error) {
      console.error(`Error al enviar mensaje de WhatsApp: ${error.message}`);
    }
  }
}
