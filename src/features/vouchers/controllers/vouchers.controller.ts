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
import { OcrServiceDto } from '../dto/ocr-service.dto';
import { WhatsAppMessageClassifierService } from '../services/whatsapp-message-classifier.service';
import { VoucherProcessorService } from '../services/voucher-processor.service';
import { WhatsAppMediaService } from '../services/whatsapp-media.service';

@Controller('vouchers')
export class VouchersController {
  constructor(
    private readonly vouchersService: VouchersService,
    private readonly ocrService: OcrService,
    private readonly messageClassifier: WhatsAppMessageClassifierService,
    private readonly voucherProcessor: VoucherProcessorService,
    private readonly whatsappMedia: WhatsAppMediaService,
  ) {}

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
      // Procesar voucher usando el servicio unificado
      const result = await this.voucherProcessor.processVoucher(
        file.buffer,
        file.originalname,
        ocrServiceDto.language,
      );

      return {
        structuredData: result.structuredData,
        whatsappMessage: result.whatsappMessage,
        originalFilename: result.originalFilename,
        gcsFilename: result.gcsFilename,
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
   * Si recibe una imagen o PDF, procesa el comprobante de pago automáticamente.
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
        const messageType = messages.type; // 'text', 'image', 'document', etc.

        console.log('Número de WhatsApp:', phoneNumber);
        console.log('Tipo de mensaje:', messageType);

        // CASO 1: Mensaje con imagen
        if (messageType === 'image' && messages.image) {
          const mediaId = messages.image.id;
          const mimeType = messages.image.mime_type;
          const caption = messages.image.caption || '';

          console.log(`Imagen recibida: ${mediaId}, tipo: ${mimeType}`);
          if (caption) console.log(`Caption: ${caption}`);

          await this.processWhatsAppMedia(phoneNumber, mediaId, 'image');
          return { success: true };
        }

        // CASO 2: Mensaje con documento (PDF)
        if (messageType === 'document' && messages.document) {
          const mediaId = messages.document.id;
          const mimeType = messages.document.mime_type;
          const filename = messages.document.filename || 'documento.pdf';

          console.log(`
            Documento recibido: ${mediaId}, tipo: ${mimeType}, nombre: ${filename}`);

          // Solo procesar si es PDF
          if (mimeType === 'application/pdf') {
            await this.processWhatsAppMedia(phoneNumber, mediaId, 'document');
          } else {
            await this.sendWhatsAppMessage(
              phoneNumber,
              'Solo puedo procesar documentos PDF. Por favor envía tu comprobante como imagen o PDF.',
            );
          }
          return { success: true };
        }

        // CASO 3: Mensaje de texto
        if (messageType === 'text' && messages.text) {
          const messageText = messages.text.body || '';
          console.log('Mensaje de texto recibido:', messageText);

          // Clasificar el mensaje usando IA
          const classification =
            await this.messageClassifier.classifyMessage(messageText);

          console.log('Clasificación:', {
            intent: classification.intent,
            confidence: classification.confidence,
          });

          // Enviar respuesta basada en la clasificación
          await this.sendWhatsAppMessage(phoneNumber, classification.response);
          return { success: true };
        }

        // CASO 4: Otros tipos de mensaje no soportados
        console.log(`Tipo de mensaje no soportado: ${messageType}`);
        await this.sendWhatsAppMessage(
          phoneNumber,
          'Por favor envía un comprobante de pago como imagen o PDF, o escribe tu consulta sobre pagos.',
        );
      }

      return { success: true };
    } catch (error) {
      console.error('Error procesando mensaje de WhatsApp:', error);
      throw new BadRequestException('Error processing WhatsApp message');
    }
  }

  /**
   * Procesa un archivo multimedia (imagen o PDF) recibido desde WhatsApp
   * Descarga el archivo, lo procesa con OCR y envía la respuesta
   */
  private async processWhatsAppMedia(
    phoneNumber: string,
    mediaId: string,
    mediaType: 'image' | 'document',
  ): Promise<void> {
    try {
      console.log(`Descargando ${mediaType} de WhatsApp: ${mediaId}`);

      // 1. Descargar el archivo desde WhatsApp
      const { buffer, mimeType, filename } =
        await this.whatsappMedia.downloadMedia(mediaId);

      console.log(
        `Archivo descargado: ${filename}, tamaño: ${buffer.length} bytes`,
      );

      // 2. Validar que el tipo de archivo sea soportado
      if (!this.whatsappMedia.isSupportedMediaType(mimeType)) {
        await this.sendWhatsAppMessage(
          phoneNumber,
          `El tipo de archivo ${mimeType} no es soportado. Por favor envía una imagen (JPG, PNG, etc.) o PDF, para registrar tu pago`,
        );
        return;
      }

      // 3. Procesar el comprobante usando el servicio unificado
      const result = await this.voucherProcessor.processVoucher(
        buffer,
        filename,
        'es', // Idioma español por defecto
        phoneNumber, // Para tracking
      );

      // 4. Enviar respuesta con el resultado del procesamiento
      await this.sendWhatsAppMessage(phoneNumber, result.whatsappMessage);

      console.log(`Comprobante procesado y respuesta enviada a ${phoneNumber}`);
    } catch (error) {
      console.error(`Error procesando media de WhatsApp: ${error.message}`);
      await this.sendWhatsAppMessage(
        phoneNumber,
        'Hubo un error al procesar tu comprobante. Por favor intenta nuevamente o envía una imagen más clara.',
      );
    }
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
