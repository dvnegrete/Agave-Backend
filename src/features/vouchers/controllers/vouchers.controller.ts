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
  NotFoundException,
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
import { WhatsAppMessagingService } from '../services/whatsapp-messaging.service';
import {
  ConversationStateService,
  ConversationState,
} from '../services/conversation-state.service';
import {
  ConfirmationMessages,
  ErrorMessages,
  ContextualMessages,
  OffTopicMessages,
} from '@/shared/content';
import { VoucherRepository } from '@/shared/database/repositories/voucher.repository';
import { CloudStorageService } from '@/shared/libs/google-cloud';

@Controller('vouchers')
export class VouchersController {
  constructor(
    private readonly vouchersService: VouchersService,
    private readonly ocrService: OcrService,
    private readonly messageClassifier: WhatsAppMessageClassifierService,
    private readonly voucherProcessor: VoucherProcessorService,
    private readonly whatsappMedia: WhatsAppMediaService,
    private readonly whatsappMessaging: WhatsAppMessagingService,
    private readonly conversationState: ConversationStateService,
    private readonly voucherRepository: VoucherRepository,
    private readonly cloudStorageService: CloudStorageService,
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
      const translateClient =
        this.ocrService['googleCloudClient'].getTranslateClient();
      const textToSpeechClient =
        this.ocrService['googleCloudClient'].getTextToSpeechClient();
      const speechClient =
        this.ocrService['googleCloudClient'].getSpeechClient();

      const config = this.ocrService['googleCloudClient'].getConfig();

      // Verificar Cloud Storage usando CloudStorageService
      let storageAvailable = false;
      try {
        const storageClient = this.ocrService['googleCloudClient'].getStorageClient();
        storageAvailable = !!storageClient;
      } catch {
        storageAvailable = false;
      }

      return {
        isConfigured: this.ocrService['googleCloudClient'].isReady(),
        services: {
          vision: !!visionClient,
          storage: storageAvailable,
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
    @Query('confirmation_status') confirmationStatus?: string,
    @Query('startDate') startDate?: string,
    @Query('endDate') endDate?: string,
  ) {
    // Filtrar por confirmation_status (true = confirmado, false = pendiente)
    if (confirmationStatus !== undefined) {
      const isConfirmed = confirmationStatus === 'true';
      return await this.vouchersService.getTransactionsByStatus(isConfirmed);
    }

    // Filtrar por rango de fechas
    if (startDate && endDate) {
      const start = new Date(startDate);
      const end = new Date(endDate);
      return await this.vouchersService.getTransactionsByDateRange(start, end);
    }

    // Retornar todos los vouchers
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

  /**
   * Obtiene un voucher por ID y genera URL firmada para visualizar el archivo
   * @param id - ID del voucher en la base de datos
   * @returns Datos del voucher con URL de visualización temporal
   */
  @Get(':id')
  async getTransactionById(@Param('id') id: string) {
    // Buscar voucher en la base de datos
    const voucher = await this.voucherRepository.findById(parseInt(id));

    if (!voucher) {
      throw new NotFoundException(`Voucher con ID ${id} no encontrado`);
    }

    // Generar URL firmada si existe el archivo en Cloud Storage
    let viewUrl: string | null = null;
    if (voucher.url) {
      try {
        // Generar URL firmada válida por 1 hora
        viewUrl = await this.cloudStorageService.getSignedUrl(voucher.url, {
          expiresInMinutes: 60,
          action: 'read',
        });
      } catch (error) {
        console.error(
          `⚠️  Error al generar URL de visualización para voucher ${id}: ${error.message}`,
        );
        // No detener la respuesta si falla la generación de URL
        viewUrl = null;
      }
    }

    return {
      confirmation_status: voucher.confirmation_status,
      url: voucher.url,
      viewUrl, // URL firmada para visualización temporal
    };
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
              ErrorMessages.onlyPdfSupported,
            );
          }
          return { success: true };
        }

        // CASO 3: Mensaje interactivo (botones o listas)
        if (messageType === 'interactive' && messages.interactive) {
          let userResponse: string | undefined;

          if (messages.interactive.type === 'button_reply') {
            userResponse = messages.interactive.button_reply.id; // ID del botón presionado
            console.log(`Botón presionado: ${userResponse}`);
          } else if (messages.interactive.type === 'list_reply') {
            userResponse = messages.interactive.list_reply.id; // ID de la opción seleccionada
            console.log(`Opción de lista seleccionada: ${userResponse}`);
          }

          // Validar que se haya recibido una respuesta
          if (!userResponse) {
            console.log('Mensaje interactivo sin respuesta identificable');
            return { success: true };
          }

          // Procesar según el estado de la conversación
          const context = this.conversationState.getContext(phoneNumber);

          if (context) {
            console.log(`Contexto activo detectado: ${context.state}`);

            // Actualizar timestamp de último mensaje
            this.conversationState.updateLastMessageTime(phoneNumber);

            // Manejar según el estado del contexto
            await this.handleContextualMessage(phoneNumber, userResponse, context.state);
            return { success: true };
          }

          return { success: true };
        }

        // CASO 4: Mensaje de texto
        if (messageType === 'text' && messages.text) {
          const messageText = messages.text.body || '';
          console.log('Mensaje de texto recibido:', messageText);

          // PRIMERO: Verificar si hay un contexto de conversación activo
          const context = this.conversationState.getContext(phoneNumber);

          if (context) {
            console.log(`Contexto activo detectado: ${context.state}`);

            // Actualizar timestamp de último mensaje
            this.conversationState.updateLastMessageTime(phoneNumber);

            // Manejar según el estado del contexto
            await this.handleContextualMessage(phoneNumber, messageText, context.state);
            return { success: true };
          }

          // Si NO hay contexto, procesar normalmente con el clasificador de IA
          console.log('No hay contexto activo, clasificando mensaje...');

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

        // CASO 5: Otros tipos de mensaje no soportados
        console.log(`Tipo de mensaje no soportado: ${messageType}`);
        await this.sendWhatsAppMessage(
          phoneNumber,
          ErrorMessages.unsupportedMessageType,
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
          ErrorMessages.unsupportedFileType(mimeType),
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

      // 4. Guardar contexto según el resultado
      const voucherData = result.structuredData;

      if (!voucherData.faltan_datos && typeof voucherData.casa === 'number') {
        // CASO 1: Datos completos, guardar para esperar confirmación (SIN código aún)
        this.conversationState.saveVoucherForConfirmation(
          phoneNumber,
          voucherData,
          result.gcsFilename,
          result.originalFilename,
          // NO pasamos confirmationCode aquí - se generará después del INSERT
        );
        console.log(
          `Esperando confirmación de ${phoneNumber} para voucher con casa ${voucherData.casa}`,
        );

        // 5a. Enviar mensaje de confirmación con botones interactivos
        await this.sendWhatsAppButtonMessage(
          phoneNumber,
          result.whatsappMessage,
          [
            { id: 'confirm', title: '✅ Sí, es correcto' },
            { id: 'cancel', title: '❌ No, cancelar' },
          ],
        );
      } else if (!voucherData.faltan_datos && voucherData.casa === null) {
        // CASO 2: Falta número de casa, guardar y esperar respuesta
        this.conversationState.setContext(
          phoneNumber,
          ConversationState.WAITING_HOUSE_NUMBER,
          {
            voucherData,
            gcsFilename: result.gcsFilename,
            originalFilename: result.originalFilename,
          },
        );
        console.log(`Esperando número de casa de ${phoneNumber}`);

        // 5b. Enviar mensaje de texto (pregunta por número de casa)
        await this.sendWhatsAppMessage(phoneNumber, result.whatsappMessage);
      } else if (voucherData.faltan_datos) {
        // CASO 3: Faltan datos, guardar y esperar respuesta
        this.conversationState.setContext(
          phoneNumber,
          ConversationState.WAITING_MISSING_DATA,
          {
            voucherData,
            gcsFilename: result.gcsFilename,
            originalFilename: result.originalFilename,
          },
        );
        console.log(`Esperando datos faltantes de ${phoneNumber}`);

        // 5c. Enviar mensaje de texto (pregunta por datos faltantes)
        await this.sendWhatsAppMessage(phoneNumber, result.whatsappMessage);
      }

      console.log(`Comprobante procesado y respuesta enviada a ${phoneNumber}`);
    } catch (error) {
      console.error(`Error procesando media de WhatsApp: ${error.message}`);
      await this.sendWhatsAppMessage(
        phoneNumber,
        ErrorMessages.processingError,
      );
    }
  }

  /**
   * Maneja mensajes de texto según el contexto de conversación activo
   */
  private async handleContextualMessage(
    phoneNumber: string,
    messageText: string,
    state: ConversationState,
  ): Promise<void> {
    switch (state) {
      case ConversationState.WAITING_CONFIRMATION:
        await this.handleConfirmation(phoneNumber, messageText);
        break;

      case ConversationState.WAITING_HOUSE_NUMBER:
        await this.handleHouseNumberResponse(phoneNumber, messageText);
        break;

      case ConversationState.WAITING_MISSING_DATA:
        await this.handleMissingDataResponse(phoneNumber, messageText);
        break;

      default:
        console.log(`Estado no manejado: ${state}`);
        this.conversationState.clearContext(phoneNumber);
        await this.sendWhatsAppMessage(phoneNumber, ErrorMessages.systemError);
    }
  }

  /**
   * Maneja la confirmación del usuario (SI/NO o botones interactivos)
   */
  private async handleConfirmation(
    phoneNumber: string,
    messageText: string,
  ): Promise<void> {
    // Detectar confirmación: texto "SI" o botón ID "confirm"
    const isConfirmation =
      messageText === 'confirm' ||
      this.conversationState.isConfirmationMessage(messageText);

    // Detectar negación: texto "NO" o botón ID "cancel"
    const isNegation =
      messageText === 'cancel' ||
      this.conversationState.isNegationMessage(messageText);

    if (isConfirmation) {
      // Usuario confirmó, proceder con el registro
      const savedData =
        this.conversationState.getVoucherDataForConfirmation(phoneNumber);

      if (!savedData) {
        await this.sendWhatsAppMessage(
          phoneNumber,
          ErrorMessages.sessionExpired,
        );
        this.conversationState.clearContext(phoneNumber);
        return;
      }

      console.log(
        `✅ Usuario ${phoneNumber} confirmó el pago. Datos:`,
        savedData.voucherData,
      );

      // PASO 1: Generar código de confirmación único
      const confirmationCode = this.voucherProcessor.generateConfirmationCode();
      console.log(`🔐 Código de confirmación generado: ${confirmationCode}`);

      // PASO 2: Insertar voucher en la base de datos
      try {
        const voucher = await this.voucherRepository.create({
          date: savedData.voucherData.fecha_pago,
          authorization_number: savedData.voucherData.referencia,
          confirmation_code: confirmationCode,
          amount: parseFloat(savedData.voucherData.monto),
          confirmation_status: false, // Pendiente verificación en banco
          url: savedData.gcsFilename,
        });

        console.log(
          `✅ Voucher insertado en BD con ID: ${voucher.id}, Código: ${voucher.confirmation_code}`,
        );
      } catch (error) {
        console.error('❌ Error al insertar voucher en BD:', error);
        await this.sendWhatsAppMessage(
          phoneNumber,
          'Hubo un error al registrar tu pago. Por favor intenta nuevamente más tarde.',
        );
        this.conversationState.clearContext(phoneNumber);
        return;
      }

      // PASO 3: Enviar mensaje de éxito con el código de confirmación
      const confirmationData = {
        casa: savedData.voucherData.casa!,
        monto: savedData.voucherData.monto,
        fecha_pago: savedData.voucherData.fecha_pago,
        referencia: savedData.voucherData.referencia,
        hora_transaccion: savedData.voucherData.hora_transaccion,
        confirmation_code: confirmationCode, // ⬅️ Ahora sí incluimos el código
      };

      await this.sendWhatsAppMessage(
        phoneNumber,
        ConfirmationMessages.success(confirmationData),
      );

      // Limpiar contexto
      this.conversationState.clearContext(phoneNumber);
    } else if (isNegation) {
      // Usuario canceló
      console.log(`❌ Usuario ${phoneNumber} canceló el registro`);

      // TODO: Implementar flujo de corrección de datos
      // En lugar de solo cancelar, permitir que el usuario:
      // 1. Indique qué datos son incorrectos (monto, fecha, casa, referencia, etc.)
      // 2. Proporcione los datos correctos mediante mensajes de WhatsApp
      // 3. Actualice los datos extraídos con la información corregida
      // 4. Vuelva a solicitar confirmación con los datos actualizados
      //
      // Flujo propuesto:
      // - Estado: WAITING_CORRECTION_TYPE (qué dato corregir)
      // - Estado: WAITING_CORRECTION_VALUE (nuevo valor del dato)
      // - Volver a WAITING_CONFIRMATION con datos actualizados
      //
      // Actualmente: solo cancela y elimina el archivo

      // Obtener datos guardados para eliminar el archivo
      const savedData =
        this.conversationState.getVoucherDataForConfirmation(phoneNumber);

      if (savedData?.gcsFilename) {
        try {
          // Eliminar archivo de Cloud Storage
          await this.cloudStorageService.deleteFile(savedData.gcsFilename);
          console.log(
            `🗑️  Archivo eliminado de GCS: ${savedData.gcsFilename}`,
          );
        } catch (error) {
          console.error(
            `⚠️  Error al eliminar archivo de GCS: ${error.message}`,
          );
          // No detenemos el flujo si falla la eliminación
        }
      }

      await this.sendWhatsAppMessage(
        phoneNumber,
        ConfirmationMessages.cancelled,
      );

      this.conversationState.clearContext(phoneNumber);
    } else {
      // Mensaje no reconocido, pedir confirmación nuevamente
      await this.sendWhatsAppMessage(phoneNumber, ConfirmationMessages.retry);
    }
  }

  /**
   * Maneja la respuesta del usuario con el número de casa
   */
  private async handleHouseNumberResponse(
    phoneNumber: string,
    messageText: string,
  ): Promise<void> {
    const houseNumber = this.conversationState.extractHouseNumber(messageText);

    if (houseNumber) {
      const context = this.conversationState.getContext(phoneNumber);
      const voucherData = context?.data?.voucherData;

      if (!voucherData) {
        await this.sendWhatsAppMessage(
          phoneNumber,
          ErrorMessages.sessionExpired,
        );
        this.conversationState.clearContext(phoneNumber);
        return;
      }

      // Actualizar los datos con el número de casa
      voucherData.casa = houseNumber;

      console.log(
        `🏠 Usuario ${phoneNumber} proporcionó número de casa: ${houseNumber}`,
      );

      // Guardar para confirmación (SIN código de confirmación aún)
      // El código se generará después del INSERT en BD
      this.conversationState.saveVoucherForConfirmation(
        phoneNumber,
        voucherData,
        context.data?.gcsFilename,
        context.data?.originalFilename,
        // NO generamos código aquí - se generará después del INSERT
      );

      // Pedir confirmación con botones interactivos
      const confirmationData = {
        casa: voucherData.casa,
        monto: voucherData.monto,
        fecha_pago: voucherData.fecha_pago,
        referencia: voucherData.referencia,
        hora_transaccion: voucherData.hora_transaccion,
      };

      await this.sendWhatsAppButtonMessage(
        phoneNumber,
        ConfirmationMessages.request(confirmationData),
        [
          { id: 'confirm', title: '✅ Sí, es correcto' },
          { id: 'cancel', title: '❌ No, cancelar' },
        ],
      );
    } else {
      await this.sendWhatsAppMessage(
        phoneNumber,
        ContextualMessages.invalidHouseNumber,
      );
    }
  }

  /**
   * Maneja la respuesta del usuario con datos faltantes
   */
  private async handleMissingDataResponse(
    phoneNumber: string,
    messageText: string,
  ): Promise<void> {
    // TODO: Implementar lógica para procesar datos faltantes proporcionados por el usuario
    console.log(
      `📝 Usuario ${phoneNumber} proporcionó datos faltantes: ${messageText}`,
    );

    await this.sendWhatsAppMessage(
      phoneNumber,
      ContextualMessages.missingDataReceived,
    );

    this.conversationState.clearContext(phoneNumber);
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
    await this.whatsappMessaging.sendTextMessage(to, message);
  }

  /**
   * Envía un mensaje con botones interactivos (SI/NO) a través de WhatsApp Business API
   * @param to Número de teléfono del destinatario
   * @param bodyText Texto del mensaje
   * @param buttons Arreglo de botones con id y título (máximo 3)
   */
  private async sendWhatsAppButtonMessage(
    to: string,
    bodyText: string,
    buttons: Array<{ id: string; title: string }>,
  ): Promise<void> {
    await this.whatsappMessaging.sendButtonMessage(to, bodyText, buttons);
  }
}
